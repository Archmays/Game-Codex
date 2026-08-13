import type {
  V1AdventureId,
  V1EncounterId,
  V1HandCard,
  V1SlotId,
} from "../golden-slice/content/adventures";
import type { GoldenCharacterId } from "../golden-slice/content/types";

export type ChapterOneRegionId = "glimmer-grove" | "echo-garden" | "wind-trail";
export type M1SlotId = V1SlotId;
export type M1PathId =
  | "glimmer-lanterns"
  | "glimmer-fireflies"
  | "garden-arches"
  | "garden-stream"
  | "wind-bells"
  | "wind-clouds";

export type M1AbilityId =
  | "guardian-light"
  | "star-path"
  | "ink-echo"
  | "root-anchor"
  | "moon-rest"
  | "bloom-step"
  | "clear-stream"
  | "echo-pouch"
  | "wind-swap";

export type M1BehaviorId =
  | "ink-mist"
  | "playful-gust"
  | "vine-snare"
  | "echo-ripple"
  | "shadow-puddle"
  | "sleepy-spore";

export interface M1AbilityDefinition {
  readonly id: M1AbilityId;
  readonly name: string;
  readonly shortLabel: string;
  readonly childFacingEffect: string;
  readonly exactRuleEffect: string;
  readonly neverChangesAnswer: true;
}

export interface M1BehaviorDefinition {
  readonly id: M1BehaviorId;
  readonly name: string;
  readonly telegraph: string;
  readonly effect: string;
  readonly guaranteedRecovery: string;
  readonly keyboardRecovery: true;
  readonly touchRecovery: true;
  readonly neverChangesAnswer: true;
  readonly neverIntroducedFirstAtBoss: true;
}

export interface M1PathDefinition {
  readonly id: M1PathId;
  readonly regionId: ChapterOneRegionId;
  readonly label: string;
  readonly shortPromise: string;
  readonly visualKey: string;
  readonly encounterOrder: readonly V1EncounterId[];
  readonly behaviorOrder: readonly M1BehaviorId[];
}

export interface M1RegionDefinition {
  readonly id: ChapterOneRegionId;
  readonly adventureId: V1AdventureId;
  readonly title: string;
  readonly childValue: string;
  readonly hanziLearningValue: string;
  readonly paths: readonly [M1PathDefinition, M1PathDefinition];
}

export interface M1EncounterPlan {
  readonly encounterId: V1EncounterId;
  readonly characterId: GoldenCharacterId;
  readonly behaviorId: M1BehaviorId;
  readonly sequence: 0 | 1 | 2 | 3;
  readonly boss: boolean;
}

export interface M1RegionPlan {
  readonly regionId: ChapterOneRegionId;
  readonly title: string;
  readonly pathOptions: readonly [M1PathDefinition, M1PathDefinition];
  readonly abilityOffer: readonly [M1AbilityId, M1AbilityId, M1AbilityId];
}

export interface M1RunPlan {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly regions: readonly [M1RegionPlan, M1RegionPlan, M1RegionPlan];
  readonly planSignature: string;
}

export interface M1AbilityEffectSnapshot {
  readonly revealedSlotCount: number;
  readonly safePathVisible: boolean;
  readonly echoRecoveryCount: number;
  readonly anchoredCardCount: number;
  readonly focusTokens: number;
  readonly meaningPreviewVisible: boolean;
  readonly recoveryTokens: number;
  readonly returnedCardCount: number;
  readonly handRotation: number;
}

export type M1Phase =
  | "camp"
  | "route-choice"
  | "behavior-telegraph"
  | "behavior-effect"
  | "encounter"
  | "composition"
  | "meaning"
  | "ability-choice"
  | "region-complete"
  | "run-summary";

export interface M1Placement {
  readonly cardId: string;
  readonly slotId: V1SlotId;
}

export interface M1GameState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly plan: M1RunPlan;
  readonly phase: M1Phase;
  readonly regionIndex: 0 | 1 | 2;
  readonly encounterIndex: 0 | 1 | 2 | 3;
  readonly chosenPathIds: readonly M1PathId[];
  readonly selectedAbilityIds: readonly M1AbilityId[];
  readonly currentPathId: M1PathId | null;
  readonly currentEncounter: M1EncounterPlan | null;
  readonly currentBehaviorRecovered: boolean;
  readonly selectedCardId: string | null;
  readonly hand: readonly V1HandCard[];
  readonly placements: readonly M1Placement[];
  readonly invalidPlacementCount: number;
  readonly discoveredCharacterIds: readonly GoldenCharacterId[];
  readonly abilityEffects: M1AbilityEffectSnapshot;
  readonly triggeredAbilityIds: readonly M1AbilityId[];
  readonly completedBehaviorCycles: readonly M1BehaviorId[];
  readonly gentleMessage: string;
  readonly actionsToFirstEncounter: number | null;
  readonly actionCount: number;
}

export type M1Action =
  | { readonly type: "start-run" }
  | { readonly type: "choose-route"; readonly pathId: M1PathId }
  | { readonly type: "begin-behavior" }
  | { readonly type: "recover-behavior" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly slotId: V1SlotId; readonly cardId?: string }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "choose-ability"; readonly abilityId: M1AbilityId }
  | { readonly type: "repeat-seed" };

export interface M1SimulationResult {
  readonly finalState: M1GameState;
  readonly actions: readonly M1Action[];
  readonly routeSignature: string;
  readonly abilitySignature: string;
  readonly encounterSignature: string;
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
}
