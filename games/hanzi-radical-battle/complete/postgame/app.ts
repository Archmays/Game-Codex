import type { MountedGame } from "../../../../packages/game-core";
import { M3_HEROES } from "../../v2/chapter-one/builds";
import { m5AssetUrl } from "../../v2/chapter-one/m5-assets";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import type { CompleteSlotId } from "../content-graph/types";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import { createCompleteEngineState, reduceCompleteEngineState } from "../core/complete-machine";
import type { CompleteEngineState, CompletePostgameMode } from "../core/complete-types";
import {
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  writeCompleteSave,
  completeBrowserStorage,
  isCompleteSaveWritable,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../save/complete-save";
import {
  COMPLETE_POSTGAME_BANDS,
  getCompletePostgameMode,
  type CompletePostgameBand,
} from "./contracts";
import {
  getCompletePostgameBuildCards,
  getCompletePostgameContextChoices,
  getCompletePostgameFamilyChoices,
  type CompletePostgameAction,
  type CompletePostgameRun,
} from "./engine";
import "../ui/postgame.css";

export interface MountCompletePostgameOptions {
  readonly storage?: CompleteStorageLike;
  readonly seed?: string;
  readonly mode: CompletePostgameMode;
  readonly band?: CompletePostgameBand;
  readonly restart?: boolean;
  readonly returnHref?: string;
}


function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function slotLabel(slotId: CompleteSlotId): string { return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面" })[slotId]; }
function character(id: string) { return COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id)!; }
function reading(id: string) { return COMPLETE_CORE_READING_SENSES.find((candidate) => character(id).readingSenseIds.includes(candidate.id))!; }
function word(id: string) { return COMPLETE_WORD_NODES.find((candidate) => candidate.id === id)!; }

function renderPath(run: CompletePostgameRun): string {
  return `<ol class="hmcp-path" aria-label="这次探索的六处字光">${run.plan.rounds.map((round, index) => `<li data-status="${index < run.state.roundIndex || run.state.phase === "session-summary" ? "complete" : index === run.state.roundIndex ? "current" : "future"}"><span>${index < run.state.roundIndex || run.state.phase === "session-summary" ? "✦" : index + 1}</span></li>`).join("")}</ol>`;
}

function renderBuild(run: CompletePostgameRun): string {
  const target = character(run.state.currentCharacterId!);
  const cards = getCompletePostgameBuildCards(run);
  const placed = (slotId: CompleteSlotId) => {
    const placement = run.state.placements.find((candidate) => candidate.slotId === slotId);
    return placement ? cards.find((card) => card.id === placement.cardId) ?? null : null;
  };
  const enclosure = target.structure === "full-enclosure" || target.structure === "semi-enclosure";
  const outerPlaced = placed("outer") !== null;
  const part = run.state.phase === "word-build-a" ? "词语里的第一个完整字" : run.state.phase === "word-build-b" ? "词语里的第二个完整字" : run.state.phase === "family-build" ? "字脉里的完整字" : "自由林路的完整字";
  return `<section class="hmcp-panel hmcp-build" data-testid="complete-postgame-build" data-character-id="${target.id}" data-structure="${target.structure}"><p class="hmcp-kicker">${part}</p><h2>把字灵送回真实位置</h2><p>${escapeHtml(run.state.gentleMessage)}</p><div class="hmcp-board hmcp-board--${target.structure}" role="group" aria-label="汉字结构位置">${target.components.map((component) => { const card = placed(component.slotId); const locked = enclosure && component.slotId === "inner" && !outerPlaced; return `<button type="button" data-slot-id="${component.slotId}" class="${card ? "is-filled" : ""}" ${locked ? "disabled" : ""}><b>${card?.glyph ?? ""}</b><span>${locked ? "先放外框" : slotLabel(component.slotId)}</span></button>`; }).join("")}</div><div class="hmcp-hand" role="group" aria-label="部件字灵">${cards.map((card) => { const used = run.state.placements.some((placement) => placement.cardId === card.id); return `<button type="button" draggable="${String(!used)}" data-card-id="${card.id}" aria-pressed="${String(run.state.selectedCardId === card.id)}" ${used ? "disabled" : ""}><b>${card.glyph}</b></button>`; }).join("")}</div><button type="button" data-action="undo" ${run.state.placements.length || run.state.selectedCardId ? "" : "disabled"}>收回上一步</button></section>`;
}

function renderMeaning(run: CompletePostgameRun): string {
  const target = character(run.state.currentCharacterId!); const sense = reading(target.id);
  return `<section class="hmcp-panel hmcp-meaning" data-testid="complete-postgame-meaning" data-character-id="${target.id}"><p class="hmcp-kicker">部件合成了完整字</p><div class="hmcp-glyph">${target.glyph}</div><h2>${sense.pinyin} · ${target.familiarWord}</h2><p>${target.shortMeaning}</p><p class="hmcp-magic"><b>${target.magicName}</b>：${target.magicEffect}</p><p>这是字义联想，不是字源说明。</p><button type="button" data-action="speak-character">听完整字和词</button><button class="hmcp-primary" type="button" data-action="continue" data-primary-focus>${run.state.phase === "word-meaning-a" ? "合成第二个完整字" : run.state.phase === "word-meaning-b" ? "连接真实词序" : run.state.phase === "family-meaning" ? "寻找真实字脉" : "让字光落进林路"}</button></section>`;
}

function renderFamily(run: CompletePostgameRun): string {
  const target = character(run.state.currentCharacterId!);
  return `<section class="hmcp-panel" data-testid="complete-postgame-family-link" data-character-id="${target.id}" data-family-id="${run.state.currentFamilyId}"><p class="hmcp-kicker">完整字先出现，字脉随后连接</p><h2>${target.glyph} 要回到哪条共享部件字脉？</h2><p>${escapeHtml(run.state.gentleMessage)}</p><div class="hmcp-offers">${getCompletePostgameFamilyChoices(run).map((family) => `<button type="button" data-family-id="${family.id}"><b>${family.name}</b><span>${family.worldRepresentation}</span></button>`).join("")}</div></section>`;
}

function renderWordOrder(run: CompletePostgameRun): string {
  const target = word(run.state.currentWordId!);
  return `<section class="hmcp-panel" data-testid="complete-postgame-word-order" data-word-id="${target.id}"><p class="hmcp-kicker">两个完整字都准备好了</p><h2>按真实阅读顺序连接词带</h2><p>${escapeHtml(run.state.gentleMessage)}</p><div class="hmcp-word-slots">${[0, 1].map((index) => `<span>${run.state.wordOrderCharacterIds[index] ? character(run.state.wordOrderCharacterIds[index]).glyph : index + 1}</span>`).join("")}</div><div class="hmcp-word-cards">${target.characterIds.map((id) => `<button type="button" data-word-character-id="${id}">${character(id).glyph}</button>`).join("")}</div><button type="button" data-action="undo" ${run.state.wordOrderCharacterIds.length ? "" : "disabled"}>收回一步</button></section>`;
}

function renderContext(run: CompletePostgameRun): string {
  const target = word(run.state.currentWordId!);
  return `<section class="hmcp-panel" data-testid="complete-postgame-context" data-word-id="${target.id}"><p class="hmcp-kicker">${target.glyphs.join("")} · ${target.pinyin}</p><h2>哪幅真实语境属于这条词带？</h2><p>${escapeHtml(run.state.gentleMessage)}</p><div class="hmcp-offers">${getCompletePostgameContextChoices(run).map((option) => `<button type="button" data-context-word-id="${option.id}"><b>${option.glyphs.join("")}</b><span>${option.context}</span></button>`).join("")}</div></section>`;
}

function renderPhase(run: CompletePostgameRun): string {
  const mode = getCompletePostgameMode(run.mode);
  if (run.state.phase === "mode-intro") return `<section class="hmcp-panel hmcp-intro" data-testid="complete-postgame-intro"><p class="hmcp-kicker">通关后探索 · ${mode.place}</p><h2>${mode.name}</h2><p>${mode.promise}</p><p>这是一段可以慢慢走完的小冒险；没有倒计时，随时停下都能继续。</p>${run.mode === "free-adventure" ? `<div class="hmcp-bands" aria-label="自由冒险字光范围">${COMPLETE_POSTGAME_BANDS.map((band) => `<a aria-current="${run.band === band.id ? "true" : "false"}" href="?play=hanzi-magic-complete&from=hub&postgame=free-adventure&band=${band.id}&new=1"><b>${band.name}</b><span>${band.childDescription}</span></a>`).join("")}</div>` : ""}<button class="hmcp-primary" type="button" data-action="start" data-primary-focus>走进这段林路</button></section>`;
  if (run.state.phase === "offer-choice") return `<section class="hmcp-panel" data-testid="complete-postgame-offers"><p class="hmcp-kicker">第 ${run.state.roundIndex + 1}/6 处 · 三道都能走完</p><h2>选择一道想跟随的字光</h2><p>${escapeHtml(run.state.gentleMessage)}</p><div class="hmcp-offers">${run.plan.rounds[run.state.roundIndex].offers.map((offer) => `<button type="button" data-offer-id="${offer.id}"><strong>${offer.glyphLabel}</strong><b>${offer.childLabel}</b><span>${offer.worldHint}</span></button>`).join("")}</div></section>`;
  if (["character-build", "family-build", "word-build-a", "word-build-b"].includes(run.state.phase)) return renderBuild(run);
  if (["character-meaning", "family-meaning", "word-meaning-a", "word-meaning-b"].includes(run.state.phase)) return renderMeaning(run);
  if (run.state.phase === "family-link") return renderFamily(run);
  if (run.state.phase === "word-order") return renderWordOrder(run);
  if (run.state.phase === "word-context") return renderContext(run);
  if (run.state.phase === "round-complete") {
    const offer = run.plan.rounds[run.state.roundIndex].offers.find((candidate) => candidate.id === run.state.selectedOfferId)!;
    return `<section class="hmcp-panel hmcp-round" data-testid="complete-postgame-round-complete"><p class="hmcp-kicker">这道字光已经归位</p><div class="hmcp-glyph">${offer.glyphLabel}</div><h2>${offer.childLabel}</h2><p>${escapeHtml(run.state.gentleMessage)}</p><button class="hmcp-primary" type="button" data-action="continue" data-primary-focus>${run.state.roundIndex >= 5 ? "收好这次探索" : "去下一处字光"}</button></section>`;
  }
  return `<section class="hmcp-panel hmcp-summary" data-testid="complete-postgame-summary"><p class="hmcp-kicker">${mode.name}完成 · 没有分数或排名</p><h2>六道字光都回到了森林</h2><p>${run.state.completedOfferIds.map((id) => run.plan.rounds.flatMap((round) => round.offers).find((offer) => offer.id === id)?.glyphLabel).join("　")}</p><p>这次探索保存在本机。可以重走同一种模式，也可以换一条林路。</p><div><a class="hmcp-primary" href="?play=hanzi-magic-complete&from=hub&postgame=${run.mode}&band=${run.band}&new=1&seed=${encodeURIComponent(`${run.seed}:next`)}">再走一次</a><a href="?play=hanzi-magic-complete&from=hub">回到墨迹森林</a></div></section>`;
}

export function mountCompletePostgame(root: HTMLElement, options: MountCompletePostgameOptions): MountedGame & { getRun(): CompletePostgameRun | null; getSave(): CompleteSaveState; dispatch(action: CompletePostgameAction): void } {
  const storage = options.storage ?? completeBrowserStorage(); let read = readCompleteSave(storage); let save = read.state;
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";
  if (!save.completedChapterIds.includes("chapter-three")) {
    root.innerHTML = `<main class="hmcp-shell hmcp-locked" data-testid="complete-postgame-locked"><section><p>归林后的远路还在沉睡</p><h1>先让三章字光回到森林</h1><p>不需要收集全部字；故事通关后，三条自由林路会一起亮起。</p><a class="hmcp-primary" href="${escapeHtml(returnHref)}">回到墨迹森林</a></section></main>`;
    return { getRun: () => null, getSave: () => save, dispatch: () => {}, destroy() { root.replaceChildren(); } };
  }
  if (options.restart && isCompleteSaveWritable(save)) {
    save = updateCompleteSave(save, { postgameResume: null }); writeCompleteSave(storage, save);
    const consumed = new URL(location.href); consumed.searchParams.delete("new"); history.replaceState(history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`);
  }
  let master: CompleteEngineState = createCompleteEngineState(save.activeResume.seed, progressSeedFromCompleteSave(save));
  master = reduceCompleteEngineState(master, { type: "enter-postgame", mode: options.mode, seed: options.seed, band: options.band ?? "whole-forest", restart: options.restart });
  let run = master.postgameRun!; let draggedCardId: string | null = null; let destroyed = false;
  const persist = () => { if (!isCompleteSaveWritable(save)) return; save = syncCompleteSaveFromEngine(save, master); writeCompleteSave(storage, save); };
  const render = () => {
    const hero = M3_HEROES.find((candidate) => candidate.id === master.heroId)!;
    root.innerHTML = `<main class="hmcp-shell" data-testid="complete-postgame" data-mode="${run.mode}" data-band="${run.band}" data-phase="${run.state.phase}" data-round-index="${run.state.roundIndex}" data-action-count="${run.state.actionCount}" data-character-count="${run.state.discoveredCharacterIds.length}" data-family-count="${run.state.discoveredFamilyIds.length}" data-word-count="${run.state.discoveredWordIds.length}" data-completed-offer-count="${run.state.completedOfferIds.length}" data-muted="${String(save.settings.muted)}" data-reduced-motion="${String(save.settings.reducedMotion)}" style="--hmcp-scene:url('${m5AssetUrl(run.mode === "word-resonance" ? "region-echo-garden" : run.mode === "component-trails" ? "region-glimmer-grove" : "region-wind-trail")}')"><div class="hmcp-world" aria-hidden="true"></div><header><a href="${escapeHtml(returnHref)}">← 森林</a><div><span>${hero.name}同行</span><h1>${getCompletePostgameMode(run.mode).name}</h1></div><div><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(save.settings.reducedMotion)}">${save.settings.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>${!isCompleteSaveWritable(save) ? `<p class="hmcp-save-note" role="status">本机存档已保护，当前进展暂未保存。回到森林后可以重新读取。</p>` : ""}<div class="hmcp-layout">${renderPath(run)}<div class="hmcp-phase" aria-live="polite">${renderPhase(run)}</div></div><footer>本地匿名保存 · 无稀有度 · 无损失 · 无倒计时</footer></main>`;
    root.querySelector<HTMLElement>(["character-build", "family-build", "word-build-a", "word-build-b"].includes(run.state.phase) && run.state.selectedCardId ? ".hmcp-board button:not([disabled]):not(.is-filled)" : "[data-primary-focus], [data-offer-id], [data-card-id], [data-family-id], [data-word-character-id], [data-context-word-id], button, a")?.focus({ preventScroll: true });
  };
  const dispatch = (action: CompletePostgameAction) => { if (destroyed) return; const next = reduceCompleteEngineState(master, { type: "postgame-action", action }); if (next === master) return; master = next; run = master.postgameRun!; persist(); render(); };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button"); if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    if (["start", "undo", "continue"].includes(String(action))) dispatch({ type: action } as CompletePostgameAction);
    if (target.dataset.offerId) dispatch({ type: "choose-offer", offerId: target.dataset.offerId });
    if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    if (target.dataset.slotId) dispatch({ type: "place-selected", slotId: target.dataset.slotId as CompleteSlotId });
    if (target.dataset.familyId) dispatch({ type: "choose-family", familyId: target.dataset.familyId });
    if (target.dataset.wordCharacterId) dispatch({ type: "place-word-character", characterId: target.dataset.wordCharacterId });
    if (target.dataset.contextWordId) dispatch({ type: "choose-context", wordId: target.dataset.contextWordId });
    if (action === "speak-character" && run.state.currentCharacterId) {
      const targetCharacter = character(run.state.currentCharacterId); const targetReading = reading(targetCharacter.id);
      if (!save.settings.muted && typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined") { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(`${targetCharacter.glyph}，${targetReading.fixedPhrase}`); utterance.lang = "zh-CN"; utterance.rate = .86; speechSynthesis.speak(utterance); }
    }
    if (target.dataset.pref && isCompleteSaveWritable(save)) { const field = target.dataset.pref === "muted" ? "muted" : "reducedMotion"; save = updateCompleteSave(save, { settings: { ...save.settings, [field]: !save.settings[field] } }); writeCompleteSave(storage, save); render(); }
  };
  const dragStart = (event: DragEvent) => { draggedCardId = (event.target as HTMLElement).closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null; };
  const dragOver = (event: DragEvent) => { if ((event.target as HTMLElement).closest("[data-slot-id]") && draggedCardId) event.preventDefault(); };
  const drop = (event: DragEvent) => { const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-id]"); if (slot?.dataset.slotId && draggedCardId) { event.preventDefault(); dispatch({ type: "place-card", cardId: draggedCardId, slotId: slot.dataset.slotId as CompleteSlotId }); } draggedCardId = null; };
  root.addEventListener("click", click); root.addEventListener("dragstart", dragStart); root.addEventListener("dragover", dragOver); root.addEventListener("drop", drop); persist(); render();
  return { getRun: () => run, getSave: () => save, dispatch, destroy() { destroyed = true; root.removeEventListener("click", click); root.removeEventListener("dragstart", dragStart); root.removeEventListener("dragover", dragOver); root.removeEventListener("drop", drop); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); root.replaceChildren(); } };
}
