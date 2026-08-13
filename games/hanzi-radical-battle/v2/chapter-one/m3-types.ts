import type { ChapterHandCard, ChapterRegionId, ChapterSlotId } from "./content-types";
import type { M3AbilityEffectKey, M3AbilityId, M3HeroId } from "./builds";
import type { M5BehaviorId, M5BossId } from "./m5-content";

export type M5AdventureMode = "story" | "free";

export type M3PathId = `${ChapterRegionId}:${"lantern" | "wild"}`;

export interface M3EncounterPlan {
  readonly id: string;
  readonly characterId: string;
  readonly handVariant: 0 | 1 | 2;
  readonly behaviorId: M5BehaviorId;
  readonly combinedBehaviorIds: readonly M5BehaviorId[];
  readonly sequence: 0 | 1 | 2 | 3;
  readonly boss: boolean;
  readonly bossId: M5BossId | null;
  readonly bossPhase: 0 | 1 | 2 | 3;
  readonly finalChallenge: "none" | "structure-review" | "behavior-combination" | "meaning-restoration";
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
  readonly schemaVersion: 3;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly mode: M5AdventureMode;
  readonly regions: readonly [M3RegionPlan, M3RegionPlan, M3RegionPlan];
  readonly finalCore: {
    readonly title: "墨王核心";
    readonly sceneKey: "region-ink-king-core";
    readonly ambienceKey: "ambience-core";
    readonly encounters: readonly [M3EncounterPlan, M3EncounterPlan, M3EncounterPlan];
  };
  readonly regionOrder: readonly ChapterRegionId[];
  readonly characterCoverage: readonly string[];
  readonly monsterBehaviorSchedule: readonly M5BehaviorId[];
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

export type M3Phase = "camp" | "route-choice" | "behavior-telegraph" | "behavior-effect" | "encounter" | "composition" | "meaning" | "ability-choice" | "region-complete" | "final-intro" | "ending" | "run-summary";

export interface M3Placement { readonly cardId: string; readonly slotId: ChapterSlotId; readonly protected: boolean; }

export interface M3GameState {
  readonly schemaVersion: 3;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly mode: M5AdventureMode;
  readonly plan: M3RunPlan;
  readonly phase: M3Phase;
  readonly chapterStage: "regions" | "final-core" | "ending" | "complete";
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
  readonly completedBehaviorCycles: readonly M5BehaviorId[];
  readonly completedBossIds: readonly M5BossId[];
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
  | { readonly type: "enter-final-core" }
  | { readonly type: "finish-ending" }
  | { readonly type: "start-free-adventure"; readonly seed?: string }
  | { readonly type: "return-camp" }
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
