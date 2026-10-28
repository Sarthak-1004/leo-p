import {Client} from "pg";
import {randomBytes} from "node:crypto";
import {mkdirSync,readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";
import {database} from "../src/db.js";
import {hashPassword,audit} from "../src/auth.js";
import {createBackup,restoreBackup} from "../src/backup.js";
const input=process.env.TEST_BACKUP_DATABASE_URL;
if(!input||process.env.NODE_ENV==="production")throw new Error("Use an explicitly configured local test database only");
const base=new URL(input);if(!["127.0.0.1","localhost","[::1]"].includes(base.hostname))throw new Error("Recovery verification is restricted to local disposable databases");
const suffix=randomBytes(8).toString("hex"),sourceName=`kanan_backup_source_${suffix}`,targetName=`kanan_restore_${suffix}`;
const source=new URL(base),target=new URL(base);source.pathname=`/${sourceName}`;target.pathname=`/${targetName}`;
const owner=new Client({connectionString:input});await owner.connect();
await owner.query(`CREATE DATABASE "${sourceName}"`);await owner.query(`CREATE DATABASE "${targetName}"`);
const db=database(source.href),restored=database(target.href);
try{
  const migration=new Client({connectionString:source.href});await migration.connect();try{for(const dir of readdirSync("prisma/migrations").filter(n=>/^\d/.test(n)).sort())await migration.query(readFileSync(`prisma/migrations/${dir}/migration.sql`,"utf8"));}finally{await migration.end();}
  // Retired optional fields remain restorable for existing databases/backups.
  const cipher=`legacy-retired-${randomBytes(32).toString("base64url")}`,passwordHash=await hashPassword("Synthetic-backup-only-password");
  await db.user.create({data:{id:"restore-admin",name:"Synthetic restore Admin",role:"ADMIN",passwordHash,mfaSecret:cipher,mfaVersion:1}});
  await db.user.create({data:{id:"restore-student",name:"Synthetic restore Student",role:"STUDENT",passwordHash,student:{create:{course:"GENERAL",startDate:"2020-01-01",expiryDate:"2099-01-01",contacts:{create:{phone:"SYNTHETIC-BACKUP-CONTACT"}}}}}});
  await audit(db,"restore-admin","Synthetic recovery verification","test");
  mkdirSync(resolve(".test-data/backups"),{recursive:true});const file=resolve(`.test-data/backups/${suffix}.enc`),secret=randomBytes(32).toString("base64");
  const archived=await createBackup(source.href,secret,file);assert.ok(!readFileSync(file).includes(Buffer.from("SYNTHETIC-BACKUP-CONTACT")));
  await restoreBackup(file,secret,target.href);
  assert.equal(await restored.user.count(),2);assert.equal((await restored.studentContact.findUniqueOrThrow({where:{studentId:"restore-student"}})).phone,"SYNTHETIC-BACKUP-CONTACT");
  assert.equal((await restored.user.findUniqueOrThrow({where:{id:"restore-admin"}})).mfaSecret,cipher);
  const log=await restored.auditLog.findFirstOrThrow();await assert.rejects(()=>restored.auditLog.update({where:{id:log.id},data:{action:"tampered"}}));
  await assert.rejects(()=>restoreBackup(file,secret,target.href),/empty/);assert.equal(await restored.user.count(),2);
  console.log(`Encrypted backup/restore verified (${archived.bytes} bytes): records, retained legacy fields, immutable audit and overwrite guard.`);
}finally{await db.$disconnect();await restored.$disconnect();await owner.query(`DROP DATABASE "${sourceName}"`);await owner.query(`DROP DATABASE "${targetName}"`);await owner.end();}
