import type { FastifyInstance } from "fastify";
import { institution } from "../settings.js";
import { registerHealthRoutes } from "../observability.js";
import type { RouteContext } from "./context.js";

// Public institution details, health checks and metrics.
export function registerSystemRoutes(app: FastifyInstance, { db, config }: RouteContext) {
  app.get("/api/institution", async () => institution(db));
  registerHealthRoutes(app, db, config);
}
