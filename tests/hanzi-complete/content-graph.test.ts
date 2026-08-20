import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHAPTER_ONE_CHARACTERS } from "../../games/hanzi-radical-battle/v2/chapter-one/characters";
import { PLAYABLE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_CHARACTER_NODES, COMPLETE_CONTENT_GRAPH_REVISION, COMPLETE_CORE_PLAYABLE_MANIFEST, COMPLETE_SPELLBOOK_MANIFEST } from "../../games/hanzi-radical-battle/complete/content-graph/manifest";
import { COMPLETE_NEW_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/new-characters";
import { COMPLETE_SOURCE_RECORDS } from "../../games/hanzi-radical-battle/complete/content-graph/sources";
import { auditCompleteCharacterHands, createCompleteCharacterHand, enumerateCompleteHandSolutions } from "../../games/hanzi-radical-battle/complete/core/content-solvers";
import { COMPLETE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";

const EXPECTED_NEW_GLYPHS = [
  "指", "饱", "情", "请", "路", "进", "迷", "思", "语", "饭", "钟", "钱", "初", "被", "祝", "神", "跳", "们",
  "空", "静", "睛", "庭", "歌", "响", "香", "间", "围", "道", "眼", "圈", "江", "洁", "树", "景", "晨", "答",
];

describe("complete-edition canonical character graph", () => {
  test("contains exactly 36 legacy and 36 genuinely new core glyphs with the fixed chapter allocation", () => {
    expect(COMPLETE_CORE_CHARACTER_NODES).toHaveLength(72);
    expect(new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.glyph)).size).toBe(72);
    expect(COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-one")).toHaveLength(36);
    expect(COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-two")).toHaveLength(18);
    expect(COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-three")).toHaveLength(18);
    for (const chapterId of ["chapter-two", "chapter-three"] as const) {
      expect(COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === chapterId && character.band === "story-required")).toHaveLength(12);
      expect(COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === chapterId && character.band === "optional")).toHaveLength(6);
    }
    expect(COMPLETE_NEW_CHARACTER_NODES.map((character) => character.glyph)).toEqual(EXPECTED_NEW_GLYPHS);
    expect(EXPECTED_NEW_GLYPHS.some((glyph) => CHAPTER_ONE_CHARACTERS.some((character) => character.glyph === glyph))).toBe(false);
  });

  test("gives every core glyph a complete sourced, fixed-reading and meaning-magic record", () => {
    const readingIds = new Set(COMPLETE_CORE_READING_SENSES.map((reading) => reading.id));
    for (const character of COMPLETE_CORE_CHARACTER_NODES) {
      expect(character.unicodeCodePoint).toMatch(/^U\+[0-9A-F]{4,6}$/);
      expect(character.components).toHaveLength(2);
      expect(new Set(character.components.map((component) => component.instanceId)).size).toBe(2);
      expect(character.readingSenseIds.every((id) => readingIds.has(id))).toBe(true);
      expect(character.familiarWord.length).toBeGreaterThanOrEqual(2);
      expect(character.shortMeaning.length).toBeGreaterThan(2);
      expect(character.magicName.length).toBeGreaterThanOrEqual(2);
      expect(character.magicEffect.length).toBeGreaterThan(4);
      expect(character.meaningImageDisclaimer).toBe("这是字义联想，不是字源说明");
      expect(character.sourceIds.length).toBeGreaterThanOrEqual(2);
      expect(character.ambiguityRisk.length).toBeGreaterThan(5);
      expect(character.revisionHash).toMatch(/^fnv1a:/);
    }
    expect(COMPLETE_CORE_PLAYABLE_MANIFEST.characterIds).toHaveLength(72);
    expect(COMPLETE_SPELLBOOK_MANIFEST.characterIds).toEqual(COMPLETE_CORE_PLAYABLE_MANIFEST.characterIds);
    expect(COMPLETE_CONTENT_GRAPH_REVISION).toMatch(/^fnv1a:/);
  });

  test("deduplicates Chapter One, wheel and new provenance into one node per canonical glyph", () => {
    expect(new Set(COMPLETE_CHARACTER_NODES.map((character) => character.id)).size).toBe(COMPLETE_CHARACTER_NODES.length);
    expect(new Set(COMPLETE_CHARACTER_NODES.map((character) => character.glyph)).size).toBe(COMPLETE_CHARACTER_NODES.length);
    for (const wheel of COMPLETE_WHEEL_MANIFEST) {
      const node = COMPLETE_CHARACTER_NODES.find((character) => character.id === wheel.characterNodeId);
      expect(node?.glyph).toBe(wheel.glyph);
    }
    const qing = COMPLETE_CHARACTER_NODES.filter((character) => character.glyph === "情");
    expect(qing).toHaveLength(1);
    expect(qing[0].provenance).toEqual(expect.arrayContaining(["new-candidate:m0", "wheel:p2.char.004"]));
  });

  test("keeps a 72-record reviewed wheel adapter with eight records in every legacy-label-only band", () => {
    expect(COMPLETE_WHEEL_MANIFEST).toHaveLength(72);
    expect(new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.glyph)).size).toBe(72);
    expect(COMPLETE_WHEEL_MANIFEST.every((record) => record.alignmentStatus === "legacy-label-only")).toBe(true);
    expect(COMPLETE_WHEEL_MANIFEST.every((record) => ["validated", "corrected-derived-record"].includes(record.auditStatus))).toBe(true);
    for (const gradeId of ["p1", "p2", "p3", "p4", "p5", "p6", "j1", "j2", "j3"]) {
      expect(COMPLETE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId), gradeId).toHaveLength(8);
    }
    for (const legacy of PLAYABLE_WHEEL_MANIFEST) {
      const adapted = COMPLETE_WHEEL_MANIFEST.find((record) => record.id === legacy.id)!;
      for (const key of Object.keys(legacy) as (keyof typeof legacy)[]) expect(adapted[key]).toEqual(legacy[key]);
    }
  });

  test("finds one canonical five-card solution for all 72 core characters, including repeated-glyph instances", () => {
    const audit = auditCompleteCharacterHands();
    expect(audit).toHaveLength(72);
    expect(audit.every((record) => record.passed)).toBe(true);
    for (const character of COMPLETE_CORE_CHARACTER_NODES) {
      const hand = createCompleteCharacterHand(character.id);
      expect(hand).toHaveLength(5);
      expect(new Set(hand.map((card) => card.id)).size).toBe(5);
      expect(enumerateCompleteHandSolutions(character.id, hand)).toMatchObject([{ characterId: character.id, glyph: character.glyph }]);
    }
    const forest = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.glyph === "林")!;
    const forestTargets = createCompleteCharacterHand(forest.id).filter((card) => card.kind === "target");
    expect(forestTargets.map((card) => card.glyph)).toEqual(["木", "木"]);
    expect(new Set(forestTargets.map((card) => card.id)).size).toBe(2);
  });

  test("binds the 36 selected new glyphs to the frozen 36/36 external source ledger", () => {
    const ledger = JSON.parse(readFileSync(resolve("artifacts/hanzi-magic-complete-v3/content/M2_SELECTED_SOURCE_LEDGER.json"), "utf8"));
    expect(ledger.sources.makeMeAHanzi.sha256).toBe("744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203");
    expect(ledger.sources.unihan.sha256).toBe("f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e");
    expect(ledger).toMatchObject({ selectedCharacterCount: 36, passedCharacterCount: 36, allPassed: true });
    expect(ledger.records.every((record: { passed: boolean }) => record.passed)).toBe(true);
    expect(COMPLETE_SOURCE_RECORDS.map((source) => source.id)).toEqual(expect.arrayContaining(["unicode-unihan-17", "makemeahanzi-bddc96d", "moe-modern-components", "moe-curriculum-2022"]));
  });
});
