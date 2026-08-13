import { getV1Character, getV1Encounter } from "../golden-slice/content/adventures";
import { getM1Ability } from "./content";
import { createDeterministicRng } from "./rng";
import {
  buildM1EncounterPlan,
  defaultM1AbilityIndex,
  defaultM1PathIndex,
  generateM1RunPlan,
} from "./run-generator";
import type {
  M1AbilityEffectSnapshot,
  M1AbilityId,
  M1Action,
  M1GameState,
  M1PathDefinition,
  M1SimulationResult,
} from "./types";

const EMPTY_EFFECTS: M1AbilityEffectSnapshot = {
  revealedSlotCount: 0,
  safePathVisible: false,
  echoRecoveryCount: 0,
  anchoredCardCount: 0,
  focusTokens: 0,
  meaningPreviewVisible: false,
  recoveryTokens: 0,
  returnedCardCount: 0,
  handRotation: 0,
};

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function incrementAction(state: M1GameState, patch: Partial<M1GameState>): M1GameState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

function currentPath(state: M1GameState): M1PathDefinition | null {
  if (!state.currentPathId) return null;
  return state.plan.regions[state.regionIndex].pathOptions.find((path) => path.id === state.currentPathId) ?? null;
}

function shuffledHand(state: M1GameState, encounterId: string) {
  const encounter = getV1Encounter(encounterId as Parameters<typeof getV1Encounter>[0]);
  return createDeterministicRng(`${state.seed}:${encounterId}:hand`).shuffle(encounter.cards);
}

function loadEncounter(state: M1GameState, index: 0 | 1 | 2 | 3): M1GameState {
  const path = currentPath(state);
  if (!path) return { ...state, gentleMessage: "先选择一条森林小路。" };
  const encounter = buildM1EncounterPlan(path)[index];
  const behavior = encounter.behaviorId;
  return {
    ...state,
    phase: "behavior-telegraph",
    encounterIndex: index,
    currentEncounter: encounter,
    currentBehaviorRecovered: false,
    selectedCardId: null,
    hand: shuffledHand(state, encounter.encounterId),
    placements: [],
    invalidPlacementCount: 0,
    gentleMessage: `墨怪准备了${behavior}，先看清预告。`,
  };
}

function applyAbility(effects: M1AbilityEffectSnapshot, abilityId: M1AbilityId): M1AbilityEffectSnapshot {
  getM1Ability(abilityId);
  switch (abilityId) {
    case "guardian-light": return { ...effects, revealedSlotCount: effects.revealedSlotCount + 1 };
    case "star-path": return { ...effects, safePathVisible: true };
    case "ink-echo": return { ...effects, echoRecoveryCount: effects.echoRecoveryCount + 1 };
    case "root-anchor": return { ...effects, anchoredCardCount: effects.anchoredCardCount + 1 };
    case "moon-rest": return { ...effects, focusTokens: effects.focusTokens + 1 };
    case "bloom-step": return { ...effects, meaningPreviewVisible: true };
    case "clear-stream": return { ...effects, recoveryTokens: effects.recoveryTokens + 1 };
    case "echo-pouch": return { ...effects, returnedCardCount: effects.returnedCardCount + 1 };
    case "wind-swap": return { ...effects, handRotation: effects.handRotation + 1 };
  }
}

export function createM1GameState(seed = "ink-forest-1"): M1GameState {
  const plan = generateM1RunPlan(seed);
  return {
    schemaVersion: 1,
    seed: plan.seed,
    plan,
    phase: "camp",
    regionIndex: 0,
    encounterIndex: 0,
    chosenPathIds: [],
    selectedAbilityIds: [],
    currentPathId: null,
    currentEncounter: null,
    currentBehaviorRecovered: false,
    selectedCardId: null,
    hand: [],
    placements: [],
    invalidPlacementCount: 0,
    discoveredCharacterIds: [],
    abilityEffects: EMPTY_EFFECTS,
    triggeredAbilityIds: [],
    completedBehaviorCycles: [],
    gentleMessage: "墨迹森林的三条路正在等第一道字光。",
    actionsToFirstEncounter: null,
    actionCount: 0,
  };
}

function transitionAfterMeaning(state: M1GameState): M1GameState {
  if (state.encounterIndex === 2) {
    return { ...state, phase: "ability-choice", gentleMessage: "选一道会在本区首领战发生的字光。" };
  }
  if (state.encounterIndex === 3) {
    return { ...state, phase: "region-complete", gentleMessage: `${state.plan.regions[state.regionIndex].title}重新亮起来了。` };
  }
  return loadEncounter(state, (state.encounterIndex + 1) as 0 | 1 | 2 | 3);
}

export function reduceM1State(state: M1GameState, action: M1Action): M1GameState {
  if (action.type === "repeat-seed" && state.phase === "run-summary") {
    const fresh = createM1GameState(state.seed);
    return { ...fresh, actionCount: state.actionCount + 1 };
  }
  if (action.type === "start-run" && state.phase === "camp") {
    return incrementAction(state, { phase: "route-choice", gentleMessage: "选一条想走的路，两条都能抵达。" });
  }
  if (action.type === "choose-route" && state.phase === "route-choice") {
    const path = state.plan.regions[state.regionIndex].pathOptions.find((entry) => entry.id === action.pathId);
    if (!path) return incrementAction(state, { gentleMessage: "这条路不在当前区域，请重新选择。" });
    const next = incrementAction(state, {
      chosenPathIds: [...state.chosenPathIds, path.id],
      currentPathId: path.id,
      actionsToFirstEncounter: state.actionsToFirstEncounter ?? state.actionCount + 1,
      gentleMessage: `${path.label}已经打开。`,
    });
    return loadEncounter(next, 0);
  }
  if (action.type === "begin-behavior" && state.phase === "behavior-telegraph" && state.currentEncounter) {
    return incrementAction(state, { phase: "behavior-effect", gentleMessage: "干扰已经发生；正确字和位置没有改变。" });
  }
  if (action.type === "recover-behavior" && state.phase === "behavior-effect" && state.currentEncounter) {
    return incrementAction(state, {
      phase: "encounter",
      currentBehaviorRecovered: true,
      completedBehaviorCycles: [...state.completedBehaviorCycles, state.currentEncounter.behaviorId],
      gentleMessage: getV1Encounter(state.currentEncounter.encounterId).prompt,
    });
  }
  if (action.type === "select-card" && state.phase === "encounter") {
    const card = state.hand.find((entry) => entry.id === action.cardId);
    if (!card || state.placements.some((entry) => entry.cardId === card.id)) {
      return incrementAction(state, { gentleMessage: "这张字灵现在不能选择，换一张看看。" });
    }
    return incrementAction(state, { selectedCardId: card.id, gentleMessage: `拿起了${card.glyph}。` });
  }
  if (action.type === "place-card" && state.phase === "encounter" && state.currentEncounter) {
    const cardId = action.cardId ?? state.selectedCardId;
    const card = state.hand.find((entry) => entry.id === cardId);
    if (!card || state.placements.some((entry) => entry.cardId === card.id)) {
      return incrementAction(state, { invalidPlacementCount: state.invalidPlacementCount + 1, gentleMessage: "先选一张还在手里的字灵。" });
    }
    if (card.kind !== "target" || card.expectedSlotId !== action.slotId || state.placements.some((entry) => entry.slotId === action.slotId)) {
      return incrementAction(state, {
        selectedCardId: null,
        invalidPlacementCount: state.invalidPlacementCount + 1,
        gentleMessage: "字灵轻轻弹回来了。看看它在完整字里的真实位置。",
      });
    }
    const placements = [...state.placements, { cardId: card.id, slotId: action.slotId }];
    const encounter = getV1Encounter(state.currentEncounter.encounterId);
    const complete = encounter.cards.filter((entry) => entry.kind === "target").every((target) => placements.some((entry) => entry.cardId === target.id));
    if (!complete) return incrementAction(state, { placements, selectedCardId: null, gentleMessage: `${card.glyph}稳稳落在位置上。` });
    return incrementAction(state, {
      phase: "composition",
      placements,
      selectedCardId: null,
      discoveredCharacterIds: unique([...state.discoveredCharacterIds, state.currentEncounter.characterId]),
      gentleMessage: "部件合在一起，完整汉字出现了。",
    });
  }
  if (action.type === "undo" && state.phase === "encounter" && state.placements.length) {
    return incrementAction(state, { placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "字灵回到手里，可以再放一次。" });
  }
  if (action.type === "continue" && state.phase === "composition") {
    return incrementAction(state, { phase: "meaning", gentleMessage: "完整汉字正在变成它自己的字义魔法。" });
  }
  if (action.type === "continue" && state.phase === "meaning") {
    return incrementAction(state, transitionAfterMeaning(state));
  }
  if (action.type === "choose-ability" && state.phase === "ability-choice") {
    const offer = state.plan.regions[state.regionIndex].abilityOffer;
    if (!offer.includes(action.abilityId)) return incrementAction(state, { gentleMessage: "这道字光不在本次选择里。" });
    const selectedAbilityIds = [...state.selectedAbilityIds, action.abilityId];
    const next = incrementAction(state, {
      selectedAbilityIds,
      triggeredAbilityIds: unique([...state.triggeredAbilityIds, action.abilityId]),
      abilityEffects: applyAbility(state.abilityEffects, action.abilityId),
      gentleMessage: `${getM1Ability(action.abilityId).name}已经亮起，会在首领战留下可见变化。`,
    });
    return loadEncounter(next, 3);
  }
  if (action.type === "continue" && state.phase === "region-complete") {
    if (state.regionIndex === 2) {
      return incrementAction(state, { phase: "run-summary", gentleMessage: "三片区域都亮了。可以复制 seed 或沿同一条路安全重放。" });
    }
    return incrementAction(state, {
      phase: "route-choice",
      regionIndex: (state.regionIndex + 1) as 1 | 2,
      encounterIndex: 0,
      currentPathId: null,
      currentEncounter: null,
      hand: [],
      placements: [],
      gentleMessage: "下一片区域有两条都能抵达的路。",
    });
  }
  return incrementAction(state, { gentleMessage: "现在先完成眼前这一步。" });
}

export function replayM1Actions(seed: string, actions: readonly M1Action[]): M1GameState {
  return actions.reduce(reduceM1State, createM1GameState(seed));
}

export function simulateM1Run(seed: string): M1SimulationResult {
  let state = createM1GameState(seed);
  const actions: M1Action[] = [];
  const failureCodes: string[] = [];
  for (let guard = 0; guard < 400 && state.phase !== "run-summary"; guard += 1) {
    let action: M1Action;
    switch (state.phase) {
      case "camp": action = { type: "start-run" }; break;
      case "route-choice": {
        const path = state.plan.regions[state.regionIndex].pathOptions[defaultM1PathIndex(seed, state.regionIndex)];
        action = { type: "choose-route", pathId: path.id };
        break;
      }
      case "behavior-telegraph": action = { type: "begin-behavior" }; break;
      case "behavior-effect": action = { type: "recover-behavior" }; break;
      case "encounter": {
        const target = state.hand.find((card) => card.kind === "target" && !state.placements.some((placement) => placement.cardId === card.id));
        if (!target?.expectedSlotId) {
          failureCodes.push("no-legal-target-card");
          action = { type: "undo" };
        } else {
          action = { type: "place-card", cardId: target.id, slotId: target.expectedSlotId };
        }
        break;
      }
      case "composition":
      case "meaning":
      case "region-complete": action = { type: "continue" }; break;
      case "ability-choice": {
        const offer = state.plan.regions[state.regionIndex].abilityOffer;
        action = { type: "choose-ability", abilityId: offer[defaultM1AbilityIndex(seed, state.regionIndex)] };
        break;
      }
    }
    const previous = state;
    state = reduceM1State(state, action);
    actions.push(action);
    if (state === previous) failureCodes.push("state-did-not-advance");
  }
  if (state.phase !== "run-summary") failureCodes.push("run-did-not-complete");
  if (state.discoveredCharacterIds.length !== 12) failureCodes.push("not-all-12-characters-cast");
  if (state.selectedAbilityIds.length !== 3 || state.triggeredAbilityIds.length !== 3) failureCodes.push("three-ability-cycle-incomplete");
  if (state.completedBehaviorCycles.length !== 12) failureCodes.push("behavior-recovery-cycle-incomplete");
  if (state.actionsToFirstEncounter !== 2) failureCodes.push("more-than-two-actions-to-adventure");
  const encountered = actions.filter((action) => action.type === "place-card").map((action) => action.type === "place-card" ? action.cardId ?? "selected" : "");
  return {
    finalState: state,
    actions,
    routeSignature: state.chosenPathIds.join("/"),
    abilitySignature: state.selectedAbilityIds.join("/"),
    encounterSignature: encountered.join("/"),
    passed: failureCodes.length === 0,
    failureCodes,
  };
}

export function abilityEffectChangedBy(id: M1AbilityId): boolean {
  return JSON.stringify(applyAbility(EMPTY_EFFECTS, id)) !== JSON.stringify(EMPTY_EFFECTS);
}

export function currentM1Character(state: M1GameState) {
  return state.currentEncounter ? getV1Character(state.currentEncounter.characterId) : null;
}
