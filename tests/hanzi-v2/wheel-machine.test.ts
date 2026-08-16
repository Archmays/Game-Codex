import { describe, expect, it } from "vitest";
import { getPlayableWheelRecord, getWheelPool, PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_REVISION, WHEEL_GRADE_OPTIONS } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { candidateIsLegalDistractor, generateWheelRound } from "../../games/hanzi-radical-battle/v2/wheel-workshop/machine/wheel-round-generator";
import { createWheelWorkshopState, reduceWheelWorkshopState, replayWheelWorkshopActions, wheelStateIsPossible } from "../../games/hanzi-radical-battle/v2/wheel-workshop/machine/wheel-machine";
import {
  WHEEL_WORKSHOP_SAVE_KEY,
  clearWheelWorkshopSave,
  createFreshWheelWorkshopSave,
  readWheelWorkshopSave,
  validateWheelWorkshopSave,
  wheelSaveFromState,
  wheelStateFromSave,
  writeWheelWorkshopSave,
} from "../../games/hanzi-radical-battle/v2/wheel-workshop/save/wheel-save";
import type { WheelGradeSelection, WheelWorkshopAction, WheelWorkshopState } from "../../games/hanzi-radical-battle/v2/wheel-workshop/types";

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes.push(key); }
  removeItem(key: string) { this.values.delete(key); }
}

function solveRound(state: WheelWorkshopState): { readonly state: WheelWorkshopState; readonly actions: readonly WheelWorkshopAction[] } {
  const spin: WheelWorkshopAction = { type: "spin" };
  let next = reduceWheelWorkshopState(state, spin);
  const settle: WheelWorkshopAction = { type: "settle-spin" };
  next = reduceWheelWorkshopState(next, settle);
  const partner = next.currentRound!.candidateCards.find((card) => card.kind === "partner")!;
  const select: WheelWorkshopAction = { type: "select-card", cardId: partner.id };
  next = reduceWheelWorkshopState(next, select);
  const record = getPlayableWheelRecord(next.currentRound!.recordId);
  const place: WheelWorkshopAction = { type: "place-card", slotId: record.slotIds[1] };
  next = reduceWheelWorkshopState(next, place);
  const proceed: WheelWorkshopAction = { type: "continue" };
  next = reduceWheelWorkshopState(next, proceed);
  return { state: next, actions: [spin, settle, select, place, proceed] };
}

describe("Wheel Workshop deterministic machine", () => {
  it("generates one legal partner and three non-answer distractors with an exact landing endpoint", () => {
    for (const grade of WHEEL_GRADE_OPTIONS) {
      for (let index = 0; index < 100; index += 1) {
        const round = generateWheelRound({ seed: `round-${grade.id}-${index}`, gradeId: grade.id, completedRoundCount: index % 3, sessionRecordIds: [], recentRecordIds: [] })!;
        const record = getPlayableWheelRecord(round.recordId);
        expect(round.candidateCards).toHaveLength(4);
        expect(round.candidateCards.filter((card) => card.kind === "partner")).toHaveLength(1);
        expect(round.candidateCards.find((card) => card.kind === "partner")?.glyph).toBe(record.orderedComponents[1]);
        expect(new Set(round.candidateCards.map((card) => card.id)).size).toBe(4);
        for (const card of round.candidateCards) {
          expect(card.id).toMatch(/^wheel-card-\d-[a-z0-9]+$/);
          expect(card.id).not.toContain(record.id);
          expect(card.id).not.toMatch(/partner|distractor/);
        }
        expect(round.wheelRotationDegrees % 360).toBeCloseTo((360 - ((round.landingIndex * 360) / getWheelPool(grade.id).length)) % 360, 8);
        for (const card of round.candidateCards.filter((entry) => entry.kind === "distractor")) {
          expect(candidateIsLegalDistractor(record.orderedComponents[0], card.glyph, record.id)).toBe(true);
        }
      }
    }
  });

  it("is seed deterministic and animation preference cannot change the rule result", () => {
    const first = generateWheelRound({ seed: "same-seed", gradeId: "p4", completedRoundCount: 1, sessionRecordIds: [], recentRecordIds: [] });
    const second = generateWheelRound({ seed: "same-seed", gradeId: "p4", completedRoundCount: 1, sessionRecordIds: [], recentRecordIds: [] });
    expect(first).toEqual(second);
    let normal = createWheelWorkshopState("same-seed", { selectedGradeId: "p4" });
    let reduced = createWheelWorkshopState("same-seed", { selectedGradeId: "p4" });
    normal = reduceWheelWorkshopState(reduceWheelWorkshopState(normal, { type: "spin" }), { type: "settle-spin" });
    reduced = reduceWheelWorkshopState(reduceWheelWorkshopState(reduced, { type: "spin" }), { type: "settle-spin" });
    expect(normal.currentRound).toEqual(reduced.currentRound);
  });

  it("keeps wrong choices gentle and recoverable, supports undo, and never lets hints auto-complete", () => {
    let state = createWheelWorkshopState("gentle", { selectedGradeId: "p2" });
    state = reduceWheelWorkshopState(reduceWheelWorkshopState(state, { type: "spin" }), { type: "settle-spin" });
    const originalRound = state.currentRound!;
    const wrong = originalRound.candidateCards.find((card) => card.kind === "distractor")!;
    state = reduceWheelWorkshopState(state, { type: "select-card", cardId: wrong.id });
    expect(state.phase).toBe("choose-card");
    expect(state.gentleMessage).not.toMatch(/失败|太差|又错|扣|惩罚/);
    expect(state.currentRound?.recordId).toBe(originalRound.recordId);
    for (let level = 1; level <= 4; level += 1) {
      state = reduceWheelWorkshopState(state, { type: "request-hint" });
      expect(state.hintLevel).toBe(level);
      expect(state.phase).toBe("choose-card");
      expect(state.currentRound?.placed).toBe(false);
    }
    expect(state.currentRound?.candidateCards.filter((card) => card.removedByHint)).toHaveLength(1);
    const partner = state.currentRound!.candidateCards.find((card) => card.kind === "partner")!;
    state = reduceWheelWorkshopState(state, { type: "select-card", cardId: partner.id });
    expect(state.phase).toBe("place-card");
    state = reduceWheelWorkshopState(state, { type: "undo" });
    expect(state).toMatchObject({ phase: "choose-card", hintLevel: 4 });
  });

  it("completes a replayable three-character session and saves discoveries immediately", () => {
    let state = createWheelWorkshopState("three-rounds", { selectedGradeId: "j3" });
    const actions: WheelWorkshopAction[] = [];
    for (let round = 0; round < 3; round += 1) {
      const solved = solveRound(state);
      state = solved.state;
      actions.push(...solved.actions);
      expect(wheelStateIsPossible(state)).toBe(true);
    }
    expect(state).toMatchObject({ phase: "finished", completedRoundCount: 3 });
    expect(state.sessionRecordIds).toHaveLength(3);
    expect(new Set(state.sessionRecordIds).size).toBe(3);
    expect(state.discoveredRecordIds).toHaveLength(3);
    expect(replayWheelWorkshopActions("three-rounds", "j3", actions)).toEqual(state);
  });

  it("cycles safely after a pool is exhausted and returns a friendly empty result for an unavailable pool", () => {
    const p1 = getWheelPool("p1");
    expect(p1).toHaveLength(4);
    expect(generateWheelRound({ seed: "cycle", gradeId: "p1", completedRoundCount: 9, sessionRecordIds: p1.map((record) => record.id), recentRecordIds: p1.map((record) => record.id) })).not.toBeNull();
    expect(generateWheelRound({ seed: "empty", gradeId: "missing" as WheelGradeSelection, completedRoundCount: 0, sessionRecordIds: [], recentRecordIds: [] })).toBeNull();
  });

  it("closes, finishes early, reopens, and starts a fresh session without an impossible intermediate state", () => {
    let state = createWheelWorkshopState("lifecycle", { selectedGradeId: "p6" });
    state = reduceWheelWorkshopState(state, { type: "spin" });
    state = reduceWheelWorkshopState(state, { type: "close" });
    expect(state).toMatchObject({ phase: "closed", currentRound: null, hintLevel: 0 });
    expect(wheelStateIsPossible(state)).toBe(true);
    state = reduceWheelWorkshopState(state, { type: "open" });
    state = reduceWheelWorkshopState(state, { type: "spin" });
    state = reduceWheelWorkshopState(state, { type: "finish-session" });
    expect(state).toMatchObject({ phase: "finished", currentRound: null });
    expect(wheelStateIsPossible(state)).toBe(true);
    state = reduceWheelWorkshopState(state, { type: "start-round" });
    expect(state).toMatchObject({ phase: "ready", completedRoundCount: 0, sessionRecordIds: [] });
  });

  it("recovers corrupt saves, protects newer saves, migrates content revisions, and stores only minimal fields", () => {
    const storage = new MemoryStorage();
    storage.values.set(WHEEL_WORKSHOP_SAVE_KEY, "{broken");
    expect(readWheelWorkshopSave(storage)).toMatchObject({ source: "recovered-corrupt", recovered: true, writable: true });
    storage.values.set(WHEEL_WORKSHOP_SAVE_KEY, JSON.stringify({ schemaVersion: 99, keep: "future" }));
    const future = readWheelWorkshopSave(storage);
    expect(future).toMatchObject({ source: "future-read-only", writable: false, futureVersionProtected: true });
    expect(() => writeWheelWorkshopSave(storage, future.state, future.writable)).toThrow("FUTURE_WHEEL_SAVE_IS_READ_ONLY");
    expect(storage.getItem(WHEEL_WORKSHOP_SAVE_KEY)).toContain('"keep":"future"');

    const old = { ...createFreshWheelWorkshopSave(), discoveredRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id], contentRevision: "old-revision" };
    storage.values.set(WHEEL_WORKSHOP_SAVE_KEY, JSON.stringify(old));
    expect(readWheelWorkshopSave(storage)).toMatchObject({ source: "migrated-content", state: { contentRevision: PLAYABLE_WHEEL_MANIFEST_REVISION, discoveredRecordIds: [PLAYABLE_WHEEL_MANIFEST[0].id] } });

    let state = createWheelWorkshopState("resume-safe", { selectedGradeId: "p5" });
    state = reduceWheelWorkshopState(state, { type: "spin" });
    const save = wheelSaveFromState(state);
    expect(Object.keys(save).sort()).toEqual(["contentRevision", "discoveredRecordIds", "lastSafeState", "recentRecordIds", "schemaVersion", "selectedGradeId"]);
    expect(JSON.stringify(save)).not.toMatch(/name|age|school|keypress|score|streak|rank|accuracy|errorCount/i);
    expect(validateWheelWorkshopSave(save)).toEqual(save);
    writeWheelWorkshopSave(storage, save);
    expect(wheelStateFromSave(readWheelWorkshopSave(storage).state, "fallback")).toMatchObject({ seed: "resume-safe", selectedGradeId: "p5", phase: "ready" });
    clearWheelWorkshopSave(storage);
    expect(storage.getItem(WHEEL_WORKSHOP_SAVE_KEY)).toBeNull();
  });

  it("binds the fixed 可汗 reading to its explicit context", () => {
    const record = PLAYABLE_WHEEL_MANIFEST.find((entry) => entry.glyph === "汗")!;
    expect(record).toMatchObject({ pinyin: "hán", familiarWord: "可汗", spokenPhrase: "可汗" });
    expect(record.shortMeaning).toContain("hán");
  });
});
