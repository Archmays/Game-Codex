import type { MountedGame } from "../../../../packages/game-core";
import type { WheelGradeSelection, WheelSlotId } from "../../v2/wheel-workshop/types";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import {
  readCompleteSave,
  updateCompleteSave,
  writeCompleteSave,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../save/complete-save";
import { COMPLETE_WHEEL_GRADE_OPTIONS, getCompleteWheelRecord } from "../wheel-adapter/selection";
import {
  createCompleteWorkshopState,
  getCompleteWorkshopPool,
  reduceCompleteWorkshopState,
  type CompleteWorkshopAction,
  type CompleteWorkshopState,
} from "./engine";
import "../ui/workshop.css";

export interface MountCompleteWorkshopOptions {
  readonly storage?: CompleteStorageLike;
  readonly seed?: string;
  readonly returnHref?: string;
}

const MEMORY_STORAGE = new Map<string, string>();
function browserStorage(): CompleteStorageLike {
  try { return window.localStorage; } catch { return { getItem: (key) => MEMORY_STORAGE.get(key) ?? null, setItem: (key, value) => { MEMORY_STORAGE.set(key, value); }, removeItem: (key) => { MEMORY_STORAGE.delete(key); } }; }
}
function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function slotLabel(slotId: WheelSlotId): string { return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面" } as Record<string, string>)[slotId] ?? "空位"; }

function saveDiscovery(save: CompleteSaveState, characterId: string, nowUtc = new Date().toISOString()): CompleteSaveState {
  if (save.discoveredCharacterIds.includes(characterId)) return save;
  const nextEligibleAt = new Date(Date.parse(nowUtc) + 24 * 60 * 60 * 1000).toISOString();
  const provenance = new Map(save.migration.characterProvenance.map((entry) => [entry.characterId, [...entry.sources]]));
  provenance.set(characterId, [...new Set([...(provenance.get(characterId) ?? []), "wheel" as const, "v3" as const])]);
  return updateCompleteSave(save, {
    discoveredCharacterIds: [...save.discoveredCharacterIds, characterId],
    reviewRecords: [...save.reviewRecords.filter((record) => record.recordId !== characterId), { recordId: characterId, state: "independent", lastEncounteredAt: nowUtc, nextEligibleAt }],
    minimalLocalEvents: { ...save.minimalLocalEvents, completedLiteracyActions: save.minimalLocalEvents.completedLiteracyActions + 1, lastPlayedAtUtc: nowUtc },
    migration: { ...save.migration, characterProvenance: [...provenance.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, sources]) => ({ characterId: id, sources })) },
  });
}

function renderPhase(state: CompleteWorkshopState): string {
  const pool = getCompleteWorkshopPool(state.selectedGradeId);
  if (state.phase === "ready") return `<section class="hmcw-panel hmcw-ready" data-testid="complete-workshop-ready"><p class="hmcw-kicker">${state.completedRoundCount ? `已有 ${state.completedRoundCount} 道字光回到字轮` : "真实结构字轮"}</p><div class="hmcw-wheel" aria-hidden="true">${pool.slice(0, 12).map((record) => `<span>${record.glyph}</span>`).join("")}</div><h2>转动字轮，找一位部件伙伴</h2><p>每道题都照着汉字的真实结构来；没有稀有度，试错也不会吞掉进度。</p><button class="hmcw-primary" type="button" data-action="spin" data-primary-focus>转动字轮</button></section>`;
  if (state.phase === "summary") return `<section class="hmcw-panel hmcw-summary" data-testid="complete-workshop-summary"><p class="hmcw-kicker">字轮小旅程完成</p><h2>三道完整字光已经收好</h2><p>${state.sessionRecordIds.map((id) => getCompleteWheelRecord(id).glyph).join("　")}</p><p>没有分数、排名、稀有度或进度损失；回到森林后仍会保存在本机。</p><a class="hmcw-primary" href="?play=hanzi-magic-complete&from=hub&view=wheel&seed=${encodeURIComponent(`${state.seed}:next`)}">再转三次</a></section>`;
  const round = state.currentRound!;
  const record = getCompleteWheelRecord(round.recordId);
  if (state.phase === "success") return `<section class="hmcw-panel hmcw-success" data-testid="complete-workshop-success" data-character-id="${record.characterNodeId}"><p class="hmcw-kicker">部件合起来了</p><div class="hmcw-result">${record.glyph}</div><h2>${record.pinyin} · ${record.familiarWord}</h2><p>${record.shortMeaning}</p><div class="hmcw-links"><article><b>字脉连接</b><span>${record.familyIds.length ? record.familyIds.map((id) => COMPLETE_COMPONENT_FAMILIES.find((family) => family.id === id)?.name).filter(Boolean).join(" · ") : "这道字光暂未进入十八条字脉"}</span></article><article><b>词语连接</b><span>${record.wordIds.length ? record.wordIds.map((id) => COMPLETE_WORD_NODES.find((word) => word.id === id)?.glyphs.join("")).filter(Boolean).join(" · ") : `先用“${record.familiarWord}”理解`}</span></article></div><button type="button" data-action="speak-result">听完整字和词</button><button class="hmcw-primary" type="button" data-action="continue" data-primary-focus>${state.completedRoundCount >= 2 ? "收好这次字轮" : "寻找下一道字光"}</button></section>`;
  const anchorSlot = record.slotIds[0]; const partnerSlot = record.slotIds[1];
  return `<section class="hmcw-panel hmcw-build" data-testid="complete-workshop-build" data-record-id="${record.id}" data-phase="${state.phase}"><p class="hmcw-kicker">第 ${state.completedRoundCount + 1}/3 道字光</p><h2>${state.phase === "choose-card" ? "哪块部件能和锚点合成完整字？" : "把伙伴送进真实空位"}</h2><p>${escapeHtml(state.gentleMessage)}</p><div class="hmcw-board hmcw-board--${record.structure}" role="group" aria-label="汉字结构位置"><span data-slot-id="${anchorSlot}" class="is-filled"><b>${record.orderedComponents[0]}</b><small>${slotLabel(anchorSlot)}</small></span><button type="button" data-slot-id="${partnerSlot}" ${state.phase === "place-card" ? "" : "disabled"}><small>${slotLabel(partnerSlot)}</small></button></div><div class="hmcw-hand" role="group" aria-label="四张部件牌">${round.cards.map((card) => `<button type="button" draggable="true" data-card-id="${card.id}" aria-pressed="${String(round.selectedCardId === card.id)}"><b>${card.glyph}</b></button>`).join("")}</div>${state.phase === "place-card" ? `<button type="button" data-action="undo">收回伙伴牌</button>` : ""}</section>`;
}

export function mountCompleteWorkshop(root: HTMLElement, options: MountCompleteWorkshopOptions = {}): MountedGame {
  const storage = options.storage ?? browserStorage(); const read = readCompleteSave(storage); let save = read.state;
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";
  if (!save.repairedObjectIds.includes("magic-tree")) {
    root.innerHTML = `<main class="hmcw-shell hmcw-locked" data-testid="complete-workshop-locked"><section><p>魔法树的字轮还在沉睡</p><h1>先完成第一章的一段冒险</h1><p>旧字轮存档和已发现字光都不会丢失。</p><a class="hmcw-primary" href="${escapeHtml(returnHref)}">回到墨迹森林</a></section></main>`;
    return { destroy() { root.replaceChildren(); } };
  }
  let state = createCompleteWorkshopState(options.seed ?? "complete-wheel-return"); let draggedCardId: string | null = null; let destroyed = false;
  const render = () => {
    root.innerHTML = `<main class="hmcw-shell" data-testid="complete-workshop" data-phase="${state.phase}" data-record-count="72" data-grade-pool-count="${getCompleteWorkshopPool(state.selectedGradeId).length}" data-discovered-count="${save.discoveredCharacterIds.length}" data-muted="${String(save.settings.muted)}"><header><a href="${escapeHtml(returnHref)}">← 森林</a><div><span>魔法树热点</span><h1>七十二字轮工坊</h1></div><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button></header>${!read.writable ? `<p class="hmcw-save-note" role="status">发现较新版本存档：当前只读，不会覆盖。</p>` : ""}<nav class="hmcw-grades" aria-label="选择字卷">${COMPLETE_WHEEL_GRADE_OPTIONS.map((grade) => `<button type="button" data-grade-id="${grade.id}" aria-pressed="${String(state.selectedGradeId === grade.id)}">${grade.worldName}</button>`).join("")}</nav><div aria-live="polite">${renderPhase(state)}</div><footer>本地匿名保存 · 无排名 · 熟悉词只在完整合字后出现</footer></main>`;
    root.querySelector<HTMLElement>(state.phase === "place-card" ? "[data-slot-id]:not(.is-filled)" : "[data-primary-focus], [data-card-id], button, a")?.focus({ preventScroll: true });
  };
  const dispatch = (action: CompleteWorkshopAction) => {
    if (destroyed) return; const before = state; state = reduceCompleteWorkshopState(state, action); if (state === before) return;
    if (state.phase === "success" && state.currentRound && before.phase !== "success" && read.writable) {
      save = saveDiscovery(save, getCompleteWheelRecord(state.currentRound.recordId).characterNodeId); writeCompleteSave(storage, save);
    }
    render();
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button"); if (!target || !root.contains(target)) return;
    if (target.dataset.gradeId) dispatch({ type: "choose-grade", gradeId: target.dataset.gradeId as WheelGradeSelection });
    if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    if (target.dataset.slotId && state.phase === "place-card") dispatch({ type: "place-card", slotId: target.dataset.slotId as WheelSlotId });
    if (["spin", "undo", "continue"].includes(String(target.dataset.action))) dispatch({ type: target.dataset.action } as CompleteWorkshopAction);
    if (target.dataset.action === "speak-result" && state.currentRound) {
      const record = getCompleteWheelRecord(state.currentRound.recordId);
      if (!save.settings.muted && typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined") { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(record.spokenPhrase); utterance.lang = "zh-CN"; utterance.rate = .86; speechSynthesis.speak(utterance); }
    }
    if (target.dataset.pref === "muted" && read.writable) { save = updateCompleteSave(save, { settings: { ...save.settings, muted: !save.settings.muted } }); writeCompleteSave(storage, save); render(); }
  };
  const dragStart = (event: DragEvent) => { draggedCardId = (event.target as HTMLElement).closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null; };
  const dragOver = (event: DragEvent) => { if ((event.target as HTMLElement).closest("[data-slot-id]") && draggedCardId) event.preventDefault(); };
  const drop = (event: DragEvent) => { const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-id]"); if (slot?.dataset.slotId && draggedCardId) { event.preventDefault(); if (state.phase === "choose-card") dispatch({ type: "select-card", cardId: draggedCardId }); dispatch({ type: "place-card", slotId: slot.dataset.slotId as WheelSlotId }); } draggedCardId = null; };
  root.addEventListener("click", click); root.addEventListener("dragstart", dragStart); root.addEventListener("dragover", dragOver); root.addEventListener("drop", drop); render();
  return { destroy() { destroyed = true; root.removeEventListener("click", click); root.removeEventListener("dragstart", dragStart); root.removeEventListener("dragover", dragOver); root.removeEventListener("drop", drop); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); root.replaceChildren(); } };
}
