import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { admin, audit } from "../auth.js";
import { assert, course } from "../domain.js";
import { type RouteContext, param } from "./context.js";

// Notifications and Admin announcements.
export function registerNotificationRoutes(app: FastifyInstance, { db, user }: RouteContext) {
  app.post("/api/notifications/read-all", async req => {
    const result = await db.notification.updateMany({
      where: { userId: user(req).id, read: false },
      data: { read: true },
    });
    return { count: result.count };
  });
  app.post("/api/notifications/:id/read", async req => {
    await db.notification.updateMany({
      where: { id: param(req, "id"), userId: user(req).id },
      data: { read: true },
    });
    return { ok: true };
  });
  app.post("/api/admin/announcements", async req => {
    const u = user(req);
    admin(u);
    const b = z
      .object({
        title: z.string().trim().min(1).max(300),
        role: z.enum(["STUDENT", "TRAINER"]),
        course: course.optional(),
      })
      .strict()
      .parse(req.body);
    assert(b.role === "STUDENT" || !b.course, 400, "Course filters apply to Students");
    const count = await transaction(db, async tx => {
      const users = await tx.user.findMany({
        where: { role: b.role, enabled: true, ...(b.course ? { student: { course: b.course } } : {}) },
        select: { id: true },
      });
      await tx.notification.createMany({
        data: users.map(to => ({ userId: to.id, title: b.title, href: `/${b.role.toLowerCase()}/notifications` })),
      });
      await audit(tx, u.id, "Announcement sent", b.role, { count: users.length, course: b.course ?? "both" });
      return users.length;
    });
    return { ok: true, count };
  });
}
