export const MATH_WORLD_SAVE_KEY = "family-games/math-world/v1";

/** Historical IDs remain valid save data, independently of playable activities. */
export const RETIRED_MATH_WORLD_STATION_IDS = ["lab", "clock", "array"] as const;
export const MATH_WORLD_STATION_IDS = ["slider", "target"] as const;
export const KNOWN_MATH_WORLD_STATION_IDS = [...RETIRED_MATH_WORLD_STATION_IDS, ...MATH_WORLD_STATION_IDS] as const;
export type MathWorldStationId = (typeof MATH_WORLD_STATION_IDS)[number];
export type KnownMathWorldStationId = (typeof KNOWN_MATH_WORLD_STATION_IDS)[number];

export interface MathWorldSaveV1 {
  readonly version: 1;
  readonly lastStation: KnownMathWorldStationId | null;
  readonly visitedStations: readonly KnownMathWorldStationId[];
  readonly reducedMotionOverride?: boolean;
  readonly [field: string]: unknown;
}

export const EMPTY_MATH_WORLD_SAVE: MathWorldSaveV1 = {
  version: 1,
  lastStation: null,
  visitedStations: [],
};

function isKnownStation(id: unknown): id is KnownMathWorldStationId {
  return KNOWN_MATH_WORLD_STATION_IDS.some((known) => known === id);
}

function parseSave(raw: string): MathWorldSaveV1 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1
      || (value.lastStation !== null && !isKnownStation(value.lastStation))
      || !Array.isArray(value.visitedStations) || !value.visitedStations.every(isKnownStation)
      || (value.reducedMotionOverride !== undefined && typeof value.reducedMotionOverride !== "boolean")) return null;
    // Preserve extension fields, ordering and historical station visits.
    return value as unknown as MathWorldSaveV1;
  } catch {
    return null;
  }
}

export function readMathWorldSave(storage?: Storage): MathWorldSaveV1 {
  try {
    const raw = (storage ?? window.localStorage).getItem(MATH_WORLD_SAVE_KEY);
    return raw === null ? EMPTY_MATH_WORLD_SAVE : parseSave(raw) ?? EMPTY_MATH_WORLD_SAVE;
  } catch {
    return EMPTY_MATH_WORLD_SAVE;
  }
}

export function writeMathWorldSave(save: MathWorldSaveV1, storage?: Storage): boolean {
  try {
    const target = storage ?? window.localStorage;
    const raw = target.getItem(MATH_WORLD_SAVE_KEY);
    // Check at write time too: another tab or a restore may have changed it.
    const existing = raw === null ? null : parseSave(raw);
    if (raw !== null && !existing) return false;
    const next = { ...existing, ...save,
      visitedStations: existing
        ? [...existing.visitedStations, ...save.visitedStations.filter(id => !existing.visitedStations.includes(id))]
        : save.visitedStations,
    };
    if (!parseSave(JSON.stringify(next))) return false;
    if (existing && JSON.stringify(existing) === JSON.stringify(next)) return true;
    target.setItem(MATH_WORLD_SAVE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function visitMathWorldStation(save: MathWorldSaveV1, station: MathWorldStationId): MathWorldSaveV1 {
  return {
    ...save,
    lastStation: station,
    visitedStations: save.visitedStations.includes(station) ? save.visitedStations : [...save.visitedStations, station],
  };
}

/** Keep a mounted map from writing over another page or a Vault restore. */
export function createMathWorldSaveSession(storage?: Storage): {
  readonly save: MathWorldSaveV1;
  write: (next: MathWorldSaveV1) => boolean;
} {
  let target: Storage | undefined;
  let expectedRaw: string | null = null;
  let writable = false;
  let save = EMPTY_MATH_WORLD_SAVE;
  try {
    target = storage ?? window.localStorage;
    expectedRaw = target.getItem(MATH_WORLD_SAVE_KEY);
    const parsed = expectedRaw === null ? EMPTY_MATH_WORLD_SAVE : parseSave(expectedRaw);
    if (parsed) { save = parsed; writable = true; }
  } catch { /* Reading never changes any stored bytes. */ }
  return {
    get save() { return save; },
    write(next): boolean {
      if (!writable || !target) return false;
      try {
        if (target.getItem(MATH_WORLD_SAVE_KEY) !== expectedRaw) {
          writable = false;
          return false;
        }
        const raw = JSON.stringify(next);
        if (!parseSave(raw)) return false;
        if (raw !== expectedRaw) target.setItem(MATH_WORLD_SAVE_KEY, raw);
        expectedRaw = raw;
        save = next;
        return true;
      } catch {
        writable = false;
        return false;
      }
    },
  };
}
