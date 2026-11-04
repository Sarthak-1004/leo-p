import {readFile} from "node:fs/promises";
import {resolve,dirname,basename} from "node:path";
import {database} from "../src/db.js";
import {loadConfig} from "../src/config.js";
import {Storage} from "../src/storage.js";
import {validateTestPack,installTestPack,slotId} from "../src/test-pack.js";
const [file,slot]=process.argv.slice(2);
if(!file||!slot)throw new Error("Usage: npm run content:test -- <private-pack.json> <slot-number>");
const input=await readFile(resolve(file),"utf8").catch(()=>{throw new Error("Private test pack is unavailable. Pass the path to an approved local file.");});
const pack=validateTestPack(JSON.parse(input)),number=Number(slot);
const url=process.env.DATABASE_URL;if(!url)throw new Error("Set DATABASE_URL before installing test content");
const db=database(url);
try {
  const users=await db.user.findMany({where:{role:"ADMIN",enabled:true,...(process.env.CONTENT_ADMIN_ID?{id:process.env.CONTENT_ADMIN_ID}:{})},include:{student:true},take:2});
  if(users.length!==1)throw new Error("Set CONTENT_ADMIN_ID to one enabled Admin account");
  console.log(`Installing ${pack.id} into ${pack.course}/${slotId(pack.kind,number)} as unpublished drafts.`);
  // Upload media only for questions that do not exist yet (a shared Listening paper is uploaded once).
  const existing=new Set((await db.question.findMany({where:{id:{in:pack.questions.map(q=>q.id)}},select:{id:true}})).map(q=>q.id));
  const pending=pack.media.filter(m=>m.questionIds.some(id=>!existing.has(id))),assets:Record<string,string[]>={};
  if(pending.length) {
    const storage=new Storage(loadConfig(process.env));
    try {
      for(const m of pending) {
        const body=await readFile(resolve(dirname(resolve(file)),m.file)).catch(()=>{throw new Error(`Media file is missing: ${m.file}`);});
        const asset=await storage.upload(db,users[0]!,basename(m.file),body);
        for(const id of m.questionIds)(assets[id]??=[]).push(asset.id);
        console.log(`Uploaded ${m.file} (${(asset.size/1048576).toFixed(2)} MB)`);
      }
    } finally {storage.close();}
  }
  console.log(JSON.stringify(await installTestPack(db,users[0]!,pack,number,assets)));
} finally {await db.$disconnect();}
