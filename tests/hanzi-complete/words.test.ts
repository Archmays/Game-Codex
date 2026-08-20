import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { auditCompleteWords, solveCompleteWord } from "../../games/hanzi-radical-battle/complete/core/content-solvers";

describe("complete-edition word resonances", () => {
  test("ships 12 story and 24 optional natural two-core-character records", () => {
    expect(COMPLETE_WORD_NODES).toHaveLength(36);
    expect(new Set(COMPLETE_WORD_NODES.map((word) => word.id)).size).toBe(36);
    expect(new Set(COMPLETE_WORD_NODES.map((word) => word.glyphs.join(""))).size).toBe(36);
    expect(COMPLETE_WORD_NODES.filter((word) => word.band === "story")).toHaveLength(12);
    expect(COMPLETE_WORD_NODES.filter((word) => word.band === "optional-postgame")).toHaveLength(24);
    const coreIds = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id));
    const readingIds = new Set(COMPLETE_CORE_READING_SENSES.map((reading) => reading.id));
    for (const word of COMPLETE_WORD_NODES) {
      expect(word.glyphs).toHaveLength(2);
      expect(word.characterIds.every((id) => coreIds.has(id))).toBe(true);
      expect(word.readingSenseIds.every((id) => readingIds.has(id))).toBe(true);
      expect(word.pinyin).toMatch(/\S+ \S+/);
      expect(word.shortMeaning.length).toBeGreaterThan(3);
      expect(word.context.length).toBeGreaterThan(5);
      expect(word.worldMagic.length).toBeGreaterThan(5);
      expect(word.sourceIds).toContain("moe-dictionary-words");
      expect(word.sourceNote.length).toBeGreaterThan(10);
      expect(word.reverseOrderStatus).toMatch(/^rejected-/);
      expect(word.revisionHash).toMatch(/^fnv1a:/);
    }
  });

  test("accepts only the fixed forward order and rejects reverse, duplicate, missing and replacement choices", () => {
    const replacementPool = COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id);
    for (const word of COMPLETE_WORD_NODES) {
      expect(solveCompleteWord(word.id, word.characterIds)).toMatchObject({ accepted: true, reason: "accepted" });
      expect(solveCompleteWord(word.id, [word.characterIds[1], word.characterIds[0]])).toMatchObject({ accepted: false, reason: "reverse" });
      expect(solveCompleteWord(word.id, [word.characterIds[0], word.characterIds[0]])).toMatchObject({ accepted: false, reason: "duplicate" });
      expect(solveCompleteWord(word.id, [word.characterIds[0]])).toMatchObject({ accepted: false, reason: "missing" });
      const replacement = replacementPool.find((id) => !word.characterIds.includes(id))!;
      expect(solveCompleteWord(word.id, [word.characterIds[0], replacement])).toMatchObject({ accepted: false, reason: "replacement" });
    }
    expect(auditCompleteWords().every((record) => record.issues.length === 0)).toBe(true);
  });

  test("records explicit context boundaries where the reversed order can carry another meaning", () => {
    expect(COMPLETE_WORD_NODES.find((word) => word.glyphs.join("") === "花香")).toMatchObject({ reverseOrderStatus: "rejected-wrong-context" });
    expect(COMPLETE_WORD_NODES.find((word) => word.glyphs.join("") === "安静")).toMatchObject({ reverseOrderStatus: "rejected-wrong-context" });
    expect(COMPLETE_WORD_NODES.filter((word) => word.reverseOrderStatus === "rejected-wrong-context").every((word) => word.ambiguityRisk.includes("本局"))).toBe(true);
  });
});
