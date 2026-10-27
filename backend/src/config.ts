import { z } from "zod";
export const configuration = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().refine(s => /^postgres(ql)?:\/\//.test(s), "PostgreSQL connection required"),
  SESSION_HOURS: z.coerce.number().min(1).max(24).default(12),
  ACCESS_TIMEZONE: z.string().default("Asia/Kolkata"),
  OPENAI_API_KEY: z.string().optional(), OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  S3_ENDPOINT: z.string().url().optional(), S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(), S3_ACCESS_KEY_ID: z.string().optional(), S3_SECRET_ACCESS_KEY: z.string().optional(),
});
export type Config = z.infer<typeof configuration>;
export function loadConfig(input = process.env): Config {
  const c = configuration.parse(input);
  if (c.NODE_ENV === "production" && !c.APP_ORIGIN.startsWith("https://")) throw new Error("Production APP_ORIGIN must use HTTPS");
  return c;
}
