import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const p=await browser.newPage({viewport:{width:1366,height:900}});
const out='tmp/tasks/chancellor-desk';await fs.mkdir(out,{recursive:true});const report={checks:[],errors:[]};
p.on('pageerror',e=>report.errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=chancellor-desk');await p.locator('.cd-canvas[data-ready=true]').waitFor();
 const lines=()=>p.locator('.cd-leaders').innerHTML();const before=await lines();const b=await p.locator('[data-action=left]').boundingBox();
 await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(700);await p.mouse.move(5,5);await p.mouse.up();await p.waitForTimeout(150);
 const after=await lines();assert.notEqual(after,before);await p.waitForTimeout(600);assert.equal(await lines(),after);assert.equal(await p.locator('[data-place-title]').innerText(),'议事桌 · 消息');
 await p.locator('[data-action=home]').click();report.checks.push('held camera turn moves projected anchors; pointer release outside control stops without selecting a place');
 await p.locator('[data-action=repair]').click();await p.locator('[data-place=river]').click();await p.getByRole('button',{name:'船送河村 · 3袋',exact:true}).click();await p.getByRole('button',{name:'车送河村 · 6袋',exact:true}).click();
 for(let i=0;i<6;i++)await p.locator('[data-action=step]').click();
 assert.match(await p.locator('[data-block]').innerText(),/还需3袋/);assert.equal(await p.locator('.chancellor-root').getAttribute('data-grain'),'12');
 await p.locator('[data-queue="0-remove"]').click();await p.getByRole('button',{name:'船送河村 · 3袋',exact:true}).click();await p.locator('[data-place=mountain]').click();await p.getByRole('button',{name:'车送山村 · 6袋',exact:true}).click();
 await p.locator('[data-action=run]').click();await p.locator('[data-complete=true]').waitFor({timeout:45000});assert.equal(await p.locator('.chancellor-root').getAttribute('data-grain'),'12');report.checks.push('river received3 -> overlarge cart blocked -> remove cart -> boat3 and mountain cart6 -> actual success');
 await p.screenshot({path:out+'/recovery-success.png',fullPage:true});
}catch(e){report.errors.push(e.stack);}finally{await browser.close();await fs.writeFile(out+'/recovery-report.json',JSON.stringify(report,null,2));console.log(report);if(report.errors.length)process.exitCode=1;}
