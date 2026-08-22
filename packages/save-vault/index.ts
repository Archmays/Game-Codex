import {
  EXPORTABLE_SAVE_KEYS,
  KNOWN_SAVE_KEY_BY_NAME,
  SAVE_VAULT_PRE_IMPORT_BACKUP_KEY,
  type KnownSaveKey,
} from "../data/saveKeyInventory";

export const SAVE_VAULT_FORMAT = "game-codex-save-vault";
export const SAVE_VAULT_VERSION = 1 as const;
export const SAVE_VAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SAVE_VAULT_MAX_ENTRY_BYTES = 1024 * 1024;
export const SAVE_VAULT_MAX_ENTRIES = 128;

export interface SaveVaultStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveVaultEntry {
  readonly key: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly value: string;
}

export interface SaveVaultBackup {
  readonly format: typeof SAVE_VAULT_FORMAT;
  readonly version: typeof SAVE_VAULT_VERSION;
  readonly exportedAt: string;
  readonly originHint: string;
  readonly entries: readonly SaveVaultEntry[];
  readonly manifestSha256: string;
}

export interface SaveVaultPreview {
  readonly format: string;
  readonly version: number;
  readonly entriesCount: number;
  readonly knownKeys: readonly string[];
  readonly unknownKeys: readonly string[];
  readonly futureKeys: readonly string[];
  readonly totalBytes: number;
  readonly checksum: "PASS";
}

export interface ValidatedSaveVault {
  readonly backup: SaveVaultBackup;
  readonly preview: SaveVaultPreview;
  readonly knownEntries: readonly SaveVaultEntry[];
}

export class SaveVaultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveVaultValidationError";
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("This browser cannot calculate the local backup checksum.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function manifestPayload(entries: readonly SaveVaultEntry[]): string {
  return JSON.stringify({ format: SAVE_VAULT_FORMAT, version: SAVE_VAULT_VERSION, entries });
}

function validSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function safeEntryKey(key: string): boolean {
  return key.length > 0
    && key.length <= 180
    && !/[\u0000-\u001f<>\\]/.test(key)
    && !key.includes("..")
    && !key.includes("://")
    && !/^[A-Za-z]:/.test(key);
}

function saveVersion(value: string): number | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const field of ["version", "saveVersion", "schemaVersion"] as const) {
      if (typeof parsed?.[field] === "number" && Number.isFinite(parsed[field])) return parsed[field] as number;
    }
  } catch {
    // Raw legacy values are preserved without interpretation.
  }
  return null;
}

function isFutureEntry(entry: SaveVaultEntry, known: KnownSaveKey): boolean {
  const version = saveVersion(entry.value);
  return known.maxVersion !== undefined && version !== null && version > known.maxVersion;
}

export async function createSaveVaultBackup(
  storage: SaveVaultStorage,
  options: { readonly now?: Date; readonly originHint?: string } = {},
): Promise<SaveVaultBackup> {
  const entries: SaveVaultEntry[] = [];
  for (const record of EXPORTABLE_SAVE_KEYS) {
    const value = storage.getItem(record.key);
    if (value === null) continue;
    const bytes = utf8Bytes(value);
    if (bytes > SAVE_VAULT_MAX_ENTRY_BYTES) throw new Error(`Local save is too large to back up safely: ${record.key}`);
    entries.push({ key: record.key, bytes, sha256: await sha256(value), value });
  }
  entries.sort((left, right) => left.key.localeCompare(right.key, "en"));
  const backupWithoutHash = {
    format: SAVE_VAULT_FORMAT,
    version: SAVE_VAULT_VERSION,
    exportedAt: (options.now ?? new Date()).toISOString(),
    originHint: options.originHint ?? (typeof location === "undefined" ? "local-game-codex" : `${location.origin}${location.pathname}`),
    entries,
  } as const;
  const manifestSha256 = await sha256(manifestPayload(entries));
  const backup = { ...backupWithoutHash, manifestSha256 };
  if (utf8Bytes(JSON.stringify(backup)) > SAVE_VAULT_MAX_FILE_BYTES) throw new Error("The local backup would exceed the safe file size limit.");
  return backup;
}

export function serializeSaveVaultBackup(backup: SaveVaultBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function saveVaultFilename(now = new Date()): string {
  return `game-codex-saves-${now.toISOString().slice(0, 10)}.json`;
}

export async function validateSaveVaultText(rawText: string): Promise<ValidatedSaveVault> {
  if (utf8Bytes(rawText) > SAVE_VAULT_MAX_FILE_BYTES) throw new SaveVaultValidationError("备份文件超过安全大小上限。请不要导入这个文件。");
  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch {
    throw new SaveVaultValidationError("这不是有效的 JSON 备份文件。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SaveVaultValidationError("备份文件结构不正确。");
  const candidate = value as Record<string, unknown>;
  if (candidate.format !== SAVE_VAULT_FORMAT) throw new SaveVaultValidationError("这不是 Game-Codex 存档保险箱文件。");
  if (candidate.version !== SAVE_VAULT_VERSION) {
    throw new SaveVaultValidationError(typeof candidate.version === "number" && candidate.version > SAVE_VAULT_VERSION
      ? "这个备份来自更新版本；当前版本不会猜测恢复。"
      : "备份版本不受支持。");
  }
  if (typeof candidate.exportedAt !== "string" || candidate.exportedAt.length > 80) throw new SaveVaultValidationError("导出时间字段不正确。");
  if (typeof candidate.originHint !== "string" || candidate.originHint.length > 256 || /[\u0000-\u001f]/.test(candidate.originHint)) throw new SaveVaultValidationError("来源提示字段不安全。");
  if (!Array.isArray(candidate.entries) || candidate.entries.length > SAVE_VAULT_MAX_ENTRIES) throw new SaveVaultValidationError("备份条目数量不正确。");
  if (!validSha256(candidate.manifestSha256)) throw new SaveVaultValidationError("备份总校验值缺失或格式不正确。");

  const seen = new Set<string>();
  const entries: SaveVaultEntry[] = [];
  for (const raw of candidate.entries) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SaveVaultValidationError("备份中有无效条目。");
    const entry = raw as Record<string, unknown>;
    if (typeof entry.key !== "string" || !safeEntryKey(entry.key)) throw new SaveVaultValidationError("备份包含不安全的路径或键名。");
    if (seen.has(entry.key)) throw new SaveVaultValidationError(`备份键重复：${entry.key}`);
    seen.add(entry.key);
    if (typeof entry.value !== "string") throw new SaveVaultValidationError(`备份值不正确：${entry.key}`);
    const bytes = utf8Bytes(entry.value);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes !== bytes || bytes > SAVE_VAULT_MAX_ENTRY_BYTES) throw new SaveVaultValidationError(`条目大小不匹配：${entry.key}`);
    if (!validSha256(entry.sha256) || await sha256(entry.value) !== entry.sha256) throw new SaveVaultValidationError(`条目校验失败：${entry.key}`);
    entries.push({ key: entry.key, bytes, sha256: entry.sha256, value: entry.value });
  }
  entries.sort((left, right) => left.key.localeCompare(right.key, "en"));
  if (await sha256(manifestPayload(entries)) !== candidate.manifestSha256) throw new SaveVaultValidationError("备份总校验失败；文件可能不完整或已改变。");

  const knownEntries = entries.filter((entry) => KNOWN_SAVE_KEY_BY_NAME.get(entry.key)?.exportable === true);
  const unknownKeys = entries.filter((entry) => !KNOWN_SAVE_KEY_BY_NAME.get(entry.key)?.exportable).map((entry) => entry.key);
  const futureKeys = knownEntries.filter((entry) => isFutureEntry(entry, KNOWN_SAVE_KEY_BY_NAME.get(entry.key)!)).map((entry) => entry.key);
  const backup: SaveVaultBackup = {
    format: SAVE_VAULT_FORMAT,
    version: SAVE_VAULT_VERSION,
    exportedAt: candidate.exportedAt,
    originHint: candidate.originHint,
    entries,
    manifestSha256: candidate.manifestSha256,
  };
  return {
    backup,
    knownEntries,
    preview: {
      format: SAVE_VAULT_FORMAT,
      version: SAVE_VAULT_VERSION,
      entriesCount: entries.length,
      knownKeys: knownEntries.map((entry) => entry.key),
      unknownKeys,
      futureKeys,
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      checksum: "PASS",
    },
  };
}

interface RollbackEntry {
  readonly key: string;
  readonly value: string | null;
}

function preImportBackup(now: Date, entries: readonly RollbackEntry[]): string {
  return JSON.stringify({ format: "game-codex-pre-import-backup", version: 1, createdAt: now.toISOString(), entries });
}

function writeRollbackSnapshot(storage: SaveVaultStorage, entries: readonly RollbackEntry[], now: Date): void {
  const raw = preImportBackup(now, entries);
  storage.setItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY, raw);
  if (storage.getItem(SAVE_VAULT_PRE_IMPORT_BACKUP_KEY) !== raw) throw new Error("无法建立恢复前备份；没有改动任何游戏进度。");
}

function rollback(storage: SaveVaultStorage, entries: readonly RollbackEntry[]): boolean {
  try {
    for (const entry of entries) {
      if (entry.value === null) storage.removeItem(entry.key);
      else storage.setItem(entry.key, entry.value);
    }
    return entries.every((entry) => storage.getItem(entry.key) === entry.value);
  } catch {
    return false;
  }
}

export interface SaveVaultRestoreResult {
  readonly restoredKeys: readonly string[];
  readonly skippedUnknownKeys: readonly string[];
  readonly futureKeysRestoredRaw: readonly string[];
  readonly readbackVerified: true;
  readonly reloadRequired: true;
}

export function restoreSaveVault(
  storage: SaveVaultStorage,
  validated: ValidatedSaveVault,
  now = new Date(),
): SaveVaultRestoreResult {
  const before = validated.knownEntries.map((entry) => ({ key: entry.key, value: storage.getItem(entry.key) }));
  writeRollbackSnapshot(storage, before, now);
  try {
    for (const entry of validated.knownEntries) storage.setItem(entry.key, entry.value);
    if (!validated.knownEntries.every((entry) => storage.getItem(entry.key) === entry.value)) throw new Error("恢复后的读取校验没有通过。");
  } catch (error) {
    if (!rollback(storage, before)) throw new Error("恢复失败，而且自动回滚未能完整验证。请保留当前浏览器页面。", { cause: error });
    throw new Error("恢复没有完成；已自动回到恢复前的本机记录。", { cause: error });
  }
  return {
    restoredKeys: validated.knownEntries.map((entry) => entry.key),
    skippedUnknownKeys: validated.preview.unknownKeys,
    futureKeysRestoredRaw: validated.preview.futureKeys,
    readbackVerified: true,
    reloadRequired: true,
  };
}

export function clearAllKnownGameSaves(
  storage: SaveVaultStorage,
  confirmation: "CONFIRMED_AFTER_EXPORT",
  now = new Date(),
): { readonly clearedKeys: readonly string[]; readonly unknownStorageTouched: 0 } {
  if (confirmation !== "CONFIRMED_AFTER_EXPORT") throw new Error("清空前必须先导出备份并由家长确认。");
  const present = EXPORTABLE_SAVE_KEYS
    .map((entry) => ({ key: entry.key, value: storage.getItem(entry.key) }))
    .filter((entry): entry is { key: string; value: string } => entry.value !== null);
  writeRollbackSnapshot(storage, present, now);
  try {
    for (const entry of present) storage.removeItem(entry.key);
    if (!present.every((entry) => storage.getItem(entry.key) === null)) throw new Error("清空后的读取校验没有通过。");
  } catch (error) {
    if (!rollback(storage, present)) throw new Error("清空失败，而且自动回滚未能完整验证。请保留当前浏览器页面。", { cause: error });
    throw new Error("清空没有完成；已自动恢复清空前的本机记录。", { cause: error });
  }
  return { clearedKeys: present.map((entry) => entry.key), unknownStorageTouched: 0 };
}
