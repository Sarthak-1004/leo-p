import { SPEAKING_RUBRIC, recordingKeyPrefix } from "./speaking.js";
import { WRITING_RUBRIC } from "./worker.js";
import { platformSettings } from "./settings.js";
import { randomUUID } from "node:crypto";
import type { Db, Tx } from "./db.js";
import { json, lockedTransaction, transaction } from "./db.js";
import {
  assert,
  overall,
  rawBand,
  packSnapshotQuestions,
  snapshotQuestions,
  type Heartbeat,
  type Conversions,
  testBuilder,
  type TestBuilder,
  type SnapshotQuestion,
} from "./domain.js";
import { audit, notify, studentOnly, digest, type Identity } from "./auth.js";
import { attemptView } from "./views.js";
import type { Attempt } from "./generated/prisma/client.js";
export const SIGNAL_GAP_MS = 7500;
// Section order. Speaking runs only in Practice Mock Tests that include Speaking questions; FLT Speaking is offline,
// so an FLT never gets Speaking time and ends after Writing.
export const SECTIONS = ["Listening", "Reading", "Writing", "Speaking"] as const;
export type Snapshot = {
  title: string;
  questions: SnapshotQuestion[];
  passages?: string[];
  builder: TestBuilder;
  conversions: Conversions;
  version: number;
  skill?: string;
  untimed?: boolean;
};
export async function owned(tx: Tx | Db, user: Identity, id: string) {
  const a = await tx.attempt.findUnique({ where: { id } });
  assert(
    a && (user.role !== "STUDENT" || (a.studentId === user.id && a.course === user.student?.course)),
    404,
    "Attempt not found",
  );
  return a;
}
// Full tests run Listening -> Reading -> Writing. The first section with time left is the only open one.
const openSection = (remainingBySection: Record<string, number>) =>
  SECTIONS.findIndex(s => (remainingBySection[s] ?? 0) > 0);
export async function startTest(db: Db, user: Identity, course: "GENERAL" | "ACADEMIC", testId: string) {
  studentOnly(user);
  assert(user.student.course === course, 403, "This course is not assigned to your account");
  // The Student row lock serializes this student's starts; Read Committed avoids false
  // conflicts between different students starting the same test at once.
  return transaction(
    db,
    async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${user.id} FOR UPDATE`;
      const test = await tx.test.findUnique({ where: { course_id: { course, id: testId } } });
      const existing = await tx.attempt.findFirst({
        where: { studentId: user.id, course, testId, state: "IN_PROGRESS" },
      });
      if (existing) return attemptView(existing, true);
      assert(test && test.published && (test.kind !== "FLT" || test.available), 403, "This test is unavailable");
      const used = await tx.attempt.count({ where: { studentId: user.id, course, testId } });
      assert(used < (test.kind === "FLT" ? 1 : 2), 409, "All attempts for this test have been used");
      const builder = testBuilder(test.builder);
      const live = SECTIONS.filter(
        s =>
          s !== "Speaking" ||
          (test.kind === "PRACTICE_MOCK" &&
            (builder.questionIds?.Speaking?.length ?? 0) > 0 &&
            Number(builder.duration?.Speaking) > 0),
      );
      const ids = live.flatMap(s => builder.questionIds?.[s] ?? []);
      const questions = await tx.question.findMany({
        where: { id: { in: ids }, published: true, archived: false, course: { in: [course, "BOTH"] } },
      });
      assert(questions.length === ids.length && ids.length > 0, 409, "Test content is not ready");
      const snapshot: Snapshot = {
        title: test.title,
        ...packSnapshotQuestions(ids.map((id: string) => questions.find(q => q.id === id))),
        builder,
        conversions: test.conversions as Conversions,
        version: test.version,
      };
      const a = await tx.attempt.create({
        data: {
          studentId: user.id,
          course,
          testId,
          kind: test.kind,
          number: used + 1,
          snapshot: json(snapshot),
          answers: {},
          remainingMs: test.duration * 60000,
          remainingBySection: json(Object.fromEntries(live.map(s => [s, Number(builder.duration![s]) * 60000]))),
          sessionKey: randomUUID(),
          lastSignalAt: new Date(),
        },
      });
      await tx.attemptLog.create({ data: { attemptId: a.id, event: "START", remainingMs: a.remainingMs } });
      return attemptView(a, true);
    },
    "ReadCommitted",
  );
}
export async function startPractice(
  db: Db,
  user: Identity,
  selection: { skill: string; mode: string; selection: string; questionId?: string; questionIds?: string[] },
) {
  studentOnly(user);
  const { dailyPracticeLimit } = await platformSettings(db);
  const recent = await db.attempt.count({
    where: { studentId: user.id, kind: "PRACTICE", createdAt: { gte: new Date(Date.now() - 86400000) } },
  });
  assert(
    recent < dailyPracticeLimit,
    429,
    `You have reached today's limit of ${dailyPracticeLimit} practice sessions. Try again tomorrow`,
  );
  let questions = await db.question.findMany({
    where: {
      ...(selection.questionIds?.length
        ? { id: { in: selection.questionIds } }
        : selection.questionId
          ? { id: selection.questionId }
          : {}),
      skill: selection.skill as any,
      course: { in: [user.student.course, "BOTH"] },
      published: true,
      archived: false,
      practiceEligible: true,
      ...(selection.questionIds?.length
        ? {}
        : selection.mode === "section"
          ? { section: selection.selection }
          : { questionType: selection.selection }),
    },
    orderBy: { id: "asc" },
    take: 100,
  });
  // A chosen practice set must be served whole: every requested question must be eligible for this student.
  if (selection.questionIds?.length)
    assert(
      questions.length === new Set(selection.questionIds).size,
      404,
      "Some of these practice questions are no longer available",
    );
  assert(questions.length, 404, "No published practice content matches this selection");
  if (selection.skill === "Writing") questions = questions.slice(0, 1);
  const minutes = selection.skill === "Writing" && questions[0]?.section === "Task 2" ? 40 : 20;
  const untimed = selection.skill !== "Writing";
  const a = await db.attempt.create({
    data: {
      studentId: user.id,
      course: user.student.course,
      testId: `practice-${randomUUID()}`,
      kind: "PRACTICE",
      number: 1,
      snapshot: json({
        title: `${selection.skill} practice`,
        skill: selection.skill,
        ...packSnapshotQuestions(questions),
        // Keyed from the fixed section list rather than the request value.
        builder: { duration: Object.fromEntries(SECTIONS.filter(s => s === selection.skill).map(s => [s, minutes])) },
        conversions: {},
        version: 1,
        untimed,
      }),
      answers: {},
      remainingMs: untimed ? 0 : minutes * 60000,
      remainingBySection: untimed ? {} : { [selection.skill]: minutes * 60000 },
      section: Math.max(0, SECTIONS.indexOf(selection.skill as (typeof SECTIONS)[number])),
      sessionKey: randomUUID(),
      lastSignalAt: new Date(),
    },
  });
  return attemptView(a, true);
}
function validateAnswers(keys: string[], answers: Record<string, string>) {
  const allowed = new Set(
    keys.flatMap(key => {
      const [skill, ...id] = key.split(":");
      return [key, `${skill}:flag:${id.join(":")}`];
    }),
  );
  if (keys.some(key => key.startsWith("Writing:")))
    for (const key of ["Writing:Task 1", "Writing:Task 2"]) allowed.add(key);
  for (const key of Object.keys(answers)) assert(allowed.has(key), 400, "An answer does not belong to this attempt");
}
// Heartbeat hot path caches. A snapshot can never change once an attempt starts (enforced by a
// database trigger), so its answer keys are cached per attempt; settings are reused for 5 s.
const keyCache = new Map<string, { keys: string[]; untimed: boolean }>();
let settingsCache: { at: number; value: Awaited<ReturnType<typeof platformSettings>> } | undefined;
async function attemptKeys(tx: Tx, id: string) {
  const hit = keyCache.get(id);
  if (hit) return hit;
  const [meta] = await tx.$queryRaw<
    Array<{ keys: string[]; untimed: boolean | null }>
  >`SELECT COALESCE((SELECT array_agg((q->>'skill')||':'||(q->>'id')) FROM jsonb_array_elements("snapshot"->'questions') q),'{}') AS keys,("snapshot"->>'untimed')::boolean AS untimed FROM "Attempt" WHERE "id"=${id}`;
  const value = { keys: meta!.keys, untimed: !!meta!.untimed };
  if (keyCache.size >= 5000) keyCache.delete(keyCache.keys().next().value!);
  keyCache.set(id, value);
  return value;
}
async function heartbeatSettings(tx: Tx) {
  if (!settingsCache || Date.now() - settingsCache.at > 5000)
    settingsCache = { at: Date.now(), value: await platformSettings(tx) };
  return settingsCache.value;
}
export async function signal(db: Db, user: Identity, id: string, body: Heartbeat, submit = false) {
  studentOnly(user);
  return lockedTransaction(db, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${id} FOR UPDATE`;
    // Heartbeats arrive every few seconds from every student: never load the whole paper here.
    // PostgreSQL projects just the answer keys; the full snapshot is read only when it is needed.
    const a = await tx.attempt.findUnique({ where: { id }, omit: { snapshot: true } });
    assert(a && a.studentId === user.id && a.course === user.student.course, 404, "Attempt not found");
    const full = async () => tx.attempt.findUniqueOrThrow({ where: { id } });
    if (a.state === "SUBMITTED") {
      assert(submit, 409, "This attempt is already submitted");
      return { attempt: attemptView(a as Attempt), submitted: true };
    }
    assert(a.sessionKey === body.sessionKey, 409, "This attempt is open in another session. Resume it again");
    assert(body.sequence >= a.sequence, 409, "A newer answer revision is already saved");
    const fingerprint = digest(
      JSON.stringify({
        ...body,
        submit,
        answers: Object.fromEntries(Object.entries(body.answers).sort(([a], [b]) => a.localeCompare(b))),
      }),
    );
    // A retried request (e.g. after a lost response) may have opened a new section: resend its questions.
    if (body.sequence === a.sequence) {
      assert(
        a.lastSignalHash === fingerprint,
        409,
        "Another save used this revision. Reload saved answers to reconcile the conflict",
      );
      return { attempt: attemptView(await full(), true), duplicate: true };
    }
    assert(body.sequence === a.sequence + 1, 409, "Refresh the attempt before saving another revision");
    const meta = await attemptKeys(tx, id);
    validateAnswers(meta.keys, body.answers);
    assert(a.kind !== "PRACTICE" || body.section === a.section, 400, "Module practice cannot change to another skill");
    const now = new Date();
    const gap = a.lastSignalAt ? Math.max(0, now.getTime() - a.lastSignalAt.getTime()) : 0;
    // Client reconnect claims cannot erase a server-observed continuous interval.
    // Only server signal staleness establishes a break in continuity. A hidden tab
    // keeps signalling, so its time is deducted (and recorded separately for review).
    const interrupted = gap > SIGNAL_GAP_MS;
    const elapsed = interrupted ? 0 : gap;
    const sectionName = SECTIONS[a.section]!;
    const remainingBySection = { ...(a.remainingBySection as Record<string, number>) };
    const hasSections = Object.keys(remainingBySection).length > 0;
    if (hasSections) remainingBySection[sectionName] = Math.max(0, (remainingBySection[sectionName] ?? 0) - elapsed);
    const remainingMs = hasSections
      ? Object.values(remainingBySection).reduce((sum, n) => sum + n, 0)
      : Math.max(0, a.remainingMs - elapsed);
    const settings = await heartbeatSettings(tx);
    const interruptions = a.interruptions + (interrupted ? 1 : 0);
    // A gap that follows a hidden-tab signal is the student leaving, not a connection failure:
    // no time is deducted (PRD), but the attempt is flagged for Admin review straight away.
    const hiddenGap = interrupted && a.lastHidden;
    const flagged = a.flagged || interruptions > settings.interruptionLimit || hiddenGap;
    const untimed = meta.untimed;
    const submittedSections = [...a.submittedSections];
    if (body.completeSection) {
      assert(a.kind !== "PRACTICE", 400, "Submit module practice using final submission");
      assert(!submittedSections.includes(sectionName), 409, "This section is already submitted");
      submittedSections.push(sectionName);
    }
    const finished = submit || (!untimed && remainingMs === 0);
    const previous = a.answers as Record<string, string>;
    for (const [key, value] of Object.entries(body.answers)) {
      const skill = key.split(":")[0]!;
      if (skill !== sectionName && (remainingBySection[skill] ?? 0) > 0)
        assert(value === (previous[key] ?? ""), 400, "Answers can only change in the open section");
    }
    // Merged in a Map so client-chosen keys never become properties of a live object.
    const accepted = new Map(Object.entries(body.answers));
    // A sparse request must never erase previously saved inactive-skill answers.
    for (const [key, value] of Object.entries(previous))
      if (key.split(":")[0] !== sectionName) accepted.set(key, value);
    if (hasSections)
      for (const key of [...accepted.keys()]) {
        const skill = key.split(":")[0]!;
        if ((remainingBySection[skill] ?? 0) === 0) {
          const old = previous[key];
          if (old === undefined) accepted.delete(key);
          else accepted.set(key, old);
        }
      }
    if (hasSections)
      for (const [key, value] of Object.entries(previous))
        if ((remainingBySection[key.split(":")[0]!] ?? 0) === 0) accepted.set(key, value);
    if (body.completeSection) {
      remainingBySection[sectionName] = 0;
      await tx.attemptLog.create({
        data: {
          attemptId: id,
          event: `SECTION_SUBMIT:${sectionName}`,
          remainingMs: Object.values(remainingBySection).reduce((sum, n) => sum + n, 0),
          at: now,
        },
      });
    }
    const finalRemaining = hasSections ? Object.values(remainingBySection).reduce((sum, n) => sum + n, 0) : remainingMs;
    const complete = finished || (!untimed && finalRemaining === 0);
    // The server decides the open section; a client cannot skip ahead or go back.
    const section = a.kind === "PRACTICE" || !hasSections ? a.section : Math.max(0, openSection(remainingBySection));
    const savedAnswers = json(!untimed && a.remainingMs === 0 ? a.answers : Object.fromEntries(accepted));
    // Listening plays once: the stored audio position only ever moves forward, so a reload cannot replay it.
    const audio =
      body.audioPart !== undefined &&
      body.audioMs !== undefined &&
      (body.audioPart > a.audioPart || (body.audioPart === a.audioPart && body.audioMs > a.audioMs))
        ? { audioPart: body.audioPart, audioMs: body.audioMs }
        : {};
    const updated = await tx.attempt.update({
      where: { id },
      data: {
        ...audio,
        answers: savedAnswers,
        remainingMs: finalRemaining,
        submittedSections,
        activeMs: { increment: Math.floor(elapsed) },
        ...(body.hidden && elapsed ? { hiddenMs: { increment: Math.floor(elapsed) } } : {}),
        lastHidden: body.hidden,
        remainingBySection: json(remainingBySection),
        section,
        question: section !== a.section ? 0 : body.question,
        theme: body.theme,
        fontSize: body.fontSize,
        sequence: body.sequence,
        lastSignalHash: fingerprint,
        lastSignalAt: now,
        interruptions,
        flagged,
        ...(interrupted && flagged ? { reviewedAt: null } : {}),
        state: complete ? "SUBMITTED" : "IN_PROGRESS",
        submittedAt: complete ? now : null,
      },
      omit: { snapshot: true },
    });
    if (interrupted) {
      await tx.attemptLog.createMany({
        data: [
          {
            attemptId: id,
            event: hiddenGap ? "STOP:HIDDEN_TAB" : "STOP",
            remainingMs: a.remainingMs,
            at: a.lastSignalAt ?? now,
          },
          { attemptId: id, event: "RESUME", remainingMs: a.remainingMs, at: now },
        ],
      });
      await audit(tx, user.id, flagged ? "Attempt flagged for review" : "Attempt resumed", id, {
        interruptions,
        remainingMs,
        ...(hiddenGap ? { afterHiddenTab: true } : {}),
      });
    }
    if (section !== a.section && !complete)
      await tx.attemptLog.create({
        data: { attemptId: id, event: `SECTION_OPEN:${SECTIONS[section]}`, remainingMs: finalRemaining, at: now },
      });
    // Questions are sent only when the open section changes (the browser keeps the current ones).
    const content = complete || section !== a.section ? await full() : null;
    if (complete) await scoreSubmission(tx, content!);
    return { attempt: content ? attemptView(content, true) : attemptView(updated as Attempt), submitted: complete };
  });
}
// tabKey: chosen once per page load by the browser, so repeated loads from the same page (React
// StrictMode, a double click on reload) keep one key instead of racing; a new tab sends a new key.
export async function resumeAttempt(db: Db, user: Identity, id: string, tabKey?: string) {
  studentOnly(user);
  return lockedTransaction(db, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id"=${id} FOR UPDATE`;
    const a = await owned(tx, user, id);
    if (a.state === "SUBMITTED") return attemptView(a, true);
    // Opening the attempt takes it over: any other tab's session key stops working.
    // The saved sequence is kept, so the new tab continues from acknowledged answers.
    const resumed =
      a.sessionKey === tabKey
        ? a
        : await tx.attempt.update({ where: { id }, data: { sessionKey: tabKey ?? randomUUID() } });
    return attemptView(resumed, true);
  });
}
// Closes an attempt with its saved answers (Admin action, wall-clock limit or inactive access).
export async function forceSubmit(tx: Tx, id: string, actorId: string, reason: string) {
  await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id"=${id} FOR UPDATE`;
  const a = await tx.attempt.findUnique({ where: { id } });
  if (!a || a.state === "SUBMITTED") return false;
  const now = new Date();
  const updated = await tx.attempt.update({ where: { id }, data: { state: "SUBMITTED", submittedAt: now } });
  await tx.attemptLog.create({ data: { attemptId: id, event: `FORCED_SUBMIT`, remainingMs: a.remainingMs, at: now } });
  await audit(tx, actorId, "Attempt submitted on the student's behalf", id, {
    reason,
    remainingMs: a.remainingMs,
    interruptions: a.interruptions,
  });
  await scoreSubmission(tx, updated);
  await notify(
    tx,
    a.studentId,
    `Your ${(a.snapshot as Snapshot).title} attempt was submitted with your saved answers.`,
    "/student/history",
  );
  return true;
}
const hasText = (answers: Record<string, string>) =>
  Object.entries(answers).some(
    ([key, value]) => key.startsWith("Writing:") && !key.includes(":flag:") && value.trim().length > 0,
  );
async function scoreSubmission(tx: Tx, a: Attempt) {
  const snapshot = a.snapshot as Snapshot;
  const answers = a.answers as Record<string, string>;
  const raw: Record<string, { correct: number; total: number }> = {};
  const bands: Record<string, number | null> = { Listening: null, Reading: null };
  // Per question-type tallies are stored once here so reports never re-read snapshots.
  const typeScores = new Map<
    string,
    { module: string; questionType: string | undefined; correct: number; total: number }
  >();
  const normalize = (value: string) => value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
  for (const module of ["Listening", "Reading"]) {
    const questions = snapshot.questions.filter(q => q.skill === module);
    let correct = 0;
    for (const q of questions) {
      const accepted = (Array.isArray(q.answer) ? q.answer : [q.answer ?? ""]).filter(key => key.trim());
      const right = accepted.some(key => normalize(key) === normalize(answers[`${module}:${q.id}`] ?? ""));
      if (right) correct++;
      const key = `${module}/${q.questionType}`,
        score = typeScores.get(key) ?? { module, questionType: q.questionType, correct: 0, total: 0 };
      score.total++;
      if (right) score.correct++;
      typeScores.set(key, score);
    }
    raw[module] = { correct, total: questions.length };
    bands[module] = rawBand(correct, module, a.course, snapshot.conversions, questions.length);
  }
  const hasWriting = snapshot.questions.some(q => q.skill === "Writing");
  // Practice Speaking: answers are the student's own recording ids; a blank practice scores 0 without an AI call.
  const hasSpeaking = a.kind !== "FLT" && snapshot.questions.some(q => q.skill === "Speaking");
  const recordings = hasSpeaking
    ? Object.entries(answers)
        .filter(([k, v]) => k.startsWith("Speaking:") && !k.includes(":flag:") && v)
        .map(([, v]) => v)
    : [];
  if (recordings.length) {
    const owned = await tx.asset.count({
      where: { id: { in: recordings }, key: { startsWith: recordingKeyPrefix(a.studentId, a.id) } },
    });
    assert(owned === new Set(recordings).size, 400, "A recording does not belong to this practice");
  }
  const blankSpeaking = hasSpeaking && !recordings.length;
  // Blank module-practice Writing scores 0 without a paid AI call (full tests keep staff review).
  const blankWriting = a.kind === "PRACTICE" && hasWriting && !hasText(answers);
  const s = await tx.student.findUnique({ where: { id: a.studentId }, select: { trainerId: true } });
  const settings = await platformSettings(tx);
  // Writing and Speaking are marked by separate AI jobs (a Practice Mock can have both).
  let autoWriting =
    ((hasWriting && !blankWriting) || (hasSpeaking && !blankSpeaking)) && settings.autoWritingEvaluation;
  let quota = "";
  if (autoWriting) {
    const since = new Date(Date.now() - 86400000);
    const portal = await tx.evaluationJob.count({ where: { createdAt: { gte: since } } });
    const own =
      a.kind === "PRACTICE"
        ? await tx.evaluationJob.count({
            where: { createdAt: { gte: since }, result: { studentId: a.studentId, kind: "PRACTICE" } },
          })
        : 0;
    if (portal >= settings.dailyAiBudget) quota = "portal";
    else if (a.kind === "PRACTICE" && own >= settings.dailyPracticeAiLimit) quota = "student";
    if (quota) autoWriting = false;
  }
  const writing = blankWriting ? 0 : null;
  const speaking = blankSpeaking ? 0 : null;
  const reviewStatus =
    a.kind === "FLT" || (hasWriting && !blankWriting) || (hasSpeaking && !blankSpeaking) ? "Pending" : "Completed";
  const r = await tx.result.create({
    data: {
      id: a.id,
      studentId: a.studentId,
      assignedTrainerId: s?.trainerId,
      course: a.course,
      testId: a.testId,
      kind: a.kind,
      name: snapshot.title,
      attemptNumber: a.number,
      minutes: Math.ceil(a.activeMs / 60000),
      listening: bands.Listening,
      reading: bands.Reading,
      writing,
      speaking,
      overall: overall({ listening: bands.Listening ?? null, reading: bands.Reading ?? null, writing, speaking }),
      rawScores: json(raw),
      originalScores: json({
        modules: [...new Set(snapshot.questions.map(q => q.skill))],
        typeScores: [...typeScores.values()],
        questionTypes: [...new Set(snapshot.questions.map(q => `${q.skill}/${q.questionType}`))],
        listening: bands.Listening,
        reading: bands.Reading,
        writing,
        ...(blankWriting ? { writingBlank: true } : {}),
        ...(quota ? { aiSkipped: quota } : {}),
      }),
      aiStatus: hasWriting ? (blankWriting ? "Completed" : autoWriting ? "Pending" : "Manual review") : "Completed",
      reviewStatus,
      released: a.kind !== "FLT",
    },
  });
  if (autoWriting && hasWriting && !blankWriting)
    await tx.evaluationJob.create({ data: { resultId: r.id, rubricVersion: WRITING_RUBRIC } });
  if (autoWriting && hasSpeaking && !blankSpeaking)
    await tx.evaluationJob.create({ data: { resultId: r.id, rubricVersion: SPEAKING_RUBRIC } });
  if (quota) await audit(tx, "system", "Writing AI skipped: daily limit reached", r.id, { limit: quota });
  if (
    (a.kind === "FLT" || (((hasWriting && !blankWriting) || (hasSpeaking && !blankSpeaking)) && !autoWriting)) &&
    s?.trainerId
  )
    await notify(tx, s.trainerId, `New marksheet: ${snapshot.title}`, `/trainer/evaluations/${r.id}`);
  await audit(tx, a.studentId, "Attempt submitted", a.id, { kind: a.kind });
}

// Practice history for the Learning Arena cards: which questions each practice attempt covered and its objective score.
export async function practiceHistory(db: Db, user: Identity) {
  studentOnly(user);
  const attempts = await db.attempt.findMany({
    where: { studentId: user.id, course: user.student.course, kind: "PRACTICE" },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, state: true, createdAt: true, snapshot: true },
  });
  const results = await db.result.findMany({
    where: { id: { in: attempts.map(a => a.id) } },
    select: { id: true, rawScores: true, writing: true, aiStatus: true },
  });
  const byId = new Map(results.map(r => [r.id, r]));
  return attempts.map(a => {
    const r = byId.get(a.id);
    const raw = Object.values((r?.rawScores ?? {}) as Record<string, { correct: number; total: number }>);
    return {
      attemptId: a.id,
      state: a.state === "SUBMITTED" ? "Completed" : "In progress",
      date: a.createdAt.toISOString(),
      questionIds: snapshotQuestions(a.snapshot).map(q => q.id),
      correct: raw.reduce((n, x) => n + (x.correct ?? 0), 0),
      total: raw.reduce((n, x) => n + (x.total ?? 0), 0),
      writing: r?.writing ?? null,
      aiStatus: r?.aiStatus ?? null,
    };
  });
}
