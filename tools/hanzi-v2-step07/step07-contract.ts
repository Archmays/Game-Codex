import { readFileSync, writeFileSync } from "node:fs";
import { STEP06_EVENT_SCHEMA_VERSION, type Step06TechnicalEvent } from "../../apps/my-game-world/second-use/event-types";
import { STEP06_CANONICAL_ORIGIN, type Step06ProgressContinuityProjection } from "../../apps/my-game-world/second-use/progress-continuity";
import {
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
  type Step06EvidenceKind,
} from "../../apps/my-game-world/second-use/session";
import { STEP07_FIXTURE_TECHNICAL_STATE, type Step07SessionGrant } from "../../apps/my-game-world/second-use/step07-session";
import {
  buildStep07Observation,
  DEFAULT_STEP07_HUMAN_OBSERVATIONS,
  type Step07ObservationDocument,
} from "../../apps/hanzi-v2-step07-observer/observation-model";
import { validateStep07Observation } from "../../apps/hanzi-v2-step07-observer/observation-schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fixtureProjection(): Step06ProgressContinuityProjection {
  return {
    originMatched: true,
    canonicalSavePresent: true,
    completedAndComplete: true,
    discoveredCharacterIds: ["ming", "hua", "lin", "xing"],
    campRepairFlags: { lamp: true, flowers: true, guardianTrees: true, starPath: true },
    recoveredFromCorruption: false,
  };
}

function fixtureEvents(sessionId: string): Step06TechnicalEvent[] {
  const entries: Array<Omit<Step06TechnicalEvent, "schemaVersion" | "sessionId" | "sequence">> = [
    { relativeMs: 0, eventType: "session_opened", safeMetadata: {} },
    { relativeMs: 50, eventType: "world_ready", safeMetadata: {} },
    { relativeMs: 80, eventType: "progress_continuity_verified", safeMetadata: { completed: true } },
    { relativeMs: 220, eventType: "world_first_action", safeMetadata: {} },
    { relativeMs: 230, eventType: "world_destination_opened", safeMetadata: { destinationId: "FOREST" } },
    { relativeMs: 420, eventType: "forest_entered", safeMetadata: {} },
    { relativeMs: 760, eventType: "golden_phase_entered", safeMetadata: { phase: "invalid_feedback" } },
    { relativeMs: 1200, eventType: "ability_selected", safeMetadata: { abilityId: "ink-echo" } },
    { relativeMs: 2400, eventType: "golden_run_completed", safeMetadata: { completed: true } },
    { relativeMs: 2800, eventType: "returned_to_world", safeMetadata: { worldReturned: true } },
    { relativeMs: 3000, eventType: "session_stopped", safeMetadata: {} },
  ];
  return entries.map((event, index) => ({
    schemaVersion: STEP06_EVENT_SCHEMA_VERSION,
    sessionId,
    sequence: index + 1,
    ...event,
  }));
}

export function createStep07Fixture(commitSha: string): Step07ObservationDocument {
  assert(/^[a-f0-9]{40}$/i.test(commitSha), "Fixture build commit must be a full SHA");
  const sessionId = `s07-fixture-${commitSha.slice(0, 12)}`;
  const startedAtMs = Date.parse("2026-08-10T06:00:00.000Z");
  const grant: Step07SessionGrant = {
    schemaVersion: 1,
    sessionId,
    evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY",
    buildCommit: commitSha.toLowerCase(),
    machineVerdictSha256: null,
    technicalState: STEP07_FIXTURE_TECHNICAL_STATE,
    parentFeedbackSha256: STEP06_PARENT_FEEDBACK_SHA256,
    parentCandidateCommit: STEP06_PARENT_CANDIDATE_COMMIT,
    parentEvidenceSha256: STEP06_PARENT_EVIDENCE_SHA256,
    parentCandidateRevision: STEP06_PARENT_CANDIDATE_REVISION,
    authorizeDefaultWorldEntry: "YES",
    authorizeSecondUseCheck: "YES",
    canonicalOrigin: STEP06_CANONICAL_ORIGIN,
    intervalBucket: "ONE_TO_THREE_DAYS",
    soundMode: "START_MUTED",
    progressContinuity: fixtureProjection(),
    startedAtMs,
    startedAtUtc: new Date(startedAtMs).toISOString(),
    expiresAtMs: startedAtMs + 30 * 60 * 1000,
    status: "AUTHORIZED",
  };
  return buildStep07Observation(grant, {
    events: fixtureEvents(sessionId),
    humanObservations: DEFAULT_STEP07_HUMAN_OBSERVATIONS,
    stopReason: "NATURAL_END",
    humanEntryMode: "SYNTHETIC_FIXTURE",
    optionalNote: "合成工具检查；没有真实儿童数据。",
    nowMs: startedAtMs + 3000,
  });
}

export function validateStep07Return(value: unknown, expectedKind: Step06EvidenceKind, commitSha: string, verdictSha256?: string): Step07ObservationDocument {
  assert(validateStep07Observation(value), "STEP 07 observation failed schema or privacy validation");
  assert(value.evidenceKind === expectedKind, `Expected ${expectedKind}, received ${value.evidenceKind}`);
  assert(value.buildIdentity.commitSha.toLowerCase() === commitSha.toLowerCase(), "STEP 07 observation commit mismatch");
  if (expectedKind === "SYNTHETIC_TOOLING_TEST_ONLY") {
    assert(value.buildIdentity.machineVerdictSha256 === null, "Synthetic STEP 07 observation must not claim a machine verdict identity");
  } else {
    assert(typeof verdictSha256 === "string" && /^[a-f0-9]{64}$/i.test(verdictSha256), "Current machine verdict SHA-256 is required");
    assert(value.buildIdentity.machineVerdictSha256?.toLowerCase() === verdictSha256.toLowerCase(), "STEP 07 observation verdict identity mismatch");
  }
  return value;
}

function step07SummaryBody(document: Step07ObservationDocument): string {
  const derived = document.derivedActions;
  const human = document.humanObservations;
  return `# STEP 07 Real Second-Use Summary\n\nEvidence kind: \`${document.evidenceKind}\`\n\n## Machine-derived facts\n\n- First action (ms): \`${derived.firstActionMs ?? "UNRECORDED"}\`\n- First destination: \`${derived.firstDestination ?? "UNRECORDED"}\`\n- Forest / spellbook / treasure: \`${derived.forestEntered} / ${derived.spellbookOpened} / ${derived.treasureOpened}\`\n- World loop / returned: \`${derived.worldLoopCompleted} / ${derived.returnedToWorld}\`\n- Golden run completed: \`${derived.goldenRunCompleted}\`\n- Hint or recovery states: \`${derived.hintOrRecoveryCount}\`\n- Ability: \`${derived.selectedAbilityId ?? "UNRECORDED"}\`\n- Technical errors: \`${derived.technicalErrorCount}\`\n- Duration (ms): \`${derived.durationMs}\`\n\n## Five human fields\n\n- Recognized world: \`${human.recognizedWorld}\`\n- Noticed persistent repairs: \`${human.noticedPersistentRepairs}\`\n- Adult answer required: \`${human.adultAnswerRequired}\`\n- Comfortable: \`${human.comfortable}\`\n- Engagement tone: \`${human.engagementTone}\`\n\n## Explicitly not concluded\n\nNo conclusion is made about child fun, learning effectiveness, retention, long-term engagement, family preference, remaining-eight readiness, replay authorization, or a full Ink Forest. A synthetic fixture is tooling evidence only.\n`;
}

export function step07Summary(document: Step07ObservationDocument): string {
  const summary = step07SummaryBody(document);
  return document.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
    ? summary.replace("# STEP 07 Real Second-Use Summary", "# STEP 07 Synthetic Tooling Summary")
    : summary;
}

function main(): void {
  const [command, inputPath, outputPath, expectedKind, commitSha, verdictSha256] = process.argv.slice(2);
  if (command === "generate-fixture") {
    const document = createStep07Fixture(inputPath);
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    return;
  }
  if (command === "validate-summary") {
    const value = JSON.parse(readFileSync(inputPath, "utf8"));
    const document = validateStep07Return(value, expectedKind as Step06EvidenceKind, commitSha, verdictSha256);
    writeFileSync(outputPath, step07Summary(document), "utf8");
    return;
  }
  throw new Error("Usage: generate-fixture <commit> <output> OR validate-summary <input> <summary> <kind> <commit> [verdict-sha256]");
}

if (process.argv[1] && /step07-contract\.(?:ts|js)$/i.test(process.argv[1])) main();
