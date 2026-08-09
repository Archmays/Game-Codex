import { readFileSync, writeFileSync } from "node:fs";
import {
  buildStep06Observation,
  emptyStep06Observations,
  emptyStep06Wellbeing,
  type Step06ObservationDocument,
} from "../../apps/hanzi-v2-step06-observer/observation-model";
import { validateStep06Observation } from "../../apps/hanzi-v2-step06-observer/observation-schema";
import { validateStep06Privacy } from "../../apps/my-game-world/second-use/privacy";
import {
  STEP06_CANONICAL_ORIGIN,
  type Step06ProgressContinuityProjection,
} from "../../apps/my-game-world/second-use/progress-continuity";
import {
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
  STEP06_TECHNICAL_STATE,
  type Step06EvidenceKind,
  type Step06SessionGrant,
} from "../../apps/my-game-world/second-use/session";
import type { Step06TechnicalEvent } from "../../apps/my-game-world/second-use/event-types";

const REQUIRED_IDS = ["ming", "hua", "lin", "xing"] as const;
const FORBIDDEN_KEYS = /^(?:(?:child)?(?:name|age|school)|userAgent|screenFingerprint|pointerCoordinates?|coordinates?|rawKey|rawKeyboardInput|audio(?:Path|Data|Blob|Recording)?|video(?:Path|Data|Blob|Recording)?|image(?:Path|Data|Blob)?|photo(?:Path|Data|Blob)?|voiceName|exactVoice|localStorage|localStorageDump|media(?:Path|Data|Blob)?|automaticDecision|passFail)$/i;
const FORBIDDEN_NOTES = /(?:https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:姓名|学校|年龄|电话|手机号|住址|邮箱)\s*[:：]|\b(?:name|school|age|phone|address|email)\s*:)/i;

function hasForbiddenField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => FORBIDDEN_KEYS.test(key) || hasForbiddenField(nested));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateStep06Return(
  value: unknown,
  expectedKind: Step06EvidenceKind,
  expectedCommit: string,
): Step06ObservationDocument {
  assert(validateStep06Observation(value), "STEP 06 observation schema or derived-actions validation failed");
  const doc = value;
  assert(doc.evidenceKind === expectedKind, `Evidence kind must be ${expectedKind}`);
  assert(doc.buildIdentity.commitSha === expectedCommit, "Build commit does not match final STEP 06 identity");
  assert(doc.parentAuthorization.feedbackSha256 === STEP06_PARENT_FEEDBACK_SHA256, "Parent feedback SHA mismatch");
  assert(doc.parentAuthorization.candidateCommit === STEP06_PARENT_CANDIDATE_COMMIT, "Parent candidate commit mismatch");
  assert(doc.parentAuthorization.evidenceSha256 === STEP06_PARENT_EVIDENCE_SHA256, "Parent evidence SHA mismatch");
  assert(doc.parentAuthorization.candidateRevision === STEP06_PARENT_CANDIDATE_REVISION, "Parent candidate revision mismatch");
  assert(doc.parentAuthorization.authorizeDefaultWorldEntry === "YES" && doc.parentAuthorization.authorizeSecondUseCheck === "YES", "Both STEP 05 authorizations must be YES");
  assert(doc.sessionIdentity.canonicalOrigin === STEP06_CANONICAL_ORIGIN, "Canonical origin mismatch");
  assert(doc.progressContinuity.originMatched && doc.progressContinuity.canonicalSavePresent && doc.progressContinuity.completedAndComplete, "Progress continuity is incomplete");
  assert(!doc.progressContinuity.recoveredFromCorruption, "Corruption recovery cannot establish continuity");
  assert(REQUIRED_IDS.every((id) => doc.progressContinuity.discoveredCharacterIds.includes(id)), "Four accepted characters are not present");
  assert(Object.values(doc.progressContinuity.campRepairFlags).every(Boolean), "Camp repairs are incomplete");
  assert(doc.completion.sessionStopped && doc.completion.stopCode !== null, "Formal observation must be stopped before FINISH");
  assert(doc.technicalEvents.length > 0 && doc.technicalEvents[0].eventType === "session_opened", "Event sequence must start with session_opened");
  assert(doc.technicalEvents.some((event) => event.eventType === "progress_continuity_verified"), "Continuity event is missing");
  assert(doc.technicalEvents.some((event) => event.eventType === "session_stopped"), "Event sequence must include session_stopped");
  assert(doc.technicalEvents.every((event) => event.sessionId === doc.sessionIdentity.sessionId), "Event session identity mismatch");
  assert(validateStep06Privacy(doc.technicalEvents), "Unsafe technical metadata detected");
  assert(!hasForbiddenField(doc), "PII, media, storage dump, raw input, or automatic-decision field detected");
  assert(!FORBIDDEN_NOTES.test(doc.observerNotes), "Observer notes contain forbidden identifying or remote content");
  return doc;
}

function fixtureProjection(): Step06ProgressContinuityProjection {
  return {
    originMatched: true,
    canonicalSavePresent: true,
    completedAndComplete: true,
    discoveredCharacterIds: [...REQUIRED_IDS],
    campRepairFlags: { lamp: true, flowers: true, guardianTrees: true, starPath: true },
    recoveredFromCorruption: false,
  };
}

function fixtureEvents(sessionId: string): Step06TechnicalEvent[] {
  const rows: Array<[number, number, Step06TechnicalEvent["eventType"], Step06TechnicalEvent["safeMetadata"]]> = [
    [1, 0, "session_opened", {}],
    [2, 10, "world_ready", {}],
    [3, 20, "progress_continuity_verified", { completed: true }],
    [4, 120, "world_first_action", {}],
    [5, 120, "world_destination_opened", { destinationId: "FOREST" }],
    [6, 240, "forest_entered", {}],
    [7, 260, "golden_phase_entered", { phase: "camp_intro" }],
    [8, 2400, "ability_selected", { abilityId: "ink-echo" }],
    [9, 2800, "golden_phase_entered", { phase: "run_complete" }],
    [10, 2800, "golden_run_completed", { completed: true }],
    [11, 2950, "world_ready", {}],
    [12, 2960, "returned_to_world", { worldReturned: true }],
    [13, 3000, "session_stopped", {}],
  ];
  return rows.map(([sequence, relativeMs, eventType, safeMetadata]) => ({ schemaVersion: 1, sessionId, sequence, relativeMs, eventType, safeMetadata }));
}

export function createStep06Fixture(commitSha: string): Step06ObservationDocument {
  assert(/^[0-9a-f]{40}$/i.test(commitSha), "Fixture build commit must be a full SHA");
  const sessionId = `s06-fixture-${commitSha.slice(0, 12)}`;
  const startedAtMs = Date.parse("2026-08-09T14:00:00.000Z");
  const grant: Step06SessionGrant = {
    schemaVersion: 1,
    sessionId,
    evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY",
    buildCommit: commitSha,
    technicalState: STEP06_TECHNICAL_STATE,
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
  return buildStep06Observation(grant, {
    events: fixtureEvents(sessionId),
    observations: emptyStep06Observations(),
    interventions: [],
    wellbeing: emptyStep06Wellbeing(),
    childRouteLoaded: true,
    stopCode: "NATURAL_END",
    observerNotes: "Synthetic fixture dry-run only; no child data and no automatic decision.",
    nowMs: startedAtMs + 3000,
  });
}

export function step06Summary(doc: Step06ObservationDocument): string {
  const d = doc.derivedActions;
  const treasureOpened = doc.technicalEvents.some((event) => event.eventType === "world_destination_opened" && event.safeMetadata.destinationId === "TREASURE_BOX");
  const world = doc.observations.worldRecognition;
  const engagement = doc.observations.engagement;
  const interventionSummary = doc.interventions.length
    ? doc.interventions.map((item) => `${item.checkpointId}:${item.code}:${item.region ?? "NO_REGION"}`).join(", ")
    : "NONE_RECORDED";
  const wellbeingSummary = Object.entries(doc.wellbeing).map(([key, value]) => `${key}=${value}`).join(", ");
  return `# STEP 06 Second-use Summary\n\nEvidence kind: \`${doc.evidenceKind}\`\n\n## Technical facts\n\n- Origin: \`${doc.sessionIdentity.canonicalOrigin}\`\n- Progress continuity: \`${doc.progressContinuity.completedAndComplete}\`\n- First world action (relative ms): \`${d.firstWorldActionMs ?? "UNRECORDED"}\`\n- First destination: \`${d.firstDestination ?? "UNRECORDED"}\`\n- Forest entered: \`${d.forestEntered}\`\n- Spellbook opened: \`${d.worldSpellbookOpened}\`\n- Treasure selected: \`${treasureOpened}\`\n- Classic hub opened: \`${d.classicHubOpened}\`\n- Full run completed: \`${d.goldenRunCompleted}\`\n- Returned to world: \`${d.returnedToWorld}\`\n- World loop completed: \`${d.worldLoopCompleted}\`\n- Technical errors: \`${doc.technicalEvents.filter((event) => event.eventType === "technical_error").length}\`\n- Duration (relative ms): \`${doc.completion.relativeDurationMs}\`\n\n## Human observations\n\n- World recognition: \`${world.recognizedWorld}\`\n- Persistence notice: \`${world.noticedPersistentRepairs}\`\n- Interventions: \`${interventionSummary}\`\n- Engagement: \`voluntarilyContinued=${engagement.voluntarilyContinued}, exploredAnotherWorldObject=${engagement.exploredAnotherWorldObject}, askedForMoreAfterOfficialCheck=${engagement.askedForMoreAfterOfficialCheck}\`\n- Wellbeing: \`${wellbeingSummary}\`\n\nThese parent-entered observations are not replaced by technical events.\n\n## Explicitly not concluded\n\nNo conclusion is made about long-term engagement, learning effectiveness, retention, remaining-eight readiness, a full Ink Forest, or production-art preference. This summary contains no automatic PASS/FAIL.\n`;
}

function main(): void {
  const [command, inputPath, outputPath, kind, commit] = process.argv.slice(2);
  if (command === "generate-fixture") {
    const doc = createStep06Fixture(inputPath);
    writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    return;
  }
  if (command === "validate-summary") {
    const value = JSON.parse(readFileSync(inputPath, "utf8"));
    const doc = validateStep06Return(value, kind as Step06EvidenceKind, commit);
    writeFileSync(outputPath, step06Summary(doc), "utf8");
    return;
  }
  throw new Error("Usage: generate-fixture <commit> <output> OR validate-summary <input> <summary> <kind> <commit>");
}

if (process.argv[1] && /step06-contract\.(?:ts|js)$/i.test(process.argv[1])) main();
