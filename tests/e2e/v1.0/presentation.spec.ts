import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {activate,criticalTargets,keyReach,type InputMode} from '../step4/input-helpers';
import {arrangeTacticsUI,tacticsItems,tacticsRegion} from '../hanzi-tower-defense/step5-input';
import {PRESENTATION_KEY} from '../../../packages/presentation/settings';
import {SAVE_KEY as ADVENTURE_SAVE} from '../../../games/hanzi-word-adventure/save';
import {TACTICS_SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
import {DEFENSE_MAPS,MAP_IDS} from '../../../games/hanzi-tower-defense/maps';
import {MAP} from '../../../games/hanzi-tower-defense/model';
const evidence=process.env.GAME_CODEX_EVIDENCE_ROOT??'tmp/tasks/GAME-CODEX-V1.0';

test('@v1-phase-clear ready and paused status leave every tower glyph and number clear',async({page},info)=>{
 test.skip(!['desktop','phone-360','phone-390','firefox','webkit'].includes(info.project.name));
 const mode:InputMode=info.project.name==='desktop'?'keyboard':info.project.use.hasTouch?'touch':'mouse';
 const act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 await page.goto('?play=hanzi-tower-defense&scenario=beacon-crowd');
 await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-guide-close]');await arrangeTacticsUI(page,mode,'beacon-crowd','volcano-grove');
 const contrast=async(selector:string)=>page.locator(selector).evaluate(el=>{
  const style=getComputedStyle(el),luminance=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
 if(mode!=='touch'){
  await page.locator('[data-td-continue]').hover();expect(await contrast('[data-td-continue]'),'gold menu action remains readable while hovered').toBeGreaterThanOrEqual(4.5);await page.mouse.move(0,0);
 }
 for(const phase of ['ready','paused']){
  if(phase==='paused'){await act('[data-td-next]');await act('[data-td-pause]');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');}
  const overlaps=await page.locator('[data-td-board]').evaluate(board=>{
   const notes=[...board.querySelectorAll<HTMLElement>('.td-road-entry,.td-field-message')].filter(e=>!e.hidden).map(e=>({text:e.textContent,rect:e.getBoundingClientRect()}));
   return [...board.querySelectorAll('.td-slot-glyph,.td-slot small')].flatMap(label=>{
    const r=label.getBoundingClientRect();return notes.filter(({rect:n})=>r.left<n.right&&r.right>n.left&&r.top<n.bottom&&r.bottom>n.top).map(note=>({glyph:label.textContent,note:note.text}));
   });
  });
  expect(overlaps,'phase decoration must not cover a real tower glyph or slot number').toEqual([]);
  if(phase==='paused')expect(await contrast('[data-td-pause]'),'pause text remains readable after real activation').toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('[data-td-enemies]')).toContainText(phase==='ready'?'波间布阵':'已暂停');
  await page.locator('[data-td-board]').scrollIntoViewIfNeeded();
  mkdirSync(`${evidence}/phase-clear`,{recursive:true});await page.screenshot({path:`${evidence}/phase-clear/${info.project.name}-${phase}.png`,fullPage:true});
 }
});

test('@v1-hud live status and native speed/pause remain reachable after scrolling',async({page},info)=>{
 const mode:InputMode=info.project.name==='desktop'?'keyboard':info.project.use.hasTouch?'touch':'mouse';
 const act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 await page.goto('?play=hanzi-tower-defense&scenario=twin-lanes');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-guide-close]');await act('[data-core="1"]');await act('[data-core="2"]');
 await keyReach(page,'[data-td-fuse]');
 const hud=page.locator('.td-ribbon'),sticky=page.viewportSize()!.height>540;
 if(sticky){const bar=(await hud.boundingBox())!;expect(await page.locator('[data-td-board]').evaluate(e=>e.getBoundingClientRect().bottom)).toBeGreaterThan(bar.y+bar.height);}
 await act('[data-td-fuse]');await act('[data-slot="0"]');await act('[data-td-next]');
 await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
 await act('.td-help > summary');await page.keyboard.press('End');
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
 if(sticky){
  const box=(await hud.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(-1);expect(box.height).toBeLessThan(104);expect(await hud.evaluate(e=>getComputedStyle(e).position)).toBe('sticky');
  for(const selector of ['[data-td-wave]','[data-td-health]','[data-td-pause]','[data-td-speed]'])await expect(page.locator(selector)).toBeInViewport();
 }else expect(await hud.evaluate(e=>getComputedStyle(e).position)).toBe('static');
 await act('[data-td-pause]');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');
 await act('[data-td-speed]');await expect(page.locator('.td-game')).toHaveAttribute('data-speed','2');
 await activate(page,'[data-td-speed]',mode,undefined,'Space');await expect(page.locator('.td-game')).toHaveAttribute('data-speed','1');
 await criticalTargets(page,'.td-live-controls button',48);
 await keyReach(page,'[data-slot="0"]','[data-slot]');
 await criticalTargets(page,'[data-slot="0"]');
 const target=(await page.locator('[data-slot="0"]').boundingBox())!,bar=(await hud.boundingBox())!;
 if(sticky)expect(target.y).toBeGreaterThanOrEqual(bar.y+bar.height-1);
 mkdirSync(`${evidence}/visual`,{recursive:true});await page.screenshot({path:`${evidence}/visual/hud-${info.project.name}.png`,fullPage:true});
});

test('@v1-endpoint gate foot meets the real path on initial entry and reload',async({page},info)=>{
 test.skip(!['desktop','phone-390','tablet-768'].includes(info.project.name));
 for(const id of MAP_IDS){
  await page.goto(`?play=hanzi-tower-defense&map=${id}`);
  for(let pass=0;pass<2;pass++){
   if(pass)await page.reload();await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
   const endpoint=DEFENSE_MAPS[id].paths[0].at(-1)!;
   const geometry=await page.locator('[data-td-board]').evaluate(board=>{
    const b=board.getBoundingClientRect(),gate=board.querySelector('[data-td-gate]')!.getBoundingClientRect();
    const note=board.querySelector('.td-slot:last-child small')!.getBoundingClientRect();
    return {left:b.left+board.clientLeft,top:b.top+board.clientTop,width:board.clientWidth,height:board.clientHeight,x:gate.left+gate.width*.5,y:gate.top+gate.height*.93,noteClear:note.right<=gate.left||note.left>=gate.right||note.bottom<=gate.top||note.top>=gate.bottom};
   });
   expect(Math.abs(geometry.x-(geometry.left+geometry.width*endpoint.x/MAP.width))).toBeLessThan(2);
   expect(Math.abs(geometry.y-(geometry.top+geometry.height*endpoint.y/MAP.height))).toBeLessThan(2);
   expect(geometry.noteClear,'tower number must not label the castle').toBe(true);
  }
 }
});

test('@v1-settings repeated management cancel restores focus and preserves progress',async({page},info)=>{
 test.skip(!['desktop','phone-390','firefox','webkit'].includes(info.project.name));
 const mode:InputMode=info.project.name==='desktop'?'keyboard':info.project.use.hasTouch?'touch':'mouse';
 for(const owner of ['td','hway']){
  const route=owner==='td'?'?play=hanzi-tower-defense&scenario=twin-lanes':'?play=hanzi-word-adventure&chapter=companions';
  await page.goto(route);await expect(page.locator(`[data-${owner}-canvas]`)).toHaveAttribute('data-ready','true');
  const reset=`[data-${owner}-${owner==='td'?'restart':'reset'}]`,key=owner==='td'?TACTICS_SAVE_KEY:ADVENTURE_SAVE;
  const before=await page.evaluate(k=>localStorage.getItem(k),key);
  for(let n=0;n<2;n++){
   await activate(page,reset,mode);await expect(page.locator(`[data-${owner}-cancel-restart]`)).toBeVisible();
   if(mode==='keyboard'&&n===0)await page.keyboard.press('Escape');else await activate(page,`[data-${owner}-cancel-restart]`,mode);
   await expect(page.locator(`[data-${owner}-settings-dialog]`)).toBeVisible();await expect(page.locator(reset)).toBeFocused();
   expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(before);
   await activate(page,`[data-${owner}-settings-close]`,mode);
  }
 }
});
test('@v1-surface real tower composition, illustrated states, sound settings and recovery',async({page},info)=>{
 const mode:InputMode=info.project.name==='desktop'?'keyboard':info.project.use.hasTouch?'touch':'mouse';
 const act=(s:string)=>activate(page,s,mode,tacticsRegion(s));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./?play=hanzi-tower-defense&scenario=qinglan-intercept');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const title=await page.locator('.td-brand h1').evaluate(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)}));
 expect(title.height,'product name must remain readable as a horizontal heading').toBeLessThan(title.font*2);
 await act('[data-td-guide-close]');await arrangeTacticsUI(page,mode,'qinglan-intercept','volcano-grove');
 const items=await tacticsItems(page);expect(items.some(i=>i.kind==='volcano')).toBe(true);
 await expect.poll(()=>page.locator('.td-slot--occupied img').evaluateAll(images=>images.every(i=>(i as HTMLImageElement).naturalWidth===256))).toBe(true);
 await act('[data-td-next]');await expect.poll(()=>page.locator('[data-english]').count(),{timeout:30000}).toBeGreaterThan(0);
 await act('[data-td-pause]');await act('[data-english="1"]');await act(items.find(i=>i.kind==='volcano')!.selector);await act('[data-td-equip]');
 await expect(page.locator('[data-resonant=true]')).toHaveCount(1);
 await expect(page.locator('.td-slot[data-resonant=true] img')).toHaveJSProperty('naturalWidth',256);
 for(const glyph of await page.locator('.td-slot--word .td-slot-glyph').all()){
  const size=await glyph.evaluate(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)}));expect(size.height,'whole word plate must stay on one line without covering its apparatus').toBeLessThan(size.font*2);
 }
 const rects=await criticalTargets(page,'.td-controls button, .td-live-controls button,.td-slot,.td-core,.td-equipment-actions button:not([hidden])');
 mkdirSync(`${evidence}/visual`,{recursive:true});await page.screenshot({path:`${evidence}/visual/tower-${info.project.name}.png`,fullPage:true});
 await act('[data-td-settings]');await expect(page.locator('[data-td-settings-dialog]')).toBeVisible();
 await act('[data-presentation-low]');await expect(page.locator('.td-game')).toHaveAttribute('data-low-performance','true');
 const volume=page.locator('[data-presentation-music]');
 await expect(volume).toHaveAttribute('type','range');await act('[data-td-mute]');await expect(page.locator('[data-td-mute]')).toHaveAttribute('aria-pressed','true');
 await act('[data-td-settings-close]');await page.reload();await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),PRESENTATION_KEY);expect(saved.tower.guideSeen).toBe(true);expect(saved.tower.lastContent).toBe('qinglan-intercept');
 writeFileSync(`${evidence}/visual/tower-${info.project.name}-geometry.json`,JSON.stringify({mode,rects,errors},null,2));expect(errors).toEqual([]);
});
test('@v1-surface adventure fast actions, actor and light, menu and settings',async({page},info)=>{
 const mode:InputMode=info.project.name==='desktop'?'keyboard':info.project.use.hasTouch?'touch':'mouse';const act=(s:string)=>activate(page,s,mode);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./?play=hanzi-word-adventure&chapter=companions');await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');
 if(mode==='keyboard'){await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('q');await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('z');}
 else {await act('[data-hway-primary]');await act('[data-hway-move=right]');await act('[data-hway-actor=friend]');await act('[data-hway-primary]');await act('[data-hway-move=right]');await act('[data-hway-undo]');}
 await expect(page.locator('.hway')).toHaveAttribute('data-active','friend');await expect(page.locator('[data-hway-hand]')).toHaveText('明');
 const rects=await criticalTargets(page,'.hway-direction button,.hway-primary button:not([hidden]),.hway-toolbar button,.hway-companions button');
 mkdirSync(`${evidence}/visual`,{recursive:true});await page.screenshot({path:`${evidence}/visual/adventure-${info.project.name}.png`,fullPage:true});
 await act('[data-hway-settings]');await act('[data-presentation-low]');await act('[data-hway-settings-close]');
 await act('[data-hway-saves]');await expect(page.locator('[data-hway-resume]')).toContainText('结伴归途');await act('[data-hway-resume]');
 await expect(page.locator('[data-hway-hand]')).toHaveText('明');await expect(page.locator('.hway')).toHaveAttribute('data-low-performance','true');
 writeFileSync(`${evidence}/visual/adventure-${info.project.name}-geometry.json`,JSON.stringify({mode,rects,errors},null,2));expect(errors).toEqual([]);
});
test('@v1-recovery blocked artwork recovers through real retry without new checkpoint',async({page},info)=>{
 test.skip(info.project.name!=='desktop');let blocked=true;await page.route('**/assets/v1.0/tower/*.webp',route=>blocked?route.abort():route.continue());
 await page.goto('./?play=hanzi-tower-defense&map=twin-bends');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await expect(page.locator('[data-td-art-retry]')).toBeVisible();
 const before=await tacticsItems(page);blocked=false;await page.locator('[data-td-art-retry]').click();await expect(page.locator('[data-td-art-retry]')).toBeHidden();expect(await tacticsItems(page)).toEqual(before);
 await expect(page.locator('.td-slot--occupied img')).toHaveJSProperty('naturalWidth',256);
});
