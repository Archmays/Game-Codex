import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {activate,fromHome,keyReach,criticalTargets,type InputMode} from '../step4/input-helpers';
import {SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP4/tower';
test('STEP4 material arrows follow rendered rows after viewport rotation',async({page},info)=>{
 mkdirSync(evidence,{recursive:true});
 await fromHome(page,'keyboard','forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await activate(page,'[data-td-new]','keyboard');await activate(page,'[data-map-select="twin-bends"]','keyboard');
 const originalSave=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),rows=[];
 const sizes=info.project.name==='touch'?[{width:390,height:844},{width:844,height:390},{width:360,height:740}]:[{width:1440,height:1000},{width:768,height:1024},{width:1024,height:768}];
 for(const viewport of sizes){
  await page.setViewportSize(viewport);await keyReach(page,'[data-core]','[data-core]');await page.keyboard.press('Home');
  const items=await page.locator('[data-core]').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-core')!,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
  const first=items[0],below=items.find(e=>e.y>first.y+1&&Math.abs(e.x-first.x)<1);expect(below,'a material in the next visual row').toBeDefined();
  await page.keyboard.press('ArrowDown');await expect(page.locator(`[data-core="${below!.id}"]`)).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(page.locator(`[data-core="${first.id}"]`)).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('[data-td-bag]:focus-within')).toHaveCount(0);
  rows.push({viewport,first,below});
 }
 expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(originalSave);
 await expect(page.locator('[data-core][aria-pressed="true"]')).toHaveCount(0);
 writeFileSync(`${evidence}/material-grid-${info.project.name}.json`,JSON.stringify({rows,actualKeysOnly:true,saveUnchanged:true},null,2));
});

test('STEP4 regions, native activation, inspect-only, map saves/reset and tablet geometry',async({page},info)=>{
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard',act=(selector:string,region?:string,key?:string)=>activate(page,selector,mode,region,key);mkdirSync(evidence,{recursive:true});
 await fromHome(page,mode,'forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-new]');await act('[data-map-select="twin-bends"]');
 await expect(page.locator('.td-game')).toHaveAttribute('data-map-id','twin-bends');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 await act('[data-core="3"]','[data-core]','Space');await expect(page.locator('[data-core="3"]')).toHaveAttribute('aria-pressed','true');
 if(mode==='keyboard'){
  await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await expect(page.locator('[data-core="3"]')).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Space');await expect(page.locator('[data-core="3"]')).toHaveAttribute('aria-pressed','true');
 }
 await act('[data-td-inspect]');await act('[data-slot="0"]','[data-slot]');await expect(page.locator('[data-core="3"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-range-kind="fire"]')).toHaveCount(1);
 await act('[data-td-inspect]');await act('[data-td-clear]');
 await act('[data-core="3"]','[data-core]');await act('[data-core="4"]','[data-core]');await act('[data-td-fuse]');
 const grove=await page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^林$/})}).evaluate(e=>e.getAttribute('data-core'));
 await act('[data-core="7"]','[data-core]');await expect(page.locator('[data-structure="pyramid"] b')).toHaveText(['木','林']);await act('[data-td-fuse]');
 const canopy=await page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^森$/})}).evaluate(e=>e.getAttribute('data-core'));expect(canopy).not.toBe(grove);
 await act('[data-td-clear]');await act('[data-core="8"]','[data-core]');await act('[data-core="9"]','[data-core]');await act('[data-td-fuse]');await act(`[data-core="${canopy}"]`,'[data-core]');await expect(page.locator('[data-structure="word"] b')).toHaveText(['森','林']);await act('[data-td-fuse]');
 await act('[data-td-clear]');await act('[data-slot="0"]','[data-slot]');await act('[data-td-stow]');
 const forest=await page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^森林$/})}).evaluate(e=>e.getAttribute('data-core'));await act(`[data-core="${forest}"]`,'[data-core]');await act('[data-slot="0"]','[data-slot]');
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);
 await act('[data-td-next]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
 if(mode==='keyboard'){await expect(page.locator('[data-td-pause]')).toBeFocused();await page.keyboard.press('p');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');await page.keyboard.press('p');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','false');}
 await expect.poll(()=>page.locator('.td-game').getAttribute('data-kills'),{timeout:30000}).not.toBe('0');
 await act('[data-td-new]');await act('[data-map-select="beacon-keep"]');await expect(page.locator('.td-game')).toHaveAttribute('data-map-id','beacon-keep');
 await act('[data-td-continue]');await act('[data-map-select="twin-bends"]');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(after.maps['twin-bends'].checkpoint).toEqual(before.maps['twin-bends'].checkpoint);
 await act('[data-td-restart]');if(mode==='keyboard'){await page.keyboard.press('Escape');await expect(page.locator('[data-td-restart-dialog]')).not.toBeVisible();await expect(page.locator('[data-td-restart]')).toBeFocused();await act('[data-td-restart]');}
 await act('[data-td-confirm-restart]');await expect(page.locator('[data-slot="0"]')).toContainText('火');await expect(page.locator('[data-core]')).toHaveCount(11);
 const reset=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(reset.maps['twin-bends'].unlocked).toEqual([]);expect(reset.maps['beacon-keep']).toEqual(after.maps['beacon-keep']);expect(reset.maps['qinglan-pass']).toEqual(after.maps['qinglan-pass']);
 const geometry=[];for(const viewport of info.project.name==='touch'?[{width:360,height:780},{width:390,height:844},{width:768,height:1024},{width:1024,height:768}]:[{width:1440,height:1000},{width:768,height:1024},{width:1024,height:768},{width:1024,height:600}]){await page.setViewportSize(viewport);geometry.push({viewport,targets:await criticalTargets(page,'[data-slot], [data-core], .td-controls button')});}
 await page.setViewportSize(info.project.name==='touch'?{width:390,height:844}:{width:1440,height:1000});await page.screenshot({path:`${evidence}/step4-controls-${mode}.png`,fullPage:true});await act('[data-td-home]');await expect(page.locator('[data-world-forest-link]')).toBeVisible();
 writeFileSync(`${evidence}/step4-controls-${mode}.json`,JSON.stringify({mode,geometry,resetPreservesOtherMaps:true,unfinishedWaveRollsBack:true,actualKeysOnly:mode==='keyboard'},null,2));
});

// Adversarial lifecycle event test, separate from the real-key/touch playthrough above. It never inserts a battle/checkpoint.
test('STEP4 canceled internal drags reject a late transfer after blur, pointercancel or dragend',async({page})=>{
 await page.goto('/?play=hanzi-tower-defense&map=twin-bends');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 for(const cancellation of ['blur','pointercancel','dragend']){
  const raw=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),transfer=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('text/plain','3');return d;});
  // A canceled pointer before DnD starts has no authorized native drag token.
  // After dragstart, pointercancel is the browser's normal transfer into DnD;
  // native cancellation then ends with dragend, exercised below using real Escape.
  if(cancellation!=='pointercancel')await page.locator('[data-core="3"]').dispatchEvent('dragstart',{dataTransfer:transfer});
  else await page.locator('[data-core="3"]').dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch'});
  if(cancellation==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  else await page.locator('[data-core="3"]').dispatchEvent(cancellation,{dataTransfer:transfer});
  await page.locator('[data-slot="1"]').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(page.locator('[data-slot="1"]')).toHaveAttribute('data-tower-id','');await expect(page.locator('[data-core="3"]')).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(raw);await transfer.dispose();
 }
});

test('STEP4 real native drag Escape cancels and rejects a late drop',async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 await page.goto('/?play=hanzi-tower-defense&map=twin-bends');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 const raw=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
 const source=page.locator('[data-core="3"]'),target=page.locator('[data-slot="1"]');
 await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();expect(a).not.toBeNull();expect(b).not.toBeNull();
 await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2,{steps:5});
 await expect(source).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await page.mouse.up();
 const transfer=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('text/plain','3');return d;});
 await target.dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
 await expect(target).toHaveAttribute('data-tower-id','');await expect(source).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(raw);
});

test('STEP4 real keyboard keeps focus when changing which source tower survives synthesis',async({page},info)=>{
 test.skip(info.project.name==='touch','This case verifies actual keyboard navigation; the touch synthesis contract is covered above.');
 const act=(selector:string,region?:string)=>activate(page,selector,'keyboard',region);
 await fromHome(page,'keyboard','forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await act('[data-td-new]');await act('[data-map-select="twin-bends"]');
 await act('[data-core="2"]','[data-core]');await act('[data-slot="1"]','[data-slot]');
 await act('[data-slot="0"]','[data-slot]');await act('[data-slot="1"]','[data-slot]');await expect(page.locator('[data-fusion-target]')).toHaveCount(2);
 await act('[data-fusion-target="1"]');await expect(page.locator('[data-fusion-target="1"]')).toBeFocused();await expect(page.locator('[data-td-target]')).toContainText('保留塔位 2，释放塔位 1');
 await page.keyboard.press('Enter');await expect(page.locator('[data-fusion-target="1"]')).toBeFocused();
 await act('[data-td-fuse]');await expect(page.locator('[data-slot="1"]')).toHaveAttribute('data-kind','flame');await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-tower-id','');await expect(page.locator('[data-slot="1"]')).toBeFocused();
});

test('STEP4 a map deep link follows a selected continue slot after reload and preserves return context',async({page},info)=>{
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard',act=(selector:string)=>activate(page,selector,mode);
 await page.goto('/?play=hanzi-tower-defense&map=twin-bends&from=hub');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-new]');await act('[data-map-select="beacon-keep"]');expect(new URL(page.url()).searchParams.get('map')).toBe('beacon-keep');expect(new URL(page.url()).searchParams.get('from')).toBe('hub');
 await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-map-id','beacon-keep');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 await act('[data-td-continue]');await act('[data-map-select="twin-bends"]');await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-map-id','twin-bends');expect(new URL(page.url()).searchParams.get('from')).toBe('hub');
 await act('[data-td-home]');await expect(page).toHaveURL(/hub=classic/);
});
