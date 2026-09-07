import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { checkpointOf, newBattle, type Checkpoint } from '../../../games/hanzi-tower-defense/model';
import { RESONANCES } from '../../../games/hanzi-tower-defense/resonance';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../../../games/hanzi-tower-defense/save';
const root=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP3';
const preferences={muted:true,reducedMotion:true};
function fixture() {
  const s=newBattle();s.wave=4;s.health=12;
  s.cores=[{id:11,kind:'volcano',slot:0,cooldown:.65},{id:12,kind:'volcano',slot:3,cooldown:.35},{id:13,kind:'wildwood',slot:1,cooldown:.5},{id:14,kind:'wildwood',slot:null,cooldown:.4},{id:15,kind:'wood',slot:null,cooldown:0},{id:16,kind:'water',slot:7,cooldown:0}];s.nextCoreId=17;
  s.englishCores=RESONANCES.map((r,i)=>({id:i+1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:null}));s.englishClaims=RESONANCES.map(r=>r.grantId);s.nextEnglishId=3;return checkpointOf(s);
}
async function setup(page:Page,checkpoint=fixture()) {
  await page.goto('/');await page.evaluate(({key,checkpoint,preferences})=>localStorage.setItem(key,JSON.stringify({version:2,checkpoint,unlocked:[],preferences})),{key:SAVE_KEY,checkpoint,preferences});
  await page.goto('/?play=hanzi-tower-defense');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
}
const raw=(page:Page)=>page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
const saved=async(page:Page)=>JSON.parse((await raw(page))!).checkpoint as Checkpoint;
async function act(page:Page,selector:string,input:string) {const n=page.locator(selector);await n.scrollIntoViewIfNeeded();if(input==='touch')await n.tap();else{await n.focus();await page.keyboard.press('Enter');}}

test('equipment selection order, mismatch, range independence, cancel and repeated confirmation keep exact ownership',async({page},info)=>{
  const input=info.project.name,errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);const before=await raw(page);
  await act(page,'[data-english="1"]',input);await act(page,'[data-slot="1"]',input);await expect(page.locator('[data-td-equip]')).toBeDisabled();await expect(page.locator('[data-td-equipment-copy]')).toContainText('用于火山');
  await expect(page.locator('[data-range-mode=inspect]')).toHaveAttribute('data-range-kind','wildwood');expect(await raw(page)).toBe(before);await act(page,'[data-td-cancel-equipment]',input);expect(await raw(page)).toBe(before);
  // Chinese first, then whole English phrase; equipment may go onto an undeployed complete word.
  await act(page,'[data-core="14"]',input);await act(page,'[data-english="2"]',input);await expect(page.locator('[data-td-equipment-copy]')).toContainText('目标：山林 · 材料栏');await act(page,'[data-td-equip]',input);
  expect((await saved(page)).englishCores.find(e=>e.id===2)?.attachedTo).toBe(14);await act(page,'[data-slot="2"]',input);expect((await saved(page)).cores.find(c=>c.id===14)?.slot).toBe(2);
  await act(page,'[data-td-clear]',input);await act(page,'[data-english="1"]',input);await act(page,'[data-slot="0"]',input);await act(page,'[data-td-equip]',input);
  const once=await raw(page);await act(page,'[data-english="1"]',input);await expect(page.locator('[data-td-equip]')).toBeDisabled();expect(await raw(page)).toBe(once);
  expect((await saved(page)).englishCores).toHaveLength(2);expect(errors).toEqual([]);
});

test('wave-gap transfer, attachment stow/move/recycle and full-health cancellation conserve resources',async({page},info)=>{
  const input=info.project.name;await setup(page);
  await act(page,'[data-english="1"]',input);await act(page,'[data-slot="0"]',input);await act(page,'[data-td-equip]',input);
  await act(page,'[data-english="1"]',input);await act(page,'[data-slot="3"]',input);await expect(page.locator('[data-td-equip]')).toHaveText('确认转移到这里');await act(page,'[data-td-equip]',input);
  let cp=await saved(page);expect(cp.englishCores[0].attachedTo).toBe(12);expect(cp.cores.find(c=>c.id===12)!.cooldown).toBe(.35);
  await act(page,'[data-td-stow]',input);cp=await saved(page);expect(cp.cores.find(c=>c.id===12)?.slot).toBeNull();expect(cp.englishCores[0].attachedTo).toBe(12);
  await act(page,'[data-core="12"]',input);await act(page,'[data-td-recycle]',input);const before=await raw(page);await expect(page.locator('[data-td-equipment-copy]')).toContainText('volcano 原枚返还背包');await act(page,'[data-td-cancel-equipment]',input);expect(await raw(page)).toBe(before);
  await act(page,'[data-core="12"]',input);await act(page,'[data-td-recycle]',input);await act(page,'[data-td-confirm-recycle]',input);cp=await saved(page);expect(cp.cores.some(c=>c.id===12)).toBe(false);expect(cp.englishCores[0]).toMatchObject({id:1,attachedTo:null});expect(cp.health).toBe(14);
  const full=fixture();full.health=16;full.cores.find(c=>c.id===11)!.slot=null;full.englishCores[0].attachedTo=11;await setup(page,full);await act(page,'[data-core="11"]',input);await expect(page.locator('[data-td-recycle]')).toBeDisabled();expect((await saved(page)).englishCores[0].attachedTo).toBe(11);
});

test('paused battle permits first equip but refuses detach/transfer; refresh rolls equipment back with the wave',async({page},info)=>{
  await setup(page);const input=info.project.name,boundary=await saved(page);await act(page,'[data-td-next]',input);await act(page,'[data-td-pause]',input);
  await act(page,'[data-english="1"]',input);await act(page,'[data-slot="0"]',input);await act(page,'[data-td-equip]',input);await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-resonant','true');
  await act(page,'[data-english="1"]',input);await act(page,'[data-slot="3"]',input);await expect(page.locator('[data-td-equip]')).toBeDisabled();await expect(page.locator('[data-td-unequip]')).toBeDisabled();await expect(page.locator('[data-td-equipment-copy]')).toContainText('暂停仍在战中');
  expect((await saved(page)).englishCores).toEqual(boundary.englishCores);await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');expect((await saved(page)).englishCores).toEqual(boundary.englishCores);await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-resonant','false');
});

test('desktop English drag uses the same preview and never automatically equips',async({page},info)=>{
  test.skip(info.project.name!=='desktop');await setup(page);const before=await raw(page);await page.locator('[data-english="2"]').dragTo(page.locator('[data-slot="1"]'));
  await expect(page.locator('[data-td-equip]')).toBeEnabled();expect(await raw(page)).toBe(before);await page.locator('[data-td-equip]').click();expect((await saved(page)).englishCores[1].attachedTo).toBe(13);
});

test('responsive whole phrase, positive canvas, real glyphs and critical action geometry',async({page},info)=>{
  await setup(page);const input=info.project.name;await act(page,'[data-english="2"]',input);await act(page,'[data-slot="1"]',input);
  const sizes=info.project.name==='touch'?[360,390]:[768,1440],rows=[];mkdirSync(root,{recursive:true});
  for(const width of sizes) {
    await page.setViewportSize({width,height:width<500?844:1024});await expect(page.locator('[data-td-equipment-copy]')).toContainText('mountain forest');
    const selectors=['[data-td-equip]','[data-td-cancel-equipment]'];
    const actions=[];for(const selector of selectors){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const g=await el.evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,hits:[.2,.5,.8].flatMap(x=>[.25,.75].map(y=>e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y))))};});expect(g.width).toBeGreaterThanOrEqual(44);expect(g.height).toBeGreaterThanOrEqual(44);expect(g.hits).toEqual([true,true,true,true,true,true]);actions.push({selector,...g});}
    const group=await page.evaluate(selectors=>{const rects=selectors.map(s=>{const r=document.querySelector(s)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});const [a,b]=rects;return {rects,intersects:a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height,clearance:Math.max(b.x-a.x-a.width,a.x-b.x-b.width,b.y-a.y-a.height,a.y-b.y-b.height)};},selectors);expect(group.intersects).toBe(false);expect(group.clearance).toBeGreaterThanOrEqual(6);
    const geometry=await page.evaluate(()=>{const canvas=document.querySelector('canvas')!,r=canvas.getBoundingClientRect();const phrase=document.querySelector('[data-english="2"] strong')!;const p=phrase.getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,dpr:devicePixelRatio,canvas:{width:canvas.width,height:canvas.height,cssWidth:r.width,cssHeight:r.height},phrase:{text:phrase.textContent,width:p.width,height:p.height,font:getComputedStyle(phrase).fontFamily,scrollWidth:phrase.scrollWidth,clientWidth:phrase.clientWidth}};});
    expect(geometry.overflow).toBe(false);expect(geometry.canvas.width).toBeGreaterThan(0);expect(geometry.canvas.height).toBeGreaterThan(0);expect(geometry.phrase.text).toBe('mountain forest');expect(geometry.phrase.scrollWidth).toBeLessThanOrEqual(geometry.phrase.clientWidth+1);
    rows.push({geometry,actions,group});await page.screenshot({path:`${root}/resonance-${width}-preview.png`,fullPage:true});
    if(process.env.TD_VISUAL_ACCEPTANCE)await expect(page).toHaveScreenshot(`resonance-${width}-preview.png`,{fullPage:true,maxDiffPixelRatio:0.001});
  }
  await act(page,'[data-td-equip]',input);await page.screenshot({path:`${root}/resonance-${info.project.name}-equipped.png`,fullPage:true});
  writeFileSync(`${root}/resonance-geometry-${info.project.name}.json`,JSON.stringify(rows,null,2));
});

test('v1 migration, existing bad/future v2 precedence and cross-page write protection',async({page,context},info)=>{
  test.skip(info.project.name!=='desktop');
  const cp=fixture();const {englishCores,englishClaims,englishSkipped,nextEnglishId,...legacy}=cp;
  const old=JSON.stringify({version:1,checkpoint:legacy,unlocked:['fire-fire'],preferences});
  await page.goto('/');await page.evaluate(({old,key,v2})=>{localStorage.setItem(key,old);localStorage.removeItem(v2);},{old,key:LEGACY_SAVE_KEY,v2:SAVE_KEY});await page.goto('/?play=hanzi-tower-defense');
  await expect(page.locator('.td-game')).toHaveAttribute('data-wave','4');expect(await page.evaluate(key=>localStorage.getItem(key),LEGACY_SAVE_KEY)).toBe(old);expect((await saved(page)).englishSkipped).toHaveLength(2);expect((await saved(page)).englishCores).toEqual([]);
  const once=await raw(page);await page.reload();expect(await raw(page)).toBe(once);
  for(const invalid of ['{broken','{"version":99,"future":true}']){await page.goto('/');await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:invalid});await page.goto('/?play=hanzi-tower-defense');await page.locator('[data-td-mute]').click();await expect(page.locator('[data-td-save-note]')).toContainText('原有记录未改动');expect(await raw(page)).toBe(invalid);expect(await page.evaluate(key=>localStorage.getItem(key),LEGACY_SAVE_KEY)).toBe(old);}
  await setup(page);const other=await context.newPage();await other.goto('/');const restored=JSON.stringify({version:99,restored:'anonymous'});await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:restored});await page.locator('[data-td-mute]').click();expect(await raw(page)).toBe(restored);await expect(page.locator('[data-td-save-note]')).toContainText('原有记录未改动');await other.close();
});
