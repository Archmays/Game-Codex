import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {activate,keyReach,type InputMode,criticalTargets} from '../step4/input-helpers';
import {arrangeTacticsUI,tacticsItems,tacticsRegion} from './step5-input';
import {TACTICS_SAVE_KEY,SAVE_KEY,V2_SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP5/tower';
const saved=(page:Page)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).scenarios['qinglan-intercept'],TACTICS_SAVE_KEY);

test('@step5-mechanism battle permissions, preview, checkpoint conservation, restart and mode isolation',async({page},info)=>{
 test.setTimeout(15*60_000);page.setDefaultTimeout(15000);mkdirSync(evidence,{recursive:true});
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard';const act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 if(mode==='keyboard')await keyReach(page,'[data-core="1"]','[data-core]');
 await arrangeTacticsUI(page,mode,'qinglan-intercept','volcano-grove');const before=(await saved(page)).checkpoint;
 await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
 await expect.poll(()=>page.locator('[data-english]').count(),{timeout:30000}).toBeGreaterThan(0);
 await act('[data-td-pause]');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');
 const startCores=await tacticsItems(page),volcanoes=startCores.filter(c=>c.kind==='volcano');
 await act('[data-td-clear]');await act(volcanoes[0].selector);await expect(page.locator('[data-td-stow]')).toBeDisabled();
 const empty=Array.from({length:8},(_,i)=>i).find(slot=>!startCores.some(c=>c.slot===slot))!;
 await act(`[data-slot="${empty}"]`);await expect(page.locator('[data-td-feedback]')).toContainText('不能移动');expect(await tacticsItems(page)).toEqual(startCores);
 await act('[data-td-inspect]');await act(volcanoes[1].selector);await expect(page.locator('[data-td-ranges] circle')).toHaveCount(1);expect(await tacticsItems(page)).toEqual(startCores);await act('[data-td-inspect]');
 await act('[data-td-clear]');await act('[data-english="1"]');await act(volcanoes[0].selector);await act('[data-td-equip]');await expect(page.locator('[data-english="1"]')).toHaveAttribute('data-attached-to',String(volcanoes[0].id));
 await act('[data-td-clear]');await act('[data-english="1"]');await act(volcanoes[1].selector);await expect(page.locator('[data-td-equip]')).toBeDisabled();await expect(page.locator('[data-td-equipment-copy]')).toContainText('暂停仍在战中');
 // A naturally dropped wood is still eligible for first deployment, while paused remains battle.
 const wood=(await tacticsItems(page)).find(c=>c.kind==='wood'&&c.slot===null)!;expect(wood).toBeTruthy();await act('[data-td-cancel-equipment]');await expect(page.locator('[data-english="1"]')).toHaveAttribute('aria-pressed','false');await act(wood.selector);await act(`[data-slot="${empty}"]`);expect((await tacticsItems(page)).find(c=>c.id===wood.id)?.slot).toBe(empty);
 // A tower plus a bag material uses the same legal fusion transaction during battle.
 const water=(await tacticsItems(page)).find(c=>c.kind==='water')!;await act('[data-td-clear]');await act(`[data-slot="${empty}"]`);await act(water.selector);await act('[data-td-fuse]');await expect(page.locator(`[data-slot="${empty}"]`)).toHaveAttribute('data-kind','wash');
 await act('[data-td-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');expect((await saved(page)).checkpoint).toEqual(before);await expect(page.locator('[data-english]')).toHaveCount(0);
 await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');expect((await saved(page)).checkpoint).toEqual(before);
 // Normal interwave retry must restore the completed wave's actual starting point, too.
 await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
 await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready',{timeout:120000});await expect(page.locator('.td-game')).toHaveAttribute('data-wave','1');
 await expect(page.locator('[data-td-retry]')).toHaveText('重整刚才一波');await act('[data-td-retry]');
 await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');expect((await saved(page)).checkpoint).toEqual(before);await expect(page.locator('[data-english]')).toHaveCount(0);
 await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');expect((await saved(page)).checkpoint).toEqual(before);await expect(page.locator('[data-english]')).toHaveCount(0);
 // Actual mode selection saves only its own slot; return to the short run never resets it.
 await act('[data-td-new]');await act('[data-map-select="twin-bends"]');await expect(page.locator('.td-game')).toHaveAttribute('data-scenario-id','');const campaignRaw=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 await act('[data-td-tactics]');await act('[data-scenario-select="qinglan-intercept"]');expect((await saved(page)).checkpoint).toEqual(before);expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(campaignRaw);
 await act('[data-td-restart]');await expect(page.locator('[data-td-restart-dialog]')).toBeVisible();await act('[data-td-cancel-restart]');expect((await saved(page)).checkpoint).toEqual(before);
 await act('[data-td-restart]');await act('[data-td-confirm-restart]');await expect(page.locator('.td-slot--occupied')).toHaveCount(0);expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(campaignRaw);
 expect(errors).toEqual([]);writeFileSync(`${evidence}/mechanisms-${mode}.json`,JSON.stringify({mode,stateInjection:false,clockAcceleration:false,normalInterwaveRetry:true,checkpoint:before,errors},null,2));
});

test('@step5-recovery natural weak defense, loss, restore, different layout and victory',async({page},info)=>{
 test.skip(info.project.name!=='touch','Touch recovery complements the keyboard natural first-scenario run.');test.setTimeout(12*60_000);page.setDefaultTimeout(15000);mkdirSync(evidence,{recursive:true});
 const mode:InputMode='touch',act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 await page.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-core="1"]');await act('[data-core="2"]');await act('[data-td-fuse]');await act('[data-slot="7"]');const before=(await saved(page)).checkpoint;
 await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','lost',{timeout:120000});await page.screenshot({path:`${evidence}/natural-loss.png`,fullPage:true});
 const loss=(await saved(page)).summaries.at(-1);expect(loss.outcome).toBe('lost');expect(loss.leaks).toBeGreaterThan(0);
 await act('[data-td-result-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');expect((await saved(page)).checkpoint).toEqual(before);
 for(let wave=0;wave<3;wave++){await arrangeTacticsUI(page,mode,'qinglan-intercept','flame-wildwood');await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');await expect(page.locator('.td-game')).toHaveAttribute('data-phase',wave===2?'won':'ready',{timeout:120000});await expect(page.locator('.td-game')).toHaveAttribute('data-wave',String(wave+1));
  if(wave===0){const pair=(await saved(page)).summaries;expect(pair.map((v:{wave:number;outcome:string})=>[v.wave,v.outcome])).toEqual([[1,'lost'],[1,'held']]);expect(pair[0].leaks).toBeGreaterThan(pair[1].leaks);expect(pair[0].healthAfter).toBeLessThan(pair[1].healthAfter);await expect(page.locator('[data-td-tactics-summary]')).toBeVisible();for(const v of pair)await expect(page.locator('[data-td-tactics-summary]')).toContainText(`击败 ${v.kills}，漏怪 ${v.leaks}，城门 ${v.healthBefore} → ${v.healthAfter}`);writeFileSync(`${evidence}/same-wave-comparison.json`,JSON.stringify(pair,null,2));}
 }
 const victory=await saved(page);expect(victory.checkpoint.health).toBeGreaterThan(0);expect(victory.summaries.length).toBeLessThanOrEqual(2);await page.screenshot({path:`${evidence}/natural-recovery-won.png`,fullPage:true});
 writeFileSync(`${evidence}/natural-loss-recovery.json`,JSON.stringify({mode,stateInjection:false,clockAcceleration:false,before,loss,victory},null,2));
});

test('@step5-save direct short-run entry protects future bytes and never migrates the campaign',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Synthetic corrupt-storage fixture, separate from natural play.');
 const future='{"version":99,"keep":"future raw"}',legacy='{"version":2,"keep":"old raw"}';
 await page.addInitScript(({key,v2,future,legacy})=>{localStorage.setItem(key,future);localStorage.setItem(v2,legacy);},{key:TACTICS_SAVE_KEY,v2:V2_SAVE_KEY,future,legacy});
 await page.goto('./?play=hanzi-tower-defense&scenario=twin-lanes');await expect(page.locator('[data-td-save-note]')).toContainText('暂不可写');await page.locator('[data-td-restart]').click();await page.locator('[data-td-confirm-restart]').click();
 expect(await page.evaluate(k=>localStorage.getItem(k),TACTICS_SAVE_KEY)).toBe(future);expect(await page.evaluate(k=>localStorage.getItem(k),V2_SAVE_KEY)).toBe(legacy);expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBeNull();
});

test('@step5-layout short controls stay reachable at phone and tablet sizes',async({page},info)=>{
 test.skip(info.project.name!=='touch','Geometry in touch emulation.');
 await page.goto('./?play=hanzi-tower-defense&scenario=twin-lanes');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 for(const [width,height] of [[360,740],[390,844],[768,1024],[1024,768],[1024,1366],[1366,1024],[740,360]]){await page.setViewportSize({width,height});await criticalTargets(page,'.td-controls button,[data-td-tactics]',44);await criticalTargets(page,'[data-slot]',44);await criticalTargets(page,'[data-td-next]',48);}
});

test('@step5-speed real 1x/2x, paused zero progress and retry returns to preparation',async({page},info)=>{
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard',act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 await page.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-core="1"]');await act('[data-slot="0"]');await act('[data-td-next]');
 const elapsed=async()=>Number(await page.locator('.td-game').getAttribute('data-elapsed'));
 const start=await elapsed();await page.waitForTimeout(1600);const normal=await elapsed()-start;
 await act('[data-td-speed]');const fastStart=await elapsed();await page.waitForTimeout(1600);const fast=await elapsed()-fastStart;expect(fast/normal).toBeGreaterThan(1.6);expect(fast/normal).toBeLessThan(2.5);
 await act('[data-td-pause]');const paused=await elapsed();await act('[data-td-speed]');await page.waitForTimeout(500);expect(await elapsed()).toBe(paused);
 await act('[data-td-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');await expect(page.locator('.td-game')).toHaveAttribute('data-speed','1');
});

test('@step5-save two actual pages stop the stale writer',async({page,context},info)=>{
 test.skip(info.project.name!=='desktop','Browser storage fixture checks actual independent page writers.');
 await page.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const second=await context.newPage();await second.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(second.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await page.locator('[data-core="1"]').click();await page.locator('[data-slot="0"]').click();const raw=await page.evaluate(k=>localStorage.getItem(k),TACTICS_SAVE_KEY);
 await second.locator('[data-core="2"]').click();await second.locator('[data-slot="1"]').click();await expect(second.locator('[data-td-save-note]')).toContainText('暂不可写');expect(await page.evaluate(k=>localStorage.getItem(k),TACTICS_SAVE_KEY)).toBe(raw);await second.close();
});
