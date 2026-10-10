import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { activate, criticalTargets, type InputMode } from '../step4/input-helpers';
import { checkpointOf, newBattle } from '../../../games/hanzi-tower-defense/model';
import { SAVE_KEY, validCheckpoint } from '../../../games/hanzi-tower-defense/save';
import { RESONANCES } from '../../../games/hanzi-tower-defense/resonance';

function fixture() {
  const state = newBattle(); state.wave = 4; state.health = 12;
  state.cores = [{ id: 11, kind: 'volcano', slot: 0, cooldown: 0 }, { id: 12, kind: 'wildwood', slot: 1, cooldown: 0 }, { id: 13, kind: 'wood', slot: null, cooldown: 0 }, { id: 14, kind: 'water', slot: 7, cooldown: 0 }];
  state.nextCoreId = 15;
  state.englishCores = RESONANCES.filter(r => r.coreId !== 'forest').map((r, i) => ({ id: i + 1, lexemeId: r.lexemeId, senseId: r.senseId, grantId: r.grantId, attachedTo: null }));
  state.englishClaims = state.englishCores.map(e => e.grantId); state.nextEnglishId = 3;
  return checkpointOf(state);
}
async function setup(page: Page, origin = '') {
  const checkpoint = fixture(); expect(validCheckpoint(checkpoint)).toBe(true);
  await page.goto(`${origin}/`);
  await page.evaluate(({ key, checkpoint }) => localStorage.setItem(key, JSON.stringify({ version: 3, activeMapId: 'qinglan-pass', maps: { 'qinglan-pass': { checkpoint, unlocked: [] } }, preferences: { muted: true, reducedMotion: true } })), { key: SAVE_KEY, checkpoint });
  await page.goto(`${origin}/?play=hanzi-tower-defense&map=qinglan-pass`);
  await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready', 'true');
  if (await page.locator('[data-td-guide-close]').isVisible()) await page.locator('[data-td-guide-close]').click();
}

test('quality feedback mirrors wave, pause and resonance without obstructing real controls', async ({ page }, info) => {
  const evidence = process.env.TD_EVIDENCE_DIR ?? info.outputPath('feedback');
  mkdirSync(evidence, { recursive: true });
  const mode: InputMode = info.project.name === 'touch' ? 'touch' : 'keyboard';
  const act = (selector: string) => activate(page, selector, mode, selector.startsWith('[data-slot=') ? '[data-slot]' : selector.startsWith('[data-english=') ? '[data-english]' : undefined);
  const errors: string[] = []; const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('request', r => { const u = new URL(r.url()); if (!['data:', 'blob:'].includes(u.protocol) && !['http://127.0.0.1:5299', process.env.TD_BEFORE_URL].includes(u.origin)) external.push(r.url()); });
  if (process.env.TD_BEFORE_URL) {
    await setup(page, process.env.TD_BEFORE_URL);
    await act('[data-english="1"]'); await act('[data-slot="0"]'); await act('[data-td-equip]');
    await page.reload(); await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready', 'true');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Control+Home');
    await page.screenshot({ path: `${evidence}/before-${info.project.name}.png`, fullPage: true });
  }
  await setup(page);
  await expect(page.locator('[data-td-phase]')).toHaveText('布阵');
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-td-wave-banner]')).toHaveText('第 4 波结束 · 调整好再出发');
  await act('[data-english="1"]'); await act('[data-slot="0"]'); await act('[data-td-equip]');
  const tower = page.locator('[data-slot="0"]');
  await expect(tower.locator('small')).toHaveText('1 · 共鸣');
  await expect(tower).toHaveAttribute('aria-label', /已共鸣：回声喷发/);
  // Static feedback survives reduced motion and a refresh of the normal checkpoint.
  await page.reload(); await expect(tower.locator('small')).toHaveText('1 · 共鸣');
  await expect(page.locator('[data-td-phase]')).toHaveText('布阵');
  await criticalTargets(page, '.td-live-controls button, [data-td-next]');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bannerHits = await page.locator('[data-td-wave-banner]').evaluate(e => getComputedStyle(e).pointerEvents);
  expect(bannerHits).toBe('none');
  await page.keyboard.press('Control+Home');
  await page.screenshot({ path: `${evidence}/after-${info.project.name}.png`, fullPage: true });
  const readySave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  await act('[data-td-next]'); await expect(page.locator('[data-td-phase]')).toHaveText('守城中');
  await expect(page.locator('[data-td-wave-banner]')).toBeHidden();
  await expect.poll(async () => Number(await page.locator('.td-game').getAttribute('data-elapsed'))).toBeGreaterThan(10);
  await act('[data-td-pause]'); await expect(page.locator('[data-td-phase]')).toHaveText('已暂停');
  await page.mouse.move(0, 0); await page.keyboard.press('Control+Home');
  await page.screenshot({ path: `${evidence}/battle-${info.project.name}.png`, fullPage: true });
  // Pausing and presentation-only labels do not commit a partial battle.
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(readySave);
  await page.reload(); await expect(page.locator('[data-td-phase]')).toHaveText('布阵');
  await expect(tower.locator('small')).toHaveText('1 · 共鸣');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
