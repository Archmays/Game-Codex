import {test,expect,type Page} from '@playwright/test';
const route='?play=hanzi-stroke-lab';
const strokes=[[[43,102],[215,100]],[[129,34],[126,118],[100,175],[45,218]],[[130,114],[165,171],[218,216]]];
const isMobile=(page:Page)=>(page.viewportSize()?.width??1300)<700;
async function ready(p:Page){await p.locator('[data-index-ready=true]').waitFor();}
async function pane(p:Page,name:string){if(isMobile(p))await p.locator(`[data-pane=${name}]`).click();}
async function query(p:Page,q:string){await pane(p,'query');await p.locator('#hsl-input').fill(q);await p.locator('[data-search] button').click();}
async function tabTo(p:Page,selector:string){
 for(let i=0;i<100;i++){if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;await p.keyboard.press('Tab');}
 throw Error(`keyboard could not reach ${selector}`);
}
async function mouseDraw(p:Page,ss=strokes){
 await p.locator('[data-pad]').scrollIntoViewIfNeeded();const r=(await p.locator('[data-pad]').boundingBox())!;
 for(const s of ss){await p.mouse.move(r.x+s[0][0]/256*r.width,r.y+s[0][1]/256*r.height);await p.mouse.down();for(const [x,y] of s.slice(1))await p.mouse.move(r.x+x/256*r.width,r.y+y/256*r.height,{steps:8});await p.mouse.up();}
 await expect(p.locator('[data-pad]')).toHaveAttribute('data-stroke-count',String(ss.length));
}
test('pure keyboard home → query → select → animation → steps → favorite → return',async({page})=>{
 await page.goto('/');await page.locator('[data-world-stroke-link]').waitFor();
 await tabTo(page,'[data-world-stroke-link]');await page.keyboard.press('Enter');await ready(page);
 await tabTo(page,'#hsl-input');await page.keyboard.type('');await page.keyboard.insertText('你好学习');await page.keyboard.press('Enter');await expect(page.locator('#hsl-character-title')).toHaveText('你');await expect(page.locator('[data-steps] button')).toHaveCount(7);
 if(isMobile(page)){await tabTo(page,'[data-pane=query]');await page.keyboard.press('Enter');}
 await tabTo(page,'[data-results] button');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('#hsl-character-title')).toHaveText('好');await expect(page.locator('[data-steps] button')).toHaveCount(6);
 await tabTo(page,'[data-play]');await page.keyboard.press('Enter');await expect(page.locator('[data-play]')).toHaveText('Ⅱ 暂停');await page.keyboard.press('Space');await expect(page.locator('[data-play]')).toHaveText('▶ 继续播放');
 await tabTo(page,'[data-steps] button');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('[data-step-status]')).toContainText('第 2 / 6 笔');await expect(page.locator('[data-glyph] [data-stroke="1"]')).toHaveAttribute('data-state','current');
 await tabTo(page,'[data-favorite]');await page.keyboard.press('Space');await expect(page.locator('[data-favorite]')).toHaveAttribute('aria-pressed','true');
 await tabTo(page,'[data-hsl-return]');await page.keyboard.press('Enter');await expect(page.locator('[data-world-stroke-link]')).toBeVisible();
});
test('mouse handwriting → real candidates → choose; undo, clear, stale results, vector resize',async({page})=>{
 await page.goto(route);await ready(page);await pane(page,'hand');await mouseDraw(page);await expect(page.locator('[data-candidates] button').first()).toBeVisible();
 const candidate=page.getByRole('button',{name:'候选 1：大',exact:true});await expect(candidate).toBeVisible();await candidate.click();await expect(page.locator('#hsl-character-title')).toHaveText('大');await expect(page.locator('[data-steps] button')).toHaveCount(3);
 await pane(page,'hand');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');await page.locator('[data-undo]').click();await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','2');await expect(page.locator('[data-candidates] button').first()).toBeVisible();
 await page.locator('[data-clear]').click();await expect(page.locator('[data-candidates] button')).toHaveCount(0);await page.waitForTimeout(500);await expect(page.locator('[data-candidates] button')).toHaveCount(0);
 await mouseDraw(page);const before=await page.locator('[data-pad] polyline').evaluateAll(es=>es.map(e=>e.getAttribute('points')));const size=page.viewportSize()!;await page.setViewportSize({width:size.height,height:size.width});await pane(page,'hand');expect(await page.locator('[data-pad] polyline').evaluateAll(es=>es.map(e=>e.getAttribute('points')))).toEqual(before);
});
test('query edges, polyphones, ordered duplicates, unknown Unicode, history and IME',async({page})=>{
 await page.goto(route);await ready(page);await query(page,'人人永');await expect(page.locator('#hsl-character-title')).toHaveText('人');await pane(page,'query');expect(await page.locator('[data-results] button').allTextContents()).toEqual(['人','人','永']);
 await query(page,'行重长乐');await expect(page.locator('[data-pinyin]')).toContainText('háng');await expect(page.locator('[data-pinyin]')).toContainText('xíng');
 await pane(page,'query');await page.locator('[data-results] button').nth(3).click();await expect(page.locator('[data-pinyin]')).toHaveText('lè / yuè');
 await query(page,'你，A好!');await pane(page,'query');await expect(page.locator('#hsl-query-note')).toContainText('3');expect(await page.locator('[data-results] button').allTextContents()).toEqual(['你','好']);
 await query(page,'𠮷');await expect(page.locator('#hsl-character-title')).toHaveText('𠮷');await expect(page.locator('[data-step-status]')).toContainText('未收录');await expect(page.locator('[data-play]')).toBeDisabled();
 await query(page,'永'.repeat(49));await expect(page.locator('#hsl-query-note')).toContainText('49');await query(page,'');await expect(page.locator('#hsl-query-note')).toContainText('请输入');
 await page.locator('#hsl-input').dispatchEvent('compositionstart');await page.locator('#hsl-input').fill('永');await page.locator('#hsl-input').press('Enter');await expect(page.locator('#hsl-character-title')).toHaveText('𠮷');await page.locator('#hsl-input').dispatchEvent('compositionend');await page.waitForTimeout(90);await page.locator('#hsl-input').press('Enter');await expect(page.locator('#hsl-character-title')).toHaveText('永');
 await page.goBack();await expect(page.locator('#hsl-character-title')).toHaveText('𠮷');await page.goForward();await expect(page.locator('#hsl-character-title')).toHaveText('永');await page.reload();await ready(page);await expect(page.locator('#hsl-character-title')).toHaveText('永');
});
test('keyboard pen is an explicit enter/exit mode, partial strokes cancel',async({page})=>{
 await page.goto(route);await ready(page);
 if(isMobile(page)){await tabTo(page,'[data-pane=hand]');await page.keyboard.press('Enter');}
 await tabTo(page,'[data-pen]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toBeFocused();await page.keyboard.press('Space');for(let i=0;i<15;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');
 await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');await expect(page.locator('[data-pad]')).toHaveAttribute('data-pen-mode','false');await page.keyboard.press('Tab');await expect(page.locator('[data-pad]')).not.toBeFocused();
 await tabTo(page,'[data-undo]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','0');
});
test('offline same-origin, no home preload, clean console, target sizes and raw old saves',async({page,context},info)=>{
 const external:string[]=[],requests:string[]=[],errors:string[]=[];const origin=new URL(info.project.use.baseURL as string||'http://127.0.0.1:5175').origin;
 await context.route('**/*',r=>{requests.push(r.request().url());if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('[data-world-stroke-link]').waitFor();expect(requests.filter(r=>/hanzi-stroke-lab\/(index.json|chars|recognizer)|workbench/.test(r))).toEqual([]);
 const keys=['family-games/hanzi-word-adventure/v2','family-games/hanzi-tower-defense/v3','family-games/equation-slider','family-games/math-world/v1','family-games/make-target'];
 await page.evaluate(ks=>ks.forEach(k=>localStorage.setItem(k,'UNRELATED RAW SENTINEL')),keys);
 await page.locator('[data-world-stroke-link]').click();await ready(page);await query(page,'永');await expect(page.locator('[data-steps] button')).toHaveCount(5);await page.locator('[data-play]').click();await expect(page.locator('[data-play]')).toHaveText('Ⅱ 暂停');await page.locator('[data-all]').click();
 await pane(page,'hand');await mouseDraw(page);await expect(page.locator('[data-candidates] button').first()).toBeVisible();
 expect(await page.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys)).toEqual(keys.map(()=> 'UNRELATED RAW SENTINEL'));
 const geometry=await page.evaluate(()=>{const main=document.querySelector('.hsl')!;return{overflow:document.documentElement.scrollWidth>innerWidth+1,targets:[...main.querySelectorAll('button,a,summary,select,.hsl-grid-toggle')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.textContent?.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))};});
 expect(geometry.overflow).toBe(false);expect(geometry.targets.filter(t=>t.h<43)).toEqual([]);expect(external).toEqual([]);expect(errors).toEqual([]);
 if(['chromium-desktop','chromium-390','webkit-tablet'].includes(info.project.name))await page.screenshot({path:`tmp/tasks/HANZI-STROKE-LAB/${info.project.name}.png`,fullPage:true});
});
test('corrupt and future local state stay unchanged; quick switching cannot overwrite current glyph',async({page})=>{
 await page.goto(route);await ready(page);const key='family-games/hanzi-stroke-lab/v1';
 for(const raw of ['{broken','{"version":50,"recent":["永"]}']){
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await ready(page);await query(page,'永');await expect(page.locator('[data-steps] button')).toHaveCount(5);await page.locator('[data-favorite]').click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
 }
 await query(page,'永水火');await pane(page,'query');await page.locator('[data-results] button').nth(1).click();await pane(page,'query');await page.locator('[data-results] button').nth(2).click();await expect(page.locator('#hsl-character-title')).toHaveText('火');await expect(page.locator('[data-steps] button')).toHaveCount(4);await page.locator('[data-restart]').click();await page.locator('[data-next]').click();await page.waitForTimeout(900);await expect(page.locator('[data-step-status]')).toContainText('第 2 / 4 笔');
});
test('touch drawing, cancel, scroll outside canvas, mixed keyboard and orientation',async({page,context,browserName},info)=>{
 test.skip(!info.project.use.hasTouch,'touch-emulation projects only');
 await page.goto(route);await ready(page);await pane(page,'hand');await page.locator('[data-pad]').scrollIntoViewIfNeeded();
 if(browserName==='chromium'){
  // Pace the lift as an actual gesture. Zero-duration CDP drags suppress later native clicks even on an inert HTML reproduction.
  const cdp=await context.newCDPSession(page);const r=(await page.locator('[data-pad]').boundingBox())!;
  for(const s of strokes){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+s[0][0]/256*r.width,y:r.y+s[0][1]/256*r.height}]});for(const [x,y] of s.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+x/256*r.width,y:r.y+y/256*r.height}]});await page.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');await expect(page.locator('[data-candidates] button').first()).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+30,y:r.y+30}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+90,y:r.y+60}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');
  const before=await page.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:5,y:650}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:5,y:300}]});await page.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>page.evaluate(()=>scrollY)).not.toBe(before);
  await page.evaluate(()=>new Promise<void>(resolve=>{let last=scrollY,stable=0;const frame=()=>{stable=scrollY===last?stable+1:0;last=scrollY;if(stable>=12)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
 }else{
  // WebKit API exposes real tap; motion/cancel dispatched as Pointer Events is a separate synthetic check.
  await page.locator('[data-pad]').tap({position:{x:40,y:50}});await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');
 }
 await page.locator('[data-clear]').tap();await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','0');await tabTo(page,'[data-pen]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toHaveAttribute('data-pen-mode','true');
});
