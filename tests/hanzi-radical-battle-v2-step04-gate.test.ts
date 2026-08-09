import {
  FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256,
  FIRST_USE_PARENT_FEEDBACK_SHA256,
  authorizeFixtureFirstUseSession,
  authorizeFirstUseSession,
  buildChildFirstUseRoute,
  cancelFirstUseSession,
  firstUseSessionStartsMuted,
  prepareFirstUseSession,
  validateChildFirstUseSessionRoute,
  type FirstUseStorage,
} from "../games/hanzi-radical-battle/v2/golden-slice/first-use/session";
import { parseParentLaunchContext } from "../apps/hanzi-v2-step04-observer/session-controller";

class MemoryStorage implements FirstUseStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const fixtureIdentity = {
  sessionId: `s04-${"a".repeat(32)}`,
  runSeed: "0123456789abcdef",
  buildIdentitySha256: "B".repeat(64),
  launchNonce: "c".repeat(32),
} as const;

describe("Hanzi V2 STEP 04 parent authorization and child-route gate", () => {
  it("pins the canonical parent feedback and accepted review identities", () => {
    expect(FIRST_USE_PARENT_FEEDBACK_SHA256).toBe("3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C");
    expect(FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256).toBe("DBA281F9954DFB591E2F3D7498B1B8F09F6C050BFBFA2436C9961B0513D73D3E");
  });

  it.each(["SOUND_OK", "START_MUTED"] as const)("authorizes %s only after READY and builds an exact guarded route", (audioChoice) => {
    const storage = new MemoryStorage();
    prepareFirstUseSession(storage, fixtureIdentity, 1_000);
    const deniedBeforeReady = validateChildFirstUseSessionRoute(
      `?play=hanzi-v2-golden-slice&mode=child-first-use&session=${fixtureIdentity.sessionId}&seed=${fixtureIdentity.runSeed}`,
      storage,
      1_001,
    );
    expect(deniedBeforeReady.ok).toBe(false);

    const grant = authorizeFirstUseSession(storage, fixtureIdentity.sessionId, {
      audioChoice,
      sessionMode: "LIVE_DASHBOARD",
      readyConfirmed: true,
    }, 1_001);
    const route = buildChildFirstUseRoute(grant);
    expect(route).toContain("mode=child-first-use");
    expect(validateChildFirstUseSessionRoute(route, storage, 1_002)).toEqual({ ok: true, grant });
    expect(firstUseSessionStartsMuted(grant)).toBe(audioChoice === "START_MUTED");
  });

  it("treats cancel and synthetic fixtures as closed gates", () => {
    const cancelledStorage = new MemoryStorage();
    prepareFirstUseSession(cancelledStorage, fixtureIdentity, 1_000);
    expect(cancelFirstUseSession(cancelledStorage, fixtureIdentity.sessionId)?.status).toBe("CANCELLED");
    expect(() => authorizeFirstUseSession(cancelledStorage, fixtureIdentity.sessionId, {
      audioChoice: "SOUND_OK",
      sessionMode: "LIVE_DASHBOARD",
      readyConfirmed: true,
    }, 1_001)).toThrow(/CANCELLED/);

    const syntheticStorage = new MemoryStorage();
    prepareFirstUseSession(syntheticStorage, { ...fixtureIdentity, fixture: true }, 1_000);
    expect(() => authorizeFirstUseSession(syntheticStorage, fixtureIdentity.sessionId, {
      audioChoice: "START_MUTED",
      sessionMode: "COMPACT_AFTER_SESSION",
      readyConfirmed: true,
    }, 1_001)).toThrow(/SYNTHETIC_TOOLING_TEST_ONLY/);
    const fixtureGrant = authorizeFixtureFirstUseSession(syntheticStorage, fixtureIdentity.sessionId, {
      audioChoice: "START_MUTED",
      sessionMode: "LIVE_DASHBOARD",
      readyConfirmed: true,
    }, 1_001);
    const fixtureRoute = buildChildFirstUseRoute(fixtureGrant);
    expect(fixtureRoute).toContain("fixture=1");
    expect(validateChildFirstUseSessionRoute(fixtureRoute, syntheticStorage, 1_002)).toEqual({ ok: true, grant: fixtureGrant });
    expect(validateChildFirstUseSessionRoute(fixtureRoute.replace("&fixture=1", ""), syntheticStorage, 1_002).ok).toBe(false);
  });

  it("fails the parent route closed unless all identity timestamps are exact UTC values", () => {
    const base = new URLSearchParams({
      observe: "hanzi-v2-step04",
      session: fixtureIdentity.sessionId,
      seed: fixtureIdentity.runSeed,
      build: fixtureIdentity.buildIdentitySha256,
      launch: fixtureIdentity.launchNonce,
      commit: "f6d47676a5434d74afdb865bb2f6c783522c0d90",
      generated: "2026-08-09T01:00:00.000Z",
      checked: "2026-08-09T01:01:00.000Z",
      started: "2026-08-09T01:02:00.000Z",
    });
    expect(parseParentLaunchContext(base).ok).toBe(true);
    for (const field of ["generated", "checked", "started"] as const) {
      const missing = new URLSearchParams(base);
      missing.delete(field);
      expect(parseParentLaunchContext(missing).ok).toBe(false);
      const nonCanonical = new URLSearchParams(base);
      nonCanonical.set(field, "2026-08-09T01:00:00Z");
      expect(parseParentLaunchContext(nonCanonical).ok).toBe(false);
    }
  });
});
