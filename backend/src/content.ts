import { z } from "zod";
import { transaction, json, type Db, type Tx } from "./db.js";
import { admin, audit, notify, type Identity } from "./auth.js";
import { assert, course, identifier, questionSchema, validateConversions, defaultConversions } from "./domain.js";
const sectionIds=z.object({Listening:z.array(identifier).max(40),Reading:z.array(identifier).max(40),Writing:z.array(identifier).max(2),Speaking:z.array(identifier).max(0).default([])}).strict();
const durations=z.object({Listening:z.number().int().min(1).max(90),Reading:z.number().int().min(1).max(120),Writing:z.number().int().min(1).max(120),Speaking:z.literal(0).default(0)}).strict();
export const testSchema=z.object({id:identifier,course,kind:z.enum(["FLT","PRACTICE_MOCK"]),number:z.number().int().min(1),published:z.boolean(),available:z.boolean(),duration:z.number().int().positive().max(330),builder:z.object({questionIds:sectionIds,duration:durations}).strict(),version:z.number().int().positive(),conversions:z.unknown().optional()}).strict();
export async function saveQuestion(db:Db,user:Identity,body:z.infer<typeof questionSchema>) {
  admin(user);
  return transaction(db,async tx=>{
    const old=await tx.question.findUnique({where:{id:body.id}});
    assert(!old||body.version===old.version,409,"Question changed. Reload before saving");
    const {version,...input}=body;
    if(input.published&&(input.skill==="Listening"||input.skill==="Reading"))assert((Array.isArray(input.answer)?input.answer:[input.answer]).some(a=>a.trim().length>0),400,"Objective questions require an answer key before publication");
    if(input.published&&input.skill==="Reading")assert(input.passage.trim().length>0,400,"Supply a Reading passage before publication");
    const assets=await tx.asset.findMany({where:{id:{in:input.assetIds}},select:{contentType:true}});
    assert(assets.length===input.assetIds.length,400,"An asset does not exist");
    if(input.skill!=="Listening")assert(assets.every(a=>a.contentType.startsWith("image/")),400,"Use images for Reading, Writing and offline Speaking material");
    if(input.published&&input.skill==="Listening")assert(assets.some(a=>a.contentType.startsWith("audio/")),400,"Attach Listening audio before publication");
    assert(!(input.published&&input.archived),400,"Restore the archived question before publication");
    const q=await tx.question.upsert({where:{id:body.id},create:{...input,options:json(input.options),answer:json(input.answer)},update:{...input,options:json(input.options),answer:json(input.answer),version:{increment:1}}});
    await audit(tx,user.id,"Question saved",q.id,{version:q.version,published:q.published,archived:q.archived});
    return q;
  });
}
export async function saveTest(db:Db,user:Identity,input:z.infer<typeof testSchema>) {
  admin(user);
  return transaction(db,tx=>saveTestRecord(tx,user,input));
}
export async function saveTestRecord(tx:Db|Tx,user:Identity,input:z.infer<typeof testSchema>,dryRun=false) {
  admin(user);
    const old=await tx.test.findUnique({where:{course_id:{course:input.course,id:input.id}}});
    assert(!old||old.version===input.version,409,"Test changed. Reload before saving");
    assert(input.kind!=="FLT"||(input.number<=40&&!!old&&old.kind==="FLT"&&old.number===input.number),400,"Use the existing 40 FLT slots for this course");
    assert(!old||old.kind===input.kind,400,"Test type cannot be changed");
    const all=Object.values(input.builder.questionIds).flat();
    assert(new Set(all).size===all.length,400,"A question cannot appear twice in a test");
    const qs=await tx.question.findMany({where:{id:{in:all}}});
    assert(qs.length===all.length,400,"A selected question does not exist");
    for(const s of ["Listening","Reading","Writing"] as const) for(const id of input.builder.questionIds[s]) {
      const q=qs.find(q=>q.id===id)!;
      assert(q.skill===s&&(q.course===input.course||q.course==="BOTH")&&!q.archived,400,"Selected question is not eligible for this section/course");
      if(input.published) assert(q.published,400,"Publish selected questions before publishing this test");
    }
    if(input.published) {
      assert(input.builder.questionIds.Listening.length===40&&input.builder.questionIds.Reading.length===40&&input.builder.questionIds.Writing.length===2,400,"A published full test needs 40 Listening, 40 Reading and two Writing tasks");
      const writing=qs.filter(q=>q.skill==="Writing");
      assert(writing.some(q=>q.section==="Task 1")&&writing.some(q=>q.section==="Task 2"),400,"Include both Writing Task 1 and Task 2");
      const audio=await tx.asset.findMany({where:{id:{in:qs.flatMap(q=>q.assetIds)},contentType:{startsWith:"audio/"}},select:{id:true}});
      assert(qs.filter(q=>q.skill==="Listening").every(q=>q.assetIds.some(id=>audio.some(a=>a.id===id))),400,"Supply Listening audio before publishing");
    }
    const conversions=input.conversions?validateConversions(input.conversions,true):old?.conversions??defaultConversions;
    assert(conversions,400,"Conversion tables are required");
    if(input.published)validateConversions(conversions,true);
    const total=Object.values(input.builder.duration).reduce((a,b)=>a+b,0);
    const data={kind:input.kind,number:input.number,title:`${input.kind==="FLT"?"Full Length Test":"Practice Mock Test"} ${String(input.number).padStart(2,"0")}`,published:input.published,available:input.kind==="FLT"?input.available:false,duration:total,builder:json(input.builder),conversions:json(conversions)};
    if(dryRun)return data;
    const t=await tx.test.upsert({where:{course_id:{course:input.course,id:input.id}},create:{id:input.id,course:input.course,...data},update:{...data,version:{increment:1}}});
    await audit(tx,user.id,"Test updated",`${t.course}/${t.id}`,{version:t.version,published:t.published,available:t.available,conversionChanged:!!input.conversions,...(input.conversions?{previousConversions:old?.conversions??null,conversions}:{}),previous:old?{published:old.published,available:old.available,builder:old.builder}:null,builder:input.builder});
    if(t.kind==="FLT"&&t.published&&t.available&&(!old?.available||!old.published)) {
      const students=await tx.student.findMany({where:{course:t.course,user:{enabled:true}},select:{id:true}});
      for(const s of students)await notify(tx,s.id,`${t.title} is now available.`,"/student/mock-tests");
    }
    return t;
}
