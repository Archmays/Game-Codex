export const MEMORY_MATCH_SAVE_KEY = "family-games/memory-match/v1";
export const LEGACY_MEMORY_SAVE_KEY = "family-games/memory-card/progress";

export interface MemoryMatchSave {
  readonly version: 1;
  readonly selectedPackId: string;
  readonly recentRelationIds: readonly string[];
  readonly contentRevision: string;
}

export function readMemorySave(packId: string, revision: string, storage: Storage = window.localStorage): MemoryMatchSave {
  try {
    const parsed = JSON.parse(storage.getItem(MEMORY_MATCH_SAVE_KEY) ?? "null") as Partial<MemoryMatchSave> | null;
    if (!parsed || parsed.version !== 1) return { version: 1, selectedPackId: packId, recentRelationIds: [], contentRevision: revision };
    return { version: 1, selectedPackId: typeof parsed.selectedPackId === "string" ? parsed.selectedPackId : packId, recentRelationIds: Array.isArray(parsed.recentRelationIds) ? parsed.recentRelationIds.filter((id): id is string => typeof id === "string") : [], contentRevision: typeof parsed.contentRevision === "string" ? parsed.contentRevision : revision };
  } catch { return { version: 1, selectedPackId: packId, recentRelationIds: [], contentRevision: revision }; }
}

export function writeMemorySave(save: MemoryMatchSave, storage: Storage = window.localStorage): void {
  try { storage.setItem(MEMORY_MATCH_SAVE_KEY, JSON.stringify(save)); } catch { /* Persistence is optional for local play. */ }
}

export function readLegacyMemoryPresence(storage: Storage = window.localStorage): { present: boolean; parseable: boolean } {
  const raw = storage.getItem(LEGACY_MEMORY_SAVE_KEY);
  if (raw === null) return { present: false, parseable: true };
  try { JSON.parse(raw); return { present: true, parseable: true }; }
  catch { return { present: true, parseable: false }; }
}
