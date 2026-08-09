import type { CharacterComponent, CharacterStructure, PilotCard, PilotScenario, StructureSlot } from "../../content/types";

export const FINAL_GOLDEN_CHARACTER_IDS = [
  "ming",
  "hua",
  "lin",
  "xing",
  "cao",
  "kan",
  "yuan",
  "hui",
  "bao",
  "feng",
  "mao",
  "pao",
] as const;

export const DEFERRED_CHARACTER_IDS = ["qing-clear", "qing-sunny", "song"] as const;

export type GoldenCharacterId = (typeof FINAL_GOLDEN_CHARACTER_IDS)[number];
export type DeferredCharacterId = (typeof DEFERRED_CHARACTER_IDS)[number];
export type GoldenStructure = CharacterStructure;
export type GoldenComponent = CharacterComponent;

export type GoldenStage = "first-run" | "manifest-only";
export type ContentAcceptanceStatus = "accepted";

export interface V1SourceMapping {
  readonly sourceCandidateId: GoldenCharacterId | DeferredCharacterId;
  readonly step02RevisionHash: string;
  readonly sourceOrderedParts: readonly string[];
  readonly sourceCombinationKey: string;
  readonly formulaAuditStatus: "accepted";
  readonly visualHintPath: string;
}

export interface GoldenCharacter {
  readonly id: GoldenCharacterId;
  readonly glyph: string;
  readonly status: ContentAcceptanceStatus;
  readonly reviewStatus: ContentAcceptanceStatus;
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly structure: GoldenStructure;
  readonly components: readonly GoldenComponent[];
  readonly illustrationPath: string;
  readonly magic: {
    readonly id: string;
    readonly name: string;
    readonly effect: string;
  };
  readonly stage: GoldenStage;
  readonly revisionHash: string;
  readonly sourceMapping: V1SourceMapping;
  readonly etymologyClaim: null;
}

export interface DeferredCharacter {
  readonly id: DeferredCharacterId;
  readonly glyph: string;
  readonly status: ContentAcceptanceStatus;
  readonly reviewStatus: ContentAcceptanceStatus;
  readonly disposition: "accepted-deferred";
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly structure: GoldenStructure;
  readonly components: readonly GoldenComponent[];
  readonly illustrationPath: string;
  readonly revisionHash: string;
  readonly sourceMapping: V1SourceMapping;
  readonly etymologyClaim: null;
}

export type GoldenEncounterId = "encounter-ming" | "encounter-hua" | "boss-lin" | "boss-xing";

export interface GoldenEncounter extends PilotScenario {
  readonly id: GoldenEncounterId;
  readonly characterId: Extract<GoldenCharacterId, "ming" | "hua" | "lin" | "xing">;
  readonly purpose: "child-pilot";
  readonly cards: readonly PilotCard[];
  readonly slots: readonly StructureSlot[];
  readonly kind: "normal" | "boss-phase";
  readonly sequence: 1 | 2 | 3 | 4;
}

export type AbilityId = "guardian-light" | "star-path" | "ink-echo";

export interface GoldenAbility {
  readonly id: AbilityId;
  readonly name: string;
  readonly timing: "wrong-placement" | "boss-phase-start" | "boss-interference";
  readonly usesPerBossPhase: 1;
  readonly exactEffect: string;
  readonly neverAutoSolves: true;
}

export type BossPhaseId = "lin" | "xing";

export interface BossPhaseRule {
  readonly id: BossPhaseId;
  readonly encounterId: Extract<GoldenEncounterId, "boss-lin" | "boss-xing">;
  readonly intent: string;
  readonly interference: "obscure-empty-slot-outlines";
  readonly trigger: "after-first-correct-placement";
  readonly recovery: "interference-complete" | "ink-echo" | "safe-retry";
  readonly neverAutoSolves: true;
}

export interface PacingBeat {
  readonly id: string;
  readonly minimumSeconds: number;
  readonly maximumSeconds: number;
  readonly purpose: string;
}
