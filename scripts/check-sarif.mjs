import {readdirSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
const directory=resolve(process.argv[2]??"codeql-results");
const files=readdirSync(directory,{recursive:true}).filter(path=>String(path).endsWith(".sarif"));
if(!files.length)throw new Error("Security analysis produced no SARIF results");
let high=0;
for(const file of files){const report=JSON.parse(readFileSync(resolve(directory,String(file)),"utf8"));
  if(!Array.isArray(report.runs)||!report.runs.length)throw new Error("Invalid security analysis report");
  for(const run of report.runs){const rules=run.tool?.driver?.rules??[];
    for(const result of run.results??[]){const rule=rules.find(rule=>rule.id===result.ruleId)??rules[result.ruleIndex];
      if(!rule)throw new Error("Security result has no matching rule metadata");
      if(Number(rule?.properties?.["security-severity"])>=7)high++;
    }
  }
}
console.log(`High/critical source-security findings: ${high}`);if(high)process.exitCode=1;
