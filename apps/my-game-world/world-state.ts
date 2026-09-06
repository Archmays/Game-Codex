export const MY_GAME_WORLD_SETTINGS_KEY = "family-games/my-game-world/v1";

export interface WorldHomeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WorldHomeSettings {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface WorldHomeState {
  readonly version: 1;
  readonly settings: WorldHomeSettings;
  readonly recoveredCalmly: boolean;
}

export interface WorldSettingsUpdateResult {
  readonly ok: boolean;
  readonly state: WorldHomeState;
}

const DEFAULT_STATE: WorldHomeState = {
  version: 1,
  settings: { muted: false, reducedMotion: false },
  recoveredCalmly: false,
};

interface WriteGuard {
  readonly raw: string | null;
  readonly payload: Record<string, unknown>;
  writable: boolean;
}
// Mount-local identity, deliberately absent from both the public state and disk.
const guards = new WeakMap<WorldHomeState, WriteGuard>();
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function readWorldHomeState(storage: WorldHomeStorageLike): WorldHomeState {
  let raw: string | null = null;
  let payload: Record<string, unknown> = {};
  let writable = false;
  let state: WorldHomeState = { ...DEFAULT_STATE };
  try {
    raw = storage.getItem(MY_GAME_WORLD_SETTINGS_KEY);
    if (raw === null) writable = true;
    else {
      const parsed: unknown = JSON.parse(raw);
      if (!object(parsed) || parsed.version !== 1
        || (parsed.settings !== undefined && !object(parsed.settings))) throw new Error("Unknown home settings");
      const settings = object(parsed.settings) ? parsed.settings : {};
      if (["muted", "reducedMotion"].some(key => settings[key] !== undefined && typeof settings[key] !== "boolean")) throw new Error("Invalid home settings");
      payload = parsed;
      state = { version: 1, settings: { muted: settings.muted === true, reducedMotion: settings.reducedMotion === true }, recoveredCalmly: false };
      writable = true;
    }
  } catch {
    state = { ...DEFAULT_STATE, recoveredCalmly: true };
  }
  guards.set(state, { raw, payload, writable });
  return state;
}

export function updateWorldSettings(
  storage: WorldHomeStorageLike,
  current: WorldHomeState,
  settings: Partial<WorldHomeSettings>,
): WorldSettingsUpdateResult {
  const guard = guards.get(current);
  if (!guard?.writable) return { ok: false, state: current };
  const state: WorldHomeState = {
    version: 1,
    settings: { ...current.settings, ...settings },
    recoveredCalmly: false,
  };
  try {
    if (storage.getItem(MY_GAME_WORLD_SETTINGS_KEY) !== guard.raw) {
      guard.writable = false;
      return { ok: false, state: current };
    }
    const payload = { ...guard.payload, version: 1, settings: { ...(object(guard.payload.settings) ? guard.payload.settings : {}), ...state.settings } };
    const raw = JSON.stringify(payload);
    storage.setItem(MY_GAME_WORLD_SETTINGS_KEY, raw);
    guard.writable = false;
    guards.set(state, { raw, payload, writable: true });
    return { ok: true, state };
  } catch {
    guard.writable = false;
    return { ok: false, state: current };
  }
}
