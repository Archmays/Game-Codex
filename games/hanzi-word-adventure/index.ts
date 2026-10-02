import { createAdventurePanels } from './panels';
import { createAdventureBoardView } from './board-view';
import { createAdventureSceneBridge } from './scene-bridge';
import { createHintSearch } from './hint-search';
import { openPresentation } from '../../packages/presentation/settings';
import { MusicLoops } from '../../packages/presentation/music';
import { bindPresentationControls } from '../../packages/presentation/controls';
import { AdventureAudio } from './audio';
import '../../packages/presentation/styles.css';
import type { MountedGame } from '../../packages/game-core';
import { act, at, carried, passable, visible, describeAction, distance, neighbor, newJourney, nextRoom, perform, restart, undo, type Action } from './model';
import { CHAPTERS, ROOMS, lastInChapter, type ChapterId, type Direction } from './rooms';
import { openSave, type StorageLike } from './save';
import type { SearchResult } from './solver';
import { bindAdventureInputs } from './input-controller';
import { bindAdventureLifecycle } from './page-lifecycle';
import './styles.css';
import './v1.css';

export { hanziWordAdventureGame } from './definition';
function browserStorage(): StorageLike { try { return window.localStorage; } catch { return { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } }; } }
export function mountHanziWordAdventure(root: HTMLElement, onExit = () => window.location.assign(new URLSearchParams(location.search).get('from') === 'hub' ? '?hub=classic&from=world' : '?world=my-game-world')): MountedGame {
  const presentation=openPresentation(browserStorage(),'adventure'), visual=presentation.value;
  const audio=new AdventureAudio();audio.volume=visual.muted?0:visual.effects;
  const music=new MusicLoops('adventure',failed=>{const retry=root.querySelector<HTMLElement>('[data-presentation-retry]');if(retry)retry.hidden=!failed;});
  const save = openSave(browserStorage(), { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }, new URLSearchParams(location.search).get('chapter') === 'companions' ? 'companions' : 'homeward');
  let journey = save.journey, settings = save.settings, selected: number | null = null, facing: Direction = 'right';
  let placementMode = false, resetFromSettings = false;
  let binding: string | null = null, splitMode = false, splitSide: 'left' | 'right' = 'right', destroyed = false, busy = false, busyTimer = 0;
  let hintLevel = 0, hintResult: SearchResult | null = null, hintSearch = createHintSearch({ result: result => { hintResult = result; showHint(); }, error: () => { el('[data-hway-hint-text]').textContent = '提示暂时没打开。可以撤销一步，或继续试试。'; } });
  let menuOpen = true, menuMode: 'entry' | 'new' | 'continue' = 'entry', hasEntered = false, resetChapter: ChapterId | null = null;
  let hintOpener: HTMLElement | null = null;

  const room = () => ROOMS[journey.room];
  const panels = createAdventurePanels(root, visual);
  const { el, shell, board, grid, feedback } = panels;
  const say = (message: string) => { if (message) feedback.textContent = message; };
  function savePresentation():void { el('[data-presentation-status]').textContent=presentation.write()?'':'设置仅在本页生效，原有设置已保护。重新打开页面后可再试。'; }
  function persist() { if (!hasEntered) return;visual.lastContent=journey.chapterId;savePresentation(); save.write(journey, settings); el('[data-hway-save-status]').textContent = save.writable ? '进度和撤销只保存在本机。' : '原有记录已保护；本页仍可玩，新的动作暂不写入存档。'; }
  function cancelHint() { hintSearch.cancel(); hintResult = null; hintLevel = 0; el('[data-hway-hint-box]').hidden = true; }
  function operationTarget() { return selected !== null && distance(room(),journey.state.player,selected) === 1 ? selected : neighbor(room(),journey.state.player,facing); }
  function primaryType() { return carried(journey.state) ? 'put' : 'take'; }
  function primaryAction() {
    if (menuOpen) return;
    if (journey.state.won) { if (lastInChapter(journey.room)) openMenu(); else { journey = nextRoom(journey); freshRoom(room().arrival); } return; }
    if (splitMode) { selectedAction('split'); return; }
    selected = operationTarget(); selectedAction(primaryType());
  }
  const renderMenu = (focus = true) => panels.renderMenu(menuOpen, menuMode, save.chapters, visual.lastContent, focus);
  function openMenu() { persist(); placementMode=false; resetInput(); menuOpen = true; menuMode = 'entry'; renderMenu(); }
  function closeMenu() { menuOpen = false; renderMenu(false); grid.focus({preventScroll:true}); }
  function enterChapter(id: ChapterId, reset = false) { if (hasEntered) persist(); hasEntered = true; journey = reset ? save.reset(id,settings) : save.select(id); settings = save.settingsFor(id); const url = new URL(location.href); url.searchParams.set('chapter',id); history.replaceState(history.state,'',url); closeMenu(); freshRoom(room().arrival); grid.focus({preventScroll:true}); }
  function openModal(title: string, message: string, confirm: string) { placementMode=false; resetInput(); panels.openModal(title, message, confirm); }
  function closeModal(restoreSettings = true) { const back=resetFromSettings; resetFromSettings=false; panels.closeModal(menuOpen, back && restoreSettings); }
  function openReset(id: ChapterId, fromSettings = false) { resetFromSettings=fromSettings;resetChapter = id; openModal(`重置“${CHAPTERS.find(c=>c.id === id)!.title}”进度？`, '这一章回到第一间，撤销和本章进度将重新开始。其他章节与旧版原始存档保留。', '确认重置本章'); }
  const sceneBridge = createAdventureSceneBridge({ board, canvas: el('[data-hway-canvas]'), view: () => {
    const preview = splitMode && selected !== null ? [selected, neighbor(room(), selected, splitSide)].filter(p => p >= 0) : [];
    return { room: room(), state: journey.state, selected, target: journey.state.won ? -1 : operationTarget(), facing, binding, preview, reducedMotion: settings.reducedMotion || visual.lowPerformance };
  }, failed: () => { shell.dataset.renderFailed='true'; el('[data-hway-retry]').hidden=false; say('图像暂不可用，文字格仍可操作；可重新载入继续。'); } });
  function sceneSync(from?: number) { sceneBridge.sync(from); }
  const boardView = createAdventureBoardView(root, sceneSync);
  function draw(from?: number) { boardView.draw({ journey, settings, visual, selected, facing, splitMode, splitSide, binding, placementMode, busy, target: operationTarget() }, from); }
  function select(pos: number) {
    if (destroyed || !Number.isInteger(pos) || pos < 0 || pos >= room().tiles.length) return;
    selected = pos; splitMode = false;
    binding = room().sentences.find(s => s.cells.includes(pos) || s.targets.includes(pos))?.id ?? null;
    draw();
  }
  function unlock() { window.clearTimeout(busyTimer); busy = false; shell.dataset.busy = 'false'; }
  function run(action: Action) {
    if (destroyed || menuOpen || !el('[data-hway-modal]').hidden || settingsDialog.open) return;
    audio.unlock();
    const previous = journey.state.player, update = perform(journey, action);
    if (action.type === 'move') facing = action.direction;
    if (!update.result.ok) { say(update.result.message); if (action.type === 'move') select(neighbor(room(), previous, action.direction)); grid.focus({preventScroll:true}); return; }
    if(update.journey.state.won||action.type==='combine')music.duck();
    audio.play(update.journey.state.won?'won':action.type);
    journey = update.journey; placementMode = false; splitMode = false; selected = null; cancelHint();
    if (action.type === 'move') { facing = action.direction; selected = neighbor(room(), journey.state.player, facing); if (selected < 0) selected = null; }
    else if (action.type !== 'switch') selected = action.target;
    if (journey.state.won) selected = null;
    busy = true; window.clearTimeout(busyTimer); persist(); draw(action.type === 'switch' ? undefined : previous); say(update.result.message); grid.focus({preventScroll:true});
    busyTimer = window.setTimeout(unlock, settings.reducedMotion ? 50 : 160);
  }
  function freshRoom(message: string) { unlock(); cancelHint(); selected = null; binding = null; placementMode = false; splitMode = false; facing = 'right'; persist(); draw(); resize(); say(message); grid.focus({preventScroll:true}); }
  function selectedAction(type: string) {
    if (type === 'cancel') { cancelHint(); placementMode = false; selected = null; splitMode = false; binding = null; draw(); grid.focus({ preventScroll: true }); return; }
    selected = operationTarget();
    if (selected < 0) { say('朝向指向边界，先换一个方向。'); return; }
    if (!visible(room(),journey.state,selected)) { say('先用明照亮这里，再查看或改变字。'); return; }
    if (type === 'preview-split') { if (!['林','明'].includes(at(journey.state, selected)?.kind ?? '')) { say('目标没有可拆的林或明。'); return; } splitMode = true; splitSide = 'right'; draw(); grid.focus({ preventScroll: true }); return; }
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
    const change = result.actions.find((a): a is Exclude<Action,{type:'move'}|{type:'switch'}> => a.type !== 'move' && a.type !== 'switch');
    let changeState = journey.state;
    for (const action of result.actions) { if (action === change) break; const step = act(room(),changeState,action); if (!step.ok) break; changeState = step.state; }
    const changedGlyph = change ? (change.type === 'put' ? carried(changeState)?.kind : at(changeState, change.target)?.kind) : undefined;
    if (hintLevel === 1) text.textContent = change ? `先看看第${Math.floor(change.target / room().width) + 1}行第${change.target % room().width + 1}列附近：哪里挡路，哪里缺一个落脚处？` : '看看发光的出口，以及你脚边连着的路。';
    else if (hintLevel === 2) text.textContent = !change ? '只要路连起来，人就能走到发光的出口。' : change.type === 'split' ? (changedGlyph === '明' ? '明拆后不再发光。先离开会变暗的影格，再留出左右两格放日和月。' : '林可以变成两枚木。拆开前，它左右至少一边要有空地。') : change.type === 'combine' ? (['日','月'].includes(changedGlyph ?? '') ? '日与月合成明才会照路；明仍算手里的一件行李。' : '两枚木可以合成林；林仍算手里的一件行李。') : changedGlyph === '不' ? '把不放进短句，才会否定那一段门或风；拿走不，马上变回肯定。拿在手里不影响短句。' : ['明','日','月'].includes(changedGlyph ?? '') ? '只有明能照影路：从灯沿通格三步，山和关门挡光。放灯腾手；走远时可以收回。' : '手里只能带一个字。岸上的木挡路，水上的木搭桥，旧桥也能拿回来。';
    else { text.textContent = describeAction(room(), journey.state, first); if(first.type !== 'switch') select(first.type === 'move' ? neighbor(room(), journey.state.player, first.direction) : first.target); }
  }
  function requestHint(opener: HTMLElement = grid) {
    if (el('[data-hway-hint-box]').hidden) hintOpener = opener;
    hintLevel = Math.min(3, hintLevel + 1); showHint(); if (hintResult || hintSearch.pending) return;
    hintSearch.request(journey.room, journey.state);
  }

  const resize = () => sceneBridge.resize();
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!target || !root.contains(target)) return;
    if (event.detail > 1 && (event as PointerEvent).pointerType !== 'touch' && target.matches('[data-hway-action]')) return;
    if (target.dataset.hwayCell !== undefined) { const pos = Number(target.dataset.hwayCell); if (pos === journey.state.companion) { run({type:'switch'}); return; } if (placementMode) { if(distance(room(),journey.state.player,pos) !== 1) { say('请选择人上下左右的相邻格；这次没有走路或放字。'); grid.focus({preventScroll:true}); return; } placementMode=false; select(pos); say('落字处已选好，按主操作确认放下。'); grid.focus({preventScroll:true}); } else if (distance(room(), journey.state.player, pos) === 1 && !at(journey.state,pos) && passable(room(),journey.state,pos)) { const direction = (['up','right','down','left'] as Direction[]).find(d => neighbor(room(),journey.state.player,d) === pos)!; run({type:'move',direction}); } else select(pos); grid.focus({preventScroll:true}); }
    else if (target.dataset.hwayActor) { if (journey.state.active !== target.dataset.hwayActor) run({type:'switch'}); else grid.focus({preventScroll:true}); }
    else if (target.matches('[data-hway-primary]')) primaryAction();
    else if (target.matches('[data-hway-choose-place]')) { placementMode=!placementMode; draw(); say(placementMode ? '点人旁边一格选落字处，再按主操作放下。' : '取消选落字处，点击空路仍会走一格。'); }
    else if (target.dataset.hwayResume) enterChapter(target.dataset.hwayResume as ChapterId);
    else if (target.matches('[data-hway-new]')) { menuMode = 'new'; renderMenu(); }
    else if (target.matches('[data-hway-continue]')) { menuMode = 'continue'; renderMenu(); }
    else if (target.dataset.hwayChapter) { const id = target.dataset.hwayChapter as ChapterId; if (menuMode === 'new' && save.chapters[id]) openReset(id); else enterChapter(id, menuMode === 'new'); }
    else if (target.matches('[data-hway-saves]')) openMenu();
    else if (target.matches('[data-hway-reset]')) {settingsDialog.close();openReset(journey.chapterId,true);}
    else if (target.matches('[data-hway-menu-close]')) { if (hasEntered) closeMenu(); else onExit(); }
    else if (target.dataset.hwayMove) { facing = target.dataset.hwayMove as Direction; run({ type: 'move', direction: facing }); }
    else if (target.dataset.hwayAction) selectedAction(target.dataset.hwayAction);
    else if (target.dataset.hwaySide) { splitSide = target.dataset.hwaySide as 'left' | 'right'; draw(); el(`[data-hway-side="${splitSide}"]`).focus({ preventScroll: true }); }
    else if (target.dataset.hwayRule) { binding = binding === target.dataset.hwayRule ? null : target.dataset.hwayRule; draw(); }
    else if (target.matches('[data-hway-undo]')) { audio.unlock();audio.play('undo');journey = undo(journey); freshRoom('退回上一步，所有字都回到了原处。'); if (event.detail === 0 && !(target as HTMLButtonElement).disabled) target.focus({preventScroll:true}); }
    else if (target.matches('[data-hway-restart]')) { resetChapter = null; openModal('重新走这一间？', '本间回到入口，已经走到的房间仍保留。', '重开这一间'); }
    else if (target.matches('[data-hway-cancel-restart]')) closeModal();
    else if (target.matches('[data-hway-confirm-restart]')) { const id = resetChapter; closeModal(false); if (id) enterChapter(id, true); else { journey = restart(journey); freshRoom(room().arrival); } }
    else if (target.matches('[data-hway-exit]')) onExit();
    else if (target.matches('[data-hway-next]')) { if (lastInChapter(journey.room)) openMenu(); else { journey = nextRoom(journey); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); } }
    else if (target.matches('[data-hway-replay]') && lastInChapter(journey.room) && journey.state.won) { journey = newJourney(CHAPTERS.find(c => c.id === journey.chapterId)!.firstRoom, journey.unlocked); freshRoom(room().arrival); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (target.matches('[data-hway-hint], [data-hway-hint-more]')) requestHint(event.detail === 0 ? el('[data-hway-hint]') : grid);
    else if (target.matches('[data-hway-hint-close]')) { cancelHint(); (event.detail === 0 && hintOpener?.isConnected ? hintOpener : grid).focus({preventScroll:true}); }
    else if (target.matches('[data-hway-mute]')) {visual.muted=!visual.muted;audio.volume=visual.muted?0:visual.effects;music.configure(visual.music,visual.muted);if(visual.muted)audio.suspend();else{audio.unlock();music.unlock();}savePresentation();draw();}
    else if (target.matches('[data-hway-motion]')) { settings.reducedMotion = !settings.reducedMotion; persist(); draw(); }
  };
  const settingsDialog=el<HTMLDialogElement>('[data-hway-settings-dialog]');
  el('[data-hway-settings]').onclick=()=>settingsDialog.showModal();el('[data-hway-settings-close]').onclick=()=>settingsDialog.close();
  el('[data-hway-guide-close]').onclick=()=>{visual.guideSeen=true;savePresentation();el('[data-hway-guide]').hidden=true;grid.focus({preventScroll:true});};
  const unbindPresentation=bindPresentationControls(root,visual,()=>{savePresentation();audio.volume=visual.muted?0:visual.effects;music.configure(visual.music,visual.muted);audio.unlock();music.unlock();draw();},()=>{el('[data-hway-guide]').hidden=false;settingsDialog.close();el('[data-hway-guide-close]').focus();},()=>music.retry());
  const inputs = bindAdventureInputs({
    root, shell, grid, settingsDialog,
    state: () => ({ menuOpen, hasEntered, splitMode, placementMode, hintOpener }), click,
    trustedInput: event => { if(event.isTrusted){audio.unlock();music.configure(visual.music,visual.muted);music.unlock();} },
    closeModal, closeMenu,
    chooseSplit: (side, focus) => { splitSide = side; draw(); if (focus) el(`[data-hway-side="${splitSide}"]`).focus(); },
    cancel: () => selectedAction('cancel'),
    placement: direction => { selected = neighbor(room(),journey.state.player,direction); facing = direction; draw(); },
    move: (direction, inspect) => { if (inspect) select(neighbor(room(), selected ?? journey.state.player, direction)); else { facing = direction; run({type:'move', direction}); } },
    primary: primaryAction, hint: () => requestHint(), switchActor: () => run({type:'switch'}),
    split: () => selectedAction('split'), previewSplit: () => selectedAction('preview-split'), combine: () => selectedAction('combine'),
    undo: () => { audio.unlock();audio.play('undo');journey = undo(journey); freshRoom('退回上一步，所有字和光都回到了原处。'); }
  });
  const resetInput = () => { inputs.reset(); unlock(); };
  const lifecycle = bindAdventureLifecycle({ root, resetInput, persist, destroy,
    suspend: () => { audio.suspend(); music.suspend(); hintSearch.cancel(); sceneBridge.suspend(); },
    resume: () => { sceneBridge.resume(); if (!el('[data-hway-hint-box]').hidden && !hintResult) hintSearch.request(journey.room, journey.state); }
  });
  draw(); renderMenu(false); const linkedChapter = new URLSearchParams(location.search).get('chapter'); if (CHAPTERS.some(c => c.id === linkedChapter)) enterChapter(linkedChapter as ChapterId);
  say(save.restored ? '接着上次的路走。撤销也一起恢复了。' : room().arrival); persist();
  el('[data-hway-retry]').onclick=()=>{persist();location.reload();};
  sceneBridge.start();
  function destroy() {
    if (destroyed) return; destroyed = true;
    lifecycle.destroy(); inputs.destroy(); unlock(); hintSearch.destroy(); sceneBridge.destroy();
    unbindPresentation(); music.destroy(); audio.destroy();
  }
  return { destroy };
}
