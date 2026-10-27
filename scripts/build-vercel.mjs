import {cp, mkdir, rm, writeFile} from "node:fs/promises";
import {resolve, dirname, sep} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";

export function deploymentConfig(environment) {
  if(environment.VITE_DEMO_MODE&&environment.VITE_DEMO_MODE!=="false")throw new Error("Testing deployments must use the connected API. Remove VITE_DEMO_MODE or set it to false.");
  let backend;
  try {backend=new URL(environment.BACKEND_ORIGIN);}catch {throw new Error("Set BACKEND_ORIGIN to the HTTPS origin of the deployed API before building Vercel.");}
  if(backend.protocol!=="https:"||backend.username||backend.password||backend.pathname!=="/"||backend.search||backend.hash||backend.port||backend.hostname==="localhost"||backend.hostname.endsWith(".localhost")||backend.hostname==="127.0.0.1")throw new Error("BACKEND_ORIGIN must be a public HTTPS origin without a path, port or credentials.");
  return {version:3,routes:[
    {src:"/.*",headers:{
      "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"strict-origin-when-cross-origin",
      "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' https:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    },continue:true},
    {src:"^(/api(?:/.*)?)$",dest:`${backend.origin}$1`,headers:{"Cache-Control":"no-store","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","x-vercel-enable-rewrite-caching":"0"}},
    {src:"/assets/.*",headers:{"Cache-Control":"public, max-age=31536000, immutable"},continue:true},
    {handle:"filesystem"},
    {src:"^/(?!api(?:/|$)).*$",dest:"/index.html",headers:{"Cache-Control":"no-cache"}},
  ]};
}
async function build() {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),config=deploymentConfig(process.env);
  const npmCli=process.env.npm_execpath;
  if(!npmCli)throw new Error("Run this build with npm run build:vercel");
  const child=spawnSync(process.execPath,[npmCli,"--prefix","frontend","run","build"],{cwd:root,stdio:"inherit",env:{...process.env,VITE_DEMO_MODE:"false"}});
  if(child.error)throw child.error;if(child.status!==0)process.exit(child.status??1);
  const output=resolve(root,".vercel/output");
  if(!output.startsWith(root+sep)||dirname(output)!==resolve(root,".vercel"))throw new Error("Invalid build output path");
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  await cp(resolve(root,"frontend/dist"),resolve(output,"static"),{recursive:true});
  await writeFile(resolve(output,"config.json"),JSON.stringify(config,null,2)+"\n");
  console.log("Vercel output prepared with connected API routing and SPA navigation.");
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await build();
