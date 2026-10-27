import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { database } from "../src/db.js";
const db=database(process.env.DATABASE_URL??"postgresql://kanan:local-development-only@127.0.0.1:55432/kanan");
const hasAdmin=await db.user.count({where:{role:"ADMIN"}});await db.$disconnect();
process.env.DATABASE_URL??="postgresql://kanan:local-development-only@127.0.0.1:55432/kanan";
if(!hasAdmin&&!process.env.BOOTSTRAP_ADMIN_PASSWORD){
  if(!process.stdin.isTTY)throw new Error("Run setup in your terminal or supply BOOTSTRAP_ADMIN_PASSWORD through the environment");
  let muted=false;
  const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
  const reader=createInterface({input:process.stdin,output,terminal:true});
  process.env.BOOTSTRAP_ADMIN_ID=await reader.question("Initial Admin ID [admin]: ")||"admin";
  process.stdout.write("New Admin password (12+ characters): ");muted=true;
  const secret=await reader.question("");process.stdout.write("\nConfirm password: ");
  const confirm=await reader.question("");muted=false;process.stdout.write("\n");reader.close();
  if(secret!==confirm)throw new Error("Passwords did not match; no Admin account was created");
  process.env.BOOTSTRAP_ADMIN_PASSWORD=secret;
}
try{await import("./seed.js");}finally{delete process.env.BOOTSTRAP_ADMIN_PASSWORD;}
