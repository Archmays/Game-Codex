import { describe, expect, it } from "vitest";
import { APP_ROUTE_QUERY_REGISTRY, resolveAppRoute } from "../src/app-route";
import { MATH_WORLD_ACTIVITIES } from "../games/math-lab/world/activity-registry";
import {
  EMPTY_MATH_WORLD_SAVE,
  MATH_WORLD_SAVE_KEY,
  readMathWorldSave,
  visitMathWorldStation,
  writeMathWorldSave,
} from "../games/math-lab/world/world-save";
import { MY_GAME_WORLD_SETTINGS_KEY, readWorldHomeState, updateWorldSettings } from "../apps/my-game-world/world-state";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("Math World shell", () => {
  it("registers the direct-refresh world route and five lazy activities", () => {
    expect(APP_ROUTE_QUERY_REGISTRY).toContainEqual(expect.objectContaining({ query: "?world=math-world" }));
    expect(resolveAppRoute(new URLSearchParams("world=math-world"))).toEqual({ kind: "world", explicit: true });
    expect(MATH_WORLD_ACTIVITIES.map((activity) => activity.id)).toEqual(["lab", "clock", "array", "target", "slider"]);
    expect(new Set(MATH_WORLD_ACTIVITIES.map((activity) => activity.load)).size).toBe(5);
  });

  it("stores only shell navigation and motion preference under the versioned key", () => {
    const storage = new MemoryStorage();
    const visited = visitMathWorldStation(EMPTY_MATH_WORLD_SAVE, "clock");
    expect(writeMathWorldSave({ ...visited, reducedMotionOverride: true }, storage)).toBe(true);
    expect([...Array(storage.length)].map((_, index) => storage.key(index))).toEqual([MATH_WORLD_SAVE_KEY]);
    expect(JSON.parse(storage.getItem(MATH_WORLD_SAVE_KEY)!)).toEqual({
      version: 1,
      lastStation: "clock",
      visitedStations: ["clock"],
      reducedMotionOverride: true,
    });
  });

  it("validates malformed or future save bytes without touching station saves", () => {
    const storage = new MemoryStorage();
    storage.setItem(MATH_WORLD_SAVE_KEY, JSON.stringify({
      version: 1,
      lastStation: "unknown",
      visitedStations: ["lab", "unknown", "clock"],
      reducedMotionOverride: "yes",
      moduleProgress: { forbidden: true },
    }));
    expect(readMathWorldSave(storage)).toEqual({
      version: 1,
      lastStation: null,
      visitedStations: ["lab", "clock"],
    });
    storage.setItem(MATH_WORLD_SAVE_KEY, "{broken");
    expect(readMathWorldSave(storage)).toEqual(EMPTY_MATH_WORLD_SAVE);
  });

  it("keeps top-world settings separate from every Hanzi save namespace", () => {
    const storage = new MemoryStorage();
    const hanziKey = "family-games/hanzi-magic-complete/v3";
    const hanziBytes = '{"schemaVersion":3,"private":"unchanged"}';
    storage.setItem(hanziKey, hanziBytes);
    const result = updateWorldSettings(storage, readWorldHomeState(storage), { muted: true, reducedMotion: true });
    expect(result.ok).toBe(true);
    expect(storage.getItem(hanziKey)).toBe(hanziBytes);
    expect(JSON.parse(storage.getItem(MY_GAME_WORLD_SETTINGS_KEY)!)).toEqual({
      version: 1,
      settings: { muted: true, reducedMotion: true },
    });
  });
});
