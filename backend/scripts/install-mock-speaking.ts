// Adds the private original Speaking sets to Practice Mock Tests (both courses) through the normal
// test-save validation, so FLTs, practice questions and unpublished content are refused as in the Admin builder.
// Usage: npm run content:mock-speaking  (PRIVATE_MOCK_SPEAKING_PATH and CONTENT_ADMIN_ID are optional)
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { database, transaction } from "../src/db.js";
import { saveTestRecord } from "../src/content.js";
import { identifier } from "../src/domain.js";

const path = resolve(process.env.PRIVATE_MOCK_SPEAKING_PATH ?? "content/mock-speaking-v1.json");
const pack = z
  .object({
    minutes: z.number().int().min(1).max(30),
    sets: z
      .array(
        z
          .object({
            mock: z.number().int().min(1),
            questions: z
              .array(
                z
                  .object({
                    id: identifier,
                    section: z.enum(["Part 1", "Part 2", "Part 3"]),
                    title: z.string().min(1).max(120),
                    prompt: z.string().min(1).max(2000),
                  })
                  .strict(),
              )
              .min(1)
              .max(12),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough()
  .parse(
    JSON.parse(
      await readFile(path, "utf8").catch(() => {
        throw new Error(
          "Private mock Speaking pack is unavailable. Set PRIVATE_MOCK_SPEAKING_PATH to an approved local file.",
        );
      }),
    ),
  );

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before installing content");
const db = database(url);
try {
  const users = await db.user.findMany({
    where: {
      role: "ADMIN",
      enabled: true,
      ...(process.env.CONTENT_ADMIN_ID ? { id: process.env.CONTENT_ADMIN_ID } : {}),
    },
    include: { student: true },
    take: 2,
  });
  if (users.length !== 1) throw new Error("Set CONTENT_ADMIN_ID to one enabled Admin account");
  const user = users[0] as any;
  let tests = 0;
  for (const set of pack.sets) {
    await transaction(db, async tx => {
      for (const q of set.questions) {
        const data = {
          skill: "Speaking" as const,
          course: "BOTH" as const,
          questionType: q.section,
          section: q.section,
          difficulty: "Medium",
          title: `Mock Speaking: ${q.title}`,
          prompt: q.prompt,
          options: [],
          answer: "",
          practiceEligible: false,
          published: true,
          archived: false,
        };
        await tx.question.upsert({ where: { id: q.id }, update: data, create: { id: q.id, ...data } });
      }
      for (const course of ["GENERAL", "ACADEMIC"] as const) {
        const t = await tx.test.findFirst({ where: { course, kind: "PRACTICE_MOCK", number: set.mock } });
        if (!t) {
          console.log(`${course} Practice Mock ${set.mock} not found; skipped`);
          continue;
        }
        const builder = t.builder as any;
        await saveTestRecord(tx, user, {
          id: t.id,
          course,
          kind: "PRACTICE_MOCK",
          number: t.number,
          published: t.published,
          available: false,
          duration: t.duration,
          version: t.version,
          builder: {
            questionIds: {
              Listening: builder.questionIds.Listening,
              Reading: builder.questionIds.Reading,
              Writing: builder.questionIds.Writing,
              Speaking: set.questions.map(q => q.id),
            },
            duration: {
              Listening: builder.duration.Listening,
              Reading: builder.duration.Reading,
              Writing: builder.duration.Writing,
              Speaking: pack.minutes,
            },
          },
        });
        tests++;
      }
    });
  }
  console.log(
    `${pack.sets.reduce((n, s) => n + s.questions.length, 0)} mock Speaking questions installed; ${tests} Practice Mock Tests updated`,
  );
} finally {
  await db.$disconnect();
}
