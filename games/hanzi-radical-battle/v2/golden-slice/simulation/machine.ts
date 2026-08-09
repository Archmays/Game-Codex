import { GOLDEN_ABILITIES } from "../content/abilities";
import { GOLDEN_BOSS_INTERFERENCE } from "../content/boss-interference";
import { getGoldenEncounter, GOLDEN_SLICE_ENCOUNTERS } from "../content/encounters";
import { GOLDEN_CHILD_COPY, type GoldenChildCopyId } from "../content/story-copy";
import type { AbilityId, BossPhaseId, GoldenEncounter, GoldenEncounterId } from "../content/types";
import {
  createStructureBoard,
  placeCard,
  removeCard,
  selectCard,
  type StructureBoardState,
} from "../../simulation/structure-board";
import { appendGoldenSliceEvent, type GoldenSliceEvent } from "./events";

export const GOLDEN_SLICE_DEFAULT_SEED = "hanzi-v2-golden-slice-v1";
export const MAX_GOLDEN_SLICE_REPLAYS = 2;

/**
 * The long names are intentional API: Phaser/DOM may render them independently,
 * while this data machine remains the single legal-transition source.
 */
export type GoldenSlicePhase =
  | "boot"
  | "camp_intro"
  | "camp_objective"
  | "travel_to_battle_1"
  | "battle_1_intro"
  | "battle_1_placing"
  | "battle_1_forming"
  | "battle_1_casting"
  | "battle_1_cleared"
  | "breather_1"
  | "travel_to_battle_2"
  | "battle_2_intro"
  | "battle_2_placing"
  | "battle_2_forming"
  | "battle_2_casting"
  | "battle_2_cleared"
  | "ability_choice"
  | "travel_to_boss"
  | "boss_intro"
  | "boss_phase_1_placing"
  | "boss_phase_1_forming"
  | "boss_phase_1_cleared"
  | "boss_phase_2_placing"
  | "boss_phase_2_forming"
  | "boss_cleared"
  | "return_to_camp"
  | "camp_repair"
  | "spellbook_review"
  | "run_complete"
  | "invalid_feedback"
  | "boss_interference"
  | "paused"
  | "settings_open"
  | "safe_retry";

export const GOLDEN_SLICE_PHASES = [
  "boot",
  "camp_intro",
  "camp_objective",
  "travel_to_battle_1",
  "battle_1_intro",
  "battle_1_placing",
  "battle_1_forming",
  "battle_1_casting",
  "battle_1_cleared",
  "breather_1",
  "travel_to_battle_2",
  "battle_2_intro",
  "battle_2_placing",
  "battle_2_forming",
  "battle_2_casting",
  "battle_2_cleared",
  "ability_choice",
  "travel_to_boss",
  "boss_intro",
  "boss_phase_1_placing",
  "boss_phase_1_forming",
  "boss_phase_1_cleared",
  "boss_phase_2_placing",
  "boss_phase_2_forming",
  "boss_cleared",
  "return_to_camp",
  "camp_repair",
  "spellbook_review",
  "run_complete",
  "invalid_feedback",
  "boss_interference",
  "paused",
  "settings_open",
  "safe_retry",
] as const satisfies readonly GoldenSlicePhase[];

export type GoldenSliceMode = "play" | "review";
export type BoardPhase = Extract<GoldenSlicePhase, "battle_1_placing" | "battle_2_placing" | "boss_phase_1_placing" | "boss_phase_2_placing">;
export type ReviewJumpPhase = Extract<GoldenSlicePhase, "camp_intro" | "battle_1_intro" | "ability_choice" | "boss_intro" | "spellbook_review">;

export type GoldenSliceAction =
  | { readonly type: "start" }
  | { readonly type: "continue" }
  | { readonly type: "begin-placing" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly cardId: string; readonly slotId: string }
  | { readonly type: "remove-card"; readonly slotId: string }
  | { readonly type: "cancel-placement" }
  | { readonly type: "feedback-complete" }
  | { readonly type: "animation-complete" }
  | { readonly type: "choose-ability"; readonly abilityId: AbilityId }
  | { readonly type: "use-ability" }
  | { readonly type: "interference-complete" }
  | { readonly type: "safe-retry" }
  | { readonly type: "continue-after-safe-retry" }
  | { readonly type: "open-spellbook" }
  | { readonly type: "finish" }
  | { readonly type: "pause" }
  | { readonly type: "resume" }
  | { readonly type: "open-settings" }
  | { readonly type: "close-settings" }
  | { readonly type: "review-jump"; readonly phase: ReviewJumpPhase }
  | { readonly type: "replay"; readonly abilityId: AbilityId };

type ActionType = GoldenSliceAction["type"];

export interface BossInterferenceState {
  readonly bossPhaseId: BossPhaseId;
  readonly beforeInterference: StructureBoardState;
  readonly obscuredSlotIds: readonly string[];
  readonly durationMs: number;
}

export interface GoldenSliceState {
  readonly phase: GoldenSlicePhase;
  readonly mode: GoldenSliceMode;
  readonly seed: string;
  readonly replayCount: number;
  readonly encounterIndex: number;
  readonly currentEncounterId: GoldenEncounterId;
  readonly presentedCardIds: readonly string[];
  readonly board: StructureBoardState;
  readonly boardHistory: readonly StructureBoardState[];
  readonly returnBoardPhase: BoardPhase | null;
  readonly overlayReturnPhase: GoldenSlicePhase | null;
  readonly hintSlotId: string | null;
  readonly selectedAbilityId: AbilityId | null;
  /** One use is independently available in 林 and 星 boss phases. */
  readonly abilityUsedBossPhaseIds: readonly BossPhaseId[];
  readonly bossInterference: BossInterferenceState | null;
  readonly resolvedBossInterferencePhaseIds: readonly BossPhaseId[];
  readonly completedEncounterIds: readonly GoldenEncounterId[];
  readonly formedCharacterIds: readonly string[];
  readonly campRepaired: boolean;
  readonly copyId: GoldenChildCopyId;
  readonly events: readonly GoldenSliceEvent[];
}

const BASE_ACTIONS: Readonly<Record<GoldenSlicePhase, readonly ActionType[]>> = {
  boot: ["start", "review-jump"],
  camp_intro: ["continue", "pause", "open-settings", "review-jump"],
  camp_objective: ["continue", "pause", "open-settings"],
  travel_to_battle_1: ["continue", "pause"],
  battle_1_intro: ["begin-placing", "pause", "open-settings", "review-jump"],
  battle_1_placing: ["select-card", "place-card", "remove-card", "cancel-placement", "safe-retry", "pause", "open-settings"],
  battle_1_forming: ["animation-complete", "pause"],
  battle_1_casting: ["animation-complete", "pause"],
  battle_1_cleared: ["continue", "pause", "open-settings"],
  breather_1: ["continue", "pause", "open-settings"],
  travel_to_battle_2: ["continue", "pause"],
  battle_2_intro: ["begin-placing", "pause", "open-settings"],
  battle_2_placing: ["select-card", "place-card", "remove-card", "cancel-placement", "safe-retry", "pause", "open-settings"],
  battle_2_forming: ["animation-complete", "pause"],
  battle_2_casting: ["animation-complete", "pause"],
  battle_2_cleared: ["continue", "pause", "open-settings"],
  ability_choice: ["choose-ability", "pause", "open-settings", "review-jump"],
  travel_to_boss: ["continue", "pause"],
  boss_intro: ["begin-placing", "pause", "open-settings", "review-jump"],
  boss_phase_1_placing: ["select-card", "place-card", "remove-card", "cancel-placement", "safe-retry", "pause", "open-settings"],
  boss_phase_1_forming: ["animation-complete", "pause"],
  boss_phase_1_cleared: ["continue", "pause", "open-settings"],
  boss_phase_2_placing: ["select-card", "place-card", "remove-card", "cancel-placement", "safe-retry", "pause", "open-settings"],
  boss_phase_2_forming: ["animation-complete", "pause"],
  boss_cleared: ["continue", "pause", "open-settings"],
  return_to_camp: ["animation-complete", "pause"],
  camp_repair: ["continue", "pause", "open-settings"],
  spellbook_review: ["finish", "pause", "open-settings", "review-jump"],
  run_complete: ["replay", "pause", "open-settings"],
  invalid_feedback: ["feedback-complete", "safe-retry", "pause", "open-settings"],
  boss_interference: ["interference-complete", "use-ability", "safe-retry", "pause", "open-settings"],
  paused: ["resume"],
  settings_open: ["close-settings"],
  safe_retry: ["continue-after-safe-retry", "pause", "open-settings"],
};

function hasAction(state: GoldenSliceState, type: ActionType): boolean {
  return BASE_ACTIONS[state.phase].includes(type) && (type !== "review-jump" || state.mode === "review");
}

export function getLegalGoldenSliceActions(state: GoldenSliceState): readonly ActionType[] {
  return BASE_ACTIONS[state.phase].filter((type) => hasAction(state, type));
}

export function isGoldenSliceActionLegal(state: GoldenSliceState, action: GoldenSliceAction): boolean {
  return hasAction(state, action.type);
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicCardOrder(encounter: GoldenEncounter, seed: string): readonly string[] {
  const ordered = encounter.cards.map((card) => card.id);
  let random = hashSeed(`${seed}:${encounter.id}`) || 1;
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    const swapIndex = (random >>> 0) % (index + 1);
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}

function currentEncounter(state: GoldenSliceState): GoldenEncounter {
  return getGoldenEncounter(state.currentEncounterId);
}

function appendEvent(
  state: GoldenSliceState,
  id: GoldenSliceEvent["id"],
  encounterId: GoldenEncounterId | null = state.currentEncounterId,
  abilityId: AbilityId | null = state.selectedAbilityId,
): readonly GoldenSliceEvent[] {
  return appendGoldenSliceEvent(state.events, id, encounterId, abilityId);
}

function firstEmptyTargetSlot(board: StructureBoardState, encounter: GoldenEncounter): string | null {
  return encounter.slots.find((slot) => !board.placements[slot.id])?.id ?? null;
}

function bossPhaseIdForEncounter(encounter: GoldenEncounter): BossPhaseId | null {
  if (encounter.characterId === "lin" || encounter.characterId === "xing") return encounter.characterId;
  return null;
}

function boardPhaseFor(state: GoldenSliceState): BoardPhase {
  if (state.phase === "boss_phase_1_placing" || state.phase === "boss_phase_2_placing") return state.phase;
  if (state.phase === "battle_2_placing") return "battle_2_placing";
  return "battle_1_placing";
}

function stateForEncounter(
  state: GoldenSliceState,
  encounterIndex: number,
  phase: GoldenSlicePhase,
  copyId: GoldenChildCopyId = "enterEncounter",
): GoldenSliceState {
  const encounter = GOLDEN_SLICE_ENCOUNTERS[encounterIndex];
  return {
    ...state,
    phase,
    encounterIndex,
    currentEncounterId: encounter.id,
    presentedCardIds: deterministicCardOrder(encounter, state.seed),
    board: createStructureBoard(),
    boardHistory: [],
    returnBoardPhase: null,
    overlayReturnPhase: null,
    hintSlotId: null,
    bossInterference: null,
    copyId,
    events: appendGoldenSliceEvent(state.events, "encounter_started", encounter.id, state.selectedAbilityId),
  };
}

function enterBossPlacing(state: GoldenSliceState, phase: "boss_phase_1_placing" | "boss_phase_2_placing"): GoldenSliceState {
  const encounter = currentEncounter(state);
  const bossPhaseId = bossPhaseIdForEncounter(encounter);
  const starPath = state.selectedAbilityId === "star-path" && bossPhaseId !== null;
  return {
    ...state,
    phase,
    hintSlotId: starPath ? firstEmptyTargetSlot(state.board, encounter) : null,
    abilityUsedBossPhaseIds:
      starPath && bossPhaseId ? [...new Set([...state.abilityUsedBossPhaseIds, bossPhaseId])] : state.abilityUsedBossPhaseIds,
    copyId: starPath ? "starPath" : "chooseCard",
    events: starPath && bossPhaseId ? appendEvent(state, "ability_used", encounter.id, "star-path") : state.events,
  };
}

export function createGoldenSliceState(options: {
  readonly seed?: string;
  readonly mode?: GoldenSliceMode;
  readonly replayCount?: number;
  readonly replayAbilityId?: AbilityId | null;
} = {}): GoldenSliceState {
  const firstEncounter = GOLDEN_SLICE_ENCOUNTERS[0];
  const seed = options.seed?.trim() || GOLDEN_SLICE_DEFAULT_SEED;
  const base: GoldenSliceState = {
    phase: "boot",
    mode: options.mode ?? "play",
    seed,
    replayCount: options.replayCount ?? 0,
    encounterIndex: 0,
    currentEncounterId: firstEncounter.id,
    presentedCardIds: deterministicCardOrder(firstEncounter, seed),
    board: createStructureBoard(),
    boardHistory: [],
    returnBoardPhase: null,
    overlayReturnPhase: null,
    hintSlotId: null,
    selectedAbilityId: options.replayAbilityId ?? null,
    abilityUsedBossPhaseIds: [],
    bossInterference: null,
    resolvedBossInterferencePhaseIds: [],
    completedEncounterIds: [],
    formedCharacterIds: [],
    campRepaired: false,
    copyId: "campIntro",
    events: [],
  };
  return { ...base, events: appendGoldenSliceEvent(base.events, "run_started", null, base.selectedAbilityId) };
}

function resolveOverlay(state: GoldenSliceState, phase: "paused" | "settings_open"): GoldenSliceState {
  return { ...state, phase, overlayReturnPhase: state.phase };
}

function returnFromOverlay(state: GoldenSliceState): GoldenSliceState {
  return state.overlayReturnPhase ? { ...state, phase: state.overlayReturnPhase, overlayReturnPhase: null } : state;
}

function beginSafeRetry(state: GoldenSliceState): GoldenSliceState {
  const encounter = currentEncounter(state);
  const returnBoardPhase =
    state.phase === "boss_interference" ? (state.bossInterference?.bossPhaseId === "xing" ? "boss_phase_2_placing" : "boss_phase_1_placing")
      : state.returnBoardPhase ?? boardPhaseFor(state);
  const resolvedBossInterferencePhaseIds =
    state.phase === "boss_interference" && state.bossInterference
      ? [...new Set([...state.resolvedBossInterferencePhaseIds, state.bossInterference.bossPhaseId])]
      : state.resolvedBossInterferencePhaseIds;
  return {
    ...state,
    phase: "safe_retry",
    board: createStructureBoard(),
    boardHistory: [],
    returnBoardPhase,
    hintSlotId: null,
    bossInterference: null,
    resolvedBossInterferencePhaseIds,
    copyId: "safeRetry",
    events: appendEvent(state, "safe_retry_started", encounter.id),
  };
}

function completedStructure(state: GoldenSliceState, board: StructureBoardState): GoldenSliceState {
  const encounter = currentEncounter(state);
  const phase: GoldenSlicePhase =
    state.phase === "battle_1_placing" ? "battle_1_forming"
      : state.phase === "battle_2_placing" ? "battle_2_forming"
      : state.phase === "boss_phase_1_placing" ? "boss_phase_1_forming"
      : "boss_phase_2_forming";
  return {
    ...state,
    phase,
    board,
    boardHistory: [],
    hintSlotId: null,
    formedCharacterIds: [...state.formedCharacterIds, encounter.characterId],
    events: appendGoldenSliceEvent(appendEvent(state, "structure_completed", encounter.id), "character_formed", encounter.id, state.selectedAbilityId),
  };
}

function triggerBossInterference(state: GoldenSliceState, board: StructureBoardState, bossPhaseId: BossPhaseId): GoldenSliceState {
  const encounter = currentEncounter(state);
  const durationMs = GOLDEN_BOSS_INTERFERENCE.minimumDurationMs +
    (hashSeed(`${state.seed}:${encounter.id}:interference`) % (GOLDEN_BOSS_INTERFERENCE.maximumDurationMs - GOLDEN_BOSS_INTERFERENCE.minimumDurationMs + 1));
  return {
    ...state,
    phase: "boss_interference",
    board,
    boardHistory: [...state.boardHistory, state.board],
    bossInterference: {
      bossPhaseId,
      beforeInterference: state.board,
      obscuredSlotIds: encounter.slots.filter((slot) => !board.placements[slot.id]).map((slot) => slot.id),
      durationMs,
    },
    copyId: "bossInterference",
    events: appendEvent(state, "boss_interference", encounter.id),
  };
}

function placeOnBoard(state: GoldenSliceState, cardId: string, slotId: string): GoldenSliceState {
  const encounter = currentEncounter(state);
  const result = placeCard(state.board, encounter, cardId, slotId);
  if (result.kind === "placed") {
    const bossPhaseId = bossPhaseIdForEncounter(encounter);
    if (result.completed) return completedStructure(state, result.board);
    if (bossPhaseId && !state.resolvedBossInterferencePhaseIds.includes(bossPhaseId)) {
      return triggerBossInterference(state, result.board, bossPhaseId);
    }
    return {
      ...state,
      board: result.board,
      boardHistory: [...state.boardHistory, state.board],
      hintSlotId: null,
      events: appendEvent(state, "card_placed", encounter.id),
    };
  }
  if (result.kind !== "invalid") return state;

  const bossPhaseId = bossPhaseIdForEncounter(encounter);
  const guardianAvailable =
    state.selectedAbilityId === "guardian-light" &&
    bossPhaseId !== null &&
    !state.abilityUsedBossPhaseIds.includes(bossPhaseId);
  return {
    ...state,
    phase: "invalid_feedback",
    board: result.board,
    returnBoardPhase: boardPhaseFor(state),
    hintSlotId: guardianAvailable ? result.suggestedSlotId : null,
    abilityUsedBossPhaseIds: guardianAvailable && bossPhaseId
      ? [...new Set([...state.abilityUsedBossPhaseIds, bossPhaseId])]
      : state.abilityUsedBossPhaseIds,
    copyId: guardianAvailable ? "guardianLight" : "warmRetry",
    events: guardianAvailable && bossPhaseId
      ? appendGoldenSliceEvent(appendEvent(state, "placement_retried", encounter.id), "ability_used", encounter.id, "guardian-light")
      : appendEvent(state, "placement_retried", encounter.id),
  };
}

function useInkEcho(state: GoldenSliceState): GoldenSliceState {
  if (state.selectedAbilityId !== "ink-echo" || !state.bossInterference) return state;
  const phaseId = state.bossInterference.bossPhaseId;
  if (state.abilityUsedBossPhaseIds.includes(phaseId)) return state;
  return {
    ...state,
    abilityUsedBossPhaseIds: [...new Set([...state.abilityUsedBossPhaseIds, phaseId])],
    copyId: "bossRecovery",
    events: appendEvent(state, "ability_used", state.currentEncounterId, "ink-echo"),
  };
}

function reviewJump(state: GoldenSliceState, phase: ReviewJumpPhase): GoldenSliceState {
  if (state.mode !== "review") return state;
  if (phase === "camp_intro") return { ...state, phase, copyId: "campIntro", board: createStructureBoard(), boardHistory: [], hintSlotId: null };
  if (phase === "battle_1_intro") return stateForEncounter(state, 0, phase);
  if (phase === "ability_choice") return stateForEncounter(state, 1, phase, "chooseAbility");
  if (phase === "boss_intro") return stateForEncounter(state, 2, phase);
  return stateForEncounter(state, 3, phase, "spellbook");
}

export function stepGoldenSlice(state: GoldenSliceState, action: GoldenSliceAction): GoldenSliceState {
  if (!isGoldenSliceActionLegal(state, action)) return state;
  const encounter = currentEncounter(state);

  if (action.type === "pause") return resolveOverlay(state, "paused");
  if (action.type === "open-settings") return resolveOverlay(state, "settings_open");
  if (action.type === "resume" || action.type === "close-settings") return returnFromOverlay(state);
  if (action.type === "review-jump") return reviewJump({ ...state, events: appendEvent(state, "review_jumped") }, action.phase);
  if (action.type === "start") return { ...state, phase: "camp_intro", copyId: "campIntro" };
  if (action.type === "begin-placing") {
    if (state.phase === "battle_1_intro") return { ...state, phase: "battle_1_placing", copyId: "chooseCard" };
    if (state.phase === "battle_2_intro") return { ...state, phase: "battle_2_placing", copyId: "chooseCard" };
    return enterBossPlacing(state, "boss_phase_1_placing");
  }
  if (action.type === "select-card") {
    const result = selectCard(state.board, encounter, action.cardId);
    return result.kind === "selected"
      ? { ...state, board: result.board, hintSlotId: null, copyId: "chooseSlot", events: appendEvent(state, "card_selected") }
      : state;
  }
  if (action.type === "place-card") return placeOnBoard(state, action.cardId, action.slotId);
  if (action.type === "remove-card") {
    const result = removeCard(state.board, encounter, action.slotId);
    return result.kind === "removed"
      ? { ...state, board: result.board, boardHistory: [...state.boardHistory, state.board], hintSlotId: null, copyId: "chooseCard" }
      : state;
  }
  if (action.type === "cancel-placement") {
    const previous = state.boardHistory.at(-1);
    return {
      ...state,
      board: previous ?? { ...state.board, selectedCardId: null },
      boardHistory: previous ? state.boardHistory.slice(0, -1) : state.boardHistory,
      hintSlotId: null,
      copyId: "chooseCard",
      events: appendEvent(state, "placement_cancelled"),
    };
  }
  if (action.type === "feedback-complete") return { ...state, phase: state.returnBoardPhase ?? "battle_1_placing", returnBoardPhase: null, hintSlotId: null, copyId: "chooseCard" };
  if (action.type === "safe-retry") return beginSafeRetry(state);
  if (action.type === "continue-after-safe-retry") return { ...state, phase: state.returnBoardPhase ?? "battle_1_placing", returnBoardPhase: null, copyId: "chooseCard" };
  if (action.type === "use-ability") return useInkEcho(state);
  if (action.type === "interference-complete") {
    const bossPhaseId = state.bossInterference?.bossPhaseId;
    const phase: BoardPhase = bossPhaseId === "xing" ? "boss_phase_2_placing" : "boss_phase_1_placing";
    return {
      ...state,
      phase,
      hintSlotId: null,
      bossInterference: null,
      resolvedBossInterferencePhaseIds: bossPhaseId
        ? [...new Set([...state.resolvedBossInterferencePhaseIds, bossPhaseId])]
        : state.resolvedBossInterferencePhaseIds,
      copyId: "chooseCard",
    };
  }
  if (action.type === "animation-complete") {
    if (state.phase === "battle_1_forming") return { ...state, phase: "battle_1_casting" };
    if (state.phase === "battle_1_casting") {
      return { ...state, phase: "battle_1_cleared", completedEncounterIds: [...state.completedEncounterIds, encounter.id], events: appendEvent(state, "spell_cast") };
    }
    if (state.phase === "battle_2_forming") return { ...state, phase: "battle_2_casting" };
    if (state.phase === "battle_2_casting") {
      return { ...state, phase: "battle_2_cleared", completedEncounterIds: [...state.completedEncounterIds, encounter.id], events: appendEvent(state, "spell_cast") };
    }
    if (state.phase === "boss_phase_1_forming") {
      return { ...state, phase: "boss_phase_1_cleared", completedEncounterIds: [...state.completedEncounterIds, encounter.id], events: appendEvent(state, "spell_cast") };
    }
    if (state.phase === "boss_phase_2_forming") {
      return { ...state, phase: "boss_cleared", completedEncounterIds: [...state.completedEncounterIds, encounter.id], events: appendEvent(state, "spell_cast") };
    }
    if (state.phase === "return_to_camp") {
      return { ...state, phase: "camp_repair", campRepaired: true, copyId: "campRepaired", events: appendEvent(state, "camp_repaired", null) };
    }
    return state;
  }
  if (action.type === "choose-ability") {
    if (!GOLDEN_ABILITIES.some((ability) => ability.id === action.abilityId)) return state;
    return { ...state, phase: "travel_to_boss", selectedAbilityId: action.abilityId, copyId: "chooseAbility", events: appendEvent(state, "ability_chosen", encounter.id, action.abilityId) };
  }
  if (action.type === "open-spellbook") return { ...state, phase: "spellbook_review", copyId: "spellbook", events: appendEvent(state, "spellbook_opened", null) };
  if (action.type === "finish") return { ...state, phase: "run_complete", copyId: "replay", events: appendEvent(state, "run_completed", null) };
  if (action.type === "replay") {
    if (state.replayCount >= MAX_GOLDEN_SLICE_REPLAYS || action.abilityId === state.selectedAbilityId) return state;
    const replayed = createGoldenSliceState({ seed: state.seed, mode: state.mode, replayCount: state.replayCount + 1, replayAbilityId: action.abilityId });
    return { ...replayed, events: appendGoldenSliceEvent(replayed.events, "replay_started", null, action.abilityId) };
  }
  if (action.type === "continue") {
    if (state.phase === "camp_intro") return { ...state, phase: "camp_objective", copyId: "enterEncounter" };
    if (state.phase === "camp_objective") return { ...state, phase: "travel_to_battle_1", copyId: "enterEncounter" };
    if (state.phase === "travel_to_battle_1") return stateForEncounter(state, 0, "battle_1_intro");
    if (state.phase === "battle_1_cleared") return { ...state, phase: "breather_1", copyId: "enterEncounter" };
    if (state.phase === "breather_1") return { ...state, phase: "travel_to_battle_2", copyId: "enterEncounter" };
    if (state.phase === "travel_to_battle_2") return stateForEncounter(state, 1, "battle_2_intro");
    if (state.phase === "battle_2_cleared") return { ...state, phase: "ability_choice", copyId: "chooseAbility" };
    if (state.phase === "travel_to_boss") return stateForEncounter(state, 2, "boss_intro");
    if (state.phase === "boss_phase_1_cleared") {
      return enterBossPlacing(stateForEncounter(state, 3, "boss_phase_2_placing", "chooseCard"), "boss_phase_2_placing");
    }
    if (state.phase === "boss_cleared") return { ...state, phase: "return_to_camp", copyId: "returnCamp" };
    if (state.phase === "camp_repair") return { ...state, phase: "spellbook_review", copyId: "spellbook", events: appendEvent(state, "spellbook_opened", null) };
  }
  return state;
}

export function getGoldenSliceCopy(state: GoldenSliceState): string {
  return GOLDEN_CHILD_COPY[state.copyId];
}
