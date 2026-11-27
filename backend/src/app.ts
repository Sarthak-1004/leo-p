import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { type Db, Prisma, retryableTransactionError } from "./db.js";
import { storageOrigins, trustProxySetting, type Config } from "./config.js";
import { authenticate, hashPassword, type Authenticated, type Identity } from "./auth.js";
import { assert, ApiError } from "./domain.js";
import { ActionLimiter } from "./action-limit.js";
import { loggerOptions, registerRequestMetrics, reportableError, requestId, traceFields } from "./observability.js";
import { Storage } from "./storage.js";
// Routes that need no session. /api/metrics checks its own bearer token.
const publicRoutes = ["/api/health", "/api/health/ready", "/api/metrics", "/api/institution"];
import type { RouteContext } from "./routes/context.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBootstrapRoutes } from "./routes/bootstrap.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerContentRoutes } from "./routes/content.js";
import { registerSupportRoutes } from "./routes/support.js";
import { registerAttemptRoutes } from "./routes/attempts.js";
import { registerResultRoutes } from "./routes/results.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerOperationsRoutes } from "./routes/operations.js";
declare module "fastify" {
  interface FastifyRequest {
    auth?: Authenticated;
  }
  interface FastifyContextConfig {
    portalApi?: boolean;
    publicApi?: boolean;
    allowInactive?: boolean;
  }
}
export async function buildApp(db: Db, config: Config) {
  const app = Fastify({
    logger: loggerOptions(config),
    genReqId: requestId,
    trustProxy: trustProxySetting(config),
    bodyLimit: 1024 * 1024,
    requestTimeout: 30000,
  });
  // Classify declared routes, never attacker-controlled raw URL spellings.
  app.addHook("onRoute", route => {
    if (route.url.startsWith("/api/"))
      route.config = {
        ...route.config,
        portalApi: true,
        publicApi: publicRoutes.includes(route.url) || (route.url === "/api/auth/login" && route.method === "POST"),
        allowInactive: ["/api/auth/me", "/api/auth/logout"].includes(route.url),
      };
  });
  registerRequestMetrics(app);
  app.addHook("onSend", async (req, reply, payload) => {
    if (req.routeOptions.config.portalApi || req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  await app.register(cookie);
  // Transport backstop before authentication/database work. The socket may be a
  // shared gateway: this deliberately generous ceiling is not the login budget.
  // Canonical-account password/write limits remain durable in PostgreSQL.
  // 1,200 students saving every 3 s send about 24,000 requests a minute, and a gateway can present
  // them all from one address, so the default leaves room for a full sitting plus audio and dashboards.
  await app.register(rateLimit, {
    max: Number(process.env.REQUEST_LIMIT_PER_MINUTE) || 120000,
    timeWindow: 60000,
    cache: 2000,
    skipOnError: false,
  });
  // Route-level hooks run after global authentication hooks in Fastify. Run the
  // same limiter here first; its request marker prevents counting twice later.
  app.addHook("onRequest", app.rateLimit());
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Style elements and sheets come only from the site; React style attributes stay allowed.
        styleSrc: ["'self'"],
        styleSrcElem: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"],
        // Media and images: the site, local blobs/data and the exact storage origin for presigned URLs.
        imgSrc: ["'self'", "data:", "blob:", ...storageOrigins(config)],
        mediaSrc: ["'self'", "blob:", ...storageOrigins(config)],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(multipart, { limits: { files: 1, fileSize: 20 * 1024 * 1024, fields: 4, parts: 5 } });
  const storage = new Storage(config);
  app.addHook("onClose", async () => storage.close());
  const unknownAccountHash = await hashPassword("dummy-account-timing-value");
  const user = (req: FastifyRequest): Identity => {
    assert(req.auth, 401, "Sign in to continue");
    return req.auth.user;
  };
  const actions = new ActionLimiter(config.ACTION_LIMIT_PER_MINUTE);
  app.addHook("onClose", async () => actions.close());
  app.addHook("onRequest", async req => {
    const route = req.routeOptions.config;
    if (!route.portalApi || route.publicApi) return;
    req.auth = await authenticate(db, req, config, route.allowInactive);
    if (req.method !== "GET") actions.hit(req.auth.user.id);
    const path = req.routeOptions.url ?? "",
      role = req.auth.user.role;
    const sensitive =
      (path.startsWith("/api/admin/") && role === "ADMIN") ||
      (path === "/api/results/release" && role === "ADMIN") ||
      (/^\/api\/results\/:id\/(evaluation|retry-ai)$/.test(path) && role !== "STUDENT");
    if (
      sensitive &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !(req.auth.reauthUntil && req.auth.reauthUntil > new Date())
    )
      throw new ApiError(403, "Confirm your password before continuing", "REAUTH_REQUIRED");
  });
  // Record IDs are UUIDs, and PostgreSQL rejects NUL in text: refuse both before any query.
  const uuidRoutes = /^\/api\/(attempts|results|notifications|assets|admin\/attempts|admin\/imports)\/:id(\/|$)/;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  app.addHook("preValidation", async req => {
    const id = (req.params as Record<string, string> | undefined)?.id;
    if (id !== undefined && uuidRoutes.test(req.routeOptions.url ?? ""))
      assert(uuidPattern.test(id), 404, "Record not found");
    assert(
      !JSON.stringify([req.query ?? null, req.params ?? null, req.body ?? null]).includes("\\u0000"),
      400,
      "Remove unsupported null characters",
    );
  });
  app.setErrorHandler((error, req, reply) => {
    if (retryableTransactionError(error))
      return reply.code(409).send({ message: "This record changed during saving. Reload and try again" });
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        message: "Check the submitted fields",
        issues: error.issues.map(i => ({ path: i.path.join("."), message: i.message })),
      });
    // P2028: no pooled connection became free in time (a burst). Safe to retry; nothing was committed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028")
      return reply
        .code(503)
        .header("Retry-After", "3")
        .send({ message: "The portal is busy. Please try again in a few seconds", code: "BUSY" });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2025", "P2034"].includes(error.code))
      return reply
        .code(409)
        .send({ message: "The record changed or this identifier is already in use. Refresh and try again" });
    if (error instanceof ApiError)
      return reply.code(error.statusCode).send({ message: error.message, ...(error.code ? { code: error.code } : {}) });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply.code(status).send({ message: error instanceof Error ? error.message : "Request failed" });
    req.log.error(
      { ...reportableError(error), ...traceFields(req), route: req.routeOptions.url, method: req.method },
      "Request failed",
    );
    return reply.code(500).send({ message: "The operation could not be completed. Please try again" });
  });
  const ctx: RouteContext = { db, config, storage, user, unknownAccountHash };
  registerSystemRoutes(app, ctx);
  registerAuthRoutes(app, ctx);
  registerBootstrapRoutes(app, ctx);
  registerAccountRoutes(app, ctx);
  registerContentRoutes(app, ctx);
  registerSupportRoutes(app, ctx);
  registerAttemptRoutes(app, ctx);
  registerResultRoutes(app, ctx);
  registerNotificationRoutes(app, ctx);
  registerMediaRoutes(app, ctx);
  registerReportRoutes(app, ctx);
  registerOperationsRoutes(app, ctx);
  const dist = resolve(process.cwd(), "../frontend/dist");
  if (config.NODE_ENV === "production" && existsSync(dist)) {
    await app.register(staticFiles, { root: dist, wildcard: false });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ message: "API route not found" })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
