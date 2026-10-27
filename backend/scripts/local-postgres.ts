import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
// Development only: real PostgreSQL, persistent within the ignored workspace.
if(process.env.NODE_ENV === "production")throw new Error("Use managed PostgreSQL in production");
const dir=resolve(".local/postgres");mkdirSync(resolve(".local"),{recursive:true});
const pg=new EmbeddedPostgres({databaseDir:dir,user:"kanan",password:"local-development-only",port:55432,persistent:true,authMethod:"scram-sha-256",postgresFlags:["-h","127.0.0.1","-c","io_method=sync"],onLog:()=>{},onError:(message)=>process.stderr.write(String(message)+"\n")});
if(!existsSync(resolve(dir,"PG_VERSION")))await pg.initialise();
await pg.start();
const client=pg.getPgClient("postgres");await client.connect();
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='kanan'")).rowCount)await pg.createDatabase("kanan");
await client.end();
console.log("Development PostgreSQL is listening on 127.0.0.1:55432. Run db:migrate, then db:seed in another terminal.");
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await pg.stop();process.exit(0);}
process.on("SIGINT",()=>void stop());process.on("SIGTERM",()=>void stop());
setInterval(()=>{},60000);
