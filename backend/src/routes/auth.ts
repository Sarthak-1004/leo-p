import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  audit,
  digest,
  hashPassword,
  passwordNeedsRehash,
  sessionFor,
  throttle,
  throttleCount,
  verifyPassword,
} from "../auth.js";
import { assert } from "../domain.js";
import { userView } from "../views.js";
import { LEGACY_SESSION_COOKIE, secureCookies, sessionCookieName } from "../config.js";
import { reauthenticate } from "../reauth.js";
import { securityAlert } from "../security.js";
import type { RouteContext } from "./context.js";

// Sign-in, password confirmation, current user and sign-out.
export function registerAuthRoutes(app: FastifyInstance, { db, config, user, unknownAccountHash }: RouteContext) {
  app.post("/api/auth/login", async (req, reply) => {
    assert(req.headers.origin === config.APP_ORIGIN, 403, "Request origin is not permitted");
    const input = z
      .object({
        role: z.enum(["student", "trainer", "admin"]),
        identifier: z.string().trim().min(1).max(200),
        password: z.string().min(1).max(128),
      })
      .strict()
      .parse(req.body);
    // Contact emails stay inside this authentication lookup, never Trainer DTOs.
    // Shared/ambiguous emails cannot choose an arbitrary account; assigned IDs work.
    const byId = await db.user.findUnique({ where: { id: input.identifier }, include: { student: true } });
    const matches = byId
      ? []
      : await db.user.findMany({
          where: {
            OR: [
              { email: { equals: input.identifier, mode: "insensitive" } },
              { role: "STUDENT", student: { contacts: { email: { equals: input.identifier, mode: "insensitive" } } } },
            ],
          },
          include: { student: true },
          take: 2,
        });
    const u = byId ?? (matches.length === 1 ? matches[0] : null);
    // An untrusted gateway IP may represent the entire institution. Never let
    // unrelated identifiers exhaust one low shared login bucket. Aliases of an
    // existing account share its canonical key, including across requested roles.
    const account = digest(u ? `user:${u.id}` : `unknown:${input.identifier.toLowerCase()}`);
    // Only failures count, and a success clears them. A browser that previously signed in to
    // this account keeps its own failure budget, so a stranger's wrong guesses (which share the
    // account budget) cannot lock the student out of their usual device.
    const deviceToken = req.cookies.kanan_device;
    const device =
      deviceToken && deviceToken.length <= 256
        ? await db.trustedDevice.findUnique({ where: { tokenHash: digest(deviceToken) } })
        : null;
    const trusted = !!u && device?.userId === u.id;
    const failKey = trusted ? `login-device-failed:${digest(deviceToken!)}` : `login-failed:${account}`;
    assert((await throttleCount(db, failKey)) < 12, 429, "Too many sign-in attempts. Try again in 15 minutes");
    // Equalize unknown-account password work without logging or retaining credentials.
    const valid = await verifyPassword(input.password, u?.passwordHash ?? unknownAccountHash);
    if (!(u && valid && u.enabled && u.role.toLowerCase() === input.role)) {
      const failed = await throttle(db, `login-failed:${account}`, 100000, 900);
      if (failed === 5) await securityAlert(db, "Repeated sign-in failures", account);
      if (trusted) await throttle(db, failKey, 100000, 900);
    }
    assert(u && valid && u.enabled && u.role.toLowerCase() === input.role, 401, "The ID or password is incorrect");
    await db.loginThrottle.deleteMany({ where: { key: { in: [`login-failed:${account}`, failKey] } } });
    if (trusted)
      await db.trustedDevice.update({ where: { tokenHash: digest(deviceToken!) }, data: { lastUsedAt: new Date() } });
    else {
      const token = randomBytes(32).toString("base64url");
      await db.trustedDevice.create({ data: { tokenHash: digest(token), userId: u.id } });
      reply.setCookie("kanan_device", token, {
        httpOnly: true,
        secure: secureCookies(config),
        sameSite: "strict",
        path: "/api/auth",
        maxAge: 180 * 86400,
      });
    }
    // CAS prevents a concurrent Admin password reset from being overwritten.
    if (passwordNeedsRehash(u.passwordHash))
      await db.user.updateMany({
        where: { id: u.id, passwordHash: u.passwordHash, authVersion: u.authVersion },
        data: { passwordHash: await hashPassword(input.password) },
      });
    const session = await sessionFor(db, u, config);
    const cookieName = sessionCookieName(config);
    reply.clearCookie("kanan_mfa", { path: "/" });
    if (cookieName !== LEGACY_SESSION_COOKIE && req.cookies[LEGACY_SESSION_COOKIE])
      reply.clearCookie(LEGACY_SESSION_COOKIE, { path: "/" });
    reply.setCookie(cookieName, session.token, {
      httpOnly: true,
      secure: secureCookies(config),
      sameSite: "strict",
      path: "/",
      maxAge: config.SESSION_HOURS * 3600,
    });
    await audit(db, u.id, "Signed in", u.id);
    return { user: userView(u, config), csrfToken: session.csrfToken };
  });
  app.post("/api/auth/reauth", async req => {
    const b = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    return reauthenticate(db, req.auth!, b.password);
  });
  app.get("/api/auth/me", async req => ({ user: userView(user(req), config), csrfToken: req.auth!.csrfToken }));
  app.post("/api/auth/logout", async (req, reply) => {
    await db.session.deleteMany({ where: { tokenHash: req.auth!.tokenHash } });
    reply.clearCookie(sessionCookieName(config), { path: "/", secure: secureCookies(config) });
    if (sessionCookieName(config) !== LEGACY_SESSION_COOKIE) reply.clearCookie(LEGACY_SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
