import type { FastifyRequest } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import type { Identity } from "../auth.js";
import type { Storage } from "../storage.js";
import { assert } from "../domain.js";

// Shared dependencies handed to every route module by buildApp.
export interface RouteContext {
  db: Db;
  config: Config;
  storage: Storage;
  // The signed-in user for a portal route; throws 401 when the request is unauthenticated.
  user: (req: FastifyRequest) => Identity;
  // Precomputed hash used to equalize sign-in work for unknown accounts.
  unknownAccountHash: string;
}
// Path parameters are always strings; each route validates them (zod, UUID hook) before use.
export function param(req: FastifyRequest, name: string): string {
  const value = (req.params as Record<string, unknown>)[name];
  assert(typeof value === "string", 404, "Record not found");
  return value;
}
export const query = (req: FastifyRequest) => req.query as Record<string, string | undefined>;
