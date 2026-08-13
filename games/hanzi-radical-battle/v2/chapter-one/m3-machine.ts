import { getChapterOneCharacter } from "./characters";
import { getChapterOneHand } from "./hands";
import { M3_BUILD_ABILITIES, getM3Ability, type M3AbilityEffectKey, type M3AbilityId, type M3AbilityTrigger, type M3HeroId } from "./builds";
import { getM5Behavior } from "./m5-content";
import { createDeterministicRng } from "./rng";
import { defaultM3AbilityIndex, defaultM3PathIndex, generateM3RunPlan } from "./m3-run-generator";
import type { ChapterHandCard } from "./content-types";
import type { M3AbilityEvidence, M3AbilityEffects, M3Action, M3EncounterPlan, M3GameState, M3InnateEvidence, M3PathPlan, M3SimulationResult, M5AdventureMode } from "./m3-types";

const EFFECT_KEYS: readonly M3AbilityEffectKey[] = [
  "guidedSlotCount", "pathPreviewCount", "intentEchoCount", "rootGuardCount", "undoReserveCount", "handOrderShiftCount",
  "meaningGlimpseCount", "wordEchoCount", "calmFieldCount", "enclosureRibbonCount", "sharedPartGrowthCount", "structureLanternCount",
  "recoveryLeafCount", "wordLanternCount", "nextShapeCount", "inkShieldCount", "secondLookCount", "repairPreviewCount",
];

export const EMPTY_M3_ABILITY_EFFECTS = Object.freeze(Object.fromEntries(EFFECT_KEYS.map((key) => [key, 0])) as unknown as M3AbilityEffects);

function unique<T>(items: readonly T[]): T[] { return [...new Set(items)]; }

function initialAbilityEvidence(offeredIds: ReadonlySet<M3AbilityId>): readonly M3AbilityEvidence[] {
  return M3_BUILD_ABILITIES.map((ability) => ({
    abilityId: ability.id,
    offered: offeredIds.has(ability.id),
    selected: false,
    triggered: false,
    stateChanged: false,
    visibleEffectObserved: false,
    neverAutoSolved: true,
    noIllegalAnswer: true,
  }));
}

function initialInnateEvidence(heroId: M3HeroId): M3InnateEvidence {
  return { heroId, triggeredCount: 0, stateChanged: false, visibleEffectObserved: false, neverAutoSolved: true, noIllegalAnswer: true };
}

function incrementAction(state: M3GameState, patch: Partial<M3GameState>): M3GameState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

function currentPath(state: M3GameState): M3PathPlan | null {
  if (!state.currentPathId) return null;
  return state.plan.regions[state.regionIndex].pathOptions.find((path) => path.id === state.currentPathId) ?? null;
}

function encounterFor(state: M3GameState, index: 0 | 1 | 2 | 3): M3EncounterPlan | null {
  if (state.chapterStage === "final-core") return state.plan.finalCore.encounters[index as 0 | 1 | 2] ?? null;
  return currentPath(state)?.encounters[index] ?? null;
}

function shuffledHand(state: M3GameState, characterId: string, variant: number): readonly ChapterHandCard[] {
  return createDeterministicRng(`${state.seed}:${state.heroId}:${characterId}:v${variant}:hand`).shuffle(getChapterOneHand(characterId, variant).cards);
}

function updateEvidence(state: M3GameState, abilityId: M3AbilityId, patch: Partial<M3AbilityEvidence>): readonly M3AbilityEvidence[] {
  return state.abilityEvidence.map((entry) => entry.abilityId === abilityId ? { ...entry, ...patch } : entry);
}

function markInnate(state: M3GameState, heroEffects: M3GameState["heroEffects"]): M3GameState {
  return {
    ...state,
    heroEffects,
    innateEvidence: {
      ...state.innateEvidence,
      triggeredCount: state.innateEvidence.triggeredCount + 1,
      stateChanged: true,
      visibleEffectObserved: true,
    },
  };
}

function triggerAbilities(state: M3GameState, trigger: M3AbilityTrigger, context: { placedSourceGlyph?: string; wasSeenBefore?: boolean } = {}): M3GameState {
  let next = state;
  for (const abilityId of state.selectedAbilityIds) {
    const ability = getM3Ability(abilityId);
    const evidence = next.abilityEvidence.find((entry) => entry.abilityId === abilityId)!;
    if (ability.trigger !== trigger || evidence.triggered) continue;
    if (abilityId === "shared-part" && (!context.placedSourceGlyph || context.wasSeenBefore !== true)) continue;
    const before = next.abilityEffects[ability.effectKey];
    const abilityEffects: M3AbilityEffects = { ...next.abilityEffects, [ability.effectKey]: before + 1 };
    let hand = next.hand;
    if (abilityId === "wind-order" && hand.length) hand = [...hand.slice(1), hand[0]];
    next = {
      ...next,
      hand,
      abilityEffects,
      triggeredAbilityIds: unique([...next.triggeredAbilityIds, abilityId]),
      abilityEvidence: updateEvidence(next, abilityId, { triggered: true, stateChanged: true, visibleEffectObserved: true }),
    };
  }
  return next;
}

function loadEncounter(state: M3GameState, index: 0 | 1 | 2 | 3): M3GameState {
  const encounter = encounterFor(state, index);
  if (!encounter) return { ...state, gentleMessage: state.chapterStage === "final-core" ? "字核正在等待下一道完整字光。" : "先选择一条森林小路。" };
  const character = getChapterOneCharacter(encounter.characterId);
  const behavior = getM5Behavior(encounter.behaviorId);
  let next: M3GameState = {
    ...state,
    phase: "behavior-telegraph",
    encounterIndex: index,
    currentEncounter: encounter,
    currentBehaviorRecovered: false,
    selectedCardId: null,
    hand: shuffledHand(state, encounter.characterId, encounter.handVariant),
    placements: [],
    invalidPlacementCount: 0,
    gentleMessage: `${behavior.name}要来了，${character.structure === "left-right" ? "左右" : character.structure === "top-bottom" ? "上下" : "包围"}位置仍然真实。`,
  };
  if (encounter.boss) next = triggerAbilities(next, "boss-telegraph");
  return next;
}

export function createM3GameState(seed = "ink-forest-2", heroId: M3HeroId = "light-speaker", mode: M5AdventureMode = "story"): M3GameState {
  const plan = generateM3RunPlan(seed, heroId, mode);
  const offered = new Set(plan.regions.flatMap((region) => region.abilityOffer));
  return {
    schemaVersion: 3,
    seed: plan.seed,
    heroId,
    mode,
    plan,
    phase: "camp",
    chapterStage: "regions",
    regionIndex: 0,
    encounterIndex: 0,
    chosenPathIds: [],
    selectedAbilityIds: [],
    triggeredAbilityIds: [],
    currentPathId: null,
    currentEncounter: null,
    currentBehaviorRecovered: false,
    selectedCardId: null,
    hand: [],
    placements: [],
    invalidPlacementCount: 0,
    discoveredCharacterIds: [],
    seenComponentGlyphs: [],
    completedBehaviorCycles: [],
    completedBossIds: [],
    abilityEffects: EMPTY_M3_ABILITY_EFFECTS,
    heroEffects: { lightTrailCount: 0, growthLinkCount: 0, intentDetailCount: 0, companionShieldCount: 0 },
    abilityEvidence: initialAbilityEvidence(offered),
    innateEvidence: initialInnateEvidence(heroId),
    gentleMessage: mode === "story" ? "选一位伙伴，一起把墨迹森林的第一章重新点亮。" : "自由冒险会沿 seed 生成三条安全路线。",
    actionsToFirstEncounter: null,
    actionCount: 0,
  };
}

function transitionAfterMeaning(state: M3GameState): M3GameState {
  if (state.chapterStage === "final-core") {
    if (state.encounterIndex < 2) return loadEncounter(state, (state.encounterIndex + 1) as 1 | 2);
    return {
      ...state,
      phase: "ending",
      chapterStage: "ending",
      completedBossIds: unique([...state.completedBossIds, "ink-king-core"]),
      gentleMessage: "最后一道完整汉字从字核发出意义魔法，墨迹森林重新亮起。",
    };
  }
  if (state.encounterIndex === 1) return { ...state, phase: "ability-choice", gentleMessage: "选一道会在本区两阶段首领战真正发生的字光。" };
  if (state.encounterIndex === 3) {
    const bossId = state.currentEncounter?.bossId;
    return {
      ...state,
      phase: "region-complete",
      completedBossIds: bossId ? unique([...state.completedBossIds, bossId]) : state.completedBossIds,
      gentleMessage: `${state.plan.regions[state.regionIndex].title}重新亮起来了。`,
    };
  }
  return loadEncounter(state, (state.encounterIndex + 1) as 0 | 1 | 2 | 3);
}

export function reduceM3State(state: M3GameState, action: M3Action): M3GameState {
  if (action.type === "repeat-seed" && state.phase === "run-summary") return { ...createM3GameState(state.seed, state.heroId, state.mode), actionCount: state.actionCount + 1 };
  if (action.type === "return-camp" && (state.phase === "run-summary" || state.phase === "ending")) return { ...createM3GameState(state.seed, state.heroId, state.mode), actionCount: state.actionCount + 1 };
  if (action.type === "start-free-adventure" && (state.phase === "camp" || state.phase === "run-summary" || state.phase === "ending")) {
    const fresh = createM3GameState(action.seed?.trim() || `${state.seed}-free`, state.heroId, "free");
    return { ...fresh, phase: "route-choice", actionCount: state.actionCount + 1, gentleMessage: "自由冒险路线已经按 seed 安全展开。" };
  }
  if (action.type === "select-hero" && state.phase === "camp") {
    const fresh = createM3GameState(state.seed, action.heroId, state.mode);
    return { ...fresh, actionCount: state.actionCount + 1, gentleMessage: `${action.heroId === "light-speaker" ? "光语" : action.heroId === "forest-speaker" ? "森语" : "墨点"}伙伴已经准备好。` };
  }
  if (action.type === "start-run" && state.phase === "camp") return incrementAction(state, { phase: "route-choice", gentleMessage: "选一条想走的路，两条都能抵达。" });
  if (action.type === "choose-route" && state.phase === "route-choice") {
    const path = state.plan.regions[state.regionIndex].pathOptions.find((entry) => entry.id === action.pathId);
    if (!path) return incrementAction(state, { gentleMessage: "这条路不在当前区域，请重新选择。" });
    const next = incrementAction(state, { chosenPathIds: [...state.chosenPathIds, path.id], currentPathId: path.id, actionsToFirstEncounter: state.actionsToFirstEncounter ?? state.actionCount + 1, gentleMessage: `${path.label}已经打开。` });
    return loadEncounter(next, 0);
  }
  if (action.type === "enter-final-core" && state.phase === "final-intro") return loadEncounter(incrementAction(state, { chapterStage: "final-core", gentleMessage: "三道已学字光正在照进墨王核心。" }), 0);
  if (action.type === "finish-ending" && state.phase === "ending") return incrementAction(state, { phase: "run-summary", chapterStage: "complete", gentleMessage: "第一章已经恢复；可以回营地、翻魔法书或再走一条自由路线。" });
  if (action.type === "begin-behavior" && state.phase === "behavior-telegraph" && state.currentEncounter) {
    let next = incrementAction(state, { phase: "behavior-effect", gentleMessage: "干扰已经发生；正确字和真实位置没有改变。" });
    if (state.heroId === "ink-companion") next = markInnate(next, { ...next.heroEffects, intentDetailCount: next.heroEffects.intentDetailCount + 1 });
    return next;
  }
  if (action.type === "recover-behavior" && state.phase === "behavior-effect" && state.currentEncounter) {
    let next = incrementAction(state, {
      phase: "encounter",
      currentBehaviorRecovered: true,
      completedBehaviorCycles: [...state.completedBehaviorCycles, ...state.currentEncounter.combinedBehaviorIds],
      gentleMessage: "把两块真正的字灵送回结构位置。",
    });
    next = triggerAbilities(next, "behavior-recovered");
    return next;
  }
  if (action.type === "select-card" && state.phase === "encounter") {
    const card = state.hand.find((entry) => entry.id === action.cardId);
    if (!card || state.placements.some((entry) => entry.cardId === card.id)) return incrementAction(state, { gentleMessage: "这张字灵现在不能选择，换一张看看。" });
    return incrementAction(state, { selectedCardId: card.id, gentleMessage: `拿起了${card.glyph}。` });
  }
  if (action.type === "place-card" && state.phase === "encounter" && state.currentEncounter) {
    const cardId = action.cardId ?? state.selectedCardId;
    const card = state.hand.find((entry) => entry.id === cardId);
    if (!card || state.placements.some((entry) => entry.cardId === card.id)) return incrementAction(state, { invalidPlacementCount: state.invalidPlacementCount + 1, gentleMessage: "先选一张还在手里的字灵。" });
    const character = getChapterOneCharacter(state.currentEncounter.characterId);
    const outerRequired = action.slotId === "inner" && character.orderedComponents.some((entry) => entry.slotId === "outer") && !state.placements.some((entry) => entry.slotId === "outer");
    if (card.kind !== "target" || card.expectedSlotId !== action.slotId || outerRequired || state.placements.some((entry) => entry.slotId === action.slotId)) {
      return incrementAction(state, { selectedCardId: null, invalidPlacementCount: state.invalidPlacementCount + 1, gentleMessage: outerRequired ? "先让外框回到位置，里面的字灵就能安全进入。" : "字灵轻轻弹回来了。看看它在完整字里的真实位置。" });
    }
    const firstPlacement = state.placements.length === 0;
    const placement = { cardId: card.id, slotId: action.slotId, protected: firstPlacement && (state.heroId === "ink-companion" || state.selectedAbilityIds.includes("root-guard")) } as const;
    const placements = [...state.placements, placement];
    const wasSeenBefore = state.seenComponentGlyphs.includes(card.sourceGlyph);
    let next = incrementAction(state, { placements, selectedCardId: null, seenComponentGlyphs: unique([...state.seenComponentGlyphs, card.sourceGlyph]), gentleMessage: `${card.glyph}稳稳落在真实位置上。` });
    if (firstPlacement && state.heroId === "light-speaker") next = markInnate(next, { ...next.heroEffects, lightTrailCount: next.heroEffects.lightTrailCount + 1 });
    if (state.heroId === "forest-speaker" && wasSeenBefore) next = markInnate(next, { ...next.heroEffects, growthLinkCount: next.heroEffects.growthLinkCount + 1 });
    if (firstPlacement && state.heroId === "ink-companion") next = markInnate(next, { ...next.heroEffects, companionShieldCount: next.heroEffects.companionShieldCount + 1 });
    next = triggerAbilities(next, "first-correct-placement", { placedSourceGlyph: card.sourceGlyph, wasSeenBefore });
    const complete = character.orderedComponents.every((component) => placements.some((entry) => entry.cardId === component.id));
    if (!complete) return next;
    next = { ...next, phase: "composition", discoveredCharacterIds: unique([...next.discoveredCharacterIds, character.id]), gentleMessage: "部件合在一起，完整汉字出现了。" };
    return triggerAbilities(next, "composition");
  }
  if (action.type === "undo" && state.phase === "encounter" && state.placements.length) return incrementAction(state, { placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "字灵回到手里，可以再放一次。" });
  if (action.type === "continue" && state.phase === "composition") {
    let next = incrementAction(state, { phase: "meaning", gentleMessage: state.currentEncounter?.finalChallenge === "meaning-restoration" ? "完整汉字正在发出恢复森林核心的最后字义魔法。" : "完整汉字正在变成它自己的字义魔法。" });
    next = triggerAbilities(next, "meaning");
    return next;
  }
  if (action.type === "continue" && state.phase === "meaning") return incrementAction(state, transitionAfterMeaning(state));
  if (action.type === "choose-ability" && state.phase === "ability-choice") {
    const offer = state.plan.regions[state.regionIndex].abilityOffer;
    if (!offer.includes(action.abilityId)) return incrementAction(state, { gentleMessage: "这道字光不在本次选择里。" });
    let next = incrementAction(state, { selectedAbilityIds: [...state.selectedAbilityIds, action.abilityId], abilityEvidence: updateEvidence(state, action.abilityId, { selected: true }), gentleMessage: `${getM3Ability(action.abilityId).name}已经成为本局第 ${state.selectedAbilityIds.length + 1} 枚字光。` });
    next = triggerAbilities(next, "on-select");
    return loadEncounter(next, 2);
  }
  if (action.type === "continue" && state.phase === "region-complete") {
    if (state.regionIndex === 2) return incrementAction(state, { phase: "final-intro", chapterStage: "final-core", currentPathId: null, currentEncounter: null, hand: [], placements: [], gentleMessage: "三片区域的字光汇成一条路，通向墨王核心。" });
    return incrementAction(state, { phase: "route-choice", regionIndex: (state.regionIndex + 1) as 1 | 2, encounterIndex: 0, currentPathId: null, currentEncounter: null, hand: [], placements: [], gentleMessage: "下一片区域也有两条都能抵达的路。" });
  }
  return incrementAction(state, { gentleMessage: "现在先完成眼前这一步。" });
}

export function replayM3Actions(seed: string, heroId: M3HeroId, actions: readonly M3Action[], mode: M5AdventureMode = "story"): M3GameState {
  return actions.reduce(reduceM3State, createM3GameState(seed, heroId, mode));
}

export function simulateM3Run(seed: string, heroId: M3HeroId, mode: M5AdventureMode = "story"): M3SimulationResult {
  let state = createM3GameState(seed, heroId, mode);
  const actions: M3Action[] = [];
  const failureCodes: string[] = [];
  for (let guard = 0; guard < 700 && state.phase !== "run-summary"; guard += 1) {
    let action: M3Action;
    if (state.phase === "camp") action = { type: "start-run" };
    else if (state.phase === "route-choice") action = { type: "choose-route", pathId: state.plan.regions[state.regionIndex].pathOptions[defaultM3PathIndex(seed, heroId, state.regionIndex)].id };
    else if (state.phase === "behavior-telegraph") action = { type: "begin-behavior" };
    else if (state.phase === "behavior-effect") action = { type: "recover-behavior" };
    else if (state.phase === "encounter") {
      const character = currentM3Character(state)!;
      const component = character.orderedComponents.find((entry) => !state.placements.some((placement) => placement.cardId === entry.id));
      if (!component) { failureCodes.push("no-legal-target-card"); action = { type: "undo" }; }
      else action = { type: "place-card", cardId: component.id, slotId: component.slotId };
    } else if (state.phase === "composition" || state.phase === "meaning" || state.phase === "region-complete") action = { type: "continue" };
    else if (state.phase === "final-intro") action = { type: "enter-final-core" };
    else if (state.phase === "ending") action = { type: "finish-ending" };
    else {
      const offer = state.plan.regions[state.regionIndex].abilityOffer;
      action = { type: "choose-ability", abilityId: offer[defaultM3AbilityIndex(seed, heroId, state.regionIndex)] };
    }
    state = reduceM3State(state, action);
    actions.push(action);
  }
  if (state.phase !== "run-summary") failureCodes.push("run-did-not-complete");
  if (state.discoveredCharacterIds.length !== 15) failureCodes.push("not-15-unique-characters-cast");
  if (state.selectedAbilityIds.length !== 3 || state.triggeredAbilityIds.length !== 3) failureCodes.push("three-ability-cycle-incomplete");
  if (state.completedBehaviorCycles.length < 15) failureCodes.push("behavior-recovery-cycle-incomplete");
  if (state.completedBossIds.length !== 4) failureCodes.push("four-boss-cycle-incomplete");
  if (!state.innateEvidence.stateChanged || state.innateEvidence.triggeredCount < 1) failureCodes.push("hero-innate-not-triggered");
  if (state.abilityEvidence.some((entry) => entry.selected && (!entry.triggered || !entry.stateChanged || !entry.visibleEffectObserved || !entry.neverAutoSolved || !entry.noIllegalAnswer))) failureCodes.push("selected-ability-evidence-incomplete");
  const placementActions = actions.filter((entry) => entry.type === "place-card").length;
  if (placementActions !== 30) failureCodes.push("ability-auto-solved-or-extra-placement");
  const encountered = state.chosenPathIds.flatMap((pathId, regionIndex) => state.plan.regions[regionIndex].pathOptions.find((entry) => entry.id === pathId)!.encounters.map((entry) => `${entry.characterId}:v${entry.handVariant}`));
  encountered.push(...state.plan.finalCore.encounters.map((entry) => `${entry.characterId}:v${entry.handVariant}`));
  return { finalState: state, actions, routeSignature: state.chosenPathIds.join("/"), abilitySignature: state.selectedAbilityIds.join("/"), encounterSignature: encountered.join("/"), passed: failureCodes.length === 0, failureCodes };
}

export function abilityEffectChangedByM3(id: M3AbilityId): boolean {
  const effectKey = getM3Ability(id).effectKey;
  return ({ ...EMPTY_M3_ABILITY_EFFECTS, [effectKey]: EMPTY_M3_ABILITY_EFFECTS[effectKey] + 1 })[effectKey] !== EMPTY_M3_ABILITY_EFFECTS[effectKey];
}

export function currentM3Character(state: M3GameState) { return state.currentEncounter ? getChapterOneCharacter(state.currentEncounter.characterId) : null; }
