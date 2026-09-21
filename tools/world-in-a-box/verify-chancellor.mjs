import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.DESK_ORIGIN||'http://127.0.0.1:5175/';
const out='tmp/tasks/chancellor-desk';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const report={origin,scenarios:[],errors:[],external:[]};
async function pageFor(viewport={width:1366,height:900},touch=false){const c=await browser.newContext({viewport,hasTouch:touch,isMobile:touch});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))report.external.push(r.url());});return p;}
async function open(p){await p.goto(origin+'?play=world-in-a-box&scene=chancellor-desk');await p.waitForSelector('[data-ready=true]');}
async function press(p,selector,touch=false){const loc=p.locator(selector);await loc.scrollIntoViewIfNeeded();if(touch)await loc.tap();else await loc.click();}
async function finished(p){await p.waitForSelector('[data-complete=true]',{timeout:45000});assert.match(await p.locator('[data-stock]').innerText(),/= 12袋/);await p.waitForFunction(()=>document.querySelector('.chancellor-root')?.getAttribute('data-running')==='false');}
async function sequence(p,jobs,touch=false){await press(p,'[data-action=repair]',touch);for(const j of jobs){await press(p,`[data-place=${j==='cart-mountain'?'mountain':j==='boat-river'?'pier':'river'}]`,touch);await p.getByRole('button',{name:j==='cart-mountain'?'车送山村 · 6袋':j==='boat-river'?'船送河村 · 3袋':'车送河村 · 6袋',exact:true})[touch?'tap':'click']();}await press(p,'[data-action=run]',touch);await finished(p);}
try{
 const p=await pageFor();await open(p);await sequence(p,['cart-river','cart-mountain']);await press(p,'[data-action=replay]');await p.screenshot({path:out+'/land-success.png',fullPage:true});report.scenarios.push({name:'mouse-land',log:await p.locator('[data-log]').innerText()});await p.context().close();
 const t=await pageFor({width:390,height:844},true);await open(t);await sequence(t,['boat-river','boat-river','cart-mountain'],true);await press(t,'[data-action=replay]',true);await t.screenshot({path:out+'/water-success.png',fullPage:true});report.scenarios.push({name:'touch-parallel-water',log:await t.locator('[data-log]').innerText()});await t.context().close();
}catch(e){report.errors.push(e.stack);}
await browser.close();await fs.writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors.length||report.external.length)process.exitCode=1;
