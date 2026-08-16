import { getPlayableWheelRecord, getWheelPool } from "../library/playable-wheel-manifest";
import type { WheelGradeSelection, WheelWorkshopAction, WheelWorkshopState } from "../types";
import { generateWheelRound } from "./wheel-round-generator";

const READY_MESSAGE = "转动字轮，听听今天是哪一道字光。";

export interface WheelStateSeed {
  readonly selectedGradeId?: WheelGradeSelection;
  readonly discoveredRecordIds?: readonly string[];
  readonly recentRecordIds?: readonly string[];
  readonly completedRoundCount?: number;
}

export function createWheelWorkshopState(seed: string, initial: WheelStateSeed = {}): WheelWorkshopState {
  const selectedGradeId = initial.selectedGradeId ?? "journey";
  return {
    schemaVersion: 1,
    seed: seed.trim() || "wheel-workshop",
    selectedGradeId,
    phase: getWheelPool(selectedGradeId).length ? "ready" : "empty",
    completedRoundCount: Math.min(3, Math.max(0, initial.completedRoundCount ?? 0)),
    sessionRecordIds: [],
    discoveredRecordIds: [...new Set(initial.discoveredRecordIds ?? [])],
    recentRecordIds: [...new Set(initial.recentRecordIds ?? [])].slice(-12),
    currentRound: null,
    hintLevel: 0,
    gentleMessage: READY_MESSAGE,
    actionCount: 0,
  };
}

function advance(state: WheelWorkshopState, patch: Partial<WheelWorkshopState>): WheelWorkshopState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

export function reduceWheelWorkshopState(state: WheelWorkshopState, action: WheelWorkshopAction): WheelWorkshopState {
  if (action.type === "open") return advance(state, { phase: state.completedRoundCount >= 3 ? "finished" : getWheelPool(state.selectedGradeId).length ? "ready" : "empty", currentRound: null, hintLevel: 0, gentleMessage: READY_MESSAGE });
  if (action.type === "close") return advance(state, {
    phase: "closed",
    currentRound: null,
    hintLevel: 0,
    gentleMessage: "这道字光会在本机安静等你回来。",
  });
  if (action.type === "reset-corrupt-save") return createWheelWorkshopState(state.seed);
  if (action.type === "choose-grade") {
    const hasPool = getWheelPool(action.gradeId).length > 0;
    return advance(state, {
      selectedGradeId: action.gradeId,
      phase: hasPool ? "ready" : "empty",
      completedRoundCount: 0,
      sessionRecordIds: [],
      currentRound: null,
      hintLevel: 0,
      gentleMessage: hasPool ? "字卷已经放好。转动字轮吧。" : "这本字卷正在整理，换一本也能继续玩。",
    });
  }
  if (action.type === "start-round") {
    const restarting = state.phase === "finished";
    return advance(state, {
      phase: getWheelPool(state.selectedGradeId).length ? "ready" : "empty",
      completedRoundCount: restarting ? 0 : state.completedRoundCount,
      sessionRecordIds: restarting ? [] : state.sessionRecordIds,
      currentRound: null,
      hintLevel: 0,
      gentleMessage: READY_MESSAGE,
    });
  }
  if (action.type === "spin") {
    if (state.phase !== "ready") return state;
    const round = generateWheelRound({
      seed: state.seed,
      gradeId: state.selectedGradeId,
      completedRoundCount: state.completedRoundCount,
      sessionRecordIds: state.sessionRecordIds,
      recentRecordIds: state.recentRecordIds,
    });
    if (!round) return advance(state, { phase: "empty", gentleMessage: "这本字卷正在整理，换一本也能继续玩。" });
    return advance(state, { phase: "spinning", currentRound: round, hintLevel: 0, gentleMessage: "字轮正在寻找一个锚点部件……" });
  }
  if (action.type === "settle-spin") {
    if (state.phase !== "spinning" || !state.currentRound) return state;
    return advance(state, { phase: "choose-card", gentleMessage: "选出能和锚点合字的伙伴部件。" });
  }
  if (action.type === "select-card") {
    if (state.phase !== "choose-card" || !state.currentRound) return state;
    const card = state.currentRound.candidateCards.find((entry) => entry.id === action.cardId && !entry.removedByHint);
    if (!card) return state;
    if (card.kind !== "partner") return advance(state, { gentleMessage: "这个部件还没找到自己的位置。看看结构轮廓，再试一张。" });
    return advance(state, {
      phase: "place-card",
      currentRound: { ...state.currentRound, selectedCardId: card.id },
      gentleMessage: "伙伴找到了。现在把它送进空着的真实位置。",
    });
  }
  if (action.type === "place-card") {
    if (state.phase !== "place-card" || !state.currentRound?.selectedCardId) return state;
    const record = getPlayableWheelRecord(state.currentRound.recordId);
    const expectedSlot = record.slotIds[state.currentRound.partnerComponentIndex];
    if (action.slotId !== expectedSlot) return advance(state, { gentleMessage: "这个部件还没找到自己的位置。看看它是在右边、下边，还是里面。" });
    const discoveredRecordIds = [...new Set([...state.discoveredRecordIds, record.id])];
    const recentRecordIds = [...state.recentRecordIds.filter((id) => id !== record.id), record.id].slice(-12);
    return advance(state, {
      phase: "success",
      currentRound: { ...state.currentRound, placed: true },
      discoveredRecordIds,
      recentRecordIds,
      gentleMessage: "部件回到正确位置，完整字亮起来了。",
    });
  }
  if (action.type === "undo") {
    if (state.phase !== "place-card" || !state.currentRound) return state;
    return advance(state, { phase: "choose-card", currentRound: { ...state.currentRound, selectedCardId: null }, gentleMessage: "伙伴牌回到手边了，可以重新选择。" });
  }
  if (action.type === "request-hint") {
    if (!state.currentRound || !["choose-card", "place-card"].includes(state.phase)) return state;
    const nextLevel = Math.min(4, state.hintLevel + 1) as 1 | 2 | 3 | 4;
    let candidateCards = state.currentRound.candidateCards;
    if (nextLevel === 2) {
      let removed = false;
      candidateCards = candidateCards.map((card) => {
        if (!removed && card.kind === "distractor" && !card.removedByHint) { removed = true; return { ...card, removedByHint: true }; }
        return card;
      });
    }
    const messages = {
      1: "提示一：空着的正确槽位亮起来了。",
      2: "提示二：一张不合适的部件牌先休息。",
      3: "提示三：听一听熟悉词，再想想缺了哪个部件。",
      4: "最后提示：伙伴牌会轻轻发光；还要由你亲自选牌和放置。",
    } as const;
    return advance(state, { hintLevel: nextLevel, currentRound: { ...state.currentRound, candidateCards }, gentleMessage: messages[nextLevel] });
  }
  if (action.type === "continue") {
    if (state.phase !== "success" || !state.currentRound) return state;
    const completedRoundCount = state.completedRoundCount + 1;
    const sessionRecordIds = [...state.sessionRecordIds, state.currentRound.recordId];
    return advance(state, {
      completedRoundCount,
      sessionRecordIds,
      currentRound: null,
      hintLevel: 0,
      phase: completedRoundCount >= 3 ? "finished" : "ready",
      gentleMessage: completedRoundCount >= 3 ? "三道字光都收好了。随时可以回营地。" : READY_MESSAGE,
    });
  }
  if (action.type === "finish-session") return advance(state, { phase: "finished", currentRound: null, hintLevel: 0, gentleMessage: "这次字轮旅程已经安全收好。" });
  return state;
}

export function replayWheelWorkshopActions(seed: string, selectedGradeId: WheelGradeSelection, actions: readonly WheelWorkshopAction[]): WheelWorkshopState {
  return actions.reduce(reduceWheelWorkshopState, createWheelWorkshopState(seed, { selectedGradeId }));
}

export function wheelStateIsPossible(state: WheelWorkshopState): boolean {
  if (state.completedRoundCount < 0 || state.completedRoundCount > 3) return false;
  if (["spinning", "choose-card", "place-card", "success"].includes(state.phase) !== Boolean(state.currentRound)) return false;
  if (state.phase === "place-card" && !state.currentRound?.selectedCardId) return false;
  if (state.phase === "success" && !state.currentRound?.placed) return false;
  if (state.currentRound && !getWheelPool(state.selectedGradeId).some((record) => record.id === state.currentRound?.recordId)) return false;
  return true;
}
