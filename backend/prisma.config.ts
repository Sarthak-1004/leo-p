import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
if(existsSync(".env"))process.loadEnvFile(".env");
if(process.env.NODE_ENV==="production"&&!process.env.DATABASE_URL)throw new Error("Set DATABASE_URL for production migrations");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://kanan:local-development-only@127.0.0.1:55432/kanan" },
});
