import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHAPTER_ONE_CHARACTERS,
  CHAPTER_ONE_HANDS,
  CHAPTER_ONE_SPELLBOOK,
  auditAllChapterHands,
  simulateContentCoverageRun,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

const count = Number(process.argv[2] ?? "5000");
if (!Number.isSafeInteger(count) || count < 1) throw new Error("seed count must be a positive integer");

const outputDirectory = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M2");
mkdirSync(outputDirectory, { recursive: true });

const handAudits = auditAllChapterHands();
const handAuditReport = {
  schemaVersion: 1,
  milestone: "M2",
  result: handAudits.every((entry) => entry.passed) ? "PASS" : "FAIL",
  handCount: handAudits.length,
  expectedHandCount: 108,
  exhaustiveMethod: "all 2-card and 3-card subsets, every order, mother-library lookup, stable instance IDs",
  hands: handAudits.map((entry) => ({
    handId: entry.handId,
    characterId: entry.characterId,
    targetGlyph: entry.targetGlyph,
    twoCardSubsets: entry.twoCardSubsets,
    threeCardSubsets: entry.threeCardSubsets,
    permutationsChecked: entry.permutationsChecked,
    distinctResultGlyphs: entry.distinctResultGlyphs,
    supportedAnswerCardSets: entry.supportedAnswerCardSets,
    failureCodes: entry.failureCodes,
    passed: entry.passed,
  })),
};
writeFileSync(resolve(outputDirectory, "M2-HAND-UNIQUE-SOLUTION-AUDIT.json"), `${JSON.stringify(handAuditReport, null, 2)}\n`, "utf8");

const ledger = {
  schemaVersion: 1,
  milestone: "M2",
  result: "PASS",
  scope: "24 new Chapter One characters; 12 V1 characters are identity-bound carry-forward",
  officialSources: {
    unicode: "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
    unicodeVersion: "17.0.0",
    unihanZipSha256: "F7A48B2B545ACFAA77B2D607AE28747404CE02BAEFEE16396C5D2D7A8EF34B5E",
    moe: "https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/201306/t20130601_186002.html",
    moeExplanation: "https://www.moe.gov.cn/jyb_xwfb/xw_fbh/moe_2069/moe_2590/moe_2914/moe_2912/tnull_50831.html",
  },
  sourceBoundary: "standard identity, fixed-context Mandarin, local combination, formula status and visual hint; no etymology or child-validation claim",
  entries: CHAPTER_ONE_CHARACTERS
    .filter((entry) => entry.acceptanceStatus === "machine-verified-v2")
    .map((entry) => ({
      id: entry.id,
      glyph: entry.glyph,
      pinyinWithToneMarks: entry.pinyinWithToneMarks,
      spokenPhrase: entry.spokenPhrase,
      familiarWord: entry.familiarWord,
      shortMeaning: entry.shortMeaning,
      regionId: entry.regionId,
      structure: entry.structure,
      orderedComponents: entry.orderedComponents,
      slotIds: entry.slotIds,
      sourceCombinationKey: entry.sourceCombinationKey,
      sourceMapping: entry.sourceMapping,
      magicId: entry.magicId,
      magicName: entry.magicName,
      magicEffect: entry.magicEffect,
      meaningAssetKey: entry.meaningAssetKey,
      familiarityBand: entry.familiarityBand,
      pronunciationRisk: entry.pronunciationRisk,
      ambiguityRisk: entry.ambiguityRisk,
      etymologyClaim: entry.etymologyClaim,
      acceptanceStatus: entry.acceptanceStatus,
      revisionHash: entry.revisionHash,
      visualHintExists: existsSync(resolve(entry.sourceMapping.visualHintPath)),
    })),
};
if (ledger.entries.length !== 24 || ledger.entries.some((entry) => !entry.visualHintExists)) {
  ledger.result = "FAIL";
}
writeFileSync(resolve(outputDirectory, "CHARACTER-SOURCE-LEDGER.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

const characterCoverage = new Map<string, number>();
const handCoverage = new Map<string, number>();
const failures: { seed: string; codes: readonly string[] }[] = [];
for (let index = 0; index < count; index += 1) {
  const seed = `m2-content-${index.toString().padStart(5, "0")}`;
  const run = simulateContentCoverageRun(seed);
  if (!run.passed) failures.push({ seed, codes: run.failureCodes });
  for (const cast of run.castStates) {
    characterCoverage.set(cast.characterId, (characterCoverage.get(cast.characterId) ?? 0) + 1);
    handCoverage.set(cast.handId, (handCoverage.get(cast.handId) ?? 0) + 1);
  }
}

const missingCharacterIds = CHAPTER_ONE_CHARACTERS.map((entry) => entry.id).filter((id) => !characterCoverage.has(id));
const missingHandIds = CHAPTER_ONE_HANDS.map((entry) => entry.id).filter((id) => !handCoverage.has(id));
const passed = failures.length === 0
  && handAuditReport.result === "PASS"
  && ledger.result === "PASS"
  && CHAPTER_ONE_CHARACTERS.length === 36
  && CHAPTER_ONE_SPELLBOOK.length === 36
  && missingCharacterIds.length === 0
  && missingHandIds.length === 0;
const report = {
  schemaVersion: 1,
  milestone: "M2",
  result: passed ? "PASS" : "FAIL",
  seeds: count,
  casts: count * CHAPTER_ONE_CHARACTERS.length,
  characterCount: CHAPTER_ONE_CHARACTERS.length,
  handVariantCount: CHAPTER_ONE_HANDS.length,
  spellbookEntryCount: CHAPTER_ONE_SPELLBOOK.length,
  failures,
  missingCharacterIds,
  missingHandIds,
  characterCoverage: Object.fromEntries([...characterCoverage].sort()),
  handCoverage: Object.fromEntries([...handCoverage].sort()),
  generatedAtUtc: new Date().toISOString(),
};
const output = resolve(outputDirectory, `M2-CONTENT-SIMULATION-${count}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, handAuditOutput: resolve(outputDirectory, "M2-HAND-UNIQUE-SOLUTION-AUDIT.json"), ledgerOutput: resolve(outputDirectory, "CHARACTER-SOURCE-LEDGER.json"), ...report }, null, 2));
if (!passed) process.exitCode = 1;
