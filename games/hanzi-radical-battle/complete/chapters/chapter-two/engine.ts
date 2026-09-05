import type { M3HeroId } from "../../../v2/chapter-one/builds";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../content-graph/families";
import type { CompleteSlotId } from "../../content-graph/types";
import {
  PILOT_SIX_RULESET, PILOT_SIX_DEFINITIONS, freshPilotProgress, getPilotSixDefinition,
  pilotEncounterKey, pilotReachable, samePilotEdge,
  type ChapterTwoRuleset, type PilotEncounterProgress, type PilotExpression,
} from "./pilot-six";
import { createCompleteCharacterHand, type CompleteHandCard } from "../../core/content-solvers";
import {
  CHAPTER_TWO_EPISODES,
  CHAPTER_TWO_NEW_ABILITY_IDS,
  type ChapterTwoAbilityId,
  type ChapterTwoBehaviorId,
  type ChapterTwoBossId,
} from "./contracts";

export type ChapterTwoPhase =
  | "chapter-intro" | "ability-choice" | "behavior-telegraph" | "behavior-effect"
  | "build" | "composition" | "meaning" | "pilot-meaning" | "family-inspect" | "family-connect" | "family-result"
  | "episode-repair" | "episode-complete" | "core-intro" | "ending" | "chapter-summary";

export interface ChapterTwoPlacement { readonly cardId: string; readonly slotId: CompleteSlotId }
export interface ChapterTwoBossEvidence { readonly bossId: ChapterTwoBossId; readonly behaviorIds: readonly ChapterTwoBehaviorId[]; readonly allPreviouslyIntroduced: boolean }

export interface ChapterTwoState {
  readonly schemaVersion: 1;
  readonly ruleset?: ChapterTwoRuleset;
  readonly pilotProgress?: Readonly<Record<string, PilotEncounterProgress>>;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly phase: ChapterTwoPhase;
  readonly episodeIndex: 0 | 1 | 2 | 3;
  readonly encounterIndex: number;
  readonly currentCharacterId: string | null;
  readonly currentFamilyId: string | null;
  readonly hand: readonly CompleteHandCard[];
  readonly placements: readonly ChapterTwoPlacement[];
  readonly selectedCardId: string | null;
  readonly familySelectedCharacterIds: readonly string[];
  readonly activeBehaviorIds: readonly ChapterTwoBehaviorId[];
  readonly introducedBehaviorIds: readonly ChapterTwoBehaviorId[];
  readonly completedBehaviorIds: readonly ChapterTwoBehaviorId[];
  readonly currentBossId: ChapterTwoBossId | null;
  readonly completedBossIds: readonly ChapterTwoBossId[];
  readonly bossEvidence: readonly ChapterTwoBossEvidence[];
  readonly abilityOfferIds: readonly ChapterTwoAbilityId[];
  readonly offeredAbilityIds: readonly ChapterTwoAbilityId[];
  readonly selectedAbilityIds: readonly ChapterTwoAbilityId[];
  readonly triggeredAbilityIds: readonly ChapterTwoAbilityId[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredFamilyIds: readonly string[];
  readonly completedEpisodeIds: readonly string[];
  readonly repairedObjectIds: readonly string[];
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type ChapterTwoAction =
  | { readonly type: "start" }
  | { readonly type: "choose-ability"; readonly abilityId: ChapterTwoAbilityId }
  | { readonly type: "begin-behavior" }
  | { readonly type: "recover-behavior" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly cardId: string; readonly slotId: CompleteSlotId }
  | { readonly type: "place-selected"; readonly slotId: CompleteSlotId }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "toggle-family-character"; readonly characterId: string }
  | { readonly type: "connect-family" }
  | { readonly type: "pilot-magic"; readonly expression?: PilotExpression }
  | { readonly type: "pilot-move"; readonly nodeId: string }
  | { readonly type: "pilot-observe" }
  | { readonly type: "start-core" }
  | { readonly type: "finish-ending" };

export interface ChapterTwoSimulationResult {
  readonly actions: readonly ChapterTwoAction[];
  readonly finalState: ChapterTwoState;
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
}

export interface ChapterTwoRun {
  readonly ruleset?: ChapterTwoRuleset;
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly actions: readonly ChapterTwoAction[];
  readonly state: ChapterTwoState;
}

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function episode(state: ChapterTwoState) { return CHAPTER_TWO_EPISODES[state.episodeIndex]; }
function character(id: string) { return COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id)!; }
function family(id: string) { return COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === id)!; }

function counted(previous: ChapterTwoState, next: ChapterTwoState): ChapterTwoState {
  return next === previous ? previous : { ...next, actionCount: previous.actionCount + 1 };
}

function currentEncounter(episodeIndex: number, encounterIndex: number) {
  const definition = CHAPTER_TWO_EPISODES[episodeIndex];
  return { characterId: definition.storyCharacterIds[encounterIndex], familyId: definition.familyIds[encounterIndex] };
}

function prepareBuild(state: ChapterTwoState, encounterIndex: number): ChapterTwoState {
  const encounter = currentEncounter(state.episodeIndex, encounterIndex);
  const pilot = getPilotSixDefinition({ ...state, encounterIndex });
  return {
    ...state,
    phase: "build",
    encounterIndex,
    currentCharacterId: encounter.characterId,
    currentFamilyId: encounter.familyId,
    hand: createCompleteCharacterHand(encounter.characterId),
    placements: [],
    selectedCardId: null,
    familySelectedCharacterIds: [],
    ...(pilot ? {
      pilotProgress: { ...state.pilotProgress, [pilotEncounterKey(pilot)]: state.pilotProgress?.[pilotEncounterKey(pilot)] ?? freshPilotProgress() },
      introducedBehaviorIds: unique([...state.introducedBehaviorIds, ...(pilot.object === "ink-leaves" || pilot.object === "leaf-gate" ? ["family-root-mist" as const] : pilot.object === "stone-path" ? ["family-variant-shadow" as const] : [])]),
    } : {}),
    gentleMessage: "把字灵送回真实位置；点选和拖动都可以。",
  };
}

function prepareAbilityChoice(state: ChapterTwoState, episodeIndex: 0 | 1 | 2): ChapterTwoState {
  if (state.ruleset === PILOT_SIX_RULESET && episodeIndex < 2) return prepareBuild({ ...state, episodeIndex, currentBossId: null, activeBehaviorIds: CHAPTER_TWO_EPISODES[episodeIndex].behaviorIds }, 0);
  const offer = CHAPTER_TWO_NEW_ABILITY_IDS.filter((id) => !state.selectedAbilityIds.includes(id));
  return {
    ...state,
    phase: "ability-choice",
    episodeIndex,
    encounterIndex: 0,
    currentCharacterId: null,
    currentFamilyId: null,
    abilityOfferIds: offer,
    offeredAbilityIds: unique([...state.offeredAbilityIds, ...offer]),
    activeBehaviorIds: CHAPTER_TWO_EPISODES[episodeIndex].behaviorIds,
    currentBossId: null,
    gentleMessage: `${CHAPTER_TWO_EPISODES[episodeIndex].name}有几道都不会代答的字脉能力。`,
  };
}

function triggerAbility(state: ChapterTwoState, abilityId: ChapterTwoAbilityId): ChapterTwoState {
  return state.selectedAbilityIds.includes(abilityId)
    ? { ...state, triggeredAbilityIds: unique([...state.triggeredAbilityIds, abilityId]) }
    : state;
}

function prepareBoss(state: ChapterTwoState, encounterIndex: number): ChapterTwoState {
  const definition = episode(state);
  const evidence = {
    bossId: definition.bossId,
    behaviorIds: definition.behaviorIds,
    allPreviouslyIntroduced: definition.behaviorIds.every((id) => state.introducedBehaviorIds.includes(id)),
  } satisfies ChapterTwoBossEvidence;
  const encounter = currentEncounter(state.episodeIndex, encounterIndex);
  if (getPilotSixDefinition({ ...state, encounterIndex })) return prepareBuild({ ...state, currentBossId: definition.bossId, activeBehaviorIds: definition.behaviorIds, bossEvidence: [...state.bossEvidence, evidence] }, encounterIndex);
  return {
    ...state,
    phase: "behavior-telegraph",
    encounterIndex,
    currentCharacterId: encounter.characterId,
    currentFamilyId: encounter.familyId,
    activeBehaviorIds: definition.behaviorIds,
    currentBossId: definition.bossId,
    bossEvidence: [...state.bossEvidence, evidence],
    gentleMessage: "守护者只会组合已经看见并恢复过的动作。",
  };
}

export function createChapterTwoState(seed = "component-roots-return", heroId: M3HeroId = "light-speaker", ruleset?: ChapterTwoRuleset): ChapterTwoState {
  if (ruleset !== undefined && ruleset !== PILOT_SIX_RULESET) throw new Error("UNKNOWN_CHAPTER_TWO_RULESET");
  return {
    schemaVersion: 1,
    ...(ruleset ? { ruleset, pilotProgress: {} } : {}),
    seed,
    heroId,
    phase: "chapter-intro",
    episodeIndex: 0,
    encounterIndex: 0,
    currentCharacterId: null,
    currentFamilyId: null,
    hand: [],
    placements: [],
    selectedCardId: null,
    familySelectedCharacterIds: [],
    activeBehaviorIds: [],
    introducedBehaviorIds: [],
    completedBehaviorIds: [],
    currentBossId: null,
    completedBossIds: [],
    bossEvidence: [],
    abilityOfferIds: [],
    offeredAbilityIds: [],
    selectedAbilityIds: [],
    triggeredAbilityIds: [],
    discoveredCharacterIds: [],
    discoveredFamilyIds: [],
    completedEpisodeIds: [],
    repairedObjectIds: [],
    gentleMessage: "树冠上的十二条故事字脉正在等待真实完整字。",
    actionCount: 0,
  };
}

export function createChapterTwoRun(seed: string, heroId: M3HeroId, ruleset: ChapterTwoRuleset = PILOT_SIX_RULESET): ChapterTwoRun {
  return { seed, initialHeroId: heroId, ruleset, actions: [], state: createChapterTwoState(seed, heroId, ruleset) };
}

export function replayChapterTwoRun(seed: string, heroId: M3HeroId, actions: readonly ChapterTwoAction[], ruleset?: ChapterTwoRuleset): ChapterTwoRun {
  return { seed, initialHeroId: heroId, ...(ruleset ? { ruleset } : {}), actions: [...actions], state: replayChapterTwoActions(seed, heroId, actions, ruleset) };
}

export function reduceChapterTwoRun(run: ChapterTwoRun, action: ChapterTwoAction): ChapterTwoRun {
  const state = reduceChapterTwoState(run.state, action);
  return state === run.state ? run : { ...run, actions: [...run.actions, action], state };
}

function placeCard(state: ChapterTwoState, cardId: string, slotId: CompleteSlotId): ChapterTwoState {
  if (state.phase !== "build" || !state.currentCharacterId || state.placements.some((placement) => placement.cardId === cardId || placement.slotId === slotId)) return state;
  const card = state.hand.find((candidate) => candidate.id === cardId);
  const target = character(state.currentCharacterId);
  if (!card || !target.components.some((component) => component.slotId === slotId)) return state;
  if (card.kind !== "target" || card.expectedSlotId !== slotId) return { ...state, selectedCardId: null, gentleMessage: "这道字灵不住在这里；原来的进度都保留。" };
  const placements = [...state.placements, { cardId, slotId }];
  if (placements.length < target.components.length) return { ...state, placements, selectedCardId: null, gentleMessage: "位置正确，下一道字灵也有自己的家。" };
  return {
    ...state,
    phase: getPilotSixDefinition(state) ? "pilot-meaning" : "composition",
    placements,
    selectedCardId: null,
    discoveredCharacterIds: unique([...state.discoveredCharacterIds, target.id]),
    ...(getPilotSixDefinition(state)?.object === "stone-path" ? { completedBehaviorIds: unique([...state.completedBehaviorIds, "family-variant-shadow" as const]) } : {}),
    gentleMessage: `${target.glyph}已经完整合起来。`,
  };
}

function finishFamilyResult(state: ChapterTwoState): ChapterTwoState {
  const definition = episode(state);
  const encounterCount = definition.storyCharacterIds.length;
  if (state.encounterIndex < encounterCount - 2) return prepareBuild(state, state.encounterIndex + 1);
  if (state.encounterIndex === encounterCount - 2 && state.episodeIndex < 3) return prepareBoss(state, state.encounterIndex + 1);
  if (state.encounterIndex < encounterCount - 1) return prepareBuild(state, state.encounterIndex + 1);
  return {
    ...state,
    phase: "episode-repair",
    completedBossIds: unique([...state.completedBossIds, definition.bossId]),
    completedEpisodeIds: unique([...state.completedEpisodeIds, definition.id]),
    repairedObjectIds: unique([...state.repairedObjectIds, definition.repairId]),
    currentCharacterId: null,
    currentFamilyId: null,
    hand: [],
    placements: [],
    gentleMessage: `${definition.name}的修复已经由真实合字和字脉连接点亮。`,
  };
}

export function getPilotProgress(state: ChapterTwoState): PilotEncounterProgress {
  const pilot = getPilotSixDefinition(state);
  return pilot ? state.pilotProgress?.[pilotEncounterKey(pilot)] ?? freshPilotProgress() : freshPilotProgress();
}

function reducePilotAction(state: ChapterTwoState, action: ChapterTwoAction): ChapterTwoState | undefined {
  const pilot = getPilotSixDefinition(state);
  if (!pilot || !["build", "pilot-meaning", "family-connect", "family-result"].includes(state.phase)) return action.type.startsWith("pilot-") ? state : undefined;
  const current = getPilotProgress(state);
  const progress = (patch: Partial<PilotEncounterProgress>, other: Partial<ChapterTwoState> = {}): ChapterTwoState => ({
    ...state, ...other, pilotProgress: { ...state.pilotProgress, [pilotEncounterKey(pilot)]: { ...current, ...patch } },
  });
  const finish = (next: ChapterTwoState): ChapterTwoState => {
    const done = getPilotProgress(next);
    return pilotReachable(pilot.startId, done.edges).has(pilot.endId) && (pilot.object !== "leaf-gate" || done.mistCleared)
      ? triggerAbility({ ...next, phase: "family-result", discoveredFamilyIds: unique([...next.discoveredFamilyIds, pilot.familyId]), gentleMessage: "入口和终点接通了！你接出的通路已经留在这里。" }, "family-root-link")
      : next;
  };
  if (action.type === "pilot-magic") {
    if (state.phase !== "pilot-meaning" || pilot.object === "waterwheel" || current.magicApplied) return state;
    if (pilot.object === "vine" ? !["quiet", "talk"].includes(String(action.expression)) : action.expression !== undefined) return state;
    return progress({ magicApplied: true, expression: action.expression ?? null, mistCleared: pilot.object === "ink-leaves" }, {
      phase: "family-connect", gentleMessage: pilot.afterMessage,
      ...(pilot.object === "ink-leaves" ? { completedBehaviorIds: unique([...state.completedBehaviorIds, "family-root-mist" as const]) } : {}),
    });
  }
  if (action.type === "pilot-move") {
    if (pilot.object !== "waterwheel" || state.phase !== "pilot-meaning") return state;
    const road = PILOT_SIX_DEFINITIONS[4];
    const roadProgress = state.pilotProgress?.[pilotEncounterKey(road)];
    if (!road.nodeIds.includes(action.nodeId) || !roadProgress?.edges.some((edge) => samePilotEdge(edge, current.wheelNodeId, action.nodeId))) return { ...state, gentleMessage: "那里还没有相连的路。请选小水轮旁边已经接通的落脚点。" };
    const arrived = action.nodeId === road.endId;
    return progress({ wheelNodeId: action.nodeId, magicApplied: arrived }, { phase: arrived ? "family-connect" : "pilot-meaning", gentleMessage: arrived ? pilot.afterMessage : "小水轮沿已有道路前进了一步。再选一个相邻的落脚点。" });
  }
  if (action.type === "pilot-observe") {
    if (pilot.object !== "leaf-gate" || current.mistCleared || !state.discoveredCharacterIds.includes(PILOT_SIX_DEFINITIONS[0].characterId) || !["pilot-meaning", "family-connect"].includes(state.phase)) return state;
    return finish(progress({ mistCleared: true }, { completedBehaviorIds: unique([...state.completedBehaviorIds, "family-root-mist" as const]), gentleMessage: "指光把守护者的根雾照开了。已经接好的线完整显回。" }));
  }
  if (action.type === "toggle-family-character" && state.phase === "family-connect") {
    if (![...pilot.nodeIds, pilot.decoyId].includes(action.characterId)) return state;
    const selected = state.familySelectedCharacterIds.includes(action.characterId) ? state.familySelectedCharacterIds.filter((id) => id !== action.characterId) : [...state.familySelectedCharacterIds, action.characterId].slice(-2);
    return { ...state, familySelectedCharacterIds: selected, gentleMessage: selected.length === 2 ? "看看这两个字里的部件，再把它们连接。" : "再选一个字碑，看看部件是否属于这条字脉。" };
  }
  if (action.type === "connect-family" && state.phase === "family-connect") {
    const selected = state.familySelectedCharacterIds;
    if (selected.length !== 2) return { ...state, gentleMessage: "先选两个字碑，再连接它们。" };
    if (!selected.every((id) => family(pilot.familyId).memberCharacterIds.includes(id))) {
      const decoy = character(pilot.decoyId);
      return { ...state, familySelectedCharacterIds: [], gentleMessage: `${decoy.glyph}里的${decoy.components[0].glyph}和这条字脉的部件不同。已接好的路都在，再找找。` };
    }
    if (current.edges.some((edge) => samePilotEdge(edge, selected[0], selected[1]))) return { ...state, gentleMessage: "这段已经接好了。看看入口和终点是否相通。" };
    return finish(progress({ edges: [...current.edges, [selected[0], selected[1]]] }, { familySelectedCharacterIds: [], gentleMessage: pilot.object === "leaf-gate" && !current.mistCleared ? "这段路接好了。用已学的指光照开根雾，再看看入口能否通到叶门。" : "这段路接好了；还要把入口和终点接通。" }));
  }
  return undefined;
}

export function reduceChapterTwoState(state: ChapterTwoState, action: ChapterTwoAction): ChapterTwoState {
  const pilotNext = reducePilotAction(state, action);
  if (pilotNext !== undefined) return counted(state, pilotNext);
  let next = state;
  switch (action.type) {
    case "start":
      if (state.phase === "chapter-intro") next = prepareAbilityChoice(state, 0);
      break;
    case "choose-ability":
      if (state.phase === "ability-choice" && state.abilityOfferIds.includes(action.abilityId)) {
        next = {
          ...state,
          phase: "behavior-telegraph",
          selectedAbilityIds: unique([...state.selectedAbilityIds, action.abilityId]),
          currentBossId: null,
          gentleMessage: "先看清干扰预告；它不会移动答案。",
        };
      }
      break;
    case "begin-behavior":
      if (state.phase === "behavior-telegraph") next = { ...state, phase: "behavior-effect", gentleMessage: "干扰正在显示，完整字、部件、槽位与进度都没有改变。" };
      break;
    case "recover-behavior":
      if (state.phase === "behavior-effect") {
        next = prepareBuild({
          ...state,
          introducedBehaviorIds: unique([...state.introducedBehaviorIds, ...state.activeBehaviorIds]),
          completedBehaviorIds: unique([...state.completedBehaviorIds, ...state.activeBehaviorIds]),
        }, state.encounterIndex);
        next = triggerAbility(next, "family-echo-trace");
      }
      break;
    case "select-card":
      if (state.phase === "build" && state.hand.some((card) => card.id === action.cardId) && !state.placements.some((placement) => placement.cardId === action.cardId)) {
        next = { ...state, selectedCardId: state.selectedCardId === action.cardId ? null : action.cardId, gentleMessage: "再选它要去的真实槽位。" };
      }
      break;
    case "place-selected":
      if (state.selectedCardId) next = placeCard(state, state.selectedCardId, action.slotId);
      break;
    case "place-card":
      next = placeCard(state, action.cardId, action.slotId);
      break;
    case "undo":
      if (state.phase === "build" && state.placements.length) next = { ...state, placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "上一步已安全收回。" };
      break;
    case "continue":
      if (state.phase === "composition") next = { ...state, phase: "meaning", gentleMessage: "先读完整字、熟悉词和短义。" };
      else if (state.phase === "meaning") next = triggerAbility({ ...state, phase: "family-inspect", familySelectedCharacterIds: [], gentleMessage: "现在只看有来源支持的共享部件关系。" }, "family-variant-lantern");
      else if (state.phase === "family-inspect") next = { ...state, phase: "family-connect", gentleMessage: "选两个字脉成员，再亲手连接。" };
      else if (state.phase === "family-result") next = finishFamilyResult(state);
      else if (state.phase === "episode-repair") {
        if (state.episodeIndex < 2) next = { ...state, phase: "episode-complete", gentleMessage: "这片区域已保存，可以继续或稍后回来。" };
        else if (state.episodeIndex === 2) next = { ...state, phase: "core-intro", episodeIndex: 3, encounterIndex: 0, currentBossId: null, gentleMessage: "树心只组合三片区域已经学过的规则。" };
        else next = { ...state, phase: "ending", currentBossId: null, gentleMessage: "十二条故事字脉回到树心；不需要收集全部字。" };
      } else if (state.phase === "episode-complete" && state.episodeIndex < 2) next = prepareAbilityChoice(state, (state.episodeIndex + 1) as 1 | 2);
      break;
    case "toggle-family-character":
      if (state.phase === "family-connect" && state.currentFamilyId && family(state.currentFamilyId).memberCharacterIds.includes(action.characterId)) {
        const selected = state.familySelectedCharacterIds.includes(action.characterId)
          ? state.familySelectedCharacterIds.filter((id) => id !== action.characterId)
          : [...state.familySelectedCharacterIds, action.characterId].slice(-2);
        next = { ...state, familySelectedCharacterIds: selected, gentleMessage: selected.length === 2 ? "两个完整字已选好，可以连接字脉。" : "再选一个属于这条字脉的完整字。" };
      }
      break;
    case "connect-family":
      if (state.phase === "family-connect" && state.currentFamilyId) {
        const members = family(state.currentFamilyId).memberCharacterIds;
        if (state.familySelectedCharacterIds.length === 2 && state.familySelectedCharacterIds.every((id) => members.includes(id))) {
          next = triggerAbility({
            ...state,
            phase: "family-result",
            discoveredFamilyIds: unique([...state.discoveredFamilyIds, state.currentFamilyId]),
            gentleMessage: "连接成立；共享关系只按来源说明，完整字义仍分别确认。",
          }, "family-root-link");
        } else next = { ...state, gentleMessage: "先选两个属于当前字脉的完整字。" };
      }
      break;
    case "start-core":
      if (state.phase === "core-intro") next = prepareBoss({ ...state, activeBehaviorIds: CHAPTER_TWO_EPISODES[3].behaviorIds }, 0);
      break;
    case "finish-ending":
      if (state.phase === "ending") next = { ...state, phase: "chapter-summary", gentleMessage: "第二章完成，第三章家灯小镇的路已经亮起。" };
      break;
  }
  return counted(state, next);
}

export function replayChapterTwoActions(seed: string, heroId: M3HeroId, actions: readonly ChapterTwoAction[], ruleset?: ChapterTwoRuleset): ChapterTwoState {
  return actions.reduce(reduceChapterTwoState, createChapterTwoState(seed, heroId, ruleset));
}

export function isChapterTwoAction(value: unknown, ruleset?: ChapterTwoRuleset): value is ChapterTwoAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.type !== "string") return false;
  if (action.type.startsWith("pilot-")) {
    if (ruleset !== PILOT_SIX_RULESET) return false;
    if (action.type === "pilot-observe") return Object.keys(action).length === 1;
    if (action.type === "pilot-move") return Object.keys(action).sort().join("|") === "nodeId|type" && typeof action.nodeId === "string" && action.nodeId.length <= 80;
    if (action.type === "pilot-magic") return Object.keys(action).sort().join("|") === "type" || (Object.keys(action).sort().join("|") === "expression|type" && ["quiet", "talk"].includes(String(action.expression)));
    return false;
  }
  if (["start", "begin-behavior", "recover-behavior", "undo", "continue", "connect-family", "start-core", "finish-ending"].includes(action.type)) return Object.keys(action).length === 1;
  if (action.type === "choose-ability") return Object.keys(action).sort().join("|") === "abilityId|type" && CHAPTER_TWO_NEW_ABILITY_IDS.includes(action.abilityId as ChapterTwoAbilityId);
  if (action.type === "select-card") return Object.keys(action).sort().join("|") === "cardId|type" && typeof action.cardId === "string";
  if (action.type === "toggle-family-character") return Object.keys(action).sort().join("|") === "characterId|type" && typeof action.characterId === "string";
  const slots = new Set(["left", "right", "top", "bottom", "outer", "inner"]);
  if (action.type === "place-selected") return Object.keys(action).sort().join("|") === "slotId|type" && typeof action.slotId === "string" && slots.has(action.slotId);
  if (action.type === "place-card") return Object.keys(action).sort().join("|") === "cardId|slotId|type" && typeof action.cardId === "string" && typeof action.slotId === "string" && slots.has(action.slotId);
  return false;
}

export function simulateChapterTwo(seed: string, heroId: M3HeroId = "light-speaker"): ChapterTwoSimulationResult {
  let state = createChapterTwoState(seed, heroId);
  const actions: ChapterTwoAction[] = [];
  const act = (action: ChapterTwoAction) => {
    const next = reduceChapterTwoState(state, action);
    if (next.actionCount === state.actionCount) throw new Error(`Chapter Two simulator produced illegal action ${action.type} in ${state.phase}`);
    actions.push(action);
    state = next;
  };
  for (let guard = 0; guard < 500 && state.phase !== "chapter-summary"; guard += 1) {
    if (state.phase === "chapter-intro") act({ type: "start" });
    else if (state.phase === "ability-choice") act({ type: "choose-ability", abilityId: state.abilityOfferIds[0] });
    else if (state.phase === "behavior-telegraph") act({ type: "begin-behavior" });
    else if (state.phase === "behavior-effect") act({ type: "recover-behavior" });
    else if (state.phase === "build") {
      const target = character(state.currentCharacterId!);
      for (const component of target.components) {
        const card = state.hand.find((candidate) => candidate.kind === "target" && candidate.expectedSlotId === component.slotId)!;
        act({ type: "place-card", cardId: card.id, slotId: component.slotId });
      }
    } else if (["composition", "meaning", "family-inspect", "family-result", "episode-repair", "episode-complete"].includes(state.phase)) act({ type: "continue" });
    else if (state.phase === "family-connect") {
      const members = family(state.currentFamilyId!).memberCharacterIds.slice(0, 2);
      act({ type: "toggle-family-character", characterId: members[0] });
      act({ type: "toggle-family-character", characterId: members[1] });
      act({ type: "connect-family" });
    } else if (state.phase === "core-intro") act({ type: "start-core" });
    else if (state.phase === "ending") act({ type: "finish-ending" });
    else throw new Error(`Chapter Two simulator reached unknown phase ${state.phase}`);
  }
  const failureCodes: string[] = [];
  if (state.phase !== "chapter-summary") failureCodes.push("SOFTLOCK");
  if (state.discoveredCharacterIds.length !== 12) failureCodes.push("STORY_CHARACTER_COVERAGE");
  if (state.discoveredFamilyIds.length !== 12) failureCodes.push("FAMILY_COVERAGE");
  if (state.selectedAbilityIds.length !== 3 || state.triggeredAbilityIds.length !== 3) failureCodes.push("ABILITY_COVERAGE");
  if (state.completedBehaviorIds.length !== 3) failureCodes.push("BEHAVIOR_COVERAGE");
  if (state.completedBossIds.length !== 4 || state.bossEvidence.some((evidence) => !evidence.allPreviouslyIntroduced)) failureCodes.push("BOSS_COVERAGE");
  if (state.repairedObjectIds.length !== 4 || state.completedEpisodeIds.length !== 4) failureCodes.push("WORLD_COVERAGE");
  return { actions, finalState: state, passed: failureCodes.length === 0, failureCodes };
}
