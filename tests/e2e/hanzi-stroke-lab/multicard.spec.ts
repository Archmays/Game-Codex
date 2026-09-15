import {test,expect} from '@playwright/test';
import {route,ready,query,details,pane,mouseDraw,one} from './helpers';

test('duplicate progress and SVG masks are independent across grid, speed and focus loss',async({page})=>{
 await page.goto(route+'&q=天天');await ready(page);
 await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
 const cards=page.locator('[data-occurrence]');
 expect(new Set(await cards.evaluateAll(es=>es.map(e=>(e as HTMLElement).dataset.occurrence))).size).toBe(2);
 await cards.nth(0).locator('[data-play]').click();await page.clock.runFor(280);await cards.nth(0).locator('[data-play]').click();
 const a=cards.nth(0).locator('[data-reveal]');const before=Number(await a.getAttribute('stroke-dashoffset'));
 await cards.nth(1).locator('[data-play]').click();await page.clock.runFor(180);await cards.nth(1).locator('[data-play]').click();
 expect(Number(await a.getAttribute('stroke-dashoffset'))).toBeCloseTo(before,5);
 const masks=await cards.locator('mask').evaluateAll(es=>es.map(e=>e.id));expect(masks).toHaveLength(2);expect(new Set(masks).size).toBe(2);
 const b=cards.nth(1).locator('[data-reveal]'),second=Number(await b.getAttribute('stroke-dashoffset'));
 await details(page,0);const reveal=page.locator('[data-detail-glyph] [data-reveal]');
 for(const speed of ['0.5','2','1']){
  await page.locator('[data-speed]').selectOption(speed);const value=Number(await reveal.getAttribute('stroke-dashoffset'));
  await page.locator('[data-grid]').click();expect(Number(await reveal.getAttribute('stroke-dashoffset'))).toBeCloseTo(value,5);
  await page.locator('[data-detail-play]').click();await page.clock.runFor(50);await page.locator('[data-detail-play]').click();
 }
 expect(Number(await b.getAttribute('stroke-dashoffset'))).toBeCloseTo(second,5);
 await page.locator('[data-detail-play]').click();
 await page.evaluate(()=>window.dispatchEvent(new Event('blur'))); // explicit lifecycle fault, not a real device blur
 await expect(page.locator('[data-detail-play]')).toHaveText('▶ 继续播放');
 const frozen=await reveal.getAttribute('stroke-dashoffset');await page.clock.runFor(150);expect(await reveal.getAttribute('stroke-dashoffset')).toBe(frozen);
 await page.locator('[data-close-detail]').click();await expect(cards.nth(0)).toBeFocused();expect(await a.getAttribute('stroke-dashoffset')).toBe(frozen);
 await cards.nth(0).locator('[data-favorite]').click();for(const c of await cards.all())await expect(c.locator('[data-favorite]')).toHaveAttribute('aria-pressed','true');
});

test('group playback preserves every occurrence, pauses, skips gaps and yields to a single card',async({page})=>{
 await page.goto(route+'&q=天天向上');await ready(page);await page.locator('[data-group-speed]').selectOption('2');
 await page.evaluate(()=>{
  const evidence={order:[] as string[],maxPlaying:0};Object.assign(window,{queueEvidence:evidence});
  new MutationObserver(()=>{const active=[...document.querySelectorAll<HTMLElement>('[data-occurrence][data-playing=true]')];evidence.maxPlaying=Math.max(evidence.maxPlaying,active.length);for(const a of active)if(evidence.order.at(-1)!==a.dataset.position)evidence.order.push(a.dataset.position!);}).observe(document.querySelector('[data-results]')!,{subtree:true,attributes:true,attributeFilter:['data-playing']});
 });
 await page.locator('[data-group-play]').click();await expect(page.locator('[data-occurrence]').first()).toHaveAttribute('data-playing','true');
 await page.locator('[data-group-play]').click();await expect(page.locator('[data-group-play]')).toHaveText('▶ 继续这组');
 const paused=await page.locator('[data-reveal]').first().getAttribute('stroke-dashoffset');await page.waitForTimeout(180);expect(await page.locator('[data-reveal]').first().getAttribute('stroke-dashoffset')).toBe(paused);
 await page.locator('[data-group-play]').click();await expect(page.locator('[data-group-status]')).toContainText('这组已播放完',{timeout:30000});
 expect(await page.evaluate(()=>(window as unknown as {queueEvidence:unknown}).queueEvidence)).toEqual({order:['0','1','2','3'],maxPlaying:1});
 await page.locator('[data-group-restart]').click();await expect(page.locator('[data-occurrence]').first()).toHaveAttribute('data-playing','true');
 await page.locator('[data-play]').nth(2).click();await expect(page.locator('[data-group-status]')).toContainText('组队列已退出');await expect(page.locator('[data-occurrence]').first()).toHaveAttribute('data-playing','false');await expect(page.locator('[data-occurrence]').nth(2)).toHaveAttribute('data-playing','true');
 await page.waitForTimeout(250);await expect(page.locator('[data-occurrence][data-playing=true]')).toHaveCount(1);
 await query(page,'一𠮷一');await page.locator('[data-group-speed]').selectOption('2');await page.locator('[data-group-play]').click();await expect(page.locator('[data-group-status]')).toContainText('这组已播放完',{timeout:15000});await expect(page.locator('[data-group-status]')).toContainText('第 2 个「𠮷」');
});

test('48 full glyphs stay light, requests deduplicate and obsolete groups cannot win',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/chars/'))requests.push(r.url());});
 await page.route('**/chars/5929.json',async r=>{await new Promise(resolve=>setTimeout(resolve,700));await r.continue();});
 await page.goto(route);await ready(page);await query(page,'天天向上');await query(page,'水');await expect(page.locator('[data-glyph] [data-state=written]')).toHaveCount(4);await page.waitForTimeout(800);await expect(page.locator('[data-character]')).toHaveText('水');
 await query(page,'天'.repeat(48));await expect(page.locator('[data-occurrence]')).toHaveCount(48);await expect(page.locator('[data-glyph] svg')).toHaveCount(48);await expect(page.locator('[data-glyph] [data-state=written]')).toHaveCount(192);
 expect(requests.filter(u=>u.includes('/5929.json'))).toHaveLength(1);await expect(page.locator('[data-reveal]')).toHaveCount(0);await expect(page.locator('[data-steps] button')).toHaveCount(0);await expect(page.locator('[data-occurrence][data-playing]')).toHaveCount(0);
 await page.locator('[data-occurrence]').last().scrollIntoViewIfNeeded();await expect(page.locator('[data-occurrence]').last()).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const size=page.viewportSize()!;await page.setViewportSize({width:size.height,height:size.width});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.evaluate(()=>document.documentElement.style.zoom='1.5');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await details(page,47);await expect(page.locator('[data-steps] button')).toHaveCount(4);await page.locator('[data-close-detail]').click();await expect(page.locator('[data-occurrence]').last()).toBeFocused();
});

test('query → third detail → reload/back/forward/close restores group, occurrence and focus',async({page},info)=>{
 await page.goto(route);await ready(page);await query(page,'天天向上');
 const geometry=await page.locator('[data-results]').evaluate(host=>{
  const cards=[...host.querySelectorAll<HTMLElement>('[data-occurrence]')];
  return {columns:getComputedStyle(host).gridTemplateColumns.split(' ').length,glyphs:cards.map(c=>c.querySelector('[data-glyph]')!.getBoundingClientRect().width),targets:cards.flatMap(c=>[...c.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height};}))};
 });
 const width=page.viewportSize()!.width;expect(geometry.columns).toBe(width<800?2:width<1100?3:4);
 expect(geometry.glyphs.every(w=>w>=130)).toBe(true);expect(geometry.targets.every(t=>t.w>=44&&t.h>=48)).toBe(true);
 for(const card of await page.locator('[data-occurrence]').all()){
  await card.scrollIntoViewIfNeeded();const hit=await card.evaluate(c=>[...c.querySelectorAll('button')].every(b=>{const r=b.getBoundingClientRect();return [0.25,0.5,0.75].every(f=>b.contains(document.elementFromPoint(r.x+r.width*f,r.y+r.height/2)));}));expect(hit).toBe(true);
 }
 const before=await page.locator('[data-occurrence]').evaluateAll(es=>es.map(e=>(e as HTMLElement).dataset.occurrence));
 await page.locator('[data-open-detail]').nth(2).scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);await details(page,2);
 expect(new URL(page.url()).searchParams.get('i')).toBe('2');await expect(page.locator('[data-steps] button')).toHaveCount(6);
 await page.locator('[data-close-detail]').click();await expect(page.locator('[data-occurrence]').nth(2)).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBeCloseTo(scroll,0);
 expect(await page.locator('[data-occurrence]').evaluateAll(es=>es.map(e=>(e as HTMLElement).dataset.occurrence))).toEqual(before);
 await details(page,2);await page.reload();await ready(page);await expect(page.locator('[data-detail]')).toBeVisible();await expect(page.locator('#hsl-character-title')).toContainText('向');await expect(page.locator('[data-occurrence]')).toHaveCount(4);
 await page.goBack();await expect(page.locator('[data-detail]')).not.toBeVisible();await expect(page.locator('[data-occurrence]').nth(2)).toBeFocused();
 await page.goForward();await expect(page.locator('[data-detail]')).toBeVisible();await expect(page.locator('#hsl-character-title')).toContainText('向');
 await page.keyboard.press('Escape');await expect(page.locator('[data-occurrence]').nth(2)).toBeFocused();await expect(page.locator('#hsl-input')).toBeVisible();
 await page.goto(route+'&q=天天向上&i=2');await ready(page);await expect(page.locator('[data-detail]')).not.toBeVisible();await expect(page.locator('[data-occurrence]').nth(2)).toBeFocused();
 if(['chromium-390','chromium-desktop'].includes(info.project.name)){
  await page.screenshot({path:`tmp/tasks/HSL-MULTICARD/results-${info.project.name}.png`,fullPage:true});await details(page,2);await page.screenshot({path:`tmp/tasks/HSL-MULTICARD/detail-${info.project.name}.png`});
 }
});

test('handwriting delayed real results, clear, re-recognize, reload and continue preserve the right ink',async({page},info)=>{
 await page.addInitScript(()=>{
  const Native=Worker;
  window.Worker=class extends Native{
   set onmessage(listener:((this:Worker,e:MessageEvent)=>unknown)|null){super.onmessage=listener?e=>{if(e.data.type==='result')setTimeout(()=>listener.call(this,e),500);else listener.call(this,e);}:null;}
  };
 });
 await page.goto(route+'&q=天天向上');await ready(page);await pane(page,'hand');await mouseDraw(page,one);
 await page.locator('[data-pane=query]').click();await pane(page,'hand');await expect(page.locator('[data-candidates] button').first()).toHaveText('一');
 await page.locator('[data-recognize]').click();await page.locator('[data-clear]').click();await page.waitForTimeout(950);await expect(page.locator('[data-candidates] button')).toHaveCount(0);await expect(page.locator('[data-hand-status]')).toContainText('已清空');
 await mouseDraw(page,one);await expect(page.locator('[data-candidates] button').first()).toHaveText('一');await page.locator('#hsl-hand summary').last().click();await page.locator('[data-retry-hand]').click();await expect(page.locator('[data-candidates] button').first()).toHaveText('一');
 await page.locator('[data-candidates] button').first().click();await page.locator('[data-hand-query]').click();await expect(page.locator('#hsl-character-title')).toContainText('一');expect(new URL(page.url()).searchParams.get('q')).toBe('天天向上');
 await page.locator('[data-continue-hand]').click();await expect(page.locator('[data-pad]')).toHaveAttribute('data-stroke-count','0');await expect(page.locator('[data-candidates] button')).toHaveCount(0);await expect(page.locator('[data-occurrence]')).toHaveCount(4);
 await mouseDraw(page,one);await expect(page.locator('[data-candidates] button').first()).toHaveText('一');await pane(page,'query');await pane(page,'hand');await expect(page.locator('[data-candidates] button').first()).toHaveText('一');
 if(info.project.name==='chromium-390')await page.screenshot({path:'tmp/tasks/HSL-MULTICARD/hand-return-mobile.png',fullPage:true});
});

test('favorite/recent clear require confirmation; valid v1 storage remains byte-compatible',async({page})=>{
 const key='family-games/hanzi-stroke-lab/v1',raw=JSON.stringify({version:1,recent:['水','永'],favorites:['天','水'],grid:false});
 await page.goto(route);await ready(page);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.reload();await ready(page);await query(page,'天天');
 for(const b of await page.locator('[data-favorite]').all())await expect(b).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-shelf-toggle]').click();page.once('dialog',d=>d.dismiss());await page.locator('[data-clear-favorites]').click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
 page.once('dialog',d=>d.accept());await page.locator('[data-clear-favorites]').click();await expect(page.locator('[data-favorites] button')).toHaveCount(0);for(const b of await page.locator('[data-favorite]').all())await expect(b).toHaveAttribute('aria-pressed','false');
 page.once('dialog',d=>d.dismiss());await page.locator('[data-clear-recent]').click();await expect(page.locator('[data-recent] button')).toHaveCount(2);page.once('dialog',d=>d.accept());await page.locator('[data-clear-recent]').click();await expect(page.locator('[data-recent] button')).toHaveCount(0);
 const value=JSON.parse((await page.evaluate(k=>localStorage.getItem(k),key))!);expect(value).toEqual({version:1,recent:[],favorites:[],grid:false});
});
