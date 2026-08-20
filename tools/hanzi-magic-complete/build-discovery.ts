import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTER_ONE_CHARACTERS, CHAPTER_ONE_CONTENT_REVISION } from "../../games/hanzi-radical-battle/v2/chapter-one/characters";
import { CANONICAL_WHEEL_LIBRARY } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library";
import { LEGACY_WHEEL_SOURCE } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source";
import { PLAYABLE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUTPUT = resolve(ROOT, "artifacts/hanzi-magic-complete-v3/working");
const ASSET_ROOT = resolve(ROOT, "public/assets/hanzi-radical-battle/v2");
const BASELINE_SHA = "3dcb6076a5f58c6877cfeccb09cda2f2acf83626";
const BASELINE_SOURCE_SHA256 = "7826E9B94B6773398B02C020A717D30F27E0370E6D079F4E76CE89A10247026A";

const SELECTED_NEW_CANDIDATES = [
  { glyph: "指", pinyin: "zhǐ", familiarWord: "指路", shortMeaning: "用手指出方向或东西", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["扌", "旨"] },
  { glyph: "饱", pinyin: "bǎo", familiarWord: "吃饱", shortMeaning: "吃够了，不再觉得饿", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["饣", "包"] },
  { glyph: "情", pinyin: "qíng", familiarWord: "心情", shortMeaning: "心里的感受", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["忄", "青"] },
  { glyph: "请", pinyin: "qǐng", familiarWord: "请问", shortMeaning: "有礼貌地提出请求", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["讠", "青"] },
  { glyph: "路", pinyin: "lù", familiarWord: "道路", shortMeaning: "供人们走过的地方", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["⻊", "各"] },
  { glyph: "进", pinyin: "jìn", familiarWord: "前进", shortMeaning: "向里面或向前走", chapter: "chapter-two", band: "story-required", structure: "semi-enclosure", orderedComponents: ["辶", "井"] },
  { glyph: "迷", pinyin: "mí", familiarWord: "迷路", shortMeaning: "找不到正确的方向", chapter: "chapter-two", band: "story-required", structure: "semi-enclosure", orderedComponents: ["辶", "米"] },
  { glyph: "思", pinyin: "sī", familiarWord: "思考", shortMeaning: "在心里认真地想", chapter: "chapter-two", band: "story-required", structure: "top-bottom", orderedComponents: ["田", "心"] },
  { glyph: "语", pinyin: "yǔ", familiarWord: "语言", shortMeaning: "人们表达意思时所用的话", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["讠", "吾"] },
  { glyph: "饭", pinyin: "fàn", familiarWord: "米饭", shortMeaning: "做熟的谷物或一顿食物", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["饣", "反"] },
  { glyph: "钟", pinyin: "zhōng", familiarWord: "时钟", shortMeaning: "用来表示时间的器物", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["钅", "中"] },
  { glyph: "钱", pinyin: "qián", familiarWord: "钱包", shortMeaning: "买东西时使用的钱", chapter: "chapter-two", band: "story-required", structure: "left-right", orderedComponents: ["钅", "戋"] },
  { glyph: "初", pinyin: "chū", familiarWord: "最初", shortMeaning: "刚开始的时候", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["衤", "刀"] },
  { glyph: "被", pinyin: "bèi", familiarWord: "被子", shortMeaning: "睡觉时盖在身上的东西", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["衤", "皮"] },
  { glyph: "祝", pinyin: "zhù", familiarWord: "祝福", shortMeaning: "希望别人平安美好", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["礻", "兄"] },
  { glyph: "神", pinyin: "shén", familiarWord: "神话", shortMeaning: "传说中有神奇力量的人物或事物", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["礻", "申"] },
  { glyph: "跳", pinyin: "tiào", familiarWord: "跳高", shortMeaning: "双脚用力离开地面的动作", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["⻊", "兆"] },
  { glyph: "们", pinyin: "men", familiarWord: "他们", shortMeaning: "放在人称后表示不止一个", chapter: "chapter-two", band: "optional", structure: "left-right", orderedComponents: ["亻", "门"] },
  { glyph: "空", pinyin: "kōng", familiarWord: "天空", shortMeaning: "地面上方广阔的地方", chapter: "chapter-three", band: "story-required", structure: "top-bottom", orderedComponents: ["穴", "工"] },
  { glyph: "静", pinyin: "jìng", familiarWord: "安静", shortMeaning: "没有嘈杂声音，很平稳", chapter: "chapter-three", band: "story-required", structure: "left-right", orderedComponents: ["青", "争"] },
  { glyph: "睛", pinyin: "jīng", familiarWord: "眼睛", shortMeaning: "看见事物的身体部位", chapter: "chapter-three", band: "story-required", structure: "left-right", orderedComponents: ["目", "青"] },
  { glyph: "庭", pinyin: "tíng", familiarWord: "家庭", shortMeaning: "家里共同生活的人们", chapter: "chapter-three", band: "story-required", structure: "semi-enclosure", orderedComponents: ["广", "廷"] },
  { glyph: "歌", pinyin: "gē", familiarWord: "唱歌", shortMeaning: "可以唱出来的曲调和词", chapter: "chapter-three", band: "story-required", structure: "left-right", orderedComponents: ["哥", "欠"] },
  { glyph: "响", pinyin: "xiǎng", familiarWord: "声响", shortMeaning: "耳朵能听见的声音", chapter: "chapter-three", band: "story-required", structure: "left-right", orderedComponents: ["口", "向"] },
  { glyph: "香", pinyin: "xiāng", familiarWord: "花香", shortMeaning: "闻起来让人舒服的气味", chapter: "chapter-three", band: "story-required", structure: "top-bottom", orderedComponents: ["禾", "日"] },
  { glyph: "间", pinyin: "jiān", familiarWord: "中间", shortMeaning: "两个地方或时候之间", chapter: "chapter-three", band: "story-required", structure: "semi-enclosure", orderedComponents: ["门", "日"] },
  { glyph: "围", pinyin: "wéi", familiarWord: "包围", shortMeaning: "从四周环绕起来", chapter: "chapter-three", band: "story-required", structure: "full-enclosure", orderedComponents: ["囗", "韦"] },
  { glyph: "道", pinyin: "dào", familiarWord: "道路", shortMeaning: "供人们通行的路线", chapter: "chapter-three", band: "story-required", structure: "semi-enclosure", orderedComponents: ["辶", "首"] },
  { glyph: "眼", pinyin: "yǎn", familiarWord: "眼睛", shortMeaning: "用来看见事物的身体部位", chapter: "chapter-three", band: "story-required", structure: "left-right", orderedComponents: ["目", "艮"] },
  { glyph: "圈", pinyin: "quān", familiarWord: "圆圈", shortMeaning: "环绕一周形成的圆形", chapter: "chapter-three", band: "story-required", structure: "full-enclosure", orderedComponents: ["囗", "卷"] },
  { glyph: "江", pinyin: "jiāng", familiarWord: "江河", shortMeaning: "水量较大的河流", chapter: "chapter-three", band: "optional", structure: "left-right", orderedComponents: ["氵", "工"] },
  { glyph: "洁", pinyin: "jié", familiarWord: "清洁", shortMeaning: "干净，没有脏东西", chapter: "chapter-three", band: "optional", structure: "left-right", orderedComponents: ["氵", "吉"] },
  { glyph: "树", pinyin: "shù", familiarWord: "树木", shortMeaning: "有木质树干的植物", chapter: "chapter-three", band: "optional", structure: "left-right", orderedComponents: ["木", "对"] },
  { glyph: "景", pinyin: "jǐng", familiarWord: "风景", shortMeaning: "看到的自然或城市景象", chapter: "chapter-three", band: "optional", structure: "top-bottom", orderedComponents: ["日", "京"] },
  { glyph: "晨", pinyin: "chén", familiarWord: "清晨", shortMeaning: "太阳刚升起的早上", chapter: "chapter-three", band: "optional", structure: "top-bottom", orderedComponents: ["日", "辰"] },
  { glyph: "答", pinyin: "dá", familiarWord: "回答", shortMeaning: "对问题作出回应", chapter: "chapter-three", band: "optional", structure: "top-bottom", orderedComponents: ["⺮", "合"] },
] as const;

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(resolve(OUTPUT, name), stableJson(value), "utf8");
}

function requireContract(condition: boolean, message: string): void {
  if (!condition) throw new Error(`DISCOVERY_CONTRACT_FAILED: ${message}`);
}

function listFiles(root: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(path));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}

function imageDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length < 30 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  const kind = bytes.subarray(12, 16).toString("ascii");
  if (kind === "VP8X") {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  if (kind === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  const marker = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
  if (marker >= 0 && marker + 7 <= bytes.length) {
    return { width: bytes.readUInt16LE(marker + 3) & 0x3fff, height: bytes.readUInt16LE(marker + 5) & 0x3fff };
  }
  return null;
}

mkdirSync(OUTPUT, { recursive: true });

const chapterGlyphs = CHAPTER_ONE_CHARACTERS.map((record) => record.glyph);
const wheelGlyphs = PLAYABLE_WHEEL_MANIFEST.map((record) => record.glyph);
const chapterSet = new Set(chapterGlyphs);
const wheelSet = new Set(wheelGlyphs);
const rawCharRecords = LEGACY_WHEEL_SOURCE.flatMap((set) => set.char.validPairs);
const rawGlyphs = [...new Set(rawCharRecords.map((record) => record.result))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
const overlapGlyphs = [...chapterSet].filter((glyph) => wheelSet.has(glyph)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
const wheelOnlyGlyphs = [...wheelSet].filter((glyph) => !chapterSet.has(glyph)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
const readingGroups = new Map<string, string[]>();
for (const record of rawCharRecords) {
  const key = `${record.result}:${record.pinyin}`;
  readingGroups.set(key, [...(readingGroups.get(key) ?? []), record.legacyId]);
}

const contentIdentity = {
  schemaVersion: 1,
  taskId: "GAME-CODEX-HANZI-MAGIC-COMPLETE-V3-REVISED-ONE-SHOT",
  actualBaseline: BASELINE_SHA,
  chapterOne: {
    count: chapterGlyphs.length,
    uniqueGlyphCount: chapterSet.size,
    glyphs: chapterGlyphs,
    contentRevision: CHAPTER_ONE_CONTENT_REVISION,
  },
  wheelPlayable: {
    count: wheelGlyphs.length,
    uniqueGlyphCount: wheelSet.size,
    glyphs: wheelGlyphs,
  },
  overlap: { count: overlapGlyphs.length, glyphs: overlapGlyphs },
  wheelOnly: { count: wheelOnlyGlyphs.length, glyphs: wheelOnlyGlyphs },
  union: { uniqueGlyphCount: new Set([...chapterGlyphs, ...wheelGlyphs]).size },
  rawWheelCharacters: { recordCount: rawCharRecords.length, uniqueGlyphCount: rawGlyphs.length, glyphs: rawGlyphs },
  duplicateReadingSenses: [...readingGroups]
    .filter(([, ids]) => ids.length > 1)
    .map(([readingSense, legacyIds]) => ({ readingSense, legacyIds })),
  immutableSources: {
    wheelStableJsonSha256: "0e47b5d434cff65c9af1a65fad1dcd5a4f6432bf218223213083a43a54af64ac",
    makeMeAHanziCommit: "bddc96d41bef78427ed0e034e9f7e31d71fd1b92",
    unihanVersion: "17.0.0",
    unihanZipSha256: "F7A48B2B545ACFAA77B2D607AE28747404CE02BAEFEE16396C5D2D7A8EF34B5E",
  },
};
writeJson("CURRENT_CONTENT_IDENTITY.json", contentIdentity);

const sourceText = listFiles(resolve(ROOT, "games/hanzi-radical-battle/v2"))
  .filter((path) => [".ts", ".css", ".json"].includes(extname(path)))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const assetEntries = listFiles(ASSET_ROOT).map((path) => {
  const bytes = readFileSync(path);
  const relativePath = relative(ROOT, path).replaceAll("\\", "/");
  const basename = relativePath.split("/").at(-1)!;
  const hash = sha256(bytes);
  const dimensions = imageDimensions(bytes);
  return {
    path: relativePath,
    bytes: statSync(path).size,
    sha256: hash,
    dimensions,
    runtimeReferenceCount: sourceText.split(basename).length - 1,
    runtimeUse: sourceText.includes(basename),
    crop: "runtime-controlled",
    loadTiming: relativePath.includes("/chapter-one/") ? "chapter-one-conditional" : "legacy-or-shared",
  };
});
const assetHashGroups = new Map<string, string[]>();
for (const entry of assetEntries) {
  assetHashGroups.set(entry.sha256, [...(assetHashGroups.get(entry.sha256) ?? []), entry.path]);
}
const duplicateAssets = [...assetHashGroups]
  .filter(([, paths]) => paths.length > 1)
  .map(([hash, paths]) => ({ sha256: hash, paths }));
writeJson("ASSET_INVENTORY.json", {
  schemaVersion: 1,
  root: "public/assets/hanzi-radical-battle/v2",
  count: assetEntries.length,
  bytes: assetEntries.reduce((sum, entry) => sum + entry.bytes, 0),
  duplicateHashes: duplicateAssets,
  files: assetEntries,
});

writeJson("DEPENDENCY_GRAPH.json", {
  schemaVersion: 1,
  routes: {
    registry: "src/app-route.ts",
    dispatcher: "src/main.ts",
    precedence: ["hanzi-magic-complete", "hanzi-v2-chapter-one", "hanzi-v2-v1", "classic-hub", "world"],
    legacyRoutes: ["?play=hanzi-v2-chapter-one", "?play=hanzi-v2-v1"],
    targetRoute: "?play=hanzi-magic-complete&from=hub",
  },
  chapterOne: {
    manifest: "games/hanzi-radical-battle/v2/chapter-one/characters.ts",
    reducer: "games/hanzi-radical-battle/v2/chapter-one/m3-machine.ts",
    ui: "games/hanzi-radical-battle/v2/chapter-one/m3-app.ts",
    save: "games/hanzi-radical-battle/v2/chapter-one/m4-save.ts",
    saveKey: "family-games/hanzi-magic-v2/chapter-one/save-v5",
  },
  wheel: {
    raw: "games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source.ts",
    freeze: "games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json",
    audit: "games/hanzi-radical-battle/v2/wheel-workshop/library/canonical-wheel-library.ts",
    playable: "games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest.ts",
    save: "games/hanzi-radical-battle/v2/wheel-workshop/save/wheel-save.ts",
    saveKey: "family-games/hanzi-magic-v2/wheel-workshop/v1",
  },
  v1: {
    entry: "games/hanzi-radical-battle/v2/v1/index.ts",
    save: "games/hanzi-radical-battle/v2/v1/save.ts",
  },
  assets: {
    manifest: "games/hanzi-radical-battle/v2/chapter-one/m5-assets.ts",
    runtimeRoot: "public/assets/hanzi-radical-battle/v2",
  },
  visualBaselines: ["tests/hanzi-v2/baselines/chapter-one", "tests/hanzi-v2/baselines/v1"],
  launcher: "tools/hanzi-v2-chapter-one",
  pagesVerifier: "tools/hanzi-v2-chapter-one/verify-pages.ts",
  packageScripts: ["test:hanzi-v2", "simulate:hanzi-v2", "simulate:hanzi-v2:wheel", "test:e2e:hanzi-v2", "test:e2e:hanzi-v2:v1", "test:visual:hanzi-v2", "test:geometry:hanzi-v2", "test:visual:hanzi-v2:v1", "test:launcher:hanzi-v2", "build"],
  retention: {
    protected: ["artifacts/hanzi-radical-battle-v2/v2-chapter-one", "games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source-freeze.json", "handoffs/GAME_CODEX_HANZI_WHEEL_TO_V2_RETURN_TO_CHATGPT.zip"],
    transient: ["dist", "test-results", "playwright-report", "tmp"],
  },
});

const charterWithoutHash = {
  schemaVersion: 1,
  mode: "DISCOVERY_MODE",
  authorization: "complete V3 autonomously through machine acceptance, Git, tag, Pages, package and cleanup",
  actualBaseline: {
    expectedAtPlanning: BASELINE_SHA,
    head: BASELINE_SHA,
    main: BASELINE_SHA,
    originMain: BASELINE_SHA,
    branch: "main",
    preMutationSourceTreeSha256: BASELINE_SOURCE_SHA256,
    preExistingUntracked: ["handoffs/"],
    v1TagCommit: "43e7841d2190922b6048182cab4b871c55715840",
    v2TagCommit: "85c0b37179271eb98697befb418d319d6579b5dd",
    frozenV2ReleaseSha256: "8503D6BF1BF39D33B00E1671702C26B987CBB941C7176B2852A3B0A2A37036AE",
    protectedHandoffSha256: "408D4E15814A8E42C874265620AC428012A7553E4E98562204BBAE5D2290E249",
  },
  baselineEvidence: {
    commands: ["audit:hanzi-v2:wheel", "test:hanzi-v2", "simulate:hanzi-v2", "simulate:hanzi-v2:wheel", "test:e2e:hanzi-v2", "test:e2e:hanzi-v2:v1", "test:visual:hanzi-v2", "test:geometry:hanzi-v2", "test:visual:hanzi-v2:v1", "test:launcher:hanzi-v2", "build"],
    result: "PASS",
    unitTests: 71,
    mainSimulationSeeds: 90000,
    wheelSimulationSeeds: 10000,
    v2E2E: { passed: 32, expectedSkipped: 30 },
    v1E2EPassed: 8,
    performanceProbe: {
      viewport: "1366x768",
      firstInteractiveMs: 1059,
      requestCount: 65,
      transferBytes: 2535841,
      encodedBodyBytes: 2516641,
      jsTransferBytes: 2113971,
      fps: 60.7,
      usedJSHeapSize: 10000000,
      canvasCount: 0,
      externalRequests: 0,
      consoleOrPageErrors: 0,
      horizontalOverflow: false,
    },
  },
  targetContracts: {
    product: "汉字魔法战 · 墨迹森林完整篇：字光归林",
    version: "V3.0.0",
    route: "?play=hanzi-magic-complete&from=hub",
    chapters: 3,
    epilogue: true,
    coreUniqueCharacters: 72,
    existingCharacters: 36,
    genuinelyNewCharacters: 36,
    newStoryRequired: 24,
    newOptional: 12,
    componentFamilies: 18,
    wordResonances: 36,
    heroes: 3,
    selectableAbilities: 24,
    innateAbilities: 3,
    monsterBehaviors: 15,
    regularRegions: 9,
    cores: 3,
    bosses: 12,
    repairs: 16,
    spellbook: 72,
    postgameModes: 3,
    storyArchive: true,
    wheelPlayableMinimum: 72,
  },
  contentSelection: {
    candidatePoolMinimum: 120,
    selectedNewGlyphsMustExcludeChapterOne: true,
    canonicalGlyphUniqueness: true,
    wheelOverlapIsProvenanceNotSecondDiscovery: true,
    broadCandidatesStaySeparateFromPlayable: true,
    selectedNewGlyphs: SELECTED_NEW_CANDIDATES.map((record) => record.glyph),
    wheelPlayableDecision: {
      selectedTarget: 72,
      conditionalMaximum: 108,
      reason: "The 72-record target reaches eight reviewed records in every legacy p1-j3 band. Additional records stay candidate-only until their child-facing meanings, fixed readings, familiarity, and unique hands receive the same review; the conditional 108 target is not claimed as passed.",
    },
  },
  legacyContracts: ["V1 route/save", "V2 route/save", "36 Chapter One characters", "3 heroes", "18 selectable and 3 innate abilities", "9 behaviors", "4 bosses", "8 repairs", "wheel raw 270 and hash", "wheel playable 36", "existing visual baselines", "existing tags and frozen release"],
  saveKeys: {
    target: "family-games/hanzi-magic-complete/v3",
    chapterOne: "family-games/hanzi-magic-v2/chapter-one/save-v5",
    wheel: "family-games/hanzi-magic-v2/wheel-workshop/v1",
  },
  budgets: {
    newRuntimeBinaryTargetBytes: 32 * 1024 * 1024,
    newRuntimeBinaryHardMaxBytes: 40 * 1024 * 1024,
    allHanziRuntimeTargetBytes: 64 * 1024 * 1024,
    ordinaryRasterTargetBytes: 1 * 1024 * 1024,
    largeSceneHardMaxBytes: 4 * 1024 * 1024,
    saveHardMaxBytes: 500 * 1024,
    firstInteractiveTransferMaxRatioVsV2: 1.2,
  },
  verticalSliceGates: ["Slice A family loop PASS_MACHINE", "Slice B word loop PASS_MACHINE", "shared raw evidence", "four independent reviewers reconciled", "pointer/keyboard/touch", "reduced motion", "mobile/desktop", "save/resume", "representative art/audio"],
  semanticReviewers: ["R1_CHILD_FIRST_GAME_DESIGN", "R2_HANZI_CONTENT_AND_PEDAGOGY", "R3_VISUAL_ACCESSIBILITY", "R4_ADVERSARIAL_RUNTIME_QA"],
  releaseConditions: ["final same-tree PASS_MACHINE", "legacy exact pass", "zero Sev-1/2/3", "zero content-correctness or child-usability Sev-4", "two V3 no-update rounds", "main equals origin/main", "V3 tag", "exact Pages commit", "verified return ZIP and SHA"],
  cleanupClasses: {
    canonical: ["runtime", "tests", "V3 baselines", "canonical docs", "final report", "final ZIP and SHA"],
    protected: ["V1/V2 source and releases", "wheel raw/freeze/audit", "pre-existing handoff"],
    transient: ["dist", "test-results", "playwright-report", "tmp", "raw retries", "debug assets", "M0-M7 raw working evidence"],
  },
  allowedDependencyClosure: ["games/hanzi-radical-battle/complete/**", "docs/hanzi-radical-battle-v3/**", "tests/hanzi-complete/**", "tests/e2e/hanzi-complete/**", "tools/hanzi-magic-complete/**", "public/assets/hanzi-radical-battle/complete/**", "src/app-route.ts", "src/main.ts", "apps/my-game-world/**", "packages/data/gameCatalog.ts", "games/hanzi-radical-battle/index.ts", "package.json", "playwright.hanzi-complete.config.ts", "task-scoped artifacts and final handoff"],
  trueBlockers: ["credentials or external permissions denied", "GitHub push or Pages denial", "36 valid new glyphs impossible after legal replacement", "unavoidable legacy conflict with independent critical reviewer disagreement", "hard gates permanently unavailable after diagnosed alternatives"],
  repairRule: "record finding, classify root cause, apply smallest in-scope repair, rerun affected dependency gates and all affected semantic reviewers; never weaken gates or update baselines to manufacture a pass",
  humanEvidenceBoundary: "REAL_CHILD_VALIDATION NOT_PERFORMED_AND_NOT_CLAIMED",
};
const charterPayload = stableJson(charterWithoutHash);
writeJson("CLOSURE_CHARTER.json", { ...charterWithoutHash, charterSha256: sha256(charterPayload) });

const selectedCandidateByGlyph = new Map(SELECTED_NEW_CANDIDATES.map((record) => [record.glyph, record]));
const wheelCandidates = CANONICAL_WHEEL_LIBRARY
  .filter((record) => record.sourceMode === "char")
  .map((record) => ({
    id: `candidate-${record.legacyId.replaceAll(".", "-")}`,
    glyph: record.result,
    pinyin: record.pinyin,
    familiarWords: record.familiarWords,
    structure: record.structure,
    orderedComponents: record.orderedComponents,
    auditStatus: record.auditStatus,
    excludedByChapterOne: chapterSet.has(record.result),
    currentWheelPlayable: wheelSet.has(record.result),
    sourceLegacyId: record.legacyId,
    selectedForV3: selectedCandidateByGlyph.has(record.result),
    selection: selectedCandidateByGlyph.get(record.result) ?? null,
  }));
const wheelCandidateGlyphs = new Set(wheelCandidates.map((record) => record.glyph));
const supplementalCandidates = SELECTED_NEW_CANDIDATES
  .filter((record) => !wheelCandidateGlyphs.has(record.glyph))
  .map((record) => ({
    id: `candidate-v3-${record.glyph.codePointAt(0)!.toString(16)}`,
    glyph: record.glyph,
    pinyin: record.pinyin,
    familiarWords: [record.familiarWord],
    structure: record.structure,
    orderedComponents: record.orderedComponents,
    auditStatus: "pending-structure-and-reading-crosscheck",
    excludedByChapterOne: chapterSet.has(record.glyph),
    currentWheelPlayable: wheelSet.has(record.glyph),
    sourceLegacyId: null,
    selectedForV3: true,
    selection: record,
  }));
const candidatePool = [...wheelCandidates, ...supplementalCandidates];
const selectedCandidates = candidatePool.filter((record) => record.selectedForV3);
requireContract(chapterSet.size === 36, `expected 36 Chapter One glyphs, received ${chapterSet.size}`);
requireContract(wheelSet.size === 36, `expected 36 current wheel glyphs, received ${wheelSet.size}`);
requireContract(rawCharRecords.length === 162, `expected 162 immutable raw character records, received ${rawCharRecords.length}`);
requireContract(candidatePool.length >= 120, `candidate pool only contains ${candidatePool.length} records`);
requireContract(selectedCandidates.length === 36, `expected 36 selected candidates, received ${selectedCandidates.length}`);
requireContract(new Set(selectedCandidates.map((record) => record.glyph)).size === 36, "selected candidates are not unique glyphs");
requireContract(selectedCandidates.every((record) => !record.excludedByChapterOne), "selected candidates overlap Chapter One");
requireContract(SELECTED_NEW_CANDIDATES.filter((record) => record.chapter === "chapter-two").length === 18, "Chapter Two selection is not 18 glyphs");
requireContract(SELECTED_NEW_CANDIDATES.filter((record) => record.chapter === "chapter-three").length === 18, "Chapter Three selection is not 18 glyphs");
requireContract(SELECTED_NEW_CANDIDATES.filter((record) => record.band === "story-required").length === 24, "story-required selection is not 24 glyphs");
requireContract(SELECTED_NEW_CANDIDATES.filter((record) => record.band === "optional").length === 12, "optional selection is not 12 glyphs");
writeJson("CANDIDATE_POOL.json", {
  schemaVersion: 1,
  minimumRequired: 120,
  count: candidatePool.length,
  approvedCount: candidatePool.filter((record) => record.auditStatus === "validated" || record.auditStatus === "corrected-derived-record").length,
  selectedCount: selectedCandidates.length,
  selectedGlyphs: selectedCandidates.map((record) => record.glyph),
  records: candidatePool,
});

process.stdout.write(stableJson({
  result: "PASS",
  output: relative(ROOT, OUTPUT).replaceAll("\\", "/"),
  chapterOne: chapterSet.size,
  wheelPlayable: wheelSet.size,
  overlap: overlapGlyphs.length,
  union: new Set([...chapterGlyphs, ...wheelGlyphs]).size,
  candidatePool: candidatePool.length,
  selectedCandidates: selectedCandidates.length,
  assets: assetEntries.length,
}));
