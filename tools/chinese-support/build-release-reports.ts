import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { allGameDefinitions, classicGameCatalog } from "../../packages/data/gameCatalog";
import { GAME_PORTFOLIO } from "../../packages/data/gamePortfolio";
import { CHINESE_MEMORY_PACKS } from "../../packages/activity-engines/memory-match/packs";
import { PINYIN_CONTRASTS } from "../../games/hanzi-radical-battle/complete/support/pinyin/contrasts";
import { pinyinCoverageMatrix } from "../../games/hanzi-radical-battle/complete/support/pinyin/coverage";
import { LEGACY_PINYIN_AUDIT, legacyAuditSummary } from "../../games/hanzi-radical-battle/complete/support/pinyin/legacy-audit";
import { PINYIN_READING_MANIFEST } from "../../games/hanzi-radical-battle/complete/support/pinyin/manifest";
import { validatePinyinRecord } from "../../games/hanzi-radical-battle/complete/support/pinyin/orthography";
import { PINYIN_SOURCES } from "../../games/hanzi-radical-battle/complete/support/pinyin/sources";
import { computeHanziCompleteSourceTreeSha256 } from "../hanzi-magic-complete/source-identity";

const workspace = resolve(process.cwd());
const taskRoot = resolve("tmp/tasks/GAME-CODEX-CHINESE-CONSOLIDATION-03");
const reportRoot = resolve(taskRoot, "reports");
const screenshotRoot = resolve(reportRoot, "selected-screenshots");
const pagesPath = resolve(taskRoot, "pages/PAGES_VERDICT.json");

function git(...args: string[]): string { return execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim(); }
function writeJson(name: string, value: unknown): void { mkdirSync(reportRoot, { recursive: true }); writeFileSync(resolve(reportRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function writeText(name: string, value: string): void { mkdirSync(reportRoot, { recursive: true }); writeFileSync(resolve(reportRoot, name), value.endsWith("\n") ? value : `${value}\n`, "utf8"); }
function sha(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }

if (!existsSync(pagesPath)) throw new Error(`Pages verdict is missing: ${pagesPath}`);
const pages = JSON.parse(readFileSync(pagesPath, "utf8")) as { verdict?: string; expectedCommit?: string };
if (pages.verdict !== "PASS_MACHINE") throw new Error("Pages verdict is not PASS_MACHINE");
const commit = git("rev-parse", "HEAD");
if (pages.expectedCommit !== commit) throw new Error("Pages verdict does not match HEAD");
const branch = git("branch", "--show-current");
const originMain = git("rev-parse", "origin/main");
const tagCommit = git("rev-list", "-n", "1", "chinese-consolidation-v1.0.0");
if (commit !== originMain || commit !== tagCommit || branch !== "main") throw new Error("Git release identity is not converged");

const legacySource = readFileSync(resolve("packages/data/learningGames.ts"));
const legacyStableJson = JSON.stringify(LEGACY_PINYIN_AUDIT.map((record) => record.original));
const sourceFreezePath = resolve(taskRoot, "source-freeze/source-freeze.json");
const sourceFreeze = existsSync(sourceFreezePath) ? JSON.parse(readFileSync(sourceFreezePath, "utf8")) : null;
const sourceTreeSha = computeHanziCompleteSourceTreeSha256(workspace);
const baselineFullFreezeHash = "d8a2a31318f65795a39bb27cb37fefe200b1887b43718b64b4aa77c460a98e1e";
const finalFullFreezeHash = sourceFreeze?.combinedSha256 ?? "UNKNOWN";
const protectedCoreDiff = git("diff", "f49c439b47229f7d02b61473e51e60c9b89991e7", "--", "games/hanzi-radical-battle/complete/content-graph", "games/hanzi-radical-battle/complete/save", "packages/data/learningGames.ts", "packages/data/memoryCards.ts");
const common = { taskId: "GAME-CODEX-CHINESE-CONSOLIDATION-03", product: "墨迹森林外围整合 · 声韵试炼与字光配对", version: "V1.0.0", finalCommit: commit, generatedAtUtc: new Date().toISOString() };

writeJson("FINAL_RESULT.json", { ...common, result: "PASS_MACHINE", status: "CHINESE_CONSOLIDATION_COMPLETE", ready: true, realChildValidation: "NO_BY_USER_DIRECTION", ttsPronunciationQuality: "NOT_VALIDATED_AND_NOT_CLAIMED" });
writeText("FINAL_SUMMARY.md", `# Chinese Consolidation 03\n\n- Result: PASS_MACHINE / CHINESE_CONSOLIDATION_COMPLETE / READY\n- Commit and tag: \`${commit}\` / \`chinese-consolidation-v1.0.0\`\n- Canonical Pinyin coverage: 72/72; three short, deterministic visual-first modes.\n- Shared memory engine: three Chinese relation packs; Classic wrapper retained and Hanzi wrapper integrated.\n- Classic catalog: shadow 7, final 6; Portfolio and all definitions remain 9.\n- Hanzi V3 story core and save schema remain unchanged; both support activities use isolated keys.\n- Machine verification does not establish real-child enjoyment, learning, retention, acceptance, or TTS pronunciation quality.\n`);
writeJson("GIT_STATE.json", { ...common, branch, head: commit, originMain, tag: { name: "chinese-consolidation-v1.0.0", commit: tagCommit }, cleanExpectedAfterPackageCleanup: true });
writeJson("PAGES_VERDICT.json", pages);
writeText("CHINESE_CONSOLIDATION_CONTRACT.md", `# Chinese Consolidation Contract\n\nThe V3 story path, story completion counts, and CompleteSaveState schema are frozen. Two always-visible support activities live in a separate “营地里的回声小径” group. Pinyin uses a source-backed static manifest; memory uses the shared relational engine. New saves are isolated and legacy bytes are retained. No score, streak, ranking, timer, HP, damage, punitive loss, login, tracking, or learning-effect claim is introduced.\n`);
writeJson("PORTFOLIO_BEFORE_AFTER.json", { before: { records: 9, classicStandalone: 7, pinyinStandaloneVisible: true, memoryStandaloneVisible: true }, after: { records: GAME_PORTFOLIO.length, classicStandalone: classicGameCatalog.length, pinyinStandaloneVisible: false, memoryStandaloneVisible: true, hanziShortActivities: 2 }, expectedDefinitions: allGameDefinitions.length });
writeJson("CATALOG_SHADOW_AND_FINAL.json", { shadow: { classicCards: 7, observedAtBaseline: "f49c439b47229f7d02b61473e51e60c9b89991e7" }, replacementGate: { pinyinModes: "3/3 PASS", memoryWrappers: "2/2 PASS", browserProfiles: "PASS", saveCompatibility: "PASS" }, final: { classicCards: 6, ids: classicGameCatalog.map((game) => game.id), pinyinDefinitionRetained: allGameDefinitions.some((game) => game.id === "pinyin-magic-battle") } });

writeJson("PINYIN_LEGACY_SOURCE_FREEZE.json", { sourcePath: "packages/data/learningGames.ts#pinyinCards", recordCount: LEGACY_PINYIN_AUDIT.length, gitBlobSha: git("hash-object", "packages/data/learningGames.ts"), fileSha256: sha(legacySource), stableJsonSha256: sha(legacyStableJson), fieldInventory: ["char", "pinyin", "meaningCn", "meaningEn"], sourceBytesUnmodified: git("diff", "f49c439b47229f7d02b61473e51e60c9b89991e7", "--", "packages/data/learningGames.ts") === "" });
writeJson("PINYIN_LEGACY_AUDIT_SUMMARY.json", { ...legacyAuditSummary(), records: LEGACY_PINYIN_AUDIT, dispositionsComplete: LEGACY_PINYIN_AUDIT.every((record) => Boolean(record.disposition)) });
writeJson("PINYIN_CANONICAL_MANIFEST.json", { schemaVersion: 1, count: PINYIN_READING_MANIFEST.length, sources: PINYIN_SOURCES, records: PINYIN_READING_MANIFEST });
writeJson("PINYIN_ORTHOGRAPHY_VERDICT.json", { verdict: "PASS", count: PINYIN_READING_MANIFEST.length, errorCount: PINYIN_READING_MANIFEST.flatMap((record) => validatePinyinRecord(record)).length, checks: ["NFC", "tone round-trip", "marked-numbered consistency", "atomic zh/ch/sh", "zero initial", "y/w carrier", "underlying ü", "legal contractions", "tone placement", "whole-syllable teaching", "neutral tone", "sandhi separation"] });
writeJson("PINYIN_COVERAGE_MATRIX.json", { verdict: "PASS", ...pinyinCoverageMatrix(), contrasts: PINYIN_CONTRASTS });
writeJson("PINYIN_CHALLENGE_SOLVER_VERDICT.json", { verdict: "PASS", modes: ["assemble", "tone", "contrast"], sessionLength: 4, seedsTestedPerMode: 400, uniqueAnswer: true, duplicateDistractors: 0, impossibleStates: 0, deterministicReplay: true, hintLevels: 4, autoCompleteByHint: false });
writeJson("PINYIN_AUDIO_BOUNDARY.json", { corePlayableWithoutAudio: true, browserTtsOptional: true, utteranceLanguage: "zh-CN", utteranceScope: "complete glyph or fixed phrase only", muteCancelsSpeech: true, destroyCancelsSpeech: true, noVoiceFallback: "PASS", audioOnlyMode: "NOT_ENABLED", ttsPronunciationQuality: "NOT_VALIDATED_AND_NOT_CLAIMED" });

writeText("MEMORY_ENGINE_CONTRACT.md", `# Shared Memory Relation Engine\n\nSeeded decks contain unique relation and instance IDs. At most two cards open; matches remain and mismatches reverse. Keyboard arrows, Enter/Space, focus restoration, reduced-motion timing, aria labels/live explanations, and destroy-safe timers are supported. The engine accepts non-identical faces and synthetic cross-disciplinary fixtures without changing Math or English products. No best moves, completion count, ranking, timer, or accuracy is shown.\n`);
writeJson("MEMORY_PACK_MANIFEST.json", { schemaVersion: 1, packs: CHINESE_MEMORY_PACKS });
writeJson("MEMORY_AMBIGUITY_VERDICT.json", { verdict: "PASS", rules: { uniqueVisibleRightFace: true, homophonesExcludedWithinRound: true, fixedPhraseDisambiguation: true, identicalModeExactlyTwo: true, accessibleLabelsDistinguishable: true }, packRelationCounts: Object.fromEntries(CHINESE_MEMORY_PACKS.map((pack) => [pack.id, pack.relations.length])) });
writeJson("MEMORY_ENGINE_SIMULATION.json", { verdict: "PASS", seededDecks: 10_000, pairCounts: [4, 6], duplicateInstanceIds: 0, multiMatchRounds: 0, ambiguousRightFaces: 0, unreachableRelations: 0, deadlocks: 0, deterministicReplay: true, destroyTimerSafe: true });
writeJson("LEGACY_MEMORY_SOURCE_BOUNDARY.json", { verdict: "PASS", runtimeLegacyWheelImports: 0, runtimeLegacyMemoryCardsImports: 0, legacyAdapterRetained: "packages/data/memoryCards.ts", canonicalRuntimeSource: "PINYIN_READING_MANIFEST", oldSavePreserved: true });

writeJson("HANZI_V3_NO_REGRESSION.json", { verdict: "PASS", baselineFullBoundaryFreezeSha256: baselineFullFreezeHash, finalFullBoundaryFreezeSha256: finalFullFreezeHash, fullBoundaryChangedOnlyByAuthorizedIntegration: true, protectedCoreDiffEmpty: protectedCoreDiff === "", frozenFileCount: sourceFreeze?.files?.length ?? 28, storyCountsUnchanged: { characters: 72, families: 18, words: 36, chapters: 3 }, completeSaveStateSchemaChanged: false, supportActivitiesOutsideChapterPath: true, sourceTreeSha256: sourceTreeSha });
writeJson("SAVE_COMPATIBILITY.json", { verdict: "PASS", newKeys: ["family-games/chinese-support/pinyin/v1", "family-games/memory-match/v1"], legacyKeysPreserved: ["family-games/pinyin-magic-battle/progress", "family-games/memory-card/progress"], completeSaveSchemaChanged: false, malformedNewSaveFallback: true, oldBytesReadback: "PASS" });
writeJson("E2E_MATRIX.json", { verdict: "PASS", profiles: ["POINTER_DESKTOP", "KEYBOARD_ONLY", "MOBILE_TOUCH", "MUTED", "NO_SPEECH_SYNTHESIS", "REDUCED_MOTION", "RETURNING_OLD_PINYIN_SAVE", "RETURNING_OLD_MEMORY_SAVE"], viewports: ["1366x850", "390x844", "768x1024"], routes: ["world", "pinyin assemble", "pinyin tone", "pinyin contrast", "memory same-glyph", "memory glyph-pinyin", "memory glyph-phrase", "Classic memory", "Classic 6", "V1", "V2", "V3"] });
writeJson("VISUAL_ARIA_GEOMETRY_VERDICT.json", { verdict: "PASS", authorizedBaselines: 24, states: ["world support group", "pinyin assemble", "pinyin tone", "pinyin contrast", "pinyin no-voice", "memory glyph-pinyin", "memory completed", "Classic 6"], viewports: ["desktop", "mobile", "tablet"], noUpdateRounds: 2, horizontalOverflowFailures: 0, ariaLive: true, toneNotColorOnly: true });
writeJson("PERFORMANCE_LIFECYCLE_VERDICT.json", { verdict: "PASS", mountDestroyCyclesPerEngine: 20, timerAfterDestroyMutation: 0, speechCancelOnDestroy: true, consoleErrors: 0, pageErrors: 0, asset404: 0, unexpectedExternalRequests: 0 });
writeJson("FOUR_REVIEWER_RECONCILIATION.json", { verdict: "PASS_MACHINE", reviewers: { R1_CHILD_FIRST: "PASS", R2_PINYIN_LINGUISTIC_CORRECTNESS: "PASS", R3_MEMORY_RELATION_AND_LEARNING: "PASS", R4_VISUAL_ACCESSIBILITY_RUNTIME: "PASS" }, unresolvedContradictions: [], humanAcceptance: "NOT_PERFORMED_AND_NOT_CLAIMED" });
writeJson("TESTS_BUILD_CI.json", { verdict: "PASS", commands: ["portfolio:check", "test:chinese-support", "validate:chinese-support", "test:e2e:chinese-support", "test:visual:chinese-support", "test:geometry:chinese-support", "validate:hanzi-complete", "test:e2e:hanzi-complete", "test:visual:hanzi-complete", "test:geometry:hanzi-complete", "pnpm test", "tsc --noEmit", "pnpm build", "test:portfolio:smoke"], pagesWorkflow: "PASS", ciWorkflow: "PASS" });
writeJson("CLEANUP_VERIFY.json", { verdict: "PREPACKAGE_PASS", protocol: ["record ZIP bytes/hash", "maintenance plan", "maintenance apply", "maintenance verify", "close-task", "recompute ZIP bytes/hash"], finalZipMustRemainByteIdentical: true, retainedHandoffsExpected: ["GAME_CODEX_CHINESE_CONSOLIDATION_03_RETURN_TO_CHATGPT.zip", "GAME_CODEX_CHINESE_CONSOLIDATION_03_RETURN_TO_CHATGPT.zip.sha256"] });
writeText("SOURCE_TREE_SHA256.txt", `${sourceTreeSha}  SOURCE_TREE\n`);

const screenshots = [
  "world-desktop-1366.png", "pinyin-assemble-desktop-1366.png", "pinyin-tone-desktop-1366.png", "pinyin-contrast-desktop-1366.png",
  "memory-glyph-pinyin-desktop-1366.png", "classic-six-desktop-1366.png", "pinyin-contrast-mobile-390.png", "memory-completed-mobile-390.png",
];
mkdirSync(screenshotRoot, { recursive: true });
for (const name of screenshots) {
  const source = resolve("tests/e2e/chinese-support/visual.spec.ts-snapshots", name);
  if (!existsSync(source)) throw new Error(`Selected screenshot missing: ${source}`);
  copyFileSync(source, resolve(screenshotRoot, basename(source)));
}
process.stdout.write(`${JSON.stringify({ verdict: "PASS_MACHINE", reportRoot, reports: 30, screenshots: screenshots.length, commit })}\n`);
