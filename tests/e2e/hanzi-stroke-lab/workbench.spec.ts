import {test,expect} from '@playwright/test';
import {route,strokes,ready,pane,query,details,tabTo,mouseDraw} from './helpers';

test('pure keyboard home → query → select → animation → steps → favorite → return',async({page})=>{
 await page.goto('./');await page.locator('[data-world-stroke-link]').waitFor();
 await tabTo(page,'[data-world-stroke-link]');await page.keyboard.press('Enter');await ready(page);
 await tabTo(page,'#hsl-input');await page.keyboard.insertText('你好学习');await page.keyboard.press('Enter');
 await expect(page.locator('[data-character]').first()).toHaveText('你');await expect(page.locator('[data-occurrence]')).toHaveCount(4);
 await tabTo(page,'[data-occurrence]');await page.keyboard.press('Enter');await expect(page.locator('[data-steps] button')).toHaveCount(7);await page.keyboard.press('Escape');
 await expect(page.locator('[data-occurrence]').first()).toBeFocused();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('#hsl-character-title')).toContainText('好');await expect(page.locator('[data-steps] button')).toHaveCount(6);
 await tabTo(page,'[data-detail-play]');await page.keyboard.press('Enter');await expect(page.locator('[data-detail-play]')).toHaveText('Ⅱ 暂停');await page.keyboard.press('Space');await expect(page.locator('[data-detail-play]')).toHaveText('▶ 继续播放');
 await tabTo(page,'[data-steps] button');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('[data-step-status]')).toContainText('第 2 / 6 笔');await expect(page.locator('[data-detail-glyph] [data-stroke="1"]')).toHaveAttribute('data-state','current');
 await tabTo(page,'[data-detail-favorite]');await page.keyboard.press('Space');await expect(page.locator('[data-detail-favorite]')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(page.locator('[data-occurrence]').nth(1)).toBeFocused();await tabTo(page,'[data-hsl-return]');await page.keyboard.press('Enter');await expect(page.locator('[data-world-stroke-link]')).toBeVisible();
});

test('mouse handwriting → real candidates → choose; undo, clear, stale results, vector resize',async({page})=>{
 await page.goto(route);await ready(page);await query(page,'天天向上');await pane(page,'hand');await mouseDraw(page);
 const candidate=page.getByRole('button',{name:'候选 1：大',exact:true});await expect(candidate).toBeVisible();await candidate.click();await page.locator('[data-hand-query]').click();await expect(page.locator('#hsl-character-title')).toContainText('大');await expect(page.locator('[data-steps] button')).toHaveCount(3);
 // A one-character handwriting preview leaves the original query intact.
 expect(await page.locator('[data-character]').allTextContents()).toEqual([...'天天向上']);expect(new URL(page.url()).searchParams.get('q')).toBe('天天向上');
 await pane(page,'hand');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');await expect(candidate).toBeVisible();await page.locator('[data-undo]').click();await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','2');await expect(page.locator('[data-candidates] button').first()).toBeVisible();
 await page.locator('[data-clear]').click();await expect(page.locator('[data-candidates] button')).toHaveCount(0);await page.waitForTimeout(500);await expect(page.locator('[data-candidates] button')).toHaveCount(0);
 await mouseDraw(page);const before=await page.locator('[data-pad] polyline').evaluateAll(es=>es.map(e=>e.getAttribute('points')));const size=page.viewportSize()!;await page.setViewportSize({width:size.height,height:size.width});expect(await page.locator('[data-pad] polyline').evaluateAll(es=>es.map(e=>e.getAttribute('points')))).toEqual(before);
 await expect(candidate).toBeVisible();await candidate.click();await page.locator('[data-hand-add]').click();expect(await page.locator('[data-character]').allTextContents()).toEqual([...'天天向上大']);
});

test('query edges, polyphones, ordered duplicates, unknown Unicode, history and IME',async({page})=>{
 await page.goto(route);await ready(page);await query(page,'人人永');expect(await page.locator('[data-character]').allTextContents()).toEqual(['人','人','永']);
 await query(page,'行重长乐');expect(await page.locator('[data-pinyin]').allTextContents()).toEqual(['háng / héng / xíng','chóng / zhòng','cháng / zhǎng','lè / yuè']);await expect(page.locator('[data-card-note]')).toHaveText(Array(4).fill('多音字 · 请结合词句判断。'));
 await query(page,'你，A好!𠮷');await expect(page.locator('#hsl-query-note')).toContainText('3');expect(await page.locator('[data-character]').allTextContents()).toEqual(['你','好','𠮷']);await expect(page.locator('[data-play]').nth(2)).toBeDisabled();await expect(page.locator('[data-card-note]').nth(2)).toContainText('本地缺数据');
 await page.reload();await ready(page);await expect(page.locator('#hsl-query-note')).toContainText('3');
 await query(page,'永'.repeat(49));await expect(page.locator('#hsl-query-note')).toContainText('49');await expect(page.locator('[data-occurrence]')).toHaveCount(0);
 await query(page,'');await expect(page.locator('#hsl-query-note')).toContainText('请输入');await expect(page.locator('[data-occurrence]')).toHaveCount(0);
 await page.locator('#hsl-input').dispatchEvent('compositionstart');await page.locator('#hsl-input').fill('永');await page.locator('#hsl-input').press('Enter');await expect(page.locator('[data-occurrence]')).toHaveCount(0);await page.locator('#hsl-input').dispatchEvent('compositionend');await page.waitForTimeout(90);await page.locator('#hsl-input').press('Enter');await expect(page.locator('[data-character]')).toHaveText('永');
 await page.goBack();await expect(page.locator('[data-occurrence]')).toHaveCount(0);await page.goForward();await expect(page.locator('[data-character]')).toHaveText('永');await page.reload();await ready(page);await expect(page.locator('[data-character]')).toHaveText('永');
});

test('keyboard pen is an explicit enter/exit mode, partial strokes cancel',async({page})=>{
 await page.goto(route);await ready(page);await tabTo(page,'[data-pane=hand]');await page.keyboard.press('Enter');
 await tabTo(page,'#hsl-hand details summary');await page.keyboard.press('Enter');await tabTo(page,'[data-pen]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toBeFocused();await page.keyboard.press('Space');for(let i=0;i<15;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');
 await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');await expect(page.locator('[data-pad]')).toHaveAttribute('data-pen-mode','false');await page.keyboard.press('Tab');await expect(page.locator('[data-pad]')).not.toBeFocused();
 await tabTo(page,'[data-undo]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','0');
});

test('offline same-origin, no home preload, clean console, target sizes and raw old saves',async({page,context},info)=>{
 const external:string[]=[],requests:string[]=[],errors:string[]=[];const origin=new URL(info.project.use.baseURL as string||'http://127.0.0.1:5175').origin;
 await context.route('**/*',r=>{requests.push(r.request().url());if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.locator('[data-world-stroke-link]').waitFor();expect(requests.filter(r=>/hanzi-stroke-lab\/(index.json|chars|recognizer)|workbench/.test(r))).toEqual([]);
 const keys=['family-games/hanzi-word-adventure/v2','family-games/hanzi-tower-defense/v3','family-games/equation-slider','family-games/math-world/v1','family-games/make-target'];
 await page.evaluate(ks=>ks.forEach(k=>localStorage.setItem(k,'UNRELATED RAW SENTINEL')),keys);
 await page.locator('[data-world-stroke-link]').click();await ready(page);await query(page,'永');expect(requests.filter(r=>/recognizer/.test(r))).toEqual([]);await details(page);await expect(page.locator('[data-steps] button')).toHaveCount(5);await page.locator('[data-detail-play]').click();await expect(page.locator('[data-detail-play]')).toHaveText('Ⅱ 暂停');await page.locator('[data-all]').click();
 await pane(page,'hand');await mouseDraw(page);await expect(page.locator('[data-candidates] button').first()).toBeVisible();
 expect(await page.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys)).toEqual(keys.map(()=> 'UNRELATED RAW SENTINEL'));
 const geometry=await page.evaluate(()=>{const main=document.querySelector('.hsl')!;return{overflow:document.documentElement.scrollWidth>innerWidth+1,targets:[...main.querySelectorAll('button,a,summary,select,.hsl-grid-toggle')].filter(e=>e.checkVisibility()).map(e=>({text:e.textContent?.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))};});
 expect(geometry.overflow).toBe(false);expect(geometry.targets.filter(t=>t.h<43)).toEqual([]);expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('corrupt and future local state stay unchanged; quick switching cannot overwrite current glyph',async({page})=>{
 await page.goto(route);await ready(page);const key='family-games/hanzi-stroke-lab/v1';
 for(const raw of ['{broken','{"version":50,"recent":["永"]}']){
   await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await ready(page);await query(page,'永');await details(page);await expect(page.locator('[data-steps] button')).toHaveCount(5);await page.locator('[data-detail-favorite]').click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
 }
 await query(page,'永水火');await details(page,1);await expect(page.locator('[data-steps] button')).toHaveCount(4);await page.locator('[data-close-detail]').click();await details(page,2);await expect(page.locator('#hsl-character-title')).toContainText('火');await expect(page.locator('[data-steps] button')).toHaveCount(4);
 await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
 await page.locator('[data-restart]').click();await page.locator('[data-next]').click();await page.clock.runFor(900);await expect(page.locator('[data-step-status]')).toContainText('第 2 / 4 笔');
});

test('touch drawing, cancel, scroll outside canvas, mixed keyboard and orientation',async({page,context,browserName},info)=>{
 test.skip(!info.project.use.hasTouch,'touch-emulation projects only');
 await page.goto(route);await ready(page);await query(page,'天天向上');await pane(page,'hand');await page.locator('[data-pad]').scrollIntoViewIfNeeded();
 if(browserName==='chromium'){
  const cdp=await context.newCDPSession(page);const r=(await page.locator('[data-pad]').boundingBox())!;
  for(const s of strokes){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+s[0][0]/256*r.width,y:r.y+s[0][1]/256*r.height}]});for(const [x,y] of s.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+x/256*r.width,y:r.y+y/256*r.height}]});await page.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');await expect(page.locator('[data-candidates] button').first()).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+30,y:r.y+30}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+90,y:r.y+60}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','3');
  const before=await page.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:5,y:650}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:5,y:300}]});await page.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>page.evaluate(()=>scrollY)).not.toBe(before);
  await page.evaluate(()=>new Promise<void>(resolve=>{let last=scrollY,stable=0;const frame=()=>{stable=scrollY===last?stable+1:0;last=scrollY;if(stable>=12)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
 }else{
  // Native WebKit tap; dragging/cancellation coverage is the Chromium CDP gesture above.
  await page.locator('[data-pad]').tap({position:{x:40,y:50}});await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','1');
 }
 await page.locator('[data-clear]').tap();await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','0');await page.locator('#hsl-hand summary').first().tap();await tabTo(page,'[data-pen]');await page.keyboard.press('Enter');await expect(page.locator('[data-pad]')).toHaveAttribute('data-pen-mode','true');
 await page.keyboard.press('Escape');await page.locator('[data-pane=query]').tap();await page.locator('[data-open-detail]').nth(2).tap();await expect(page.locator('#hsl-character-title')).toContainText('向');await page.locator('[data-close-detail]').tap();await expect(page.locator('[data-occurrence]')).toHaveCount(4);
});
