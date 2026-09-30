import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e/hanzi-tower-defense',testMatch:'short-missions.spec.ts',
 fullyParallel:true,workers:3,retries:0,timeout:300_000,expect:{timeout:15000},reporter:[['line']],
 outputDir:'tmp/tasks/SHORT-MISSIONS/browser-failures',
 use:{baseURL:'http://127.0.0.1:5299',trace:'off',screenshot:'only-on-failure'},
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
  {name:'touch',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
 ],
 webServer:{command:'pnpm exec vite --host 127.0.0.1 --port 5299 --strictPort',url:'http://127.0.0.1:5299',reuseExistingServer:false},
});
