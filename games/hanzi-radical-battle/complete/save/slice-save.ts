import { COMPLETE_SLICE_CONTENT_REVISION } from "../content-graph/slice-content";
import {
  createCompleteSliceState,
  isCompleteSliceAction,
  reduceCompleteSliceState,
  type CompleteSliceAction,
  type CompleteSliceId,
} from "../core/slice-machine";

export const HANZI_MAGIC_COMPLETE_SAVE_KEY = "family-games/hanzi-magic-complete/v3";
export const HANZI_MAGIC_COMPLETE_BACKUP_KEY = `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.backup`;
export const HANZI_MAGIC_COMPLETE_RECOVERY_KEY = `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.recovery`;
export const HANZI_MAGIC_COMPLETE_SLICE_SCHEMA_VERSION = 1 as const;
const SAVE_HARD_MAX_BYTES = 500 * 1024;

export interface CompleteSliceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CompleteSlicePreferences {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly inputMode: "auto" | "mouse" | "touch" | "keyboard";
}

export interface CompleteSliceSave {
  readonly schemaVersion: 1;
  readonly gameVersion: "3.0.0-slices";
  readonly contentRevisionHash: string;
  readonly activeSlice: CompleteSliceId;
  readonly sessions: Readonly<Record<CompleteSliceId, readonly CompleteSliceAction[]>>;
  readonly preferences: CompleteSlicePreferences;
  readonly privacy: { readonly anonymousLocalOnly: true; readonly freeTextStored: false };
  readonly validation: { readonly algorithm: "fnv1a32"; readonly checksum: string };
}

export interface CompleteSliceSaveRead {
  readonly state: CompleteSliceSave;
  readonly source: "fresh" | "v3-slice" | "v3-slice-backup" | "future-read-only";
  readonly recovered: boolean;
  readonly writable: boolean;
  readonly recoveryReason: "NONE" | "MALFORMED_JSON" | "INVALID_SHAPE" | "CHECKSUM_MISMATCH";
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function payloadChecksum(payload: Omit<CompleteSliceSave, "validation">): string {
  return fnv1a(JSON.stringify(payload));
}

function withChecksum(payload: Omit<CompleteSliceSave, "validation">): CompleteSliceSave {
  return { ...payload, validation: { algorithm: "fnv1a32", checksum: payloadChecksum(payload) } };
}

export function createFreshCompleteSliceSave(activeSlice: CompleteSliceId = "family"): CompleteSliceSave {
  return withChecksum({
    schemaVersion: HANZI_MAGIC_COMPLETE_SLICE_SCHEMA_VERSION,
    gameVersion: "3.0.0-slices",
    contentRevisionHash: COMPLETE_SLICE_CONTENT_REVISION,
    activeSlice,
    sessions: { family: [], word: [] },
    preferences: { muted: false, reducedMotion: false, inputMode: "auto" },
    privacy: { anonymousLocalOnly: true, freeTextStored: false },
  });
}

function validActions(sliceId: CompleteSliceId, value: unknown): value is CompleteSliceAction[] {
  if (!Array.isArray(value) || value.length > 256 || !value.every(isCompleteSliceAction)) return false;
  let state = createCompleteSliceState(sliceId);
  for (const action of value) {
    const next = reduceCompleteSliceState(state, action);
    if (next.actionCount !== state.actionCount + 1) return false;
    state = next;
  }
  return true;
}

function validateDetailed(value: unknown): { state: CompleteSliceSave | null; reason: "INVALID_SHAPE" | "CHECKSUM_MISMATCH" | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: null, reason: "INVALID_SHAPE" };
  const save = value as Record<string, unknown>;
  const keys = ["activeSlice", "contentRevisionHash", "gameVersion", "preferences", "privacy", "schemaVersion", "sessions", "validation"];
  if (Object.keys(save).sort().join("|") !== keys.sort().join("|") || save.schemaVersion !== 1 || save.gameVersion !== "3.0.0-slices" || save.contentRevisionHash !== COMPLETE_SLICE_CONTENT_REVISION || !["family", "word"].includes(String(save.activeSlice))) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.sessions || typeof save.sessions !== "object" || Array.isArray(save.sessions)) return { state: null, reason: "INVALID_SHAPE" };
  const sessions = save.sessions as Record<string, unknown>;
  if (Object.keys(sessions).sort().join("|") !== "family|word" || !validActions("family", sessions.family) || !validActions("word", sessions.word)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.preferences || typeof save.preferences !== "object" || Array.isArray(save.preferences)) return { state: null, reason: "INVALID_SHAPE" };
  const preferences = save.preferences as Record<string, unknown>;
  if (Object.keys(preferences).sort().join("|") !== "inputMode|muted|reducedMotion" || typeof preferences.muted !== "boolean" || typeof preferences.reducedMotion !== "boolean" || !["auto", "mouse", "touch", "keyboard"].includes(String(preferences.inputMode))) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.privacy || typeof save.privacy !== "object" || Array.isArray(save.privacy)) return { state: null, reason: "INVALID_SHAPE" };
  const privacy = save.privacy as Record<string, unknown>;
  if (Object.keys(privacy).sort().join("|") !== "anonymousLocalOnly|freeTextStored" || privacy.anonymousLocalOnly !== true || privacy.freeTextStored !== false) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.validation || typeof save.validation !== "object" || Array.isArray(save.validation)) return { state: null, reason: "INVALID_SHAPE" };
  const validation = save.validation as Record<string, unknown>;
  if (Object.keys(validation).sort().join("|") !== "algorithm|checksum" || validation.algorithm !== "fnv1a32" || typeof validation.checksum !== "string") return { state: null, reason: "INVALID_SHAPE" };
  const { validation: omitted, ...payload } = save as unknown as CompleteSliceSave;
  if (omitted.checksum !== payloadChecksum(payload)) return { state: null, reason: "CHECKSUM_MISMATCH" };
  return { state: save as unknown as CompleteSliceSave, reason: null };
}

export function validateCompleteSliceSave(value: unknown): CompleteSliceSave | null {
  return validateDetailed(value).state;
}

function readBackup(storage: CompleteSliceStorage): CompleteSliceSave | null {
  const raw = storage.getItem(HANZI_MAGIC_COMPLETE_BACKUP_KEY);
  if (!raw) return null;
  try { return validateCompleteSliceSave(JSON.parse(raw)); } catch { return null; }
}

function captureRecovery(storage: CompleteSliceStorage, raw: string, reason: string): void {
  storage.setItem(HANZI_MAGIC_COMPLETE_RECOVERY_KEY, JSON.stringify({ schemaVersion: 1, reason, raw }));
}

export function readCompleteSliceSave(storage: CompleteSliceStorage, activeSlice: CompleteSliceId): CompleteSliceSaveRead {
  const raw = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
  if (raw === null) return { state: createFreshCompleteSliceSave(activeSlice), source: "fresh", recovered: false, writable: true, recoveryReason: "NONE" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    captureRecovery(storage, raw, "MALFORMED_JSON");
    const backup = readBackup(storage);
    return { state: backup ?? createFreshCompleteSliceSave(activeSlice), source: backup ? "v3-slice-backup" : "fresh", recovered: true, writable: true, recoveryReason: "MALFORMED_JSON" };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).schemaVersion === "number" && Number((parsed as Record<string, unknown>).schemaVersion) > HANZI_MAGIC_COMPLETE_SLICE_SCHEMA_VERSION) {
    return { state: createFreshCompleteSliceSave(activeSlice), source: "future-read-only", recovered: false, writable: false, recoveryReason: "NONE" };
  }
  const checked = validateDetailed(parsed);
  if (checked.state) return { state: checked.state, source: "v3-slice", recovered: false, writable: true, recoveryReason: "NONE" };
  captureRecovery(storage, raw, checked.reason ?? "INVALID_SHAPE");
  const backup = readBackup(storage);
  return { state: backup ?? createFreshCompleteSliceSave(activeSlice), source: backup ? "v3-slice-backup" : "fresh", recovered: true, writable: true, recoveryReason: checked.reason ?? "INVALID_SHAPE" };
}

export function writeCompleteSliceSave(storage: CompleteSliceStorage, state: CompleteSliceSave, writable = true): void {
  if (!writable) throw new Error("FUTURE_VERSION_SAVE_IS_READ_ONLY");
  const valid = validateCompleteSliceSave(state);
  if (!valid) throw new Error("Refusing to write invalid Hanzi Magic Complete slice save");
  const serialized = JSON.stringify(valid);
  if (new TextEncoder().encode(serialized).byteLength >= SAVE_HARD_MAX_BYTES) throw new Error("HANZI_MAGIC_COMPLETE_SAVE_EXCEEDS_500_KIB");
  const previous = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
  if (previous !== null) {
    try { if (validateCompleteSliceSave(JSON.parse(previous))) storage.setItem(HANZI_MAGIC_COMPLETE_BACKUP_KEY, previous); } catch { /* malformed raw is captured by read */ }
  }
  storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, serialized);
}

export function updateCompleteSliceSave(
  previous: CompleteSliceSave,
  patch: Partial<Pick<CompleteSliceSave, "activeSlice" | "sessions" | "preferences">>,
): CompleteSliceSave {
  const { validation: _validation, ...payload } = previous;
  return withChecksum({ ...payload, ...patch });
}

export function clearCompleteSliceSession(previous: CompleteSliceSave, sliceId: CompleteSliceId): CompleteSliceSave {
  return updateCompleteSliceSave(previous, { activeSlice: sliceId, sessions: { ...previous.sessions, [sliceId]: [] } });
}

export function clearCompleteSliceSave(storage: CompleteSliceStorage): void {
  storage.removeItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
  storage.removeItem(HANZI_MAGIC_COMPLETE_BACKUP_KEY);
  storage.removeItem(HANZI_MAGIC_COMPLETE_RECOVERY_KEY);
}
