import { describe, expect, it } from "vitest";
import type { BuilderDraft, MockTest, Question, Result, Student, TestAttempt } from "../types/domain";
import { courseName, dateLabel, wordCount } from "./format";
import { accessStatus, activeStudent, attemptCount } from "./policy";
import { buildBooks, buildSets, setName, tabOf } from "./practiceSets";
import { bySection, emptyBuilder, structure, testName } from "./mockBuilder";

describe("format", () => {
  it("names courses", () => {
    expect(courseName("GENERAL")).toBe("IELTS General");
    expect(courseName("ACADEMIC")).toBe("IELTS Academic");
  });
  it("formats plain dates without a timezone shift", () => {
    expect(dateLabel("2026-11-27")).toBe("27 Nov 2026");
  });
  it("counts words across any whitespace", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount(" Public  transport\nreduces\tcongestion. ")).toBe(4);
  });
});

const student = (overrides: Partial<Student> = {}): Student => ({
  id: "s1",
  name: "Student",
  course: "GENERAL",
  startDate: "2026-01-01",
  expiryDate: "2026-12-31",
  enabled: true,
  ...overrides,
});

describe("policy", () => {
  it("treats access as active only between the start and expiry dates", () => {
    expect(activeStudent(student(), "2026-06-01")).toBe(true);
    expect(activeStudent(student(), "2026-12-31")).toBe(true);
    expect(activeStudent(student(), "2027-01-01")).toBe(false);
    expect(activeStudent(student(), "2025-12-31")).toBe(false);
    expect(activeStudent(student({ enabled: false }), "2026-06-01")).toBe(false);
  });
  it("reports account status", () => {
    expect(accessStatus(student({ enabled: false }))).toBe("Disabled");
    expect(accessStatus(student({ startDate: "2000-01-01", expiryDate: "2000-01-02" }))).toBe("Expired");
    expect(accessStatus(student({ startDate: "2999-01-01", expiryDate: "2999-12-31" }))).toBe("Upcoming");
    expect(accessStatus(student({ startDate: "2000-01-01", expiryDate: "2999-12-31" }))).toBe("Active");
  });
  it("counts the highest attempt number across attempts and results for that test only", () => {
    const test = { id: "t1", course: "GENERAL" } as MockTest;
    const attempts = [
      { studentId: "s1", course: "GENERAL", testId: "t1", number: 1 },
      { studentId: "s1", course: "GENERAL", testId: "t2", number: 2 },
      { studentId: "s2", course: "GENERAL", testId: "t1", number: 2 },
    ] as TestAttempt[];
    const results = [{ studentId: "s1", course: "GENERAL", testId: "t1", attemptNumber: 2 }] as Result[];
    expect(attemptCount("s1", test, attempts, results)).toBe(2);
    expect(attemptCount("s1", test, [], [])).toBe(0);
  });
});

const question = (overrides: Partial<Question>): Question => ({
  id: "orig-v1-001",
  skill: "Reading",
  course: "BOTH",
  title: "Original practice: Coral reefs 1",
  prompt: "",
  options: [],
  answer: "",
  published: true,
  section: "Passage 1",
  questionType: "True/False/Not Given",
  difficulty: "Medium",
  ...overrides,
});

describe("practice sets", () => {
  it("strips the source prefix and trailing number from set names", () => {
    expect(setName(question({}))).toBe("Coral reefs");
    expect(setName(question({ title: "Original practice: 7" }))).toBe("Original practice: 7");
  });
  it("places Writing tasks in their own tabs", () => {
    expect(tabOf(question({ skill: "Writing", section: "Task 2" }))).toBe("Writing Task 2");
    expect(tabOf(question({ skill: "Writing", section: "Task 1" }))).toBe("Writing Task 1");
    expect(tabOf(question({ skill: "Listening" }))).toBe("Listening");
  });
  it("groups one passage by question type, or as a whole section", () => {
    const qs = [
      question({ id: "orig-v1-1" }),
      question({ id: "orig-v1-2", questionType: "Matching Headings", difficulty: "Hard" }),
      question({ id: "orig-v1-3", difficulty: "Hard" }),
    ];
    const byType = buildSets(qs, "type");
    expect(byType).toHaveLength(2);
    expect(byType[0]!.type).toBe("True/False/Not Given");
    expect(byType[0]!.questions).toHaveLength(2);
    const sectional = buildSets(qs, "section");
    expect(sectional).toHaveLength(1);
    expect(sectional[0]!.type).toBe("2 question types");
    expect(sectional[0]!.difficulty).toBe("Hard");
  });
  it("keeps each Writing task as its own set", () => {
    const sets = buildSets(
      [question({ id: "w-1", skill: "Writing" }), question({ id: "w-2", skill: "Writing" })],
      "section",
    );
    expect(sets).toHaveLength(2);
  });
  it("builds books whose tests take the k-th set of every section in order", () => {
    const sets = buildSets(
      [
        question({ id: "orig-v1-a", section: "Passage 2", title: "B 1" }),
        question({ id: "orig-v1-b", section: "Passage 1", title: "A 1" }),
        question({ id: "orig-v1-c", section: "Passage 1", title: "C 1" }),
        question({ id: "orig-v2-a", section: "Passage 1", title: "D 1" }),
      ],
      "section",
    );
    const books = buildBooks(sets);
    expect(books.map(b => b.key)).toEqual(["orig-v1", "orig-v2"]);
    expect(books[0]!.tests).toHaveLength(2);
    expect(books[0]!.tests[0]!.parts.map(p => p.section)).toEqual(["Passage 1", "Passage 2"]);
    expect(books[0]!.tests[1]!.parts.map(p => p.title)).toEqual(["C"]);
  });
});

describe("mock builder helpers", () => {
  it("names tests with a padded number", () => {
    expect(testName({ kind: "FLT", number: 3 } as MockTest)).toBe("FLT 03");
    expect(testName({ kind: "PRACTICE_MOCK", number: 12 } as MockTest)).toBe("Practice Mock 12");
  });
  it("sorts sections numerically", () => {
    expect(["Part 10", "Part 2", "", "Part 1"].sort(bySection)).toEqual(["", "Part 1", "Part 2", "Part 10"]);
    expect(bySection(undefined, "Part 1")).toBeLessThan(0);
  });
  it("detects structural changes but ignores unrelated fields", () => {
    const a: BuilderDraft = emptyBuilder();
    const b: BuilderDraft = { ...emptyBuilder(), questionIds: { ...emptyBuilder().questionIds, Reading: ["q1"] } };
    expect(structure(a)).toBe(structure(emptyBuilder()));
    expect(structure(a)).not.toBe(structure(b));
    expect(structure(a)).not.toBe(structure({ ...a, duration: { ...a.duration, Listening: 40 } }));
  });
});
