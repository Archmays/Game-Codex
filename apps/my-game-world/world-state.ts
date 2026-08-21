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

export function readWorldHomeState(storage: WorldHomeStorageLike): WorldHomeState {
  try {
    const raw = storage.getItem(MY_GAME_WORLD_SETTINGS_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as { version?: unknown; settings?: { muted?: unknown; reducedMotion?: unknown } };
    if (parsed.version !== 1) return { ...DEFAULT_STATE, recoveredCalmly: true };
    return {
      version: 1,
      settings: {
        muted: parsed.settings?.muted === true,
        reducedMotion: parsed.settings?.reducedMotion === true,
      },
      recoveredCalmly: false,
    };
  } catch {
    return { ...DEFAULT_STATE, recoveredCalmly: true };
  }
}

export function updateWorldSettings(
  storage: WorldHomeStorageLike,
  current: WorldHomeState,
  settings: Partial<WorldHomeSettings>,
): WorldSettingsUpdateResult {
  const state: WorldHomeState = {
    version: 1,
    settings: { ...current.settings, ...settings },
    recoveredCalmly: false,
  };
  try {
    storage.setItem(MY_GAME_WORLD_SETTINGS_KEY, JSON.stringify({ version: 1, settings: state.settings }));
    return { ok: true, state };
  } catch {
    return { ok: false, state: current };
  }
}
