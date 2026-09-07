import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ROOMS } from '../../../games/hanzi-word-adventure/rooms';
import { act, carried, type Action } from '../../../games/hanzi-word-adventure/model';
import { solve } from '../../../games/hanzi-word-adventure/solver';
import { SAVE_KEY } from '../../../games/hanzi-word-adventure/save';
const evidence = process.env.HWAY_EVIDENCE ?? 'tmp/tasks/GAME-CODEX-STEP2';
const gameURL = '?play=hanzi-word-adventure';
type Input = 'keyboard' | 'touch' | 'pointer';
const raw = (page: Page) => page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
const saved = async (page: Page) => JSON.parse((await raw(page))!).journey;
const keyFor = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
async function activate(page: Page, selector: string, input: Input) {
  const el = page.locator(selector); await el.scrollIntoViewIfNeeded();
  if (input === 'touch') await el.tap(); else if (input === 'pointer') await el.click(); else { await el.focus(); await page.keyboard.press('Enter'); }
}
async function inspect(page: Page, target: number, input: Input) {
  if (input !== 'keyboard') { await activate(page, `[data-hway-cell="${target}"]`, input); return; }
  const pressed = page.locator('[data-hway-cell][aria-pressed=true]');
  let current = await pressed.count() ? Number(await pressed.getAttribute('data-hway-cell')) : Number(await page.locator('.hway').getAttribute('data-player'));
  while (current !== target) {
    const direction = current % 7 < target % 7 ? 'right' : current % 7 > target % 7 ? 'left' : current < target ? 'down' : 'up';
    await page.keyboard.press(`Shift+${keyFor[direction]}`); current += { right: 1, left: -1, up: -7, down: 7 }[direction];
  }
}
async function action(page: Page, a: Action, input: Input) {
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'false');
  if (a.type === 'move') {
    if (input === 'keyboard') await page.keyboard.press(keyFor[a.direction]);
    else await activate(page, `[data-hway-move="${a.direction}"]`, input);
  } else {
    await inspect(page, a.target, input);
    if (a.type === 'split') {
      if (input === 'keyboard') await page.keyboard.press('x'); else await activate(page, '[data-hway-action=preview-split]', input);
      await activate(page, `[data-hway-side=${a.side}]`, input);
      await expect(page.locator('[data-hway-action=split]')).toBeEnabled();
      await activate(page, '[data-hway-action=split]', input);
    } else if (input === 'keyboard') await page.keyboard.press(a.type === 'combine' ? 'c' : 'e');
    else await activate(page, `[data-hway-action=${a.type}]`, input);
  }
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'false');
}
async function open(page: Page) { await page.goto(gameURL); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true'); }
async function criticalControls(page: Page) {
  const rows = [];
  for (const group of ['.hway-direction', '.hway-toolbar', '.hway-actions']) {
    const buttons = page.locator(`${group} button:visible`), count = await buttons.count();
    const rects = await buttons.evaluateAll(elements => elements.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const a = rects[i], b = rects[j];
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
    for (const button of await buttons.all()) {
      await button.scrollIntoViewIfNeeded();
      const row = await button.evaluate(e => { const r = e.getBoundingClientRect(); return { label: e.textContent, width: r.width, height: r.height, hits: [.25, .5, .75].map(t => e.contains(document.elementFromPoint(r.x + r.width * t, r.y + r.height / 2))) }; });
      expect(row.width).toBeGreaterThanOrEqual(44); expect(row.height).toBeGreaterThanOrEqual(44); expect(row.hits).toEqual([true, true, true]); rows.push({ group, ...row });
    }
  }
  return rows;
}
async function playRoom(page: Page, index: number, input: Input, screenshots = false) {
  const room = ROOMS[index], start = await saved(page), search = solve(room, start.state);
  expect(search.status).toBe('solved'); let state = start.state;
  for (const [n, a] of search.actions.entries()) {
    const expected = act(room, state, a); expect(expected.ok).toBe(true);
    await action(page, a, input); expect((await saved(page)).state).toEqual(expected.state); state = expected.state;
    if (screenshots && ((index === 1 && n === 2) || (index === 3 && a.type === 'combine'))) {
      await page.screenshot({ path: `${evidence}/${input}-${room.id}-change.png`, fullPage: true });
    }
  }
  await expect(page.locator('.hway')).toHaveAttribute('data-won', 'true');
  if (screenshots && index === 4) await page.screenshot({ path: `${evidence}/${input}-home.png`, fullPage: true });
  return { room: room.id, actions: search.actions, visited: search.visited, final: state };
}

test('ordinary inputs complete all five rooms, restore mid-action state and undo, with no external runtime', async ({ page }, info) => {
  mkdirSync(evidence, { recursive: true }); const input: Input = info.project.name === 'touch' ? 'touch' : 'keyboard';
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const allowedOrigin = new URL(info.project.use.baseURL!).origin;
  page.on('request', r => { if (r.url().startsWith('http') && new URL(r.url()).origin !== allowedOrigin) requests.push(r.url()); });
  await open(page); await page.screenshot({ path: `${evidence}/${input}-first.png`, fullPage: true });
  await action(page, { type: 'move', direction: 'right' }, input);
  const afterMove = await saved(page); await page.reload(); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true'); expect(await saved(page)).toEqual(afterMove);
  if (input === 'keyboard') await page.keyboard.press('z'); else await activate(page, '[data-hway-undo]', input);
  expect((await saved(page)).state).toEqual(ROOMS[0].initial);
  const rows = [];
  for (let i = 0; i < 5; i++) { rows.push(await playRoom(page, i, input, true)); if (i < 4) await activate(page, '[data-hway-next]', input); }
  const won = await saved(page); await activate(page, '[data-hway-undo]', input); expect((await saved(page)).state.won).toBe(false);
  await action(page, rows[4].actions.at(-1)!, input); expect((await saved(page)).state).toEqual(won.state);
  await activate(page, '[data-hway-replay]', input); expect((await saved(page)).state).toEqual(ROOMS[0].initial); expect((await saved(page)).unlocked).toBe(4);
  await activate(page, '[data-hway-exit]', input); await expect(page.getByTestId('my-game-world')).toBeVisible();
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  writeFileSync(`${evidence}/playthrough-${input}.json`, JSON.stringify({ input, rows, errors, requests }, null, 2));
});

test('exploration, blocked split previews, cancel, three current-state hints and a real wind deadlock recover', async ({ page }, info) => {
  const input: Input = info.project.name === 'touch' ? 'touch' : 'keyboard'; await open(page);
  const original = await raw(page); await inspect(page, 33, input); await page.keyboard.press('e'); expect(await raw(page)).toBe(original);
  await activate(page, '[data-hway-hint]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('先看看');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('手里');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toHaveText('向右走一步。');
  await activate(page, '[data-hway-hint-close]', input);
  await playRoom(page, 0, input); await activate(page, '[data-hway-next]', input);
  await activate(page, '[data-hway-hint]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('先看看');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('拿走不，马上变回肯定');
  if (input === 'keyboard') await page.screenshot({ path: `${evidence}/negation-hint.png`, fullPage: true });
  await activate(page, '[data-hway-hint-close]', input);
  await playRoom(page, 1, input); await activate(page, '[data-hway-next]', input);
  await action(page, { type: 'move', direction: 'right' }, input); await inspect(page, 10, input);
  await activate(page, '[data-hway-action=preview-split]', input); await activate(page, '[data-hway-side=left]', input);
  await expect(page.locator('[data-hway-action=split]')).toBeDisabled(); await expect(page.locator('[data-hway-actions]')).toContainText('人正站在这里');
  const preview = await raw(page); await page.screenshot({ path: `${evidence}/${input}-blocked-split.png`, fullPage: true });
  writeFileSync(`${evidence}/split-controls-${input}.json`, JSON.stringify(await criticalControls(page), null, 2));
  await page.keyboard.press('Escape'); expect(await raw(page)).toBe(preview);
  // Move the forest first: hints must solve this changed arrangement, not replay initial-room script.
  await action(page, { type: 'take', target: 10 }, input); await action(page, { type: 'move', direction: 'down' }, input); await action(page, { type: 'put', target: 17 }, input);
  await activate(page, '[data-hway-hint]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('先看看');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('林可以变成两枚木');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toHaveText('拆开第3行第4列的林，另一枚木放在它右边。');
  if (input === 'touch') await page.screenshot({ path: `${evidence}/changed-layout-hint.png`, fullPage: true });
  await activate(page, '[data-hway-hint-close]', input);
  await playRoom(page, 2, input); await activate(page, '[data-hway-next]', input);
  for (const direction of ['right', 'down', 'down', 'right'] as const) await action(page, { type: 'move', direction }, input);
  expect((await saved(page)).state.player).toBe(25); await activate(page, '[data-hway-hint]', input);
  await expect(page.locator('[data-hway-hint-text]')).toContainText('已经找不到');
  await activate(page, '[data-hway-undo]', input); expect((await saved(page)).state.player).toBe(23);
  await activate(page, '[data-hway-restart]', input); await activate(page, '[data-hway-cancel-restart]', input); expect((await saved(page)).state.player).toBe(23);
  await activate(page, '[data-hway-restart]', input); await activate(page, '[data-hway-confirm-restart]', input); expect((await saved(page)).state).toEqual(ROOMS[3].initial);
  // Take the lower wood first, unlike the normal solution, then combine the upper one.
  for (const direction of ['right', 'down', 'down'] as const) await action(page, { type: 'move', direction }, input);
  await action(page, { type: 'take', target: 22 }, input); await action(page, { type: 'move', direction: 'up' }, input);
  await action(page, { type: 'combine', target: 15 }, input); await expect(page.locator('[data-hway-hand]')).toHaveText('林');
  await activate(page, '[data-hway-undo]', input); await expect(page.locator('[data-hway-hand]')).toHaveText('木');
});

test('compact/tablet/desktop/zoom geometry, font availability, scrolling and save protection', async ({ page }, info) => {
  await open(page); const rows = [];
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
    await expect.poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) => Math.abs(c.width / Math.min(devicePixelRatio, 3) - c.clientWidth))).toBeLessThan(1.1);
    const geometry = await page.evaluate(() => {
      const board = document.querySelector('[data-hway-board]')!.getBoundingClientRect(), canvas = document.querySelector('canvas')!;
      const cells = [...document.querySelectorAll('[data-hway-cell]')].map((c, index) => { const r = c.getBoundingClientRect(); return { index, width: r.width, height: r.height, errorX: Math.abs(r.x + r.width / 2 - (board.x + (index % 7 + .5) * board.width / 7)), errorY: Math.abs(r.y + r.height / 2 - (board.y + (Math.floor(index / 7) + .5) * board.height / 7)) }; });
      const controls = [...document.querySelectorAll('.hway button, .hway summary')].filter(c => c.getClientRects().length).map(c => { const r = c.getBoundingClientRect(); return { label: c.getAttribute('aria-label') ?? c.textContent, width: r.width, height: r.height }; });
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, canvas: { width: canvas.width, height: canvas.height }, fonts: document.fonts.check('32px "Microsoft YaHei"', '人木林不家门风水开吹山路'), cells, controls };
    });
    expect(geometry.overflow).toBe(false); expect(geometry.fonts).toBe(true); expect(geometry.canvas.width).toBeGreaterThan(0);
    for (const c of geometry.cells) { expect(c.width).toBeGreaterThanOrEqual(44); expect(c.height).toBeGreaterThanOrEqual(44); expect(c.errorX).toBeLessThan(1); expect(c.errorY).toBeLessThan(1); }
    for (const c of geometry.controls) { expect(c.width).toBeGreaterThanOrEqual(44); expect(c.height).toBeGreaterThanOrEqual(44); }
    rows.push({ ...geometry, critical: await criticalControls(page) });
    if (width === 360 || width === 768) await page.screenshot({ path: `${evidence}/${info.project.name}-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.body.style.zoom = '1.25'; }); await page.setViewportSize({ width: 768, height: 600 });
  await activate(page, '[data-hway-move=right]', info.project.name === 'touch' ? 'touch' : 'pointer'); expect((await saved(page)).state.player).toBe(9);
  await page.evaluate(() => { document.body.style.zoom = ''; });
  await page.setViewportSize({ width: 390, height: 600 }); await page.locator('.hway-help summary').click();
  await page.mouse.wheel(0, 400); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  writeFileSync(`${evidence}/geometry-${info.project.name}.json`, JSON.stringify(rows, null, 2));
  for (const invalid of ['{broken', '{"version":99}']) {
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw: invalid }); await page.reload(); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true');
    await activate(page, '[data-hway-move=right]', info.project.name === 'touch' ? 'touch' : 'pointer'); expect(await raw(page)).toBe(invalid);
  }
});

test('home and Classic are real single-target entries, with return, history and isolated save', async ({ page }, info) => {
  const input: Input = info.project.name === 'touch' ? 'touch' : 'pointer';
  await page.goto('?world=my-game-world'); await activate(page, '[data-world-adventure-link]', input);
  await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true'); await action(page, { type: 'move', direction: 'right' }, input);
  const before = await raw(page); await activate(page, '[data-hway-exit]', input); await expect(page.locator('[data-world-adventure-link]')).toBeFocused();
  await page.goBack(); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true'); expect(await raw(page)).toBe(before);
  await action(page, { type: 'take', target: 10 }, input); await activate(page, '[data-hway-exit]', input);
  await activate(page, '[data-world-treasure-link]', input); const card = page.locator('[data-game-id=hanzi-word-adventure]');
  await expect(card.locator('a')).toHaveCount(1); await expect(card.locator('button')).toHaveCount(0);
  await activate(page, '[data-game-id=hanzi-word-adventure] a', input); await expect(page.locator('[data-hway-hand]')).toHaveText('木');
  await activate(page, '[data-hway-exit]', input); await expect(page.getByTestId('classic-hub-from-world')).toBeVisible();
});

test('refresh during a live animation is one complete action with undo; touch pan never moves a letter', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page); await page.locator('.hway-help summary').click();
  await expect(page.locator('[data-hway-motion]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-hway-motion]').click(); await page.locator('.hway-help summary').click();
  await page.locator('[data-hway-move=right]').click();
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'true');
  await page.reload(); await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).state.player).toBe(9); await page.locator('[data-hway-undo]').click(); expect((await saved(page)).state).toEqual(ROOMS[0].initial);
  if (info.project.name === 'touch') {
    await page.setViewportSize({ width: 390, height: 600 }); await page.locator('.hway-help summary').click(); await page.evaluate(() => scrollTo(0, 0));
    const before = await raw(page), session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 350 }] });
    for (const y of [325, 300, 270, 230, 190, 140]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80); expect(await raw(page)).toBe(before); await session.detach();
  }
});

test('an alternative home strategy keeps wind active and recovers both bypass bridge pieces', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The alternative strategy is replayed on desktop; normal five-room touch is covered separately.');
  await open(page);
  for (let i = 0; i < 4; i++) { await playRoom(page, i, 'pointer'); await activate(page, '[data-hway-next]', 'pointer'); }
  const r = ROOMS[4], slot = r.sentences[1].cells[1], initial = (await saved(page)).state;
  const solution = solve(r, initial, { allow: (s, a) => !(a.type === 'put' && a.target === slot && carried(s)?.kind === '不') });
  expect(solution.status).toBe('solved'); let state = initial;
  for (const a of solution.actions) { await action(page, a, 'pointer'); state = act(r, state, a).state; expect((await saved(page)).state).toEqual(state); }
  expect(state.won).toBe(true); await expect(page.locator('[data-hway-sentences]')).toContainText('风吹');
  writeFileSync(`${evidence}/alternative-browser.json`, JSON.stringify({ actions: solution.actions, state }, null, 2));
});
