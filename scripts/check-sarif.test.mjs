import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
mkdirSync(resolve("tmp"),{recursive:true});
for(const [name,severity,result,expected] of [["high findings block",9.1,true,1],["lower findings remain visible",4.2,true,0],["no findings pass",9,false,0]])test(name,()=>{
  const dir=mkdtempSync(resolve("tmp/sarif-test-"));writeFileSync(resolve(dir,"results.sarif"),JSON.stringify({runs:[{tool:{driver:{rules:[{id:"synthetic-rule",properties:{"security-severity":severity}}]}},results:result?[{ruleId:"synthetic-rule"}]:[]}]}));
  const child=spawnSync(process.execPath,["scripts/check-sarif.mjs",dir],{encoding:"utf8"});assert.equal(child.status,expected,child.stderr);
});
test("missing results fail closed",()=>{const dir=mkdtempSync(resolve("tmp/sarif-empty-"));const child=spawnSync(process.execPath,["scripts/check-sarif.mjs",dir],{encoding:"utf8"});assert.equal(child.status,1);});
