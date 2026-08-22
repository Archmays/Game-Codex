import { readFileSync } from "node:fs";
import { pinyinCoverageMatrix } from "../../games/hanzi-radical-battle/complete/support/pinyin/coverage";
import { PINYIN_CONTRASTS, validateContrast } from "../../games/hanzi-radical-battle/complete/support/pinyin/contrasts";
import { LEGACY_PINYIN_AUDIT, legacyAuditSummary } from "../../games/hanzi-radical-battle/complete/support/pinyin/legacy-audit";
import { createPinyinSession, validateChallenge } from "../../games/hanzi-radical-battle/complete/support/pinyin/machine";
import { PINYIN_READING_MANIFEST } from "../../games/hanzi-radical-battle/complete/support/pinyin/manifest";
import { validatePinyinRecord } from "../../games/hanzi-radical-battle/complete/support/pinyin/orthography";

describe("canonical Pinyin support", () => {
  it("covers all 72 core characters with round-trippable records", () => {
    expect(PINYIN_READING_MANIFEST).toHaveLength(72);
    expect(new Set(PINYIN_READING_MANIFEST.map((record) => record.characterId)).size).toBe(72);
    for (const record of PINYIN_READING_MANIFEST) expect(validatePinyinRecord(record), record.glyph).toEqual([]);
  });

  it("covers every required orthography category with real records", () => {
    expect(pinyinCoverageMatrix()).toMatchObject({ characterCount: 72, fourTones: true, neutralTone: true, zeroInitial: true, yOrthography: true, wOrthography: true, underlyingUmlaut: true, jqxUmlautSpelling: true, nasalFinal: true, retroflexInitial: true, nonRetroflexInitial: true, contractedFinal: true, wholeSyllableTeaching: true });
  });

  it("gives every immutable legacy row exactly one disposition", () => {
    expect(legacyAuditSummary()).toMatchObject({ recordCount: 71, stableIdsUnique: true });
    expect(LEGACY_PINYIN_AUDIT.every((record) => record.disposition && record.issueCodes.length > 0)).toBe(true);
  });

  it("keeps the child runtime outside the legacy source/audit boundary", () => {
    const runtimeFiles = [
      "games/pinyin-magic-battle/index.ts",
      "games/hanzi-radical-battle/complete/support/pinyin/app.ts",
      "games/hanzi-radical-battle/complete/support/pinyin/machine.ts",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(runtimeFiles).not.toContain("pinyinCards");
    expect(runtimeFiles).not.toContain("legacy-audit");
  });

  it("validates source-backed single-dimension contrasts", () => {
    expect(PINYIN_CONTRASTS.length).toBeGreaterThanOrEqual(4);
    for (const contrast of PINYIN_CONTRASTS) expect(validateContrast(contrast), contrast.id).toEqual([]);
  });

  it("generates deterministic, unique-answer challenges with legal hints", () => {
    for (const mode of ["assemble", "tone", "contrast"] as const) {
      for (let index = 0; index < 400; index += 1) {
        const seed = `solver-${index}`;
        const session = createPinyinSession(mode, seed);
        expect(session).toEqual(createPinyinSession(mode, seed));
        expect(session.length).toBeGreaterThanOrEqual(3);
        expect(session.length).toBeLessThanOrEqual(5);
        for (const challenge of session) expect(validateChallenge(challenge), challenge.id).toEqual([]);
      }
    }
  });

  it("prioritizes discovered characters when enough are available", () => {
    const preferred = PINYIN_READING_MANIFEST.slice(0, 6).map((record) => record.characterId);
    const session = createPinyinSession("assemble", "preferred", preferred);
    expect(session.every((challenge) => preferred.includes(PINYIN_READING_MANIFEST.find((record) => record.id === challenge.recordId)!.characterId))).toBe(true);
  });
});
