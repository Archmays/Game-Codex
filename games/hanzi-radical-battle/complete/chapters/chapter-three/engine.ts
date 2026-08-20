import type { M3HeroId } from "../../../v2/chapter-one/builds";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../content-graph/families";
import type { CompleteSlotId } from "../../content-graph/types";
import { COMPLETE_WORD_NODES } from "../../content-graph/words";
import { createCompleteCharacterHand, type CompleteHandCard } from "../../core/content-solvers";
import {
  CHAPTER_THREE_EPISODES,
  CHAPTER_THREE_NEW_ABILITY_IDS,
  CHAPTER_THREE_OPTIONAL_CHARACTER_IDS,
  CHAPTER_THREE_STORY_CHARACTER_IDS,
  CHAPTER_THREE_STORY_WORD_IDS,
  type ChapterThreeAbilityId,
  type ChapterThreeBehaviorId,
  type ChapterThreeBossId,
} from "./contracts";

export type ChapterThreePhase =
  | "chapter-intro" | "ability-choice" | "behavior-telegraph" | "behavior-effect"
  | "discovery-build" | "discovery-meaning"
  | "word-build-a" | "word-meaning-a" | "word-build-b" | "word-meaning-b"
  | "core-family" | "word-order" | "word-result" | "world-effect"
  | "episode-repair" | "episode-complete" | "core-intro" | "ending"
  | "epilogue-forest" | "epilogue-companions" | "epilogue-home" | "chapter-summary";

export type ChapterThreeBuildRole = "discovery" | "word-a" | "word-b";
export interface ChapterThreePlacement { readonly cardId: string; readonly slotId: CompleteSlotId }
export interface ChapterThreeBossEvidence { readonly bossId: ChapterThreeBossId; readonly behaviorIds: readonly ChapterThreeBehaviorId[]; readonly allPreviouslyIntroduced: boolean }

export interface ChapterThreeState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly phase: ChapterThreePhase;
  readonly episodeIndex: 0 | 1 | 2 | 3;
  readonly encounterIndex: number;
  readonly currentDiscoveryCharacterId: string | null;
  readonly currentWordId: string | null;
  readonly currentBuildCharacterId: string | null;
  readonly currentBuildRole: ChapterThreeBuildRole | null;
  readonly hand: readonly CompleteHandCard[];
  readonly placements: readonly ChapterThreePlacement[];
  readonly selectedCardId: string | null;
  readonly wordSelectedCharacterIds: readonly string[];
  readonly activeBehaviorIds: readonly ChapterThreeBehaviorId[];
  readonly introducedBehaviorIds: readonly ChapterThreeBehaviorId[];
  readonly completedBehaviorIds: readonly ChapterThreeBehaviorId[];
  readonly currentBossId: ChapterThreeBossId | null;
  readonly completedBossIds: readonly ChapterThreeBossId[];
  readonly bossEvidence: readonly ChapterThreeBossEvidence[];
  readonly abilityOfferIds: readonly ChapterThreeAbilityId[];
  readonly offeredAbilityIds: readonly ChapterThreeAbilityId[];
  readonly selectedAbilityIds: readonly ChapterThreeAbilityId[];
  readonly triggeredAbilityIds: readonly ChapterThreeAbilityId[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredWordIds: readonly string[];
  readonly reviewedFamilyIds: readonly string[];
  readonly completedEpisodeIds: readonly string[];
  readonly repairedObjectIds: readonly string[];
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type ChapterThreeAction =
  | { readonly type: "start" }
  | { readonly type: "choose-ability"; readonly abilityId: ChapterThreeAbilityId }
  | { readonly type: "begin-behavior" }
  | { readonly type: "recover-behavior" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly cardId: string; readonly slotId: CompleteSlotId }
  | { readonly type: "place-selected"; readonly slotId: CompleteSlotId }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "choose-core-family"; readonly familyId: string }
  | { readonly type: "place-word-character"; readonly characterId: string }
  | { readonly type: "clear-word-order" }
  | { readonly type: "start-core" }
  | { readonly type: "finish-ending" };

export interface ChapterThreeRun { readonly seed: string; readonly initialHeroId: M3HeroId; readonly actions: readonly ChapterThreeAction[]; readonly state: ChapterThreeState }
export interface ChapterThreeSimulationResult { readonly actions: readonly ChapterThreeAction[]; readonly finalState: ChapterThreeState; readonly passed: boolean; readonly failureCodes: readonly string[] }

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function episode(state: ChapterThreeState) { return CHAPTER_THREE_EPISODES[state.episodeIndex]; }
function character(id: string) { return COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id)!; }
function word(id: string) { return COMPLETE_WORD_NODES.find((candidate) => candidate.id === id)!; }
function counted(previous: ChapterThreeState, next: ChapterThreeState): ChapterThreeState { return next === previous ? previous : { ...next, actionCount: previous.actionCount + 1 }; }

function triggerAbility(state: ChapterThreeState, abilityId: ChapterThreeAbilityId): ChapterThreeState {
  return state.selectedAbilityIds.includes(abilityId) ? { ...state, triggeredAbilityIds: unique([...state.triggeredAbilityIds, abilityId]) } : state;
}

function prepareBuild(state: ChapterThreeState, characterId: string, role: ChapterThreeBuildRole): ChapterThreeState {
  const phase = role === "discovery" ? "discovery-build" : role === "word-a" ? "word-build-a" : "word-build-b";
  return {
    ...state,
    phase,
    currentBuildCharacterId: characterId,
    currentBuildRole: role,
    hand: createCompleteCharacterHand(characterId),
    placements: [],
    selectedCardId: null,
    gentleMessage: role === "discovery" ? "先让这一道新字光完整，再进入词语。" : "词语只接纳两个完整字；先把当前字合完整。",
  };
}

function prepareStoryEncounter(state: ChapterThreeState, encounterIndex: number, preserveBoss = false): ChapterThreeState {
  const definition = episode(state);
  const currentWordId = definition.wordIds[encounterIndex];
  const discoveryCharacterId = definition.storyCharacterIds[encounterIndex];
  return prepareBuild({
    ...state,
    encounterIndex,
    currentDiscoveryCharacterId: discoveryCharacterId,
    currentWordId,
    wordSelectedCharacterIds: [],
    currentBossId: preserveBoss ? state.currentBossId : null,
  }, discoveryCharacterId, "discovery");
}

function prepareWordBuild(state: ChapterThreeState, part: 0 | 1): ChapterThreeState {
  const targetWord = word(state.currentWordId!);
  return prepareBuild(state, targetWord.characterIds[part], part === 0 ? "word-a" : "word-b");
}

function prepareCoreWord(state: ChapterThreeState, encounterIndex: number): ChapterThreeState {
  const definition = CHAPTER_THREE_EPISODES[3];
  const next = { ...state, encounterIndex, currentDiscoveryCharacterId: null, currentWordId: definition.wordIds[encounterIndex], wordSelectedCharacterIds: [] };
  return prepareWordBuild(next, 0);
}

function prepareAbilityChoice(state: ChapterThreeState, episodeIndex: 0 | 1 | 2): ChapterThreeState {
  const offer = CHAPTER_THREE_NEW_ABILITY_IDS.filter((id) => !state.selectedAbilityIds.includes(id));
  return {
    ...state,
    phase: "ability-choice",
    episodeIndex,
    encounterIndex: 0,
    currentDiscoveryCharacterId: null,
    currentWordId: null,
    currentBuildCharacterId: null,
    currentBuildRole: null,
    abilityOfferIds: offer,
    offeredAbilityIds: unique([...state.offeredAbilityIds, ...offer]),
    activeBehaviorIds: CHAPTER_THREE_EPISODES[episodeIndex].behaviorIds,
    currentBossId: null,
    gentleMessage: `${CHAPTER_THREE_EPISODES[episodeIndex].name}有几道只让词语关系更清楚的同行字光。`,
  };
}

function prepareBoss(state: ChapterThreeState, encounterIndex: number): ChapterThreeState {
  const definition = episode(state);
  return {
    ...state,
    phase: "behavior-telegraph",
    encounterIndex,
    currentDiscoveryCharacterId: definition.storyCharacterIds[encounterIndex] ?? null,
    currentWordId: definition.wordIds[encounterIndex],
    activeBehaviorIds: definition.behaviorIds,
    currentBossId: definition.bossId,
    bossEvidence: [...state.bossEvidence, { bossId: definition.bossId, behaviorIds: definition.behaviorIds, allPreviouslyIntroduced: definition.behaviorIds.every((id) => state.introducedBehaviorIds.includes(id)) }],
    gentleMessage: "守护者只组合已经看见并恢复过的动作，不会首次改变规则。",
  };
}

export function createChapterThreeState(seed = "word-light-return", heroId: M3HeroId = "light-speaker"): ChapterThreeState {
  return {
    schemaVersion: 1,
    seed,
    heroId,
    phase: "chapter-intro",
    episodeIndex: 0,
    encounterIndex: 0,
    currentDiscoveryCharacterId: null,
    currentWordId: null,
    currentBuildCharacterId: null,
    currentBuildRole: null,
    hand: [],
    placements: [],
    selectedCardId: null,
    wordSelectedCharacterIds: [],
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
    discoveredWordIds: [],
    reviewedFamilyIds: [],
    completedEpisodeIds: [],
    repairedObjectIds: [],
    gentleMessage: "十二道故事新字光和十二个真实词语正在等待共鸣。",
    actionCount: 0,
  };
}

export function createChapterThreeRun(seed: string, heroId: M3HeroId): ChapterThreeRun { return { seed, initialHeroId: heroId, actions: [], state: createChapterThreeState(seed, heroId) }; }
export function replayChapterThreeRun(seed: string, heroId: M3HeroId, actions: readonly ChapterThreeAction[]): ChapterThreeRun { return { seed, initialHeroId: heroId, actions: [...actions], state: replayChapterThreeActions(seed, heroId, actions) }; }
export function reduceChapterThreeRun(run: ChapterThreeRun, action: ChapterThreeAction): ChapterThreeRun {
  const state = reduceChapterThreeState(run.state, action);
  return state === run.state ? run : { ...run, actions: [...run.actions, action], state };
}

function placeCard(state: ChapterThreeState, cardId: string, slotId: CompleteSlotId): ChapterThreeState {
  if (!state.currentBuildCharacterId || !state.currentBuildRole || !["discovery-build", "word-build-a", "word-build-b"].includes(state.phase) || state.placements.some((placement) => placement.cardId === cardId || placement.slotId === slotId)) return state;
  const card = state.hand.find((candidate) => candidate.id === cardId);
  const target = character(state.currentBuildCharacterId);
  if (!card || !target.components.some((component) => component.slotId === slotId)) return state;
  if (card.kind !== "target" || card.expectedSlotId !== slotId) return { ...state, selectedCardId: null, gentleMessage: "这道字灵不住在这里；已经完成的部分和词序都保留。" };
  const placements = [...state.placements, { cardId, slotId }];
  if (placements.length < target.components.length) return { ...state, placements, selectedCardId: null, gentleMessage: "位置正确，下一道字灵也有自己的家。" };
  const phase = state.currentBuildRole === "discovery" ? "discovery-meaning" : state.currentBuildRole === "word-a" ? "word-meaning-a" : "word-meaning-b";
  return {
    ...state,
    phase,
    placements,
    selectedCardId: null,
    discoveredCharacterIds: unique([...state.discoveredCharacterIds, target.id]),
    gentleMessage: `${target.glyph}已经完整合起来。`,
  };
}

function enterWordOrder(state: ChapterThreeState): ChapterThreeState {
  return { ...state, phase: state.episodeIndex === 3 ? "core-family" : "word-order", wordSelectedCharacterIds: [], gentleMessage: state.episodeIndex === 3 ? "先连接一个已经学过的部件字脉，再排真实词序。" : "按正常阅读方向，把两个完整字送进词槽。" };
}

function finishWorldEffect(state: ChapterThreeState): ChapterThreeState {
  const definition = episode(state);
  if (state.episodeIndex < 3) {
    if (state.encounterIndex < 2) return prepareStoryEncounter(state, state.encounterIndex + 1);
    if (state.encounterIndex === 2) return prepareBoss(state, 3);
  } else if (state.encounterIndex < definition.wordIds.length - 1) return prepareCoreWord(state, state.encounterIndex + 1);
  return {
    ...state,
    phase: "episode-repair",
    completedBossIds: unique([...state.completedBossIds, definition.bossId]),
    completedEpisodeIds: unique([...state.completedEpisodeIds, definition.id]),
    repairedObjectIds: unique([...state.repairedObjectIds, definition.repairId]),
    currentDiscoveryCharacterId: null,
    currentWordId: null,
    currentBuildCharacterId: null,
    currentBuildRole: null,
    hand: [],
    placements: [],
    wordSelectedCharacterIds: [],
    gentleMessage: `${definition.name}已由完整字、真实词序和语境共同点亮。`,
  };
}

export function chapterThreeCoreFamilyOptions(expectedFamilyId: string): readonly string[] {
  return [expectedFamilyId, ...COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "story-core" && family.id !== expectedFamilyId).slice(0, 2).map((family) => family.id)];
}

export function reduceChapterThreeState(state: ChapterThreeState, action: ChapterThreeAction): ChapterThreeState {
  let next = state;
  switch (action.type) {
    case "start":
      if (state.phase === "chapter-intro") next = prepareAbilityChoice(state, 0);
      break;
    case "choose-ability":
      if (state.phase === "ability-choice" && state.abilityOfferIds.includes(action.abilityId)) next = { ...state, phase: "behavior-telegraph", selectedAbilityIds: unique([...state.selectedAbilityIds, action.abilityId]), currentBossId: null, gentleMessage: "先看清干扰预告；词序和答案不会改变。" };
      break;
    case "begin-behavior":
      if (state.phase === "behavior-telegraph") next = { ...state, phase: "behavior-effect", gentleMessage: "干扰正在显示，完整字、词序、语境和进度都没有改变。" };
      break;
    case "recover-behavior":
      if (state.phase === "behavior-effect") {
        const recovered = { ...state, introducedBehaviorIds: unique([...state.introducedBehaviorIds, ...state.activeBehaviorIds]), completedBehaviorIds: unique([...state.completedBehaviorIds, ...state.activeBehaviorIds]) };
        next = state.episodeIndex === 3 ? prepareCoreWord(recovered, state.encounterIndex) : prepareStoryEncounter(recovered, state.encounterIndex, Boolean(state.currentBossId));
      }
      break;
    case "select-card":
      if (["discovery-build", "word-build-a", "word-build-b"].includes(state.phase) && state.hand.some((card) => card.id === action.cardId) && !state.placements.some((placement) => placement.cardId === action.cardId)) next = { ...state, selectedCardId: state.selectedCardId === action.cardId ? null : action.cardId, gentleMessage: "再选它要去的真实槽位。" };
      break;
    case "place-selected":
      if (state.selectedCardId) next = placeCard(state, state.selectedCardId, action.slotId);
      break;
    case "place-card":
      next = placeCard(state, action.cardId, action.slotId);
      break;
    case "undo":
      if (["discovery-build", "word-build-a", "word-build-b"].includes(state.phase) && state.placements.length) next = { ...state, placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "上一步已安全收回；词语进度没有损失。" };
      break;
    case "continue":
      if (state.phase === "discovery-meaning") next = prepareWordBuild(state, 0);
      else if (state.phase === "word-meaning-a") next = prepareWordBuild(state, 1);
      else if (state.phase === "word-meaning-b") next = enterWordOrder(state);
      else if (state.phase === "word-result") next = triggerAbility({ ...state, phase: "world-effect", gentleMessage: "完整词语正在让世界发生可见变化。" }, "word-resonance-bridge");
      else if (state.phase === "world-effect") next = finishWorldEffect(state);
      else if (state.phase === "episode-repair") {
        if (state.episodeIndex < 2) next = { ...state, phase: "episode-complete", gentleMessage: "这片区域已保存，可以继续或稍后回来。" };
        else if (state.episodeIndex === 2) next = { ...state, phase: "core-intro", episodeIndex: 3, encounterIndex: 0, currentBossId: null, gentleMessage: "万象字心只组合三章已经学过的规则。" };
        else next = { ...state, phase: "ending", currentBossId: null, gentleMessage: "三层规则各守其位，字光已经可以归林。" };
      } else if (state.phase === "episode-complete" && state.episodeIndex < 2) next = prepareAbilityChoice(state, (state.episodeIndex + 1) as 1 | 2);
      else if (state.phase === "epilogue-forest") next = { ...state, phase: "epilogue-companions", gentleMessage: "伙伴们沿着持久修复一起回到营地。" };
      else if (state.phase === "epilogue-companions") next = { ...state, phase: "epilogue-home", gentleMessage: "家灯会一直亮着；以后可以自由重看，不用每日报到。" };
      else if (state.phase === "epilogue-home") next = { ...state, phase: "chapter-summary", gentleMessage: "完整篇已经完成，自由探索与故事档案已经打开。" };
      break;
    case "choose-core-family":
      if (state.phase === "core-family") {
        const expected = CHAPTER_THREE_EPISODES[3].coreFamilyIds[state.encounterIndex];
        next = action.familyId === expected
          ? { ...state, phase: "word-order", reviewedFamilyIds: unique([...state.reviewedFamilyIds, expected]), gentleMessage: "这条已学字脉连接正确；现在按真实词序排列。" }
          : { ...state, gentleMessage: "这条字脉不属于高亮完整字；原来的进度都保留。" };
      }
      break;
    case "place-word-character":
      if (state.phase === "word-order" && state.currentWordId) {
        const targetWord = word(state.currentWordId);
        if (!targetWord.characterIds.includes(action.characterId as never) || state.wordSelectedCharacterIds.includes(action.characterId)) next = { ...state, wordSelectedCharacterIds: [], gentleMessage: "这次词序没有成立；两个完整字和全部进度都保留，请再试一次。" };
        else if (state.wordSelectedCharacterIds.length === 0) next = { ...state, wordSelectedCharacterIds: [action.characterId], gentleMessage: "第一个完整字已就位，再放第二个。" };
        else {
          const candidate = [state.wordSelectedCharacterIds[0], action.characterId];
          if (candidate[0] === targetWord.characterIds[0] && candidate[1] === targetWord.characterIds[1]) {
            next = { ...state, phase: "word-result", wordSelectedCharacterIds: candidate, discoveredWordIds: unique([...state.discoveredWordIds, targetWord.id]), gentleMessage: "真实词序成立；现在一起读完整词和语境。" };
            next = triggerAbility(triggerAbility(next, "word-order-ribbon"), "word-context-lantern");
          } else next = { ...state, wordSelectedCharacterIds: [], gentleMessage: `这次顺序不读“${targetWord.glyphs.join("")}”；完整字和进度都保留。` };
        }
      }
      break;
    case "clear-word-order":
      if (state.phase === "word-order" && state.wordSelectedCharacterIds.length) next = { ...state, wordSelectedCharacterIds: [], gentleMessage: "词槽已清空；两个完整字仍在。" };
      break;
    case "start-core":
      if (state.phase === "core-intro") next = prepareBoss({ ...state, activeBehaviorIds: CHAPTER_THREE_EPISODES[3].behaviorIds }, 0);
      break;
    case "finish-ending":
      if (state.phase === "ending") next = { ...state, phase: "epilogue-forest", gentleMessage: "字光穿过三章修好的路，正在回到墨迹森林。" };
      break;
  }
  return counted(state, next);
}

export function replayChapterThreeActions(seed: string, heroId: M3HeroId, actions: readonly ChapterThreeAction[]): ChapterThreeState { return actions.reduce(reduceChapterThreeState, createChapterThreeState(seed, heroId)); }

export function isChapterThreeAction(value: unknown): value is ChapterThreeAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.type !== "string") return false;
  if (["start", "begin-behavior", "recover-behavior", "undo", "continue", "clear-word-order", "start-core", "finish-ending"].includes(action.type)) return Object.keys(action).length === 1;
  if (action.type === "choose-ability") return Object.keys(action).sort().join("|") === "abilityId|type" && CHAPTER_THREE_NEW_ABILITY_IDS.includes(action.abilityId as ChapterThreeAbilityId);
  if (["select-card", "place-word-character"].includes(action.type)) return Object.keys(action).sort().join("|") === `${action.type === "select-card" ? "cardId" : "characterId"}|type` && typeof (action.type === "select-card" ? action.cardId : action.characterId) === "string";
  if (action.type === "choose-core-family") return Object.keys(action).sort().join("|") === "familyId|type" && typeof action.familyId === "string" && COMPLETE_COMPONENT_FAMILIES.some((family) => family.id === action.familyId);
  const slots = new Set(["left", "right", "top", "bottom", "outer", "inner"]);
  if (action.type === "place-selected") return Object.keys(action).sort().join("|") === "slotId|type" && typeof action.slotId === "string" && slots.has(action.slotId);
  if (action.type === "place-card") return Object.keys(action).sort().join("|") === "cardId|slotId|type" && typeof action.cardId === "string" && typeof action.slotId === "string" && slots.has(action.slotId);
  return false;
}

export function simulateChapterThree(seed: string, heroId: M3HeroId = "light-speaker"): ChapterThreeSimulationResult {
  let state = createChapterThreeState(seed, heroId);
  const actions: ChapterThreeAction[] = [];
  const act = (action: ChapterThreeAction) => {
    const next = reduceChapterThreeState(state, action);
    if (next.actionCount === state.actionCount) throw new Error(`Chapter Three simulator produced illegal action ${action.type} in ${state.phase}`);
    actions.push(action); state = next;
  };
  for (let guard = 0; guard < 900 && state.phase !== "chapter-summary"; guard += 1) {
    if (state.phase === "chapter-intro") act({ type: "start" });
    else if (state.phase === "ability-choice") act({ type: "choose-ability", abilityId: state.abilityOfferIds[0] });
    else if (state.phase === "behavior-telegraph") act({ type: "begin-behavior" });
    else if (state.phase === "behavior-effect") act({ type: "recover-behavior" });
    else if (["discovery-build", "word-build-a", "word-build-b"].includes(state.phase)) {
      const target = character(state.currentBuildCharacterId!);
      for (const component of target.components) {
        const card = state.hand.find((candidate) => candidate.kind === "target" && candidate.expectedSlotId === component.slotId)!;
        act({ type: "place-card", cardId: card.id, slotId: component.slotId });
      }
    } else if (["discovery-meaning", "word-meaning-a", "word-meaning-b", "word-result", "world-effect", "episode-repair", "episode-complete", "epilogue-forest", "epilogue-companions", "epilogue-home"].includes(state.phase)) act({ type: "continue" });
    else if (state.phase === "core-family") act({ type: "choose-core-family", familyId: CHAPTER_THREE_EPISODES[3].coreFamilyIds[state.encounterIndex] });
    else if (state.phase === "word-order") {
      const targetWord = word(state.currentWordId!);
      act({ type: "place-word-character", characterId: targetWord.characterIds[0] });
      act({ type: "place-word-character", characterId: targetWord.characterIds[1] });
    } else if (state.phase === "core-intro") act({ type: "start-core" });
    else if (state.phase === "ending") act({ type: "finish-ending" });
    else throw new Error(`Chapter Three simulator reached unknown phase ${state.phase}`);
  }
  const failureCodes: string[] = [];
  if (state.phase !== "chapter-summary") failureCodes.push("SOFTLOCK");
  if (!CHAPTER_THREE_STORY_CHARACTER_IDS.every((id) => state.discoveredCharacterIds.includes(id))) failureCodes.push("STORY_CHARACTER_COVERAGE");
  if (CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.some((id) => state.discoveredCharacterIds.includes(id))) failureCodes.push("OPTIONAL_CHARACTER_BLOCKS_STORY");
  if (!CHAPTER_THREE_STORY_WORD_IDS.every((id) => state.discoveredWordIds.includes(id)) || state.discoveredWordIds.length !== 12) failureCodes.push("STORY_WORD_COVERAGE");
  if (state.selectedAbilityIds.length !== 3 || state.triggeredAbilityIds.length !== 3) failureCodes.push("ABILITY_COVERAGE");
  if (state.completedBehaviorIds.length !== 3) failureCodes.push("BEHAVIOR_COVERAGE");
  if (state.completedBossIds.length !== 4 || state.bossEvidence.some((evidence) => !evidence.allPreviouslyIntroduced)) failureCodes.push("BOSS_COVERAGE");
  if (state.repairedObjectIds.length !== 4 || state.completedEpisodeIds.length !== 4) failureCodes.push("WORLD_COVERAGE");
  if (state.reviewedFamilyIds.length !== 3) failureCodes.push("CORE_FAMILY_COVERAGE");
  return { actions, finalState: state, passed: failureCodes.length === 0, failureCodes };
}
