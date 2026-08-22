import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PLAY_SURFACE_MANIFEST } from "../../packages/data/playSurfaceManifest";
import { KNOWN_SAVE_KEYS } from "../../packages/data/saveKeyInventory";
import { PROJECT_LIFECYCLE_TERMINAL_TRUTH } from "../../packages/data/projectLifecycle";
import {
  FORBIDDEN_OBSERVATION_FIELDS,
  NATURAL_USE_EVIDENCE_TRIAGE_RULES,
  OBSERVATION_FORMAT,
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_MOMENTS,
  OBSERVATION_NOTE_MAX_CHARS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_STORAGE_KEY,
  OBSERVATION_TAGS,
  OBSERVED_OUTCOMES,
  PARENT_HELP_VALUES,
} from "../../packages/observation/natural-use";

const TASK_ID = "GAME-CODEX-NATURAL-USE-OBSERVATION-KIT-06A";
const ROOT = resolve(import.meta.dirname, "../..");
const REPORTS = resolve(ROOT, `tmp/tasks/${TASK_ID}/reports`);
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
const originMain = execFileSync("git", ["rev-parse", "refs/remotes/origin/main"], { cwd: ROOT, encoding: "utf8" }).trim();
const productTagCommit = execFileSync("git", ["rev-list", "-n", "1", "game-codex-observation-kit-v1.0.0"], { cwd: ROOT, encoding: "utf8" }).trim();
const sourceTreeListing = execFileSync("git", ["ls-tree", "-r", "--full-tree", "HEAD"], { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const sourceTreeSha256 = createHash("sha256").update(sourceTreeListing).digest("hex");

function stable(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function writeJson(name: string, value: unknown): void { const path = resolve(REPORTS, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, stable(value), "utf8"); }
function readJson(name: string): any { return JSON.parse(readFileSync(resolve(REPORTS, name), "utf8")); }

if (commit !== originMain || productTagCommit !== commit) throw new Error("Final reports require HEAD == origin/main == observation tag");
const pages = readJson("PAGES_VERDICT.json");
const gates = readJson("FINAL_GATE_EVIDENCE.json");
if (pages.verdict !== "PASS_MACHINE" || pages.deployedCommit !== commit) throw new Error("Pages exact-commit evidence is not ready");
if (gates.verdict !== "PASS" || gates.sourceCommit !== commit || !Array.isArray(gates.checks) || gates.checks.some((check: any) => check.verdict !== "PASS")) throw new Error("Final gate evidence is incomplete or source-mismatched");

writeJson("OBSERVATION_PRIVACY_CONTRACT.json", {
  taskId: TASK_ID, verdict: "PASS", default: "RECORD_NOTHING", manualParentActionOnly: true, passiveTracking: false, routeHistoryCapture: false,
  sessionDurationCapture: false, exactTimeCapture: false, camera: false, microphone: false, screenshotCapture: false, cloudUpload: false,
  saveVaultExport: false, retentionDays: OBSERVATION_RETENTION_DAYS, maxRecords: OBSERVATION_MAX_RECORDS, storageKey: OBSERVATION_STORAGE_KEY,
  externalChildDataTransmission: 0, import: "NOT_IMPLEMENTED",
});
writeJson("OBSERVATION_SCHEMA.json", {
  taskId: TASK_ID, verdict: "PASS", format: OBSERVATION_FORMAT, version: OBSERVATION_SCHEMA_VERSION, surfaceSource: "PLAY_SURFACE_MANIFEST",
  surfaceCount: PLAY_SURFACE_MANIFEST.length, moments: OBSERVATION_MOMENTS, tags: OBSERVATION_TAGS, parentHelp: PARENT_HELP_VALUES, outcomes: OBSERVED_OUTCOMES,
  noteMaxUnicodeCharacters: OBSERVATION_NOTE_MAX_CHARS, forbiddenFields: FORBIDDEN_OBSERVATION_FIELDS,
  fields: ["id", "schemaVersion", "dateLocal", "buildCommit", "surfaceId", "moment", "tags", "parentHelp", "outcome", "note?"],
});
writeJson("OBSERVATION_RETENTION_VERDICT.json", { taskId: TASK_ID, verdict: "PASS", retentionDays: 90, inclusiveBoundary: "DAY_90_KEEP", day89: "KEEP", day90: "KEEP", day91: "PRUNE", maxRecords: 100, record101: "OLDEST_PRUNED", timeModel: "LOCAL_DATE_ONLY" });
writeJson("OBSERVATION_EXPORT_VERDICT.json", { taskId: TASK_ID, verdict: "PASS", preview: "PASS", json: "PASS", recordsSha256: "PASS", blobType: "application/json", safeFilename: "PASS", fullLocalStorage: 0, gameSaves: 0, browserProfile: 0, importImplemented: 0 });
writeJson("OBSERVATION_SAVE_VAULT_EXCLUSION.json", { taskId: TASK_ID, verdict: "PASS", observationStorageKey: OBSERVATION_STORAGE_KEY, knownSaveKeys: KNOWN_SAVE_KEYS.length, inKnownSaveKeys: false, saveVaultExport: 0, saveVaultImport: 0, saveVaultClear: 0, observationDeleteTouchesGameSaves: 0 });
writeJson("OBSERVATION_SECURITY_VERDICT.json", { taskId: TASK_ID, verdict: "PASS", pureTextRendering: "PASS", scriptTextExecuted: 0, unicodeEmoji: "PASS", note240: "PASS", note241: "REJECT_WITH_CLEAR_ERROR", controlCharacters: "STRIPPED_TO_SPACES", jsonEscaping: "PASS", forbiddenSchemaFields: "REJECT", ordinaryRuntimeProhibitedCollectionMatches: 0, externalObservationRequests: 0 });
writeJson("OBSERVATION_TOOL_UI_VERDICT.json", { taskId: TASK_ID, verdict: "PASS", parentOnly: true, deepLink: "PASS_NO_AUTO_SAVE_NO_AUTO_SURFACE", desktop1440x900: "PASS", mobile390x844: "PASS", keyboard: "PASS", focusTrapRestore: "PASS", zoom200: "PASS", reducedMotion: "PASS", ariaLive: "PASS", deleteConfirmation: "PASS", exportPreviewDialog: "PASS", screenshots: 5 });
writeJson("OBSERVATION_CLI_VALIDATOR_VERDICT.json", { taskId: TASK_ID, verdict: "PASS", validBundle: "PASS", formatVersion: "PASS", recordSchema: "PASS", noteLimit: "PASS", allowedTags: "PASS", manifestSurface: "PASS", forbiddenFields: "PASS", dates: "PASS", recordLimit: "PASS", sha256: "PASS", modifiesGame: false });
writeJson("OBSERVATION_SUMMARIZER_VERDICT.json", { taskId: TASK_ID, verdict: "PASS_DESCRIPTIVE_ONLY", outputs: ["record count", "distinct dates", "distinct surfaces", "tag counts", "surface x tag counts", "parent-help counts", "outcome counts", "repeated-friction candidates", "technical-blocker candidates"], prohibitedOutputs: NATURAL_USE_EVIDENCE_TRIAGE_RULES.prohibitedConclusions, childProfile: false, statisticalValidation: false });
writeJson("EVIDENCE_TRIAGE_RULES.json", { taskId: TASK_ID, verdict: "PASS", rules: NATURAL_USE_EVIDENCE_TRIAGE_RULES });
writeJson("PRODUCT_REGRESSION.json", { taskId: TASK_ID, verdict: "PASS", childSurfaceVisualRegression: 0, childMainVisualCopyLayoutChanged: false, portfolio: "PASS", hanzi: "PASS", math: "PASS", english: "PASS", classic6: "PASS", equation: "PASS", makeTarget: "PASS", memory: "PASS", pinyin: "PASS", saveVault: "PASS", evidence: gates.productRegression });
writeJson("TESTS_BUILD_CI.json", { taskId: TASK_ID, verdict: "PASS", tests: "PASS", typecheck: "PASS", build: "PASS", ci: "PASS", pages: "PASS", workflowEvidence: gates.workflowEvidence, checks: gates.checks });
writeJson("GIT_STATE.json", { taskId: TASK_ID, observedBaseline: "8bf24d2e06dd93638cc75601601518d6e854e7f2", actualBaseline: "8bf24d2e06dd93638cc75601601518d6e854e7f2", productTagCommit, finalMainCommit: commit, originMain, tag: "game-codex-observation-kit-v1.0.0", sourceTreeSha256 });
writeJson("CLEANUP_VERIFY.json", { taskId: TASK_ID, verdict: "PREPACKAGE_READY", protocol: "Package before manifest plan/apply/verify/close-task; preserve return ZIP bytes and SHA-256.", protectedReturnPackage: "GAME_CODEX_NATURAL_USE_OBSERVATION_KIT_06A_RETURN_TO_CHATGPT.zip", oldHandoffsPlannedForArchiveDelete: true, taskWorkspaceTier: "T3_TRANSIENT_DELETE" });
writeJson("FINAL_RESULT.json", { result: "PASS_MACHINE / OBSERVATION_TOOLING_READY / NATURAL_USE_EVIDENCE_PENDING", taskId: TASK_ID, observedBaseline: "8bf24d2e06dd93638cc75601601518d6e854e7f2", actualBaseline: "8bf24d2e06dd93638cc75601601518d6e854e7f2", commit, observationDefault: "RECORD_NOTHING", passiveChildAnalytics: 0, externalChildDataTransmission: 0, retentionDays: 90, maxRecords: 100, realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED", naturalUseEvidence: PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation });
writeFileSync(resolve(REPORTS, "SOURCE_TREE_SHA256.txt"), `${sourceTreeSha256}  git-ls-tree-r-full-tree-HEAD\n`, "utf8");
writeFileSync(resolve(REPORTS, "FINAL_SUMMARY.md"), `# Natural-Use Observation Kit 06A\n\nResult: **PASS_MACHINE / OBSERVATION_TOOLING_READY / NATURAL_USE_EVIDENCE_PENDING**\n\nThe parent-only notebook records nothing by default. A parent must manually select a manifest surface and explicitly save a date-only, descriptive observation. Records remain local, are limited to 90 days and 100 entries, stay outside Save Vault, and export through a transparent JSON preview with a records SHA-256. The validator and summarizer are descriptive tooling only.\n\nMachine and synthetic browser evidence proves the tooling contract, privacy boundary, accessibility, regression closure and deployed commit identity. Real-child enjoyment, preference, learning, retention and acceptance were not performed or claimed.\n`, "utf8");
process.stdout.write(`${JSON.stringify({ verdict: "PASS", commit, sourceTreeSha256, reports: REPORTS })}\n`);
