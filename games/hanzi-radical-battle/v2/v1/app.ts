import "./styles.css";
import {
  HANZI_MAGIC_V1_ADVENTURES,
  HANZI_MAGIC_V1_CHARACTERS,
  HANZI_MAGIC_V1_CONTENT_REVISION,
  HANZI_MAGIC_V1_GAME_VERSION,
  getV1Adventure,
  getV1Character,
  getV1Encounter,
  type V1AdventureId,
  type V1SlotId,
} from "../golden-slice/content/adventures";
import type { AbilityId, GoldenCharacterId } from "../golden-slice/content/types";
import { AudioDirector, DEFAULT_AUDIO_SETTINGS } from "../golden-slice/phaser/AudioDirector";
import { v1AssetUrl, v1MeaningAssetUrl } from "./assets";
import { createV1GameState, stepV1Game, type V1Action, type V1GameState } from "./machine";
import { createHanziMagicV1World, type V1WorldHandle, type V1WorldViewModel } from "./phaser";
import {
  clearV1Save,
  progressFromV1Save,
  readV1Save,
  saveFromGameState,
  updateV1Settings,
  writeV1Save,
  type V1InputMode,
  type V1SaveState,
} from "./save";
import type { GoldenSliceStorageLike } from "../golden-slice/save";

export interface HanziMagicV1Options {
  readonly storage?: GoldenSliceStorageLike;
  readonly seed?: string;
  readonly returnHref?: string;
  readonly onStateChange?: (state: V1GameState) => void;
}

export interface HanziMagicV1Handle {
  getState(): V1GameState;
  setMuted(muted: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  resetLocalProgress(): void;
  destroy(): void;
}

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "local-source";
const SLOT_LABELS: Readonly<Record<V1SlotId, string>> = {
  left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));
}

function browserStorage(): GoldenSliceStorageLike { return window.localStorage; }

function abilityCopy(id: AbilityId): { short: string; description: string; asset: "A7" | "A8" | "A9" } {
  if (id === "guardian-light") return { short: "守护光", description: "护住已找到位置的字光。", asset: "A7" };
  if (id === "star-path") return { short: "星路", description: "首领出现时亮出下一个方向。", asset: "A8" };
  return { short: "墨回声", description: "提前送开一次墨雾，还能重听读音。", asset: "A9" };
}

function worldView(state: V1GameState, reducedMotion: boolean): V1WorldViewModel {
  const encounter = state.currentEncounterId ? getV1Encounter(state.currentEncounterId) : null;
  return {
    phase: state.phase,
    characterId: encounter?.characterId ?? null,
    encounterKind: encounter?.kind ?? null,
    campRepairStage: state.campRepairStage,
    selectedAbilityId: state.selectedAbilityId,
    interferenceActive: state.bossInterferenceActive,
    reducedMotion,
  };
}

function renderProgress(state: V1GameState): string {
  return `<ol class="hmv1-progress" aria-label="三段冒险进度">${HANZI_MAGIC_V1_ADVENTURES.map((adventure) => {
    const complete = state.completedAdventureIds.includes(adventure.id);
    const unlocked = state.unlockedAdventureIds.includes(adventure.id);
    return `<li data-status="${complete ? "complete" : unlocked ? "open" : "locked"}"><span>${adventure.sequence}</span><small>${escapeHtml(adventure.shortTitle)}</small></li>`;
  }).join("")}</ol>`;
}

function renderCamp(state: V1GameState, recovered: boolean): string {
  const next = HANZI_MAGIC_V1_ADVENTURES.find((adventure) => state.unlockedAdventureIds.includes(adventure.id) && !state.completedAdventureIds.includes(adventure.id));
  const cards = HANZI_MAGIC_V1_ADVENTURES.map((adventure) => {
    const complete = state.completedAdventureIds.includes(adventure.id);
    const unlocked = state.unlockedAdventureIds.includes(adventure.id);
    const replay = complete && state.freeAdventureUnlocked;
    return `<article class="hmv1-adventure-card" data-status="${complete ? "complete" : unlocked ? "open" : "locked"}">
      <span class="hmv1-adventure-number">${adventure.sequence}</span><h3>${escapeHtml(adventure.title)}</h3>
      <p>${complete ? "字光已经留在营地" : unlocked ? escapeHtml(adventure.purpose) : "前一道字光会把这里照亮"}</p>
      ${unlocked || replay ? `<button type="button" data-action="start-adventure" data-adventure="${adventure.id}" data-replay="${String(replay)}">${replay ? "再走一次" : escapeHtml(adventure.entryAction)}</button>` : `<span class="hmv1-locked" aria-label="尚未解锁">静静等候</span>`}
    </article>`;
  }).join("");
  return `<section class="hmv1-camp-panel" data-testid="v1-camp" data-repair-stage="${state.campRepairStage}">
    <div class="hmv1-camp-copy"><span class="hmv1-kicker">墨迹森林</span><h2>${state.completedV1 ? "十二道字光都回来了" : "营地正在等你"}</h2><p>${escapeHtml(state.gentleMessage)}</p>${recovered ? `<p class="hmv1-calm-note" role="status">营地打开了一页安全的存档，可以继续冒险。</p>` : ""}</div>
    ${renderProgress(state)}
    ${next ? `<button class="hmv1-primary hmv1-primary--large" type="button" data-action="start-adventure" data-adventure="${next.id}" data-replay="false">${escapeHtml(next.entryAction)}</button>` : ""}
    <div class="hmv1-adventure-grid">${cards}</div>
    ${state.discoveredCharacterIds.length ? `<button class="hmv1-book-button" type="button" data-action="open-spellbook"><img src="${v1AssetUrl("A15")}" alt="">打开魔法书 · ${state.discoveredCharacterIds.length}/12</button>` : ""}
  </section>`;
}

function renderAdventureIntro(state: V1GameState): string {
  const adventure = getV1Adventure(state.currentAdventureId!);
  const needsAbility = state.encounterIndex === 1 && state.selectedAbilityId === null;
  if (needsAbility) {
    return `<section class="hmv1-dialog-panel hmv1-ability-panel" data-testid="v1-ability-choice"><span class="hmv1-kicker">${escapeHtml(adventure.title)}</span><h2>带哪道魔法？</h2><p>三道都能走完全程，选你想带的一道。</p><div class="hmv1-ability-grid">${adventure.abilityIds.map((abilityId) => {
      const copy = abilityCopy(abilityId);
      return `<button type="button" data-action="choose-ability" data-ability="${abilityId}"><img src="${v1AssetUrl(copy.asset)}" alt=""><strong>${copy.short}</strong><span>${copy.description}</span></button>`;
    }).join("")}</div></section>`;
  }
  return `<section class="hmv1-dialog-panel hmv1-intro-panel" data-testid="v1-adventure-intro"><span class="hmv1-kicker">第 ${adventure.sequence} 段冒险</span><h2>${escapeHtml(adventure.title)}</h2><p>${escapeHtml(adventure.purpose)}</p><div class="hmv1-char-preview" aria-label="这段路上的四道字光">${adventure.characterIds.map((id) => `<span>${getV1Character(id).glyph}</span>`).join("")}</div><button class="hmv1-primary" type="button" data-action="begin-adventure">${escapeHtml(adventure.entryAction)}</button></section>`;
}

function hintedSlot(state: V1GameState): V1SlotId | null {
  if (!state.currentEncounterId) return null;
  if (state.abilityEffect?.safePathSlotId) return state.abilityEffect.safePathSlotId;
  if (state.hintLevel < 2) return null;
  const encounter = getV1Encounter(state.currentEncounterId);
  const selected = encounter.cards.find((card) => card.id === state.selectedCardId && card.kind === "target");
  if (selected?.expectedSlotId) return selected.expectedSlotId;
  return getV1Character(encounter.characterId).components.find((component) => !state.placements.some((placement) => placement.slotId === component.slotId))?.slotId ?? null;
}

function renderBoard(state: V1GameState): string {
  const encounter = getV1Encounter(state.currentEncounterId!);
  const character = getV1Character(encounter.characterId);
  const hint = hintedSlot(state);
  const slot = (slotId: V1SlotId) => {
    const placement = state.placements.find((entry) => entry.slotId === slotId);
    const card = placement ? encounter.cards.find((entry) => entry.id === placement.cardId) : null;
    return `<button class="hmv1-slot" type="button" data-slot="${slotId}" data-hint="${String(hint === slotId)}" aria-label="${character.glyph}的${SLOT_LABELS[slotId]}位置">${card ? `<span>${card.glyph}</span>` : `<small>${SLOT_LABELS[slotId]}</small>`}</button>`;
  };
  const placementGlyph = (slotId: V1SlotId) => {
    const placement = state.placements.find((entry) => entry.slotId === slotId);
    return placement ? encounter.cards.find((entry) => entry.id === placement.cardId)?.glyph ?? "" : "";
  };
  const isEnclosure = character.structure === "full-enclosure" || character.structure === "semi-enclosure";
  const slots = character.structure === "left-right" ? slot("left") + slot("right")
    : character.structure === "top-bottom" ? slot("top") + slot("bottom")
      : `<div class="hmv1-enclosure-preview" aria-hidden="true"><span class="hmv1-enclosure-outer" data-empty="${String(!placementGlyph("outer"))}">${placementGlyph("outer")}</span><span class="hmv1-enclosure-inner" data-empty="${String(!placementGlyph("inner"))}">${placementGlyph("inner")}</span></div><div class="hmv1-enclosure-controls">${slot("outer")}${slot("inner")}</div>`;
  const cards = state.handCardIds.map((cardId) => encounter.cards.find((card) => card.id === cardId)!).map((card) => {
    const used = state.placements.some((placement) => placement.cardId === card.id);
    return `<button class="hmv1-card" type="button" draggable="${String(!used)}" data-card="${card.id}" aria-pressed="${String(state.selectedCardId === card.id)}" ${used ? "disabled" : ""} aria-label="字光 ${card.glyph}"><span>${card.glyph}</span></button>`;
  }).join("");
  return `<section class="hmv1-battle-panel" data-testid="v1-encounter" data-encounter="${encounter.id}" data-structure="${character.structure}">
    <header><span class="hmv1-kicker">${encounter.kind === "boss-phase" ? `首领墨雾 · ${encounter.sequence - 2}/2` : `字光相遇 · ${encounter.sequence}/4`}</span><h2>${escapeHtml(encounter.prompt)}</h2><p>${escapeHtml(state.gentleMessage)}</p></header>
    <div class="hmv1-board hmv1-board--${character.structure}" role="group" aria-label="${character.glyph}的${character.structure === "full-enclosure" ? "外框和里面" : character.structure === "semi-enclosure" ? "有开口的外框和里面" : "结构"}" data-enclosure="${String(isEnclosure)}">${slots}</div>
    <div class="hmv1-hand" role="group" aria-label="五张字光卡">${cards}</div>
    <div class="hmv1-battle-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回</button><button type="button" data-action="hint">看亮光</button><button type="button" data-action="return-camp">回营地</button></div>
  </section>`;
}

function renderComposition(state: V1GameState): string {
  const character = getV1Character(getV1Encounter(state.currentEncounterId!).characterId);
  return `<section class="hmv1-composition-panel" data-testid="v1-composition" data-structure="${character.structure}"><span class="hmv1-kicker">部件合起来了</span><div class="hmv1-formed-glyph" aria-label="完整汉字 ${character.glyph}">${character.glyph}</div><div class="hmv1-part-trail">${character.components.map((part) => `<span>${part.glyph}</span>`).join("<b>＋</b>")}<b>→</b><span>${character.glyph}</span></div><button class="hmv1-primary" type="button" data-action="continue">看魔法</button></section>`;
}

function renderMeaning(state: V1GameState): string {
  const character = getV1Character(getV1Encounter(state.currentEncounterId!).characterId);
  return `<section class="hmv1-meaning-panel" data-testid="v1-meaning" data-character="${character.id}"><img src="${v1MeaningAssetUrl(character.id)}" alt="${escapeHtml(character.magic.name)}的意义魔法"><div class="hmv1-meaning-copy"><span class="hmv1-meaning-glyph">${character.glyph}</span><div><span class="hmv1-pinyin">${character.pinyin}</span><h2>${escapeHtml(character.familiarWord)}</h2><p>${escapeHtml(character.shortMeaning)}</p><strong>${escapeHtml(character.magic.name)}</strong><small>${escapeHtml(character.magic.effect)}</small></div></div><p class="hmv1-association-note">这是字义联想魔法，不是字源说明。</p><div class="hmv1-meaning-actions"><button type="button" data-action="speak" data-character="${character.id}">读给我听</button><button class="hmv1-primary" type="button" data-action="continue">继续前进</button></div></section>`;
}

function renderInterference(state: V1GameState): string {
  const ink = state.selectedAbilityId === "ink-echo";
  return `<section class="hmv1-interference" role="dialog" aria-modal="true" aria-labelledby="hmv1-mist-title" data-testid="v1-boss-interference"><span class="hmv1-kicker">首领墨雾</span><h2 id="hmv1-mist-title">已经放好的字光还在</h2><p>${escapeHtml(state.gentleMessage)}</p><button class="hmv1-primary" type="button" data-action="clear-interference">${ink ? "用墨回声" : "拨开墨雾"}</button></section>`;
}

function renderRepair(state: V1GameState): string {
  const adventure = getV1Adventure(state.currentAdventureId!);
  return `<section class="hmv1-dialog-panel hmv1-repair-panel" data-testid="v1-repair"><span class="hmv1-kicker">永久修复 · ${adventure.repair.stage}/3</span><h2>${escapeHtml(adventure.repair.title)}</h2><p>${escapeHtml(adventure.repair.description)}</p><div class="hmv1-repair-symbol" data-stage="${adventure.repair.stage}" aria-hidden="true"></div><button class="hmv1-primary" type="button" data-action="repair-world">修好营地</button></section>`;
}

function renderChapterReport(state: V1GameState): string {
  const report = state.chapterReports.at(-1)!;
  const adventure = getV1Adventure(report.adventureId);
  const ability = abilityCopy(report.selectedAbilityId);
  return `<section class="hmv1-dialog-panel hmv1-report-panel" data-testid="v1-chapter-report" data-ability="${report.selectedAbilityId}" data-effect-triggered="${String(report.abilityEffectTriggered)}" data-effect-visible="${String(report.abilityEffectVisible)}" data-effect-state-verified="${String(report.abilityEffectStateVerified)}"><span class="hmv1-kicker">${escapeHtml(adventure.title)}完成</span><h2>${escapeHtml(adventure.repair.title)}</h2><p>${ability.short}在首领墨雾里留下了清楚的变化。</p><div class="hmv1-report-glyphs">${report.completedCharacterIds.map((id) => `<span>${getV1Character(id).glyph}</span>`).join("")}</div><button class="hmv1-primary" type="button" data-action="continue-from-report">${state.completedV1 && !state.replay ? "看看结尾" : "回到营地"}</button></section>`;
}

function renderEnding(state: V1GameState): string {
  return `<section class="hmv1-dialog-panel hmv1-ending-panel" data-testid="v1-ending" data-book-seen="${String(state.endingBookSeen)}"><span class="hmv1-kicker">墨迹森林 · V1 完整结尾</span><h2>十二道字光照亮了回家的路</h2><p>灯、花园和世界门都修好了。先把十二道字光收进魔法书，再自由选择三条冒险路。</p><div class="hmv1-ending-glyphs">${HANZI_MAGIC_V1_CHARACTERS.map((character) => `<span>${character.glyph}</span>`).join("")}</div>${state.endingBookSeen ? `<div class="hmv1-ending-actions"><button type="button" data-action="open-spellbook">再看魔法书</button><button class="hmv1-primary" type="button" data-action="finish-ending">自由冒险</button></div>` : `<button class="hmv1-primary" type="button" data-action="open-spellbook">翻开十二字魔法书</button>`}</section>`;
}

function renderSpellbook(state: V1GameState, selectedId: GoldenCharacterId | null): string {
  const ids = state.discoveredCharacterIds;
  const activeId = selectedId && ids.includes(selectedId) ? selectedId : ids[0];
  if (!activeId) return `<section class="hmv1-spellbook" role="dialog" aria-modal="true"><h2>魔法书还在等第一道字光</h2><button type="button" data-action="close-spellbook">合上</button></section>`;
  const character = getV1Character(activeId);
  return `<section class="hmv1-spellbook" role="dialog" aria-modal="true" aria-labelledby="hmv1-book-title" data-testid="v1-spellbook"><div class="hmv1-spellbook-art" aria-hidden="true"><img src="${v1AssetUrl("A14")}" alt=""></div><header><span>${ids.length}/12 道字光</span><h2 id="hmv1-book-title">十二字魔法书</h2><button type="button" data-action="close-spellbook" aria-label="合上魔法书">合上</button></header><nav aria-label="已经发现的字">${ids.map((id) => `<button type="button" data-book-character="${id}" aria-current="${String(id === activeId)}">${getV1Character(id).glyph}</button>`).join("")}</nav><article><span class="hmv1-book-glyph">${character.glyph}</span><div><span>${character.pinyin}</span><h3>${escapeHtml(character.familiarWord)}</h3><p>${escapeHtml(character.shortMeaning)}</p><dl><dt>结构</dt><dd>${character.components.map((part) => part.glyph).join(" + ")}</dd><dt>意义魔法</dt><dd>${escapeHtml(character.magic.effect)}</dd></dl><button type="button" data-action="speak" data-character="${character.id}">读给我听</button></div></article></section>`;
}

function renderParentPanel(save: V1SaveState, futureProtected: boolean, clearConfirm: boolean): string {
  return `<section class="hmv1-parent-panel" role="dialog" aria-modal="true" aria-labelledby="hmv1-parent-title" data-testid="v1-parent-panel"><header><span class="hmv1-kicker">家长区</span><h2 id="hmv1-parent-title">声音、画面与本机存档</h2><button type="button" data-parent-action="close" aria-label="关闭家长区">关闭</button></header>
    <div class="hmv1-parent-grid"><section><h3>游戏设置</h3><label><input type="checkbox" data-setting="muted" ${save.settings.muted ? "checked" : ""}> 静音</label><label><input type="checkbox" data-setting="reducedMotion" ${save.settings.reducedMotion ? "checked" : ""}> 减少动画</label><label>输入方式<select data-setting="inputMode"><option value="auto" ${save.settings.inputMode === "auto" ? "selected" : ""}>自动</option><option value="mouse" ${save.settings.inputMode === "mouse" ? "selected" : ""}>鼠标</option><option value="touch" ${save.settings.inputMode === "touch" ? "selected" : ""}>触控</option><option value="keyboard" ${save.settings.inputMode === "keyboard" ? "selected" : ""}>键盘</option></select></label></section>
    <section><h3>本机与隐私</h3><p>进度只保存在这台设备的当前浏览器中。游戏不上传姓名、语音、照片、自由文本或使用记录，也不含商业推广、账号或跨设备追踪。</p>${futureProtected ? `<p class="hmv1-warning" role="alert">发现更新版本的存档；当前版本只读保护它，不会覆盖。</p>` : ""}</section>
    <section><h3>版本信息</h3><dl><dt>游戏版本</dt><dd>${HANZI_MAGIC_V1_GAME_VERSION}</dd><dt>内容版本</dt><dd>${HANZI_MAGIC_V1_CONTENT_REVISION}</dd><dt>Build</dt><dd>${escapeHtml(BUILD_ID)}</dd><dt>固定字表</dt><dd>${HANZI_MAGIC_V1_CHARACTERS.map((entry) => entry.glyph).join("、")}</dd></dl></section>
    <section><h3>清除本机进度</h3><p>会清除三章进度、魔法书和设置，不影响其他游戏。</p><button class="hmv1-danger" type="button" data-parent-action="clear">${clearConfirm ? "再按一次清除" : "清除存档"}</button>${clearConfirm ? `<button type="button" data-parent-action="cancel-clear">先不清除</button>` : ""}</section></div></section>`;
}

export function mountHanziMagicV1(root: HTMLElement, options: HanziMagicV1Options = {}): HanziMagicV1Handle {
  const storage = options.storage ?? browserStorage();
  const read = readV1Save(storage);
  let save = read.state;
  let state = createV1GameState(options.seed ?? "hanzi-magic-v1", progressFromV1Save(save));
  let world: V1WorldHandle | null = null;
  let parentOpen = false;
  let clearConfirm = false;
  let selectedBookId: GoldenCharacterId | null = state.discoveredCharacterIds[0] ?? null;
  let destroyed = false;
  let idleTimer: number | null = null;
  const systemReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const audio = new AudioDirector({ ...DEFAULT_AUDIO_SETTINGS, muted: save.settings.muted });
  const returnHref = options.returnHref ?? "?world=my-game-world";

  document.documentElement.classList.add("hanzi-magic-v1-page");
  document.body.classList.add("hanzi-magic-v1-page");
  root.className = "hanzi-magic-v1-mount";
  root.innerHTML = `<main class="hmv1-shell" data-testid="hanzi-magic-v1" data-version="${HANZI_MAGIC_V1_GAME_VERSION}"><div class="hmv1-world" data-world></div><div class="hmv1-vignette" aria-hidden="true"></div><header class="hmv1-header"><a href="${returnHref}" aria-label="返回游戏世界">← 营地外</a><div><span aria-hidden="true"></span><h1>汉字魔法战</h1></div><button type="button" data-parent-action="open">声音与家长</button></header><div class="hmv1-ui" data-ui></div><div class="hmv1-modal-layer" data-modal></div></main>`;
  const worldHost = root.querySelector<HTMLElement>("[data-world]")!;
  const uiHost = root.querySelector<HTMLElement>("[data-ui]")!;
  const modalHost = root.querySelector<HTMLElement>("[data-modal]")!;
  world = createHanziMagicV1World(worldHost, worldView(state, systemReduced || save.settings.reducedMotion));

  const persist = (): void => {
    save = saveFromGameState(save, state);
    if (read.writable) writeV1Save(storage, save, true);
  };

  const resetIdleHint = (): void => {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = null;
    if (state.phase === "encounter") {
      idleTimer = window.setTimeout(() => {
        if (!destroyed && state.phase === "encounter") dispatch({ type: "request-hint" });
      }, 4000);
    }
  };

  const render = (): void => {
    const active = document.activeElement instanceof HTMLElement ? activeIdentity(document.activeElement) : null;
    const phaseHtml = state.phase === "camp" ? renderCamp(state, read.recovered)
      : state.phase === "adventure-intro" ? renderAdventureIntro(state)
        : state.phase === "encounter" ? renderBoard(state)
          : state.phase === "boss-interference" ? renderInterference(state)
            : state.phase === "composition" ? renderComposition(state)
              : state.phase === "meaning" ? renderMeaning(state)
                : state.phase === "repair" ? renderRepair(state)
                  : state.phase === "chapter-report" ? renderChapterReport(state)
                    : state.phase === "ending" ? renderEnding(state)
                      : renderSpellbook(state, selectedBookId);
    uiHost.innerHTML = phaseHtml;
    modalHost.innerHTML = parentOpen ? renderParentPanel(save, read.futureVersionProtected, clearConfirm) : "";
    modalHost.toggleAttribute("data-open", parentOpen);
    const modalActive = parentOpen || state.phase === "spellbook" || state.phase === "boss-interference";
    world?.setInputEnabled(!modalActive);
    world?.setView(worldView(state, systemReduced || save.settings.reducedMotion));
    const shell = root.querySelector<HTMLElement>(".hmv1-shell");
    shell?.setAttribute("data-phase", state.phase);
    shell?.setAttribute("data-world-input-enabled", String(!modalActive));
    shell?.setAttribute("data-reduced-motion", String(systemReduced || save.settings.reducedMotion));
    shell?.setAttribute("data-input-mode", save.settings.inputMode);
    if (active) restoreFocus(root, active);
    if (parentOpen && !modalHost.contains(document.activeElement)) modalHost.querySelector<HTMLElement>("button, input, select")?.focus();
    resetIdleHint();
  };

  const dispatch = (action: V1Action): void => {
    const before = state;
    state = stepV1Game(state, action);
    if (state === before) return;
    if (action.type === "place-card") audio.playSfx(state.invalidPlacementCount > before.invalidPlacementCount ? "invalid" : state.phase === "composition" ? "form" : "place");
    else if (action.type === "choose-ability") audio.playSfx("choice");
    else if (action.type === "clear-interference") audio.playSfx("boss");
    else if (action.type === "repair-world") audio.playSfx("restore");
    else if (action.type === "continue" && before.phase === "composition") audio.playSfx("magic");
    else audio.playSfx("ui");
    persist();
    render();
    options.onStateChange?.(state);
  };

  const setInputMode = (inputMode: V1InputMode): void => {
    if (save.settings.inputMode === inputMode || save.settings.inputMode !== "auto") return;
    save = updateV1Settings(save, { inputMode });
    if (read.writable) writeV1Save(storage, save, true);
  };

  root.addEventListener("pointerdown", (event) => setInputMode(event.pointerType === "touch" ? "touch" : "mouse"), { passive: true });
  root.addEventListener("keydown", (event) => {
    setInputMode("keyboard");
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const focused = document.activeElement as HTMLElement | null;
    const group = focused?.closest(".hmv1-hand, .hmv1-board, .hmv1-spellbook nav");
    if (!group) return;
    const controls = [...group.querySelectorAll<HTMLElement>("button:not([disabled])")];
    const index = controls.indexOf(focused!);
    if (index < 0 || !controls.length) return;
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    controls[(index + delta + controls.length) % controls.length].focus();
    event.preventDefault();
  });

  root.addEventListener("dragstart", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card]");
    if (!card || !event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", card.dataset.card ?? "");
    event.dataTransfer.effectAllowed = "move";
  });
  root.addEventListener("dragover", (event) => { if ((event.target as HTMLElement).closest("[data-slot]")) event.preventDefault(); });
  root.addEventListener("drop", (event) => {
    const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot]");
    if (!slot || !event.dataTransfer) return;
    event.preventDefault();
    dispatch({ type: "place-card", slotId: slot.dataset.slot as V1SlotId, cardId: event.dataTransfer.getData("text/plain") });
  });

  root.addEventListener("change", (event) => {
    const field = (event.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>("[data-setting]");
    if (!field) return;
    const key = field.dataset.setting;
    const value = field instanceof HTMLInputElement ? field.checked : field.value;
    if (key === "muted" && typeof value === "boolean") { save = updateV1Settings(save, { muted: value }); audio.setMuted(value); }
    else if (key === "reducedMotion" && typeof value === "boolean") save = updateV1Settings(save, { reducedMotion: value });
    else if (key === "inputMode" && typeof value === "string") save = updateV1Settings(save, { inputMode: value as V1InputMode });
    if (read.writable) writeV1Save(storage, save, true);
    render();
  });

  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, [data-action]");
    if (!target) return;
    const parentAction = target.dataset.parentAction;
    if (parentAction === "open") { parentOpen = true; clearConfirm = false; render(); return; }
    if (parentAction === "close") { parentOpen = false; clearConfirm = false; render(); root.querySelector<HTMLElement>("[data-parent-action='open']")?.focus(); return; }
    if (parentAction === "clear") {
      if (!clearConfirm) { clearConfirm = true; render(); return; }
      clearV1Save(storage); save = readV1Save(storage).state; state = createV1GameState(options.seed ?? "hanzi-magic-v1"); parentOpen = false; clearConfirm = false; audio.setMuted(save.settings.muted); render(); options.onStateChange?.(state); return;
    }
    if (parentAction === "cancel-clear") { clearConfirm = false; render(); return; }
    if (parentOpen) return;
    const bookId = target.dataset.bookCharacter as GoldenCharacterId | undefined;
    if (bookId) { selectedBookId = bookId; render(); return; }
    const cardId = target.dataset.card;
    if (cardId) { dispatch({ type: "select-card", cardId }); return; }
    const slotId = target.dataset.slot as V1SlotId | undefined;
    if (slotId) { dispatch({ type: "place-card", slotId }); return; }
    const action = target.dataset.action;
    if (action === "start-adventure") dispatch({ type: "start-adventure", adventureId: target.dataset.adventure as V1AdventureId, replay: target.dataset.replay === "true" });
    else if (action === "begin-adventure") dispatch({ type: "begin-adventure" });
    else if (action === "choose-ability") dispatch({ type: "choose-ability", abilityId: target.dataset.ability as AbilityId });
    else if (action === "undo") dispatch({ type: "undo" });
    else if (action === "hint") dispatch({ type: "request-hint" });
    else if (action === "continue") dispatch({ type: "continue" });
    else if (action === "clear-interference") {
      const characterId = state.currentEncounterId ? getV1Encounter(state.currentEncounterId).characterId : null;
      dispatch({ type: "clear-interference" });
      if (state.abilityEffect?.inkEchoReplayRequested && characterId) void audio.speak(getV1Character(characterId).spokenPhrase, "zh-CN");
    }
    else if (action === "repair-world") dispatch({ type: "repair-world" });
    else if (action === "continue-from-report") dispatch({ type: "continue-from-report" });
    else if (action === "finish-ending") dispatch({ type: "finish-ending" });
    else if (action === "open-spellbook") dispatch({ type: "open-spellbook" });
    else if (action === "close-spellbook") dispatch({ type: "close-spellbook" });
    else if (action === "return-camp") dispatch({ type: "return-camp" });
    else if (action === "speak") {
      const character = getV1Character(target.dataset.character as GoldenCharacterId);
      void audio.speak(character.spokenPhrase, "zh-CN");
    }
  });

  render();
  options.onStateChange?.(state);
  return {
    getState: () => state,
    setMuted(muted) { save = updateV1Settings(save, { muted }); audio.setMuted(muted); if (read.writable) writeV1Save(storage, save, true); render(); },
    setReducedMotion(reducedMotion) { save = updateV1Settings(save, { reducedMotion }); if (read.writable) writeV1Save(storage, save, true); render(); },
    resetLocalProgress() { clearV1Save(storage); save = readV1Save(storage).state; state = createV1GameState(options.seed ?? "hanzi-magic-v1"); render(); },
    destroy() { if (destroyed) return; destroyed = true; if (idleTimer !== null) window.clearTimeout(idleTimer); audio.destroy(); world?.destroy(); world = null; document.documentElement.classList.remove("hanzi-magic-v1-page"); document.body.classList.remove("hanzi-magic-v1-page"); root.replaceChildren(); },
  };
}

function activeIdentity(element: HTMLElement): string | null {
  if (element.dataset.card) return `card:${element.dataset.card}`;
  if (element.dataset.slot) return `slot:${element.dataset.slot}`;
  if (element.dataset.action) return `action:${element.dataset.action}`;
  if (element.dataset.parentAction) return `parent:${element.dataset.parentAction}`;
  if (element.dataset.bookCharacter) return `book:${element.dataset.bookCharacter}`;
  return null;
}

function restoreFocus(root: HTMLElement, identity: string): void {
  const [kind, value] = identity.split(":", 2);
  const selector = kind === "card" ? `[data-card="${CSS.escape(value)}"]` : kind === "slot" ? `[data-slot="${CSS.escape(value)}"]` : kind === "action" ? `[data-action="${CSS.escape(value)}"]` : kind === "parent" ? `[data-parent-action="${CSS.escape(value)}"]` : `[data-book-character="${CSS.escape(value)}"]`;
  root.querySelector<HTMLElement>(selector)?.focus();
}
