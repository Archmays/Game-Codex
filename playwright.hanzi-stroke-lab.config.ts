import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e/hanzi-stroke-lab',outputDir:'tmp/tasks/HANZI-STROKE-LAB/test-results',timeout:45000,fullyParallel:false,workers:2,
 reporter:[['list'],['json',{outputFile:'tmp/tasks/HANZI-STROKE-LAB/browser-results.json'}]],
 use:{baseURL:process.env.HSL_BASE||'http://127.0.0.1:5175/',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1366,height:900}}},
  {name:'chromium-360',use:{browserName:'chromium',viewport:{width:360,height:800},hasTouch:true,deviceScaleFactor:2}},
  {name:'chromium-390',use:{browserName:'chromium',viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:3}},
  {name:'chromium-tablet-portrait',use:{browserName:'chromium',viewport:{width:768,height:1024},hasTouch:true,deviceScaleFactor:2}},
  {name:'chromium-tablet-landscape',use:{browserName:'chromium',viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:2}},
  {name:'webkit-desktop',use:{browserName:'webkit',viewport:{width:1366,height:900}}},
  {name:'webkit-390',use:{browserName:'webkit',viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:3}},
  {name:'webkit-tablet',use:{browserName:'webkit',viewport:{width:768,height:1024},hasTouch:true,deviceScaleFactor:2}}
 ],
 webServer:process.env.HSL_BASE?undefined:{command:'pnpm run play:my-game-world',url:'http://127.0.0.1:5175',reuseExistingServer:true,timeout:30000}
});
