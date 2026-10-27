import { z } from "zod";
import type { Db } from "./db.js";
import { json, transaction } from "./db.js";
import { questionSchema, assert } from "./domain.js";
import { admin, audit, type Identity } from "./auth.js";

const packSchema = z.object({
  id:z.literal("original-practice-v1"), version:z.literal(1), authorship:z.string().min(1), status:z.string(),
  questions:z.array(questionSchema).length(40),
  listeningScripts:z.array(z.object({id:z.string(),questionIds:z.array(z.string()),text:z.string().min(1),audioStatus:z.string()})),
});
export function validatePracticePack(value:unknown) {
  const pack=packSchema.parse(value), ids=new Set<string>();
  for(const q of pack.questions) {
    assert(!ids.has(q.id)&&q.id.startsWith("orig-v1-"),400,"Use unique original practice identifiers");ids.add(q.id);
    assert(!q.published&&!q.archived&&q.practiceEligible&&q.assetIds.length===0,400,"Practice packs must contain unpublished drafts without media references");
    assert(q.skill!=="Speaking"&&q.title.startsWith("Original practice:"),400,"Label original practice questions and exclude digital Speaking");
    if(q.skill==="Reading")assert(q.passage.length>100,400,"Reading questions require a passage");
    if(q.skill!=="Writing") {
      const answers=Array.isArray(q.answer)?q.answer:[q.answer];
      assert(answers.length>0&&answers.every(a=>a.trim().length>0),400,"Objective questions require an answer key");
      if(q.options.length)assert(answers.every(a=>q.options.includes(a)),400,"Answers must match the supplied options");
    }
  }
  const listeningIds=new Set(pack.questions.filter(q=>q.skill==="Listening").map(q=>q.id));
  const scripted=new Set(pack.listeningScripts.flatMap(s=>s.questionIds));
  assert([...listeningIds].every(id=>scripted.has(id))&&[...scripted].every(id=>listeningIds.has(id)),400,"Listening scripts must reference the pack's Listening questions");
  return pack;
}
export async function installPracticePack(db:Db,actor:Identity,value:unknown) {
  admin(actor);assert(actor.enabled,403,"Enabled Admin access required");const pack=validatePracticePack(value);
  return transaction(db,async tx=>{
    const current=await tx.user.findUnique({where:{id:actor.id}});
    assert(current?.role==="ADMIN"&&current.enabled,403,"Enabled Admin access required");
    const existing=new Set((await tx.question.findMany({where:{id:{in:pack.questions.map(q=>q.id)}},select:{id:true}})).map(q=>q.id));
    let created=0;
    for(const q of pack.questions) {
      if(existing.has(q.id))continue;
      const {version: _version,...fields}=q;
      await tx.question.create({data:{...fields,options:json(q.options),answer:json(q.answer)}});created++;
    }
    const result={created,skipped:pack.questions.length-created,published:0};
    await audit(tx,actor.id,"CONTENT_PRACTICE_INSTALL",pack.id,{...result,authorship:pack.authorship});return result;
  });
}
