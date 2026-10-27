import type { Course, Result, SpeakingCriteria } from "../types/domain";

export function roundBand(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 9) throw new RangeError("Band must be between 0 and 9");
  return Math.round((value + Number.EPSILON) * 2) / 2;
}
export function overallBand(result: Pick<Result, "listening" | "reading" | "writing" | "speaking">): number | null {
  if (result.writing === null || result.listening === null || result.reading === null) return null;
  const bands = [result.listening, result.reading, result.writing];
  if (result.speaking !== null) bands.push(result.speaking);
  return roundBand(bands.reduce((sum, band) => sum + band, 0) / bands.length);
}
export function speakingBand(criteria: SpeakingCriteria): number {
  const bands = Object.values(criteria);
  if (bands.length !== 4 || bands.some(n => !Number.isInteger(n) || n < 0 || n > 9)) throw new RangeError("Enter four whole bands from 0 to 9");
  return roundBand(bands.reduce((a, b) => a + b, 0) / 4);
}
export function writingBand(task1: number, task2: number): number {
  if ([task1, task2].some(n => !Number.isFinite(n) || n < 0 || n > 9)) throw new RangeError("Invalid task band");
  return roundBand((task1 + 2 * task2) / 3);
}
export function overallLabel(result: Pick<Result, "kind" | "speaking">): string {
  if (result.kind === "PRACTICE") return "Module score";
  if (result.speaking !== null) return "Overall (4 skills)";
  return result.kind === "FLT" ? "Overall (3 skills) — Speaking pending" : "Overall (3 skills)";
}
export function isResultVisible(result: Result): boolean {
  if (result.visible !== undefined) return result.visible;
  return result.kind === "FLT" ? result.released : result.writing !== null && (result.aiStatus !== "Failed" || result.reviewStatus === "Completed");
}
export function canRelease(result: Result): boolean {
  return result.kind === "FLT" && !result.released && result.listening !== null && result.reading !== null && result.writing !== null && result.reviewStatus === "Completed";
}
// SOW A28.1 defaults. Lower raw scores require an Admin-configured table;
// returning null avoids inventing bands absent from the supplied scope.
export const conversionTables = {
  Listening: [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4]],
  AcademicReading: [[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4]],
  GeneralReading: [[40,9],[39,8.5],[37,8],[36,7.5],[34,7],[32,6.5],[30,6],[27,5.5],[23,5],[19,4.5],[15,4],[12,3.5],[9,3]],
} as const;
export function rawToBand(raw: number, skill: "Listening" | "Reading", course: Course): number | null {
  if (!Number.isInteger(raw) || raw < 0 || raw > 40) throw new RangeError("Raw score must be 0 to 40");
  const table = skill === "Listening" ? conversionTables.Listening : course === "GENERAL" ? conversionTables.GeneralReading : conversionTables.AcademicReading;
  return table.find(([minimum]) => raw >= minimum)?.[1] ?? null;
}
