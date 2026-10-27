import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Db } from "./db.js";
import { json, transaction, Prisma, retryableTransactionError } from "./db.js";
import type { Config } from "./config.js";
import { authenticate, active, admin, audit, digest, hashPassword, notify, sessionFor, staff, studentOnly, throttle, verifyPassword, type Authenticated } from "./auth.js";
import { assert, ApiError, course, defaultSettings, heartbeatSchema, identifier, password, questionSchema, settingsSchema, roundBand } from "./domain.js";
import { bootstrap, publicQuestion, resultView, userView } from "./views.js";
import { owned, resumeAttempt, signal, startPractice, startTest } from "./attempts.js";
import { claim, evaluate, evaluationSchema, release } from "./evaluation.js";
import { saveQuestion, saveTest, testSchema } from "./content.js";
import { saveStudent, saveTrainer, studentSchema, trainerSchema } from "./accounts.js";
import { confirmImport, csvExport, previewImport } from "./imports.js";
import {institution,platformSettings} from "./settings.js";
import {reports,reportQuery} from "./reports.js";
import { Storage } from "./storage.js";
declare module "fastify" { interface FastifyRequest { auth?:Authenticated; } }
export async function buildApp(db:Db,config:Config) {
  const app=Fastify({logger:config.NODE_ENV!=="test"?{redact:["req.headers.cookie","req.headers.authorization","res.headers.set-cookie"]}:false,bodyLimit:1024*1024,requestTimeout:30000});
  app.addHook("onSend",async(req,reply,payload)=>{
    if(req.url.startsWith("/api/"))reply.header("Cache-Control","no-store");
    return payload;
  });
  await app.register(cookie);
  await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:",...(config.S3_ENDPOINT?[new URL(config.S3_ENDPOINT).origin]:[])],mediaSrc:["'self'","https:",...(config.S3_ENDPOINT?[new URL(config.S3_ENDPOINT).origin]:[])],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}}});
  await app.register(multipart,{limits:{files:1,fileSize:20*1024*1024,fields:4,parts:5}});
  const storage=new Storage(config);
  app.addHook("onClose",async()=>storage.close());
  const unknownAccountHash=await hashPassword("dummy-account-timing-value");
  const user=(req:any)=>req.auth!.user as Authenticated["user"];
  app.addHook("onRequest",async req=>{
    if(!req.url.startsWith("/api/")||["/api/health","/api/institution"].includes(req.url.split("?")[0]!)||req.url==="/api/auth/login")return;
    req.auth=await authenticate(db,req,config,["/api/auth/me","/api/auth/logout"].includes(req.url));
    if(req.method!=="GET")await throttle(db,`action:${req.auth.user.id}`,300,60);
  });
  app.setErrorHandler((error,req,reply)=>{
    if(retryableTransactionError(error))return reply.code(409).send({message:"This record changed during saving. Reload and try again"});
    if(error instanceof z.ZodError)return reply.code(400).send({message:"Check the submitted fields",issues:error.issues.map(i=>({path:i.path.join("."),message:i.message}))});
    if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2025","P2034"].includes(error.code))return reply.code(409).send({message:"The record changed or this identifier is already in use. Refresh and try again"});
    if(error instanceof ApiError)return reply.code(error.statusCode).send({message:error.message});
    const status=(error as any).statusCode;
    if(status&&status<500)return reply.code(status).send({message:error instanceof Error?error.message:"Request failed"});
    req.log.error({err:{name:error instanceof Error?error.name:"Error",code:(error as any).code}},"Request failed");
    return reply.code(500).send({message:"The operation could not be completed. Please try again"});
  });
  app.get("/api/institution",async()=>institution(db));
  app.get("/api/health",async()=>{await db.$queryRaw`SELECT 1`;return {status:"ok"};});
  app.post("/api/auth/login",async(req,reply)=>{
    assert(req.headers.origin===config.APP_ORIGIN,403,"Request origin is not permitted");
    const input=z.object({role:z.enum(["student","trainer","admin"]),identifier:z.string().trim().min(1).max(200),password:z.string().min(1).max(128)}).strict().parse(req.body);
    await throttle(db,`login-ip:${req.ip}`,30,900);await throttle(db,`login-account:${digest(input.identifier.toLowerCase())}`,12,900);
    const u=await db.user.findFirst({where:{OR:[{id:input.identifier},{email:input.identifier.toLowerCase()}]},include:{student:true}});
    // Equalize unknown-account password work without logging or retaining credentials.
    const valid=await verifyPassword(input.password,u?.passwordHash??unknownAccountHash);
    assert(u&&valid&&u.enabled&&u.role.toLowerCase()===input.role,401,"The ID or password is incorrect");
    const session=await sessionFor(db,u,config);
    reply.setCookie("kanan_session",session.token,{httpOnly:true,secure:config.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:config.SESSION_HOURS*3600});
    await audit(db,u.id,"Signed in",u.id);
    return {user:userView(u,config),csrfToken:session.csrfToken};
  });
  app.get("/api/auth/me",async req=>({user:userView(user(req),config),csrfToken:req.auth!.csrfToken}));
  app.post("/api/auth/logout",async(req,reply)=>{await db.session.deleteMany({where:{tokenHash:req.auth!.tokenHash}});reply.clearCookie("kanan_session",{path:"/"});return {ok:true};});
  app.get("/api/bootstrap",async req=>{const q=z.object({offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(500).default(500)}).parse(req.query);return bootstrap(db,user(req),q.offset,q.limit);});
  app.put("/api/admin/students/:id",async req=>{const b=studentSchema.parse(req.body);assert(b.id===(req.params as any).id,400,"Student ID mismatch");return saveStudent(db,user(req),b);});
  app.put("/api/admin/trainers/:id",async req=>{const b=trainerSchema.parse(req.body);assert(b.id===(req.params as any).id,400,"Trainer ID mismatch");return saveTrainer(db,user(req),b);});
  app.post("/api/admin/users/:id/password",async req=>{
    const u=user(req);admin(u);const input=z.object({password}).strict().parse(req.body);const id=identifier.parse((req.params as any).id);
    await transaction(db,async tx=>{const target=await tx.user.findUnique({where:{id}});assert(target,404,"Account not found");await tx.user.update({where:{id},data:{passwordHash:await hashPassword(input.password),authVersion:{increment:1}}});await audit(tx,u.id,"Password reset",id);});return {ok:true};
  });
  app.put("/api/admin/questions/:id",async req=>{const b=questionSchema.parse(req.body);assert(b.id===(req.params as any).id,400,"Question ID mismatch");return publicQuestion(await saveQuestion(db,user(req),b),true);});
  app.put("/api/admin/tests/:course/:id",async req=>{const b=testSchema.parse(req.body);assert(b.id===(req.params as any).id&&b.course===(req.params as any).course,400,"Test identifier mismatch");return saveTest(db,user(req),b);});
  app.put("/api/admin/settings",async req=>{const u=user(req);admin(u);const value=settingsSchema.parse(req.body);await transaction(db,async tx=>{await tx.platformSetting.upsert({where:{id:"platform"},create:{id:"platform",value},update:{value,version:{increment:1}}});await audit(tx,u.id,"Settings updated","platform");});return value;});
  app.post("/api/tests/:course/:id/start",async req=>startTest(db,user(req),course.parse((req.params as any).course),identifier.parse((req.params as any).id)));
  app.post("/api/practice/start",async req=>startPractice(db,user(req),z.object({skill:z.enum(["Listening","Reading","Writing"]),mode:z.enum(["type","section"]),selection:z.string().trim().min(1).max(100),questionId:identifier.optional()}).strict().parse(req.body)));
  app.get("/api/attempts/:id",async req=>{const a=await owned(db,user(req),(req.params as any).id);if(user(req).role!=="STUDENT")staff(user(req));return resumeAttempt(db,user(req),a.id);});
  app.post("/api/attempts/:id/heartbeat",async req=>signal(db,user(req),(req.params as any).id,heartbeatSchema.parse(req.body)));
  app.post("/api/attempts/:id/submit",async req=>signal(db,user(req),(req.params as any).id,heartbeatSchema.parse(req.body),true));
  app.get("/api/results/:id",async req=>{
    const u=user(req);const r=await db.result.findUnique({where:{id:(req.params as any).id},include:{revisions:u.role!=="STUDENT",jobs:{where:{state:"COMPLETED"}},attempt:true}});
    assert(r&&(u.role!=="STUDENT"||(r.studentId===u.id&&r.course===u.student?.course&&(r.kind!=="FLT"||r.released))),404,"Result not found");
    const dto=resultView(r,u);assert(dto.visible,409,"Scoring is not complete");
    return {...dto,responses:r.attempt.answers,questions:(r.attempt.snapshot as any).questions.map((q:any)=>publicQuestion(q,true))};
  });
  app.post("/api/results/:id/claim",async req=>claim(db,user(req),(req.params as any).id));
  app.put("/api/results/:id/evaluation",async req=>evaluate(db,user(req),(req.params as any).id,evaluationSchema.parse(req.body)));
  app.post("/api/results/release",async req=>release(db,user(req),z.object({ids:z.array(z.string().uuid()).min(1).max(500)}).strict().parse(req.body).ids));
  app.post("/api/results/:id/retry-ai",async req=>{
    const u=user(req);staff(u);assert(config.OPENAI_API_KEY&&config.OPENAI_MODEL,503,"Writing AI is not configured; manual evaluation is available");
    const id=z.string().uuid().parse((req.params as any).id);await throttle(db,`ai-retry:${u.id}`,10,3600);
    await transaction(db,async tx=>{const target=await tx.result.findUnique({where:{id},include:{attempt:{select:{snapshot:true}}}});assert(target,404,"Result not found");assert((target.attempt.snapshot as any).questions.some((q:any)=>q.skill==="Writing"),400,"This assessment has no Writing submission");const pending=await tx.evaluationJob.findFirst({where:{resultId:id,state:{in:["PENDING","RUNNING"]}}});assert(!pending,409,"Writing evaluation is already queued");await tx.evaluationJob.create({data:{resultId:id}});await tx.result.update({where:{id},data:{aiStatus:"Pending",version:{increment:1}}});await audit(tx,u.id,"Writing AI retry queued",id);});return {queued:true};
  });
  app.post("/api/notifications/read-all",async req=>{const result=await db.notification.updateMany({where:{userId:user(req).id,read:false},data:{read:true}});return {count:result.count};});
  app.post("/api/notifications/:id/read",async req=>{await db.notification.updateMany({where:{id:(req.params as any).id,userId:user(req).id},data:{read:true}});return {ok:true};});
  app.post("/api/admin/announcements",async req=>{const u=user(req);admin(u);const b=z.object({title:z.string().trim().min(1).max(300),role:z.enum(["STUDENT","TRAINER"]),course:course.optional()}).strict().parse(req.body);assert(b.role==="STUDENT"||!b.course,400,"Course filters apply to Students");const count=await transaction(db,async tx=>{const users=await tx.user.findMany({where:{role:b.role,enabled:true,...(b.course?{student:{course:b.course}}:{})},select:{id:true}});for(const to of users)await notify(tx,to.id,b.title,`/${b.role.toLowerCase()}/notifications`);await audit(tx,u.id,"Announcement sent",b.role,{count:users.length,course:b.course??"both"});return users.length;});return {ok:true,count};});
  app.post("/api/admin/imports/:kind",async req=>{admin(user(req));const part=await req.file();assert(part,400,"Choose a file");return previewImport(db,user(req),(req.params as any).kind,await part.toBuffer(),part.filename);});
  app.post("/api/admin/imports/:id/confirm",async req=>confirmImport(db,user(req),(req.params as any).id));
  app.get("/api/admin/imports/:id/errors",async(req,reply)=>{admin(user(req));const batch=await db.importBatch.findFirst({where:{id:(req.params as any).id,actorId:user(req).id}});assert(batch,404,"Import not found");const rows=batch.rows as any[];reply.header("Content-Disposition",'attachment; filename="import-errors.csv"').type("text/csv; charset=utf-8");return csvExport([["Row","Error"],...rows.filter(r=>r.error).map(r=>[String(r.row),r.error])]);});
  app.get("/api/admin/assets",async req=>{admin(user(req));const q=z.object({search:z.string().max(200).default(""),page:z.coerce.number().int().min(1).default(1)}).parse(req.query);const where={filename:{contains:q.search,mode:"insensitive" as const}};const [count,rows]=await Promise.all([db.asset.count({where}),db.asset.findMany({where,select:{id:true,filename:true,contentType:true,size:true,createdAt:true},orderBy:{createdAt:"desc"},take:25,skip:(q.page-1)*25})]);return {count,rows};});
  app.post("/api/admin/assets",async req=>{admin(user(req));const part=await req.file();assert(part,400,"Choose a media file");return storage.upload(db,user(req),part.filename,await part.toBuffer());});
  app.get("/api/assets/:id/url",async req=>{staff(user(req));return storage.readUrl(db,user(req),z.string().uuid().parse((req.params as any).id));});
  app.get("/api/assets/:id/stream",async(req,reply)=>{const object=await storage.stream(db,user(req),z.string().uuid().parse((req.params as any).id),req.headers.range);reply.type(object.ContentType??"application/octet-stream").header("Accept-Ranges","bytes").header("Cache-Control","private, no-store");if(object.ContentLength!==undefined)reply.header("Content-Length",object.ContentLength);if(object.ContentRange)reply.code(206).header("Content-Range",object.ContentRange);return reply.send(object.Body);});
  app.get("/api/leaderboard",async req=>{
    const u=user(req);studentOnly(u);const setting=await db.platformSetting.findUnique({where:{id:"platform"}});assert((setting?.value as any)?.leaderboard,404,"Leaderboard is disabled");
    const period=z.enum(["Weekly","Monthly","Overall"]).parse((req.query as any).period??"Weekly");const since=new Date(Date.now()-(period==="Weekly"?7:period==="Monthly"?30:36500)*86400000);
    const rows=await db.result.findMany({where:{course:u.student.course,date:{gte:since},overall:{not:null},OR:[{kind:"FLT",released:true},{kind:"PRACTICE_MOCK",writing:{not:null},listening:{not:null},reading:{not:null}}]},orderBy:{date:"desc"},take:10000});
    const latest=new Map<string,typeof rows[number]>();for(const r of rows){const key=`${r.studentId}/${r.testId}`;if(!latest.has(key))latest.set(key,r);}
    const groups=new Map<string,number[]>();for(const r of latest.values()){const values=groups.get(r.studentId)??[];values.push(r.overall!);groups.set(r.studentId,values);}
    const people=await db.user.findMany({where:{id:{in:[...groups.keys()]}},select:{id:true,name:true}});
    return [...groups].map(([id,bands])=>{const names=people.find(p=>p.id===id)!.name.split(/\s+/);return {name:`${names[0]} ${names.at(-1)?.[0]??""}.`,band:roundBand(bands.reduce((a,b)=>a+b,0)/bands.length),completed:bands.length};}).sort((a,b)=>b.band-a.band||a.name.localeCompare(b.name)).slice(0,100);
  });
  app.get("/api/reports",async req=>reports(db,user(req),reportQuery.parse(req.query)));
  app.get("/api/reports/export",async(req,reply)=>{const result=await reports(db,user(req),reportQuery.parse(req.query),true);return reply.header("Content-Disposition",'attachment; filename="academic-report.csv"').type("text/csv; charset=utf-8").send(result);});
  app.get("/api/admin/operations",async req=>{
    admin(user(req));const [failedJobs,pendingJobs,flagged,unreviewed,settings]=await Promise.all([db.evaluationJob.count({where:{state:"FAILED"}}),db.evaluationJob.count({where:{state:{in:["PENDING","RUNNING"]}}}),db.attempt.count({where:{flagged:true}}),db.attempt.count({where:{flagged:true,reviewedAt:null}}),platformSettings(db)]);
    return {failedJobs,pendingJobs,flagged,unreviewed,storageConfigured:!!config.S3_BUCKET,writingConfigured:!!config.OPENAI_API_KEY&&!!config.OPENAI_MODEL,autoWritingEvaluation:settings.autoWritingEvaluation};
  });
  app.get("/api/admin/attempts",async req=>{
    admin(user(req));const q=z.object({page:z.coerce.number().int().min(1).default(1),course:course.optional(),studentId:z.string().max(80).optional(),filter:z.enum(["all","flagged","unreviewed","in-progress"]).default("unreviewed")}).parse(req.query);
    const where={...(q.course?{course:q.course}:{}),...(q.studentId?{studentId:q.studentId}:{}),...(q.filter==="flagged"||q.filter==="unreviewed"?{flagged:true}:{}),...(q.filter==="unreviewed"?{reviewedAt:null}:{}),...(q.filter==="in-progress"?{state:"IN_PROGRESS" as const}:{})};
    const [count,rows]=await Promise.all([db.attempt.count({where}),db.attempt.findMany({where,orderBy:{createdAt:"desc"},skip:(q.page-1)*25,take:25,select:{id:true,studentId:true,course:true,testId:true,kind:true,state:true,interruptions:true,flagged:true,reviewedAt:true,reviewerId:true,reviewRemarks:true,remainingMs:true,createdAt:true,submittedAt:true,logs:{orderBy:{at:"asc"}},student:{select:{user:{select:{name:true}}}}}})]);return {count,page:q.page,rows};
  });
  app.post("/api/admin/attempts/:id/review",async req=>{const u=user(req);admin(u);const b=z.object({remarks:z.string().trim().min(1).max(2000)}).strict().parse(req.body);const id=z.string().uuid().parse((req.params as any).id);await transaction(db,async tx=>{const a=await tx.attempt.findUnique({where:{id}});assert(a?.flagged,404,"Flagged attempt not found");await tx.attempt.update({where:{id},data:{reviewedAt:new Date(),reviewerId:u.id,reviewRemarks:b.remarks}});await audit(tx,u.id,"Interruption review completed",id,{previousRemarks:a.reviewRemarks,remarks:b.remarks,interruptions:a.interruptions});});return {ok:true};});
  app.get("/api/admin/audit",async req=>{admin(user(req));const q=z.object({search:z.string().max(200).default(""),page:z.coerce.number().int().min(1).default(1)}).parse(req.query);const where={OR:[{action:{contains:q.search,mode:"insensitive" as const}},{target:{contains:q.search,mode:"insensitive" as const}},{actorId:{contains:q.search,mode:"insensitive" as const}}]};const [count,rows]=await Promise.all([db.auditLog.count({where}),db.auditLog.findMany({where,orderBy:{at:"desc"},take:25,skip:(q.page-1)*25})]);return {count,rows};});
  app.post("/api/admin/results/release-scope",async req=>{const u=user(req);admin(u);const b=z.object({course,testId:z.string().max(80).optional()}).strict().parse(req.body);let count=0;for(;;){const rows=await db.result.findMany({where:{course:b.course,...(b.testId?{testId:b.testId}:{}),kind:"FLT",released:false,reviewStatus:"Completed",listening:{not:null},reading:{not:null},writing:{not:null}},select:{id:true},take:100});if(!rows.length)break;const batch=await release(db,u,rows.map(r=>r.id));count+=batch.released.length;if(!batch.released.length)break;}return {count};});
  const dist=resolve(process.cwd(),"../frontend/dist");
  if(config.NODE_ENV==="production"&&existsSync(dist)) {
    await app.register(staticFiles,{root:dist,wildcard:false});
    app.setNotFoundHandler((req,reply)=>req.url.startsWith("/api/")?reply.code(404).send({message:"API route not found"}):reply.sendFile("index.html"));
  }
  return app;
}
