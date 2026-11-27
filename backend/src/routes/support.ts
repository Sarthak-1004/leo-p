import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  issueQuery,
  issueSchema,
  issueUpdateSchema,
  listIssues,
  reportIssue,
  updateIssue,
  withdrawIssue,
} from "../issues.js";
import {
  listRequests,
  raiseRequest,
  requestQuery,
  requestSchema,
  requestUpdateSchema,
  updateRequest,
  withdrawRequest,
} from "../requests.js";
import { type RouteContext, param } from "./context.js";

// Student requests and issue reports.
export function registerSupportRoutes(app: FastifyInstance, { db, user }: RouteContext) {
  app.get("/api/requests", async req => listRequests(db, user(req), requestQuery.parse(req.query)));
  app.post("/api/requests", async req => raiseRequest(db, user(req), requestSchema.parse(req.body)));
  app.post("/api/requests/:id/withdraw", async req =>
    withdrawRequest(db, user(req), z.string().uuid().parse(param(req, "id"))),
  );
  app.put("/api/admin/requests/:id", async req =>
    updateRequest(db, user(req), z.string().uuid().parse(param(req, "id")), requestUpdateSchema.parse(req.body)),
  );
  app.get("/api/issues", async req => listIssues(db, user(req), issueQuery.parse(req.query)));
  app.post("/api/issues", async req => reportIssue(db, user(req), issueSchema.parse(req.body)));
  app.post("/api/issues/:id/withdraw", async req =>
    withdrawIssue(db, user(req), z.string().uuid().parse(param(req, "id"))),
  );
  app.put("/api/admin/issues/:id", async req =>
    updateIssue(db, user(req), z.string().uuid().parse(param(req, "id")), issueUpdateSchema.parse(req.body)),
  );
}
