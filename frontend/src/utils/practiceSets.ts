import type { Question } from "../types/domain";

// Learning Arena practice sets: Question Specific groups one passage or recording by question type;
// Sectional groups the whole passage or recording. Writing tasks are sets on their own.
export type Mode = "type" | "section";
export type Tab = "Listening" | "Reading" | "Writing" | "Writing Task 1" | "Writing Task 2" | "Speaking";
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

// Sectional books: one book per practice pack (question id prefix, e.g. "orig-v1"); inside it, Test k takes
// the k-th set of every section (Part 1, Part 2 ... / Passage 1 ... / Task 1, Task 2), as the material does not
// record its own book or test number.
export type Book = { key: string; title: string; tests: { number: number; parts: PracticeSet[] }[]; parts: number };
const sectionOrder = (s: string) => { const m = s.match(/(\d+)/); return (/task/i.test(s) ? 100 : 0) + (m ? Number(m[1]) : 50); };
export function buildBooks(sets: PracticeSet[]): Book[] {
  const books = new Map<string, PracticeSet[]>();
  for (const set of sets) { const key = set.questions[0]!.id.split("-").slice(0, 2).join("-"); books.set(key, [...(books.get(key) ?? []), set]); }
  return [...books.entries()].map(([key, list], i) => {
    const sections = new Map<string, PracticeSet[]>();
    for (const set of list) sections.set(set.section, [...(sections.get(set.section) ?? []), set]);
    const ordered = [...sections.entries()].sort((a, b) => sectionOrder(a[0]) - sectionOrder(b[0]));
    const count = Math.max(...ordered.map(([, v]) => v.length));
    const tests = Array.from({ length: count }, (_, t) => ({ number: t + 1, parts: ordered.map(([, v]) => v[t]).filter((x): x is PracticeSet => !!x) }));
    return { key, title: `LEO PREP Practice Book ${i + 1}`, tests, parts: list.length };
  });
}
