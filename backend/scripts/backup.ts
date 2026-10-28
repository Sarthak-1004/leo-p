import {resolve} from "node:path";
import {createBackup,restoreBackup} from "../src/backup.js";
const mode=process.argv[2],file=process.argv[3],secret=process.env.BACKUP_ENCRYPTION_KEY;
if(!file||!secret)throw new Error("Supply create|verify, an archive path and BACKUP_ENCRYPTION_KEY through the environment");
try{if(mode==="create"){
  const url=process.env.BACKUP_DATABASE_URL??process.env.DATABASE_URL;if(!url)throw new Error("Set the authorized source connection through the environment");
  const result=await createBackup(url,secret,resolve(file));console.log(`Encrypted backup created (${result.bytes} bytes). Keep the key separately and verify restoration.`);
}else if(mode==="verify"){
  if(!process.env.RESTORE_DATABASE_URL)throw new Error("Set an empty local disposable RESTORE_DATABASE_URL");
  await restoreBackup(resolve(file),secret,process.env.RESTORE_DATABASE_URL);console.log("Restore into the isolated database completed. Check application records before recording recovery acceptance.");
}else throw new Error("Use create or verify; no operation was performed");
}catch{console.error("Backup operation failed. Check the client tools, encryption key, connectivity and empty local restore target; no credentials are printed.");process.exitCode=1;}
