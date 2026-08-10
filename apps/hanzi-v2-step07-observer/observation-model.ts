import type { Step06StopCode, Step06TechnicalEvent } from "../my-game-world/second-use/event-types";
import type { Step06ProgressContinuityProjection } from "../my-game-world/second-use/progress-continuity";
import type { Step06EvidenceKind, Step06IntervalBucket } from "../my-game-world/second-use/session";
import type { Step07SessionGrant } from "../my-game-world/second-use/step07-session";

export const STEP07_TRI_STATE_VALUES = ["YES", "NO", "UNCERTAIN"] as const;
export const STEP07_BINARY_VALUES = ["YES", "NO"] as const;
export const STEP07_ENGAGEMENT_TONES = ["BORED", "NEUTRAL", "CONTINUE", "UNCERTAIN"] as const;
export const STEP07_OPTIONAL_NOTE_VALUES = [
  "",
  "孩子在开始页结束。",
  "孩子打开字灵书后结束。",
  "孩子进入森林后结束。",
  "孩子回到世界后结束。",
  "技术中断；没有记录行为结论。",
  "合成工具检查；没有真实儿童数据。",
] as const;

export type Step07TriState = (typeof STEP07_TRI_STATE_VALUES)[number];
export type Step07Binary = (typeof STEP07_BINARY_VALUES)[number];
export type Step07EngagementTone = (typeof STEP07_ENGAGEMENT_TONES)[number];
export type Step07OptionalNote = (typeof STEP07_OPTIONAL_NOTE_VALUES)[number];

export interface Step07HumanObservations {
  readonly recognizedWorld: Step07TriState;
  readonly noticedPersistentRepairs: Step07TriState;
  readonly adultAnswerRequired: Step07Binary;
  readonly comfortable: Step07TriState;
  readonly engagementTone: Step07EngagementTone;
}

export interface Step07DerivedActions {
  readonly firstActionMs: number | null;
  readonly firstDestination: "FOREST" | "SPELLBOOK" | "TREASURE_BOX" | null;
  readonly forestEntered: boolean;
  readonly spellbookOpened: boolean;
  readonly treasureOpened: boolean;
  readonly worldLoopCompleted: boolean;
  readonly goldenRunCompleted: boolean;
  readonly returnedToWorld: boolean;
  readonly hintOrRecoveryCount: number;
  readonly selectedAbilityId: string | null;
  readonly technicalErrorCount: number;
  readonly durationMs: number;
}

export interface Step07ObservationDocument {
  readonly schemaVersion: 1;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "07";
  readonly evidenceKind: Step06EvidenceKind;
  readonly sessionIdentity: {
    readonly sessionId: string;
    readonly canonicalOrigin: "http://127.0.0.1:5175";
    readonly startedAtUtc: string;
  };
  readonly buildIdentity: {
    readonly commitSha: string;
    readonly technicalState: "MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY" | "SYNTHETIC_TOOLING_TEST_ONLY";
    readonly machineVerdictSha256: string | null;
  };
  readonly intervalBucket: Step06IntervalBucket;
  readonly progressContinuity: Step06ProgressContinuityProjection;
  readonly technicalEvents: readonly Step06TechnicalEvent[];
  readonly derivedActions: Step07DerivedActions;
  readonly humanObservations: Step07HumanObservations;
  readonly completion: {
    readonly childRouteLoaded: boolean;
    readonly sessionStopped: true;
    readonly stopReason: Step06StopCode;
    readonly humanEntryMode: "EXPLICIT_FORM_INPUT" | "SYNTHETIC_FIXTURE";
  };
  readonly privacyConfirmed: true;
  readonly optionalNote: Step07OptionalNote;
}

export const DEFAULT_STEP07_HUMAN_OBSERVATIONS: Step07HumanObservations = {
  recognizedWorld: "UNCERTAIN",
  noticedPersistentRepairs: "UNCERTAIN",
  adultAnswerRequired: "NO",
  comfortable: "UNCERTAIN",
  engagementTone: "UNCERTAIN",
};

export function deriveStep07Actions(events: readonly Step06TechnicalEvent[], durationMs?: number): Step07DerivedActions {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const firstAction = ordered.find((event) => event.eventType === "world_first_action");
  const firstDestinationEvent = ordered.find((event) => event.eventType === "world_destination_opened");
  const firstDestination = firstDestinationEvent?.safeMetadata.destinationId ?? null;
  const destinationIndex = ordered.findIndex((event) => event.eventType === "world_destination_opened");
  const returnedIndex = ordered.findIndex((event) => event.eventType === "returned_to_world");
  const hintOrRecoveryPhases = new Set(["invalid_feedback", "safe_retry"]);
  return {
    firstActionMs: firstAction?.relativeMs ?? null,
    firstDestination,
    forestEntered: ordered.some((event) => event.eventType === "forest_entered"),
    spellbookOpened: ordered.some((event) => event.eventType === "world_spellbook_opened"),
    treasureOpened: ordered.some((event) => event.eventType === "world_destination_opened" && event.safeMetadata.destinationId === "TREASURE_BOX"),
    worldLoopCompleted: destinationIndex >= 0 && returnedIndex > destinationIndex,
    goldenRunCompleted: ordered.some((event) => event.eventType === "golden_run_completed"),
    returnedToWorld: returnedIndex >= 0,
    hintOrRecoveryCount: ordered.filter((event) => event.eventType === "golden_phase_entered" && hintOrRecoveryPhases.has(event.safeMetadata.phase ?? "")).length,
    selectedAbilityId: ordered.find((event) => event.eventType === "ability_selected")?.safeMetadata.abilityId ?? null,
    technicalErrorCount: ordered.filter((event) => event.eventType === "technical_error").length,
    durationMs: Math.max(0, Math.round(durationMs ?? ordered.at(-1)?.relativeMs ?? 0)),
  };
}

export function buildStep07Observation(
  grant: Step07SessionGrant,
  input: {
    readonly events: readonly Step06TechnicalEvent[];
    readonly humanObservations: Step07HumanObservations;
    readonly stopReason: Step06StopCode;
    readonly humanEntryMode: "EXPLICIT_FORM_INPUT" | "SYNTHETIC_FIXTURE";
    readonly optionalNote: Step07OptionalNote;
    readonly nowMs?: number;
  },
): Step07ObservationDocument {
  const durationMs = Math.max(0, Math.min(30 * 60 * 1000, (input.nowMs ?? Date.now()) - grant.startedAtMs));
  const events = [...input.events].sort((a, b) => a.sequence - b.sequence);
  const childRouteLoaded = events.some((event) => ["world_ready", "forest_entered", "classic_hub_opened"].includes(event.eventType));
  return {
    schemaVersion: 1,
    initiativeId: "hanzi-radical-battle-v2",
    step: "07",
    evidenceKind: grant.evidenceKind,
    sessionIdentity: {
      sessionId: grant.sessionId,
      canonicalOrigin: grant.canonicalOrigin,
      startedAtUtc: grant.startedAtUtc,
    },
    buildIdentity: {
      commitSha: grant.buildCommit,
      technicalState: grant.technicalState,
      machineVerdictSha256: grant.machineVerdictSha256,
    },
    intervalBucket: grant.intervalBucket,
    progressContinuity: grant.progressContinuity,
    technicalEvents: events,
    derivedActions: deriveStep07Actions(events, durationMs),
    humanObservations: input.humanObservations,
    completion: {
      childRouteLoaded,
      sessionStopped: true,
      stopReason: input.stopReason,
      humanEntryMode: input.humanEntryMode,
    },
    privacyConfirmed: true,
    optionalNote: input.optionalNote,
  };
}
