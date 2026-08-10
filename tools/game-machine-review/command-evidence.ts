import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  assertStrictAgentProfileCoverage,
  assertStrictCatalogSmokeCoverage,
  assertStrictScrollMatrixCoverage,
} from "./evidence-validators";
import { SEMANTIC_REVIEWER_IDS, parseSemanticReview, type SemanticReviewerId } from "./semantic-review-schema";
import { validateDeepRouteEvidenceReport, type DeepRouteEvidenceReport } from "./deep-route-evidence";
import { createMachineReviewManifest } from "./machine-review-manifest";

export const DEFAULT_MACHINE_REVIEW_OUTPUT = "artifacts/game-machine-review/step-07";

export const COMMAND_GATE_IDS = [
  "compile",
  "targeted-tests",
  "step-regressions",
  "full-tests",
  "build",
  "visual-regression",
  "aria-snapshots",
] as const;

export const ORDINARY_COMMAND_GATE_IDS = [
  "compile",
  "targeted-tests",
  "step-regressions",
  "full-tests",
  "build",
] as const;

export const COMMAND_RUN_GATE_IDS = [
  ...ORDINARY_COMMAND_GATE_IDS,
  "visual-baseline-update",
  "visual-no-update",
] as const;

export type CommandGateId = (typeof COMMAND_GATE_IDS)[number];
export type OrdinaryCommandGateId = (typeof ORDINARY_COMMAND_GATE_IDS)[number];
export type CommandRunGateId = (typeof COMMAND_RUN_GATE_IDS)[number];

export interface FixedCommandDefinition {
  readonly command: "pnpm";
  readonly args: readonly string[];
  readonly allowsSourceMutation: boolean;
}

export const FIXED_COMMAND_DEFINITIONS: Readonly<Record<CommandRunGateId, FixedCommandDefinition>> = {
  compile: {
    command: "pnpm",
    args: ["exec", "tsc", "--noEmit"],
    allowsSourceMutation: false,
  },
  "targeted-tests": {
    command: "pnpm",
    args: ["run", "test:hanzi-v2:step07:targeted-closure"],
    allowsSourceMutation: false,
  },
  "step-regressions": {
    command: "pnpm",
    args: ["run", "test:hanzi-v2:all-steps"],
    allowsSourceMutation: false,
  },
  "full-tests": {
    command: "pnpm",
    args: ["run", "test"],
    allowsSourceMutation: false,
  },
  build: {
    command: "pnpm",
    args: ["run", "build"],
    allowsSourceMutation: false,
  },
  "visual-baseline-update": {
    command: "pnpm",
    args: [
      "exec",
      "playwright",
      "test",
      "tests/e2e/game-machine-visual-regression.spec.ts",
      "--config",
      "playwright.step07.config.ts",
      "--project=desktop-chromium",
      "--update-snapshots",
    ],
    allowsSourceMutation: false,
  },
  "visual-no-update": {
    command: "pnpm",
    args: [
      "exec",
      "playwright",
      "test",
      "tests/e2e/game-machine-visual-regression.spec.ts",
      "--config",
      "playwright.step07.config.ts",
      "--project=desktop-chromium",
      "--update-snapshots=none",
    ],
    allowsSourceMutation: false,
  },
};

export interface CommandRunEvidenceRecord {
  readonly schemaVersion: 1;
  readonly recordType: "ACTUAL_COMMAND_RUN";
  readonly runId: string;
  readonly gateId: CommandRunGateId;
  readonly command: "pnpm";
  readonly args: readonly string[];
  readonly startedAtUtc: string;
  readonly finishedAtUtc: string;
  readonly exitCode: number;
  readonly sourceTreeSha256Before: string;
  readonly sourceTreeSha256After: string;
  readonly logSha256: string;
  readonly logPath: string;
  readonly status: "PASS" | "FAIL";
}

interface EvidenceFingerprint {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface VisualAriaCandidateIndex {
  readonly schemaVersion: 1;
  readonly sourceTreeSha256: string;
  readonly baselineKind: "STEP07_BASELINE_CANDIDATE";
  readonly generatedAtUtc: string;
  readonly evidenceFiles: readonly string[];
}

export interface VisualAriaCandidateRecord {
  readonly schemaVersion: 1;
  readonly recordType: "VISUAL_ARIA_BASELINE_CANDIDATE";
  readonly sourceTreeSha256: string;
  readonly preservedAtUtc: string;
  readonly status: "CANDIDATE_REVIEW_REQUIRED";
  readonly updateCommandRunRecordFile: string;
  readonly sourceIndexFile: string;
  readonly sourceIndexSha256: string;
  readonly candidateIndex: VisualAriaCandidateIndex;
  readonly evidenceEntries: readonly EvidenceFingerprint[];
  readonly snapshotEntries: readonly EvidenceFingerprint[];
}

export interface BaselineEstablishmentRecord {
  readonly schemaVersion: 1;
  readonly recordType: "VISUAL_ARIA_BASELINE_ESTABLISHMENT";
  readonly sourceTreeSha256: string;
  readonly establishedAtUtc: string;
  readonly status: "PASS";
  readonly visualBaselineUpdateRecordFile: string;
  readonly candidateEvidenceFile: string;
  readonly preChangeReferenceFile: string;
  readonly ordinaryCommandRunRecordFiles: Readonly<Record<OrdinaryCommandGateId, string>>;
  readonly semanticReviewFiles: Readonly<Record<SemanticReviewerId, string>>;
  readonly reviewerConflictFile: string;
  readonly scrollMatrixFile: string;
  readonly catalogSmokeFile: string;
  readonly agentPlaythroughsFile: string;
  readonly deepRouteEvidenceFile: string;
  readonly prerequisiteEntries: readonly EvidenceFingerprint[];
  readonly blockerFindingIds: readonly string[];
  readonly unresolvedCriticalReviewerConflict: false;
  readonly realChildEvidenceClaimed: false;
  readonly limitations: readonly string[];
}

export type BaselineStage = "PRE_CHANGE_REFERENCE" | "STEP07_ESTABLISHED_BASELINE" | "REGRESSION_PASS";

interface BaselineStageRecord {
  readonly stage: BaselineStage;
  readonly evidenceFile: string;
  readonly commandRunRecordFile?: string;
}

export interface BaselinePromotionRecord {
  readonly schemaVersion: 1;
  readonly recordType: "VISUAL_ARIA_BASELINE_PROMOTION";
  readonly sourceTreeSha256: string;
  readonly promotedAtUtc: string;
  readonly status: "PASS";
  readonly stages: readonly BaselineStageRecord[];
  readonly commandRunRecordFiles: {
    readonly visualBaselineUpdate: string;
    readonly visualNoUpdate: string;
  };
  readonly establishmentRecordFile: string;
  readonly candidateEvidenceFile: string;
  readonly preChangeReferenceFile: string;
  readonly visualAriaEvidenceFile: string;
  readonly semanticReviewFiles: Readonly<Record<SemanticReviewerId, string>>;
  readonly reviewerConflictFile: string;
  readonly scrollMatrixFile: string;
  readonly catalogSmokeFile: string;
  readonly agentPlaythroughsFile: string;
  readonly deepRouteEvidenceFile: string;
  readonly blockerFindingIds: readonly string[];
  readonly unresolvedCriticalReviewerConflict: false;
  readonly realChildEvidenceClaimed: false;
  readonly limitations: readonly string[];
}

export interface CommandGateProvenance {
  readonly kind: "COMMAND_RUN_RECORD" | "BASELINE_PROMOTION";
  readonly recordFile: string;
  readonly stage?: "REGRESSION_PASS";
}

export interface DerivedCommandGateResult {
  readonly id: CommandGateId;
  readonly status: "PASS";
  readonly evidenceFiles: readonly string[];
  readonly detail: string;
  readonly provenance: CommandGateProvenance;
}

export interface CommandGateResultsDocument {
  readonly schemaVersion: 1;
  readonly sourceTreeSha256: string;
  readonly generatedAtUtc: string;
  readonly derivation: "ACTUAL_COMMAND_RECORDS_AND_BASELINE_PROMOTION";
  readonly status: "PASS";
  readonly realChildEvidenceClaimed: false;
  readonly limitations: readonly string[];
  readonly results: readonly DerivedCommandGateResult[];
}

export interface EvidenceValidationOptions {
  readonly workspaceRoot: string;
  readonly outputDirectory?: string;
  readonly sourceTreeSha256: string;
  readonly inventoryWorkspaceRoot?: string;
}

interface CommandRunValidationOptions extends EvidenceValidationOptions {
  readonly requirePassing?: boolean;
}

interface DeriveCommandGateOptions extends EvidenceValidationOptions {
  readonly commandRunRecordFiles: Readonly<Record<CommandRunGateId, string>>;
  readonly baselinePromotionFile: string;
  readonly generatedAtUtc?: string;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const RUN_ID_PATTERN = /^[a-z0-9-]+-\d{8}T\d{9}Z-\d+-[a-f0-9]{8}$/;
const MACHINE_ONLY_LIMITATION = "Machine baseline promotion is not real-child, parent, learning, retention, or preference acceptance.";
const PRE_CHANGE_REFERENCE_SOURCE_COMMIT = "8e00aa61d796578f7e593243caa514da5a307189";
const PRE_CHANGE_REFERENCE_ORIGIN = "http://127.0.0.1:5175";
const PRE_CHANGE_REFERENCE_FILES = [
  "01-world-fresh.png",
  "02-world-repaired.png",
  "03-world-spellbook.png",
  "04-classic-hub.png",
  "05-forest-boot.png",
  "06-forest-ming-placing.png",
  "07-forest-ability-choice.png",
  "08-forest-boss-lin.png",
  "09-forest-camp-repair.png",
  "10-forest-spellbook.png",
  "PRE-CHANGE-ARIA-REFERENCE.yml",
] as const;

const COMMAND_GATE_DETAILS: Readonly<Record<CommandGateId, string>> = {
  compile: "Fixed TypeScript compile command exited 0 on the unchanged current source tree.",
  "targeted-tests": "Fixed machine-review targeted tests exited 0 on the unchanged current source tree.",
  "step-regressions": "Fixed STEP 07 regression command exited 0 on the unchanged current source tree.",
  "full-tests": "Fixed full Vitest command exited 0 on the unchanged current source tree.",
  build: "Fixed production build command exited 0 on the unchanged current source tree.",
  "visual-regression": "Validated baseline promotion cites both the snapshot update run and a later no-update regression pass.",
  "aria-snapshots": "Validated baseline promotion cites both the ARIA snapshot update run and a later no-update regression pass.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} must use the exact schema fields`);
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO UTC timestamp`);
  }
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw new Error(`${label} must be a full SHA-256`);
}

function normalizeSha256(value: string): string {
  return value.toUpperCase();
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function outputDirectory(options: EvidenceValidationOptions): string {
  return resolve(options.workspaceRoot, options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT);
}

function workspaceRelative(path: string, workspaceRoot: string, label: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
  const normalized = relative(workspaceRoot, absolute).replaceAll("\\", "/");
  if (!normalized || isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) throw new Error(`${label} must stay inside the workspace`);
  return normalized;
}

function outputRelative(options: EvidenceValidationOptions, ...segments: string[]): string {
  return workspaceRelative(resolve(outputDirectory(options), ...segments), options.workspaceRoot, "machine evidence path");
}

function absoluteWorkspacePath(path: string, workspaceRoot: string, label: string): string {
  const normalized = workspaceRelative(path, workspaceRoot, label);
  return resolve(workspaceRoot, normalized);
}

function assertFile(path: string, options: EvidenceValidationOptions, label: string, requireOutput = true): string {
  const absolute = absoluteWorkspacePath(path, options.workspaceRoot, label);
  if (requireOutput) {
    const relativeToOutput = relative(outputDirectory(options), absolute).replaceAll("\\", "/");
    if (isAbsolute(relativeToOutput) || relativeToOutput === ".." || relativeToOutput.startsWith("../")) throw new Error(`${label} must live in the machine-review output directory`);
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) throw new Error(`${label} is missing or empty: ${path}`);
  return absolute;
}

function fingerprintFile(path: string, options: EvidenceValidationOptions, label: string): EvidenceFingerprint {
  const absolute = assertFile(path, options, label);
  const bytes = readFileSync(absolute);
  return {
    path: workspaceRelative(absolute, options.workspaceRoot, label),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

function assertEvidenceFingerprint(
  value: unknown,
  options: EvidenceValidationOptions,
  label: string,
): asserts value is EvidenceFingerprint {
  if (!isRecord(value)) throw new Error(`${label} must be an evidence fingerprint`);
  assertExactKeys(value, ["path", "bytes", "sha256"], label);
  if (typeof value.path !== "string" || !Number.isInteger(value.bytes) || (value.bytes as number) <= 0) {
    throw new Error(`${label} path or byte count is invalid`);
  }
  assertSha256(value.sha256, `${label}.sha256`);
  const actual = fingerprintFile(value.path, options, label);
  if (actual.path !== workspaceRelative(value.path, options.workspaceRoot, label)
    || actual.bytes !== value.bytes
    || normalizeSha256(actual.sha256) !== normalizeSha256(value.sha256)) {
    throw new Error(`${label} no longer matches the preserved bytes and SHA-256`);
  }
}

function assertEvidenceFingerprints(
  value: unknown,
  options: EvidenceValidationOptions,
  label: string,
  allowEmpty = false,
): asserts value is EvidenceFingerprint[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${label} must be a non-empty fingerprint array`);
  value.forEach((entry, index) => assertEvidenceFingerprint(entry, options, `${label}[${index}]`));
  const paths = value.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify([...paths].sort())) {
    throw new Error(`${label} paths must be unique and sorted`);
  }
}

function listFilesRecursively(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const files: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...listFilesRecursively(path));
    else if (statSync(path).isFile()) files.push(path);
  }
  return files.sort();
}

function readJsonFile(path: string, options: EvidenceValidationOptions, label: string): Record<string, unknown> {
  const absolute = assertFile(path, options, label);
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    throw new Error(`${label} must contain valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(value)) throw new Error(`${label} must contain a JSON object`);
  return value;
}

function assertCurrentSource(value: Record<string, unknown>, options: EvidenceValidationOptions, label: string): void {
  assertSha256(value.sourceTreeSha256, `${label}.sourceTreeSha256`);
  if (normalizeSha256(value.sourceTreeSha256) !== normalizeSha256(options.sourceTreeSha256)) {
    throw new Error(`${label} sourceTreeSha256 does not match the current source tree`);
  }
}

function assertStringArray(value: unknown, label: string, allowEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || !value.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array of strings`);
  }
}

function assertEmptyDiagnosticArrays(value: Record<string, unknown>, label: string): void {
  for (const key of ["externalRequests", "consoleErrors", "pageErrors", "failedRequests"] as const) {
    if (key in value && (!Array.isArray(value[key]) || value[key].length !== 0)) throw new Error(`${label}.${key} contains blockers`);
  }
}

function assertReferencedEvidenceFiles(value: Record<string, unknown>, options: EvidenceValidationOptions, label: string): void {
  assertStringArray(value.evidenceFiles, `${label}.evidenceFiles`);
  for (const path of value.evidenceFiles) assertFile(path, options, `${label} cited evidence`);
}

function assertCanonicalReference(actual: unknown, expected: string, options: EvidenceValidationOptions, label: string): asserts actual is string {
  if (typeof actual !== "string" || workspaceRelative(actual, options.workspaceRoot, label) !== expected) {
    throw new Error(`${label} must reference ${expected}`);
  }
}

function assertCommandLog(value: unknown, record: Record<string, unknown>): void {
  if (!isRecord(value)) throw new Error("Command log must be structured JSON produced by the command runner");
  assertExactKeys(value, [
    "schemaVersion",
    "logType",
    "runId",
    "gateId",
    "command",
    "args",
    "startedAtUtc",
    "sourceTreeSha256Before",
    "stdout",
    "stderr",
    "spawnError",
    "exitCode",
    "signal",
    "sourceTreeSha256After",
    "finishedAtUtc",
  ], "Command log");
  if (value.schemaVersion !== 1 || value.logType !== "ACTUAL_COMMAND_OUTPUT") throw new Error("Command log schema or type is invalid");
  for (const key of [
    "runId",
    "gateId",
    "command",
    "args",
    "startedAtUtc",
    "sourceTreeSha256Before",
    "exitCode",
    "sourceTreeSha256After",
    "finishedAtUtc",
  ] as const) {
    if (JSON.stringify(value[key]) !== JSON.stringify(record[key])) throw new Error(`Command log ${key} does not match its run record`);
  }
  if (typeof value.stdout !== "string" || typeof value.stderr !== "string" || typeof value.spawnError !== "string") {
    throw new Error("Command log must capture stdout, stderr, and spawnError as strings");
  }
  if (value.signal !== null && typeof value.signal !== "string") throw new Error("Command log signal must be a string or null");
}

export function commandLogPath(runId: string, options: Pick<EvidenceValidationOptions, "workspaceRoot" | "outputDirectory">): string {
  return workspaceRelative(
    resolve(options.workspaceRoot, options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT, "hard-gates", "commands", `${runId}.log`),
    options.workspaceRoot,
    "command log path",
  );
}

export function commandRecordPath(runId: string, options: Pick<EvidenceValidationOptions, "workspaceRoot" | "outputDirectory">): string {
  return workspaceRelative(
    resolve(options.workspaceRoot, options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT, "hard-gates", "commands", `${runId}.json`),
    options.workspaceRoot,
    "command record path",
  );
}

export function validateCommandRunRecord(value: unknown, options: CommandRunValidationOptions): CommandRunEvidenceRecord {
  if (!isRecord(value)) throw new Error("Command run record must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "recordType",
    "runId",
    "gateId",
    "command",
    "args",
    "startedAtUtc",
    "finishedAtUtc",
    "exitCode",
    "sourceTreeSha256Before",
    "sourceTreeSha256After",
    "logSha256",
    "logPath",
    "status",
  ], "Command run record");
  if (value.schemaVersion !== 1 || value.recordType !== "ACTUAL_COMMAND_RUN") throw new Error("Command run record schema or recordType is invalid");
  if (typeof value.runId !== "string" || !RUN_ID_PATTERN.test(value.runId)) throw new Error("Command run record runId is invalid");
  if (!COMMAND_RUN_GATE_IDS.includes(value.gateId as CommandRunGateId)) throw new Error("Command run record gateId is not allowlisted");
  const gateId = value.gateId as CommandRunGateId;
  const definition = FIXED_COMMAND_DEFINITIONS[gateId];
  if (value.command !== definition.command || !Array.isArray(value.args) || JSON.stringify(value.args) !== JSON.stringify(definition.args)) {
    throw new Error(`Command run ${gateId} does not match the fixed command and args`);
  }
  assertIsoTimestamp(value.startedAtUtc, "Command run startedAtUtc");
  assertIsoTimestamp(value.finishedAtUtc, "Command run finishedAtUtc");
  if (!value.runId.startsWith(`${gateId}-${value.startedAtUtc.replace(/[-:.]/g, "")}-`)) throw new Error("Command run runId does not match its gate and start time");
  if (Date.parse(value.finishedAtUtc) < Date.parse(value.startedAtUtc)) throw new Error("Command run finished before it started");
  if (!Number.isInteger(value.exitCode) || (value.exitCode as number) < 0) throw new Error("Command run exitCode must be a non-negative integer");
  assertSha256(value.sourceTreeSha256Before, "Command run sourceTreeSha256Before");
  assertSha256(value.sourceTreeSha256After, "Command run sourceTreeSha256After");
  assertSha256(value.logSha256, "Command run logSha256");
  const expectedLogPath = commandLogPath(value.runId, options);
  assertCanonicalReference(value.logPath, expectedLogPath, options, "Command run logPath");
  const logAbsolute = assertFile(value.logPath, options, "Command run log");
  const logBytes = readFileSync(logAbsolute);
  const actualLogSha256 = createHash("sha256").update(logBytes).digest("hex").toUpperCase();
  if (actualLogSha256 !== normalizeSha256(value.logSha256)) throw new Error("Command run log SHA-256 does not match the log file");
  let parsedLog: unknown;
  try {
    parsedLog = JSON.parse(logBytes.toString("utf8"));
  } catch {
    throw new Error("Command log must be structured JSON produced by the command runner");
  }
  assertCommandLog(parsedLog, value);
  const sourceUnchanged = normalizeSha256(value.sourceTreeSha256Before) === normalizeSha256(value.sourceTreeSha256After);
  const expectedStatus = value.exitCode === 0 && (definition.allowsSourceMutation || sourceUnchanged) ? "PASS" : "FAIL";
  if (value.status !== expectedStatus) throw new Error(`Command run ${gateId} status is not derived from exitCode and source identity`);
  if (options.requirePassing) {
    if (!definition.allowsSourceMutation && !sourceUnchanged) throw new Error(`Command run ${gateId} changed the source tree`);
    if (value.exitCode !== 0 || value.status !== "PASS") throw new Error(`Command run ${gateId} did not exit 0`);
    if (normalizeSha256(value.sourceTreeSha256After) !== normalizeSha256(options.sourceTreeSha256)) {
      throw new Error(`Command run ${gateId} is stale for the current source tree`);
    }
  }
  return value as unknown as CommandRunEvidenceRecord;
}

export function readAndValidateCommandRunRecord(
  recordFile: string,
  options: CommandRunValidationOptions,
): CommandRunEvidenceRecord {
  const value = readJsonFile(recordFile, options, "Command run record file");
  const record = validateCommandRunRecord(value, options);
  const expectedRecordPath = commandRecordPath(record.runId, options);
  assertCanonicalReference(recordFile, expectedRecordPath, options, "Command run record file");
  return record;
}

export function validatePreChangeReference(path: string, options: EvidenceValidationOptions): void {
  const expectedReferencePath = outputRelative(options, "pre-change-reference", "PRE-CHANGE-REFERENCE.json");
  assertCanonicalReference(path, expectedReferencePath, options, "PRE_CHANGE_REFERENCE path");
  const value = readJsonFile(path, options, "PRE_CHANGE_REFERENCE");
  assertExactKeys(value, [
    "schemaVersion",
    "evidenceStage",
    "sourceCommit",
    "isolatedBrowserContext",
    "canonicalTestOrigin",
    "sameOriginAllowed",
    "externalNetworkForbidden",
    "diagnostics",
    "files",
    "limitation",
  ], "PRE_CHANGE_REFERENCE");
  if (value.schemaVersion !== 1) throw new Error("PRE_CHANGE_REFERENCE schemaVersion must be 1");
  if (value.evidenceStage !== "PRE_CHANGE_REFERENCE") throw new Error("Pre-change evidence must be labelled PRE_CHANGE_REFERENCE");
  if (value.sourceCommit !== PRE_CHANGE_REFERENCE_SOURCE_COMMIT) {
    throw new Error(`PRE_CHANGE_REFERENCE sourceCommit must be ${PRE_CHANGE_REFERENCE_SOURCE_COMMIT}`);
  }
  if (value.isolatedBrowserContext !== true) throw new Error("PRE_CHANGE_REFERENCE must use an isolated browser context");
  if (value.canonicalTestOrigin !== PRE_CHANGE_REFERENCE_ORIGIN) {
    throw new Error(`PRE_CHANGE_REFERENCE canonical origin must be ${PRE_CHANGE_REFERENCE_ORIGIN}`);
  }
  if (value.sameOriginAllowed !== true) throw new Error("PRE_CHANGE_REFERENCE network policy must be SAME_ORIGIN_ALLOWED");
  if (value.externalNetworkForbidden !== true) throw new Error("PRE_CHANGE_REFERENCE network policy must be EXTERNAL_NETWORK_FORBIDDEN");

  if (!isRecord(value.diagnostics)) throw new Error("PRE_CHANGE_REFERENCE diagnostics must be an object");
  assertExactKeys(value.diagnostics, ["consoleErrors", "pageErrors", "externalRequests"], "PRE_CHANGE_REFERENCE.diagnostics");
  for (const key of ["consoleErrors", "pageErrors", "externalRequests"] as const) {
    if (!Array.isArray(value.diagnostics[key]) || value.diagnostics[key].length !== 0) {
      throw new Error(`PRE_CHANGE_REFERENCE.diagnostics.${key} must be empty`);
    }
  }

  assertStringArray(value.files, "PRE_CHANGE_REFERENCE.files");
  if (JSON.stringify(value.files) !== JSON.stringify(PRE_CHANGE_REFERENCE_FILES)) {
    throw new Error("PRE_CHANGE_REFERENCE.files must exactly match the sealed required state evidence set");
  }
  const directory = resolve(assertFile(path, options, "PRE_CHANGE_REFERENCE"), "..");
  for (const file of PRE_CHANGE_REFERENCE_FILES) {
    const absolute = resolve(directory, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) throw new Error(`PRE_CHANGE_REFERENCE evidence is missing: ${file}`);
  }
  const expectedDirectoryEntries = [...PRE_CHANGE_REFERENCE_FILES, "PRE-CHANGE-REFERENCE.json"].sort();
  const actualDirectoryEntries = readdirSync(directory).sort();
  if (JSON.stringify(actualDirectoryEntries) !== JSON.stringify(expectedDirectoryEntries)) {
    throw new Error("PRE_CHANGE_REFERENCE directory must contain exactly the sealed manifest and required state evidence files");
  }
  if (typeof value.limitation !== "string" || !/not an accepted.+baseline/i.test(value.limitation)) {
    throw new Error("PRE_CHANGE_REFERENCE must explicitly say it is not an accepted baseline");
  }
}

export function createVisualAriaCandidateRecord(
  options: EvidenceValidationOptions & { readonly visualBaselineUpdateRecordFile: string; readonly preservedAtUtc?: string },
): VisualAriaCandidateRecord {
  const update = readAndValidateCommandRunRecord(options.visualBaselineUpdateRecordFile, { ...options, requirePassing: true });
  if (update.gateId !== "visual-baseline-update") throw new Error("Candidate evidence must be produced by visual-baseline-update");
  const sourceIndexFile = outputRelative(options, "VISUAL-ARIA-EVIDENCE.json");
  const sourceIndexAbsolute = assertFile(sourceIndexFile, options, "visual/ARIA candidate source index");
  const sourceIndexBytes = readFileSync(sourceIndexAbsolute);
  const parsed = JSON.parse(sourceIndexBytes.toString("utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error("Visual/ARIA candidate source index must be a JSON object");
  assertExactKeys(parsed, ["schemaVersion", "sourceTreeSha256", "baselineKind", "generatedAtUtc", "evidenceFiles"], "Visual/ARIA candidate source index");
  if (parsed.schemaVersion !== 1 || parsed.baselineKind !== "STEP07_BASELINE_CANDIDATE") {
    throw new Error("Snapshot update must produce STEP07_BASELINE_CANDIDATE, not an established baseline");
  }
  assertCurrentSource(parsed, options, "Visual/ARIA candidate source index");
  assertIsoTimestamp(parsed.generatedAtUtc, "Visual/ARIA candidate source index generatedAtUtc");
  const candidateGeneratedAt = Date.parse(parsed.generatedAtUtc);
  if (candidateGeneratedAt < Date.parse(update.startedAtUtc) || candidateGeneratedAt > Date.parse(update.finishedAtUtc)) {
    throw new Error("Visual/ARIA candidate index was not generated during the cited snapshot update run");
  }
  assertReferencedEvidenceFiles(parsed, options, "Visual/ARIA candidate source index");
  const evidenceFiles = (parsed.evidenceFiles as string[]).map((path) => workspaceRelative(path, options.workspaceRoot, "candidate evidence")).sort();
  if (!evidenceFiles.some((path) => /\.png$/i.test(path)) || !evidenceFiles.some((path) => /\.aria\.ya?ml$/i.test(path))) {
    throw new Error("Visual/ARIA candidate must cite both PNG and ARIA YAML evidence");
  }
  const snapshotFiles = listFilesRecursively(resolve(outputDirectory(options), "baselines"))
    .map((path) => workspaceRelative(path, options.workspaceRoot, "candidate snapshot"))
    .sort();
  if (!snapshotFiles.some((path) => /\.png$/i.test(path)) || !snapshotFiles.some((path) => /\.aria\.ya?ml$/i.test(path))) {
    throw new Error("Visual/ARIA candidate must preserve both visual and ARIA snapshot files");
  }
  const candidateIndex = parsed as unknown as VisualAriaCandidateIndex;
  const preservedAtUtc = options.preservedAtUtc
    ?? new Date(Math.max(Date.now(), Date.parse(update.finishedAtUtc) + 1)).toISOString();
  assertIsoTimestamp(preservedAtUtc, "Visual/ARIA candidate preservedAtUtc");
  if (Date.parse(preservedAtUtc) < Date.parse(update.finishedAtUtc)) throw new Error("Candidate preservation predates the snapshot update completion");
  return {
    schemaVersion: 1,
    recordType: "VISUAL_ARIA_BASELINE_CANDIDATE",
    sourceTreeSha256: normalizeSha256(options.sourceTreeSha256),
    preservedAtUtc,
    status: "CANDIDATE_REVIEW_REQUIRED",
    updateCommandRunRecordFile: workspaceRelative(options.visualBaselineUpdateRecordFile, options.workspaceRoot, "visual update record"),
    sourceIndexFile,
    sourceIndexSha256: sha256(sourceIndexBytes),
    candidateIndex,
    evidenceEntries: evidenceFiles.map((path) => fingerprintFile(path, options, "candidate evidence")),
    snapshotEntries: snapshotFiles.map((path) => fingerprintFile(path, options, "candidate snapshot")),
  };
}

export function validateVisualAriaCandidateRecord(
  value: unknown,
  options: EvidenceValidationOptions,
): VisualAriaCandidateRecord {
  if (!isRecord(value)) throw new Error("VISUAL-ARIA-CANDIDATE.json must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "recordType",
    "sourceTreeSha256",
    "preservedAtUtc",
    "status",
    "updateCommandRunRecordFile",
    "sourceIndexFile",
    "sourceIndexSha256",
    "candidateIndex",
    "evidenceEntries",
    "snapshotEntries",
  ], "VISUAL-ARIA-CANDIDATE.json");
  if (value.schemaVersion !== 1
    || value.recordType !== "VISUAL_ARIA_BASELINE_CANDIDATE"
    || value.status !== "CANDIDATE_REVIEW_REQUIRED") {
    throw new Error("VISUAL-ARIA-CANDIDATE.json schema, type, or status is invalid");
  }
  assertCurrentSource(value, options, "VISUAL-ARIA-CANDIDATE.json");
  assertIsoTimestamp(value.preservedAtUtc, "VISUAL-ARIA-CANDIDATE.json.preservedAtUtc");
  assertSha256(value.sourceIndexSha256, "VISUAL-ARIA-CANDIDATE.json.sourceIndexSha256");
  const expectedSourceIndex = outputRelative(options, "VISUAL-ARIA-EVIDENCE.json");
  assertCanonicalReference(value.sourceIndexFile, expectedSourceIndex, options, "VISUAL-ARIA-CANDIDATE.json.sourceIndexFile");
  if (!isRecord(value.candidateIndex)) throw new Error("VISUAL-ARIA-CANDIDATE.json candidateIndex is missing");
  assertExactKeys(value.candidateIndex, ["schemaVersion", "sourceTreeSha256", "baselineKind", "generatedAtUtc", "evidenceFiles"], "candidateIndex");
  if (value.candidateIndex.schemaVersion !== 1 || value.candidateIndex.baselineKind !== "STEP07_BASELINE_CANDIDATE") {
    throw new Error("Preserved visual/ARIA index is not a STEP07_BASELINE_CANDIDATE");
  }
  assertCurrentSource(value.candidateIndex, options, "candidateIndex");
  assertIsoTimestamp(value.candidateIndex.generatedAtUtc, "candidateIndex.generatedAtUtc");
  assertStringArray(value.candidateIndex.evidenceFiles, "candidateIndex.evidenceFiles");
  const canonicalCandidate = `${JSON.stringify(value.candidateIndex, null, 2)}\n`;
  if (sha256(canonicalCandidate) !== normalizeSha256(value.sourceIndexSha256)) {
    throw new Error("Preserved candidate index SHA-256 does not match its canonical content");
  }
  const update = readAndValidateCommandRunRecord(value.updateCommandRunRecordFile as string, { ...options, requirePassing: true });
  if (update.gateId !== "visual-baseline-update") throw new Error("Candidate evidence must cite visual-baseline-update");
  if (Date.parse(value.candidateIndex.generatedAtUtc as string) < Date.parse(update.startedAtUtc)
    || Date.parse(value.candidateIndex.generatedAtUtc as string) > Date.parse(update.finishedAtUtc)) {
    throw new Error("Candidate index timestamp does not fall within the snapshot update run");
  }
  if (Date.parse(value.preservedAtUtc) < Date.parse(update.finishedAtUtc)) throw new Error("Candidate preservation predates the snapshot update completion");
  assertEvidenceFingerprints(value.evidenceEntries, options, "candidate evidenceEntries");
  assertEvidenceFingerprints(value.snapshotEntries, options, "candidate snapshotEntries");
  const evidencePaths = (value.evidenceEntries as EvidenceFingerprint[]).map((entry) => entry.path);
  const declaredEvidencePaths = (value.candidateIndex.evidenceFiles as string[])
    .map((path) => workspaceRelative(path, options.workspaceRoot, "candidate evidence path"))
    .sort();
  if (JSON.stringify(evidencePaths) !== JSON.stringify(declaredEvidencePaths)) {
    throw new Error("Candidate evidence fingerprints do not exactly match candidateIndex.evidenceFiles");
  }
  if (!evidencePaths.some((path) => /\.png$/i.test(path)) || !evidencePaths.some((path) => /\.aria\.ya?ml$/i.test(path))) {
    throw new Error("Candidate evidence must contain visual and ARIA files");
  }
  const snapshotPaths = (value.snapshotEntries as EvidenceFingerprint[]).map((entry) => entry.path);
  if (!snapshotPaths.some((path) => /\.png$/i.test(path)) || !snapshotPaths.some((path) => /\.aria\.ya?ml$/i.test(path))) {
    throw new Error("Candidate snapshot inventory must contain visual and ARIA baselines");
  }
  return value as unknown as VisualAriaCandidateRecord;
}

function validateVisualAriaEvidence(path: string, options: EvidenceValidationOptions): Record<string, unknown> {
  const value = readJsonFile(path, options, "VISUAL-ARIA-EVIDENCE.json");
  assertCurrentSource(value, options, "VISUAL-ARIA-EVIDENCE.json");
  if (value.baselineKind !== "STEP07_ESTABLISHED_BASELINE") throw new Error("Visual/ARIA evidence is not a STEP07_ESTABLISHED_BASELINE");
  assertIsoTimestamp(value.generatedAtUtc, "VISUAL-ARIA-EVIDENCE.json.generatedAtUtc");
  assertReferencedEvidenceFiles(value, options, "VISUAL-ARIA-EVIDENCE.json");
  const evidenceFiles = value.evidenceFiles as string[];
  if (!evidenceFiles.some((file) => /\.png$/i.test(file))) throw new Error("Visual baseline must cite PNG evidence");
  if (!evidenceFiles.some((file) => /\.aria\.ya?ml$/i.test(file))) throw new Error("ARIA baseline must cite ARIA YAML evidence");
  return value;
}

export function validateVisualNoUpdateRunOutput(
  recordFile: string,
  options: EvidenceValidationOptions,
): Record<string, unknown> {
  const run = readAndValidateCommandRunRecord(recordFile, { ...options, requirePassing: true });
  if (run.gateId !== "visual-no-update") throw new Error("Established visual/ARIA output must cite visual-no-update");
  const index = validateVisualAriaEvidence(outputRelative(options, "VISUAL-ARIA-EVIDENCE.json"), options);
  const generatedAt = Date.parse(index.generatedAtUtc as string);
  if (generatedAt < Date.parse(run.startedAtUtc) || generatedAt > Date.parse(run.finishedAtUtc)) {
    throw new Error("Established visual/ARIA index was not generated during the no-update regression run");
  }
  return index;
}

function validateSemanticReviews(paths: Record<SemanticReviewerId, string>, options: EvidenceValidationOptions): string[] {
  const blockerFindingIds: string[] = [];
  for (const reviewer of SEMANTIC_REVIEWER_IDS) {
    const expected = outputRelative(options, "semantic-reviews", `${reviewer}.json`);
    assertCanonicalReference(paths[reviewer], expected, options, `Semantic review ${reviewer}`);
    const value = readJsonFile(paths[reviewer], options, `Semantic review ${reviewer}`);
    const document = parseSemanticReview(value);
    if (normalizeSha256(document.sourceTreeSha256) !== normalizeSha256(options.sourceTreeSha256)) {
      throw new Error(`Semantic review ${reviewer} is stale for the current source tree`);
    }
    for (const evidenceFile of document.evidenceFiles) assertFile(evidenceFile, options, `Semantic review ${reviewer} evidence`);
    for (const finding of document.findings) {
      for (const evidenceFile of finding.evidenceFiles) assertFile(evidenceFile, options, `Semantic finding ${finding.id} evidence`);
      if (finding.severity === "SEV_1" || finding.severity === "SEV_2") blockerFindingIds.push(finding.id);
    }
  }
  return blockerFindingIds;
}

function validateReviewerConflicts(path: string, options: EvidenceValidationOptions): void {
  const value = readJsonFile(path, options, "REVIEW-CONFLICTS.json");
  assertCurrentSource(value, options, "REVIEW-CONFLICTS.json");
  if (value.unresolvedCriticalReviewerConflict !== false) throw new Error("Critical semantic reviewer conflict blocks baseline promotion");
}

function validateScrollMatrix(path: string, options: EvidenceValidationOptions): void {
  const value = readJsonFile(path, options, "SCROLL-MATRIX.json");
  assertCurrentSource(value, options, "SCROLL-MATRIX.json");
  assertStrictScrollMatrixCoverage(value, options.inventoryWorkspaceRoot ?? options.workspaceRoot, options.workspaceRoot);
  if (value.status !== "PASS" || value.passed !== true || value.evidenceComplete !== true) throw new Error("Scroll matrix is not complete PASS evidence");
  if (!Array.isArray(value.missingOrStaleProjects) || value.missingOrStaleProjects.length !== 0) throw new Error("Scroll matrix has missing or stale projects");
  if (!isRecord(value.summary) || !Array.isArray(value.rows) || value.rows.length === 0) throw new Error("Scroll matrix rows or summary are invalid");
  const rows = value.rows.filter(isRecord);
  if (rows.length !== value.rows.length || value.summary.total !== rows.length || value.summary.passed !== rows.length || value.summary.failed !== 0 || value.summary.status !== "PASS") {
    throw new Error("Scroll matrix totals do not prove a complete PASS");
  }
  for (const [index, row] of rows.entries()) {
    if (row.status !== "PASS") throw new Error(`Scroll matrix row ${index} failed`);
    assertEmptyDiagnosticArrays(row, `Scroll matrix row ${index}`);
    if (isRecord(row.network)) assertEmptyDiagnosticArrays(row.network, `Scroll matrix row ${index}.network`);
    assertStringArray(row.screenshots, `Scroll matrix row ${index}.screenshots`);
    for (const screenshot of row.screenshots) assertFile(screenshot, options, `Scroll matrix row ${index} screenshot`);
    if (typeof row.fullPageScreenshot !== "string") throw new Error(`Scroll matrix row ${index} full-page screenshot is missing`);
    assertFile(row.fullPageScreenshot, options, `Scroll matrix row ${index} full-page screenshot`);
  }
  assertReferencedEvidenceFiles(value, options, "SCROLL-MATRIX.json");
}

function validateCatalogSmoke(path: string, options: EvidenceValidationOptions): void {
  const value = readJsonFile(path, options, "GAME-CATALOG-MACHINE-SMOKE.json");
  assertCurrentSource(value, options, "GAME-CATALOG-MACHINE-SMOKE.json");
  assertStrictCatalogSmokeCoverage(value, options.inventoryWorkspaceRoot ?? options.workspaceRoot, options.workspaceRoot);
  if (!Array.isArray(value.results) || value.results.length === 0 || value.status !== "PASS") throw new Error("Catalog smoke is not PASS evidence");
  const results = value.results.filter(isRecord);
  if (results.length !== value.results.length
    || value.expectedResultCount !== results.length
    || value.resultCount !== results.length
    || value.passed !== results.length
    || value.failed !== 0) throw new Error("Catalog smoke totals do not prove a complete PASS");
  for (const [index, result] of results.entries()) {
    if (result.status !== "PASS" || result.returnedToCatalog !== true) throw new Error(`Catalog smoke result ${index} failed`);
    assertEmptyDiagnosticArrays(result, `Catalog smoke result ${index}`);
    if (typeof result.screenshot !== "string" || typeof result.trace !== "string") throw new Error(`Catalog smoke result ${index} evidence paths are missing`);
    assertFile(result.screenshot, options, `Catalog smoke result ${index} screenshot`);
    assertFile(result.trace, options, `Catalog smoke result ${index} trace`);
  }
  assertReferencedEvidenceFiles(value, options, "GAME-CATALOG-MACHINE-SMOKE.json");
}

function validateAgentPlaythroughs(path: string, options: EvidenceValidationOptions): void {
  const value = readJsonFile(path, options, "AGENT-PLAYTHROUGH-RESULTS.json");
  assertCurrentSource(value, options, "AGENT-PLAYTHROUGH-RESULTS.json");
  assertStrictAgentProfileCoverage(value, options.workspaceRoot);
  if (!Array.isArray(value.expectedProfiles) || value.expectedProfiles.length === 0 || !Array.isArray(value.results) || value.status !== "PASS" || value.allExpectedProfilesRecorded !== true) {
    throw new Error("Agent playthrough profiles are not complete PASS evidence");
  }
  const expectedProfiles = value.expectedProfiles.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  const results = value.results.filter(isRecord);
  const actualProfiles = results.map((entry) => entry.profile);
  if (expectedProfiles.length !== value.expectedProfiles.length
    || new Set(expectedProfiles).size !== expectedProfiles.length
    || results.length !== expectedProfiles.length
    || value.profileCount !== results.length
    || value.passed !== results.length
    || value.failed !== 0
    || expectedProfiles.some((profile) => !actualProfiles.includes(profile))) {
    throw new Error("Agent playthrough totals do not prove every expected profile passed");
  }
  if (!isRecord(value.networkPolicy) || value.networkPolicy.externalRequestCount !== 0) throw new Error("Agent playthrough external network blocker is present");
  for (const [index, result] of results.entries()) {
    if (result.status !== "PASS" || result.completed !== true) throw new Error(`Agent playthrough profile ${index} failed`);
    assertEmptyDiagnosticArrays(result, `Agent playthrough profile ${index}`);
    if (typeof result.screenshot !== "string" || typeof result.trace !== "string") throw new Error(`Agent playthrough profile ${index} evidence paths are missing`);
    assertFile(result.screenshot, options, `Agent playthrough profile ${index} screenshot`);
    assertFile(result.trace, options, `Agent playthrough profile ${index} trace`);
  }
  assertReferencedEvidenceFiles(value, options, "AGENT-PLAYTHROUGH-RESULTS.json");
}

function validateDeepRouteEvidence(path: string, options: EvidenceValidationOptions): void {
  const value = readJsonFile(path, options, "DEEP-ROUTE-EVIDENCE.json");
  assertCurrentSource(value, options, "DEEP-ROUTE-EVIDENCE.json");
  const manifest = createMachineReviewManifest(options.inventoryWorkspaceRoot ?? options.workspaceRoot);
  const errors = validateDeepRouteEvidenceReport(value as unknown as DeepRouteEvidenceReport, options.workspaceRoot, manifest);
  if (value.status !== "PASS" || errors.length > 0) throw new Error(`Deep route/accessibility evidence failed: ${errors.join("; ")}`);
  assertReferencedEvidenceFiles(value, options, "DEEP-ROUTE-EVIDENCE.json");
}

function establishmentPrerequisitePaths(record: Omit<BaselineEstablishmentRecord, "prerequisiteEntries">, options: EvidenceValidationOptions): string[] {
  const paths = [
    record.preChangeReferenceFile,
    record.candidateEvidenceFile,
    record.visualBaselineUpdateRecordFile,
    record.reviewerConflictFile,
    record.scrollMatrixFile,
    record.catalogSmokeFile,
    record.agentPlaythroughsFile,
    record.deepRouteEvidenceFile,
    ...SEMANTIC_REVIEWER_IDS.map((reviewer) => record.semanticReviewFiles[reviewer]),
    ...ORDINARY_COMMAND_GATE_IDS.map((gateId) => record.ordinaryCommandRunRecordFiles[gateId]),
  ];
  const commandRecordPaths = [record.visualBaselineUpdateRecordFile, ...ORDINARY_COMMAND_GATE_IDS.map((gateId) => record.ordinaryCommandRunRecordFiles[gateId])];
  for (const path of commandRecordPaths) {
    const command = readAndValidateCommandRunRecord(path, { ...options, requirePassing: true });
    paths.push(command.logPath);
  }
  return [...new Set(paths.map((path) => workspaceRelative(path, options.workspaceRoot, "baseline prerequisite")))].sort();
}

export function validateBaselineEstablishmentRecord(
  value: unknown,
  options: EvidenceValidationOptions,
): BaselineEstablishmentRecord {
  if (!isRecord(value)) throw new Error("BASELINE-ESTABLISHMENT.json must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "recordType",
    "sourceTreeSha256",
    "establishedAtUtc",
    "status",
    "visualBaselineUpdateRecordFile",
    "candidateEvidenceFile",
    "preChangeReferenceFile",
    "ordinaryCommandRunRecordFiles",
    "semanticReviewFiles",
    "reviewerConflictFile",
    "scrollMatrixFile",
    "catalogSmokeFile",
    "agentPlaythroughsFile",
    "deepRouteEvidenceFile",
    "prerequisiteEntries",
    "blockerFindingIds",
    "unresolvedCriticalReviewerConflict",
    "realChildEvidenceClaimed",
    "limitations",
  ], "BASELINE-ESTABLISHMENT.json");
  if (value.schemaVersion !== 1
    || value.recordType !== "VISUAL_ARIA_BASELINE_ESTABLISHMENT"
    || value.status !== "PASS") throw new Error("BASELINE-ESTABLISHMENT.json schema, type, or status is invalid");
  assertCurrentSource(value, options, "BASELINE-ESTABLISHMENT.json");
  assertIsoTimestamp(value.establishedAtUtc, "BASELINE-ESTABLISHMENT.json.establishedAtUtc");
  if (!isRecord(value.ordinaryCommandRunRecordFiles)) throw new Error("Baseline establishment must cite all five ordinary command records");
  assertExactKeys(value.ordinaryCommandRunRecordFiles, ORDINARY_COMMAND_GATE_IDS, "Baseline establishment ordinaryCommandRunRecordFiles");
  if (!isRecord(value.semanticReviewFiles)) throw new Error("Baseline establishment must cite all three semantic reviews");
  assertExactKeys(value.semanticReviewFiles, SEMANTIC_REVIEWER_IDS, "Baseline establishment semanticReviewFiles");
  if (!Array.isArray(value.blockerFindingIds) || value.blockerFindingIds.length !== 0) throw new Error("Semantic Sev-1/2 findings block baseline establishment");
  if (value.unresolvedCriticalReviewerConflict !== false) throw new Error("Critical reviewer conflict blocks baseline establishment");
  if (value.realChildEvidenceClaimed !== false) throw new Error("Machine baseline establishment cannot claim real-child evidence");
  assertStringArray(value.limitations, "Baseline establishment limitations");
  if (!value.limitations.includes(MACHINE_ONLY_LIMITATION)) throw new Error("Baseline establishment must preserve the machine-only limitation");

  const record = value as unknown as BaselineEstablishmentRecord;
  const expectedCandidate = outputRelative(options, "VISUAL-ARIA-CANDIDATE.json");
  const expectedPreChange = outputRelative(options, "pre-change-reference", "PRE-CHANGE-REFERENCE.json");
  const expectedConflict = outputRelative(options, "semantic-reviews", "REVIEW-CONFLICTS.json");
  const expectedScroll = outputRelative(options, "SCROLL-MATRIX.json");
  const expectedCatalog = outputRelative(options, "GAME-CATALOG-MACHINE-SMOKE.json");
  const expectedProfiles = outputRelative(options, "agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json");
  const expectedDeep = outputRelative(options, "DEEP-ROUTE-EVIDENCE.json");
  assertCanonicalReference(record.candidateEvidenceFile, expectedCandidate, options, "Baseline establishment candidateEvidenceFile");
  assertCanonicalReference(record.preChangeReferenceFile, expectedPreChange, options, "Baseline establishment preChangeReferenceFile");
  assertCanonicalReference(record.reviewerConflictFile, expectedConflict, options, "Baseline establishment reviewerConflictFile");
  assertCanonicalReference(record.scrollMatrixFile, expectedScroll, options, "Baseline establishment scrollMatrixFile");
  assertCanonicalReference(record.catalogSmokeFile, expectedCatalog, options, "Baseline establishment catalogSmokeFile");
  assertCanonicalReference(record.agentPlaythroughsFile, expectedProfiles, options, "Baseline establishment agentPlaythroughsFile");
  assertCanonicalReference(record.deepRouteEvidenceFile, expectedDeep, options, "Baseline establishment deepRouteEvidenceFile");

  const update = readAndValidateCommandRunRecord(record.visualBaselineUpdateRecordFile, { ...options, requirePassing: true });
  if (update.gateId !== "visual-baseline-update") throw new Error("Baseline establishment must cite visual-baseline-update");
  const candidateValue = readJsonFile(record.candidateEvidenceFile, options, "VISUAL-ARIA-CANDIDATE.json");
  const candidate = validateVisualAriaCandidateRecord(candidateValue, options);
  if (workspaceRelative(candidate.updateCommandRunRecordFile, options.workspaceRoot, "candidate update record")
    !== workspaceRelative(record.visualBaselineUpdateRecordFile, options.workspaceRoot, "establishment update record")) {
    throw new Error("Baseline establishment and candidate must cite the same snapshot update run");
  }
  const establishmentTime = Date.parse(record.establishedAtUtc);
  if (establishmentTime < Date.parse(update.finishedAtUtc) || establishmentTime < Date.parse(candidate.preservedAtUtc)) {
    throw new Error("Baseline establishment must occur after snapshot update and candidate preservation");
  }

  for (const gateId of ORDINARY_COMMAND_GATE_IDS) {
    const command = readAndValidateCommandRunRecord(record.ordinaryCommandRunRecordFiles[gateId], { ...options, requirePassing: true });
    if (command.gateId !== gateId) throw new Error(`Baseline establishment command ${gateId} cites ${command.gateId}`);
    if (establishmentTime < Date.parse(command.finishedAtUtc)) throw new Error(`Baseline establishment predates ${gateId}`);
  }
  const blockerFindingIds = validateSemanticReviews(record.semanticReviewFiles as Record<SemanticReviewerId, string>, options);
  if (blockerFindingIds.length > 0 || JSON.stringify(blockerFindingIds) !== JSON.stringify(record.blockerFindingIds)) {
    throw new Error(`Semantic blockers prevent baseline establishment: ${blockerFindingIds.join(",")}`);
  }
  const candidateEvidencePaths = new Set(candidate.evidenceEntries.map((entry) => entry.path));
  for (const reviewer of SEMANTIC_REVIEWER_IDS) {
    const document = parseSemanticReview(readJsonFile(record.semanticReviewFiles[reviewer], options, `Semantic review ${reviewer}`));
    const reviewTime = Date.parse(document.completedAtUtc);
    if (reviewTime < Date.parse(update.finishedAtUtc)) throw new Error(`Semantic review ${reviewer} predates the baseline candidate update`);
    if (reviewTime > establishmentTime) throw new Error(`Baseline establishment predates semantic review ${reviewer}`);
    const reviewedCandidatePaths = document.evidenceFiles
      .map((path) => workspaceRelative(path, options.workspaceRoot, `Semantic review ${reviewer} evidence`))
      .filter((path) => candidateEvidencePaths.has(path));
    if (!reviewedCandidatePaths.some((path) => /\.png$/i.test(path))
      || !reviewedCandidatePaths.some((path) => /\.aria\.ya?ml$/i.test(path))) {
      throw new Error(`Semantic review ${reviewer} must review the preserved candidate visual and ARIA evidence`);
    }
  }
  validatePreChangeReference(record.preChangeReferenceFile, options);
  validateReviewerConflicts(record.reviewerConflictFile, options);
  validateScrollMatrix(record.scrollMatrixFile, options);
  validateCatalogSmoke(record.catalogSmokeFile, options);
  validateAgentPlaythroughs(record.agentPlaythroughsFile, options);
  validateDeepRouteEvidence(record.deepRouteEvidenceFile, options);
  const deep = readJsonFile(record.deepRouteEvidenceFile, options, "DEEP-ROUTE-EVIDENCE.json");
  assertIsoTimestamp(deep.generatedAtUtc, "DEEP-ROUTE-EVIDENCE.json.generatedAtUtc");
  if (Date.parse(deep.generatedAtUtc) > establishmentTime) throw new Error("Baseline establishment predates deep route evidence");

  assertEvidenceFingerprints(record.prerequisiteEntries, options, "Baseline establishment prerequisiteEntries");
  const expectedEntries = establishmentPrerequisitePaths(record, options)
    .map((path) => fingerprintFile(path, options, "baseline prerequisite"));
  if (JSON.stringify(record.prerequisiteEntries) !== JSON.stringify(expectedEntries)) {
    throw new Error("Baseline establishment prerequisite fingerprints are incomplete or stale");
  }
  return record;
}

export function createBaselineEstablishmentRecord(
  options: EvidenceValidationOptions & {
    readonly visualBaselineUpdateRecordFile: string;
    readonly ordinaryCommandRunRecordFiles: Readonly<Record<OrdinaryCommandGateId, string>>;
    readonly establishedAtUtc?: string;
  },
): BaselineEstablishmentRecord {
  const semanticReviewFiles = Object.fromEntries(
    SEMANTIC_REVIEWER_IDS.map((reviewer) => [reviewer, outputRelative(options, "semantic-reviews", `${reviewer}.json`)]),
  ) as Record<SemanticReviewerId, string>;
  const partial = {
    schemaVersion: 1 as const,
    recordType: "VISUAL_ARIA_BASELINE_ESTABLISHMENT" as const,
    sourceTreeSha256: normalizeSha256(options.sourceTreeSha256),
    establishedAtUtc: options.establishedAtUtc ?? new Date().toISOString(),
    status: "PASS" as const,
    visualBaselineUpdateRecordFile: workspaceRelative(options.visualBaselineUpdateRecordFile, options.workspaceRoot, "visual baseline update record"),
    candidateEvidenceFile: outputRelative(options, "VISUAL-ARIA-CANDIDATE.json"),
    preChangeReferenceFile: outputRelative(options, "pre-change-reference", "PRE-CHANGE-REFERENCE.json"),
    ordinaryCommandRunRecordFiles: Object.fromEntries(ORDINARY_COMMAND_GATE_IDS.map((gateId) => [
      gateId,
      workspaceRelative(options.ordinaryCommandRunRecordFiles[gateId], options.workspaceRoot, `${gateId} record`),
    ])) as Record<OrdinaryCommandGateId, string>,
    semanticReviewFiles,
    reviewerConflictFile: outputRelative(options, "semantic-reviews", "REVIEW-CONFLICTS.json"),
    scrollMatrixFile: outputRelative(options, "SCROLL-MATRIX.json"),
    catalogSmokeFile: outputRelative(options, "GAME-CATALOG-MACHINE-SMOKE.json"),
    agentPlaythroughsFile: outputRelative(options, "agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json"),
    deepRouteEvidenceFile: outputRelative(options, "DEEP-ROUTE-EVIDENCE.json"),
    blockerFindingIds: [] as const,
    unresolvedCriticalReviewerConflict: false as const,
    realChildEvidenceClaimed: false as const,
    limitations: [MACHINE_ONLY_LIMITATION],
  };
  const record: BaselineEstablishmentRecord = {
    ...partial,
    prerequisiteEntries: establishmentPrerequisitePaths(partial, options)
      .map((path) => fingerprintFile(path, options, "baseline prerequisite")),
  };
  return validateBaselineEstablishmentRecord(record, options);
}

function assertBaselineStageRecords(value: readonly BaselineStageRecord[], record: BaselinePromotionRecord): void {
  const expected: readonly BaselineStageRecord[] = [
    { stage: "PRE_CHANGE_REFERENCE", evidenceFile: record.preChangeReferenceFile },
    { stage: "STEP07_ESTABLISHED_BASELINE", evidenceFile: record.establishmentRecordFile, commandRunRecordFile: record.commandRunRecordFiles.visualBaselineUpdate },
    { stage: "REGRESSION_PASS", evidenceFile: record.visualAriaEvidenceFile, commandRunRecordFile: record.commandRunRecordFiles.visualNoUpdate },
  ];
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error("Baseline promotion must record PRE_CHANGE_REFERENCE, STEP07_ESTABLISHED_BASELINE, and REGRESSION_PASS in order");
  }
}

export function validateBaselinePromotionRecord(value: unknown, options: EvidenceValidationOptions): BaselinePromotionRecord {
  if (!isRecord(value)) throw new Error("Baseline promotion record must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "recordType",
    "sourceTreeSha256",
    "promotedAtUtc",
    "status",
    "stages",
    "commandRunRecordFiles",
    "establishmentRecordFile",
    "candidateEvidenceFile",
    "preChangeReferenceFile",
    "visualAriaEvidenceFile",
    "semanticReviewFiles",
    "reviewerConflictFile",
    "scrollMatrixFile",
    "catalogSmokeFile",
    "agentPlaythroughsFile",
    "deepRouteEvidenceFile",
    "blockerFindingIds",
    "unresolvedCriticalReviewerConflict",
    "realChildEvidenceClaimed",
    "limitations",
  ], "Baseline promotion record");
  if (value.schemaVersion !== 1 || value.recordType !== "VISUAL_ARIA_BASELINE_PROMOTION" || value.status !== "PASS") throw new Error("Baseline promotion schema, type, or status is invalid");
  assertCurrentSource(value, options, "Baseline promotion record");
  assertIsoTimestamp(value.promotedAtUtc, "Baseline promotion promotedAtUtc");
  if (!isRecord(value.commandRunRecordFiles)) throw new Error("Baseline promotion must reference both visual command runs");
  assertExactKeys(value.commandRunRecordFiles, ["visualBaselineUpdate", "visualNoUpdate"], "Baseline promotion commandRunRecordFiles");
  if (!isRecord(value.semanticReviewFiles)) throw new Error("Baseline promotion must reference three semantic reviews");
  assertExactKeys(value.semanticReviewFiles, SEMANTIC_REVIEWER_IDS, "Baseline promotion semanticReviewFiles");
  if (!Array.isArray(value.stages)) throw new Error("Baseline promotion stages must be an array");
  if (!Array.isArray(value.blockerFindingIds) || value.blockerFindingIds.length !== 0) throw new Error("Semantic Sev-1/2 findings block baseline promotion");
  if (value.unresolvedCriticalReviewerConflict !== false) throw new Error("Unresolved critical reviewer conflict blocks baseline promotion");
  if (value.realChildEvidenceClaimed !== false) throw new Error("Machine baseline promotion cannot claim real-child evidence");
  assertStringArray(value.limitations, "Baseline promotion limitations");
  if (!value.limitations.includes(MACHINE_ONLY_LIMITATION)) throw new Error("Baseline promotion must preserve the machine-only limitation");

  const record = value as unknown as BaselinePromotionRecord;
  const expectedPreChange = outputRelative(options, "pre-change-reference", "PRE-CHANGE-REFERENCE.json");
  const expectedCandidate = outputRelative(options, "VISUAL-ARIA-CANDIDATE.json");
  const expectedEstablishment = outputRelative(options, "hard-gates", "BASELINE-ESTABLISHMENT.json");
  const expectedVisualAria = outputRelative(options, "VISUAL-ARIA-EVIDENCE.json");
  const expectedConflict = outputRelative(options, "semantic-reviews", "REVIEW-CONFLICTS.json");
  const expectedScroll = outputRelative(options, "SCROLL-MATRIX.json");
  const expectedCatalog = outputRelative(options, "GAME-CATALOG-MACHINE-SMOKE.json");
  const expectedProfiles = outputRelative(options, "agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json");
  const expectedDeepRoute = outputRelative(options, "DEEP-ROUTE-EVIDENCE.json");
  assertCanonicalReference(record.preChangeReferenceFile, expectedPreChange, options, "Baseline promotion preChangeReferenceFile");
  assertCanonicalReference(record.candidateEvidenceFile, expectedCandidate, options, "Baseline promotion candidateEvidenceFile");
  assertCanonicalReference(record.establishmentRecordFile, expectedEstablishment, options, "Baseline promotion establishmentRecordFile");
  assertCanonicalReference(record.visualAriaEvidenceFile, expectedVisualAria, options, "Baseline promotion visualAriaEvidenceFile");
  assertCanonicalReference(record.reviewerConflictFile, expectedConflict, options, "Baseline promotion reviewerConflictFile");
  assertCanonicalReference(record.scrollMatrixFile, expectedScroll, options, "Baseline promotion scrollMatrixFile");
  assertCanonicalReference(record.catalogSmokeFile, expectedCatalog, options, "Baseline promotion catalogSmokeFile");
  assertCanonicalReference(record.agentPlaythroughsFile, expectedProfiles, options, "Baseline promotion agentPlaythroughsFile");
  assertCanonicalReference(record.deepRouteEvidenceFile, expectedDeepRoute, options, "Baseline promotion deepRouteEvidenceFile");

  const update = readAndValidateCommandRunRecord(record.commandRunRecordFiles.visualBaselineUpdate, { ...options, requirePassing: true });
  const noUpdate = readAndValidateCommandRunRecord(record.commandRunRecordFiles.visualNoUpdate, { ...options, requirePassing: true });
  if (update.gateId !== "visual-baseline-update") throw new Error("Baseline establishment must cite the fixed visual-baseline-update run");
  if (noUpdate.gateId !== "visual-no-update") throw new Error("Regression proof must cite the fixed visual-no-update run");
  const establishment = validateBaselineEstablishmentRecord(
    readJsonFile(record.establishmentRecordFile, options, "BASELINE-ESTABLISHMENT.json"),
    options,
  );
  if (workspaceRelative(establishment.visualBaselineUpdateRecordFile, options.workspaceRoot, "establishment update record")
    !== workspaceRelative(record.commandRunRecordFiles.visualBaselineUpdate, options.workspaceRoot, "promotion update record")) {
    throw new Error("Baseline promotion and establishment must cite the same snapshot update run");
  }
  if (workspaceRelative(establishment.candidateEvidenceFile, options.workspaceRoot, "establishment candidate")
    !== workspaceRelative(record.candidateEvidenceFile, options.workspaceRoot, "promotion candidate")) {
    throw new Error("Baseline promotion and establishment must cite the same candidate index");
  }
  if (update.runId === noUpdate.runId || Date.parse(update.finishedAtUtc) > Date.parse(establishment.establishedAtUtc)) {
    throw new Error("Baseline establishment must run after the baseline update completes");
  }
  if (Date.parse(establishment.establishedAtUtc) >= Date.parse(noUpdate.startedAtUtc)) {
    throw new Error("The visual-no-update regression must start after baseline establishment");
  }
  if (normalizeSha256(noUpdate.sourceTreeSha256Before) !== normalizeSha256(noUpdate.sourceTreeSha256After)) {
    throw new Error("The visual-no-update regression changed the source tree");
  }
  if (Date.parse(record.promotedAtUtc) < Date.parse(noUpdate.finishedAtUtc)) throw new Error("Baseline promotion predates the no-update regression");

  assertBaselineStageRecords(record.stages, record);
  validatePreChangeReference(record.preChangeReferenceFile, options);
  const visualAriaEvidence = validateVisualAriaEvidence(record.visualAriaEvidenceFile, options);
  if (Date.parse(visualAriaEvidence.generatedAtUtc as string) < Date.parse(noUpdate.startedAtUtc)
    || Date.parse(visualAriaEvidence.generatedAtUtc as string) > Date.parse(noUpdate.finishedAtUtc)) {
    throw new Error("Visual/ARIA evidence index was not regenerated by the no-update regression run");
  }
  const blockerFindingIds = validateSemanticReviews(record.semanticReviewFiles as Record<SemanticReviewerId, string>, options);
  if (blockerFindingIds.length > 0 || JSON.stringify(blockerFindingIds) !== JSON.stringify(record.blockerFindingIds)) {
    throw new Error(`Semantic blockers prevent baseline promotion: ${blockerFindingIds.join(",")}`);
  }
  validateReviewerConflicts(record.reviewerConflictFile, options);
  validateScrollMatrix(record.scrollMatrixFile, options);
  validateCatalogSmoke(record.catalogSmokeFile, options);
  validateAgentPlaythroughs(record.agentPlaythroughsFile, options);
  validateDeepRouteEvidence(record.deepRouteEvidenceFile, options);
  return record;
}

export function createBaselinePromotionRecord(
  options: EvidenceValidationOptions & {
    readonly visualBaselineUpdateRecordFile: string;
    readonly visualNoUpdateRecordFile: string;
    readonly promotedAtUtc?: string;
  },
): BaselinePromotionRecord {
  const preChangeReferenceFile = outputRelative(options, "pre-change-reference", "PRE-CHANGE-REFERENCE.json");
  const candidateEvidenceFile = outputRelative(options, "VISUAL-ARIA-CANDIDATE.json");
  const establishmentRecordFile = outputRelative(options, "hard-gates", "BASELINE-ESTABLISHMENT.json");
  const visualAriaEvidenceFile = outputRelative(options, "VISUAL-ARIA-EVIDENCE.json");
  const commandRunRecordFiles = {
    visualBaselineUpdate: workspaceRelative(options.visualBaselineUpdateRecordFile, options.workspaceRoot, "visual baseline update record"),
    visualNoUpdate: workspaceRelative(options.visualNoUpdateRecordFile, options.workspaceRoot, "visual no-update record"),
  };
  const semanticReviewFiles = Object.fromEntries(
    SEMANTIC_REVIEWER_IDS.map((reviewer) => [reviewer, outputRelative(options, "semantic-reviews", `${reviewer}.json`)]),
  ) as Record<SemanticReviewerId, string>;
  const record: BaselinePromotionRecord = {
    schemaVersion: 1,
    recordType: "VISUAL_ARIA_BASELINE_PROMOTION",
    sourceTreeSha256: normalizeSha256(options.sourceTreeSha256),
    promotedAtUtc: options.promotedAtUtc ?? new Date().toISOString(),
    status: "PASS",
    stages: [
      { stage: "PRE_CHANGE_REFERENCE", evidenceFile: preChangeReferenceFile },
      { stage: "STEP07_ESTABLISHED_BASELINE", evidenceFile: establishmentRecordFile, commandRunRecordFile: commandRunRecordFiles.visualBaselineUpdate },
      { stage: "REGRESSION_PASS", evidenceFile: visualAriaEvidenceFile, commandRunRecordFile: commandRunRecordFiles.visualNoUpdate },
    ],
    commandRunRecordFiles,
    establishmentRecordFile,
    candidateEvidenceFile,
    preChangeReferenceFile,
    visualAriaEvidenceFile,
    semanticReviewFiles,
    reviewerConflictFile: outputRelative(options, "semantic-reviews", "REVIEW-CONFLICTS.json"),
    scrollMatrixFile: outputRelative(options, "SCROLL-MATRIX.json"),
    catalogSmokeFile: outputRelative(options, "GAME-CATALOG-MACHINE-SMOKE.json"),
    agentPlaythroughsFile: outputRelative(options, "agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json"),
    deepRouteEvidenceFile: outputRelative(options, "DEEP-ROUTE-EVIDENCE.json"),
    blockerFindingIds: [],
    unresolvedCriticalReviewerConflict: false,
    realChildEvidenceClaimed: false,
    limitations: [MACHINE_ONLY_LIMITATION],
  };
  return validateBaselinePromotionRecord(record, options);
}

function expectedOrdinaryEvidenceFiles(recordFile: string, record: CommandRunEvidenceRecord, options: EvidenceValidationOptions): string[] {
  return [
    workspaceRelative(recordFile, options.workspaceRoot, "command record evidence"),
    workspaceRelative(record.logPath, options.workspaceRoot, "command log evidence"),
  ];
}

function visualGateEvidenceFiles(
  gateId: "visual-regression" | "aria-snapshots",
  promotionFile: string,
  promotion: BaselinePromotionRecord,
  options: EvidenceValidationOptions,
): string[] {
  const update = readAndValidateCommandRunRecord(promotion.commandRunRecordFiles.visualBaselineUpdate, { ...options, requirePassing: true });
  const noUpdate = readAndValidateCommandRunRecord(promotion.commandRunRecordFiles.visualNoUpdate, { ...options, requirePassing: true });
  const visualIndex = validateVisualAriaEvidence(promotion.visualAriaEvidenceFile, options);
  const extension = gateId === "visual-regression" ? /\.png$/i : /\.aria\.ya?ml$/i;
  const kindEvidence = (visualIndex.evidenceFiles as string[]).filter((path) => extension.test(path));
  return [
    workspaceRelative(promotionFile, options.workspaceRoot, "baseline promotion evidence"),
    workspaceRelative(promotion.establishmentRecordFile, options.workspaceRoot, "baseline establishment evidence"),
    workspaceRelative(promotion.candidateEvidenceFile, options.workspaceRoot, "visual ARIA candidate evidence"),
    workspaceRelative(promotion.commandRunRecordFiles.visualBaselineUpdate, options.workspaceRoot, "visual baseline update record"),
    workspaceRelative(update.logPath, options.workspaceRoot, "visual baseline update log"),
    workspaceRelative(promotion.commandRunRecordFiles.visualNoUpdate, options.workspaceRoot, "visual no-update record"),
    workspaceRelative(noUpdate.logPath, options.workspaceRoot, "visual no-update log"),
    workspaceRelative(promotion.visualAriaEvidenceFile, options.workspaceRoot, "visual ARIA evidence index"),
    ...kindEvidence.map((path) => workspaceRelative(path, options.workspaceRoot, `${gateId} evidence`)),
  ];
}

export function deriveCommandGateResultsDocument(options: DeriveCommandGateOptions): CommandGateResultsDocument {
  const ordinaryRecords = Object.fromEntries(ORDINARY_COMMAND_GATE_IDS.map((gateId) => {
    const recordFile = options.commandRunRecordFiles[gateId];
    const record = readAndValidateCommandRunRecord(recordFile, { ...options, requirePassing: true });
    if (record.gateId !== gateId) throw new Error(`Command gate ${gateId} cites a ${record.gateId} run`);
    return [gateId, { recordFile, record }];
  })) as Record<OrdinaryCommandGateId, { recordFile: string; record: CommandRunEvidenceRecord }>;
  const promotionValue = readJsonFile(options.baselinePromotionFile, options, "BASELINE-PROMOTION.json");
  const promotion = validateBaselinePromotionRecord(promotionValue, options);
  if (workspaceRelative(options.commandRunRecordFiles["visual-baseline-update"], options.workspaceRoot, "visual update record")
    !== workspaceRelative(promotion.commandRunRecordFiles.visualBaselineUpdate, options.workspaceRoot, "promoted visual update record")
    || workspaceRelative(options.commandRunRecordFiles["visual-no-update"], options.workspaceRoot, "visual no-update record")
    !== workspaceRelative(promotion.commandRunRecordFiles.visualNoUpdate, options.workspaceRoot, "promoted visual no-update record")) {
    throw new Error("Baseline promotion does not cite the selected visual command records");
  }
  const results: DerivedCommandGateResult[] = [
    ...ORDINARY_COMMAND_GATE_IDS.map((gateId): DerivedCommandGateResult => ({
      id: gateId,
      status: "PASS",
      evidenceFiles: expectedOrdinaryEvidenceFiles(ordinaryRecords[gateId].recordFile, ordinaryRecords[gateId].record, options),
      detail: COMMAND_GATE_DETAILS[gateId],
      provenance: {
        kind: "COMMAND_RUN_RECORD",
        recordFile: workspaceRelative(ordinaryRecords[gateId].recordFile, options.workspaceRoot, `${gateId} record`),
      },
    })),
    ...(["visual-regression", "aria-snapshots"] as const).map((gateId): DerivedCommandGateResult => ({
      id: gateId,
      status: "PASS",
      evidenceFiles: visualGateEvidenceFiles(gateId, options.baselinePromotionFile, promotion, options),
      detail: COMMAND_GATE_DETAILS[gateId],
      provenance: {
        kind: "BASELINE_PROMOTION",
        recordFile: workspaceRelative(options.baselinePromotionFile, options.workspaceRoot, "baseline promotion record"),
        stage: "REGRESSION_PASS",
      },
    })),
  ];
  return {
    schemaVersion: 1,
    sourceTreeSha256: normalizeSha256(options.sourceTreeSha256),
    generatedAtUtc: options.generatedAtUtc ?? new Date().toISOString(),
    derivation: "ACTUAL_COMMAND_RECORDS_AND_BASELINE_PROMOTION",
    status: "PASS",
    realChildEvidenceClaimed: false,
    limitations: [MACHINE_ONLY_LIMITATION],
    results,
  };
}

export function validateCommandGateResultsForFinalizer(
  value: unknown,
  options: EvidenceValidationOptions,
): CommandGateResultsDocument {
  if (!isRecord(value)) throw new Error("COMMAND-GATE-RESULTS.json must be an object");
  assertExactKeys(value, [
    "schemaVersion",
    "sourceTreeSha256",
    "generatedAtUtc",
    "derivation",
    "status",
    "realChildEvidenceClaimed",
    "limitations",
    "results",
  ], "COMMAND-GATE-RESULTS.json");
  if (value.schemaVersion !== 1
    || value.derivation !== "ACTUAL_COMMAND_RECORDS_AND_BASELINE_PROMOTION"
    || value.status !== "PASS") throw new Error("COMMAND-GATE-RESULTS.json schema, derivation, or status is invalid");
  assertCurrentSource(value, options, "COMMAND-GATE-RESULTS.json");
  assertIsoTimestamp(value.generatedAtUtc, "COMMAND-GATE-RESULTS.json.generatedAtUtc");
  const generatedAt = Date.parse(value.generatedAtUtc);
  if (value.realChildEvidenceClaimed !== false) throw new Error("Command gates cannot claim real-child evidence");
  assertStringArray(value.limitations, "COMMAND-GATE-RESULTS.json.limitations");
  if (!value.limitations.includes(MACHINE_ONLY_LIMITATION)) throw new Error("Command gates must preserve the machine-only limitation");
  if (!Array.isArray(value.results) || value.results.length !== COMMAND_GATE_IDS.length) throw new Error("COMMAND-GATE-RESULTS.json must contain exactly seven command gates");
  const results = value.results.filter(isRecord);
  const ids = results.map((result) => result.id);
  if (results.length !== COMMAND_GATE_IDS.length || new Set(ids).size !== ids.length || COMMAND_GATE_IDS.some((id) => !ids.includes(id))) {
    throw new Error("COMMAND-GATE-RESULTS.json must contain the exact seven command gates");
  }

  let promotionCache: { path: string; record: BaselinePromotionRecord } | null = null;
  for (const gateId of COMMAND_GATE_IDS) {
    const result = results.find((entry) => entry.id === gateId)!;
    assertExactKeys(result, ["id", "status", "evidenceFiles", "detail", "provenance"], `Command gate ${gateId}`);
    if (result.status !== "PASS" || result.detail !== COMMAND_GATE_DETAILS[gateId]) throw new Error(`Command gate ${gateId} is not derived PASS evidence`);
    assertStringArray(result.evidenceFiles, `Command gate ${gateId}.evidenceFiles`);
    if (!isRecord(result.provenance)) throw new Error(`Command gate ${gateId} provenance is missing`);
    if (ORDINARY_COMMAND_GATE_IDS.includes(gateId as OrdinaryCommandGateId)) {
      assertExactKeys(result.provenance, ["kind", "recordFile"], `Command gate ${gateId} provenance`);
      if (result.provenance.kind !== "COMMAND_RUN_RECORD" || typeof result.provenance.recordFile !== "string") throw new Error(`Command gate ${gateId} must cite an actual command record`);
      const record = readAndValidateCommandRunRecord(result.provenance.recordFile, { ...options, requirePassing: true });
      if (record.gateId !== gateId) throw new Error(`Command gate ${gateId} cites a ${record.gateId} run`);
      if (generatedAt < Date.parse(record.finishedAtUtc)) throw new Error(`Command gate ${gateId} document predates its command run`);
      const expectedEvidence = expectedOrdinaryEvidenceFiles(result.provenance.recordFile, record, options);
      if (JSON.stringify(result.evidenceFiles) !== JSON.stringify(expectedEvidence)) throw new Error(`Command gate ${gateId} evidence was not derived from its command record`);
    } else {
      assertExactKeys(result.provenance, ["kind", "recordFile", "stage"], `Command gate ${gateId} provenance`);
      if (result.provenance.kind !== "BASELINE_PROMOTION" || result.provenance.stage !== "REGRESSION_PASS" || typeof result.provenance.recordFile !== "string") {
        throw new Error(`Command gate ${gateId} must derive only from a REGRESSION_PASS baseline promotion`);
      }
      const promotionPath = workspaceRelative(result.provenance.recordFile, options.workspaceRoot, `${gateId} promotion record`);
      const expectedPromotionPath = outputRelative(options, "hard-gates", "BASELINE-PROMOTION.json");
      if (promotionPath !== expectedPromotionPath) throw new Error(`Command gate ${gateId} must cite the canonical BASELINE-PROMOTION.json`);
      if (!promotionCache) {
        const promotionValue = readJsonFile(promotionPath, options, "BASELINE-PROMOTION.json");
        promotionCache = { path: promotionPath, record: validateBaselinePromotionRecord(promotionValue, options) };
      } else if (promotionCache.path !== promotionPath) {
        throw new Error("Visual and ARIA command gates must cite the same baseline promotion");
      }
      if (generatedAt < Date.parse(promotionCache.record.promotedAtUtc)) throw new Error(`Command gate ${gateId} document predates baseline promotion`);
      const expectedEvidence = visualGateEvidenceFiles(gateId as "visual-regression" | "aria-snapshots", promotionCache.path, promotionCache.record, options);
      if (JSON.stringify(result.evidenceFiles) !== JSON.stringify(expectedEvidence)) throw new Error(`Command gate ${gateId} evidence was not derived from baseline promotion`);
    }
    for (const evidenceFile of result.evidenceFiles) assertFile(evidenceFile, options, `Command gate ${gateId} evidence`);
  }
  return value as unknown as CommandGateResultsDocument;
}

export function findLatestCommandRunRecordFilesFor<const GateId extends CommandRunGateId>(
  options: EvidenceValidationOptions,
  gateIds: readonly GateId[],
): Readonly<Record<GateId, string>> {
  const directory = resolve(outputDirectory(options), "hard-gates", "commands");
  if (!existsSync(directory) || !statSync(directory).isDirectory()) throw new Error("Command evidence directory does not exist");
  const grouped = new Map<CommandRunGateId, Array<{ path: string; record: CommandRunEvidenceRecord }>>();
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".json")).sort()) {
    const path = workspaceRelative(resolve(directory, name), options.workspaceRoot, "command record candidate");
    const record = readAndValidateCommandRunRecord(path, { ...options, requirePassing: false });
    const entries = grouped.get(record.gateId) ?? [];
    entries.push({ path, record });
    grouped.set(record.gateId, entries);
  }
  return Object.fromEntries(gateIds.map((gateId) => {
    const candidates = grouped.get(gateId) ?? [];
    if (candidates.length === 0) throw new Error(`No actual command record exists for ${gateId}`);
    candidates.sort((left, right) => Date.parse(right.record.finishedAtUtc) - Date.parse(left.record.finishedAtUtc));
    const latest = candidates[0];
    validateCommandRunRecord(latest.record, { ...options, requirePassing: true });
    return [gateId, latest.path];
  })) as Readonly<Record<GateId, string>>;
}

export function findLatestCommandRunRecordFiles(options: EvidenceValidationOptions): Readonly<Record<CommandRunGateId, string>> {
  return findLatestCommandRunRecordFilesFor(options, COMMAND_RUN_GATE_IDS);
}
