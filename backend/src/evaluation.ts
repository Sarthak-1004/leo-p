import { z } from "zod";
import { transaction, json, Prisma, type Db } from "./db.js";
import { assert, band, criteria, date, overall } from "./domain.js";
import { admin, audit, notify, staff, type Identity } from "./auth.js";
import { resultView } from "./views.js";
export const evaluationSchema = z.object({
  version:z.number().int().positive(), listening:band.nullable(), reading:band.nullable(), writing:band.nullable(),
  speakingCriteria:criteria.nullable().optional(), speakingDate:date.nullable().optional(),
  remarks:z.string().trim().max(5000), completed:z.boolean(), draft:z.boolean().default(false),
}).strict();
export async function evaluate(db:Db,user:Identity,id:string,input:z.infer<typeof evaluationSchema>) {
  staff(user);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Result" WHERE "id"=${id} FOR UPDATE`;
    const result=await tx.result.findUnique({where:{id},include:{attempt:{select:{snapshot:true}}}});
    assert(result,404,"Marksheet not found");
    assert(result.version === input.version,409,"This marksheet changed. Reload it before saving");
    const c=input.speakingCriteria;
    assert(!c || result.kind === "FLT",400,"Speaking applies only to offline FLT assessment");
    assert(!c || input.speakingDate,400,"Record the offline Speaking test date");
    const speaking=c?Math.round(Object.values(c).reduce((a,b)=>a+b,0)/4*2)/2:result.speaking;
    const scores={listening:input.listening,reading:input.reading,writing:input.writing,speaking};
    const changed=(["listening","reading","writing","speaking"] as const).filter(key=>scores[key] !== result[key]);
    const criteriaChanged=!!c && (JSON.stringify(c)!==JSON.stringify(result.speakingCriteria) || input.speakingDate!==result.speakingDate);
    assert(!(changed.length||criteriaChanged)||input.remarks.length>0,400,"Remarks are required for every score change");
    if(input.draft) {
      const saved=await tx.result.update({where:{id},data:{evaluationDraft:json({...input,actor:user.id}),version:{increment:1},reviewerId:user.id,reviewerUntil:new Date(Date.now()+600000)}});
      await audit(tx,user.id,"Evaluation draft saved",id);
      return resultView(saved,user);
    }
    const modules=new Set(((result.attempt.snapshot as any).questions as any[]).map(q=>q.skill));
    if(result.kind === "PRACTICE")for(const key of ["listening","reading","writing"] as const)assert(modules.has(key[0]!.toUpperCase()+key.slice(1))||input[key]===null,400,"Cannot score a module outside this practice submission");
    assert(!input.completed || (result.kind === "PRACTICE"?(!modules.has("Writing")||input.writing!==null):[input.listening,input.reading,input.writing].every(n=>n!==null)),400,"Complete the required module evaluations before completing review");
    if(criteriaChanged&&!changed.includes("speaking")) changed.push("speaking");
    for(const key of changed) await tx.scoreRevision.create({data:{resultId:id,section:key[0]!.toUpperCase()+key.slice(1),previous:result[key],value:scores[key],actorId:user.id,actorName:user.name,role:user.role,remarks:input.remarks,details:json(key==="speaking"?{previousCriteria:result.speakingCriteria,criteria:c,date:input.speakingDate}:{})}});
    const updated=await tx.result.update({where:{id},data:{...scores,overall:overall(scores),remarks:input.remarks||result.remarks,reviewStatus:input.completed?"Completed":"In review",evaluatedBy:user.id,evaluationDraft:Prisma.DbNull,reviewerId:null,reviewerUntil:null,version:{increment:1},...(c?{speakingCriteria:json(c),speakingDate:input.speakingDate}:{} )},include:{revisions:true}});
    await audit(tx,user.id,"Evaluation updated",id,{changes:changed,remarks:input.remarks,completed:input.completed});
    if(result.released&&result.speaking===null&&speaking!==null) await notify(tx,result.studentId,`Your Speaking score has been added to ${result.name}.`,`/student/results/${id}`);
    else if(result.released&&changed.length) await notify(tx,result.studentId,`Trainer feedback for ${result.name} has been updated.`,`/student/results/${id}`);
    return resultView(updated,user);
  });
}
export async function release(db:Db,user:Identity,ids:string[]) {
  admin(user);
  return transaction(db,async tx=>{
    const eligible:string[]=[], skipped:Array<{id:string;reason:string}>=[];
    for(const id of [...new Set(ids)].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "Result" WHERE "id"=${id} FOR UPDATE`;
      const r=await tx.result.findUnique({where:{id}});
      if(!r || r.kind!=="FLT" || r.released || r.reviewStatus!=="Completed" || [r.listening,r.reading,r.writing].some(n=>n===null)) {skipped.push({id,reason:"Not an unreleased, completed FLT result"});continue;}
      await tx.result.update({where:{id},data:{released:true,releasedBy:user.id,releasedAt:new Date(),version:{increment:1}}});
      await notify(tx,r.studentId,`Your ${r.name} result is now available.`,`/student/results/${id}`);
      await audit(tx,user.id,"Result released",id,{speakingPending:r.speaking===null});
      eligible.push(id);
    }
    return {released:eligible,skipped};
  });
}
export async function claim(db:Db,user:Identity,id:string) {
  staff(user);
  return transaction(db,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Result" WHERE "id"=${id} FOR UPDATE`;
    const result=await tx.result.findUnique({where:{id}});
    assert(result,404,"Marksheet not found");
    if(result.reviewerId===user.id&&result.reviewerUntil&&result.reviewerUntil.getTime()>Date.now()+300000)return {claimed:true,reviewer:user.name};
    if(result.reviewerId && result.reviewerId!==user.id && result.reviewerUntil && result.reviewerUntil>new Date()) {
      const reviewer=await tx.user.findUnique({where:{id:result.reviewerId},select:{name:true}});
      return {claimed:false,reviewer:reviewer?.name??"Another trainer",until:result.reviewerUntil};
    }
    await tx.result.update({where:{id},data:{reviewerId:user.id,reviewerUntil:new Date(Date.now()+600000)}});
    return {claimed:true,reviewer:user.name};
  });
}
