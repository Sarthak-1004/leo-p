import { z } from "zod";
import { transaction, type Db } from "./db.js";
import { admin, audit, notify, studentOnly, throttle, type Identity } from "./auth.js";
import { assert } from "./domain.js";

// General requests from students: portal problems, improvement ideas and feature requests.
// Question-level problems use issue reports instead.
export const REQUEST_TYPES = ["Portal problem", "Improvement idea", "New feature", "Account or access", "Other"] as const;
export const REQUEST_STATUSES = ["Open", "In review", "Planned", "Done", "Declined", "Withdrawn"] as const;

export const requestSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  subject: z.string().trim().min(5, "Add a short subject (at least 5 characters)").max(150),
  description: z.string().trim().min(10, "Describe your request in at least 10 characters").max(3000),
}).strict();
export const requestQuery = z.object({
  status: z.enum(REQUEST_STATUSES).optional(), type: z.enum(REQUEST_TYPES).optional(), course: z.enum(["GENERAL", "ACADEMIC"]).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10),
}).strict();
export const requestUpdateSchema = z.object({ status: z.enum(["Open", "In review", "Planned", "Done", "Declined"]), adminNote: z.string().trim().max(3000), version: z.number().int().positive() }).strict();

const view = (r: any, names?: Map<string, string>) => ({
  id: r.id, studentId: r.studentId, ...(names ? { studentName: names.get(r.studentId) ?? r.studentId } : {}), course: r.course,
  type: r.type, subject: r.subject, description: r.description, status: r.status, adminNote: r.adminNote,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), version: r.version,
});

export async function raiseRequest(db: Db, user: Identity, input: z.infer<typeof requestSchema>) {
  studentOnly(user);
  await throttle(db, `requests:${user.id}`, 10, 86400);
  return view(await transaction(db, async tx => {
    const created = await tx.supportRequest.create({ data: { studentId: user.id, course: user.student.course, type: input.type, subject: input.subject, description: input.description } });
    for (const a of await tx.user.findMany({ where: { role: "ADMIN", enabled: true }, select: { id: true } })) await notify(tx, a.id, `New student request: ${input.subject}`, "/admin/requests");
    await audit(tx, user.id, "Request raised", created.id, { type: input.type });
    return created;
  }));
}

export async function listRequests(db: Db, user: Identity, q: z.infer<typeof requestQuery>) {
  assert(user.role === "STUDENT" || user.role === "ADMIN", 403, "Requests are managed by Admin");
  const own = user.role === "STUDENT" ? { studentId: user.id } : {};
  const where = { ...own, ...(user.role === "ADMIN" && q.course ? { course: q.course } : {}), ...(q.status ? { status: q.status } : {}), ...(q.type ? { type: q.type } : {}) };
  const [count, rows, open] = await Promise.all([
    db.supportRequest.count({ where }),
    db.supportRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.limit, take: q.limit }),
    db.supportRequest.count({ where: { ...own, status: { in: ["Open", "In review"] } } }),
  ]);
  const names = user.role === "ADMIN" ? new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, name: true } })).map(u => [u.id, u.name])) : undefined;
  return { count, page: q.page, open, rows: rows.map(r => view(r, names)) };
}

export async function updateRequest(db: Db, user: Identity, id: string, input: z.infer<typeof requestUpdateSchema>) {
  admin(user);
  return transaction(db, async tx => {
    const current = await tx.supportRequest.findUnique({ where: { id } });
    assert(current, 404, "Request not found");
    assert(current.version === input.version, 409, "This request changed. Reload before saving");
    assert(current.status !== "Withdrawn", 400, "The student withdrew this request");
    const saved = await tx.supportRequest.update({ where: { id }, data: { status: input.status, adminNote: input.adminNote, version: { increment: 1 } } });
    if (current.status !== input.status || current.adminNote !== input.adminNote) await notify(tx, current.studentId, `Your request “${current.subject}” is now ${input.status.toLowerCase()}${input.adminNote ? " – see the reply" : ""}.`, "/student/requests");
    await audit(tx, user.id, "Request updated", id, { from: current.status, to: input.status });
    return view(saved);
  });
}

export async function withdrawRequest(db: Db, user: Identity, id: string) {
  studentOnly(user);
  return transaction(db, async tx => {
    const current = await tx.supportRequest.findUnique({ where: { id } });
    assert(current && current.studentId === user.id, 404, "Request not found");
    assert(current.status === "Open", 400, "Only an open request can be withdrawn");
    return view(await tx.supportRequest.update({ where: { id }, data: { status: "Withdrawn", version: { increment: 1 } } }));
  });
}
