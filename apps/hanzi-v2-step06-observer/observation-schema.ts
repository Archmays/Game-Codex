import {
  isStep06TechnicalEvent,
  STEP06_DESTINATIONS,
  STEP06_STOP_CODES,
} from "../my-game-world/second-use/event-types";
import { containsStep06ForbiddenObserverNotes, validateStep06Privacy } from "../my-game-world/second-use/privacy";
import {
  STEP06_INTERVAL_BUCKETS,
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
} from "../my-game-world/second-use/session";
import {
  deriveStep06Actions,
  STEP06_INTERVENTION_CHECKPOINTS,
  STEP06_INTERVENTION_CODES,
  STEP06_OBSERVATION_VALUES,
  STEP06_POINTABLE_REGIONS,
  STEP06_WELLBEING_VALUES,
  type Step06ObservationDocument,
} from "./observation-model";

const TOP_LEVEL_KEYS = [
  "schemaVersion", "initiativeId", "step", "evidenceKind", "sessionIdentity", "buildIdentity",
  "parentAuthorization", "intervalBucket", "progressContinuity", "technicalEvents", "derivedActions",
  "observations", "interventions", "wellbeing", "completion", "privacyConfirmed", "observerNotes",
] as const;
const DERIVED_KEYS = ["firstWorldActionMs", "firstDestination", "forestEntered", "worldSpellbookOpened", "classicHubOpened", "goldenRunCompleted", "returnedToWorld", "worldLoopCompleted"] as const;
const WORLD_RECOGNITION_KEYS = ["recognizedWorld", "noticedPersistentRepairs", "selectedDestination", "understoodForestPortal", "understoodSpellbook", "understoodTreasureBox", "returnedToWorld"] as const;
const FAMILIARIZATION_KEYS = ["rememberedCorePlacement", "usedBuiltInHintsOnly", "neededAdultAnswer", "showedBoredomWithRepeatedRoute"] as const;
const ENGAGEMENT_KEYS = ["voluntarilyContinued", "exploredAnotherWorldObject", "askedForMoreAfterOfficialCheck"] as const;
const WELLBEING_KEYS = ["comfortable", "briefConfusionRecovered", "sustainedFrustration", "sensoryDiscomfort", "childInitiatedStop", "feltForced"] as const;
const REQUIRED_CHARACTER_IDS = ["hua", "lin", "ming", "xing"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && exactKeys(value, keys);
}

function isIntegerWithin(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isEnumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isEnumRecord(value: unknown, keys: readonly string[], values: readonly string[]): boolean {
  return isExactRecord(value, keys) && keys.every((key) => isEnumValue(value[key], values));
}

function validateSessionIdentity(value: unknown): value is Step06ObservationDocument["sessionIdentity"] {
  if (!isExactRecord(value, ["sessionId", "canonicalOrigin", "startedAtUtc"])) return false;
  return typeof value.sessionId === "string"
    && /^s06-[a-z0-9-]{8,64}$/.test(value.sessionId)
    && value.canonicalOrigin === "http://127.0.0.1:5175"
    && typeof value.startedAtUtc === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.startedAtUtc)
    && !Number.isNaN(Date.parse(value.startedAtUtc));
}

function validateBuildIdentity(value: unknown): boolean {
  return isExactRecord(value, ["commitSha", "technicalState"])
    && typeof value.commitSha === "string"
    && /^[a-f0-9]{40}$/.test(value.commitSha)
    && value.technicalState === "DEFAULT_WORLD_ENTRY_PROMOTED_SECOND_USE_READY";
}

function validateParentAuthorization(value: unknown): boolean {
  if (!isExactRecord(value, ["feedbackSha256", "candidateCommit", "evidenceSha256", "candidateRevision", "authorizeDefaultWorldEntry", "authorizeSecondUseCheck"])) return false;
  return value.feedbackSha256 === STEP06_PARENT_FEEDBACK_SHA256
    && value.candidateCommit === STEP06_PARENT_CANDIDATE_COMMIT
    && value.evidenceSha256 === STEP06_PARENT_EVIDENCE_SHA256
    && value.candidateRevision === STEP06_PARENT_CANDIDATE_REVISION
    && value.authorizeDefaultWorldEntry === "YES"
    && value.authorizeSecondUseCheck === "YES";
}

function validateProgressContinuity(value: unknown): boolean {
  if (!isExactRecord(value, ["originMatched", "canonicalSavePresent", "completedAndComplete", "discoveredCharacterIds", "campRepairFlags", "recoveredFromCorruption"])) return false;
  if (value.originMatched !== true || value.canonicalSavePresent !== true || value.completedAndComplete !== true || value.recoveredFromCorruption !== false) return false;
  if (!Array.isArray(value.discoveredCharacterIds) || value.discoveredCharacterIds.length !== 4) return false;
  if (value.discoveredCharacterIds.some((id) => typeof id !== "string") || [...value.discoveredCharacterIds].sort().join("|") !== REQUIRED_CHARACTER_IDS.join("|")) return false;
  const repairs = value.campRepairFlags;
  return isExactRecord(repairs, ["lamp", "flowers", "guardianTrees", "starPath"])
    && repairs.lamp === true && repairs.flowers === true && repairs.guardianTrees === true && repairs.starPath === true;
}

function validateDerivedActions(value: unknown, events: Step06ObservationDocument["technicalEvents"]): boolean {
  if (!isExactRecord(value, DERIVED_KEYS)) return false;
  if (!(value.firstWorldActionMs === null || isIntegerWithin(value.firstWorldActionMs, 0, 1_800_000))) return false;
  if (!(value.firstDestination === null || isEnumValue(value.firstDestination, STEP06_DESTINATIONS))) return false;
  if (!["forestEntered", "worldSpellbookOpened", "classicHubOpened", "goldenRunCompleted", "returnedToWorld", "worldLoopCompleted"].every((key) => typeof value[key] === "boolean")) return false;
  const derived = deriveStep06Actions(events);
  return DERIVED_KEYS.every((key) => Object.is(value[key], derived[key]));
}

function validateObservations(value: unknown): boolean {
  if (!isExactRecord(value, ["worldRecognition", "familiarization", "engagement"])) return false;
  return isEnumRecord(value.worldRecognition, WORLD_RECOGNITION_KEYS, STEP06_OBSERVATION_VALUES)
    && isEnumRecord(value.familiarization, FAMILIARIZATION_KEYS, STEP06_OBSERVATION_VALUES)
    && isEnumRecord(value.engagement, ENGAGEMENT_KEYS, STEP06_OBSERVATION_VALUES);
}

function validateInterventions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > 50) return false;
  return value.every((item) => {
    if (!isExactRecord(item, ["checkpointId", "relativeMs", "code", "region"])) return false;
    if (!isEnumValue(item.checkpointId, STEP06_INTERVENTION_CHECKPOINTS) || !isEnumValue(item.code, STEP06_INTERVENTION_CODES) || !isIntegerWithin(item.relativeMs, 0, 1_800_000)) return false;
    if (item.code === "POINT_TO_REGION_ONLY") return isEnumValue(item.region, STEP06_POINTABLE_REGIONS);
    return item.region === null;
  });
}

function validateCompletion(value: unknown): boolean {
  if (!isExactRecord(value, ["childRouteLoaded", "sessionStopped", "relativeDurationMs", "stopCode"])) return false;
  return typeof value.childRouteLoaded === "boolean"
    && value.sessionStopped === true
    && isIntegerWithin(value.relativeDurationMs, 0, 1_800_000)
    && isEnumValue(value.stopCode, STEP06_STOP_CODES);
}

export function validateStep06Observation(value: unknown): value is Step06ObservationDocument {
  if (!isExactRecord(value, TOP_LEVEL_KEYS)) return false;
  if (value.schemaVersion !== 1 || value.initiativeId !== "hanzi-radical-battle-v2" || value.step !== "06") return false;
  if (value.evidenceKind !== "REAL_CHILD_SECOND_USE" && value.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") return false;
  const sessionIdentity = value.sessionIdentity;
  if (!validateSessionIdentity(sessionIdentity) || !validateBuildIdentity(value.buildIdentity) || !validateParentAuthorization(value.parentAuthorization)) return false;
  if (!isEnumValue(value.intervalBucket, STEP06_INTERVAL_BUCKETS) || !validateProgressContinuity(value.progressContinuity)) return false;
  if (!Array.isArray(value.technicalEvents) || value.technicalEvents.length < 1 || value.technicalEvents.length > 500 || !value.technicalEvents.every(isStep06TechnicalEvent)) return false;
  const events = value.technicalEvents;
  if (events.some((event, index) => event.sessionId !== sessionIdentity.sessionId || (index > 0 && event.sequence <= events[index - 1].sequence))) return false;
  if (!validateStep06Privacy(events) || !validateDerivedActions(value.derivedActions, events)) return false;
  if (!validateObservations(value.observations) || !validateInterventions(value.interventions)) return false;
  if (!isEnumRecord(value.wellbeing, WELLBEING_KEYS, STEP06_WELLBEING_VALUES) || !validateCompletion(value.completion)) return false;
  return value.privacyConfirmed === true
    && typeof value.observerNotes === "string"
    && value.observerNotes.length <= 1000
    && !containsStep06ForbiddenObserverNotes(value.observerNotes);
}
