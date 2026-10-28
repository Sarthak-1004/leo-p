import { createContext } from "react";
import type { AuditEvent, Course, MockTest, Notification, PlatformSettings, PracticeRecord, Progress, Question, Result, Student, TestAttempt, Trainer, Role } from "../types/domain";
type Awaitable<T> = T | Promise<T>;
export interface SessionUser { id:string;name:string;role:Role;email?:string;course?:Course;accessActive:boolean;startDate?:string;expiryDate?:string; }
export interface PreviewState {
  statistics?:{students:number;activeStudents:number;generalStudents:number;academicStudents:number;trainers:number;results:number;pending:number;ready:number;unlocked:number};
  hasMore?:boolean;nextOffset?:number;
  students:Student[];trainers:Trainer[];tests:MockTest[];questions:Question[];results:Result[];progress:Progress[];
  attempts:TestAttempt[];practiceRecords:PracticeRecord[];notifications:Notification[];auditEvents:AuditEvent[];settings:PlatformSettings;
}
export interface PreviewValue extends PreviewState {
  mode:"demo"|"live";currentUser?:SessionUser;authStatus:"loading"|"anonymous"|"authenticated";
  loadMore?:()=>Promise<void>;
  pending:boolean;error:string;clearError:()=>void;
  login:(role:Role,id:string,password:string)=>Promise<void>;logout:()=>Promise<void>;refresh:()=>Promise<void>;
  course:Course;setCourse:(course:Course)=>void;trainerId:string;setTrainerId:(id:string)=>void;
  status:"loading"|"ready"|"error";retry:()=>void;
  updateStudent:(student:Student)=>Awaitable<void|boolean>;updateTrainer:(trainer:Trainer)=>Awaitable<void|boolean>;
  updateQuestion:(question:Question)=>Awaitable<void|boolean|Question>;updateTest:(test:MockTest)=>Awaitable<void|boolean>;
  updateResult:(result:Result)=>Awaitable<void|boolean>;reviseResult:(result:Result,actor:string,remarks:string)=>Awaitable<boolean>;
  releaseResults:(ids:string[])=>Awaitable<number>;markNotificationRead:(id:string)=>Awaitable<void|boolean>;
  addAudit:(action:string,target:string,detail:string)=>void;updateSettings:(settings:PlatformSettings)=>Awaitable<void|boolean>;
  startAttempt:(test:MockTest)=>Awaitable<TestAttempt|null>;updateAttempt:(attempt:TestAttempt)=>void;
  addPracticeRecord:(record:PracticeRecord)=>void;
}
export const PortalContext=createContext<PreviewValue|null>(null);
