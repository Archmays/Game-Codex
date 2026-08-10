import { validateStep07Observation } from "../apps/hanzi-v2-step07-observer/observation-schema";
import { createStep07Fixture, validateStep07Return } from "../tools/hanzi-v2-step07/step07-contract";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function mutableFixture(): any {
  return structuredClone(createStep07Fixture(COMMIT));
}

describe("Hanzi V2 STEP 07 observation schema", () => {
  it("accepts a closed synthetic fixture with exactly five human fields", () => {
    const fixture = createStep07Fixture(COMMIT);

    expect(validateStep07Observation(fixture)).toBe(true);
    expect(fixture.evidenceKind).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(fixture.buildIdentity.technicalState).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(fixture.buildIdentity.machineVerdictSha256).toBeNull();
    expect(fixture.completion.humanEntryMode).toBe("SYNTHETIC_FIXTURE");
    expect(Object.keys(fixture.humanObservations).sort()).toEqual([
      "adultAnswerRequired",
      "comfortable",
      "engagementTone",
      "noticedPersistentRepairs",
      "recognizedWorld",
    ]);
    expect(fixture.derivedActions).toMatchObject({
      firstDestination: "FOREST",
      forestEntered: true,
      worldLoopCompleted: true,
      goldenRunCompleted: true,
      returnedToWorld: true,
      hintOrRecoveryCount: 1,
      selectedAbilityId: "ink-echo",
      technicalErrorCount: 0,
    });
  });

  it.each([
    ["document schema version", (value: any) => { value.schemaVersion = 2; }],
    ["event schema version", (value: any) => { value.technicalEvents[0].schemaVersion = 2; }],
    ["STEP 06 document session", (value: any) => { value.sessionIdentity.sessionId = "s06-fixture-12345678"; }],
    ["mismatched event session", (value: any) => { value.technicalEvents[0].sessionId = "s07-different-12345678"; }],
    ["duplicate event sequence", (value: any) => { value.technicalEvents[2].sequence = value.technicalEvents[1].sequence; }],
    ["out-of-order event sequence", (value: any) => { value.technicalEvents[2].sequence = value.technicalEvents[1].sequence - 1; }],
    ["decreasing event time", (value: any) => { value.technicalEvents[2].relativeMs = value.technicalEvents[1].relativeMs - 1; }],
    ["unknown document field", (value: any) => { value.unapproved = true; }],
    ["unknown human field", (value: any) => { value.humanObservations.childPassed = true; }],
    ["missing human field", (value: any) => { delete value.humanObservations.comfortable; }],
    ["invalid human enum", (value: any) => { value.humanObservations.engagementTone = "FUN_PROVEN"; }],
    ["tampered derived result", (value: any) => { value.derivedActions.goldenRunCompleted = false; }],
    ["premature machine-readiness fixture claim", (value: any) => { value.buildIdentity.technicalState = "MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY"; }],
    ["fixture machine verdict claim", (value: any) => { value.buildIdentity.machineVerdictSha256 = "a".repeat(64); }],
    ["fixture claiming human entry", (value: any) => { value.completion.humanEntryMode = "EXPLICIT_FORM_INPUT"; }],
  ])("rejects %s", (_label, mutate) => {
    const fixture = mutableFixture();
    mutate(fixture);
    expect(validateStep07Observation(fixture)).toBe(false);
  });

  it("accepts only privacy-safe preset notes and rejects arbitrary free text", () => {
    const allowed = mutableFixture();
    allowed.optionalNote = "孩子回到世界后结束。";
    expect(validateStep07Observation(allowed)).toBe(true);

    for (const note of ["小明今天自己回到世界。", "张伟说还想继续。", "北京海淀区中关村大街1号", "妈妈微信may12345", "My child is Alice.", "界".repeat(501)]) {
      const rejected = mutableFixture();
      rejected.optionalNote = note;
      expect(validateStep07Observation(rejected)).toBe(false);
    }
  });

  it("binds final validation to both evidence kind and exact commit", () => {
    const fixture = createStep07Fixture(COMMIT);
    expect(validateStep07Return(fixture, "SYNTHETIC_TOOLING_TEST_ONLY", COMMIT)).toBe(fixture);
    expect(() => validateStep07Return(fixture, "REAL_CHILD_SECOND_USE", COMMIT)).toThrow(/Expected REAL_CHILD_SECOND_USE/);
    expect(() => validateStep07Return(fixture, "SYNTHETIC_TOOLING_TEST_ONLY", "f".repeat(40))).toThrow(/commit mismatch/);
  });

  it("binds a real observation to the exact machine verdict bytes", () => {
    const verdictSha256 = "a".repeat(64);
    const real = mutableFixture();
    real.evidenceKind = "REAL_CHILD_SECOND_USE";
    real.buildIdentity.technicalState = "MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY";
    real.buildIdentity.machineVerdictSha256 = verdictSha256;
    real.completion.humanEntryMode = "EXPLICIT_FORM_INPUT";
    expect(validateStep07Observation(real)).toBe(true);
    expect(validateStep07Return(real, "REAL_CHILD_SECOND_USE", COMMIT, verdictSha256)).toBe(real);
    expect(() => validateStep07Return(real, "REAL_CHILD_SECOND_USE", COMMIT, "b".repeat(64))).toThrow(/verdict identity mismatch/);
  });
});
