import {platformSettings} from "./settings.js";
import { randomUUID } from "node:crypto";
import type { Db, Tx } from "./db.js";
import { json, transaction } from "./db.js";
import { assert, defaultSettings, overall, rawBand, type Heartbeat, type Conversions } from "./domain.js";
import { audit, notify, studentOnly, digest, type Identity } from "./auth.js";
import { attemptView, publicQuestion } from "./views.js";
import type { Attempt } from "./generated/prisma/client.js";
export const SIGNAL_GAP_MS = 7500;
export type Snapshot = { title:string; questions:any[]; builder:any; conversions:Conversions; version:number; skill?:string; untimed?:boolean };
export async function owned(tx: Tx | Db, user: Identity, id: string) {
  const a = await tx.attempt.findUnique({where:{id}});
  assert(a && (user.role !== "STUDENT" || (a.studentId === user.id && a.course === user.student?.course)),404,"Attempt not found");
  return a;
}
function visibleSnapshot(snapshot: Snapshot) { return {...snapshot,questions:snapshot.questions.map(q=>publicQuestion(q)),conversions:undefined}; }
export async function startTest(db: Db, user: Identity, course: "GENERAL"|"ACADEMIC", testId: string) {
  studentOnly(user);
  assert(user.student.course === course,403,"This course is not assigned to your account");
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${user.id} FOR UPDATE`;
    const test = await tx.test.findUnique({where:{course_id:{course,id:testId}}});
    const existing = await tx.attempt.findFirst({where:{studentId:user.id,course,testId,state:"IN_PROGRESS"}});
    if(existing) return attemptView(existing,true);
    assert(test && test.published && (test.kind !== "FLT" || test.available),403,"This test is unavailable");
    const used = await tx.attempt.count({where:{studentId:user.id,course,testId}});
    assert(used < (test.kind === "FLT" ? 1 : 2),409,"All attempts for this test have been used");
    const builder = test.builder as any;
    const ids = ["Listening","Reading","Writing"].flatMap(s=>builder.questionIds?.[s]??[]);
    const questions = await tx.question.findMany({where:{id:{in:ids},published:true,archived:false,course:{in:[course,"BOTH"]},skill:{not:"Speaking"}}});
    assert(questions.length === ids.length && ids.length > 0,409,"Test content is not ready");
    const snapshot:Snapshot = {title:test.title,questions:ids.map((id:string)=>questions.find(q=>q.id===id)),builder,conversions:test.conversions as Conversions,version:test.version};
    const a=await tx.attempt.create({data:{studentId:user.id,course,testId,kind:test.kind,number:used+1,snapshot:json(snapshot),answers:{},remainingMs:test.duration*60000,remainingBySection:json(Object.fromEntries(["Listening","Reading","Writing"].map(s=>[s,Number(builder.duration[s])*60000]))),sessionKey:randomUUID(),lastSignalAt:new Date()}});
    await tx.attemptLog.create({data:{attemptId:a.id,event:"START",remainingMs:a.remainingMs}});
    return attemptView(a,true);
  });
}
export async function startPractice(db:Db,user:Identity,selection:{skill:string;mode:string;selection:string;questionId?:string}) {
  studentOnly(user);
  assert(selection.skill !== "Speaking",403,"Speaking is conducted offline by your trainer");
  let questions=await db.question.findMany({where:{...(selection.questionId?{id:selection.questionId}:{}),skill:selection.skill as any,course:{in:[user.student.course,"BOTH"]},published:true,archived:false,practiceEligible:true,...(selection.mode === "section"?{section:selection.selection}:{questionType:selection.selection})},orderBy:{id:"asc"},take:100});
  assert(questions.length,404,"No published practice content matches this selection");
  if(selection.skill === "Writing")questions=questions.slice(0,1);
  const minutes=selection.skill === "Writing" && questions[0]?.section === "Task 2"?40:20;
  const untimed=selection.skill!=="Writing";
  const a=await db.attempt.create({data:{studentId:user.id,course:user.student.course,testId:`practice-${randomUUID()}`,kind:"PRACTICE",number:1,snapshot:json({title:`${selection.skill} practice`,skill:selection.skill,questions,builder:{duration:{[selection.skill]:minutes}},conversions:{},version:1,untimed}),answers:{},remainingMs:untimed?0:minutes*60000,remainingBySection:untimed?{}:{[selection.skill]:minutes*60000},section:Math.max(0,["Listening","Reading","Writing"].indexOf(selection.skill)),sessionKey:randomUUID(),lastSignalAt:new Date()}});
  return attemptView(a,true);
}
function validateAnswers(a:Attempt,answers:Record<string,string>) {
  const snapshot=a.snapshot as Snapshot;
  const allowed=new Set(snapshot.questions.flatMap(q=>[`${q.skill}:${q.id}`,`${q.skill}:flag:${q.id}`]));
  if(snapshot.questions.some(q=>q.skill === "Writing")) for(const key of ["Writing:Task 1","Writing:Task 2"]) allowed.add(key);
  for(const key of Object.keys(answers)) assert(allowed.has(key),400,"An answer does not belong to this attempt");
}
export async function signal(db:Db,user:Identity,id:string,body:Heartbeat,submit=false) {
  studentOnly(user);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${id} FOR UPDATE`;
    const a=await owned(tx,user,id);
    if(a.state === "SUBMITTED") { assert(submit,409,"This attempt is already submitted"); return {attempt:attemptView(a,true),submitted:true}; }
    assert(a.sessionKey === body.sessionKey,409,"This attempt is open in another session. Resume it again");
    assert(body.sequence >= a.sequence,409,"A newer answer revision is already saved");
    const fingerprint=digest(JSON.stringify({...body,submit,answers:Object.fromEntries(Object.entries(body.answers).sort(([a],[b])=>a.localeCompare(b)))}));
    if(body.sequence === a.sequence) {assert(a.lastSignalHash===fingerprint,409,"Another save used this revision. Reload saved answers to reconcile the conflict");return {attempt:attemptView(a,true),duplicate:true};}
    assert(body.sequence === a.sequence+1,409,"Refresh the attempt before saving another revision");
    validateAnswers(a,body.answers);
    assert(a.kind!=="PRACTICE"||body.section===a.section,400,"Module practice cannot change to another skill");
    const now=new Date();
    const gap=a.lastSignalAt?Math.max(0,now.getTime()-a.lastSignalAt.getTime()):0;
    // Client reconnect claims cannot erase a server-observed continuous interval.
    // Only server signal staleness establishes a break in continuity.
    const interrupted=gap>SIGNAL_GAP_MS;
    const elapsed=interrupted?0:gap;
    const sectionName=["Listening","Reading","Writing"][a.section]!;
    const remainingBySection={...a.remainingBySection as Record<string,number>};
    const hasSections=Object.keys(remainingBySection).length>0;
    if(hasSections)remainingBySection[sectionName]=Math.max(0,(remainingBySection[sectionName]??0)-elapsed);
    const remainingMs=hasSections?Object.values(remainingBySection).reduce((sum,n)=>sum+n,0):Math.max(0,a.remainingMs-elapsed);
    const setting=await tx.platformSetting.findUnique({where:{id:"platform"}});
    const limit=(setting?.value as typeof defaultSettings | undefined)?.interruptionLimit??3;
    const interruptions=a.interruptions+(interrupted?1:0);
    const flagged=interruptions>limit;
    const untimed=(a.snapshot as Snapshot).untimed;
    const submittedSections=[...a.submittedSections];
    if(body.completeSection){assert(a.kind!=="PRACTICE",400,"Submit module practice using final submission");assert(!submittedSections.includes(sectionName),409,"This section is already submitted");submittedSections.push(sectionName);}
    const finished=submit||(!untimed&&remainingMs === 0);
    const previous=a.answers as Record<string,string>;
    for(const [key,value] of Object.entries(body.answers)){
      const skill=key.split(":")[0]!;
      if(skill!==sectionName&&(remainingBySection[skill]??0)>0)assert(value===(previous[key]??""),400,"Save the section change before editing answers in another skill");
    }
    const accepted={...body.answers};
    // A sparse request must never erase previously saved inactive-skill answers.
    for(const [key,value] of Object.entries(previous))if(key.split(":")[0]!==sectionName)accepted[key]=value;
    if(hasSections)for(const key of Object.keys(accepted)){const skill=key.split(":")[0]!;if((remainingBySection[skill]??0)===0){const old=(a.answers as Record<string,string>)[key];if(old===undefined)delete accepted[key];else accepted[key]=old;}}
    if(hasSections)for(const [key,value] of Object.entries(a.answers as Record<string,string>))if((remainingBySection[key.split(":")[0]!]??0)===0)accepted[key]=value;
    if(body.completeSection){remainingBySection[sectionName]=0;await tx.attemptLog.create({data:{attemptId:id,event:`SECTION_SUBMIT:${sectionName}`,remainingMs:Object.values(remainingBySection).reduce((sum,n)=>sum+n,0),at:now}});}
    const finalRemaining=hasSections?Object.values(remainingBySection).reduce((sum,n)=>sum+n,0):remainingMs;
    const complete=finished||(!untimed&&finalRemaining===0);
    const chosenSection=["Listening","Reading","Writing"][body.section]!;
    const section=hasSections&&finalRemaining>0&&(remainingBySection[chosenSection]??0)===0?["Listening","Reading","Writing"].findIndex(s=>(remainingBySection[s]??0)>0):body.section;
    const savedAnswers=json(!untimed&&a.remainingMs===0?a.answers:accepted);
    const updated=await tx.attempt.update({where:{id},data:{answers:savedAnswers,remainingMs:finalRemaining,submittedSections,activeMs:{increment:Math.floor(elapsed)},remainingBySection:json(remainingBySection),section,question:section!==a.section?0:body.question,theme:body.theme,fontSize:body.fontSize,sequence:body.sequence,lastSignalHash:fingerprint,lastSignalAt:now,interruptions,flagged,...(interrupted&&flagged?{reviewedAt:null}:{}),state:complete?"SUBMITTED":"IN_PROGRESS",submittedAt:complete?now:null}});
    if(interrupted) {
      await tx.attemptLog.createMany({data:[{attemptId:id,event:"STOP",remainingMs:a.remainingMs,at:a.lastSignalAt??now},{attemptId:id,event:"RESUME",remainingMs:a.remainingMs,at:now}]});
      await audit(tx,user.id,flagged?"Attempt flagged for review":"Attempt resumed",id,{interruptions,remainingMs});
    }
    if(complete) await scoreSubmission(tx,updated);
    return {attempt:attemptView(updated,true),submitted:complete};
  });
}
export async function resumeAttempt(db:Db,user:Identity,id:string) {
  studentOnly(user);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id"=${id} FOR UPDATE`;
    const a=await owned(tx,user,id);
    if(a.state === "SUBMITTED") return attemptView(a,true);
    // Keep the saved sequence/session. Heartbeat CAS rejects stale concurrent tabs.
    // A stale last signal is reconciled on the next confirmed heartbeat.
    return {...attemptView(a,true),snapshot:visibleSnapshot(a.snapshot as Snapshot)};
  });
}
async function scoreSubmission(tx:Tx,a:Attempt) {
  const snapshot=a.snapshot as Snapshot;
  const answers=a.answers as Record<string,string>;
  const raw:Record<string,{correct:number;total:number}>= {};
  const bands:Record<string,number|null>={Listening:null,Reading:null};
  for(const module of ["Listening","Reading"]) {
    const questions=snapshot.questions.filter(q=>q.skill === module);
    const normalize=(value:string)=>value.trim().toLocaleLowerCase("en").replace(/\s+/g," ");
    const correct=questions.filter(q=>{const accepted=(Array.isArray(q.answer)?q.answer:[q.answer]).filter((key:string)=>key.trim());return accepted.some((key:string)=>normalize(key) === normalize(answers[`${module}:${q.id}`]??""));}).length;
    raw[module]={correct,total:questions.length};
    bands[module]=rawBand(correct,module,a.course,snapshot.conversions,questions.length);
  }
  const hasWriting=snapshot.questions.some(q=>q.skill === "Writing");
  const s=await tx.student.findUnique({where:{id:a.studentId},select:{trainerId:true}});
  const autoWriting=hasWriting&&(await platformSettings(tx)).autoWritingEvaluation;
  const r=await tx.result.create({data:{id:a.id,studentId:a.studentId,assignedTrainerId:s?.trainerId,course:a.course,testId:a.testId,kind:a.kind,name:snapshot.title,attemptNumber:a.number,minutes:Math.ceil(a.activeMs/60000),listening:bands.Listening,reading:bands.Reading,rawScores:json(raw),originalScores:json({modules:[...new Set(snapshot.questions.map(q=>q.skill))],listening:bands.Listening,reading:bands.Reading,writing:null}),aiStatus:hasWriting?(autoWriting?"Pending":"Manual review"):"Completed",reviewStatus:a.kind === "FLT"||hasWriting?"Pending":"Completed",released:a.kind !== "FLT"}});
  if(autoWriting) await tx.evaluationJob.create({data:{resultId:r.id}});
  if((a.kind === "FLT"||hasWriting) && s?.trainerId) await notify(tx,s.trainerId,`New marksheet: ${snapshot.title}`,`/trainer/evaluations/${r.id}`);
  await audit(tx,a.studentId,"Attempt submitted",a.id,{kind:a.kind});
}
