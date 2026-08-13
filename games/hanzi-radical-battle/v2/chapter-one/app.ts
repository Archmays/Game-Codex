import type { MountedGame } from "../../../../packages/game-core";
import { getV1Character } from "../golden-slice/content/adventures";
import { getM1Ability, getM1Behavior } from "./content";
import { createM1GameState, currentM1Character, reduceM1State } from "./machine";
import { clearM1Session, readM1Session, writeM1Session, type M1SessionStorage } from "./session";
import type { M1AbilityId, M1Action, M1GameState, M1PathId, M1SlotId } from "./types";
import "./styles.css";

const PREFS_KEY = "family-games/hanzi-magic-v2/chapter-one/preferences";

export interface ChapterOnePreferences {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface MountChapterOneOptions {
  readonly seed?: string;
  readonly storage?: M1SessionStorage;
  readonly fresh?: boolean;
  readonly returnHref?: string;
  readonly onStateChange?: (state: M1GameState) => void;
}

export interface MountedChapterOne extends MountedGame {
  getState(): M1GameState;
  dispatch(action: M1Action): void;
}

type StructureSlotId = "left" | "right" | "top" | "bottom" | "outer" | "inner";

function browserStorage(): M1SessionStorage {
  return window.localStorage;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function readPreferences(storage: M1SessionStorage): ChapterOnePreferences {
  try {
    const parsed = JSON.parse(storage.getItem(PREFS_KEY) ?? "null") as Partial<ChapterOnePreferences> | null;
    return {
      muted: parsed?.muted === true,
      reducedMotion: parsed?.reducedMotion === true || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    };
  } catch {
    return { muted: false, reducedMotion: false };
  }
}

function writePreferences(storage: M1SessionStorage, preferences: ChapterOnePreferences): void {
  storage.setItem(PREFS_KEY, JSON.stringify(preferences));
}

function slotLabel(slot: StructureSlotId): string {
  return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面" })[slot];
}

function renderProgress(state: M1GameState): string {
  return `<ol class="hm2-progress" aria-label="三片区域进度">${state.plan.regions.map((region, index) => {
    const status = index < state.regionIndex || state.phase === "run-summary" ? "complete" : index === state.regionIndex ? "current" : "future";
    return `<li data-status="${status}"><span>${index + 1}</span><b>${region.title}</b></li>`;
  }).join("")}</ol>`;
}

function renderCamp(state: M1GameState): string {
  return `<section class="hm2-panel hm2-camp" data-testid="chapter-one-camp">
    <p class="hm2-kicker">第一章 · 墨迹森林</p>
    <h2>字光要从三条路回家</h2>
    <p>选路、合字、让完整汉字施展自己的魔法。每条路都能抵达，没有倒计时。</p>
    <div class="hm2-seed" aria-label="本局种子"><span>森林 seed</span><code>${escapeHtml(state.seed)}</code></div>
    <button class="hm2-primary" type="button" data-action="start-run">走进墨迹森林</button>
  </section>`;
}

function renderRouteChoice(state: M1GameState): string {
  const region = state.plan.regions[state.regionIndex];
  return `<section class="hm2-panel" data-testid="chapter-one-route-choice">
    <p class="hm2-kicker">${region.title}</p><h2>想走哪一条路？</h2><p>两条路都能抵达，也都能安全重放。</p>
    <div class="hm2-route-grid">${region.pathOptions.map((path) => `<button type="button" class="hm2-route-card" data-action="choose-route" data-path-id="${path.id}">
      <span class="hm2-route-art" data-visual-key="${path.visualKey}" aria-hidden="true"></span><b>${path.label}</b><span>${path.shortPromise}</span>
    </button>`).join("")}</div>
  </section>`;
}

function renderBehavior(state: M1GameState): string {
  if (!state.currentEncounter) return "";
  const behavior = getM1Behavior(state.currentEncounter.behaviorId);
  const effect = state.phase === "behavior-effect";
  return `<section class="hm2-panel hm2-behavior" data-testid="chapter-one-behavior" data-behavior-id="${behavior.id}" data-behavior-stage="${effect ? "effect" : "telegraph"}">
    <div class="hm2-monster-orb" aria-hidden="true"><i></i><i></i></div>
    <p class="hm2-kicker">墨怪动作 · ${effect ? "正在发生" : "先看预告"}</p><h2>${behavior.name}</h2>
    <p>${effect ? behavior.effect : behavior.telegraph}</p>
    <p class="hm2-recovery"><b>总能恢复：</b>${behavior.guaranteedRecovery}</p>
    <button class="hm2-primary" type="button" data-action="${effect ? "recover-behavior" : "begin-behavior"}">${effect ? "恢复棋盘" : "我看清了"}</button>
  </section>`;
}

function renderBoard(state: M1GameState): string {
  const character = currentM1Character(state);
  if (!character || !state.currentEncounter) return "";
  const targetCards = state.hand.filter((card) => card.kind === "target");
  const slots = character.components.map((component) => component.slotId as StructureSlotId);
  const placedCard = (slotId: string) => {
    const placement = state.placements.find((entry) => entry.slotId === slotId);
    return placement ? state.hand.find((card) => card.id === placement.cardId) ?? null : null;
  };
  const orderedEnclosure = character.structure === "full-enclosure" || character.structure === "semi-enclosure";
  const outerPlaced = placedCard("outer") !== null;
  return `<section class="hm2-battle" data-testid="chapter-one-encounter" data-character-id="${character.id}" data-structure="${character.structure}" data-input-ready="${String(state.currentBehaviorRecovered)}">
    <div class="hm2-battle-copy"><p class="hm2-kicker">${state.plan.regions[state.regionIndex].title} · 第 ${state.encounterIndex + 1} 道字光</p><h2>把字灵送回真实位置</h2><p>${escapeHtml(state.gentleMessage)}</p></div>
    <div class="hm2-board hm2-board--${character.structure}" role="group" aria-label="汉字结构位置">${slots.map((slotId) => {
      const placed = placedCard(slotId);
      const locked = orderedEnclosure && slotId === "inner" && !outerPlaced;
      return `<button class="hm2-slot${placed ? " is-filled" : ""}${locked ? " is-locked" : ""}" type="button" data-slot-id="${slotId}" aria-label="${slotLabel(slotId)}${locked ? "，先放外框" : placed ? `，已有${placed.glyph}` : "，空"}" ${locked ? "disabled" : ""}>${placed ? `<b>${placed.glyph}</b>` : `<span>${locked ? "先放外框" : slotLabel(slotId)}</span>`}</button>`;
    }).join("")}</div>
    <div class="hm2-hand" role="group" aria-label="五张字灵手牌">${state.hand.map((card) => {
      const used = state.placements.some((placement) => placement.cardId === card.id);
      const selected = state.selectedCardId === card.id;
      return `<button type="button" draggable="${String(!used)}" class="hm2-card${selected ? " is-selected" : ""}" data-card-id="${card.id}" data-card-kind="${card.kind}" aria-pressed="${String(selected)}" ${used ? "disabled" : ""}><span>${card.glyph}</span></button>`;
    }).join("")}</div>
    <div class="hm2-board-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回上一步</button><span>${targetCards.length} 个部件 · 5 张手牌</span></div>
  </section>`;
}

function renderComposition(state: M1GameState): string {
  const character = currentM1Character(state);
  if (!character) return "";
  return `<section class="hm2-panel hm2-composition" data-testid="chapter-one-composition" data-character-id="${character.id}">
    <p class="hm2-kicker">部件合起来了</p><div class="hm2-formed-glyph" aria-label="完整汉字 ${character.glyph}">${character.glyph}</div>
    <div class="hm2-equation">${character.components.map((component) => `<span>${component.glyph}</span>`).join("<b>＋</b>")}<b>→</b><span>${character.glyph}</span></div>
    <button class="hm2-primary" type="button" data-action="continue">看字义魔法</button>
  </section>`;
}

function renderMeaning(state: M1GameState): string {
  const character = currentM1Character(state);
  if (!character) return "";
  return `<section class="hm2-panel hm2-meaning" data-testid="chapter-one-meaning" data-character-id="${character.id}">
    <div class="hm2-meaning-burst" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="hm2-kicker">${character.magic.name}</p><h2><span>${character.glyph}</span> ${character.pinyin}</h2><p class="hm2-word">${character.familiarWord}</p><p>${character.shortMeaning}</p>
    <p class="hm2-effect">${character.magic.effect}</p><button class="hm2-primary" type="button" data-action="continue">让字光继续</button>
  </section>`;
}

function renderAbilityChoice(state: M1GameState): string {
  const offer = state.plan.regions[state.regionIndex].abilityOffer;
  return `<section class="hm2-panel" data-testid="chapter-one-ability-choice"><p class="hm2-kicker">首领前 · 三选一</p><h2>带哪一道字光？</h2><p>三项都能继续，也都不会替你完成汉字。</p><div class="hm2-ability-grid">${offer.map((id) => {
    const ability = getM1Ability(id);
    return `<button type="button" class="hm2-ability-card" data-action="choose-ability" data-ability-id="${id}"><span aria-hidden="true" data-ability-mark="${id}"></span><b>${ability.name}</b><em>${ability.shortLabel}</em><small>${ability.childFacingEffect}</small></button>`;
  }).join("")}</div></section>`;
}

function renderRegionComplete(state: M1GameState): string {
  const region = state.plan.regions[state.regionIndex];
  const ability = getM1Ability(state.selectedAbilityIds.at(-1)!);
  return `<section class="hm2-panel hm2-repair" data-testid="chapter-one-region-complete"><p class="hm2-kicker">区域恢复</p><h2>${region.title}重新亮起来了</h2><p>${ability.name}也在首领战留下了真正可见的变化。</p><button class="hm2-primary" type="button" data-action="continue">${state.regionIndex === 2 ? "看看这次冒险" : "去下一片区域"}</button></section>`;
}

function renderSummary(state: M1GameState): string {
  return `<section class="hm2-panel hm2-summary" data-testid="chapter-one-run-summary"><p class="hm2-kicker">短局完成 · 没有分数和排名</p><h2>三片区域都亮了</h2>
    <dl><div><dt>走过的路</dt><dd>${state.chosenPathIds.map((id) => state.plan.regions.flatMap((region) => region.pathOptions).find((path) => path.id === id)?.label).join("、")}</dd></div><div><dt>带回的字光</dt><dd>${state.discoveredCharacterIds.map((id) => getV1Character(id).glyph).join(" ")}</dd></div><div><dt>本局能力</dt><dd>${state.selectedAbilityIds.map((id) => getM1Ability(id).name).join("、")}</dd></div><div><dt>seed</dt><dd><code>${escapeHtml(state.seed)}</code></dd></div></dl>
    <div class="hm2-summary-actions"><button class="hm2-primary" type="button" data-action="repeat-seed">沿同一 seed 重放</button><a href="?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=${encodeURIComponent(`${state.seed}-next`)}">换一片森林</a></div>
  </section>`;
}

function renderPhase(state: M1GameState): string {
  switch (state.phase) {
    case "camp": return renderCamp(state);
    case "route-choice": return renderRouteChoice(state);
    case "behavior-telegraph":
    case "behavior-effect": return renderBehavior(state);
    case "encounter": return renderBoard(state);
    case "composition": return renderComposition(state);
    case "meaning": return renderMeaning(state);
    case "ability-choice": return renderAbilityChoice(state);
    case "region-complete": return renderRegionComplete(state);
    case "run-summary": return renderSummary(state);
  }
}

export function mountHanziMagicChapterOne(root: HTMLElement, options: MountChapterOneOptions = {}): MountedChapterOne {
  const storage = options.storage ?? browserStorage();
  if (options.fresh) {
    clearM1Session(storage);
    const consumed = new URL(window.location.href);
    consumed.searchParams.delete("fresh");
    window.history.replaceState(window.history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`);
  }
  const requestedSeed = options.seed?.trim() || "ink-forest-1";
  const restored = options.fresh ? null : readM1Session(storage);
  let state = restored?.state.seed === requestedSeed ? restored.state : createM1GameState(requestedSeed);
  let actions = restored?.state.seed === requestedSeed ? restored.actions : [];
  let preferences = readPreferences(storage);
  let draggedCardId: string | null = null;
  let destroyed = false;
  const returnHref = options.returnHref ?? "?world=my-game-world";

  const render = (): void => {
    root.innerHTML = `<main class="hm2-shell" data-testid="hanzi-magic-chapter-one" data-phase="${state.phase}" data-seed="${escapeHtml(state.seed)}" data-muted="${String(preferences.muted)}" data-reduced-motion="${String(preferences.reducedMotion)}" data-action-count="${state.actionCount}" data-first-entry-actions="${state.actionsToFirstEncounter ?? "pending"}">
      <div class="hm2-world" aria-hidden="true"><div class="hm2-canopy"></div><div class="hm2-path"></div><div class="hm2-fireflies"></div></div>
      <header class="hm2-header"><a href="${returnHref}" aria-label="返回我的游戏世界">← 营地外</a><div><span>汉字魔法战</span><h1>墨迹森林</h1></div><div class="hm2-settings"><button type="button" data-pref="muted" aria-pressed="${String(preferences.muted)}">${preferences.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(preferences.reducedMotion)}">${preferences.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>
      <div class="hm2-ui">${renderProgress(state)}<div class="hm2-phase" aria-live="polite">${renderPhase(state)}</div></div>
      <footer class="hm2-footer"><span>本地保存 · 无登录 · 无排名</span><span>V2.0.0 M1</span></footer>
    </main>`;
    root.querySelector<HTMLElement>("[data-action]")?.focus({ preventScroll: true });
    options.onStateChange?.(state);
  };

  const dispatch = (action: M1Action): void => {
    if (destroyed) return;
    state = reduceM1State(state, action);
    actions = action.type === "repeat-seed" ? [] : [...actions, action];
    writeM1Session(storage, state.seed, actions);
    render();
  };

  const onClick = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("button, a");
    if (!target) return;
    const pref = target.dataset.pref;
    if (pref === "muted" || pref === "reduced-motion") {
      preferences = pref === "muted"
        ? { ...preferences, muted: !preferences.muted }
        : { ...preferences, reducedMotion: !preferences.reducedMotion };
      writePreferences(storage, preferences);
      render();
      return;
    }
    const action = target.dataset.action;
    if (action === "start-run") dispatch({ type: "start-run" });
    else if (action === "choose-route" && target.dataset.pathId) dispatch({ type: "choose-route", pathId: target.dataset.pathId as M1PathId });
    else if (action === "begin-behavior") dispatch({ type: "begin-behavior" });
    else if (action === "recover-behavior") dispatch({ type: "recover-behavior" });
    else if (action === "undo") dispatch({ type: "undo" });
    else if (action === "continue") dispatch({ type: "continue" });
    else if (action === "choose-ability" && target.dataset.abilityId) dispatch({ type: "choose-ability", abilityId: target.dataset.abilityId as M1AbilityId });
    else if (action === "repeat-seed") dispatch({ type: "repeat-seed" });
    else if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    else if (target.dataset.slotId) dispatch({ type: "place-card", slotId: target.dataset.slotId as M1SlotId });
  };

  const onDragStart = (event: DragEvent): void => {
    const card = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    if (!card?.dataset.cardId) return;
    draggedCardId = card.dataset.cardId;
    event.dataTransfer?.setData("text/plain", draggedCardId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (event: DragEvent): void => {
    if ((event.target as HTMLElement | null)?.closest("[data-slot-id]")) event.preventDefault();
  };
  const onDrop = (event: DragEvent): void => {
    const slot = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-slot-id]");
    const cardId = event.dataTransfer?.getData("text/plain") || draggedCardId;
    if (!slot?.dataset.slotId || !cardId) return;
    event.preventDefault();
    dispatch({ type: "place-card", slotId: slot.dataset.slotId as M1SlotId, cardId });
    draggedCardId = null;
  };

  root.addEventListener("click", onClick);
  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", onDrop);
  render();
  return {
    getState: () => state,
    dispatch,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener("click", onClick);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      root.replaceChildren();
    },
  };
}
