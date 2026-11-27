import { describe, expect, it } from "vitest";
import type { Question } from "../types/domain";
import { GAP, group, parse, partOf, range } from "./questionLayout";

const q = (id: string, prompt: string, overrides: Partial<Question> = {}): Question => ({
  id,
  skill: "Reading",
  course: "BOTH",
  title: "",
  prompt,
  options: [],
  answer: "",
  published: true,
  section: "Passage 1",
  ...overrides,
});

describe("parse", () => {
  it("splits shared instructions from the numbered stem", () => {
    const [item] = parse([q("a", "Choose ONE WORD ONLY.\n\n14. The reef is ______ old.")]);
    expect(item).toMatchObject({ number: 14, stem: "The reef is ______ old.", instructions: "Choose ONE WORD ONLY." });
  });
  it("falls back to the position when the prompt has no number", () => {
    const items = parse([q("a", "First"), q("b", "Second")]);
    expect(items.map(i => [i.number, i.stem, i.instructions])).toEqual([
      [1, "First", ""],
      [2, "Second", ""],
    ]);
  });
});

describe("group", () => {
  it("joins consecutive questions with the same part and instructions", () => {
    const groups = group(
      parse([
        q("a", "Do this.\n\n1. A"),
        q("b", "Do this.\n\n2. B"),
        q("c", "Do that.\n\n3. C"),
        q("d", "Do that.\n\n4. D", { section: "Passage 2" }),
      ]),
    );
    expect(groups.map(g => [g.part, g.items.length])).toEqual([
      ["Passage 1", 2],
      ["Passage 1", 1],
      ["Passage 2", 1],
    ]);
    expect(range(groups[0]!.items)).toBe("1–2");
    expect(range(groups[1]!.items)).toBe("3");
  });
  it("turns a shared option list into drag chips", () => {
    const options = ["i Origins", "ii Decline", "iii Revival"];
    const [g] = group(parse([q("a", "Match.\n\n1. A", { options }), q("b", "Match.\n\n2. B", { options })]));
    expect(g!.chips).toEqual(options);
  });
  it("keeps True/False/Not Given, short lists and single questions as choices", () => {
    const tfng = ["True", "False", "Not Given"];
    expect(
      group(parse([q("a", "X\n\n1. A", { options: tfng }), q("b", "X\n\n2. B", { options: tfng })]))[0]!.chips,
    ).toBe(undefined);
    const short = ["A", "B"];
    expect(
      group(parse([q("a", "X\n\n1. A", { options: short }), q("b", "X\n\n2. B", { options: short })]))[0]!.chips,
    ).toBe(undefined);
    expect(group(parse([q("a", "X\n\n1. A", { options: ["A", "B", "C"] })]))[0]!.chips).toBe(undefined);
  });
});

describe("gaps and parts", () => {
  it("detects inline answer gaps of three or more underscores", () => {
    expect(GAP.test("The reef is ___ old")).toBe(true);
    expect(GAP.test("snake_case")).toBe(false);
  });
  it("reads the part from the question section", () => {
    expect(partOf(parse([q("a", "A", { section: "Part 3" })])[0]!)).toBe("Part 3");
    expect(partOf(parse([q("a", "A", { section: undefined })])[0]!)).toBe("");
  });
});
