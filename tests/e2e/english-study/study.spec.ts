import { expect, test, type Page } from '@playwright/test';

async function lookup(page: Page, word: string, touch = false): Promise<void> {
  await page.locator('#es-input').fill(word);
  if (touch) { await page.locator('[data-es-search] button').tap(); await page.locator('[data-es-results] button').first().tap(); }
  else { await page.locator('[data-es-search] button').click(); await page.locator('[data-es-results] button').first().click(); }
}
async function ratio(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate(path => {
    const ink = path as SVGPathElement;
    return 1 - parseFloat(ink.style.strokeDashoffset) / ink.getTotalLength();
  });
}

test('one apple sheet writes continuously, pauses in place, preserves both p instances and completes', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).origin !== 'http://127.0.0.1:5175') external.push(request.url()); });
  await page.goto('?world=my-game-world');
  const entrance = page.locator('[data-world-english-link]');
  if (info.project.name.includes('touch')) await entrance.tap(); else await entrance.click();
  await expect(page).toHaveURL(/play=english-study/);
  await expect(page.locator('[data-testid=english-study]')).toHaveAttribute('data-word-count', '10547');
  await lookup(page, 'apple', info.project.name.includes('touch'));
  await expect(page.locator('[data-es-zh]')).toHaveText('苹果');
  const board = page.locator('[data-es-word-board] svg');
  await expect(board).toHaveCount(1);
  await expect(board.locator('[data-guide]')).toHaveCount(4);
  await expect(board.locator('.es-stroke-ghost[data-char-index="0"]')).not.toHaveCount(0);
  for (const index of [0, 1, 2, 3, 4]) {
    const path = board.locator(`.es-stroke-ghost[data-char-index="${index}"]`).first();
    expect(await path.evaluate(node => (node as SVGPathElement).getBBox().width + (node as SVGPathElement).getBBox().height)).toBeGreaterThan(0);
  }
  const firstP = board.locator('.es-stroke-ink[data-char-index="1"]');
  const secondP = board.locator('.es-stroke-ink[data-char-index="2"]');
  expect(await firstP.first().getAttribute('transform')).not.toBe(await secondP.first().getAttribute('transform'));
  if (info.project.name === 'chromium-desktop') await board.screenshot({ path: 'tmp/tasks/ENGLISH-STUDY/apple-before.png' });
  const play = page.locator('[data-es-word-pane] [data-es-control="play"]');
  await page.locator('[data-es-word-pane] [data-es-speed]').selectOption('slow');
  if (info.project.name.includes('touch')) await play.tap(); else await play.click();
  const first = '[data-es-word-board] .es-stroke-ink[data-char-index="0"]';
  await expect.poll(() => ratio(page, first), { timeout: 4000 }).toBeGreaterThan(0.22);
  const quarter = await ratio(page, first);
  await expect.poll(() => ratio(page, first), { timeout: 4000 }).toBeGreaterThan(0.48);
  const half = await ratio(page, first);
  if (info.project.name === 'chromium-desktop') await board.screenshot({ path: 'tmp/tasks/ENGLISH-STUDY/apple-half-stroke.png' });
  await play.click();
  const frozen = await ratio(page, first);
  expect(frozen).toBeLessThan(1);
  await page.waitForTimeout(2100);
  expect(await ratio(page, first)).toBeCloseTo(frozen, 4);
  await expect(play).toContainText('继续');
  await play.click();
  await expect.poll(() => ratio(page, first), { timeout: 4000 }).toBeGreaterThan(frozen + 0.03);
  await expect.poll(() => ratio(page, first), { timeout: 4000 }).toBeGreaterThan(0.72);
  const threeQuarter = await ratio(page, first);
  expect(quarter).toBeLessThan(half); expect(half).toBeLessThan(threeQuarter);
  await page.locator('[data-es-word-pane] [data-es-speed]').selectOption('fast');
  await expect.poll(() => ratio(page, '[data-es-word-board] .es-stroke-ink[data-char-index="1"]'), { timeout: 20000 }).toBeCloseTo(1, 3);
  await expect.poll(() => ratio(page, '[data-es-word-board] .es-stroke-ink[data-char-index="2"]'), { timeout: 12000 }).toBeGreaterThan(0.01);
  expect(await ratio(page, '[data-es-word-board] .es-stroke-ink[data-char-index="1"]')).toBe(1);
  if (info.project.name === 'chromium-desktop') await board.screenshot({ path: 'tmp/tasks/ENGLISH-STUDY/apple-partial.png' });
  await expect(page.locator('[data-es-word-status]')).toContainText('完成', { timeout: 30000 });
  await expect(board.locator('.es-stroke-ink')).toHaveCount(await board.locator('.es-stroke-ghost').count());
  expect(await board.locator('.es-stroke-ink').evaluateAll(paths => paths.every(path => parseFloat((path as SVGPathElement).style.strokeDashoffset) === 0))).toBe(true);
  if (info.project.name === 'chromium-desktop') await board.screenshot({ path: 'tmp/tasks/ENGLISH-STUDY/apple-complete.png' });
  const dialog = await page.locator('[data-es-word-dialog]').boundingBox();
  const boardBox = await board.boundingBox();
  expect(dialog && boardBox && boardBox.x >= dialog.x && boardBox.x + boardBox.width <= dialog.x + dialog.width + 1).toBeTruthy();
  for (const button of await page.locator('[data-es-word-pane] .es-writing-controls button').all()) {
    const box = await button.boundingBox();
    expect(box && dialog && box.width >= 44 && box.height >= 44 && box.x >= dialog.x && box.x + box.width <= dialog.x + dialog.width + 1).toBeTruthy();
  }
  await page.locator('[data-es-word-close]').click();
  await page.locator('[data-es-return]').click();
  await expect(page.locator('[data-world-english-link]')).toBeFocused();
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test('lookup keeps case, punctuation, repeats and unknown writing; review returns to word progress', async ({ page }, info) => {
  await page.goto('?play=english-study');
  await page.locator('#es-input').fill("Apple CAT I can't don't don’t ice-cream Apple");
  await page.locator('#es-input').press('Enter');
  await expect(page.locator('[data-es-results] button')).toHaveCount(8);
  const expected = ['Apple', 'CAT', 'I', "can't", "don't", 'don’t', 'ice-cream', 'Apple'];
  for (let i = 0; i < expected.length; i++) {
    const card = page.locator('[data-es-results] button').nth(i);
    await expect(card.locator('strong')).toHaveText(expected[i]);
    await card.click();
    await expect(page.locator('#es-dialog-title')).toHaveText(expected[i]);
    await expect(page.locator('[data-es-word-board] .es-stroke-ghost')).not.toHaveCount(0);
    if (expected[i] === 'Apple') await expect(page.locator('[data-es-word-board] .es-stroke-ghost').first()).toHaveAttribute('d', 'M18 94 L50 20 L82 94');
    if (expected[i] === "can't") await expect(page.locator('[data-es-word-board] .es-stroke-ghost[data-char-index="3"]')).toHaveAttribute('d', 'M53 31 C53 38 50 43 46 46');
    if (expected[i] === 'ice-cream') await expect(page.locator('[data-es-word-board] .es-stroke-ghost[data-char-index="3"]')).toHaveAttribute('d', 'M35 70 L64 70');
    await page.locator('[data-es-word-close]').click();
  }
  await lookup(page, 'unrecognizablylongword');
  await expect(page.locator('[data-es-zh]')).toContainText('没有收录');
  await expect(page.locator('[data-es-speak]')).toBeDisabled();
  await expect(page.locator('[data-es-favorite]')).toBeHidden();
  if (page.viewportSize()!.width < 700) await expect(page.locator('[data-es-zoom-wrap]')).toBeVisible();
  else await expect(page.locator('[data-es-zoom-wrap]')).toBeHidden();
  const overview = await page.locator('[data-es-word-board] svg').boundingBox();
  if (page.viewportSize()!.width < 700) {
    const zoom = await page.locator('[data-es-word-zoom] svg').boundingBox();
    expect(zoom!.width).toBeGreaterThan(overview!.width);
  } else expect(overview!.width).toBeGreaterThan(500);
  await page.locator('[data-es-word-close]').click();
  for (const word of ['minimum', 'butterfly']) {
    await lookup(page, word);
    await expect(page.locator('[data-es-word-board] .es-stroke-ghost[data-char-index="0"]')).not.toHaveCount(0);
    if (page.viewportSize()!.width < 700) await expect(page.locator('[data-es-zoom-wrap]')).toBeVisible();
    await page.locator('[data-es-word-close]').click();
  }
  await lookup(page, 'apple');
  await page.locator('[data-es-word-pane] [data-es-control="next"]').click();
  await page.locator('[data-es-spell-play]').click();
  await page.locator('[data-es-word-letters] button').nth(1).click();
  await expect(page.locator('[data-es-review-pane]')).toBeVisible();
  await expect(page.locator('[data-es-word-dialog]')).toHaveCount(1);
  await page.locator('[data-es-review-pane] [data-es-control="all"]').click();
  await page.locator('[data-es-review-back]').click();
  await expect(page.locator('[data-es-word-status]')).toContainText('已暂停');
  await expect(page.locator('[data-es-spell-play]')).toContainText('看拼写');
  expect(await ratio(page, '[data-es-word-board] .es-stroke-ink')).toBe(1);
  await expect(page.locator('[data-es-word-letters] button').nth(1)).toBeFocused();
  await page.locator('[data-es-word-letters] button').nth(1).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-es-word-pane]')).toBeVisible();
  await expect(page.locator('[data-es-word-letters] button').nth(1)).toBeFocused();
  await page.locator('[data-es-speak]').click();
  await expect(page.locator('[data-es-speech-status]')).toContainText('系统');
  await page.locator('[data-es-favorite]').click();
  await expect(page.locator('[data-es-favorite]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-es-word-close]').click();
  await expect(page.locator('[data-es-favorites]')).toContainText('apple');
  expect(info.project.name).toBeTruthy();
});

test('keyboard grid rows, native activation, escape focus and step controls', async ({ page }) => {
  await page.goto('?world=my-game-world');
  let foundEntrance = false;
  for (let step = 0; step < 160; step++) {
    await page.keyboard.press('Tab');
    foundEntrance = await page.evaluate(() => document.activeElement?.hasAttribute('data-world-english-link') ?? false);
    if (foundEntrance) break;
  }
  expect(foundEntrance).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/play=english-study/);
  await page.locator('#es-input').click();
  await page.keyboard.type('book'); await page.keyboard.press('Enter');
  const first = page.locator('[data-es-results] button').first();
  await expect(first).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-es-word-dialog]')).toBeVisible();
  await page.locator('[data-es-word-pane] [data-es-control="next"]').click();
  expect(await ratio(page, '[data-es-word-board] .es-stroke-ink')).toBe(1);
  await page.locator('[data-es-word-pane] [data-es-control="previous"]').click();
  expect(await ratio(page, '[data-es-word-board] .es-stroke-ink')).toBe(0);
  await page.locator('[data-es-word-pane] [data-es-control="all"]').click();
  await expect(page.locator('[data-es-word-status]')).toContainText('完成');
  await page.locator('[data-es-word-pane] [data-es-control="replay"]').click();
  await expect(page.locator('[data-es-word-status]')).toContainText('正在写');
  await page.keyboard.press('Escape'); await expect(first).toBeFocused();
  await page.locator('[data-es-alphabet] button').first().click();
  await expect(page.locator('[data-es-review-pane]')).toBeVisible();
  await page.locator('[data-es-word-dialog]').press('Escape');
  await expect(page.locator('[data-es-alphabet] button').first()).toBeFocused();
  const alphabet = page.locator('[data-es-alphabet] button');
  await page.keyboard.press('ArrowDown');
  const rowMove = await page.evaluate(() => ({ first: document.querySelector('[data-es-alphabet] button')!.getBoundingClientRect().y, focused: document.activeElement!.getBoundingClientRect().y, position: (document.activeElement as HTMLElement).dataset.position }));
  expect(Number(rowMove.position)).toBeGreaterThan(1);
  expect(rowMove.focused).toBeGreaterThan(rowMove.first + 10);
});

test('resize, details, simulated background and word change preserve or cancel writing', async ({ page }) => {
  await page.goto('?play=english-study');
  await lookup(page, 'cat');
  const play = page.locator('[data-es-word-pane] [data-es-control="play"]');
  await play.click();
  const first = '[data-es-word-board] .es-stroke-ink';
  await expect.poll(() => ratio(page, first)).toBeGreaterThan(0.15);
  await play.click(); const held = await ratio(page, first);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.es-more summary').click();
  expect(await ratio(page, first)).toBeCloseTo(held, 4);
  await play.click();
  await expect.poll(() => ratio(page, first)).toBeGreaterThan(held + 0.03);
  // Headless tabs stay visible when another tab is raised; dispatch the browser
  // lifecycle event here, while all writing actions remain real pointer input.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const backgroundHeld = await ratio(page, first);
  await page.waitForTimeout(400);
  expect(await ratio(page, first)).toBeCloseTo(backgroundHeld, 4);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('[data-es-word-close]').click();
  await lookup(page, 'dog');
  await expect(page.locator('#es-dialog-title')).toHaveText('dog');
  expect(await ratio(page, first)).toBe(0);
  await page.waitForTimeout(400);
  expect(await ratio(page, first)).toBe(0);
});
