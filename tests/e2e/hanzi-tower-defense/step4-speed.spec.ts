import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { activate, criticalTargets, fromHome, keyReach, type InputMode } from '../step4/input-helpers';
import { SAVE_KEY } from '../../../games/hanzi-tower-defense/save';

const evidence = process.env.TD_EVIDENCE_DIR ?? 'tmp/tasks/GAME-CODEX-STEP4/tower';
const speedControl = '[data-td-speed]';
const readClock = (page: Page) => page.locator('.td-game').evaluate(element => ({
  wall: performance.now(), simulated: Number(element.getAttribute('data-elapsed')),
}));

async function measureProgress(page: Page, milliseconds: number) {
  const before = await readClock(page);
  // Observe real foreground time. Do not install a fake clock or insert battle state.
  await page.waitForTimeout(milliseconds);
  const after = await readClock(page);
  const wallSeconds = (after.wall - before.wall) / 1000, simulatedSeconds = after.simulated - before.simulated;
  return { wallSeconds, simulatedSeconds, rate: simulatedSeconds / wallSeconds };
}

test('STEP4 real 1x/2x speed, pause, native activation, independent saves and mobile targets', async ({ page }, info) => {
  test.setTimeout(120_000);
  mkdirSync(evidence, { recursive: true });
  const mode: InputMode = info.project.name === 'touch' ? 'touch' : 'keyboard';
  const act = (selector: string, key?: string) => activate(page, selector, mode, undefined, key);
  const game = page.locator('.td-game'), speed = page.locator(speedControl), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await fromHome(page, mode, 'forest');
  await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready', 'true');
  await act('[data-td-new]'); await act('[data-map-select="twin-bends"]');
  await expect(game).toHaveAttribute('data-phase', 'ready');
  await expect(game).toHaveAttribute('data-speed', '1');
  await expect(speed).toHaveText('速度 1×'); await expect(speed).toHaveAttribute('aria-pressed', 'false');
  const originalSave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);

  if (mode === 'keyboard') {
    await keyReach(page, speedControl); await expect(speed).toBeFocused();
    await page.keyboard.press('Enter'); await expect(game).toHaveAttribute('data-speed', '2');
    await expect(speed).toBeFocused(); await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space'); await expect(game).toHaveAttribute('data-speed', '1');
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    await expect(game).toHaveAttribute('data-speed', '2');
    await page.keyboard.down('Space'); await page.keyboard.down('Space'); await page.keyboard.up('Space');
    await expect(game).toHaveAttribute('data-speed', '1');
    // Independently exercise ordinary mouse activation, including release semantics.
    await activate(page, speedControl, 'mouse'); await expect(game).toHaveAttribute('data-speed', '2');
    await activate(page, speedControl, 'mouse'); await expect(game).toHaveAttribute('data-speed', '1');
  } else {
    await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
    await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await act(speedControl); await expect(game).toHaveAttribute('data-speed', '1');
  }
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);
  expect((await measureProgress(page, 400)).simulatedSeconds).toBe(0);

  const initialViewport = page.viewportSize()!, geometry = [];
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.td-controls button')).toHaveCount(8);
    geometry.push({ width, targets: await criticalTargets(page, '.td-controls button', 48) });
    expect(await page.locator('.td-controls button').evaluateAll(buttons => new Set(buttons.map(button => Math.round(button.getBoundingClientRect().y))).size)).toBe(2);
  }
  await page.screenshot({ path: `${evidence}/step4-speed-${mode}-mobile.png`, fullPage: true });
  await page.setViewportSize(initialViewport);

  await act('[data-td-next]'); await expect(game).toHaveAttribute('data-phase', 'battle');
  const normal = await measureProgress(page, 3000);
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
  const fast = await measureProgress(page, 3000);
  await expect(game).toHaveAttribute('data-phase', 'battle');
  const ratio = fast.rate / normal.rate;
  expect(normal.rate).toBeGreaterThan(.65); expect(normal.rate).toBeLessThan(1.25);
  expect(fast.rate).toBeGreaterThan(1.45); expect(fast.rate).toBeLessThan(2.5);
  expect(ratio).toBeGreaterThan(1.65); expect(ratio).toBeLessThan(2.35);

  await act('[data-td-pause]'); await expect(game).toHaveAttribute('data-paused', 'true');
  const pausedSave = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  const paused = await measureProgress(page, 1000); expect(paused.simulatedSeconds).toBe(0);
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '1');
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
  await expect(game).toHaveAttribute('data-paused', 'true');
  expect((await measureProgress(page, 400)).simulatedSeconds).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(pausedSave);

  await act('[data-td-new]'); await act('[data-map-select="beacon-keep"]');
  await expect(game).toHaveAttribute('data-speed', '1'); await expect(game).toHaveAttribute('data-phase', 'ready');
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
  await act('[data-td-restart]'); await act('[data-td-confirm-restart]');
  await expect(game).toHaveAttribute('data-speed', '1');
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
  await page.reload(); await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready', 'true');
  await expect(game).toHaveAttribute('data-speed', '1'); await expect(game).toHaveAttribute('data-phase', 'ready');
  await act(speedControl); await expect(game).toHaveAttribute('data-speed', '2');
  await act('[data-td-continue]'); await act('[data-map-select="twin-bends"]');
  await expect(game).toHaveAttribute('data-speed', '1'); await expect(speed).toHaveAttribute('aria-pressed', 'false');
  await act('[data-td-home]'); await expect(page.locator('[data-world-forest-link]')).toBeVisible();
  expect(errors).toEqual([]);
  writeFileSync(`${evidence}/step4-speed-${mode}.json`, JSON.stringify({ mode, inputs: mode === 'keyboard' ? ['keyboard', 'mouse'] : ['touch'], normal, fast, ratio, paused, geometry, speedNotSaved: true, stateInjection: false, externalClockAcceleration: false, productSpeeds: [1, 2], errors }, null, 2));
});
