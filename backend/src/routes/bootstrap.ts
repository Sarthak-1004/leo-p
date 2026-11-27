import type { FastifyInstance } from "fastify";

import { z } from "zod";
import { bootstrap } from "../views.js";
import type { RouteContext } from "./context.js";

// Initial portal data for the signed-in user.
export function registerBootstrapRoutes(app: FastifyInstance, { db, config, user }: RouteContext) {
  // Staff dashboards are large (hundreds of students and results); building at most six at once
  // bounds server memory when a whole team signs in together. Student dashboards are small.
  let staffBuilding = 0;
  const staffQueue: Array<() => void> = [];
  app.get("/api/bootstrap", async req => {
    const q = z
      .object({
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(500).default(500),
      })
      .parse(req.query);
    const u = user(req);
    if (u.role === "STUDENT") return bootstrap(db, u, q.offset, q.limit, config.ACCESS_TIMEZONE);
    if (staffBuilding >= 6) await new Promise<void>(resolve => staffQueue.push(resolve));
    else staffBuilding++;
    try {
      return await bootstrap(db, u, q.offset, q.limit, config.ACCESS_TIMEZONE);
    } finally {
      const next = staffQueue.shift();
      if (next) next();
      else staffBuilding--;
    }
  });
}
