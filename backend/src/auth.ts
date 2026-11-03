import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { availableParallelism } from "node:os";
import type { FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { Db, Tx } from "./db.js";
import type { User, Student } from "./generated/prisma/client.js";
import { ApiError, assert, today } from "./domain.js";
// Keep memory bounded on the 512 MB testing service, including login bursts.
// p=3 provides the recommended work at N=2^15 without a 128 MB allocation per job.
// Each job needs about 32 MB. HASH_CONCURRENCY sets how many run at once (default: cores - 1,
// between 2 and 4). Hashes run on libuv's thread pool, so values above 4 also need a larger
// UV_THREADPOOL_SIZE. Throughput, not the queue, decides how fast a whole class can sign in.
const hashConcurrency=Math.max(1,Number(process.env.HASH_CONCURRENCY)||Math.min(4,Math.max(2,availableParallelism()-1)));
let hashing=0,averageMs=150;
const waiting:Array<()=>void>=[];
async function scrypt(password:string,salt:string,p:number) {
  if(hashing>=hashConcurrency){
    // Answer "busy" at once when the queue could not finish before the 30 s request timeout;
    // the sign-in page retries with back-off, so a whole class gets in instead of timing out.
    if((waiting.length+1)/hashConcurrency*averageMs>20000)throw new ApiError(503,"Many students are signing in. Retrying automatically…","BUSY");
    await new Promise<void>(resolve=>waiting.push(resolve));
  }
  else hashing++;
  const started=performance.now();
  try{return await new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,{N:32768,r:8,p,maxmem:64*1024*1024},(error,hash)=>error?reject(error):resolve(hash)));}
  finally{averageMs=averageMs*0.9+(performance.now()-started)*0.1;const next=waiting.shift();if(next)next();else hashing--;}
}
const currentHash=/^scrypt:32768:8:3:[a-f0-9]{32}:[a-f0-9]{128}$/;
export const passwordNeedsRehash=(stored:string)=>!currentHash.test(stored);
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt,3);
  return `scrypt:32768:8:3:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  if(!/^scrypt:32768:8:[13]:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored))return false;
  const [, , , p, salt, hash] = stored.split(":") as [string,string,string,string,string,string];
  const derived = await scrypt(password, salt,Number(p));
  // Equalize old-account verification work with new/unknown accounts until rehash.
  if(p==="1")await scrypt(password,salt,2);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export type Identity = User & { student: Student | null };
export interface Authenticated { user: Identity; csrfToken: string; tokenHash: string;reauthUntil:Date|null; }
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
  return { user: session.user, csrfToken: session.csrfToken, tokenHash: session.tokenHash,reauthUntil:session.reauthUntil };
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
  return row[0]!.count;
}
// Reads a throttle counter without incrementing it (0 once its window has passed).
export async function throttleCount(db: Db, key: string) {
  const row = await db.loginThrottle.findUnique({ where: { key } });
  return row && row.resetAt > new Date() ? row.count : 0;
}
export async function sessionFor(db: Db|Tx, user: User, config: Config) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: digest(token), userId: user.id, authVersion: user.authVersion, csrfToken, expiresAt: new Date(Date.now()+config.SESSION_HOURS*3600000),reauthUntil:user.role!=="STUDENT"?new Date(Date.now()+300000):null } });
  return { token, csrfToken };
}
export const academicSelect = { id:true, course:true, startDate:true, expiryDate:true, trainerId:true, user:{select:{name:true,enabled:true}} } as const;
export async function audit(tx: Tx | Db, actorId: string, action: string, target: string, detail: object = {}) {
  await tx.auditLog.create({ data: { actorId, action, target, detail } });
}
export async function notify(tx: Tx | Db, userId: string, title: string, href: string) {
  await tx.notification.create({ data: { userId, title, href } });
}
