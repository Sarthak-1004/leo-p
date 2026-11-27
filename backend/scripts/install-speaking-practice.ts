// Installs the private original Speaking practice pack for module practice (Learning Arena).
// Questions are installed as unpublished drafts for trainer review unless --publish is passed.
// Usage: npm run content:speaking-practice  (PRIVATE_SPEAKING_PACK_PATH is optional)
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { database } from "../src/db.js";
import { identifier } from "../src/domain.js";

const path = resolve(process.env.PRIVATE_SPEAKING_PACK_PATH ?? "content/speaking-practice-v1.json");
const pack = z
  .object({
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
      .max(500),
  })
  .passthrough()
  .parse(
    JSON.parse(
      await readFile(path, "utf8").catch(() => {
        throw new Error(
          "Private Speaking practice pack is unavailable. Set PRIVATE_SPEAKING_PACK_PATH to an approved local file.",
        );
      }),
    ),
  );
const publish = process.argv.includes("--publish");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before installing content");
const db = database(url);
try {
  // Questions already used in a test cannot join module practice (practice shows answers).
  const tests = await db.test.findMany({ select: { builder: true } });
  const used = new Set(tests.flatMap(t => Object.values((t.builder as any)?.questionIds ?? {}).flat() as string[]));
  const clash = pack.questions.find(q => used.has(q.id));
  if (clash) throw new Error(`${clash.id} is used in a test and cannot be a practice question`);
  let created = 0;
  for (const q of pack.questions) {
    const existing = await db.question.findUnique({ where: { id: q.id }, select: { published: true } });
    // Re-running never unpublishes questions a trainer has already approved.
    const data = {
      skill: "Speaking" as const,
      course: "BOTH" as const,
      questionType: q.section,
      section: q.section,
      difficulty: "Medium",
      title: `Original practice: ${q.title}`,
      prompt: q.prompt,
      options: [],
      answer: "",
      practiceEligible: true,
      published: publish || !!existing?.published,
    };
    await db.question.upsert({ where: { id: q.id }, update: data, create: { id: q.id, ...data } });
    if (!existing) created++;
  }
  console.log(
    `${pack.questions.length} Speaking practice questions installed (${created} new, ${publish ? "published" : "drafts unless already published"})`,
  );
} finally {
  await db.$disconnect();
}
