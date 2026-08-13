import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { computeMachineReviewSourceTreeSha256 } from "../game-machine-review/source-identity";

const workspace = resolve(process.cwd());
const reportRoot = resolve(workspace, "artifacts/hanzi-radical-battle-v2/v2-chapter-one/report");
const dataRoot = resolve(reportRoot, "data");
const expectedPages = "https://archmays.github.io/Game-Codex/?play=hanzi-v2-chapter-one&from=hub";
const expectedV1 = "43e7841d2190922b6048182cab4b871c55715840";
interface JsonObject { [key: string]: unknown }
function readJson(path: string): JsonObject { if (!existsSync(path)) throw new Error(`Required final evidence is missing: ${path}`); return JSON.parse(readFileSync(path, "utf8")) as JsonObject; }
function writeJson(path: string, value: unknown): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function git(...args: string[]): string { return execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim(); }
function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: workspace, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function remoteTagCommit(tag: string): string {
  const rows = git("ls-remote", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`).split(/\r?\n/).filter(Boolean);
  const peeled = rows.find((row) => row.endsWith(`refs/tags/${tag}^{}`));
  return (peeled ?? rows[0] ?? "").split(/\s+/)[0] ?? "";
}

export function finalizeReleaseState(): void {
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspace);
  const candidate = readJson(resolve(dataRoot, "MACHINE-REVIEW-CANDIDATE.json"));
  const pages = readJson(resolve(dataRoot, "PAGES-VERDICT.json"));
  const cleanup = readJson(resolve(dataRoot, "CLEANUP-RESULT.json"));
  const tests = readJson(resolve(dataRoot, "TEST-BUILD-RESULTS.json"));
  const simulation = readJson(resolve(dataRoot, "PURE-SIMULATION.json"));
  const matrix = readJson(resolve(dataRoot, "MACHINE-PLAYTHROUGH-MATRIX.json"));
  const reviewers = readJson(resolve(dataRoot, "REVIEWER-RECONCILIATION.json"));
  const head = git("rev-parse", "HEAD");
  const branch = git("branch", "--show-current");
  const originMain = git("rev-parse", "refs/remotes/origin/main");
  const remoteMain = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] ?? "";
  const v1Tag = git("rev-list", "-n", "1", "hanzi-magic-v2-v1.0.0");
  const v2Tag = git("rev-list", "-n", "1", "hanzi-magic-v2-v2.0.0");
  const remoteV1Tag = remoteTagCommit("hanzi-magic-v2-v1.0.0");
  const remoteV2Tag = remoteTagCommit("hanzi-magic-v2-v2.0.0");
  const v2TagIsAncestorOfFinalCommit = isAncestor(v2Tag, head);
  const statusPorcelain = git("status", "--porcelain=v1", "--untracked-files=normal");

  requireValue(candidate.result === "PASS_MACHINE" && candidate.sourceTreeSha256 === sourceTreeSha256, "Machine review candidate is failed or stale");
  requireValue(reviewers.conservativeVerdict === "PASS_MACHINE" && reviewers.sourceTreeSha256 === sourceTreeSha256, "Reviewer reconciliation is failed or stale");
  requireValue(pages.result === "PASS" && pages.sourceTreeSha256 === sourceTreeSha256 && pages.commit === head && pages.canonicalUrl === expectedPages, "Pages verdict is failed, stale, or bound to another commit");
  requireValue(cleanup.result === "PASS" && Array.isArray(cleanup.remainingTargets) && cleanup.remainingTargets.length === 0 && cleanup.rejectedImagegenRetriesPresent === 0, "Cleanup result is incomplete or failed");
  requireValue(tests.result === "PASS" && tests.sourceTreeSha256 === sourceTreeSha256, "Test/build result is failed or stale");
  requireValue(simulation.result === "PASS" && simulation.sourceTreeSha256 === sourceTreeSha256 && Number(simulation.totalSeeds) === 90_000, "Simulation evidence is failed or stale");
  requireValue(matrix.result === "PASS" && matrix.sourceTreeSha256 === sourceTreeSha256 && Number(matrix.playthroughCount) === 18, "Browser matrix is failed or stale");
  requireValue(branch === "main" && head === originMain && head === remoteMain, "main, origin/main, and remote main are not identical");
  requireValue(v1Tag === expectedV1 && remoteV1Tag === v1Tag, "The V1 release tag is missing, moved, or differs from origin");
  requireValue(remoteV2Tag === v2Tag && v2TagIsAncestorOfFinalCommit, "The immutable V2 release tag is missing, differs from origin, or is not in the final repair lineage");
  requireValue(statusPorcelain === "", `Repository is not clean: ${statusPorcelain}`);

  const generatedAtUtc = new Date().toISOString();
  const gitState = { schemaVersion: 1, sourceTreeSha256, branch, head, originMain, remoteMain, v1Tag: { name: "hanzi-magic-v2-v1.0.0", target: v1Tag, remoteTarget: remoteV1Tag }, v2Tag: { name: "hanzi-magic-v2-v2.0.0", target: v2Tag, remoteTarget: remoteV2Tag, isAncestorOfFinalCommit: v2TagIsAncestorOfFinalCommit }, statusPorcelain, repoClean: true, generatedAtUtc };
  const finalResult = { schemaVersion: 1, result: "PASS_MACHINE", productStatus: "CHAPTER_ONE_COMPLETE", readiness: "HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_PLAYABLE_READY", version: "V2.0.0", parentV1PlayAcceptance: "PASS", realChildValidation: "NO_BY_USER_DIRECTION", counts: { playableCharacters: "36/36", heroes: "3/3", regions: "3/3 + 墨王核心", monsterBehaviors: "9/9", bosses: "4/4", selectableAbilities: "18/18", heroInnateAbilities: "3/3", campRepairs: "8/8", spellbook: "36/36" }, simulationSeeds: simulation.totalSeeds, browserPlaythroughs: matrix.playthroughCount, tests: tests.summary, sourceTreeSha256, finalCommit: head, originMain, v1Tag: v1Tag, v2Tag: v2Tag, repoClean: true, pages: expectedPages, unresolvedReleaseDefects: 0, generatedAtUtc };
  writeJson(resolve(dataRoot, "GIT-STATE.json"), gitState);
  writeJson(resolve(reportRoot, "FINAL-RESULT.json"), finalResult);
  writeFileSync(resolve(reportRoot, "FINAL-SUMMARY.md"), `# 汉字魔法战 V2.0.0 · 墨迹森林第一章\n\n- Result: PASS_MACHINE / CHAPTER_ONE_COMPLETE / HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_PLAYABLE_READY\n- Source tree SHA-256: ${sourceTreeSha256}\n- Final commit / origin main: ${head}\n- Immutable V2 tag: ${v2Tag} (verified ancestor of the final Pages repair commit)\n- Pure simulation: ${simulation.totalSeeds} seeds\n- Browser playthroughs: ${matrix.playthroughCount}\n- Full repository tests: ${String((tests.summary as JsonObject).fullRepository)}\n- Pages: ${expectedPages}\n- Real child validation: NO_BY_USER_DIRECTION\n- Unresolved release defects: 0\n`, "utf8");
  const links = ["FINAL-RESULT.json", "SOURCE-TREE-SHA256.txt", "data/GIT-STATE.json", "data/PAGES-VERDICT.json", "data/TEST-BUILD-RESULTS.json", "data/REVIEWER-A-CHILD-GAME-SCOPE.json", "data/REVIEWER-B-HANZI-LEARNING.json", "data/REVIEWER-C-VISUAL-A11Y-TECH.json", "data/REVIEWER-RECONCILIATION.json", "data/MACHINE-PLAYTHROUGH-MATRIX.json", "data/PURE-SIMULATION.json"];
  writeFileSync(resolve(reportRoot, "index.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>汉字魔法战 V2.0.0 第一章机器报告</title><style>body{font:16px/1.65 system-ui,"Microsoft YaHei";max-width:980px;margin:auto;padding:28px;color:#143238;background:#f7f4e7}h1,h2{color:#124d4a}.pass{padding:18px;border-radius:16px;background:#d9f7e7;color:#164d37;font-weight:800}table{border-collapse:collapse;width:100%;background:#fff}th,td{padding:10px;border:1px solid #bdd4cf;text-align:left}code{overflow-wrap:anywhere}a{color:#075f68}</style></head><body><main><h1>汉字魔法战 V2.0.0 · 墨迹森林第一章</h1><p class="pass">PASS_MACHINE / CHAPTER_ONE_COMPLETE / HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE_PLAYABLE_READY</p><table><tr><th>Source tree SHA-256</th><td><code>${sourceTreeSha256}</code></td></tr><tr><th>Final commit / origin main</th><td><code>${head}</code></td></tr><tr><th>Immutable V2 tag</th><td><code>${v2Tag}</code> · verified ancestor of final Pages repair</td></tr><tr><th>Pure simulation</th><td>${simulation.totalSeeds} seeds · PASS</td></tr><tr><th>Browser playthroughs</th><td>${matrix.playthroughCount} complete runs · PASS</td></tr><tr><th>Scope</th><td>36 characters · 3 heroes · 3 regions + final core · 9 behaviors · 4 bosses · 18+3 abilities · 8 repairs · 36 spellbook entries</td></tr><tr><th>Pages</th><td><a href="${expectedPages}">${expectedPages}</a></td></tr><tr><th>Child evidence boundary</th><td>NO_BY_USER_DIRECTION; no real-child result was simulated or inferred.</td></tr></table><h2>Evidence</h2><ul>${links.map((link) => `<li><a href="${link}">${link}</a></li>`).join("")}</ul></main></body></html>`, "utf8");
  process.stdout.write(`${JSON.stringify({ result: finalResult.result, productStatus: finalResult.productStatus, readiness: finalResult.readiness, sourceTreeSha256, finalCommit: head, pages: expectedPages }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) finalizeReleaseState();
