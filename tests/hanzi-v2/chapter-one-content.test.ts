import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HANZI_RADICAL_FORMULA_AUDIT_ENTRIES } from "../../games/hanzi-radical-battle/formula-audit";
import { getHanziRadicalCombination } from "../../games/hanzi-radical-battle/game-data";
import {
  CHAPTER_ONE_CHARACTERS,
  CHAPTER_ONE_HANDS,
  CHAPTER_ONE_SPELLBOOK,
  auditAllChapterHands,
  simulateContentCast,
  simulateContentCoverageRun,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

const EXPECTED_READINGS: Readonly<Record<string, string>> = {
  明: "míng", 花: "huā", 林: "lín", 星: "xīng", 草: "cǎo", 看: "kàn",
  园: "yuán", 回: "huí", 包: "bāo", 风: "fēng", 猫: "māo", 跑: "pǎo",
  清: "qīng", 晴: "qíng", 松: "sōng", 河: "hé", 海: "hǎi", 洋: "yáng",
  安: "ān", 闪: "shǎn", 你: "nǐ", 他: "tā", 好: "hǎo", 唱: "chàng",
  家: "jiā", 苗: "miáo", 菜: "cài", 音: "yīn", 早: "zǎo", 笔: "bǐ",
  尘: "chén", 国: "guó", 图: "tú", 圆: "yuán", 问: "wèn", 闭: "bì",
};

const V1_GLYPHS = new Set("明花林星草看园回包风猫跑".split(""));

describe("Hanzi Magic Battle V2 Chapter One M2 content closure", () => {
  it("locks exactly 36 identity-bound characters in three balanced regions", () => {
    expect(CHAPTER_ONE_CHARACTERS).toHaveLength(36);
    expect(new Set(CHAPTER_ONE_CHARACTERS.map((entry) => entry.id)).size).toBe(36);
    expect(new Set(CHAPTER_ONE_CHARACTERS.map((entry) => entry.glyph))).toEqual(new Set(Object.keys(EXPECTED_READINGS)));
    for (const regionId of ["glimmer-grove", "echo-garden", "wind-trail"] as const) {
      expect(CHAPTER_ONE_CHARACTERS.filter((entry) => entry.regionId === regionId)).toHaveLength(12);
    }
    expect(Object.fromEntries(["left-right", "top-bottom", "full-enclosure", "semi-enclosure"].map((structure) => [
      structure,
      CHAPTER_ONE_CHARACTERS.filter((entry) => entry.structure === structure).length,
    ]))).toEqual({ "left-right": 14, "top-bottom": 12, "full-enclosure": 5, "semi-enclosure": 5 });
    expect(CHAPTER_ONE_CHARACTERS.filter((entry) => entry.familiarityBand === "high")).toHaveLength(28);
    expect(CHAPTER_ONE_CHARACTERS.filter((entry) => entry.familiarityBand === "near")).toHaveLength(8);
  });

  it("binds standard reading, source mapping, formula and visible meaning identity", () => {
    for (const character of CHAPTER_ONE_CHARACTERS) {
      expect(character.pinyinWithToneMarks).toBe(EXPECTED_READINGS[character.glyph]);
      expect(character.spokenPhrase).toBe(`${character.glyph}，${character.familiarWord}`);
      expect(character.sourceMapping.unihanMandarin).toBe(EXPECTED_READINGS[character.glyph]);
      expect(character.sourceMapping.unihanSource).toContain("Unicode 17.0.0");
      expect(character.sourceMapping.unihanZipSha256).toMatch(/^[A-F0-9]{64}$/);
      expect(character.sourceMapping.moeSource).toContain("通用规范汉字表");
      expect(character.sourceMapping.sourceLimit).toContain("not-etymology-or-child-validation");
      expect(character.etymologyClaim).toBeNull();
      expect(character.shortMeaning).toBeTruthy();
      expect(character.magicName).toBeTruthy();
      expect(character.magicEffect).toBeTruthy();
      expect(character.meaningAssetKey).toBeTruthy();
      expect(character.revisionHash).toMatch(/^fnv1a:[a-f0-9]{8}$/);
      expect(existsSync(resolve(character.sourceMapping.visualHintPath))).toBe(true);

      const sourceParts = character.sourceMapping.sourceOrderedParts;
      expect(character.orderedComponents.map((entry) => entry.sourceGlyph)).toEqual(sourceParts);
      expect(character.slotIds).toEqual(character.orderedComponents.map((entry) => entry.slotId));
      const motherResult = getHanziRadicalCombination(sourceParts);
      expect(motherResult?.char.split("/")).toContain(character.glyph);
      const formula = HANZI_RADICAL_FORMULA_AUDIT_ENTRIES.find((entry) =>
        entry.result.char.split("/").includes(character.glyph)
        && entry.parts.join("|") === sourceParts.join("|"));
      expect(formula).toMatchObject({ status: "accepted", source: character.sourceMapping.formulaAuditSource });
    }
  });

  it("preserves the 12 accepted V1 identities and machine-verifies only the 24 additions", () => {
    const carried = CHAPTER_ONE_CHARACTERS.filter((entry) => entry.acceptanceStatus === "v1-accepted-carried-forward");
    const additions = CHAPTER_ONE_CHARACTERS.filter((entry) => entry.acceptanceStatus === "machine-verified-v2");
    expect(carried).toHaveLength(12);
    expect(additions).toHaveLength(24);
    expect(new Set(carried.map((entry) => entry.glyph))).toEqual(V1_GLYPHS);
    expect(additions.every((entry) => !V1_GLYPHS.has(entry.glyph))).toBe(true);
    expect(new Set(CHAPTER_ONE_CHARACTERS.map((entry) => entry.acceptanceStatus))).toEqual(new Set([
      "v1-accepted-carried-forward",
      "machine-verified-v2",
    ]));
  });

  it("proves all 108 five-card hands have one supported answer card set", () => {
    expect(CHAPTER_ONE_HANDS).toHaveLength(108);
    expect(new Set(CHAPTER_ONE_HANDS.map((entry) => entry.id)).size).toBe(108);
    const audits = auditAllChapterHands();
    expect(audits).toHaveLength(108);
    expect(audits.filter((audit) => !audit.passed)).toEqual([]);
    for (const character of CHAPTER_ONE_CHARACTERS) {
      const hands = CHAPTER_ONE_HANDS.filter((entry) => entry.characterId === character.id);
      expect(hands).toHaveLength(3);
      expect(new Set(hands.map((hand) => hand.cards.filter((card) => card.kind === "distractor").map((card) => card.sourceGlyph).sort().join("|"))).size).toBe(3);
    }
  });

  it("requires correct placement before composition and meaning magic", () => {
    const character = CHAPTER_ONE_CHARACTERS.find((entry) => entry.glyph === "闪")!;
    const hand = CHAPTER_ONE_HANDS.find((entry) => entry.characterId === character.id)!;
    const wrong = hand.cards.find((entry) => entry.kind === "distractor")!;
    const initial = simulateContentCast("m2-sequence", character.id, 0);
    expect(initial).toMatchObject({ phase: "meaning", completeGlyphVisible: true, meaningMagicVisible: true, invalidPlacements: 0 });
    expect(wrong.expectedSlotId).toBeNull();
    for (const entry of CHAPTER_ONE_CHARACTERS) {
      for (let variant = 0; variant < 3; variant += 1) {
        expect(simulateContentCast(`m2-${entry.id}-${variant}`, entry.id, variant)).toMatchObject({
          phase: "meaning",
          completeGlyphVisible: true,
          meaningMagicVisible: true,
          invalidPlacements: 0,
        });
      }
    }
  });

  it("provides a complete replayable 36-entry spellbook and seeded coverage", () => {
    expect(CHAPTER_ONE_SPELLBOOK).toHaveLength(36);
    expect(new Set(CHAPTER_ONE_SPELLBOOK.map((entry) => entry.characterId)).size).toBe(36);
    expect(CHAPTER_ONE_SPELLBOOK.every((entry) => entry.replayFormation && entry.replayMeaningMagic)).toBe(true);
    for (const seed of ["m2-0", "m2-1", "m2-42", "黄小越-36字图鉴"]) {
      const result = simulateContentCoverageRun(seed);
      expect(result.failureCodes).toEqual([]);
      expect(result.castStates).toHaveLength(36);
      expect(result.passed).toBe(true);
    }
  });

  it("marks fixed-context polyphones without changing the required reading", () => {
    expect(CHAPTER_ONE_CHARACTERS.filter((entry) => entry.pronunciationRisk === "fixed-context-polyphone").map((entry) => entry.glyph).sort()).toEqual(["好", "看"].sort());
  });
});
