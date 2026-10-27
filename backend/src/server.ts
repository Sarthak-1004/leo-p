import { database } from "./db.js";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { startWorker } from "./worker.js";
const config=loadConfig();
const db=database(config.DATABASE_URL);
await db.$connect();
const app=await buildApp(db,config);
const stopWorker=startWorker(db,config);
let closing=false;
async function shutdown(){if(closing)return;closing=true;stopWorker();await app.close();await db.$disconnect();}
process.on("SIGTERM",()=>void shutdown());process.on("SIGINT",()=>void shutdown());
await app.listen({host:"0.0.0.0",port:config.PORT});
