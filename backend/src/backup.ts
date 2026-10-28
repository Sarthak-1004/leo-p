import {spawn} from "node:child_process";
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
import {createReadStream,createWriteStream} from "node:fs";
import {open,stat,appendFile} from "node:fs/promises";
import {pipeline} from "node:stream/promises";
import {Writable} from "node:stream";
import {Client} from "pg";
import {assert} from "./domain.js";
const magic=Buffer.from("KANANB01");
function key(value:string){assert(/^[A-Za-z0-9+/]{43}=$/.test(value)&&Buffer.from(value,"base64").length===32,400,"Use a base64 32-byte backup encryption key");return Buffer.from(value,"base64");}
function environment(url:string){const u=new URL(url);assert(["postgres:","postgresql:"].includes(u.protocol),400,"PostgreSQL connection required");return {...process.env,PGCONNECT_TIMEOUT:"10",PGHOST:u.hostname,PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:u.searchParams.get("sslmode")??(["127.0.0.1","localhost","[::1]"].includes(u.hostname)?"disable":"require")};}
function postgresClient(kind:"pg_dump"|"pg_restore",url:string,args:string[]){
  const docker=process.env.PG_CLIENT_DOCKER==="true",env=environment(url);
  const prefix=docker?["run","--rm","-i","--network","host",...(["PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PGSSLMODE"].flatMap(name=>["-e",name])),"postgres:18",kind]:[];
  const command=docker?"docker":process.env[kind==="pg_dump"?"PG_DUMP_PATH":"PG_RESTORE_PATH"]??kind;
  const child=spawn(command,[...prefix,...args],{env,stdio:["pipe","pipe","pipe"],windowsHide:true});child.stderr.resume();
  const done=new Promise<void>((resolve,reject)=>{child.once("error",()=>reject(new Error("PostgreSQL client unavailable; install version 18 clients or configure PG_CLIENT_DOCKER")));child.once("close",code=>code===0?resolve():reject(new Error(`PostgreSQL ${kind} failed; backup/restore did not complete`)));});
  return {child,done};
}
async function decipher(file:string,secret:string){const handle=await open(file,"r");try{
  const size=(await handle.stat()).size;assert(size>=36,400,"Incomplete encrypted backup");const header=Buffer.alloc(20),tag=Buffer.alloc(16);await handle.read(header,0,20,0);await handle.read(tag,0,16,size-16);assert(header.subarray(0,8).equals(magic),400,"Unknown backup format");
  const decrypt=createDecipheriv("aes-256-gcm",key(secret),header.subarray(8));decrypt.setAAD(header);decrypt.setAuthTag(tag);return {decrypt,size};
}finally{await handle.close();}}
export async function createBackup(url:string,secret:string,file:string){
  const iv=randomBytes(12),header=Buffer.concat([magic,iv]),cipher=createCipheriv("aes-256-gcm",key(secret),iv);cipher.setAAD(header);
  const output=createWriteStream(file,{flags:"wx",mode:0o600});output.write(header);
  const {child,done}=postgresClient("pg_dump",url,["--format=custom","--no-owner","--no-privileges","--no-password"]);child.stdin.end();
  const results=await Promise.allSettled([pipeline(child.stdout,cipher,output).catch(error=>{child.kill();throw error;}),done]);
  const failed=results.find(r=>r.status==="rejected");if(failed?.status==="rejected"){child.kill();throw new Error("Encrypted backup failed; do not use the incomplete output file");}
  await appendFile(file,cipher.getAuthTag());return {bytes:(await stat(file)).size};
}
export async function restoreBackup(file:string,secret:string,target:string){
  const u=new URL(target),database=decodeURIComponent(u.pathname.slice(1));
  assert(["127.0.0.1","localhost","[::1]"].includes(u.hostname)&&/^kanan_restore_[a-z0-9_]+$/.test(database),400,"Restore verification requires a local disposable database named kanan_restore_...");
  // Authenticate the complete ciphertext before executing anything from it.
  const checked=await decipher(file,secret);await pipeline(createReadStream(file,{start:20,end:checked.size-17}),checked.decrypt,new Writable({write(_chunk,_encoding,cb){cb();}}));
  const client=new Client({connectionString:target});await client.connect();try{
    const result=await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");assert(result.rows[0].count===0,400,"Restore target must be empty; existing data is never overwritten");
  }finally{await client.end();}
  const source=await decipher(file,secret),{child,done}=postgresClient("pg_restore",target,["--dbname",database,"--no-owner","--no-privileges","--exit-on-error","--no-password"]);child.stdout.resume();
  const results=await Promise.allSettled([pipeline(createReadStream(file,{start:20,end:source.size-17}),source.decrypt,child.stdin).catch(error=>{child.kill();throw error;}),done]);
  const failed=results.find(r=>r.status==="rejected");if(failed?.status==="rejected"){child.kill();throw new Error("Restore verification failed; the disposable target may be incomplete");}
  return {restored:true};
}
