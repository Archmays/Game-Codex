import type { MountedGame } from "../../../../packages/game-core";
import { getM1Behavior } from "./content";
import { getChapterOneCharacter } from "./characters";
import { getM3Ability, getM3Hero, type M3AbilityId, type M3HeroId } from "./builds";
import type { M4RepairId } from "./camp";
import { clearM3Session, readM3Session, writeM3Session } from "./m3-session";
import { createM3GameState, currentM3Character, reduceM3State } from "./m3-machine";
import { clearM4Save, createFreshM4Save, readM4Save, syncM4SaveFromGame, updateM4Save, writeM4Save } from "./m4-save";
import { FRESH_M4_SPELLBOOK_VIEW, renderM4Camp, renderM4Parent, renderM4RepairDetail, renderM4Spellbook, spellbookPageCount, type M4OverlayKind, type M4SpellbookFilter, type M4SpellbookView } from "./m4-ui";
import type { M3Action, M3GameState, M3PathId } from "./m3-types";
import type { ChapterSlotId } from "./content-types";
import type { M1SessionStorage } from "./session";
import "./styles.css";

interface Preferences { readonly muted: boolean; readonly reducedMotion: boolean; }
export interface MountM3Options { readonly seed?: string; readonly heroId?: M3HeroId; readonly storage?: M1SessionStorage; readonly fresh?: boolean; readonly returnHref?: string; readonly onStateChange?: (state: M3GameState) => void; }
export interface MountedM3ChapterOne extends MountedGame { getState(): M3GameState; dispatch(action: M3Action): void; }

function browserStorage(): M1SessionStorage { return window.localStorage; }
function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function slotLabel(slot: ChapterSlotId): string { return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面" })[slot]; }
function structureLabel(structure: ReturnType<typeof getChapterOneCharacter>["structure"]): string { return ({ "left-right": "左右结构", "top-bottom": "上下结构", "full-enclosure": "全包围结构", "semi-enclosure": "半包围结构" })[structure]; }
function speak(text: string, preferences: Preferences): void {
  if (preferences.muted || typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = 0.88; window.speechSynthesis.speak(utterance);
}

function renderProgress(state: M3GameState): string {
  return `<ol class="hm2-progress" aria-label="三片区域进度">${state.plan.regions.map((region, index) => {
    const status = index < state.regionIndex || state.phase === "run-summary" ? "complete" : index === state.regionIndex ? "current" : "future";
    return `<li data-status="${status}"><span>${index + 1}</span><b>${region.title}</b></li>`;
  }).join("")}</ol>`;
}

function renderBuildBadges(state: M3GameState): string {
  const hero = getM3Hero(state.heroId);
  const selected = state.selectedAbilityIds.map((id) => ({ ability: getM3Ability(id), active: state.triggeredAbilityIds.includes(id) }));
  return `<div class="hm2-build-badges" data-testid="chapter-one-build-badges" data-badge-count="${selected.length + 1}" aria-label="本局字光">
    <span class="hm2-build-badge is-active" data-innate-id="${hero.innateAbilityId}" title="${escapeHtml(hero.innateDescription)}"><i data-icon-key="${hero.iconKey}"></i><b>${hero.innateName}</b></span>
    ${selected.map(({ ability, active }) => `<span class="hm2-build-badge${active ? " is-active" : ""}" data-build-ability-id="${ability.id}" data-triggered="${String(active)}" title="${escapeHtml(ability.childDescription)}"><i data-icon-key="${ability.iconKey}"></i><b>${ability.name}</b></span>`).join("")}
  </div>`;
}

function renderRouteChoice(state: M3GameState): string {
  const region = state.plan.regions[state.regionIndex];
  return `<section class="hm2-panel" data-testid="chapter-one-m3-route-choice"><p class="hm2-kicker">${region.title}</p><h2>想走哪一条路？</h2><p>两条路都能抵达；没有稀有路线，也没有限时。</p><div class="hm2-route-grid">${region.pathOptions.map((path) => `<button type="button" class="hm2-route-card" data-action="choose-route" data-path-id="${path.id}"><span class="hm2-route-art" data-visual-key="${path.visualKey}" aria-hidden="true"></span><b>${path.label}</b><span>${path.shortPromise}</span></button>`).join("")}</div></section>`;
}

function renderBehavior(state: M3GameState): string {
  if (!state.currentEncounter) return "";
  const behavior = getM1Behavior(state.currentEncounter.behaviorId);
  const character = currentM3Character(state)!;
  const effect = state.phase === "behavior-effect";
  const echo = state.abilityEffects.intentEchoCount > 0 || state.heroId === "ink-companion";
  const structure = state.abilityEffects.structureLanternCount > 0 ? `<p class="hm2-build-callout">结构灯：${structureLabel(character.structure)}</p>` : "";
  return `<section class="hm2-panel hm2-behavior" data-testid="chapter-one-m3-behavior" data-behavior-id="${behavior.id}" data-behavior-stage="${effect ? "effect" : "telegraph"}"><div class="hm2-monster-orb" aria-hidden="true"><i></i><i></i></div><p class="hm2-kicker">${state.currentEncounter.boss ? "区域首领" : "墨怪动作"} · ${effect ? "正在发生" : "先看预告"}</p><h2>${behavior.name}</h2><p>${effect ? behavior.effect : behavior.telegraph}</p><p class="hm2-recovery"><b>总能恢复：</b>${behavior.guaranteedRecovery}</p>${echo ? `<p class="hm2-build-callout">${state.heroId === "ink-companion" ? "墨点伙伴" : "预告回声"}：正确字、部件和槽位没有改变。</p>` : ""}${structure}<button class="hm2-primary" type="button" data-action="${effect ? "recover-behavior" : "begin-behavior"}">${effect ? "恢复棋盘" : "我看清了"}</button></section>`;
}

function renderBoard(state: M3GameState): string {
  const character = currentM3Character(state);
  if (!character || !state.currentEncounter) return "";
  const placedCard = (slotId: ChapterSlotId) => { const placement = state.placements.find((entry) => entry.slotId === slotId); return placement ? state.hand.find((card) => card.id === placement.cardId) ?? null : null; };
  const enclosure = character.structure === "full-enclosure" || character.structure === "semi-enclosure";
  const outerPlaced = placedCard("outer") !== null;
  const protectedCardId = state.abilityEffects.inkShieldCount > 0 ? state.hand.find((card) => card.kind === "target")?.id : undefined;
  const activeCallouts = [
    state.abilityEffects.meaningGlimpseCount > 0 && state.placements.length ? `魔法微光：${character.magicName}` : "",
    state.abilityEffects.enclosureRibbonCount > 0 ? `框内路：${character.slotIds.map(slotLabel).join(" → ")}` : "",
    state.abilityEffects.secondLookCount > 0 ? "再看一眼：棋盘没有倒计时" : "",
  ].filter(Boolean);
  return `<section class="hm2-battle" data-testid="chapter-one-m3-encounter" data-character-id="${character.id}" data-structure="${character.structure}" data-input-ready="${String(state.currentBehaviorRecovered)}"><div class="hm2-battle-copy"><p class="hm2-kicker">${state.plan.regions[state.regionIndex].title} · 第 ${state.encounterIndex + 1} 道字光</p><h2>把字灵送回真实位置</h2><p>${escapeHtml(state.gentleMessage)}</p>${state.abilityEffects.guidedSlotCount > 0 ? `<p class="hm2-build-callout">引位光只照亮真实空槽，不替你选牌。</p>` : ""}</div>
    <div class="hm2-board hm2-board--${character.structure}" role="group" aria-label="汉字结构位置">${character.slotIds.map((slotId) => { const placed = placedCard(slotId); const locked = enclosure && slotId === "inner" && !outerPlaced; const protectedPlacement = state.placements.find((entry) => entry.slotId === slotId)?.protected === true; return `<button class="hm2-slot${placed ? " is-filled" : ""}${locked ? " is-locked" : ""}${protectedPlacement ? " is-protected" : ""}" type="button" data-slot-id="${slotId}" aria-label="${slotLabel(slotId)}${locked ? "，先放外框" : placed ? `，已有${placed.glyph}` : "，空"}" ${locked ? "disabled" : ""}>${placed ? `<b>${placed.glyph}</b>` : `<span>${locked ? "先放外框" : slotLabel(slotId)}</span>`}</button>`; }).join("")}</div>
    <div class="hm2-hand" role="group" aria-label="五张字灵手牌">${state.hand.map((card) => { const used = state.placements.some((placement) => placement.cardId === card.id); const selected = state.selectedCardId === card.id; return `<button type="button" draggable="${String(!used)}" class="hm2-card${selected ? " is-selected" : ""}${protectedCardId === card.id ? " is-protected" : ""}" data-card-id="${card.id}" data-card-kind="${card.kind}" aria-pressed="${String(selected)}" ${used ? "disabled" : ""}><span>${card.glyph}</span></button>`; }).join("")}</div>
    <div class="hm2-board-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回上一步${state.abilityEffects.undoReserveCount > 0 ? " · 叶" : ""}</button><span>2 个部件 · 5 张手牌</span></div>${activeCallouts.length ? `<div class="hm2-build-status" data-testid="chapter-one-active-effects">${activeCallouts.map((text) => `<span>${text}</span>`).join("")}</div>` : ""}</section>`;
}

function renderComposition(state: M3GameState): string {
  const character = currentM3Character(state); if (!character) return "";
  return `<section class="hm2-panel hm2-composition" data-testid="chapter-one-m3-composition" data-character-id="${character.id}"><p class="hm2-kicker">部件合起来了</p><div class="hm2-formed-glyph" aria-label="完整汉字 ${character.glyph}">${character.glyph}</div><div class="hm2-equation">${character.orderedComponents.map((component) => `<span>${component.glyph}</span>`).join("<b>＋</b>")}<b>→</b><span>${character.glyph}</span></div>${state.abilityEffects.wordLanternCount > 0 ? `<p class="hm2-build-callout">词语灯：${character.familiarWord}</p>` : ""}${state.abilityEffects.wordEchoCount > 0 ? `<button type="button" class="hm2-echo-button" data-action="word-echo">重听“${character.spokenPhrase}”</button>` : ""}<button class="hm2-primary" type="button" data-action="continue">看字义魔法</button></section>`;
}

function renderMeaning(state: M3GameState): string {
  const character = currentM3Character(state); if (!character) return "";
  return `<section class="hm2-panel hm2-meaning" data-testid="chapter-one-m3-meaning" data-character-id="${character.id}"><div class="hm2-meaning-burst" aria-hidden="true"><i></i><i></i><i></i></div><p class="hm2-kicker">${character.magicName}</p><h2><span>${character.glyph}</span> ${character.pinyinWithToneMarks}</h2><p class="hm2-word">${character.familiarWord}</p><p>${character.shortMeaning}</p><p class="hm2-effect">${character.magicEffect}</p>${state.abilityEffects.repairPreviewCount > 0 ? `<p class="hm2-build-callout">营地微光：本区修复影子已经亮起。</p>` : ""}<button class="hm2-primary" type="button" data-action="continue">让字光继续</button></section>`;
}

function renderAbilityChoice(state: M3GameState): string {
  const offer = state.plan.regions[state.regionIndex].abilityOffer;
  return `<section class="hm2-panel" data-testid="chapter-one-m3-ability-choice"><p class="hm2-kicker">首领前 · 第 ${state.regionIndex + 1}/3 次选择</p><h2>带哪一道字光？</h2><p>三项都能走完整局。左右方向键可换卡，Enter 确认。</p><div class="hm2-ability-grid" role="radiogroup" aria-label="三项能力">${offer.map((id) => { const ability = getM3Ability(id); return `<button type="button" class="hm2-ability-card" data-action="choose-ability" data-ability-id="${id}"><span aria-hidden="true" data-icon-key="${ability.iconKey}"></span><b>${ability.name}</b><small>${ability.childDescription}</small></button>`; }).join("")}</div></section>`;
}

function renderRegionComplete(state: M3GameState): string {
  return `<section class="hm2-panel hm2-repair" data-testid="chapter-one-m3-region-complete"><p class="hm2-kicker">区域恢复</p><h2>${state.plan.regions[state.regionIndex].title}重新亮起来了</h2><p>英雄固有能力和本区选择都留下了真实、可见、但不代答的变化。</p><button class="hm2-primary" type="button" data-action="continue">${state.regionIndex === 2 ? "看看这次冒险" : "去下一片区域"}</button></section>`;
}

function renderSummary(state: M3GameState): string {
  return `<section class="hm2-panel hm2-summary" data-testid="chapter-one-m3-run-summary"><p class="hm2-kicker">完整短局 · 没有分数、排名或连胜</p><h2>${getM3Hero(state.heroId).name}带回了三道字光</h2><dl><div><dt>同行伙伴</dt><dd>${getM3Hero(state.heroId).name} · ${getM3Hero(state.heroId).innateName}</dd></div><div><dt>本局能力</dt><dd>${state.selectedAbilityIds.map((id) => getM3Ability(id).name).join("、")}</dd></div><div><dt>发现汉字</dt><dd>${state.discoveredCharacterIds.map((id) => getChapterOneCharacter(id).glyph).join(" ")}</dd></div><div><dt>seed</dt><dd><code>${escapeHtml(state.seed)}</code></dd></div></dl><div class="hm2-summary-actions"><button class="hm2-primary" type="button" data-action="repeat-seed">同一英雄沿 seed 重放</button><a href="?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=${encodeURIComponent(`${state.seed}-next`)}">换英雄或路线</a></div></section>`;
}

function renderPhase(state: M3GameState, progress: ReturnType<typeof createFreshM4Save>, overlay: M4OverlayKind, spellbookView: M4SpellbookView, repairId: M4RepairId | null, parentClearArmed: boolean, readOnly: boolean): string {
  if (overlay === "spellbook") return renderM4Spellbook(progress, spellbookView);
  if (overlay === "parent") return renderM4Parent(progress, parentClearArmed, readOnly);
  if (overlay === "repair" && repairId) return renderM4RepairDetail(progress, repairId);
  if (state.phase === "camp") return renderM4Camp(state, progress);
  if (state.phase === "route-choice") return renderRouteChoice(state);
  if (state.phase === "behavior-telegraph" || state.phase === "behavior-effect") return renderBehavior(state);
  if (state.phase === "encounter") return renderBoard(state);
  if (state.phase === "composition") return renderComposition(state);
  if (state.phase === "meaning") return renderMeaning(state);
  if (state.phase === "ability-choice") return renderAbilityChoice(state);
  if (state.phase === "region-complete") return renderRegionComplete(state);
  return renderSummary(state);
}

export function mountHanziMagicChapterOneM3(root: HTMLElement, options: MountM3Options = {}): MountedM3ChapterOne {
  const storage = options.storage ?? browserStorage();
  if (options.fresh) { clearM3Session(storage); const consumed = new URL(window.location.href); consumed.searchParams.delete("fresh"); window.history.replaceState(window.history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`); }
  const saveRead = readM4Save(storage);
  const writable = saveRead.writable;
  let progress = saveRead.state;
  const requestedSeed = options.seed?.trim() || "ink-forest-2";
  const requestedHero = options.heroId ?? progress.selectedHeroId;
  const restored = options.fresh ? null : readM3Session(storage);
  const canRestore = restored?.state.seed === requestedSeed;
  let state = canRestore ? restored.state : createM3GameState(requestedSeed, requestedHero);
  let actions: M3Action[] = canRestore ? restored.actions : [];
  let initialHeroId: M3HeroId = canRestore ? restored.initialHeroId : requestedHero;
  let preferences: Preferences = { muted: progress.settings.muted, reducedMotion: progress.settings.reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true };
  const initialMode = new URL(window.location.href).searchParams.get("mode");
  let overlay: M4OverlayKind = initialMode === "spellbook" ? "spellbook" : initialMode === "parent" ? "parent" : "none";
  let spellbookView: M4SpellbookView = FRESH_M4_SPELLBOOK_VIEW;
  let repairId: M4RepairId | null = null;
  let parentClearArmed = false;
  let restoreFocusSelector: string | null = null;
  let draggedCardId: string | null = null;
  let destroyed = false;
  const returnHref = options.returnHref ?? "?world=my-game-world";
  progress = syncM4SaveFromGame(progress, state);
  if (writable) writeM4Save(storage, progress);

  const persistProgress = () => { if (writable) writeM4Save(storage, progress); };
  const closeOverlay = () => {
    overlay = "none"; parentClearArmed = false; repairId = null; render();
    if (restoreFocusSelector) root.querySelector<HTMLElement>(restoreFocusSelector)?.focus({ preventScroll: true });
    restoreFocusSelector = null;
  };

  const render = () => {
    root.innerHTML = `<main class="hm2-shell hm2-m3-shell" data-testid="hanzi-magic-chapter-one-m3" data-phase="${state.phase}" data-overlay="${overlay}" data-seed="${escapeHtml(state.seed)}" data-hero-id="${state.heroId}" data-muted="${String(preferences.muted)}" data-reduced-motion="${String(preferences.reducedMotion)}" data-selected-ability-count="${state.selectedAbilityIds.length}" data-triggered-ability-count="${state.triggeredAbilityIds.length}" data-innate-trigger-count="${state.innateEvidence.triggeredCount}" data-action-count="${state.actionCount}" data-discovered-count="${progress.discoveredCharacterIds.length}" data-repair-count="${progress.repairedObjectIds.length}" data-save-source="${saveRead.source}" data-save-read-only="${String(!writable)}"><div class="hm2-world" aria-hidden="true"><div class="hm2-canopy"></div><div class="hm2-path"></div><div class="hm2-fireflies"></div></div><header class="hm2-header"><a href="${returnHref}" aria-label="返回我的游戏世界">← 营地外</a><div><span>汉字魔法战</span><h1>墨迹森林 · 第一章</h1></div><div class="hm2-settings"><button type="button" data-pref="muted" aria-pressed="${String(preferences.muted)}">${preferences.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(preferences.reducedMotion)}">${preferences.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>${saveRead.recovered || !writable ? `<div class="hm2-save-note" role="status">${!writable ? "发现较新版本存档：当前只读，不会覆盖。" : "已从本机备份安全恢复。"}</div>` : ""}<div class="hm2-ui">${renderProgress(state)}${renderBuildBadges(state)}<div class="hm2-phase" aria-live="polite">${renderPhase(state, progress, overlay, spellbookView, repairId, parentClearArmed, !writable)}</div></div><footer class="hm2-footer"><span>本地保存 · 无登录 · 无排名</span><span>V2.0.0 · 三英雄</span></footer></main>`;
    const focusSelector = overlay === "spellbook" ? "[data-spellbook-search]" : overlay === "parent" || overlay === "repair" ? "[data-action=\"close-overlay\"]" : state.phase === "ability-choice" ? "[data-ability-id]" : state.phase === "camp" ? `[data-hero-id="${state.heroId}"]` : "[data-action]";
    root.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    options.onStateChange?.(state);
  };
  const dispatch = (action: M3Action) => {
    if (destroyed) return;
    state = reduceM3State(state, action);
    if (action.type === "repeat-seed") { actions = []; initialHeroId = state.heroId; } else actions = [...actions, action];
    if (writable) writeM3Session(storage, state.seed, initialHeroId, actions);
    progress = syncM4SaveFromGame(progress, state);
    persistProgress();
    render();
  };
  const onClick = (event: Event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("button, a"); if (!target) return;
    const pref = target.dataset.pref;
    if (pref === "muted" || pref === "reduced-motion") { preferences = pref === "muted" ? { ...preferences, muted: !preferences.muted } : { ...preferences, reducedMotion: !preferences.reducedMotion }; progress = updateM4Save(progress, { settings: { ...progress.settings, ...preferences } }); persistProgress(); render(); return; }
    const action = target.dataset.action;
    if (action === "open-spellbook") { restoreFocusSelector = '[data-action="open-spellbook"]'; overlay = "spellbook"; spellbookView = FRESH_M4_SPELLBOOK_VIEW; progress = updateM4Save(progress, { minimalLocalEvents: { ...progress.minimalLocalEvents, spellbookOpens: progress.minimalLocalEvents.spellbookOpens + 1 } }); persistProgress(); render(); }
    else if (action === "open-parent") { restoreFocusSelector = '[data-action="open-parent"]'; overlay = "parent"; parentClearArmed = false; render(); }
    else if (action === "open-repair" && target.dataset.repairId) { repairId = target.dataset.repairId as M4RepairId; restoreFocusSelector = `[data-repair-id="${repairId}"]`; overlay = "repair"; progress = updateM4Save(progress, { minimalLocalEvents: { ...progress.minimalLocalEvents, repairInteractions: progress.minimalLocalEvents.repairInteractions + 1 } }); persistProgress(); render(); }
    else if (action === "close-overlay") closeOverlay();
    else if (action === "filter-spellbook" && target.dataset.filter) { spellbookView = { ...spellbookView, filter: target.dataset.filter as M4SpellbookFilter, page: 0, selectedCharacterId: null, replayKind: null }; render(); }
    else if (action === "spellbook-previous") { spellbookView = { ...spellbookView, page: Math.max(0, spellbookView.page - 1), selectedCharacterId: null, replayKind: null }; render(); }
    else if (action === "spellbook-next") { spellbookView = { ...spellbookView, page: Math.min(spellbookPageCount(spellbookView) - 1, spellbookView.page + 1), selectedCharacterId: null, replayKind: null }; render(); }
    else if (action === "select-spellbook-entry" && target.dataset.characterId) { spellbookView = { ...spellbookView, selectedCharacterId: target.dataset.characterId, replayKind: null }; render(); }
    else if ((action === "replay-pronunciation" || action === "replay-formation" || action === "replay-meaning") && target.dataset.characterId) { const character = getChapterOneCharacter(target.dataset.characterId); const replayKind = action === "replay-pronunciation" ? "pronunciation" : action === "replay-formation" ? "formation" : "meaning"; spellbookView = { ...spellbookView, selectedCharacterId: character.id, replayKind }; if (replayKind === "pronunciation") speak(character.spokenPhrase, preferences); render(); }
    else if (action === "arm-clear-progress") { parentClearArmed = true; render(); }
    else if (action === "cancel-clear-progress") { parentClearArmed = false; render(); }
    else if (action === "confirm-clear-progress" && parentClearArmed && writable) { clearM4Save(storage); clearM3Session(storage); progress = createFreshM4Save(); preferences = { muted: false, reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true }; state = createM3GameState(requestedSeed, "light-speaker"); actions = []; initialHeroId = "light-speaker"; progress = syncM4SaveFromGame(progress, state); persistProgress(); overlay = "none"; parentClearArmed = false; render(); }
    else if (action === "word-echo") { const character = currentM3Character(state); if (character) speak(character.spokenPhrase, preferences); }
    else if (action === "select-hero" && target.dataset.heroId) dispatch({ type: "select-hero", heroId: target.dataset.heroId as M3HeroId });
    else if (action === "start-run") dispatch({ type: "start-run" });
    else if (action === "choose-route" && target.dataset.pathId) dispatch({ type: "choose-route", pathId: target.dataset.pathId as M3PathId });
    else if (action === "begin-behavior") dispatch({ type: "begin-behavior" });
    else if (action === "recover-behavior") dispatch({ type: "recover-behavior" });
    else if (action === "undo") dispatch({ type: "undo" });
    else if (action === "continue") dispatch({ type: "continue" });
    else if (action === "choose-ability" && target.dataset.abilityId) dispatch({ type: "choose-ability", abilityId: target.dataset.abilityId as M3AbilityId });
    else if (action === "repeat-seed") dispatch({ type: "repeat-seed" });
    else if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    else if (target.dataset.slotId) dispatch({ type: "place-card", slotId: target.dataset.slotId as ChapterSlotId });
  };
  const onInput = (event: Event) => { const input = (event.target as HTMLElement | null)?.closest<HTMLInputElement>("[data-spellbook-search]"); if (!input) return; spellbookView = { ...spellbookView, query: input.value, page: 0, selectedCharacterId: null, replayKind: null }; render(); };
  const onDragStart = (event: DragEvent) => { const card = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]"); if (!card?.dataset.cardId) return; draggedCardId = card.dataset.cardId; event.dataTransfer?.setData("text/plain", draggedCardId); };
  const onDragOver = (event: DragEvent) => { if ((event.target as HTMLElement | null)?.closest("[data-slot-id]")) event.preventDefault(); };
  const onDrop = (event: DragEvent) => { const slot = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-slot-id]"); const cardId = event.dataTransfer?.getData("text/plain") || draggedCardId; if (!slot?.dataset.slotId || !cardId) return; event.preventDefault(); dispatch({ type: "place-card", slotId: slot.dataset.slotId as ChapterSlotId, cardId }); draggedCardId = null; };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && overlay !== "none") { closeOverlay(); event.preventDefault(); return; }
    if (overlay === "none" && (event.key === "ArrowLeft" || event.key === "ArrowRight") && (state.phase === "ability-choice" || state.phase === "camp")) {
      const selector = state.phase === "ability-choice" ? "[data-ability-id]" : "[data-hero-id]";
      const candidates = [...root.querySelectorAll<HTMLElement>(selector)]; const current = candidates.indexOf(document.activeElement as HTMLElement); if (!candidates.length) return;
      const delta = event.key === "ArrowRight" ? 1 : -1; candidates[(current + delta + candidates.length) % candidates.length].focus(); event.preventDefault();
    }
  };
  root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("dragstart", onDragStart); root.addEventListener("dragover", onDragOver); root.addEventListener("drop", onDrop); root.addEventListener("keydown", onKeyDown);
  render();
  return { getState: () => state, dispatch, destroy() { destroyed = true; root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("dragstart", onDragStart); root.removeEventListener("dragover", onDragOver); root.removeEventListener("drop", onDrop); root.removeEventListener("keydown", onKeyDown); root.replaceChildren(); } };
}
