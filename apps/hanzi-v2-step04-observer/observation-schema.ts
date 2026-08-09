import {
  AGAIN_AGAIN_VALUES,
  CHECKPOINT_NOTICE_VALUES,
  CHECKPOINT_REACH_VALUES,
  ENGAGEMENT_OBSERVATION_IDS,
  FAVORITE_MOMENT_VALUES,
  FIRST_USE_CHECKPOINTS,
  INTERVENTION_CODES,
  LEARNING_VISIBILITY_OBSERVATION_IDS,
  OBSERVATION_VALUES,
  PARENT_OBSERVED_REPLAY_VALUES,
  POINTABLE_REGIONS,
  STEP04_ACCEPTED_SOURCE_SNAPSHOTS,
  STEP04_AUDIO_CONTRACT_VERSION,
  STEP04_RUNTIME_VERSION,
  STEP04_TECHNICAL_STATE,
  USABILITY_OBSERVATION_IDS,
  WELLBEING_VALUES,
  type FirstUseObservationPackage,
  type FirstUseObservationPackageV1,
  type FirstUseObservationPackageV2,
} from "./observation-model";
import {
  FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256,
  FIRST_USE_AUDIO_CHOICES,
  FIRST_USE_PARENT_FEEDBACK_SHA256,
  FIRST_USE_SESSION_MODES,
  isFirstUseRunSeed,
  isFirstUseSessionId,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/session";
import { FIRST_USE_STOP_CODES, isFirstUseTechnicalEvent } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types";
import { validateFirstUsePrivacy, validateObserverNotes } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/privacy";
import { deriveCheckpointReach, evidenceConsistencyWarnings } from "./evidence-reconciliation";
import { migrateFirstUseObservationV1ToV2 } from "./observation-migration";

export interface ObservationSchemaValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

const SHA256_PATTERN = /^[A-F0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const PHRASE_RESULTS = ["HEARD_OK", "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE"] as const;
const ADAPTER_STATUSES = ["SPEECH_SYNTHESIS", "UNAVAILABLE"] as const;
const VOICE_CATEGORIES = ["ZH_CN_DEVICE_VOICE", "ZH_DEVICE_VOICE", "DEFAULT_DEVICE_VOICE", "NONE"] as const;
const FIRST_RUN_AUDIO = [
  { visualPinyin: "míng", spokenPhrase: "明，明亮的明。" },
  { visualPinyin: "huā", spokenPhrase: "花，花朵的花。" },
  { visualPinyin: "lín", spokenPhrase: "林，树林的林。" },
  { visualPinyin: "xīng", spokenPhrase: "星，星星的星。" },
] as const;

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isUtcDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validateObservationRecord(value: unknown, ids: readonly string[], path: string, errors: string[]): void {
  if (!hasExactKeys(value, ids)) {
    errors.push(`${path} must contain exactly the stable observation IDs`);
    return;
  }
  for (const id of ids) if (!isOneOf(value[id], OBSERVATION_VALUES)) errors.push(`${path}.${id} has an invalid observation value`);
}

export function validateFirstUseObservationV1(value: unknown): ObservationSchemaValidationResult {
  const errors: string[] = [];
  const topKeys = [
    "schemaVersion", "initiativeId", "step", "evidenceKind", "sessionIdentity", "buildIdentity",
    "parentAuthorization", "audioPreflight", "technicalEvents", "observations", "interventions",
    "wellbeing", "optionalChildChoices", "completion", "privacyConfirmed", "observerNotes",
  ];
  if (!hasExactKeys(value, topKeys)) return { ok: false, errors: ["Observation package has missing or additional top-level properties"] };
  const record = value;
  if (record.schemaVersion !== 1 || record.initiativeId !== "hanzi-radical-battle-v2" || record.step !== "04") errors.push("Observation identity/version is invalid");
  if (record.evidenceKind !== "REAL_CHILD_OBSERVATION" && record.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") errors.push("evidenceKind is invalid");

  const sessionKeys = ["sessionId", "runSeed", "sessionMode", "startedAtUtc", "runCount"];
  if (!hasExactKeys(record.sessionIdentity, sessionKeys)) errors.push("sessionIdentity has missing or additional properties");
  else {
    const session = record.sessionIdentity;
    if (!isFirstUseSessionId(session.sessionId)) errors.push("sessionIdentity.sessionId is invalid");
    if (!isFirstUseRunSeed(session.runSeed)) errors.push("sessionIdentity.runSeed is invalid");
    if (!isOneOf(session.sessionMode, FIRST_USE_SESSION_MODES)) errors.push("sessionIdentity.sessionMode is invalid");
    if (!isUtcDate(session.startedAtUtc)) errors.push("sessionIdentity.startedAtUtc is invalid");
    if (session.runCount !== 1 && session.runCount !== 2) errors.push("sessionIdentity.runCount must be 1 or 2");
  }

  const buildKeys = [
    "schemaVersion", "initiativeId", "step", "technicalState", "runtimeVersion", "audioContractVersion",
    "parentFeedbackSha256", "acceptedReviewIdentitySha256", "acceptedSourceSnapshots", "commitSha",
    "generatedAtUtc", "buildIdentitySha256",
  ];
  if (!hasExactKeys(record.buildIdentity, buildKeys)) errors.push("buildIdentity has missing or additional properties");
  else {
    const build = record.buildIdentity;
    if (build.schemaVersion !== 1 || build.initiativeId !== "hanzi-radical-battle-v2" || build.step !== "04") errors.push("buildIdentity base identity is invalid");
    if (build.technicalState !== STEP04_TECHNICAL_STATE || build.runtimeVersion !== STEP04_RUNTIME_VERSION || build.audioContractVersion !== STEP04_AUDIO_CONTRACT_VERSION) errors.push("buildIdentity runtime contract is invalid");
    if (build.parentFeedbackSha256 !== FIRST_USE_PARENT_FEEDBACK_SHA256 || build.acceptedReviewIdentitySha256 !== FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256) errors.push("buildIdentity accepted identity does not match");
    if (!hasExactKeys(build.acceptedSourceSnapshots, Object.keys(STEP04_ACCEPTED_SOURCE_SNAPSHOTS))) errors.push("acceptedSourceSnapshots has missing or additional properties");
    else for (const [key, expected] of Object.entries(STEP04_ACCEPTED_SOURCE_SNAPSHOTS)) if (build.acceptedSourceSnapshots[key] !== expected) errors.push(`acceptedSourceSnapshots.${key} changed`);
    if (typeof build.commitSha !== "string" || !COMMIT_PATTERN.test(build.commitSha)) errors.push("buildIdentity.commitSha is invalid");
    if (!isUtcDate(build.generatedAtUtc)) errors.push("buildIdentity.generatedAtUtc is invalid");
    if (typeof build.buildIdentitySha256 !== "string" || !SHA256_PATTERN.test(build.buildIdentitySha256)) errors.push("buildIdentity.buildIdentitySha256 is invalid");
  }

  const authKeys = ["schemaVersion", "initiativeId", "step", "authorized", "authorizeChildFirstUse", "audioDecision", "parentFeedbackSha256", "acceptedReviewIdentitySha256", "checkedAtUtc"];
  if (!hasExactKeys(record.parentAuthorization, authKeys)) errors.push("parentAuthorization has missing or additional properties");
  else {
    const auth = record.parentAuthorization;
    if (auth.schemaVersion !== 1 || auth.initiativeId !== "hanzi-radical-battle-v2" || auth.step !== "04") errors.push("parentAuthorization identity/version is invalid");
    if (auth.authorized !== true || auth.authorizeChildFirstUse !== "YES" || auth.audioDecision !== "REVISE") errors.push("Parent authorization is incomplete");
    if (auth.parentFeedbackSha256 !== FIRST_USE_PARENT_FEEDBACK_SHA256 || auth.acceptedReviewIdentitySha256 !== FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256) errors.push("Parent authorization identity does not match");
    if (!isUtcDate(auth.checkedAtUtc)) errors.push("parentAuthorization.checkedAtUtc is invalid");
  }

  const audioKeys = ["decision", "lang", "adapterStatus", "voiceCategory", "visualPinyinConfirmed", "phraseChecks"];
  if (!hasExactKeys(record.audioPreflight, audioKeys)) errors.push("audioPreflight has missing or additional properties");
  else {
    const audio = record.audioPreflight;
    if (!isOneOf(audio.decision, FIRST_USE_AUDIO_CHOICES) || audio.lang !== "zh-CN" || audio.visualPinyinConfirmed !== true) errors.push("audioPreflight decision/lang/visual confirmation is invalid");
    if (!isOneOf(audio.adapterStatus, ADAPTER_STATUSES) || !isOneOf(audio.voiceCategory, VOICE_CATEGORIES)) errors.push("audioPreflight adapter/voice category is invalid");
    if (!Array.isArray(audio.phraseChecks) || audio.phraseChecks.length !== 4) errors.push("audioPreflight must contain exactly four phrase checks");
    else audio.phraseChecks.forEach((phrase, index) => {
      if (!hasExactKeys(phrase, ["visualPinyin", "spokenPhrase", "result"])) errors.push(`audioPreflight.phraseChecks[${index}] is not closed`);
      else if (phrase.visualPinyin !== FIRST_RUN_AUDIO[index].visualPinyin || phrase.spokenPhrase !== FIRST_RUN_AUDIO[index].spokenPhrase || !isOneOf(phrase.result, PHRASE_RESULTS)) errors.push(`audioPreflight.phraseChecks[${index}] is invalid`);
    });
  }

  if (!Array.isArray(record.technicalEvents) || record.technicalEvents.length > 500) errors.push("technicalEvents must be an array with at most 500 events");
  else {
    let priorSequence = 0;
    let priorRelativeMs = -1;
    const sessionId = hasExactKeys(record.sessionIdentity, sessionKeys) ? record.sessionIdentity.sessionId : null;
    for (const event of record.technicalEvents) {
      if (!isFirstUseTechnicalEvent(event)) errors.push("technicalEvents contains an invalid event");
      else {
        if (event.sessionId !== sessionId) errors.push("technical event sessionId does not match");
        if (event.sequence <= priorSequence) errors.push("technical event sequence must be strictly increasing and deduplicated");
        if (event.relativeMs < priorRelativeMs || event.relativeMs > 3_600_000) errors.push("technical event relativeMs is invalid");
        priorSequence = event.sequence;
        priorRelativeMs = event.relativeMs;
      }
    }
  }

  if (!hasExactKeys(record.observations, ["checkpoints", "usability", "engagement", "learningMechanismVisibility"])) errors.push("observations has missing or additional properties");
  else {
    validateObservationRecord(record.observations.checkpoints, FIRST_USE_CHECKPOINTS, "observations.checkpoints", errors);
    validateObservationRecord(record.observations.usability, USABILITY_OBSERVATION_IDS, "observations.usability", errors);
    validateObservationRecord(record.observations.engagement, ENGAGEMENT_OBSERVATION_IDS, "observations.engagement", errors);
    validateObservationRecord(record.observations.learningMechanismVisibility, LEARNING_VISIBILITY_OBSERVATION_IDS, "observations.learningMechanismVisibility", errors);
  }

  if (!Array.isArray(record.interventions) || record.interventions.length > 50) errors.push("interventions must be an array with at most 50 entries");
  else for (const intervention of record.interventions) {
    if (!hasExactKeys(intervention, ["checkpointId", "code", "region", "relativeMs"])) errors.push("intervention has missing or additional properties");
    else {
      if (!isOneOf(intervention.checkpointId, FIRST_USE_CHECKPOINTS) || !isOneOf(intervention.code, INTERVENTION_CODES)) errors.push("intervention enum is invalid");
      const validRegion = intervention.region === null || isOneOf(intervention.region, POINTABLE_REGIONS);
      if (!validRegion || (intervention.code === "POINT_TO_REGION_ONLY") !== (intervention.region !== null)) errors.push("POINT_TO_REGION_ONLY must use WORLD, BOARD, or HAND; other interventions must not store a region");
      if (!Number.isSafeInteger(intervention.relativeMs) || (intervention.relativeMs as number) < 0 || (intervention.relativeMs as number) > 3_600_000) errors.push("intervention relativeMs is invalid");
    }
  }

  const wellbeingKeys = ["comfortable", "briefConfusionRecovered", "sustainedFrustration", "sensoryDiscomfort", "childInitiatedStop", "feltForced", "stopCode"];
  if (!hasExactKeys(record.wellbeing, wellbeingKeys)) errors.push("wellbeing has missing or additional properties");
  else {
    for (const key of wellbeingKeys.slice(0, -1)) if (!isOneOf(record.wellbeing[key], WELLBEING_VALUES)) errors.push(`wellbeing.${key} is invalid`);
    if (record.wellbeing.stopCode !== null && !isOneOf(record.wellbeing.stopCode, FIRST_USE_STOP_CODES)) errors.push("wellbeing.stopCode is invalid");
  }

  const choiceKeys = ["againAgain", "favoriteMoment", "spontaneousReplay", "promptedReplay", "optionalQuestionsAsked"];
  if (!hasExactKeys(record.optionalChildChoices, choiceKeys)) errors.push("optionalChildChoices has missing or additional properties");
  else {
    const choices = record.optionalChildChoices;
    if (!isOneOf(choices.againAgain, AGAIN_AGAIN_VALUES) || !isOneOf(choices.favoriteMoment, FAVORITE_MOMENT_VALUES)) errors.push("Optional child choice enum is invalid");
    for (const key of choiceKeys.slice(2)) if (typeof choices[key] !== "boolean") errors.push(`optionalChildChoices.${key} must be boolean`);
    if (choices.spontaneousReplay === true && choices.promptedReplay === true) errors.push("Replay cannot be both spontaneous and prompted");
  }

  const completionKeys = ["childRouteLoaded", "runCompleted", "sessionStopped", "relativeDurationMs", "runCount", "stopCode"];
  if (!hasExactKeys(record.completion, completionKeys)) errors.push("completion has missing or additional properties");
  else {
    const completion = record.completion;
    for (const key of completionKeys.slice(0, 3)) if (typeof completion[key] !== "boolean") errors.push(`completion.${key} must be boolean`);
    if (!Number.isSafeInteger(completion.relativeDurationMs) || (completion.relativeDurationMs as number) < 0 || (completion.relativeDurationMs as number) > 3_600_000) errors.push("completion.relativeDurationMs is invalid");
    if (completion.runCount !== 1 && completion.runCount !== 2) errors.push("completion.runCount must be 1 or 2");
    if ((completion.sessionStopped === true) !== (completion.stopCode !== null) || (completion.stopCode !== null && !isOneOf(completion.stopCode, FIRST_USE_STOP_CODES))) errors.push("completion stop state/code is invalid");
    if (hasExactKeys(record.sessionIdentity, sessionKeys) && record.sessionIdentity.runCount !== completion.runCount) errors.push("Session and completion runCount must match");
    if (Array.isArray(record.interventions) && record.interventions.some((item) => hasExactKeys(item, ["checkpointId", "code", "region", "relativeMs"]) && item.code === "ADULT_ANSWER_REQUIRED") && completion.stopCode !== "ADULT_ANSWER_REQUIRED") errors.push("ADULT_ANSWER_REQUIRED must stop the formal session with the matching code");
  }

  if (record.privacyConfirmed !== true) errors.push("privacyConfirmed must be true");
  errors.push(...validateObserverNotes(record.observerNotes).issues);
  errors.push(...validateFirstUsePrivacy(record).issues);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function legacyProjection(value: FirstUseObservationPackageV2): FirstUseObservationPackageV1 {
  return {
    schemaVersion: 1,
    initiativeId: value.initiativeId,
    step: value.step,
    evidenceKind: value.evidenceKind,
    sessionIdentity: value.sessionIdentity,
    buildIdentity: value.buildIdentity,
    parentAuthorization: value.parentAuthorization,
    audioPreflight: value.audioPreflight,
    technicalEvents: value.technicalEvents,
    observations: {
      checkpoints: Object.fromEntries(FIRST_USE_CHECKPOINTS.map((checkpointId) => [
        checkpointId,
        value.observations.checkpointNotice[checkpointId] === "UNRECORDED"
          ? "NOT_REACHED"
          : value.observations.checkpointNotice[checkpointId],
      ])) as FirstUseObservationPackageV1["observations"]["checkpoints"],
      usability: value.observations.usability,
      engagement: value.observations.engagement,
      learningMechanismVisibility: value.observations.learningMechanismVisibility,
    },
    interventions: value.interventions,
    wellbeing: value.wellbeing,
    optionalChildChoices: value.optionalChildChoices,
    completion: value.completion,
    privacyConfirmed: value.privacyConfirmed,
    observerNotes: value.observerNotes,
  };
}

export function validateFirstUseObservationV2(value: unknown): ObservationSchemaValidationResult {
  const errors: string[] = [];
  const topKeys = [
    "schemaVersion", "initiativeId", "step", "evidenceKind", "fixtureLabel", "sessionIdentity",
    "buildIdentity", "parentAuthorization", "audioPreflight", "technicalEvents", "observations",
    "interventions", "wellbeing", "optionalChildChoices", "replay", "completion", "privacyConfirmed",
    "observerNotes", "evidenceConsistencyWarnings",
  ];
  if (!hasExactKeys(value, topKeys)) {
    return { ok: false, errors: ["Observation v2 package has missing or additional top-level properties"] };
  }
  const record = value;
  if (record.schemaVersion !== 2 || record.initiativeId !== "hanzi-radical-battle-v2" || record.step !== "04") {
    errors.push("Observation v2 identity/version is invalid");
  }
  if (record.evidenceKind !== "REAL_CHILD_OBSERVATION" && record.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") {
    errors.push("evidenceKind is invalid");
  }
  if (record.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY") {
    if (record.fixtureLabel !== "SYNTHETIC_FROM_SCHEMA_ONLY") errors.push("Synthetic v2 evidence requires the exact schema-only fixture label");
  } else if (record.fixtureLabel !== null) {
    errors.push("Real child evidence must not carry a fixture label");
  }

  if (!hasExactKeys(record.observations, ["checkpointReach", "checkpointNotice", "usability", "engagement", "learningMechanismVisibility"])) {
    errors.push("observations has missing or additional v2 properties");
  } else {
    const observations = record.observations;
    if (!hasExactKeys(observations.checkpointReach, FIRST_USE_CHECKPOINTS)) errors.push("observations.checkpointReach must contain exactly the stable checkpoint IDs");
    else for (const checkpointId of FIRST_USE_CHECKPOINTS) {
      if (!isOneOf(observations.checkpointReach[checkpointId], CHECKPOINT_REACH_VALUES)) errors.push(`observations.checkpointReach.${checkpointId} is invalid`);
    }
    if (!hasExactKeys(observations.checkpointNotice, FIRST_USE_CHECKPOINTS)) errors.push("observations.checkpointNotice must contain exactly the stable checkpoint IDs");
    else for (const checkpointId of FIRST_USE_CHECKPOINTS) {
      if (!isOneOf(observations.checkpointNotice[checkpointId], CHECKPOINT_NOTICE_VALUES)) errors.push(`observations.checkpointNotice.${checkpointId} is invalid`);
    }
    validateObservationRecord(observations.usability, USABILITY_OBSERVATION_IDS, "observations.usability", errors);
    validateObservationRecord(observations.engagement, ENGAGEMENT_OBSERVATION_IDS, "observations.engagement", errors);
    validateObservationRecord(observations.learningMechanismVisibility, LEARNING_VISIBILITY_OBSERVATION_IDS, "observations.learningMechanismVisibility", errors);
  }

  if (!hasExactKeys(record.replay, ["replayIntent", "parentObservedReplayRequest", "actualReplayAction"])) {
    errors.push("replay has missing or additional properties");
  } else {
    if (!isOneOf(record.replay.replayIntent, AGAIN_AGAIN_VALUES)) errors.push("replay.replayIntent is invalid");
    if (!isOneOf(record.replay.parentObservedReplayRequest, PARENT_OBSERVED_REPLAY_VALUES)) errors.push("replay.parentObservedReplayRequest is invalid");
    if (typeof record.replay.actualReplayAction !== "boolean") errors.push("replay.actualReplayAction must be boolean");
  }
  if (!Array.isArray(record.evidenceConsistencyWarnings) || record.evidenceConsistencyWarnings.some((warning) => typeof warning !== "string")) {
    errors.push("evidenceConsistencyWarnings must be an array of strings");
  }

  if (errors.length === 0) {
    const candidate = record as unknown as FirstUseObservationPackageV2;
    const legacyValidation = validateFirstUseObservationV1(legacyProjection(candidate));
    errors.push(...legacyValidation.errors.map((error) => `Shared v1 contract: ${error}`));
    const expectedReach = deriveCheckpointReach(candidate.technicalEvents, candidate.completion.sessionStopped);
    for (const checkpointId of FIRST_USE_CHECKPOINTS) {
      if (candidate.observations.checkpointReach[checkpointId] !== expectedReach[checkpointId]) {
        errors.push(`observations.checkpointReach.${checkpointId} must be derived from technical events`);
      }
    }
    const actualReplayAction = candidate.technicalEvents.some((event) => event.eventType === "replay_selected");
    if (candidate.replay.actualReplayAction !== actualReplayAction) errors.push("replay.actualReplayAction must be derived from replay_selected events");
    const requiredWarnings = evidenceConsistencyWarnings(candidate);
    for (const warning of requiredWarnings) {
      if (!candidate.evidenceConsistencyWarnings.includes(warning)) errors.push(`Missing evidence consistency warning: ${warning}`);
    }
  }
  errors.push(...validateFirstUsePrivacy(record).issues);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateFirstUseObservation(value: unknown): ObservationSchemaValidationResult {
  return validateFirstUseObservationV2(value);
}

export function normalizeFirstUseObservation(value: unknown): {
  readonly value: FirstUseObservationPackage;
  readonly migrated: boolean;
  readonly warnings: readonly string[];
} {
  const v2 = validateFirstUseObservationV2(value);
  if (v2.ok) {
    const observation = value as FirstUseObservationPackageV2;
    return { value: observation, migrated: false, warnings: observation.evidenceConsistencyWarnings };
  }
  const v1 = validateFirstUseObservationV1(value);
  if (!v1.ok) throw new Error(`Invalid STEP 04 observation package: ${[...v1.errors, ...v2.errors].join("; ")}`);
  const migrated = migrateFirstUseObservationV1ToV2(value as FirstUseObservationPackageV1);
  const migratedValidation = validateFirstUseObservationV2(migrated.value);
  if (!migratedValidation.ok) throw new Error(`Migrated STEP 04 observation v2 is invalid: ${migratedValidation.errors.join("; ")}`);
  return { value: migrated.value, migrated: true, warnings: migrated.warnings };
}

export function assertValidFirstUseObservation(value: unknown): asserts value is FirstUseObservationPackage {
  const result = validateFirstUseObservationV2(value);
  if (!result.ok) throw new Error(`Invalid STEP 04 observation package: ${result.errors.join("; ")}`);
}
