import {
  prepareStep07FixtureProgress,
  isStep07RuntimeLaunchGrant,
  recoverStep07ObserverSession,
  startStep07AuthorizedSession,
  verifyStep07RuntimeLaunch,
  STEP07_OBSERVER_SESSION_QUERY,
} from "../apps/hanzi-v2-step07-observer/session-controller";
import { STEP07_EVIDENCE_ID } from "../apps/my-game-world/second-use/event-types";
import {
  createStep06SyntheticCompleteSave,
  STEP06_CANONICAL_ORIGIN,
} from "../apps/my-game-world/second-use/progress-continuity";
import {
  finishStep07Session,
  readStep07Grant,
  stopStep07Session,
  validateStep07InstrumentedRoute,
} from "../apps/my-game-world/second-use/step07-session";
import { GOLDEN_SLICE_SAVE_KEY } from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const VERDICT_SHA256 = "b".repeat(64);

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function completeStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(createStep06SyntheticCompleteSave()));
  return storage;
}

function start(storage: MemoryStorage, fixture: boolean) {
  return startStep07AuthorizedSession({
    storage,
    origin: STEP06_CANONICAL_ORIGIN,
    buildCommit: COMMIT,
    intervalBucket: "ONE_TO_THREE_DAYS",
    soundMode: "START_MUTED",
    fixture,
    privacyReady: true,
    runtimeLaunchReady: true,
    machineVerdictSha256: fixture ? null : VERDICT_SHA256,
  });
}

describe("Hanzi V2 STEP 07 final progress and evidence gate", () => {
  it("injects synthetic progress only into empty fixture storage and never overwrites an existing value", () => {
    const empty = new MemoryStorage();
    expect(prepareStep07FixtureProgress(empty)).toBe(true);
    expect(JSON.parse(empty.getItem(GOLDEN_SLICE_SAVE_KEY)!)).toMatchObject({ completedRuns: 1 });

    const family = completeStorage();
    const before = family.getItem(GOLDEN_SLICE_SAVE_KEY);
    expect(prepareStep07FixtureProgress(family)).toBe(false);
    expect(family.getItem(GOLDEN_SLICE_SAVE_KEY)).toBe(before);

    const corrupt = new MemoryStorage();
    corrupt.setItem(GOLDEN_SLICE_SAVE_KEY, "{broken");
    expect(prepareStep07FixtureProgress(corrupt)).toBe(false);
    expect(corrupt.getItem(GOLDEN_SLICE_SAVE_KEY)).toBe("{broken");
  });

  it("fails closed for missing, incomplete, or wrong-origin progress", () => {
    expect(() => start(new MemoryStorage(), false)).toThrow("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");

    const incomplete = completeStorage();
    const state = JSON.parse(incomplete.getItem(GOLDEN_SLICE_SAVE_KEY)!);
    state.completedRuns = 0;
    incomplete.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(state));
    expect(() => start(incomplete, false)).toThrow("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");

    expect(() => startStep07AuthorizedSession({
      storage: completeStorage(),
      origin: "http://localhost:5175",
      buildCommit: COMMIT,
      intervalBucket: "ONE_TO_THREE_DAYS",
      soundMode: "START_MUTED",
      fixture: false,
      privacyReady: true,
      runtimeLaunchReady: true,
      machineVerdictSha256: VERDICT_SHA256,
    })).toThrow("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");
  });

  it("requires a short-lived PASS_MACHINE launch grant bound to the final build and nonce", async () => {
    const nowMs = Date.parse("2026-08-10T06:00:00.000Z");
    const nonce = "a".repeat(32);
    const verdictSha256 = "b".repeat(64);
    const runtimeGrant = {
      schemaVersion: 1,
      step: "07",
      verdict: "PASS_MACHINE",
      buildCommit: COMMIT,
      verdictSha256,
      launchNonce: nonce,
      generatedAtUtc: new Date(nowMs).toISOString(),
      expiresAtUtc: new Date(nowMs + 30 * 60 * 1000).toISOString(),
    } as const;
    expect(isStep07RuntimeLaunchGrant(runtimeGrant, COMMIT, nonce, verdictSha256, nowMs)).toBe(true);
    expect(isStep07RuntimeLaunchGrant(runtimeGrant, "f".repeat(40), nonce, verdictSha256, nowMs)).toBe(false);
    expect(isStep07RuntimeLaunchGrant(runtimeGrant, COMMIT, "c".repeat(32), verdictSha256, nowMs)).toBe(false);
    expect(isStep07RuntimeLaunchGrant(runtimeGrant, COMMIT, nonce, "c".repeat(64), nowMs)).toBe(false);
    expect(await verifyStep07RuntimeLaunch(
      new URLSearchParams({ launch: nonce, verdict: verdictSha256 }),
      COMMIT,
      async () => runtimeGrant,
      nowMs,
    )).toBe(true);
    expect(await verifyStep07RuntimeLaunch(
      new URLSearchParams({ launch: nonce, verdict: verdictSha256 }),
      COMMIT,
      async () => ({ ...runtimeGrant, verdict: "AUTO_REVISE" }),
      nowMs,
    )).toBe(false);
    expect(await verifyStep07RuntimeLaunch(
      new URLSearchParams({ launch: nonce, verdict: "c".repeat(64) }),
      COMMIT,
      async () => runtimeGrant,
      nowMs,
    )).toBe(false);

    expect(() => startStep07AuthorizedSession({
      storage: completeStorage(),
      origin: STEP06_CANONICAL_ORIGIN,
      buildCommit: COMMIT,
      intervalBucket: "ONE_TO_THREE_DAYS",
      soundMode: "START_MUTED",
      fixture: false,
      privacyReady: true,
      runtimeLaunchReady: false,
      machineVerdictSha256: null,
    })).toThrow("STEP07_MACHINE_VERDICT_GRANT_REQUIRED");
  });

  it("labels real and fixture grants distinctly and never infers STEP 07 from session alone", () => {
    const realStorage = completeStorage();
    const real = start(realStorage, false);
    expect(real.evidenceKind).toBe("REAL_CHILD_SECOND_USE");
    expect(real.technicalState).toBe("MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY");
    expect(real.machineVerdictSha256).toBe(VERDICT_SHA256);

    const fixtureStorage = new MemoryStorage();
    expect(prepareStep07FixtureProgress(fixtureStorage)).toBe(true);
    const fixture = start(fixtureStorage, true);
    expect(fixture.evidenceKind).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(fixture.technicalState).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(fixture.machineVerdictSha256).toBeNull();

    expect(validateStep07InstrumentedRoute(
      new URLSearchParams({ session: real.sessionId }),
      STEP06_CANONICAL_ORIGIN,
      realStorage,
    )).toEqual({ ok: false, reason: "INVALID_ROUTE" });
    expect(validateStep07InstrumentedRoute(
      new URLSearchParams({ evidence: "hanzi-v2-step06", session: real.sessionId }),
      STEP06_CANONICAL_ORIGIN,
      realStorage,
    )).toEqual({ ok: false, reason: "INVALID_ROUTE" });
  });

  it("recovers only the exact live persisted grant through the observer-only session query", () => {
    const storage = completeStorage();
    const grant = start(storage, false);
    const observerSearch = new URLSearchParams({ observe: "hanzi-v2-step07", build: COMMIT });
    observerSearch.set(STEP07_OBSERVER_SESSION_QUERY, grant.sessionId);

    expect(observerSearch.has("evidence")).toBe(false);
    expect(observerSearch.has("session")).toBe(false);
    expect(recoverStep07ObserverSession({
      search: observerSearch,
      storage,
      origin: STEP06_CANONICAL_ORIGIN,
      fixture: false,
    })).toEqual({ status: "RECOVERED", grant });

    const duplicate = new URLSearchParams(observerSearch);
    duplicate.append(STEP07_OBSERVER_SESSION_QUERY, grant.sessionId);
    expect(recoverStep07ObserverSession({ search: duplicate, storage, origin: STEP06_CANONICAL_ORIGIN, fixture: false }))
      .toEqual({ status: "DENIED", reason: "DUPLICATE_OBSERVER_SESSION" });

    const wrongBuild = new URLSearchParams(observerSearch);
    wrongBuild.set("build", "f".repeat(40));
    expect(recoverStep07ObserverSession({ search: wrongBuild, storage, origin: STEP06_CANONICAL_ORIGIN, fixture: false }))
      .toEqual({ status: "DENIED", reason: "BUILD_IDENTITY_MISMATCH" });

    expect(recoverStep07ObserverSession({ search: observerSearch, storage, origin: STEP06_CANONICAL_ORIGIN, fixture: true }))
      .toEqual({ status: "DENIED", reason: "EVIDENCE_KIND_MISMATCH" });
    expect(recoverStep07ObserverSession({
      search: observerSearch,
      storage,
      origin: STEP06_CANONICAL_ORIGIN,
      fixture: false,
      nowMs: grant.expiresAtMs + 1,
    })).toEqual({ status: "DENIED", reason: "GRANT_EXPIRED" });
  });

  it("fails observer recovery closed when progress or persisted lifecycle state changes", () => {
    const changedProgress = completeStorage();
    const changedGrant = start(changedProgress, false);
    const changedSearch = new URLSearchParams({
      build: COMMIT,
      [STEP07_OBSERVER_SESSION_QUERY]: changedGrant.sessionId,
    });
    changedProgress.removeItem(GOLDEN_SLICE_SAVE_KEY);
    expect(recoverStep07ObserverSession({ search: changedSearch, storage: changedProgress, origin: STEP06_CANONICAL_ORIGIN, fixture: false }))
      .toEqual({ status: "DENIED", reason: "PROGRESS_CONTINUITY" });

    const stoppedStorage = completeStorage();
    const stoppedGrant = start(stoppedStorage, false);
    const stoppedSearch = new URLSearchParams({
      build: COMMIT,
      [STEP07_OBSERVER_SESSION_QUERY]: stoppedGrant.sessionId,
    });
    stopStep07Session(stoppedStorage, stoppedGrant.sessionId, "NATURAL_END");
    expect(recoverStep07ObserverSession({ search: stoppedSearch, storage: stoppedStorage, origin: STEP06_CANONICAL_ORIGIN, fixture: false }))
      .toEqual({ status: "DENIED", reason: "GRANT_STOPPED" });
    finishStep07Session(stoppedStorage, stoppedGrant.sessionId);
    expect(readStep07Grant(stoppedStorage, stoppedGrant.sessionId)?.status).toBe("FINISHED");
    stopStep07Session(stoppedStorage, stoppedGrant.sessionId, "TECHNICAL");
    expect(readStep07Grant(stoppedStorage, stoppedGrant.sessionId)).toMatchObject({ status: "FINISHED", stopCode: "NATURAL_END" });
  });

  it("authorizes only an exact live grant with unchanged progress and then closes it", () => {
    const storage = completeStorage();
    const grant = start(storage, false);
    const route = new URLSearchParams({ evidence: STEP07_EVIDENCE_ID, session: grant.sessionId });

    expect(validateStep07InstrumentedRoute(route, STEP06_CANONICAL_ORIGIN, storage)).toMatchObject({
      ok: true,
      grant: { sessionId: grant.sessionId, buildCommit: COMMIT },
    });

    const state = JSON.parse(storage.getItem(GOLDEN_SLICE_SAVE_KEY)!);
    state.spellbookEntries = state.spellbookEntries.filter((id: string) => id !== "xing");
    storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(state));
    expect(validateStep07InstrumentedRoute(route, STEP06_CANONICAL_ORIGIN, storage)).toEqual({
      ok: false,
      reason: "PROGRESS_CONTINUITY",
    });

    storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(createStep06SyntheticCompleteSave()));
    stopStep07Session(storage, grant.sessionId, "NATURAL_END");
    finishStep07Session(storage, grant.sessionId);
    expect(validateStep07InstrumentedRoute(route, STEP06_CANONICAL_ORIGIN, storage)).toEqual({
      ok: false,
      reason: "GRANT_STOPPED",
    });
  });
});
