import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction } from "../db.js";
import { admin, audit, hashPassword } from "../auth.js";
import { assert, identifier, password } from "../domain.js";
import { saveStudent, saveTrainer, studentSchema, trainerSchema } from "../accounts.js";
import { type RouteContext, param } from "./context.js";

// Admin management of student and trainer accounts.
export function registerAccountRoutes(app: FastifyInstance, { db, user }: RouteContext) {
  app.put("/api/admin/students/:id", async req => {
    const b = studentSchema.parse(req.body);
    assert(b.id === param(req, "id"), 400, "Student ID mismatch");
    return saveStudent(db, user(req), b);
  });
  app.put("/api/admin/trainers/:id", async req => {
    const b = trainerSchema.parse(req.body);
    assert(b.id === param(req, "id"), 400, "Trainer ID mismatch");
    return saveTrainer(db, user(req), b);
  });
  app.post("/api/admin/users/:id/password", async req => {
    const u = user(req);
    admin(u);
    const input = z.object({ password }).strict().parse(req.body);
    const id = identifier.parse(param(req, "id"));
    await transaction(db, async tx => {
      const target = await tx.user.findUnique({ where: { id } });
      assert(target, 404, "Account not found");
      await tx.user.update({
        where: { id },
        data: { passwordHash: await hashPassword(input.password), authVersion: { increment: 1 } },
      });
      await audit(tx, u.id, "Password reset", id);
    });
    return { ok: true };
  });
}
