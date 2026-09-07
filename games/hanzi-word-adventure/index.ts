import Phaser from 'phaser';
import type { GameDefinition, MountedGame } from '../../packages/game-core';
import { FONT_STACK, wordRecord, WORLD_RULES } from './content';
import { act, at, carried, describeAction, DIR_NAMES, distance, neighbor, newJourney, nextRoom, perform, restart, sentenceText, undo, type Action } from './model';
import { ROOMS, type Direction } from './rooms';
import { openSave, type StorageLike } from './save';
import { AdventureScene } from './scene';
import type { SearchResult } from './solver';
import './styles.css';

export const hanziWordAdventureGame: GameDefinition = {
  id: 'hanzi-word-adventure', title: '字间行者', description: '挪一枚字，变一段路。借来木与不，走回家。', subject: '识字', recommendedAge: '6 岁起', learningGoal: '在文字空间中观察左右结构、否定和材料守恒。', status: '可玩', playLabel: '踏上归途', route: '?play=hanzi-word-adventure&from=hub', mount: context => mountHanziWordAdventure(context.container, context.onExit),
};
function browserStorage(): StorageLike { try { return window.localStorage; } catch { return { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } }; } }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };

export function mountHanziWordAdventure(root: HTMLElement, onExit = () => window.location.assign(new URLSearchParams(location.search).get('from') === 'hub' ? '?hub=classic&from=world' : '?world=my-game-world')): MountedGame {
  const save = openSave(browserStorage(), { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  let journey = save.journey, settings = save.settings, selected: number | null = null, facing: Direction = 'right';
  let binding: string | null = null, splitMode = false, splitSide: 'left' | 'right' = 'right', destroyed = false, busy = false, busyTimer = 0;
  let hintLevel = 0, hintResult: SearchResult | null = null, hintWorker: Worker | null = null, hintId = 0;
  let game: Phaser.Game | undefined, scene: AdventureScene | undefined, gridRoom = '';
  const room = () => ROOMS[journey.room];
  root.className = 'hway-mount';
  root.innerHTML = `<main class="hway" data-testid="hanzi-word-adventure" aria-labelledby="hway-title">
    <header class="hway-header"><div><p>字间行者 <span>· 借字归途</span></p><h1 id="hway-title" data-hway-title></h1></div><button type="button" data-hway-exit aria-label="返回游戏世界">返回</button></header>
    <div class="hway-layout"><section class="hway-land" aria-label="文字场景">
      <p class="hway-subtitle" data-hway-subtitle></p>
      <div class="hway-board" data-hway-board><div class="hway-canvas" data-hway-canvas aria-hidden="true"></div><div class="hway-grid" role="group" aria-label="点字查看，方向键移动人；按住 Shift 和方向键查看相邻格" data-hway-grid></div></div>
      <p class="hway-legend"><span>山 · 山崖</span><span>框中的字 · 可搬</span><span>双线短句 · 改规则</span></p>
    </section><aside class="hway-controls" aria-label="走路与改字">
      <div class="hway-hand"><span>手里 <strong data-hway-hand>空</strong></span><span>最多带一个字<br> · 林也算一个</span></div>
      <div class="hway-direction" aria-label="移动方向">${(['left', 'up', 'down', 'right'] as Direction[]).map(d => `<button type="button" data-hway-move="${d}" aria-label="向${DIR_NAMES[d]}走">${arrows[d]}</button>`).join('')}</div>
      <div class="hway-toolbar"><button type="button" data-hway-undo>撤销一步</button><button type="button" data-hway-restart>本间重开</button><button type="button" data-hway-hint>想一想</button></div>
      <section class="hway-inspect" aria-label="字的状态和动作"><p data-hway-inspect>点一个字，先看它能做什么。</p><div class="hway-actions" data-hway-actions></div></section>
      <p class="hway-feedback" role="status" aria-live="polite" data-hway-feedback></p>
      <div class="hway-hint" data-hway-hint-box hidden><p data-hway-hint-text></p><button type="button" data-hway-hint-more>再提示一点</button><button type="button" data-hway-hint-close>收起提示</button></div>
      <div class="hway-sentences" data-hway-sentences></div>
      <div class="hway-ending" data-hway-ending hidden><p data-hway-ending-text></p><button type="button" data-hway-next>往前走</button><button type="button" data-hway-replay hidden>再走一次归途</button></div>
      <details class="hway-help"><summary>怎么玩 · 字与规则</summary><p>方向键／WASD：移动　Shift＋方向键：查看<br>E：拿／放　X：拆林　C：合林　Z：撤销　Esc：取消</p><p>点击只查看，不会自动走路，也不会自动搬字。</p><ol>${WORLD_RULES.map(r => `<li>${r}</li>`).join('')}</ol><button type="button" data-hway-motion aria-pressed="false">减少动态</button><p data-hway-save-status></p></details>
    </aside></div>
    <div class="hway-modal" data-hway-modal hidden role="dialog" aria-modal="true" aria-labelledby="hway-restart-title"><div><h2 id="hway-restart-title">重新走这一间？</h2><p>本间回到入口，已经走到的房间仍保留。</p><button type="button" data-hway-confirm-restart>重开这一间</button><button type="button" data-hway-cancel-restart>取消</button></div></div>
  </main>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const shell = el('.hway'), board = el('[data-hway-board]'), grid = el('[data-hway-grid]'), feedback = el('[data-hway-feedback]');
  const say = (message: string) => { if (message) feedback.textContent = message; };
  function persist() { save.write(journey, settings); el('[data-hway-save-status]').textContent = save.writable ? '进度和撤销只保存在本机。' : '原有记录已保护；本页仍可玩，新的动作暂不写入存档。'; }
  function cancelHint() { hintWorker?.terminate(); hintWorker = null; hintResult = null; hintLevel = 0; hintId++; el('[data-hway-hint-box]').hidden = true; }
  function cellGlyph(pos: number) {
    if (pos === journey.state.player) return '人';
    const item = at(journey.state, pos); if (item) return item.kind;
    const sentence = room().sentences.find(s => s.cells.includes(pos));
    if (sentence) return sentence.cells[0] === pos ? sentence.subject : sentence.cells[2] === pos ? sentence.verb : '空字位';
    return ({ floor: '路面', water: '水', wind: '风', door: '门', goal: journey.room === 4 ? '家' : '路', wall: '山', rule: '规则', socket: '空字位' })[room().tiles[pos]];
  }
  function sceneSync(from?: number) {
    const preview = splitMode && selected !== null ? [selected, neighbor(room(), selected, splitSide)].filter(p => p >= 0) : [];
    scene?.sync({ room: room(), state: journey.state, selected, binding, preview, reducedMotion: settings.reducedMotion }, from);
  }
  function draw(from?: number) {
    const r = room(), state = journey.state, hand = carried(state);
    shell.dataset.room = r.id; shell.dataset.won = String(state.won); shell.dataset.player = String(state.player); shell.dataset.busy = String(busy);
    shell.dataset.reducedMotion = String(settings.reducedMotion);
    el('[data-hway-title]').textContent = r.title; el('[data-hway-subtitle]').textContent = r.subtitle;
    el('[data-hway-hand]').textContent = hand?.kind ?? '空';
    if (gridRoom !== r.id) {
      gridRoom = r.id; board.style.aspectRatio = `${r.width} / ${r.height}`;
      grid.style.gridTemplateColumns = `repeat(${r.width}, 1fr)`; grid.style.gridTemplateRows = `repeat(${r.height}, 1fr)`;
      grid.innerHTML = r.tiles.map((_, pos) => `<button type="button" class="hway-cell" data-hway-cell="${pos}" tabindex="-1"></button>`).join('');
    }
    grid.querySelectorAll<HTMLButtonElement>('[data-hway-cell]').forEach(button => {
      const pos = Number(button.dataset.hwayCell), glyph = cellGlyph(pos);
      button.setAttribute('aria-label', `第${Math.floor(pos / r.width) + 1}行第${pos % r.width + 1}列，${glyph}${r.tiles[pos] === 'water' && at(state, pos) ? '，木桥下是水' : ''}`);
      button.setAttribute('aria-pressed', String(pos === selected)); button.tabIndex = pos === (selected ?? state.player) ? 0 : -1;
    });
    el<HTMLButtonElement>('[data-hway-undo]').disabled = !journey.history.length;
    el('[data-hway-ending]').hidden = !state.won;
    el('[data-hway-ending-text]').textContent = r.departure;
    el('[data-hway-next]').textContent = journey.room === 4 ? '回到游戏世界' : '往前走';
    el('[data-hway-replay]').hidden = journey.room !== 4 || !state.won;
    el('[data-hway-motion]').setAttribute('aria-pressed', String(settings.reducedMotion));
    el('[data-hway-sentences]').innerHTML = r.sentences.map(s => `<button type="button" data-hway-rule="${s.id}" aria-pressed="${binding === s.id}">${sentenceText(state, s)} <small>查看这段路</small></button>`).join('');
    inspect(); sceneSync(from);
  }
  function inspect() {
    const state = journey.state, r = room(), actions = el('[data-hway-actions]'); actions.innerHTML = '';
    if (selected === null) { el('[data-hway-inspect]').textContent = '点字先查看；走到旁边，再拿、放、拆或合。'; return; }
    const pos = selected, glyph = cellGlyph(pos), item = at(state, pos), hand = carried(state), word = wordRecord(glyph);
    const close = distance(r, state.player, pos) === 1;
    const sentence = r.sentences.find(s => s.cells.includes(pos) || s.targets.includes(pos));
    let text = `${glyph}${word ? ` ${word.pinyin} · ${word.meaning}` : ''}`;
    if (sentence) text += ` ${sentenceText(state, sentence)}，只作用于连线框出的${sentence.subject === '门' ? '门格' : '风格'}。`;
    if (glyph === '风') text += ' 风吹时，踏入风格会沿箭头到下一格；停风后可以停留。风格不能放字。';
    if (!close && pos !== state.player) text += ' 先走到上下左右的相邻格。';
    if (pos === state.player) text += hand ? ` 手里带着${hand.kind}。` : ' 手里是空的。';
    el('[data-hway-inspect]').textContent = text;
    const button = (label: string, command: string, disabled = false) => `<button type="button" data-hway-action="${command}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    if (!close || state.won) return;
    if (splitMode && item?.kind === '林') {
      const preview = act(r, state, { type: 'split', target: pos, side: splitSide });
      actions.innerHTML = `<div class="hway-structure" aria-label="林是左右结构，左木右木"><span>木</span><span>木</span><b>↔ 林</b></div><div class="hway-split-sides">${(['left', 'right'] as const).map(side => `<button type="button" data-hway-side="${side}" aria-pressed="${splitSide === side}">向${side === 'left' ? '左' : '右'}拆</button>`).join('')}</div>${button('确认拆开', 'split', !preview.ok)}${button('取消', 'cancel')}<p>${preview.ok ? '金色框内两格可放下两枚木。' : escape(preview.message)}</p>`;
    } else {
      if (item) actions.innerHTML += button('拿起' + item.kind, 'take', !!hand);
      if (hand && !item) { const preview = act(r, state, { type: 'put', target: pos }); actions.innerHTML += button('放下' + hand.kind, 'put'); if (!preview.ok) actions.innerHTML += `<p>${escape(preview.message)}</p>`; }
      if (item?.kind === '林') actions.innerHTML += button('拆开林', 'preview-split');
      if (item?.kind === '木' && hand?.kind === '木') actions.innerHTML += `<div class="hway-structure" aria-label="木在左，木在右，合成林"><span>木</span><span>木</span><b>→ 林</b></div>${button('合成林', 'combine')}`;
      if (!actions.children.length && r.tiles[pos] === 'floor') actions.innerHTML = '<p>这格可以走。用方向按钮移动人。</p>';
      actions.innerHTML += button('取消', 'cancel');
    }
  }
  function select(pos: number) {
    if (destroyed || !Number.isInteger(pos) || pos < 0 || pos >= room().tiles.length) return;
    selected = pos; splitMode = false;
    binding = room().sentences.find(s => s.cells.includes(pos) || s.targets.includes(pos))?.id ?? null;
    draw();
  }
  function unlock() { window.clearTimeout(busyTimer); busy = false; shell.dataset.busy = 'false'; }
  function run(action: Action) {
    if (destroyed || busy || !el('[data-hway-modal]').hidden) return;
    const previous = journey.state.player, update = perform(journey, action);
    if (!update.result.ok) { say(update.result.message); if (action.type === 'move') select(neighbor(room(), previous, action.direction)); return; }
    journey = update.journey; splitMode = false; selected = null; cancelHint();
    if (action.type === 'move') { facing = action.direction; selected = neighbor(room(), journey.state.player, facing); if (selected < 0) selected = null; }
    else selected = action.target;
    busy = true; persist(); draw(previous); say(update.result.message);
    busyTimer = window.setTimeout(unlock, settings.reducedMotion ? 50 : 160);
  }
  function freshRoom(message: string) { unlock(); cancelHint(); selected = null; binding = null; splitMode = false; facing = 'right'; persist(); draw(); resize(); say(message); }
  function selectedAction(type: string) {
    if (type === 'cancel') { selected = null; splitMode = false; binding = null; draw(); el(`[data-hway-cell="${journey.state.player}"]`).focus({ preventScroll: true }); return; }
    if (selected === null) selected = neighbor(room(), journey.state.player, facing);
    if (type === 'preview-split') { splitMode = true; splitSide = 'right'; draw(); el(`[data-hway-side="${splitSide}"]`)?.focus({ preventScroll: true }); return; }
    if (type === 'split') run({ type: 'split', target: selected, side: splitSide });
    else if (type === 'take' || type === 'put' || type === 'combine') run({ type, target: selected });
  }
  function showHint() {
    el('[data-hway-hint-box]').hidden = false;
    const result = hintResult, text = el('[data-hway-hint-text]');
    el('[data-hway-hint-more]').hidden = hintLevel >= 3;
    if (!result) { text.textContent = '正在看你现在这段路……'; return; }
    if (result.status !== 'solved') { text.textContent = result.status === 'unsolvable' ? '从现在的位置，已经找不到回家的路了。撤销到路断开之前，或重开这一间；字和进度不会受罚。' : '这次还没算出完整路线，不能确定已经无路。可以先撤销一步再看看。'; return; }
    const first = result.actions[0]; if (!first) { text.textContent = '已经到了，往前走吧。'; return; }
    const change = result.actions.find(a => a.type !== 'move');
    const changedGlyph = change ? (change.type === 'put' ? carried(journey.state)?.kind : at(journey.state, change.target)?.kind) : undefined;
    if (hintLevel === 1) text.textContent = change ? `先看看第${Math.floor(change.target / room().width) + 1}行第${change.target % room().width + 1}列附近：哪里挡路，哪里缺一个落脚处？` : '看看发光的出口，以及你脚边连着的路。';
    else if (hintLevel === 2) text.textContent = !change ? '只要路连起来，人就能走到发光的出口。' : change.type === 'split' ? '林可以变成两枚木。拆开前，它左右至少一边要有空地。' : change.type === 'combine' ? '两枚木可以合成林；林仍算手里的一件行李。' : changedGlyph === '不' ? '把不放进短句，才会否定那一段门或风；拿走不，马上变回肯定。拿在手里不影响短句。' : '手里只能带一个字。岸上的木挡路，水上的木搭桥，旧桥也能拿回来。';
    else { text.textContent = describeAction(room(), journey.state, first); select(first.type === 'move' ? neighbor(room(), journey.state.player, first.direction) : first.target); }
  }
  function requestHint() {
    hintLevel = Math.min(3, hintLevel + 1); showHint(); if (hintResult || hintWorker) return;
    const id = ++hintId;
    hintWorker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    hintWorker.onmessage = event => { if (destroyed || event.data.id !== hintId) return; hintResult = event.data.result; hintWorker?.terminate(); hintWorker = null; showHint(); };
    hintWorker.onerror = () => { hintWorker?.terminate(); hintWorker = null; el('[data-hway-hint-text]').textContent = '提示暂时没打开。可以撤销一步，或继续试试。'; };
    hintWorker.postMessage({ id, room: journey.room, state: journey.state });
  }
  function resize() {
    if (!game || destroyed) return;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const width = Math.round(board.clientWidth * ratio), height = Math.round(board.clientHeight * ratio);
    if (width < 1 || height < 1) return;
    if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
    sceneSync();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(board);
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!target || !root.contains(target)) return;
    if (event.detail > 1 && (event as PointerEvent).pointerType !== 'touch' && target.matches('[data-hway-action]')) return;
    if (target.dataset.hwayCell !== undefined) select(Number(target.dataset.hwayCell));
    else if (target.dataset.hwayMove) { facing = target.dataset.hwayMove as Direction; run({ type: 'move', direction: facing }); }
    else if (target.dataset.hwayAction) selectedAction(target.dataset.hwayAction);
    else if (target.dataset.hwaySide) { splitSide = target.dataset.hwaySide as 'left' | 'right'; draw(); el(`[data-hway-side="${splitSide}"]`).focus({ preventScroll: true }); }
    else if (target.dataset.hwayRule) { binding = binding === target.dataset.hwayRule ? null : target.dataset.hwayRule; draw(); }
    else if (target.matches('[data-hway-undo]')) { journey = undo(journey); freshRoom('退回上一步，所有字都回到了原处。'); }
    else if (target.matches('[data-hway-restart]')) { el('[data-hway-modal]').hidden = false; el('[data-hway-confirm-restart]').focus(); }
    else if (target.matches('[data-hway-cancel-restart]')) { el('[data-hway-modal]').hidden = true; el('[data-hway-restart]').focus(); }
    else if (target.matches('[data-hway-confirm-restart]')) { el('[data-hway-modal]').hidden = true; journey = restart(journey); freshRoom(room().arrival); el('[data-hway-restart]').focus(); }
    else if (target.matches('[data-hway-exit]')) onExit();
    else if (target.matches('[data-hway-next]')) { if (journey.room === 4) onExit(); else { journey = nextRoom(journey); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); } }
    else if (target.matches('[data-hway-replay]') && journey.room === 4 && journey.state.won) { journey = newJourney(0, journey.unlocked); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (target.matches('[data-hway-hint], [data-hway-hint-more]')) requestHint();
    else if (target.matches('[data-hway-hint-close]')) el('[data-hway-hint-box]').hidden = true;
    else if (target.matches('[data-hway-motion]')) { settings.reducedMotion = !settings.reducedMotion; persist(); draw(); }
  };
  root.addEventListener('click', click);
  const keys = (event: KeyboardEvent) => {
    if (destroyed || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!el('[data-hway-modal]').hidden) {
      if (event.key === 'Escape') el('[data-hway-cancel-restart]').click();
      if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === el('[data-hway-confirm-restart]') ? el('[data-hway-cancel-restart]') : el('[data-hway-confirm-restart]')).focus(); }
      return;
    }
    const key = event.key.toLowerCase();
    const direction = ({ arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' } as Record<string, Direction>)[key];
    if (direction) { event.preventDefault(); if (event.shiftKey) select(neighbor(room(), selected ?? journey.state.player, direction)); else { facing = direction; run({ type: 'move', direction }); } }
    else if (key === 'e') { event.preventDefault(); selectedAction(carried(journey.state) ? 'put' : 'take'); }
    else if (key === 'x') { event.preventDefault(); selectedAction('preview-split'); }
    else if (key === 'c') { event.preventDefault(); selectedAction('combine'); }
    else if (key === 'z') { event.preventDefault(); el('[data-hway-undo]').click(); }
    else if (key === 'escape') selectedAction('cancel');
  };
  window.addEventListener('keydown', keys);
  const visibility = () => { unlock(); if (!destroyed) sceneSync(); };
  document.addEventListener('visibilitychange', visibility);
  const pagehide = (event: PageTransitionEvent) => { persist(); if (!event.persisted) destroy(); else { unlock(); hintWorker?.terminate(); hintWorker = null; } };
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('resize', resize);
  draw(); say(save.restored ? '接着上次的路走。撤销也一起恢复了。' : room().arrival); persist();
  void (async () => {
    await document.fonts.ready; await document.fonts.load(`32px ${FONT_STACK}`, '人木林不家门风水开吹山路');
    if (destroyed) return;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const width = Math.round(board.clientWidth * ratio), height = Math.round(board.clientHeight * ratio); if (width < 1 || height < 1) { say('场景暂时没有可用尺寸。请展开窗口后刷新。'); return; }
    scene = new AdventureScene(() => { if (destroyed) return; el('[data-hway-canvas]').dataset.ready = 'true'; sceneSync(); });
    game = new Phaser.Game({ type: Phaser.CANVAS, parent: el('[data-hway-canvas]'), width, height, transparent: true, scene, banner: false, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false }, scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER } });
    resize();
  })();
  function destroy() { if (destroyed) return; destroyed = true; unlock(); hintWorker?.terminate(); resizeObserver.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('keydown', keys); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); root.removeEventListener('click', click); game?.destroy(true); }
  return { destroy };
}
