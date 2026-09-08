import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {activate,criticalTargets,fromHome,type InputMode} from '../step4/input-helpers';
import {SLOTS} from '../../../games/hanzi-tower-defense/maps';
import {CORES} from '../../../games/hanzi-tower-defense/content';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP4/tower';
test('STEP4 Qinglan moved posts keep true ranges, ordinary relocation and all-width separation',async({page},info)=>{
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard';
 const act=(selector:string,region?:string)=>activate(page,selector,mode,region);
 mkdirSync(evidence,{recursive:true});
 await fromHome(page,mode,'forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-pause]');
 for(const slot of [2,6,7]){
  const source=page.locator('.td-slot--occupied').filter({has:page.locator('.td-slot-glyph',{hasText:/^火$/})}).first();
  const sourceSlot=await source.getAttribute('data-slot');await act(`[data-slot="${sourceSlot}"]`,'[data-slot]');await act('[data-td-stow]');
  const core=await page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^火$/})}).first().getAttribute('data-core');
  await act(`[data-core="${core}"]`,'[data-core]');await act(`[data-slot="${slot}"]`,'[data-slot]');
  await expect(page.locator(`[data-slot="${slot}"]`)).toHaveAttribute('data-kind','fire');
  await act('[data-td-clear]');await act('[data-td-inspect]');await act(`[data-slot="${slot}"]`,'[data-slot]');
  const ring=page.locator('[data-range-mode="inspect"]');await expect(ring).toHaveAttribute('cx',String(SLOTS[slot].x));await expect(ring).toHaveAttribute('cy',String(SLOTS[slot].y));await expect(ring).toHaveAttribute('r',String(CORES.fire.range));
  await page.locator('[data-td-board]').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/qinglan-post-${slot+1}-${mode}.png`});
  await act('[data-td-inspect]');
 }
 const rows=[];
 for(const width of [360,390,741,768,1000,1024,1025,1366,1440]){
  await page.setViewportSize({width,height:width<741?844:1000});
  rows.push({width,targets:await criticalTargets(page,'[data-slot], .td-controls button')});
 }
 writeFileSync(`${evidence}/qinglan-placement-${mode}.json`,JSON.stringify({mode,trueModelRadii:true,rows},null,2));
});
