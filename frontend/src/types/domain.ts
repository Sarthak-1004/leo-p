export type Course = "GENERAL" | "ACADEMIC";
export type Skill = "Listening" | "Reading" | "Writing" | "Speaking";
export type TestKind = "FLT" | "PRACTICE_MOCK";
export type Role = "student" | "trainer" | "admin";
export interface Trainer { id: string; name: string; email: string; enabled: boolean; password?: string; }
export interface Student {
  id: string;
  name: string;
  course: Course;
  startDate: string;
  expiryDate: string;
  enabled: boolean;
  trainerId?: string;
  password?: string;
  movePending?:boolean;
  contacts?: {phone:string;email:string;address:string;guardianContact:string};
}
export interface MockTest {
  attempts?:number;completed?:number;sectionDurations?:Record<string,number>;
  version?: number;
  conversions?: Record<string, [number,number][]>;
  builder?: BuilderDraft;
  kind: TestKind;
  id: string;
  course: Course;
  number: number;
  published: boolean;
  available: boolean;
  duration: number;
}
export interface Question {
  version?: number;
  passage?: string;
  passageRef?: number;
  assetIds?: string[];
  practiceEligible?: boolean;
  archived?: boolean;
  explanation?: string;
  questionType?: string;
  section?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  id: string;
  skill: Skill;
  course: Course | "BOTH";
  title: string;
  prompt: string;
  options: string[];
  answer: string | string[];
  published: boolean;
}
export interface EvaluationDraft { listening: number | null; reading: number | null; writing: number | null; speaking: number | null; speakingCriteria?: SpeakingCriteria; speakingDate?: string; remarks: string; actor: string; }
export interface Result {
  modules?:string[];
  originalScores?:{listening?:number|null;reading?:number|null;aiWriting?:number};
  version?: number;
  visible?: boolean;
  rawScores?: Record<string, {correct:number;total:number}>;
  aiFeedback?: WritingAiFeedback[];
  reviewerId?: string;
  reviewerUntil?: string;
  evaluationDraft?: EvaluationDraft;
  kind: TestKind | "PRACTICE";
  released: boolean;
  reviewStatus: "Pending" | "In review" | "Completed";
  aiStatus: "Pending" | "Completed" | "Failed" | "Manual review";
  attemptNumber: number;
  remarks?: string;
  speakingCriteria?: SpeakingCriteria;
  speakingDate?: string;
  revisions?: ScoreRevision[];
  assignedTrainerId?:string|null;
  evaluatedBy?: string;
  id: string;
  studentId: string;
  course: Course;
  testId: string;
  name: string;
  date: string;
  minutes: number;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
}
export interface LeaderboardEntry {
  name: string;
  band: number;
  completed: number;
}
export interface Progress {
  skill: Skill;
  percent: number;
  completed: number;
  total: number;
  band: number | null;
  description: string;
}
export interface BuilderDraft {
  questionIds: Record<Skill, string[]>;
  duration: Record<Skill, number>;
}
export type Answers = Record<string, string>;
export interface SpeakingCriteria { fluency: number; lexical: number; grammar: number; pronunciation: number; }
export interface ScoreRevision { id: string; section: Skill; previous: number | null; value: number | null; actor: string; role?:string; actorId?:string; remarks: string; at: string; }
export interface TestAttempt {
  id: string; testId: string; studentId: string; course: Course; kind: TestKind | "PRACTICE";
  number: number; state: "In progress" | "Submitted"; remainingSeconds: number;
  section: number; question: number; answers: Answers;
  theme: "standard" | "dark" | "yellow";
  audioPart?: number;
  audioMs?: number;
  fontSize: "standard" | "large" | "extra-large";
  interruptions: number;
  submittedSections?: string[];
  flagged?: boolean;
  questions?: Question[];
  passages?: Record<string, string>;
  sequence?: number;
  sessionKey?: string;
  name?: string;
  practiceSkill?: Skill;
  remainingBySection?: Record<string,number>;
  sectionRemainingSeconds?: number;
  timed?: boolean;
}
export interface Notification { id: string; role: Role; recipientId?: string; title: string; href: string; read: boolean; createdAt: string; }
export interface AuditEvent { actorId?:string; id: string; action: string; target: string; detail: string; at: string; }
export interface PlatformSettings { institutionName: string; interruptionLimit: number; leaderboard: boolean; supportEmail?:string; supportPhone?:string; supportAddress?:string; defaultAccessDays?:number; mediaLimitMb?:number; autoWritingEvaluation?:boolean; expiryReminders?:boolean; backlogNotifications?:boolean; attemptWindowHours?:number; dailyPracticeAiLimit?:number; dailyAiBudget?:number; dailyPracticeLimit?:number; }

export interface PracticeRecord { id: string; studentId: string; course: Course; skill: Skill; date: string; correct: number | null; total: number | null; answers: Answers; }

export type WritingAiTask = {
  task: string;
  criteria: Record<string, number | { band: number; remarks: string }>;
  feedback: string; strengths: string[]; weaknesses: string[]; improvements?: string[];
  corrections: { original: string; suggestion: string; reason: string; type?: string }[];
  improvedParagraph?: string;
};
export type WritingAiFeedback = { output: { tasks: WritingAiTask[]; summary?: string; priorities?: string[] }; model: string; rubricVersion: string };

// Student dashboard analytics from /api/student/insights (visible results only).
export type SkillSummary = { band: number | null; count: number };
export type StudentInsights = {
  goals: { examDate: string | null; targetBand: number | null };
  activity: { activeDays: number; streak: number; testsGiven: number; today: string[] };
  estimatedBand: number | null;
  tests: { flt: { done: number; available: number }; practiceMock: { done: number; available: number } };
  skills: { listening: SkillSummary; reading: SkillSummary; writing: SkillSummary; speaking: number | null };
  writingTasks: Record<string, { scripts: number; band: number | null; criteria: Record<string, number | null> }>;
  cohort: { students: number; listening: number | null; reading: number | null; writing: number | null };
  questionTypes: { module: string; questionType: string; correct: number; total: number; accuracy: number; cohortAccuracy: number | null }[];
  progress: { date: string; kind: string; name: string; listening: number | null; reading: number | null; writing: number | null; speaking: number | null; overall: number | null }[];
};

// Issue reports (student-raised, Admin-reviewed).
export const ISSUE_TYPES = ["Wrong answer key", "Question or passage error", "Audio problem", "Image or chart problem", "Marking or score problem", "Technical problem", "Other"] as const;
export const ISSUE_MODULES = ["Listening", "Reading", "Writing", "Speaking", "General"] as const;
export const ISSUE_STATUSES = ["Open", "In review", "Resolved", "Rejected", "Withdrawn"] as const;
export type IssueReport = {
  id: string; studentId: string; studentName?: string; course: Course; resultId: string | null; testName: string;
  module: typeof ISSUE_MODULES[number]; type: typeof ISSUE_TYPES[number]; questions: string[]; description: string;
  status: typeof ISSUE_STATUSES[number]; adminNote: string; createdAt: string; updatedAt: string; version: number;
};
export type IssuePage = { count: number; page: number; open: number; rows: IssueReport[] };

// General student requests (portal problems, ideas, features), answered by Admin.
export const REQUEST_TYPES = ["Portal problem", "Improvement idea", "New feature", "Account or access", "Other"] as const;
export const REQUEST_STATUSES = ["Open", "In review", "Planned", "Done", "Declined", "Withdrawn"] as const;
export type SupportRequest = {
  id: string; studentId: string; studentName?: string; course: Course; type: typeof REQUEST_TYPES[number]; subject: string; description: string;
  status: typeof REQUEST_STATUSES[number]; adminNote: string; createdAt: string; updatedAt: string; version: number;
};
export type RequestPage = { count: number; page: number; open: number; rows: SupportRequest[] };
