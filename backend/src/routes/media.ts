import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { admin, staff } from "../auth.js";
import { assert } from "../domain.js";
import { confirmImport, csvExport, previewImport } from "../imports.js";
import { type RouteContext, param } from "./context.js";

// Imports, media library and protected asset delivery.
export function registerMediaRoutes(app: FastifyInstance, { db, storage, user }: RouteContext) {
  app.post("/api/admin/imports/:kind", async req => {
    admin(user(req));
    const part = await req.file();
    assert(part, 400, "Choose a file");
    return previewImport(db, user(req), param(req, "kind"), await part.toBuffer(), part.filename);
  });
  app.post("/api/admin/imports/:id/confirm", async req => confirmImport(db, user(req), param(req, "id")));
  app.get("/api/admin/imports/:id/errors", async (req, reply) => {
    admin(user(req));
    const batch = await db.importBatch.findFirst({ where: { id: param(req, "id"), actorId: user(req).id } });
    assert(batch, 404, "Import not found");
    const rows = batch.rows as Array<{ row: number; error?: string }>;
    reply.header("Content-Disposition", 'attachment; filename="import-errors.csv"').type("text/csv; charset=utf-8");
    return csvExport([["Row", "Error"], ...rows.flatMap(r => (r.error ? [[String(r.row), r.error]] : []))]);
  });
  app.get("/api/admin/assets", async req => {
    admin(user(req));
    const q = z
      .object({ search: z.string().max(200).default(""), page: z.coerce.number().int().min(1).default(1) })
      .parse(req.query);
    const where = { filename: { contains: q.search, mode: "insensitive" as const } };
    const [count, rows] = await Promise.all([
      db.asset.count({ where }),
      db.asset.findMany({
        where,
        select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
        skip: (q.page - 1) * 25,
      }),
    ]);
    return { count, rows };
  });
  app.post("/api/admin/assets", async req => {
    admin(user(req));
    const part = await req.file();
    assert(part, 400, "Choose a media file");
    return storage.upload(db, user(req), part.filename, await part.toBuffer());
  });
  app.get("/api/assets/:id/url", async req => {
    staff(user(req));
    return storage.readUrl(db, user(req), z.string().uuid().parse(param(req, "id")));
  });
  app.get("/api/assets/:id/stream", async (req, reply) => {
    const object = await storage.stream(db, user(req), z.string().uuid().parse(param(req, "id")), req.headers.range);
    reply
      .type(object.ContentType ?? "application/octet-stream")
      .header("Accept-Ranges", "bytes")
      .header("Cache-Control", "private, no-store");
    if (object.ContentLength !== undefined) reply.header("Content-Length", object.ContentLength);
    if (object.ContentRange) reply.code(206).header("Content-Range", object.ContentRange);
    return reply.send(object.Body);
  });
}
