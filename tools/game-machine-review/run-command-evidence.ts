import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  COMMAND_RUN_GATE_IDS,
  DEFAULT_MACHINE_REVIEW_OUTPUT,
  FIXED_COMMAND_DEFINITIONS,
  ORDINARY_COMMAND_GATE_IDS,
  commandLogPath,
  commandRecordPath,
  createBaselineEstablishmentRecord,
  createVisualAriaCandidateRecord,
  findLatestCommandRunRecordFilesFor,
  validateBaselineEstablishmentRecord,
  validateCommandRunRecord,
  validateVisualAriaCandidateRecord,
  validateVisualNoUpdateRunOutput,
  type BaselineEstablishmentRecord,
  type CommandRunEvidenceRecord,
  type CommandRunGateId,
  type VisualAriaCandidateRecord,
} from "./command-evidence";
import { computeMachineReviewSourceTreeSha256 } from "./source-identity";

export interface RunCommandEvidenceOptions {
  readonly workspaceRoot?: string;
  readonly outputDirectory?: string;
  readonly inventoryWorkspaceRoot?: string;
}

export interface VisualNoUpdatePreflightResult {
  readonly establishment: BaselineEstablishmentRecord;
  readonly establishmentPath: string;
}

function runId(gateId: CommandRunGateId, startedAtUtc: string): string {
  const compactTimestamp = startedAtUtc.replace(/[-:.]/g, "");
  return `${gateId}-${compactTimestamp}-${process.pid}-${randomBytes(4).toString("hex")}`;
}

function text(value: string | Buffer | null | undefined): string {
  if (typeof value === "string") return value;
  return value ? value.toString("utf8") : "";
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function prepareVisualNoUpdatePreflight(
  options: RunCommandEvidenceOptions = {},
): VisualNoUpdatePreflightResult {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const output = options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT;
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const validationOptions = {
    workspaceRoot,
    outputDirectory: output,
    sourceTreeSha256,
    inventoryWorkspaceRoot: resolve(options.inventoryWorkspaceRoot ?? workspaceRoot),
  };
  const requiredGateIds = [...ORDINARY_COMMAND_GATE_IDS, "visual-baseline-update"] as const;
  const commandRecords = findLatestCommandRunRecordFilesFor(validationOptions, requiredGateIds);
  const establishment = createBaselineEstablishmentRecord({
    ...validationOptions,
    visualBaselineUpdateRecordFile: commandRecords["visual-baseline-update"],
    ordinaryCommandRunRecordFiles: Object.fromEntries(
      ORDINARY_COMMAND_GATE_IDS.map((gateId) => [gateId, commandRecords[gateId]]),
    ) as Record<(typeof ORDINARY_COMMAND_GATE_IDS)[number], string>,
  });
  const establishmentPath = [output.replaceAll("\\", "/").replace(/\/$/, ""), "hard-gates", "BASELINE-ESTABLISHMENT.json"].join("/");
  writeJson(resolve(workspaceRoot, establishmentPath), establishment);
  validateBaselineEstablishmentRecord(establishment, validationOptions);
  return { establishment, establishmentPath };
}

function preserveCandidate(
  recordPath: string,
  options: Required<RunCommandEvidenceOptions>,
  sourceTreeSha256: string,
): VisualAriaCandidateRecord {
  const validationOptions = { workspaceRoot: options.workspaceRoot, outputDirectory: options.outputDirectory, sourceTreeSha256 };
  const candidate = createVisualAriaCandidateRecord({
    ...validationOptions,
    visualBaselineUpdateRecordFile: recordPath,
  });
  const path = resolve(options.workspaceRoot, options.outputDirectory, "VISUAL-ARIA-CANDIDATE.json");
  writeJson(path, candidate);
  return validateVisualAriaCandidateRecord(candidate, validationOptions);
}

export function runCommandEvidence(
  gateId: CommandRunGateId,
  options: RunCommandEvidenceOptions = {},
): { readonly record: CommandRunEvidenceRecord; readonly recordPath: string } {
  if (!COMMAND_RUN_GATE_IDS.includes(gateId)) throw new Error(`Command gate is not allowlisted: ${gateId}`);
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const evidenceOptions = {
    workspaceRoot,
    outputDirectory: options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT,
    inventoryWorkspaceRoot: resolve(options.inventoryWorkspaceRoot ?? workspaceRoot),
  };
  const definition = FIXED_COMMAND_DEFINITIONS[gateId];
  const preflight = gateId === "visual-no-update" ? prepareVisualNoUpdatePreflight(evidenceOptions) : null;
  const startedAtUtc = preflight
    ? new Date(Math.max(Date.now(), Date.parse(preflight.establishment.establishedAtUtc) + 1)).toISOString()
    : new Date().toISOString();
  const id = runId(gateId, startedAtUtc);
  const logPath = commandLogPath(id, evidenceOptions);
  const recordPath = commandRecordPath(id, evidenceOptions);
  const logAbsolute = resolve(workspaceRoot, logPath);
  const recordAbsolute = resolve(workspaceRoot, recordPath);
  mkdirSync(dirname(logAbsolute), { recursive: true });

  const sourceTreeSha256Before = computeMachineReviewSourceTreeSha256(workspaceRoot);
  if (preflight && sourceTreeSha256Before !== preflight.establishment.sourceTreeSha256) {
    throw new Error("Source tree changed after baseline establishment and before visual-no-update launch");
  }
  const result = spawnSync(definition.command, [...definition.args], {
    cwd: workspaceRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
  });
  const sourceTreeSha256After = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const finishedAtUtc = new Date().toISOString();
  const stdout = text(result.stdout);
  const stderr = text(result.stderr);
  const spawnError = result.error ? `${result.error.name}: ${result.error.message}\n` : "";
  const exitCode = Number.isInteger(result.status) && (result.status as number) >= 0 ? result.status as number : 1;
  const log = `${JSON.stringify({
    schemaVersion: 1,
    logType: "ACTUAL_COMMAND_OUTPUT",
    runId: id,
    gateId,
    command: definition.command,
    args: definition.args,
    startedAtUtc,
    sourceTreeSha256Before,
    stdout,
    stderr,
    spawnError,
    exitCode,
    signal: result.signal,
    sourceTreeSha256After,
    finishedAtUtc,
  }, null, 2)}\n`;
  writeFileSync(logAbsolute, log, "utf8");

  const sourceUnchanged = sourceTreeSha256Before === sourceTreeSha256After;
  const status = exitCode === 0 && (definition.allowsSourceMutation || sourceUnchanged) ? "PASS" : "FAIL";
  const record: CommandRunEvidenceRecord = {
    schemaVersion: 1,
    recordType: "ACTUAL_COMMAND_RUN",
    runId: id,
    gateId,
    command: definition.command,
    args: definition.args,
    startedAtUtc,
    finishedAtUtc,
    exitCode,
    sourceTreeSha256Before,
    sourceTreeSha256After,
    logSha256: createHash("sha256").update(log, "utf8").digest("hex").toUpperCase(),
    logPath,
    status,
  };
  writeFileSync(recordAbsolute, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  validateCommandRunRecord(record, { ...evidenceOptions, sourceTreeSha256: sourceTreeSha256After });
  if (record.status === "PASS" && gateId === "visual-baseline-update") {
    preserveCandidate(recordPath, evidenceOptions, sourceTreeSha256After);
  }
  if (record.status === "PASS" && gateId === "visual-no-update") {
    validateVisualNoUpdateRunOutput(recordPath, { ...evidenceOptions, sourceTreeSha256: sourceTreeSha256After });
  }

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (spawnError) process.stderr.write(spawnError);
  return { record, recordPath };
}

function main(): void {
  const [gateId, ...extraArguments] = process.argv.slice(2);
  if (extraArguments.length > 0 || !COMMAND_RUN_GATE_IDS.includes(gateId as CommandRunGateId)) {
    throw new Error(`Usage: tsx tools/game-machine-review/run-command-evidence.ts <${COMMAND_RUN_GATE_IDS.join("|")}>`);
  }
  const result = runCommandEvidence(gateId as CommandRunGateId);
  process.stdout.write(`\n${result.record.status}\n${result.recordPath}\n`);
  if (result.record.status !== "PASS") process.exitCode = result.record.exitCode || 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
