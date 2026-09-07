import { newJourney, validState, type Journey } from './model';
import { ROOMS } from './rooms';
export const SAVE_KEY = 'family-games/hanzi-word-adventure/v1';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface Settings { reducedMotion: boolean; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function validJourney(v: unknown): v is Journey {
  if (!object(v) || !Number.isInteger(v.room) || !Number.isInteger(v.unlocked)) return false;
  const room = v.room as number, unlocked = v.unlocked as number;
  return room >= 0 && room < ROOMS.length && unlocked >= room && unlocked < ROOMS.length
    && validState(ROOMS[room], v.state) && Array.isArray(v.history) && v.history.length <= 256
    && v.history.every(s => validState(ROOMS[room], s));
}
/** Same mounted-session compare-and-set protection as the shipped tower-defense save.
 * Bad/future data and another tab's writes remain byte-for-byte intact. No old game is read.
 */
export function openSave(storage: StorageLike, defaults: Settings) {
  let raw: string | null = null, writable = true, payload: Record<string, unknown> = {};
  let journey = newJourney(), settings = { ...defaults }, restored = false;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      const value: unknown = JSON.parse(raw);
      if (!object(value) || value.version !== 1 || !validJourney(value.journey) || !object(value.settings) || typeof value.settings.reducedMotion !== 'boolean') throw Error('Unrecognized save');
      payload = value; journey = value.journey; settings = { reducedMotion: value.settings.reducedMotion }; restored = true;
    }
  } catch { writable = false; }
  return {
    journey, settings, restored, get writable() { return writable; },
    write(current: Journey, preferences: Settings): boolean {
      if (!writable || !validJourney(current)) return false;
      try {
        if (storage.getItem(SAVE_KEY) !== raw) { writable = false; return false; }
        const oldJourney = object(payload.journey) ? payload.journey : {};
        const oldState = object(oldJourney.state) ? oldJourney.state : {};
        const next = { ...payload, version: 1, journey: { ...oldJourney, ...current, state: { ...oldState, ...current.state } }, settings: { ...(object(payload.settings) ? payload.settings : {}), ...preferences } };
        const nextRaw = JSON.stringify(next); storage.setItem(SAVE_KEY, nextRaw); raw = nextRaw; payload = next; return true;
      } catch { writable = false; return false; }
    },
  };
}
