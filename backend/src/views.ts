import {platformSettings} from "./settings.js";
import type { Db } from "./db.js";
import { academicSelect, type Identity } from "./auth.js";
import { defaultSettings, overall, today } from "./domain.js";
import type { Config } from "./config.js";
import type { Attempt, Question, Result, ScoreRevision } from "./generated/prisma/client.js";

export function publicQuestion(q: Question | Record<string, any>, includeKey = false) {
  const { id, skill, course, questionType, section, difficulty, title, prompt, passage, options, explanation, assetIds, published, archived, version, practiceEligible } = q;
  return { id, skill, course, questionType, section, difficulty, title, prompt, passage, options, assetIds, published, archived, version, practiceEligible, ...(includeKey ? { answer:q.answer, explanation } : {}) };
}
export function attemptView(a: Attempt, includeContent = false) {
  const snapshot = a.snapshot as any;
  return { submittedSections:a.submittedSections, id:a.id, testId:a.testId, studentId:a.studentId, course:a.course, kind:a.kind, number:a.number, state:a.state === "IN_PROGRESS" ? "In progress" : "Submitted", remainingSeconds:Math.ceil(a.remainingMs/1000), remainingBySection:a.remainingBySection, sectionRemainingSeconds:Math.ceil(((a.remainingBySection as any)[["Listening","Reading","Writing"][a.section]!]??a.remainingMs)/1000), section:a.section, question:a.question, answers:a.answers, theme:a.theme, fontSize:a.fontSize, interruptions:a.interruptions, flagged:a.flagged, sequence:a.sequence, sessionKey:a.sessionKey,
    ...(includeContent ? { questions:(snapshot.questions ?? []).map((q:any) => publicQuestion(q)), name:snapshot.title, practiceSkill:snapshot.skill, timed:!snapshot.untimed } : {}) };
}
export function resultView(result: Result & { revisions?: ScoreRevision[]; jobs?: any[] }, user: Identity) {
  const internal = user.role !== "STUDENT";
  const visible = internal || (result.kind === "FLT" ? result.released : result.kind === "PRACTICE" || (result.listening !== null && result.reading !== null && result.writing !== null));
  const base = { modules:(result.originalScores as any)?.modules??(result.kind==="PRACTICE"?[result.name.split(" ")[0]]:["Listening","Reading","Writing"]), id:result.id, studentId:result.studentId, course:result.course, testId:result.testId, kind:result.kind, name:result.name, attemptNumber:result.attemptNumber, date:result.date.toISOString(), minutes:result.minutes, released:result.released, reviewStatus:result.reviewStatus, aiStatus:result.aiStatus, visible };
  if (!visible) return { ...base, listening:null, reading:null, writing:null, speaking:null, overall:null };
  return { ...base, listening:result.listening, reading:result.reading, writing:result.writing, speaking:result.speaking, overall:overall(result), remarks:result.remarks, speakingCriteria:result.speakingCriteria, speakingDate:result.speakingDate, rawScores:result.rawScores,
    aiFeedback:result.jobs?.filter(j => j.state === "COMPLETED").map(j => ({ output:j.output, model:j.model, rubricVersion:j.rubricVersion })),
    ...(internal ? { assignedTrainerId:result.assignedTrainerId,evaluatedBy:result.evaluatedBy, reviewerId:result.reviewerId, reviewerUntil:result.reviewerUntil, version:result.version, evaluationDraft:result.evaluationDraft, originalScores:result.originalScores, revisions:result.revisions?.map(r => ({ id:r.id, section:r.section, previous:r.previous, value:r.value, actor:r.actorName, actorId:r.actorId, role:r.role, remarks:r.remarks, details:r.details, at:r.at.toISOString() })) } : {}) };
}
export const userView = (u: Identity, config: Config) => ({ id:u.id, name:u.name, role:u.role.toLowerCase(), email:u.role === "STUDENT" ? undefined : u.email, enabled:u.enabled, course:u.student?.course, accessActive:u.role !== "STUDENT" || (u.enabled && !!u.student && u.student.startDate <= today(config.ACCESS_TIMEZONE) && u.student.expiryDate >= today(config.ACCESS_TIMEZONE)), startDate:u.student?.startDate, expiryDate:u.student?.expiryDate });
export async function bootstrap(db: Db, user: Identity, offset=0, limit=500) {
  const isStudent = user.role === "STUDENT";
  const [students, trainers, tests, questions, results, attempts, notifications, auditEvents, setting] = await Promise.all([
    db.student.findMany({ where:isStudent ? {id:user.id} : {}, select: user.role === "ADMIN" ? {...academicSelect,contacts:true} : academicSelect, orderBy:{id:"asc"}, skip:offset,take:limit+1 }),
    isStudent ? Promise.resolve([]) : db.user.findMany({ where:{role:"TRAINER"}, select:{id:true,name:true,email:true,enabled:true},orderBy:{name:"asc"},skip:offset,take:limit+1 }),
    db.test.findMany({ where:isStudent ? {course:user.student!.course} : {},orderBy:[{course:"asc"},{number:"asc"}] }),
    user.role==="TRAINER"?Promise.resolve([]):db.question.findMany({ where:isStudent ? {course:{in:[user.student!.course,"BOTH"]},skill:{not:"Speaking"},published:true,archived:false,practiceEligible:true} : {},orderBy:{id:"asc"},skip:offset,take:limit+1 }),
    db.result.findMany({ where:isStudent ? {studentId:user.id,course:user.student!.course} : {},include:{ revisions:!isStudent, jobs:{where:{state:"COMPLETED"},select:{state:true,output:true,model:true,rubricVersion:true}} },orderBy:{date:"desc"},skip:offset,take:limit+1 }),
    isStudent ? db.attempt.findMany({where:{studentId:user.id,course:user.student!.course},orderBy:{createdAt:"desc"},skip:offset,take:limit+1}) : Promise.resolve([]),
    db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},skip:offset,take:limit+1}),
    user.role === "ADMIN" ? db.auditLog.findMany({orderBy:{at:"desc"},skip:offset,take:limit+1}) : Promise.resolve([]),
    db.platformSetting.findUnique({where:{id:"platform"}}),
  ]);
  const testCounts=await db.attempt.groupBy({by:["course","testId","state"],where:{kind:{not:"PRACTICE"},...(isStudent?{studentId:user.id,course:user.student!.course}:{})},_count:true});
  const latestPractice=new Map<string,number>();for(const r of results)if(r.kind==="PRACTICE_MOCK")latestPractice.set(`${r.studentId}/${r.course}/${r.testId}`,Math.max(latestPractice.get(`${r.studentId}/${r.course}/${r.testId}`)??0,r.attemptNumber));
  const ownResults = results.filter(r => (!isStudent || resultView(r,user).visible)&&(r.kind!=="PRACTICE_MOCK"||r.attemptNumber===latestPractice.get(`${r.studentId}/${r.course}/${r.testId}`)));
  const progress = ["Listening","Reading","Writing","Speaking"].map(skill => {
    const key = skill.toLowerCase() as "listening"|"reading"|"writing"|"speaking";
    const scored = ownResults.filter(r => r[key] !== null);
    return {skill,percent:0,completed:scored.length,total:0,band:scored[0]?.[key] ?? null,description:skill === "Speaking" ? "Offline trainer assessment" : "Based on completed assessments"};
  });
  const statistics=user.role==="ADMIN"?await (async()=>{
    const day=today("Asia/Kolkata");
    const [students,activeStudents,generalStudents,academicStudents,trainers,results,pending,ready,unlocked]=await Promise.all([
      db.student.count(),db.student.count({where:{user:{enabled:true},startDate:{lte:day},expiryDate:{gte:day}}}),
      db.student.count({where:{course:"GENERAL"}}),db.student.count({where:{course:"ACADEMIC"}}),db.user.count({where:{role:"TRAINER"}}),db.result.count(),
      db.result.count({where:{reviewStatus:{not:"Completed"}}}),db.result.count({where:{kind:"FLT",released:false,reviewStatus:"Completed",listening:{not:null},reading:{not:null},writing:{not:null}}}),db.test.count({where:{kind:"FLT",published:true,available:true}}),
    ]);return {students,activeStudents,generalStudents,academicStudents,trainers,results,pending,ready,unlocked};
  })():undefined;
  return {
    statistics,
    hasMore:[students,trainers,questions,results,attempts,notifications,auditEvents].some(rows=>rows.length>limit),nextOffset:offset+limit,
    students:students.slice(0,limit).map((s:any) => ({id:s.id,name:s.user.name,enabled:s.user.enabled,course:s.course,startDate:s.startDate,expiryDate:s.expiryDate,trainerId:s.trainerId ?? undefined,...(user.role === "ADMIN" ? {contacts:s.contacts} : {})})),
    trainers:trainers.slice(0,limit),tests:tests.map(t => ({attempts:testCounts.filter(a=>a.course===t.course&&a.testId===t.id).reduce((sum,a)=>sum+a._count,0),completed:testCounts.filter(a=>a.course===t.course&&a.testId===t.id&&a.state==="SUBMITTED").reduce((sum,a)=>sum+a._count,0),id:t.id,course:t.course,kind:t.kind,number:t.number,published:t.published,available:t.kind === "PRACTICE_MOCK" ? t.published : t.available,duration:t.duration,sectionDurations:(t.builder as any).duration,builder:user.role==="ADMIN" ? t.builder : undefined,conversions:user.role==="ADMIN" ? t.conversions : undefined,version:t.version})),
    questions:questions.slice(0,limit).map(q => publicQuestion(q,!isStudent)),results:results.slice(0,limit).map(r => resultView(r,user)),attempts:attempts.slice(0,limit).map(a=>attemptView(a)),progress,
    practiceRecords:[],notifications:notifications.slice(0,limit).map(n=>({id:n.id,role:user.role.toLowerCase(),recipientId:user.id,title:n.title,href:n.href,read:n.read,createdAt:n.createdAt.toISOString()})),
    auditEvents:auditEvents.slice(0,limit).map(a=>({id:a.id,actorId:a.actorId,action:a.action,target:a.target,detail:JSON.stringify(a.detail),at:a.at.toISOString()})),settings:await platformSettings(db),
  };
}
