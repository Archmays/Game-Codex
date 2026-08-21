export const MATH_WORLD_SAVE_KEY = "family-games/math-world/v1";

export const MATH_WORLD_STATION_IDS = ["lab", "clock", "array", "target", "slider"] as const;
export type MathWorldStationId = (typeof MATH_WORLD_STATION_IDS)[number];

export interface MathWorldSaveV1 {
  readonly version: 1;
  readonly lastStation: MathWorldStationId | null;
  readonly visitedStations: readonly MathWorldStationId[];
  readonly reducedMotionOverride?: boolean;
}

export const EMPTY_MATH_WORLD_SAVE: MathWorldSaveV1 = {
  version: 1,
  lastStation: null,
  visitedStations: [],
};

export function readMathWorldSave(storage: Storage = window.localStorage): MathWorldSaveV1 {
  try {
    const raw = storage.getItem(MATH_WORLD_SAVE_KEY);
    if (!raw) return EMPTY_MATH_WORLD_SAVE;
    const parsed = JSON.parse(raw) as Partial<MathWorldSaveV1>;
    if (parsed.version !== 1) return EMPTY_MATH_WORLD_SAVE;
    const visitedStations = MATH_WORLD_STATION_IDS.filter((id) => parsed.visitedStations?.includes(id));
    const lastStation = MATH_WORLD_STATION_IDS.find((id) => id === parsed.lastStation) ?? null;
    return {
      version: 1,
      lastStation,
      visitedStations,
      ...(typeof parsed.reducedMotionOverride === "boolean" ? { reducedMotionOverride: parsed.reducedMotionOverride } : {}),
    };
  } catch {
    return EMPTY_MATH_WORLD_SAVE;
  }
}

export function writeMathWorldSave(save: MathWorldSaveV1, storage: Storage = window.localStorage): boolean {
  try {
    storage.setItem(MATH_WORLD_SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function visitMathWorldStation(save: MathWorldSaveV1, station: MathWorldStationId): MathWorldSaveV1 {
  return {
    ...save,
    lastStation: station,
    visitedStations: MATH_WORLD_STATION_IDS.filter((id) => id === station || save.visitedStations.includes(id)),
  };
}
