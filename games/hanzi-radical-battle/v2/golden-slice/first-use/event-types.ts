import { GOLDEN_SLICE_PHASES, type GoldenSlicePhase } from "../simulation/machine";
import type { AbilityId, GoldenEncounterId } from "../content/types";

export const FIRST_USE_EVENT_SCHEMA_VERSION = 1 as const;

export const FIRST_USE_EVENT_TYPES = [
  "session_opened",
  "child_route_ready",
  "first_action",
  "phase_entered",
  "invalid_placement",
  "built_in_hint_shown",
  "spell_formed",
  "meaning_magic_completed",
  "ability_selected",
  "boss_intent_shown",
  "boss_phase_completed",
  "camp_repaired",
  "spellbook_opened",
  "run_completed",
  "replay_selected",
  "session_stopped",
  "technical_error",
] as const;

export const FIRST_USE_STOP_CODES = [
  "CHILD_REQUEST",
  "DISTRESS",
  "SENSORY_DISCOMFORT",
  "TECHNICAL",
  "PRIVACY",
  "IDENTITY",
  "ADULT_ANSWER_REQUIRED",
  "OTHER",
] as const;

export const FIRST_USE_TECHNICAL_ERROR_CODES = [
  "BRIDGE_UNAVAILABLE",
  "SESSION_INVALID",
  "RENDER_ERROR",
  "AUDIO_UNAVAILABLE",
  "LOCAL_STORAGE_UNAVAILABLE",
  "UNKNOWN_LOCAL_ERROR",
] as const;

export const FIRST_USE_ACTION_KINDS = ["pointer", "drag", "keyboard", "other"] as const;
export const FIRST_USE_REPLAY_ORIGINS = ["spontaneous", "prompted"] as const;
export const FIRST_USE_CHARACTER_IDS = ["ming", "hua", "lin", "xing"] as const;
export const FIRST_USE_ENCOUNTER_IDS = ["encounter-ming", "encounter-hua", "boss-lin", "boss-xing"] as const;
export const FIRST_USE_ABILITY_IDS = ["guardian-light", "star-path", "ink-echo"] as const;
export const FIRST_USE_BOSS_PHASE_IDS = ["lin", "xing"] as const;

export type FirstUseEventType = (typeof FIRST_USE_EVENT_TYPES)[number];
export type FirstUseStopCode = (typeof FIRST_USE_STOP_CODES)[number];
export type FirstUseTechnicalErrorCode = (typeof FIRST_USE_TECHNICAL_ERROR_CODES)[number];
export type FirstUseActionKind = (typeof FIRST_USE_ACTION_KINDS)[number];
export type FirstUseReplayOrigin = (typeof FIRST_USE_REPLAY_ORIGINS)[number];
export type FirstUseCharacterId = (typeof FIRST_USE_CHARACTER_IDS)[number];
export type FirstUseBossPhaseId = (typeof FIRST_USE_BOSS_PHASE_IDS)[number];

export type FirstUseSafeMetadataValue = string | number | boolean;
export type FirstUseSafeMetadata = Readonly<Record<string, FirstUseSafeMetadataValue>>;

export interface FirstUseTechnicalEvent {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly sequence: number;
  readonly relativeMs: number;
  readonly eventType: FirstUseEventType;
  readonly safeMetadata: FirstUseSafeMetadata;
}

type MetadataRule = Readonly<{
  required?: readonly string[];
  allowed?: readonly string[];
  validate: (metadata: FirstUseSafeMetadata) => boolean;
}>;

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

const isReplayIndex = (value: unknown): value is 0 | 1 => value === 0 || value === 1;

const METADATA_RULES: Readonly<Record<FirstUseEventType, MetadataRule>> = {
  session_opened: {
    required: ["muted", "replayIndex"],
    allowed: ["muted", "replayIndex"],
    validate: (value) => typeof value.muted === "boolean" && isReplayIndex(value.replayIndex),
  },
  child_route_ready: {
    required: ["muted"],
    allowed: ["muted"],
    validate: (value) => typeof value.muted === "boolean",
  },
  first_action: {
    required: ["actionKind"],
    allowed: ["actionKind"],
    validate: (value) => isOneOf(value.actionKind, FIRST_USE_ACTION_KINDS),
  },
  phase_entered: {
    required: ["phase"],
    allowed: ["phase"],
    validate: (value) => isOneOf(value.phase, GOLDEN_SLICE_PHASES),
  },
  invalid_placement: {
    required: ["encounterId"],
    allowed: ["encounterId"],
    validate: (value) => isOneOf(value.encounterId, FIRST_USE_ENCOUNTER_IDS),
  },
  built_in_hint_shown: {
    required: ["encounterId", "hintLevel"],
    allowed: ["encounterId", "hintLevel"],
    validate: (value) =>
      isOneOf(value.encounterId, FIRST_USE_ENCOUNTER_IDS) && (value.hintLevel === 1 || value.hintLevel === 2),
  },
  spell_formed: {
    required: ["characterId", "encounterId"],
    allowed: ["characterId", "encounterId"],
    validate: (value) =>
      isOneOf(value.characterId, FIRST_USE_CHARACTER_IDS) && isOneOf(value.encounterId, FIRST_USE_ENCOUNTER_IDS),
  },
  meaning_magic_completed: {
    required: ["characterId", "encounterId"],
    allowed: ["characterId", "encounterId"],
    validate: (value) =>
      isOneOf(value.characterId, FIRST_USE_CHARACTER_IDS) && isOneOf(value.encounterId, FIRST_USE_ENCOUNTER_IDS),
  },
  ability_selected: {
    required: ["abilityId"],
    allowed: ["abilityId"],
    validate: (value) => isOneOf(value.abilityId, FIRST_USE_ABILITY_IDS),
  },
  boss_intent_shown: {
    required: ["bossPhase"],
    allowed: ["bossPhase"],
    validate: (value) => isOneOf(value.bossPhase, FIRST_USE_BOSS_PHASE_IDS),
  },
  boss_phase_completed: {
    required: ["bossPhase"],
    allowed: ["bossPhase"],
    validate: (value) => isOneOf(value.bossPhase, FIRST_USE_BOSS_PHASE_IDS),
  },
  camp_repaired: { allowed: [], validate: () => true },
  spellbook_opened: { allowed: [], validate: () => true },
  run_completed: {
    required: ["replayIndex"],
    allowed: ["replayIndex"],
    validate: (value) => isReplayIndex(value.replayIndex),
  },
  replay_selected: {
    required: ["origin", "replayIndex"],
    allowed: ["origin", "replayIndex"],
    validate: (value) => isOneOf(value.origin, FIRST_USE_REPLAY_ORIGINS) && value.replayIndex === 1,
  },
  session_stopped: {
    required: ["stopCode"],
    allowed: ["stopCode"],
    validate: (value) => isOneOf(value.stopCode, FIRST_USE_STOP_CODES),
  },
  technical_error: {
    required: ["errorCode", "recoverable"],
    allowed: ["errorCode", "recoverable"],
    validate: (value) =>
      isOneOf(value.errorCode, FIRST_USE_TECHNICAL_ERROR_CODES) && typeof value.recoverable === "boolean",
  },
};

export function isFirstUseSafeMetadata(eventType: FirstUseEventType, value: unknown): value is FirstUseSafeMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  const rule = METADATA_RULES[eventType];
  const keys = Object.keys(metadata);
  const allowed = rule.allowed ?? [];
  const required = rule.required ?? [];
  if (keys.some((key) => !allowed.includes(key))) return false;
  if (required.some((key) => !Object.hasOwn(metadata, key))) return false;
  if (Object.values(metadata).some((item) => !["string", "number", "boolean"].includes(typeof item))) return false;
  return rule.validate(metadata as FirstUseSafeMetadata);
}

export function isFirstUseEventType(value: unknown): value is FirstUseEventType {
  return isOneOf(value, FIRST_USE_EVENT_TYPES);
}

export function isFirstUseStopCode(value: unknown): value is FirstUseStopCode {
  return isOneOf(value, FIRST_USE_STOP_CODES);
}

export function isFirstUseTechnicalEvent(value: unknown): value is FirstUseTechnicalEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const exactKeys = ["schemaVersion", "sessionId", "sequence", "relativeMs", "eventType", "safeMetadata"];
  if (Object.keys(event).length !== exactKeys.length || exactKeys.some((key) => !Object.hasOwn(event, key))) return false;
  if (event.schemaVersion !== FIRST_USE_EVENT_SCHEMA_VERSION) return false;
  if (typeof event.sessionId !== "string" || !/^s04-[a-f0-9]{32}$/.test(event.sessionId)) return false;
  if (!Number.isSafeInteger(event.sequence) || (event.sequence as number) < 1) return false;
  if (!Number.isSafeInteger(event.relativeMs) || (event.relativeMs as number) < 0) return false;
  if (!isFirstUseEventType(event.eventType)) return false;
  return isFirstUseSafeMetadata(event.eventType, event.safeMetadata);
}

export type FirstUsePhaseMetadata = Readonly<{ phase: GoldenSlicePhase }>;
export type FirstUseEncounterMetadata = Readonly<{ encounterId: GoldenEncounterId }>;
export type FirstUseAbilityMetadata = Readonly<{ abilityId: AbilityId }>;
