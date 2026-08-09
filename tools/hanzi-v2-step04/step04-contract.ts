import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";

type JsonRecord = Record<string, unknown>;

export const INITIATIVE_ID = "hanzi-radical-battle-v2";
export const STEP = "04";
export const TECHNICAL_STATE = "AUTHORIZED_CHILD_FIRST_USE_READY";
export const RUNTIME_VERSION = "hanzi-v2-step04-runtime-v1";
export const AUDIO_CONTRACT_VERSION = "hanzi-v2-step04-spoken-phrase-v1";
export const EXPECTED_PARENT_FEEDBACK_SHA256 = "3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C";
export const EXPECTED_REVIEW_IDENTITY_SHA256 = "DBA281F9954DFB591E2F3D7498B1B8F09F6C050BFBFA2436C9961B0513D73D3E";
export const EXPECTED_SOURCE_SNAPSHOTS = Object.freeze({
  encounters: "fnv1a:d805357d",
  abilities: "fnv1a:2d361817",
  boss: "fnv1a:ee5df70f",
  themeC: "fnv1a:15133968",
  manifest: "fnv1a:67ad1fe2",
});
export const EXPECTED_REVIEW_IDENTITY_PAYLOAD = Object.freeze({
  schemaVersion: 2,
  reviewContractVersion: "hanzi-v2-step03-parent-contract-v2",
  initiativeId: INITIATIVE_ID,
  technicalState: "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW",
  implementationReviewVersion: "hanzi-v2-step03-runtime-v1",
  goldenSliceManifestVersion: "hanzi-v2-step03-golden-slice-v1",
  goldenSliceManifestRevisionHash: EXPECTED_SOURCE_SNAPSHOTS.manifest,
  previewRoute: "?play=hanzi-v2-golden-slice&mode=review",
  selectedTheme: "C",
  sourceSnapshots: {
    encounters: EXPECTED_SOURCE_SNAPSHOTS.encounters,
    abilities: EXPECTED_SOURCE_SNAPSHOTS.abilities,
    boss: EXPECTED_SOURCE_SNAPSHOTS.boss,
    themeC: EXPECTED_SOURCE_SNAPSHOTS.themeC,
  },
});

export const OBSERVATION_FILE_NAME = "STEP-04_CHILD_FIRST_USE_OBSERVATION.json";
export const REAL_EVIDENCE_KIND = "REAL_CHILD_OBSERVATION";
export const FIXTURE_EVIDENCE_KIND = "SYNTHETIC_TOOLING_TEST_ONLY";

export const EVENT_TYPES = Object.freeze([
  "session_opened", "child_route_ready", "first_action", "phase_entered", "invalid_placement",
  "built_in_hint_shown", "spell_formed", "meaning_magic_completed", "ability_selected",
  "boss_intent_shown", "boss_phase_completed", "camp_repaired", "spellbook_opened",
  "run_completed", "replay_selected", "session_stopped", "technical_error",
]);
export const PHASES = Object.freeze([
  "boot", "camp_intro", "camp_objective", "travel_to_battle_1", "battle_1_intro", "battle_1_placing",
  "battle_1_forming", "battle_1_casting", "battle_1_cleared", "breather_1", "travel_to_battle_2",
  "battle_2_intro", "battle_2_placing", "battle_2_forming", "battle_2_casting", "battle_2_cleared",
  "ability_choice", "travel_to_boss", "boss_intro", "boss_phase_1_placing", "boss_phase_1_forming",
  "boss_phase_1_cleared", "boss_phase_2_placing", "boss_phase_2_forming", "boss_cleared",
  "return_to_camp", "camp_repair", "spellbook_review", "run_complete", "invalid_feedback",
  "boss_interference", "paused", "settings_open", "safe_retry",
]);
export const STOP_CODES = Object.freeze([
  "CHILD_REQUEST", "DISTRESS", "SENSORY_DISCOMFORT", "TECHNICAL", "PRIVACY", "IDENTITY", "ADULT_ANSWER_REQUIRED", "OTHER",
]);
export const OBSERVATION_VALUES = Object.freeze([
  "NOT_REACHED", "NOTICED_WITHOUT_PROMPT", "NOTICED_AFTER_BUILT_IN_SUPPORT",
  "NOTICED_AFTER_REGION_ONLY_PROMPT", "ADULT_ANSWER_REQUIRED", "STOPPED",
]);
export const INTERVENTION_CODES = Object.freeze([
  "NONE", "REPEAT_VISIBLE_COPY", "POINT_TO_REGION_ONLY", "TECHNICAL_ASSIST", "ADULT_ANSWER_REQUIRED", "STOPPED",
]);

const SESSION_MODES = ["LIVE_DASHBOARD", "COMPACT_AFTER_SESSION"] as const;
const AUDIO_DECISIONS = ["SOUND_OK", "START_MUTED"] as const;
const ADAPTER_STATUSES = ["SPEECH_SYNTHESIS", "UNAVAILABLE"] as const;
const VOICE_CATEGORIES = ["ZH_CN_DEVICE_VOICE", "ZH_DEVICE_VOICE", "DEFAULT_DEVICE_VOICE", "NONE"] as const;
const ABILITY_IDS = ["guardian-light", "star-path", "ink-echo"] as const;
const ACTION_KINDS = ["pointer", "drag", "keyboard", "other"] as const;
const ENCOUNTER_IDS = ["encounter-ming", "encounter-hua", "boss-lin", "boss-xing"] as const;
const CHARACTER_IDS = ["ming", "hua", "lin", "xing"] as const;
const BOSS_PHASE_IDS = ["lin", "xing"] as const;
const REPLAY_ORIGINS = ["spontaneous", "prompted"] as const;
const TECHNICAL_ERROR_CODES = ["BRIDGE_UNAVAILABLE", "SESSION_INVALID", "RENDER_ERROR", "AUDIO_UNAVAILABLE", "LOCAL_STORAGE_UNAVAILABLE", "UNKNOWN_LOCAL_ERROR"] as const;
const WELLBEING_VALUES = ["OBSERVED", "NOT_OBSERVED", "UNKNOWN"] as const;
const AGAIN_VALUES = ["AGAIN_NOW", "MAYBE_LATER", "STOP", "DECLINED", "NOT_ASKED"] as const;
const FAVORITE_VALUES = ["CAMP", "HANZI_MAGIC", "THREE_CHOICE", "BOSS", "SPELLBOOK", "NO_SELECTION", "NOT_ASKED"] as const;
const PHRASE_RESULTS = ["HEARD_OK", "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE"] as const;
const FIRST_RUN_AUDIO = Object.freeze([
  { visualPinyin: "míng", spokenPhrase: "明，明亮的明。" },
  { visualPinyin: "huā", spokenPhrase: "花，花朵的花。" },
  { visualPinyin: "lín", spokenPhrase: "林，树林的林。" },
  { visualPinyin: "xīng", spokenPhrase: "星，星星的星。" },
]);

const TOP_LEVEL_KEYS = [
  "schemaVersion", "initiativeId", "step", "evidenceKind", "sessionIdentity", "buildIdentity",
  "parentAuthorization", "audioPreflight", "technicalEvents", "observations", "interventions",
  "wellbeing", "optionalChildChoices", "completion", "privacyConfirmed", "observerNotes",
] as const;
const SESSION_IDENTITY_KEYS = ["sessionId", "runSeed", "sessionMode", "startedAtUtc", "runCount"] as const;
const BUILD_IDENTITY_KEYS = [
  "schemaVersion", "initiativeId", "step", "technicalState", "runtimeVersion", "audioContractVersion",
  "parentFeedbackSha256", "acceptedReviewIdentitySha256", "acceptedSourceSnapshots", "commitSha",
  "generatedAtUtc", "buildIdentitySha256",
] as const;
const AUTHORIZATION_KEYS = [
  "schemaVersion", "initiativeId", "step", "authorized", "authorizeChildFirstUse", "audioDecision", "parentFeedbackSha256",
  "acceptedReviewIdentitySha256", "checkedAtUtc",
] as const;

const EVENT_METADATA_RULES: Readonly<Record<string, { required: readonly string[]; allowed: readonly string[] }>> = Object.freeze({
  session_opened: { required: ["muted", "replayIndex"], allowed: ["muted", "replayIndex"] },
  child_route_ready: { required: ["muted"], allowed: ["muted"] },
  first_action: { required: ["actionKind"], allowed: ["actionKind"] },
  phase_entered: { required: ["phase"], allowed: ["phase"] },
  invalid_placement: { required: ["encounterId"], allowed: ["encounterId"] },
  built_in_hint_shown: { required: ["encounterId", "hintLevel"], allowed: ["encounterId", "hintLevel"] },
  spell_formed: { required: ["characterId", "encounterId"], allowed: ["characterId", "encounterId"] },
  meaning_magic_completed: { required: ["characterId", "encounterId"], allowed: ["characterId", "encounterId"] },
  ability_selected: { required: ["abilityId"], allowed: ["abilityId"] },
  boss_intent_shown: { required: ["bossPhase"], allowed: ["bossPhase"] },
  boss_phase_completed: { required: ["bossPhase"], allowed: ["bossPhase"] },
  camp_repaired: { required: [], allowed: [] },
  spellbook_opened: { required: [], allowed: [] },
  run_completed: { required: ["replayIndex"], allowed: ["replayIndex"] },
  replay_selected: { required: ["origin", "replayIndex"], allowed: ["origin", "replayIndex"] },
  session_stopped: { required: ["stopCode"], allowed: ["stopCode"] },
  technical_error: { required: ["errorCode", "recoverable"], allowed: ["errorCode", "recoverable"] },
});

const FORBIDDEN_KEYS = new Set([
  "name", "childname", "age", "school", "class", "teacher", "birthday", "birthdate", "address", "contact",
  "phone", "email", "ip", "ipaddress", "useragent", "screenresolution", "screenwidth", "screenheight",
  "coordinates", "x", "y", "rawinput", "rawkey", "keycode", "voicename", "systemvoicename", "deviceid",
  "media", "mediapath", "image", "imagepath", "photo", "photopath", "audiopath", "video", "videopath",
  "recording", "transcript", "childquote", "quote", "score", "rank", "browserstorage", "localstoragedump",
  "sessionstoragedump", "url", "remoteurl", "requesturl",
]);
const NOTE_DENYLIST = /(黄小越|姓名|名字|年龄|学校|班级|老师|生日|出生|电话|手机|微信|邮箱|地址|联系方式|孩子原话|name|age|school|class|teacher|birthday|phone|email|address|contact|voice\s*name|user\s*agent|截图|照片|录音|录像|录屏|transcript|score|rank|分数|排名|[A-Z]:\\|file:\/\/|https?:\/\/|\b1[3-9]\d{9}\b|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b)/iu;
const PATH_OR_REMOTE_PATTERN = /([A-Z]:\\|file:\/\/|https?:\/\/|\\\\[A-Za-z0-9._-]+\\)/iu;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  privacyErrors: string[];
}

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function sameJson(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function exactKeys(value: JsonRecord, keys: readonly string[], label: string, errors: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  const missing = expected.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !expected.includes(key));
  if (missing.length) errors.push(`${label} is missing: ${missing.join(", ")}.`);
  if (unexpected.length) errors.push(`${label} has unsupported fields: ${unexpected.join(", ")}.`);
}

function enumValue(value: unknown, allowed: readonly string[], label: string, errors: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) errors.push(`${label} is not an allowed enum value.`);
}

function boundedInteger(value: unknown, min: number, max: number, label: string, errors: string[]): void {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    errors.push(`${label} must be an integer from ${min} to ${max}.`);
  }
}

function isoDate(value: unknown, label: string, errors: string[]): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${label} must be a UTC ISO date-time.`);
  }
}

function requireRecord(value: unknown, label: string, errors: string[]): JsonRecord | null {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  return value;
}

async function fileSha256(path: string): Promise<string> {
  return sha256Text(await readFile(path, "utf8"));
}

function expectedCurrentIdentityErrors(currentIdentity: unknown): string[] {
  const errors: string[] = [];
  const current = requireRecord(currentIdentity, "current STEP 03 review identity", errors);
  if (!current) return errors;
  const currentSnapshots = requireRecord(current.sourceSnapshots, "STEP03_REVIEW_IDENTITY.sourceSnapshots", errors);
  if (current.goldenSliceManifestRevisionHash !== EXPECTED_SOURCE_SNAPSHOTS.manifest) errors.push("manifest frozen hash changed.");
  if (currentSnapshots) {
    for (const key of ["encounters", "abilities", "boss", "themeC"] as const) {
      if (currentSnapshots[key] !== EXPECTED_SOURCE_SNAPSHOTS[key]) errors.push(`${key} frozen hash changed.`);
    }
  }
  return errors;
}

export function validateCanonicalFeedback(
  feedback: unknown,
  reviewIdentity: unknown,
  currentIdentity: unknown = EXPECTED_REVIEW_IDENTITY_PAYLOAD,
): string[] {
  const errors = expectedCurrentIdentityErrors(currentIdentity);
  const root = requireRecord(feedback, "feedback", errors);
  const identityFile = requireRecord(reviewIdentity, "review identity file", errors);
  if (!root || !identityFile) return errors;

  if (root.schemaVersion !== 2 || root.initiativeId !== INITIATIVE_ID) errors.push("Canonical feedback identity/version is invalid.");
  if (!sameJson(root.goldenSliceIdentity, EXPECTED_REVIEW_IDENTITY_PAYLOAD)) errors.push("Canonical feedback goldenSliceIdentity does not match the accepted STEP 03 identity.");
  if (identityFile.identitySha256 !== EXPECTED_REVIEW_IDENTITY_SHA256) errors.push("Accepted review identity SHA-256 does not match.");
  if (!sameJson(identityFile.reviewIdentity, EXPECTED_REVIEW_IDENTITY_PAYLOAD)) errors.push("Accepted review identity payload does not match the accepted STEP 03 identity.");
  if (!sameJson(currentIdentity, EXPECTED_REVIEW_IDENTITY_PAYLOAD)) errors.push("FAIL_STEP04_SCOPE_DRIFT: current STEP 03 runtime identity differs from the accepted identity.");

  if (root.goldenSliceDecision !== "ACCEPT" || root.manifestDecision !== "ACCEPT" || root.bossDecision !== "ACCEPT") {
    errors.push("Golden Slice, manifest, and boss must remain accepted.");
  }
  const abilities = requireRecord(root.abilityDecisions, "feedback.abilityDecisions", errors);
  if (!abilities || ABILITY_IDS.some((id) => abilities[id] !== "ACCEPT")) errors.push("All three ability decisions must remain ACCEPT.");
  const assets = requireRecord(root.assetDecisions, "feedback.assetDecisions", errors);
  const assetIds = ["themeC", "mage", "companion", "commonMonster", "boss", "camp", "abilityCards", "meaningMagic"];
  if (!assets || assetIds.some((id) => assets[id] !== "ACCEPT")) errors.push("All eight asset decisions must remain ACCEPT.");
  if (root.audioDecision !== "REVISE") errors.push("audioDecision must remain the canonical REVISE decision.");
  if (root.authorizeChildFirstUse !== "YES") errors.push("authorizeChildFirstUse must equal exact YES.");

  const decisions = requireRecord(root.decisions, "feedback.decisions", errors);
  const characters = decisions && Array.isArray(decisions.characters) ? decisions.characters : [];
  if (characters.length !== 12 || characters.some((entry) => !isRecord(entry) || entry.decision !== "ACCEPT")) {
    errors.push("All 12 canonical character decisions must remain ACCEPT.");
  }
  return errors;
}

export function createBuildIdentity(commitSha: string, generatedAtUtc = new Date().toISOString()): JsonRecord {
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error("commitSha must be a full lowercase 40-hex Git SHA.");
  const payload = {
    schemaVersion: 1,
    initiativeId: INITIATIVE_ID,
    step: STEP,
    technicalState: TECHNICAL_STATE,
    runtimeVersion: RUNTIME_VERSION,
    audioContractVersion: AUDIO_CONTRACT_VERSION,
    parentFeedbackSha256: EXPECTED_PARENT_FEEDBACK_SHA256,
    acceptedReviewIdentitySha256: EXPECTED_REVIEW_IDENTITY_SHA256,
    acceptedSourceSnapshots: { ...EXPECTED_SOURCE_SNAPSHOTS },
    commitSha,
    generatedAtUtc,
  };
  return { ...payload, buildIdentitySha256: sha256Text(stableSerialize(payload)) };
}

export function createParentAuthorization(checkedAtUtc = new Date().toISOString()): JsonRecord {
  return {
    schemaVersion: 1,
    initiativeId: INITIATIVE_ID,
    step: STEP,
    authorized: true,
    authorizeChildFirstUse: "YES",
    audioDecision: "REVISE",
    parentFeedbackSha256: EXPECTED_PARENT_FEEDBACK_SHA256,
    acceptedReviewIdentitySha256: EXPECTED_REVIEW_IDENTITY_SHA256,
    checkedAtUtc,
  };
}

function validateSessionIdentity(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "sessionIdentity", errors); if (!record) return;
  exactKeys(record, SESSION_IDENTITY_KEYS, "sessionIdentity", errors);
  if (typeof record.sessionId !== "string" || !/^s04-[a-f0-9]{32}$/.test(record.sessionId)) errors.push("sessionIdentity.sessionId is invalid.");
  if (typeof record.runSeed !== "string" || !/^[a-f0-9]{16}$/.test(record.runSeed)) errors.push("sessionIdentity.runSeed is invalid.");
  enumValue(record.sessionMode, SESSION_MODES, "sessionIdentity.sessionMode", errors);
  isoDate(record.startedAtUtc, "sessionIdentity.startedAtUtc", errors);
  boundedInteger(record.runCount, 1, 2, "sessionIdentity.runCount", errors);
}

function validateSourceSnapshots(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "buildIdentity.acceptedSourceSnapshots", errors); if (!record) return;
  exactKeys(record, Object.keys(EXPECTED_SOURCE_SNAPSHOTS), "buildIdentity.acceptedSourceSnapshots", errors);
  if (!sameJson(record, EXPECTED_SOURCE_SNAPSHOTS)) errors.push("FAIL_STEP04_SCOPE_DRIFT: accepted source snapshots changed.");
}

export function validateBuildIdentity(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "buildIdentity", errors); if (!record) return;
  exactKeys(record, BUILD_IDENTITY_KEYS, "buildIdentity", errors);
  const checks: Array<[string, unknown, unknown]> = [
    ["schemaVersion", record.schemaVersion, 1], ["initiativeId", record.initiativeId, INITIATIVE_ID], ["step", record.step, STEP],
    ["technicalState", record.technicalState, TECHNICAL_STATE], ["runtimeVersion", record.runtimeVersion, RUNTIME_VERSION],
    ["audioContractVersion", record.audioContractVersion, AUDIO_CONTRACT_VERSION],
    ["parentFeedbackSha256", record.parentFeedbackSha256, EXPECTED_PARENT_FEEDBACK_SHA256],
    ["acceptedReviewIdentitySha256", record.acceptedReviewIdentitySha256, EXPECTED_REVIEW_IDENTITY_SHA256],
  ];
  for (const [label, actual, expected] of checks) if (actual !== expected) errors.push(`buildIdentity.${label} does not match.`);
  validateSourceSnapshots(record.acceptedSourceSnapshots, errors);
  if (typeof record.commitSha !== "string" || !/^[a-f0-9]{40}$/.test(record.commitSha)) errors.push("buildIdentity.commitSha is invalid.");
  isoDate(record.generatedAtUtc, "buildIdentity.generatedAtUtc", errors);
  if (typeof record.buildIdentitySha256 !== "string" || !/^[A-F0-9]{64}$/.test(record.buildIdentitySha256)) {
    errors.push("buildIdentity.buildIdentitySha256 is invalid.");
  } else {
    const { buildIdentitySha256, ...payload } = record;
    if (buildIdentitySha256 !== sha256Text(stableSerialize(payload))) errors.push("buildIdentity SHA-256 does not match its payload.");
  }
}

function validateAuthorization(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "parentAuthorization", errors); if (!record) return;
  exactKeys(record, AUTHORIZATION_KEYS, "parentAuthorization", errors);
  if (record.schemaVersion !== 1 || record.initiativeId !== INITIATIVE_ID || record.step !== STEP) errors.push("parentAuthorization identity/version mismatch.");
  if (record.authorized !== true || record.authorizeChildFirstUse !== "YES" || record.audioDecision !== "REVISE") errors.push("parentAuthorization is not the exact authorized STEP 04 state.");
  if (record.parentFeedbackSha256 !== EXPECTED_PARENT_FEEDBACK_SHA256 || record.acceptedReviewIdentitySha256 !== EXPECTED_REVIEW_IDENTITY_SHA256) errors.push("parentAuthorization identity mismatch.");
  isoDate(record.checkedAtUtc, "parentAuthorization.checkedAtUtc", errors);
}

function validateAudioPreflight(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "audioPreflight", errors); if (!record) return;
  exactKeys(record, ["decision", "lang", "adapterStatus", "voiceCategory", "visualPinyinConfirmed", "phraseChecks"], "audioPreflight", errors);
  enumValue(record.decision, AUDIO_DECISIONS, "audioPreflight.decision", errors);
  if (record.lang !== "zh-CN" || record.visualPinyinConfirmed !== true) errors.push("audioPreflight must keep zh-CN and visible pinyin confirmation.");
  enumValue(record.adapterStatus, ADAPTER_STATUSES, "audioPreflight.adapterStatus", errors);
  enumValue(record.voiceCategory, VOICE_CATEGORIES, "audioPreflight.voiceCategory", errors);
  if (!Array.isArray(record.phraseChecks) || record.phraseChecks.length !== 4) {
    errors.push("audioPreflight.phraseChecks must contain the exact first-run four.");
    return;
  }
  record.phraseChecks.forEach((entry, index) => {
    const phrase = requireRecord(entry, `audioPreflight.phraseChecks[${index}]`, errors); if (!phrase) return;
    exactKeys(phrase, ["visualPinyin", "spokenPhrase", "result"], `audioPreflight.phraseChecks[${index}]`, errors);
    if (phrase.visualPinyin !== FIRST_RUN_AUDIO[index].visualPinyin || phrase.spokenPhrase !== FIRST_RUN_AUDIO[index].spokenPhrase) errors.push(`audioPreflight.phraseChecks[${index}] does not match the accepted phrase.`);
    enumValue(phrase.result, PHRASE_RESULTS, `audioPreflight.phraseChecks[${index}].result`, errors);
  });
}

function validateEvents(value: unknown, sessionId: string | null, errors: string[]): void {
  if (!Array.isArray(value) || value.length > 500) { errors.push("technicalEvents must be an array with at most 500 events."); return; }
  let previousSequence = 0;
  let previousRelativeMs = -1;
  value.forEach((entry, index) => {
    const event = requireRecord(entry, `technicalEvents[${index}]`, errors); if (!event) return;
    exactKeys(event, ["schemaVersion", "sessionId", "sequence", "relativeMs", "eventType", "safeMetadata"], `technicalEvents[${index}]`, errors);
    if (event.schemaVersion !== 1 || event.sessionId !== sessionId) errors.push(`technicalEvents[${index}] identity/version mismatch.`);
    boundedInteger(event.sequence, 1, 100000, `technicalEvents[${index}].sequence`, errors);
    boundedInteger(event.relativeMs, 0, 3600000, `technicalEvents[${index}].relativeMs`, errors);
    if (Number.isInteger(event.sequence) && (event.sequence as number) <= previousSequence) errors.push(`technicalEvents[${index}] sequence is duplicate or not strictly increasing.`);
    if (Number.isInteger(event.relativeMs) && (event.relativeMs as number) < previousRelativeMs) errors.push(`technicalEvents[${index}] relativeMs moved backwards.`);
    if (Number.isInteger(event.sequence)) previousSequence = event.sequence as number;
    if (Number.isInteger(event.relativeMs)) previousRelativeMs = event.relativeMs as number;
    enumValue(event.eventType, EVENT_TYPES, `technicalEvents[${index}].eventType`, errors);
    const metadata = requireRecord(event.safeMetadata, `technicalEvents[${index}].safeMetadata`, errors);
    if (metadata) {
      const rule = typeof event.eventType === "string" ? EVENT_METADATA_RULES[event.eventType] : undefined;
      if (rule) exactKeys(metadata, rule.allowed, `technicalEvents[${index}].safeMetadata`, errors);
      if (rule) for (const key of rule.required) if (!Object.hasOwn(metadata, key)) errors.push(`technicalEvents[${index}].safeMetadata is missing ${key}.`);
      if (metadata.phase !== undefined) enumValue(metadata.phase, PHASES, `technicalEvents[${index}].safeMetadata.phase`, errors);
      if (metadata.muted !== undefined && typeof metadata.muted !== "boolean") errors.push(`technicalEvents[${index}].safeMetadata.muted must be boolean.`);
      if (metadata.replayIndex !== undefined && metadata.replayIndex !== 0 && metadata.replayIndex !== 1) errors.push(`technicalEvents[${index}].safeMetadata.replayIndex must be 0 or 1.`);
      if (metadata.actionKind !== undefined) enumValue(metadata.actionKind, ACTION_KINDS, `technicalEvents[${index}].safeMetadata.actionKind`, errors);
      if (metadata.encounterId !== undefined) enumValue(metadata.encounterId, ENCOUNTER_IDS, `technicalEvents[${index}].safeMetadata.encounterId`, errors);
      if (metadata.hintLevel !== undefined && metadata.hintLevel !== 1 && metadata.hintLevel !== 2) errors.push(`technicalEvents[${index}].safeMetadata.hintLevel must be 1 or 2.`);
      if (metadata.characterId !== undefined) enumValue(metadata.characterId, CHARACTER_IDS, `technicalEvents[${index}].safeMetadata.characterId`, errors);
      if (metadata.abilityId !== undefined) enumValue(metadata.abilityId, ABILITY_IDS, `technicalEvents[${index}].safeMetadata.abilityId`, errors);
      if (metadata.bossPhase !== undefined) enumValue(metadata.bossPhase, BOSS_PHASE_IDS, `technicalEvents[${index}].safeMetadata.bossPhase`, errors);
      if (metadata.origin !== undefined) enumValue(metadata.origin, REPLAY_ORIGINS, `technicalEvents[${index}].safeMetadata.origin`, errors);
      if (metadata.stopCode !== undefined) enumValue(metadata.stopCode, STOP_CODES, `technicalEvents[${index}].safeMetadata.stopCode`, errors);
      if (metadata.errorCode !== undefined) enumValue(metadata.errorCode, TECHNICAL_ERROR_CODES, `technicalEvents[${index}].safeMetadata.errorCode`, errors);
      if (metadata.recoverable !== undefined && typeof metadata.recoverable !== "boolean") errors.push(`technicalEvents[${index}].safeMetadata.recoverable must be boolean.`);
      if (event.eventType === "replay_selected" && metadata.replayIndex !== 1) errors.push(`technicalEvents[${index}] replay_selected must carry replayIndex 1.`);
    }
  });
}

function validateObservationMap(value: unknown, keys: readonly string[], label: string, errors: string[]): void {
  const record = requireRecord(value, label, errors); if (!record) return;
  exactKeys(record, keys, label, errors);
  for (const key of keys) enumValue(record[key], OBSERVATION_VALUES, `${label}.${key}`, errors);
}

function validateObservations(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "observations", errors); if (!record) return;
  exactKeys(record, ["checkpoints", "usability", "engagement", "learningMechanismVisibility"], "observations", errors);
  validateObservationMap(record.checkpoints, ["firstScreen", "firstSpell", "secondStructure", "abilityChoice", "bossIntent", "safeFailure", "campRepair", "spellbook"], "observations.checkpoints", errors);
  validateObservationMap(record.usability, ["firstAction", "boardCardSlotDistinction", "clickOrDrag", "abilityChoice", "bossIntent", "spellbookNavigation"], "observations.usability", errors);
  validateObservationMap(record.engagement, ["voluntarilyContinued", "noticedWorldChange", "replayedAudio", "spontaneousReplay"], "observations.engagement", errors);
  validateObservationMap(record.learningMechanismVisibility, ["noticedMingComposition", "noticedStructureChange", "noticedMeaningChangedWorld", "connectedAbilityToBossSupport"], "observations.learningMechanismVisibility", errors);
}

function validateInterventions(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length > 50) { errors.push("interventions must be an array with at most 50 entries."); return; }
  value.forEach((entry, index) => {
    const record = requireRecord(entry, `interventions[${index}]`, errors); if (!record) return;
    exactKeys(record, ["checkpointId", "code", "region", "relativeMs"], `interventions[${index}]`, errors);
    enumValue(record.checkpointId, ["firstScreen", "firstSpell", "secondStructure", "abilityChoice", "bossIntent", "safeFailure", "campRepair", "spellbook"], `interventions[${index}].checkpointId`, errors);
    enumValue(record.code, INTERVENTION_CODES, `interventions[${index}].code`, errors);
    boundedInteger(record.relativeMs, 0, 3600000, `interventions[${index}].relativeMs`, errors);
    const allowedRegion = record.region === "WORLD" || record.region === "BOARD" || record.region === "HAND";
    if (record.code === "POINT_TO_REGION_ONLY" ? !allowedRegion : record.region !== null) errors.push(`interventions[${index}] must use WORLD/BOARD/HAND only for POINT_TO_REGION_ONLY and null otherwise.`);
  });
}

function validateWellbeing(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "wellbeing", errors); if (!record) return;
  const keys = ["comfortable", "briefConfusionRecovered", "sustainedFrustration", "sensoryDiscomfort", "childInitiatedStop", "feltForced", "stopCode"];
  exactKeys(record, keys, "wellbeing", errors);
  keys.slice(0, -1).forEach((key) => enumValue(record[key], WELLBEING_VALUES, `wellbeing.${key}`, errors));
  if (record.stopCode !== null) enumValue(record.stopCode, STOP_CODES, "wellbeing.stopCode", errors);
}

function validateOptionalChoices(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "optionalChildChoices", errors); if (!record) return;
  exactKeys(record, ["againAgain", "favoriteMoment", "spontaneousReplay", "promptedReplay", "optionalQuestionsAsked"], "optionalChildChoices", errors);
  enumValue(record.againAgain, AGAIN_VALUES, "optionalChildChoices.againAgain", errors);
  enumValue(record.favoriteMoment, FAVORITE_VALUES, "optionalChildChoices.favoriteMoment", errors);
  for (const key of ["spontaneousReplay", "promptedReplay", "optionalQuestionsAsked"]) if (typeof record[key] !== "boolean") errors.push(`optionalChildChoices.${key} must be boolean.`);
  if (record.spontaneousReplay === true && record.promptedReplay === true) errors.push("Replay cannot be both spontaneous and parent-prompted.");
}

function validateCompletion(value: unknown, errors: string[]): void {
  const record = requireRecord(value, "completion", errors); if (!record) return;
  exactKeys(record, ["childRouteLoaded", "runCompleted", "sessionStopped", "relativeDurationMs", "runCount", "stopCode"], "completion", errors);
  for (const key of ["childRouteLoaded", "runCompleted", "sessionStopped"]) if (typeof record[key] !== "boolean") errors.push(`completion.${key} must be boolean.`);
  boundedInteger(record.relativeDurationMs, 0, 3600000, "completion.relativeDurationMs", errors);
  boundedInteger(record.runCount, 1, 2, "completion.runCount", errors);
  if (record.stopCode !== null) enumValue(record.stopCode, STOP_CODES, "completion.stopCode", errors);
  if (record.sessionStopped === true && record.stopCode === null) errors.push("A stopped session requires completion.stopCode.");
  if (record.sessionStopped === false && record.stopCode !== null) errors.push("A non-stopped session cannot carry completion.stopCode.");
}

function walkForbiddenKeys(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) { value.forEach((item, index) => walkForbiddenKeys(item, `${path}[${index}]`, errors)); return; }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_KEYS.has(normalized)) errors.push(`${path}.${key} is a forbidden privacy/media/profile field.`);
    walkForbiddenKeys(child, `${path}.${key}`, errors);
  }
}

export function validatePrivacy(value: unknown): string[] {
  const errors: string[] = [];
  walkForbiddenKeys(value, "$", errors);
  if (isRecord(value)) {
    const notes = value.observerNotes;
    if (typeof notes === "string" && (NOTE_DENYLIST.test(notes) || PATH_OR_REMOTE_PATTERN.test(notes))) errors.push("observerNotes matches the PII/media/path/remote denylist.");
    if (typeof notes === "string" && notes.includes("```")) errors.push("observerNotes cannot contain fenced blocks.");
  }
  return [...new Set(errors)];
}

export function validateObservation(observation: unknown, sessionState: unknown): ValidationResult {
  const errors: string[] = [];
  const root = requireRecord(observation, "observation", errors);
  const state = requireRecord(sessionState, "session state", errors);
  if (!root || !state) return { valid: false, errors, privacyErrors: validatePrivacy(observation) };
  exactKeys(root, TOP_LEVEL_KEYS, "observation", errors);
  if (root.schemaVersion !== 1 || root.initiativeId !== INITIATIVE_ID || root.step !== STEP) errors.push("Observation identity/version mismatch.");
  const expectedKind = state.fixture === true ? FIXTURE_EVIDENCE_KIND : REAL_EVIDENCE_KIND;
  if (root.evidenceKind !== expectedKind) errors.push(`evidenceKind must equal ${expectedKind} for this session.`);

  validateSessionIdentity(root.sessionIdentity, errors);
  const sessionIdentity = isRecord(root.sessionIdentity) ? root.sessionIdentity : null;
  const stateModeMatches = state.sessionMode === null || state.sessionMode === undefined || sessionIdentity?.sessionMode === state.sessionMode;
  if (!sessionIdentity || sessionIdentity.sessionId !== state.sessionId || sessionIdentity.runSeed !== state.runSeed || sessionIdentity.startedAtUtc !== state.startedAtUtc || !stateModeMatches) errors.push("Observation session identity does not match START state.");
  validateBuildIdentity(root.buildIdentity, errors);
  if (!sameJson(root.buildIdentity, state.buildIdentity)) errors.push("Observation build identity does not exactly match START state.");
  validateAuthorization(root.parentAuthorization, errors);
  if (!sameJson(root.parentAuthorization, state.parentAuthorization)) errors.push("Observation parent authorization does not exactly match START state.");
  validateAudioPreflight(root.audioPreflight, errors);
  validateEvents(root.technicalEvents, typeof state.sessionId === "string" ? state.sessionId : null, errors);
  validateObservations(root.observations, errors);
  validateInterventions(root.interventions, errors);
  validateWellbeing(root.wellbeing, errors);
  validateOptionalChoices(root.optionalChildChoices, errors);
  validateCompletion(root.completion, errors);
  if (root.privacyConfirmed !== true) errors.push("privacyConfirmed must equal true.");
  if (typeof root.observerNotes !== "string" || root.observerNotes.length > 1000) errors.push("observerNotes must be a string with at most 1000 characters.");

  const completion = isRecord(root.completion) ? root.completion : null;
  if (sessionIdentity && completion && sessionIdentity.runCount !== completion.runCount) errors.push("Session and completion runCount values must match.");
  const interventions = Array.isArray(root.interventions) ? root.interventions.filter(isRecord) : [];
  if (interventions.some((item) => item.code === "ADULT_ANSWER_REQUIRED") && (!completion || completion.stopCode !== "ADULT_ANSWER_REQUIRED")) errors.push("ADULT_ANSWER_REQUIRED intervention must stop the formal session with the matching code.");

  const privacyErrors = validatePrivacy(root);
  return { valid: errors.length === 0 && privacyErrors.length === 0, errors, privacyErrors };
}

function jsonBlock(value: unknown): string[] {
  return ["```json", JSON.stringify(value, null, 2), "```"];
}

export function createObservationSummary(observation: JsonRecord): string {
  const events = Array.isArray(observation.technicalEvents) ? observation.technicalEvents.filter(isRecord) : [];
  const eventCount = (type: string) => events.filter((event) => event.eventType === type).length;
  const ability = events.map((event) => isRecord(event.safeMetadata) ? event.safeMetadata.abilityId : null).find((value) => typeof value === "string") ?? "not recorded";
  const technicalErrors = events.filter((event) => event.eventType === "technical_error").map((event) => isRecord(event.safeMetadata) ? event.safeMetadata.errorCode : "UNKNOWN");
  const sequence = events.map((event) => event.sequence);
  const notes = typeof observation.observerNotes === "string" ? observation.observerNotes : "";
  const noteLines = notes ? notes.split(/\r?\n/).map((line) => `> ${line}`) : ["> (none)" ];
  const lines = [
    "# STEP 04 child first-use summary",
    "",
    `Evidence kind: ${String(observation.evidenceKind)}`,
    "",
    "## Technical facts",
    "",
    `- Child route loaded: ${String(isRecord(observation.completion) ? observation.completion.childRouteLoaded : false)}`,
    `- Event count: ${events.length}`,
    `- Event sequence: ${sequence.length ? `${sequence[0]}..${sequence.at(-1)}` : "none"}`,
    `- Technical errors: ${technicalErrors.length ? technicalErrors.join(", ") : "none recorded"}`,
    `- Completion: ${String(isRecord(observation.completion) ? observation.completion.runCompleted : false)}`,
    `- Relative duration ms: ${String(isRecord(observation.completion) ? observation.completion.relativeDurationMs : 0)}`,
    `- Invalid placements: ${eventCount("invalid_placement")}`,
    `- Built-in hints: ${eventCount("built_in_hint_shown")}`,
    `- Selected ability: ${String(ability)}`,
    `- Camp repaired events: ${eventCount("camp_repaired")}`,
    `- Spellbook opened events: ${eventCount("spellbook_opened")}`,
    `- Replay selected events: ${eventCount("replay_selected")}`,
    "",
    "## Human observations",
    "",
    ...jsonBlock({ observations: observation.observations, interventions: observation.interventions, wellbeing: observation.wellbeing, optionalChildChoices: observation.optionalChildChoices }),
    "",
    "## Parent notes",
    "",
    ...noteLines,
    "",
    "## Explicitly not concluded",
    "",
    "- learning effectiveness",
    "- generalized usability",
    "- child acceptance",
    "- promotion",
    "- comparative preference",
    "- long-term retention",
    "",
  ];
  return lines.join("\n");
}

export function createFixtureObservation(sessionState: JsonRecord): JsonRecord {
  if (sessionState.fixture !== true) throw new Error("Fixture observation requires a fixture START state.");
  const sessionId = String(sessionState.sessionId);
  const startedAtUtc = String(sessionState.startedAtUtc);
  const fixtureEvents: Array<{ eventType: string; safeMetadata: JsonRecord }> = [
    { eventType: "session_opened", safeMetadata: { muted: true, replayIndex: 0 } },
    { eventType: "child_route_ready", safeMetadata: { muted: true } },
    { eventType: "first_action", safeMetadata: { actionKind: "pointer" } },
    { eventType: "phase_entered", safeMetadata: { phase: "battle_1_placing" } },
    { eventType: "invalid_placement", safeMetadata: { encounterId: "encounter-ming" } },
    { eventType: "built_in_hint_shown", safeMetadata: { encounterId: "encounter-ming", hintLevel: 1 } },
    { eventType: "spell_formed", safeMetadata: { characterId: "ming", encounterId: "encounter-ming" } },
    { eventType: "meaning_magic_completed", safeMetadata: { characterId: "ming", encounterId: "encounter-ming" } },
    { eventType: "phase_entered", safeMetadata: { phase: "battle_2_placing" } },
    { eventType: "spell_formed", safeMetadata: { characterId: "hua", encounterId: "encounter-hua" } },
    { eventType: "ability_selected", safeMetadata: { abilityId: "guardian-light" } },
    { eventType: "boss_intent_shown", safeMetadata: { bossPhase: "lin" } },
    { eventType: "boss_phase_completed", safeMetadata: { bossPhase: "lin" } },
    { eventType: "camp_repaired", safeMetadata: {} },
    { eventType: "spellbook_opened", safeMetadata: {} },
    { eventType: "run_completed", safeMetadata: { replayIndex: 0 } },
  ];
  const events = fixtureEvents.map((entry, index) => ({
    schemaVersion: 1, sessionId, sequence: index + 1, relativeMs: index * 15000,
    eventType: entry.eventType, safeMetadata: entry.safeMetadata,
  }));
  const notReached = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, "NOT_REACHED"]));
  return {
    schemaVersion: 1,
    initiativeId: INITIATIVE_ID,
    step: STEP,
    evidenceKind: FIXTURE_EVIDENCE_KIND,
    sessionIdentity: { sessionId, runSeed: sessionState.runSeed, sessionMode: sessionState.sessionMode, startedAtUtc, runCount: 1 },
    buildIdentity: sessionState.buildIdentity,
    parentAuthorization: sessionState.parentAuthorization,
    audioPreflight: {
      decision: "START_MUTED", lang: "zh-CN", adapterStatus: "UNAVAILABLE", voiceCategory: "NONE", visualPinyinConfirmed: true,
      phraseChecks: FIRST_RUN_AUDIO.map((entry) => ({ ...entry, result: "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE" })),
    },
    technicalEvents: events,
    observations: {
      checkpoints: notReached(["firstScreen", "firstSpell", "secondStructure", "abilityChoice", "bossIntent", "safeFailure", "campRepair", "spellbook"]),
      usability: notReached(["firstAction", "boardCardSlotDistinction", "clickOrDrag", "abilityChoice", "bossIntent", "spellbookNavigation"]),
      engagement: notReached(["voluntarilyContinued", "noticedWorldChange", "replayedAudio", "spontaneousReplay"]),
      learningMechanismVisibility: notReached(["noticedMingComposition", "noticedStructureChange", "noticedMeaningChangedWorld", "connectedAbilityToBossSupport"]),
    },
    interventions: [{ checkpointId: "firstScreen", code: "NONE", region: null, relativeMs: 0 }],
    wellbeing: {
      comfortable: "UNKNOWN", briefConfusionRecovered: "UNKNOWN", sustainedFrustration: "UNKNOWN",
      sensoryDiscomfort: "UNKNOWN", childInitiatedStop: "UNKNOWN", feltForced: "UNKNOWN", stopCode: null,
    },
    optionalChildChoices: { againAgain: "NOT_ASKED", favoriteMoment: "NOT_ASKED", spontaneousReplay: false, promptedReplay: false, optionalQuestionsAsked: false },
    completion: { childRouteLoaded: true, runCompleted: true, sessionStopped: false, relativeDurationMs: 240000, runCount: 1, stopCode: null },
    privacyConfirmed: true,
    observerNotes: "",
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function parseJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadCurrentReviewIdentity(): Promise<unknown> {
  const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const server = await createServer({
    root: repositoryRoot,
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  });
  try {
    const module = await server.ssrLoadModule("/apps/hanzi-v2-step03-review/review-identity.ts");
    return JSON.parse(JSON.stringify(module.STEP03_REVIEW_IDENTITY));
  } finally {
    await server.close();
  }
}

async function readinessCommand(): Promise<void> {
  const feedbackPath = argument("--feedback");
  const identityPath = argument("--review-identity");
  const output = argument("--output");
  const buildOutput = argument("--build-output");
  const authorizationOutput = argument("--authorization-output");
  const commit = argument("--commit");
  if (!feedbackPath || !identityPath || !output || !buildOutput || !authorizationOutput || !commit) throw new Error("readiness requires --feedback, --review-identity, --output, --build-output, --authorization-output, and --commit.");
  const errors: string[] = [];
  const feedbackSha = await fileSha256(resolve(feedbackPath));
  if (feedbackSha !== EXPECTED_PARENT_FEEDBACK_SHA256) errors.push("Canonical parent feedback SHA-256 mismatch.");
  let feedback: unknown = null; let reviewIdentity: unknown = null;
  let currentIdentity: unknown = null;
  try { feedback = await parseJson(feedbackPath); } catch (error) { errors.push(`Canonical feedback JSON parse error: ${String(error)}`); }
  try { reviewIdentity = await parseJson(identityPath); } catch (error) { errors.push(`Review identity JSON parse error: ${String(error)}`); }
  try { currentIdentity = await loadCurrentReviewIdentity(); } catch (error) { errors.push(`Current runtime identity could not be loaded: ${String(error)}`); }
  errors.push(...validateCanonicalFeedback(feedback, reviewIdentity, currentIdentity));
  let buildIdentity: JsonRecord | null = null;
  try { buildIdentity = createBuildIdentity(commit); } catch (error) { errors.push(String(error)); }
  const authorization = createParentAuthorization();
  const valid = errors.length === 0;
  await writeJson(output, { schemaVersion: 1, valid, code: valid ? "AUTHORIZED_CHILD_FIRST_USE_READY" : errors.some((entry) => entry.includes("frozen hash")) ? "FAIL_STEP04_SCOPE_DRIFT" : "FAIL_STEP04_READINESS", errors, parentFeedbackSha256: feedbackSha, acceptedReviewIdentitySha256: EXPECTED_REVIEW_IDENTITY_SHA256, acceptedSourceSnapshots: EXPECTED_SOURCE_SNAPSHOTS });
  if (valid && buildIdentity) {
    await writeJson(buildOutput, buildIdentity);
    await writeJson(authorizationOutput, authorization);
  }
  if (!valid) process.exitCode = 2;
}

async function validateObservationCommand(): Promise<void> {
  const observationPath = argument("--observation");
  const sessionStatePath = argument("--session-state");
  const output = argument("--output");
  const summaryOutput = argument("--summary-output");
  if (!observationPath || !sessionStatePath || !output || !summaryOutput) throw new Error("validate-observation requires --observation, --session-state, --output, and --summary-output.");
  let observation: unknown = null; let state: unknown = null; const parseErrors: string[] = [];
  try { observation = await parseJson(observationPath); } catch (error) { parseErrors.push(`Observation JSON parse error: ${String(error)}`); }
  try { state = await parseJson(sessionStatePath); } catch (error) { parseErrors.push(`Session state JSON parse error: ${String(error)}`); }
  const result = parseErrors.length ? { valid: false, errors: parseErrors, privacyErrors: [] } : validateObservation(observation, state);
  await writeJson(output, { schemaVersion: 1, valid: result.valid, schemaAndIdentityErrors: result.errors, privacyErrors: result.privacyErrors, evidenceKind: isRecord(observation) ? observation.evidenceKind : null, observationSha256: await fileSha256(resolve(observationPath)).catch(() => null) });
  if (result.valid && isRecord(observation)) await writeFile(resolve(summaryOutput), createObservationSummary(observation), "utf8");
  if (!result.valid) process.exitCode = 3;
}

async function fixtureCommand(): Promise<void> {
  const sessionStatePath = argument("--session-state"); const output = argument("--output");
  if (!sessionStatePath || !output) throw new Error("fixture-observation requires --session-state and --output.");
  const state = await parseJson(sessionStatePath);
  if (!isRecord(state)) throw new Error("Fixture session state must be an object.");
  await writeJson(output, createFixtureObservation(state));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "readiness") return readinessCommand();
  if (command === "validate-observation") return validateObservationCommand();
  if (command === "fixture-observation") return fixtureCommand();
  throw new Error("Usage: step04-contract.ts readiness|validate-observation|fixture-observation [arguments]");
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) : false;
if (isMain) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

export function newOpaqueId(prefix: string, bytes = 16): string {
  return `${prefix}${randomBytes(bytes).toString("hex")}`;
}
