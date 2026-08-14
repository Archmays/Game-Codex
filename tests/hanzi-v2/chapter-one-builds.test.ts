import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_CHARACTERS,
  M3_BUILD_ABILITIES,
  M3_HEROES,
  M3_SESSION_KEY,
  abilityEffectChangedByM3,
  generateM3RunPlan,
  readM3Session,
  replayM3Actions,
  simulateM3Run,
  writeM3Session,
  type M3Action,
  type M3AbilityId,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi Magic Battle V2 Chapter One M3 heroes and builds", () => {
  it("defines three child-readable heroes with stable save and world identities", () => {
    expect(M3_HEROES).toHaveLength(3);
    expect(new Set(M3_HEROES.map((hero) => hero.id)).size).toBe(3);
    expect(new Set(M3_HEROES.map((hero) => hero.saveId)).size).toBe(3);
    expect(new Set(M3_HEROES.map((hero) => hero.iconKey)).size).toBe(3);
    expect(new Set(M3_HEROES.map((hero) => hero.worldMarkKey)).size).toBe(3);
    for (const hero of M3_HEROES) {
      expect(Array.from(hero.name).length).toBeGreaterThanOrEqual(2);
      expect(Array.from(hero.name).length).toBeLessThanOrEqual(6);
      expect(hero.innateName).toBeTruthy();
      expect(hero.innateDescription).toBeTruthy();
      expect(hero.exactRule).toBeTruthy();
      expect(hero.childValue).toBeTruthy();
      expect(hero.hanziLearningValue).toBeTruthy();
      expect(hero.neverChangesAnswer).toBe(true);
    }
  });

  it("defines exactly 18 distinct, answer-safe selectable abilities", () => {
    expect(M3_BUILD_ABILITIES).toHaveLength(18);
    for (const field of ["id", "saveId", "name", "iconKey", "effectKey", "exactRule", "visibleEffect"] as const) {
      expect(new Set(M3_BUILD_ABILITIES.map((ability) => ability[field])).size).toBe(18);
    }
    for (const ability of M3_BUILD_ABILITIES) {
      expect(Array.from(ability.name).length).toBeGreaterThanOrEqual(2);
      expect(Array.from(ability.name).length).toBeLessThanOrEqual(6);
      expect(ability.childDescription).toBeTruthy();
      expect(ability.trigger).toBeTruthy();
      expect(ability.neverAutoSolves && ability.neverChangesAnswer && ability.noProbability && ability.noRarity && ability.noPrice).toBe(true);
      expect(abilityEffectChangedByM3(ability.id)).toBe(true);
    }
    expect(JSON.stringify(M3_BUILD_ABILITIES)).not.toMatch(/推荐|最佳|史诗|稀有|价格|概率|胜率|攻击力/);
  });

  it("builds two safe four-encounter paths per region and only repeats learned boss behavior", () => {
    for (const hero of M3_HEROES) {
      const plan = generateM3RunPlan("m3-plan-contract", hero.id);
      expect(plan.regions).toHaveLength(3);
      expect(new Set(plan.regions.flatMap((region) => region.abilityOffer)).size).toBe(9);
      for (const region of plan.regions) {
        expect(region.pathOptions).toHaveLength(2);
        for (const path of region.pathOptions) {
          expect(path.encounters).toHaveLength(4);
          expect(new Set(path.encounters.map((entry) => entry.characterId)).size).toBe(4);
          expect(path.encounters.every((entry) => CHAPTER_ONE_CHARACTERS.find((character) => character.id === entry.characterId)?.regionId === region.regionId)).toBe(true);
          expect(path.encounters.map((entry) => entry.boss)).toEqual([false, false, true, true]);
          expect(path.encounters.map((entry) => entry.bossPhase)).toEqual([0, 0, 1, 2]);
          expect(path.encounters.slice(0, 2).map((entry) => entry.behaviorId)).toContain(path.encounters[2].behaviorId);
          expect(path.encounters.slice(0, 2).map((entry) => entry.behaviorId)).toContain(path.encounters[3].behaviorId);
          const openingParts = new Set(path.encounters.slice(0, 2).flatMap((entry) => CHAPTER_ONE_CHARACTERS.find((character) => character.id === entry.characterId)!.orderedComponents.map((component) => component.sourceGlyph)));
          expect(path.encounters[2].characterId).toBeTruthy();
          expect(CHAPTER_ONE_CHARACTERS.find((character) => character.id === path.encounters[2].characterId)!.orderedComponents.some((component) => openingParts.has(component.sourceGlyph))).toBe(true);
        }
      }
    }
  });

  it("completes and exactly replays all three hero strategies", () => {
    for (const hero of M3_HEROES) {
      const result = simulateM3Run(`m3-replay-${hero.id}`, hero.id);
      expect(result.failureCodes).toEqual([]);
      expect(result.finalState.phase).toBe("run-summary");
      expect(result.finalState.discoveredCharacterIds).toHaveLength(15);
      expect(result.finalState.selectedAbilityIds).toHaveLength(3);
      expect(result.finalState.triggeredAbilityIds).toHaveLength(3);
      expect(result.finalState.innateEvidence).toMatchObject({ stateChanged: true, visibleEffectObserved: true, neverAutoSolved: true, noIllegalAnswer: true });
      expect(result.actions.filter((action) => action.type === "place-card")).toHaveLength(30);
      expect(replayM3Actions(result.finalState.seed, hero.id, result.actions)).toEqual(result.finalState);
    }
  });

  it("covers all heroes, characters and 18 ability evidence paths across bounded seeds", () => {
    const characters = new Set<string>();
    const offered = new Set<M3AbilityId>();
    const selected = new Set<M3AbilityId>();
    const triggered = new Set<M3AbilityId>();
    for (const hero of M3_HEROES) {
      for (let index = 0; index < 1000; index += 1) {
        const result = simulateM3Run(`m3-coverage-${hero.id}-${index}`, hero.id);
        expect(result.passed).toBe(true);
        result.finalState.discoveredCharacterIds.forEach((id) => characters.add(id));
        result.finalState.abilityEvidence.forEach((entry) => {
          if (entry.offered) offered.add(entry.abilityId);
          if (entry.selected) selected.add(entry.abilityId);
          if (entry.triggered) triggered.add(entry.abilityId);
        });
      }
    }
    expect(characters).toEqual(new Set(CHAPTER_ONE_CHARACTERS.map((entry) => entry.id)));
    expect(offered).toEqual(new Set(M3_BUILD_ABILITIES.map((entry) => entry.id)));
    expect(selected).toEqual(new Set(M3_BUILD_ABILITIES.map((entry) => entry.id)));
    expect(triggered).toEqual(new Set(M3_BUILD_ABILITIES.map((entry) => entry.id)));
  });

  it("stores the initial hero plus replay actions and fails closed", () => {
    const storage = new MemoryStorage();
    const simulation = simulateM3Run("m3-session", "forest-speaker");
    const actions = simulation.actions.slice(0, 31) as M3Action[];
    writeM3Session(storage, "m3-session", "forest-speaker", actions);
    expect(readM3Session(storage)?.state).toEqual(replayM3Actions("m3-session", "forest-speaker", actions));
    expect(Object.keys(JSON.parse(storage.getItem(M3_SESSION_KEY)!)).sort()).toEqual(["actions", "initialHeroId", "mode", "schemaVersion", "seed"]);
    storage.setItem(M3_SESSION_KEY, JSON.stringify({ schemaVersion: 99, seed: "x", initialHeroId: "forest-speaker", actions: [] }));
    expect(readM3Session(storage)).toBeNull();
    storage.setItem(M3_SESSION_KEY, "{broken");
    expect(readM3Session(storage)).toBeNull();
  });
});
