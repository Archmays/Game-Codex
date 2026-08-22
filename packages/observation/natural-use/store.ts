import {
  OBSERVATION_FORMAT,
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_STORAGE_KEY,
  type NaturalUseObservationRecord,
} from "./types";
import { dateOnlyEpochDay, localDateString, ObservationValidationError, validateObservationRecord } from "./schema";

export interface ObservationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredObservations {
  readonly format: typeof OBSERVATION_FORMAT;
  readonly version: typeof OBSERVATION_SCHEMA_VERSION;
  readonly records: readonly NaturalUseObservationRecord[];
}

function parseStored(raw: string): StoredObservations {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ObservationValidationError("本机观察笔记无法读取；没有改动原记录。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ObservationValidationError("本机观察笔记结构不正确；没有改动原记录。");
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["format", "version", "records"].includes(key))) throw new ObservationValidationError("本机观察笔记包含未知字段；没有改动原记录。");
  if (candidate.format !== OBSERVATION_FORMAT || candidate.version !== OBSERVATION_SCHEMA_VERSION || !Array.isArray(candidate.records) || candidate.records.length > 1000) {
    throw new ObservationValidationError("本机观察笔记版本或数量不受支持；没有改动原记录。");
  }
  return { format: OBSERVATION_FORMAT, version: OBSERVATION_SCHEMA_VERSION, records: candidate.records.map(validateObservationRecord) };
}

function serializeStored(records: readonly NaturalUseObservationRecord[]): string {
  return JSON.stringify({ format: OBSERVATION_FORMAT, version: OBSERVATION_SCHEMA_VERSION, records });
}

function writeRecords(storage: ObservationStorage, records: readonly NaturalUseObservationRecord[], previousRaw: string | null): void {
  try {
    if (records.length === 0) storage.removeItem(OBSERVATION_STORAGE_KEY);
    else storage.setItem(OBSERVATION_STORAGE_KEY, serializeStored(records));
    const expected = records.length === 0 ? null : serializeStored(records);
    if (storage.getItem(OBSERVATION_STORAGE_KEY) !== expected) throw new Error("readback");
  } catch (error) {
    try {
      if (previousRaw === null) storage.removeItem(OBSERVATION_STORAGE_KEY);
      else storage.setItem(OBSERVATION_STORAGE_KEY, previousRaw);
    } catch { /* The caller receives the primary failure; no other key is touched. */ }
    throw new ObservationValidationError("本机观察笔记没有保存；原有记录保持不变。", { cause: error });
  }
}

export function pruneObservationRecords(records: readonly NaturalUseObservationRecord[], today = localDateString()): NaturalUseObservationRecord[] {
  const todayDay = dateOnlyEpochDay(today);
  const retained = records.filter((record) => {
    const ageInDays = todayDay - dateOnlyEpochDay(record.dateLocal);
    return ageInDays >= 0 && ageInDays <= OBSERVATION_RETENTION_DAYS;
  });
  return retained.length <= OBSERVATION_MAX_RECORDS ? [...retained] : retained.slice(-OBSERVATION_MAX_RECORDS);
}

export function loadObservationRecords(storage: ObservationStorage, today = localDateString()): NaturalUseObservationRecord[] {
  const raw = storage.getItem(OBSERVATION_STORAGE_KEY);
  if (raw === null) return [];
  const parsed = parseStored(raw);
  const pruned = pruneObservationRecords(parsed.records, today);
  const nextRaw = pruned.length ? serializeStored(pruned) : null;
  if (nextRaw !== raw) writeRecords(storage, pruned, raw);
  return pruned;
}

export function saveObservationRecord(storage: ObservationStorage, record: NaturalUseObservationRecord, today = localDateString()): NaturalUseObservationRecord[] {
  const validated = validateObservationRecord(record);
  const previousRaw = storage.getItem(OBSERVATION_STORAGE_KEY);
  const existing = previousRaw === null ? [] : parseStored(previousRaw).records;
  if (existing.some((entry) => entry.id === validated.id)) throw new ObservationValidationError("观察记录编号重复；没有保存。");
  const records = pruneObservationRecords([...existing, validated], today);
  writeRecords(storage, records, previousRaw);
  return records;
}

export function deleteObservationRecord(storage: ObservationStorage, id: string, today = localDateString()): NaturalUseObservationRecord[] {
  const previousRaw = storage.getItem(OBSERVATION_STORAGE_KEY);
  if (previousRaw === null) return [];
  const existing = pruneObservationRecords(parseStored(previousRaw).records, today);
  const records = existing.filter((record) => record.id !== id);
  if (records.length === existing.length) return existing;
  writeRecords(storage, records, previousRaw);
  return records;
}

export function deleteAllObservationRecords(storage: ObservationStorage): void {
  const previousRaw = storage.getItem(OBSERVATION_STORAGE_KEY);
  if (previousRaw === null) return;
  writeRecords(storage, [], previousRaw);
}
