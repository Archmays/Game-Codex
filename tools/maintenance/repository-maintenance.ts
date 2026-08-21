import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const TASK_ID = "GAME-CODEX-MATH-WORLD-02-R2";
export const RETURN_ZIP = "handoffs/GAME_CODEX_MATH_WORLD_02_R2_RETURN_TO_CHATGPT.zip";
export const RETURN_SHA = `${RETURN_ZIP}.sha256`;

export type RetentionTier =
  | "T0_CANONICAL"
  | "T1_RETURN_PACKAGE"
  | "T2_HISTORY_ARCHIVE"
  | "T3_TRANSIENT_DELETE"
  | "T4_PROTECTED_HUMAN";

export type MaintenanceAction = "keep" | "archive-delete" | "delete";

export interface InventoryEntry {
  readonly path: string;
  readonly bytes: number;
  readonly extension: string;
  readonly sha256: string;
  readonly gitStatus: "tracked" | "untracked" | "ignored";
  readonly references: readonly string[];
  readonly generated: boolean;
  readonly source: boolean;
  readonly visualBaseline: boolean;
  readonly releaseEvidence: boolean;
  readonly humanProtected: boolean;
  duplicateGroup: string | null;
  readonly tier: RetentionTier;
  readonly action: MaintenanceAction;
  readonly reason: string;
}

export interface InventoryReport {
  readonly schemaVersion: 1;
  readonly taskId: string;
  readonly repositoryRoot: string;
  readonly generatedAt: string;
  readonly totals: Record<RetentionTier, { files: number; bytes: number }>;
  readonly files: InventoryEntry[];
  readonly skippedLinks: readonly string[];
}

export interface PlanEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly tier: "T2_HISTORY_ARCHIVE" | "T3_TRANSIENT_DELETE";
  readonly action: "archive-delete" | "delete";
  readonly reason: string;
}

export interface CleanupPlan {
  readonly schemaVersion: 1;
  readonly taskId: string;
  readonly repositoryRoot: string;
  readonly archiveRoot: string;
  readonly generatedAt: string;
  readonly includeActiveTask: boolean;
  readonly entries: readonly PlanEntry[];
}

export interface ArchiveManifestEntry {
  readonly originalPath: string;
  readonly objectPath: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly reason: string;
}

const ROOT_INSTRUCTION = "Game-Codex-STEP07-5-Static-Report-End-State-Final-Release-Codex-Instruction-20260812.md";
const FROZEN_V2_PREFIX = "artifacts/hanzi-radical-battle-v2/v2-chapter-one/HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_V2_COMPLETE_RETURN_TO_CHATGPT.zip";
const V3_FINAL_REPORT_PREFIX = "artifacts/hanzi-magic-battle/v3-complete/report/";
const ACTIVE_TASK_PREFIX = `tmp/tasks/${TASK_ID}/`;

function slash(value: string): string {
  return value.split(sep).join("/");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp-write`;
  writeFileSync(temporary, stableJson(value), "utf8");
  renameSync(temporary, path);
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runGit(repoRoot: string, args: readonly string[]): Buffer {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: null, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr?.toString("utf8") ?? "unknown error"}`);
  }
  return result.stdout ?? Buffer.alloc(0);
}

function nulPaths(buffer: Buffer): string[] {
  return buffer.toString("utf8").split("\0").filter(Boolean).map(slash);
}

function getGitSets(repoRoot: string, relativeFiles: readonly string[]): { tracked: Set<string>; ignored: Set<string> } {
  const tracked = new Set(nulPaths(runGit(repoRoot, ["ls-files", "-z"])).map((path) => path.toLowerCase()));
  const nonTracked = relativeFiles.filter((path) => !tracked.has(path.toLowerCase()));
  if (nonTracked.length === 0) return { tracked, ignored: new Set() };
  const input = Buffer.from(`${nonTracked.join("\0")}\0`, "utf8");
  const result = spawnSync("git", ["check-ignore", "--stdin", "-z"], {
    cwd: repoRoot,
    input,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore failed: ${result.stderr?.toString("utf8") ?? "unknown error"}`);
  }
  return { tracked, ignored: new Set(nulPaths(result.stdout ?? Buffer.alloc(0)).map((path) => path.toLowerCase())) };
}

function walkFiles(repoRoot: string): { files: string[]; skippedLinks: string[] } {
  const files: string[] = [];
  const skippedLinks: string[] = [];
  const excludedRoots = new Set([".git", "node_modules"]);
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (directory === repoRoot && excludedRoots.has(entry.name)) continue;
      const absolute = resolve(directory, entry.name);
      const repositoryPath = slash(relative(repoRoot, absolute));
      const metadata = lstatSync(absolute);
      if (metadata.isSymbolicLink()) {
        skippedLinks.push(repositoryPath);
        continue;
      }
      if (metadata.isDirectory()) visit(absolute);
      else if (metadata.isFile()) files.push(repositoryPath);
    }
  };
  visit(repoRoot);
  return { files: files.sort(), skippedLinks: skippedLinks.sort() };
}

function isTransient(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /^(dist|tmp|\.vite|coverage|\.cache|test-results|playwright-report)\//.test(lower)
    || lower.endsWith(".log")
    || lower.endsWith(".tmp")
    || lower.includes("/raw-trace")
    || lower.includes("/raw-traces/")
  );
}

function isArchiveCandidate(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.startsWith("source/national-standard/original-files/") && basename(lower) !== "readme.md") return true;
  if (lower.startsWith("source/my-little-pony/") && basename(lower) !== "readme.md") return true;
  if (lower.startsWith("docs/references/curriculum/") && lower.endsWith(".pdf")) return true;
  if (/^docs\/screenshots\/equation-slider\/rebuild-v3\/(before|after)\//.test(lower)) return true;
  if (lower.startsWith("artifacts/maintenance/hanzi-v2/")) return true;
  if (/^handoffs\/game_codex_portfolio_foundation_01_return_to_chatgpt.*\.zip(?:\.sha256)?$/.test(lower)) return true;
  if (/^handoffs\/game_codex_math_world_02_return_to_chatgpt.*\.zip(?:\.sha256)?$/.test(lower)) return true;
  return false;
}

export function isProtectedRepositoryPath(path: string): boolean {
  const normalized = slash(path).replace(/^\.\//, "");
  const lower = normalized.toLowerCase();
  return (
    normalized === ROOT_INSTRUCTION
    || lower === RETURN_ZIP.toLowerCase()
    || lower === RETURN_SHA.toLowerCase()
    || lower === FROZEN_V2_PREFIX.toLowerCase()
    || lower === `${FROZEN_V2_PREFIX}.sha256`.toLowerCase()
    || lower.startsWith(V3_FINAL_REPORT_PREFIX.toLowerCase())
  );
}

function classify(path: string): Pick<InventoryEntry, "tier" | "action" | "reason" | "humanProtected"> {
  const normalized = slash(path).replace(/^\.\//, "");
  const lower = normalized.toLowerCase();
  if (normalized === ROOT_INSTRUCTION) {
    return { tier: "T4_PROTECTED_HUMAN", action: "keep", reason: "Local user authorization/instruction; never auto-delete or publish.", humanProtected: true };
  }
  if (lower === RETURN_ZIP.toLowerCase() || lower === RETURN_SHA.toLowerCase()) {
    return { tier: "T1_RETURN_PACKAGE", action: "keep", reason: "Only current task return package and checksum.", humanProtected: false };
  }
  if (lower === FROZEN_V2_PREFIX.toLowerCase() || lower === `${FROZEN_V2_PREFIX}.sha256`.toLowerCase()) {
    return { tier: "T0_CANONICAL", action: "keep", reason: "Frozen release bytes are consumed by the V3 release identity builder.", humanProtected: false };
  }
  if (lower.startsWith(V3_FINAL_REPORT_PREFIX.toLowerCase())) {
    return { tier: "T0_CANONICAL", action: "keep", reason: "Source-bound V3 final verdict and release evidence retained as the canonical local report.", humanProtected: false };
  }
  if (isArchiveCandidate(normalized)) {
    return { tier: "T2_HISTORY_ARCHIVE", action: "archive-delete", reason: archiveReason(normalized), humanProtected: false };
  }
  if (isTransient(normalized)) {
    return { tier: "T3_TRANSIENT_DELETE", action: "delete", reason: "Reproducible task/build/test transient; not canonical project state.", humanProtected: false };
  }
  return { tier: "T0_CANONICAL", action: "keep", reason: "Current source, runtime asset, test baseline, documentation, or release identity.", humanProtected: false };
}

function archiveReason(path: string): string {
  if (path.startsWith("source/national-standard/original-files/")) return "Raw national-standard original; processed source ledger remains in Git.";
  if (path.startsWith("source/my-little-pony/")) return "Non-runtime reference imagery; archived with identity before current-tree removal.";
  if (path.startsWith("docs/references/curriculum/")) return "Raw curriculum reference; documentation pointer and archive manifest preserve identity.";
  if (path.startsWith("docs/screenshots/equation-slider/")) return "Superseded before/after process screenshot; active visual baselines remain under tests.";
  if (path.startsWith("artifacts/maintenance/hanzi-v2/")) return "Superseded maintenance handoff/evidence.";
  return "Superseded return package; only the current task handoff remains local.";
}

function inferReferences(path: string): string[] {
  const refs: string[] = [];
  if (path.startsWith("public/")) refs.push("Pages runtime/public asset root");
  if (/^(apps|games|packages|src)\//.test(path)) refs.push("source/import graph");
  if (path.startsWith("tests/")) refs.push("test suite or baseline");
  if (path.startsWith("docs/")) refs.push("project documentation");
  if (path.startsWith("artifacts/")) refs.push("release/evidence policy");
  if (path.startsWith("source/national-standard/original-files/")) refs.push("processed-source ledger mapping");
  if (path.startsWith("handoffs/")) refs.push("handoff retention policy");
  if (path.startsWith(ACTIVE_TASK_PREFIX)) refs.push("active task workspace");
  return refs;
}

function emptyTotals(): Record<RetentionTier, { files: number; bytes: number }> {
  return {
    T0_CANONICAL: { files: 0, bytes: 0 },
    T1_RETURN_PACKAGE: { files: 0, bytes: 0 },
    T2_HISTORY_ARCHIVE: { files: 0, bytes: 0 },
    T3_TRANSIENT_DELETE: { files: 0, bytes: 0 },
    T4_PROTECTED_HUMAN: { files: 0, bytes: 0 },
  };
}

export function createInventory(repoRoot: string, generatedAt = new Date().toISOString()): InventoryReport {
  const repositoryRoot = realpathSync(repoRoot);
  const walked = walkFiles(repositoryRoot);
  const git = getGitSets(repositoryRoot, walked.files);
  const files: InventoryEntry[] = walked.files.map((path) => {
    const absolute = resolve(repositoryRoot, path);
    const bytes = statSync(absolute).size;
    const identity = sha256File(absolute);
    const retention = classify(path);
    const lower = path.toLowerCase();
    return {
      path,
      bytes,
      extension: extname(path).toLowerCase() || "[none]",
      sha256: identity,
      gitStatus: git.tracked.has(lower) ? "tracked" : git.ignored.has(lower) ? "ignored" : "untracked",
      references: inferReferences(path),
      generated: /^(dist|tmp|test-results|playwright-report|coverage|\.cache|\.vite)\//.test(lower) || lower.includes("/generated/"),
      source: lower.startsWith("source/") || /^(apps|games|packages|src|tools)\//.test(lower),
      visualBaseline: lower.includes("/baselines/") || lower.includes("-snapshots/") || lower.includes("/__snapshots__/") || lower.endsWith(".snap"),
      releaseEvidence: lower.startsWith("artifacts/") || lower.startsWith("handoffs/") || lower.includes("release"),
      humanProtected: retention.humanProtected,
      duplicateGroup: null,
      tier: retention.tier,
      action: retention.action,
      reason: retention.reason,
    };
  });
  const hashes = new Map<string, InventoryEntry[]>();
  for (const file of files) {
    const group = hashes.get(file.sha256) ?? [];
    group.push(file);
    hashes.set(file.sha256, group);
  }
  for (const [hash, group] of hashes) {
    if (group.length > 1) for (const file of group) file.duplicateGroup = hash;
  }
  const totals = emptyTotals();
  for (const file of files) {
    totals[file.tier].files += 1;
    totals[file.tier].bytes += file.bytes;
  }
  return { schemaVersion: 1, taskId: TASK_ID, repositoryRoot, generatedAt, totals, files, skippedLinks: walked.skippedLinks };
}

export function createPlan(
  inventory: InventoryReport,
  archiveRoot: string,
  includeActiveTask = false,
  generatedAt = new Date().toISOString(),
): CleanupPlan {
  const entries = inventory.files
    .filter((file) => file.action !== "keep")
    .filter((file) => includeActiveTask || !file.path.startsWith(ACTIVE_TASK_PREFIX))
    .map((file): PlanEntry => ({
      path: file.path,
      bytes: file.bytes,
      sha256: file.sha256,
      tier: file.tier as PlanEntry["tier"],
      action: file.action as PlanEntry["action"],
      reason: file.reason,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: 1,
    taskId: TASK_ID,
    repositoryRoot: inventory.repositoryRoot,
    archiveRoot: resolve(archiveRoot),
    generatedAt,
    includeActiveTask,
    entries,
  };
}

function pathWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(resolve(parent), resolve(child));
  return pathFromParent !== "" && pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent);
}

function looksUnresolved(value: string): boolean {
  return /\$\{|\$env:|%[^%]+%/.test(value);
}

export function assertDeletionAllowed(repoRoot: string, repositoryPath: string): string {
  if (!repositoryPath || isAbsolute(repositoryPath) || looksUnresolved(repositoryPath)) {
    throw new Error(`Unsafe unresolved or absolute plan path: ${repositoryPath}`);
  }
  const normalized = slash(repositoryPath);
  if (normalized.includes("*") || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe wildcard or traversal plan path: ${repositoryPath}`);
  }
  if (isProtectedRepositoryPath(normalized)) throw new Error(`Protected path cannot be deleted: ${repositoryPath}`);
  const root = realpathSync(repoRoot);
  const target = resolve(root, repositoryPath);
  if (!pathWithin(root, target) || target === root) throw new Error(`Deletion target escapes repository: ${repositoryPath}`);
  const home = resolve(homedir());
  if (target === home || target === resolve(target, sep) || target.toLowerCase().startsWith(`${resolve(root, ".git").toLowerCase()}${sep}`)) {
    throw new Error(`Refusing protected root/.git/home deletion: ${repositoryPath}`);
  }
  let cursor = root;
  for (const segment of relative(root, target).split(sep)) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink/junction traversal refused: ${repositoryPath}`);
  }
  if (existsSync(target)) {
    const realTarget = realpathSync(target);
    if (!pathWithin(root, realTarget)) throw new Error(`Resolved deletion target escapes repository: ${repositoryPath}`);
    if (!lstatSync(target).isFile()) throw new Error(`Plan entries must name explicit files: ${repositoryPath}`);
  }
  return target;
}

function assertArchiveRootAllowed(repoRoot: string, archiveRoot: string): string {
  if (looksUnresolved(archiveRoot)) throw new Error(`Unresolved archive root: ${archiveRoot}`);
  const resolved = resolve(archiveRoot);
  const volumeRoot = resolve(resolved, sep);
  if (resolved === volumeRoot || resolved === resolve(homedir()) || resolved === resolve(repoRoot) || pathWithin(resolved, resolve(repoRoot))) {
    throw new Error(`Unsafe archive root: ${archiveRoot}`);
  }
  return resolved;
}

function pruneEmptyParents(repoRoot: string, filePath: string): void {
  let current = dirname(filePath);
  const root = resolve(repoRoot);
  while (current !== root && pathWithin(root, current)) {
    try {
      rmdirSync(current);
    } catch {
      break;
    }
    current = dirname(current);
  }
}

export function pruneEmptyTaskWorkspace(repoRoot: string): boolean {
  const root = realpathSync(repoRoot);
  const taskRoot = resolve(root, ACTIVE_TASK_PREFIX);
  if (!pathWithin(root, taskRoot)) throw new Error("Active task workspace escapes repository root.");
  if (!existsSync(taskRoot)) return true;

  const prune = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink/junction in active task workspace refused: ${slash(relative(root, child))}`);
      if (entry.isDirectory()) prune(child);
    }
    if (readdirSync(directory).length === 0) rmdirSync(directory);
  };

  prune(taskRoot);
  return !existsSync(taskRoot);
}

export function applyPlan(plan: CleanupPlan, appliedAt = new Date().toISOString()): {
  archiveManifestPath: string;
  deletionLedgerPath: string;
  archivedFiles: number;
  deletedFiles: number;
  alreadyAbsent: number;
} {
  if (plan.schemaVersion !== 1 || plan.taskId !== TASK_ID) throw new Error("Unsupported or foreign cleanup plan.");
  const repoRoot = realpathSync(plan.repositoryRoot);
  const archiveRoot = assertArchiveRootAllowed(repoRoot, plan.archiveRoot);
  const archiveObjects = resolve(archiveRoot, "objects", "sha256");
  const archiveReports = resolve(archiveRoot, "reports");
  mkdirSync(archiveObjects, { recursive: true });
  mkdirSync(archiveReports, { recursive: true });

  const validated = plan.entries.map((entry) => ({ entry, absolute: assertDeletionAllowed(repoRoot, entry.path) }));
  for (const { entry, absolute } of validated) {
    if (!existsSync(absolute)) continue;
    const actual = sha256File(absolute);
    if (actual !== entry.sha256) throw new Error(`SHA-256 mismatch for ${entry.path}: expected ${entry.sha256}, got ${actual}`);
    if (statSync(absolute).size !== entry.bytes) throw new Error(`Byte-size mismatch for ${entry.path}`);
  }

  const archiveManifestPath = resolve(archiveReports, "archive-manifest.json");
  const priorArchiveEntries = existsSync(archiveManifestPath)
    ? (JSON.parse(readFileSync(archiveManifestPath, "utf8")) as { entries?: ArchiveManifestEntry[] }).entries ?? []
    : [];
  const archiveEntries: ArchiveManifestEntry[] = [...priorArchiveEntries];
  for (const { entry, absolute } of validated) {
    if (entry.action !== "archive-delete") continue;
    const objectPath = resolve(archiveObjects, entry.sha256);
    if (existsSync(absolute) && !existsSync(objectPath)) copyFileSync(absolute, objectPath);
    if (!existsSync(objectPath) || sha256File(objectPath) !== entry.sha256) {
      throw new Error(`Archive verification failed for ${entry.path}`);
    }
    const archived: ArchiveManifestEntry = {
      originalPath: entry.path,
      objectPath: slash(relative(archiveRoot, objectPath)),
      bytes: entry.bytes,
      sha256: entry.sha256,
      reason: entry.reason,
    };
    const priorIndex = archiveEntries.findIndex((candidate) => candidate.originalPath === archived.originalPath);
    if (priorIndex >= 0) archiveEntries[priorIndex] = archived;
    else archiveEntries.push(archived);
  }
  archiveEntries.sort((left, right) => left.originalPath.localeCompare(right.originalPath));
  writeJsonAtomic(archiveManifestPath, {
    schemaVersion: 1,
    taskId: TASK_ID,
    generatedAt: appliedAt,
    repositoryRoot: repoRoot,
    archiveRoot,
    contentAddressed: true,
    entries: archiveEntries,
  });

  const deletionEntries: Array<PlanEntry & { status: "deleted" | "already-absent"; deletedAt: string }> = [];
  let deletedFiles = 0;
  let alreadyAbsent = 0;
  for (const { entry, absolute } of validated) {
    if (existsSync(absolute)) {
      unlinkSync(absolute);
      pruneEmptyParents(repoRoot, absolute);
      deletedFiles += 1;
      deletionEntries.push({ ...entry, status: "deleted", deletedAt: appliedAt });
    } else {
      alreadyAbsent += 1;
      deletionEntries.push({ ...entry, status: "already-absent", deletedAt: appliedAt });
    }
  }
  const deletionLedgerPath = resolve(archiveReports, plan.includeActiveTask ? "final-deletion-ledger.json" : "deletion-ledger.json");
  writeJsonAtomic(deletionLedgerPath, {
    schemaVersion: 1,
    taskId: TASK_ID,
    generatedAt: appliedAt,
    planGeneratedAt: plan.generatedAt,
    entries: deletionEntries,
  });
  const archivedFiles = validated.filter(({ entry }) => entry.action === "archive-delete").length;
  return { archiveManifestPath, deletionLedgerPath, archivedFiles, deletedFiles, alreadyAbsent };
}

export function verifyMaintenance(repoRoot: string, archiveRoot: string, generatedAt = new Date().toISOString()): {
  ok: boolean;
  generatedAt: string;
  remainingCleanupCandidates: string[];
  archiveObjectsVerified: number;
  package: { path: string; bytes: number; sha256: string } | null;
} {
  const inventory = createInventory(repoRoot, generatedAt);
  const remainingCleanupCandidates = inventory.files
    .filter((entry) => entry.action !== "keep" && !entry.path.startsWith(ACTIVE_TASK_PREFIX))
    .map((entry) => entry.path);
  const manifestPath = resolve(archiveRoot, "reports", "archive-manifest.json");
  let archiveObjectsVerified = 0;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { entries: ArchiveManifestEntry[] };
    for (const entry of manifest.entries) {
      const object = resolve(archiveRoot, entry.objectPath);
      if (!pathWithin(archiveRoot, object) || !existsSync(object) || sha256File(object) !== entry.sha256) {
        throw new Error(`Archive object verification failed: ${entry.originalPath}`);
      }
      archiveObjectsVerified += 1;
    }
  }
  const packagePath = resolve(repoRoot, RETURN_ZIP);
  const packageState = existsSync(packagePath)
    ? { path: RETURN_ZIP, bytes: statSync(packagePath).size, sha256: sha256File(packagePath) }
    : null;
  return { ok: remainingCleanupCandidates.length === 0, generatedAt, remainingCleanupCandidates, archiveObjectsVerified, package: packageState };
}

interface Options {
  command: string;
  repoRoot: string;
  archiveRoot: string;
  output?: string;
  plan?: string;
  includeActiveTask: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const command = argv[0] ?? "inventory";
  const value = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const repoRoot = resolve(value("--repo") ?? process.cwd());
  const archiveRoot = resolve(value("--archive-root") ?? resolve(repoRoot, "..", "_archives", "Game-Codex", TASK_ID));
  return {
    command,
    repoRoot,
    archiveRoot,
    output: value("--output"),
    plan: value("--plan"),
    includeActiveTask: argv.includes("--include-active-task"),
  };
}

function defaultReport(repoRoot: string, name: string): string {
  return resolve(repoRoot, "tmp", "tasks", TASK_ID, "reports", name);
}

export function verificationReportPath(repoRoot: string, archiveRoot: string, explicitOutput?: string): string {
  if (explicitOutput) return resolve(explicitOutput);
  const activeTaskRoot = resolve(repoRoot, "tmp", "tasks", TASK_ID);
  return existsSync(activeTaskRoot)
    ? resolve(activeTaskRoot, "reports", "cleanup-verify.json")
    : resolve(archiveRoot, "reports", "post-close-maintenance-verify.json");
}

function executeCli(argv: readonly string[]): void {
  const options = parseArgs(argv);
  if (options.command === "inventory") {
    const report = createInventory(options.repoRoot);
    const output = resolve(options.output ?? defaultReport(options.repoRoot, "repository-inventory.json"));
    writeJsonAtomic(output, report);
    console.log(`Inventory: ${report.files.length} files; ${report.skippedLinks.length} links skipped; ${output}`);
    return;
  }
  if (options.command === "plan") {
    const inventory = createInventory(options.repoRoot);
    const plan = createPlan(inventory, options.archiveRoot, options.includeActiveTask);
    const output = resolve(options.output ?? defaultReport(options.repoRoot, options.includeActiveTask ? "final-cleanup-plan.json" : "cleanup-plan.json"));
    writeJsonAtomic(output, plan);
    console.log(`Plan: ${plan.entries.length} explicit files; ${output}`);
    return;
  }
  if (options.command === "apply") {
    if (!options.plan) throw new Error("apply requires --plan <explicit-plan.json>");
    const plan = JSON.parse(readFileSync(resolve(options.plan), "utf8")) as CleanupPlan;
    const result = applyPlan(plan);
    console.log(`Apply: ${result.deletedFiles} deleted; ${result.archivedFiles} archived; ${result.alreadyAbsent} already absent.`);
    console.log(`Archive manifest: ${result.archiveManifestPath}`);
    console.log(`Deletion ledger: ${result.deletionLedgerPath}`);
    return;
  }
  if (options.command === "cleanup") {
    const inventory = createInventory(options.repoRoot);
    const plan = createPlan(inventory, options.archiveRoot, false);
    const planPath = defaultReport(options.repoRoot, "cleanup-plan.json");
    writeJsonAtomic(planPath, plan);
    const result = applyPlan(plan);
    console.log(`Cleanup: planned ${plan.entries.length}; deleted ${result.deletedFiles}; archived ${result.archivedFiles}.`);
    return;
  }
  if (options.command === "verify") {
    const report = verifyMaintenance(options.repoRoot, options.archiveRoot);
    const output = verificationReportPath(options.repoRoot, options.archiveRoot, options.output);
    writeJsonAtomic(output, report);
    console.log(`Verify: ${report.ok ? "PASS" : "FAIL"}; remaining ${report.remainingCleanupCandidates.length}; archive objects ${report.archiveObjectsVerified}.`);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (options.command === "close-task") {
    const before = existsSync(resolve(options.repoRoot, RETURN_ZIP)) ? verifyMaintenance(options.repoRoot, options.archiveRoot).package : null;
    const inventory = createInventory(options.repoRoot);
    const plan = createPlan(inventory, options.archiveRoot, true);
    const planPath = resolve(options.archiveRoot, "reports", "final-cleanup-plan.json");
    writeJsonAtomic(planPath, plan);
    const result = applyPlan(plan);
    if (!pruneEmptyTaskWorkspace(options.repoRoot)) {
      throw new Error("Active task workspace still contains unplanned files after close-task.");
    }
    const after = existsSync(resolve(options.repoRoot, RETURN_ZIP)) ? verifyMaintenance(options.repoRoot, options.archiveRoot).package : null;
    if (before && (!after || before.bytes !== after.bytes || before.sha256 !== after.sha256)) {
      throw new Error("Return package bytes/hash changed during close-task.");
    }
    const finalReport = { ok: true, generatedAt: new Date().toISOString(), packageBefore: before, packageAfter: after, ...result };
    writeJsonAtomic(resolve(options.archiveRoot, "reports", "final-cleanup-verify.json"), finalReport);
    console.log(`Close task: ${result.deletedFiles} files deleted; return package ${after ? "preserved" : "not yet present"}.`);
    return;
  }
  throw new Error(`Unknown command '${options.command}'. Expected inventory, plan, apply, cleanup, verify, or close-task.`);
}

const invokedAsScript = process.argv[1]?.replace(/\\/g, "/").endsWith("/repository-maintenance.ts") ?? false;
if (invokedAsScript) {
  try {
    executeCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
