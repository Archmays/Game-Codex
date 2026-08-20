import type { M3HeroId } from "../../v2/chapter-one/builds";
import { createDeterministicRng } from "../../v2/chapter-one/rng";
import { COMPLETE_CORE_CHARACTER_NODES } from "../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import type { CompleteSlotId } from "../content-graph/types";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import type { CompletePostgameMode } from "../core/complete-types";
import {
  createCompletePostgamePlan,
  type CompletePostgameBand,
  type CompletePostgameOffer,
  type CompletePostgamePlan,
} from "./contracts";

export type CompletePostgamePhase =
  | "mode-intro"
  | "offer-choice"
  | "character-build"
  | "character-meaning"
  | "family-build"
  | "family-meaning"
  | "family-link"
  | "word-build-a"
  | "word-meaning-a"
  | "word-build-b"
  | "word-meaning-b"
  | "word-order"
  | "word-context"
  | "round-complete"
  | "session-summary";

export interface CompletePostgamePlacement {
  readonly cardId: string;
  readonly slotId: CompleteSlotId;
}

export interface CompletePostgameBuildCard {
  readonly id: string;
  readonly componentId: string;
  readonly glyph: string;
  readonly placementInstanceId: string | null;
}

export interface CompletePostgameState {
  readonly schemaVersion: 1;
  readonly phase: CompletePostgamePhase;
  readonly roundIndex: number;
  readonly selectedOfferId: string | null;
  readonly currentCharacterId: string | null;
  readonly currentFamilyId: string | null;
  readonly currentWordId: string | null;
  readonly selectedCardId: string | null;
  readonly placements: readonly CompletePostgamePlacement[];
  readonly wordOrderCharacterIds: readonly string[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredFamilyIds: readonly string[];
  readonly discoveredWordIds: readonly string[];
  readonly completedOfferIds: readonly string[];
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type CompletePostgameAction =
  | { readonly type: "start" }
  | { readonly type: "choose-offer"; readonly offerId: string }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-selected"; readonly slotId: CompleteSlotId }
  | { readonly type: "place-card"; readonly cardId: string; readonly slotId: CompleteSlotId }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "choose-family"; readonly familyId: string }
  | { readonly type: "place-word-character"; readonly characterId: string }
  | { readonly type: "choose-context"; readonly wordId: string };

export interface CompletePostgameRun {
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly mode: CompletePostgameMode;
  readonly band: CompletePostgameBand;
  readonly plan: CompletePostgamePlan;
  readonly state: CompletePostgameState;
  readonly actions: readonly CompletePostgameAction[];
}

const SLOT_IDS = new Set<string>(["left", "right", "top", "bottom", "outer", "inner"]);

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function character(id: string) {
  const result = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Unknown postgame character ${id}`);
  return result;
}

function word(id: string) {
  const result = COMPLETE_WORD_NODES.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Unknown postgame word ${id}`);
  return result;
}

function currentOffer(plan: CompletePostgamePlan, state: CompletePostgameState): CompletePostgameOffer | null {
  if (!state.selectedOfferId) return null;
  return plan.rounds[state.roundIndex]?.offers.find((offer) => offer.id === state.selectedOfferId) ?? null;
}

function advance(state: CompletePostgameState, patch: Partial<CompletePostgameState>): CompletePostgameState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

export function createCompletePostgameRun(
  seed: string,
  initialHeroId: M3HeroId,
  mode: CompletePostgameMode,
  band: CompletePostgameBand = "whole-forest",
): CompletePostgameRun {
  const plan = createCompletePostgamePlan(seed, initialHeroId, mode, band);
  return {
    seed: plan.seed,
    initialHeroId,
    mode,
    band,
    plan,
    state: {
      schemaVersion: 1,
      phase: "mode-intro",
      roundIndex: 0,
      selectedOfferId: null,
      currentCharacterId: null,
      currentFamilyId: null,
      currentWordId: null,
      selectedCardId: null,
      placements: [],
      wordOrderCharacterIds: [],
      discoveredCharacterIds: [],
      discoveredFamilyIds: [],
      discoveredWordIds: [],
      completedOfferIds: [],
      gentleMessage: "这段林路没有倒计时，也不会失去已经发现的字光。",
      actionCount: 0,
    },
    actions: [],
  };
}

export function getCompletePostgameBuildCards(run: CompletePostgameRun): readonly CompletePostgameBuildCard[] {
  const target = run.state.currentCharacterId ? character(run.state.currentCharacterId) : null;
  if (!target) return [];
  const targetCards = target.components.map((component) => ({
    id: `${run.plan.rounds[run.state.roundIndex].id}-${target.id}-${component.order}`,
    componentId: component.componentId,
    glyph: component.glyph,
    placementInstanceId: component.instanceId,
  }));
  const targetComponentIds = new Set(target.components.map((component) => component.componentId));
  const distractor = createDeterministicRng(`${run.seed}:${run.state.roundIndex}:${target.id}:hand`)
    .shuffle(COMPLETE_CORE_CHARACTER_NODES.flatMap((candidate) => candidate.components))
    .find((component) => !targetComponentIds.has(component.componentId));
  const cards = distractor ? [...targetCards, { id: `${run.plan.rounds[run.state.roundIndex].id}-${target.id}-visitor`, componentId: distractor.componentId, glyph: distractor.glyph, placementInstanceId: null }] : targetCards;
  return createDeterministicRng(`${run.seed}:${run.state.roundIndex}:${target.id}:card-order`).shuffle(cards);
}

export function getCompletePostgameFamilyChoices(run: CompletePostgameRun) {
  if (!run.state.currentFamilyId) return [];
  const correct = COMPLETE_COMPONENT_FAMILIES.find((family) => family.id === run.state.currentFamilyId)!;
  const others = createDeterministicRng(`${run.seed}:${run.state.roundIndex}:family-choices`)
    .shuffle(COMPLETE_COMPONENT_FAMILIES.filter((family) => family.id !== correct.id)).slice(0, 2);
  return createDeterministicRng(`${run.seed}:${run.state.roundIndex}:family-order`).shuffle([correct, ...others]);
}

export function getCompletePostgameContextChoices(run: CompletePostgameRun) {
  if (!run.state.currentWordId) return [];
  const correct = word(run.state.currentWordId);
  const others = createDeterministicRng(`${run.seed}:${run.state.roundIndex}:context-choices`)
    .shuffle(COMPLETE_WORD_NODES.filter((candidate) => candidate.id !== correct.id)).slice(0, 2);
  return createDeterministicRng(`${run.seed}:${run.state.roundIndex}:context-order`).shuffle([correct, ...others]);
}

function placeBuildCard(run: CompletePostgameRun, cardId: string, slotId: CompleteSlotId): CompletePostgameRun {
  const state = run.state;
  const activeBuild = ["character-build", "family-build", "word-build-a", "word-build-b"].includes(state.phase);
  if (!activeBuild || !state.currentCharacterId || state.placements.some((placement) => placement.cardId === cardId || placement.slotId === slotId)) return run;
  const cards = getCompletePostgameBuildCards(run);
  const card = cards.find((candidate) => candidate.id === cardId);
  const target = character(state.currentCharacterId);
  const placement = target.components.find((component) => component.instanceId === card?.placementInstanceId);
  if (!card || !placement || placement.slotId !== slotId) {
    return { ...run, state: advance(state, { selectedCardId: null, gentleMessage: "这块字灵还不住在这里；原来的位置和进度都保留。" }) };
  }
  if (slotId === "inner" && target.components.some((component) => component.slotId === "outer") && !state.placements.some((entry) => entry.slotId === "outer")) {
    return { ...run, state: advance(state, { selectedCardId: null, gentleMessage: "先放好外框，里面的字灵就有清楚的位置了。" }) };
  }
  const placements = [...state.placements, { cardId, slotId }];
  const complete = placements.length === target.components.length;
  if (!complete) return { ...run, state: advance(state, { placements, selectedCardId: null, gentleMessage: "字灵稳稳落下了，再看下一处真实位置。" }) };
  const discoveredCharacterIds = unique([...state.discoveredCharacterIds, target.id]);
  const phase: CompletePostgamePhase = state.phase === "character-build" ? "character-meaning" : state.phase === "family-build" ? "family-meaning" : state.phase === "word-build-a" ? "word-meaning-a" : "word-meaning-b";
  return { ...run, state: advance(state, { placements, selectedCardId: null, discoveredCharacterIds, phase, gentleMessage: `${target.glyph}已经完整合成；现在看它自己的读音和意思。` }) };
}

function reduceCompletePostgameState(run: CompletePostgameRun, action: CompletePostgameAction): CompletePostgameRun {
  const state = run.state;
  if (action.type === "start" && state.phase === "mode-intro") {
    return { ...run, state: advance(state, { phase: "offer-choice", gentleMessage: "三道字光都能走完；选喜欢的一道就好。" }) };
  }
  if (action.type === "choose-offer" && state.phase === "offer-choice") {
    const offer = run.plan.rounds[state.roundIndex]?.offers.find((candidate) => candidate.id === action.offerId);
    if (!offer) return run;
    const chosen = {
      selectedOfferId: offer.id,
      currentCharacterId: offer.characterId,
      currentFamilyId: offer.kind === "family" ? offer.targetId : null,
      currentWordId: offer.kind === "word" ? offer.targetId : null,
      selectedCardId: null,
      placements: [],
      wordOrderCharacterIds: [],
      phase: (offer.kind === "character" ? "character-build" : offer.kind === "family" ? "family-build" : "word-build-a") as CompletePostgamePhase,
      gentleMessage: offer.kind === "word" ? "先合成词语里的第一个完整字。" : "先把完整字的部件送回真实位置。",
    };
    return { ...run, state: advance(state, chosen) };
  }
  if (action.type === "select-card" && ["character-build", "family-build", "word-build-a", "word-build-b"].includes(state.phase)) {
    if (!getCompletePostgameBuildCards(run).some((card) => card.id === action.cardId) || state.placements.some((placement) => placement.cardId === action.cardId)) return run;
    return { ...run, state: advance(state, { selectedCardId: action.cardId, gentleMessage: "字灵已经拿在手边，请送到对应位置。" }) };
  }
  if (action.type === "place-selected" && state.selectedCardId) return placeBuildCard(run, state.selectedCardId, action.slotId);
  if (action.type === "place-card") return placeBuildCard(run, action.cardId, action.slotId);
  if (action.type === "undo" && ["character-build", "family-build", "word-build-a", "word-build-b"].includes(state.phase)) {
    if (!state.placements.length && !state.selectedCardId) return run;
    return { ...run, state: advance(state, { placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "上一步已经安全收回，可以重新放。" }) };
  }
  if (action.type === "undo" && state.phase === "word-order" && state.wordOrderCharacterIds.length) {
    return { ...run, state: advance(state, { wordOrderCharacterIds: state.wordOrderCharacterIds.slice(0, -1), gentleMessage: "词带退回一步，可以重新按阅读顺序放。" }) };
  }
  if (action.type === "continue" && state.phase === "character-meaning") {
    return { ...run, state: advance(state, { phase: "round-complete", gentleMessage: "完整字光已经落在这条自由林路上。" }) };
  }
  if (action.type === "continue" && state.phase === "family-meaning") {
    return { ...run, state: advance(state, { phase: "family-link", gentleMessage: "完整字已经看清；现在沿共享部件送回真实字脉。" }) };
  }
  if (action.type === "choose-family" && state.phase === "family-link" && state.currentFamilyId) {
    if (action.familyId !== state.currentFamilyId) return { ...run, state: advance(state, { gentleMessage: "这条根线不属于刚才的完整字；换一条也不会丢失进度。" }) };
    return { ...run, state: advance(state, { phase: "round-complete", discoveredFamilyIds: unique([...state.discoveredFamilyIds, action.familyId]), gentleMessage: "完整字回到了有真实共享部件依据的字脉。" }) };
  }
  if (action.type === "continue" && state.phase === "word-meaning-a" && state.currentWordId) {
    const target = word(state.currentWordId);
    return { ...run, state: advance(state, { phase: "word-build-b", currentCharacterId: target.characterIds[1], placements: [], selectedCardId: null, gentleMessage: "第一个完整字已经看清；现在合成第二个完整字。" }) };
  }
  if (action.type === "continue" && state.phase === "word-meaning-b") {
    return { ...run, state: advance(state, { phase: "word-order", placements: [], selectedCardId: null, wordOrderCharacterIds: [], gentleMessage: "两个完整字都准备好了，请按真实词序连接。" }) };
  }
  if (action.type === "place-word-character" && state.phase === "word-order" && state.currentWordId) {
    const target = word(state.currentWordId);
    const expected = target.characterIds[state.wordOrderCharacterIds.length];
    if (action.characterId !== expected) return { ...run, state: advance(state, { wordOrderCharacterIds: [], gentleMessage: `这次学习“${target.glyphs.join("")}”；先读${target.glyphs[0]}，原进度保留。` }) };
    const wordOrderCharacterIds = [...state.wordOrderCharacterIds, action.characterId];
    return { ...run, state: advance(state, { wordOrderCharacterIds, phase: wordOrderCharacterIds.length === 2 ? "word-context" : "word-order", gentleMessage: wordOrderCharacterIds.length === 2 ? "词序已经连好，再用真实语境确认它。" : "第一道字光已经就位。" }) };
  }
  if (action.type === "choose-context" && state.phase === "word-context" && state.currentWordId) {
    if (action.wordId !== state.currentWordId) return { ...run, state: advance(state, { gentleMessage: "这个场景属于另一条词带；当前词序和进度都保留。" }) };
    return { ...run, state: advance(state, { phase: "round-complete", discoveredWordIds: unique([...state.discoveredWordIds, action.wordId]), gentleMessage: "词序、读音和语境一起确认了这道共鸣。" }) };
  }
  if (action.type === "continue" && state.phase === "round-complete" && state.selectedOfferId) {
    const completedOfferIds = unique([...state.completedOfferIds, state.selectedOfferId]);
    const finalRound = state.roundIndex >= run.plan.rounds.length - 1;
    return { ...run, state: advance(state, {
      phase: finalRound ? "session-summary" : "offer-choice",
      roundIndex: finalRound ? state.roundIndex : state.roundIndex + 1,
      selectedOfferId: null,
      currentCharacterId: null,
      currentFamilyId: null,
      currentWordId: null,
      selectedCardId: null,
      placements: [],
      wordOrderCharacterIds: [],
      completedOfferIds,
      gentleMessage: finalRound ? "这次林路已经完整收好；没有分数，也没有失去任何发现。" : "下一处三道字光都已经亮起。",
    }) };
  }
  return run;
}

export function reduceCompletePostgameRun(run: CompletePostgameRun, action: CompletePostgameAction): CompletePostgameRun {
  const next = reduceCompletePostgameState(run, action);
  if (next === run) return run;
  return { ...next, actions: [...run.actions, action] };
}

export function replayCompletePostgameRun(
  seed: string,
  initialHeroId: M3HeroId,
  mode: CompletePostgameMode,
  band: CompletePostgameBand,
  actions: readonly CompletePostgameAction[],
): CompletePostgameRun {
  return actions.reduce(reduceCompletePostgameRun, createCompletePostgameRun(seed, initialHeroId, mode, band));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export function isCompletePostgameAction(value: unknown): value is CompletePostgameAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (action.type === "start" || action.type === "undo" || action.type === "continue") return exactKeys(action, ["type"]);
  if (action.type === "choose-offer") return exactKeys(action, ["type", "offerId"]) && typeof action.offerId === "string" && action.offerId.length <= 180;
  if (action.type === "select-card") return exactKeys(action, ["type", "cardId"]) && typeof action.cardId === "string" && action.cardId.length <= 180;
  if (action.type === "place-selected") return exactKeys(action, ["type", "slotId"]) && typeof action.slotId === "string" && SLOT_IDS.has(action.slotId);
  if (action.type === "place-card") return exactKeys(action, ["type", "cardId", "slotId"]) && typeof action.cardId === "string" && action.cardId.length <= 180 && typeof action.slotId === "string" && SLOT_IDS.has(action.slotId);
  if (action.type === "choose-family") return exactKeys(action, ["type", "familyId"]) && typeof action.familyId === "string" && action.familyId.length <= 180;
  if (action.type === "place-word-character") return exactKeys(action, ["type", "characterId"]) && typeof action.characterId === "string" && action.characterId.length <= 180;
  if (action.type === "choose-context") return exactKeys(action, ["type", "wordId"]) && typeof action.wordId === "string" && action.wordId.length <= 180;
  return false;
}

export interface CompletePostgameSimulationResult {
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
  readonly finalRun: CompletePostgameRun;
  readonly actions: readonly CompletePostgameAction[];
}

export function simulateCompletePostgame(
  mode: CompletePostgameMode,
  seed: string,
  heroId: M3HeroId = "light-speaker",
  band: CompletePostgameBand = "whole-forest",
  offerChoice = 0,
): CompletePostgameSimulationResult {
  let run = createCompletePostgameRun(seed, heroId, mode, band);
  const act = (action: CompletePostgameAction) => { run = reduceCompletePostgameRun(run, action); };
  for (let guard = 0; guard < 500 && run.state.phase !== "session-summary"; guard += 1) {
    const state = run.state;
    if (state.phase === "mode-intro") act({ type: "start" });
    else if (state.phase === "offer-choice") act({ type: "choose-offer", offerId: run.plan.rounds[state.roundIndex].offers[offerChoice % 3].id });
    else if (["character-build", "family-build", "word-build-a", "word-build-b"].includes(state.phase)) {
      const target = character(state.currentCharacterId!);
      const cards = getCompletePostgameBuildCards(run);
      const placement = target.components[state.placements.length];
      const card = cards.find((candidate) => candidate.placementInstanceId === placement.instanceId)!;
      act({ type: "place-card", cardId: card.id, slotId: placement.slotId });
    } else if (["character-meaning", "family-meaning", "word-meaning-a", "word-meaning-b", "round-complete"].includes(state.phase)) act({ type: "continue" });
    else if (state.phase === "family-link") act({ type: "choose-family", familyId: state.currentFamilyId! });
    else if (state.phase === "word-order") {
      const target = word(state.currentWordId!);
      act({ type: "place-word-character", characterId: target.characterIds[state.wordOrderCharacterIds.length] });
    } else if (state.phase === "word-context") act({ type: "choose-context", wordId: state.currentWordId! });
    else break;
  }
  const failureCodes: string[] = [];
  if (run.state.phase !== "session-summary") failureCodes.push("SESSION_NOT_COMPLETE");
  if (run.state.completedOfferIds.length !== 6) failureCodes.push("ROUND_COVERAGE");
  if (mode === "free-adventure" && run.state.discoveredCharacterIds.length !== 6) failureCodes.push("CHARACTER_COVERAGE");
  if (mode === "component-trails" && run.state.discoveredFamilyIds.length !== 6) failureCodes.push("FAMILY_COVERAGE");
  if (mode === "word-resonance" && run.state.discoveredWordIds.length !== 6) failureCodes.push("WORD_COVERAGE");
  return { passed: failureCodes.length === 0, failureCodes, finalRun: run, actions: run.actions };
}
