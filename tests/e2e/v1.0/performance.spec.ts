import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {activate} from '../step4/input-helpers';
import {arrangeTacticsUI} from '../hanzi-tower-defense/step5-input';
const evidence=process.env.GAME_CODEX_EVIDENCE_ROOT??'tmp/tasks/GAME-CODEX-V1.0';
async function sample(page:Page,ms:number){return page.evaluate(duration=>new Promise(resolve=>{
 const gaps:number[]=[];let previous=performance.now(),start=previous,maxNodes=0,maxEnemies=0;
 const frame=(now:number)=>{gaps.push(now-previous);previous=now;maxNodes=Math.max(maxNodes,document.querySelectorAll('*').length);maxEnemies=Math.max(maxEnemies,Number(document.querySelector('[data-td-enemies]')?.textContent?.match(/路上 (\d+)/)?.[1]??0));
 if(now-start<duration)requestAnimationFrame(frame);else{const sorted=gaps.slice(1).sort((a,b)=>a-b);resolve({durationMs:now-start,frames:gaps.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],over50ms:sorted.filter(v=>v>50).length,maxNodes,maxEnemies,jsHeapBytes:(performance as any).memory?.usedJSHeapSize??null,resources:performance.getEntriesByType('resource').map(v=>({url:v.name,transferBytes:(v as PerformanceResourceTiming).transferSize,decodedBodyBytes:(v as PerformanceResourceTiming).decodedBodySize}))});}};requestAnimationFrame(frame);
 }),ms);}
test('@v1-performance cold entry and ordinary dense battle',async({page},info)=>{
 test.skip(!['desktop','phone-390'].includes(info.project.name));const mode=info.project.use.hasTouch?'touch':'mouse';const act=(s:string)=>activate(page,s,mode);const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('?play=hanzi-tower-defense&scenario=beacon-crowd');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');const first=await sample(page,3000);
 expect(requests.some(u=>u.includes('/assets/images/')||u.includes('qinglan-pass.webp')||u.includes('twin-bends.webp')||u.endsWith('captain.webp'))).toBe(false);
 await act('[data-td-guide-close]');await arrangeTacticsUI(page,mode,'beacon-crowd','flame-wildwood');await act('[data-td-next]');
 await expect.poll(()=>page.locator('[data-td-enemies]').textContent()).toMatch(/路上 [3-9]/);const battle=await sample(page,20000);
 await act('[data-td-settings]');await act('[data-presentation-low]');await act('[data-td-settings-close]');await act('[data-td-pause]');const low=await sample(page,10000);
 expect(await page.locator('.td-drop').count()).toBeLessThan(20);expect(await page.locator('canvas').count()).toBe(1);
 const catalogue=JSON.parse(readFileSync('assets/images/v1.0/manifest.json','utf8'));const loaded=catalogue.runtime.filter((v:any)=>requests.some(u=>u.endsWith(v.path.replace(/^public\//,''))));
 mkdirSync(`${evidence}/performance`,{recursive:true});writeFileSync(`${evidence}/performance/${info.project.name}.json`,JSON.stringify({profile:info.project.use.viewport,dpr:await page.evaluate(()=>devicePixelRatio),first,battle,low,assetDownloadBytes:loaded.reduce((s:number,v:any)=>s+v.bytes,0),decodedImageRGBAEstimate:loaded.reduce((s:number,v:any)=>s+(v.decodedRGBABytes??0),0),notes:['Passive requestAnimationFrame observations, not physical device measurements.','RGBA sum is a lower-bound texture estimate before GPU copies/mipmaps and framebuffers.','Ordinary 1x battle; low mode sampled later in the same wave, not a controlled speed comparison.']},null,2));
});
