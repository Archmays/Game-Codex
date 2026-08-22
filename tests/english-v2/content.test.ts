import { existsSync, statSync } from "node:fs";
import { ENGLISH_V2_SENTENCES, ENGLISH_V2_SUPPORT_MANIFEST, ENGLISH_V2_WORDS } from "../../games/english-spell-battle/v2/content/manifest";
import { sentenceHasUniqueTarget, validateWordRecord } from "../../games/english-spell-battle/v2/core/machine";
import { ENGLISH_V2_CANDIDATE_POOL, LEGACY_ENGLISH_AUDIT, LEGACY_LEVEL_LABEL_DISPOSITION } from "../../games/english-spell-battle/v2/content/legacy-audit";

describe("Wordlight Island V2 content", () => {
  it("contains 48 words split into 30 story words and 18 optional words", () => {
    expect(ENGLISH_V2_WORDS).toHaveLength(48);
    expect(ENGLISH_V2_WORDS.filter((word) => word.storyBand === "story-core")).toHaveLength(30);
    expect(ENGLISH_V2_WORDS.filter((word) => word.storyBand === "optional")).toHaveLength(18);
    expect(new Set(ENGLISH_V2_WORDS.map((word) => word.decodingBand))).toEqual(new Set(["simple-regular", "common-pattern", "irregular-supported", "optional-advanced"]));
    expect(ENGLISH_V2_WORDS.some((word) => word.partOfSpeech === "verb")).toBe(true);
    expect(ENGLISH_V2_WORDS.some((word) => word.graphemeUnits.some((unit) => unit.letters === "sh"))).toBe(true);
    expect(ENGLISH_V2_WORDS.some((word) => word.graphemeUnits.some((unit) => unit.role === "irregular-heart"))).toBe(true);
  });

  it("has complete, source-backed pronunciation and hand-audited grapheme coverage", () => {
    for (const word of ENGLISH_V2_WORDS) expect(validateWordRecord(word), word.id).toEqual([]);
    expect(ENGLISH_V2_WORDS.find((word) => word.lemma === "frog")?.arpabet.join(" ")).toBe("F R AA1 G");
    expect(ENGLISH_V2_WORDS.find((word) => word.lemma === "drink")?.arpabet.join(" ")).toBe("D R IH1 NG K");
  });

  it("fixes one child-facing sense and formal visual representation for every word", () => {
    expect(new Set(ENGLISH_V2_WORDS.map((word) => word.senseId)).size).toBe(48);
    for (const word of ENGLISH_V2_WORDS) {
      expect(word.childGlossZh).not.toBe("");
      expect(word.childDefinitionEn.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(word.sourceIds).toContain("oewn-2025");
      if (word.visualKind === "asset") {
        const path = `public/assets/english-world/words/${word.lemma}.webp`;
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size, path).toBeLessThanOrEqual(200 * 1024);
      }
    }
    expect(ENGLISH_V2_WORDS.filter((word) => word.visualKind === "asset")).toHaveLength(40);
    expect(ENGLISH_V2_WORDS.filter((word) => word.visualKind === "color")).toHaveLength(4);
    expect(ENGLISH_V2_WORDS.filter((word) => word.visualKind === "quantity")).toHaveLength(4);
  });

  it("keeps 30 natural project-authored sentences with one unique target slot", () => {
    expect(ENGLISH_V2_SENTENCES).toHaveLength(30);
    const supportIds = new Set(ENGLISH_V2_SUPPORT_MANIFEST.map((word) => word.id));
    for (const sentence of ENGLISH_V2_SENTENCES) {
      const word = ENGLISH_V2_WORDS.find((candidate) => candidate.id === sentence.targetWordId)!;
      expect(sentenceHasUniqueTarget(sentence, word), sentence.id).toBe(true);
      const count = sentence.text.replace(/[.!?]$/, "").split(/\s+/).length;
      expect(count, sentence.id).toBeGreaterThanOrEqual(2);
      expect(count, sentence.id).toBeLessThanOrEqual(6);
      expect(sentence.sourceNote).toBe("project-authored");
      expect(sentence.reviewStatus).toBe("accepted");
      expect(sentence.supportWordIds.every((id) => supportIds.has(id)), sentence.id).toBe(true);
    }
    const targetDisplays = new Set(ENGLISH_V2_WORDS.map((word) => word.displayWord.toLowerCase()));
    expect(ENGLISH_V2_SUPPORT_MANIFEST.filter((word) => targetDisplays.has(word.display.toLowerCase()))).toEqual([]);
  });

  it("audits all 44 legacy words and selects exactly four of at least 20 candidates", () => {
    expect(LEGACY_ENGLISH_AUDIT).toHaveLength(44);
    expect(new Set(LEGACY_ENGLISH_AUDIT.map((record) => record.lemma)).size).toBe(44);
    expect(ENGLISH_V2_CANDIDATE_POOL.length).toBeGreaterThanOrEqual(20);
    expect(ENGLISH_V2_CANDIDATE_POOL.filter((candidate) => candidate.selected).map((candidate) => candidate.lemma)).toEqual(["goat", "book", "corn", "clap"]);
    expect(LEGACY_LEVEL_LABEL_DISPOSITION.status).toBe("QUARANTINED_UNSUPPORTED");
  });
});
