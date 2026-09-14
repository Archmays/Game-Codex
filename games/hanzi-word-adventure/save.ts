import { newJourney, validState, type Journey } from './model';
import { CHAPTERS, ROOMS, chapterForRoom, type ChapterId } from './rooms';
export const LEGACY_SAVE_KEY = 'family-games/hanzi-word-adventure/v1';
export const SAVE_KEY = 'family-games/hanzi-word-adventure/v2';
export const COMPANION_SAVE_KEY = 'family-games/hanzi-word-adventure/companions/v1';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface Settings { reducedMotion: boolean; }
export type ChapterSaves = Partial<Record<ChapterId, Journey>>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function validJourney(v: unknown): v is Journey {
  if (!object(v) || !Number.isInteger(v.room) || !Number.isInteger(v.unlocked)) return false;
  const room = v.room as number, unlocked = v.unlocked as number, definition = ROOMS[room];
  return !!definition && v.roomId === definition.id && v.chapterId === definition.chapterId && unlocked >= room && ROOMS[unlocked]?.chapterId === definition.chapterId
    && validState(definition, v.state) && Array.isArray(v.history) && v.history.length <= 256 && v.history.every(s => validState(definition, s));
}
export function validSaveV2(value: unknown): boolean {
  if (!object(value) || value.version !== 2 || !CHAPTERS.some(c => c.id !== 'companions' && c.id === value.activeChapterId) || !object(value.chapters) || !object(value.settings) || typeof value.settings.reducedMotion !== 'boolean') return false;
  return Object.entries(value.chapters).every(([id, j]) => id !== 'companions' && CHAPTERS.some(c => c.id === id) && validJourney(j) && j.chapterId === id);
}
export function validCompanionSave(value: unknown): boolean {
  return object(value) && value.version === 1 && validJourney(value.journey) && value.journey.chapterId === 'companions' && object(value.settings) && typeof value.settings.reducedMotion === 'boolean';
}
function migrateLegacy(value: unknown): Journey | null {
  if (!object(value) || value.version !== 1 || !object(value.journey)) return null;
  const j = value.journey;
  if (!Number.isInteger(j.room) || (j.room as number) < 0 || (j.room as number) > 4 || !Number.isInteger(j.unlocked) || (j.unlocked as number) > 4) return null;
  const candidate = { ...j, chapterId: 'homeward', roomId: ROOMS[j.room as number].id };
  return validJourney(candidate) ? candidate : null;
}
/** v1 bytes stay untouched. Only an absent v2 may copy a valid v1; all writes use
 * a mounted-session compare-and-set so other tabs and Vault restoration win. */
function openClassicSave(storage: StorageLike, defaults: Settings, migrate = true) {
  let raw: string | null = null, writable = true, payload: Record<string, unknown> = {}, chapters: ChapterSaves = {};
  let journey = newJourney(), settings = { ...defaults }, restored = false, activeChapterId: ChapterId = 'homeward';
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      const value: unknown = JSON.parse(raw);
      if (!validSaveV2(value)) throw Error('Unrecognized save');
      payload = value as Record<string, unknown>; chapters = { ...(payload.chapters as ChapterSaves) }; activeChapterId = payload.activeChapterId as ChapterId;
      settings = { reducedMotion: (payload.settings as Settings).reducedMotion }; restored = Object.keys(chapters).length > 0;
    } else {
      const oldRaw = storage.getItem(LEGACY_SAVE_KEY);
      if (oldRaw !== null) {
        let old: unknown; try { old = JSON.parse(oldRaw); } catch { old = null; }
        const migrated = migrateLegacy(old);
        if (migrated && object(old) && object(old.settings) && typeof old.settings.reducedMotion === 'boolean') {
          chapters.homeward = migrated; journey = migrated; settings = { reducedMotion: old.settings.reducedMotion }; restored = true;
          payload = { version: 2, activeChapterId, chapters, settings };
          if (migrate) {
            if (storage.getItem(SAVE_KEY) !== null || storage.getItem(LEGACY_SAVE_KEY) !== oldRaw) throw Error('Concurrent migration source or new save');
            const migratedRaw = JSON.stringify(payload); storage.setItem(SAVE_KEY, migratedRaw); raw = migratedRaw;
          }
        }
      }
    }
    journey = chapters[activeChapterId] ?? newJourney(CHAPTERS.find(c => c.id === activeChapterId)!.firstRoom);
  } catch { writable = false; }
  function flush(preferences: Settings): boolean {
    if (!writable) return false;
    try {
      if (storage.getItem(SAVE_KEY) !== raw) { writable = false; return false; }
      const next = { ...payload, version: 2, activeChapterId, chapters, settings: { ...(object(payload.settings) ? payload.settings : {}), ...preferences } };
      const nextRaw = JSON.stringify(next); storage.setItem(SAVE_KEY, nextRaw); raw = nextRaw; payload = next; return true;
    } catch { writable = false; return false; }
  }
  return {
    journey, settings, restored, get chapters() { return { ...chapters }; }, get writable() { return writable; },
    select(chapterId: ChapterId): Journey { activeChapterId = chapterId; return chapters[chapterId] ?? newJourney(CHAPTERS.find(c => c.id === chapterId)!.firstRoom); },
    reset(chapterId: ChapterId, preferences: Settings): Journey {
      const fresh = newJourney(CHAPTERS.find(c => c.id === chapterId)!.firstRoom); chapters = { ...chapters, [chapterId]: fresh }; activeChapterId = chapterId; flush(preferences); return fresh;
    },
    write(current: Journey, preferences: Settings): boolean {
      if (!validJourney(current) || current.chapterId === 'companions') return false;
      const old = chapters[current.chapterId];
      chapters = { ...chapters, [current.chapterId]: { ...old, ...current, state: { ...old?.state, ...current.state } } }; activeChapterId = current.chapterId;
      return flush(preferences);
    },
  };
}

/** New mode owns only its exact key. A corrupt/future or concurrently changed slot is
 * protected even when the user restarts for an in-memory play session. */
export function openSave(storage: StorageLike, defaults: Settings, initialChapter: ChapterId = 'homeward') {
  const classic = openClassicSave(storage, defaults, initialChapter !== 'companions');
  let classicSettings = classic.settings;
  let raw: string | null = null, writable = true, payload: Record<string, unknown> = {}, companion: Journey | undefined, active = classic.journey.chapterId;
  let companionSettings = { ...defaults };
  try { raw = storage.getItem(COMPANION_SAVE_KEY); if (raw !== null) { const value: unknown = JSON.parse(raw); if (!validCompanionSave(value)) throw Error('Unrecognized companion save'); payload = value as Record<string,unknown>; companion = payload.journey as Journey; companionSettings = payload.settings as Settings; } } catch { writable = false; }
  function writeCompanion(current: Journey, preferences: Settings): boolean {
    if (!validJourney(current) || current.chapterId !== 'companions') return false;
    companion = current; companionSettings = preferences;
    if (!writable) return false;
    try { if (storage.getItem(COMPANION_SAVE_KEY) !== raw) { writable = false; return false; }
      const next = { ...payload, version: 1, journey: current, settings: { ...(object(payload.settings) ? payload.settings : {}), ...preferences } };
      const text = JSON.stringify(next); storage.setItem(COMPANION_SAVE_KEY,text); raw = text; payload = next; return true;
    } catch { writable = false; return false; }
  }
  return {
    journey: classic.journey, settings: classic.settings, restored: classic.restored,
    get chapters(): ChapterSaves { return { ...classic.chapters, ...(companion ? { companions: companion } : {}) }; },
    get writable() { return active === 'companions' ? writable : classic.writable; },
    settingsFor(id: ChapterId) { return id === 'companions' ? companionSettings : classicSettings; },
    select(id: ChapterId): Journey { active = id; return id === 'companions' ? companion ?? newJourney(15) : classic.select(id); },
    reset(id: ChapterId, preferences: Settings): Journey { active = id; if (id !== 'companions') return classic.reset(id,preferences); const fresh = newJourney(15); writeCompanion(fresh,preferences); return fresh; },
    write(current: Journey, preferences: Settings): boolean { active = current.chapterId; if (active === 'companions') return writeCompanion(current,preferences); classicSettings = preferences; return classic.write(current,preferences); },
  };
}
