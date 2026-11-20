import type { Question } from "../types/domain";

// Learning Arena practice sets: Question Specific groups one passage or recording by question type;
// Sectional groups the whole passage or recording. Writing tasks are sets on their own.
export type Mode = "type" | "section";
export type Tab = "Listening" | "Reading" | "Writing Task 1" | "Writing Task 2" | "Speaking";
export type PracticeSet = { key: string; number: number; title: string; skill: Question["skill"]; section: string; type: string; difficulty: string; questions: Question[] };
export const DIFFICULTY: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
export const setName = (q: Question) => q.title.replace(/^Original practice:\s*/i, "").replace(/\s*\d+\s*$/, "").trim() || q.title;
export const tabOf = (q: Question): Tab => q.skill === "Writing" ? (q.section === "Task 2" ? "Writing Task 2" : "Writing Task 1") : q.skill as Tab;
export function buildSets(questions: Question[], mode: Mode): PracticeSet[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    // Writing: each task is its own set. Others: same skill, course scope and source title (one passage or recording).
    const base = q.skill === "Writing" ? q.id : `${q.skill}|${q.section ?? ""}|${setName(q)}`;
    const key = mode === "type" && q.skill !== "Writing" ? `${base}|${q.questionType ?? ""}` : base;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  return [...groups.entries()].map(([key, qs], i) => {
    const q = qs[0]!, types = [...new Set(qs.map(x => x.questionType).filter(Boolean))] as string[];
    const level = Math.round(qs.reduce((n, x) => n + (DIFFICULTY[x.difficulty ?? "Medium"] ?? 2), 0) / qs.length);
    return { key, number: i + 1, title: q.skill === "Writing" ? q.title.replace(/^Original practice:\s*/i, "") : setName(q), skill: q.skill, section: q.section ?? "", type: mode === "type" ? types[0] ?? "Mixed" : types.length > 1 ? `${types.length} question types` : types[0] ?? "", difficulty: ["", "Easy", "Medium", "Hard"][level] ?? "Medium", questions: qs };
  });
}
