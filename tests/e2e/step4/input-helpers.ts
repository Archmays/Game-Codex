import { expect, type Page } from '@playwright/test';
export type InputMode = 'keyboard' | 'mouse' | 'touch';

/** Read DOM state to decide which real key to press. Never focus/click/inject state in a keyboard run. */
export async function keyReach(page: Page, selector: string, region?: string): Promise<void> {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible(); await expect(target).toBeEnabled();
  for (let tabs=0; tabs<80; tabs++) {
    if (await target.evaluate(element => document.activeElement === element)) return;
    if (region && await page.locator(region).evaluateAll(elements => elements.some(element => element === document.activeElement))) {
      const count = await page.locator(region).count();
      for (let arrow=0; arrow<count; arrow++) {
        await page.keyboard.press('ArrowRight');
        if (await target.evaluate(element => document.activeElement === element)) return;
      }
      throw new Error(`Region cannot reach ${selector} by real arrows`);
    }
    const backwards = await target.evaluate(element => {
      const active=document.activeElement;
      return active!==document.body && active!==document.documentElement && !!active && !!(element.compareDocumentPosition(active)&Node.DOCUMENT_POSITION_FOLLOWING);
    });
    await page.keyboard.press(backwards?'Shift+Tab':'Tab');
  }
  throw new Error(`Tab cannot reach ${selector}; active=${await page.evaluate(()=>document.activeElement?.outerHTML)}`);
}
export async function activate(page: Page, selector: string, mode: InputMode, region?: string, key='Enter'): Promise<void> {
  if (mode === 'keyboard') { await keyReach(page, selector, region); await page.keyboard.press(key); }
  else if (mode === 'touch') await page.locator(selector).first().tap();
  else await page.locator(selector).first().click();
}
export async function fromHome(page: Page, mode: InputMode, destination:'math'|'adventure'|'forest'|'playtest'): Promise<void> {
  await page.goto('./?world=my-game-world');
  await activate(page,`[data-world-${destination}-link]`,mode);
}
export async function criticalTargets(page: Page, selector: string, minimum=44): Promise<unknown[]> {
  const targets = page.locator(selector);
  const rects = await targets.evaluateAll(elements => elements.filter(element => element.getClientRects().length > 0).map(element => {
    const r = element.getBoundingClientRect();
    return { label:element.getAttribute('aria-label') ?? element.textContent, x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom };
  }));
  const violations:string[]=[];
  for (let i=0; i<rects.length; i++) {
    const r=rects[i];
    if(r.width<minimum-.1||r.height<minimum-.1) violations.push(`${r.label}: ${r.width}×${r.height}, minimum ${minimum}`);
    for (const s of rects.slice(i+1)) if(Math.min(r.right,s.right)>Math.max(r.x,s.x)+1 && Math.min(r.bottom,s.bottom)>Math.max(r.y,s.y)+1) violations.push(`${r.label}/${s.label} overlap`);
  }
  // Keep every pair/size check while avoiding hundreds of trace steps for a single geometry snapshot.
  expect(violations).toEqual([]);
  for (const target of await targets.all()) {
    if (!await target.isVisible()) continue;
    await target.scrollIntoViewIfNeeded();
    expect(await target.evaluate(element => {
      const r = element.getBoundingClientRect();
      return [[.2,.2],[.8,.2],[.5,.5],[.2,.8],[.8,.8]].every(([x,y])=>{const hit=document.elementFromPoint(r.x+r.width*x,r.y+r.height*y);return hit===element || element.contains(hit);});
    })).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  return rects;
}
