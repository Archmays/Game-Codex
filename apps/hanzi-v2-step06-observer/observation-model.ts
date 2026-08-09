import type { Step06ProgressContinuityProjection } from "../my-game-world/second-use/progress-continuity";
import type {
  Step06DestinationId,
  Step06StopCode,
  Step06TechnicalEvent,
} from "../my-game-world/second-use/event-types";
import type {
  Step06EvidenceKind,
  Step06IntervalBucket,
  Step06SessionGrant,
} from "../my-game-world/second-use/session";

export const STEP06_OBSERVATION_VALUES = [
  "UNRECORDED",
  "NOTICED_WITHOUT_PROMPT",
  "NOTICED_AFTER_BUILT_IN_SUPPORT",
  "NOTICED_AFTER_REGION_ONLY_PROMPT",
  "ADULT_ANSWER_REQUIRED",
  "STOPPED",
] as const;
export type Step06ObservationValue = (typeof STEP06_OBSERVATION_VALUES)[number];

export const STEP06_INTERVENTION_CODES = [
  "NONE",
  "REPEAT_VISIBLE_COPY",
  "POINT_TO_REGION_ONLY",
  "TECHNICAL_ASSIST",
  "ADULT_ANSWER_REQUIRED",
  "STOPPED",
] as const;
export type Step06InterventionCode = (typeof STEP06_INTERVENTION_CODES)[number];

export const STEP06_POINTABLE_REGIONS = ["WORLD", "WORLD_OBJECTS", "FOREST_PLAYFIELD", "BOARD", "HAND"] as const;
export type Step06PointableRegion = (typeof STEP06_POINTABLE_REGIONS)[number];

export const STEP06_INTERVENTION_CHECKPOINTS = [
  "recognizedWorld", "noticedPersistentRepairs", "selectedDestination", "understoodForestPortal",
  "understoodSpellbook", "understoodTreasureBox", "returnedToWorld", "rememberedCorePlacement",
  "usedBuiltInHintsOnly", "neededAdultAnswer", "showedBoredomWithRepeatedRoute", "voluntarilyContinued",
  "exploredAnotherWorldObject", "askedForMoreAfterOfficialCheck",
] as const;
export type Step06InterventionCheckpoint = (typeof STEP06_INTERVENTION_CHECKPOINTS)[number];

export const STEP06_WELLBEING_VALUES = ["OBSERVED", "NOT_OBSERVED", "UNKNOWN"] as const;
export type Step06WellbeingValue = (typeof STEP06_WELLBEING_VALUES)[number];

export interface Step06DerivedActions {
  readonly firstWorldActionMs: number | null;
  readonly firstDestination: Step06DestinationId | null;
  readonly forestEntered: boolean;
  readonly worldSpellbookOpened: boolean;
  readonly classicHubOpened: boolean;
  readonly goldenRunCompleted: boolean;
  readonly returnedToWorld: boolean;
  readonly worldLoopCompleted: boolean;
}

export interface Step06HumanObservations {
  readonly worldRecognition: {
    readonly recognizedWorld: Step06ObservationValue;
    readonly noticedPersistentRepairs: Step06ObservationValue;
    readonly selectedDestination: Step06ObservationValue;
    readonly understoodForestPortal: Step06ObservationValue;
    readonly understoodSpellbook: Step06ObservationValue;
    readonly understoodTreasureBox: Step06ObservationValue;
    readonly returnedToWorld: Step06ObservationValue;
  };
  readonly familiarization: {
    readonly rememberedCorePlacement: Step06ObservationValue;
    readonly usedBuiltInHintsOnly: Step06ObservationValue;
    readonly neededAdultAnswer: Step06ObservationValue;
    readonly showedBoredomWithRepeatedRoute: Step06ObservationValue;
  };
  readonly engagement: {
    readonly voluntarilyContinued: Step06ObservationValue;
    readonly exploredAnotherWorldObject: Step06ObservationValue;
    readonly askedForMoreAfterOfficialCheck: Step06ObservationValue;
  };
}

export interface Step06Intervention {
  readonly checkpointId: Step06InterventionCheckpoint;
  readonly relativeMs: number;
  readonly code: Step06InterventionCode;
  readonly region: Step06PointableRegion | null;
}

export interface Step06Wellbeing {
  readonly comfortable: Step06WellbeingValue;
  readonly briefConfusionRecovered: Step06WellbeingValue;
  readonly sustainedFrustration: Step06WellbeingValue;
  readonly sensoryDiscomfort: Step06WellbeingValue;
  readonly childInitiatedStop: Step06WellbeingValue;
  readonly feltForced: Step06WellbeingValue;
}

export interface Step06ObservationDocument {
  readonly schemaVersion: 1;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "06";
  readonly evidenceKind: Step06EvidenceKind;
  readonly sessionIdentity: {
    readonly sessionId: string;
    readonly canonicalOrigin: string;
    readonly startedAtUtc: string;
  };
  readonly buildIdentity: {
    readonly commitSha: string;
    readonly technicalState: "DEFAULT_WORLD_ENTRY_PROMOTED_SECOND_USE_READY";
  };
  readonly parentAuthorization: {
    readonly feedbackSha256: string;
    readonly candidateCommit: string;
    readonly evidenceSha256: string;
    readonly candidateRevision: string;
    readonly authorizeDefaultWorldEntry: "YES";
    readonly authorizeSecondUseCheck: "YES";
  };
  readonly intervalBucket: Step06IntervalBucket;
  readonly progressContinuity: Step06ProgressContinuityProjection;
  readonly technicalEvents: readonly Step06TechnicalEvent[];
  readonly derivedActions: Step06DerivedActions;
  readonly observations: Step06HumanObservations;
  readonly interventions: readonly Step06Intervention[];
  readonly wellbeing: Step06Wellbeing;
  readonly completion: {
    readonly childRouteLoaded: boolean;
    readonly sessionStopped: true;
    readonly relativeDurationMs: number;
    readonly stopCode: Step06StopCode;
  };
  readonly privacyConfirmed: true;
  readonly observerNotes: string;
}

export function emptyStep06Observations(): Step06HumanObservations {
  const value = "UNRECORDED" as const;
  return {
    worldRecognition: {
      recognizedWorld: value,
      noticedPersistentRepairs: value,
      selectedDestination: value,
      understoodForestPortal: value,
      understoodSpellbook: value,
      understoodTreasureBox: value,
      returnedToWorld: value,
    },
    familiarization: {
      rememberedCorePlacement: value,
      usedBuiltInHintsOnly: value,
      neededAdultAnswer: value,
      showedBoredomWithRepeatedRoute: value,
    },
    engagement: {
      voluntarilyContinued: value,
      exploredAnotherWorldObject: value,
      askedForMoreAfterOfficialCheck: value,
    },
  };
}

export function emptyStep06Wellbeing(): Step06Wellbeing {
  return {
    comfortable: "UNKNOWN",
    briefConfusionRecovered: "UNKNOWN",
    sustainedFrustration: "UNKNOWN",
    sensoryDiscomfort: "UNKNOWN",
    childInitiatedStop: "UNKNOWN",
    feltForced: "UNKNOWN",
  };
}

export function deriveStep06Actions(events: readonly Step06TechnicalEvent[]): Step06DerivedActions {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const firstAction = ordered.find((event) => event.eventType === "world_first_action");
  const firstDestinationEvent = ordered.find((event) => event.eventType === "world_destination_opened");
  const firstDestination = firstDestinationEvent?.safeMetadata.destinationId ?? null;
  const returnedIndex = ordered.findIndex((event) => event.eventType === "returned_to_world");
  const destinationIndex = ordered.findIndex((event) => event.eventType === "world_destination_opened");
  return {
    firstWorldActionMs: firstAction?.relativeMs ?? null,
    firstDestination,
    forestEntered: ordered.some((event) => event.eventType === "forest_entered"),
    worldSpellbookOpened: ordered.some((event) => event.eventType === "world_spellbook_opened"),
    classicHubOpened: ordered.some((event) => event.eventType === "classic_hub_opened"),
    goldenRunCompleted: ordered.some((event) => event.eventType === "golden_run_completed"),
    returnedToWorld: returnedIndex >= 0,
    worldLoopCompleted: destinationIndex >= 0 && returnedIndex > destinationIndex,
  };
}

export function buildStep06Observation(
  grant: Step06SessionGrant,
  input: {
    readonly events: readonly Step06TechnicalEvent[];
    readonly observations: Step06HumanObservations;
    readonly interventions: readonly Step06Intervention[];
    readonly wellbeing: Step06Wellbeing;
    readonly childRouteLoaded: boolean;
    readonly stopCode: Step06StopCode;
    readonly observerNotes: string;
    readonly nowMs?: number;
  },
): Step06ObservationDocument {
  const nowMs = input.nowMs ?? Date.now();
  return {
    schemaVersion: 1,
    initiativeId: "hanzi-radical-battle-v2",
    step: "06",
    evidenceKind: grant.evidenceKind,
    sessionIdentity: { sessionId: grant.sessionId, canonicalOrigin: grant.canonicalOrigin, startedAtUtc: grant.startedAtUtc },
    buildIdentity: { commitSha: grant.buildCommit, technicalState: grant.technicalState },
    parentAuthorization: {
      feedbackSha256: grant.parentFeedbackSha256,
      candidateCommit: grant.parentCandidateCommit,
      evidenceSha256: grant.parentEvidenceSha256,
      candidateRevision: grant.parentCandidateRevision,
      authorizeDefaultWorldEntry: grant.authorizeDefaultWorldEntry,
      authorizeSecondUseCheck: grant.authorizeSecondUseCheck,
    },
    intervalBucket: grant.intervalBucket,
    progressContinuity: grant.progressContinuity,
    technicalEvents: [...input.events].sort((a, b) => a.sequence - b.sequence),
    derivedActions: deriveStep06Actions(input.events),
    observations: input.observations,
    interventions: input.interventions,
    wellbeing: input.wellbeing,
    completion: {
      childRouteLoaded: input.childRouteLoaded,
      sessionStopped: true,
      relativeDurationMs: Math.max(0, Math.round(nowMs - grant.startedAtMs)),
      stopCode: input.stopCode,
    },
    privacyConfirmed: true,
    observerNotes: input.observerNotes.slice(0, 1000),
  };
}
