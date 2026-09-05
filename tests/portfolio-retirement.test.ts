import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { normalizeRetiredMathRoute, resolveAppRoute } from "../src/app-route";
import { GAME_PORTFOLIO, WORLD_MODULES } from "../packages/data/gamePortfolio";
import { PLAY_SURFACE_MANIFEST } from "../packages/data/playSurfaceManifest";
import { EXPORTABLE_SAVE_KEYS } from "../packages/data/saveKeyInventory";
import { findMathWorldActivity } from "../games/math-lab/world/activity-registry";
import { EMPTY_MATH_WORLD_SAVE, MATH_WORLD_SAVE_KEY, readMathWorldSave, visitMathWorldStation, writeMathWorldSave } from "../games/math-lab/world/world-save";
import { createSaveVaultBackup, validateSaveVaultText, restoreSaveVault } from "../packages/save-vault";

class FixtureStorage implements Storage {
  readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): never { throw new Error("Global clear is forbidden"); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const retiredBytes = {
  "math-battle-web/save-v1": '{ "version":1, "currentStreak":3, "settings":{"largeText":true}, "extension":[1,2] }',
  "family-games/clock-reader/progress": '{"best":8,"streak":4,"extension":"synthetic"}',
  "family-games/multiplication-adventure/progress": '{"bestScore":9,"plays":12}',
};

describe("portfolio retirement step 1", () => {
  it.each(["lab", "clock", "array"])("normalizes %s without a station mount or a path change", station => {
    const url = new URL(`https://example.invalid/Game-Codex/?world=math-world&station=${station}&from=hub#map`);
    expect(normalizeRetiredMathRoute(url)).toBe(true);
    expect(url.pathname).toBe("/Game-Codex/");
    expect(url.hash).toBe("#map");
    expect(url.searchParams.get("station")).toBeNull();
    expect(url.searchParams.get("notice")).toBe("retired-game");
    expect(resolveAppRoute(url.searchParams)).toEqual({ kind: "world", explicit: true });
    expect(normalizeRetiredMathRoute(url)).toBe(false);
    expect(findMathWorldActivity(station)).toBeNull();
  });

  it.each([
    "world=math-world&station=slider", "world=math-world&station=target",
    "world=math-world&station=clockwise", "world=math-world&station=clock&station=target",
    "world=english-world&station=clock", "hub=classic", "world=my-game-world&station=lab",
    "play=hanzi-magic-complete&world=math-world&station=lab",
    "play=english-spell-battle-legacy&world=math-world&station=clock",
  ])("does not intercept the unrelated or nonexact route %s", query => {
    const url = new URL(`https://example.invalid/Game-Codex/?${query}`), before = url.href;
    expect(normalizeRetiredMathRoute(url)).toBe(false);
    expect(url.href).toBe(before);
  });

  it("retires production definitions, station surfaces and dedicated dependencies", () => {
    for (const id of ["clock-reader", "multiplication-adventure"]) expect(GAME_PORTFOLIO.map(record => record.id)).not.toContain(id);
    expect(WORLD_MODULES.filter(record => record.world === "math").map(record => record.id)).toEqual(["math-equation-slider", "math-make-target"]);
    expect(PLAY_SURFACE_MANIFEST.filter(record => record.kind === "station").map(record => record.id)).toEqual(["math-slider", "math-target"]);
    expect(GAME_PORTFOLIO.find(record => record.id === "math-lab")).toMatchObject({ worldModuleIds: [], saveNamespaces: [MATH_WORLD_SAVE_KEY] });
    for (const file of ["games/clock-reader/index.ts", "games/multiplication-adventure/index.ts", "src/game/config.ts", "src/game/scenes/BootScene.ts", "public/data/levels/add-sub-mvp.json", "public/assets/generated/math-lab-stage-garden.png"]) expect(existsSync(file), file).toBe(false);
    expect(readFileSync("games/math-lab/index.ts", "utf8")).toContain("mountMathWorld(container)");
    expect(readFileSync("games/math-lab/world/activity-registry.ts", "utf8")).not.toMatch(/import\("\.\.\/index"\)|clock-reader|multiplication-adventure/);
  });

  it("preserves historical visits, settings and extension fields when an active station is visited", () => {
    const storage = new FixtureStorage();
    const raw = '{ "version":1, "lastStation":"clock", "visitedStations":["array","clock","lab"], "reducedMotionOverride":true, "extension":{"value":7} }';
    storage.setItem(MATH_WORLD_SAVE_KEY, raw);
    const save = readMathWorldSave(storage);
    expect(storage.getItem(MATH_WORLD_SAVE_KEY)).toBe(raw);
    expect(save.lastStation).toBe("clock");
    expect(findMathWorldActivity(save.lastStation)).toBeNull();
    expect(writeMathWorldSave(visitMathWorldStation(save, "slider"), storage)).toBe(true);
    expect(readMathWorldSave(storage)).toEqual({ version: 1, lastStation: "slider", visitedStations: ["array", "clock", "lab", "slider"], reducedMotionOverride: true, extension: { value: 7 } });
  });

  it.each(["{broken", "null", "[]", "", '{"version":99,"lastStation":"future","unknown":[7]}', '{"version":1,"lastStation":"future","visitedStations":[]}', '{"version":1,"lastStation":null,"visitedStations":"clock"}'])("keeps unrecognized shell bytes read-only: %s", raw => {
    const storage = new FixtureStorage();
    storage.setItem(MATH_WORLD_SAVE_KEY, raw);
    const fallback = readMathWorldSave(storage);
    expect(fallback).toEqual(EMPTY_MATH_WORLD_SAVE);
    expect(writeMathWorldSave({ ...visitMathWorldStation(fallback, "target"), reducedMotionOverride: false }, storage)).toBe(false);
    expect(storage.getItem(MATH_WORLD_SAVE_KEY)).toBe(raw);
  });

  it("checks storage again before writing and survives blocked access or writes", () => {
    const storage = new FixtureStorage();
    const save = readMathWorldSave(storage);
    storage.setItem(MATH_WORLD_SAVE_KEY, '{"version":99}');
    expect(writeMathWorldSave(visitMathWorldStation(save, "slider"), storage)).toBe(false);
    expect(storage.getItem(MATH_WORLD_SAVE_KEY)).toBe('{"version":99}');
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } as unknown as Storage;
    expect(readMathWorldSave(blocked)).toEqual(EMPTY_MATH_WORLD_SAVE);
    expect(writeMathWorldSave(save, blocked)).toBe(false);
    const quota = { getItem() { return null; }, setItem() { throw new Error("quota"); } } as unknown as Storage;
    expect(writeMathWorldSave(save, quota)).toBe(false);
  });

  it("exports and restores all old exact keys with their raw bytes, independently of game registration", async () => {
    const source = new FixtureStorage(), destination = new FixtureStorage();
    for (const [key, value] of Object.entries(retiredBytes)) source.setItem(key, value);
    const shell = '{"version":1,"lastStation":"lab","visitedStations":["lab","clock","array"],"custom":{"kept":true}}';
    source.setItem(MATH_WORLD_SAVE_KEY, shell);
    source.setItem("synthetic/unrelated", "untouched");
    destination.setItem("synthetic/unrelated", "untouched");
    for (const key of Object.keys(retiredBytes)) expect(EXPORTABLE_SAVE_KEYS.map(record => record.key)).toContain(key);
    const backup = await createSaveVaultBackup(source);
    const validated = await validateSaveVaultText(JSON.stringify(backup));
    const result = restoreSaveVault(destination, validated);
    expect(result.readbackVerified).toBe(true);
    for (const [key, value] of Object.entries({ ...retiredBytes, [MATH_WORLD_SAVE_KEY]: shell })) expect(destination.getItem(key)).toBe(value);
    expect(destination.getItem("synthetic/unrelated")).toBe("untouched");
    expect(source.getItem("synthetic/unrelated")).toBe("untouched");
  });
});
