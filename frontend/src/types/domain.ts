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
  aiFeedback?: {output:{tasks:{task:string;criteria:Record<string,number>;feedback:string;strengths:string[];weaknesses:string[];improvements?:string[];corrections:{original:string;suggestion:string;reason:string}[]}[]};model:string;rubricVersion:string}[];
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
  fontSize: "standard" | "large" | "extra-large";
  interruptions: number;
  submittedSections?: string[];
  flagged?: boolean;
  questions?: Question[];
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
export interface PlatformSettings { institutionName: string; interruptionLimit: number; leaderboard: boolean; supportEmail?:string; supportPhone?:string; supportAddress?:string; defaultAccessDays?:number; mediaLimitMb?:number; autoWritingEvaluation?:boolean; expiryReminders?:boolean; backlogNotifications?:boolean; }

export interface PracticeRecord { id: string; studentId: string; course: Course; skill: Skill; date: string; correct: number | null; total: number | null; answers: Answers; }
