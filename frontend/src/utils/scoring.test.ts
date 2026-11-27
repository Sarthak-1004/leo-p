import { describe, expect, it } from "vitest";
import type { Result } from "../types/domain";
import {
  canRelease,
  isResultVisible,
  overallBand,
  overallLabel,
  rawToBand,
  roundBand,
  speakingBand,
  writingBand,
} from "./scoring";

const result = (overrides: Partial<Result>) =>
  ({
    kind: "FLT",
    released: false,
    listening: 7,
    reading: 7,
    writing: 6,
    speaking: null,
    reviewStatus: "Completed",
    aiStatus: "Completed",
    ...overrides,
  }) as Result;

describe("roundBand", () => {
  it("rounds to the nearest half band, with quarters going up", () => {
    expect(roundBand(6.25)).toBe(6.5);
    expect(roundBand(6.75)).toBe(7);
    expect(roundBand(6.125)).toBe(6);
    expect(roundBand(0)).toBe(0);
    expect(roundBand(9)).toBe(9);
  });
  it("rejects values outside 0-9", () => {
    expect(() => roundBand(-0.5)).toThrow(RangeError);
    expect(() => roundBand(9.5)).toThrow(RangeError);
    expect(() => roundBand(Number.NaN)).toThrow(RangeError);
  });
});

describe("overallBand", () => {
  it("averages the three written skills when Speaking is pending", () => {
    expect(overallBand({ listening: 7, reading: 7, writing: 6, speaking: null })).toBe(6.5);
  });
  it("includes Speaking once it is entered", () => {
    expect(overallBand({ listening: 7, reading: 7, writing: 6, speaking: 8 })).toBe(7);
  });
  it("never treats a missing Listening, Reading or Writing band as zero", () => {
    expect(overallBand({ listening: null, reading: 7, writing: 6, speaking: 8 })).toBeNull();
    expect(overallBand({ listening: 7, reading: 7, writing: null, speaking: null })).toBeNull();
  });
});

describe("speakingBand and writingBand", () => {
  it("averages four whole Speaking criteria to a half band", () => {
    expect(speakingBand({ fluency: 6, lexical: 7, grammar: 6, pronunciation: 7 })).toBe(6.5);
  });
  it("rejects half-band or out-of-range Speaking criteria", () => {
    expect(() => speakingBand({ fluency: 6.5, lexical: 7, grammar: 6, pronunciation: 7 })).toThrow(RangeError);
    expect(() => speakingBand({ fluency: 10, lexical: 7, grammar: 6, pronunciation: 7 })).toThrow(RangeError);
  });
  it("weights Writing Task 2 twice as much as Task 1", () => {
    expect(writingBand(5, 7)).toBe(6.5);
    expect(writingBand(6, 6)).toBe(6);
    expect(() => writingBand(6, 10)).toThrow(RangeError);
  });
});

describe("rawToBand", () => {
  it("follows the official Listening rows", () => {
    expect(rawToBand(40, "Listening", "ACADEMIC")).toBe(9);
    expect(rawToBand(30, "Listening", "GENERAL")).toBe(7);
    expect(rawToBand(23, "Listening", "GENERAL")).toBe(6);
    expect(rawToBand(10, "Listening", "GENERAL")).toBe(4);
  });
  it("uses the client-approved low-score extension", () => {
    expect(rawToBand(9, "Listening", "GENERAL")).toBe(3.5);
    expect(rawToBand(6, "Listening", "GENERAL")).toBe(3);
    expect(rawToBand(3, "Listening", "GENERAL")).toBe(2);
    expect(rawToBand(1, "Listening", "GENERAL")).toBe(1);
    expect(rawToBand(0, "Listening", "GENERAL")).toBe(0);
  });
  it("uses separate Academic and General Reading tables", () => {
    expect(rawToBand(30, "Reading", "ACADEMIC")).toBe(7);
    expect(rawToBand(30, "Reading", "GENERAL")).toBe(6);
    expect(rawToBand(40, "Reading", "GENERAL")).toBe(9);
    expect(rawToBand(39, "Reading", "GENERAL")).toBe(8.5);
  });
  it("rejects raw scores outside 0-40 or fractional", () => {
    expect(() => rawToBand(41, "Listening", "GENERAL")).toThrow(RangeError);
    expect(() => rawToBand(-1, "Reading", "ACADEMIC")).toThrow(RangeError);
    expect(() => rawToBand(20.5, "Reading", "ACADEMIC")).toThrow(RangeError);
  });
});

describe("result visibility and release", () => {
  it("labels FLTs with pending Speaking as three-skill results", () => {
    expect(overallLabel({ kind: "FLT", speaking: null })).toBe("Overall (3 skills) — Speaking pending");
    expect(overallLabel({ kind: "FLT", speaking: 7 })).toBe("Overall (4 skills)");
    expect(overallLabel({ kind: "PRACTICE", speaking: null })).toBe("Module score");
  });
  it("hides FLT results until Admin release", () => {
    expect(isResultVisible(result({ released: false }))).toBe(false);
    expect(isResultVisible(result({ released: true }))).toBe(true);
  });
  it("trusts the server's visibility flag when present", () => {
    expect(isResultVisible(result({ released: true, visible: false }))).toBe(false);
  });
  it("shows practice results once Writing is marked", () => {
    expect(isResultVisible(result({ kind: "PRACTICE_MOCK", writing: 6 }))).toBe(true);
    expect(isResultVisible(result({ kind: "PRACTICE_MOCK", writing: null }))).toBe(false);
  });
  it("allows release only for complete, unreleased FLTs", () => {
    expect(canRelease(result({}))).toBe(true);
    expect(canRelease(result({ released: true }))).toBe(false);
    expect(canRelease(result({ writing: null }))).toBe(false);
    expect(canRelease(result({ reviewStatus: "Pending" }))).toBe(false);
    expect(canRelease(result({ kind: "PRACTICE_MOCK" }))).toBe(false);
  });
});
