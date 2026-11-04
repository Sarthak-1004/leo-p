import { z } from "zod";
import type { Db } from "./db.js";
import { json, transaction } from "./db.js";
import { questionSchema, assert, course, identifier } from "./domain.js";
import { admin, audit, type Identity } from "./auth.js";
import { saveTestRecord } from "./content.js";

// A full original paper (40 Listening, 40 Reading, 2 Writing) placed into one FLT or Practice Mock slot as unpublished drafts.
const packSchema = z.object({
  id:identifier, version:z.number().int().positive(), course, kind:z.enum(["FLT","PRACTICE_MOCK"]), authorship:z.string().min(1), status:z.string(),
  durations:z.object({Listening:z.number().int().min(1).max(90),Reading:z.number().int().min(1).max(120),Writing:z.number().int().min(1).max(120)}).strict(),
  questions:z.array(questionSchema).length(82),
  listeningScripts:z.array(z.object({id:z.string(),part:z.string(),questionIds:z.array(z.string()),text:z.string().min(1),audioStatus:z.string()})),
  // A Listening paper may be shared by the General and Academic tests of the same number, as in the real test.
  listeningId:identifier.optional(),
  // Audio per Listening part and Academic Task 1 images, relative to the pack file; uploaded and attached at install.
  media:z.array(z.object({file:z.string().regex(/^[\w./-]+$/).refine(f=>!f.includes("..")),questionIds:z.array(identifier).min(1)})).default([]),
  speaking:z.string().default(""),
});
export type TestPack = z.infer<typeof packSchema>;
export const slotId = (kind:TestPack["kind"],number:number) => `${kind==="FLT"?"mock":"practice-mock"}-${String(number).padStart(2,"0")}`;
export function validateTestPack(value:unknown) {
  const pack=packSchema.parse(value), ids=new Set<string>();
  for(const q of pack.questions) {
    assert(!ids.has(q.id),400,"Use unique question identifiers");ids.add(q.id);
    // Module practice reveals answer keys, so test questions never join the practice pool.
    assert(!q.published&&!q.archived&&!q.practiceEligible&&q.assetIds.length===0,400,"Test packs must contain unpublished, non-practice drafts without media references");
    assert(q.skill!=="Speaking"&&q.title.startsWith("Original"),400,"Label original questions and exclude digital Speaking");
    assert(q.course===pack.course||q.course==="BOTH",400,"Every question must belong to the pack's course");
    if(q.skill==="Reading")assert(q.passage.length>100,400,"Reading questions require a passage");
    if(q.skill!=="Writing") {
      const answers=Array.isArray(q.answer)?q.answer:[q.answer];
      assert(answers.length>0&&answers.every(a=>a.trim().length>0),400,"Objective questions require an answer key");
      if(q.options.length)assert(answers.every(a=>q.options.includes(a)),400,"Answers must match the supplied options");
    }
  }
  const of=(skill:string)=>pack.questions.filter(q=>q.skill===skill);
  assert(of("Listening").length===40&&of("Reading").length===40&&of("Writing").length===2,400,"A full test needs 40 Listening, 40 Reading and two Writing tasks");
  assert(of("Writing").some(q=>q.section==="Task 1")&&of("Writing").some(q=>q.section==="Task 2"),400,"Include both Writing Task 1 and Task 2");
  const listeningIds=new Set(of("Listening").map(q=>q.id)), scripted=new Set(pack.listeningScripts.flatMap(s=>s.questionIds));
  assert([...listeningIds].every(id=>scripted.has(id))&&[...scripted].every(id=>listeningIds.has(id)),400,"Listening scripts must reference the pack's Listening questions");
  assert(pack.media.every(m=>m.questionIds.every(id=>ids.has(id))),400,"Media must reference the pack's questions");
  return pack;
}
// assets: uploaded asset IDs per question ID, attached only to questions this install creates.
export async function installTestPack(db:Db,actor:Identity,value:unknown,number:number,assets:Record<string,string[]>={}) {
  admin(actor);assert(actor.enabled,403,"Enabled Admin access required");const pack=validateTestPack(value);
  assert(Number.isInteger(number)&&number>=1&&(pack.kind!=="FLT"||number<=40),400,"Choose a valid slot number");
  const id=slotId(pack.kind,number);
  return transaction(db,async tx=>{
    const current=await tx.user.findUnique({where:{id:actor.id}});
    assert(current?.role==="ADMIN"&&current.enabled,403,"Enabled Admin access required");
    const old=await tx.test.findUnique({where:{course_id:{course:pack.course,id}}});
    const questionIds={Listening:[] as string[],Reading:[] as string[],Writing:[] as string[],Speaking:[] as string[]};
    for(const q of pack.questions)questionIds[q.skill as "Listening"|"Reading"|"Writing"].push(q.id);
    // Never overwrite a live slot or a different paper; rerunning the same pack is a no-op for the builder.
    if(old) {
      assert(!old.published,409,`${pack.course}/${id} is published. Unpublish it before replacing its paper`);
      const placed=((old.builder as any)?.questionIds??{}) as Record<string,string[]>;
      const same=(Object.keys(questionIds) as (keyof typeof questionIds)[]).every(s=>(placed[s]??[]).join()===questionIds[s].join());
      assert(!Object.values(placed).flat().length||same,409,`${pack.course}/${id} already holds a different paper`);
    }
    const existing=new Set((await tx.question.findMany({where:{id:{in:pack.questions.map(q=>q.id)}},select:{id:true}})).map(q=>q.id));
    const files=await tx.asset.findMany({where:{id:{in:Object.values(assets).flat()}},select:{id:true,contentType:true}});
    let created=0;
    for(const q of pack.questions) {
      if(existing.has(q.id))continue;
      const {version: _version,...fields}=q,assetIds=assets[q.id]??[];
      const types=assetIds.map(id=>files.find(f=>f.id===id)?.contentType);
      assert(types.every(t=>t&&(q.skill==="Listening"?t.startsWith("audio/"):t.startsWith("image/"))),400,`${q.id}: attach audio to Listening and images elsewhere`);
      await tx.question.create({data:{...fields,assetIds,options:json(q.options),answer:json(q.answer)}});created++;
    }
    await saveTestRecord(tx,actor,{id,course:pack.course,kind:pack.kind,number,published:false,available:old?.available??false,duration:pack.durations.Listening+pack.durations.Reading+pack.durations.Writing,builder:{questionIds,duration:{...pack.durations,Speaking:0}},version:old?.version??1});
    const result={test:`${pack.course}/${id}`,created,skipped:pack.questions.length-created,published:0};
    await audit(tx,actor.id,"CONTENT_TEST_INSTALL",pack.id,{...result,authorship:pack.authorship});return result;
  });
}
