import { isStep06EvidenceAttempt, resolveAppRoute } from "../src/app-route";
import { resolveObservationContext } from "../src/observation-context";

const search = (query = "") => new URLSearchParams(query);

describe("versioned observation context", () => {
  it("resolves explicit STEP 06 and STEP 07 evidence independently", () => {
    expect(resolveObservationContext(search("evidence=hanzi-v2-step06&session=s06-12345678")))
      .toEqual({ kind: "step06", sessionId: "s06-12345678" });
    expect(resolveObservationContext(search("evidence=hanzi-v2-step07&session=s07-12345678")))
      .toEqual({ kind: "step07", sessionId: "s07-12345678" });
  });

  it("never sends a STEP 07 session into STEP 06 instrumentation", () => {
    const query = search("evidence=hanzi-v2-step07&session=s07-12345678");
    expect(resolveObservationContext(query).kind).toBe("step07");
    expect(isStep06EvidenceAttempt(query)).toBe(false);
  });

  it("fails closed for missing, duplicate, cross-version, and unknown observation identity", () => {
    expect(resolveObservationContext(search("evidence=hanzi-v2-step06"))).toEqual({ kind: "invalid", reason: "MISSING_SESSION" });
    expect(resolveObservationContext(search("evidence=hanzi-v2-step07&session=s06-12345678"))).toEqual({ kind: "invalid", reason: "STEP07_SESSION_MISMATCH" });
    expect(resolveObservationContext(search("evidence=hanzi-v2-step06&session=s06-12345678&session=s06-abcdefgh"))).toEqual({ kind: "invalid", reason: "DUPLICATE_SESSION" });
    expect(resolveObservationContext(search("evidence=hanzi-v2-step08&session=s08-12345678"))).toEqual({ kind: "invalid", reason: "UNSUPPORTED_OBSERVATION_EVIDENCE" });
  });

  it("denies bare STEP 06/07 sessions while keeping ordinary routes outside instrumentation", () => {
    expect(resolveObservationContext(search("session=s06-12345678"))).toEqual({ kind: "invalid", reason: "BARE_OBSERVATION_SESSION" });
    expect(resolveObservationContext(search("session=s07-12345678"))).toEqual({ kind: "invalid", reason: "BARE_OBSERVATION_SESSION" });
    expect(resolveObservationContext(search("world=my-game-world"))).toEqual({ kind: "none" });
    expect(resolveObservationContext(search("play=hanzi-v2-golden-slice&mode=play"))).toEqual({ kind: "none" });
    expect(resolveObservationContext(search("play=hanzi-v2-golden-slice&mode=child-first-use&session=s04-12345678"))).toEqual({ kind: "none" });
  });
});

describe("STEP 07 formal app routes", () => {
  it("preserves STEP 06 routes and adds explicit STEP 07 observer routing", () => {
    expect(resolveAppRoute(search("observe=hanzi-v2-step06"))).toEqual({ kind: "observe-step06", explicit: true });
    expect(resolveAppRoute(search("observe=hanzi-v2-step07"))).toEqual({ kind: "observe-step07", explicit: true });
  });

  it("routes the machine report formally and keeps documented precedence", () => {
    expect(resolveAppRoute(search("report=game-machine-review"))).toEqual({ kind: "machine-review-report", explicit: true });
    expect(resolveAppRoute(search("observe=hanzi-v2-step07&report=game-machine-review"))).toEqual({ kind: "observe-step07", explicit: true });
    expect(resolveAppRoute(search("play=hanzi-v2-golden-slice&observe=hanzi-v2-step07"))).toEqual({ kind: "play", explicit: true });
  });
});
