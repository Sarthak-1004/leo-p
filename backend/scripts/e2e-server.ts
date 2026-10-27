import EmbeddedPostgres from "embedded-postgres";
import {existsSync,mkdirSync,readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {createServer} from "node:net";
import {database,json} from "../src/db.js";
import {hashPassword} from "../src/auth.js";
import {defaultConversions,defaultSettings} from "../src/domain.js";
import {buildApp} from "../src/app.js";
import {loadConfig} from "../src/config.js";
if(process.env.NODE_ENV==="production")throw new Error("E2E fixtures must never run in production");
const name=`e2e_${randomUUID().replaceAll("-","")}`,dir=resolve(`.test-data/${name}`);mkdirSync(resolve(".test-data"),{recursive:true});
const pgPort=await new Promise<number>((resolve,reject)=>{const probe=createServer();probe.on("error",reject);probe.listen(0,"127.0.0.1",()=>{const port=(probe.address() as {port:number}).port;probe.close(()=>resolve(port));});});
const pg=new EmbeddedPostgres({databaseDir:dir,user:"e2e_runner",password:"e2e-local-runtime-only",port:pgPort,persistent:true,authMethod:"scram-sha-256",postgresFlags:["-h","127.0.0.1","-c","io_method=sync"],onLog:(message)=>{if(/FATAL|PANIC|ERROR/.test(message))process.stderr.write(message);},onError:(error)=>process.stderr.write(String(error)+"\n")});
if(!existsSync(resolve(dir,"PG_VERSION")))await pg.initialise();await pg.start();await pg.createDatabase(name);
const client=pg.getPgClient(name);await client.connect();for(const migration of readdirSync("prisma/migrations").filter(p=>/^\d/.test(p)).sort())await client.query(readFileSync(`prisma/migrations/${migration}/migration.sql`,"utf8"));await client.end();
const url=`postgresql://e2e_runner:e2e-local-runtime-only@127.0.0.1:${pgPort}/${name}`,db=database(url);
const hash=await hashPassword("E2e-fixture-password-only");
for(const [id,role] of [["admin","ADMIN"],["trainer","TRAINER"],["student","STUDENT"]] as const){await db.user.create({data:{id,role,name:`Test ${role}`,passwordHash:hash,email:role==="TRAINER"?"teacher@example.test":null}});if(role==="STUDENT")await db.student.create({data:{id,course:"GENERAL",startDate:"2020-01-01",expiryDate:"2099-01-01",trainerId:"trainer",contacts:{create:{phone:"555-secret-contact",email:"student-private@example.test",address:"Private street",guardianContact:"private-guardian"}}}});}
await db.platformSetting.create({data:{id:"platform",value:defaultSettings}});
await db.notification.create({data:{userId:"admin",title:"Local operations notification",href:"/admin/operations"}});
const questions=[];
for(const skill of ["Listening","Reading"] as const)for(let i=1;i<=40;i++)questions.push(await db.question.create({data:{id:`${skill}-${i}`,skill,course:"GENERAL",title:`${skill} question ${i}`,prompt:`Choose the correct answer for ${skill} ${i}`,passage:skill==="Reading"?`Passage ${i<=20?1:2}: isolated reading fixture for automated checks.`:"",options:["yes","no"],answer:"yes",questionType:"Multiple choice",section:skill==="Reading"?`Passage ${i<=20?1:2}`:`Part ${Math.ceil(i/10)}`,published:true,practiceEligible:true}}));
for(const section of ["Task 1","Task 2"])questions.push(await db.question.create({data:{id:section.replaceAll(" ","-"),skill:"Writing",course:"GENERAL",title:section,prompt:"Write about improving local transport services.",options:[],answer:"",questionType:section,section,published:true,practiceEligible:true}}));
for(const kind of ["FLT","PRACTICE_MOCK"] as const)await db.test.create({data:{id:kind==="FLT"?"mock-01":"practice-mock-01",course:"GENERAL",kind,number:1,title:kind==="FLT"?"Full Length Test 01":"Practice Mock Test 01",published:true,available:kind==="FLT",duration:150,builder:json({questionIds:{Listening:questions.filter(q=>q.skill==="Listening").map(q=>q.id),Reading:questions.filter(q=>q.skill==="Reading").map(q=>q.id),Writing:questions.filter(q=>q.skill==="Writing").map(q=>q.id),Speaking:[]},duration:{Listening:30,Reading:60,Writing:60,Speaking:0}}),conversions:json(defaultConversions)}});
const app=await buildApp(db,loadConfig({NODE_ENV:"test",DATABASE_URL:url,APP_ORIGIN:"http://127.0.0.1:4174",PORT:"3002"}));await app.listen({host:"127.0.0.1",port:3002});
console.log("E2E API ready on port 3002 (isolated PostgreSQL fixtures)");
let stopped=false;async function stop(){if(stopped)return;stopped=true;await app.close();await db.$disconnect();await pg.dropDatabase(name);await pg.stop();process.exit(0);}
process.on("SIGINT",()=>void stop());process.on("SIGTERM",()=>void stop());
