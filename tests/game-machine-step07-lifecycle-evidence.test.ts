import type { Step06EventType, Step06TechnicalEvent } from "../apps/my-game-world/second-use/event-types";
import {
  buildStep07LifecycleEvidenceReport,
  STEP07_CONFLICT_CASE_IDS,
  validateStep07LifecycleEvidenceReport,
  type Step07LifecycleEvidenceReport,
  type Step07LifecycleEvidenceRow,
} from "../tools/game-machine-review/step07-lifecycle-evidence";

const SOURCE_SHA = "A".repeat(64);

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function mutableReport(): DeepMutable<Step07LifecycleEvidenceReport> {
  return structuredClone(validReport()) as unknown as DeepMutable<Step07LifecycleEvidenceReport>;
}

function eventLog(
  sessionId: string,
  entries: readonly (Step06EventType | { readonly eventType: Step06EventType; readonly safeMetadata: Record<string, unknown> })[],
): Step06TechnicalEvent[] {
  return entries.map((entry, index) => ({
    schemaVersion: 1,
    sessionId,
    sequence: index + 1,
    relativeMs: index * 10,
    eventType: typeof entry === "string" ? entry : entry.eventType,
    safeMetadata: (typeof entry === "string" ? {} : entry.safeMetadata) as Step06TechnicalEvent["safeMetadata"],
  }));
}

function row(
  scenarioId: Step07LifecycleEvidenceRow["scenarioId"],
  index: number,
  events: Step06TechnicalEvent[],
): Step07LifecycleEvidenceRow {
  return {
    schemaVersion: 1,
    scenarioId,
    sourceTreeSha256: SOURCE_SHA,
    browserContextId: `context-${index}`,
    pagesShareContext: true,
    sessionId: events[0].sessionId,
    evidenceId: "hanzi-v2-step07",
    evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY",
    status: "PASS",
    eventLog: events,
    expectedExactEventTypes: null,
    disconnectWindowSequences: [],
    recoveredSequences: [],
    broadcastChannelMode: "NATIVE",
    observerRecoveryCount: 0,
    stopEffective: true,
    reloads: { observer: 0, child: 0, world: 0 },
    progressContinuityPreserved: true,
    history: null,
    conflicts: [],
    rapidInputTransitions: [],
    externalRequests: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
}

function validReport(): Step07LifecycleEvidenceReport {
  const l1Events = eventLog("s07-lifecycle-l1", [
    "session_opened", "world_ready", "progress_continuity_verified", "world_first_action",
    "world_destination_opened", "world_spellbook_opened", "returned_to_world", "session_stopped",
  ]);
  const l1 = {
    ...row("L1_ACTIVE_CONNECTION", 1, l1Events),
    expectedExactEventTypes: l1Events.map((event) => event.eventType),
  } satisfies Step07LifecycleEvidenceRow;

  const l2Events = eventLog("s07-lifecycle-l2", [
    "session_opened", "world_ready", "progress_continuity_verified", "world_first_action",
    "world_destination_opened", "forest_entered", "golden_phase_entered", "session_stopped",
  ]);
  const l2 = {
    ...row("L2_DISCONNECT_CONTINUE_RECOVER", 2, l2Events),
    disconnectWindowSequences: [4, 5, 6, 7],
    recoveredSequences: l2Events.map((event) => event.sequence),
    observerRecoveryCount: 1,
  } satisfies Step07LifecycleEvidenceRow;

  const l3Events = eventLog("s07-lifecycle-l3", [
    "session_opened", "world_ready", "progress_continuity_verified", "world_first_action",
    "world_destination_opened", "world_spellbook_opened", "returned_to_world", "session_stopped",
  ]);
  const l3 = {
    ...row("L3_BROADCASTCHANNEL_STORAGE_FALLBACK", 3, l3Events),
    broadcastChannelMode: "STORAGE_EVENT_FALLBACK",
    expectedExactEventTypes: l3Events.map((event) => event.eventType),
  } satisfies Step07LifecycleEvidenceRow;

  const l4 = {
    ...row("L4_RELOAD_CONTINUITY", 4, eventLog("s07-lifecycle-l4", [
      "session_opened", "world_ready", "progress_continuity_verified", "world_ready",
      "world_first_action", "world_destination_opened", "forest_entered", "golden_phase_entered",
      "world_ready", "returned_to_world", "world_ready", "session_stopped",
    ])),
    observerRecoveryCount: 1,
    reloads: { observer: 1, child: 1, world: 1 },
  } satisfies Step07LifecycleEvidenceRow;

  const l5Session = "s07-lifecycle-l5";
  const l5 = {
    ...row("L5_ORDINARY_HISTORY_BACK_FORWARD", 5, eventLog(l5Session, [
      "session_opened", "world_ready", "progress_continuity_verified", "world_first_action",
      "world_destination_opened", "forest_entered", "golden_phase_entered", "world_ready",
      "returned_to_world", "forest_entered", "golden_phase_entered", "world_ready", "returned_to_world", "session_stopped",
    ])),
    history: {
      navigationKind: "ORDINARY_HISTORY",
      bfcacheClaimed: false,
      entries: (["WORLD", "FOREST", "WORLD", "FOREST", "WORLD"] as const).map((surface) => ({
        surface,
        evidenceId: "hanzi-v2-step07",
        sessionId: l5Session,
        denied: false,
        step06Instrumentation: false,
      })),
    },
  } satisfies Step07LifecycleEvidenceRow;

  const conflictReasons = {
    STEP06_EVIDENCE_STEP07_SESSION: "STEP06_SESSION_MISMATCH",
    STEP07_EVIDENCE_STEP06_SESSION: "STEP07_SESSION_MISMATCH",
    BARE_SESSION: "BARE_OBSERVATION_SESSION",
    UNKNOWN_EVIDENCE: "UNSUPPORTED_OBSERVATION_EVIDENCE",
    WRONG_ORIGIN: "IDENTITY_MISMATCH",
    EXPIRED_GRANT: "GRANT_EXPIRED",
    INVALID_GRANT: "INVALID_GRANT",
    MISSING_CANONICAL_COMPLETED_SAVE: "PROGRESS_CONTINUITY",
  } as const;
  const l6 = {
    ...row("L6_CONFLICT_FAIL_CLOSED", 6, eventLog("s07-lifecycle-l6", [
      "session_opened", "world_ready", "progress_continuity_verified", "session_stopped",
    ])),
    conflicts: STEP07_CONFLICT_CASE_IDS.map((caseId) => ({ caseId, denied: true, denialReason: conflictReasons[caseId] })),
  } satisfies Step07LifecycleEvidenceRow;

  const rapid = {
    ...row("RAPID_INPUT_TRANSITIONS", 7, eventLog("s07-lifecycle-rapid", [
      "session_opened", "world_ready", "progress_continuity_verified", "world_first_action",
      "world_destination_opened", "forest_entered",
      { eventType: "golden_phase_entered", safeMetadata: { phase: "battle_1_forming" } },
      { eventType: "golden_phase_entered", safeMetadata: { phase: "battle_1_cleared" } },
      { eventType: "ability_selected", safeMetadata: { abilityId: "ink-echo" } },
      "session_stopped",
    ])),
    rapidInputTransitions: [
      { transitionId: "SELECTION_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "battle_1_forming" },
      { transitionId: "PLACEMENT_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "battle_1_cleared" },
      { transitionId: "ABILITY_CHOICE_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "boss_approach" },
      { transitionId: "BOSS_COMPLETION_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "boss_cleared" },
      { transitionId: "FINISH_RUN_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "camp_repair" },
      { transitionId: "RETURN_WORLD_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: 1, duplicateTransitionEventCount: 0, finalState: "WORLD" },
    ],
  } satisfies Step07LifecycleEvidenceRow;

  return buildStep07LifecycleEvidenceReport({
    rows: [l1, l2, l3, l4, l5, l6, rapid],
    sourceTreeSha256Before: SOURCE_SHA,
    sourceTreeSha256After: SOURCE_SHA,
    generatedAtUtc: "2026-08-10T00:00:00.000Z",
  });
}

describe("STEP 07 lifecycle evidence validator", () => {
  it("accepts a complete source-bound L1-L6 plus rapid-input report", () => {
    expect(validateStep07LifecycleEvidenceReport(validReport(), SOURCE_SHA)).toEqual([]);
  });

  it("fails a duplicated event identity mutation", () => {
    const report = mutableReport();
    report.rows[0].eventLog.splice(2, 0, structuredClone(report.rows[0].eventLog[1]));
    expect(validateStep07LifecycleEvidenceReport(report, SOURCE_SHA).join("\n")).toMatch(/duplicate event identity/);
  });

  it("fails an out-of-order sequence mutation", () => {
    const report = mutableReport();
    [report.rows[0].eventLog[2], report.rows[0].eventLog[3]] = [report.rows[0].eventLog[3], report.rows[0].eventLog[2]];
    expect(validateStep07LifecycleEvidenceReport(report, SOURCE_SHA).join("\n")).toMatch(/not contiguous and monotonic/);
  });

  it("fails a wrong-session event mutation", () => {
    const report = mutableReport();
    report.rows[0].eventLog[2].sessionId = "s07-wrong-session";
    expect(validateStep07LifecycleEvidenceReport(report, SOURCE_SHA).join("\n")).toMatch(/wrong session/);
  });

  it("fails a cross-version history route mutation", () => {
    const report = mutableReport();
    const history = report.rows[4].history;
    if (!history) throw new Error("fixture history missing");
    history.entries[2].evidenceId = "hanzi-v2-step06";
    history.entries[2].sessionId = "s06-cross-version";
    history.entries[2].step06Instrumentation = true;
    expect(validateStep07LifecycleEvidenceReport(report, SOURCE_SHA).join("\n")).toMatch(/crossed into STEP 06/);
  });

  it("fails when a disconnect-window event is absent from recovered evidence", () => {
    const report = mutableReport();
    report.rows[1].recoveredSequences = report.rows[1].recoveredSequences.filter((sequence) => sequence !== 6);
    expect(validateStep07LifecycleEvidenceReport(report, SOURCE_SHA).join("\n")).toMatch(/disconnect event 6 was not recovered/);
  });
});
