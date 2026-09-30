import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {activate,criticalTargets,fromHome,type InputMode} from '../step4/input-helpers';
import {tacticsItems,tacticsRegion} from './step5-input';
import {TACTICS_SAVE_KEY,SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
import type {CoreKind} from '../../../games/hanzi-tower-defense/content';
const evidence='tmp/tasks/SHORT-MISSIONS/evidence';
const modes=(touch:boolean,id:string):InputMode=>touch?'touch':id==='qinglan-repair'?'mouse':'keyboard';
function actions(page:Page,mode:InputMode){
 const act=(selector:string)=>activate(page,selector,mode,selector.startsWith('[data-td-pack=')?'[data-td-pack]':selector.startsWith('[data-td-goal=')?'[data-td-goal]':tacticsRegion(selector));
 const clear=()=>mode==='keyboard'?page.keyboard.press('Escape'):act('[data-td-clear]');
 const find=async(kind:CoreKind)=>{const c=(await tacticsItems(page)).find(c=>c.kind===kind);if(!c)throw Error(`Missing ${kind}`);return c;};
 const merge=async(a:CoreKind,b:CoreKind)=>{await clear();const first=await find(a);await act(first.selector);const second=(await tacticsItems(page)).find(c=>c.kind===b&&c.id!==first.id)!;await act(second.selector);await act('[data-td-fuse]');};
 const place=async(kind:CoreKind,slot:number)=>{await clear();await act((await find(kind)).selector);await act(`[data-slot="${slot}"]`);};
 return {act,clear,find,merge,place};
}
for(const id of ['qinglan-elite','qinglan-repair','qinglan-packs'] as const)test(`${id} real input full short run`,async({page},info)=>{
 mkdirSync(evidence,{recursive:true});const mode=modes(info.project.name==='touch',id),{act,clear,merge,place,find}=actions(page,mode);
 const errors:string[]=[],external:string[]=[],localBlobs:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const url=new URL(r.url());if(url.protocol==='blob:'&&url.origin==='http://127.0.0.1:5299')localBlobs.push(r.url());else if(url.protocol!=='data:'&&url.origin!=='http://127.0.0.1:5299')external.push(r.url());});
 await fromHome(page,mode,'forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const campaignRaw=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 await act('[data-td-tactics]');await act(`[data-scenario-select="${id}"]`);
 await expect(page.locator('[data-td-challenge-rule]')).toBeVisible();await expect(page.locator('[data-td-challenge-foes]')).toContainText('第 3 波');
 if(id==='qinglan-elite'){
  await expect(page.locator('[data-td-next]')).toBeDisabled();
  await act('[data-td-pack="ember"]');await place('fire',0);await act('[data-td-pack="leaf"]');expect((await tacticsItems(page)).filter(c=>c.slot!==null)).toHaveLength(0);
  await act(`[data-td-pack="${mode==='touch'?'leaf':'ember'}"]`);
  await place('fire',0);await place('wood',1);await place('water',3);
  const before=await tacticsItems(page);await clear();const mountain=await find('mountain');await act(mountain.selector);await act('[data-slot="6"]');
  await expect(page.locator('[data-td-feedback]')).toContainText('收回一座');expect(await tacticsItems(page)).toEqual(before);await expect(page.locator(mountain.selector)).toHaveAttribute('aria-pressed','true');
  for(const c of (await tacticsItems(page)).filter(c=>c.slot!==null)){await clear();await act(c.selector);await act('[data-td-stow]');}
  await merge('fire','mountain');await merge('wood','wood');await merge('water','wood');await place('volcano',0);await place('grove',1);await place('wash',3);
  await expect(page.locator('[data-td-deployed-count]')).toContainText('3／3');
 }else if(id==='qinglan-repair'){
  await act('[data-td-change-variation]');await expect(page.locator('[data-slot="5"]')).toHaveAttribute('data-kind','grove');
  await clear();await act('[data-slot="5"]');await act('[data-slot="1"]');await expect(page.locator('[data-slot="1"]')).toHaveAttribute('data-kind','grove');
  await merge('water','wood');await place('wash',3);
 }else{
  await expect(page.locator('[data-td-next]')).toBeDisabled();await act(`[data-td-goal="${mode==='touch'?'wood-water':'fire-mountain'}"]`);
  await merge('fire','mountain');await merge('wood','wood');
  if(mode==='touch'){await merge('fire','fire');await place('volcano',0);await place('grove',1);await place('flame',3);}
  else{await merge('water','wood');await place('volcano',0);await place('grove',1);await place('wash',3);}
  await clear();await act((await find(mode==='touch'?'water':'mountain')).selector);await expect(page.locator('[data-td-pack-consequence]')).toBeVisible();await clear();
 }
 await criticalTargets(page,'[data-td-pack], [data-td-goal], [data-td-change-variation], [data-td-next]');
 await page.keyboard.press('Control+Home');await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 await page.screenshot({path:`${evidence}/${id}-${mode}-ready.png`,fullPage:true});
 await page.screenshot({path:`${evidence}/${id}-${mode}-viewport.png`});
 const records:unknown[]=[];
 for(let wave=0;wave<3;wave++){
  await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
  if(wave===0){await act('[data-td-pause]');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');await act('[data-td-pause]');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','false');await act('[data-td-pause]');await act('[data-td-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');await act('[data-td-next]');await act('[data-td-speed]');}
  await expect.poll(()=>page.locator('.td-game').getAttribute('data-phase'),{timeout:100000,intervals:[1000]}).not.toBe('battle');
  await expect(page.locator('.td-game')).toHaveAttribute('data-phase',wave===2?'won':'ready');
  records.push(await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)!).scenarios[id],{key:TACTICS_SAVE_KEY,id}));
  if(wave===0){await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-wave','1');await act('[data-td-speed]');}
 }
 await expect(page.locator('#td-result-title')).toContainText('守住');
 if(id==='qinglan-packs')await expect(page.locator('[data-td-result-objectives]')).toContainText('行囊 · 已装好');
 await criticalTargets(page,'[data-td-result-retry], [data-td-replay], [data-td-result-change], [data-td-result-home]');
 await page.screenshot({path:`${evidence}/${id}-${mode}-won.png`,fullPage:true});
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(campaignRaw);expect(errors).toEqual([]);expect(external).toEqual([]);
 const beforeReplay=(records[2] as {checkpoint:{challenge:unknown}}).checkpoint.challenge;
 await act('[data-td-replay]');await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');
 expect(await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)!).scenarios[id].checkpoint.challenge,{key:TACTICS_SAVE_KEY,id})).toEqual(beforeReplay);
 await act('[data-td-home]');await expect(page.locator('[data-world-forest-link]')).toBeVisible();
 writeFileSync(`${evidence}/${id}-${mode}-browser.json`,JSON.stringify({id,mode,records,errors,external,localBlobRequests:localBlobs.length,stateInjection:false,clockAcceleration:false,publicSpeed:2,physicalDevice:false},null,2));
});

test('reasonable first-wave mistake, failure and recovery use real buttons',async({page},info)=>{
 const mode:InputMode=info.project.name==='touch'?'touch':'mouse',{act,merge,place}=actions(page,mode);
 await page.goto('/?play=hanzi-tower-defense&scenario=qinglan-elite');await act('[data-td-pack="ember"]');await place('water',7);await act('[data-td-next]');await act('[data-td-speed]');
 await expect(page.locator('.td-game')).toHaveAttribute('data-phase','lost',{timeout:100000});await act('[data-td-result-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 await act('[data-td-clear]');await act('[data-slot="7"]');await act('[data-td-stow]');await merge('fire','mountain');await merge('wood','wood');await merge('water','wood');await place('volcano',0);await place('grove',1);await place('wash',3);
 await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready',{timeout:100000});await expect(page.locator('.td-game')).toHaveAttribute('data-wave','1');
});

test('new controls remain reachable at compact phones and tablet orientations',async({page},info)=>{
 for(const size of [{width:360,height:740},{width:768,height:1024},{width:1024,height:768},{width:844,height:390}]){
  await page.setViewportSize(size);await page.goto('/?play=hanzi-tower-defense&scenario=qinglan-packs');
  await expect(page.locator('[data-td-goal]')).toHaveCount(2);
  await criticalTargets(page,'[data-td-goal]');await activate(page,'[data-td-goal="wood-water"]',info.project.name==='touch'?'touch':'mouse');await expect(page.locator('[data-td-next]')).toBeEnabled();
 }
});

test('keyboard variation and preparation focus use native activation',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Keyboard case on desktop Chromium.');
 await page.goto('/?play=hanzi-tower-defense&scenario=qinglan-repair');
 await activate(page,'[data-td-change-variation]','keyboard',undefined,'Space');
 await expect(page.locator('[data-slot="5"]')).toHaveAttribute('data-kind','grove');
 await expect(page.locator('[data-td-next]')).toBeFocused();
 await activate(page,'[data-td-change-variation]','keyboard');
 await expect(page.locator('[data-slot="7"]')).toHaveAttribute('data-kind','grove');
 await activate(page,'[data-td-tactics]','keyboard');await activate(page,'[data-scenario-select="qinglan-packs"]','keyboard');
 await expect(page.locator('[data-td-goal="fire-mountain"]')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.locator('[data-td-goal="wood-water"]')).toBeFocused();await page.keyboard.press('Space');
 await expect(page.locator('[data-td-goal="wood-water"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-td-goal="wood-water"]')).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.locator('[data-td-goals]:focus-within')).toHaveCount(0);
});
