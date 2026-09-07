import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY } from '../../../games/hanzi-tower-defense/save';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP3';
async function items(page:Page) {
  return page.locator('[data-core],.td-slot--occupied').evaluateAll(nodes=>nodes.map(e=>({
    selector:e.hasAttribute('data-core')?`[data-core="${e.getAttribute('data-core')}"]`:`[data-slot="${e.getAttribute('data-slot')}"]`,
    id:Number(e.getAttribute('data-core')??e.getAttribute('data-tower-id')),slot:e.hasAttribute('data-slot')?Number(e.getAttribute('data-slot')):null,
    glyph:e.querySelector('strong,.td-slot-glyph')!.textContent!,
  })));
}
test('six natural waves collect both whole English cores, equip in both directions, transfer, resume and win',async({page},info)=>{
  test.setTimeout(6*120000+180000);
  const errors:string[]=[],foreign:string[]=[],records:object[]=[];const began=Date.now();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('request',r=>{const u=new URL(r.url());if(u.protocol.startsWith('http')&&u.origin!=='http://127.0.0.1:5299')foreign.push(r.url());});
  let count=0;const act=async(selector:string)=>{const n=page.locator(selector);await n.scrollIntoViewIfNeeded();if(info.project.name==='touch')await n.tap();else if(++count%2===0){await n.focus();await page.keyboard.press('Enter');}else await n.click();};
  const clear=()=>act('[data-td-clear]');
  async function craft(aGlyph:string,bGlyph:string) {
    const all=await items(page),a=all.find(c=>c.glyph===aGlyph),b=all.find(c=>c.glyph===bGlyph&&c.id!==a?.id);if(!a||!b)return false;
    await clear();await act(a.selector);await act(b.selector);await expect(page.locator('[data-td-fuse]')).toBeEnabled();await act('[data-td-fuse]');return true;
  }
  async function placeBag() {
    const order=['山林','火山','林','沐','山','火','木','氵'];
    for(const c of (await items(page)).filter(c=>c.slot===null).sort((a,b)=>order.indexOf(a.glyph)-order.indexOf(b.glyph))) {
      let slot:number|undefined;for(const n of [1,3,0,6,2,4,7,5])if((await page.locator(`[data-slot="${n}"]`).getAttribute('data-tower-id'))===''){slot=n;break;}
      if(slot===undefined)break;await clear();await act(c.selector);await act(`[data-slot="${slot}"]`);
    }
  }
  await page.goto('/?play=hanzi-tower-defense');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await act('[data-td-pause]');
  let transferred=false;
  for(let wave=0;wave<6;wave++) {
    if(wave===0){expect(await craft('山','火')).toBe(true);expect(await craft('木','木')).toBe(true);}
    else {
      if(!(await items(page)).some(c=>c.glyph==='山林')) {await craft('木','木');expect(await craft('林','山')).toBe(true);}
      for(let step=0;step<12;step++){if(await craft('火','山'))continue;if(await craft('木','木'))continue;if(await craft('氵','木'))continue;break;}
    }
    await placeBag();
    if(wave===2) {
      const towers=(await items(page)).filter(c=>c.glyph==='火山'&&c.slot!==null);expect(towers.length).toBeGreaterThanOrEqual(2);
      const oldOwner=Number(await page.locator('[data-english="1"]').getAttribute('data-attached-to')),next=towers.find(c=>c.id!==oldOwner)!;
      await clear();await act('[data-english="1"]');await act(next.selector);await expect(page.locator('[data-td-equip]')).toHaveText('确认转移到这里');await act('[data-td-equip]');
      await expect(page.locator('[data-english="1"]')).toHaveAttribute('data-attached-to',String(next.id));transferred=true;
      const cp=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).checkpoint,SAVE_KEY);await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).checkpoint,SAVE_KEY)).toEqual(cp);
    }
    await page.locator('[data-td-board]').scrollIntoViewIfNeeded();
    if(wave===0)await act('[data-td-pause]');else await act('[data-td-next]');
    if(wave===1||wave===3) {
      const id=wave===1?1:2,glyph=wave===1?'火山':'山林';await expect(page.locator(`[data-english="${id}"]`)).toBeVisible({timeout:90000});
      const tower=(await items(page)).find(c=>c.glyph===glyph&&c.slot!==null)!;expect(tower).toBeTruthy();await clear();
      if(wave===1){await act(`[data-english="${id}"]`);await act(tower.selector);}else{await act(tower.selector);await act(`[data-english="${id}"]`);}
      await expect(page.locator('[data-td-equip]')).toBeEnabled();await act('[data-td-equip]');await expect(page.locator(tower.selector)).toHaveAttribute('data-resonant','true');
      await page.locator('[data-td-board]').scrollIntoViewIfNeeded();await expect.poll(()=>page.locator('.td-game').getAttribute(wave===1?'data-echoes':'data-root-bursts'),{timeout:30000}).not.toBeNull();
      mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/natural-${info.project.name}-${glyph}.png`,fullPage:true});
    }
    await expect.poll(()=>page.locator('.td-game').getAttribute('data-phase'),{timeout:120000,intervals:[1000]}).not.toBe('battle');
    await expect(page.locator('.td-game')).toHaveAttribute('data-phase',wave===5?'won':'ready');
    records.push({wave:wave+1,health:await page.locator('[data-td-health]').textContent(),kills:await page.locator('.td-game').getAttribute('data-kills'),leaks:await page.locator('.td-game').getAttribute('data-leaks')});
    console.log(`resonance ${info.project.name}: ${wave+1}/6`);
  }
  expect(transferred).toBe(true);await expect(page.locator('[data-td-result]')).toBeVisible();
  const final=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(final.checkpoint.englishCores).toHaveLength(2);expect(final.checkpoint.englishClaims).toHaveLength(2);expect(new Set(final.checkpoint.englishCores.map((e:{id:number})=>e.id)).size).toBe(2);
  await page.screenshot({path:`${evidence}/natural-${info.project.name}-win.png`,fullPage:true});await act('[data-td-replay]');await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');await expect(page.locator('[data-english]')).toHaveCount(0);
  expect(errors).toEqual([]);expect(foreign).toEqual([]);writeFileSync(`${evidence}/natural-${info.project.name}.json`,JSON.stringify({stateInjection:false,timeAcceleration:false,transferred,records,final,errors,foreign,seconds:Math.round((Date.now()-began)/1000)},null,2));
});
