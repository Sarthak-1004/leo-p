import {validatePracticePack,installPracticePack} from "../src/practice-pack.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID,randomBytes,scryptSync } from "node:crypto";
import {createServer} from "node:http";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import ExcelJS from "exceljs";
import sharp from "sharp";
import {Secret,TOTP} from "otpauth";
import {encryptMfa,resetStaffMfa} from "../src/mfa.js";
import { database, json, type Db } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { defaultConversions, defaultSettings } from "../src/domain.js";
import { hashPassword,sessionFor } from "../src/auth.js";
import { parseImport,previewImport,confirmImport,csvExport } from "../src/imports.js";
import {maintain} from "../src/maintenance.js";
import {today} from "../src/domain.js";
import { writingInput, runWritingJob } from "../src/worker.js";
let db:Db, app:Awaited<ReturnType<typeof buildApp>>, pg:EmbeddedPostgres;
const secret=`Test-only-${randomUUID()}`;
const dbName=`kanan_test_${randomUUID().replaceAll("-","")}`;
const origin="http://localhost:5173";
const identities=new Map<string,{cookie:string;csrf:string}>();
const testMfaKey=Buffer.alloc(32,11).toString("base64"),otpSeeds=new Map<string,string>();
let testNumber=1;
before(async()=>{
  mkdirSync(resolve(".test-data"),{recursive:true});
  const dir=resolve(".test-data/postgres");
  pg=new EmbeddedPostgres({databaseDir:dir,user:"test_runner",password:"test-runtime-only",port:55433,persistent:true,authMethod:"scram-sha-256",postgresFlags:["-h","127.0.0.1","-c","io_method=sync"],onLog:()=>{},onError:()=>{}});
  if(!existsSync(resolve(dir,"PG_VERSION")))await pg.initialise();await pg.start();await pg.createDatabase(dbName);
  const client=pg.getPgClient(dbName);await client.connect();for(const folder of readdirSync("prisma/migrations").filter(p=>/^\d/.test(p)).sort())await client.query(readFileSync(`prisma/migrations/${folder}/migration.sql`,"utf8"));await client.end();
  const url=`postgresql://test_runner:test-runtime-only@127.0.0.1:55433/${dbName}`;
  db=database(url);
  const hash=await hashPassword(secret);
  for(const [id,role] of [["admin","ADMIN"],["trainer","TRAINER"],["s1","STUDENT"],["s2","STUDENT"],["academic","STUDENT"],["expired","STUDENT"]] as const) {
    const seed=new Secret({size:20}).base32;otpSeeds.set(id,seed);
    await db.user.create({data:{id,role,name:id,passwordHash:hash,email:role==="TRAINER"?"trainer@example.test":null,...(role!=="STUDENT"?{mfaSecret:encryptMfa(seed,id,loadConfig({DATABASE_URL:url,MFA_ENCRYPTION_KEY:testMfaKey})),mfaVersion:1}:{})}});
    if(role==="STUDENT")await db.student.create({data:{id,course:id==="academic"?"ACADEMIC":"GENERAL",startDate:"2020-01-01",expiryDate:id==="expired"?"2020-01-02":"2099-01-01",trainerId:"trainer",contacts:{create:{phone:"private-phone",email:"private-email",address:"private-address",guardianContact:"private-guardian"}}}});
  }
  await db.platformSetting.create({data:{id:"platform",value:defaultSettings}});
  app=await buildApp(db,loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:url,APP_ORIGIN:origin}));await app.ready();
  for(const id of ["admin","trainer","s1","s2","academic","expired"]) {
    let r=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:id==="admin"?"admin":id==="trainer"?"trainer":"student",identifier:id,password:secret}});
    assert.equal(r.statusCode,200,r.body);
    if(id==="admin"||id==="trainer"){const cookie=r.cookies.find(c=>c.name==="kanan_mfa")!;r=await app.inject({method:"POST",url:"/api/auth/mfa/verify",headers:{origin,cookie:`kanan_mfa=${cookie.value}`,"x-csrf-token":r.json().csrfToken},payload:{code:new TOTP({secret:Secret.fromBase32(otpSeeds.get(id)!)}).generate()}});assert.equal(r.statusCode,200,r.body);}
    const cookie=r.cookies.find(c=>c.name==="kanan_session"&&c.value)!;identities.set(id,{cookie:`kanan_session=${cookie.value}`,csrf:r.json().csrfToken});
  }
});
after(async()=>{await app?.close();await db?.$disconnect();if(pg){await pg.dropDatabase(dbName);await pg.stop();}});
function call(id:string,method:any,url:string,payload?:unknown,headers:Record<string,string>={}) {
  const auth=identities.get(id)!;return app.inject({method,url,headers:{cookie:auth.cookie,origin,"x-csrf-token":auth.csrf,...headers},payload:payload as any});
}
async function fixture(kind:"FLT"|"PRACTICE_MOCK"="PRACTICE_MOCK") {
  const n=testNumber++,id=`fixture-${n}`;
  const questions=[];
  for(const skill of ["Listening","Reading"] as const)for(let i=0;i<40;i++)questions.push(await db.question.create({data:{id:`${id}-${skill}-${i}`,skill,course:"GENERAL",questionType:"Multiple choice",section:"Part 1",title:"Question",prompt:`Question ${i+1}`,options:["yes","no"],answer:"yes",published:true}}));
  for(const task of ["Task 1","Task 2"])questions.push(await db.question.create({data:{id:`${id}-${task.replaceAll(" ","")}`,skill:"Writing",course:"GENERAL",questionType:task,section:task,title:task,prompt:"Write an essay",options:[],answer:"",published:true}}));
  await db.test.create({data:{id,course:"GENERAL",kind,number:n,title:id,published:true,available:kind==="FLT",duration:150,builder:json({questionIds:{Listening:questions.filter(q=>q.skill==="Listening").map(q=>q.id),Reading:questions.filter(q=>q.skill==="Reading").map(q=>q.id),Writing:questions.filter(q=>q.skill==="Writing").map(q=>q.id),Speaking:[]},duration:{Listening:30,Reading:60,Writing:60,Speaking:0}}),conversions:json(defaultConversions)}});
  return {id,questions};
}
function payload(a:any,answers:Record<string,string>={}) {return {sessionKey:a.sessionKey,sequence:a.sequence+1,answers,section:0,question:0,theme:"standard",fontSize:"standard"};}
async function submitted(kind:"FLT"|"PRACTICE_MOCK"="FLT") {
  const f=await fixture(kind);const started=await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`);assert.equal(started.statusCode,200,started.body);
  let a=started.json();const answers:Record<string,string>={};
  for(const [section,skill] of ["Listening","Reading","Writing"].entries()){
    for(const q of f.questions.filter(q=>q.skill===skill&&skill!=="Writing"))answers[`${q.skill}:${q.id}`]="yes";
    const sent=await call("s1","POST",`/api/attempts/${a.id}/${section===2?"submit":"heartbeat"}`,{...payload(a,answers),section,completeSection:section<2});assert.equal(sent.statusCode,200,sent.body);a=sent.json().attempt;
  }
  return a.id as string;
}
test("transport request limiting covers anonymous requests and does not trust forwarded identity",async()=>{
  const first=await app.inject({url:"/api/bootstrap"});
  const forged=await app.inject({url:"/api/bootstrap",headers:{"x-forwarded-for":"198.51.100.250","x-real-ip":"198.51.100.251"}});
  assert.equal(first.statusCode,401);assert.equal(forged.statusCode,401);
  assert.equal(Number(first.headers["x-ratelimit-limit"]),30000);
  assert.equal(Number(forged.headers["x-ratelimit-remaining"]),Number(first.headers["x-ratelimit-remaining"])-1);
});
test("unauthenticated, wrong-role, CSRF and origin requests are rejected",async()=>{
  const anonymous=await app.inject({url:"/api/bootstrap"});assert.equal(anonymous.statusCode,401);assert.equal(anonymous.headers["cache-control"],"no-store");
  assert.equal((await call("admin","GET","/api/bootstrap")).headers["cache-control"],"no-store");
  assert.equal((await call("trainer","PUT","/api/admin/settings",defaultSettings)).statusCode,403);
  assert.equal((await call("admin","PUT","/api/admin/settings",defaultSettings,{"x-csrf-token":"wrong"})).statusCode,403);
  assert.equal((await call("admin","PUT","/api/admin/settings",defaultSettings,{origin:"https://attacker.invalid"})).statusCode,403);
});
test("Trainer response never contains contacts; Admin projection does",async()=>{
  const trainer=await call("trainer","GET","/api/bootstrap");assert.equal(trainer.statusCode,200,trainer.body);
  assert.ok(!trainer.body.includes("private-"));assert.equal(trainer.json().students.length,4);
  const admin=await call("admin","GET","/api/bootstrap");assert.ok(admin.body.includes("private-phone"));
});
test("expired students can inspect session identity but cannot read protected data",async()=>{
  assert.equal((await call("expired","GET","/api/auth/me")).statusCode,200);
  assert.equal((await call("expired","GET","/api/bootstrap")).statusCode,403);
});
test("course isolation and publication/availability are enforced on server",async()=>{
  const f=await fixture("FLT");
  assert.equal((await call("academic","POST",`/api/tests/GENERAL/${f.id}/start`)).statusCode,403);
  await db.test.update({where:{course_id:{course:"GENERAL",id:f.id}},data:{published:false}});
  assert.equal((await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).statusCode,403);
  await db.test.update({where:{course_id:{course:"GENERAL",id:f.id}},data:{published:true,available:false}});
  assert.equal((await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).statusCode,403);
});
test("concurrent FLT starts return the same attempt, then prevent retake",async()=>{
  const f=await fixture("FLT");const r=await Promise.all(Array.from({length:6},()=>call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)));
  r.forEach(x=>assert.equal(x.statusCode,200,x.body));assert.equal(new Set(r.map(x=>x.json().id)).size,1);assert.equal(await db.attempt.count({where:{testId:f.id}}),1);
  assert.equal((await call("s1","POST",`/api/attempts/${r[0]!.json().id}/submit`,payload(r[0]!.json()))).statusCode,200);
  assert.equal((await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).statusCode,409);
});
test("Practice Mocks allow two starts and do not need availability unlock",async()=>{
  const f=await fixture();await db.test.update({where:{course_id:{course:"GENERAL",id:f.id}},data:{available:false}});
  for(let n=1;n<=2;n++){const r=await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`);assert.equal(r.statusCode,200,r.body);assert.equal(r.json().number,n);assert.equal((await call("s1","POST",`/api/attempts/${r.json().id}/submit`,payload(r.json()))).statusCode,200);}
  assert.equal((await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).statusCode,409);
});
test("answers and display preferences persist, duplicate signals are safe, other owners are rejected",async()=>{
  const f=await fixture();const a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();
  assert.ok(!JSON.stringify(a).includes('"answer":'));const input={...payload(a,{[`Listening:${f.questions[0]!.id}`]:"yes"}),theme:"yellow",fontSize:"extra-large"};
  assert.equal((await call("s2","POST",`/api/attempts/${a.id}/heartbeat`,input)).statusCode,404);
  assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,input)).statusCode,200);
  assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,input)).json().duplicate,true);
  assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...input,answers:{[`Listening:${f.questions[0]!.id}`]:"no"}})).statusCode,409);
  const restored=(await call("s1","GET",`/api/attempts/${a.id}`)).json();assert.equal(restored.theme,"yellow");assert.deepEqual(restored.answers,input.answers);
  assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...input,sequence:3,answers:{unknown:"answer"}})).statusCode,409);
});
test("disconnected gaps do not consume time and the fourth interruption is flagged",async()=>{
  const f=await fixture();let a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();
  const before=(await db.attempt.findUniqueOrThrow({where:{id:a.id}})).remainingMs;
  for(let n=1;n<=4;n++){await db.attempt.update({where:{id:a.id},data:{lastSignalAt:new Date(Date.now()-60000)}});const r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,payload(a));assert.equal(r.statusCode,200,r.body);a=r.json().attempt;assert.equal(a.flagged,n>3);}
  assert.equal((await db.attempt.findUniqueOrThrow({where:{id:a.id}})).remainingMs,before);assert.equal(await db.attemptLog.count({where:{attemptId:a.id,event:"RESUME"}}),4);
});
test("unreleased scores are absent from student bootstrap and direct results",async()=>{
  const id=await submitted();assert.equal((await call("s1","GET",`/api/results/${id}`)).statusCode,404);
  const row=(await call("s1","GET","/api/bootstrap")).json().results.find((r:any)=>r.id===id);assert.equal(row.listening,null);assert.equal(row.overall,null);assert.equal(row.visible,false);
  assert.equal((await call("s2","GET",`/api/results/${id}`)).statusCode,404);
});
test("remarks, draft isolation, optimistic edits, Admin release and Speaking updates",async()=>{
  const id=await submitted();let r=await db.result.findUniqueOrThrow({where:{id}});
  const input={version:r.version,listening:9,reading:9,writing:6.5,remarks:"",completed:true};
  assert.equal((await call("trainer","PUT",`/api/results/${id}/evaluation`,input)).statusCode,400);
  let response=await call("trainer","PUT",`/api/results/${id}/evaluation`,{...input,draft:true,remarks:"Reviewed Writing"});assert.equal(response.statusCode,200,response.body);
  r=await db.result.findUniqueOrThrow({where:{id}});assert.equal(r.writing,null);
  assert.equal((await call("trainer","PUT",`/api/results/${id}/evaluation`,{...input,version:r.version,remarks:"Reviewed Writing"})).statusCode,200);
  assert.equal((await call("trainer","PUT",`/api/results/${id}/evaluation`,{...input,version:r.version,remarks:"Stale edit"})).statusCode,409);
  assert.equal((await call("trainer","POST","/api/results/release",{ids:[id]})).statusCode,403);
  assert.deepEqual((await call("admin","POST","/api/results/release",{ids:[id]})).json().released,[id]);
  assert.equal((await call("s1","GET",`/api/results/${id}`)).json().speaking,null);
  r=await db.result.findUniqueOrThrow({where:{id}});
  response=await call("trainer","PUT",`/api/results/${id}/evaluation`,{...input,version:r.version,remarks:"Offline Speaking assessed",speakingCriteria:{fluency:7,lexical:7,grammar:7,pronunciation:7},speakingDate:"2026-10-27"});assert.equal(response.statusCode,200,response.body);
  const visible=(await call("s1","GET",`/api/results/${id}`)).json();assert.equal(visible.speaking,7);assert.equal(visible.overall,8);
  assert.ok((await call("s1","GET","/api/bootstrap")).json().notifications.some((n:any)=>n.title.includes("Speaking score has been added")));
  assert.equal(await db.scoreRevision.count({where:{resultId:id}}),2);
});
test("AI failure retains answers and permits manual evaluation",async()=>{
  const id=await submitted();await runWritingJob(db,loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:"postgresql://unused"}));
  assert.ok(await db.attempt.findUnique({where:{id}}));
  const configured=await call("trainer","POST",`/api/results/${id}/retry-ai`);assert.equal(configured.statusCode,503);
});
test("XLSX parsing accepts values and rejects formula cells",async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Assignments");sheet.addRow(["Student ID","Teacher ID","Course"]);sheet.addRow(["s1","trainer","GENERAL"]);
  const buffer=Buffer.from(await workbook.xlsx.writeBuffer());assert.equal((await parseImport(buffer,"assignment.xlsx"))[0]!["Student ID"],"s1");
  sheet.getCell("A2").value={formula:'"s1"',result:"s1"};await assert.rejects(async()=>parseImport(Buffer.from(await workbook.xlsx.writeBuffer()),"assignment.xlsx"));
});
test("password reset revokes prior sessions and students cannot reset credentials",async()=>{
  const id="reset-student",hash=await hashPassword(secret);
  await db.user.create({data:{id,role:"STUDENT",name:"Reset target",passwordHash:hash,student:{create:{course:"GENERAL",startDate:"2020-01-01",expiryDate:"2099-01-01"}}}});
  const login=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:"student",identifier:id,password:secret}});
  const oldCookie=login.cookies[0]!.name+"="+login.cookies[0]!.value;
  assert.equal((await call("s1","POST",`/api/admin/users/${id}/password`,{password:"Another-test-password"})).statusCode,403);
  assert.equal((await call("admin","POST",`/api/admin/users/${id}/password`,{password:"Another-test-password"})).statusCode,200);
  assert.equal((await app.inject({url:"/api/bootstrap",headers:{cookie:oldCookie}})).statusCode,401);
  const stored=await db.user.findUniqueOrThrow({where:{id}});assert.ok(!stored.passwordHash.includes("Another-test-password"));
});
test("CSV imports revalidate, report bad rows and confirm only once",async()=>{
  await db.user.create({data:{id:"trainer-2",name:"Second trainer",role:"TRAINER",passwordHash:await hashPassword(secret)}});
  const boundary="kanan-test-boundary";
  const csv="Student ID,Teacher ID,Course\r\ns2,trainer-2,GENERAL\r\nUNKNOWN,trainer-2,GENERAL\r\n";
  const body=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="assignments.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`);
  const response=await call("admin","POST","/api/admin/imports/assignments",body,{"content-type":`multipart/form-data; boundary=${boundary}`});
  assert.equal(response.statusCode,200,response.body);assert.equal(response.json().valid,1);assert.equal(response.json().failed,1);
  const id=response.json().id;
  const confirmed=await call("admin","POST",`/api/admin/imports/${id}/confirm`);assert.equal(confirmed.statusCode,200,confirmed.body);assert.equal(confirmed.json().success,1);assert.equal(confirmed.json().failed,1);
  assert.equal((await db.student.findUniqueOrThrow({where:{id:"s2"}})).trainerId,"trainer-2");
  assert.equal((await call("admin","POST",`/api/admin/imports/${id}/confirm`)).json().alreadyCommitted,true);
});
test("AI output is stored while a manual approved Writing band remains authoritative",async()=>{
  await db.evaluationJob.updateMany({where:{state:{in:["PENDING","RUNNING"]}},data:{state:"FAILED"}});
  const id=await submitted();const r=await db.result.findUniqueOrThrow({where:{id}});
  assert.equal((await call("trainer","PUT",`/api/results/${id}/evaluation`,{version:r.version,listening:9,reading:9,writing:7,remarks:"Manual reviewed score",completed:true})).statusCode,200);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify({tasks:["Task 1","Task 2"].map((task,i)=>({task,criteria:{taskAchievement:6+i*0.5,coherence:6+i*0.5,lexical:6+i*0.5,grammar:6+i*0.5},feedback:"Specific training feedback",strengths:["Clear ideas"],weaknesses:["Develop detail"],improvements:["Use supporting examples"],corrections:[]}))})}]}]}),{status:200,headers:{"content-type":"application/json"}});
  try{await runWritingJob(db,loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:"postgresql://unused",OPENAI_API_KEY:"test-provider-contract",OPENAI_MODEL:"configured-test-model"}));}finally{globalThis.fetch=originalFetch;}
  const saved=await db.result.findUniqueOrThrow({where:{id}});assert.equal(saved.writing,7);assert.equal((saved.originalScores as any).aiWriting,6.5);assert.equal(await db.evaluationJob.count({where:{resultId:id,state:"COMPLETED"}}),1);
});
test("audit records are immutable at database level",async()=>{
  const record=await db.auditLog.findFirstOrThrow();await assert.rejects(()=>db.auditLog.update({where:{id:record.id},data:{action:"tampered"}}));
});
test("test structures import as drafts without granting availability",async()=>{
  const user=await db.user.findUniqueOrThrow({where:{id:"admin"},include:{student:true}});
  const csv=csvExport([["id","course","kind","number","version","questionIds","durations"],["imported-practice","GENERAL","PRACTICE_MOCK","99","1",JSON.stringify({Listening:[],Reading:[],Writing:[],Speaking:[]}),JSON.stringify({Listening:30,Reading:60,Writing:60,Speaking:0})]]);
  const preview=await previewImport(db,user,"tests",Buffer.from(csv),"structures.csv");assert.equal(preview.valid,1);
  const outcome=await confirmImport(db,user,preview.id);assert.equal(outcome.success,1);
  const saved=await db.test.findUniqueOrThrow({where:{course_id:{course:"GENERAL",id:"imported-practice"}}});assert.equal(saved.published,false);assert.equal(saved.available,false);
});
test("expiry reminders are recipient-scoped and scheduled only once",async()=>{
  const now=new Date(),expiry=today("Asia/Kolkata",new Date(now.getTime()+7*86400000));
  await db.student.update({where:{id:"s2"},data:{expiryDate:expiry}});
  const config=loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:"postgresql://unused"});await maintain(db,config,now);await maintain(db,config,now);
  assert.equal(await db.notification.count({where:{userId:"s2",dedupeKey:{startsWith:"expiry/"}}}),1);
  await db.student.update({where:{id:"s2"},data:{expiryDate:"2099-01-01"}});
});
test("S3 adapter uploads permitted bytes and streams only entitled student media",async()=>{
  const objects=new Map<string,Buffer>();
  const server=createServer(async(req,res)=>{
    const key=req.url!.split("?")[0]!;
    if(req.method==="PUT"){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));objects.set(key,Buffer.concat(chunks));res.statusCode=200;res.end();return;}
    const data=objects.get(key);if(!data){res.statusCode=404;res.end();return;}
    res.setHeader("content-length",data.length);res.setHeader("content-type","image/png");res.statusCode=200;res.end(req.method==="HEAD"?undefined:data);
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const port=(server.address() as any).port;
  const mediaApp=await buildApp(db,loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:"postgresql://unused",APP_ORIGIN:origin,S3_ENDPOINT:`http://127.0.0.1:${port}`,S3_BUCKET:"test-private",S3_ACCESS_KEY_ID:"test-access",S3_SECRET_ACCESS_KEY:"test-secret"}));
  try{
    const auth=identities.get("admin")!,boundary="media-boundary";
    const png=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).png().toBuffer();
    const multipart=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="chart.png"\r\nContent-Type: image/png\r\n\r\n`),png,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const upload=await mediaApp.inject({method:"POST",url:"/api/admin/assets",headers:{cookie:auth.cookie,origin,"x-csrf-token":auth.csrf,"content-type":`multipart/form-data; boundary=${boundary}`},payload:multipart});assert.equal(upload.statusCode,200,upload.body);const id=upload.json().id;
    const student=identities.get("s1")!;
    assert.equal((await mediaApp.inject({url:`/api/assets/${id}/stream`,headers:{cookie:student.cookie}})).statusCode,404);
    await db.question.create({data:{id:`media-${randomUUID()}`,skill:"Reading",course:"GENERAL",questionType:"Matching",section:"Passage 1",title:"Chart",prompt:"Use this chart",passage:"Passage",options:[],answer:"yes",assetIds:[id],published:true,practiceEligible:true}});
    const download=await mediaApp.inject({url:`/api/assets/${id}/stream`,headers:{cookie:student.cookie}});assert.equal(download.statusCode,200,download.body);assert.deepEqual(download.rawPayload,png);
    assert.equal((await mediaApp.inject({url:`/api/assets/${id}/url`,headers:{cookie:student.cookie}})).statusCode,403);
    const providerConfig=loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:"postgresql://unused",S3_ENDPOINT:`http://127.0.0.1:${port}`,S3_BUCKET:"test-private",S3_ACCESS_KEY_ID:"test-access",S3_SECRET_ACCESS_KEY:"test-secret"});
    const request=await writingInput(db,providerConfig,"ACADEMIC",[{skill:"Writing",section:"Task 1",prompt:"Describe the chart",assetIds:[id]}],{"Writing:Task 1":"The chart shows growth."});assert.equal(request.tasks.length,1);assert.ok(request.input[0]!.content.some(c=>c.type==="input_image"&&c.image_url===`data:image/png;base64,${png.toString("base64")}`));
    assert.ok(!JSON.stringify(request).includes("test-secret"));
  }finally{await mediaApp.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});


test("section submission saves final answers, restores closed sections and advances without extra attempts",async()=>{
 const f=await fixture();let a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();
 const key=`Listening:${f.questions[0]!.id}`;const input={...payload(a,{[key]:"yes"}),completeSection:true};
 const response=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,input);assert.equal(response.statusCode,200,response.body);a=response.json().attempt;
 assert.deepEqual(a.submittedSections,["Listening"]);assert.equal(a.section,1);assert.equal(a.answers[key],"yes");assert.equal(a.remainingBySection.Listening,0);
 assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,input)).json().duplicate,true);
 const stale=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a,{[key]:"no"}),section:1});assert.equal(stale.statusCode,200,stale.body);a=stale.json().attempt;assert.equal(a.answers[key],"yes");
 assert.deepEqual((await call("s1","GET",`/api/attempts/${a.id}`)).json().submittedSections,["Listening"]);
 assert.equal(await db.attempt.count({where:{testId:f.id,studentId:"s1"}}),1);
 assert.equal(await db.attemptLog.count({where:{attemptId:a.id,event:"SECTION_SUBMIT:Listening"}}),1);
});

test("Writing practice selects one actual task with its timer and permits module-only manual review",async()=>{
 const id=`writing-practice-${randomUUID()}`;
 await db.question.create({data:{id,skill:"Writing",course:"GENERAL",title:"Task two",prompt:"Discuss public transport.",section:"Task 2",questionType:"Essay",options:[],answer:"",published:true,practiceEligible:true}});
 const response=await call("s1","POST","/api/practice/start",{skill:"Writing",mode:"type",selection:"Essay",questionId:id});assert.equal(response.statusCode,200,response.body);const a=response.json();assert.equal(a.questions.length,1);assert.equal(a.remainingSeconds,2400);
 const submitted=await call("s1","POST",`/api/attempts/${a.id}/submit`,{...payload(a,{"Writing:Task 2":"Public transport can reduce congestion."}),section:2});assert.equal(submitted.statusCode,200,submitted.body);
 const result=await db.result.findUniqueOrThrow({where:{id:a.id}});
 const evaluated=await call("trainer","PUT",`/api/results/${a.id}/evaluation`,{version:result.version,listening:null,reading:null,writing:6.5,remarks:"Module Writing reviewed",completed:true});assert.equal(evaluated.statusCode,200,evaluated.body);assert.equal(evaluated.json().overall,null);assert.deepEqual(evaluated.json().modules,["Writing"]);
 assert.equal((await call("s1","GET",`/api/results/${a.id}`)).json().writing,6.5);
});

test("operational settings are persisted, public details are minimal and automated evaluation can be disabled",async()=>{
 const next={...defaultSettings,supportEmail:"office@example.test",supportPhone:"Office phone",defaultAccessDays:90,mediaLimitMb:5,autoWritingEvaluation:false,expiryReminders:false,backlogNotifications:false};
 const saved=await call("admin","PUT","/api/admin/settings",next);assert.equal(saved.statusCode,200,saved.body);
 const publicInfo=await app.inject({url:"/api/institution"});assert.equal(publicInfo.statusCode,200);assert.equal(publicInfo.json().supportEmail,"office@example.test");assert.ok(!publicInfo.body.includes("autoWritingEvaluation"));
 const id=await submitted();assert.equal(await db.evaluationJob.count({where:{resultId:id}}),0);
 assert.equal((await call("s1","GET","/api/admin/operations")).statusCode,403);
 assert.equal((await call("admin","GET","/api/admin/operations")).json().autoWritingEvaluation,false);
 await call("admin","PUT","/api/admin/settings",defaultSettings);
});

test("reports filter and aggregate real records, paginate, and exclude contacts from Trainer exports",async()=>{
 const r=await call("trainer","GET","/api/reports?course=GENERAL&kind=FLT&module=Listening&limit=1");assert.equal(r.statusCode,200,r.body);assert.ok(r.json().count>1);assert.equal(r.json().results.length,1);assert.ok(r.json().summary.starts>=r.json().count);assert.ok(r.json().questionTypes.length>0);assert.ok(!r.body.includes("private-"));
 const csv=await call("trainer","GET","/api/reports/export?course=GENERAL&kind=FLT");assert.equal(csv.statusCode,200,csv.body);assert.ok(/Student ID.*Name.*Course/.test(csv.body));assert.ok(!csv.body.includes("private-"));
 assert.equal((await call("s1","GET","/api/reports")).statusCode,403);
 assert.equal((await call("admin","GET","/api/reports?from=2026-12-01&to=2026-01-01")).statusCode,400);
});

test("flagged attempt review requires Admin remarks and keeps the original connection log",async()=>{
 const f=await fixture();const a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();await db.attempt.update({where:{id:a.id},data:{flagged:true,interruptions:4}});
 assert.equal((await call("trainer","GET","/api/admin/attempts")).statusCode,403);
 assert.equal((await call("admin","POST",`/api/admin/attempts/${a.id}/review`,{remarks:""})).statusCode,400);
 assert.equal((await call("admin","POST",`/api/admin/attempts/${a.id}/review`,{remarks:"Connectivity discussed with student"})).statusCode,200);
 const saved=await db.attempt.findUniqueOrThrow({where:{id:a.id}});assert.equal(saved.flagged,true);assert.equal(saved.interruptions,4);assert.ok(saved.reviewedAt);
 const rows=(await call("admin","GET","/api/admin/attempts?filter=flagged")).json().rows;assert.ok(rows.some((x:any)=>x.id===a.id));
 const audit=await call("admin","GET","/api/admin/audit?search=Interruption%20review");assert.equal(audit.statusCode,200);assert.ok(audit.json().rows.some((r:any)=>r.actorId==="admin"&&r.target===a.id));
});

test("announcements and read-all are recipient-scoped; bulk course release skips incomplete results",async()=>{
 assert.equal((await call("trainer","POST","/api/admin/announcements",{role:"STUDENT",title:"Test notice"})).statusCode,403);
 const announced=await call("admin","POST","/api/admin/announcements",{role:"STUDENT",course:"GENERAL",title:"General-course announcement"});assert.equal(announced.statusCode,200,announced.body);assert.ok(announced.json().count>0);assert.equal(await db.notification.count({where:{userId:"academic",title:"General-course announcement"}}),0);
 await db.notification.create({data:{userId:"admin",title:"Admin-only backlog",href:"/admin/results"}});
 assert.equal((await call("s1","POST","/api/notifications/read-all")).statusCode,200);assert.equal(await db.notification.count({where:{userId:"s1",read:false}}),0);assert.equal(await db.notification.count({where:{userId:"admin",title:"Admin-only backlog",read:false}}),1);
 const incomplete=await submitted();const eligible=await submitted();const r=await db.result.findUniqueOrThrow({where:{id:eligible}});
 await call("trainer","PUT",`/api/results/${eligible}/evaluation`,{version:r.version,listening:9,reading:9,writing:7,remarks:"Reviewed for bulk release",completed:true});
 assert.equal((await call("trainer","POST","/api/admin/results/release-scope",{course:"GENERAL"})).statusCode,403);
 const released=await call("admin","POST","/api/admin/results/release-scope",{course:"GENERAL"});assert.equal(released.statusCode,200,released.body);assert.ok(released.json().count>=1);assert.equal((await db.result.findUniqueOrThrow({where:{id:eligible}})).released,true);assert.equal((await db.result.findUniqueOrThrow({where:{id:incomplete}})).released,false);
});

test("saved records and authenticated sessions survive an API process restart",async()=>{
 const f=await fixture();const a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();const key=`Listening:${f.questions[0]!.id}`;
 await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,payload(a,{[key]:"yes"}));
 await app.close();const url=`postgresql://test_runner:test-runtime-only@127.0.0.1:55433/${dbName}`;app=await buildApp(db,loadConfig({MFA_ENCRYPTION_KEY:testMfaKey,NODE_ENV:"test",DATABASE_URL:url,APP_ORIGIN:origin}));await app.ready();
 const resumed=await call("s1","GET",`/api/attempts/${a.id}`);assert.equal(resumed.statusCode,200,resumed.body);assert.equal(resumed.json().answers[key],"yes");assert.equal(resumed.json().sequence,1);
});


test("trainer reassignment routes new submissions and moves pending work only when explicitly selected",async()=>{
 const id=await submitted();const original=await db.result.findUniqueOrThrow({where:{id}});assert.equal(original.assignedTrainerId,"trainer");
 const input={id:"s1",name:"s1",course:"GENERAL",startDate:"2020-01-01",expiryDate:"2099-01-01",enabled:true,trainerId:"trainer-2"};
 const changed=await call("admin","PUT","/api/admin/students/s1",input);assert.equal(changed.statusCode,200,changed.body);
 assert.equal((await db.result.findUniqueOrThrow({where:{id}})).assignedTrainerId,"trainer");
 // Assignment alone leaves the student's session valid and never becomes an access restriction.
 const newer=await submitted();assert.equal((await db.result.findUniqueOrThrow({where:{id:newer}})).assignedTrainerId,"trainer-2");
 assert.equal((await call("admin","PUT","/api/admin/students/s1",{...input,movePending:true})).statusCode,200);
 assert.equal((await db.result.findUniqueOrThrow({where:{id}})).assignedTrainerId,"trainer-2");
 assert.equal(await db.scoreRevision.count({where:{resultId:id}}),0);
});


test("existing staff accounts can be edited without replacing their passwords",async()=>{
 const before=await db.user.findUniqueOrThrow({where:{id:"trainer-2"}});
 const response=await call("admin","PUT","/api/admin/trainers/trainer-2",{id:"trainer-2",name:"Updated trainer",email:"updated@example.test",enabled:true});assert.equal(response.statusCode,200,response.body);assert.equal((await db.user.findUniqueOrThrow({where:{id:"trainer-2"}})).passwordHash,before.passwordHash);
});


test("concurrent reviewer claims and Admin release retry PostgreSQL row-lock conflicts",async()=>{
 const id=await submitted();let r=await db.result.findUniqueOrThrow({where:{id}});
 const reviewed=await call("trainer","PUT",`/api/results/${id}/evaluation`,{version:r.version,listening:9,reading:9,writing:7,remarks:"Ready for concurrent release",completed:true});assert.equal(reviewed.statusCode,200,reviewed.body);
 const responses=await Promise.all([call("trainer","POST",`/api/results/${id}/claim`),call("admin","POST",`/api/results/${id}/claim`),call("admin","POST","/api/results/release",{ids:[id]}),call("admin","POST","/api/results/release",{ids:[id]})]);
 for(const response of responses)assert.equal(response.statusCode,200,response.body);
 r=await db.result.findUniqueOrThrow({where:{id}});assert.equal(r.released,true);assert.equal(await db.notification.count({where:{userId:"s1",href:`/student/results/${id}`}}),1);
});


test("draft practice pack validation rejects publication and duplicate identifiers",()=>{
 const pack=validatePracticePack(syntheticPracticePack());
 assert.equal(pack.questions.filter(q=>q.skill==="Reading").length,24);assert.equal(pack.questions.filter(q=>q.skill==="Writing").length,8);assert.equal(pack.questions.filter(q=>q.skill==="Listening").length,8);
 assert.ok(pack.questions.every(q=>!q.published&&q.practiceEligible&&q.assetIds.length===0));assert.equal(pack.listeningScripts[0]!.questionIds.length,8);
 assert.throws(()=>validatePracticePack({...pack,questions:pack.questions.map((q,i)=>i===0?{...q,published:true}:q)}));
 assert.throws(()=>validatePracticePack({...pack,questions:pack.questions.map((q,i)=>i===1?{...q,id:pack.questions[0]!.id}:q)}));
});

test("practice installation is Admin-only, preserves edited questions on rerun and leaves FLTs unchanged",async()=>{
 const pack=syntheticPracticePack(),admin=await db.user.findUniqueOrThrow({where:{id:"admin"},include:{student:true}}),trainer=await db.user.findUniqueOrThrow({where:{id:"trainer"},include:{student:true}});
 await assert.rejects(()=>installPracticePack(db,trainer,pack));const tests=await db.test.count(),attempts=await db.attempt.count();
 assert.deepEqual(await installPracticePack(db,admin,pack),{created:40,skipped:0,published:0});
 const id=pack.questions[0]!.id;await db.question.update({where:{id},data:{prompt:"Staff reviewed question wording",published:true,version:{increment:1}}});
 assert.deepEqual(await installPracticePack(db,admin,pack),{created:0,skipped:40,published:0});const preserved=await db.question.findUniqueOrThrow({where:{id}});assert.equal(preserved.prompt,"Staff reviewed question wording");assert.equal(preserved.published,true);
 assert.equal(await db.test.count(),tests);assert.equal(await db.attempt.count(),attempts);
});

test("encoded API routes use authentication and cache policy regardless of raw spelling",async()=>{
  for(const url of ["/%61pi/bootstrap","/%61pi/admin/operations","/%61pi/reports","/%61pi/attempts/missing","/%61pi/results/missing"]){
    const r=await app.inject({url});assert.equal(r.statusCode,401,url);assert.equal(r.headers["cache-control"],"no-store");
  }
  assert.equal((await call("s1","GET","/%61pi/admin/operations")).statusCode,403);
  assert.equal((await call("admin","GET","/%61pi/bootstrap")).statusCode,200);
  assert.equal((await call("expired","GET","/api/auth/me?query=1")).statusCode,200);
});
test("Trainer bootstrap never enumerates draft questions or test builders; evaluation keys remain accessible",async()=>{
  await db.question.create({data:{id:"000-security-private",skill:"Reading",course:"ACADEMIC",title:"Private draft",prompt:"SYNTHETIC-PRIVATE-DRAFT",questionType:"Completion",section:"Passage 1",options:[],answer:"SYNTHETIC-PRIVATE-KEY",published:false}});
  for(const url of ["/api/bootstrap","/api/bootstrap?offset=1&limit=1"]){const r=await call("trainer","GET",url);assert.equal(r.statusCode,200);assert.deepEqual(r.json().questions,[]);assert.ok(!r.body.includes("SYNTHETIC-PRIVATE"));assert.ok(r.json().tests.every((t:any)=>t.builder===undefined&&t.conversions===undefined));}
  assert.ok((await call("admin","GET","/api/bootstrap")).body.includes("SYNTHETIC-PRIVATE-KEY"));
  const id=await submitted();const result=await call("trainer","GET",`/api/results/${id}`);assert.equal(result.statusCode,200,result.body);assert.ok(result.json().questions.some((q:any)=>q.answer==="yes"));
});
test("reconnect claims cannot cancel continuous server time; actual stale gaps still pause and flag",async()=>{
  const f=await fixture(),start=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();let a=start;
  const before=await db.attempt.findUniqueOrThrow({where:{id:a.id}});
  for(let i=0;i<4;i++){await db.attempt.update({where:{id:a.id},data:{lastSignalAt:new Date(Date.now()-1000)}});const r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a),resumed:true});assert.equal(r.statusCode,200,r.body);a=r.json().attempt;}
  let saved=await db.attempt.findUniqueOrThrow({where:{id:a.id}});assert.ok(before.remainingMs-saved.remainingMs>=4000);assert.equal(saved.interruptions,0);
  for(let i=0;i<4;i++){const remaining=saved.remainingMs;await db.attempt.update({where:{id:a.id},data:{lastSignalAt:new Date(Date.now()-60000)}});const r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,payload(a));assert.equal(r.statusCode,200,r.body);a=r.json().attempt;saved=await db.attempt.findUniqueOrThrow({where:{id:a.id}});assert.equal(saved.remainingMs,remaining);}
  assert.equal(saved.interruptions,4);assert.equal(saved.flagged,true);
});
test("inactive-skill edits and transition smuggling fail; acknowledged switching preserves both sections",async()=>{
  const f=await fixture();let a=(await call("s1","POST",`/api/tests/GENERAL/${f.id}/start`)).json();const key=`Listening:${f.questions[0]!.id}`;
  for(const suffix of ["heartbeat","submit"])assert.equal((await call("s1","POST",`/api/attempts/${a.id}/${suffix}`,payload(a,{"Writing:Task 1":"unsanctioned"}))).statusCode,400);
  assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a,{"Writing:Task 1":"smuggled"}),section:2})).statusCode,400);
  assert.equal((await db.attempt.findUniqueOrThrow({where:{id:a.id}})).sequence,0);
  let r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a,{[key]:"yes"}),section:2});assert.equal(r.statusCode,200,r.body);a=r.json().attempt;assert.equal(a.section,2);
  r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a,{"Writing:Task 1":"properly timed answer"}),section:2});assert.equal(r.statusCode,200,r.body);a=r.json().attempt;assert.equal(a.answers[key],"yes");assert.equal(a.answers["Writing:Task 1"],"properly timed answer");
  r=await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,{...payload(a,a.answers),section:0});assert.equal(r.statusCode,200,r.body);a=r.json().attempt;
  const changed={...a.answers,"Writing:Task 1":"changed while Listening"};assert.equal((await call("s1","POST",`/api/attempts/${a.id}/heartbeat`,payload(a,changed))).statusCode,400);
});
test("failed identifiers on one gateway cannot exhaust a different user's login bucket",async()=>{
  await db.loginThrottle.deleteMany();
  try{
    for(let i=0;i<30;i++){const r=await app.inject({method:"POST",url:"/api/auth/login",remoteAddress:"10.23.0.5",headers:{origin,"x-forwarded-for":`192.0.2.${i+1}`},payload:{role:"student",identifier:`security-unknown-${i}`,password:"incorrect"}});assert.equal(r.statusCode,401);}
    const r=await app.inject({method:"POST",url:"/api/auth/login",remoteAddress:"10.23.0.5",headers:{origin,"x-forwarded-for":"198.51.100.99"},payload:{role:"admin",identifier:"admin",password:secret}});assert.equal(r.statusCode,200,r.body);
  }finally{await db.loginThrottle.deleteMany();}
});
test("account aliases and forwarding spoofing share a canonical brute-force limit",async()=>{
  await db.loginThrottle.deleteMany();const user=await db.user.findUniqueOrThrow({where:{id:"trainer"}});
  try{
    for(let i=0;i<12;i++){const r=await app.inject({method:"POST",url:"/api/auth/login",remoteAddress:`192.0.2.${i+1}`,headers:{origin,"x-forwarded-for":`198.51.100.${i+1}`},payload:{role:"trainer",identifier:i%2?user.id:user.email,password:"incorrect"}});assert.equal(r.statusCode,401);}
    const r=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:"trainer",identifier:user.id,password:secret}});assert.equal(r.statusCode,429);
  }finally{await db.loginThrottle.deleteMany();}
});
test("successful legacy authentication upgrades the hash without changing credentials or auth version",async()=>{
  const id="legacy-security",salt=randomBytes(16).toString("hex"),password="Synthetic-legacy-review-password",key=scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString("hex");
  await db.user.create({data:{id,name:"Legacy test",role:"TRAINER",passwordHash:`scrypt:32768:8:1:${salt}:${key}`}});
  const response=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:"trainer",identifier:id,password}});assert.equal(response.statusCode,200,response.body);
  const stored=await db.user.findUniqueOrThrow({where:{id}});assert.match(stored.passwordHash,/^scrypt:32768:8:3:/);assert.equal(stored.authVersion,1);
});

async function staffChallenge(id:string,password=secret){
  const response=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:"trainer",identifier:id,password}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().mfaRequired,true);
  const cookie=response.cookies.find(c=>c.name==="kanan_mfa")!;return {cookie:`kanan_mfa=${cookie.value}`,csrf:response.json().csrfToken,token:cookie.value};
}
function factor(c:{cookie:string;csrf:string},path:string,body:unknown={}){return app.inject({method:"POST",url:`/api/auth/mfa/${path}`,headers:{origin,cookie:c.cookie,"x-csrf-token":c.csrf},payload:body as any});}
async function enrollStaff(){
  const id=`mfa-${randomUUID()}`;await db.user.create({data:{id,name:"Synthetic MFA staff",role:"TRAINER",passwordHash:await hashPassword(secret)}});
  const c=await staffChallenge(id);assert.equal((await app.inject({url:"/api/bootstrap",headers:{cookie:c.cookie}})).statusCode,401);
  assert.equal((await factor(c,"complete")).statusCode,409);
  const setup=await factor(c,"enroll");assert.equal(setup.statusCode,200,setup.body);const seed=setup.json().secret;
  const totpCode=new TOTP({secret:Secret.fromBase32(seed)}).generate(),response=await factor(c,"verify",{code:totpCode});assert.equal(response.statusCode,200,response.body);const codes=response.json().recoveryCodes as string[];assert.equal(codes.length,10);
  assert.equal((await app.inject({url:"/api/bootstrap",headers:{cookie:c.cookie}})).statusCode,401);
  const complete=await factor(c,"complete");assert.equal(complete.statusCode,200,complete.body);const cookie=complete.cookies.find(c=>c.name==="kanan_session"&&c.value)!;
  identities.set(id,{cookie:`kanan_session=${cookie.value}`,csrf:complete.json().csrfToken});return {id,c,seed,codes,totpCode,cookie:cookie.value};
}
test("staff enrollment grants no portal session until a code and recovery acknowledgement; secrets stay private",async()=>{
  const subject=await enrollStaff();assert.equal((await call(subject.id,"GET","/api/bootstrap")).statusCode,200);
  const user=await db.user.findUniqueOrThrow({where:{id:subject.id}});assert.ok(user.mfaSecret&&!user.mfaSecret.includes(subject.seed));assert.equal(user.mfaVersion,1);
  const recovery=await db.recoveryCode.findMany({where:{userId:subject.id}});assert.equal(recovery.length,10);assert.ok(recovery.every(c=>!subject.codes.includes(c.hash)));
  assert.equal((await factor(subject.c,"complete")).statusCode,401);
  const pending=await staffChallenge(subject.id);assert.equal((await app.inject({method:"POST",url:"/api/auth/mfa/verify",headers:{origin,cookie:pending.cookie},payload:{code:subject.codes[0]}})).statusCode,403);
  assert.equal((await app.inject({method:"POST",url:"/api/auth/mfa/verify",headers:{origin:"https://untrusted.audit.test",cookie:pending.cookie,"x-csrf-token":pending.csrf},payload:{code:subject.codes[0]}})).statusCode,403);
  assert.equal((await factor(pending,"enroll")).statusCode,409);
  const bare=await sessionFor(db,user,loadConfig({DATABASE_URL:"postgresql://unused"}));
  assert.equal((await app.inject({url:"/api/bootstrap",headers:{cookie:`kanan_session=${bare.token}`}})).statusCode,401);
});
test("TOTP replay and recovery-code reuse fail across independent login challenges",async()=>{
  const subject=await enrollStaff(),c=await staffChallenge(subject.id);
  assert.equal((await factor(c,"verify",{code:subject.totpCode})).statusCode,401);
  assert.equal((await factor(c,"verify",{code:subject.codes[0]})).statusCode,200);
  const second=await staffChallenge(subject.id);assert.equal((await factor(second,"verify",{code:subject.codes[0]})).statusCode,401);
  assert.equal((await factor(second,"verify",{code:subject.codes[1]})).statusCode,200);
  assert.equal(await db.recoveryCode.count({where:{userId:subject.id,usedAt:{not:null}}}),2);
});
test("concurrent copies of one authenticator code create only one staff session",async()=>{
  const subject=await enrollStaff(),a=await staffChallenge(subject.id),b=await staffChallenge(subject.id);
  const code=new TOTP({secret:Secret.fromBase32(subject.seed)}).generate({timestamp:Date.now()+30000});
  const responses=await Promise.all([factor(a,"verify",{code}),factor(b,"verify",{code})]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,401]);
});
test("expired challenges, credential reset and operator MFA recovery revoke old proof",async()=>{
  const subject=await enrollStaff(),expired=await staffChallenge(subject.id);
  const {digest}=await import("../src/auth.js");await db.authChallenge.update({where:{tokenHash:digest(expired.token)},data:{expiresAt:new Date(Date.now()-1)}});
  assert.equal((await factor(expired,"verify",{code:subject.codes[0]})).statusCode,401);
  const pending=await staffChallenge(subject.id),next="Synthetic-reset-staff-password";
  assert.equal((await call("admin","POST",`/api/admin/users/${subject.id}/password`,{password:next})).statusCode,200);
  assert.equal((await factor(pending,"verify",{code:subject.codes[0]})).statusCode,401);assert.equal((await call(subject.id,"GET","/api/bootstrap")).statusCode,401);
  const reset=await staffChallenge(subject.id,next);await resetStaffMfa(db,"synthetic-operator",subject.id,"Verified synthetic staff recovery request");
  assert.equal((await factor(reset,"verify",{code:subject.codes[1]})).statusCode,401);assert.equal(await db.recoveryCode.count({where:{userId:subject.id}}),0);
  const login=await app.inject({method:"POST",url:"/api/auth/login",headers:{origin},payload:{role:"trainer",identifier:subject.id,password:next}});assert.equal(login.json().enrollmentRequired,true);
});
test("sensitive writes require fresh password and MFA proof without changing the record first",async()=>{
  const subject=await enrollStaff(),{digest}=await import("../src/auth.js");await db.session.update({where:{tokenHash:digest(subject.cookie)},data:{reauthUntil:new Date(Date.now()-1)}});
  const id=await submitted(),r=await db.result.findUniqueOrThrow({where:{id}}),body={version:r.version,listening:7,reading:7,writing:6.5,remarks:"Fresh verification test",completed:true};
  const denied=await call(subject.id,"PUT",`/api/results/${id}/evaluation`,body);assert.equal(denied.statusCode,403);assert.equal(denied.json().code,"REAUTH_REQUIRED");assert.equal((await db.result.findUniqueOrThrow({where:{id}})).version,r.version);
  const forbidden=await call(subject.id,"POST","/api/results/release",{ids:[id]});assert.equal(forbidden.statusCode,403);assert.equal(forbidden.json().code,undefined);
  assert.equal((await call(subject.id,"POST","/api/auth/reauth",{password:"incorrect",code:subject.codes[0]})).statusCode,401);
  assert.equal((await call(subject.id,"POST","/api/auth/reauth",{password:secret,code:subject.codes[0]})).statusCode,200);
  assert.equal((await call(subject.id,"PUT",`/api/results/${id}/evaluation`,body)).statusCode,200);
  assert.equal((await call("s1","POST","/api/auth/reauth",{password:secret,code:subject.codes[1]})).statusCode,403);
});
test("MFA attempts are throttled across new challenges and security alerts are Admin-only",async()=>{
  const subject=await enrollStaff();await db.loginThrottle.deleteMany({where:{key:{startsWith:`mfa-factor:${subject.id}`}}});
  for(let i=0;i<5;i++){const c=await staffChallenge(subject.id);const r=await factor(c,"verify",{code:"invalid-recovery-code"});assert.equal(r.statusCode,401);}
  const blocked=await staffChallenge(subject.id);assert.equal((await factor(blocked,"verify",{code:subject.codes[0]})).statusCode,429);
  const events=await db.notification.findMany({where:{dedupeKey:{startsWith:"security/"}},include:{user:{select:{role:true}}}});assert.ok(events.length>0);assert.ok(events.every(e=>e.user.role==="ADMIN"));
});
test("security readiness exposes role flags only to Admin and never claims unverified cloud controls",async()=>{
  for(const id of ["s1","trainer"])assert.equal((await call(id,"GET","/api/admin/security")).statusCode,403);
  const response=await call("admin","GET","/api/admin/security");assert.equal(response.statusCode,200,response.body);const status=response.json();assert.equal(status.staffMfaRequired,true);assert.equal(status.mfaConfigured,true);assert.equal(status.leastPrivilegeVerified,false);assert.equal(status.backupRestoreVerified,false);assert.ok(!response.body.includes("passwordHash"));assert.ok(!response.body.includes("mfaSecret"));
});

// Synthetic parser/installation fixture, independent of private assessment files.
function syntheticPracticePack() {
  const questions=Array.from({length:40},(_,i)=>({
    id:`orig-v1-fixture-${i}`,skill:i<24?"Reading":i<32?"Writing":"Listening",course:"GENERAL",
    questionType:i<24?"Completion":i<32?"Task 2":"Completion",section:i<24?"Passage 1":i<32?"Task 2":"Part 1",difficulty:"Easy",
    title:`Original practice: fixture ${i}`,prompt:"Synthetic test fixture prompt",passage:"Synthetic passage for parser tests only. ".repeat(5),options:[],
    answer:i<24||i>=32?"fixture-answer":"",explanation:"",assetIds:[],published:false,archived:false,practiceEligible:true,
  }));
  return {id:"original-practice-v1",version:1,authorship:"Synthetic automated test fixture",status:"draft",questions,
    listeningScripts:[{id:"fixture-script",questionIds:questions.slice(32).map(q=>q.id),text:"Synthetic script for parser validation.",audioStatus:"not recorded"}]};
}
