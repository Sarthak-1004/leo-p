import {readdirSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
const directory=resolve(process.argv[2]??"codeql-results");
const files=readdirSync(directory,{recursive:true}).filter(path=>String(path).endsWith(".sarif"));
if(!files.length)throw new Error("Security analysis produced no SARIF results");
let high=0;
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
        high++;
        const location=result.locations?.[0]?.physicalLocation;
        console.error(`${rule.id}: severity ${rule.properties["security-severity"]} at ${location?.artifactLocation?.uri??"unknown file"}:${location?.region?.startLine??"?"}`);
      }
    }
  }
}
console.log(`High/critical source-security findings: ${high}`);if(high)process.exitCode=1;
