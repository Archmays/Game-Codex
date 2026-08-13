import {
  HANZI_MAGIC_V1_ADVENTURES,
  getV1Adventure,
  getV1Character,
  getV1Encounter,
  type V1AdventureId,
  type V1Encounter,
  type V1EncounterId,
  type V1SlotId,
} from "../golden-slice/content/adventures";
import type { AbilityId, GoldenCharacterId } from "../golden-slice/content/types";

export type V1Phase =
  | "camp"
  | "adventure-intro"
  | "encounter"
  | "boss-interference"
  | "composition"
  | "meaning"
  | "repair"
  | "chapter-report"
  | "ending"
  | "spellbook";

export interface V1Placement {
  readonly cardId: string;
  readonly slotId: V1SlotId;
}

export interface V1AbilityEffectState {
  readonly selectedAbilityId: AbilityId;
  readonly abilityEffectTriggered: boolean;
  readonly abilityEffectVisible: boolean;
  readonly abilityEffectStateVerified: boolean;
  readonly guardianCharge: 0 | 1;
  readonly safePathSlotId: V1SlotId | null;
  readonly inkEchoReady: boolean;
  readonly inkEchoReplayRequested: boolean;
}

export interface V1ChapterReport {
  readonly adventureId: V1AdventureId;
  readonly selectedAbilityId: AbilityId;
  readonly abilityEffectTriggered: boolean;
  readonly abilityEffectVisible: boolean;
  readonly abilityEffectStateVerified: boolean;
  readonly completedCharacterIds: readonly GoldenCharacterId[];
  readonly repairStage: 1 | 2 | 3;
}

export interface V1SafeRoute {
  readonly adventureId: V1AdventureId;
  readonly encounterIndex: 0 | 1 | 2 | 3;
  readonly selectedAbilityId: AbilityId | null;
  readonly replay: boolean;
}

export interface V1ProgressSeed {
  readonly completedAdventureIds?: readonly V1AdventureId[];
  readonly unlockedAdventureIds?: readonly V1AdventureId[];
  readonly discoveredCharacterIds?: readonly GoldenCharacterId[];
  readonly campRepairStage?: 0 | 1 | 2 | 3;
  readonly selectedAbilityHistory?: readonly AbilityId[];
  readonly lastSafeRoute?: V1SafeRoute | null;
  readonly freeAdventureUnlocked?: boolean;
}

export interface V1GameState {
  readonly seed: string;
  readonly phase: V1Phase;
  readonly previousPhase: Exclude<V1Phase, "spellbook"> | null;
  readonly currentAdventureId: V1AdventureId | null;
  readonly encounterIndex: 0 | 1 | 2 | 3;
  readonly currentEncounterId: V1EncounterId | null;
  readonly replay: boolean;
  readonly selectedAbilityId: AbilityId | null;
  readonly abilityEffect: V1AbilityEffectState | null;
  readonly placements: readonly V1Placement[];
  readonly selectedCardId: string | null;
  readonly handCardIds: readonly string[];
  readonly invalidPlacementCount: number;
  readonly hintLevel: 0 | 1 | 2;
  readonly gentleMessage: string;
  readonly bossInterferenceActive: boolean;
  readonly inputLocked: boolean;
  readonly completedAdventureIds: readonly V1AdventureId[];
  readonly unlockedAdventureIds: readonly V1AdventureId[];
  readonly discoveredCharacterIds: readonly GoldenCharacterId[];
  readonly campRepairStage: 0 | 1 | 2 | 3;
  readonly selectedAbilityHistory: readonly AbilityId[];
  readonly chapterReports: readonly V1ChapterReport[];
  readonly lastSafeRoute: V1SafeRoute | null;
  readonly freeAdventureUnlocked: boolean;
  readonly completedV1: boolean;
  readonly endingBookSeen: boolean;
}

export type V1Action =
  | { readonly type: "start-adventure"; readonly adventureId: V1AdventureId; readonly replay?: boolean }
  | { readonly type: "begin-adventure" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly slotId: V1SlotId; readonly cardId?: string }
  | { readonly type: "undo" }
  | { readonly type: "request-hint" }
  | { readonly type: "continue" }
  | { readonly type: "choose-ability"; readonly abilityId: AbilityId }
  | { readonly type: "clear-interference" }
  | { readonly type: "repair-world" }
  | { readonly type: "continue-from-report" }
  | { readonly type: "finish-ending" }
  | { readonly type: "open-spellbook" }
  | { readonly type: "close-spellbook" }
  | { readonly type: "return-camp" };

const ABILITY_IDS = new Set<AbilityId>(["guardian-light", "star-path", "ink-echo"]);

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function cardOrderForSeed(encounter: V1Encounter, seed: string): readonly string[] {
  const cards = [...encounter.cards];
  let state = hashSeed(`${seed}:${encounter.id}`) || 1;
  for (let index = cards.length - 1; index > 0; index -= 1) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const swapIndex = (state >>> 0) % (index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards.map((card) => card.id);
}

function initialAbilityEffect(selectedAbilityId: AbilityId | null, encounter: V1Encounter): V1AbilityEffectState | null {
  if (!selectedAbilityId || encounter.kind !== "boss-phase") return null;
  const firstSlot = getV1Character(encounter.characterId).components[0].slotId;
  return {
    selectedAbilityId,
    abilityEffectTriggered: selectedAbilityId !== "ink-echo",
    abilityEffectVisible: selectedAbilityId !== "ink-echo",
    abilityEffectStateVerified: selectedAbilityId !== "ink-echo",
    guardianCharge: selectedAbilityId === "guardian-light" ? 1 : 0,
    safePathSlotId: selectedAbilityId === "star-path" ? firstSlot : null,
    inkEchoReady: selectedAbilityId === "ink-echo",
    inkEchoReplayRequested: false,
  };
}

function loadEncounter(state: V1GameState, encounterIndex: 0 | 1 | 2 | 3): V1GameState {
  if (!state.currentAdventureId) return state;
  const adventure = getV1Adventure(state.currentAdventureId);
  const encounter = getV1Encounter(adventure.encounterIds[encounterIndex]);
  return {
    ...state,
    phase: "encounter",
    previousPhase: null,
    encounterIndex,
    currentEncounterId: encounter.id,
    abilityEffect: initialAbilityEffect(state.selectedAbilityId, encounter),
    placements: [],
    selectedCardId: null,
    handCardIds: cardOrderForSeed(encounter, state.seed),
    invalidPlacementCount: 0,
    hintLevel: 0,
    gentleMessage: encounter.prompt,
    bossInterferenceActive: false,
    inputLocked: false,
    lastSafeRoute: {
      adventureId: state.currentAdventureId,
      encounterIndex,
      selectedAbilityId: state.selectedAbilityId,
      replay: state.replay,
    },
  };
}

export function createV1GameState(seed = "hanzi-magic-v1", progress: V1ProgressSeed = {}): V1GameState {
  const completed = unique(progress.completedAdventureIds ?? []);
  const unlocked = unique<V1AdventureId>(progress.unlockedAdventureIds?.length ? progress.unlockedAdventureIds : ["glimmer-path"]);
  const completedV1 = completed.length === HANZI_MAGIC_V1_ADVENTURES.length;
  const base: V1GameState = {
    seed,
    phase: "camp",
    previousPhase: null,
    currentAdventureId: null,
    encounterIndex: 0,
    currentEncounterId: null,
    replay: false,
    selectedAbilityId: null,
    abilityEffect: null,
    placements: [],
    selectedCardId: null,
    handCardIds: [],
    invalidPlacementCount: 0,
    hintLevel: 0,
    gentleMessage: completedV1 ? "三条路都亮着，想走哪一条都可以。" : "墨迹森林在等第一道字光。",
    bossInterferenceActive: false,
    inputLocked: false,
    completedAdventureIds: completed,
    unlockedAdventureIds: unlocked,
    discoveredCharacterIds: unique(progress.discoveredCharacterIds ?? []),
    campRepairStage: progress.campRepairStage ?? 0,
    selectedAbilityHistory: [...(progress.selectedAbilityHistory ?? [])],
    chapterReports: [],
    lastSafeRoute: progress.lastSafeRoute ?? null,
    freeAdventureUnlocked: progress.freeAdventureUnlocked ?? completedV1,
    completedV1,
    endingBookSeen: completedV1,
  };
  if (!progress.lastSafeRoute) return base;
  const safe = progress.lastSafeRoute;
  if (!unlocked.includes(safe.adventureId) && !completed.includes(safe.adventureId)) return base;
  return loadEncounter({
    ...base,
    currentAdventureId: safe.adventureId,
    replay: safe.replay,
    selectedAbilityId: safe.selectedAbilityId,
  }, safe.encounterIndex);
}

function addDiscovered(state: V1GameState, characterId: GoldenCharacterId): readonly GoldenCharacterId[] {
  return unique([...state.discoveredCharacterIds, characterId]);
}

function nextAfterMeaning(state: V1GameState): V1GameState {
  if (state.encounterIndex === 0) return loadEncounter(state, 1);
  if (state.encounterIndex === 1) {
    return {
      ...state,
      phase: "adventure-intro",
      gentleMessage: "选一道魔法，和它一起走过两段首领墨雾。",
      inputLocked: false,
      currentEncounterId: null,
      placements: [],
      handCardIds: [],
    };
  }
  if (state.encounterIndex === 2) return loadEncounter(state, 3);
  return { ...state, phase: "repair", currentEncounterId: null, inputLocked: false, gentleMessage: "四道字光聚在一起，世界正在等你修好它。" };
}

function invalidPlacement(state: V1GameState, safeSlotId: V1SlotId): V1GameState {
  const invalidPlacementCount = state.invalidPlacementCount + 1;
  const hintLevel = Math.min(2, Math.max(state.hintLevel, invalidPlacementCount >= 2 ? 2 : 1)) as 0 | 1 | 2;
  let abilityEffect = state.abilityEffect;
  if (abilityEffect?.selectedAbilityId === "guardian-light" && abilityEffect.guardianCharge === 1) {
    abilityEffect = {
      ...abilityEffect,
      abilityEffectTriggered: true,
      abilityEffectVisible: true,
      abilityEffectStateVerified: true,
      guardianCharge: 0,
      safePathSlotId: safeSlotId,
    };
  }
  return {
    ...state,
    invalidPlacementCount,
    hintLevel,
    abilityEffect,
    selectedCardId: null,
    gentleMessage: invalidPlacementCount >= 2 ? "这道字光在另一处，亮起的槽位会带路。" : "它想去别的位置，再试一试。",
  };
}

export function stepV1Game(state: V1GameState, action: V1Action): V1GameState {
  if (action.type === "open-spellbook") {
    return {
      ...state,
      previousPhase: state.phase === "spellbook" ? state.previousPhase : state.phase,
      phase: "spellbook",
      inputLocked: true,
      endingBookSeen: state.endingBookSeen || state.phase === "ending",
    };
  }
  if (action.type === "close-spellbook" && state.phase === "spellbook") {
    return { ...state, phase: state.previousPhase ?? "camp", previousPhase: null, inputLocked: false };
  }
  if (action.type === "return-camp") {
    return { ...state, phase: "camp", previousPhase: null, currentAdventureId: null, currentEncounterId: null, lastSafeRoute: null, inputLocked: false };
  }

  if (action.type === "start-adventure" && state.phase === "camp") {
    const allowed = state.unlockedAdventureIds.includes(action.adventureId) || (Boolean(action.replay) && state.completedAdventureIds.includes(action.adventureId));
    if (!allowed) return { ...state, gentleMessage: "这条路还在等前一道字光。" };
    return {
      ...state,
      phase: "adventure-intro",
      currentAdventureId: action.adventureId,
      currentEncounterId: null,
      encounterIndex: 0,
      replay: Boolean(action.replay),
      selectedAbilityId: null,
      abilityEffect: null,
      lastSafeRoute: null,
      gentleMessage: getV1Adventure(action.adventureId).purpose,
    };
  }
  if (action.type === "begin-adventure" && state.phase === "adventure-intro" && state.currentAdventureId && !state.selectedAbilityId) {
    return loadEncounter(state, 0);
  }
  if (action.type === "choose-ability" && state.phase === "adventure-intro" && state.currentAdventureId && ABILITY_IDS.has(action.abilityId)) {
    return loadEncounter({ ...state, selectedAbilityId: action.abilityId }, 2);
  }
  if (action.type === "select-card" && state.phase === "encounter" && !state.inputLocked && state.currentEncounterId) {
    const encounter = getV1Encounter(state.currentEncounterId);
    if (!encounter.cards.some((card) => card.id === action.cardId) || state.placements.some((placement) => placement.cardId === action.cardId)) return state;
    return { ...state, selectedCardId: action.cardId, hintLevel: 0, gentleMessage: "再选一个发光的位置。" };
  }
  if (action.type === "place-card" && state.phase === "encounter" && !state.inputLocked && state.currentEncounterId) {
    const encounter = getV1Encounter(state.currentEncounterId);
    const cardId = action.cardId ?? state.selectedCardId;
    const card = encounter.cards.find((entry) => entry.id === cardId);
    if (!card || state.placements.some((placement) => placement.slotId === action.slotId || placement.cardId === card.id)) return invalidPlacement(state, action.slotId);
    if (card.kind !== "target" || card.expectedSlotId !== action.slotId) return invalidPlacement(state, card.expectedSlotId ?? action.slotId);
    const placements = [...state.placements, { cardId: card.id, slotId: action.slotId }];
    const targetCount = encounter.cards.filter((entry) => entry.kind === "target").length;
    const discoveredCharacterIds = placements.length === targetCount ? addDiscovered(state, encounter.characterId) : state.discoveredCharacterIds;
    const safePathSlotId = state.abilityEffect?.selectedAbilityId === "star-path"
      ? getV1Character(encounter.characterId).components.find((component) => !placements.some((placement) => placement.slotId === component.slotId))?.slotId ?? null
      : state.abilityEffect?.safePathSlotId ?? null;
    const abilityEffect = state.abilityEffect ? { ...state.abilityEffect, safePathSlotId } : null;
    if (placements.length === targetCount) {
      return {
        ...state,
        phase: "composition",
        placements,
        selectedCardId: null,
        abilityEffect,
        discoveredCharacterIds,
        inputLocked: true,
        bossInterferenceActive: false,
        gentleMessage: "部件合在一起，字光出现了。",
      };
    }
    if (encounter.kind === "boss-phase" && placements.length === 1) {
      return {
        ...state,
        phase: "boss-interference",
        placements,
        selectedCardId: null,
        abilityEffect,
        bossInterferenceActive: true,
        inputLocked: true,
        gentleMessage: state.selectedAbilityId === "ink-echo" ? "墨雾来了，用墨回声把它轻轻送开。" : "墨雾挡了一下，已经放好的字光还在。",
      };
    }
    return { ...state, placements, selectedCardId: null, abilityEffect, hintLevel: 0, gentleMessage: "这块已经找到位置了。" };
  }
  if (action.type === "clear-interference" && state.phase === "boss-interference") {
    let abilityEffect = state.abilityEffect;
    if (abilityEffect?.selectedAbilityId === "ink-echo") {
      abilityEffect = {
        ...abilityEffect,
        abilityEffectTriggered: true,
        abilityEffectVisible: true,
        abilityEffectStateVerified: true,
        inkEchoReady: false,
        inkEchoReplayRequested: true,
      };
    }
    return { ...state, phase: "encounter", abilityEffect, bossInterferenceActive: false, inputLocked: false, gentleMessage: "墨雾散开了，继续把字光送回位置。" };
  }
  if (action.type === "undo" && state.phase === "encounter" && state.placements.length) {
    return { ...state, placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "可以换一块再试。" };
  }
  if (action.type === "request-hint" && state.phase === "encounter") {
    if (state.hintLevel === 2) return state;
    return { ...state, hintLevel: Math.min(2, state.hintLevel + 1) as 0 | 1 | 2, gentleMessage: state.hintLevel >= 1 ? "亮起的槽位在等它的字光。" : "跟着轻轻闪动的路径看看。" };
  }
  if (action.type === "continue" && state.phase === "composition") {
    return { ...state, phase: "meaning", inputLocked: false, gentleMessage: "这道魔法只是在讲字义，不是在讲字源。" };
  }
  if (action.type === "continue" && state.phase === "meaning") return nextAfterMeaning(state);
  if (action.type === "repair-world" && state.phase === "repair" && state.currentAdventureId && state.selectedAbilityId) {
    const adventure = getV1Adventure(state.currentAdventureId);
    const completedAdventureIds = unique([...state.completedAdventureIds, adventure.id]);
    const next = HANZI_MAGIC_V1_ADVENTURES[adventure.sequence];
    const unlockedAdventureIds = next ? unique([...state.unlockedAdventureIds, next.id]) : state.unlockedAdventureIds;
    const abilityEffect = state.abilityEffect ?? initialAbilityEffect(state.selectedAbilityId, getV1Encounter(adventure.encounterIds[3]))!;
    const report: V1ChapterReport = {
      adventureId: adventure.id,
      selectedAbilityId: state.selectedAbilityId,
      abilityEffectTriggered: abilityEffect.abilityEffectTriggered,
      abilityEffectVisible: abilityEffect.abilityEffectVisible,
      abilityEffectStateVerified: abilityEffect.abilityEffectStateVerified,
      completedCharacterIds: adventure.characterIds,
      repairStage: adventure.repair.stage,
    };
    const completedV1 = completedAdventureIds.length === HANZI_MAGIC_V1_ADVENTURES.length;
    return {
      ...state,
      phase: "chapter-report",
      completedAdventureIds,
      unlockedAdventureIds,
      campRepairStage: Math.max(state.campRepairStage, adventure.repair.stage) as 0 | 1 | 2 | 3,
      selectedAbilityHistory: [...state.selectedAbilityHistory, state.selectedAbilityId],
      chapterReports: [...state.chapterReports, report],
      lastSafeRoute: null,
      freeAdventureUnlocked: state.freeAdventureUnlocked || completedV1,
      completedV1,
      gentleMessage: adventure.repair.description,
    };
  }
  if (action.type === "continue-from-report" && state.phase === "chapter-report") {
    if (state.completedV1 && !state.replay) return { ...state, phase: "ending", inputLocked: false, gentleMessage: "十二道字光一起照亮了墨迹森林。" };
    return { ...state, phase: "camp", currentAdventureId: null, currentEncounterId: null, selectedAbilityId: null, abilityEffect: null, replay: false, inputLocked: false };
  }
  if (action.type === "finish-ending" && state.phase === "ending" && state.endingBookSeen) {
    return { ...state, phase: "camp", currentAdventureId: null, currentEncounterId: null, selectedAbilityId: null, abilityEffect: null, freeAdventureUnlocked: true, inputLocked: false, gentleMessage: "自由冒险亮起来了，三条路都可以再走。" };
  }
  return state;
}
