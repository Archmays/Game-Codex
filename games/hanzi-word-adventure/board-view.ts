import { PRODUCT_VERSION, type Presentation } from '../../packages/presentation/settings';
import { preserveRegionFocus } from '../../packages/ui/input';
import { wordRecord } from './content';
import { act, at, actorGlyph, carried, combineKind, illumination, visible, DIR_NAMES, distance, sentenceText, type Journey } from './model';
import { CHAPTERS, ROOMS, lastInChapter, type Direction } from './rooms';
import type { Settings } from './save';
const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };
export interface AdventureViewState {
  journey: Journey; settings: Settings; visual: Presentation;
  selected: number | null; facing: Direction; splitMode: boolean; splitSide: 'left' | 'right';
  binding: string | null; placementMode: boolean; busy: boolean; target: number;
}
/** DOM controls are stable within a room; rule previews still call the existing pure act. */
export function createAdventureBoardView(root: HTMLElement, sceneSync: (from?: number) => void) {
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const shell = el('.hway'), board = el('[data-hway-board]'), grid = el('[data-hway-grid]');
  let gridRoom = '';
  function draw(view: AdventureViewState, from?: number) {
    const { journey, settings, visual, selected, facing, splitMode, splitSide, binding, placementMode, busy } = view;
    const room = () => ROOMS[journey.room];
    const operationTarget = () => view.target;
    const primaryType = () => carried(journey.state) ? 'put' : 'take';
  function cellGlyph(pos: number) {
    if (pos === journey.state.player) return actorGlyph(journey.state);
    if (pos === journey.state.companion) return journey.state.active === 'person' ? '友' : '人';
    if (!visible(room(), journey.state, pos)) return '影（暗，不可走）';
    const item = at(journey.state, pos); if (item) return item.kind;
    const sentence = room().sentences.find(s => s.cells.includes(pos));
    if (sentence) return sentence.cells[0] === pos ? sentence.subject : sentence.cells[2] === pos ? sentence.verb : '空字位';
    return ({ floor: '路面', water: '水', wind: '风', door: '门', goal: journey.chapterId === 'companions' || lastInChapter(journey.room) ? '家' : '路', shadow: '影（亮，可走）', wall: '山', rule: '规则', socket: '空字位' })[room().tiles[pos]];
  }
    const r = room(), state = journey.state, hand = carried(state);
    shell.dataset.chapter = r.chapterId; shell.dataset.room = r.id; shell.dataset.won = String(state.won); shell.dataset.player = String(state.player); shell.dataset.busy = String(busy);
    shell.dataset.reducedMotion = String(settings.reducedMotion);shell.dataset.lowPerformance=String(visual.lowPerformance);el('[data-hway-content-id]').textContent=`${r.chapterId} / ${r.id} · v${PRODUCT_VERSION}`; shell.dataset.active = state.active ?? 'person'; shell.dataset.companion = state.companion === undefined ? '' : String(state.companion);
    el('[data-hway-companions]').hidden = state.companion === undefined;
    for (const actor of ['person','friend'] as const) { const b = el(`[data-hway-actor=${actor}]`), pos = state.active === actor ? state.player : state.companion; b.textContent = `${actor === 'person' ? '人' : '友'} · ${state.active === actor ? '正在走' : '等在原地'} · 手里${state.entities.find(e => e.pos === null && e.holder === actor)?.kind ?? '空'}${pos !== undefined && r.tiles[pos] === 'goal' ? ' · 到家' : ''}`; b.setAttribute('aria-pressed',String(state.active === actor)); }
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
      button.dataset.fallback=pos===state.player?actorGlyph(state):pos===state.companion?(state.active==='person'?'友':'人'):!visible(r,state,pos)?'影':at(state,pos)?.kind??({wall:'山',water:'水',goal:'家',door:'门',wind:'风',shadow:'影'} as Record<string,string>)[r.tiles[pos]]??'·';
      button.setAttribute('aria-label', `第${Math.floor(pos / r.width) + 1}行第${pos % r.width + 1}列，${glyph}${r.tiles[pos] === 'water' && at(state, pos) ? '，木桥下是水' : ''}`);
      button.setAttribute('aria-pressed', String(pos === selected)); button.tabIndex = -1; button.dataset.lit = String(illumination(r, state).has(pos)); button.dataset.target = String(!state.won && pos === operationTarget());
    });
    el<HTMLButtonElement>('[data-hway-undo]').disabled = !journey.history.length;
    el('[data-hway-ending]').hidden = !state.won;
    el('[data-hway-ending-text]').textContent = r.departure;
    el('[data-hway-next]').textContent = lastInChapter(journey.room) ? '选择另一章' : '往前走';
    el('[data-hway-replay]').hidden = !lastInChapter(journey.room) || !state.won;
    el('[data-hway-mute]').setAttribute('aria-pressed',String(visual.muted));
    el('[data-hway-motion]').setAttribute('aria-pressed', String(settings.reducedMotion));
    preserveRegionFocus(el('[data-hway-sentences]'), () => { el('[data-hway-sentences]').innerHTML = r.sentences.map(s => `<button type="button" data-hway-rule="${s.id}" aria-pressed="${binding === s.id}">${sentenceText(state, s)} <small>查看这段路</small></button>`).join(''); }, e => e.dataset.hwayRule ?? null, id => root.querySelector(`[data-hway-rule="${id}"]`), () => grid);
    inspect();
    const target = operationTarget(), item = visible(r,state,target) ? at(state,target) : undefined, primary = primaryType();
    el('[data-hway-target]').textContent = `朝${DIR_NAMES[facing]} ${arrows[facing]} · 目标：${target < 0 ? '边界' : `第${Math.floor(target/r.width)+1}行第${target%r.width+1}列 ${cellGlyph(target)}`}${selected !== null && distance(r, state.player, selected) !== 1 ? '（远处仅查看）' : ''}`;
    if (state.won) el('[data-hway-target]').textContent = `${state.companion === undefined ? '已到达出口。' : '两人各到一格家。'}${lastInChapter(journey.room) ? '可以选择另一章，或撤销再试。' : `下一间：${ROOMS[journey.room+1].title}。`}`;
    el('[data-hway-choose-place]').hidden = !hand || state.won; el('[data-hway-choose-place]').setAttribute('aria-pressed',String(placementMode));
    el('[data-hway-choose-place]').textContent = placementMode ? '点相邻格选位置 · Esc取消' : '选择落字处';
    el('[data-hway-primary]').textContent = state.won ? (lastInChapter(journey.room) ? '选择另一章 · Space' : '往前走 · Space') : splitMode ? '确认拆开 · Space' : `${primary === 'put' ? '放下'+(hand?.kind ?? '字') : '拿起'+(item?.kind ?? '字')} · Space`;
    const primaryPreview = splitMode && selected !== null ? act(r,state,{type:'split',target:selected,side:splitSide}) : act(r,state,{type:primary,target});
    el<HTMLButtonElement>('[data-hway-primary]').disabled = !state.won && !primaryPreview.ok;
    if (!state.won && !splitMode && !primaryPreview.ok) { el('[data-hway-primary]').textContent = hand ? `暂不能放${hand.kind} · 换个目标` : item ? `暂不能拿${item.kind} · 先留好落脚处` : '这里没有可拿的字 · 换个目标'; if (hand || item) el('[data-hway-target]').textContent += ` ${primaryPreview.message}`; }
    sceneSync(from);

  function inspect() {
    const state = journey.state, r = room(), actions = el('[data-hway-actions]');
    // Stable controls: rendering changes visibility/text/state, never replaces an active button.
    if (!actions.children.length) actions.innerHTML = `<div class="hway-structure" data-hway-structure></div><div class="hway-split-sides">${(['left','right'] as const).map(side => `<button type="button" data-hway-side="${side}">向${side === 'left' ? '左' : '右'}拆</button>`).join('')}</div>${['take','put','preview-split','combine','split','cancel'].map(command => `<button type="button" data-hway-action="${command}"></button>`).join('')}<p data-hway-preview-reason></p>`;
    const button = (command: string, label: string, shown: boolean, disabled = false) => { const b = el<HTMLButtonElement>(`[data-hway-action="${command}"]`); b.textContent = label; b.hidden = !shown; b.disabled = disabled; };
    const pos = selected, item = pos !== null && visible(r,state,pos) ? at(state,pos) : undefined, hand = carried(state), close = pos !== null && distance(r,state.player,pos) === 1 && !state.won && visible(r,state,pos);
    const glyph = pos === null ? '' : cellGlyph(pos), word = wordRecord(glyph), sentence = r.sentences.find(s => pos !== null && (s.cells.includes(pos) || s.targets.includes(pos)));
    el('[data-hway-inspect]').textContent = pos === null ? state.won ? '可以继续旅程，也可以撤销一步再试。' : 'Space拿／放 · X拆 · C合。目标框会跟着朝向。' : `${glyph}${word ? ` ${word.pinyin} · ${word.meaning}` : ''}${sentence ? ` ${sentenceText(state,sentence)}，作用于框出的${sentence.subject}格。` : ''}${!close && pos !== state.player ? ' 走到相邻格才能操作。' : ''}`;
    const preview = splitMode && pos !== null ? act(r,state,{type:'split',target:pos,side:splitSide}) : null;
    button('take',`拿起${item?.kind ?? '字'}`,!!close && !!item && !splitMode,!!hand);
    button('put',`放下${hand?.kind ?? '字'}`,!!close && !!hand && !item && !splitMode);
    button('preview-split',`拆开${item?.kind ?? '字'} · X`,!!close && ['林','明'].includes(item?.kind ?? '') && !splitMode);
    button('combine',`合成${combineKind(hand,item) ?? ''} · C`,!!close && !!combineKind(hand,item) && !splitMode);
    button('split','确认拆开',!!close && splitMode,!preview?.ok);
    button('cancel','取消',pos !== null || splitMode);
    el('.hway-split-sides').hidden = !splitMode;
    for (const side of ['left','right'] as const) { const b = el(`[data-hway-side=${side}]`); b.setAttribute('aria-pressed',String(splitSide === side)); b.tabIndex = splitSide === side ? 0 : -1; }
    const structure = el('[data-hway-structure]'); structure.hidden = !splitMode && !combineKind(hand,item); structure.textContent = `${item?.kind === '明' || combineKind(hand,item) === '明' ? '日 月' : '木 木'} ↔ ${item?.kind === '明' || combineKind(hand,item) === '明' ? '明' : '林'}`;
    el('[data-hway-preview-reason]').textContent = preview ? preview.ok ? '两格能放下。左右选择，Enter／Space确认，Esc取消。' : preview.message : '';
  }
  }
  return { draw };
}
