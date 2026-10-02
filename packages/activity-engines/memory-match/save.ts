export const MEMORY_MATCH_SAVE_KEY = "family-games/memory-match/v1";
export const LEGACY_MEMORY_SAVE_KEY = "family-games/memory-card/progress";
export interface MemoryMatchSave {
  readonly version: 1;
  readonly selectedPackId: string;
  readonly recentRelationIds: readonly string[];
  readonly contentRevision: string;
}
type MemoryStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type MemorySaveStatus = 'missing' | 'current' | 'legacy' | 'future' | 'corrupt' | 'unavailable' | 'conflict' | 'write-failed';
export interface MemorySaveRead { status: MemorySaveStatus; value: MemoryMatchSave; raw: string | null; }
const initial = (packId: string, revision: string): MemoryMatchSave => ({ version: 1, selectedPackId: packId, recentRelationIds: [], contentRevision: revision });
const valid = (value: unknown): value is MemoryMatchSave => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as MemoryMatchSave;
  return v.version === 1 && typeof v.selectedPackId === 'string' && typeof v.contentRevision === 'string'
    && Array.isArray(v.recentRelationIds) && v.recentRelationIds.every(id => typeof id === 'string');
};
// Resolve inside the guarded operation: even accessing localStorage can throw.
const resolve = (storage?: MemoryStorage): MemoryStorage => storage ?? window.localStorage;
export function inspectMemorySave(packId: string, revision: string, storage?: MemoryStorage): MemorySaveRead {
  const fallback = initial(packId, revision);
  let raw: string | null;
  try { raw = resolve(storage).getItem(MEMORY_MATCH_SAVE_KEY); }
  catch { return { status: 'unavailable', value: fallback, raw: null }; }
  if (raw === null) {
    const legacy = readLegacyMemoryPresence(storage);
    // The old game's score format is intentionally not converted into relation progress.
    return { status: legacy.present ? 'legacy' : 'missing', value: fallback, raw };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (valid(value)) return { status: 'current', value, raw };
    const version = value && typeof value === 'object' ? (value as { version?: unknown }).version : undefined;
    return { status: typeof version === 'number' && version > 1 ? 'future' : 'corrupt', value: fallback, raw };
  } catch { return { status: 'corrupt', value: fallback, raw }; }
}
export function readMemorySave(packId: string, revision: string, storage?: MemoryStorage): MemoryMatchSave {
  return inspectMemorySave(packId, revision, storage).value;
}
export function openMemorySave(packId: string, revision: string, storage?: MemoryStorage) {
  const loaded = inspectMemorySave(packId, revision, storage);
  let status = loaded.status, raw = loaded.raw;
  const writable = () => ['missing', 'current', 'legacy'].includes(status);
  return {
    value: loaded.value,
    get status() { return status; },
    get raw() { return raw; },
    get writable() { return writable(); },
    write(value: MemoryMatchSave): boolean {
      if (!writable() || !valid(value)) return false;
      try {
        const target = resolve(storage);
        if (target.getItem(MEMORY_MATCH_SAVE_KEY) !== raw) { status = 'conflict'; return false; }
        const next = JSON.stringify(value);
        target.setItem(MEMORY_MATCH_SAVE_KEY, next);
        raw = next; status = 'current'; return true;
      } catch { status = 'write-failed'; return false; }
    }
  };
}
/** Compatibility API also checks existing bytes; a default state never authorizes replacing an unknown save. */
export function writeMemorySave(save: MemoryMatchSave, storage?: MemoryStorage): boolean {
  return openMemorySave(save.selectedPackId, save.contentRevision, storage).write(save);
}
export function readLegacyMemoryPresence(storage?: MemoryStorage): { present: boolean; parseable: boolean } {
  try {
    const raw = resolve(storage).getItem(LEGACY_MEMORY_SAVE_KEY);
    if (raw === null) return { present: false, parseable: true };
    try { JSON.parse(raw); return { present: true, parseable: true }; }
    catch { return { present: true, parseable: false }; }
  } catch { return { present: false, parseable: false }; }
}
