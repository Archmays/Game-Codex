import {defineConfig,devices} from '@playwright/test';
import {existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const evidence=process.env.GAME_CODEX_EVIDENCE_ROOT??'tmp/tasks/GAME-CODEX-V1.0';
const runtime=resolve(evidence,'browser-runtimes');
const executable=(family:string,relative:string)=>{if(!existsSync(runtime))return undefined;const folder=readdirSync(runtime).find(n=>n.startsWith(`${family}-`));const path=folder?resolve(runtime,folder,relative):'';return existsSync(path)?path:undefined;};
const firefox=executable('firefox','firefox/firefox.exe'),webkit=executable('webkit','Playwright.exe');
export default defineConfig({testDir:'tests/e2e/v1.0',workers:1,retries:0,timeout:300000,expect:{timeout:15000},
 reporter:[['line'],['json',{outputFile:`${evidence}/v1-results.json`}]],outputDir:`${evidence}/v1-failures`,
 snapshotPathTemplate:`${process.cwd()}/${evidence}/v1-visual-baseline/{projectName}/{arg}{ext}`,
 use:{baseURL:process.env.V1_URL??'http://127.0.0.1:5315',screenshot:'only-on-failure',trace:'retain-on-failure',reducedMotion:'reduce'},
 webServer:process.env.V1_URL?undefined:{command:`pnpm exec vite ${process.env.V1_PREVIEW?'preview ':''}--host 127.0.0.1 --port 5315 --strictPort`,url:'http://127.0.0.1:5315',reuseExistingServer:false},
 projects:[
 {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
 {name:'phone-360',use:{...devices['Pixel 7'],viewport:{width:360,height:740}}},
 {name:'phone-390',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
 {name:'tablet-768',use:{...devices['Desktop Chrome'],hasTouch:true,viewport:{width:768,height:1024},deviceScaleFactor:2}},
 {name:'tablet-1024-landscape',use:{...devices['Desktop Chrome'],hasTouch:true,viewport:{width:1024,height:768},deviceScaleFactor:2}},
 {name:'tablet-1024-portrait',use:{...devices['Desktop Chrome'],hasTouch:true,viewport:{width:1024,height:1366},deviceScaleFactor:2}},
 {name:'tablet-1366',use:{...devices['Desktop Chrome'],hasTouch:true,viewport:{width:1366,height:1024},deviceScaleFactor:2}},
 {name:'low-height',use:{...devices['Desktop Chrome'],viewport:{width:960,height:480}}},
 ...(firefox?[{name:'firefox',use:{browserName:'firefox' as const,viewport:{width:1440,height:1000},launchOptions:{executablePath:firefox}}}]:[]),
 ...(webkit?[{name:'webkit',use:{browserName:'webkit' as const,viewport:{width:1024,height:768},hasTouch:true,launchOptions:{executablePath:webkit}}}]:[]),
 ],
});
