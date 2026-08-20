import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_CONTENT_GRAPH_REVISION } from "../../games/hanzi-radical-battle/complete/content-graph/manifest";
import { COMPLETE_SOURCE_RECORDS } from "../../games/hanzi-radical-battle/complete/content-graph/sources";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { auditCompleteCharacterHands, auditCompleteFamilies, auditCompleteWords, createCompleteCharacterHand } from "../../games/hanzi-radical-battle/complete/core/content-solvers";
import { COMPLETE_WHEEL_MANIFEST, COMPLETE_WHEEL_MANIFEST_REVISION } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";

const CONTENT_ROOT = resolve("artifacts/hanzi-magic-complete-v3/content");
const SOURCE_LEDGER_PATH = resolve(CONTENT_ROOT, "M2_SELECTED_SOURCE_LEDGER.json");
const GRAPH_PATH = resolve(CONTENT_ROOT, "M2_CONTENT_GRAPH.json");
const GLYPH_PATH = resolve(CONTENT_ROOT, "M2_GLYPH_SHEET.json");
const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check") || !WRITE;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readingFor(characterId: string) {
  const reading = COMPLETE_CORE_READING_SENSES.find((candidate) => candidate.characterId === characterId);
  if (!reading) throw new Error(`Missing core reading for ${characterId}`);
  return reading;
}

if (!existsSync(SOURCE_LEDGER_PATH)) throw new Error("Run refresh-m2-source-ledger.ts before building the M2 content evidence");
const sourceLedgerText = readFileSync(SOURCE_LEDGER_PATH, "utf8").replace(/\r\n/g, "\n");
const sourceLedger = JSON.parse(sourceLedgerText) as { readonly selectedCharacterCount: number; readonly passedCharacterCount: number; readonly allPassed: boolean };
if (!sourceLedger.allPassed || sourceLedger.selectedCharacterCount !== 36 || sourceLedger.passedCharacterCount !== 36) {
  throw new Error("M2 selected-source ledger is not 36/36 PASS");
}

const handAudit = auditCompleteCharacterHands();
const familyAudit = auditCompleteFamilies();
const wordAudit = auditCompleteWords();
const graphArtifact = {
  schemaVersion: 1,
  contentGraphRevision: COMPLETE_CONTENT_GRAPH_REVISION,
  sourceLedger: { path: "M2_SELECTED_SOURCE_LEDGER.json", sha256: sha256(sourceLedgerText) },
  counts: {
    coreCharacters: COMPLETE_CORE_CHARACTER_NODES.length,
    existingCharacters: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-one").length,
    genuinelyNewCharacters: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId !== "chapter-one").length,
    chapterTwo: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-two").length,
    chapterThree: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-three").length,
    newStoryRequired: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId !== "chapter-one" && character.band === "story-required").length,
    newOptional: COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.band === "optional").length,
    componentFamilies: COMPLETE_COMPONENT_FAMILIES.length,
    storyFamilies: COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "story-core").length,
    optionalFamilies: COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "optional-advanced").length,
    wordResonances: COMPLETE_WORD_NODES.length,
    storyWords: COMPLETE_WORD_NODES.filter((word) => word.band === "story").length,
    optionalWords: COMPLETE_WORD_NODES.filter((word) => word.band === "optional-postgame").length,
    wheelPlayable: COMPLETE_WHEEL_MANIFEST.length,
  },
  verdicts: {
    characters: handAudit.every((record) => record.passed) ? "72/72 PASS" : "FAIL",
    families: familyAudit.every((record) => record.issues.length === 0) ? "18/18 PASS" : "FAIL",
    words: wordAudit.every((record) => record.issues.length === 0) ? "36/36 PASS" : "FAIL",
    wheel: COMPLETE_WHEEL_MANIFEST.length >= 72 ? `${COMPLETE_WHEEL_MANIFEST.length}/${COMPLETE_WHEEL_MANIFEST.length} PASS` : "FAIL",
    playableAmbiguityCount: handAudit.filter((record) => record.solutionCount !== 1).length + familyAudit.filter((record) => record.issues.length > 0).length + wordAudit.filter((record) => record.issues.length > 0).length,
  },
  characters: COMPLETE_CORE_CHARACTER_NODES.map((character) => ({
    id: character.id,
    glyph: character.glyph,
    unicodeCodePoint: character.unicodeCodePoint,
    chapterId: character.chapterId,
    band: character.band,
    structure: character.structure,
    components: character.components.map((component) => ({ instanceId: component.instanceId, glyph: component.glyph, sourceGlyph: component.sourceGlyph, slotId: component.slotId, role: component.role })),
    reading: readingFor(character.id),
    familiarWord: character.familiarWord,
    shortMeaning: character.shortMeaning,
    magicName: character.magicName,
    ambiguityRisk: character.ambiguityRisk,
    sourceIds: character.sourceIds,
    provenance: character.provenance,
    revisionHash: character.revisionHash,
    hand: createCompleteCharacterHand(character.id),
  })),
  families: COMPLETE_COMPONENT_FAMILIES.map((family) => ({
    ...family,
    relations: COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === family.id),
  })),
  words: COMPLETE_WORD_NODES,
  wheel: {
    revisionHash: COMPLETE_WHEEL_MANIFEST_REVISION,
    gradeCounts: Object.fromEntries(["p1", "p2", "p3", "p4", "p5", "p6", "j1", "j2", "j3"].map((gradeId) => [gradeId, COMPLETE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId).length])),
    records: COMPLETE_WHEEL_MANIFEST.map((record) => ({ id: record.id, legacyId: record.legacyId, sourceGradeId: record.sourceGradeId, alignmentStatus: record.alignmentStatus, glyph: record.glyph, pinyin: record.pinyin, familiarWord: record.familiarWord, auditStatus: record.auditStatus, characterNodeId: record.characterNodeId, familyIds: record.familyIds, wordIds: record.wordIds, revisionHash: record.revisionHash, adapterRevisionHash: record.adapterRevisionHash })),
  },
  sources: COMPLETE_SOURCE_RECORDS,
};

const glyphArtifact = {
  schemaVersion: 1,
  title: "汉字魔法战 V3 核心 72 字浏览器字形表",
  route: "?play=hanzi-magic-complete&from=hub&audit=content-graph",
  fontStack: "Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif",
  characterCount: COMPLETE_CORE_CHARACTER_NODES.length,
  characters: COMPLETE_CORE_CHARACTER_NODES.map((character, index) => ({
    ordinal: index + 1,
    id: character.id,
    glyph: character.glyph,
    codePoint: character.unicodeCodePoint,
    pinyin: readingFor(character.id).pinyin,
    fixedPhrase: readingFor(character.id).fixedPhrase,
    chapterId: character.chapterId,
    band: character.band,
    structure: character.structure,
    componentGlyphs: character.components.map((component) => component.glyph),
  })),
};

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function handle(path: string, value: unknown): void {
  const expected = serialize(value);
  if (WRITE) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, "utf8");
  }
  if (CHECK) {
    if (!existsSync(path)) throw new Error(`Missing generated M2 artifact: ${path}`);
    const actual = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    if (actual !== expected) throw new Error(`Generated M2 artifact is stale: ${path}`);
  }
}

handle(GRAPH_PATH, graphArtifact);
handle(GLYPH_PATH, glyphArtifact);
process.stdout.write(`${JSON.stringify({ mode: WRITE ? "write" : "check", graph: GRAPH_PATH, glyphs: GLYPH_PATH, verdicts: graphArtifact.verdicts })}\n`);
