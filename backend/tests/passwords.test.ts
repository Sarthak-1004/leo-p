import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes,scryptSync} from "node:crypto";
import {hashPassword,verifyPassword,passwordNeedsRehash} from "../src/auth.js";
test("new hashes use the upgraded work factor and reject wrong passwords",async()=>{
  const hash=await hashPassword("Synthetic-security-test-password");assert.match(hash,/^scrypt:32768:8:3:/);
  assert.equal(passwordNeedsRehash(hash),false);assert.equal(await verifyPassword("Synthetic-security-test-password",hash),true);assert.equal(await verifyPassword("wrong",hash),false);
});
test("legacy hashes remain verifiable for safe migration; invalid parameters never trigger hashing",async()=>{
  const salt=randomBytes(16).toString("hex"),secret="Synthetic-legacy-password",key=scryptSync(secret,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString("hex"),old=`scrypt:32768:8:1:${salt}:${key}`;
  assert.equal(passwordNeedsRehash(old),true);assert.equal(await verifyPassword(secret,old),true);assert.equal(await verifyPassword("wrong",old),false);
  for(const hash of [old.replace("32768","1073741824"),old.replace("scrypt:","other:"),old+":extra",old.replace(key,"abcd")])assert.equal(await verifyPassword(secret,hash),false);
});
