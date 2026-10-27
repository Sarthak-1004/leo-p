import type { Course, MockTest } from "../types/domain";
export const mockTests: MockTest[] = (
  ["GENERAL", "ACADEMIC"] as Course[]
).flatMap((course) =>
  Array.from({ length: 40 }, (_, i) => ({
    kind: "FLT" as const,
    id: `mock-${String(i + 1).padStart(2, "0")}`,
    course,
    number: i + 1,
    published: i < 32,
    available: course === "GENERAL" ? i < 6 : i > 0 && i < 8,
    duration: 150,
  })),
);

// Illustrative sample only; production Practice Mock count awaits client confirmation.
mockTests.push(...(["GENERAL", "ACADEMIC"] as Course[]).map(course => ({
  id: "practice-mock-01", course, kind: "PRACTICE_MOCK" as const, number: 1, published: true, available: true, duration: 150,
})));
