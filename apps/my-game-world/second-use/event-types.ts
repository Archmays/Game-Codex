export const STEP06_EVIDENCE_ID = "hanzi-v2-step06";
export const STEP06_EVENT_SCHEMA_VERSION = 1;

export const STEP06_EVENT_TYPES = [
  "session_opened",
  "world_ready",
  "progress_continuity_verified",
  "world_first_action",
  "world_destination_opened",
  "world_spellbook_opened",
  "classic_hub_opened",
  "settings_opened",
  "forest_entered",
  "golden_phase_entered",
  "ability_selected",
  "golden_run_completed",
  "returned_to_world",
  "session_stopped",
  "technical_error",
] as const;

export type Step06EventType = (typeof STEP06_EVENT_TYPES)[number];

export const STEP06_DESTINATIONS = ["FOREST", "SPELLBOOK", "TREASURE_BOX"] as const;
export type Step06DestinationId = (typeof STEP06_DESTINATIONS)[number];

export interface Step06SafeMetadata {
  readonly destinationId?: Step06DestinationId;
  readonly phase?: string;
  readonly abilityId?: string;
  readonly worldReturned?: boolean;
  readonly completed?: boolean;
  readonly errorCode?: string;
  readonly recoverable?: boolean;
}

export interface Step06TechnicalEvent {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly sequence: number;
  readonly relativeMs: number;
  readonly eventType: Step06EventType;
  readonly safeMetadata: Step06SafeMetadata;
}

export const STEP06_STOP_CODES = [
  "CHILD_REQUEST",
  "DISTRESS",
  "SENSORY_DISCOMFORT",
  "TECHNICAL",
  "PRIVACY",
  "PROGRESS_CONTINUITY",
  "ADULT_ANSWER_REQUIRED",
  "NATURAL_END",
  "OTHER",
] as const;
export type Step06StopCode = (typeof STEP06_STOP_CODES)[number];

export const STEP06_ALLOWED_METADATA_KEYS = [
  "destinationId",
  "phase",
  "abilityId",
  "worldReturned",
  "completed",
  "errorCode",
  "recoverable",
] as const;

export function isStep06TechnicalEvent(value: unknown): value is Step06TechnicalEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const exact = ["schemaVersion", "sessionId", "sequence", "relativeMs", "eventType", "safeMetadata"];
  if (Object.keys(event).sort().join("|") !== exact.sort().join("|")) return false;
  if (event.schemaVersion !== STEP06_EVENT_SCHEMA_VERSION) return false;
  if (typeof event.sessionId !== "string" || !/^s06-[a-z0-9-]{8,64}$/.test(event.sessionId)) return false;
  if (!Number.isInteger(event.sequence) || (event.sequence as number) < 1 || (event.sequence as number) > 100_000) return false;
  if (!Number.isInteger(event.relativeMs) || (event.relativeMs as number) < 0 || (event.relativeMs as number) > 30 * 60 * 1000) return false;
  if (typeof event.eventType !== "string" || !STEP06_EVENT_TYPES.includes(event.eventType as Step06EventType)) return false;
  if (!event.safeMetadata || typeof event.safeMetadata !== "object" || Array.isArray(event.safeMetadata)) return false;
  const metadata = event.safeMetadata as Record<string, unknown>;
  if (Object.keys(metadata).some((key) => !STEP06_ALLOWED_METADATA_KEYS.includes(key as never))) return false;
  if (metadata.destinationId !== undefined && !STEP06_DESTINATIONS.includes(metadata.destinationId as Step06DestinationId)) return false;
  if (metadata.phase !== undefined && (typeof metadata.phase !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(metadata.phase))) return false;
  if (metadata.abilityId !== undefined && (typeof metadata.abilityId !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(metadata.abilityId))) return false;
  if (metadata.errorCode !== undefined && (typeof metadata.errorCode !== "string" || !/^[A-Z0-9_]{1,48}$/.test(metadata.errorCode))) return false;
  for (const key of ["worldReturned", "completed", "recoverable"] as const) {
    if (metadata[key] !== undefined && typeof metadata[key] !== "boolean") return false;
  }
  return true;
}
