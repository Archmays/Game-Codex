import { PLAY_SURFACE_BY_ID } from "../../data/playSurfaceManifest";
import {
  FORBIDDEN_OBSERVATION_FIELDS,
  OBSERVATION_FORMAT,
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_MOMENTS,
  OBSERVATION_NOTE_MAX_CHARS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_TAGS,
  OBSERVED_OUTCOMES,
  PARENT_HELP_VALUES,
  type NaturalUseObservationBundle,
  type NaturalUseObservationDraft,
  type NaturalUseObservationRecord,
  type ObservationMoment,
  type ObservationTag,
  type ObservedOutcome,
  type ParentHelp,
} from "./types";

const RECORD_FIELDS = new Set(["id", "schemaVersion", "dateLocal", "buildCommit", "surfaceId", "moment", "tags", "parentHelp", "outcome", "note"]);
const BUNDLE_FIELDS = new Set(["format", "version", "exportedAt", "projectBuildCommit", "retentionDays", "maxRecords", "recordCount", "records", "integrity"]);
const INTEGRITY_FIELDS = new Set(["algorithm", "recordsSha256"]);
const FORBIDDEN_FIELDS = new Set<string>(FORBIDDEN_OBSERVATION_FIELDS);

export class ObservationValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ObservationValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_FIELDS.has(key)) throw new ObservationValidationError(`${label} contains forbidden field: ${key}`);
    if (!allowed.has(key)) throw new ObservationValidationError(`${label} contains unknown field: ${key}`);
  }
}

function assertNoForbiddenFields(value: unknown, path = "bundle"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) throw new ObservationValidationError(`${path} contains forbidden field: ${key}`);
    assertNoForbiddenFields(entry, `${path}.${key}`);
  }
}

export function noteCharacterCount(value: string): number {
  return [...value].length;
}

export function normalizeObservationNote(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyEpochDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ObservationValidationError("Observation date must use YYYY-MM-DD only.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ObservationValidationError("Observation date is not a real calendar date.");
  }
  return Math.floor(date.getTime() / 86_400_000);
}

function validBuildCommit(value: unknown): value is string {
  return typeof value === "string" && (/^[a-f0-9]{40}$/.test(value) || value === "local-source");
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function validatedNote(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new ObservationValidationError("Observation note must be plain text.");
  if (normalizeObservationNote(value) !== value) throw new ObservationValidationError("Observation note contains unsupported control or whitespace characters.");
  if (noteCharacterCount(value) > OBSERVATION_NOTE_MAX_CHARS) throw new ObservationValidationError(`Observation note exceeds ${OBSERVATION_NOTE_MAX_CHARS} characters.`);
  return value;
}

export function validateObservationRecord(value: unknown): NaturalUseObservationRecord {
  if (!isRecord(value)) throw new ObservationValidationError("Observation record must be an object.");
  assertExactFields(value, RECORD_FIELDS, "Observation record");
  if (!validId(value.id)) throw new ObservationValidationError("Observation id is invalid.");
  if (value.schemaVersion !== OBSERVATION_SCHEMA_VERSION) throw new ObservationValidationError("Observation schema version is unsupported.");
  const dateLocal = typeof value.dateLocal === "string" ? value.dateLocal : "";
  dateOnlyEpochDay(dateLocal);
  if (!validBuildCommit(value.buildCommit)) throw new ObservationValidationError("Observation build commit is invalid.");
  if (typeof value.surfaceId !== "string" || !PLAY_SURFACE_BY_ID.has(value.surfaceId)) throw new ObservationValidationError("Observation surface is not in PLAY_SURFACE_MANIFEST.");
  if (!oneOf(value.moment, OBSERVATION_MOMENTS)) throw new ObservationValidationError("Observation moment is invalid.");
  if (!Array.isArray(value.tags) || value.tags.length < 1 || value.tags.length > 3) throw new ObservationValidationError("Choose between one and three observable tags.");
  if (!value.tags.every((tag): tag is ObservationTag => oneOf(tag, OBSERVATION_TAGS))) throw new ObservationValidationError("Observation contains an unsupported tag.");
  if (new Set(value.tags).size !== value.tags.length) throw new ObservationValidationError("Observation tags must be unique.");
  if (!oneOf(value.parentHelp, PARENT_HELP_VALUES)) throw new ObservationValidationError("Parent-help value is invalid.");
  if (!oneOf(value.outcome, OBSERVED_OUTCOMES)) throw new ObservationValidationError("Observed outcome is invalid.");
  const note = validatedNote(value.note);
  return {
    id: value.id,
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    dateLocal,
    buildCommit: value.buildCommit,
    surfaceId: value.surfaceId,
    moment: value.moment as ObservationMoment,
    tags: [...value.tags] as ObservationTag[],
    parentHelp: value.parentHelp as ParentHelp,
    outcome: value.outcome as ObservedOutcome,
    ...(note ? { note } : {}),
  };
}

export function createObservationRecord(
  draft: NaturalUseObservationDraft,
  options: { readonly id?: string; readonly today?: string } = {},
): NaturalUseObservationRecord {
  const normalizedNote = draft.note === undefined ? undefined : normalizeObservationNote(draft.note);
  if (normalizedNote && noteCharacterCount(normalizedNote) > OBSERVATION_NOTE_MAX_CHARS) {
    throw new ObservationValidationError(`观察备注最多 ${OBSERVATION_NOTE_MAX_CHARS} 个字符。`);
  }
  const today = options.today ?? localDateString();
  if (dateOnlyEpochDay(draft.dateLocal) > dateOnlyEpochDay(today)) throw new ObservationValidationError("观察日期不能晚于今天。");
  const id = options.id ?? globalThis.crypto?.randomUUID?.();
  if (!id) throw new ObservationValidationError("当前浏览器无法安全生成本地记录编号。");
  return validateObservationRecord({
    ...draft,
    id,
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    ...(normalizedNote ? { note: normalizedNote } : { note: undefined }),
  });
}

export function recordsIntegrityPayload(records: readonly NaturalUseObservationRecord[]): string {
  return JSON.stringify(records);
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new ObservationValidationError("SHA-256 is unavailable in this environment.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateObservationBundle(value: unknown): Promise<NaturalUseObservationBundle> {
  assertNoForbiddenFields(value);
  if (!isRecord(value)) throw new ObservationValidationError("Observation bundle must be an object.");
  assertExactFields(value, BUNDLE_FIELDS, "Observation bundle");
  if (value.format !== OBSERVATION_FORMAT || value.version !== OBSERVATION_SCHEMA_VERSION) throw new ObservationValidationError("Observation bundle format or version is unsupported.");
  if (typeof value.exportedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new ObservationValidationError("Parent export timestamp is invalid.");
  }
  if (!validBuildCommit(value.projectBuildCommit)) throw new ObservationValidationError("Project build commit is invalid.");
  if (value.retentionDays !== OBSERVATION_RETENTION_DAYS || value.maxRecords !== OBSERVATION_MAX_RECORDS) throw new ObservationValidationError("Observation retention limits do not match the current contract.");
  if (!Array.isArray(value.records) || value.records.length > OBSERVATION_MAX_RECORDS) throw new ObservationValidationError("Observation bundle has too many records.");
  const records = value.records.map(validateObservationRecord);
  if (value.recordCount !== records.length) throw new ObservationValidationError("Observation record count does not match the records array.");
  if (!isRecord(value.integrity)) throw new ObservationValidationError("Observation integrity section is missing.");
  assertExactFields(value.integrity, INTEGRITY_FIELDS, "Observation integrity");
  if (value.integrity.algorithm !== "SHA-256" || typeof value.integrity.recordsSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.integrity.recordsSha256)) {
    throw new ObservationValidationError("Observation integrity metadata is invalid.");
  }
  if (await sha256Hex(recordsIntegrityPayload(records)) !== value.integrity.recordsSha256) throw new ObservationValidationError("Observation records SHA-256 does not match.");
  return {
    format: OBSERVATION_FORMAT,
    version: OBSERVATION_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    projectBuildCommit: value.projectBuildCommit,
    retentionDays: OBSERVATION_RETENTION_DAYS,
    maxRecords: OBSERVATION_MAX_RECORDS,
    recordCount: records.length,
    records,
    integrity: { algorithm: "SHA-256", recordsSha256: value.integrity.recordsSha256 },
  };
}
