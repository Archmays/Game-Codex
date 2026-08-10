import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const CLEANUP_PLAN_RELATIVE_PATH = "artifacts/game-machine-review/step-07/CLEANUP-PLAN.json";
export const CLEANUP_RESULT_RELATIVE_PATH = "artifacts/game-machine-review/step-07/CLEANUP-RESULT.json";
export const PROJECT_HYGIENE_RELATIVE_PATH = "artifacts/game-machine-review/step-07/PROJECT_HYGIENE_VERDICT.json";
export const READINESS_ZIP_RELATIVE_PATH =
  "artifacts/game-machine-review/step-07/STEP-07_MACHINE_QA_REAL_SECOND_USE_READINESS_RETURN_TO_CHATGPT.zip";

export type CleanupTier =
  | "T0_CANONICAL"
  | "T1_RETURN_PACKAGE"
  | "T2_HISTORY_ARCHIVE"
  | "T3_TRANSIENT_DELETE"
  | "T4_PROTECTED_HUMAN";

export interface CleanupPathSpec {
  path: string;
  reason: string;
  required: boolean;
}

export interface CleanupPolicy {
  policyId: string;
  canonical: CleanupPathSpec[];
  returnPackage: CleanupPathSpec[];
  history: CleanupPathSpec[];
  transient: CleanupPathSpec[];
  protectedHuman: CleanupPathSpec[];
  assets: {
    common: CleanupPathSpec[];
    selected: CleanupPathSpec[];
    verdictPath?: string;
  };
  rawAssetCandidatesRoot?: string;
  selectedAssetsRoot?: string;
  readinessZipPath: string;
}

export interface CleanupInventoryEntry {
  path: string;
  kind: "file" | "directory" | "missing";
  exists: boolean;
  bytes: number;
  sha256: string | null;
  required: boolean;
  reason: string;
}

export interface CleanupDeletionTarget extends CleanupInventoryEntry {
  kind: "file" | "directory";
  exists: true;
  sha256: string;
  tier: "T3_TRANSIENT_DELETE";
  authority: "EXACT_POLICY_PATH" | "EXACT_UNSELECTED_ASSET_FILE";
}

export interface CleanupPlan {
  schemaVersion: 1;
  step: "07";
  policyId: string;
  generatedAtUtc: string;
  status: "READY_FOR_APPLY" | "BLOCKED";
  tiers: Record<CleanupTier, { entries: CleanupInventoryEntry[] }>;
  selectedAssetMode: "MACHINE_SELECTED" | "PROMPT_BATCH_READY" | "UNRESOLVED" | "FIXED_POLICY";
  readinessZip: CleanupInventoryEntry;
  deletionAllowlist: CleanupDeletionTarget[];
  blockers: string[];
  guardrails: {
    exactPathsOnly: true;
    recursiveGlobAuthority: false;
    readinessZipRequiredBeforeApply: true;
    protectedHumanEvidenceDeletionForbidden: true;
    hashesRecheckedBeforeDelete: true;
  };
}

export interface CleanupResult {
  schemaVersion: 1;
  step: "07";
  policyId: string;
  appliedAtUtc: string;
  status: "PASS";
  cleanupState: "TRANSIENT_EVIDENCE_CLEANED";
  protectedEvidenceState: "PROTECTED_EVIDENCE_PRESERVED";
  readinessZip: {
    path: string;
    sha256Before: string;
    sha256After: string;
    unchanged: true;
  };
  deletedEvidenceManifest: Array<{
    path: string;
    kind: "file" | "directory";
    originalSha256: string;
    bytes: number;
    reasonDeleted: string;
  }>;
  deletedTargetCount: number;
}

export interface ProjectHygieneVerdict {
  schemaVersion: 1;
  step: "07";
  policyId: string;
  verifiedAtUtc: string;
  status: "PASS" | "FAIL";
  projectHygieneVerdict: "PROJECT_CLEAN" | "PROJECT_HYGIENE_FAILED";
  checks: {
    canonicalInventory: "PASS" | "FAIL";
    protectedInventory: "PASS" | "FAIL";
    readinessZip: "PASS" | "FAIL";
    selectedAssetInventory: "PASS" | "FAIL";
    noDuplicateLargeTransientDirectory: "PASS" | "FAIL";
    gitStatusRelativeToPushedCommit: "PASS" | "FAIL";
    originUnchanged: "PASS" | "FAIL";
  };
  git: {
    branch: string | null;
    head: string | null;
    originMain: string | null;
    trackedClean: boolean;
    stagedClean: boolean;
    untrackedSourceFiles: string[];
  };
  readinessZipSha256: string | null;
  errors: string[];
}

export interface CleanupOptions {
  workspaceRoot?: string;
  policy?: CleanupPolicy;
  now?: Date;
}

const MACHINE_GENERATED_PREFIXES = [
  ".git/",
  ".playwright-cli/",
  "artifacts/",
  "dist/",
  "node_modules/",
  "output/",
  "playwright-report/",
  "test-results/",
  "tmp/",
] as const;

const defaultPolicy: CleanupPolicy = {
  policyId: "STEP07_FINAL_CLOSURE_RETENTION_V1",
  canonical: [
    required("artifacts/game-machine-review/step-07/MACHINE-REVIEW-VERDICT.json", "final machine verdict"),
    required("artifacts/game-machine-review/step-07/MACHINE-REVIEW-REPORT.json", "final machine report"),
    required("artifacts/game-machine-review/step-07/MACHINE-REVIEW-SUMMARY.md", "final machine summary"),
    required("artifacts/game-machine-review/step-07/MACHINE-REVIEW-REPORT.html", "final static report"),
    required("artifacts/game-machine-review/step-07/FINAL-SOURCE-FREEZE.json", "final source freeze"),
    required("artifacts/game-machine-review/step-07/STATIC-REPORT-PROOF.json", "static report identity proof"),
    required("artifacts/game-machine-review/step-07/baselines", "accepted visual and ARIA baselines"),
    required(
      "artifacts/game-machine-review/step-07/final-closure/STEP07-FINAL-CLOSURE-CHARTER.json",
      "frozen final-closure finding disposition",
    ),
  ],
  returnPackage: [
    optional(READINESS_ZIP_RELATIVE_PATH, "unique final return ZIP; mandatory at apply time"),
    optional(`${READINESS_ZIP_RELATIVE_PATH}.sha256`, "readiness ZIP immutable hash sidecar"),
  ],
  history: [
    required(
      "artifacts/game-machine-review/step-07/repair-rounds/THREE-REPAIR-LOOPS-FAILED.json",
      "ordinary repair-loop lineage",
    ),
    required(
      "artifacts/game-machine-review/step-07/recovery-preflight/CLOSED-RECOVERY-FREEZE.json",
      "closed-recovery source freeze lineage",
    ),
    required(
      "artifacts/game-machine-review/step-07/recovery-preflight/CLOSED-RECOVERY-STOPPED.json",
      "closed-recovery stop lineage",
    ),
    required(
      "artifacts/hanzi-radical-battle-v2/step-06/STEP-06_SECOND_USE_OBSERVATION.json",
      "synthetic STEP 06 tooling lineage; not real-child evidence",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/history/exceptional-repair-index.json",
      "compact exceptional-repair archive index",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/history/deleted-evidence-manifest.json",
      "compact deleted-evidence identity index",
    ),
  ],
  transient: [
    optional("dist", "reproducible build output"),
    optional("output", "reproducible generated output"),
    optional("test-results", "Playwright transient results"),
    optional("playwright-report", "Playwright transient HTML report"),
    optional(".playwright-cli", "temporary browser tooling state"),
    optional("tmp/game-machine-review/step-07-readiness", "owned readiness staging directory"),
    optional("artifacts/game-machine-review/step-07/traces", "raw final-run traces replaced by summaries"),
    optional(
      "artifacts/game-machine-review/step-07/screenshots",
      "raw browser screenshots replaced by canonical baselines and compact proofs",
    ),
    optional(
      "artifacts/game-machine-review/step-07/agent-playthrough/screenshots",
      "raw agent-playthrough screenshots replaced by the canonical result",
    ),
    optional(
      "artifacts/game-machine-review/step-07/agent-playthrough/traces",
      "raw agent-playthrough traces replaced by the canonical result",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/build-dist",
      "superseded recovery build output",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/collection",
      "superseded recovery raw collection",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/command-evidence",
      "duplicate recovery command records",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/deterministic",
      "superseded recovery deterministic candidates",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/validation",
      "superseded recovery raw validation",
    ),
    optional(
      "artifacts/game-machine-review/step-07/recovery-preflight/PRE_RECOVERY_DIFF.patch",
      "preflight patch archived by hash",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/PRE-CLOSURE-DIFF.patch",
      "pre-closure patch archived by hash",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/PRE-CLOSURE-GIT-STATUS.txt",
      "pre-closure transient status",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/PRE-CLOSURE-CHANGED-FILES.txt",
      "pre-closure transient file inventory",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/PRE-CLOSURE-SOURCE-IDENTITY.json",
      "pre-closure transient source identity",
    ),
    optional(
      "artifacts/game-machine-review/step-07/final-closure/capture-preclosure.ts",
      "one-use pre-closure capture helper",
    ),
  ],
  protectedHuman: [
    required(
      "artifacts/hanzi-radical-battle-v2/step-02/review/STEP-02_PARENT_REVIEW_FEEDBACK.json",
      "parent feedback",
    ),
    required(
      "artifacts/hanzi-radical-battle-v2/step-03/review/STEP-03_PARENT_REVIEW_FEEDBACK.json",
      "parent feedback",
    ),
    required("artifacts/hanzi-radical-battle-v2/step-04", "real first-use evidence and authorization"),
    required(
      "artifacts/hanzi-radical-battle-v2/step-05/review/STEP-05_PARENT_REVIEW_FEEDBACK.json",
      "parent feedback",
    ),
    required(
      "artifacts/hanzi-radical-battle-v2/step-06/STEP-06-PARENT-AUTHORIZATION-IDENTITY.json",
      "parent authorization identity",
    ),
    optional(
      "artifacts/hanzi-radical-battle-v2/step-06/observation-inbox",
      "protected observation inbox",
    ),
    optional("artifacts/hanzi-radical-battle-v2/step-07", "future real second-use evidence root"),
    required(
      "artifacts/game-machine-review/step-07/final-closure/STEP07-FINAL-CLOSURE-CHARTER.json",
      "human final-closure authorization record",
    ),
    required(
      "artifacts/game-machine-review/step-07/final-closure/STEP07-FINAL-CLOSURE-CHARTER.sha256.json",
      "immutable authorization hash",
    ),
  ],
  assets: {
    common: [
      required(
        "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/ASSET-BATCH-MANIFEST.json",
        "Theme C batch manifest",
      ),
      required(
        "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/prompt-pack.md",
        "Theme C prompt pack",
      ),
      required(
        "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/MACHINE-ASSET-VERDICT.json",
        "machine asset verdict",
      ),
    ],
    selected: [
      required(
        "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/SELECTED",
        "machine-selected candidates",
      ),
      required(
        "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/contact-sheet.webp",
        "selected asset contact sheet",
      ),
    ],
    verdictPath:
      "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/MACHINE-ASSET-VERDICT.json",
  },
  rawAssetCandidatesRoot:
    "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/raw-candidates",
  selectedAssetsRoot:
    "artifacts/hanzi-radical-battle-v2/asset-foundry/theme-c/batch-01/SELECTED",
  readinessZipPath: READINESS_ZIP_RELATIVE_PATH,
};

function required(path: string, reason: string): CleanupPathSpec {
  return { path, reason, required: true };
}

function optional(path: string, reason: string): CleanupPathSpec {
  return { path, reason, required: false };
}

function normalizeRelativePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    isAbsolute(normalized) ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.includes("\0")
  ) {
    throw new Error(`Cleanup paths must be nonempty workspace-relative paths: ${path}`);
  }
  return normalized;
}

function resolveContained(workspaceRoot: string, workspaceRelativePath: string): string {
  const root = resolve(workspaceRoot);
  const normalized = normalizeRelativePath(workspaceRelativePath);
  const target = resolve(root, normalized);
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Cleanup path escapes the workspace or resolves to its root: ${workspaceRelativePath}`);
  }
  return target;
}

function assertNoReparsePoints(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Cleanup inventory cannot traverse a symbolic link or junction: ${path}`);
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    assertNoReparsePoints(resolve(path, entry.name));
  }
}

function listDirectoryFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const fullPath = resolve(directory, entry.name);
      const stat = lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Cleanup inventory cannot traverse a symbolic link or junction: ${fullPath}`);
      }
      if (stat.isDirectory()) visit(fullPath);
      else if (stat.isFile()) files.push(fullPath);
      else throw new Error(`Cleanup inventory supports only regular files and directories: ${fullPath}`);
    }
  };
  visit(root);
  return files;
}

function hashPath(path: string): { kind: "file" | "directory"; bytes: number; sha256: string } {
  assertNoReparsePoints(path);
  const stat = statSync(path);
  if (stat.isFile()) {
    return {
      kind: "file",
      bytes: stat.size,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase(),
    };
  }
  if (!stat.isDirectory()) throw new Error(`Cleanup inventory supports only regular files and directories: ${path}`);
  const hash = createHash("sha256");
  let bytes = 0;
  hash.update("DIRECTORY\0", "utf8");
  for (const file of listDirectoryFiles(path)) {
    const fileRelativePath = relative(path, file).replaceAll("\\", "/");
    const contents = readFileSync(file);
    bytes += contents.byteLength;
    hash.update(fileRelativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(contents);
    hash.update("\0", "utf8");
  }
  return { kind: "directory", bytes, sha256: hash.digest("hex").toUpperCase() };
}

function inventory(workspaceRoot: string, spec: CleanupPathSpec): CleanupInventoryEntry {
  const normalized = normalizeRelativePath(spec.path);
  const fullPath = resolveContained(workspaceRoot, normalized);
  if (!existsSync(fullPath)) {
    return {
      path: normalized,
      kind: "missing",
      exists: false,
      bytes: 0,
      sha256: null,
      required: spec.required,
      reason: spec.reason,
    };
  }
  const identity = hashPath(fullPath);
  return {
    path: normalized,
    ...identity,
    exists: true,
    required: spec.required,
    reason: spec.reason,
  };
}

function uniqueSpecs(specs: CleanupPathSpec[]): CleanupPathSpec[] {
  const seen = new Set<string>();
  return specs.filter((spec) => {
    const path = normalizeRelativePath(spec.path);
    if (seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function detectAssetMode(
  workspaceRoot: string,
  policy: CleanupPolicy,
): CleanupPlan["selectedAssetMode"] {
  if (!policy.assets.verdictPath) return "FIXED_POLICY";
  const verdictPath = resolveContained(workspaceRoot, policy.assets.verdictPath);
  if (!existsSync(verdictPath) || !statSync(verdictPath).isFile()) return "UNRESOLVED";
  const verdict = readFileSync(verdictPath, "utf8");
  if (verdict.includes("ASSET_GENERATION_TOOL_UNAVAILABLE_PROMPT_BATCH_READY")) return "PROMPT_BATCH_READY";
  if (
    verdict.includes("THEME_C_ASSET_BATCH_01_MACHINE_SELECTED_NOT_INTEGRATED") ||
    verdict.includes("ASSET_CANDIDATE_ACCEPTED")
  ) {
    return "MACHINE_SELECTED";
  }
  return "UNRESOLVED";
}

function isProtectedMarker(path: string): boolean {
  return /(?:^|\/)(?:observation-inbox|real[-_ ]?child)(?:\/|$)/i.test(path) ||
    /(?:parent.*feedback|authorization|real[-_ ].*observation|\.sha256$|sha256\.json$|immutable.*hash)/i.test(path);
}

function pathWithin(candidate: string, ancestor: string): boolean {
  return candidate === ancestor || candidate.startsWith(`${ancestor}/`);
}

function protectedByPolicy(path: string, policy: CleanupPolicy): boolean {
  const normalized = normalizeRelativePath(path);
  return (
    isProtectedMarker(normalized) ||
    policy.protectedHuman.some((spec) => pathWithin(normalized, normalizeRelativePath(spec.path)))
  );
}

function assertNoProtectedDescendant(workspaceRoot: string, path: string, policy: CleanupPolicy): void {
  if (protectedByPolicy(path, policy)) throw new Error(`Protected evidence cannot enter cleanup deletion authority: ${path}`);
  const fullPath = resolveContained(workspaceRoot, path);
  if (!existsSync(fullPath) || !lstatSync(fullPath).isDirectory()) return;
  for (const file of listDirectoryFiles(fullPath)) {
    const relativePath = relative(resolve(workspaceRoot), file).replaceAll("\\", "/");
    if (protectedByPolicy(relativePath, policy)) {
      throw new Error(`Protected evidence cannot be deleted through a parent directory: ${relativePath}`);
    }
  }
}

function exactDeletionTarget(
  workspaceRoot: string,
  spec: CleanupPathSpec,
  policy: CleanupPolicy,
): CleanupDeletionTarget | null {
  const entry = inventory(workspaceRoot, spec);
  if (!entry.exists || entry.kind === "missing" || !entry.sha256) return null;
  assertNoProtectedDescendant(workspaceRoot, entry.path, policy);
  return {
    ...entry,
    kind: entry.kind,
    exists: true,
    sha256: entry.sha256,
    tier: "T3_TRANSIENT_DELETE",
    authority: "EXACT_POLICY_PATH",
  };
}

function selectedAssetHashes(workspaceRoot: string, selectedRoot: string | undefined): Set<string> {
  if (!selectedRoot) return new Set();
  const fullRoot = resolveContained(workspaceRoot, selectedRoot);
  if (!existsSync(fullRoot)) return new Set();
  const stat = lstatSync(fullRoot);
  if (stat.isSymbolicLink()) throw new Error(`Selected asset root cannot be a symbolic link or junction: ${selectedRoot}`);
  const files = stat.isDirectory() ? listDirectoryFiles(fullRoot) : [fullRoot];
  return new Set(files.map((file) => hashPath(file).sha256));
}

function unselectedRawAssetTargets(workspaceRoot: string, policy: CleanupPolicy): CleanupDeletionTarget[] {
  if (!policy.rawAssetCandidatesRoot) return [];
  const rawRootRelative = normalizeRelativePath(policy.rawAssetCandidatesRoot);
  const rawRoot = resolveContained(workspaceRoot, rawRootRelative);
  if (!existsSync(rawRoot)) return [];
  if (!lstatSync(rawRoot).isDirectory()) throw new Error(`Raw asset candidate root must be a directory: ${rawRootRelative}`);
  const selectedHashes = selectedAssetHashes(workspaceRoot, policy.selectedAssetsRoot);
  return listDirectoryFiles(rawRoot)
    .map((file): CleanupDeletionTarget | null => {
      const path = relative(resolve(workspaceRoot), file).replaceAll("\\", "/");
      const identity = hashPath(file);
      if (selectedHashes.has(identity.sha256)) return null;
      if (protectedByPolicy(path, policy)) throw new Error(`Protected evidence found under raw asset candidates: ${path}`);
      return {
        path,
        kind: "file",
        exists: true,
        bytes: identity.bytes,
        sha256: identity.sha256,
        required: false,
        reason: "unselected raw Theme C asset candidate",
        tier: "T3_TRANSIENT_DELETE",
        authority: "EXACT_UNSELECTED_ASSET_FILE",
      };
    })
    .filter((entry): entry is CleanupDeletionTarget => entry !== null)
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
}

function missingRequired(entries: CleanupInventoryEntry[]): string[] {
  return entries
    .filter((entry) => entry.required && !entry.exists)
    .map((entry) => `Required ${entry.path} is missing.`);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function planPath(workspaceRoot: string): string {
  return resolveContained(workspaceRoot, CLEANUP_PLAN_RELATIVE_PATH);
}

function resultPath(workspaceRoot: string): string {
  return resolveContained(workspaceRoot, CLEANUP_RESULT_RELATIVE_PATH);
}

function hygienePath(workspaceRoot: string): string {
  return resolveContained(workspaceRoot, PROJECT_HYGIENE_RELATIVE_PATH);
}

function effectivePolicy(options: CleanupOptions): CleanupPolicy {
  return options.policy ?? defaultPolicy;
}

function nowIso(options: CleanupOptions): string {
  return (options.now ?? new Date()).toISOString();
}

export function planStep07Cleanup(options: CleanupOptions = {}): CleanupPlan {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const policy = effectivePolicy(options);
  const assetMode = detectAssetMode(workspaceRoot, policy);
  const assetSpecs = [
    ...policy.assets.common,
    ...(assetMode === "PROMPT_BATCH_READY" ? [] : policy.assets.selected),
  ];
  const canonicalEntries = uniqueSpecs([...policy.canonical, ...assetSpecs]).map((spec) => inventory(workspaceRoot, spec));
  const returnEntries = uniqueSpecs(policy.returnPackage).map((spec) => inventory(workspaceRoot, spec));
  const historyEntries = uniqueSpecs(policy.history).map((spec) => inventory(workspaceRoot, spec));
  const transientEntries = uniqueSpecs(policy.transient).map((spec) => inventory(workspaceRoot, spec));
  const protectedEntries = uniqueSpecs(policy.protectedHuman).map((spec) => inventory(workspaceRoot, spec));
  const blockers = [
    ...missingRequired(canonicalEntries),
    ...missingRequired(historyEntries),
    ...missingRequired(protectedEntries),
  ];
  if (assetMode === "UNRESOLVED") blockers.push("Machine asset generation mode could not be resolved from the verdict.");
  const staticTargets = policy.transient
    .map((spec) => exactDeletionTarget(workspaceRoot, spec, policy))
    .filter((entry): entry is CleanupDeletionTarget => entry !== null);
  const dynamicAssetTargets = unselectedRawAssetTargets(workspaceRoot, policy);
  const deletionAllowlist = [...staticTargets, ...dynamicAssetTargets].sort((a, b) => a.path.localeCompare(b.path, "en"));
  for (let index = 0; index < deletionAllowlist.length; index += 1) {
    for (let other = index + 1; other < deletionAllowlist.length; other += 1) {
      if (pathWithin(deletionAllowlist[other].path, deletionAllowlist[index].path)) {
        throw new Error(`Cleanup deletion targets may not overlap: ${deletionAllowlist[index].path}`);
      }
    }
  }
  const readinessZip = inventory(workspaceRoot, {
    path: policy.readinessZipPath,
    reason: "unique final readiness ZIP; required before apply",
    required: false,
  });
  const plan: CleanupPlan = {
    schemaVersion: 1,
    step: "07",
    policyId: policy.policyId,
    generatedAtUtc: nowIso(options),
    status: blockers.length === 0 ? "READY_FOR_APPLY" : "BLOCKED",
    tiers: {
      T0_CANONICAL: { entries: canonicalEntries },
      T1_RETURN_PACKAGE: { entries: returnEntries },
      T2_HISTORY_ARCHIVE: { entries: historyEntries },
      T3_TRANSIENT_DELETE: { entries: transientEntries },
      T4_PROTECTED_HUMAN: { entries: protectedEntries },
    },
    selectedAssetMode: assetMode,
    readinessZip,
    deletionAllowlist,
    blockers,
    guardrails: {
      exactPathsOnly: true,
      recursiveGlobAuthority: false,
      readinessZipRequiredBeforeApply: true,
      protectedHumanEvidenceDeletionForbidden: true,
      hashesRecheckedBeforeDelete: true,
    },
  };
  writeJson(planPath(workspaceRoot), plan);
  return plan;
}

function assertPlanMatchesPolicy(plan: CleanupPlan, policy: CleanupPolicy): void {
  if (plan.schemaVersion !== 1 || plan.step !== "07" || plan.policyId !== policy.policyId) {
    throw new Error("Cleanup plan does not match the active STEP 07 cleanup policy.");
  }
  if (plan.status !== "READY_FOR_APPLY" || plan.blockers.length > 0) {
    throw new Error(`Cleanup plan is not ready: ${plan.blockers.join(" ") || plan.status}`);
  }
  const exactPolicyTargets = new Set(policy.transient.map((spec) => normalizeRelativePath(spec.path)));
  const rawRoot = policy.rawAssetCandidatesRoot ? normalizeRelativePath(policy.rawAssetCandidatesRoot) : null;
  for (const target of plan.deletionAllowlist) {
    const path = normalizeRelativePath(target.path);
    const authorized =
      (target.authority === "EXACT_POLICY_PATH" && exactPolicyTargets.has(path)) ||
      (target.authority === "EXACT_UNSELECTED_ASSET_FILE" && rawRoot !== null && pathWithin(path, rawRoot));
    if (!authorized) throw new Error(`Cleanup plan contains a target outside the active exact allowlist: ${path}`);
    if (protectedByPolicy(path, policy)) throw new Error(`Cleanup plan contains protected evidence: ${path}`);
  }
}

function assertInventoryUnchanged(workspaceRoot: string, entries: CleanupInventoryEntry[], label: string): void {
  for (const expected of entries) {
    if (!expected.exists) {
      if (expected.required) throw new Error(`${label} required path was absent from the frozen plan: ${expected.path}`);
      continue;
    }
    const current = inventory(workspaceRoot, {
      path: expected.path,
      reason: expected.reason,
      required: expected.required,
    });
    if (!current.exists || current.sha256 !== expected.sha256 || current.kind !== expected.kind) {
      throw new Error(`${label} identity changed after cleanup planning: ${expected.path}`);
    }
  }
}

function assertDeletionTargetsFresh(workspaceRoot: string, plan: CleanupPlan, policy: CleanupPolicy): void {
  const currentStaticTargets = new Map(
    policy.transient
      .map((spec) => exactDeletionTarget(workspaceRoot, spec, policy))
      .filter((entry): entry is CleanupDeletionTarget => entry !== null)
      .map((entry) => [entry.path, entry.sha256]),
  );
  const currentDynamicTargets = new Map(unselectedRawAssetTargets(workspaceRoot, policy).map((entry) => [entry.path, entry.sha256]));
  const plannedStaticTargets = new Map(
    plan.deletionAllowlist
      .filter((entry) => entry.authority === "EXACT_POLICY_PATH")
      .map((entry) => [entry.path, entry.sha256]),
  );
  const plannedDynamicTargets = new Map(
    plan.deletionAllowlist
      .filter((entry) => entry.authority === "EXACT_UNSELECTED_ASSET_FILE")
      .map((entry) => [entry.path, entry.sha256]),
  );
  const sameMap = (left: Map<string, string>, right: Map<string, string>): boolean =>
    left.size === right.size && [...left].every(([path, sha256]) => right.get(path) === sha256);
  if (!sameMap(currentStaticTargets, plannedStaticTargets)) {
    throw new Error("Exact transient target set changed after cleanup planning.");
  }
  if (!sameMap(currentDynamicTargets, plannedDynamicTargets)) {
    throw new Error("Exact unselected asset target set changed after cleanup planning.");
  }
  for (const target of plan.deletionAllowlist) {
    const current = inventory(workspaceRoot, {
      path: target.path,
      reason: target.reason,
      required: true,
    });
    if (!current.exists || current.kind !== target.kind || current.sha256 !== target.sha256) {
      throw new Error(`Cleanup target changed after planning: ${target.path}`);
    }
    if (
      target.authority === "EXACT_UNSELECTED_ASSET_FILE" &&
      currentDynamicTargets.get(target.path) !== target.sha256
    ) {
      throw new Error(`Raw asset candidate is no longer an exact unselected target: ${target.path}`);
    }
    assertNoProtectedDescendant(workspaceRoot, target.path, policy);
  }
}

export function applyStep07Cleanup(options: CleanupOptions = {}): CleanupResult {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const policy = effectivePolicy(options);
  const plan = readJson<CleanupPlan>(planPath(workspaceRoot));
  assertPlanMatchesPolicy(plan, policy);
  const readinessZipPath = resolveContained(workspaceRoot, policy.readinessZipPath);
  if (!existsSync(readinessZipPath) || !statSync(readinessZipPath).isFile() || statSync(readinessZipPath).size <= 0) {
    throw new Error("The final STEP 07 readiness ZIP must exist before cleanup apply.");
  }
  const readinessZipSha256Before = hashPath(readinessZipPath).sha256;
  if (plan.readinessZip.exists && plan.readinessZip.sha256 !== readinessZipSha256Before) {
    throw new Error("The final readiness ZIP changed after cleanup planning.");
  }
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T0_CANONICAL.entries, "Canonical inventory");
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T2_HISTORY_ARCHIVE.entries, "History inventory");
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T4_PROTECTED_HUMAN.entries, "Protected inventory");
  assertDeletionTargetsFresh(workspaceRoot, plan, policy);

  for (const target of plan.deletionAllowlist) {
    const fullPath = resolveContained(workspaceRoot, target.path);
    rmSync(fullPath, { recursive: target.kind === "directory", force: false });
  }
  const readinessZipSha256After = hashPath(readinessZipPath).sha256;
  if (readinessZipSha256After !== readinessZipSha256Before) {
    throw new Error("The final readiness ZIP changed while cleanup was applied.");
  }
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T0_CANONICAL.entries, "Canonical inventory");
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T2_HISTORY_ARCHIVE.entries, "History inventory");
  assertInventoryUnchanged(workspaceRoot, plan.tiers.T4_PROTECTED_HUMAN.entries, "Protected inventory");

  const result: CleanupResult = {
    schemaVersion: 1,
    step: "07",
    policyId: policy.policyId,
    appliedAtUtc: nowIso(options),
    status: "PASS",
    cleanupState: "TRANSIENT_EVIDENCE_CLEANED",
    protectedEvidenceState: "PROTECTED_EVIDENCE_PRESERVED",
    readinessZip: {
      path: normalizeRelativePath(policy.readinessZipPath),
      sha256Before: readinessZipSha256Before,
      sha256After: readinessZipSha256After,
      unchanged: true,
    },
    deletedEvidenceManifest: plan.deletionAllowlist.map((target) => ({
      path: target.path,
      kind: target.kind,
      originalSha256: target.sha256,
      bytes: target.bytes,
      reasonDeleted: target.reason,
    })),
    deletedTargetCount: plan.deletionAllowlist.length,
  };
  writeJson(resultPath(workspaceRoot), result);
  return result;
}

function inventoryMatches(workspaceRoot: string, entries: CleanupInventoryEntry[]): string[] {
  const errors: string[] = [];
  for (const expected of entries) {
    if (!expected.exists) {
      if (expected.required) errors.push(`Required planned path was missing: ${expected.path}`);
      continue;
    }
    try {
      const current = inventory(workspaceRoot, {
        path: expected.path,
        reason: expected.reason,
        required: expected.required,
      });
      if (!current.exists || current.kind !== expected.kind || current.sha256 !== expected.sha256) {
        errors.push(`Inventory identity mismatch: ${expected.path}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return errors;
}

function gitQuiet(workspaceRoot: string, args: string[]): boolean {
  const result = spawnSync("git", args, { cwd: workspaceRoot, encoding: "utf8" });
  return result.status === 0;
}

function gitValue(workspaceRoot: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: workspaceRoot, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function untrackedSourceFiles(workspaceRoot: string): string[] {
  try {
    return execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
      cwd: workspaceRoot,
      encoding: "utf8",
    })
      .split("\0")
      .map((path) => path.replaceAll("\\", "/"))
      .filter(Boolean)
      .filter((path) => !MACHINE_GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix)))
      .sort();
  } catch {
    return ["<git-untracked-inventory-unavailable>"];
  }
}

function remainingTransientPaths(workspaceRoot: string, policy: CleanupPolicy): string[] {
  const remaining = policy.transient
    .map((spec) => normalizeRelativePath(spec.path))
    .filter((path) => existsSync(resolveContained(workspaceRoot, path)));
  return [...remaining, ...unselectedRawAssetTargets(workspaceRoot, policy).map((entry) => entry.path)].sort();
}

export function verifyStep07Cleanup(options: CleanupOptions = {}): ProjectHygieneVerdict {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const policy = effectivePolicy(options);
  const errors: string[] = [];
  let plan: CleanupPlan | null = null;
  let result: CleanupResult | null = null;
  try {
    plan = readJson<CleanupPlan>(planPath(workspaceRoot));
    assertPlanMatchesPolicy(plan, policy);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    result = readJson<CleanupResult>(resultPath(workspaceRoot));
    if (result.policyId !== policy.policyId || result.status !== "PASS") {
      errors.push("Cleanup result does not match the active policy or is not PASS.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const canonicalErrors = plan ? inventoryMatches(workspaceRoot, plan.tiers.T0_CANONICAL.entries) : ["Plan unavailable"];
  const protectedErrors = plan
    ? inventoryMatches(workspaceRoot, plan.tiers.T4_PROTECTED_HUMAN.entries)
    : ["Plan unavailable"];
  const assetPaths = new Set([
    ...policy.assets.common.map((entry) => normalizeRelativePath(entry.path)),
    ...policy.assets.selected.map((entry) => normalizeRelativePath(entry.path)),
  ]);
  const assetErrors = plan
    ? inventoryMatches(
        workspaceRoot,
        plan.tiers.T0_CANONICAL.entries.filter((entry) => assetPaths.has(entry.path)),
      )
    : ["Plan unavailable"];
  errors.push(...canonicalErrors, ...protectedErrors, ...assetErrors);

  const readinessZipPath = resolveContained(workspaceRoot, policy.readinessZipPath);
  let readinessZipSha256: string | null = null;
  let readinessPass = false;
  if (result && existsSync(readinessZipPath) && statSync(readinessZipPath).isFile()) {
    readinessZipSha256 = hashPath(readinessZipPath).sha256;
    readinessPass =
      result.readinessZip.unchanged &&
      result.readinessZip.sha256Before === readinessZipSha256 &&
      result.readinessZip.sha256After === readinessZipSha256;
  }
  if (!readinessPass) errors.push("Final readiness ZIP is missing or changed after cleanup.");

  let remainingTransient: string[] = [];
  try {
    remainingTransient = remainingTransientPaths(workspaceRoot, policy);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (remainingTransient.length > 0) {
    errors.push(`Transient cleanup targets remain: ${remainingTransient.join(", ")}`);
  }

  const branch = gitValue(workspaceRoot, ["branch", "--show-current"]);
  const head = gitValue(workspaceRoot, ["rev-parse", "HEAD"]);
  const originMain = gitValue(workspaceRoot, ["rev-parse", "origin/main"]);
  const trackedClean = gitQuiet(workspaceRoot, ["diff", "--quiet", "HEAD", "--"]);
  const stagedClean = gitQuiet(workspaceRoot, ["diff", "--cached", "--quiet"]);
  const untracked = untrackedSourceFiles(workspaceRoot);
  const gitClean = branch === "main" && trackedClean && stagedClean && untracked.length === 0;
  const originUnchanged = head !== null && head === originMain;
  if (!gitClean) errors.push("Git source status is not clean relative to the pushed commit.");
  if (!originUnchanged) errors.push("Local HEAD does not equal origin/main.");

  const checks: ProjectHygieneVerdict["checks"] = {
    canonicalInventory: canonicalErrors.length === 0 ? "PASS" : "FAIL",
    protectedInventory: protectedErrors.length === 0 ? "PASS" : "FAIL",
    readinessZip: readinessPass ? "PASS" : "FAIL",
    selectedAssetInventory: assetErrors.length === 0 ? "PASS" : "FAIL",
    noDuplicateLargeTransientDirectory: remainingTransient.length === 0 ? "PASS" : "FAIL",
    gitStatusRelativeToPushedCommit: gitClean ? "PASS" : "FAIL",
    originUnchanged: originUnchanged ? "PASS" : "FAIL",
  };
  const status = Object.values(checks).every((value) => value === "PASS") && errors.length === 0 ? "PASS" : "FAIL";
  const verdict: ProjectHygieneVerdict = {
    schemaVersion: 1,
    step: "07",
    policyId: policy.policyId,
    verifiedAtUtc: nowIso(options),
    status,
    projectHygieneVerdict: status === "PASS" ? "PROJECT_CLEAN" : "PROJECT_HYGIENE_FAILED",
    checks,
    git: {
      branch,
      head,
      originMain,
      trackedClean,
      stagedClean,
      untrackedSourceFiles: untracked,
    },
    readinessZipSha256,
    errors: [...new Set(errors)],
  };
  writeJson(hygienePath(workspaceRoot), verdict);
  return verdict;
}

function main(): void {
  const mode = process.argv[2];
  const workspaceRoot = resolve(process.argv[3] ?? process.cwd());
  if (mode === "plan") {
    const plan = planStep07Cleanup({ workspaceRoot });
    process.stdout.write(`${JSON.stringify({ status: plan.status, path: CLEANUP_PLAN_RELATIVE_PATH })}\n`);
    if (plan.status !== "READY_FOR_APPLY") process.exitCode = 1;
    return;
  }
  if (mode === "apply") {
    const result = applyStep07Cleanup({ workspaceRoot });
    process.stdout.write(`${JSON.stringify({ status: result.status, path: CLEANUP_RESULT_RELATIVE_PATH })}\n`);
    return;
  }
  if (mode === "verify") {
    const verdict = verifyStep07Cleanup({ workspaceRoot });
    process.stdout.write(`${JSON.stringify({ status: verdict.status, path: PROJECT_HYGIENE_RELATIVE_PATH })}\n`);
    if (verdict.status !== "PASS") process.exitCode = 1;
    return;
  }
  throw new Error("Usage: cleanup.ts plan|apply|verify [workspace-root]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
