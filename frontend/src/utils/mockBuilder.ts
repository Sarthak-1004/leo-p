import type { BuilderDraft, MockTest, Skill } from "../types/domain";

// Pure helpers for the Admin test builder. Kept outside the page so they can be unit tested.
export const skills: Skill[] = ["Listening", "Reading", "Writing", "Speaking"];
export type OnlineSkill = "Listening" | "Reading" | "Writing" | "Speaking";
// Speaking is optional and only in Practice Mocks (up to 12 questions across Parts 1-3).
export const required: Record<OnlineSkill, number> = { Listening: 40, Reading: 40, Writing: 2, Speaking: 12 };
// Mirrors the server's per-section duration limits.
export const maxMinutes: Record<OnlineSkill, number> = { Listening: 90, Reading: 120, Writing: 120, Speaking: 30 };
export const conversionNames = ["Listening", "AcademicReading", "GeneralReading"];
export const emptyBuilder = (): BuilderDraft => ({
  questionIds: { Listening: [], Reading: [], Writing: [], Speaking: [] },
  duration: { Listening: 30, Reading: 60, Writing: 60, Speaking: 0 },
});
export const structure = (b: BuilderDraft) => JSON.stringify(skills.map(s => [b.questionIds[s] ?? [], b.duration[s]]));
export const testName = (t: MockTest) =>
  `${t.kind === "FLT" ? "FLT" : "Practice Mock"} ${String(t.number).padStart(2, "0")}`;
export const bySection = (a?: string, b?: string) => (a ?? "").localeCompare(b ?? "", undefined, { numeric: true });
