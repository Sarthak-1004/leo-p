import { z } from "zod";
import { Prisma, type Db } from "./db.js";
import { studentOnly, type Identity } from "./auth.js";
import { band, date, roundBand } from "./domain.js";

// Student dashboard analytics. Only results the student is allowed to see are counted:
// released FLTs, module practice, and Practice Mocks once all three skills are scored.
const visibleSql = Prisma.sql`((r."kind"='FLT' AND r."released") OR r."kind"='PRACTICE' OR (r."kind"='PRACTICE_MOCK' AND r."listening" IS NOT NULL AND r."reading" IS NOT NULL AND r."writing" IS NOT NULL AND (r."speaking" IS NOT NULL OR NOT COALESCE(r."originalScores"->'modules','[]'::jsonb) ? 'Speaking')))`;
const COHORT_MIN_STUDENTS = 5; // institute averages appear only when enough students contribute
const cohortCache = new Map<string, { at: number; value: Cohort }>();
type Cohort = {
  students: number;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  types: Record<string, number>;
};

export const goalsSchema = z.object({ examDate: date.nullable(), targetBand: band.min(4).nullable() }).strict();

const dayIn = (d: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

async function cohort(db: Db, course: string): Promise<Cohort> {
  const hit = cohortCache.get(course);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const [skills] = await db.$queryRaw<
    Array<{ students: number; listening: number | null; reading: number | null; writing: number | null }>
  >`
    SELECT count(DISTINCT r."studentId")::int AS students, AVG(r."listening")::float AS listening, AVG(r."reading")::float AS reading, AVG(r."writing")::float AS writing
    FROM "Result" r WHERE r."course"=${course}::"Course" AND ${visibleSql}`;
  const types = await db.$queryRaw<
    Array<{ module: string; questionType: string; correct: number; total: number; students: number }>
  >`
    SELECT t->>'module' AS module, t->>'questionType' AS "questionType", SUM((t->>'correct')::int)::int AS correct, SUM((t->>'total')::int)::int AS total, count(DISTINCT r."studentId")::int AS students
    FROM "Result" r, jsonb_array_elements(COALESCE(r."originalScores"->'typeScores','[]'::jsonb)) t
    WHERE r."course"=${course}::"Course" AND ${visibleSql} GROUP BY 1, 2`;
  const enough = skills!.students >= COHORT_MIN_STUDENTS;
  const value: Cohort = {
    students: skills!.students,
    listening: enough ? round2(skills!.listening) : null,
    reading: enough ? round2(skills!.reading) : null,
    writing: enough ? round2(skills!.writing) : null,
    types: Object.fromEntries(
      types
        .filter(t => t.students >= COHORT_MIN_STUDENTS && t.total > 0)
        .map(t => [`${t.module}/${t.questionType}`, Math.round((t.correct / t.total) * 100)]),
    ),
  };
  cohortCache.set(course, { at: Date.now(), value });
  return value;
}

export async function studentInsights(db: Db, user: Identity, timezone: string) {
  studentOnly(user);
  const course = user.student.course,
    studentId = user.id;
  const since = new Date(Date.now() - 183 * 86400_000);
  const [student, attempts, results, tests, peers] = await Promise.all([
    db.student.findUniqueOrThrow({ where: { id: studentId }, select: { examDate: true, targetBand: true } }),
    db.attempt.findMany({
      where: { studentId, course },
      select: { kind: true, testId: true, state: true, createdAt: true, submittedAt: true },
    }),
    db.$queryRaw<
      Array<{
        id: string;
        kind: string;
        testId: string;
        name: string;
        date: Date;
        listening: number | null;
        reading: number | null;
        writing: number | null;
        speaking: number | null;
        overall: number | null;
        typeScores: any;
        modules: any;
      }>
    >`
      SELECT r."id", r."kind"::text AS kind, r."testId", r."name", r."date", r."listening", r."reading", r."writing", r."speaking", r."overall", r."originalScores"->'typeScores' AS "typeScores", r."originalScores"->'modules' AS modules
      FROM "Result" r WHERE r."studentId"=${studentId} AND r."course"=${course}::"Course" AND ${visibleSql} ORDER BY r."date"`,
    db.test.findMany({ where: { course, published: true }, select: { kind: true, id: true, available: true } }),
    cohort(db, course),
  ]);
  // Activity: a day counts when the student started or submitted any test or practice.
  const days = new Set<string>();
  for (const a of attempts) {
    days.add(dayIn(a.createdAt, timezone));
    if (a.submittedAt) days.add(dayIn(a.submittedAt, timezone));
  }
  const todayKey = dayIn(new Date(), timezone);
  let streak = 0;
  for (let d = new Date(); ; d = new Date(d.getTime() - 86400_000)) {
    const key = dayIn(d, timezone);
    if (days.has(key)) streak++;
    else if (key !== todayKey) break; // today may still be empty; the streak counts up to yesterday
    if (streak > 3650) break;
  }
  const submitted = attempts.filter(a => a.state === "SUBMITTED");
  const distinct = (kind: string) => new Set(submitted.filter(a => a.kind === kind).map(a => a.testId)).size;
  const fullTests = results.filter(r => r.kind !== "PRACTICE");
  const skillBand = (key: "listening" | "reading" | "writing") => {
    const xs = fullTests.map(r => r[key]).filter((x): x is number => x !== null);
    return { band: round2(mean(xs)), count: xs.length };
  };
  // Question-type accuracy from every visible result (Listening and Reading are marked objectively).
  const typeMap = new Map<string, { module: string; questionType: string; correct: number; total: number }>();
  for (const r of results)
    for (const t of (r.typeScores ?? []) as {
      module: string;
      questionType: string;
      correct: number;
      total: number;
    }[]) {
      const key = `${t.module}/${t.questionType}`,
        cur = typeMap.get(key) ?? { module: t.module, questionType: t.questionType, correct: 0, total: 0 };
      cur.correct += t.correct;
      cur.total += t.total;
      typeMap.set(key, cur);
    }
  // Writing per task and criterion, from completed AI evaluations of visible results.
  const jobs = results.length
    ? await db.evaluationJob.findMany({
        where: { resultId: { in: results.map(r => r.id) }, state: "COMPLETED" },
        select: { resultId: true, output: true, completedAt: true },
        orderBy: { completedAt: "asc" },
      })
    : [];
  const latestJob = new Map(jobs.map(j => [j.resultId, j.output as any]));
  const writingTasks: Record<string, { scripts: number; criteria: Record<string, number[]> }> = {};
  for (const output of latestJob.values())
    for (const t of output?.tasks ?? []) {
      const entry = (writingTasks[t.task] ??= { scripts: 0, criteria: {} });
      entry.scripts++;
      for (const [k, v] of Object.entries(t.criteria ?? {}))
        (entry.criteria[k] ??= []).push(typeof v === "number" ? v : (v as any).band);
    }
  const writing = Object.fromEntries(
    Object.entries(writingTasks).map(([task, e]) => {
      const criteria = Object.fromEntries(Object.entries(e.criteria).map(([k, xs]) => [k, round2(mean(xs))]));
      const values = Object.values(criteria).filter((x): x is number => x !== null);
      return [
        task,
        {
          scripts: e.scripts,
          band: values.length ? roundBand(values.reduce((a, b) => a + b, 0) / values.length) : null,
          criteria,
        },
      ];
    }),
  );
  const recentOverall = fullTests
    .map(r => r.overall)
    .filter((x): x is number => x !== null)
    .slice(-3);
  const speaking = [...results].reverse().find(r => r.speaking !== null)?.speaking ?? null;
  return {
    goals: { examDate: student.examDate, targetBand: student.targetBand },
    activity: {
      activeDays: days.size,
      streak,
      testsGiven: submitted.filter(a => a.kind !== "PRACTICE").length,
      today: [
        ...new Set(
          results
            .filter(r => dayIn(r.date, timezone) === todayKey)
            .flatMap(r => (r.kind === "PRACTICE" ? (r.modules ?? [r.name.split(" ")[0]]) : ["Full test"])),
        ),
      ],
    },
    estimatedBand: recentOverall.length
      ? roundBand(recentOverall.reduce((a, b) => a + b, 0) / recentOverall.length)
      : null,
    tests: {
      flt: { done: distinct("FLT"), available: tests.filter(t => t.kind === "FLT" && t.available).length },
      practiceMock: {
        done: distinct("PRACTICE_MOCK"),
        available: tests.filter(t => t.kind === "PRACTICE_MOCK").length,
      },
    },
    skills: {
      listening: skillBand("listening"),
      reading: skillBand("reading"),
      writing: skillBand("writing"),
      speaking,
    },
    writingTasks: writing,
    cohort: { students: peers.students, listening: peers.listening, reading: peers.reading, writing: peers.writing },
    questionTypes: [...typeMap.values()]
      .map(t => ({
        ...t,
        accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0,
        cohortAccuracy: peers.types[`${t.module}/${t.questionType}`] ?? null,
      }))
      .sort((a, b) => a.module.localeCompare(b.module) || b.total - a.total),
    progress: results
      .filter(r => r.date >= since && r.kind !== "PRACTICE")
      .map(r => ({
        date: r.date.toISOString(),
        kind: r.kind,
        name: r.name,
        listening: r.listening,
        reading: r.reading,
        writing: r.writing,
        speaking: r.speaking,
        overall: r.overall,
      })),
  };
}

export async function saveGoals(db: Db, user: Identity, input: z.infer<typeof goalsSchema>) {
  studentOnly(user);
  // Respond with the stored values, not the request body.
  const saved = await db.student.update({
    where: { id: user.id },
    data: { examDate: input.examDate, targetBand: input.targetBand },
    select: { examDate: true, targetBand: true },
  });
  return { examDate: saved.examDate, targetBand: saved.targetBand };
}
