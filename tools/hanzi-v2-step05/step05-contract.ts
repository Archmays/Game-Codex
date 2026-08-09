import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { normalizeFirstUseObservation } from "../../apps/hanzi-v2-step04-observer/observation-schema";
import {
  deriveFirstUseTechnicalTimeline,
  reconcileFirstUseEvidence,
} from "../../apps/hanzi-v2-step04-observer/evidence-reconciliation";

type JsonRecord = Record<string, unknown>;

interface Step05ReviewIdentity {
  readonly candidateCommit: string;
  readonly evidenceSha256: string;
  readonly candidateRevision: string;
}

interface Step05ParentReviewFeedback {
  readonly reviewContractVersion: string;
  readonly reviewRound: number;
  readonly identity: Step05ReviewIdentity;
  readonly decisions: readonly {
    readonly itemId: string;
    readonly revisionHash: string;
    readonly decision: string;
    readonly notes: string;
    readonly carriedForward: boolean;
  }[];
  readonly authorizeDefaultWorldEntry: "YES" | "NO";
  readonly authorizeSecondUseCheck: "YES" | "NO";
  readonly generalNotes: string;
  readonly reviewMeta: {
    readonly exportedAtUtc: string;
  };
}

interface Step05ReviewRuntime {
  readonly evidenceSha256: string;
  readonly returnPackageSha256: string;
  readonly provisionalDecision: string;
  readonly notConcluded: readonly string[];
  readonly reviewContractVersion: string;
  readonly candidateRevision: string;
  readonly reviewItemIds: readonly string[];
  readonly reviewItems: readonly {
    readonly id: string;
    readonly revisionHash: string;
  }[];
  readonly createReviewDraft: (identity: Step05ReviewIdentity) => JsonRecord;
  readonly finalizeReviewDraft: (draft: JsonRecord, now?: Date) => Step05ParentReviewFeedback;
  readonly isParentReviewFeedback: (value: unknown) => boolean;
  readonly validateNotes: (value: string) => readonly string[];
  readonly step03ReviewIdentity: {
    readonly sourceSnapshots: Record<string, string>;
  };
  readonly content: {
    readonly FINAL_GOLDEN_MANIFEST: readonly unknown[];
    readonly FIRST_RUN_CHARACTER_IDS: readonly string[];
    readonly GOLDEN_ABILITIES: readonly { readonly id: string }[];
    readonly GOLDEN_BOSS_PHASES: readonly { readonly id: string }[];
    readonly GOLDEN_SLICE_ENCOUNTERS: readonly unknown[];
    readonly GOLDEN_SLICE_MANIFEST_REVISION_HASH: string;
    readonly THEME_C_PROCEDURAL_ASSETS: readonly unknown[];
  };
}

export const INITIATIVE_ID = "hanzi-radical-battle-v2";
export const STEP = "05";
export const REVIEW_FILE_NAME = "STEP-05_PARENT_REVIEW_FEEDBACK.json";
export const EXPECTED_OBSERVED_BUILD_COMMIT = "388370d69ab469b7ee0657047b001485fbe58395";
export const EXPECTED_EVIDENCE_SHA256 = "EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8";
export const EXPECTED_RETURN_PACKAGE_SHA256 = "FEE13257ECF3402CDB85D6153D08FCF9A3082CD208EE88B10BABA8978E1F6612";
export const EXPECTED_SOURCE_SNAPSHOTS = Object.freeze({
  encounters: "fnv1a:d805357d",
  abilities: "fnv1a:2d361817",
  boss: "fnv1a:ee5df70f",
  themeC: "fnv1a:15133968",
  manifest: "fnv1a:67ad1fe2",
});

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const PII_PATTERN = /(?:real\s*name|child\s*name|student\s*name|姓名\s*[:：]|真实姓名|学校\s*[:：]|班级\s*[:：]|电话\s*[:：]|手机\s*[:：]|地址\s*[:：]|身份证|微信\s*[:：]|(?:e-?mail|邮箱)\s*[:：]|\b1[3-9]\d{9}\b|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|[A-Z]:\\|file:\/\/|https?:\/\/|sessionId)/iu;

let runtimePromise: Promise<Step05ReviewRuntime> | null = null;

async function loadStep05ReviewRuntime(): Promise<Step05ReviewRuntime> {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const server = await createServer({
      root: repositoryRoot,
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true },
    });
    try {
      const [evidence, items, schema, step03Identity, content] = await Promise.all([
        server.ssrLoadModule("/apps/hanzi-v2-step05-review/review-evidence.ts"),
        server.ssrLoadModule("/apps/hanzi-v2-step05-review/review-items.ts"),
        server.ssrLoadModule("/apps/hanzi-v2-step05-review/review-schema.ts"),
        server.ssrLoadModule("/apps/hanzi-v2-step03-review/review-identity.ts"),
        server.ssrLoadModule("/games/hanzi-radical-battle/v2/golden-slice/content/index.ts"),
      ]);
      return {
        evidenceSha256: evidence.STEP05_EVIDENCE_SHA256 as string,
        returnPackageSha256: evidence.STEP04_RETURN_PACKAGE_SHA256 as string,
        provisionalDecision: evidence.STEP05_PROVISIONAL_DECISION as string,
        notConcluded: evidence.STEP05_SAFE_EVIDENCE.notConcluded as readonly string[],
        reviewContractVersion: schema.STEP05_REVIEW_CONTRACT_VERSION as string,
        candidateRevision: items.STEP05_REVIEW_CANDIDATE_REVISION as string,
        reviewItemIds: items.STEP05_REVIEW_ITEM_IDS as readonly string[],
        reviewItems: items.STEP05_REVIEW_ITEMS as Step05ReviewRuntime["reviewItems"],
        createReviewDraft: schema.createStep05ReviewDraft as Step05ReviewRuntime["createReviewDraft"],
        finalizeReviewDraft: schema.finalizeStep05ReviewDraft as Step05ReviewRuntime["finalizeReviewDraft"],
        isParentReviewFeedback: schema.isStep05ParentReviewFeedback as Step05ReviewRuntime["isParentReviewFeedback"],
        validateNotes: schema.validateNotes as Step05ReviewRuntime["validateNotes"],
        step03ReviewIdentity: step03Identity.STEP03_REVIEW_IDENTITY as Step05ReviewRuntime["step03ReviewIdentity"],
        content: content as Step05ReviewRuntime["content"],
      };
    } finally {
      await server.close();
    }
  })();
  return runtimePromise;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

async function parseJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fileSha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(resolve(path))).digest("hex").toUpperCase();
}

export async function createStep05CandidateRevision(): Promise<string> {
  return (await loadStep05ReviewRuntime()).candidateRevision;
}

export async function createStep05ReviewIdentity(candidateCommit: string): Promise<Step05ReviewIdentity> {
  if (!COMMIT_PATTERN.test(candidateCommit)) throw new Error("candidate commit must be a full lowercase 40-hex Git SHA");
  const runtime = await loadStep05ReviewRuntime();
  return {
    candidateCommit,
    evidenceSha256: runtime.evidenceSha256,
    candidateRevision: runtime.candidateRevision,
  };
}

async function currentSourceSnapshotErrors(runtime: Step05ReviewRuntime): Promise<string[]> {
  const errors: string[] = [];
  const actual = {
    ...runtime.step03ReviewIdentity.sourceSnapshots,
    manifest: runtime.content.GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  };
  for (const [key, expected] of Object.entries(EXPECTED_SOURCE_SNAPSHOTS)) {
    if (actual[key as keyof typeof actual] !== expected) errors.push(`frozen source '${key}' changed`);
  }
  if (runtime.content.FINAL_GOLDEN_MANIFEST.length !== 12) errors.push("frozen manifest cardinality changed");
  if (JSON.stringify(runtime.content.FIRST_RUN_CHARACTER_IDS) !== JSON.stringify(["ming", "hua", "lin", "xing"])) errors.push("first-run character IDs changed");
  if (runtime.content.GOLDEN_SLICE_ENCOUNTERS.length !== 4) errors.push("encounter cardinality changed");
  if (JSON.stringify(runtime.content.GOLDEN_ABILITIES.map(({ id }) => id)) !== JSON.stringify(["guardian-light", "star-path", "ink-echo"])) errors.push("ability IDs changed");
  if (JSON.stringify(runtime.content.GOLDEN_BOSS_PHASES.map(({ id }) => id)) !== JSON.stringify(["lin", "xing"])) errors.push("boss phases changed");
  if (runtime.content.THEME_C_PROCEDURAL_ASSETS.length === 0) errors.push("Theme C asset manifest is empty");
  return errors;
}

function rawEvidenceErrors(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["raw evidence root must be an object"];
  if (value.schemaVersion !== 1 || value.initiativeId !== INITIATIVE_ID || value.step !== "04") errors.push("raw evidence schema identity is invalid");
  if (value.evidenceKind !== "REAL_CHILD_OBSERVATION") errors.push("raw evidence kind is not REAL_CHILD_OBSERVATION");
  if (value.privacyConfirmed !== true) errors.push("raw evidence privacyConfirmed is not true");
  const build = isRecord(value.buildIdentity) ? value.buildIdentity : null;
  if (!build) {
    errors.push("raw evidence build identity is missing");
  } else {
    if (build.commitSha !== EXPECTED_OBSERVED_BUILD_COMMIT) errors.push("raw evidence observed build commit changed");
    const snapshots = isRecord(build.acceptedSourceSnapshots) ? build.acceptedSourceSnapshots : null;
    if (!snapshots) errors.push("raw evidence accepted source snapshots are missing");
    else for (const [key, expected] of Object.entries(EXPECTED_SOURCE_SNAPSHOTS)) {
      if (snapshots[key] !== expected) errors.push(`raw evidence frozen source '${key}' changed`);
    }
  }
  const completion = isRecord(value.completion) ? value.completion : null;
  if (!completion || completion.runCompleted !== true || completion.relativeDurationMs !== 63_241 || completion.runCount !== 1) {
    errors.push("raw evidence completion identity changed");
  }
  if (!Array.isArray(value.technicalEvents) || value.technicalEvents.length !== 56) errors.push("raw evidence technical event count changed");
  return errors;
}

async function readinessCommand(): Promise<void> {
  const rawEvidencePath = argument("--raw-evidence");
  const returnPackagePath = argument("--return-package");
  const outputPath = argument("--output");
  const commit = argument("--commit");
  if (!rawEvidencePath || !returnPackagePath || !outputPath || !commit) {
    throw new Error("readiness requires --raw-evidence, --return-package, --output, and --commit");
  }

  const errors: string[] = [];
  const runtime = await loadStep05ReviewRuntime();
  if (runtime.evidenceSha256 !== EXPECTED_EVIDENCE_SHA256) errors.push("review runtime canonical evidence SHA-256 changed");
  if (runtime.returnPackageSha256 !== EXPECTED_RETURN_PACKAGE_SHA256) errors.push("review runtime STEP 04 package SHA-256 changed");
  let rawEvidence: unknown = null;
  let rawEvidenceSha256: string | null = null;
  let returnPackageSha256: string | null = null;
  try {
    rawEvidenceSha256 = await fileSha256(rawEvidencePath);
    if (rawEvidenceSha256 !== EXPECTED_EVIDENCE_SHA256) errors.push("canonical raw evidence SHA-256 mismatch");
    rawEvidence = await parseJson(rawEvidencePath);
    errors.push(...rawEvidenceErrors(rawEvidence));
  } catch (error) {
    errors.push(`canonical raw evidence could not be read: ${String(error)}`);
  }
  try {
    returnPackageSha256 = await fileSha256(returnPackagePath);
    if (returnPackageSha256 !== EXPECTED_RETURN_PACKAGE_SHA256) errors.push("STEP 04 child return package SHA-256 mismatch");
  } catch (error) {
    errors.push(`STEP 04 child return package could not be read: ${String(error)}`);
  }
  errors.push(...await currentSourceSnapshotErrors(runtime));

  let identity: Step05ReviewIdentity | null = null;
  try {
    identity = await createStep05ReviewIdentity(commit);
  } catch (error) {
    errors.push(String(error));
  }
  const valid = errors.length === 0;
  await writeJson(outputPath, {
    schemaVersion: 1,
    initiativeId: INITIATIVE_ID,
    step: STEP,
    valid,
    code: valid ? "STEP05_PARENT_REVIEW_READY" : "FAIL_STEP05_REVIEW_READINESS",
    errors,
    identity,
    evidenceIdentity: {
      rawEvidenceSha256,
      childReturnPackageSha256: returnPackageSha256,
      observedBuildCommit: EXPECTED_OBSERVED_BUILD_COMMIT,
    },
    sourceSnapshots: EXPECTED_SOURCE_SNAPSHOTS,
  });
  if (!valid) process.exitCode = 2;
}

function sessionIdentity(value: unknown, errors: string[]): Step05ReviewIdentity | null {
  if (!isRecord(value)) {
    errors.push("session state must be an object");
    return null;
  }
  if (value.schemaVersion !== 1 || value.initiativeId !== INITIATIVE_ID || value.step !== STEP) errors.push("session state identity is invalid");
  if (typeof value.fixture !== "boolean") errors.push("session state fixture marker is invalid");
  if (typeof value.startedAtUtc !== "string" || !ISO_UTC_PATTERN.test(value.startedAtUtc) || Number.isNaN(Date.parse(value.startedAtUtc))) errors.push("session state start time is invalid");
  if (!isRecord(value.identity)) {
    errors.push("session state review identity is missing");
    return null;
  }
  return {
    candidateCommit: typeof value.identity.candidateCommit === "string" ? value.identity.candidateCommit : "",
    evidenceSha256: typeof value.identity.evidenceSha256 === "string" ? value.identity.evidenceSha256 : "",
    candidateRevision: typeof value.identity.candidateRevision === "string" ? value.identity.candidateRevision : "",
  };
}

function privacyErrors(feedback: Step05ParentReviewFeedback, runtime: Step05ReviewRuntime): string[] {
  const errors: string[] = [];
  const textFields = [
    ...feedback.decisions.map(({ itemId, notes }) => ({ label: `${itemId}.notes`, value: notes })),
    { label: "generalNotes", value: feedback.generalNotes },
  ];
  for (const { label, value } of textFields) {
    for (const issue of runtime.validateNotes(value)) errors.push(`${label}: ${issue}`);
    if (PII_PATTERN.test(value)) errors.push(`${label} contains a disallowed personal identity, path, session, or remote-address marker`);
  }
  return errors;
}

export async function validateStep05Feedback(
  feedbackValue: unknown,
  sessionValue: unknown,
): Promise<{
  valid: boolean;
  errors: string[];
  identity: Step05ReviewIdentity | null;
  decisions: readonly { itemId: string; decision: string; carriedForward: boolean }[];
  authorizations: { authorizeDefaultWorldEntry: string | null; authorizeSecondUseCheck: string | null };
}> {
  const errors: string[] = [];
  const runtime = await loadStep05ReviewRuntime();
  const identity = sessionIdentity(sessionValue, errors);
  if (!runtime.isParentReviewFeedback(feedbackValue)) {
    errors.push("feedback does not match the exact STEP 05 parent review schema or is incomplete");
    return {
      valid: false,
      errors,
      identity,
      decisions: [],
      authorizations: { authorizeDefaultWorldEntry: null, authorizeSecondUseCheck: null },
    };
  }
  const feedback = feedbackValue as Step05ParentReviewFeedback;
  const currentRevision = runtime.candidateRevision;
  if (!identity) {
    errors.push("feedback cannot be bound without a valid START session identity");
  } else {
    if (feedback.identity.candidateCommit !== identity.candidateCommit) errors.push("feedback candidate commit does not match START");
    if (feedback.identity.evidenceSha256 !== identity.evidenceSha256) errors.push("feedback evidence SHA-256 does not match START");
    if (feedback.identity.candidateRevision !== identity.candidateRevision) errors.push("feedback candidate revision does not match START");
    if (identity.evidenceSha256 !== EXPECTED_EVIDENCE_SHA256) errors.push("START evidence SHA-256 is not canonical");
    if (identity.candidateRevision !== currentRevision) errors.push("current STEP 05 review revision differs from START");
    if (!COMMIT_PATTERN.test(identity.candidateCommit)) errors.push("START candidate commit is malformed");
  }
  if (feedback.reviewContractVersion !== runtime.reviewContractVersion) errors.push("feedback review contract version changed");
  const seen = new Set<string>();
  for (const decision of feedback.decisions) {
    if (seen.has(decision.itemId)) errors.push(`duplicate decision item '${decision.itemId}'`);
    seen.add(decision.itemId);
    const current = runtime.reviewItems.find(({ id }) => id === decision.itemId);
    if (!current) errors.push(`unknown decision item '${decision.itemId}'`);
    else if (decision.revisionHash !== current.revisionHash) errors.push(`decision '${decision.itemId}' revision hash is stale`);
    if (decision.carriedForward && decision.decision !== "ACCEPT") errors.push(`decision '${decision.itemId}' cannot carry forward a non-ACCEPT result`);
    if (feedback.reviewRound === 1 && decision.carriedForward) errors.push(`Round 1 decision '${decision.itemId}' cannot be carried forward`);
  }
  for (const itemId of runtime.reviewItemIds) if (!seen.has(itemId)) errors.push(`missing decision item '${itemId}'`);
  if (!ISO_UTC_PATTERN.test(feedback.reviewMeta.exportedAtUtc) || Number.isNaN(Date.parse(feedback.reviewMeta.exportedAtUtc))) errors.push("review export time is not a valid UTC ISO date-time");
  errors.push(...privacyErrors(feedback, runtime));
  return {
    valid: errors.length === 0,
    errors,
    identity,
    decisions: feedback.decisions.map(({ itemId, decision, carriedForward }) => ({ itemId, decision, carriedForward })),
    authorizations: {
      authorizeDefaultWorldEntry: feedback.authorizeDefaultWorldEntry,
      authorizeSecondUseCheck: feedback.authorizeSecondUseCheck,
    },
  };
}

async function validateFeedbackCommand(): Promise<void> {
  const feedbackPath = argument("--feedback");
  const sessionStatePath = argument("--session-state");
  const outputPath = argument("--output");
  if (!feedbackPath || !sessionStatePath || !outputPath) throw new Error("validate-feedback requires --feedback, --session-state, and --output");
  let feedback: unknown = null;
  let session: unknown = null;
  const parseErrors: string[] = [];
  try { feedback = await parseJson(feedbackPath); } catch (error) { parseErrors.push(`feedback JSON could not be parsed: ${String(error)}`); }
  try { session = await parseJson(sessionStatePath); } catch (error) { parseErrors.push(`session state JSON could not be parsed: ${String(error)}`); }
  const result = parseErrors.length
    ? {
      valid: false,
      errors: parseErrors,
      identity: null,
      decisions: [],
      authorizations: { authorizeDefaultWorldEntry: null, authorizeSecondUseCheck: null },
    }
    : await validateStep05Feedback(feedback, session);
  await writeJson(outputPath, {
    schemaVersion: 1,
    initiativeId: INITIATIVE_ID,
    step: STEP,
    valid: result.valid,
    code: result.valid ? "VALID_PARENT_REVIEW_FEEDBACK" : "FAIL_STEP05_PARENT_REVIEW_FEEDBACK",
    errors: result.errors,
    feedbackSha256: await fileSha256(feedbackPath).catch(() => null),
    identity: result.identity,
    decisions: result.decisions,
    authorizations: result.authorizations,
    automaticDecision: null,
    parentAcceptanceInferred: false,
  });
  if (!result.valid) process.exitCode = 3;
}

async function fixtureFeedbackCommand(): Promise<void> {
  const sessionStatePath = argument("--session-state");
  const outputPath = argument("--output");
  if (!sessionStatePath || !outputPath) throw new Error("fixture-feedback requires --session-state and --output");
  const session = await parseJson(sessionStatePath);
  const errors: string[] = [];
  const identity = sessionIdentity(session, errors);
  if (!identity || errors.length) throw new Error(errors.join("; "));
  const runtime = await loadStep05ReviewRuntime();
  const draft = runtime.createReviewDraft(identity) as JsonRecord & { decisions: Array<JsonRecord & { itemId: string }> };
  const decisions = draft.decisions.map((entry) => ({
    ...entry,
    decision: (entry.itemId === "private-world-shell" ? "REJECT" : "REVISE") as "REVISE" | "REJECT",
    notes: "SYNTHETIC_TOOLING_TEST_ONLY - no parent acceptance is represented.",
  }));
  const fixture = runtime.finalizeReviewDraft({
    ...draft,
    decisions,
    authorizeDefaultWorldEntry: "NO",
    authorizeSecondUseCheck: "NO",
    generalNotes: "SYNTHETIC_TOOLING_TEST_ONLY - validator and package fixture only.",
  }, new Date("2026-01-01T00:00:00.000Z"));
  await writeJson(outputPath, fixture);
}

async function deriveEvidenceCommand(): Promise<void> {
  const rawEvidencePath = argument("--raw-evidence");
  const outputPath = argument("--output");
  if (!rawEvidencePath || !outputPath) throw new Error("derive-evidence requires --raw-evidence and --output");
  if (resolve(outputPath).split(/[\\/]/u).at(-1) !== "STEP-05-FIRST-USE-EVIDENCE-DERIVED.json") {
    throw new Error("derive-evidence requires the fixed STEP-05-FIRST-USE-EVIDENCE-DERIVED.json filename");
  }
  const sourceEvidenceSha256 = await fileSha256(rawEvidencePath);
  if (sourceEvidenceSha256 !== EXPECTED_EVIDENCE_SHA256) throw new Error("canonical raw evidence SHA-256 mismatch; no derived artifact was written");
  const rawEvidence = await parseJson(rawEvidencePath);
  const identityErrors = rawEvidenceErrors(rawEvidence);
  if (identityErrors.length) throw new Error(`canonical raw evidence identity is invalid: ${identityErrors.join("; ")}`);

  const normalized = normalizeFirstUseObservation(rawEvidence);
  const reconciled = reconcileFirstUseEvidence(normalized.value, normalized.warnings);
  const timeline = deriveFirstUseTechnicalTimeline(reconciled.technicalEvents);
  const runtime = await loadStep05ReviewRuntime();
  await writeJson(outputPath, {
    schemaVersion: 1,
    artifactKind: "PRIVACY_SAFE_DERIVED_EVIDENCE",
    sourceEvidenceSha256,
    timeline,
    checkpointReach: reconciled.observations.checkpointReach,
    replay: {
      replayIntent: reconciled.replay.replayIntent,
      parentObservedReplayRequest: reconciled.replay.parentObservedReplayRequest,
      actualReplayAction: reconciled.replay.actualReplayAction,
      runCount: reconciled.completion.runCount,
    },
    warnings: reconciled.evidenceConsistencyWarnings,
    provisionalDecision: runtime.provisionalDecision,
    notConcluded: runtime.notConcluded,
  });
}

async function identityCommand(): Promise<void> {
  const commit = argument("--commit");
  if (!commit) throw new Error("identity requires --commit");
  process.stdout.write(`${JSON.stringify(await createStep05ReviewIdentity(commit))}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "readiness") return readinessCommand();
  if (command === "validate-feedback") return validateFeedbackCommand();
  if (command === "fixture-feedback") return fixtureFeedbackCommand();
  if (command === "derive-evidence") return deriveEvidenceCommand();
  if (command === "identity") return identityCommand();
  throw new Error("Usage: step05-contract.ts readiness|validate-feedback|fixture-feedback|derive-evidence|identity [arguments]");
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) : false;
if (isMain) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
