import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lockedTransaction, transaction } from "../db.js";
import { admin, audit } from "../auth.js";
import { assert, course } from "../domain.js";
import { forceSubmit } from "../attempts.js";
import { release } from "../evaluation.js";
import { platformSettings } from "../settings.js";
import { type RouteContext, param } from "./context.js";

// Admin operations, security, attempt review, audit and bulk release.
export function registerOperationsRoutes(app: FastifyInstance, { db, config, user }: RouteContext) {
  app.get("/api/admin/operations", async req => {
    admin(user(req));
    const [failedJobs, pendingJobs, flagged, unreviewed, settings] = await Promise.all([
      db.evaluationJob.count({ where: { state: "FAILED" } }),
      db.evaluationJob.count({ where: { state: { in: ["PENDING", "RUNNING"] } } }),
      db.attempt.count({ where: { flagged: true } }),
      db.attempt.count({ where: { flagged: true, reviewedAt: null } }),
      platformSettings(db),
    ]);
    return {
      failedJobs,
      pendingJobs,
      flagged,
      unreviewed,
      storageConfigured: !!config.S3_BUCKET,
      writingConfigured: !!config.OPENAI_API_KEY && !!config.OPENAI_MODEL,
      autoWritingEvaluation: settings.autoWritingEvaluation,
    };
  });
  app.get("/api/admin/security", async req => {
    admin(user(req));
    const rows = await db.$queryRaw<
      Array<{
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        owns_database: boolean;
        can_create_schema_objects: boolean;
      }>
    >`SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,pg_has_role(current_user,d.datdba,'MEMBER') AS owns_database,has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`;
    const privileges = rows[0];
    const [staff, legacyPasswords] = await Promise.all([
      db.user.count({ where: { role: { not: "STUDENT" }, enabled: true } }),
      db.user.count({ where: { passwordHash: { startsWith: "scrypt:32768:8:1:" } } }),
    ]);
    return {
      authenticationMethod: "password",
      staffMfaRequired: false,
      staff,
      legacyPasswords,
      runtimeDatabasePrivileges: privileges,
      runtimeRoleHasElevatedPrivileges: !privileges || Object.values(privileges).some(Boolean),
      leastPrivilegeVerified: false,
      backupRestoreVerified: false,
      storagePolicyVerified: false,
    };
  });
  app.get("/api/admin/attempts", async req => {
    admin(user(req));
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        course: course.optional(),
        studentId: z.string().max(80).optional(),
        filter: z.enum(["all", "flagged", "unreviewed", "in-progress"]).default("unreviewed"),
      })
      .parse(req.query);
    const where = {
      ...(q.course ? { course: q.course } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.filter === "flagged" || q.filter === "unreviewed" ? { flagged: true } : {}),
      ...(q.filter === "unreviewed" ? { reviewedAt: null } : {}),
      ...(q.filter === "in-progress" ? { state: "IN_PROGRESS" as const } : {}),
    };
    const [count, rows] = await Promise.all([
      db.attempt.count({ where }),
      db.attempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * 25,
        take: 25,
        select: {
          id: true,
          studentId: true,
          course: true,
          testId: true,
          kind: true,
          state: true,
          interruptions: true,
          flagged: true,
          reviewedAt: true,
          reviewerId: true,
          reviewRemarks: true,
          remainingMs: true,
          hiddenMs: true,
          activeMs: true,
          createdAt: true,
          submittedAt: true,
          logs: { orderBy: { at: "asc" } },
          student: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return { count, page: q.page, rows };
  });
  app.post("/api/admin/attempts/:id/review", async req => {
    const u = user(req);
    admin(u);
    const b = z
      .object({ remarks: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    const id = z.string().uuid().parse(param(req, "id"));
    await transaction(db, async tx => {
      const a = await tx.attempt.findUnique({ where: { id } });
      assert(a?.flagged, 404, "Flagged attempt not found");
      await tx.attempt.update({
        where: { id },
        data: { reviewedAt: new Date(), reviewerId: u.id, reviewRemarks: b.remarks },
      });
      await audit(tx, u.id, "Interruption review completed", id, {
        previousRemarks: a.reviewRemarks,
        remarks: b.remarks,
        interruptions: a.interruptions,
      });
    });
    return { ok: true };
  });
  app.post("/api/admin/attempts/:id/submit", async req => {
    const u = user(req);
    admin(u);
    const b = z
      .object({ remarks: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    const id = param(req, "id");
    const done = await lockedTransaction(db, tx => forceSubmit(tx, id, u.id, b.remarks));
    assert(done, 409, "This attempt is not in progress");
    return { ok: true };
  });
  app.get("/api/admin/audit", async req => {
    admin(user(req));
    const q = z
      .object({ search: z.string().max(200).default(""), page: z.coerce.number().int().min(1).default(1) })
      .parse(req.query);
    const where = {
      OR: [
        { action: { contains: q.search, mode: "insensitive" as const } },
        { target: { contains: q.search, mode: "insensitive" as const } },
        { actorId: { contains: q.search, mode: "insensitive" as const } },
      ],
    };
    const [count, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 25, skip: (q.page - 1) * 25 }),
    ]);
    return { count, rows };
  });
  app.post("/api/admin/results/release-scope", async req => {
    const u = user(req);
    admin(u);
    const b = z
      .object({ course, testId: z.string().max(80).optional() })
      .strict()
      .parse(req.body);
    let count = 0;
    for (;;) {
      const rows = await db.result.findMany({
        where: {
          course: b.course,
          ...(b.testId ? { testId: b.testId } : {}),
          kind: "FLT",
          released: false,
          reviewStatus: "Completed",
          listening: { not: null },
          reading: { not: null },
          writing: { not: null },
        },
        select: { id: true },
        take: 100,
      });
      if (!rows.length) break;
      const batch = await release(
        db,
        u,
        rows.map(r => r.id),
      );
      count += batch.released.length;
      if (!batch.released.length) break;
    }
    return { count };
  });
}
