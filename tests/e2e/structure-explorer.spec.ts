import { test as base, expect, type Page, type Locator } from '@playwright/test';

type DemoState = { mode: number; open: number; pos: number; auto: boolean; marks: number[]; crumbs: number; pressure: number; grade: string; zoom: number; view: string; part: string; processStep: number };
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
  await expect(frame(page).locator('#expand-view')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(stage(page)).toBeFocused();
  await page.keyboard.press('End');
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(10);
  await page.keyboard.press('Shift+Tab');
  await expect(frame(page).locator('#expand-view')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modes.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(modes.nth(2)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(frame(page).locator('#expand-view')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(stage(page)).toBeFocused();
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

test('structure views, part inspection and zoom remain usable in the enlarged dialog', async ({ page }) => {
  await page.goto(pencil);
  for (const view of ['assembled', 'exploded', 'longitudinal', 'cross']) {
    await frame(page).locator('#view').selectOption(view);
    expect((await state(page)).view).toBe(view);
    const active = view === 'cross' ? '#model-cross' : view === 'longitudinal' ? '#model-longitudinal' : '#model-structure';
    await expect(stage(page).locator(active)).toBeVisible();
    await expect(stage(page).locator('#structure > svg:visible')).toHaveCount(1);
  }
  for (const part of ['paint', 'wood', 'core', 'tip', 'all']) {
    await frame(page).locator('#part').selectOption(part);
    expect((await state(page)).part).toBe(part);
  }
  const initialZoom = (await state(page)).zoom;
  await frame(page).locator('#zoom-in').click();
  expect((await state(page)).zoom).toBeGreaterThan(initialZoom);
  await frame(page).locator('#zoom-out').click();
  expect((await state(page)).zoom).toBeCloseTo(initialZoom, 8);
  await frame(page).locator('#view-reset').click();
  expect((await state(page)).zoom).toBe(1);
  const opener = frame(page).locator('#expand-view');
  await opener.click();
  const dialog = frame(page).locator('#inspector-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#stage')).toHaveCount(1);
  await expect(frame(page).locator('#stage')).toHaveCount(1);
  expect((await state(page)).auto).toBe(false);
  // Actual keys exercise both modal boundaries; focus must never escape to the iframe or parent page.
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate(el => el.contains(el.ownerDocument.activeElement))).toBe(true);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(stage(page)).toBeVisible();
  await opener.click();
  await frame(page).locator('#close-inspector').click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('controlled comparisons keep three real traces and survive ordinary paper and setting changes', async ({ page }, testInfo) => {
  await page.goto(pencil);
  const activate = async (target: Locator) => testInfo.project.use.hasTouch ? target.tap() : target.click();
  await activate(frame(page).locator('[data-mode="1"]'));
  const rows = frame(page).locator('[data-comparison-row]');
  for (const kind of ['grade', 'pressure', 'paper', 'passes']) {
    await frame(page).locator('#compare-kind').selectOption(kind);
    await activate(frame(page).locator('#compare-run'));
    await expect(rows).toHaveCount(3);
    const conditions = await rows.evaluateAll(els => els.map(el => {
      const svg = el.querySelector('svg');
      return { density: Number(svg?.getAttribute('data-density')), grade: svg?.getAttribute('data-grade'), pressure: svg?.getAttribute('data-pressure'), paper: svg?.getAttribute('data-paper'), passes: svg?.getAttribute('data-passes') };
    }));
    expect(conditions.every(row => Number.isFinite(row.density) && row.density > 0 && row.density < 1)).toBe(true);
    expect(conditions[0].density).toBeLessThan(conditions[1].density);
    expect(conditions[1].density).toBeLessThan(conditions[2].density);
    for (const fixed of ['grade', 'pressure', 'paper', 'passes'] as const) {
      expect(new Set(conditions.map(row => row[fixed])).size).toBe(fixed === kind ? 3 : 1);
    }
    for (let i = 0; i < 3; i++) await expect(rows.nth(i).locator('svg')).toBeVisible();
    await expect(frame(page).locator('#compare-result')).not.toHaveText('');
  }
  const snapshot = await frame(page).locator('#comparison-results').innerHTML();
  const p = await point(page);
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(0);
  const existingMarks = (await state(page)).marks;
  await frame(page).locator('#grade').selectOption('2B');
  await frame(page).locator('#pressure').selectOption('2');
  await frame(page).locator('#paper').selectOption('rough');
  expect((await state(page)).marks, 'Changing a writing condition preserves the marks already on the paper').toEqual(existingMarks);
  await activate(frame(page).locator('#reset'));
  expect(await frame(page).locator('#comparison-results').innerHTML()).toBe(snapshot);
  expect(ink(await state(page))).toBe(0);
});

test('micro process advances and reverses explicitly in writing and erasing modes', async ({ page }, testInfo) => {
  await page.goto(pencil);
  const activate = async (target: Locator) => testInfo.project.use.hasTouch ? target.tap() : target.click();
  for (const mode of [1, 2]) {
    await activate(frame(page).locator(`[data-mode="${mode}"]`));
    const slider = frame(page).locator('#process-step');
    await tabTo(page, slider);
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await expect(frame(page).locator('#micro-process')).toBeVisible();
    const descriptions = new Set<string>();
    for (let step = 0; step <= 3; step++) {
      expect((await state(page)).processStep).toBe(step);
      const description = (await frame(page).locator('#process-description').textContent())?.trim() ?? '';
      expect(description).not.toBe('');
      descriptions.add(description);
      if (step < 3) await activate(frame(page).locator('#process-next'));
    }
    expect(descriptions.size).toBe(4);
    for (let step = 2; step >= 0; step--) {
      await activate(frame(page).locator('#process-prev'));
      expect((await state(page)).processStep).toBe(step);
    }
  }
  await activate(frame(page).locator('#reset'));
  const p = await point(page);
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  expect(ink(await state(page))).toBe(0);
  expect((await state(page)).crumbs).toBe(0);
  await expect(frame(page).locator('#picked > *')).toHaveCount(0);
});

test('automatic erasing never draws on blank paper or replaces a faint line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pencil);
  await frame(page).locator('[data-mode="2"]').click();
  await frame(page).locator('#auto').click();
  await expect.poll(async () => (await state(page)).pos).toBe(1);
  expect(ink(await state(page)), 'An automatic eraser cannot deposit ink on blank paper').toBe(0);
  expect((await state(page)).crumbs).toBe(0);
  await expect(frame(page).locator('#picked > *')).toHaveCount(0);
  await frame(page).locator('#seed').click();
  await tabTo(page, stage(page));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('End');
    await expect.poll(async () => (await state(page)).pos).toBe(1);
    await page.keyboard.press('Home');
    await expect.poll(async () => (await state(page)).pos).toBe(0);
  }
  const faint = await state(page);
  expect(faint.marks.every(value => value < .1)).toBe(true);
  expect(ink(faint)).toBeGreaterThan(0);
  await frame(page).locator('#auto').click();
  await expect.poll(async () => (await state(page)).pos).toBe(1);
  const erased = await state(page);
  expect(ink(erased)).toBeLessThan(ink(faint));
  expect(erased.marks.every((value, i) => value <= faint.marks[i])).toBe(true);
});

test('enlarged dialog controls fit the parent viewport and accept real pointer input', async ({ page }, testInfo) => {
  await page.goto(pencil);
  const iframe = page.locator('[data-pencil-frame]');
  await expect(stage(page)).toBeVisible();
  await expect.poll(async () => frame(page).locator('.page').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  const naturalHeight = (await iframe.boundingBox())!.height;
  const activateVisible = async (target: Locator) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await target.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const hit = el.ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === el || el.contains(hit);
    }), 'A visible target must receive input at its center').toBe(true);
    if (testInfo.project.use.hasTouch) await target.tap();
    else await target.click();
  };
  await activateVisible(frame(page).locator('#expand-view'));
  const dialog = frame(page).locator('#inspector-dialog');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await dialog.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await activateVisible(frame(page).locator('#zoom-in'));
  expect((await state(page)).zoom).toBeGreaterThan(1);
  await activateVisible(frame(page).locator('#view-reset'));
  expect((await state(page)).zoom).toBe(1);
  await activateVisible(frame(page).locator('#close-inspector'));
  await expect(dialog).not.toBeVisible();
  await expect(frame(page).locator('#expand-view')).toBeFocused();
  await expect.poll(async () => Math.abs((await iframe.boundingBox())!.height - naturalHeight)).toBeLessThanOrEqual(2);
});
