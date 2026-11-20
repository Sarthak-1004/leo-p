import type { StudentInsights } from "../types/domain";
// Sample analytics for the isolated demo preview only.
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
export const sampleInsights: StudentInsights = {
  goals: { examDate: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10), targetBand: 7.5 },
  activity: { activeDays: 18, streak: 4, testsGiven: 6, today: ["Reading"] },
  estimatedBand: 6.5,
  tests: { flt: { done: 3, available: 48 }, practiceMock: { done: 3, available: 5 } },
  skills: { listening: { band: 6.5, count: 6 }, reading: { band: 6.17, count: 6 }, writing: { band: 6, count: 6 }, speaking: 6.5 },
  writingTasks: {
    "Task 1": { scripts: 9, band: 6, criteria: { taskAchievement: 6.4, coherence: 6.1, lexical: 5.8, grammar: 5.6 } },
    "Task 2": { scripts: 8, band: 6, criteria: { taskAchievement: 6.2, coherence: 6.3, lexical: 6, grammar: 5.5 } },
  },
  cohort: { students: 42, listening: 6.1, reading: 5.9, writing: 5.8 },
  questionTypes: [
    { module: "Listening", questionType: "Form completion", correct: 41, total: 50, accuracy: 82, cohortAccuracy: 74 },
    { module: "Listening", questionType: "Multiple choice", correct: 22, total: 36, accuracy: 61, cohortAccuracy: 65 },
    { module: "Listening", questionType: "Map labelling", correct: 9, total: 18, accuracy: 50, cohortAccuracy: 58 },
    { module: "Listening", questionType: "Matching", correct: 14, total: 20, accuracy: 70, cohortAccuracy: 63 },
    { module: "Listening", questionType: "Sentence completion", correct: 16, total: 20, accuracy: 80, cohortAccuracy: 71 },
    { module: "Reading", questionType: "True/False/Not Given", correct: 25, total: 40, accuracy: 63, cohortAccuracy: 60 },
    { module: "Reading", questionType: "Matching headings", correct: 12, total: 24, accuracy: 50, cohortAccuracy: 55 },
    { module: "Reading", questionType: "Summary completion", correct: 20, total: 26, accuracy: 77, cohortAccuracy: 68 },
    { module: "Reading", questionType: "Multiple choice", correct: 15, total: 22, accuracy: 68, cohortAccuracy: 66 },
    { module: "Reading", questionType: "Sentence completion", correct: 13, total: 16, accuracy: 81, cohortAccuracy: 72 },
  ],
  progress: [
    { date: day(150), kind: "PRACTICE_MOCK", name: "Practice Mock 1", listening: 5.5, reading: 5, writing: 5.5, speaking: null, overall: 5.5 },
    { date: day(110), kind: "FLT", name: "Full Length Test 01", listening: 6, reading: 5.5, writing: 5.5, speaking: 6, overall: 6 },
    { date: day(70), kind: "PRACTICE_MOCK", name: "Practice Mock 2", listening: 6, reading: 6, writing: 6, speaking: null, overall: 6 },
    { date: day(40), kind: "FLT", name: "Full Length Test 02", listening: 6.5, reading: 6, writing: 6, speaking: 6.5, overall: 6.5 },
    { date: day(18), kind: "PRACTICE_MOCK", name: "Practice Mock 3", listening: 7, reading: 6.5, writing: 6, speaking: null, overall: 6.5 },
    { date: day(5), kind: "FLT", name: "Full Length Test 03", listening: 7, reading: 6.5, writing: 6.5, speaking: 6.5, overall: 6.5 },
  ],
};
