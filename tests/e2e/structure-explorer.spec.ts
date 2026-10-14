import { test as base, expect, type Page, type Locator } from '@playwright/test';

type StructureState = { rotation: [number, number]; pan: [number, number]; dragMode: 'rotate' | 'pan'; scale: number; selected: string | null; gesturing: boolean; ready: boolean; view: string; exploded: boolean; contextLost: boolean };
type DemoState = { mode: number; open: number; pos: number; auto: boolean; marks: number[]; crumbs: number; pressure: number; grade: string; zoom: number; view: string; part: string; processStep: number; structure: StructureState };
// Preserve a Pages subdirectory when an explicitly requested remote base is used.
const basePath = process.env.STRUCTURE_BASE_URL ? new URL(process.env.STRUCTURE_BASE_URL).pathname.replace(/\/?$/, '/') : '/';
const expectedCommit = process.env.STRUCTURE_EXPECTED_COMMIT?.toLowerCase();
const directory = `${basePath}?play=structure-explorer`;
const pencil = `${directory}&exhibit=pencil`;
const frame = (page: Page) => page.frameLocator('[data-pencil-frame]');
const stage = (page: Page) => frame(page).locator('#stage');
async function state(page: Page): Promise<DemoState> {
  return stage(page).evaluate(() => (window as unknown as { pencilDemo: { state(): DemoState } }).pencilDemo.state());
}
const ink = (s: DemoState) => s.marks.reduce((sum, value) => sum + value, 0);
const parts = ['wood-upper', 'wood-lower', 'core', 'paint-upper', 'paint-lower', 'tip'];
async function ready3d(page: Page) {
  await expect(frame(page).locator('canvas#pencil-3d')).toBeVisible();
  await expect.poll(async () => (await state(page)).structure.ready).toBe(true);
  expect((await state(page)).structure.contextLost).toBe(false);
  if (expectedCommit) {
    await expect(page.locator('html'), 'Parent page must serve the expected commit').toHaveAttribute('data-build-commit', expectedCommit);
    await expect(frame(page).locator('html'), 'Pencil iframe must serve the same expected commit').toHaveAttribute('data-build-commit', expectedCommit);
  }
}
async function revealControl(target: Locator) {
  const details = target.locator('xpath=ancestor::details').last();
  if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').first().click();
  await expect(target).toBeVisible();
}
async function canvasPoint(page: Page) {
  const canvas = frame(page).locator('canvas#pencil-3d');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Visible 3D canvas missing');
  return { x: box.x + box.width * .55, y: box.y + box.height * .55, box };
}
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

test('BOOM stops after opening and closing; writing motion starts explicitly, pauses and resets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Normal motion on representative desktop');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(pencil);
  await ready3d(page);
  expect((await state(page)).auto).toBe(false);
  await expect(frame(page).locator('#auto')).not.toBeVisible();
  const canvas = frame(page).locator('canvas#pencil-3d');
  // Keep the crop at the same document position. Button auto-scroll otherwise places the
  // canvas top just outside the viewport and clips a row, even when restored geometry is identical.
  const capture = async () => {
    const documentTop = (await canvas.boundingBox())!.y + await page.evaluate(() => window.scrollY);
    await page.evaluate(top => window.scrollTo({ top: Math.max(0, Math.floor(top) - 32), behavior: 'instant' }), documentTop);
    const box = (await canvas.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    return canvas.screenshot();
  };
  const assembled = await capture();
  for (const exploded of [true, false]) {
    await frame(page).locator('#boom').click();
    await expect.poll(async () => (await state(page)).structure.exploded).toBe(exploded);
    expect((await state(page)).open).toBe(exploded ? 1 : 0);
    expect((await state(page)).auto).toBe(false);
    // open is an immediate semantic value. Compare rendered canvas pixels after the bounded
    // transition so this verifies a stable visual result, rather than an automatic oscillation.
    await page.waitForTimeout(800);
    const settled = await capture();
    await page.waitForTimeout(200);
    expect((await capture()).equals(settled), 'BOOM stays at its completed visual position').toBe(true);
    expect(settled.equals(assembled), 'Opening changes the rendered geometry; closing restores it').toBe(!exploded);
  }
  await frame(page).locator('[data-mode="1"]').click();
  await frame(page).locator('#auto').click();
  await expect.poll(async () => ink(await state(page))).toBeGreaterThan(5);
  await frame(page).locator('#auto').click();
  expect((await state(page)).auto).toBe(false);
  const paused = await state(page);
  await page.waitForTimeout(250);
  expect(await state(page)).toEqual(paused);
  await frame(page).locator('#auto').click();
  expect((await state(page)).auto).toBe(true);
  await frame(page).locator('[data-mode="2"]').click();
  expect((await state(page)).auto).toBe(false);
  await frame(page).locator('#reset').click();
  expect(ink(await state(page))).toBe(0);
});

test('keyboard: home → directory → pencil, native controls, return and reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Full actual keyboard playthrough on desktop');
  await page.goto(`${basePath}?world=my-game-world`);
  const entrance = page.getByRole('button', { name: /结构探索馆/ }).or(page.getByRole('link', { name: /结构探索馆/ }));
  await expect(entrance).toBeVisible();
  await tabTo(page, entrance);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-structure-view="directory"]')).toBeVisible();
  await tabTo(page, page.locator('[data-structure-pencil]'));
  await page.keyboard.press('Enter');
  await expect(stage(page)).toBeVisible();
  await ready3d(page);
  const initialRotation = (await state(page)).structure.rotation;
  await tabTo(page, stage(page));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).structure.rotation).not.toEqual(initialRotation);
  await page.keyboard.press('+');
  expect((await state(page)).structure.scale).toBeGreaterThan(1);
  await page.keyboard.press('-');
  await page.keyboard.press('End');
  await expect.poll(async () => (await state(page)).structure.exploded).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).structure.exploded).toBe(false);
  await page.keyboard.press('Home');
  expect((await state(page)).structure.rotation).toEqual(initialRotation);
  expect((await state(page)).structure.scale).toBe(1);
  await tabTo(page, frame(page).locator('#drag-pan'));
  await page.keyboard.press('Space');
  await expect(frame(page).locator('#drag-pan')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame(page).locator('#drag-rotate')).toHaveAttribute('aria-pressed', 'false');
  expect((await state(page)).structure.dragMode).toBe('pan');
  expect((await state(page)).structure.rotation).toEqual(initialRotation);
  expect((await state(page)).structure.pan).toEqual([0, 0]);
  expect((await state(page)).structure.exploded, 'Native mode button does not also activate the stage').toBe(false);
  await tabTo(page, frame(page).locator('#drag-rotate'));
  await page.keyboard.press('Enter');
  await expect(frame(page).locator('#drag-rotate')).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).structure.dragMode).toBe('rotate');
  await tabTo(page, frame(page).locator('#boom'));
  await page.keyboard.press('Space');
  expect((await state(page)).structure.exploded, 'Native Space activates BOOM exactly once').toBe(true);
  const upperWoodLabel = frame(page).locator('[data-inspect-part="wood-upper"]');
  await tabTo(page, frame(page).locator('[data-inspect-part="paint-upper"]'));
  await page.keyboard.press('ArrowRight');
  await expect(upperWoodLabel).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await state(page)).structure.selected, 'A part button activates independently of stage shortcuts').toBe('wood-upper');
  const partDialog = frame(page).locator('#inspector-dialog');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await partDialog.evaluate(el => el.contains(el.ownerDocument.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(upperWoodLabel).toBeFocused();
  expect((await state(page)).structure.selected).toBeNull();
  await tabTo(page, frame(page).locator('#part'));
  // Open the native popup before navigating: on Chromium a closed select changes immediately
  // on ArrowDown, which opens inspection and moves focus before Enter can commit the option.
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).structure.selected).toBe('wood-upper');
  await tabTo(page, stage(page));
  await page.keyboard.press('Escape');
  expect((await state(page)).structure.selected).toBeNull();
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
  await ready3d(page);
  await revealControl(frame(page).locator('#view'));
  for (const view of ['assembled', 'exploded', 'longitudinal', 'cross']) {
    await frame(page).locator('#view').selectOption(view);
    expect((await state(page)).view).toBe(view);
    expect((await state(page)).structure.view).toBe(view);
    await ready3d(page);
  }
  for (const part of [...parts, 'all']) {
    await frame(page).locator('#part').selectOption(part);
    expect((await state(page)).part).toBe(part);
    expect((await state(page)).structure.selected).toBe(part === 'all' ? null : part);
    if (part !== 'all') {
      await expect(frame(page).locator('#inspector-dialog')).toBeVisible();
      await frame(page).locator('#return-parts').click();
      expect((await state(page)).structure.selected).toBeNull();
    }
  }
  const initialZoom = (await state(page)).zoom;
  await revealControl(frame(page).locator('#zoom-in'));
  await frame(page).locator('#zoom-in').click();
  expect((await state(page)).zoom).toBeGreaterThan(initialZoom);
  await frame(page).locator('#zoom-out').click();
  expect((await state(page)).zoom).toBeCloseTo(initialZoom, 8);
  await frame(page).locator('#view-reset').click();
  expect((await state(page)).zoom).toBe(1);
  const opener = frame(page).locator('#expand-view');
  await frame(page).locator('#boom').click();
  await opener.click();
  const dialog = frame(page).locator('#inspector-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#stage')).toHaveCount(1);
  await expect(frame(page).locator('#stage')).toHaveCount(1);
  await ready3d(page);
  await frame(page).locator('[data-inspect-part="core"]').click();
  expect((await state(page)).structure.selected).toBe('core');
  await frame(page).locator('#return-parts').click();
  expect((await state(page)).structure.selected).toBeNull();
  // Leaving a single-part inspection closes its dialog; reopen the general enlarged view.
  await opener.click();
  await expect(dialog).toBeVisible();
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

test('mouse rotates the 3D pencil without selecting, zooms and inspects each exploded part', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Representative mouse gestures on desktop');
  await page.goto(pencil);
  await ready3d(page);
  await frame(page).locator('#boom').click();
  expect((await state(page)).structure.exploded).toBe(true);
  const canvasBox = (await canvasPoint(page)).box;
  // BOOM lays the exposed core through the actual canvas center. This exercises geometry picking,
  // independently of HTML label buttons and the native select alternative.
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.down();
  expect((await state(page)).structure.selected).toBeNull();
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).structure.selected).toBe('core');
  await expect(frame(page).locator('#inspector-dialog')).toBeVisible();
  await frame(page).locator('#return-parts').click();
  await expect(frame(page).locator('#inspector-dialog')).not.toBeVisible();
  const before = (await state(page)).structure;
  const p = await canvasPoint(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  expect((await state(page)).structure.selected, 'Selection completes only on release').toBeNull();
  await page.mouse.move(p.x + 55, p.y + 25, { steps: 6 });
  await expect.poll(async () => (await state(page)).structure.rotation).not.toEqual(before.rotation);
  await page.mouse.up();
  expect((await state(page)).structure.selected, 'Rotation drag cannot become a part click').toBeNull();
  expect((await state(page)).structure.gesturing).toBe(false);
  const scale = (await state(page)).structure.scale;
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await state(page)).structure.scale).toBeGreaterThan(scale);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await state(page)).structure.scale).toBeLessThan(scale * 1.01);
  for (const part of parts) {
    await frame(page).locator(`[data-inspect-part="${part}"]`).click();
    expect((await state(page)).structure.selected).toBe(part);
    expect((await state(page)).part).toBe(part);
    await frame(page).locator('#return-parts').click();
    expect((await state(page)).structure.selected).toBeNull();
    expect((await state(page)).structure.exploded).toBe(true);
  }
});

test('left mouse pans by mode or Shift, cancels safely and preserves the exploded view on return', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Representative actual left-button pan input on desktop');
  await page.goto(pencil);
  await ready3d(page);
  const canvas = frame(page).locator('canvas#pencil-3d');
  const panButton = frame(page).locator('#drag-pan');
  const rotateButton = frame(page).locator('#drag-rotate');
  const drag = async (release = true) => {
    const p = await canvasPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(p.x + 36, p.y + 14, { steps: 5 });
    if (release) await page.mouse.up({ button: 'left' });
  };
  expect((await state(page)).structure.dragMode).toBe('rotate');
  await expect(rotateButton).toHaveAttribute('aria-pressed', 'true');
  await panButton.click();
  await expect(panButton).toHaveAttribute('aria-pressed', 'true');
  const start = (await state(page)).structure;
  await drag();
  const panned = (await state(page)).structure;
  expect(panned.pan).not.toEqual(start.pan);
  expect(panned.rotation).toEqual(start.rotation);
  expect(panned.selected).toBeNull();
  expect(panned.gesturing).toBe(false);
  await drag(false);
  expect((await state(page)).structure.pan).not.toEqual(panned.pan);
  // Diagnose pointercancel on an actual held left-button pan, then release the real mouse.
  await canvas.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up({ button: 'left' });
  expect((await state(page)).structure.pan).toEqual(panned.pan);
  expect((await state(page)).structure.rotation).toEqual(panned.rotation);
  expect((await state(page)).structure.gesturing).toBe(false);
  await drag(false);
  expect((await state(page)).structure.pan).not.toEqual(panned.pan);
  await stage(page).evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up({ button: 'left' });
  expect((await state(page)).structure.pan).toEqual(panned.pan);
  expect((await state(page)).structure.gesturing).toBe(false);
  await rotateButton.click();
  const beforeRotate = (await state(page)).structure;
  await drag();
  const rotated = (await state(page)).structure;
  expect(rotated.rotation).not.toEqual(beforeRotate.rotation);
  expect(rotated.pan).toEqual(beforeRotate.pan);
  expect(rotated.selected).toBeNull();
  await page.keyboard.down('Shift');
  try { await drag(); } finally { await page.keyboard.up('Shift'); }
  const shifted = (await state(page)).structure;
  expect(shifted.pan).not.toEqual(rotated.pan);
  expect(shifted.rotation).toEqual(rotated.rotation);
  expect(shifted.dragMode, 'Shift only temporarily changes the gesture').toBe('rotate');
  expect(shifted.selected).toBeNull();
  await frame(page).locator('#boom').click();
  await panButton.click();
  const box = (await canvasPoint(page)).box;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'left' });
  expect((await state(page)).structure.selected, 'A light click still picks geometry in pan mode').toBe('core');
  await frame(page).locator('#return-parts').click();
  await drag();
  const exploded = (await state(page)).structure;
  expect(exploded.exploded).toBe(true);
  expect(exploded.pan).not.toEqual([0, 0]);
  await frame(page).locator('[data-inspect-part="core"]').click();
  await expect(frame(page).locator('#inspector-dialog')).toBeVisible();
  await expect(panButton).toBeVisible();
  await panButton.click();
  const single = (await state(page)).structure;
  await drag();
  const singlePanned = (await state(page)).structure;
  expect(singlePanned.pan).not.toEqual(single.pan);
  expect(singlePanned.rotation).toEqual(single.rotation);
  expect(singlePanned.selected).toBe('core');
  await frame(page).locator('#return-parts').click();
  const restored = (await state(page)).structure;
  expect(restored.selected).toBeNull();
  expect(restored.pan).toEqual(exploded.pan);
  expect(restored.rotation).toEqual(exploded.rotation);
  expect(restored.scale).toBe(exploded.scale);
  expect(restored.view).toBe(exploded.view);
});

test('3D gestures clear on cancellation, focus loss, dialog entry and route re-entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Representative mouse lifecycle on desktop');
  await page.goto(pencil);
  await ready3d(page);
  const beginDrag = async () => {
    const p = await canvasPoint(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 35, p.y + 15, { steps: 4 });
    expect((await state(page)).structure.gesturing).toBe(true);
  };
  await beginDrag();
  // Diagnostic cancellation of an actual held mouse gesture, not synthetic gesture coverage.
  await stage(page).dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  expect((await state(page)).structure.gesturing).toBe(false);
  expect((await state(page)).structure.selected).toBeNull();
  await beginDrag();
  await stage(page).evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  expect((await state(page)).structure.gesturing).toBe(false);
  const stopped = (await state(page)).structure.rotation;
  const p = await canvasPoint(page);
  await page.mouse.move(p.x - 30, p.y - 20);
  expect((await state(page)).structure.rotation).toEqual(stopped);
  await beginDrag();
  await tabTo(page, frame(page).locator('#expand-view'));
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await expect(frame(page).locator('#inspector-dialog')).toBeVisible();
  expect((await state(page)).structure.gesturing).toBe(false);
  await page.keyboard.press('Escape');
  await beginDrag();
  await tabTo(page, page.locator('[data-structure-directory]'));
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await page.locator('[data-structure-pencil]').click();
  await ready3d(page);
  expect((await state(page)).structure.gesturing).toBe(false);
  expect((await state(page)).structure.selected).toBeNull();
  const reentered = (await state(page)).structure.rotation;
  const q = await canvasPoint(page);
  await page.mouse.move(q.x + 25, q.y + 10);
  expect((await state(page)).structure.rotation).toEqual(reentered);
});

test('device-emulated touch taps parts, rotates with one finger and pinches with two', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'Representative Chromium CDP device emulation; not physical-device evidence');
  await page.goto(pencil);
  await ready3d(page);
  await frame(page).locator('#drag-pan').tap();
  await expect(frame(page).locator('#drag-pan')).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).structure.dragMode).toBe('pan');
  expect((await state(page)).structure.selected).toBeNull();
  expect((await state(page)).structure.gesturing).toBe(false);
  // Mouse and touch remain interchangeable on the same emulated touch device.
  await frame(page).locator('#drag-rotate').click();
  await expect(frame(page).locator('#drag-rotate')).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).structure.dragMode).toBe('rotate');
  await frame(page).locator('#boom').tap();
  await frame(page).locator('[data-inspect-part="wood-upper"]').tap();
  expect((await state(page)).structure.selected).toBe('wood-upper');
  await frame(page).locator('#return-parts').tap();
  expect((await state(page)).structure.selected).toBeNull();
  const cdp = await context.newCDPSession(page);
  const touch = (id: number, x: number, y: number) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
  try {
    const p = await canvasPoint(page);
    const rotation = (await state(page)).structure.rotation;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, p.x, p.y)] });
    for (let step = 1; step <= 4; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(1, p.x + step * 8, p.y + step * 3)] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await state(page)).structure.rotation).not.toEqual(rotation);
    expect((await state(page)).structure.selected).toBeNull();
    expect((await state(page)).structure.gesturing).toBe(false);
    const q = await canvasPoint(page);
    const scale = (await state(page)).structure.scale;
    const separation = Math.min(28, q.box.width * .1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, q.x - separation, q.y), touch(2, q.x + separation, q.y)] });
    for (let step = 1; step <= 4; step++) {
      const distance = separation + step * 7;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(1, q.x - distance, q.y), touch(2, q.x + distance, q.y)] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await state(page)).structure.scale).toBeGreaterThan(scale);
    expect((await state(page)).structure.gesturing).toBe(false);
    expect((await state(page)).structure.selected).toBeNull();
    const r = await canvasPoint(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(1, r.x, r.y)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(1, r.x + 20, r.y + 10)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    expect((await state(page)).structure.gesturing).toBe(false);
    expect((await state(page)).structure.selected).toBeNull();
    await revealControl(frame(page).locator('#view-reset'));
    await frame(page).locator('#view-reset').tap();
    expect((await state(page)).structure.scale).toBe(1);
    await page.locator('[data-structure-directory]').tap();
    await page.locator('[data-structure-pencil]').tap();
    await ready3d(page);
    expect((await state(page)).structure.gesturing).toBe(false);
  } finally {
    await cdp.detach();
  }
});

test('3D controls and exploded part targets are at least 44px, unobstructed and reachable', async ({ page }, testInfo) => {
  await page.goto(pencil);
  await ready3d(page);
  const checkTarget = async (target: Locator) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width, 'Interactive target width').toBeGreaterThanOrEqual(44);
    expect(box!.height, 'Interactive target height').toBeGreaterThanOrEqual(44);
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await target.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const hit = el.ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === el || el.contains(hit);
    }), 'Interactive target center must receive input').toBe(true);
  };
  const activate = async (target: Locator) => {
    await checkTarget(target);
    if (testInfo.project.use.hasTouch) await target.tap();
    else await target.click();
  };
  await activate(frame(page).locator('#drag-pan'));
  await expect(frame(page).locator('#drag-pan')).toHaveAttribute('aria-pressed', 'true');
  await activate(frame(page).locator('#drag-rotate'));
  await expect(frame(page).locator('#drag-rotate')).toHaveAttribute('aria-pressed', 'true');
  await activate(frame(page).locator('#boom'));
  for (const part of parts) {
    await activate(frame(page).locator(`[data-inspect-part="${part}"]`));
    expect((await state(page)).structure.selected).toBe(part);
    await activate(frame(page).locator('#return-parts'));
    expect((await state(page)).structure.selected).toBeNull();
  }
  await checkTarget(frame(page).locator('#part'));
  await revealControl(frame(page).locator('#view'));
  await checkTarget(frame(page).locator('#view'));
  await revealControl(frame(page).locator('#zoom-in'));
  for (const id of ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'view-reset']) {
    await activate(frame(page).locator(`#${id}`));
  }
  expect((await state(page)).structure.scale).toBe(1);
  expect((await state(page)).structure.gesturing).toBe(false);
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
  await revealControl(frame(page).locator('#zoom-in'));
  await activateVisible(frame(page).locator('#zoom-in'));
  expect((await state(page)).zoom).toBeGreaterThan(1);
  await activateVisible(frame(page).locator('#view-reset'));
  expect((await state(page)).zoom).toBe(1);
  await activateVisible(frame(page).locator('#close-inspector'));
  await expect(dialog).not.toBeVisible();
  await expect(frame(page).locator('#expand-view')).toBeFocused();
  await expect.poll(async () => Math.abs((await iframe.boundingBox())!.height - naturalHeight)).toBeLessThanOrEqual(2);
});
