import type { WheelIssueCode } from "./audit/issue-codes";
import type { LegacyWheelGradeId, WheelCurriculumStage, WheelSourceMode } from "./library/legacy-wheel-types";

export type WheelAuditStatus = "validated" | "corrected-derived-record" | "quarantined" | "not-playable-context-only";
export type WheelAlignmentStatus = "legacy-label-only";
export type WheelStructure = "left-right" | "top-bottom" | "full-enclosure" | "semi-enclosure" | "not-applicable" | "unknown";
export type WheelSlotId = "left" | "right" | "top" | "bottom" | "outer" | "inner" | "context-first" | "context-second";
export type WheelComponentRole = "left-component" | "right-component" | "top-component" | "bottom-component" | "enclosing-component" | "inner-component" | "context-segment";

export interface WheelSourceEvidence {
  readonly sourceId: string;
  readonly location: string;
  readonly version: string;
  readonly license: string;
  readonly supports: string;
}

export interface CanonicalWheelAuditRecord {
  readonly legacyId: string;
  readonly sourceGradeId: LegacyWheelGradeId;
  readonly sourceGradeLabel: string;
  readonly curriculumStage: WheelCurriculumStage;
  readonly sourceMode: WheelSourceMode;
  readonly result: string;
  readonly pinyin: string;
  readonly familiarWords: readonly string[];
  readonly structure: WheelStructure;
  readonly orderedComponents: readonly string[];
  readonly slotIds: readonly WheelSlotId[];
  readonly componentRoles: readonly WheelComponentRole[];
  readonly alignmentStatus: WheelAlignmentStatus;
  readonly auditStatus: WheelAuditStatus;
  readonly issueCodes: readonly WheelIssueCode[];
  readonly correctionNote: string | null;
  readonly sourceEvidence: readonly WheelSourceEvidence[];
  readonly revisionHash: string;
}

export type WheelGradeSelection = "journey" | LegacyWheelGradeId;

export interface PlayableWheelRecord {
  readonly id: string;
  readonly legacyId: string;
  readonly sourceGradeId: LegacyWheelGradeId;
  readonly sourceGradeLabel: string;
  readonly curriculumStage: WheelCurriculumStage;
  readonly alignmentStatus: WheelAlignmentStatus;
  readonly glyph: string;
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly spokenPhrase: string;
  readonly shortMeaning: string;
  readonly meaningClue: string;
  readonly structure: Exclude<WheelStructure, "not-applicable" | "unknown">;
  readonly orderedComponents: readonly [string, string];
  readonly slotIds: readonly [WheelSlotId, WheelSlotId];
  readonly componentRoles: readonly [WheelComponentRole, WheelComponentRole];
  readonly illustrationBrief: string;
  readonly sourceEvidence: readonly WheelSourceEvidence[];
  readonly auditStatus: "validated" | "corrected-derived-record";
  readonly revisionHash: string;
}

export type WheelWorkshopPhase = "closed" | "ready" | "spinning" | "choose-card" | "place-card" | "success" | "finished" | "empty";

export interface WheelCandidateCard {
  readonly id: string;
  readonly glyph: string;
  readonly kind: "partner" | "distractor";
  readonly removedByHint: boolean;
}

export interface WheelRoundState {
  readonly recordId: string;
  readonly anchorComponentIndex: 0;
  readonly partnerComponentIndex: 1;
  readonly candidateCards: readonly WheelCandidateCard[];
  readonly selectedCardId: string | null;
  readonly placed: boolean;
  readonly landingIndex: number;
  readonly wheelRotationDegrees: number;
}

export interface WheelWorkshopState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly selectedGradeId: WheelGradeSelection;
  readonly phase: WheelWorkshopPhase;
  readonly completedRoundCount: number;
  readonly sessionRecordIds: readonly string[];
  readonly discoveredRecordIds: readonly string[];
  readonly recentRecordIds: readonly string[];
  readonly currentRound: WheelRoundState | null;
  readonly hintLevel: 0 | 1 | 2 | 3 | 4;
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type WheelWorkshopAction =
  | { readonly type: "open" }
  | { readonly type: "close" }
  | { readonly type: "choose-grade"; readonly gradeId: WheelGradeSelection }
  | { readonly type: "start-round" }
  | { readonly type: "spin" }
  | { readonly type: "settle-spin" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly slotId: WheelSlotId }
  | { readonly type: "undo" }
  | { readonly type: "request-hint" }
  | { readonly type: "continue" }
  | { readonly type: "finish-session" }
  | { readonly type: "reset-corrupt-save" };

