import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transaction, Prisma } from "../db.js";
import { admin, audit } from "../auth.js";
import { assert, course, identifier, questionSchema, settingsSchema } from "../domain.js";
import { publicQuestion } from "../views.js";
import { saveQuestion, saveTest, testSchema } from "../content.js";
import { type RouteContext, param } from "./context.js";

// Question bank, test builder and platform settings.
export function registerContentRoutes(app: FastifyInstance, { db, user }: RouteContext) {
  // Builder search: paginated so test assembly is not limited to the bootstrap page.
  app.get("/api/admin/questions", async req => {
    admin(user(req));
    const q = z
      .object({
        skill: z.enum(["Listening", "Reading", "Writing", "Speaking"]).optional(),
        course: course.optional(),
        search: z.string().trim().max(200).default(""),
        section: z.string().max(100).optional(),
        questionType: z.string().max(100).optional(),
        status: z.enum(["all", "published", "draft", "archived"]).default("published"),
        order: z.enum(["section", "title", "id"]).default("section"),
        ids: z.string().max(8200).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .strict()
      .parse(req.query);
    const ids = q.ids ? q.ids.split(",").filter(Boolean).slice(0, 100) : undefined;
    const scope: Prisma.QuestionWhereInput = {
      ...(q.skill ? { skill: q.skill } : {}),
      ...(q.course ? { course: { in: [q.course, "BOTH"] } } : {}),
    };
    const where: Prisma.QuestionWhereInput = ids
      ? { id: { in: ids } }
      : {
          ...scope,
          ...(q.section ? { section: q.section } : {}),
          ...(q.questionType ? { questionType: q.questionType } : {}),
          ...(q.status === "published"
            ? { published: true, archived: false }
            : q.status === "draft"
              ? { published: false, archived: false }
              : q.status === "archived"
                ? { archived: true }
                : {}),
          ...(q.search
            ? {
                OR: (["id", "title", "prompt"] as const).map(field => ({
                  [field]: { contains: q.search, mode: "insensitive" as const },
                })),
              }
            : {}),
        };
    const select = {
      id: true,
      skill: true,
      course: true,
      questionType: true,
      section: true,
      difficulty: true,
      title: true,
      prompt: true,
      published: true,
      archived: true,
      practiceEligible: true,
      assetIds: true,
      version: true,
    } as const;
    const [count, rows, sections, types] = await Promise.all([
      db.question.count({ where }),
      db.question.findMany({
        where,
        select,
        orderBy:
          q.order === "title"
            ? [{ title: "asc" }, { id: "asc" }]
            : q.order === "id"
              ? [{ id: "asc" }]
              : [{ section: "asc" }, { id: "asc" }],
        ...(ids ? {} : { skip: (q.page - 1) * q.limit, take: q.limit }),
      }),
      db.question.findMany({
        where: scope,
        distinct: ["section"],
        select: { section: true },
        orderBy: { section: "asc" },
      }),
      db.question.findMany({
        where: scope,
        distinct: ["questionType"],
        select: { questionType: true },
        orderBy: { questionType: "asc" },
      }),
    ]);
    return {
      count,
      page: q.page,
      rows: rows.map(r => ({ ...r, prompt: r.prompt.slice(0, 300) })),
      sections: sections.map(s => s.section),
      questionTypes: types.map(t => t.questionType),
    };
  });
  // One full question (with key and passage) for the editor and for list actions that save it back.
  app.get("/api/admin/questions/:id", async req => {
    admin(user(req));
    const q = await db.question.findUnique({ where: { id: identifier.parse(param(req, "id")) } });
    assert(q, 404, "Question not found");
    return publicQuestion(q, true);
  });
  app.put("/api/admin/questions/:id", async req => {
    const b = questionSchema.parse(req.body);
    assert(b.id === param(req, "id"), 400, "Question ID mismatch");
    return publicQuestion(await saveQuestion(db, user(req), b), true);
  });
  app.put("/api/admin/tests/:course/:id", async req => {
    const b = testSchema.parse(req.body);
    assert(b.id === param(req, "id") && b.course === param(req, "course"), 400, "Test identifier mismatch");
    return saveTest(db, user(req), b);
  });
  app.put("/api/admin/settings", async req => {
    const u = user(req);
    admin(u);
    const value = settingsSchema.parse(req.body);
    await transaction(db, async tx => {
      await tx.platformSetting.upsert({
        where: { id: "platform" },
        create: { id: "platform", value },
        update: { value, version: { increment: 1 } },
      });
      await audit(tx, u.id, "Settings updated", "platform");
    });
    return value;
  });
}
