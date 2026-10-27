import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests-live",workers:1,use:{actionTimeout:10000,baseURL:"http://127.0.0.1:4174",viewport:{width:1440,height:1000}},webServer:[
  {command:"npm --prefix ../backend exec -- tsx scripts/e2e-server.ts",cwd:"../backend",url:"http://127.0.0.1:3002/api/health",timeout:90000,reuseExistingServer:false},
  {command:"npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",url:"http://127.0.0.1:4174",env:{VITE_DEMO_MODE:"false",API_PROXY_TARGET:"http://127.0.0.1:3002"},reuseExistingServer:false},
]});
