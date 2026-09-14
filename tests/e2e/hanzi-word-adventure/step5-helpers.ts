import { expect, type Page } from '@playwright/test';
import { type Action } from '../../../games/hanzi-word-adventure/model';
import { type Journey } from '../../../games/hanzi-word-adventure/model';
import { COMPANION_SAVE_KEY } from '../../../games/hanzi-word-adventure/save';
import { ROOMS } from '../../../games/hanzi-word-adventure/rooms';
export type CompanionInput = 'keyboard' | 'touch' | 'pointer';
const keys = {up:'ArrowUp',right:'ArrowRight',down:'ArrowDown',left:'ArrowLeft'};
export async function readCompanion(page: Page): Promise<Journey> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).journey,COMPANION_SAVE_KEY); }
export async function companionReady(page: Page) { await expect(page.locator('[data-hway-grid]')).toBeVisible(); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true'); await expect(page.locator('[data-hway-menu]')).toBeHidden(); }
export async function point(page:Page,selector:string,input:CompanionInput) { if(input==='touch') await page.locator(selector).tap(); else await page.locator(selector).click(); }
/** Only real keys. World focus is asserted, never repaired with Tab/focus/click. */
export async function companionAction(page: Page, action: Action, input: CompanionInput) {
  await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  const journey = await readCompanion(page), room = ROOMS[journey.room];
  if(input==='keyboard') {
    await expect(page.locator('[data-hway-grid]')).toBeFocused();
    if(action.type==='move') await page.keyboard.press(keys[action.direction]);
    else if(action.type==='switch') await page.keyboard.press('q');
    else {
      await page.keyboard.press('Escape');
      const dx=action.target%room.width-journey.state.player%room.width, dy=Math.floor(action.target/room.width)-Math.floor(journey.state.player/room.width);
      expect(Math.abs(dx)+Math.abs(dy)).toBe(1);
      await page.keyboard.press(`Shift+${keys[dx===1?'right':dx===-1?'left':dy===1?'down':'up']}`);
      if(action.type==='split') { await page.keyboard.press('x'); await page.keyboard.press(action.side==='left'?'ArrowLeft':'ArrowRight'); await page.keyboard.press('Enter'); }
      else await page.keyboard.press(action.type==='combine'?'c':'Space');
    }
    await expect(page.locator('[data-hway-grid]')).toBeFocused();
  } else {
    if(action.type==='move') await point(page,`[data-hway-move=${action.direction}]`,input);
    else if(action.type==='switch') await point(page,`[data-hway-actor=${journey.state.active==='person'?'friend':'person'}]`,input);
    else {
      if(action.type==='put') await point(page,'[data-hway-choose-place]',input);
      await point(page,`[data-hway-cell="${action.target}"]`,input);
      if(action.type==='split') { await point(page,'[data-hway-action=preview-split]',input); await point(page,`[data-hway-side=${action.side}]`,input); await point(page,'[data-hway-action=split]',input); }
      else await point(page,action.type==='combine'?'[data-hway-action=combine]':'[data-hway-primary]',input);
    }
  }
  await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
}
