import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,relative} from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
mkdirSync(resolve("tmp"),{recursive:true});
for(const [name,severity,result,expected] of [["high findings block",9.1,true,1],["lower findings remain visible",4.2,true,0],["no findings pass",9,false,0]])test(name,()=>{
  const dir=mkdtempSync(resolve("tmp/sarif-test-"));writeFileSync(resolve(dir,"results.sarif"),JSON.stringify({runs:[{tool:{driver:{rules:[{id:"synthetic-rule",properties:{"security-severity":severity}}]}},results:result?[{ruleId:"synthetic-rule"}]:[]}]}));
  const child=spawnSync(process.execPath,["scripts/check-sarif.mjs",dir],{encoding:"utf8"});assert.equal(child.status,expected,child.stderr);
});
test("missing results fail closed",()=>{const dir=mkdtempSync(resolve("tmp/sarif-empty-"));const child=spawnSync(process.execPath,["scripts/check-sarif.mjs",dir],{encoding:"utf8"});assert.equal(child.status,1);});

function checkReport(report,reviews){
  const dir=mkdtempSync(resolve("tmp/sarif-extension-"));
  writeFileSync(resolve(dir,"results.sarif"),JSON.stringify(report));
  const reviewFile=resolve(dir,"reviewed.json");if(reviews)writeFileSync(reviewFile,JSON.stringify({reviews}));
  return spawnSync(process.execPath,["scripts/check-sarif.mjs",dir,...(reviews?[reviewFile]:[])],{encoding:"utf8"});
}
for(const severity of [4.2,9.1])test(`query-pack extension severity ${severity} is enforced`,()=>{
  const child=checkReport({runs:[{tool:{driver:{rules:[]},extensions:[{name:"codeql/javascript-queries",rules:[{id:"extension-rule",properties:{"security-severity":severity}}]}]},results:[{ruleId:"extension-rule",ruleIndex:0,rule:{id:"extension-rule",index:0,toolComponent:{index:0}}}]}]});
  assert.equal(child.status,severity>=7?1:0,child.stderr);
  if(severity>=7)assert.match(child.stderr,/extension-rule: severity 9.1/);
});
test("extension reference by name resolves its own rules",()=>{
  const child=checkReport({runs:[{tool:{driver:{rules:[]},extensions:[{name:"pack",rules:[{id:"rule",properties:{"security-severity":8}}]}]},results:[{rule:{id:"rule",toolComponent:{name:"pack"}}}]}]});
  assert.equal(child.status,1);assert.match(child.stderr,/rule: severity 8/);
});
test("unknown extension fails closed despite a matching driver rule",()=>{
  const child=checkReport({runs:[{tool:{driver:{rules:[{id:"rule",properties:{"security-severity":1}}]},extensions:[]},results:[{rule:{id:"rule",toolComponent:{index:0}}}]}]});
  assert.equal(child.status,1);assert.match(child.stderr,/no matching tool component/);
});
test("missing or inconsistent rule descriptors fail closed",()=>{
  for(const result of [{ruleId:"missing"},{ruleId:"rule",ruleIndex:1}]){
    const child=checkReport({runs:[{tool:{driver:{rules:[{id:"rule",properties:{"security-severity":1}}]}},results:[result]}]});
    assert.equal(child.status,1);assert.match(child.stderr,/metadata|disagree/);
  }
});
test("reviewed exceptions require unchanged source, exact flow and a current review",()=>{
  const dir=mkdtempSync(resolve("tmp/sarif-reviewed-")),files=["auth.js","token.js"].map(name=>{
    const path=relative(process.cwd(),resolve(dir,name)).replaceAll("\\","/");writeFileSync(path,"synthetic source\n");
    return {path,sha256:createHash("sha256").update("synthetic source\n").digest("hex")};
  });
  const physicalLocation=(uri)=>({artifactLocation:{uri},region:{startLine:1}});
  const result={ruleId:"synthetic-rule",locations:[{physicalLocation:physicalLocation("synthetic/auth.js")}],codeFlows:[{threadFlows:[{locations:[{location:{physicalLocation:physicalLocation("synthetic/token.js")}}]}]}]};
  const report={runs:[{tool:{driver:{rules:[{id:"synthetic-rule",properties:{"security-severity":8.1}}]}},results:[result]}]};
  const review={ruleId:"synthetic-rule",location:{uri:"synthetic/auth.js",line:1},source:{uri:"synthetic/token.js",line:1},justification:"Synthetic reviewed finding used only to verify strict source and flow matching.",reviewUntil:new Date(Date.now()+86400000).toISOString(),files};
  assert.equal(checkReport(report,[review]).status,0);
  assert.equal(checkReport(report,[{...review,reviewUntil:"2000-01-01"}]).status,1);
  assert.equal(checkReport(report,[{...review,source:{uri:"different.js",line:1}}]).status,1);
  writeFileSync(files[0].path,"changed source\n");assert.equal(checkReport(report,[review]).status,1);
});
