import { students } from "../mocks/students";
import { mockTests } from "../mocks/mockTests";
import { questions } from "../mocks/questions";
import { results } from "../mocks/results";
import { progress } from "../mocks/practice";
import { leaderboard } from "../mocks/leaderboard";
import type {
  LeaderboardService,
  MockTestService,
  PracticeService,
  QuestionService,
  ResultService,
  StudentService,
} from "./contracts";
const copy = <T>(value: T): Promise<T> =>
  Promise.resolve(structuredClone(value));
export const studentService: StudentService = { list: () => copy(students) };
export const mockTestService: MockTestService = { list: () => copy(mockTests) };
export const questionService: QuestionService = { list: () => copy(questions) };
export const resultService: ResultService = { list: () => copy(results) };
export const practiceService: PracticeService = {
  progress: () => copy(progress),
  questions: (skill, course) =>
    copy(
      questions.filter(
        (q) =>
          skill !== "Speaking" && q.published && q.skill === skill && (q.course === course || q.course === "BOTH"),
      ),
    ),
};
export const leaderboardService: LeaderboardService = {
  list: (course, period) =>
    copy(
      leaderboard[course].map((entry, i) => ({
        ...entry,
        completed:
          period === "Weekly"
            ? Math.max(1, 4 - i)
            : period === "Monthly"
              ? Math.max(2, entry.completed - 2)
              : entry.completed,
      })),
    ),
};
