import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_CHARACTERS,
  M3_BUILD_ABILITIES,
  M3_HEROES,
  M4_REPAIR_IDS,
  M5_BEHAVIORS,
  M5_BOSSES,
  M5_REGION_META,
  M5_RUNTIME_ASSETS,
  m5AssetUrl,
  generateM3RunPlan,
  replayM3Actions,
  simulateM3Run,
} from "../games/hanzi-radical-battle/v2/chapter-one";

describe("Hanzi Magic Battle V2 Chapter One M5 release contract", () => {
  it("defines exactly nine recoverable regional behaviors", () => {
    expect(M5_BEHAVIORS).toHaveLength(9);
    expect(new Set(M5_BEHAVIORS.map((entry) => entry.id)).size).toBe(9);
    for (const regionId of ["glimmer-grove", "echo-garden", "wind-trail"] as const) {
      expect(M5_BEHAVIORS.filter((entry) => entry.regionId === regionId).map((entry) => entry.id)).toEqual([...M5_REGION_META[regionId].behaviorIds]);
    }
    for (const behavior of M5_BEHAVIORS) {
      expect(behavior.telegraph.length).toBeGreaterThan(8);
      expect(behavior.effect.length).toBeGreaterThan(8);
      expect(behavior.guaranteedRecovery.length).toBeGreaterThan(8);
      expect(behavior).toMatchObject({ keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverHidesPlacedComponents: true, neverIntroducedFirstAtBoss: true });
    }
  });

  it("defines three two-phase region bosses and one safe three-phase final boss", () => {
    expect(M5_BOSSES).toHaveLength(4);
    expect(M5_BOSSES.map((boss) => boss.phaseCount)).toEqual([2, 2, 2, 3]);
    for (const boss of M5_BOSSES) expect(boss).toMatchObject({ neverIntroducesUnseenBehavior: true, noPermanentLoss: true, nonFrightening: true });
  });

  it("builds formal regions, branch-safe boss repetition, and a constrained final core", () => {
    for (const hero of M3_HEROES) {
      for (const mode of ["story", "free"] as const) {
        const plan = generateM3RunPlan("m5-plan-contract", hero.id, mode);
        expect(plan.schemaVersion).toBe(3);
        expect(plan.mode).toBe(mode);
        expect(plan.regions).toHaveLength(3);
        expect(plan.finalCore.encounters.map((entry) => entry.finalChallenge)).toEqual(["structure-review", "behavior-combination", "meaning-restoration"]);
        expect(plan.finalCore.encounters.map((entry) => entry.bossPhase)).toEqual([1, 2, 3]);
        for (const region of plan.regions) {
          expect(region.pathOptions).toHaveLength(2);
          expect(region.abilityOffer).toHaveLength(3);
          for (const path of region.pathOptions) {
            expect(path.encounters.map((entry) => entry.boss)).toEqual([false, false, true, true]);
            const seen = new Set(path.encounters.slice(0, 2).map((entry) => entry.behaviorId));
            expect(path.encounters.slice(2).every((entry) => entry.combinedBehaviorIds.every((id) => seen.has(id)))).toBe(true);
            expect(new Set(path.encounters.slice(2).map((entry) => CHAPTER_ONE_CHARACTERS.find((character) => character.id === entry.characterId)!.structure)).size).toBe(2);
          }
        }
        const seenOnEveryBranch = new Set<(typeof M5_BEHAVIORS)[number]["id"]>(plan.regions.map((region) => M5_REGION_META[region.regionId].behaviorIds[1]));
        expect(plan.finalCore.encounters.flatMap((entry) => entry.combinedBehaviorIds).every((id) => seenOnEveryBranch.has(id))).toBe(true);
      }
    }
  });

  it("completes story and free adventure with exact replay and no score systems", () => {
    for (const hero of M3_HEROES) {
      for (const mode of ["story", "free"] as const) {
        const result = simulateM3Run(`m5-${mode}-${hero.id}`, hero.id, mode);
        expect(result.passed, result.failureCodes.join(",")).toBe(true);
        expect(result.finalState).toMatchObject({ phase: "run-summary", chapterStage: "complete", mode });
        expect(result.finalState.discoveredCharacterIds).toHaveLength(15);
        expect(result.finalState.selectedAbilityIds).toHaveLength(3);
        expect(result.finalState.completedBossIds).toHaveLength(4);
        expect(replayM3Actions(result.finalState.seed, hero.id, result.actions, mode)).toEqual(result.finalState);
        expect(JSON.stringify(result.finalState)).not.toMatch(/score|streak|leaderboard|rank|loot|currency/i);
      }
    }
  });

  it("ships a complete optimized Theme C runtime manifest", () => {
    expect(M5_RUNTIME_ASSETS).toHaveLength(72);
    expect(new Set(M5_RUNTIME_ASSETS.map((entry) => entry.key)).size).toBe(72);
    const assetDir = resolve("public/assets/hanzi-radical-battle/v2/theme-c/chapter-one");
    const files = readdirSync(assetDir).filter((name) => name.endsWith(".webp"));
    expect(files).toHaveLength(72);
    expect(M5_RUNTIME_ASSETS.every((entry) => existsSync(resolve(assetDir, entry.fileName)))).toBe(true);
    expect(files.every((name) => statSync(resolve(assetDir, name)).size < 3_000_000)).toBe(true);
    expect(files.reduce((sum, name) => sum + statSync(resolve(assetDir, name)).size, 0)).toBeLessThan(15_000_000);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "hero")).toHaveLength(3);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "monster")).toHaveLength(9);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "boss")).toHaveLength(4);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "meaning")).toHaveLength(24);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "ability")).toHaveLength(M3_BUILD_ABILITIES.length);
    expect(M5_RUNTIME_ASSETS.filter((entry) => entry.role === "repair")).toHaveLength(M4_REPAIR_IDS.length);
    expect(m5AssetUrl("region-ink-king-core")).toMatch(/^\.?\/assets\/hanzi-radical-battle\/v2\/theme-c\/chapter-one\/region-ink-king-core\.webp$/);
    expect(m5AssetUrl("region-ink-king-core")).not.toContain("/assets/assets/");
  });
});
