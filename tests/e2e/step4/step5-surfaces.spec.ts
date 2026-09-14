import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {activate,criticalTargets,fromHome,type InputMode} from './input-helpers';
import {shortClip} from './short-clip';
import {companionAction,companionReady,readCompanion} from '../hanzi-word-adventure/step5-helpers';
import {act} from '../../../games/hanzi-word-adventure/model';
import {ROOMS} from '../../../games/hanzi-word-adventure/rooms';
import {solve} from '../../../games/hanzi-word-adventure/solver';
import {TACTICS_SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
import {tacticsRegion} from '../hanzi-tower-defense/step5-input';

const evidence='tmp/tasks/GAME-CODEX-STEP5';
test('@step5-keypath new modes use ordinary inputs, restore and return across browsers',async({page},info)=>{
 test.skip(!['desktop','phone-390','firefox','webkit'].includes(info.project.name));
 const mode:InputMode=['phone-390','webkit'].includes(info.project.name)?'touch':'keyboard';
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await fromHome(page,mode,'adventure');await activate(page,'[data-hway-new]',mode);await activate(page,'[data-hway-chapter=companions]',mode);await companionReady(page);
 const room=ROOMS[15],result=solve(room,room.initial);expect(result.status).toBe('solved');let state=room.initial;
 for(const action of result.actions){await companionAction(page,action,mode==='touch'?'touch':'keyboard');state=act(room,state,action).state;expect((await readCompanion(page)).state).toEqual(state);}
 await expect(page.locator('.hway')).toHaveAttribute('data-won','true');
 if(mode==='keyboard'){await page.keyboard.press('z');await page.keyboard.press('h');await expect(page.locator('[data-hway-hint-box]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[data-hway-grid]')).toBeFocused();}
 else{await activate(page,'[data-hway-undo]',mode);await activate(page,'[data-hway-hint]',mode);await activate(page,'[data-hway-hint-close]',mode);}
 const saved=await readCompanion(page);await page.reload();await companionReady(page);expect(await readCompanion(page)).toEqual(saved);
 await activate(page,'[data-hway-exit]',mode);await expect(page.getByTestId('my-game-world')).toBeVisible();
 await activate(page,'[data-world-forest-link]',mode);await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await activate(page,'[data-td-tactics]',mode);await activate(page,'[data-scenario-select=qinglan-intercept]',mode);
 const control=(selector:string)=>activate(page,selector,mode,tacticsRegion(selector));
 await control('[data-core="1"]');await control('[data-core="2"]');await control('[data-td-fuse]');await control('[data-slot="0"]');
 const checkpoint=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).scenarios['qinglan-intercept'].checkpoint,TACTICS_SAVE_KEY);
 const finish=info.project.name==='desktop'?await shortClip(page,`${evidence}/clips/tactics`):null;
 await control('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
 await expect.poll(()=>page.locator('.td-game').getAttribute('data-kills'),{timeout:45000}).not.toBe('0');
 await control('[data-td-pause]');await control('[data-td-clear]');await control('[data-slot="0"]');await expect(page.locator('[data-td-stow]')).toBeDisabled();
 await control('[data-td-retry]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).scenarios['qinglan-intercept'].checkpoint,TACTICS_SAVE_KEY)).toEqual(checkpoint);
 if(finish)expect(await finish()).toBeGreaterThan(5);
 await control('[data-td-home]');await expect(page.getByTestId('my-game-world')).toBeVisible();expect(errors).toEqual([]);
});

test('@step5-geometry all companion rooms and tactical controls at seven sizes, candidate visual and ARIA',async({page},info)=>{
 test.skip(['firefox','webkit'].includes(info.project.name));mkdirSync(`${evidence}/surfaces`,{recursive:true});const rows:unknown[]=[];
 for(let index=0;index<5;index++){
  await page.goto('?play=hanzi-word-adventure&chapter=companions');await companionReady(page);
  // Each room's ordinary entry is its previous room completion. Keep one context and use real actions.
  for(let previous=0;previous<index;previous++){
   const journey=await readCompanion(page);if(journey.room>15+previous)continue;
   const room=ROOMS[journey.room],result=solve(room,journey.state);expect(result.status).toBe('solved');
   for(const action of result.actions)await companionAction(page,action,info.project.use.hasTouch?'touch':'keyboard');
   await activate(page,'[data-hway-next]',info.project.use.hasTouch?'touch':'keyboard');
  }
  await expect(page.locator('.hway')).toHaveAttribute('data-room',`companions-${index+1}`);
  rows.push({room:`companions-${index+1}`,targets:await criticalTargets(page,'[data-hway-cell], [data-hway-actor], [data-hway-move], [data-hway-primary], .hway-toolbar button')});
  const group=await page.locator('.hway-controls').evaluate(element=>{
   const selectors=['[data-hway-move]','[data-hway-primary]'];const boxes=selectors.flatMap(s=>[...element.querySelectorAll(s)]).map(e=>e.getBoundingClientRect());return Math.max(...boxes.map(r=>r.bottom))-Math.min(...boxes.map(r=>r.top));
  });expect(group).toBeLessThan(page.viewportSize()!.height-24);
  if(index===2){
   await page.locator('.hway').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${evidence}/surfaces/companions-${info.project.name}.png`,fullPage:true});
   const aria=await page.locator('.hway').ariaSnapshot(),path=`${evidence}/surfaces/companions-${info.project.name}.aria.txt`;
   if(process.env.STEP5_VISUAL==='establish')writeFileSync(path,aria);else if(process.env.STEP5_VISUAL==='verify')expect(aria).toBe(readFileSync(path,'utf8'));else writeFileSync(path,aria);
   if(process.env.STEP5_VISUAL)await expect(page).toHaveScreenshot('companions-room3.png',{fullPage:true,animations:'disabled'});
  }
 }
 await page.goto('?play=hanzi-tower-defense&scenario=twin-lanes');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 rows.push({scenario:'twin-lanes',targets:await criticalTargets(page,'[data-slot], .td-controls button, [data-td-tactics]')});
 await page.screenshot({path:`${evidence}/surfaces/tactics-${info.project.name}.png`,fullPage:true});
 const tacticsAria=await page.locator('.td-game').ariaSnapshot(),tacticsAriaPath=`${evidence}/surfaces/tactics-${info.project.name}.aria.txt`;
 if(process.env.STEP5_VISUAL==='verify')expect(tacticsAria).toBe(readFileSync(tacticsAriaPath,'utf8'));else writeFileSync(tacticsAriaPath,tacticsAria);
 if(process.env.STEP5_VISUAL)await expect(page).toHaveScreenshot('tactics-ready.png',{fullPage:true,animations:'disabled'});
 const viewport=page.viewportSize()!;await page.setViewportSize({width:Math.max(740,viewport.width),height:360});
 await page.goto('?play=hanzi-word-adventure&chapter=companions');await companionReady(page);await criticalTargets(page,'[data-hway-move], [data-hway-primary], .hway-toolbar button');
 expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,;]|$)/);
 await page.mouse.wheel(0,10000);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
 writeFileSync(`${evidence}/surfaces/${info.project.name}-geometry.json`,JSON.stringify({viewport,rows,lowHeightScroll:true},null,2));
});

test('@step5-video companion movement and role switching recorded without state injection',async({page},info)=>{
 test.skip(info.project.name!=='desktop');await page.goto('?play=hanzi-word-adventure&chapter=companions');await companionReady(page);
 const finish=await shortClip(page,`${evidence}/clips/companions`),room=ROOMS[15],solution=solve(room,room.initial);expect(solution.status).toBe('solved');
 for(const action of solution.actions)await companionAction(page,action,'keyboard');await page.keyboard.press('z');await page.keyboard.press('h');await page.keyboard.press('Escape');expect(await finish()).toBeGreaterThan(5);
});

for(const game of ['slider','target','pairing'] as const)test(`@step5-video ${game} ordinary action and recovery sample`,async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 if(game==='pairing'){await fromHome(page,'mouse','playtest');await activate(page,'a[href="?play=memory-card"]','mouse');await expect(page.getByTestId('memory-match')).toBeVisible();}
 else{await fromHome(page,'mouse','math');await activate(page,`[data-station-id=${game}] button`,'mouse');await expect(page.locator(game==='slider'?'[data-equation-board]':'[data-testid=target-cards]')).toBeVisible();}
 const finish=await shortClip(page,`${evidence}/clips/${game}-review`,12000,1);
 // Review footage holds actual UI states briefly; it never controls the game clock.
 const show=async(selector:string)=>{await activate(page,selector,'mouse');await page.waitForTimeout(500);};
 if(game==='slider'){
  await show('[data-control-direction=up]');await expect(page.locator('[data-move-count]')).toHaveText('1');
  await show('[data-control-direction=down]');await expect(page.locator('[data-move-count]')).toHaveText('2');
  await show('.equation-slider__actions button:nth-child(1)');await expect(page.locator('[data-move-count]')).toHaveText('1');
  await show('.equation-slider__actions button:nth-child(2)');await expect(page.locator('.equation-slider__hint')).toBeVisible();
 }else if(game==='target'){
  await show('[data-card-id=target-10-01-source-1]');await show('[data-card-id=target-10-01-source-2]');
  await show('[data-target-action="operator--"]');await expect(page.locator('[data-target-action=combine]')).toBeDisabled();
  await show('[data-target-action=swap]');await show('[data-target-action=combine]');
  await expect(page.locator('[data-card-id=target-10-01-combined-1]')).toHaveAttribute('data-card-value','1');
  await show('[data-target-action=undo]');await expect(page.getByTestId('target-cards').locator('button')).toHaveCount(4);
 }else{
  const cards=await page.locator('[data-card-id]').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-card-id')!,relation:e.getAttribute('data-relation-id')!})));
  const first=cards[0],different=cards.find(c=>c.relation!==first.relation)!;
  for(const card of [first,different])await show(`[data-card-id="${card.id}"]`);
  await expect(page.locator(`[data-card-id="${first.id}"]`)).toHaveAttribute('data-open','false');
  for(const relation of [...new Set(cards.map(c=>c.relation))].slice(0,2))for(const card of cards.filter(c=>c.relation===relation))await show(`[data-card-id="${card.id}"]`);
 }
 expect(await finish()).toBeGreaterThan(5);
 if(game==='pairing'){await activate(page,'.memory-match header a','mouse');await activate(page,'.classic-hub-world-nav a','mouse');}
 else{await activate(page,'[data-return-map]','mouse');await activate(page,'.math-world__header a','mouse');}
 await expect(page.getByTestId('my-game-world')).toBeVisible();
});
