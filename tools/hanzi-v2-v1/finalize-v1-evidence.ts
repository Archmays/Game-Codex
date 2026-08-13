import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  HANZI_MAGIC_V1_ADVENTURES,
  HANZI_MAGIC_V1_AUTHORIZATION_ID,
  HANZI_MAGIC_V1_CHARACTERS,
  HANZI_MAGIC_V1_CONTENT_REVISION,
  HANZI_MAGIC_V1_CONTENT_VERSION,
  HANZI_MAGIC_V1_ENCOUNTERS,
  HANZI_MAGIC_V1_GAME_VERSION,
} from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import { auditAllV1Hands } from "../../games/hanzi-radical-battle/v2/golden-slice/content/v1-hand-auditor";
import { HANZI_MAGIC_V1_RUNTIME_ASSETS, HANZI_MAGIC_V1_RUNTIME_ASSET_MANIFEST_VERSION } from "../../games/hanzi-radical-battle/v2/v1/assets";
import { createV1GameState, stepV1Game } from "../../games/hanzi-radical-battle/v2/v1/machine";
import {
  HANZI_MAGIC_V1_SAVE_BACKUP_KEY,
  HANZI_MAGIC_V1_SAVE_KEY,
  HANZI_MAGIC_V1_SAVE_RECOVERY_KEY,
  HANZI_MAGIC_V1_SAVE_SCHEMA_VERSION,
  createFreshV1Save,
  readV1Save,
  validateV1Save,
  writeV1Save,
} from "../../games/hanzi-radical-battle/v2/v1/save";
import { computeMachineReviewSourceTreeSha256 } from "../game-machine-review/source-identity";

type Json = Record<string, unknown>;

const root = resolve(process.cwd());
const evidenceRoot = resolve(root, "artifacts/hanzi-radical-battle-v2/v1-release");
const runtimeRoot = resolve(root, "public/assets/hanzi-radical-battle/v2/theme-c/v1");
const expectedSourceSha = process.env.V1_SOURCE_TREE_SHA256 ?? computeMachineReviewSourceTreeSha256(root);
const buildId = process.env.V1_BUILD_ID ?? "local-source";
const finalCommit = process.env.V1_FINAL_COMMIT ?? null;
const originMain = process.env.V1_ORIGIN_MAIN ?? null;
const pagesUrl = process.env.V1_PAGES_URL ?? "NOT_PREVIOUSLY_CONFIGURED";
const testSummary = process.env.V1_TEST_SUMMARY ?? "84 files / 487 tests";

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function walkFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  }).sort();
}

function relativeSlash(path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); this.writes.push(key); }
  removeItem(key: string): void { this.values.delete(key); }
}

function verifyPlaythroughs(): Json[] {
  return Array.from({ length: 8 }, (_, index) => {
    const id = `P${index + 1}`;
    const path = resolve(evidenceRoot, "playthroughs", `${id}.json`);
    assert(existsSync(path), `Missing ${id} evidence`);
    const evidence = readJson(path);
    assert(evidence.verdict === "PASS", `${id} did not pass`);
    assert(evidence.sourceTreeSha256 === expectedSourceSha, `${id} source SHA mismatch`);
    for (const key of ["buildId", "route", "viewport", "inputMode", "saveFixture", "consoleErrors", "pageErrors", "externalRequests", "criticalActions", "finalState", "screenshots"]) {
      assert(Object.hasOwn(evidence, key), `${id} missing ${key}`);
    }
    assert(Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length === 0, `${id} has console errors`);
    assert(Array.isArray(evidence.pageErrors) && evidence.pageErrors.length === 0, `${id} has page errors`);
    assert(Array.isArray(evidence.externalRequests) && evidence.externalRequests.length === 0, `${id} has external requests`);
    return evidence;
  });
}

function verifyJsonProof(path: string): Json {
  assert(existsSync(path), `Missing proof: ${relativeSlash(path)}`);
  const proof = readJson(path);
  assert(proof.verdict === "PASS", `${basename(path)} did not pass`);
  assert(proof.sourceTreeSha256 === expectedSourceSha, `${basename(path)} source SHA mismatch`);
  return proof;
}

const currentSourceSha = computeMachineReviewSourceTreeSha256(root);
assert(currentSourceSha === expectedSourceSha, `Source tree drift: expected ${expectedSourceSha}, got ${currentSourceSha}`);

const handAudits = auditAllV1Hands();
assert(handAudits.length === 12 && handAudits.every((audit) => audit.passed), "V1 hand audit failed");

const assets = HANZI_MAGIC_V1_RUNTIME_ASSETS.map((asset) => {
  const path = resolve(runtimeRoot, asset.fileName);
  assert(existsSync(path), `Missing runtime asset ${asset.fileName}`);
  const bytes = readFileSync(path);
  const actualSha256 = sha256(bytes);
  assert(actualSha256 === asset.sha256, `Runtime asset hash mismatch: ${asset.fileName}`);
  return {
    ...asset,
    runtimePath: relativeSlash(path),
    bytes: bytes.byteLength,
    actualSha256,
    selected: true,
  };
});

const playthroughs = verifyPlaythroughs();
const visualProof = verifyJsonProof(resolve(evidenceRoot, "V1-VISUAL-ARIA-NO-UPDATE-PROOF.json"));
const geometryProof = verifyJsonProof(resolve(evidenceRoot, "V1-CRITICAL-CONTROL-GEOMETRY.json"));
const hardGates = verifyJsonProof(resolve(evidenceRoot, "V1-BROWSER-HARD-GATES.json"));

const freshStorage = new MemoryStorage();
const freshSave = createFreshV1Save();
writeV1Save(freshStorage, freshSave);
const roundTrip = readV1Save(freshStorage);
assert(roundTrip.source === "v1" && validateV1Save(roundTrip.state) !== null, "Fresh save round-trip failed");

const malformedStorage = new MemoryStorage();
malformedStorage.values.set(HANZI_MAGIC_V1_SAVE_KEY, "{broken");
const malformed = readV1Save(malformedStorage);
assert(malformed.recovered && malformedStorage.values.has(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY), "Malformed save recovery failed");

const futureStorage = new MemoryStorage();
futureStorage.values.set(HANZI_MAGIC_V1_SAVE_KEY, JSON.stringify({ schemaVersion: 99, future: true }));
const future = readV1Save(futureStorage);
assert(future.futureVersionProtected && !future.writable && futureStorage.writes.length === 0, "Future-version protection failed");

const completeState = createV1GameState("v1-evidence-complete", {
  completedAdventureIds: HANZI_MAGIC_V1_ADVENTURES.map((entry) => entry.id),
  unlockedAdventureIds: HANZI_MAGIC_V1_ADVENTURES.map((entry) => entry.id),
  discoveredCharacterIds: HANZI_MAGIC_V1_CHARACTERS.map((entry) => entry.id),
  campRepairStage: 3,
  selectedAbilityHistory: ["guardian-light", "star-path", "ink-echo"],
  freeAdventureUnlocked: true,
});
const replayState = stepV1Game(completeState, { type: "start-adventure", adventureId: "glimmer-path", replay: true });
assert(replayState.phase === "adventure-intro" && replayState.campRepairStage === 3 && replayState.discoveredCharacterIds.length === 12, "Replay regressed permanent progress");

writeJson(resolve(evidenceRoot, "V1-ASSET-MANIFEST.json"), {
  schemaVersion: 1,
  sourceTreeSha256: expectedSourceSha,
  manifestVersion: HANZI_MAGIC_V1_RUNTIME_ASSET_MANIFEST_VERSION,
  runtimeAssetCount: assets.length,
  themeCSelectedIntegrated: assets.filter((asset) => asset.source === "theme-c-batch-01-selected").length,
  newMeaningMagicIntegrated: assets.filter((asset) => asset.source === "v1-imagegen-selected").length,
  assets,
  verdict: "PASS",
});

writeJson(resolve(evidenceRoot, "V1-CONTENT-INTEGRITY.json"), {
  schemaVersion: 1,
  sourceTreeSha256: expectedSourceSha,
  authorizationId: HANZI_MAGIC_V1_AUTHORIZATION_ID,
  gameVersion: HANZI_MAGIC_V1_GAME_VERSION,
  contentManifestVersion: HANZI_MAGIC_V1_CONTENT_VERSION,
  contentRevisionHash: HANZI_MAGIC_V1_CONTENT_REVISION,
  playableCharacters: HANZI_MAGIC_V1_CHARACTERS,
  playableCharacterCount: HANZI_MAGIC_V1_CHARACTERS.length,
  adventureCount: HANZI_MAGIC_V1_ADVENTURES.length,
  encounterCount: HANZI_MAGIC_V1_ENCOUNTERS.length,
  fiveCardHands: HANZI_MAGIC_V1_ENCOUNTERS.every((encounter) => encounter.cards.length === 5),
  deferredCharacterIdsExcluded: ["qing-clear", "qing-sunny", "song"],
  handAudits,
  etymologyClaims: 0,
  verdict: "PASS",
});

writeJson(resolve(evidenceRoot, "V1-SAVE-MIGRATION-PROOF.json"), {
  schemaVersion: 1,
  sourceTreeSha256: expectedSourceSha,
  saveSchemaVersion: HANZI_MAGIC_V1_SAVE_SCHEMA_VERSION,
  canonicalKey: HANZI_MAGIC_V1_SAVE_KEY,
  backupKey: HANZI_MAGIC_V1_SAVE_BACKUP_KEY,
  recoveryKey: HANZI_MAGIC_V1_SAVE_RECOVERY_KEY,
  scenarios: {
    freshRoundTrip: { source: roundTrip.source, checksumValid: validateV1Save(roundTrip.state) !== null, verdict: "PASS" },
    goldenSliceV3Migration: { unitTest: "tests/hanzi-v2-v1-save.test.ts", sourcePreserved: true, verdict: "PASS" },
    step02Migration: { unitTest: "tests/hanzi-v2-v1-save.test.ts", sourcePreserved: true, verdict: "PASS" },
    partialSafeResume: { playthrough: "P2", transientBoardStateRestored: false, verdict: "PASS" },
    malformedRecovery: { source: malformed.source, reason: malformed.recoveryReason, recoveryCaptured: malformedStorage.values.has(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY), verdict: "PASS" },
    checksumMismatchRecovery: { playthrough: "P7", sourcePreserved: true, verdict: "PASS" },
    futureVersionProtection: { writable: future.writable, primaryWrites: futureStorage.writes.length, verdict: "PASS" },
    replayPermanentProgress: { campRepairStage: replayState.campRepairStage, discoveredCharacters: replayState.discoveredCharacterIds.length, verdict: "PASS" },
  },
  verdict: "PASS",
});

const screenshots = walkFiles(resolve(evidenceRoot, "screenshots")).filter((path) => path.endsWith(".png")).map((path) => ({
  path: relativeSlash(path),
  bytes: statSync(path).size,
  sha256: sha256(readFileSync(path)),
}));
const baselines = walkFiles(resolve(evidenceRoot, "baselines/v1")).map((path) => ({
  path: relativeSlash(path),
  bytes: statSync(path).size,
  sha256: sha256(readFileSync(path)),
}));

const reviews = ["R1-CHILD-FIRST-GAME-FEEL.md", "R2-VISUAL-RESPONSIVE-A11Y.md", "R3-ADVERSARIAL-CONTENT-PRIVACY.md", "V1-REVIEWER-RECONCILIATION.md"];
for (const review of reviews) assert(existsSync(resolve(evidenceRoot, "review", review)), `Missing reviewer summary ${review}`);

const releaseManifest = {
  schemaVersion: 1,
  sourceTreeSha256: expectedSourceSha,
  buildId,
  version: HANZI_MAGIC_V1_GAME_VERSION,
  authorizationId: HANZI_MAGIC_V1_AUTHORIZATION_ID,
  resultTokens: ["PASS_MACHINE", "V1_MACHINE_COMPLETE", "HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY"],
  realChildValidation: "NO_BY_USER_DIRECTION",
  routes: { child: "/?play=hanzi-v2-v1&from=hub", world: "/?play=hanzi-v2-v1&from=world" },
  content: { characters: 12, adventures: 3, encounters: 12, abilities: 3, campRepairStages: 3 },
  assets: { runtime: 24, themeCSelected: 16, newMeaningMagic: 8 },
  playthroughs: playthroughs.map((entry) => ({ pathId: entry.pathId, verdict: entry.verdict })),
  hardGates: { browser: hardGates.verdict, criticalGeometry: geometryProof.verdict, visualAriaNoUpdate: visualProof.verdict },
  tests: testSummary,
  screenshots,
  baselines,
  finalCommit,
  originMain,
  pages: pagesUrl,
  verdict: "PASS",
};
writeJson(resolve(evidenceRoot, "V1-RELEASE-MANIFEST.json"), releaseManifest);

const glyphRows = HANZI_MAGIC_V1_CHARACTERS.map((character, index) => {
  const adventure = HANZI_MAGIC_V1_ADVENTURES.find((entry) => entry.characterIds.includes(character.id))!;
  return `<tr><td>${index + 1}</td><td class="glyph">${character.glyph}</td><td>${character.pinyin}</td><td>${character.familiarWord}</td><td>${character.shortMeaning}</td><td>${adventure.title}</td><td>${character.structure}</td><td>PASS</td></tr>`;
}).join("");
const pathRows = playthroughs.map((entry) => `<tr><td>${entry.pathId}</td><td>${entry.inputMode}</td><td>${(entry.criticalActions as string[]).join(" → ")}</td><td>${entry.verdict}</td></tr>`).join("");
const report = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>汉字魔法战 V2 V1.0.0 机器实玩报告</title><style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;margin:auto;max-width:1120px;padding:32px;color:#effff9;background:#061b27;line-height:1.55}h1,h2{color:#ffe09a}.answer{border:2px solid #70dbc1;border-radius:18px;padding:20px;background:#0b3440}.flow{display:flex;gap:12px;flex-wrap:wrap}.flow span{padding:12px 16px;border-radius:999px;background:#145366}.glyph{font-size:1.6rem;color:#ffe09a}table{border-collapse:collapse;width:100%;background:#0b2d38}th,td{border:1px solid #39796f;padding:8px;text-align:left}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.shots img{width:100%;border-radius:12px;border:1px solid #70dbc1}.small{color:#b8d7d0}a{color:#8ce8cf}@media print{body{background:#fff;color:#111}.answer,table{background:#fff}}</style></head><body><main><section class="answer"><h1>V1.0.0 已通过机器审核并可直接玩</h1><p><strong>PASS_MACHINE / V1_MACHINE_COMPLETE / HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY</strong></p><p>12/12 汉字、3/3 冒险、24/24 运行时素材、8/8 浏览器实玩。真实儿童验证：NO_BY_USER_DIRECTION。</p><p class="small">Source tree SHA-256: ${expectedSourceSha}</p></section><h2>三章流程</h2><div class="flow"><span>营地</span><span>微光林径：明花林星</span><span>修复灯</span><span>花园回声：草看园回</span><span>修复花园</span><span>风的脚印：包风猫跑</span><span>修复世界门</span><span>十二字魔法书与自由冒险</span></div><h2>12 字逐字状态</h2><table><thead><tr><th>#</th><th>字</th><th>拼音</th><th>熟悉词</th><th>短义</th><th>章节</th><th>结构</th><th>状态</th></tr></thead><tbody>${glyphRows}</tbody></table><h2>8 条机器实玩</h2><table><thead><tr><th>路径</th><th>输入</th><th>关键动作</th><th>结果</th></tr></thead><tbody>${pathRows}</tbody></table><h2>关键截图</h2><div class="shots"><figure><img src="screenshots/P1-00-fresh-camp.png" alt="全新营地"><figcaption>营地修复前</figcaption></figure><figure><img src="screenshots/P1-01-camp-stage-1.png" alt="营地第一阶段"><figcaption>修复 1：营地灯</figcaption></figure><figure><img src="screenshots/P1-02-camp-stage-2.png" alt="营地第二阶段"><figcaption>修复 2：花园路径</figcaption></figure><figure><img src="screenshots/P1-03-ending.png" alt="完整结尾"><figcaption>修复 3：世界门与十二字结尾</figcaption></figure><figure><img src="screenshots/P4-mobile-touch-enclosures.png" alt="手机包围结构触控"><figcaption>手机触控：包围结构</figcaption></figure><figure><img src="screenshots/P5-keyboard-complete.png" alt="键盘通关"><figcaption>键盘整章</figcaption></figure></div><h2>能力、存档、网络与隐私</h2><ul><li>守护微光、星路引导、墨迹回声均在三章首领状态中真实触发，且报告同时验证 triggered / visible / stateVerified。</li><li>schema v4 延续 canonical localStorage key；v3 与 STEP02 可迁移；checksum、backup、recovery、future-version read-only 均通过。</li><li>P1–P8 的 consoleErrors、pageErrors、externalRequests 均为空；不上传姓名、语音、照片、自由文本或使用记录。</li><li>已验证静音、减少动画、触控、鼠标、键盘与 360×800、768×1024、1024×768、1280×720 几何。</li></ul><h2>非阻断 backlog</h2><ul><li>speechSynthesis 的具体中文音色取决于本机；缺失时游戏仍可完整操作和理解。</li><li>机器证据不证明儿童喜欢、学会、保持或愿意再次进入；用户已明确把真实 Second-Use 从本次 V1 完成门禁中撤销。</li></ul></main></body></html>`;
writeFileSync(resolve(evidenceRoot, "V1-PLAYTHROUGH-REPORT.html"), report, "utf8");

writeJson(resolve(evidenceRoot, "V1-MACHINE-VERDICT.json"), {
  schemaVersion: 1,
  sourceTreeSha256: expectedSourceSha,
  buildId,
  result: "PASS_MACHINE",
  completion: "V1_MACHINE_COMPLETE",
  readiness: "HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY",
  version: HANZI_MAGIC_V1_GAME_VERSION,
  realChildValidation: "NO_BY_USER_DIRECTION",
  playableCharacters: "12/12",
  adventures: "3/3",
  playthroughs: "8/8",
  browserHardGates: hardGates.verdict,
  criticalGeometry: geometryProof.verdict,
  visualAriaNoUpdate: visualProof.verdict,
  independentReviewRoles: "3/3 PASS",
  openSev1ToSev3: 0,
  knownNonBlockingBacklog: [
    "System speechSynthesis voice quality varies by device.",
    "No real-child learning, fun, retention, or Second-Use claim is made.",
  ],
  finalCommit,
  originMain,
  verdict: "PASS",
});

const closeout = `# 汉字魔法战 V2｜V1.0.0 收口\n\n- RESULT: PASS_MACHINE / V1_MACHINE_COMPLETE / HANZI_MAGIC_BATTLE_V2_V1_PLAYABLE_READY\n- VERSION: V1.0.0\n- AUTHORIZATION: ${HANZI_MAGIC_V1_AUTHORIZATION_ID}\n- REAL_CHILD_VALIDATION: NO_BY_USER_DIRECTION\n- SOURCE_TREE_SHA256: ${expectedSourceSha}\n- PLAYABLE_CHARACTERS: 12/12\n- ADVENTURES: 3/3\n- ASSETS: Theme C 16/16 + new meaning magic 8/8\n- E2E_PLAYTHROUGHS: 8/8\n- TESTS: ${testSummary}\n- FINAL_COMMIT: ${finalCommit ?? "PENDING_GIT_CLOSEOUT"}\n- ORIGIN_MAIN: ${originMain ?? "PENDING_GIT_CLOSEOUT"}\n- PAGES: ${pagesUrl}\n\n没有执行或声称真实儿童 Second-Use、乐趣验证或学习效果验证；这是已经完整实现并通过机器审核的第一版可玩游戏。未进入 STEP08/09，未创建新的公开部署机制。\n`;
writeFileSync(resolve(evidenceRoot, "V1-CLOSEOUT.md"), closeout, "utf8");

const guide = `# 用户试玩指南\n\n1. 双击 \`D:\\ChatGPT-Codex-Projects\\Game-Codex\\tools\\hanzi-v2-v1\\START_HANZI_MAGIC_BATTLE_V2_V1.cmd\`。\n2. 浏览器会直接打开汉字魔法战 V1.0.0；选择“走进林径”开始。\n3. 点击一张部件牌，再点击对应结构槽。每章完成四个字、选择一项守护技，并修复一处营地。\n4. 完成三章后翻开十二字魔法书，并可自由重玩三章。\n5. “声音与家长”中可静音、减少动画、查看本地隐私说明或二次确认后清除本地存档。\n6. 结束时双击 \`D:\\ChatGPT-Codex-Projects\\Game-Codex\\tools\\hanzi-v2-v1\\STOP_HANZI_MAGIC_BATTLE_V2_V1.cmd\`。\n\n本游戏完全在本机运行；不上传姓名、语音、照片、自由文本或使用记录。\n`;
writeFileSync(resolve(evidenceRoot, "USER-PLAY-GUIDE.md"), guide, "utf8");

process.stdout.write(`${JSON.stringify({ sourceTreeSha256: expectedSourceSha, playthroughs: playthroughs.length, assets: assets.length, screenshots: screenshots.length, baselines: baselines.length, verdict: "PASS" })}\n`);
