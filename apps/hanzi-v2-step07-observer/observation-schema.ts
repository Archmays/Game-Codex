import { isStep06TechnicalEvent, STEP06_DESTINATIONS, STEP06_STOP_CODES } from "../my-game-world/second-use/event-types";
import { containsStep06ForbiddenObserverNotes, validateStep06Privacy } from "../my-game-world/second-use/privacy";
import { STEP06_INTERVAL_BUCKETS } from "../my-game-world/second-use/session";
import { STEP07_FIXTURE_TECHNICAL_STATE, STEP07_TECHNICAL_STATE } from "../my-game-world/second-use/step07-session";
import {
  deriveStep07Actions,
  STEP07_BINARY_VALUES,
  STEP07_ENGAGEMENT_TONES,
  STEP07_OPTIONAL_NOTE_VALUES,
  STEP07_TRI_STATE_VALUES,
  type Step07ObservationDocument,
} from "./observation-model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function exactProjection(value: unknown): boolean {
  if (!hasExactKeys(value, ["originMatched", "canonicalSavePresent", "completedAndComplete", "discoveredCharacterIds", "campRepairFlags", "recoveredFromCorruption"])) return false;
  if (value.originMatched !== true || value.canonicalSavePresent !== true || value.completedAndComplete !== true || value.recoveredFromCorruption !== false) return false;
  if (!Array.isArray(value.discoveredCharacterIds) || [...value.discoveredCharacterIds].sort().join("|") !== "hua|lin|ming|xing") return false;
  return hasExactKeys(value.campRepairFlags, ["lamp", "flowers", "guardianTrees", "starPath"])
    && Object.values(value.campRepairFlags).every((item) => item === true);
}

export function validateStep07Observation(value: unknown): value is Step07ObservationDocument {
  if (!hasExactKeys(value, ["schemaVersion", "initiativeId", "step", "evidenceKind", "sessionIdentity", "buildIdentity", "intervalBucket", "progressContinuity", "technicalEvents", "derivedActions", "humanObservations", "completion", "privacyConfirmed", "optionalNote"])) return false;
  if (value.schemaVersion !== 1 || value.initiativeId !== "hanzi-radical-battle-v2" || value.step !== "07") return false;
  if (value.evidenceKind !== "REAL_CHILD_SECOND_USE" && value.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") return false;
  if (!hasExactKeys(value.sessionIdentity, ["sessionId", "canonicalOrigin", "startedAtUtc"])) return false;
  if (typeof value.sessionIdentity.sessionId !== "string" || !/^s07-[a-z0-9-]{8,64}$/.test(value.sessionIdentity.sessionId)) return false;
  const sessionId = value.sessionIdentity.sessionId;
  if (value.sessionIdentity.canonicalOrigin !== "http://127.0.0.1:5175" || typeof value.sessionIdentity.startedAtUtc !== "string" || Number.isNaN(Date.parse(value.sessionIdentity.startedAtUtc))) return false;
  if (!hasExactKeys(value.buildIdentity, ["commitSha", "technicalState", "machineVerdictSha256"]) || typeof value.buildIdentity.commitSha !== "string" || !/^[a-f0-9]{40}$/i.test(value.buildIdentity.commitSha)) return false;
  const expectedTechnicalState = value.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
    ? STEP07_FIXTURE_TECHNICAL_STATE
    : STEP07_TECHNICAL_STATE;
  if (value.buildIdentity.technicalState !== expectedTechnicalState) return false;
  if (value.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY") {
    if (value.buildIdentity.machineVerdictSha256 !== null) return false;
  } else if (typeof value.buildIdentity.machineVerdictSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.buildIdentity.machineVerdictSha256)) return false;
  if (typeof value.intervalBucket !== "string" || !STEP06_INTERVAL_BUCKETS.includes(value.intervalBucket as never) || !exactProjection(value.progressContinuity)) return false;
  if (!Array.isArray(value.technicalEvents) || value.technicalEvents.length < 1 || value.technicalEvents.length > 500 || !value.technicalEvents.every(isStep06TechnicalEvent)) return false;
  const events = value.technicalEvents;
  if (events.some((event, index) => event.sessionId !== sessionId || (index > 0 && (event.sequence <= events[index - 1].sequence || event.relativeMs < events[index - 1].relativeMs)))) return false;
  if (events[0]?.eventType !== "session_opened" || events.at(-1)?.eventType !== "session_stopped") return false;
  if (events.filter((event) => event.eventType === "session_opened").length !== 1 || events.filter((event) => event.eventType === "session_stopped").length !== 1) return false;
  if (!validateStep06Privacy(events)) return false;
  if (!hasExactKeys(value.derivedActions, ["firstActionMs", "firstDestination", "forestEntered", "spellbookOpened", "treasureOpened", "worldLoopCompleted", "goldenRunCompleted", "returnedToWorld", "hintOrRecoveryCount", "selectedAbilityId", "technicalErrorCount", "durationMs"])) return false;
  const derived = value.derivedActions;
  if (!(derived.firstActionMs === null || Number.isInteger(derived.firstActionMs))) return false;
  if (!(derived.firstDestination === null || STEP06_DESTINATIONS.includes(derived.firstDestination as never))) return false;
  if (!(derived.selectedAbilityId === null || (typeof derived.selectedAbilityId === "string" && /^[a-z0-9_-]{1,40}$/i.test(derived.selectedAbilityId)))) return false;
  if (!["forestEntered", "spellbookOpened", "treasureOpened", "worldLoopCompleted", "goldenRunCompleted", "returnedToWorld"].every((key) => typeof derived[key] === "boolean")) return false;
  if (!["hintOrRecoveryCount", "technicalErrorCount", "durationMs"].every((key) => Number.isInteger(derived[key]) && (derived[key] as number) >= 0)) return false;
  const expected = deriveStep07Actions(events, derived.durationMs as number);
  if (JSON.stringify(derived) !== JSON.stringify(expected)) return false;
  if (!hasExactKeys(value.humanObservations, ["recognizedWorld", "noticedPersistentRepairs", "adultAnswerRequired", "comfortable", "engagementTone"])) return false;
  const human = value.humanObservations;
  if (!STEP07_TRI_STATE_VALUES.includes(human.recognizedWorld as never) || !STEP07_TRI_STATE_VALUES.includes(human.noticedPersistentRepairs as never) || !STEP07_BINARY_VALUES.includes(human.adultAnswerRequired as never) || !STEP07_TRI_STATE_VALUES.includes(human.comfortable as never) || !STEP07_ENGAGEMENT_TONES.includes(human.engagementTone as never)) return false;
  if (!hasExactKeys(value.completion, ["childRouteLoaded", "sessionStopped", "stopReason", "humanEntryMode"]) || typeof value.completion.childRouteLoaded !== "boolean" || value.completion.sessionStopped !== true || !STEP06_STOP_CODES.includes(value.completion.stopReason as never)) return false;
  const expectedHumanEntryMode = value.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY" ? "SYNTHETIC_FIXTURE" : "EXPLICIT_FORM_INPUT";
  if (value.completion.humanEntryMode !== expectedHumanEntryMode) return false;
  const derivedChildRouteLoaded = events.some((event) => ["world_ready", "forest_entered", "classic_hub_opened"].includes(event.eventType));
  if (value.completion.childRouteLoaded !== derivedChildRouteLoaded) return false;
  return value.privacyConfirmed === true
    && typeof value.optionalNote === "string"
    && value.optionalNote.length <= 500
    && STEP07_OPTIONAL_NOTE_VALUES.includes(value.optionalNote as never)
    && !containsStep06ForbiddenObserverNotes(value.optionalNote);
}
