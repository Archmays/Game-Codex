import {test,expect} from '@playwright/test';

test('regression: ordered complete occurrence cards, never selector-only results',async({page})=>{
 await page.goto('?play=hanzi-stroke-lab&q=天天向上');await page.locator('[data-index-ready=true]').waitFor();
 const cards=page.locator('[data-results] [data-occurrence]');await expect(cards).toHaveCount(4);
 expect(await cards.locator('[data-character]').allTextContents()).toEqual(['天','天','向','上']);
 for(const card of await cards.all()){
  await expect(card.locator('[data-glyph] svg')).toBeVisible();
  expect(await card.locator('[data-glyph] [data-state=written]').count()).toBeGreaterThan(0);
  const box=(await card.locator('[data-glyph]').boundingBox())!;expect(box.width).toBeGreaterThan(110);
 }
 await page.locator('#hsl-input').fill('天天天');await page.locator('[data-search] button').click();await expect(cards).toHaveCount(3);
});

test('regression: paused mid-stroke grid toggle and resume retain reveal',async({page})=>{
 await page.goto('?play=hanzi-stroke-lab&q=永');await page.locator('[data-index-ready=true]').waitFor();
 const details=page.locator('[data-open-detail]').first();if(await details.count())await details.click();
 await page.locator('[data-speed]').selectOption('0.5');
 const play=page.locator('[data-detail-play]');await play.click();
 const reveal=page.locator('[data-glyph] [data-reveal]').first();
 await expect.poll(async()=>Number(await reveal.getAttribute('stroke-dashoffset'))).toBeLessThan(.85);
 await play.click();const before=Number(await reveal.getAttribute('stroke-dashoffset'));
 await page.locator('[data-grid]').click();await expect(reveal).toHaveCount(1);expect(Number(await reveal.getAttribute('stroke-dashoffset'))).toBeCloseTo(before,5);
 await page.locator('[data-grid]').click();expect(Number(await reveal.getAttribute('stroke-dashoffset'))).toBeCloseTo(before,5);
 await play.click();expect(Number(await reveal.getAttribute('stroke-dashoffset'))).toBeLessThanOrEqual(before);await play.click();
});

test('regression: real pointer 一 candidates survive hand return and engine reload',async({page})=>{
 await page.goto('?play=hanzi-stroke-lab');await page.locator('[data-index-ready=true]').waitFor();
 const hand=page.locator('[data-pane=hand]');if(await hand.isVisible())await hand.click();
 const pad=page.locator('[data-pad]');await pad.scrollIntoViewIfNeeded();const r=(await pad.boundingBox())!;
 await page.mouse.move(r.x+r.width*.2,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.5,{steps:15});await page.mouse.up();
 const candidates=page.locator('[data-candidates] button');await expect(candidates.first()).toHaveText('一');
 await page.locator('[data-pane=query]').click();await hand.click();await expect(candidates.first()).toHaveText('一');
 await page.getByText('没有找到想要的字？',{exact:true}).click();await page.locator('[data-retry-hand]').click();await expect(candidates.first()).toHaveText('一');
});
