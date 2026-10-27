import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {database} from "../src/db.js";
import {validatePracticePack,installPracticePack} from "../src/practice-pack.js";
import {csvExport} from "../src/imports.js";
const path=resolve(process.env.PRIVATE_PRACTICE_PACK_PATH??"content/original-practice-v1.json");
const input=await readFile(path,"utf8").catch(()=>{throw new Error("Private practice pack is unavailable. Set PRIVATE_PRACTICE_PACK_PATH to an approved local file.");});
const pack=validatePracticePack(JSON.parse(input));
if(process.argv.includes("--export")) {
  const headers=["id","skill","course","questionType","section","difficulty","title","prompt","passage","options","answer","explanation","assetIds","practiceEligible"] as const;
  const rows=pack.questions.map(q=>headers.map(key=>["options","answer","assetIds"].includes(key)?JSON.stringify(q[key]):String(q[key])));
  await writeFile(path.replace(/\.json$/i,"")+".csv",csvExport([[...headers],...rows]),"utf8");
  console.log("Private practice CSV exported beside the source file.");
} else {
  const url=process.env.DATABASE_URL;if(!url)throw new Error("Set DATABASE_URL before installing practice content");
  const db=database(url);
  try {
    const users=await db.user.findMany({where:{role:"ADMIN",enabled:true,...(process.env.CONTENT_ADMIN_ID?{id:process.env.CONTENT_ADMIN_ID}:{})},include:{student:true},take:2});
    if(users.length!==1)throw new Error("Set CONTENT_ADMIN_ID to one enabled Admin account");
    console.log(JSON.stringify(await installPracticePack(db,users[0]!,pack)));
  } finally {await db.$disconnect();}
}
