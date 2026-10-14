import { test as base, expect, type Page, type Locator } from '@playwright/test';

type DemoState = { mode: number; open: number; pos: number; auto: boolean; marks: number[]; crumbs: number };
const directory = '/?play=structure-explorer';
const pencil = `${directory}&exhibit=pencil`;
const frame = (page: Page) => page.frameLocator('[data-pencil-frame]');
const stage = (page: Page) => frame(page).locator('#stage');
async function state(page: Page): Promise<DemoState> {
  return stage(page).evaluate(() => (window as unknown as { pencilDemo: { state(): DemoState } }).pencilDemo.state());
}
const ink = (s: DemoState) => s.marks.reduce((sum, value) => sum + value, 0);
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 80; i++) {
    if (await target.evaluate(el => el === el.ownerDocument.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Target cannot be reached with actual Tab navigation');
}
async function point(page: Page) {
  await stage(page).scrollIntoViewIfNeeded();
  const box = await stage(page).boundingBox();
  if (!box) throw new Error('Visible pencil stage missing');
  return { x: box.x + box.width * .78, y: box.y + box.height * .65 };
}

const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [async ({ page, baseURL }, use) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.failure()?.errorText} ${request.url()}`); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin) external.push(url.href);
    });
    await use();
    expect(errors, 'Uncaught runtime errors').toEqual([]);
    expect(external, 'Unexpected external runtime requests').toEqual([]);
  }, { auto: true }],
});

test('normal motion starts explicitly, pauses, switches modes and resets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Normal motion on representative desktop');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(pencil);
  expect((await state(page)).auto).toBe(false);
  await frame(page).locator('#auto').click();
  await expect.poll(async () => (await state(page)).open).toBeGreaterThan(.1);
  await frame(page).locator('#auto').click();
  expect((await state(page)).auto).toBe(false);
  // Pausing stops automatic targets; allow its existing eased motion to settle.
  await page.waitForTimeout(1800);
  const paused = await state(page);
  await page.waitForTimeout(250);
  expect(await state(page)).toEqual(paused);
  await frame(page).locator('[data-mode="1"]').click();
  await frame(page).locator('#auto').click();
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(5);
  await frame(page).locator('[data-mode="2"]').click();
  expect((await state(page)).auto).toBe(false);
  await frame(page).locator('#reset').click();
  expect(ink(await state(page))).toBe(0);
});

test('keyboard: home → directory → pencil, native controls, return and reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Full actual keyboard playthrough on desktop');
  await page.goto('/?world=my-game-world');
  const entrance = page.getByRole('button', { name: /结构探索馆/ }).or(page.getByRole('link', { name: /结构探索馆/ }));
  await expect(entrance).toBeVisible();
  await tabTo(page, entrance);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-structure-view="directory"]')).toBeVisible();
  await tabTo(page, page.locator('[data-structure-pencil]'));
  await page.keyboard.press('Enter');
  await expect(stage(page)).toBeVisible();
  const modes = frame(page).locator('[data-mode]');
  await tabTo(page, modes.nth(0));
  await page.keyboard.press('ArrowRight');
  await expect(modes.nth(1)).toBeFocused();
  await expect(modes.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(modes.nth(0)).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Tab');
  await expect(stage(page)).toBeFocused();
  await page.keyboard.press('End');
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(10);
  await page.keyboard.press('Shift+Tab');
  await expect(modes.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(modes.nth(2)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('End');
  await expect.poll(async () => (await state(page)).crumbs).toBeGreaterThan(0);
  await tabTo(page, frame(page).locator('#reset'));
  await page.keyboard.press('Enter');
  await expect.poll(async () => ink(await state(page))).toBe(0);
  await tabTo(page, page.locator('[data-structure-directory]'));
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-structure-pencil]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-structure-view="directory"]')).toBeVisible();
  await tabTo(page, page.locator('[data-structure-home]'));
  await page.keyboard.press('Enter');
  await expect(entrance).toBeVisible();
});

test('mouse writes, erases, resets, cancels pending taps and stops on blur', async ({ page }) => {
  await page.goto(pencil);
  await frame(page).locator('[data-mode="1"]').click();
  const p = await point(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  expect(ink(await state(page)), 'Pointerdown does not write before release').toBe(0);
  // Synthetic pointercancel is a diagnostic of the real mouse gesture's cancellation handler.
  await stage(page).dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect(ink(await state(page))).toBe(0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 30, p.y, { steps: 4 });
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(0);
  await stage(page).dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  expect(ink(await state(page)), 'Canceled drag restores its original paper').toBe(0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 30, p.y, { steps: 4 });
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(0);
  await page.mouse.wheel(0, 60);
  await expect.poll(async () => ink(await state(page)), 'Wheel scrolling cancels the unfinished drag').toBe(0);
  await page.mouse.up();
  expect(ink(await state(page))).toBe(0);
  const writePoint = await point(page);
  await page.mouse.click(writePoint.x, writePoint.y);
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(10);
  const beforeErase = ink(await state(page));
  await frame(page).locator('[data-mode="2"]').click();
  const eraserPoint = await point(page);
  await page.mouse.click(eraserPoint.x, eraserPoint.y);
  await expect.poll(async () => ink(await state(page))).toBeLessThan(beforeErase);
  await frame(page).locator('#reset').click();
  expect(ink(await state(page))).toBe(0);
  const blankPoint = await point(page);
  await page.mouse.click(blankPoint.x, blankPoint.y);
  await expect.poll(async () => (await state(page)).pos).toBeGreaterThan(.2);
  expect(ink(await state(page)), 'Erasing a blank sheet does not create ink').toBe(0);
  await frame(page).locator('[data-mode="1"]').click();
  const blurPoint = await point(page);
  await page.mouse.move(blurPoint.x, blurPoint.y);
  await page.mouse.down();
  await page.mouse.move(blurPoint.x - 30, blurPoint.y, { steps: 4 });
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(0);
  await stage(page).evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  const stopped = await state(page);
  await page.waitForTimeout(200);
  expect(await state(page)).toEqual(stopped);
  expect(ink(stopped)).toBe(0);
});

test('touch completes writing, erasing, reset and return', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch profiles only');
  await page.goto(directory);
  await page.locator('[data-structure-pencil]').tap();
  await frame(page).locator('[data-mode="1"]').tap();
  const p = await point(page);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(10);
  const beforeErase = ink(await state(page));
  await frame(page).locator('[data-mode="2"]').tap();
  const q = await point(page);
  await page.touchscreen.tap(q.x, q.y);
  await expect.poll(async () => ink(await state(page))).toBeLessThan(beforeErase);
  await frame(page).locator('#reset').tap();
  expect(ink(await state(page))).toBe(0);
  expect(await context.cookies()).toEqual([]);
  await page.locator('[data-structure-directory]').tap();
  await expect(page.locator('[data-structure-pencil]')).toBeVisible();
});

test('unknown and duplicate exhibit safely fall back without changing storage', async ({ page }) => {
  await page.goto(directory);
  const snapshot = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const original = await snapshot();
  for (const query of ['&exhibit=unknown', '&exhibit=pencil&exhibit=pencil', '&exhibit=']) {
    await page.goto(directory + query);
    await expect(page.locator('[data-structure-view="directory"]')).toBeVisible();
    await expect(page.locator('[data-pencil-frame]')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('还没有开放');
    expect(await snapshot()).toEqual(original);
  }
});

test('responsive layout and iframe height accommodate every mode', async ({ page }, testInfo) => {
  await page.goto(directory);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('temporary-directory.png'), fullPage: true });
  await page.locator('[data-structure-pencil]').click();
  for (const mode of [0, 1, 2]) {
    await frame(page).locator(`[data-mode="${mode}"]`).click();
    await expect.poll(async () => frame(page).locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect.poll(async () => frame(page).locator('.page').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`temporary-mode-${mode}.png`), fullPage: true });
  }
  await page.reload();
  await expect(stage(page)).toBeVisible();
  expect(ink(await state(page))).toBe(0);
});
