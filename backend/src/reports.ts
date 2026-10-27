import {z} from "zod";
import {Prisma,type Db} from "./db.js";
import {academicSelect,staff,type Identity} from "./auth.js";
import {assert,course,today} from "./domain.js";
import {csvExport} from "./imports.js";
import {resultView} from "./views.js";

export const reportQuery=z.object({
  course:course.optional(),studentId:z.string().max(80).optional(),trainerId:z.string().max(80).optional(),testId:z.string().max(80).optional(),
  kind:z.enum(["FLT","PRACTICE_MOCK","PRACTICE"]).optional(),module:z.enum(["Listening","Reading","Writing","Speaking"]).optional(),questionType:z.string().max(100).optional(),
  from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),
  sort:z.enum(["newest","oldest","band-desc","band-asc"]).default("newest"),
}).strict().refine(q=>!q.from||!q.to||q.from<=q.to,"End date must follow start date");
export type ReportQuery=z.infer<typeof reportQuery>;
const mean=(values:number[])=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null;
const normalize=(v:string)=>v.trim().toLocaleLowerCase("en").replace(/\s+/g," ");

export async function reports(db:Db,user:Identity,q:ReportQuery,exporting=false){
  staff(user);
  const dateRange=q.from||q.to?{...(q.from?{gte:new Date(`${q.from}T00:00:00+05:30`)}:{}),...(q.to?{lte:new Date(`${q.to}T23:59:59.999+05:30`)}:{})}:undefined;
  const studentWhere:Prisma.StudentWhereInput={...(q.course?{course:q.course}:{}),...(q.studentId?{id:q.studentId}:{}),...(q.trainerId?{trainerId:q.trainerId}:{})};
  const attemptWhere:Prisma.AttemptWhereInput={student:studentWhere,...(q.course?{course:q.course}:{}),...(q.kind?{kind:q.kind}:{}),...(q.testId?{testId:q.testId}:{}),...(dateRange?{createdAt:dateRange}:{})};
  const where:Prisma.ResultWhereInput={...(q.course?{course:q.course}:{}),...(q.studentId?{studentId:q.studentId}:{}),...(q.kind?{kind:q.kind}:{}),...(q.testId?{testId:q.testId}:{}),...(dateRange?{date:dateRange}:{}),attempt:{student:studentWhere}};
  // Academic-only selections: Trainer requests never fetch a contact record.
  const students=await db.student.findMany({where:studentWhere,select:academicSelect,orderBy:{id:"asc"}});
  const trainers=await db.user.findMany({where:{role:"TRAINER"},select:{id:true,name:true,enabled:true},orderBy:{name:"asc"}});
  type TypeScore={module:string;questionType:string;correct:number;total:number};
  type ReportRow=Prisma.ResultGetPayload<{include:{revisions:{select:{actorId:true;at:true}}}}>&{typeScores:TypeScore[]};
  const filtered:ReportRow[]=[];let cursor:string|undefined;
  // Project only scoring metadata inside PostgreSQL. Passage/prompt/essay bodies
  // are never accumulated in the report process, even for a large history.
  for(;;){
    const rows=await db.result.findMany({where,orderBy:{id:"asc"},take:500,...(cursor?{cursor:{id:cursor},skip:1}:{}),include:{revisions:{select:{actorId:true,at:true},orderBy:{at:"asc"}}}});
    if(!rows.length)break;
    const projected=await db.$queryRaw<Array<{id:string;questions:{id:string;skill:string;questionType:string;answer:string|string[]|null;response:string|null}[]}>>(Prisma.sql`
      SELECT a."id",jsonb_agg(jsonb_build_object('id',items.item->>'id','skill',items.item->>'skill','questionType',items.item->>'questionType',
        'answer',CASE WHEN items.item->>'skill' IN ('Listening','Reading') THEN items.item->'answer' ELSE NULL END,
        'response',CASE WHEN items.item->>'skill' IN ('Listening','Reading') THEN a."answers"->>((items.item->>'skill')||':'||(items.item->>'id')) ELSE NULL END)) AS questions
      FROM "Attempt" a CROSS JOIN LATERAL jsonb_array_elements(a."snapshot"->'questions') AS items(item)
      WHERE a."id" IN (${Prisma.join(rows.map(r=>r.id))}) GROUP BY a."id"`);
    for(const r of rows){
      const questions=projected.find(row=>row.id===r.id)?.questions??[];
      if(q.module&&!questions.some(x=>x.skill===q.module)&&!(q.module==="Speaking"&&r.kind==="FLT"))continue;
      if(q.questionType&&!questions.some(x=>x.questionType===q.questionType&&(!q.module||x.skill===q.module)))continue;
      const scores=new Map<string,TypeScore>();
      for(const question of questions){
        if(!["Listening","Reading"].includes(question.skill)||(q.module&&question.skill!==q.module)||(q.questionType&&question.questionType!==q.questionType))continue;
        const key=`${question.skill}/${question.questionType}`,score=scores.get(key)??{module:question.skill,questionType:question.questionType,correct:0,total:0};
        const accepted=(Array.isArray(question.answer)?question.answer:[question.answer??""]).filter(key=>key.trim());
        if(accepted.some(key=>normalize(key)===normalize(question.response??"")))score.correct++;
        score.total++;scores.set(key,score);
      }
      filtered.push({...r,typeScores:[...scores.values()]});
    }
    if(rows.length<500)break;cursor=rows.at(-1)!.id;
  }
  const latest=new Map<string,typeof filtered[number]>();
  for(const r of filtered){const key=r.kind==="PRACTICE_MOCK"?`${r.studentId}/${r.course}/${r.testId}`:r.id;const old=latest.get(key);if(!old||r.attemptNumber>old.attemptNumber)latest.set(key,r);}
  const performance=[...latest.values()];
  const moduleBands=["Listening","Reading","Writing","Speaking"].map(module=>({module,count:performance.filter(r=>r[module.toLowerCase() as "listening"]!==null).length,average:mean(performance.flatMap(r=>r[module.toLowerCase() as "listening"]===null?[]:[r[module.toLowerCase() as "listening"]!]))}));
  const group=(key:"course"|"kind")=>[...new Set(performance.map(r=>r[key]))].map(name=>{const rows=performance.filter(r=>r[key]===name);return {name,count:rows.length,average:mean(rows.flatMap(r=>r.overall===null?[]:[r.overall]))};});
  const types=new Map<string,{module:string;questionType:string;correct:number;total:number}>();
  for(const r of performance)for(const score of r.typeScores){const key=`${score.module}/${score.questionType}`,old=types.get(key)??{...score,correct:0,total:0};old.correct+=score.correct;old.total+=score.total;types.set(key,old);}
  const day=today("Asia/Kolkata"),soon=new Date(`${day}T00:00:00Z`);soon.setUTCDate(soon.getUTCDate()+7);
  const access={active:0,expired:0,disabled:0,upcoming:0,expiring:0};
  for(const s of students){if(!s.user.enabled)access.disabled++;else if(s.expiryDate<day)access.expired++;else if(s.startDate>day)access.upcoming++;else{access.active++;if(s.expiryDate<=soon.toISOString().slice(0,10))access.expiring++;}}
  const workload=trainers.filter(t=>!q.trainerId||q.trainerId===t.id).map(t=>{const evaluated=filtered.filter(r=>r.evaluatedBy===t.id&&r.reviewStatus==="Completed");return {id:t.id,name:t.name,assigned:students.filter(s=>s.trainerId===t.id).length,pending:filtered.filter(r=>r.reviewStatus!=="Completed"&&r.assignedTrainerId===t.id).length,completed:evaluated.length,turnaroundHours:mean(evaluated.flatMap(r=>{const at=r.revisions.filter(v=>v.actorId===t.id).at(-1)?.at;return at?[Math.max(0,at.getTime()-r.date.getTime())/3600000]:[];}))};});
  filtered.sort((a,b)=>q.sort==="oldest"?+a.date-+b.date:q.sort==="band-desc"?(b.overall??-1)-(a.overall??-1):q.sort==="band-asc"?(a.overall??10)-(b.overall??10):+b.date-+a.date);
  const rows=filtered.slice((q.page-1)*q.limit,q.page*q.limit).map(r=>({...resultView({...r,revisions:undefined},user),studentName:students.find(s=>s.id===r.studentId)?.user.name??r.studentId}));
  if(exporting){assert(filtered.length<=50000,400,"Narrow the filters to export at most 50,000 records");return csvExport([["Student ID","Name","Course","Type","Test","Attempt","Submitted (UTC)","Listening","Reading","Writing","Speaking","Overall","Review","Released"],...filtered.map(r=>[r.studentId,students.find(s=>s.id===r.studentId)?.user.name??r.studentId,r.course,r.kind,r.name,String(r.attemptNumber),r.date.toISOString(),...[r.listening,r.reading,r.writing,r.speaking,r.overall].map(v=>v===null?"Pending":String(v)),r.reviewStatus,r.released?"Yes":"No"])]);}
  const [starts,submitted]=await Promise.all([db.attempt.count({where:attemptWhere}),db.attempt.count({where:{...attemptWhere,state:"SUBMITTED"}})]);
  return {count:filtered.length,page:q.page,limit:q.limit,results:rows,summary:{starts,submitted,inProgress:starts-submitted,averageBand:mean(performance.flatMap(r=>r.overall===null?[]:[r.overall])),access},moduleBands,byCourse:group("course"),byKind:group("kind"),questionTypes:[...types.values()],workload};
}
