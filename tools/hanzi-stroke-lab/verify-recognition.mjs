import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {samples,trajectories} from './handwriting-fixtures.mjs';
const browser=await chromium.launch();const page=await browser.newPage();
await page.goto(process.env.HSL_BASE || 'http://127.0.0.1:5175/');
const packets=samples.flatMap(([char,s])=>['base','offset','scale','tilt'].map(variant=>({char,variant,strokes:trajectories(s,variant)})));
// Only anonymous trajectories/revision/limit enter the actual engine Worker.
const results=await page.evaluate(async inputs=>{
 const w=new Worker(new URL('./hanzi-stroke-lab/recognizer/worker.js',document.baseURI));
 const ask=(packet)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('recognizer timeout')),10000);w.onmessage=({data})=>{clearTimeout(t);data.type==='error'?reject(new Error(data.message)):resolve(data);};w.onerror=reject;if(packet)w.postMessage(packet);});
 await ask(null);const rows=[];
 for(let i=0;i<inputs.length;i++)rows.push(await ask({revision:i,strokes:inputs[i]}));
 w.terminate();return rows;
},packets.map(p=>p.strokes));
const rows=packets.map((p,i)=>({char:p.char,variant:p.variant,rank:results[i].matches.findIndex(m=>m.hanzi===p.char)+1,candidates:results[i].matches.map(m=>m.hanzi)}));
const stats=group=>({n:group.length,top1:group.filter(r=>r.rank===1).length,top5:group.filter(r=>r.rank>=1&&r.rank<=5).length,failures:group.filter(r=>!r.rank||r.rank>5).map(r=>({char:r.char,variant:r.variant,rank:r.rank,candidates:r.candidates}))});
const report={provenance:'36 independently authored geometric handwriting samples; 4 transformations each. Synthetic, not real-person accuracy. Engine receives points only.',overall:stats(rows),base:stats(rows.filter(r=>r.variant==='base')),rows};
writeFileSync('tmp/tasks/HANZI-STROKE-LAB/recognition-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({overall:report.overall,base:report.base},null,2));await browser.close();
