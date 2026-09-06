import { describe, expect, it } from "vitest";
import { APP_ROUTE_QUERY_REGISTRY, resolveAppRoute } from "../src/app-route";
import { MATH_WORLD_ACTIVITIES } from "../games/math-lab/world/activity-registry";
import {
  EMPTY_MATH_WORLD_SAVE,
  MATH_WORLD_SAVE_KEY,
  readMathWorldSave,
  visitMathWorldStation,
  writeMathWorldSave,
  createMathWorldSaveSession,
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
  it("registers only Slider then Target as lazy activities", () => {
    expect(APP_ROUTE_QUERY_REGISTRY).toContainEqual(expect.objectContaining({ query: "?world=math-world" }));
    expect(resolveAppRoute(new URLSearchParams("world=math-world"))).toEqual({ kind: "world", explicit: true });
    expect(MATH_WORLD_ACTIVITIES.map((activity) => activity.id)).toEqual(["slider", "target"]);
    expect(new Set(MATH_WORLD_ACTIVITIES.map((activity) => activity.load)).size).toBe(2);
  });

  it("stores only shell navigation and motion preference under the versioned key", () => {
    const storage = new MemoryStorage();
    const visited = visitMathWorldStation(EMPTY_MATH_WORLD_SAVE, "slider");
    expect(writeMathWorldSave({ ...visited, reducedMotionOverride: true }, storage)).toBe(true);
    expect([...Array(storage.length)].map((_, index) => storage.key(index))).toEqual([MATH_WORLD_SAVE_KEY]);
    expect(JSON.parse(storage.getItem(MATH_WORLD_SAVE_KEY)!)).toEqual({
      version: 1,
      lastStation: "slider",
      visitedStations: ["slider"],
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
    const original = storage.getItem(MATH_WORLD_SAVE_KEY);
    expect(readMathWorldSave(storage)).toEqual(EMPTY_MATH_WORLD_SAVE);
    expect(writeMathWorldSave(visitMathWorldStation(EMPTY_MATH_WORLD_SAVE, "slider"), storage)).toBe(false);
    expect(storage.getItem(MATH_WORLD_SAVE_KEY)).toBe(original);
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

  it("does not let a mounted map overwrite a different valid Vault generation", () => {
    const storage = new MemoryStorage();
    storage.setItem(MATH_WORLD_SAVE_KEY, '{"version":1,"lastStation":"clock","visitedStations":["clock"],"extension":{"old":true}}');
    const session = createMathWorldSaveSession(storage);
    const restored = '{"version":1,"lastStation":"target","visitedStations":["lab","target"],"extension":{"restored":true}}';
    storage.setItem(MATH_WORLD_SAVE_KEY, restored);
    expect(session.write(visitMathWorldStation(session.save, "slider"))).toBe(false);
    expect(storage.getItem(MATH_WORLD_SAVE_KEY)).toBe(restored);
  });

  it("keeps a failed map read permanently read-only in that mount", () => {
    let denied = true;
    let value: string | null = null;
    const storage = {
      getItem() { if (denied) throw new Error("denied"); return value; },
      setItem(_key: string, raw: string) { value = raw; },
    } as unknown as Storage;
    const session = createMathWorldSaveSession(storage);
    denied = false;
    expect(session.write(visitMathWorldStation(session.save, "target"))).toBe(false);
    expect(value).toBeNull();
  });
});
