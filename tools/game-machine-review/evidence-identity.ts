import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  computeMachineReviewSourceTreeSha256,
  listUntrackedMachineReviewSourceFiles,
} from "./source-identity";
import {
  STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH,
  validateStaticMachineReportScrollEvidence,
  type StaticMachineReportScrollEvidence,
} from "./static-report-scroll-evidence";

const MANIFEST_NAME = "EVIDENCE-MANIFEST.json";
const REPORT_NAME = "MACHINE-REVIEW-REPORT.json";
const VERDICT_NAME = "MACHINE-REVIEW-VERDICT.json";
const DERIVED_SEAL_NAME = "DERIVED-OUTPUT-SEAL.json";

export const STEP07_EXCEPTIONAL_REPAIR_01_ID = "HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_01" as const;
export const STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/repair-rounds/exceptional-repair-01/EXCEPTION_CONTRACT.json" as const;
export const STEP07_EXCEPTION_01_ORIGINAL_BLOCKER = "THREE_REPAIR_LOOPS_FAILED" as const;
export const STEP07_EXCEPTION_01_ROOT_CAUSE = "ROW_UNIQUENESS_CONFUSED_WITH_CONTEXT_UNIQUENESS" as const;
export const STEP07_EXCEPTION_01_RESOLUTION = "CANONICAL_ROW_TO_CONTEXT_MAPPING_WITH_SEQUENTIAL_REUSE" as const;

export const STEP07_EXCEPTIONAL_REPAIR_02_ID =
  "HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_02_VISUAL_HARNESS_SEQUENCE_ONLY" as const;
export const STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/repair-rounds/exceptional-repair-02/EXCEPTION_CONTRACT.json" as const;
export const STEP07_EXCEPTION_02_ORIGINAL_BLOCKER = "POST_EXCEPTION_UNRELATED_VISUAL_HARNESS_BLOCKER" as const;
export const STEP07_EXCEPTION_02_ROOT_CAUSE = "VISUAL_HARNESS_START_ACTION_ORDER_INVERTED" as const;
export const STEP07_EXCEPTION_02_RESOLUTION = "PUBLIC_START_ACTION_BEFORE_CAMP_CAPTURE" as const;

export const STEP07_EXCEPTIONAL_REPAIR_03_ID =
  "HUMAN_AUTHORIZED_EXCEPTIONAL_REPAIR_03_VISUAL_HARNESS_REDUCED_MOTION_ONLY" as const;
export const STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/repair-rounds/exceptional-repair-03/EXCEPTION_CONTRACT.json" as const;
export const STEP07_EXCEPTION_03_ORIGINAL_BLOCKER = "POST_EXCEPTION_02_UNRELATED_VISUAL_CANVAS_STABILITY_BLOCKER" as const;
export const STEP07_EXCEPTION_03_ROOT_CAUSE =
  "PHASER_CANVAS_INFINITE_TWEEN_NOT_FROZEN_BY_PLAYWRIGHT_CSS_ANIMATION_CONTROL" as const;
export const STEP07_EXCEPTION_03_RESOLUTION = "PRODUCT_SUPPORTED_REDUCED_MOTION_VISUAL_HARNESS" as const;

export const STEP07_EXCEPTIONAL_REPAIR_IDS = [
  STEP07_EXCEPTIONAL_REPAIR_01_ID,
  STEP07_EXCEPTIONAL_REPAIR_02_ID,
  STEP07_EXCEPTIONAL_REPAIR_03_ID,
] as const;

export const STEP07_CLOSED_RECOVERY_ID = "HUMAN_AUTHORIZED_STEP07_CLOSED_RECOVERY_01" as const;
export const STEP07_FINAL_CLOSURE_AUTHORIZATION_ID =
  "HUMAN_AUTHORIZED_STEP07_FINAL_CLOSURE_SKILL_CLEANUP_ASSET_FOUNDRY_01" as const;
export const STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/recovery-preflight/CLOSED-RECOVERY-FREEZE.json" as const;
export const STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/recovery-preflight/CLOSED-RECOVERY-STOPPED.json" as const;
export const STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE =
  "artifacts/game-machine-review/step-07/final-closure/STEP07-FINAL-CLOSURE-CHARTER.json" as const;
export const STEP07_AUTHORIZATION_LINEAGE_EVIDENCE_FILES = [
  STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE,
  STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE,
  STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE,
] as const;

// Kept as aliases for callers that still need to identify the first preserved
// repair artifact directly. Final lineage must use STEP07_EXCEPTIONAL_REPAIR_IDS.
export const STEP07_EXCEPTIONAL_REPAIR_ID = STEP07_EXCEPTIONAL_REPAIR_01_ID;
export const STEP07_EXCEPTION_AUTHORIZATION_EVIDENCE_FILE = STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE;
export const STEP07_EXCEPTION_ORIGINAL_BLOCKER = STEP07_EXCEPTION_01_ORIGINAL_BLOCKER;
export const STEP07_EXCEPTION_ROOT_CAUSE = STEP07_EXCEPTION_01_ROOT_CAUSE;
export const STEP07_EXCEPTION_RESOLUTION = STEP07_EXCEPTION_01_RESOLUTION;

const DERIVED_OUTPUT_PATHS = new Set([
  MANIFEST_NAME,
  REPORT_NAME,
  VERDICT_NAME,
  "MACHINE-REVIEW-SUMMARY.md",
  "MACHINE-REVIEW-REPORT.html",
  "route-inventory.json",
  DERIVED_SEAL_NAME,
  "STEP-07_MACHINE_QA_REAL_SECOND_USE_READINESS_RETURN_TO_CHATGPT.zip",
  "STEP-07_MACHINE_QA_REAL_SECOND_USE_READINESS_RETURN_TO_CHATGPT.zip.sha256",
  "CLEANUP-PLAN.json",
  "CLEANUP-RESULT.json",
  "PROJECT_HYGIENE_VERDICT.json",
  "final-closure/RETURN-PACKAGE-INVENTORY.json",
  "final-closure/POST-PACKAGE-CLEANUP-CONTRACT.json",
]);

const HASH_PATTERN = /^[A-F0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export interface EvidenceManifestEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface EvidenceManifest {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly sourceTreeSha256: string;
  readonly generatedAtUtc: string;
  readonly evidenceTreeSha256: string;
  readonly entries: readonly EvidenceManifestEntry[];
}

export interface WrittenEvidenceManifest {
  readonly manifest: EvidenceManifest;
  readonly manifestPath: string;
  readonly evidenceManifestSha256: string;
}

export interface VerifiedEvidenceIdentity {
  readonly sourceTreeSha256: string;
  readonly evidenceTreeSha256: string;
  readonly evidenceManifestSha256: string;
  readonly entryCount: number;
}

export interface VerifyStep07ReadinessOptions {
  readonly workspaceRoot?: string;
  readonly outputDirectory: string;
  readonly expectedCommit: string;
}

export interface Step07ExceptionalRepairRecord {
  readonly exceptionalRepairId: string;
  readonly originalBlocker: string;
  readonly rootCause: string;
  readonly resolution: string;
  readonly authorizationEvidenceFile: string;
}

export interface Step07ExceptionalRepairMetadata {
  readonly repairRoundsConsumed: 3;
  readonly humanExceptionalRepairs: 3;
  readonly ordinaryAutoReviseLoop: false;
  readonly closedRecoveryAuthorizations: 1;
  readonly finalClosureAuthorizations: 1;
  readonly exceptionalRepairs: readonly [
    {
      readonly exceptionalRepairId: typeof STEP07_EXCEPTIONAL_REPAIR_01_ID;
      readonly originalBlocker: typeof STEP07_EXCEPTION_01_ORIGINAL_BLOCKER;
      readonly rootCause: typeof STEP07_EXCEPTION_01_ROOT_CAUSE;
      readonly resolution: typeof STEP07_EXCEPTION_01_RESOLUTION;
      readonly authorizationEvidenceFile: typeof STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE;
    },
    {
      readonly exceptionalRepairId: typeof STEP07_EXCEPTIONAL_REPAIR_02_ID;
      readonly originalBlocker: typeof STEP07_EXCEPTION_02_ORIGINAL_BLOCKER;
      readonly rootCause: typeof STEP07_EXCEPTION_02_ROOT_CAUSE;
      readonly resolution: typeof STEP07_EXCEPTION_02_RESOLUTION;
      readonly authorizationEvidenceFile: typeof STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE;
    },
    {
      readonly exceptionalRepairId: typeof STEP07_EXCEPTIONAL_REPAIR_03_ID;
      readonly originalBlocker: typeof STEP07_EXCEPTION_03_ORIGINAL_BLOCKER;
      readonly rootCause: typeof STEP07_EXCEPTION_03_ROOT_CAUSE;
      readonly resolution: typeof STEP07_EXCEPTION_03_RESOLUTION;
      readonly authorizationEvidenceFile: typeof STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE;
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO UTC timestamp`);
  }
}

function assertUtcTimestamp(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be a valid ISO UTC timestamp`);
  }
}

function normalizeWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const nativeRelative = relative(workspaceRoot, absolutePath);
  if (!nativeRelative || nativeRelative === ".." || nativeRelative.startsWith(`..\\`) || isAbsolute(nativeRelative)) {
    throw new Error(`Evidence path escapes the workspace: ${absolutePath}`);
  }
  const normalized = nativeRelative.replaceAll("\\", "/");
  if (normalized.includes("\0") || /[\r\n]/.test(normalized)) {
    throw new Error(`Evidence path contains a forbidden control character: ${normalized}`);
  }
  return normalized;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256Buffer(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex").toUpperCase();
}

export function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

function walkEvidenceFiles(directory: string, relativePrefix = ""): string[] {
  const paths: string[] = [];
  for (const child of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativePrefix ? `${relativePrefix}/${child.name}` : child.name;
    if (DERIVED_OUTPUT_PATHS.has(relativePath)) continue;
    const absolutePath = resolve(directory, child.name);
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink()) throw new Error(`Evidence must not be a symbolic link: ${relativePath}`);
    if (metadata.isDirectory()) paths.push(...walkEvidenceFiles(absolutePath, relativePath));
    else if (metadata.isFile()) paths.push(absolutePath);
  }
  return paths;
}

export function collectEvidenceManifestEntries(
  workspaceRoot: string,
  outputDirectory: string,
): readonly EvidenceManifestEntry[] {
  const workspace = resolve(workspaceRoot);
  const output = resolve(outputDirectory);
  const outputRelative = normalizeWorkspaceRelativePath(workspace, output);
  const outputMetadata = lstatSync(output);
  if (!outputMetadata.isDirectory() || outputMetadata.isSymbolicLink()) {
    throw new Error("STEP 07 evidence output must be a real directory inside the workspace");
  }
  const entries = walkEvidenceFiles(output).map((absolutePath) => {
    const path = normalizeWorkspaceRelativePath(workspace, absolutePath);
    if (path !== outputRelative && !path.startsWith(`${outputRelative}/`)) {
      throw new Error(`Evidence path leaves the STEP 07 output directory: ${path}`);
    }
    const contents = readFileSync(absolutePath);
    if (contents.byteLength === 0) throw new Error(`Evidence file is empty: ${path}`);
    return { path, bytes: contents.byteLength, sha256: sha256Buffer(contents) };
  });
  entries.sort((left, right) => ordinalCompare(left.path, right.path));
  return entries;
}

export function computeEvidenceTreeSha256(entries: readonly EvidenceManifestEntry[]): string {
  const hash = createHash("sha256");
  hash.update("GAME-CODEX-STEP07-EVIDENCE-TREE-V1\0", "utf8");
  for (const entry of entries) {
    hash.update(entry.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(entry.bytes), "utf8");
    hash.update("\0", "utf8");
    hash.update(entry.sha256, "utf8");
    hash.update("\0", "utf8");
  }
  return hash.digest("hex").toUpperCase();
}

export function createEvidenceManifest(
  workspaceRoot: string,
  outputDirectory: string,
  sourceTreeSha256: string,
  generatedAtUtc = new Date().toISOString(),
): EvidenceManifest {
  if (!HASH_PATTERN.test(sourceTreeSha256)) throw new Error("Source tree SHA-256 is invalid");
  assertIsoTimestamp(generatedAtUtc, "Evidence manifest generatedAtUtc");
  const entries = collectEvidenceManifestEntries(workspaceRoot, outputDirectory);
  if (entries.length === 0) throw new Error("STEP 07 evidence manifest cannot be empty");
  return {
    schemaVersion: 1,
    step: "07",
    sourceTreeSha256,
    generatedAtUtc,
    evidenceTreeSha256: computeEvidenceTreeSha256(entries),
    entries,
  };
}

export function writeEvidenceManifest(
  workspaceRoot: string,
  outputDirectory: string,
  sourceTreeSha256: string,
  generatedAtUtc = new Date().toISOString(),
): WrittenEvidenceManifest {
  const output = resolve(outputDirectory);
  mkdirSync(output, { recursive: true });
  const manifest = createEvidenceManifest(workspaceRoot, output, sourceTreeSha256, generatedAtUtc);
  const manifestPath = resolve(output, MANIFEST_NAME);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, manifestPath, evidenceManifestSha256: sha256File(manifestPath) };
}

function parseEvidenceManifest(value: unknown): EvidenceManifest {
  if (!isRecord(value)) throw new Error("Evidence manifest must be a JSON object");
  assertExactKeys(
    value,
    ["schemaVersion", "step", "sourceTreeSha256", "generatedAtUtc", "evidenceTreeSha256", "entries"],
    "Evidence manifest",
  );
  if (value.schemaVersion !== 1 || value.step !== "07") throw new Error("Evidence manifest schema or step is invalid");
  if (typeof value.sourceTreeSha256 !== "string" || !HASH_PATTERN.test(value.sourceTreeSha256)) {
    throw new Error("Evidence manifest source tree SHA-256 is invalid");
  }
  assertIsoTimestamp(value.generatedAtUtc, "Evidence manifest generatedAtUtc");
  if (typeof value.evidenceTreeSha256 !== "string" || !HASH_PATTERN.test(value.evidenceTreeSha256)) {
    throw new Error("Evidence manifest tree SHA-256 is invalid");
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) throw new Error("Evidence manifest must contain evidence entries");
  const entries = value.entries.map((entry, index): EvidenceManifestEntry => {
    if (!isRecord(entry)) throw new Error(`Evidence manifest entry ${index} must be an object`);
    assertExactKeys(entry, ["path", "bytes", "sha256"], `Evidence manifest entry ${index}`);
    if (typeof entry.path !== "string" || !entry.path || entry.path.includes("\\") || entry.path.startsWith("/") || entry.path.includes("\0") || /[\r\n]/.test(entry.path)) {
      throw new Error(`Evidence manifest entry ${index} path is invalid`);
    }
    if (!Number.isSafeInteger(entry.bytes) || (entry.bytes as number) <= 0) {
      throw new Error(`Evidence manifest entry ${index} byte count is invalid`);
    }
    if (typeof entry.sha256 !== "string" || !HASH_PATTERN.test(entry.sha256)) {
      throw new Error(`Evidence manifest entry ${index} SHA-256 is invalid`);
    }
    return { path: entry.path, bytes: entry.bytes as number, sha256: entry.sha256 };
  });
  for (let index = 1; index < entries.length; index += 1) {
    if (ordinalCompare(entries[index - 1].path, entries[index].path) >= 0) {
      throw new Error("Evidence manifest entries must be uniquely sorted by canonical path");
    }
  }
  return {
    schemaVersion: 1,
    step: "07",
    sourceTreeSha256: value.sourceTreeSha256,
    generatedAtUtc: value.generatedAtUtc,
    evidenceTreeSha256: value.evidenceTreeSha256,
    entries,
  };
}

function readJsonObject(path: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size === 0) throw new Error("not a nonempty regular file");
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${label} is missing or invalid JSON`);
  }
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}

function assertCanonicalExceptionalRepairIds(value: unknown, label: string): void {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(STEP07_EXCEPTIONAL_REPAIR_IDS)) {
    throw new Error(`${label} exceptional repair lineage is invalid`);
  }
}

export function readStep07AuthorizationLineageMetadata(workspaceRoot: string): {
  readonly closedRecoveryAuthorizations: 1;
  readonly finalClosureAuthorizations: 1;
} {
  const freezePath = resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE);
  const freeze = readJsonObject(freezePath, "STEP 07 closed recovery freeze");
  assertExactKeys(freeze, [
    "schemaVersion",
    "recordType",
    "status",
    "sourceTreeShaBeforeRecovery",
    "committedBaseline",
    "branch",
    "repairRoundsConsumed",
    "ordinaryAutoReviseLoop",
    "humanExceptionalRepairs",
    "exceptionalRepairs",
    "closedRecoveryAuthorizations",
    "closedRecoveryId",
    "preflight",
    "allObservedFailures",
    "admittedFailures",
    "rejectedFailures",
    "rejectedCandidates",
    "exactAllowedFiles",
    "affectedDependencies",
    "forbiddenFiles",
    "forbiddenMutations",
    "unknownFailurePolicy",
    "firstMutationMakesFreezeImmutable",
    "immutable",
  ], "STEP 07 closed recovery freeze");
  if (
    freeze.schemaVersion !== 1
    || freeze.recordType !== "STEP07_CLOSED_RECOVERY_FREEZE"
    || freeze.status !== "IMMUTABLE"
    || typeof freeze.sourceTreeShaBeforeRecovery !== "string"
    || !HASH_PATTERN.test(freeze.sourceTreeShaBeforeRecovery)
    || typeof freeze.committedBaseline !== "string"
    || !COMMIT_PATTERN.test(freeze.committedBaseline)
    || freeze.branch !== "main"
    || freeze.repairRoundsConsumed !== 3
    || freeze.ordinaryAutoReviseLoop !== false
    || freeze.humanExceptionalRepairs !== 3
    || freeze.closedRecoveryAuthorizations !== 1
    || freeze.closedRecoveryId !== STEP07_CLOSED_RECOVERY_ID
    || freeze.firstMutationMakesFreezeImmutable !== true
    || freeze.immutable !== true
  ) {
    throw new Error("STEP 07 closed recovery freeze authorization identity is invalid");
  }
  assertCanonicalExceptionalRepairIds(freeze.exceptionalRepairs, "STEP 07 closed recovery freeze");

  const stopped = readJsonObject(
    resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE),
    "STEP 07 closed recovery stop",
  );
  assertExactKeys(stopped, [
    "schemaVersion",
    "recordType",
    "status",
    "stopReason",
    "machineVerdict",
    "machinePassEligible",
    "recordedAtUtc",
    "branch",
    "committedBaseline",
    "originMainAtStop",
    "sourceTreeShaBeforeRecovery",
    "sourceTreeShaAtStop",
    "closedRecoveryFreeze",
    "lineage",
    "authorizedRepairCompleted",
    "sameTreeVerificationBeforeStop",
    "semanticReviewMerge",
    "newUnauthorizedBlockers",
    "notPerformedAfterStop",
    "explicitBoundaries",
    "nextAuthorityRequired",
  ], "STEP 07 closed recovery stop");
  if (
    stopped.schemaVersion !== 1
    || stopped.recordType !== "STEP07_CLOSED_RECOVERY_STOP"
    || stopped.status !== "CLOSED_RECOVERY_STOPPED"
    || stopped.stopReason !== "NEW_UNAUTHORIZED_BLOCKER"
    || stopped.machineVerdict !== "ESCALATE_HUMAN"
    || stopped.machinePassEligible !== false
    || stopped.branch !== "main"
    || typeof stopped.committedBaseline !== "string"
    || !COMMIT_PATTERN.test(stopped.committedBaseline)
    || stopped.committedBaseline !== freeze.committedBaseline
    || typeof stopped.originMainAtStop !== "string"
    || !COMMIT_PATTERN.test(stopped.originMainAtStop)
    || stopped.originMainAtStop !== freeze.committedBaseline
    || typeof stopped.sourceTreeShaBeforeRecovery !== "string"
    || !HASH_PATTERN.test(stopped.sourceTreeShaBeforeRecovery)
    || stopped.sourceTreeShaBeforeRecovery !== freeze.sourceTreeShaBeforeRecovery
    || typeof stopped.sourceTreeShaAtStop !== "string"
    || !HASH_PATTERN.test(stopped.sourceTreeShaAtStop)
  ) {
    throw new Error("STEP 07 closed recovery stop authorization identity is invalid");
  }
  assertUtcTimestamp(stopped.recordedAtUtc, "STEP 07 closed recovery stop recordedAtUtc");
  if (!isRecord(stopped.closedRecoveryFreeze)) throw new Error("STEP 07 closed recovery freeze reference is invalid");
  assertExactKeys(stopped.closedRecoveryFreeze, ["path", "sha256", "status"], "STEP 07 closed recovery freeze reference");
  if (
    stopped.closedRecoveryFreeze.path !== STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE
    || stopped.closedRecoveryFreeze.sha256 !== sha256File(freezePath)
    || stopped.closedRecoveryFreeze.status !== "IMMUTABLE"
  ) {
    throw new Error("STEP 07 closed recovery freeze reference identity is invalid");
  }
  if (!isRecord(stopped.lineage)) throw new Error("STEP 07 closed recovery stop lineage is invalid");
  assertExactKeys(stopped.lineage, [
    "repairRoundsConsumed",
    "ordinaryAutoReviseLoop",
    "humanExceptionalRepairs",
    "exceptionalRepairs",
    "closedRecoveryAuthorizations",
    "closedRecoveryId",
  ], "STEP 07 closed recovery stop lineage");
  if (
    stopped.lineage.repairRoundsConsumed !== 3
    || stopped.lineage.ordinaryAutoReviseLoop !== false
    || stopped.lineage.humanExceptionalRepairs !== 3
    || stopped.lineage.closedRecoveryAuthorizations !== 1
    || stopped.lineage.closedRecoveryId !== STEP07_CLOSED_RECOVERY_ID
  ) {
    throw new Error("STEP 07 closed recovery stop lineage identity is invalid");
  }
  assertCanonicalExceptionalRepairIds(stopped.lineage.exceptionalRepairs, "STEP 07 closed recovery stop");

  const charter = readJsonObject(
    resolve(workspaceRoot, STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE),
    "STEP 07 final closure charter",
  );
  assertExactKeys(charter, [
    "schemaVersion",
    "recordType",
    "authorizationId",
    "frozenAtUtc",
    "sourceTreeSha256",
    "findingCount",
    "findingListFrozen",
    "newFindingPolicy",
    "lineage",
    "boundedProductQuestion",
    "childValue",
    "hanziLearningValue",
    "explicitNonGoals",
    "findings",
  ], "STEP 07 final closure charter");
  if (
    charter.schemaVersion !== 1
    || charter.recordType !== "STEP07_FINAL_CLOSURE_CHARTER"
    || charter.authorizationId !== STEP07_FINAL_CLOSURE_AUTHORIZATION_ID
    || typeof charter.sourceTreeSha256 !== "string"
    || !HASH_PATTERN.test(charter.sourceTreeSha256)
    || charter.sourceTreeSha256 !== stopped.sourceTreeShaAtStop
    || charter.findingListFrozen !== true
    || !Number.isSafeInteger(charter.findingCount)
    || (charter.findingCount as number) <= 0
    || !Array.isArray(charter.findings)
    || charter.findings.length !== charter.findingCount
  ) {
    throw new Error("STEP 07 final closure charter authorization identity is invalid");
  }
  assertUtcTimestamp(charter.frozenAtUtc, "STEP 07 final closure charter frozenAtUtc");
  if (Date.parse(charter.frozenAtUtc) < Date.parse(stopped.recordedAtUtc as string)) {
    throw new Error("STEP 07 final closure charter predates the closed recovery stop");
  }
  if (!isRecord(charter.lineage)) throw new Error("STEP 07 final closure charter lineage is invalid");
  assertExactKeys(charter.lineage, [
    "repairRoundsConsumed",
    "ordinaryAutoReviseLoop",
    "humanExceptionalRepairs",
    "closedRecoveryAuthorizations",
    "finalClosureAuthorizations",
    "closureAutoRepairLoopsMaximum",
  ], "STEP 07 final closure charter lineage");
  if (
    charter.lineage.repairRoundsConsumed !== 3
    || charter.lineage.ordinaryAutoReviseLoop !== false
    || charter.lineage.humanExceptionalRepairs !== 3
    || charter.lineage.closedRecoveryAuthorizations !== 1
    || charter.lineage.finalClosureAuthorizations !== 1
    || charter.lineage.closureAutoRepairLoopsMaximum !== 3
  ) {
    throw new Error("STEP 07 final closure charter lineage identity is invalid");
  }

  return { closedRecoveryAuthorizations: 1, finalClosureAuthorizations: 1 };
}

export function readStep07ExceptionalRepairMetadata(
  workspaceRoot: string,
  requestedExceptionalRepairIds: readonly string[],
): Step07ExceptionalRepairMetadata {
  if (
    requestedExceptionalRepairIds.length !== STEP07_EXCEPTIONAL_REPAIR_IDS.length
    || requestedExceptionalRepairIds.some((id, index) => id !== STEP07_EXCEPTIONAL_REPAIR_IDS[index])
  ) {
    throw new Error(`Exceptional repair ids must be ${STEP07_EXCEPTIONAL_REPAIR_IDS.join(", ")} in canonical order`);
  }
  const authorizationLineage = readStep07AuthorizationLineageMetadata(workspaceRoot);
  const firstContract = readJsonObject(
    resolve(workspaceRoot, STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE),
    "STEP 07 exceptional repair 01 authorization contract",
  );
  if (
    firstContract.schemaVersion !== 1
    || firstContract.authorization !== STEP07_EXCEPTIONAL_REPAIR_01_ID
    || firstContract.exceptionalRepairId !== STEP07_EXCEPTIONAL_REPAIR_01_ID
    || firstContract.repairRoundsConsumed !== 3
    || firstContract.humanExceptionalRepairs !== 1
    || firstContract.ordinaryAutoReviseLoop !== false
    || firstContract.originalBlocker !== STEP07_EXCEPTION_01_ORIGINAL_BLOCKER
  ) {
    throw new Error("STEP 07 exceptional repair 01 authorization contract identity is invalid");
  }
  if (
    !isRecord(firstContract.scope)
    || firstContract.scope.rootCause !== STEP07_EXCEPTION_01_ROOT_CAUSE
    || firstContract.scope.requiredResolution !== STEP07_EXCEPTION_01_RESOLUTION
  ) {
    throw new Error("STEP 07 exceptional repair 01 authorization scope is invalid");
  }

  const secondContract = readJsonObject(
    resolve(workspaceRoot, STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE),
    "STEP 07 exceptional repair 02 authorization contract",
  );
  if (
    secondContract.schemaVersion !== 1
    || secondContract.authorization !== STEP07_EXCEPTIONAL_REPAIR_02_ID
    || secondContract.exceptionalRepairId !== STEP07_EXCEPTIONAL_REPAIR_02_ID
    || secondContract.repairRoundsConsumed !== 3
    || secondContract.humanExceptionalRepairs !== 2
    || secondContract.ordinaryAutoReviseLoop !== false
    || secondContract.originalBlocker !== STEP07_EXCEPTION_02_ORIGINAL_BLOCKER
  ) {
    throw new Error("STEP 07 exceptional repair 02 authorization contract identity is invalid");
  }
  if (
    !isRecord(secondContract.scope)
    || secondContract.scope.rootCause !== STEP07_EXCEPTION_02_ROOT_CAUSE
    || secondContract.scope.requiredResolution !== STEP07_EXCEPTION_02_RESOLUTION
  ) {
    throw new Error("STEP 07 exceptional repair 02 authorization scope is invalid");
  }

  const thirdContract = readJsonObject(
    resolve(workspaceRoot, STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE),
    "STEP 07 exceptional repair 03 authorization contract",
  );
  if (
    thirdContract.schemaVersion !== 1
    || thirdContract.authorization !== STEP07_EXCEPTIONAL_REPAIR_03_ID
    || thirdContract.exceptionalRepairId !== STEP07_EXCEPTIONAL_REPAIR_03_ID
    || thirdContract.repairRoundsConsumed !== 3
    || thirdContract.humanExceptionalRepairs !== 3
    || thirdContract.ordinaryAutoReviseLoop !== false
    || thirdContract.originalBlocker !== STEP07_EXCEPTION_03_ORIGINAL_BLOCKER
  ) {
    throw new Error("STEP 07 exceptional repair 03 authorization contract identity is invalid");
  }
  if (
    !isRecord(thirdContract.scope)
    || thirdContract.scope.rootCause !== STEP07_EXCEPTION_03_ROOT_CAUSE
    || thirdContract.scope.requiredResolution !== STEP07_EXCEPTION_03_RESOLUTION
  ) {
    throw new Error("STEP 07 exceptional repair 03 authorization scope is invalid");
  }

  return {
    repairRoundsConsumed: 3,
    humanExceptionalRepairs: 3,
    ordinaryAutoReviseLoop: false,
    ...authorizationLineage,
    exceptionalRepairs: [
      {
        exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_01_ID,
        originalBlocker: STEP07_EXCEPTION_01_ORIGINAL_BLOCKER,
        rootCause: STEP07_EXCEPTION_01_ROOT_CAUSE,
        resolution: STEP07_EXCEPTION_01_RESOLUTION,
        authorizationEvidenceFile: STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
      },
      {
        exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_02_ID,
        originalBlocker: STEP07_EXCEPTION_02_ORIGINAL_BLOCKER,
        rootCause: STEP07_EXCEPTION_02_ROOT_CAUSE,
        resolution: STEP07_EXCEPTION_02_RESOLUTION,
        authorizationEvidenceFile: STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
      },
      {
        exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_03_ID,
        originalBlocker: STEP07_EXCEPTION_03_ORIGINAL_BLOCKER,
        rootCause: STEP07_EXCEPTION_03_ROOT_CAUSE,
        resolution: STEP07_EXCEPTION_03_RESOLUTION,
        authorizationEvidenceFile: STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
      },
    ],
  };
}

function assertExceptionalRepairMetadata(
  value: Record<string, unknown>,
  expected: Step07ExceptionalRepairMetadata,
  label: string,
): void {
  for (const field of [
    "repairRoundsConsumed",
    "humanExceptionalRepairs",
    "ordinaryAutoReviseLoop",
    "closedRecoveryAuthorizations",
    "finalClosureAuthorizations",
  ] as const) {
    if (value[field] !== expected[field]) throw new Error(`${label} ${field} is invalid`);
  }
  if (JSON.stringify(value.exceptionalRepairs) !== JSON.stringify(expected.exceptionalRepairs)) {
    throw new Error(`${label} exceptionalRepairs is invalid`);
  }
}

export function assertStep07AuthorizationLineageEvidenceEntries(
  entries: readonly Pick<EvidenceManifestEntry, "path">[],
): void {
  for (const path of STEP07_AUTHORIZATION_LINEAGE_EVIDENCE_FILES) {
    if (!entries.some((entry) => entry.path === path)) {
      throw new Error(`STEP 07 authorization lineage evidence is not bound to the evidence manifest: ${path}`);
    }
  }
}

export function verifyEvidenceManifest(
  workspaceRoot: string,
  outputDirectory: string,
  expectedSourceTreeSha256?: string,
): VerifiedEvidenceIdentity {
  const output = resolve(outputDirectory);
  const manifestPath = resolve(output, MANIFEST_NAME);
  const manifest = parseEvidenceManifest(readJsonObject(manifestPath, "Evidence manifest"));
  if (expectedSourceTreeSha256 && manifest.sourceTreeSha256 !== expectedSourceTreeSha256) {
    throw new Error("Evidence manifest is bound to a different source tree");
  }
  const currentEntries = collectEvidenceManifestEntries(workspaceRoot, output);
  if (currentEntries.length !== manifest.entries.length) throw new Error("Evidence manifest coverage is stale");
  for (let index = 0; index < currentEntries.length; index += 1) {
    const current = currentEntries[index];
    const declared = manifest.entries[index];
    if (current.path !== declared.path || current.bytes !== declared.bytes || current.sha256 !== declared.sha256) {
      throw new Error(`Evidence content identity mismatch: ${declared.path}`);
    }
  }
  const evidenceTreeSha256 = computeEvidenceTreeSha256(currentEntries);
  if (manifest.evidenceTreeSha256 !== evidenceTreeSha256) throw new Error("Evidence tree SHA-256 mismatch");
  return {
    sourceTreeSha256: manifest.sourceTreeSha256,
    evidenceTreeSha256,
    evidenceManifestSha256: sha256File(manifestPath),
    entryCount: currentEntries.length,
  };
}

function assertReadinessVerdict(
  value: Record<string, unknown>,
  exceptionalRepair: Step07ExceptionalRepairMetadata,
): void {
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "step",
      "verdict",
      "escalationReason",
      "failedConditions",
      "repairRound",
      "finalCommit",
      "sourceTreeSha256",
      "evidenceTreeSha256",
      "evidenceManifestSha256",
      "derivedOutputSealSha256",
      "generatedAtUtc",
      "realSecondUsePerformed",
      "repairRoundsConsumed",
      "humanExceptionalRepairs",
      "ordinaryAutoReviseLoop",
      "closedRecoveryAuthorizations",
      "finalClosureAuthorizations",
      "exceptionalRepairs",
    ],
    "Machine review verdict",
  );
  if (value.schemaVersion !== 1 || value.step !== "07" || value.verdict !== "PASS_MACHINE") {
    throw new Error("Machine review verdict schema, step, or verdict is invalid");
  }
  if (value.escalationReason !== null || !Array.isArray(value.failedConditions) || value.failedConditions.length !== 0) {
    throw new Error("Machine review verdict contains an escalation or failed condition");
  }
  if (value.repairRound !== 3) {
    throw new Error("Machine review repair round must remain 3 for the authorized exception");
  }
  if (typeof value.finalCommit !== "string" || !COMMIT_PATTERN.test(value.finalCommit)) throw new Error("Machine review final commit is invalid");
  for (const field of ["sourceTreeSha256", "evidenceTreeSha256", "evidenceManifestSha256", "derivedOutputSealSha256"] as const) {
    if (typeof value[field] !== "string" || !HASH_PATTERN.test(value[field] as string)) throw new Error(`Machine review ${field} is invalid`);
  }
  assertIsoTimestamp(value.generatedAtUtc, "Machine review verdict generatedAtUtc");
  if (value.realSecondUsePerformed !== "NO") throw new Error("Machine review verdict must not claim real second-use evidence");
  assertExceptionalRepairMetadata(value, exceptionalRepair, "Machine review verdict exceptional repair metadata");
}

function verifyDerivedOutputSeal(
  outputDirectory: string,
  expectedSourceTreeSha256: string,
  expectedEvidenceTreeSha256: string,
  expectedSealSha256: string,
): void {
  const sealPath = resolve(outputDirectory, DERIVED_SEAL_NAME);
  if (sha256File(sealPath) !== expectedSealSha256) throw new Error("Derived output seal SHA-256 mismatch");
  const seal = readJsonObject(sealPath, "Derived output seal");
  assertExactKeys(seal, ["schemaVersion", "step", "sourceTreeSha256", "evidenceTreeSha256", "entries"], "Derived output seal");
  if (seal.schemaVersion !== 1 || seal.step !== "07" || seal.sourceTreeSha256 !== expectedSourceTreeSha256 || seal.evidenceTreeSha256 !== expectedEvidenceTreeSha256) {
    throw new Error("Derived output seal identity is invalid");
  }
  const expectedNames = ["MACHINE-REVIEW-REPORT.html", "MACHINE-REVIEW-REPORT.json", "MACHINE-REVIEW-SUMMARY.md", "route-inventory.json"].sort();
  if (!Array.isArray(seal.entries) || seal.entries.length !== expectedNames.length) throw new Error("Derived output seal coverage is incomplete");
  const entries = seal.entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Derived output seal entry ${index} is invalid`);
    assertExactKeys(entry, ["path", "bytes", "sha256"], `Derived output seal entry ${index}`);
    if (typeof entry.path !== "string" || !expectedNames.includes(entry.path)) throw new Error(`Derived output seal entry ${index} path is invalid`);
    if (!Number.isSafeInteger(entry.bytes) || (entry.bytes as number) <= 0 || typeof entry.sha256 !== "string" || !HASH_PATTERN.test(entry.sha256)) {
      throw new Error(`Derived output seal entry ${index} identity is invalid`);
    }
    return entry as { path: string; bytes: number; sha256: string };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (JSON.stringify(entries.map((entry) => entry.path)) !== JSON.stringify(expectedNames)) throw new Error("Derived output seal paths are incomplete or duplicated");
  for (const entry of entries) {
    const absolute = resolve(outputDirectory, entry.path);
    const metadata = lstatSync(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== entry.bytes || sha256File(absolute) !== entry.sha256) {
      throw new Error(`Derived output identity mismatch: ${entry.path}`);
    }
  }
}

export function verifyStep07Readiness(options: VerifyStep07ReadinessOptions): VerifiedEvidenceIdentity {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const outputDirectory = resolve(options.outputDirectory);
  if (!COMMIT_PATTERN.test(options.expectedCommit)) throw new Error("Expected STEP 07 final commit is invalid");
  const actualCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot, encoding: "utf8" }).trim();
  if (actualCommit !== options.expectedCommit) throw new Error("Expected STEP 07 commit does not equal local HEAD");
  const untrackedSourceFiles = listUntrackedMachineReviewSourceFiles(workspaceRoot);
  if (untrackedSourceFiles.length > 0) {
    throw new Error(`Untracked source files are not bound to the pushed STEP 07 commit: ${untrackedSourceFiles.join(", ")}`);
  }
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const identity = verifyEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256);
  const exceptionalRepair = readStep07ExceptionalRepairMetadata(workspaceRoot, STEP07_EXCEPTIONAL_REPAIR_IDS);
  const evidenceEntries = collectEvidenceManifestEntries(workspaceRoot, outputDirectory);
  assertStep07AuthorizationLineageEvidenceEntries(evidenceEntries);
  for (const repair of exceptionalRepair.exceptionalRepairs) {
    if (!evidenceEntries.some((entry) => entry.path === repair.authorizationEvidenceFile)) {
      throw new Error(`Exceptional repair authorization evidence is not bound to the evidence manifest: ${repair.exceptionalRepairId}`);
    }
  }

  const verdict = readJsonObject(resolve(outputDirectory, VERDICT_NAME), "Machine review verdict");
  assertReadinessVerdict(verdict, exceptionalRepair);
  if (verdict.finalCommit !== actualCommit || verdict.sourceTreeSha256 !== sourceTreeSha256) {
    throw new Error("Machine review verdict is bound to a different commit or source tree");
  }
  if (verdict.evidenceTreeSha256 !== identity.evidenceTreeSha256 || verdict.evidenceManifestSha256 !== identity.evidenceManifestSha256) {
    throw new Error("Machine review verdict is bound to different evidence content");
  }
  verifyDerivedOutputSeal(
    outputDirectory,
    sourceTreeSha256,
    identity.evidenceTreeSha256,
    verdict.derivedOutputSealSha256 as string,
  );
  const staticReportScroll = readJsonObject(
    resolve(workspaceRoot, STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH),
    "Static machine report scroll evidence",
  );
  const staticReportErrors = validateStaticMachineReportScrollEvidence(
    staticReportScroll as unknown as StaticMachineReportScrollEvidence,
    workspaceRoot,
    sourceTreeSha256,
  );
  if (staticReportErrors.length > 0) {
    throw new Error(`Static machine report readiness gate failed: ${staticReportErrors.join("; ")}`);
  }

  const report = readJsonObject(resolve(outputDirectory, REPORT_NAME), "Machine review report");
  assertExactKeys(report, [
    "schemaVersion",
    "step",
    "generatedAtUtc",
    "sourceIdentity",
    "evidenceTreeSha256",
    "evidenceManifestSha256",
    "manifest",
    "hardGates",
    "scrollMatrix",
    "catalogSmoke",
    "agentPlaythroughs",
    "deepRouteAccessibility",
    "network",
    "privacy",
    "semanticReview",
    "unresolvedCriticalReviewerConflict",
    "finalFullTests",
    "finalBuild",
    "verdict",
    "repairRoundsConsumed",
    "humanExceptionalRepairs",
    "ordinaryAutoReviseLoop",
    "closedRecoveryAuthorizations",
    "finalClosureAuthorizations",
    "exceptionalRepairs",
    "realSecondUsePerformed",
    "limitations",
  ], "Machine review report");
  if (report.schemaVersion !== 1 || report.step !== "07" || report.realSecondUsePerformed !== false) {
    throw new Error("Machine review report schema, step, or real second-use boundary is invalid");
  }
  if (!isRecord(report.sourceIdentity) || report.sourceIdentity.commitSha !== actualCommit || report.sourceIdentity.sourceTreeSha256 !== sourceTreeSha256) {
    throw new Error("Machine review report is bound to a different commit or source tree");
  }
  if (report.evidenceTreeSha256 !== identity.evidenceTreeSha256 || report.evidenceManifestSha256 !== identity.evidenceManifestSha256) {
    throw new Error("Machine review report is bound to different evidence content");
  }
  if (!isRecord(report.verdict) || report.verdict.verdict !== "PASS_MACHINE" || report.verdict.escalationReason !== null || !Array.isArray(report.verdict.failedConditions) || report.verdict.failedConditions.length !== 0) {
    throw new Error("Machine review report does not contain a clean PASS_MACHINE verdict");
  }
  if (report.verdict.repairRound !== 3) throw new Error("Machine review report repair round must remain 3 for the authorized exception");
  assertExceptionalRepairMetadata(report, exceptionalRepair, "Machine review report exceptional repair metadata");
  return identity;
}

function main(): void {
  const [command, workspaceArgument, outputArgument, commitArgument] = process.argv.slice(2);
  if (command !== "verify-readiness" || !workspaceArgument || !outputArgument || !commitArgument) {
    throw new Error("Usage: evidence-identity.ts verify-readiness <workspace-root> <output-directory> <expected-commit>");
  }
  const result = verifyStep07Readiness({
    workspaceRoot: resolve(workspaceArgument),
    outputDirectory: resolve(outputArgument),
    expectedCommit: commitArgument,
  });
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
