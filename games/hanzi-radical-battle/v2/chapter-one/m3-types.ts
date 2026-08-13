import type { ChapterHandCard, ChapterRegionId, ChapterSlotId } from "./content-types";
import type { M1BehaviorId } from "./types";
import type { M3AbilityEffectKey, M3AbilityId, M3HeroId } from "./builds";

export type M3PathId = `${ChapterRegionId}:${"lantern" | "wild"}`;

export interface M3EncounterPlan {
  readonly id: string;
  readonly characterId: string;
  readonly handVariant: 0 | 1 | 2;
  readonly behaviorId: M1BehaviorId;
  readonly sequence: 0 | 1 | 2 | 3;
  readonly boss: boolean;
}

export interface M3PathPlan {
  readonly id: M3PathId;
  readonly regionId: ChapterRegionId;
  readonly label: string;
  readonly shortPromise: string;
  readonly visualKey: string;
  readonly encounters: readonly [M3EncounterPlan, M3EncounterPlan, M3EncounterPlan, M3EncounterPlan];
}

export interface M3RegionPlan {
  readonly regionId: ChapterRegionId;
  readonly title: string;
  readonly pathOptions: readonly [M3PathPlan, M3PathPlan];
  readonly abilityOffer: readonly [M3AbilityId, M3AbilityId, M3AbilityId];
}

export interface M3RunPlan {
  readonly schemaVersion: 2;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly regions: readonly [M3RegionPlan, M3RegionPlan, M3RegionPlan];
  readonly planSignature: string;
}

export type M3AbilityEffects = Readonly<Record<M3AbilityEffectKey, number>>;

export interface M3AbilityEvidence {
  readonly abilityId: M3AbilityId;
  readonly offered: boolean;
  readonly selected: boolean;
  readonly triggered: boolean;
  readonly stateChanged: boolean;
  readonly visibleEffectObserved: boolean;
  readonly neverAutoSolved: true;
  readonly noIllegalAnswer: true;
}

export interface M3InnateEvidence {
  readonly heroId: M3HeroId;
  readonly triggeredCount: number;
  readonly stateChanged: boolean;
  readonly visibleEffectObserved: boolean;
  readonly neverAutoSolved: true;
  readonly noIllegalAnswer: true;
}

export interface M3HeroEffects {
  readonly lightTrailCount: number;
  readonly growthLinkCount: number;
  readonly intentDetailCount: number;
  readonly companionShieldCount: number;
}

export type M3Phase = "camp" | "route-choice" | "behavior-telegraph" | "behavior-effect" | "encounter" | "composition" | "meaning" | "ability-choice" | "region-complete" | "run-summary";

export interface M3Placement { readonly cardId: string; readonly slotId: ChapterSlotId; readonly protected: boolean; }

export interface M3GameState {
  readonly schemaVersion: 2;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly plan: M3RunPlan;
  readonly phase: M3Phase;
  readonly regionIndex: 0 | 1 | 2;
  readonly encounterIndex: 0 | 1 | 2 | 3;
  readonly chosenPathIds: readonly M3PathId[];
  readonly selectedAbilityIds: readonly M3AbilityId[];
  readonly triggeredAbilityIds: readonly M3AbilityId[];
  readonly currentPathId: M3PathId | null;
  readonly currentEncounter: M3EncounterPlan | null;
  readonly currentBehaviorRecovered: boolean;
  readonly selectedCardId: string | null;
  readonly hand: readonly ChapterHandCard[];
  readonly placements: readonly M3Placement[];
  readonly invalidPlacementCount: number;
  readonly discoveredCharacterIds: readonly string[];
  readonly seenComponentGlyphs: readonly string[];
  readonly completedBehaviorCycles: readonly M1BehaviorId[];
  readonly abilityEffects: M3AbilityEffects;
  readonly heroEffects: M3HeroEffects;
  readonly abilityEvidence: readonly M3AbilityEvidence[];
  readonly innateEvidence: M3InnateEvidence;
  readonly gentleMessage: string;
  readonly actionsToFirstEncounter: number | null;
  readonly actionCount: number;
}

export type M3Action =
  | { readonly type: "select-hero"; readonly heroId: M3HeroId }
  | { readonly type: "start-run" }
  | { readonly type: "choose-route"; readonly pathId: M3PathId }
  | { readonly type: "begin-behavior" }
  | { readonly type: "recover-behavior" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly slotId: ChapterSlotId; readonly cardId?: string }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "choose-ability"; readonly abilityId: M3AbilityId }
  | { readonly type: "repeat-seed" };

export interface M3SimulationResult {
  readonly finalState: M3GameState;
  readonly actions: readonly M3Action[];
  readonly routeSignature: string;
  readonly abilitySignature: string;
  readonly encounterSignature: string;
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
}
