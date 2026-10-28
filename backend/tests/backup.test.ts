import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes,createCipheriv} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {restoreBackup,createBackup} from "../src/backup.js";
test("restore refuses nonlocal or non-disposable targets before connecting",async()=>{
  for(const target of ["postgresql://user@db.example.test/kanan_restore_test","postgresql://user@127.0.0.1/production","postgresql://user@127.0.0.1/kanan"])
    await assert.rejects(()=>restoreBackup("unused",randomBytes(32).toString("base64"),target),/local disposable/);
});
test("backup rejects an invalid encryption key before starting a client",async()=>{
  await assert.rejects(()=>createBackup("postgresql://unused","invalid-key","unused"),/32-byte/);
});
test("wrong keys and ciphertext tampering fail before any restore database connection",async()=>{
  mkdirSync(resolve(".test-data/backup-tests"),{recursive:true});
  const secret=randomBytes(32),iv=randomBytes(12),header=Buffer.concat([Buffer.from("KANANB01"),iv]),cipher=createCipheriv("aes-256-gcm",secret,iv);cipher.setAAD(header);
  const encrypted=Buffer.concat([header,cipher.update("Synthetic backup data"),cipher.final(),cipher.getAuthTag()]),file=resolve(`.test-data/backup-tests/${randomBytes(8).toString("hex")}.enc`);writeFileSync(file,encrypted);
  const target="postgresql://unused@127.0.0.1:1/kanan_restore_security_test";
  await assert.rejects(()=>restoreBackup(file,randomBytes(32).toString("base64"),target),/authenticat/i);
  encrypted[22]=encrypted[22]!^1;writeFileSync(file,encrypted);await assert.rejects(()=>restoreBackup(file,secret.toString("base64"),target),/authenticat/i);
});
