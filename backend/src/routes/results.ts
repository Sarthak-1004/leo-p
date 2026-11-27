import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { audit, staff, throttle } from "../auth.js";
import { assert, snapshotQuestions } from "../domain.js";
import { publicQuestion, resultView } from "../views.js";
import { claim, evaluate, evaluationSchema, release } from "../evaluation.js";
import { type RouteContext, param } from "./context.js";

// Results, evaluation, release and AI retries.
export function registerResultRoutes(app: FastifyInstance, { db, config, user }: RouteContext) {
  app.get("/api/results/:id", async req => {
    const u = user(req);
    const r = await db.result.findUnique({
      where: { id: param(req, "id") },
      include: { revisions: u.role !== "STUDENT", jobs: { where: { state: "COMPLETED" } }, attempt: true },
    });
    assert(
      r &&
        (u.role !== "STUDENT" ||
          (r.studentId === u.id && r.course === u.student?.course && (r.kind !== "FLT" || r.released))),
      404,
      "Result not found",
    );
    const dto = resultView(r, u);
    assert(dto.visible, 409, "Scoring is not complete");
    // Practice Mocks allow two attempts on the same paper: keep keys hidden until both are used.
    const keysWithheld =
      u.role === "STUDENT" &&
      r.kind === "PRACTICE_MOCK" &&
      (await db.attempt.count({ where: { studentId: u.id, course: r.course, testId: r.testId, state: "SUBMITTED" } })) <
        2;
    return {
      ...dto,
      keysWithheld,
      responses: r.attempt.answers,
      questions: snapshotQuestions(r.attempt.snapshot).map(q => publicQuestion(q, !keysWithheld)),
    };
  });
  app.post("/api/results/:id/claim", async req => claim(db, user(req), param(req, "id")));
  app.put("/api/results/:id/evaluation", async req =>
    evaluate(db, user(req), param(req, "id"), evaluationSchema.parse(req.body)),
  );
  app.post("/api/results/release", async req =>
    release(
      db,
      user(req),
      z
        .object({ ids: z.array(z.string().uuid()).min(1).max(500) })
        .strict()
        .parse(req.body).ids,
    ),
  );
  app.post("/api/results/:id/retry-ai", async req => {
    const u = user(req);
    staff(u);
    assert(
      config.OPENAI_API_KEY && config.OPENAI_MODEL,
      503,
      "Writing AI is not configured; manual evaluation is available",
    );
    const id = z.string().uuid().parse(param(req, "id"));
    await throttle(db, `ai-retry:${u.id}`, 10, 3600);
    await transaction(db, async tx => {
      const target = await tx.result.findUnique({
        where: { id },
        include: { attempt: { select: { snapshot: true } } },
      });
      assert(target, 404, "Result not found");
      assert(
        snapshotQuestions(target.attempt.snapshot).some(q => q.skill === "Writing"),
        400,
        "This assessment has no Writing submission",
      );
      const pending = await tx.evaluationJob.findFirst({
        where: { resultId: id, state: { in: ["PENDING", "RUNNING"] } },
      });
      assert(!pending, 409, "Writing evaluation is already queued");
      await tx.evaluationJob.create({ data: { resultId: id } });
      await tx.result.update({ where: { id }, data: { aiStatus: "Pending", version: { increment: 1 } } });
      await audit(tx, u.id, "Writing AI retry queued", id);
    });
    return { queued: true };
  });
}
