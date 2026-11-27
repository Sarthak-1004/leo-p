import { z } from "zod";
import { transaction, type Db } from "./db.js";
import { admin, audit, notify, studentOnly, throttle, type Identity } from "./auth.js";
import { assert, snapshotQuestions } from "./domain.js";

// Students report problems with test content or the portal; Admin reviews, notes and resolves them.
export const ISSUE_TYPES = [
  "Wrong answer key",
  "Question or passage error",
  "Audio problem",
  "Image or chart problem",
  "Marking or score problem",
  "Technical problem",
  "Other",
] as const;
export const ISSUE_MODULES = ["Listening", "Reading", "Writing", "Speaking", "General"] as const;
export const ISSUE_STATUSES = ["Open", "In review", "Resolved", "Rejected", "Withdrawn"] as const;

export const issueSchema = z
  .object({
    resultId: z.string().uuid().nullable().optional(),
    module: z.enum(ISSUE_MODULES),
    type: z.enum(ISSUE_TYPES),
    questionIds: z.array(z.string().min(1).max(120)).max(20).default([]),
    description: z.string().trim().min(10, "Describe the issue in at least 10 characters").max(2000),
  })
  .strict();
export const issueQuery = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    course: z.enum(["GENERAL", "ACADEMIC"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
export const issueUpdateSchema = z
  .object({
    status: z.enum(["Open", "In review", "Resolved", "Rejected"]),
    adminNote: z.string().trim().max(2000),
    version: z.number().int().positive(),
  })
  .strict();

const view = (i: any, names?: Map<string, string>) => ({
  id: i.id,
  studentId: i.studentId,
  ...(names ? { studentName: names.get(i.studentId) ?? i.studentId } : {}),
  course: i.course,
  resultId: i.resultId,
  testName: i.testName,
  module: i.module,
  type: i.type,
  questions: i.questions,
  description: i.description,
  status: i.status,
  adminNote: i.adminNote,
  createdAt: i.createdAt.toISOString(),
  updatedAt: i.updatedAt.toISOString(),
  version: i.version,
});

export async function reportIssue(db: Db, user: Identity, input: z.infer<typeof issueSchema>) {
  studentOnly(user);
  await throttle(db, `issues:${user.id}`, 20, 86400);
  let testName = "",
    questions: string[] = [],
    questionIds: string[] = [];
  if (input.resultId) {
    const result = await db.result.findUnique({
      where: { id: input.resultId },
      include: { attempt: { select: { snapshot: true } } },
    });
    assert(result && result.studentId === user.id, 404, "Result not found");
    testName = result.name;
    // Questions are named as the student saw them: the skill and its position in that skill.
    const all = snapshotQuestions(result.attempt.snapshot);
    const label = new Map<string, string>();
    for (const skill of ["Listening", "Reading", "Writing"])
      all
        .filter(q => q.skill === skill)
        .forEach((q, i) =>
          label.set(q.id, skill === "Writing" ? `Writing ${q.section ?? `Task ${i + 1}`}` : `${skill} Q${i + 1}`),
        );
    for (const id of new Set(input.questionIds)) {
      assert(label.has(id), 400, "A selected question is not part of this test");
      questionIds.push(id);
      questions.push(label.get(id)!);
    }
  } else assert(!input.questionIds.length, 400, "Questions can only be selected from a test result");
  const issue = await transaction(db, async tx => {
    const created = await tx.issueReport.create({
      data: {
        studentId: user.id,
        course: user.student.course,
        resultId: input.resultId ?? null,
        testName,
        module: input.module,
        type: input.type,
        questions,
        questionIds,
        description: input.description,
      },
    });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", enabled: true }, select: { id: true } });
    for (const a of admins)
      await notify(tx, a.id, `New issue report: ${input.type}${testName ? ` (${testName})` : ""}`, "/admin/issues");
    await audit(tx, user.id, "Issue reported", created.id, { type: input.type, module: input.module });
    return created;
  });
  return view(issue);
}

export async function listIssues(db: Db, user: Identity, q: z.infer<typeof issueQuery>) {
  assert(user.role === "STUDENT" || user.role === "ADMIN", 403, "Issue reports are managed by Admin");
  const where = {
    ...(user.role === "STUDENT" ? { studentId: user.id } : q.course ? { course: q.course } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { type: q.type } : {}),
  };
  const [count, rows, open] = await Promise.all([
    db.issueReport.count({ where }),
    db.issueReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    db.issueReport.count({
      where: { ...(user.role === "STUDENT" ? { studentId: user.id } : {}), status: { in: ["Open", "In review"] } },
    }),
  ]);
  const names =
    user.role === "ADMIN"
      ? new Map(
          (
            await db.user.findMany({
              where: { id: { in: [...new Set(rows.map(r => r.studentId))] } },
              select: { id: true, name: true },
            })
          ).map(u => [u.id, u.name]),
        )
      : undefined;
  return { count, page: q.page, open, rows: rows.map(r => view(r, names)) };
}

export async function updateIssue(db: Db, user: Identity, id: string, input: z.infer<typeof issueUpdateSchema>) {
  admin(user);
  return transaction(db, async tx => {
    const current = await tx.issueReport.findUnique({ where: { id } });
    assert(current, 404, "Issue report not found");
    assert(current.version === input.version, 409, "This report changed. Reload before saving");
    assert(current.status !== "Withdrawn", 400, "The student withdrew this report");
    const saved = await tx.issueReport.update({
      where: { id },
      data: {
        status: input.status,
        adminNote: input.adminNote,
        resolvedBy: ["Resolved", "Rejected"].includes(input.status) ? user.id : null,
        version: { increment: 1 },
      },
    });
    if (current.status !== input.status || current.adminNote !== input.adminNote)
      await notify(
        tx,
        current.studentId,
        `Your issue report is now ${input.status.toLowerCase()}${input.adminNote ? " – see the admin note" : ""}.`,
        "/student/issues",
      );
    await audit(tx, user.id, "Issue report updated", id, { from: current.status, to: input.status });
    return view(saved);
  });
}

export async function withdrawIssue(db: Db, user: Identity, id: string) {
  studentOnly(user);
  return transaction(db, async tx => {
    const current = await tx.issueReport.findUnique({ where: { id } });
    assert(current && current.studentId === user.id, 404, "Issue report not found");
    assert(current.status === "Open", 400, "Only an open report can be withdrawn");
    return view(
      await tx.issueReport.update({ where: { id }, data: { status: "Withdrawn", version: { increment: 1 } } }),
    );
  });
}
