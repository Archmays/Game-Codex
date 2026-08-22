import { ENGLISH_V2_CONTENT_REVISION } from "../content/manifest";
import type { EnglishThemeId } from "../content/types";

export const ENGLISH_WORLD_SAVE_KEY = "family-games/english-world/v2";
export const LEGACY_ENGLISH_SAVE_KEY = "family-games/english-spell-battle/progress";

export interface EnglishWorldSettings {
  readonly soundEnabled: boolean;
  readonly chineseScaffold: boolean;
  readonly reducedMotion: boolean;
}
export interface EnglishWorldSaveV2 {
  readonly version: 2;
  readonly completedStoryWordIds: readonly string[];
  readonly encounteredOptionalWordIds: readonly string[];
  readonly completedSentenceIds: readonly string[];
  readonly visitedRegionIds: readonly EnglishThemeId[];
  readonly activeRegionId: EnglishThemeId | null;
  readonly settings: EnglishWorldSettings;
  readonly contentRevision: string;
  readonly checksum: string;
}

export interface ReadEnglishWorldSaveResult {
  readonly save: EnglishWorldSaveV2;
  readonly status: "fresh" | "ok" | "corrupt-recovered" | "future-readonly";
  readonly writable: boolean;
  readonly legacyRaw: string | null;
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function checksumPayload(save: Omit<EnglishWorldSaveV2, "checksum">): string {
  const text = JSON.stringify(save);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function withChecksum(value: Omit<EnglishWorldSaveV2, "checksum">): EnglishWorldSaveV2 {
  return { ...value, checksum: checksumPayload(value) };
}

export function createDefaultEnglishWorldSave(): EnglishWorldSaveV2 {
  return withChecksum({
    version: 2,
    completedStoryWordIds: [],
    encounteredOptionalWordIds: [],
    completedSentenceIds: [],
    visitedRegionIds: [],
    activeRegionId: null,
    settings: { soundEnabled: true, chineseScaffold: true, reducedMotion: false },
    contentRevision: ENGLISH_V2_CONTENT_REVISION,
  });
}

function normalizeV2(parsed: Record<string, unknown>): EnglishWorldSaveV2 {
  const settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings as Record<string, unknown> : {};
  const candidate = {
    version: 2 as const,
    completedStoryWordIds: uniqueStrings(parsed.completedStoryWordIds),
    encounteredOptionalWordIds: uniqueStrings(parsed.encounteredOptionalWordIds),
    completedSentenceIds: uniqueStrings(parsed.completedSentenceIds),
    visitedRegionIds: uniqueStrings(parsed.visitedRegionIds).filter((id): id is EnglishThemeId => ["animals", "home", "food", "actions", "colors"].includes(id)),
    activeRegionId: typeof parsed.activeRegionId === "string" && ["animals", "home", "food", "actions", "colors"].includes(parsed.activeRegionId) ? parsed.activeRegionId as EnglishThemeId : null,
    settings: {
      soundEnabled: settings.soundEnabled !== false,
      chineseScaffold: settings.chineseScaffold !== false,
      reducedMotion: settings.reducedMotion === true,
    },
    contentRevision: typeof parsed.contentRevision === "string" ? parsed.contentRevision : ENGLISH_V2_CONTENT_REVISION,
  };
  return withChecksum(candidate);
}

export function readEnglishWorldSave(storage: Pick<Storage, "getItem"> = window.localStorage): ReadEnglishWorldSaveResult {
  const legacyRaw = storage.getItem(LEGACY_ENGLISH_SAVE_KEY);
  const raw = storage.getItem(ENGLISH_WORLD_SAVE_KEY);
  if (!raw) return { save: createDefaultEnglishWorldSave(), status: "fresh", writable: true, legacyRaw };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.version === "number" && parsed.version > 2) return { save: createDefaultEnglishWorldSave(), status: "future-readonly", writable: false, legacyRaw };
    if (parsed.version !== 2 || typeof parsed.checksum !== "string") throw new Error("invalid version or checksum");
    const normalized = normalizeV2(parsed);
    if (normalized.checksum !== parsed.checksum) throw new Error("checksum mismatch");
    return { save: normalized, status: "ok", writable: true, legacyRaw };
  } catch {
    return { save: createDefaultEnglishWorldSave(), status: "corrupt-recovered", writable: true, legacyRaw };
  }
}

export function writeEnglishWorldSave(save: EnglishWorldSaveV2, storage: Pick<Storage, "setItem"> = window.localStorage): boolean {
  try {
    const normalized = normalizeV2(save as unknown as Record<string, unknown>);
    storage.setItem(ENGLISH_WORLD_SAVE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function updateEnglishWorldSave(save: EnglishWorldSaveV2, patch: Partial<Omit<EnglishWorldSaveV2, "version" | "checksum">>): EnglishWorldSaveV2 {
  return normalizeV2({ ...save, ...patch, version: 2 });
}
