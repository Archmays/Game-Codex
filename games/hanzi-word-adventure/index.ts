import Phaser from 'phaser';
import type { GameDefinition, MountedGame } from '../../packages/game-core';
import { FONT_STACK, wordRecord, WORLD_RULES } from './content';
import { act, at, carried, combineKind, illumination, passable, visible, describeAction, DIR_NAMES, distance, neighbor, newJourney, nextRoom, perform, restart, sentenceText, undo, type Action } from './model';
import { CHAPTERS, ROOMS, lastInChapter, type ChapterId, type Direction } from './rooms';
import { openSave, type StorageLike } from './save';
import { AdventureScene } from './scene';
import type { SearchResult } from './solver';
import { bindInputLifecycle, ignoreGameKey, preserveRegionFocus, rovingGroup } from '../../packages/ui/input';
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
  let placementMode = false;
  let binding: string | null = null, splitMode = false, splitSide: 'left' | 'right' = 'right', destroyed = false, busy = false, busyTimer = 0;
  let hintLevel = 0, hintResult: SearchResult | null = null, hintWorker: Worker | null = null, hintId = 0;
  let menuOpen = true, menuMode: 'entry' | 'new' | 'continue' = 'entry', hasEntered = false, resetChapter: ChapterId | null = null;
  let modalOpener: HTMLElement | null = null, moveStamp = 0;
  let game: Phaser.Game | undefined, scene: AdventureScene | undefined, gridRoom = '';
  const room = () => ROOMS[journey.room];
  root.className = 'hway-mount';
  root.innerHTML = `<main class="hway" data-testid="hanzi-word-adventure" aria-labelledby="hway-title">
    <header class="hway-header"><div><p>字间行者 <span data-hway-chapter-title>· 借字归途</span></p><h1 id="hway-title" data-hway-title></h1></div><button type="button" data-hway-exit aria-label="返回游戏世界">返回</button></header>
    <section class="hway-menu hway-modal" data-hway-menu role="dialog" aria-modal="true" aria-label="选择新游戏或继续游戏"><div><h2>从哪段路出发？</h2><p>每章各有一份本机存档，可以随时换章。</p><div data-hway-menu-content></div><button type="button" data-hway-menu-close>返回</button></div></section><div class="hway-layout"><section class="hway-land" aria-label="文字场景">
      <p class="hway-subtitle" data-hway-subtitle></p>
      <div class="hway-board" data-hway-board><div class="hway-canvas" data-hway-canvas aria-hidden="true"></div><div class="hway-grid" role="group" aria-label="文字世界。方向键移动；Shift加方向键查看相邻格；空格主操作；Tab离开世界" data-hway-grid tabindex="0"></div></div>
      <p class="hway-legend"><span>山 · 山崖</span><span>框中的字 · 可搬</span><span>双线短句 · 改规则</span></p>
    </section><aside class="hway-controls" aria-label="走路与改字">
      <div class="hway-save-tools"><button type="button" data-hway-saves>章节／存档</button><button type="button" data-hway-reset>重置本章进度</button></div><div class="hway-hand"><span>手里 <strong data-hway-hand>空</strong></span><span>最多带一个字<br> · 林也算一个</span></div>
      <div class="hway-direction" aria-label="移动方向">${(['left', 'up', 'down', 'right'] as Direction[]).map(d => `<button type="button" data-hway-move="${d}" aria-label="向${DIR_NAMES[d]}走">${arrows[d]}</button>`).join('')}</div>
      <div class="hway-primary"><p data-hway-target></p><button type="button" data-hway-primary>主操作 · Space</button><button type="button" data-hway-choose-place hidden aria-pressed="false">选择落字处</button></div><div class="hway-toolbar"><button type="button" data-hway-undo>撤销一步</button><button type="button" data-hway-restart>本间重开</button><button type="button" data-hway-hint>想一想</button></div>
      <section class="hway-inspect" aria-label="字的状态和动作"><p data-hway-inspect>点一个字，先看它能做什么。</p><div class="hway-actions" data-hway-actions></div></section>
      <p class="hway-feedback" role="status" aria-live="polite" data-hway-feedback></p>
      <div class="hway-hint" data-hway-hint-box hidden><p data-hway-hint-text></p><button type="button" data-hway-hint-more>再提示一点</button><button type="button" data-hway-hint-close>收起提示</button></div>
      <div class="hway-sentences" data-hway-sentences></div>
      <div class="hway-ending" data-hway-ending hidden><p data-hway-ending-text></p><button type="button" data-hway-next>往前走</button><button type="button" data-hway-replay hidden>再走一次归途</button></div>
      <details class="hway-help"><summary>怎么玩 · 字与规则</summary><p>方向键／WASD：移动　Shift＋方向键：查看<br>Space／E：拿／放／明确确认　X：拆　C：合　Z：撤销　Esc：取消</p><p>点击相邻空路走一格；点击物件先查看，再按主操作。持字时点“选择落字处”，再点相邻格，只选位置不走路。远格不移动。Tab切换区域；在方向区用方向键选按钮。</p><ol>${WORLD_RULES.map(r => `<li>${r}</li>`).join('')}</ol><button type="button" data-hway-motion aria-pressed="false">减少动态</button><p data-hway-save-status></p></details>
    </aside></div>
    <div class="hway-modal" data-hway-modal hidden role="dialog" aria-modal="true" aria-labelledby="hway-restart-title"><div><h2 id="hway-restart-title" data-hway-modal-title>重新走这一间？</h2><p data-hway-modal-text>本间回到入口，已经走到的房间仍保留。</p><button type="button" data-hway-confirm-restart>重开这一间</button><button type="button" data-hway-cancel-restart>取消</button></div></div>
  </main>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const shell = el('.hway'), board = el('[data-hway-board]'), grid = el('[data-hway-grid]'), feedback = el('[data-hway-feedback]');
  const say = (message: string) => { if (message) feedback.textContent = message; };
  function persist() { if (!hasEntered) return; save.write(journey, settings); el('[data-hway-save-status]').textContent = save.writable ? '进度和撤销只保存在本机。' : '原有记录已保护；本页仍可玩，新的动作暂不写入存档。'; }
  function cancelHint() { hintWorker?.terminate(); hintWorker = null; hintResult = null; hintLevel = 0; hintId++; el('[data-hway-hint-box]').hidden = true; }
  function cellGlyph(pos: number) {
    if (pos === journey.state.player) return '人';
    if (!visible(room(), journey.state, pos)) return '影（暗，不可走）';
    const item = at(journey.state, pos); if (item) return item.kind;
    const sentence = room().sentences.find(s => s.cells.includes(pos));
    if (sentence) return sentence.cells[0] === pos ? sentence.subject : sentence.cells[2] === pos ? sentence.verb : '空字位';
    return ({ floor: '路面', water: '水', wind: '风', door: '门', goal: lastInChapter(journey.room) ? '家' : '路', shadow: '影（亮，可走）', wall: '山', rule: '规则', socket: '空字位' })[room().tiles[pos]];
  }
  function operationTarget() { return selected !== null && distance(room(),journey.state.player,selected) === 1 ? selected : neighbor(room(),journey.state.player,facing); }
  function primaryType() { const item = visible(room(),journey.state,operationTarget()) ? at(journey.state, operationTarget()) : undefined, hand = carried(journey.state); return !hand && (item?.kind === '林' || item?.kind === '明') ? 'choose' : combineKind(hand,item) ? 'choose' : hand ? 'put' : 'take'; }
  function primaryAction() {
    if (busy || menuOpen) return;
    if (splitMode) { selectedAction('split'); return; }
    selected = operationTarget(); draw();
    if (primaryType() === 'choose') { say('这里有几种动作。选择拿起、拆开或合成，预览后再确认。'); el<HTMLButtonElement>('[data-hway-actions] button:not(:disabled)')?.focus(); }
    else selectedAction(primaryType());
  }
  function renderMenu(focus = true) {
    const content = el('[data-hway-menu-content]');
    content.innerHTML = menuMode === 'entry' ? '<button type="button" data-hway-new>新游戏</button><button type="button" data-hway-continue>继续游戏</button>' : `<p>${menuMode === 'new' ? '选择新游戏章节。已有存档的章节会先确认重置。' : '选择要继续的章节存档。其他章节会保留。'}</p>${CHAPTERS.map(c => { const j = save.chapters[c.id]; return `<button type="button" data-hway-chapter="${c.id}" ${menuMode === 'continue' && !j ? 'disabled' : ''}>${escape(c.title)}<small>${j ? `${escape(ROOMS[j.room].title)} · ${j.roomId}${j.state.won ? ' · 已到出口' : ''}` : '尚未开始'}</small></button>`; }).join('')}<button type="button" data-hway-${menuMode === 'new' ? 'continue' : 'new'}>${menuMode === 'new' ? '查看继续存档' : '选择新游戏'}</button>`;
    el('[data-hway-menu]').hidden = !menuOpen; el('.hway-layout').inert = menuOpen; el('.hway-header').inert = menuOpen;
    if (focus) content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
  function openMenu() { persist(); placementMode=false; resetInput(); menuOpen = true; menuMode = 'entry'; renderMenu(); }
  function closeMenu() { menuOpen = false; renderMenu(false); grid.focus({preventScroll:true}); }
  function enterChapter(id: ChapterId, reset = false) { if (hasEntered) persist(); hasEntered = true; journey = reset ? save.reset(id,settings) : save.select(id); const url = new URL(location.href); url.searchParams.set('chapter',id); history.replaceState(history.state,'',url); closeMenu(); freshRoom(room().arrival); grid.focus({preventScroll:true}); }
  function openModal(title: string, message: string, confirm: string) { placementMode=false; resetInput(); modalOpener = document.activeElement as HTMLElement; el('[data-hway-modal-title]').textContent = title; el('[data-hway-modal-text]').textContent = message; el('[data-hway-confirm-restart]').textContent = confirm; el('[data-hway-modal]').hidden = false; el('[data-hway-menu]').inert = true; el('.hway-layout').inert = true; el('[data-hway-cancel-restart]').focus(); }
  function closeModal() { el('[data-hway-modal]').hidden = true; el('[data-hway-menu]').inert = false; el('.hway-layout').inert = menuOpen; (modalOpener?.isConnected ? modalOpener : grid).focus(); }
  function openReset(id: ChapterId) { resetChapter = id; openModal(`重置“${CHAPTERS.find(c=>c.id === id)!.title}”进度？`, '这一章回到第一间，撤销和本章进度将重新开始。其他章节与旧版原始存档保留。', '确认重置本章'); }
  function sceneSync(from?: number) {
    const preview = splitMode && selected !== null ? [selected, neighbor(room(), selected, splitSide)].filter(p => p >= 0) : [];
    scene?.sync({ room: room(), state: journey.state, selected, target: operationTarget(), facing, binding, preview, reducedMotion: settings.reducedMotion }, from);
  }
  function draw(from?: number) {
    const r = room(), state = journey.state, hand = carried(state);
    shell.dataset.chapter = r.chapterId; shell.dataset.room = r.id; shell.dataset.won = String(state.won); shell.dataset.player = String(state.player); shell.dataset.busy = String(busy);
    shell.dataset.reducedMotion = String(settings.reducedMotion);
    el('[data-hway-chapter-title]').textContent = `· ${CHAPTERS.find(c=>c.id === r.chapterId)!.title}`;
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
      button.setAttribute('aria-pressed', String(pos === selected)); button.tabIndex = -1; button.dataset.lit = String(illumination(r, state).has(pos)); button.dataset.target = String(pos === operationTarget());
    });
    el<HTMLButtonElement>('[data-hway-undo]').disabled = !journey.history.length;
    el('[data-hway-ending]').hidden = !state.won;
    el('[data-hway-ending-text]').textContent = r.departure;
    el('[data-hway-next]').textContent = lastInChapter(journey.room) ? '选择另一章' : '往前走';
    el('[data-hway-replay]').hidden = !lastInChapter(journey.room) || !state.won;
    el('[data-hway-motion]').setAttribute('aria-pressed', String(settings.reducedMotion));
    preserveRegionFocus(el('[data-hway-sentences]'), () => { el('[data-hway-sentences]').innerHTML = r.sentences.map(s => `<button type="button" data-hway-rule="${s.id}" aria-pressed="${binding === s.id}">${sentenceText(state, s)} <small>查看这段路</small></button>`).join(''); }, e => e.dataset.hwayRule ?? null, id => root.querySelector(`[data-hway-rule="${id}"]`), () => grid);
    preserveRegionFocus(el('[data-hway-actions]'), inspect, e => e.dataset.hwayAction ?? e.dataset.hwaySide ?? null, id => root.querySelector(`[data-hway-action="${id}"]:not(:disabled), [data-hway-side="${id}"]:not(:disabled)`), () => grid);
    const target = operationTarget(), item = visible(r,state,target) ? at(state,target) : undefined, primary = primaryType();
    el('[data-hway-target]').textContent = `朝${DIR_NAMES[facing]} ${arrows[facing]} · 目标：${target < 0 ? '边界' : `第${Math.floor(target/r.width)+1}行第${target%r.width+1}列 ${cellGlyph(target)}`}${selected !== null && distance(r, state.player, selected) !== 1 ? '（远处仅查看）' : ''}`;
    el('[data-hway-choose-place]').hidden = !hand || state.won; el('[data-hway-choose-place]').setAttribute('aria-pressed',String(placementMode));
    el('[data-hway-choose-place]').textContent = placementMode ? '点相邻格选位置 · Esc取消' : '选择落字处';
    el('[data-hway-primary]').textContent = splitMode ? '确认拆开 · Space' : primary === 'choose' ? '选择当前动作 · Space' : `${primary === 'put' ? '放下'+(hand?.kind ?? '字') : '拿起'+(item?.kind ?? '字')} · Space`;
    sceneSync(from);
  }
  function inspect() {
    const state = journey.state, r = room(), actions = el('[data-hway-actions]'); actions.innerHTML = '';
    if (selected === null) { el('[data-hway-inspect]').textContent = '点字先查看；走到旁边，再拿、放、拆或合。'; return; }
    const pos = selected, glyph = cellGlyph(pos), item = visible(r,state,pos) ? at(state,pos) : undefined, hand = carried(state), word = wordRecord(glyph);
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
    if (!visible(r,state,pos)) { actions.innerHTML = '<p>先用明照亮这里，再查看或改变字。</p>'+button('取消','cancel'); return; }
    if (splitMode && (item?.kind === '林' || item?.kind === '明')) {
      const preview = act(r, state, { type: 'split', target: pos, side: splitSide });
      actions.innerHTML = `<div class="hway-structure" aria-label="${item.kind}的左右结构"><span>${item.kind === '明' ? '日' : '木'}</span><span>${item.kind === '明' ? '月' : '木'}</span><b>↔ ${item.kind}</b></div><div class="hway-split-sides">${(['left', 'right'] as const).map(side => `<button type="button" data-hway-side="${side}" aria-pressed="${splitSide === side}" tabindex="${splitSide === side ? 0 : -1}">向${side === 'left' ? '左' : '右'}拆</button>`).join('')}</div>${button('确认拆开', 'split', !preview.ok)}${button('取消', 'cancel')}<p>${preview.ok ? `金色框内两格可放下${item.kind === '明' ? '日和月' : '两枚木'}。` : escape(preview.message)}</p>`;
    } else {
      if (item) actions.innerHTML += button('拿起' + item.kind, 'take', !!hand);
      if (hand && !item) { const preview = act(r, state, { type: 'put', target: pos }); actions.innerHTML += button('放下' + hand.kind, 'put'); if (!preview.ok) actions.innerHTML += `<p>${escape(preview.message)}</p>`; }
      if (item?.kind === '林' || item?.kind === '明') actions.innerHTML += button('拆开'+item.kind, 'preview-split');
      if (combineKind(hand, item)) actions.innerHTML += `<div class="hway-structure" aria-label="规范左右结构"><span>${combineKind(hand,item) === '明' ? '日' : '木'}</span><span>${combineKind(hand,item) === '明' ? '月' : '木'}</span><b>→ ${combineKind(hand,item)}</b></div>${button('合成'+combineKind(hand,item), 'combine')}`;
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
    if (destroyed || busy || menuOpen || !el('[data-hway-modal]').hidden) return;
    const previous = journey.state.player, update = perform(journey, action);
    if (action.type === 'move') facing = action.direction;
    if (!update.result.ok) { say(update.result.message); if (action.type === 'move') select(neighbor(room(), previous, action.direction)); return; }
    journey = update.journey; placementMode = false; splitMode = false; selected = null; cancelHint();
    if (action.type === 'move') { facing = action.direction; selected = neighbor(room(), journey.state.player, facing); if (selected < 0) selected = null; }
    else selected = action.target;
    busy = true; persist(); draw(previous); say(update.result.message);
    busyTimer = window.setTimeout(unlock, settings.reducedMotion ? 50 : 160);
  }
  function freshRoom(message: string) { const endingFocus = (document.activeElement as HTMLElement)?.matches('[data-hway-next],[data-hway-replay]'); unlock(); cancelHint(); selected = null; binding = null; placementMode = false; splitMode = false; facing = 'right'; persist(); draw(); resize(); say(message); if(endingFocus) grid.focus({preventScroll:true}); }
  function selectedAction(type: string) {
    if (type === 'cancel') { placementMode = false; selected = null; splitMode = false; binding = null; draw(); grid.focus({ preventScroll: true }); return; }
    selected = operationTarget();
    if (selected < 0) { say('朝向指向边界，先换一个方向。'); return; }
    if (!visible(room(),journey.state,selected)) { say('先用明照亮这里，再查看或改变字。'); return; }
    if (type === 'preview-split') { if (!['林','明'].includes(at(journey.state, selected)?.kind ?? '')) { say('目标没有可拆的林或明。'); return; } splitMode = true; splitSide = 'right'; draw(); el(`[data-hway-side="${splitSide}"]`)?.focus({ preventScroll: true }); return; }
    if (type === 'split') run({ type: 'split', target: selected, side: splitSide });
    else if (type === 'take' || type === 'put' || type === 'combine') run({ type, target: selected });
  }
  function showHint() {
    el('[data-hway-hint-box]').hidden = false;
    const result = hintResult, text = el('[data-hway-hint-text]');
    const more = el('[data-hway-hint-more]'); const wasFocused = document.activeElement === more; more.hidden = hintLevel >= 3; if (wasFocused && more.hidden) el('[data-hway-hint-close]').focus();
    if (!result) { text.textContent = '正在看你现在这段路……'; return; }
    if (result.status !== 'solved') { text.textContent = result.status === 'unsolvable' ? '从现在的位置，已经找不到回家的路了。撤销到路断开之前，或重开这一间；字和进度不会受罚。' : '这次还没算出完整路线，不能确定已经无路。可以先撤销一步再看看。'; return; }
    const first = result.actions[0]; if (!first) { text.textContent = '已经到了，往前走吧。'; return; }
    const change = result.actions.find(a => a.type !== 'move');
    const changedGlyph = change ? (change.type === 'put' ? carried(journey.state)?.kind : at(journey.state, change.target)?.kind) : undefined;
    if (hintLevel === 1) text.textContent = change ? `先看看第${Math.floor(change.target / room().width) + 1}行第${change.target % room().width + 1}列附近：哪里挡路，哪里缺一个落脚处？` : '看看发光的出口，以及你脚边连着的路。';
    else if (hintLevel === 2) text.textContent = !change ? '只要路连起来，人就能走到发光的出口。' : change.type === 'split' ? (changedGlyph === '明' ? '明拆后不再发光。先离开会变暗的影格，再留出左右两格放日和月。' : '林可以变成两枚木。拆开前，它左右至少一边要有空地。') : change.type === 'combine' ? (['日','月'].includes(changedGlyph ?? '') ? '日与月合成明才会照路；明仍算手里的一件行李。' : '两枚木可以合成林；林仍算手里的一件行李。') : changedGlyph === '不' ? '把不放进短句，才会否定那一段门或风；拿走不，马上变回肯定。拿在手里不影响短句。' : ['明','日','月'].includes(changedGlyph ?? '') ? '只有明能照影路：从灯沿通格三步，山和关门挡光。放灯腾手；走远时可以收回。' : '手里只能带一个字。岸上的木挡路，水上的木搭桥，旧桥也能拿回来。';
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
    if (target.dataset.hwayCell !== undefined) { const pos = Number(target.dataset.hwayCell); if (placementMode) { if(distance(room(),journey.state.player,pos) !== 1) { say('请选择人上下左右的相邻格；这次没有走路或放字。'); return; } placementMode=false; select(pos); say('落字处已选好，按主操作确认放下。'); el('[data-hway-primary]').focus({preventScroll:true}); } else if (distance(room(), journey.state.player, pos) === 1 && !at(journey.state,pos) && passable(room(),journey.state,pos)) { const direction = (['up','right','down','left'] as Direction[]).find(d => neighbor(room(),journey.state.player,d) === pos)!; run({type:'move',direction}); } else select(pos); }
    else if (target.matches('[data-hway-primary]')) primaryAction();
    else if (target.matches('[data-hway-choose-place]')) { placementMode=!placementMode; draw(); say(placementMode ? '点人旁边一格选落字处，再按主操作放下。' : '取消选落字处，点击空路仍会走一格。'); }
    else if (target.matches('[data-hway-new]')) { menuMode = 'new'; renderMenu(); }
    else if (target.matches('[data-hway-continue]')) { menuMode = 'continue'; renderMenu(); }
    else if (target.dataset.hwayChapter) { const id = target.dataset.hwayChapter as ChapterId; if (menuMode === 'new' && save.chapters[id]) openReset(id); else enterChapter(id, menuMode === 'new'); }
    else if (target.matches('[data-hway-saves]')) openMenu();
    else if (target.matches('[data-hway-reset]')) openReset(journey.chapterId);
    else if (target.matches('[data-hway-menu-close]')) { if (hasEntered) closeMenu(); else onExit(); }
    else if (target.dataset.hwayMove) { facing = target.dataset.hwayMove as Direction; run({ type: 'move', direction: facing }); }
    else if (target.dataset.hwayAction) selectedAction(target.dataset.hwayAction);
    else if (target.dataset.hwaySide) { splitSide = target.dataset.hwaySide as 'left' | 'right'; draw(); el(`[data-hway-side="${splitSide}"]`).focus({ preventScroll: true }); }
    else if (target.dataset.hwayRule) { binding = binding === target.dataset.hwayRule ? null : target.dataset.hwayRule; draw(); }
    else if (target.matches('[data-hway-undo]')) { journey = undo(journey); freshRoom('退回上一步，所有字都回到了原处。'); }
    else if (target.matches('[data-hway-restart]')) { resetChapter = null; openModal('重新走这一间？', '本间回到入口，已经走到的房间仍保留。', '重开这一间'); }
    else if (target.matches('[data-hway-cancel-restart]')) closeModal();
    else if (target.matches('[data-hway-confirm-restart]')) { const id = resetChapter; closeModal(); if (id) enterChapter(id, true); else { journey = restart(journey); freshRoom(room().arrival); } }
    else if (target.matches('[data-hway-exit]')) onExit();
    else if (target.matches('[data-hway-next]')) { if (lastInChapter(journey.room)) openMenu(); else { journey = nextRoom(journey); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); } }
    else if (target.matches('[data-hway-replay]') && lastInChapter(journey.room) && journey.state.won) { journey = newJourney(CHAPTERS.find(c => c.id === journey.chapterId)!.firstRoom, journey.unlocked); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (target.matches('[data-hway-hint], [data-hway-hint-more]')) requestHint();
    else if (target.matches('[data-hway-hint-close]')) { el('[data-hway-hint-box]').hidden = true; el('[data-hway-hint]').focus({ preventScroll: true }); }
    else if (target.matches('[data-hway-motion]')) { settings.reducedMotion = !settings.reducedMotion; persist(); draw(); }
  };
  root.addEventListener('click', click);
  const directionRoving = rovingGroup(el('.hway-direction'), { items: 'button', columns: () => 4 });
  const keys = (event: KeyboardEvent) => {
    if (destroyed) return;
    const modal = !el('[data-hway-modal]').hidden ? el('[data-hway-modal]') : menuOpen ? el('[data-hway-menu]') : null;
    if (modal) {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { event.preventDefault(); if (modal === el('[data-hway-modal]')) closeModal(); else if (hasEntered) closeMenu(); }
      if (event.key === 'Tab') { const list = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => !b.closest('[hidden]')); const current = list.indexOf(document.activeElement as HTMLButtonElement); if (current < 0 || (event.shiftKey ? current === 0 : current === list.length-1)) { event.preventDefault(); list[event.shiftKey ? list.length-1 : 0]?.focus(); } }
      return;
    }
    if (!event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey && (event.target as HTMLElement)?.dataset?.hwaySide && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); splitSide = event.key === 'ArrowLeft' ? 'left' : 'right'; draw(); el(`[data-hway-side="${splitSide}"]`).focus(); return; }
    if (ignoreGameKey(event, shell, true)) return;
    const key = event.key.toLowerCase(), inWorld = grid.contains(event.target as Node) || event.target === grid;
    if (key === 'escape') { event.preventDefault(); selectedAction('cancel'); return; }
    // Directions and shortcuts belong to the world; ordinary buttons retain navigation and scrolling.
    if (!inWorld) return;
    const direction = ({ arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' } as Record<string, Direction>)[key];
    if (direction) { event.preventDefault(); if (event.repeat && performance.now()-moveStamp < 170) return; moveStamp = performance.now(); if (event.shiftKey) select(neighbor(room(), selected ?? journey.state.player, direction)); else { facing = direction; run({type:'move', direction}); } }
    else if (event.repeat) return;
    else if (key === 'e' || key === ' ') { event.preventDefault(); primaryAction(); }
    else if (key === 'x') { event.preventDefault(); selectedAction('preview-split'); }
    else if (key === 'c') { event.preventDefault(); selectedAction('combine'); }
    else if (key === 'z') { event.preventDefault(); journey = undo(journey); freshRoom('退回上一步，所有字和光都回到了原处。'); }
  };
  window.addEventListener('keydown', keys);
  const resetInput = () => { moveStamp = 0; unlock(); };
  const unbindInput = bindInputLifecycle(root, resetInput);
  const visibility = () => { resetInput(); if (!destroyed) sceneSync(); };
  document.addEventListener('visibilitychange', visibility);
  const pagehide = (event: PageTransitionEvent) => { persist(); if (!event.persisted) destroy(); else { unlock(); hintWorker?.terminate(); hintWorker = null; } };
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('resize', resize);
  draw(); renderMenu(false); const linkedChapter = new URLSearchParams(location.search).get('chapter'); if (CHAPTERS.some(c => c.id === linkedChapter)) enterChapter(linkedChapter as ChapterId);
  say(save.restored ? '接着上次的路走。撤销也一起恢复了。' : room().arrival); persist();
  void (async () => {
    await document.fonts.ready; await document.fonts.load(`32px ${FONT_STACK}`, '人木林不家门风水开吹山路日月明影');
    if (destroyed) return;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const width = Math.round(board.clientWidth * ratio), height = Math.round(board.clientHeight * ratio); if (width < 1 || height < 1) { say('场景暂时没有可用尺寸。请展开窗口后刷新。'); return; }
    scene = new AdventureScene(() => { if (destroyed) return; el('[data-hway-canvas]').dataset.ready = 'true'; sceneSync(); });
    game = new Phaser.Game({ type: Phaser.CANVAS, parent: el('[data-hway-canvas]'), width, height, transparent: true, scene, banner: false, audio: { noAudio: true }, input: { keyboard: false, mouse: false, touch: false }, scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER } });
    resize();
  })();
  function destroy() { if (destroyed) return; destroyed = true; unbindInput(); directionRoving.destroy(); unlock(); hintWorker?.terminate(); resizeObserver.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('keydown', keys); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); root.removeEventListener('click', click); game?.destroy(true); }
  return { destroy };
}
