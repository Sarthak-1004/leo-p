import { z } from "zod";
export const role = z.enum(["ADMIN", "TRAINER", "STUDENT"]);
export const course = z.enum(["GENERAL", "ACADEMIC"]);
export const skill = z.enum(["Listening", "Reading", "Writing", "Speaking"]);
export const onlineSkills = ["Listening", "Reading", "Writing"] as const;
export const band = z.number().min(0).max(9).multipleOf(0.5);
export const date = z.iso.date();
export const identifier = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
export const password = z.string().min(12).max(128);
export const criteria = z.object({ fluency: z.number().int().min(0).max(9), lexical: z.number().int().min(0).max(9), grammar: z.number().int().min(0).max(9), pronunciation: z.number().int().min(0).max(9) }).strict();
export const settingsSchema = z.object({
  institutionName: z.string().trim().min(1).max(120), interruptionLimit: z.number().int().min(0).max(100), leaderboard: z.boolean(),
  supportEmail:z.union([z.email(),z.literal("")]).default(""),supportPhone:z.string().trim().max(60).default(""),supportAddress:z.string().trim().max(500).default(""),
  defaultAccessDays:z.number().int().min(1).max(3650).default(180),mediaLimitMb:z.number().int().min(1).max(20).default(20),
  autoWritingEvaluation:z.boolean().default(true),expiryReminders:z.boolean().default(true),backlogNotifications:z.boolean().default(true),
}).strict();
export const defaultSettings = settingsSchema.parse({ institutionName: "Kanan IELTS Practice Portal", interruptionLimit: 3, leaderboard: false });
export const roundBand = (n: number) => Math.round((n + Number.EPSILON) * 2) / 2;
export function overall(scores: { listening: number | null; reading: number | null; writing: number | null; speaking: number | null }): number | null {
  if ([scores.listening, scores.reading, scores.writing].some(n => n === null)) return null;
  const values = [scores.listening!, scores.reading!, scores.writing!];
  if (scores.speaking !== null) values.push(scores.speaking);
  return roundBand(values.reduce((a, b) => a + b, 0) / values.length);
}
export const defaultConversions = {
  Listening: [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4]],
  AcademicReading: [[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4]],
  GeneralReading: [[40,9],[39,8.5],[37,8],[36,7.5],[34,7],[32,6.5],[30,6],[27,5.5],[23,5],[19,4.5],[15,4],[12,3.5],[9,3]],
};
export const conversionsSchema = z.record(z.string(), z.array(z.tuple([z.number().int().min(0).max(40), band])));
export type Conversions = z.infer<typeof conversionsSchema>;
export function validateConversions(value: unknown, complete = false): Conversions {
  const tables = conversionsSchema.parse(value);
  for (const name of Object.keys(defaultConversions)) {
    const rows = tables[name];
    if (!rows?.length || (complete && rows.at(-1)?.[0] !== 0)) throw new ApiError(400, "Supply a complete conversion table for each skill/course");
    rows.forEach(([minimum, value], i) => { if (i && (minimum >= rows[i-1]![0] || value > rows[i-1]![1])) throw new ApiError(400, "Conversion thresholds must be unique and descending"); });
  }
  return tables;
}
export function rawBand(raw: number, module: string, track: string, tables: Conversions, total: number): number | null {
  if (total !== 40) return null;
  const name = module === "Listening" ? "Listening" : track === "GENERAL" ? "GeneralReading" : "AcademicReading";
  return tables[name]?.find(([minimum]) => raw >= minimum)?.[1] ?? null;
}
export class ApiError extends Error { constructor(public statusCode: number, message: string,public code?:string) { super(message); } }
export function assert(condition: unknown, status: number, message: string): asserts condition { if (!condition) throw new ApiError(status, message); }
export const today = (timezone: string, now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const answerMap = z.record(z.string().max(120), z.string().max(50000)).refine(value => Object.keys(value).length <= 200, "Too many answers");
export const heartbeatSchema = z.object({ sessionKey: z.string().uuid(), sequence: z.number().int().min(1), answers: answerMap, section: z.number().int().min(0).max(2), question: z.number().int().min(0).max(100), theme: z.enum(["standard","dark","yellow"]), fontSize: z.enum(["standard","large","extra-large"]), resumed:z.boolean().default(false),completeSection:z.boolean().default(false) }).strict();
export type Heartbeat = z.infer<typeof heartbeatSchema>;
export const questionSchema = z.object({ id: identifier, skill, course: z.enum(["GENERAL","ACADEMIC","BOTH"]), questionType: z.string().trim().min(1).max(100), section: z.string().trim().min(1).max(100), difficulty: z.enum(["Easy","Medium","Hard"]), title: z.string().trim().min(1).max(200), prompt: z.string().trim().min(1).max(50000), passage: z.string().max(100000).default(""), options: z.array(z.string().max(1000)).max(40), answer: z.union([z.string().max(1000), z.array(z.string().max(1000)).max(20)]), explanation: z.string().max(5000).default(""), assetIds: z.array(z.string().uuid()).max(10).default([]), published: z.boolean(), archived: z.boolean().default(false), practiceEligible: z.boolean().default(true), version: z.number().int().optional() }).strict();
