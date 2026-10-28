import {randomBytes} from "node:crypto";
import {appendFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
if(process.env.NODE_ENV==="production")throw new Error("Configure the production key through your host's secret environment");
for(const [name,file] of [["MFA_ENCRYPTION_KEY","mfa-key.env"],["BACKUP_ENCRYPTION_KEY","backup-key.env"]]){
  if(process.env[name!]){console.log(`${name} is already configured; it was not changed.`);continue;}
  const key=randomBytes(32).toString("base64");mkdirSync(resolve(".local"),{recursive:true});
  writeFileSync(resolve(`.local/${file}`),`${name}=${key}\n`,{mode:0o600,flag:"wx"});
  appendFileSync(resolve(".env"),`\n# Security encryption key; preserve a separate protected backup.\n${name}=${key}\n`,{mode:0o600});
  console.log(`${name} saved to ignored environment files. No key was printed.`);
}
