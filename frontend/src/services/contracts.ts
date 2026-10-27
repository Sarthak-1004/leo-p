import type {
  Course,
  LeaderboardEntry,
  MockTest,
  Progress,
  Question,
  Result,
  Skill,
  Student,
} from "../types/domain";
export interface StudentService {
  list(): Promise<Student[]>;
}
export interface MockTestService {
  list(): Promise<MockTest[]>;
}
export interface QuestionService {
  list(): Promise<Question[]>;
}
export interface ResultService {
  list(): Promise<Result[]>;
}
export interface PracticeService {
  progress(): Promise<Progress[]>;
  questions(skill: Skill, course: Course): Promise<Question[]>;
}
export interface LeaderboardService {
  list(course: Course, period: string): Promise<LeaderboardEntry[]>;
}
