import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { Db, Tx } from "./db.js";
import type { User, Student } from "./generated/prisma/client.js";
import { ApiError, assert, today } from "./domain.js";
const scrypt = (password:string,salt:string) => new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,hash)=>error?reject(error):resolve(hash)));
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt);
  return `scrypt:32768:8:1:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, n, r, p, salt, hash] = stored.split(":");
  if (!n || !r || !p || !salt || !hash) return false;
  if(n!=="32768"||r!=="8"||p!=="1")return false;
  const derived = await scrypt(password, salt);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export type Identity = User & { student: Student | null };
export interface Authenticated { user: Identity; csrfToken: string; tokenHash: string; }
export async function authenticate(db: Db, req: FastifyRequest, config: Config, allowInactive = false): Promise<Authenticated> {
  const token = req.cookies.kanan_session;
  assert(token && token.length <= 256, 401, "Sign in to continue");
  const session = await db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { student: true } } } });
  assert(session && session.expiresAt > new Date() && session.user.enabled && session.authVersion === session.user.authVersion, 401, "Your session has ended. Sign in again");
  if (!["GET","HEAD","OPTIONS"].includes(req.method)) {
    assert(req.headers.origin === config.APP_ORIGIN, 403, "Request origin is not permitted");
    assert(req.headers["x-csrf-token"] === session.csrfToken, 403, "Refresh your session before saving");
  }
  if (session.user.role === "STUDENT" && !allowInactive) active(session.user, config);
  return { user: session.user, csrfToken: session.csrfToken, tokenHash: session.tokenHash };
}
export function active(user: Identity, config: Config) {
  const date = today(config.ACCESS_TIMEZONE);
  assert(user.enabled && user.student && user.student.startDate <= date && user.student.expiryDate >= date, 403, "Portal access is inactive. Contact the Kanan office");
}
export function staff(user: Identity) { assert(user.role === "ADMIN" || user.role === "TRAINER", 403, "Staff access required"); }
export function admin(user: Identity) { assert(user.role === "ADMIN", 403, "Admin access required"); }
export function studentOnly(user: Identity): asserts user is Identity & { student: Student } { assert(user.role === "STUDENT" && user.student, 403, "Student access required"); }
export async function throttle(db: Db, key: string, limit: number, seconds: number) {
  const now = new Date();
  const row = await db.$queryRaw<Array<{count:number}>>`INSERT INTO "LoginThrottle" ("key","count","resetAt") VALUES (${key},1,${new Date(now.getTime()+seconds*1000)}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "LoginThrottle"."resetAt" < ${now} THEN 1 ELSE "LoginThrottle"."count"+1 END, "resetAt" = CASE WHEN "LoginThrottle"."resetAt" < ${now} THEN ${new Date(now.getTime()+seconds*1000)} ELSE "LoginThrottle"."resetAt" END RETURNING "count"`;
  if (row[0]!.count > limit) throw new ApiError(429, "Too many requests. Try again later");
}
export async function sessionFor(db: Db, user: User, config: Config) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: digest(token), userId: user.id, authVersion: user.authVersion, csrfToken, expiresAt: new Date(Date.now()+config.SESSION_HOURS*3600000) } });
  return { token, csrfToken };
}
export const academicSelect = { id:true, course:true, startDate:true, expiryDate:true, trainerId:true, user:{select:{name:true,enabled:true}} } as const;
export async function audit(tx: Tx | Db, actorId: string, action: string, target: string, detail: object = {}) {
  await tx.auditLog.create({ data: { actorId, action, target, detail } });
}
export async function notify(tx: Tx | Db, userId: string, title: string, href: string) {
  await tx.notification.create({ data: { userId, title, href } });
}
