import { isStep06TechnicalEvent, type Step06EventType, type Step06TechnicalEvent } from "../../apps/my-game-world/second-use/event-types";

export const STEP07_LIFECYCLE_SCENARIO_IDS = [
  "L1_ACTIVE_CONNECTION",
  "L2_DISCONNECT_CONTINUE_RECOVER",
  "L3_BROADCASTCHANNEL_STORAGE_FALLBACK",
  "L4_RELOAD_CONTINUITY",
  "L5_ORDINARY_HISTORY_BACK_FORWARD",
  "L6_CONFLICT_FAIL_CLOSED",
  "RAPID_INPUT_TRANSITIONS",
] as const;

export type Step07LifecycleScenarioId = (typeof STEP07_LIFECYCLE_SCENARIO_IDS)[number];

export const STEP07_CONFLICT_CASE_IDS = [
  "STEP06_EVIDENCE_STEP07_SESSION",
  "STEP07_EVIDENCE_STEP06_SESSION",
  "BARE_SESSION",
  "UNKNOWN_EVIDENCE",
  "WRONG_ORIGIN",
  "EXPIRED_GRANT",
  "INVALID_GRANT",
  "MISSING_CANONICAL_COMPLETED_SAVE",
] as const;

export type Step07ConflictCaseId = (typeof STEP07_CONFLICT_CASE_IDS)[number];

const EXPECTED_CONFLICT_REASONS: Readonly<Record<Step07ConflictCaseId, string>> = {
  STEP06_EVIDENCE_STEP07_SESSION: "STEP06_SESSION_MISMATCH",
  STEP07_EVIDENCE_STEP06_SESSION: "STEP07_SESSION_MISMATCH",
  BARE_SESSION: "BARE_OBSERVATION_SESSION",
  UNKNOWN_EVIDENCE: "UNSUPPORTED_OBSERVATION_EVIDENCE",
  WRONG_ORIGIN: "IDENTITY_MISMATCH",
  EXPIRED_GRANT: "GRANT_EXPIRED",
  INVALID_GRANT: "INVALID_GRANT",
  MISSING_CANONICAL_COMPLETED_SAVE: "PROGRESS_CONTINUITY",
};

export interface Step07RouteIdentitySnapshot {
  readonly surface: "WORLD" | "FOREST";
  readonly evidenceId: string | null;
  readonly sessionId: string | null;
  readonly denied: boolean;
  readonly step06Instrumentation: boolean;
}

export interface Step07ConflictResult {
  readonly caseId: Step07ConflictCaseId;
  readonly denied: boolean;
  readonly denialReason: string;
}

export interface Step07RapidInputTransition {
  readonly transitionId:
    | "SELECTION_INPUT_LOCK"
    | "PLACEMENT_INPUT_LOCK"
    | "ABILITY_CHOICE_INPUT_LOCK"
    | "BOSS_COMPLETION_INPUT_LOCK"
    | "FINISH_RUN_INPUT_LOCK"
    | "RETURN_WORLD_INPUT_LOCK";
  readonly dispatchCount: number;
  readonly acceptedTransitionCount: number;
  readonly duplicateTransitionEventCount: number;
  readonly finalState: string;
}

export interface Step07LifecycleEvidenceRow {
  readonly schemaVersion: 1;
  readonly scenarioId: Step07LifecycleScenarioId;
  readonly sourceTreeSha256: string;
  readonly browserContextId: string;
  readonly pagesShareContext: true;
  readonly sessionId: string;
  readonly evidenceId: "hanzi-v2-step07";
  readonly evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY";
  readonly status: "PASS" | "FAIL";
  readonly eventLog: readonly Step06TechnicalEvent[];
  readonly expectedExactEventTypes: readonly Step06EventType[] | null;
  readonly disconnectWindowSequences: readonly number[];
  readonly recoveredSequences: readonly number[];
  readonly broadcastChannelMode: "NATIVE" | "STORAGE_EVENT_FALLBACK" | "NOT_APPLICABLE";
  readonly observerRecoveryCount: number;
  readonly stopEffective: boolean;
  readonly reloads: {
    readonly observer: number;
    readonly child: number;
    readonly world: number;
  };
  readonly progressContinuityPreserved: boolean;
  readonly history: {
    readonly navigationKind: "ORDINARY_HISTORY";
    readonly bfcacheClaimed: false;
    readonly entries: readonly Step07RouteIdentitySnapshot[];
  } | null;
  readonly conflicts: readonly Step07ConflictResult[];
  readonly rapidInputTransitions: readonly Step07RapidInputTransition[];
  readonly externalRequests: readonly string[];
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
}

export interface Step07LifecycleEvidenceReport {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly reportType: "STEP07_LIFECYCLE_EVIDENCE";
  readonly evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY";
  readonly sourceTreeSha256: string;
  readonly sourceTreeSha256Before: string;
  readonly sourceTreeSha256After: string;
  readonly generatedAtUtc: string;
  readonly command: "pnpm run test:e2e:hanzi-v2:step07:lifecycle";
  readonly status: "PASS" | "FAIL";
  readonly scenarioIds: readonly Step07LifecycleScenarioId[];
  readonly rows: readonly Step07LifecycleEvidenceRow[];
  readonly limitations: readonly [
    "SYNTHETIC_TOOLING_TEST_ONLY; NO REAL CHILD DATA",
    "Ordinary history navigation only; no BFCache restoration claim",
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSha(value: string): string {
  return value.toUpperCase();
}

function sameStringArray(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function duplicateCount(values: readonly string[]): number {
  return values.length - new Set(values).size;
}

function validateEventLog(row: Step07LifecycleEvidenceRow, errors: string[]): void {
  if (!Array.isArray(row.eventLog) || row.eventLog.length === 0) {
    errors.push(`${row.scenarioId}: eventLog is empty`);
    return;
  }
  const identities: string[] = [];
  let previousSequence = 0;
  let previousRelativeMs = -1;
  for (const [index, event] of row.eventLog.entries()) {
    if (!isStep06TechnicalEvent(event)) {
      errors.push(`${row.scenarioId}: event ${index} fails the allowlisted event schema`);
      continue;
    }
    if (event.sessionId !== row.sessionId) errors.push(`${row.scenarioId}: event ${index} has the wrong session`);
    if (event.sequence !== previousSequence + 1) errors.push(`${row.scenarioId}: event sequence is not contiguous and monotonic at ${index}`);
    if (event.relativeMs < previousRelativeMs) errors.push(`${row.scenarioId}: relative time moved backwards at ${index}`);
    previousSequence = event.sequence;
    previousRelativeMs = event.relativeMs;
    identities.push(`${event.sessionId}:${event.sequence}`);
  }
  if (duplicateCount(identities) !== 0) errors.push(`${row.scenarioId}: duplicate event identity`);
  if (row.eventLog.filter((event) => event.eventType === "session_opened").length !== 1) {
    errors.push(`${row.scenarioId}: session_opened must occur exactly once`);
  }
  if (row.expectedExactEventTypes) {
    const actual = row.eventLog.map((event) => event.eventType);
    if (!sameStringArray(actual, row.expectedExactEventTypes)) {
      errors.push(`${row.scenarioId}: exact event sequence differs`);
    }
  }
}

function validateScenario(row: Step07LifecycleEvidenceRow, errors: string[]): void {
  if (row.scenarioId === "L1_ACTIVE_CONNECTION") {
    if (!row.expectedExactEventTypes || row.expectedExactEventTypes.length === 0) errors.push("L1: exact sequence is missing");
    if (!row.stopEffective) errors.push("L1: stop was not effective");
  }

  if (row.scenarioId === "L2_DISCONNECT_CONTINUE_RECOVER") {
    if (row.observerRecoveryCount !== 1) errors.push("L2: observer must recover exactly once");
    if (row.disconnectWindowSequences.length === 0) errors.push("L2: disconnect window has no events");
    const recovered = new Set(row.recoveredSequences);
    for (const sequence of row.disconnectWindowSequences) {
      if (!recovered.has(sequence)) errors.push(`L2: disconnect event ${sequence} was not recovered`);
      if (!row.eventLog.some((event) => event.sequence === sequence)) errors.push(`L2: disconnect event ${sequence} is absent from the final log`);
    }
    if (!row.stopEffective) errors.push("L2: recovered observer stop was not effective");
  }

  if (row.scenarioId === "L3_BROADCASTCHANNEL_STORAGE_FALLBACK") {
    if (row.broadcastChannelMode !== "STORAGE_EVENT_FALLBACK") errors.push("L3: storage-event fallback was not selected");
    if (!row.stopEffective) errors.push("L3: fallback stop was not effective");
  }

  if (row.scenarioId === "L4_RELOAD_CONTINUITY") {
    if (row.reloads.observer < 1 || row.reloads.child < 1 || row.reloads.world < 1) errors.push("L4: observer, child, and world reloads are all required");
    if (row.observerRecoveryCount < 1) errors.push("L4: observer reload did not recover");
    if (!row.progressContinuityPreserved) errors.push("L4: progress/session identity did not survive reload");
  }

  if (row.scenarioId === "L5_ORDINARY_HISTORY_BACK_FORWARD") {
    const expectedSurfaces = ["WORLD", "FOREST", "WORLD", "FOREST", "WORLD"];
    if (!row.history) errors.push("L5: ordinary history proof is missing");
    else {
      if (row.history.navigationKind !== "ORDINARY_HISTORY" || row.history.bfcacheClaimed !== false) errors.push("L5: BFCache must not be claimed");
      if (!sameStringArray(row.history.entries.map((entry) => entry.surface), expectedSurfaces)) errors.push("L5: world/forest history sequence differs");
      for (const entry of row.history.entries) {
        if (entry.denied || entry.step06Instrumentation || entry.evidenceId !== row.evidenceId || entry.sessionId !== row.sessionId) {
          errors.push("L5: route identity was lost or crossed into STEP 06");
        }
      }
    }
  }

  if (row.scenarioId === "L6_CONFLICT_FAIL_CLOSED") {
    const ids = row.conflicts.map((entry) => entry.caseId);
    if (!sameStringArray(ids, STEP07_CONFLICT_CASE_IDS)) errors.push("L6: conflict case coverage differs");
    for (const conflict of row.conflicts) {
      if (!conflict.denied) errors.push(`L6: ${conflict.caseId} did not fail closed`);
      if (conflict.denialReason !== EXPECTED_CONFLICT_REASONS[conflict.caseId]) errors.push(`L6: ${conflict.caseId} denial reason differs`);
    }
  }

  if (row.scenarioId === "RAPID_INPUT_TRANSITIONS") {
    const expected = [
      "SELECTION_INPUT_LOCK",
      "PLACEMENT_INPUT_LOCK",
      "ABILITY_CHOICE_INPUT_LOCK",
      "BOSS_COMPLETION_INPUT_LOCK",
      "FINISH_RUN_INPUT_LOCK",
      "RETURN_WORLD_INPUT_LOCK",
    ];
    if (!sameStringArray(row.rapidInputTransitions.map((entry) => entry.transitionId), expected)) errors.push("rapid input: transition coverage differs");
    for (const transition of row.rapidInputTransitions) {
      if (transition.dispatchCount < 2 || transition.acceptedTransitionCount !== 1 || transition.duplicateTransitionEventCount !== 0 || !transition.finalState) {
        errors.push(`rapid input: ${transition.transitionId} was not single-accept deterministic`);
      }
    }
  }
}

export function buildStep07LifecycleEvidenceReport(input: {
  readonly rows: readonly Step07LifecycleEvidenceRow[];
  readonly sourceTreeSha256Before: string;
  readonly sourceTreeSha256After: string;
  readonly generatedAtUtc?: string;
}): Step07LifecycleEvidenceReport {
  const before = normalizeSha(input.sourceTreeSha256Before);
  const after = normalizeSha(input.sourceTreeSha256After);
  const complete = sameStringArray(input.rows.map((row) => row.scenarioId), STEP07_LIFECYCLE_SCENARIO_IDS)
    && input.rows.every((row) => row.status === "PASS")
    && before === after;
  return {
    schemaVersion: 1,
    step: "07",
    reportType: "STEP07_LIFECYCLE_EVIDENCE",
    evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY",
    sourceTreeSha256: after,
    sourceTreeSha256Before: before,
    sourceTreeSha256After: after,
    generatedAtUtc: input.generatedAtUtc ?? new Date().toISOString(),
    command: "pnpm run test:e2e:hanzi-v2:step07:lifecycle",
    status: complete ? "PASS" : "FAIL",
    scenarioIds: STEP07_LIFECYCLE_SCENARIO_IDS,
    rows: input.rows,
    limitations: [
      "SYNTHETIC_TOOLING_TEST_ONLY; NO REAL CHILD DATA",
      "Ordinary history navigation only; no BFCache restoration claim",
    ],
  };
}

export function validateStep07LifecycleEvidenceReport(
  value: unknown,
  expectedSourceTreeSha256?: string,
): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["lifecycle report must be an object"];
  const report = value as unknown as Step07LifecycleEvidenceReport;
  if (report.schemaVersion !== 1 || report.step !== "07" || report.reportType !== "STEP07_LIFECYCLE_EVIDENCE") errors.push("lifecycle report identity differs");
  if (report.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") errors.push("lifecycle evidence must remain synthetic");
  if (!/^[a-f0-9]{64}$/i.test(report.sourceTreeSha256 ?? "")) errors.push("lifecycle sourceTreeSha256 is invalid");
  if (report.sourceTreeSha256Before !== report.sourceTreeSha256 || report.sourceTreeSha256After !== report.sourceTreeSha256) errors.push("lifecycle source tree changed during capture");
  if (expectedSourceTreeSha256 && normalizeSha(report.sourceTreeSha256) !== normalizeSha(expectedSourceTreeSha256)) errors.push("lifecycle source identity is stale");
  if (!Number.isFinite(Date.parse(report.generatedAtUtc ?? ""))) errors.push("lifecycle generatedAtUtc is invalid");
  if (report.command !== "pnpm run test:e2e:hanzi-v2:step07:lifecycle") errors.push("lifecycle command identity differs");
  if (!Array.isArray(report.scenarioIds) || !sameStringArray(report.scenarioIds, STEP07_LIFECYCLE_SCENARIO_IDS)) errors.push("lifecycle scenario inventory differs");
  if (!Array.isArray(report.rows)) return [...errors, "lifecycle rows are missing"];
  if (!sameStringArray(report.rows.map((row) => row.scenarioId), STEP07_LIFECYCLE_SCENARIO_IDS)) errors.push("lifecycle row order/coverage differs");
  if (duplicateCount(report.rows.map((row) => row.browserContextId)) !== 0) errors.push("lifecycle tests reused a BrowserContext identity");
  for (const candidateRow of report.rows as readonly unknown[]) {
    if (!isRecord(candidateRow)) { errors.push("lifecycle row is invalid"); continue; }
    const row = candidateRow as unknown as Step07LifecycleEvidenceRow;
    if (row.schemaVersion !== 1 || row.status !== "PASS") errors.push(`${row.scenarioId}: row did not PASS`);
    if (normalizeSha(row.sourceTreeSha256 ?? "") !== normalizeSha(report.sourceTreeSha256)) errors.push(`${row.scenarioId}: row source identity is stale`);
    if (row.pagesShareContext !== true) errors.push(`${row.scenarioId}: observer and child did not share one BrowserContext`);
    if (!/^s07-[a-z0-9-]{8,64}$/.test(row.sessionId ?? "") || row.evidenceId !== "hanzi-v2-step07") errors.push(`${row.scenarioId}: STEP 07 route identity differs`);
    if (row.evidenceKind !== "SYNTHETIC_TOOLING_TEST_ONLY") errors.push(`${row.scenarioId}: row evidence kind differs`);
    for (const field of ["externalRequests", "consoleErrors", "pageErrors", "failedRequests"] as const) {
      if (!Array.isArray(row[field]) || row[field].length !== 0) errors.push(`${row.scenarioId}: ${field} is not empty`);
    }
    validateEventLog(row, errors);
    validateScenario(row, errors);
  }
  if (report.status !== (errors.length === 0 ? "PASS" : "FAIL")) errors.push("lifecycle report status does not match validation");
  return errors;
}
