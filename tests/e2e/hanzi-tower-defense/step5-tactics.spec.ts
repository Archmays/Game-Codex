import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {activate,fromHome,keyReach,type InputMode} from '../step4/input-helpers';
import {shortClip} from '../step4/short-clip';
import {CORES,RECIPES,type CoreKind} from '../../../games/hanzi-tower-defense/content';
import {SCENARIOS,SCENARIO_IDS,type ScenarioId} from '../../../games/hanzi-tower-defense/tactics';
import {TACTICS_SAVE_KEY,SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
import {prioritiesFor,orderFor,positionsFor,type TacticsBuild} from '../../../tools/hanzi-tower-defense/step5-balance';
import {newTactics} from '../../../games/hanzi-tower-defense/model';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP5/tower';
import {arrangeTacticsUI,tacticsRegion} from './step5-input';
for(const [index,id] of SCENARIO_IDS.entries())test(`@step5-natural ${id} ordinary three-wave victory`,async({page},info)=>{
 const mode:InputMode=index%2===0?'keyboard':'touch';test.skip((mode==='keyboard')!==(info.project.name==='desktop'),'Six scenarios partitioned across keyboard and touch; mechanism tests cover both.');
 test.setTimeout(15*60_000);page.setDefaultTimeout(15_000);mkdirSync(evidence,{recursive:true});
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('framenavigated',f=>{if(f===page.mainFrame())console.log('NAVIGATION',f.url());});const act=(selector:string)=>activate(page,selector,mode,tacticsRegion(selector));
 await fromHome(page,mode,'forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const campaignRaw=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 await act('[data-td-tactics]');await act(`[data-scenario-select="${id}"]`);await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 await expect(page.locator('[data-td-tactics-rules]')).toContainText('暂停仍在战中');
 const build:TacticsBuild=mode==='keyboard'?'volcano-grove':'flame-wildwood',records:unknown[]=[];const started=Date.now();
 for(let wave=0;wave<3;wave++){
  if(mode==='keyboard')await keyReach(page,'[data-slot="0"]','[data-slot]');
  await arrangeTacticsUI(page,mode,id,build);
  if(wave===0)await page.screenshot({path:`${evidence}/${id}-${mode}-layout.png`,fullPage:true});
  await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');await expect(page.locator('.td-game')).toHaveAttribute('data-speed','1');
  if(mode==='keyboard')await expect(page.locator('[data-td-pause]')).toBeFocused();
  const stop=id==='beacon-crowd'&&wave===1?await shortClip(page,`${evidence}/tactics-clip`):null;
  await expect.poll(()=>page.locator('.td-game').getAttribute('data-phase'),{timeout:120000,intervals:[1000]}).not.toBe('battle');
  await expect(page.locator('.td-game')).toHaveAttribute('data-phase',wave===2?'won':'ready');
  await expect(page.locator('.td-game')).toHaveAttribute('data-wave',String(wave+1));
  if(stop)expect(await stop()).toBeGreaterThan(5);
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),TACTICS_SAVE_KEY);records.push(saved.scenarios[id]);expect(saved.scenarios[id].checkpoint.wave).toBe(wave+1);
  writeFileSync(`${evidence}/${id}-${mode}-progress.json`,JSON.stringify(records,null,2));
  console.log(`${id}/${mode}: wave ${wave+1}/3 complete`);
  if(wave===0){await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-wave','1');}
 }
 await page.screenshot({path:`${evidence}/${id}-${mode}-won.png`,fullPage:true});expect(errors).toEqual([]);
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(campaignRaw);
 await act('[data-td-result-home]');await expect(page.locator('[data-world-forest-link]')).toBeVisible();
 writeFileSync(`${evidence}/${id}-${mode}-natural.json`,JSON.stringify({id,mode,build,stateInjection:false,clockAcceleration:false,wallSeconds:Math.round((Date.now()-started)/1000),records,errors},null,2));
});
