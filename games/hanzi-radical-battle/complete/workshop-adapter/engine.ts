import { CANONICAL_WHEEL_LIBRARY } from "../../v2/wheel-workshop/library/canonical-wheel-library";
import type { LegacyWheelGradeId } from "../../v2/wheel-workshop/library/legacy-wheel-types";
import { hashWheelSeed, shuffleWheelItems } from "../../v2/wheel-workshop/machine/wheel-rng";
import type { WheelGradeSelection, WheelSlotId } from "../../v2/wheel-workshop/types";
import { COMPLETE_WHEEL_MANIFEST, getCompleteWheelRecord, type CompleteWheelRecord } from "../wheel-adapter/selection";

export type CompleteWorkshopPhase = "ready" | "choose-card" | "place-card" | "success" | "summary";

export interface CompleteWorkshopCard {
  readonly id: string;
  readonly glyph: string;
  readonly kind: "partner" | "distractor";
}

export interface CompleteWorkshopRound {
  readonly recordId: string;
  readonly cards: readonly CompleteWorkshopCard[];
  readonly selectedCardId: string | null;
  readonly placed: boolean;
  readonly landingIndex: number;
  readonly rotationDegrees: number;
}

export interface CompleteWorkshopState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly selectedGradeId: WheelGradeSelection;
  readonly phase: CompleteWorkshopPhase;
  readonly completedRoundCount: number;
  readonly sessionRecordIds: readonly string[];
  readonly currentRound: CompleteWorkshopRound | null;
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type CompleteWorkshopAction =
  | { readonly type: "choose-grade"; readonly gradeId: WheelGradeSelection }
  | { readonly type: "spin" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly slotId: WheelSlotId }
  | { readonly type: "undo" }
  | { readonly type: "continue" };

const POSITIONALLY_INCOMPATIBLE_PARTNERS = ["氵", "扌", "亻", "讠", "忄", "犭", "钅", "饣"] as const;
const APPROVED_PAIR_KEYS = new Set(CANONICAL_WHEEL_LIBRARY
  .filter((record) => record.sourceMode === "char" && (record.auditStatus === "validated" || record.auditStatus === "corrected-derived-record") && record.orderedComponents.length === 2)
  .map((record) => record.orderedComponents.join("|")));

export function getCompleteWorkshopPool(gradeId: WheelGradeSelection): readonly CompleteWheelRecord[] {
  if (gradeId === "journey") return COMPLETE_WHEEL_MANIFEST;
  return COMPLETE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId as LegacyWheelGradeId);
}

export function createCompleteWorkshopState(seed: string, selectedGradeId: WheelGradeSelection = "journey"): CompleteWorkshopState {
  return { schemaVersion: 1, seed: seed.trim() || "complete-wheel-workshop", selectedGradeId, phase: "ready", completedRoundCount: 0, sessionRecordIds: [], currentRound: null, gentleMessage: "转动字轮，让一道真实结构的字光停下来。", actionCount: 0 };
}

function advance(state: CompleteWorkshopState, patch: Partial<CompleteWorkshopState>): CompleteWorkshopState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

function generateRound(state: CompleteWorkshopState): CompleteWorkshopRound {
  const pool = getCompleteWorkshopPool(state.selectedGradeId);
  const unused = pool.filter((record) => !state.sessionRecordIds.includes(record.id));
  const candidates = unused.length ? unused : pool;
  const target = candidates[hashWheelSeed(`${state.seed}:${state.selectedGradeId}:${state.completedRoundCount}:target`) % candidates.length];
  const anchor = target.orderedComponents[0];
  const partner = target.orderedComponents[1];
  const distractors = shuffleWheelItems(POSITIONALLY_INCOMPATIBLE_PARTNERS.filter((glyph) => glyph !== anchor && glyph !== partner && !APPROVED_PAIR_KEYS.has(`${anchor}|${glyph}`)), `${state.seed}:${state.completedRoundCount}:distractors`).slice(0, 3);
  if (distractors.length !== 3) throw new Error(`Complete wheel cannot create three legal distractors for ${target.id}`);
  const cards = shuffleWheelItems([
    { glyph: partner, kind: "partner" as const },
    ...distractors.map((glyph) => ({ glyph, kind: "distractor" as const })),
  ], `${state.seed}:${state.completedRoundCount}:cards`).map((card, index) => ({ ...card, id: `complete-wheel-card-${index}-${hashWheelSeed(`${state.seed}:${state.completedRoundCount}:${index}`).toString(36)}` }));
  const landingIndex = pool.findIndex((record) => record.id === target.id);
  return { recordId: target.id, cards, selectedCardId: null, placed: false, landingIndex, rotationDegrees: 720 + (360 - landingIndex * 360 / pool.length) };
}

export function reduceCompleteWorkshopState(state: CompleteWorkshopState, action: CompleteWorkshopAction): CompleteWorkshopState {
  if (action.type === "choose-grade") return advance(state, { selectedGradeId: action.gradeId, phase: "ready", completedRoundCount: 0, sessionRecordIds: [], currentRound: null, gentleMessage: "这本字卷已经放好，可以转动字轮。" });
  if (action.type === "spin" && state.phase === "ready") return advance(state, { phase: "choose-card", currentRound: generateRound(state), gentleMessage: "锚点已经停稳，选出能回到空位的伙伴部件。" });
  if (action.type === "select-card" && state.phase === "choose-card" && state.currentRound) {
    if (!state.currentRound.cards.some((card) => card.id === action.cardId)) return state;
    return advance(state, { phase: "place-card", currentRound: { ...state.currentRound, selectedCardId: action.cardId }, gentleMessage: "伙伴牌已经拿好，请放进空着的真实位置。" });
  }
  if (action.type === "place-card" && state.phase === "place-card" && state.currentRound?.selectedCardId) {
    const record = getCompleteWheelRecord(state.currentRound.recordId);
    const card = state.currentRound.cards.find((candidate) => candidate.id === state.currentRound?.selectedCardId)!;
    const expectedSlot = record.slotIds[1];
    if (card.kind !== "partner" || action.slotId !== expectedSlot) return advance(state, { phase: "choose-card", currentRound: { ...state.currentRound, selectedCardId: null }, gentleMessage: "这块部件还没找到自己的真实位置；换一张也不会失去进度。" });
    return advance(state, { phase: "success", currentRound: { ...state.currentRound, placed: true }, gentleMessage: "两个部件在真实位置合成了完整汉字。" });
  }
  if (action.type === "undo" && state.phase === "place-card" && state.currentRound) return advance(state, { phase: "choose-card", currentRound: { ...state.currentRound, selectedCardId: null }, gentleMessage: "伙伴牌回到手边，可以重新选择。" });
  if (action.type === "continue" && state.phase === "success" && state.currentRound) {
    const completedRoundCount = state.completedRoundCount + 1;
    const sessionRecordIds = [...state.sessionRecordIds, state.currentRound.recordId];
    return advance(state, { completedRoundCount, sessionRecordIds, currentRound: null, phase: completedRoundCount >= 3 ? "summary" : "ready", gentleMessage: completedRoundCount >= 3 ? "三道完整字光已经安全收好。" : "下一次转动已经准备好。" });
  }
  return state;
}

export function simulateCompleteWorkshop(seed: string, gradeId: WheelGradeSelection = "journey") {
  let state = createCompleteWorkshopState(seed, gradeId);
  for (let guard = 0; guard < 40 && state.phase !== "summary"; guard += 1) {
    if (state.phase === "ready") state = reduceCompleteWorkshopState(state, { type: "spin" });
    else if (state.phase === "choose-card") state = reduceCompleteWorkshopState(state, { type: "select-card", cardId: state.currentRound!.cards.find((card) => card.kind === "partner")!.id });
    else if (state.phase === "place-card") state = reduceCompleteWorkshopState(state, { type: "place-card", slotId: getCompleteWheelRecord(state.currentRound!.recordId).slotIds[1] });
    else if (state.phase === "success") state = reduceCompleteWorkshopState(state, { type: "continue" });
  }
  return state;
}

if (COMPLETE_WHEEL_MANIFEST.length < 72 || new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.glyph)).size !== COMPLETE_WHEEL_MANIFEST.length) {
  throw new Error("Complete workshop adapter requires at least 72 unique playable glyphs");
}
