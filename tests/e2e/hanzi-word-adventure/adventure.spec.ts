import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { CHAPTERS, ROOMS } from '../../../games/hanzi-word-adventure/rooms';
import { act, carried, type Action } from '../../../games/hanzi-word-adventure/model';
import { solve } from '../../../games/hanzi-word-adventure/solver';
import { SAVE_KEY } from '../../../games/hanzi-word-adventure/save';
const evidence = process.env.HWAY_EVIDENCE ?? 'tmp/tasks/GAME-CODEX-STEP4/adventure';
const gameURL = '?play=hanzi-word-adventure';
type Input = 'keyboard' | 'touch' | 'pointer';
const raw = (page: Page) => page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
const saved = async (page: Page) => { const value = JSON.parse((await raw(page))!); return value.chapters[value.activeChapterId]; };
const keyFor = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
async function tabTo(page: Page, selector: string) {
  const target = page.locator(selector);
  for (let i=0; i<150; i++) { if (await target.evaluate(e=>e === document.activeElement)) return; await page.keyboard.press('Tab'); }
  throw Error(`No real Tab route to ${selector}; active=${await page.locator(':focus').evaluate(e=>e.outerHTML)}`);
}
async function activate(page: Page, selector: string, input: Input) {
  const el = page.locator(selector);
  if (input === 'keyboard') { await tabTo(page,selector); await page.keyboard.press('Enter'); }
  else { await el.scrollIntoViewIfNeeded(); if(input === 'touch') await el.tap(); else await el.click(); }
}
async function inspect(page: Page, target: number, input: Input) {
  if (input !== 'keyboard') { await activate(page, `[data-hway-cell="${target}"]`, input); return; }
  await tabTo(page,'[data-hway-grid]'); await page.keyboard.press('Escape');
  let current = Number(await page.locator('.hway').getAttribute('data-player'));
  while (current !== target) {
    const direction = current % 7 < target % 7 ? 'right' : current % 7 > target % 7 ? 'left' : current < target ? 'down' : 'up';
    await page.keyboard.press(`Shift+${keyFor[direction]}`); current += { right: 1, left: -1, up: -7, down: 7 }[direction];
  }
}
async function action(page: Page, a: Action, input: Input) {
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'false');
  if (a.type === 'move') {
    if (input === 'keyboard') { await tabTo(page,'[data-hway-grid]'); await page.keyboard.press(keyFor[a.direction]); }
    else await activate(page, `[data-hway-move="${a.direction}"]`, input);
  } else {
    if(a.type === 'put' && input !== 'keyboard') await activate(page,'[data-hway-choose-place]',input);
    await inspect(page, a.target, input);
    if (a.type === 'split') {
      if (input === 'keyboard') { await page.keyboard.press('x'); await page.keyboard.press(a.side === 'left' ? 'ArrowLeft' : 'ArrowRight'); }
      else { await activate(page, '[data-hway-action=preview-split]', input); await activate(page, `[data-hway-side=${a.side}]`, input); }
      await expect(page.locator('[data-hway-action=split]')).toBeEnabled();
      await activate(page, '[data-hway-action=split]', input);
    } else if (input === 'keyboard') {
      const compound = a.type === 'take' && ['林','明'].includes((await saved(page)).state.entities.find((e:any)=>e.pos === a.target)?.kind);
      await page.keyboard.press(a.type === 'combine' ? 'c' : 'Space');
      if (compound) { await expect(page.locator('[data-hway-action=take]')).toBeFocused(); await page.keyboard.press('Enter'); }
    } else await activate(page, `[data-hway-action=${a.type}]`, input);
  }
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'false');
}
async function begin(page: Page,input: Input='pointer',chapter='homeward') {
  await expect(page.getByTestId('hanzi-word-adventure')).toBeVisible();
  await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');
  if(await page.locator('[data-hway-menu]').isVisible()) {
    const value=await raw(page); let exists=false; try {exists=!!JSON.parse(value??'null')?.chapters?.[chapter];}catch{}
    await activate(page,exists?'[data-hway-continue]':'[data-hway-new]',input);await activate(page,`[data-hway-chapter="${chapter}"]`,input);
  }
  await expect(page.locator('[data-hway-menu]')).toBeHidden();
  await expect(page.locator('.hway-layout')).toHaveJSProperty('inert',false);
}
async function open(page: Page,input: Input='pointer',chapter='homeward') { await page.goto(gameURL); await begin(page,input,chapter); }
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
  await page.goto('?world=my-game-world'); await activate(page,'[data-world-adventure-link]',input); await begin(page,input); await page.screenshot({ path: `${evidence}/${input}-first.png`, fullPage: true });
  await action(page, { type: 'move', direction: 'right' }, input);
  const afterMove = await saved(page); await page.reload(); await begin(page, info.project.name === 'touch' ? 'touch' : 'keyboard'); expect(await saved(page)).toEqual(afterMove);
  if (input === 'keyboard') { await tabTo(page,'[data-hway-grid]'); await page.keyboard.press('z'); } else await activate(page, '[data-hway-undo]', input);
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
  const input: Input = info.project.name === 'touch' ? 'touch' : 'keyboard'; await open(page,input);
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
  await activate(page, '[data-hway-action=preview-split]', input); if(input === 'keyboard') await page.keyboard.press('ArrowLeft'); else await activate(page, '[data-hway-side=left]', input);
  await expect(page.locator('[data-hway-action=split]')).toBeDisabled(); await expect(page.locator('[data-hway-actions]')).toContainText('人正站在这里');
  const preview = await raw(page); await page.screenshot({ path: `${evidence}/${input}-blocked-split.png`, fullPage: true });
  writeFileSync(`${evidence}/split-controls-${input}.json`, JSON.stringify(await criticalControls(page), null, 2));
  await page.keyboard.press('Escape'); expect(await raw(page)).toBe(preview);
  // Move the forest first: hints must solve this changed arrangement, not replay initial-room script.
  await action(page, { type: 'take', target: 10 }, input); await action(page, { type: 'move', direction: 'down' }, input); await action(page, { type: 'put', target: 17 }, input);
  await activate(page, '[data-hway-hint]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('先看看');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toContainText('林可以变成两枚木');
  await activate(page, '[data-hway-hint-more]', input); await expect(page.locator('[data-hway-hint-text]')).toHaveText('拆开第3行第4列的林，第二格在它右边。');
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
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw: invalid }); await page.reload(); await begin(page, info.project.name === 'touch' ? 'touch' : 'keyboard');
    await activate(page, '[data-hway-move=right]', info.project.name === 'touch' ? 'touch' : 'pointer'); expect(await raw(page)).toBe(invalid);
  }
});

test('home and Classic are real single-target entries, with return, history and isolated save', async ({ page }, info) => {
  const input: Input = info.project.name === 'touch' ? 'touch' : 'pointer';
  await page.goto('?world=my-game-world'); await activate(page, '[data-world-adventure-link]', input);
  await begin(page,input); await action(page, { type: 'move', direction: 'right' }, input);
  const before = await raw(page); await activate(page, '[data-hway-exit]', input); await expect(page.locator('[data-world-adventure-link]')).toBeFocused();
  await page.goBack(); await begin(page,input); expect(await raw(page)).toBe(before);
  await action(page, { type: 'take', target: 10 }, input); await activate(page, '[data-hway-exit]', input);
  await activate(page, '[data-world-treasure-link]', input); const card = page.locator('[data-game-id=hanzi-word-adventure]');
  await expect(card.locator('a')).toHaveCount(1); await expect(card.locator('button')).toHaveCount(0);
  await activate(page, '[data-game-id=hanzi-word-adventure] a', input); await begin(page,input); await expect(page.locator('[data-hway-hand]')).toHaveText('木');
  await activate(page, '[data-hway-exit]', input); await expect(page.getByTestId('classic-hub-from-world')).toBeVisible();
});

test('refresh during a live animation is one complete action with undo; touch pan never moves a letter', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page); await page.locator('.hway-help summary').click();
  await expect(page.locator('[data-hway-motion]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-hway-motion]').click(); await page.locator('.hway-help summary').click();
  await page.locator('[data-hway-move=right]').click();
  await expect(page.locator('.hway')).toHaveAttribute('data-busy', 'true');
  await page.reload(); await begin(page, info.project.name === 'touch' ? 'touch' : 'keyboard');
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


test('new chapters are completed through real keyboard or touch, with independent saves and explicit reset', async ({page},info) => {
  test.setTimeout(180_000); const input:Input=info.project.name==='touch'?'touch':'keyboard'; mkdirSync(evidence,{recursive:true});
  await page.goto('?world=my-game-world');await activate(page,'[data-world-adventure-link]',input);await begin(page,input,'lamplight');
  const rows=[];
  for(const chapter of CHAPTERS.slice(1)) {
    if(chapter.id==='confluence') {await activate(page,'[data-hway-saves]',input);await activate(page,'[data-hway-new]',input);await activate(page,`[data-hway-chapter="${chapter.id}"]`,input);}
    for(let i=chapter.firstRoom;i<chapter.firstRoom+5;i++) {rows.push(await playRoom(page,i,input));if(i<chapter.firstRoom+4)await activate(page,'[data-hway-next]',input);}
    await page.screenshot({path:`${evidence}/${input}-${chapter.id}-complete.png`,fullPage:true});
  }
  const finished=JSON.parse((await raw(page))!);expect(finished.chapters.lamplight.roomId).toBe('light-5');expect(finished.chapters.confluence.roomId).toBe('woven-5');
  await activate(page,'[data-hway-saves]',input);await activate(page,'[data-hway-continue]',input);await expect(page.locator('[data-hway-chapter=lamplight]')).toContainText('light-5');await activate(page,'[data-hway-chapter=lamplight]',input);
  await activate(page,'[data-hway-undo]',input);expect((await saved(page)).state.won).toBe(false);const beforeReset=await raw(page);
  await activate(page,'[data-hway-reset]',input);await activate(page,'[data-hway-cancel-restart]',input);expect(await raw(page)).toBe(beforeReset);
  await activate(page,'[data-hway-reset]',input);await activate(page,'[data-hway-confirm-restart]',input);expect((await saved(page)).roomId).toBe('light-1');expect((await saved(page)).state).toEqual(ROOMS[5].initial);
  expect(JSON.parse((await raw(page))!).chapters.confluence).toEqual(finished.chapters.confluence);
  await activate(page,'[data-hway-exit]',input);await expect(page.getByTestId('my-game-world')).toBeVisible();
  writeFileSync(`${evidence}/new-chapters-${input}.json`,JSON.stringify({input,rows,resetOtherChapterPreserved:true},null,2));
});

test('new puzzles keep a second ordinary mouse strategy and explicit light-target feedback', async ({page},info) => {
  test.skip(info.project.name!=='desktop','Mouse alternate replay on desktop; full touch chapters are separate.');test.setTimeout(180_000);
  await page.goto('?world=my-game-world');await activate(page,'[data-world-adventure-link]','pointer');await begin(page,'pointer','confluence');const records=[];
  for(let i=10;i<15;i++) {
    const r=ROOMS[i], initial=(await saved(page)).state, wind=r.sentences.find(s=>s.subject==='风');
    const alternate=i===12||i===14; const solution=solve(r,initial,alternate?{allow:(s,a)=>!(a.type==='put'&&a.target===wind!.cells[1]&&carried(s)?.kind==='不')}:{});
    expect(solution.status).toBe('solved');let state=initial;
    for(const a of solution.actions) {await action(page,a,'pointer');state=act(r,state,a).state;expect((await saved(page)).state).toEqual(state);}
    expect(state.won).toBe(true);if(alternate)await expect(page.locator('[data-hway-sentences]')).toContainText('风吹');records.push({room:r.id,alternate,actions:solution.actions});
    if(i<14)await activate(page,'[data-hway-next]','pointer');
  }
  const won=await saved(page);await activate(page,'[data-hway-undo]','pointer');expect((await saved(page)).state.won).toBe(false);
  await activate(page,'[data-hway-hint]','pointer');await expect(page.locator('[data-hway-hint-text]')).not.toContainText('正在看');await activate(page,'[data-hway-hint-close]','pointer');
  await action(page,records.at(-1)!.actions.at(-1)!,'pointer');expect((await saved(page)).state).toEqual(won.state);
  await activate(page,'[data-hway-exit]','pointer');await expect(page.getByTestId('my-game-world')).toBeVisible();
  writeFileSync(`${evidence}/new-alternatives-pointer.json`,JSON.stringify(records,null,2));
});

test('Space on native controls acts once; world shortcuts scope, canceled inputs and shadow targets stay explicit', async ({page},info) => {
  await open(page,'pointer','lamplight');await tabTo(page,'[data-hway-grid]');
  await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Space');await expect(page.locator('[data-hway-hand]')).toHaveText('日');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  await page.keyboard.press('ArrowRight');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('c');await expect(page.locator('[data-hway-hand]')).toHaveText('明');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  const before=await saved(page);await tabTo(page,'[data-hway-undo]');await page.keyboard.press('Space');expect((await saved(page)).history.length).toBe(before.history.length-1);await expect(page.locator('[data-hway-hand]')).toHaveText('日');
  const afterUndo=await raw(page);await page.keyboard.press('ArrowDown');expect(await raw(page)).toBe(afterUndo);
  await tabTo(page,'[data-hway-grid]');await page.keyboard.down('c');await page.keyboard.up('c');await expect(page.locator('[data-hway-hand]')).toHaveText('明');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  await page.keyboard.press('Shift+ArrowDown');await expect(page.locator('[data-hway-target]')).toContainText('目标');
  await activate(page,'[data-hway-restart]','keyboard');await page.keyboard.press('Escape');await expect(page.locator('[data-hway-restart]')).toBeFocused();
  const stable=await raw(page);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await raw(page)).toBe(stable);
});


test('pointer placement selects without walking and sentence toggles retain focus', async ({page},info) => {
  const input:Input=info.project.name==='touch'?'touch':'pointer';await open(page,input,'homeward');
  await action(page,{type:'move',direction:'right'},input);await action(page,{type:'take',target:10},input);
  const before=await saved(page);await activate(page,'[data-hway-choose-place]',input);await activate(page,'[data-hway-cell="10"]',input);
  expect(await saved(page)).toEqual(before);await expect(page.locator('[data-hway-primary]')).toBeFocused();await activate(page,'[data-hway-primary]',input);
  expect((await saved(page)).state.player).toBe(before.state.player);expect((await saved(page)).state.entities[0].pos).toBe(10);
  await playRoom(page,0,input);await activate(page,'[data-hway-next]',input);const rule=page.locator('[data-hway-rule]').first(),id=await rule.getAttribute('data-hway-rule');
  await activate(page,`[data-hway-rule="${id}"]`,input);await expect(page.locator(`[data-hway-rule="${id}"]`)).toBeFocused();
});


test('linked chapter switches replace URL without adding history and reload the selected checkpoint', async ({page},info) => {
  const input:Input=info.project.name==='touch'?'touch':'keyboard';await page.goto(`${gameURL}&chapter=lamplight&from=world`);await begin(page,input,'lamplight');
  await action(page,{type:'take',target:9},input);const lampCheckpoint=await saved(page),historyCount=await page.evaluate(()=>history.length);
  await activate(page,'[data-hway-saves]',input);await activate(page,'[data-hway-new]',input);await activate(page,'[data-hway-chapter=confluence]',input);
  expect(new URL(page.url()).searchParams.get('chapter')).toBe('confluence');expect(new URL(page.url()).searchParams.get('from')).toBe('world');expect(await page.evaluate(()=>history.length)).toBe(historyCount);
  await action(page,{type:'move',direction:'right'},input);const selected=await saved(page);await page.reload();await begin(page,input,'confluence');expect(await saved(page)).toEqual(selected);
  expect(JSON.parse((await raw(page))!).chapters.lamplight).toEqual(lampCheckpoint);await expect(page.locator('.hway')).toHaveAttribute('data-chapter','confluence');
});
