import { describe, expect, it } from "vitest";
import { auditAllV1Hands } from "../../games/hanzi-radical-battle/v2/golden-slice/content/v1-hand-auditor";
import { APP_ROUTE_QUERY_REGISTRY, resolveAppRoute } from "../../src/app-route";
import {
  M1_ABILITIES,
  M1_BEHAVIORS,
  M1_REGIONS,
  M1_SESSION_KEY,
  abilityEffectChangedBy,
  buildM1EncounterPlan,
  createM1GameState,
  generateM1RunPlan,
  readM1Session,
  reduceM1State,
  replayM1Actions,
  simulateM1Run,
  writeM1Session,
  type M1Action,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi Magic Battle V2 Chapter One M1 replay loop", () => {
  it("defines exactly nine answer-safe abilities and six recoverable behavior prototypes", () => {
    expect(M1_ABILITIES).toHaveLength(9);
    expect(new Set(M1_ABILITIES.map((entry) => entry.id)).size).toBe(9);
    expect(M1_ABILITIES.every((entry) => entry.neverChangesAnswer && abilityEffectChangedBy(entry.id))).toBe(true);
    expect(M1_BEHAVIORS).toHaveLength(6);
    expect(new Set(M1_BEHAVIORS.map((entry) => entry.id)).size).toBe(6);
    for (const behavior of M1_BEHAVIORS) {
      expect(behavior.telegraph).toBeTruthy();
      expect(behavior.effect).toBeTruthy();
      expect(behavior.guaranteedRecovery).toBeTruthy();
      expect(behavior).toMatchObject({
        keyboardRecovery: true,
        touchRecovery: true,
        neverChangesAnswer: true,
        neverIntroducedFirstAtBoss: true,
      });
    }
  });

  it("registers the canonical chapter route without replacing the frozen V1 route", () => {
    expect(resolveAppRoute(new URLSearchParams("play=hanzi-v2-chapter-one&from=hub"))).toEqual({ kind: "play", explicit: true });
    expect(APP_ROUTE_QUERY_REGISTRY).toEqual(expect.arrayContaining([
      expect.objectContaining({ queryKey: "play", queryValue: "hanzi-v2-chapter-one", pageMode: "game-fullscreen" }),
      expect.objectContaining({ queryKey: "play", queryValue: "hanzi-v2-v1", pageMode: "game-fullscreen" }),
    ]));
  });

  it("builds three child-readable two-path regions and deals all nine abilities once", () => {
    const plan = generateM1RunPlan("m1-contract");
    expect(M1_REGIONS).toHaveLength(3);
    expect(plan.regions).toHaveLength(3);
    expect(plan.regions.flatMap((region) => region.abilityOffer)).toHaveLength(9);
    expect(new Set(plan.regions.flatMap((region) => region.abilityOffer)).size).toBe(9);
    for (const region of plan.regions) {
      expect(region.pathOptions).toHaveLength(2);
      for (const path of region.pathOptions) {
        const encounters = buildM1EncounterPlan(path);
        expect(encounters).toHaveLength(4);
        expect(new Set(encounters.map((entry) => entry.characterId)).size).toBe(4);
        expect(encounters[3].boss).toBe(true);
        expect(encounters.slice(0, 3).some((entry) => entry.behaviorId === encounters[3].behaviorId)).toBe(true);
      }
    }
  });

  it("keeps all twelve inherited five-card hands unique and legal", () => {
    const audits = auditAllV1Hands();
    expect(audits).toHaveLength(12);
    expect(audits.every((audit) => audit.passed)).toBe(true);
  });

  it("completes and exactly replays representative seeded runs", () => {
    for (const seed of ["m1-0", "m1-1", "m1-42", "黄小越-forest"] ) {
      const result = simulateM1Run(seed);
      expect(result.failureCodes).toEqual([]);
      expect(result.finalState.phase).toBe("run-summary");
      expect(result.finalState.discoveredCharacterIds).toHaveLength(12);
      expect(result.finalState.selectedAbilityIds).toHaveLength(3);
      expect(result.finalState.completedBehaviorCycles).toHaveLength(12);
      expect(replayM1Actions(seed, result.actions)).toEqual(result.finalState);
    }
  });

  it("varies routes, encounters and selected abilities across deterministic seeds", () => {
    const results = Array.from({ length: 256 }, (_, index) => simulateM1Run(`variation-${index}`));
    expect(new Set(results.map((result) => result.routeSignature)).size).toBeGreaterThan(4);
    expect(new Set(results.map((result) => result.abilitySignature)).size).toBeGreaterThan(20);
    expect(new Set(results.map((result) => result.encounterSignature)).size).toBeGreaterThan(20);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("makes every ability selectable and triggered across bounded coverage seeds", () => {
    const selected = new Set<string>();
    const behaviors = new Set<string>();
    for (let index = 0; index < 500; index += 1) {
      const state = simulateM1Run(`coverage-${index}`).finalState;
      state.triggeredAbilityIds.forEach((id) => selected.add(id));
      state.completedBehaviorCycles.forEach((id) => behaviors.add(id));
    }
    expect(selected).toEqual(new Set(M1_ABILITIES.map((ability) => ability.id)));
    expect(behaviors).toEqual(new Set(M1_BEHAVIORS.map((behavior) => behavior.id)));
  });

  it("rejects a wrong placement gently and remains recoverable", () => {
    let state = createM1GameState("recoverable");
    state = reduceM1State(state, { type: "start-run" });
    state = reduceM1State(state, { type: "choose-route", pathId: state.plan.regions[0].pathOptions[0].id });
    state = reduceM1State(state, { type: "begin-behavior" });
    state = reduceM1State(state, { type: "recover-behavior" });
    const distractor = state.hand.find((card) => card.kind === "distractor")!;
    const afterWrong = reduceM1State(state, { type: "place-card", cardId: distractor.id, slotId: "left" });
    expect(afterWrong.phase).toBe("encounter");
    expect(afterWrong.invalidPlacementCount).toBe(1);
    expect(afterWrong.gentleMessage).not.toMatch(/失败|做错|败北|练习/);
    const target = afterWrong.hand.find((card) => card.kind === "target")!;
    expect(reduceM1State(afterWrong, { type: "place-card", cardId: target.id, slotId: target.expectedSlotId! }).placements).toHaveLength(1);
  });

  it("stores only seed plus replay actions and fails closed on malformed session data", () => {
    const storage = new MemoryStorage();
    const simulation = simulateM1Run("resume-m1");
    const partial = simulation.actions.slice(0, 19) as M1Action[];
    writeM1Session(storage, "resume-m1", partial);
    const restored = readM1Session(storage);
    expect(restored?.state).toEqual(replayM1Actions("resume-m1", partial));
    expect(Object.keys(JSON.parse(storage.getItem(M1_SESSION_KEY)!)).sort()).toEqual(["actions", "schemaVersion", "seed"]);
    storage.setItem(M1_SESSION_KEY, JSON.stringify({ schemaVersion: 99, seed: "x", actions: [] }));
    expect(readM1Session(storage)).toBeNull();
    storage.setItem(M1_SESSION_KEY, "{broken");
    expect(readM1Session(storage)).toBeNull();
  });
});
