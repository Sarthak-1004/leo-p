import {z} from "zod";
import {Prisma,type Db} from "./db.js";
import {academicSelect,staff,type Identity} from "./auth.js";
import {assert,course,today,zonedDay} from "./domain.js";
import {csvExport} from "./imports.js";
import {resultView} from "./views.js";

export const reportQuery=z.object({
  course:course.optional(),studentId:z.string().max(80).optional(),trainerId:z.string().max(80).optional(),testId:z.string().max(80).optional(),
  kind:z.enum(["FLT","PRACTICE_MOCK","PRACTICE"]).optional(),module:z.enum(["Listening","Reading","Writing","Speaking"]).optional(),questionType:z.string().max(100).optional(),
  from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),
  sort:z.enum(["newest","oldest","band-desc","band-asc"]).default("newest"),
}).strict().refine(q=>!q.from||!q.to||q.from<=q.to,"End date must follow start date");
export type ReportQuery=z.infer<typeof reportQuery>;

// Aggregates run inside PostgreSQL; only the requested page (or the bounded CSV columns) reaches
// this process, so many staff opening reports at once cannot exhaust server memory.
// At most three reports/exports run at once, so staff analytics never take every database
// connection away from students' exam saves; further requests wait their turn.
let running=0;const queued:Array<()=>void>=[];
export async function reports(db:Db,user:Identity,q:ReportQuery,exporting=false,timezone="Asia/Kolkata"){
  staff(user);
  if(running>=3)await new Promise<void>(resolve=>queued.push(resolve));else running++;
  try{return await buildReport(db,user,q,exporting,timezone);}
  finally{const next=queued.shift();if(next)next();else running--;}
}
async function buildReport(db:Db,user:Identity,q:ReportQuery,exporting:boolean,timezone:string){
  const filters:Prisma.Sql[]=[Prisma.sql`TRUE`];
  if(q.course)filters.push(Prisma.sql`r."course"=${q.course}::"Course"`);
  if(q.studentId)filters.push(Prisma.sql`r."studentId"=${q.studentId}`);
  if(q.trainerId)filters.push(Prisma.sql`s."trainerId"=${q.trainerId}`);
  if(q.kind)filters.push(Prisma.sql`r."kind"=${q.kind}::"TestKind"`);
  if(q.testId)filters.push(Prisma.sql`r."testId"=${q.testId}`);
  if(q.from)filters.push(Prisma.sql`r."date">=${zonedDay(q.from,timezone).start}`);
  if(q.to)filters.push(Prisma.sql`r."date"<=${zonedDay(q.to,timezone).end}`);
  if(q.module)filters.push(q.module==="Speaking"?Prisma.sql`(r."kind"='FLT' OR COALESCE(r."originalScores"->'modules','[]'::jsonb) @> jsonb_build_array('Speaking'::text))`:Prisma.sql`COALESCE(r."originalScores"->'modules','["Listening","Reading","Writing"]'::jsonb) @> jsonb_build_array(${q.module}::text)`);
  if(q.questionType)filters.push(Prisma.sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(r."originalScores"->'questionTypes','[]'::jsonb)) t(v) WHERE ${q.module?Prisma.sql`t.v=${`${q.module}/${q.questionType}`}`:Prisma.sql`substring(t.v from position('/' in t.v)+1)=${q.questionType}`})`);
  const from=Prisma.sql`FROM "Result" r JOIN "Student" s ON s."id"=r."studentId" WHERE ${Prisma.join(filters," AND ")}`;
  const total=(await db.$queryRaw<Array<{n:number}>>(Prisma.sql`SELECT count(*)::int AS n ${from}`))[0]!.n;
  if(exporting){
    assert(total<=50000,400,"Narrow the filters to export at most 50,000 records");
    const rows=await db.$queryRaw<Array<{studentId:string;studentName:string;course:string;kind:string;name:string;attemptNumber:number;date:Date;listening:number|null;reading:number|null;writing:number|null;speaking:number|null;overall:number|null;reviewStatus:string;released:boolean}>>(Prisma.sql`SELECT r."studentId",u."name" AS "studentName",r."course"::text AS course,r."kind"::text AS kind,r."name",r."attemptNumber",r."date",r."listening",r."reading",r."writing",r."speaking",r."overall",r."reviewStatus",r."released" FROM "Result" r JOIN "Student" s ON s."id"=r."studentId" JOIN "User" u ON u."id"=r."studentId" WHERE ${Prisma.join(filters," AND ")} ORDER BY r."date" DESC,r."id"`);
    return csvExport([["Student ID","Name","Course","Type","Test","Attempt","Submitted (UTC)","Listening","Reading","Writing","Speaking","Overall","Review","Released"],...rows.map(r=>[r.studentId,r.studentName,r.course,r.kind,r.name,String(r.attemptNumber),r.date.toISOString(),...[r.listening,r.reading,r.writing,r.speaking,r.overall].map(v=>v===null?"Pending":String(v)),r.reviewStatus,r.released?"Yes":"No"])]);
  }
  // Performance uses the latest Practice Mock attempt per student and test; every other result counts once.
  const typeFilter=Prisma.sql`${q.module?Prisma.sql`t->>'module'=${q.module}`:Prisma.sql`TRUE`} AND ${q.questionType?Prisma.sql`t->>'questionType'=${q.questionType}`:Prisma.sql`TRUE`}`;
  const [agg]=await db.$queryRaw<Array<{averageBand:number|null;moduleBands:{module:string;count:number;average:number|null}[]|null;byCourse:{name:string;count:number;average:number|null}[]|null;byKind:{name:string;count:number;average:number|null}[]|null;questionTypes:{module:string;questionType:string;correct:number;total:number}[]|null;pending:{id:string;pending:number}[]|null;completed:{id:string;completed:number;turnaroundHours:number|null}[]|null}>>(Prisma.sql`
    WITH f AS (SELECT r.* ${from}),
    perf AS (SELECT DISTINCT ON (CASE WHEN f."kind"='PRACTICE_MOCK' THEN f."studentId"||'/'||f."course"||'/'||f."testId" ELSE f."id" END) f.* FROM f ORDER BY CASE WHEN f."kind"='PRACTICE_MOCK' THEN f."studentId"||'/'||f."course"||'/'||f."testId" ELSE f."id" END,f."attemptNumber" DESC)
    SELECT
      (SELECT ROUND(AVG("overall")::numeric,2)::float FROM perf) AS "averageBand",
      (SELECT json_agg(x) FROM (SELECT m AS module,count(v)::int AS count,ROUND(AVG(v)::numeric,2)::float AS average FROM perf,LATERAL (VALUES ('Listening',perf."listening"),('Reading',perf."reading"),('Writing',perf."writing"),('Speaking',perf."speaking")) mv(m,v) GROUP BY m) x) AS "moduleBands",
      (SELECT json_agg(x) FROM (SELECT "course"::text AS name,count(*)::int AS count,ROUND(AVG("overall")::numeric,2)::float AS average FROM perf GROUP BY "course") x) AS "byCourse",
      (SELECT json_agg(x) FROM (SELECT "kind"::text AS name,count(*)::int AS count,ROUND(AVG("overall")::numeric,2)::float AS average FROM perf GROUP BY "kind") x) AS "byKind",
      (SELECT json_agg(x) FROM (SELECT t->>'module' AS module,t->>'questionType' AS "questionType",SUM((t->>'correct')::int)::int AS correct,SUM((t->>'total')::int)::int AS total FROM perf,jsonb_array_elements(COALESCE(perf."originalScores"->'typeScores','[]'::jsonb)) t WHERE ${typeFilter} GROUP BY 1,2) x) AS "questionTypes",
      (SELECT json_agg(x) FROM (SELECT "assignedTrainerId" AS id,count(*)::int AS pending FROM f WHERE "reviewStatus"<>'Completed' AND "assignedTrainerId" IS NOT NULL GROUP BY 1) x) AS pending,
      (SELECT json_agg(x) FROM (SELECT f."evaluatedBy" AS id,count(*)::int AS completed,ROUND(AVG(GREATEST(0,EXTRACT(EPOCH FROM (rv.at-f."date"))/3600))::numeric,2)::float AS "turnaroundHours" FROM f LEFT JOIN LATERAL (SELECT max("at") AS at FROM "ScoreRevision" WHERE "resultId"=f."id" AND "actorId"=f."evaluatedBy") rv ON true WHERE f."reviewStatus"='Completed' AND f."evaluatedBy" IS NOT NULL GROUP BY 1) x) AS completed`);
  const order=q.sort==="oldest"?Prisma.sql`r."date" ASC,r."id"`:q.sort==="band-desc"?Prisma.sql`r."overall" DESC NULLS LAST,r."date" DESC`:q.sort==="band-asc"?Prisma.sql`r."overall" ASC NULLS LAST,r."date" DESC`:Prisma.sql`r."date" DESC,r."id"`;
  const pageIds=(await db.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT r."id" ${from} ORDER BY ${order} LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`)).map(r=>r.id);
  const pageRows=await db.result.findMany({where:{id:{in:pageIds}}});
  // Academic-only selections: Trainer requests never fetch a contact record.
  const studentWhere:Prisma.StudentWhereInput={...(q.course?{course:q.course}:{}),...(q.studentId?{id:q.studentId}:{}),...(q.trainerId?{trainerId:q.trainerId}:{})};
  const [students,trainers]=await Promise.all([db.student.findMany({where:studentWhere,select:academicSelect}),db.user.findMany({where:{role:"TRAINER"},select:{id:true,name:true,enabled:true},orderBy:{name:"asc"}})]);
  const studentNames=new Map(students.map(s=>[s.id,s.user.name]));
  const missing=pageRows.filter(r=>!studentNames.has(r.studentId)).map(r=>r.studentId);
  if(missing.length)for(const u of await db.user.findMany({where:{id:{in:missing}},select:{id:true,name:true}}))studentNames.set(u.id,u.name);
  const rows=pageIds.map(id=>pageRows.find(r=>r.id===id)!).map(r=>({...resultView(r,user),studentName:studentNames.get(r.studentId)??r.studentId}));
  const day=today(timezone),soon=new Date(`${day}T00:00:00Z`);soon.setUTCDate(soon.getUTCDate()+7);
  const access={active:0,expired:0,disabled:0,upcoming:0,expiring:0};
  for(const s of students){if(!s.user.enabled)access.disabled++;else if(s.expiryDate<day)access.expired++;else if(s.startDate>day)access.upcoming++;else{access.active++;if(s.expiryDate<=soon.toISOString().slice(0,10))access.expiring++;}}
  const assigned=new Map<string,number>();for(const s of students)if(s.trainerId)assigned.set(s.trainerId,(assigned.get(s.trainerId)??0)+1);
  const pending=new Map((agg!.pending??[]).map(p=>[p.id,p.pending])),completed=new Map((agg!.completed??[]).map(c=>[c.id,c]));
  const workload=trainers.filter(t=>!q.trainerId||q.trainerId===t.id).map(t=>({id:t.id,name:t.name,assigned:assigned.get(t.id)??0,pending:pending.get(t.id)??0,completed:completed.get(t.id)?.completed??0,turnaroundHours:completed.get(t.id)?.turnaroundHours??null}));
  const moduleBands=["Listening","Reading","Writing","Speaking"].map(module=>agg!.moduleBands?.find(m=>m.module===module)??{module,count:0,average:null});
  const attemptWhere:Prisma.AttemptWhereInput={student:studentWhere,...(q.course?{course:q.course}:{}),...(q.kind?{kind:q.kind}:{}),...(q.testId?{testId:q.testId}:{}),...(q.from||q.to?{createdAt:{...(q.from?{gte:zonedDay(q.from,timezone).start}:{}),...(q.to?{lte:zonedDay(q.to,timezone).end}:{})}}:{})};
  const [starts,submitted]=await Promise.all([db.attempt.count({where:attemptWhere}),db.attempt.count({where:{...attemptWhere,state:"SUBMITTED"}})]);
  return {count:total,page:q.page,limit:q.limit,results:rows,summary:{starts,submitted,inProgress:starts-submitted,averageBand:agg!.averageBand,access},moduleBands,byCourse:agg!.byCourse??[],byKind:agg!.byKind??[],questionTypes:agg!.questionTypes??[],workload};
}
