import {readdirSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
const directory=resolve(process.argv[2]??"codeql-results");
const files=readdirSync(directory,{recursive:true}).filter(path=>String(path).endsWith(".sarif"));
if(!files.length)throw new Error("Security analysis produced no SARIF results");
let reviews=[];
try{reviews=JSON.parse(readFileSync(resolve(process.argv[3]??".github/codeql-reviewed.json"),"utf8")).reviews;}
catch(error){if(error.code!=="ENOENT")throw error;}
if(!Array.isArray(reviews))throw new Error("Invalid reviewed security findings");
function reviewed(result,rule){
  const location=result.locations?.[0]?.physicalLocation;
  const source=result.codeFlows?.[0]?.threadFlows?.[0]?.locations?.[0]?.location?.physicalLocation;
  return reviews.find(review=>review.ruleId===rule.id
    &&review.location?.uri===location?.artifactLocation?.uri&&review.location?.line===location?.region?.startLine
    &&review.source?.uri===source?.artifactLocation?.uri&&review.source?.line===source?.region?.startLine
    &&typeof review.justification==="string"&&review.justification.length>=40
    &&Date.parse(review.reviewUntil)>Date.now()
    &&Array.isArray(review.files)&&review.files.length>=2&&review.files.every(file=>{
      if(!/^[a-zA-Z0-9_.\/-]+$/.test(file.path)||file.path.split("/").includes(".."))return false;
      try{return createHash("sha256").update(readFileSync(resolve(file.path),"utf8").replaceAll("\r\n","\n")).digest("hex")===file.sha256;}catch{return false;}
    }));
}
let high=0,accepted=0;
for(const file of files){const report=JSON.parse(readFileSync(resolve(directory,String(file)),"utf8"));
  if(!Array.isArray(report.runs)||!report.runs.length)throw new Error("Invalid security analysis report");
  for(const run of report.runs){
    for(const result of run.results??[]){
      // CodeQL query packs put descriptors in extensions, referenced by result.rule.
      const reference=result.rule??{},componentReference=reference.toolComponent;
      const extensions=run.tool?.extensions??[];
      const component=componentReference
        ? (Number.isInteger(componentReference.index)
          ? extensions[componentReference.index]
          : extensions.find(extension=>componentReference.guid
            ? extension.guid===componentReference.guid
            : extension.name===componentReference.name))
        : run.tool?.driver;
      if(!component)throw new Error("Security result has no matching tool component");
      const rules=component.rules??[],id=reference.id??result.ruleId,index=reference.index??result.ruleIndex;
      const rule=id?rules.find(rule=>rule.id===id):rules[index];
      if(!rule)throw new Error("Security result has no matching rule metadata");
      if(index!==undefined&&rules[index]!==rule)throw new Error("Security rule references disagree");
      if(Number(rule.properties?.["security-severity"])>=7){
        const review=reviewed(result,rule);
        if(review){accepted++;console.log(`Reviewed false positive ${rule.id}: ${review.justification}`);continue;}
        high++;
        const location=result.locations?.[0]?.physicalLocation;
        console.error(`${rule.id}: severity ${rule.properties["security-severity"]} at ${location?.artifactLocation?.uri??"unknown file"}:${location?.region?.startLine??"?"}`);
      }
    }
  }
}
console.log(`Unreviewed high/critical source-security findings: ${high}; source-checked false positives: ${accepted}`);if(high)process.exitCode=1;
