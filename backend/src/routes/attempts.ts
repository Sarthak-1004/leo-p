import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { staff } from "../auth.js";
import { assert, course, heartbeatSchema, identifier } from "../domain.js";
import { staffAttemptView } from "../views.js";
import { practiceHistory, resumeAttempt, signal, startPractice, startTest } from "../attempts.js";
import { uploadRecording } from "../speaking.js";
import { goalsSchema, saveGoals, studentInsights } from "../insights.js";
import { type RouteContext, param } from "./context.js";

// Test and practice attempts, recordings and student insights.
export function registerAttemptRoutes(app: FastifyInstance, { db, config, storage, user }: RouteContext) {
  app.post("/api/tests/:course/:id/start", async req =>
    startTest(db, user(req), course.parse(param(req, "course")), identifier.parse(param(req, "id"))),
  );
  app.get("/api/student/insights", async req => studentInsights(db, user(req), config.ACCESS_TIMEZONE));
  app.put("/api/student/goals", async req => saveGoals(db, user(req), goalsSchema.parse(req.body)));
  app.post("/api/practice/start", async req =>
    startPractice(
      db,
      user(req),
      z
        .object({
          skill: z.enum(["Listening", "Reading", "Writing", "Speaking"]),
          mode: z.enum(["type", "section"]),
          selection: z.string().trim().min(1).max(100),
          questionId: identifier.optional(),
          questionIds: z.array(identifier).min(1).max(40).optional(),
        })
        .strict()
        .parse(req.body),
    ),
  );
  app.get("/api/practice/history", async req => practiceHistory(db, user(req)));
  app.post("/api/attempts/:id/recordings/:questionId", async req => {
    const u = user(req);
    const part = await req.file();
    assert(part, 400, "Choose a recording");
    return uploadRecording(
      db,
      storage,
      u,
      z.string().uuid().parse(param(req, "id")),
      identifier.parse(param(req, "questionId")),
      await part.toBuffer(),
    );
  });
  app.get("/api/attempts/:id", async req => {
    const u = user(req),
      id = param(req, "id");
    if (u.role === "STUDENT")
      return resumeAttempt(db, u, id, z.object({ session: z.string().uuid().optional() }).parse(req.query).session);
    // Staff get a read-only view with the full paper and keys; it never takes over the student's session.
    staff(u);
    const a = await db.attempt.findUnique({ where: { id } });
    assert(a, 404, "Attempt not found");
    return staffAttemptView(a);
  });
  app.post("/api/attempts/:id/heartbeat", async req =>
    signal(db, user(req), param(req, "id"), heartbeatSchema.parse(req.body)),
  );
  app.post("/api/attempts/:id/submit", async req =>
    signal(db, user(req), param(req, "id"), heartbeatSchema.parse(req.body), true),
  );
}
