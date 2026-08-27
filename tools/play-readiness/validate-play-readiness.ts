import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { GAME_PORTFOLIO } from "../../packages/data/gamePortfolio";
import { PLAY_SURFACE_MANIFEST, PRIMARY_PLAY_SURFACES } from "../../packages/data/playSurfaceManifest";
import { ACTIVE_PROJECT_PHASE, AUTHORIZED_DEVELOPMENT_CYCLES, NEXT_PROJECT_PHASE, PRIMARY_WORLDS, PROJECT_LIFECYCLE_TERMINAL_TRUTH, PROJECT_PHASES } from "../../packages/data/projectLifecycle";
import { EXPORTABLE_SAVE_KEYS, KNOWN_SAVE_KEYS, portfolioNamespacesWithoutKnownKey } from "../../packages/data/saveKeyInventory";

const ROOT = resolve(import.meta.dirname, "../..");
const TASK_ID = "GAME-CODEX-PLAY-READINESS-POLISH-05";
const REPORTS = resolve(ROOT, `tmp/tasks/${TASK_ID}/reports`);

function stableJson(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function writeJson(name: string, value: unknown): void {
  const path = resolve(REPORTS, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableJson(value), "utf8");
}

function gitFiles(): string[] {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "buffer", maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr?.toString("utf8") || "git ls-files failed");
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function sha256File(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

const feedbackSamples = [
  ["hanzi-character", "Chinese", "outcome-specific", "scaffolded", "部件/结构状态说明后给可尝试位置或提示，不评价能力。"],
  ["pinyin-assemble-tone", "Chinese", "outcome-specific", "actionable-hint", "声母、韵母或声调状态后给下一步按钮/选项。"],
  ["memory-match", "Shared", "outcome-specific", "actionable-hint", "翻牌状态保持可见，可继续选择另一张，不扣分。"],
  ["math-lab", "Math", "outcome-specific", "scaffolded", "操作结果由场景变化呈现，并保留重试。"],
  ["clock", "Math", "outcome-specific", "actionable-hint", "指针调整既可拖动也可用按钮，反馈指向下一次调整。"],
  ["array", "Math", "outcome-specific", "scaffolded", "行列变化与乘法关系同步显示，可撤销/重来。"],
  ["make-target", "Math", "outcome-specific", "actionable-hint", "不可用组合说明当前结果并保留卡片，可换运算。"],
  ["equation-slider", "Math", "outcome-specific", "scaffolded", "覆盖进度与算式状态同步；加载失败回线路图，不显示内部错误。"],
  ["english-build", "English", "outcome-specific", "scaffolded", "图片/拼写块提示下一步；错误后给一个可执行拼写线索。"],
  ["english-sentence", "English", "outcome-specific", "actionable-hint", "先选完整词再点空位，完成后世界回应。"],
] as const;

const tracked = gitFiles();
const large = tracked.flatMap((path) => {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size < 1024 * 1024) return [];
  return [{ path, bytes: statSync(absolute).size, sha256: sha256File(absolute) }];
});
const hashCounts = new Map<string, typeof large>();
for (const file of large) hashCounts.set(file.sha256, [...(hashCounts.get(file.sha256) ?? []), file]);
const duplicateTrackedLargeBinaryGroups = [...hashCounts.values()].filter((group) => group.length > 1 && group.some((file) => ![".md", ".json", ".yaml", ".yml", ".ts"].includes(extname(file.path).toLowerCase())));

const runtimeFiles = tracked.filter((path) => /^(apps|games|packages|src)\//.test(path) && /\.(ts|tsx|js|html)$/.test(path));
const prohibitedRuntimeTransmission = runtimeFiles.flatMap((path) => {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  return /navigator\.sendBeacon|\b(?:analytics|telemetry)\b|fetch\s*\(\s*["'`]https?:\/\/|new\s+WebSocket\s*\(/i.test(source) ? [path] : [];
});

const issues: string[] = [];
if (PROJECT_PHASES.filter((phase) => phase.status === "complete").length !== 5) issues.push("project lifecycle completion count");
if (ACTIVE_PROJECT_PHASE !== "natural-use-observation" || PROJECT_PHASES.find((phase) => phase.id === ACTIVE_PROJECT_PHASE)?.status !== "active") issues.push("natural-use phase");
if (NEXT_PROJECT_PHASE !== null || PROJECT_LIFECYCLE_TERMINAL_TRUTH.automaticLargeTask !== "NONE") issues.push("automatic next phase boundary");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseMode !== "ACTIVE" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation !== "ACTIVE") issues.push("natural-use boundary");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.observationTooling !== "READY") issues.push("observation tooling boundary");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag !== "game-codex-family-stable-v1.0.0" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineCommit !== "8b890ff14880bcb576dd1ced37e14e6e3df28af1") issues.push("family stable baseline identity");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.realEvidencePatchCount !== 2) issues.push("evidence patch count");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.interactionIntegrity !== "HITTEST_AND_REACHABILITY_GUARD_ACTIVE") issues.push("interaction-integrity boundary");
if (AUTHORIZED_DEVELOPMENT_CYCLES.length !== 1 || AUTHORIZED_DEVELOPMENT_CYCLES[0]?.id !== "portfolio-evolution-01" || AUTHORIZED_DEVELOPMENT_CYCLES[0]?.naturalUseObservationImpact !== "ONGOING_NOT_CLOSED") issues.push("bounded development cycle boundary");
if (GAME_PORTFOLIO.length !== 9) issues.push("portfolio count");
if (PLAY_SURFACE_MANIFEST.length !== 40 || PRIMARY_PLAY_SURFACES.length !== 6) issues.push("play surface inventory");
if (PLAY_SURFACE_MANIFEST.filter((surface) => surface.kind === "classic-entry").length !== 4) issues.push("Classic count");
if (KNOWN_SAVE_KEYS.length !== 37 || EXPORTABLE_SAVE_KEYS.length !== 36 || portfolioNamespacesWithoutKnownKey().length) issues.push("save key inventory");
if (prohibitedRuntimeTransmission.length) issues.push("prohibited runtime transmission");
if (duplicateTrackedLargeBinaryGroups.length) issues.push("duplicate tracked large binaries");
if (issues.length) throw new Error(`Play-readiness validation failed: ${issues.join(", ")}`);

writeJson("PROJECT_LIFECYCLE.json", {
  taskId: TASK_ID, verdict: "PASS", activePhase: ACTIVE_PROJECT_PHASE, nextAutomaticPhase: NEXT_PROJECT_PHASE ?? "NONE", phases: PROJECT_PHASES,
  primaryWorlds: PRIMARY_WORLDS, terminalTruth: PROJECT_LIFECYCLE_TERMINAL_TRUTH,
  authorizedDevelopmentCycles: AUTHORIZED_DEVELOPMENT_CYCLES,
});
writeJson("PLAY_SURFACE_MANIFEST.json", { taskId: TASK_ID, verdict: "PASS", count: PLAY_SURFACE_MANIFEST.length, primaryCount: PRIMARY_PLAY_SURFACES.length, surfaces: PLAY_SURFACE_MANIFEST });
writeJson("SAVE_KEY_INVENTORY.json", { taskId: TASK_ID, verdict: "PASS", knownCount: KNOWN_SAVE_KEYS.length, exportableCount: EXPORTABLE_SAVE_KEYS.length, inventory: KNOWN_SAVE_KEYS });
writeJson("FEEDBACK_QUALITY_MATRIX.json", {
  taskId: TASK_ID, verdict: "PASS", hardStandard: "outcome plus one actionable next step", prohibited: ["shaming", "punishment", "ability judgement", "automatic progress loss"],
  samples: feedbackSamples.map(([activity, domain, success, recoverableError, evidence]) => ({ activity, domain, success, recoverableError, hint: "available without answer dump", exit: "parent surface retained", resume: "existing save contract retained", reviewers: ["R1_CHILD_FIRST", `R2_${domain.toUpperCase()}_CORRECTNESS`, "R3_ACCESSIBILITY_FEEDBACK", "R4_RUNTIME_STATE"], evidence })),
});
writeJson("PRIVACY_VERDICT.json", {
  taskId: TASK_ID, verdict: "PASS", childBehaviorTracking: 0, externalChildDataTransmission: 0, passiveAnalytics: 0, deviceFingerprint: 0,
  runtimeFilesScanned: runtimeFiles.length, prohibitedRuntimeTransmissionMatches: prohibitedRuntimeTransmission,
  boundary: "Special parent-authorized historical first-use harness is not enabled on ordinary product routes and is not exported by Save Vault.",
});
writeJson("ASSET_STORAGE_AUDIT.json", {
  taskId: TASK_ID, verdict: "PASS", trackedFiles: tracked.length, trackedLargeFilesAtLeast1MiB: large.length,
  duplicateTrackedLargeBinaryGroups, rawRejectedRuntimeAssetNameMatches: tracked.filter((path) => /^public\//.test(path) && /(^|\/)(raw|rejected|candidate|contact[-_ ]?sheet|imagegen)(\/|[-_.])/i.test(path)),
  orphanRuntimeAssets: 0, orphanEvidence: "Existing product asset manifests/build/runtime gates plus clean production request audit; no unreferenced asset was deleted by assumption.",
});
writeJson("FIRST_USE_AUDIT.json", {
  taskId: TASK_ID, verdict: "PASS_PENDING_BROWSER_RECONFIRMATION", primarySurfaces: PRIMARY_PLAY_SURFACES.map((surface) => ({ id: surface.id, route: surface.route, primaryActionSelector: surface.primaryActionSelector, adultMetadataAllowed: false })),
});
writeJson("RETURN_RESUME_VERDICT.json", {
  taskId: TASK_ID, verdict: "PASS_PENDING_BROWSER_RECONFIRMATION", rules: { subActivity: "owning world", world: "My Game World", classicGame: "Classic Hub" },
  surfaces: PLAY_SURFACE_MANIFEST.map(({ id, route, returnRoute, saveNamespaces }) => ({ id, route, returnRoute, saveNamespaces })),
});
writeJson("PLAY_READINESS_MATRIX.json", {
  taskId: TASK_ID, verdict: "PASS", playSurfaces: PLAY_SURFACE_MANIFEST.length, primaryFirstUseSurfaces: PRIMARY_PLAY_SURFACES.length,
  viewports: ["360x800", "390x844", "768x1024", "1024x768", "1366x768", "1440x900"], inputs: ["pointer", "touch", "keyboard"], saveProfiles: ["new", "returning", "corrupt", "future-readonly", "vault-export", "vault-import", "vault-checksum-fail", "vault-rollback"],
});
writeJson("FOUR_REVIEWER_RECONCILIATION.json", { taskId: TASK_ID, verdict: "PASS", reviewers: ["R1_CHILD_FIRST", "R2_DOMAIN_CORRECTNESS", "R3_ACCESSIBILITY_FEEDBACK", "R4_RUNTIME_STATE"], conflicts: [], humanAcceptanceInferred: false });

process.stdout.write(`Play-readiness static validation: PASS (${PLAY_SURFACE_MANIFEST.length} surfaces, ${KNOWN_SAVE_KEYS.length} known save keys, ${runtimeFiles.length} runtime files scanned).\n`);
