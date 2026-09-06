import { ENGLISH_V2_CONTENT_REVISION, ENGLISH_V2_SENTENCES, ENGLISH_V2_WORDS } from "../content/manifest";
import type { EnglishThemeId } from "../content/types";
import { ENGLISH_INTERACTION_REVISION, validPilotRecords, type PilotRecords } from "../pilot/model";

export const ENGLISH_WORLD_SAVE_KEY = "family-games/english-world/v2";
export const LEGACY_ENGLISH_SAVE_KEY = "family-games/english-spell-battle/progress";
export const ENGLISH_WORLD_SAVE_VERSION = 3;
export interface EnglishWorldSettings {
  readonly soundEnabled: boolean;
  readonly chineseScaffold: boolean;
  readonly reducedMotion: boolean;
  readonly [extension: string]: unknown;
}
export interface EnglishWorldSaveV3 {
  readonly version: 3;
  readonly completedStoryWordIds: readonly string[];
  readonly encounteredOptionalWordIds: readonly string[];
  readonly completedSentenceIds: readonly string[];
  readonly visitedRegionIds: readonly EnglishThemeId[];
  readonly activeRegionId: EnglishThemeId | null;
  readonly settings: EnglishWorldSettings;
  readonly contentRevision: string;
  readonly interactionRevision: typeof ENGLISH_INTERACTION_REVISION;
  readonly interactions: PilotRecords;
  /** Exact pre-migration V2 bytes, including opaque extensions; retained once. */
  readonly migratedFromV2Raw?: string;
  readonly checksum: string;
  readonly [extension: string]: unknown;
}
export interface ReadEnglishWorldSaveResult {
  readonly save: EnglishWorldSaveV3;
  readonly status: "fresh" | "ok" | "migrated" | "corrupt-recovered" | "future-readonly" | "storage-readonly";
  readonly writable: boolean;
  readonly raw: string | null;
  readonly legacyRaw: string | null;
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function checksumPayload(save: Record<string, unknown>): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(save)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function withChecksum(value: Record<string, unknown>): EnglishWorldSaveV3 {
  const { checksum: _previous, ...payload } = value;
  return { ...payload, checksum: checksumPayload(payload) } as EnglishWorldSaveV3;
}
export function createDefaultEnglishWorldSave(): EnglishWorldSaveV3 {
  return withChecksum({
    version: 3, completedStoryWordIds: [], encounteredOptionalWordIds: [], completedSentenceIds: [], visitedRegionIds: [], activeRegionId: null,
    settings: { soundEnabled: true, chineseScaffold: true, reducedMotion: false },
    contentRevision: ENGLISH_V2_CONTENT_REVISION, interactionRevision: ENGLISH_INTERACTION_REVISION, interactions: {},
  });
}
const REGIONS = ["animals", "home", "food", "actions", "colors"];
function validIds(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.every(item => typeof item === "string" && allowed.includes(item)) && new Set(value).size === value.length;
}
function validKnownFields(parsed: Record<string, unknown>): boolean {
  return validIds(parsed.completedStoryWordIds, ENGLISH_V2_WORDS.filter(word => word.storyBand === "story-core").map(word => word.id))
    && validIds(parsed.encounteredOptionalWordIds, ENGLISH_V2_WORDS.filter(word => word.storyBand === "optional").map(word => word.id))
    && validIds(parsed.completedSentenceIds, ENGLISH_V2_SENTENCES.map(sentence => sentence.id))
    && validIds(parsed.visitedRegionIds, REGIONS)
    && (parsed.activeRegionId === null || REGIONS.includes(parsed.activeRegionId as string))
    && object(parsed.settings) && ["soundEnabled", "chineseScaffold", "reducedMotion"].every(key => typeof (parsed.settings as Record<string, unknown>)[key] === "boolean");
}
/** Exact field order/projection of the shipped V2 checksum contract. Verification only:
 * migration retains the complete parsed payload and original raw bytes. */
function legacyV2Payload(parsed: Record<string, unknown>): Record<string, unknown> {
  const unique = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
  const settings = object(parsed.settings) ? parsed.settings : {};
  return {
    version: 2,
    completedStoryWordIds: unique(parsed.completedStoryWordIds),
    encounteredOptionalWordIds: unique(parsed.encounteredOptionalWordIds),
    completedSentenceIds: unique(parsed.completedSentenceIds),
    visitedRegionIds: unique(parsed.visitedRegionIds).filter(id => REGIONS.includes(id)),
    activeRegionId: typeof parsed.activeRegionId === "string" && REGIONS.includes(parsed.activeRegionId) ? parsed.activeRegionId : null,
    settings: { soundEnabled: settings.soundEnabled !== false, chineseScaffold: settings.chineseScaffold !== false, reducedMotion: settings.reducedMotion === true },
    contentRevision: typeof parsed.contentRevision === "string" ? parsed.contentRevision : ENGLISH_V2_CONTENT_REVISION,
  };
}
function validV3(parsed: Record<string, unknown>): parsed is EnglishWorldSaveV3 {
  if (parsed.version !== 3 || parsed.contentRevision !== ENGLISH_V2_CONTENT_REVISION || parsed.interactionRevision !== ENGLISH_INTERACTION_REVISION
    || !validKnownFields(parsed) || !validPilotRecords(parsed.interactions) || typeof parsed.checksum !== "string") return false;
  if (parsed.migratedFromV2Raw !== undefined) {
    if (typeof parsed.migratedFromV2Raw !== "string") return false;
    try {
      const old: unknown = JSON.parse(parsed.migratedFromV2Raw);
      if (!object(old) || old.version !== 2) return false;
      const known = legacyV2Payload(old);
      if (old.checksum !== checksumPayload(known) || !validKnownFields(known)) return false;
    } catch { return false; }
  }
  const { checksum, ...payload } = parsed;
  return checksum === checksumPayload(payload);
}
function decode(raw: string | null, legacyRaw: string | null): ReadEnglishWorldSaveResult {
  const readonly = (status: ReadEnglishWorldSaveResult["status"]): ReadEnglishWorldSaveResult => ({ save: createDefaultEnglishWorldSave(), status, writable: false, raw, legacyRaw });
  if (raw === null) return { save: createDefaultEnglishWorldSave(), status: "fresh", writable: true, raw, legacyRaw };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!object(parsed)) return readonly("corrupt-recovered");
    if (typeof parsed.version === "number" && parsed.version > 3) return readonly("future-readonly");
    if (parsed.version === 2) {
      const known = legacyV2Payload(parsed);
      if (parsed.checksum !== checksumPayload(known) || !validKnownFields(known)) return readonly("corrupt-recovered");
      if (known.contentRevision !== ENGLISH_V2_CONTENT_REVISION || ["interactionRevision", "interactions", "migratedFromV2Raw"].some(key => key in parsed)) return readonly("future-readonly");
      const save = withChecksum({ ...parsed, ...known, settings: { ...(object(parsed.settings) ? parsed.settings : {}), ...(known.settings as object) },
        version: 3, interactionRevision: ENGLISH_INTERACTION_REVISION, interactions: {}, migratedFromV2Raw: raw });
      return { save, status: "migrated", writable: true, raw, legacyRaw };
    }
    if (parsed.version === 3 && (parsed.contentRevision !== ENGLISH_V2_CONTENT_REVISION || parsed.interactionRevision !== ENGLISH_INTERACTION_REVISION)) return readonly("future-readonly");
    if (!validV3(parsed)) return readonly("corrupt-recovered");
    return { save: parsed, status: "ok", writable: true, raw, legacyRaw };
  } catch { return readonly("corrupt-recovered"); }
}
export function readEnglishWorldSave(storage: Pick<Storage, "getItem"> = window.localStorage): ReadEnglishWorldSaveResult {
  try { return decode(storage.getItem(ENGLISH_WORLD_SAVE_KEY), storage.getItem(LEGACY_ENGLISH_SAVE_KEY)); }
  catch { return { save: createDefaultEnglishWorldSave(), status: "storage-readonly", writable: false, raw: null, legacyRaw: null }; }
}
/** Compare before every write; an old mount cannot overwrite another tab or a Vault restore. */
export function writeEnglishWorldSave(save: EnglishWorldSaveV3, storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage, expectedRaw: string | null = null): boolean {
  try {
    const currentRaw = storage.getItem(ENGLISH_WORLD_SAVE_KEY);
    if (currentRaw !== expectedRaw || !decode(currentRaw, null).writable || !validV3(save)) return false;
    storage.setItem(ENGLISH_WORLD_SAVE_KEY, JSON.stringify(save));
    return true;
  } catch { return false; }
}
export function updateEnglishWorldSave(save: EnglishWorldSaveV3, patch: Partial<Pick<EnglishWorldSaveV3,
  "completedStoryWordIds" | "encounteredOptionalWordIds" | "completedSentenceIds" | "visitedRegionIds" | "activeRegionId" | "settings" | "interactions">>): EnglishWorldSaveV3 {
  return withChecksum({ ...save, ...patch, settings: { ...save.settings, ...patch.settings }, version: 3 });
}
