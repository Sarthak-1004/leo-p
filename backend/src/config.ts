import { z } from "zod";
// Empty values (for example `METRICS_TOKEN=` in an .env file) mean "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(value => (value === "" ? undefined : value), schema.optional());
export const configuration = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().refine(s => /^postgres(ql)?:\/\//.test(s), "PostgreSQL connection required"),
  SESSION_HOURS: z.coerce.number().min(1).max(24).default(12),
  ACCESS_TIMEZONE: z.string().default("Asia/Kolkata"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  // Writing AI provider: "vertex" uses Gemini on Google Cloud with the service account; "openai" uses OPENAI_*.
  AI_PROVIDER: z.enum(["openai", "vertex"]).default("openai"),
  VERTEX_PROJECT: z.string().optional(),
  VERTEX_LOCATION: z.string().default("global"),
  VERTEX_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Proxies in front of the API: unset trusts none; a hop count (e.g. "2" for Vercel then Cloud Run)
  // or a comma-separated list of addresses/CIDRs. Decides the client IP used by the per-IP limiter.
  TRUST_PROXY: optional(
    z
      .string()
      .regex(/^(\d{1,2}|[0-9a-fA-F.:/]+(,[0-9a-fA-F.:/]+)*)$/, "TRUST_PROXY must be a hop count or address list"),
  ),
  // inline: API and evaluation worker in one process. off: API only. only: worker only (health routes, no API).
  WORKER_MODE: z.enum(["inline", "off", "only"]).default("inline"),
  // Evaluation jobs one process runs at once. Each slot claims its own lease (FOR UPDATE SKIP LOCKED).
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  // Enables /api/metrics and queue detail on /api/health/ready for callers sending this bearer token.
  METRICS_TOKEN: optional(z.string().min(24, "METRICS_TOKEN must be at least 24 characters")),
  // Per-user write requests allowed per minute (abuse backstop held in memory per instance).
  ACTION_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).max(100000).default(300),
});
export type Config = z.infer<typeof configuration>;
export function loadConfig(input = process.env): Config {
  const c = configuration.parse(input);
  if (c.NODE_ENV === "production" && !c.APP_ORIGIN.startsWith("https://"))
    throw new Error("Production APP_ORIGIN must use HTTPS");
  return c;
}
// Cookies are marked Secure whenever the site itself is served over HTTPS, in every environment.
export const secureCookies = (config: Config) => config.APP_ORIGIN.startsWith("https://");
// On HTTPS the session cookie uses the __Host- prefix: browsers only accept it as Secure, host-only and path=/.
export const sessionCookieName = (config: Config) => (secureCookies(config) ? "__Host-kanan_session" : "kanan_session");
export const LEGACY_SESSION_COOKIE = "kanan_session";
export function trustProxySetting(config: Config): boolean | string[] | ((address: string, hop: number) => boolean) {
  const value = config.TRUST_PROXY;
  if (!value) return false;
  if (!/^\d+$/.test(value)) return value.split(",");
  // Trust the nearest N hops: the client IP is the address N entries back in X-Forwarded-For.
  const hops = Number(value);
  return (_address, hop) => hop < hops;
}
// Exact storage origin for presigned media URLs: the configured endpoint, or the AWS S3 bucket host.
export function storageOrigins(config: Config): string[] {
  if (config.S3_ENDPOINT) return [new URL(config.S3_ENDPOINT).origin];
  if (config.S3_BUCKET) return [`https://${config.S3_BUCKET}.s3.${config.S3_REGION}.amazonaws.com`];
  return [];
}
