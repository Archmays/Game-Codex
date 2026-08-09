import {
  ACCEPTED_DEFERRED_CHARACTERS,
  FINAL_GOLDEN_MANIFEST,
  FIRST_RUN_CHARACTER_IDS,
  GOLDEN_CHILD_COPY,
  GOLDEN_CHILD_COPY_MAX_LENGTH,
  GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  GOLDEN_SLICE_PACING_CONTRACT,
  THEME_C_PROCEDURAL_ASSETS,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";

describe("Hanzi V2 STEP 03 accepted golden-slice manifest", () => {
  it("contains the exact accepted final twelve, three accepted-deferred records, and fixed first run", () => {
    expect(FINAL_GOLDEN_MANIFEST.map(({ id, glyph }) => [id, glyph])).toEqual([
      ["ming", "明"], ["hua", "花"], ["lin", "林"], ["xing", "星"],
      ["cao", "草"], ["kan", "看"], ["yuan", "园"], ["hui", "回"],
      ["bao", "包"], ["feng", "风"], ["mao", "猫"], ["pao", "跑"],
    ]);
    expect(ACCEPTED_DEFERRED_CHARACTERS.map(({ id, glyph, disposition }) => [id, glyph, disposition])).toEqual([
      ["qing-clear", "清", "accepted-deferred"],
      ["qing-sunny", "晴", "accepted-deferred"],
      ["song", "松", "accepted-deferred"],
    ]);
    expect(FIRST_RUN_CHARACTER_IDS).toEqual(["ming", "hua", "lin", "xing"]);
    expect(GOLDEN_SLICE_MANIFEST_REVISION_HASH).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it("keeps every final entry accepted, traceable, ordered, and non-etymological", () => {
    for (const character of [...FINAL_GOLDEN_MANIFEST, ...ACCEPTED_DEFERRED_CHARACTERS]) {
      expect(character.status).toBe("accepted");
      expect(character.pinyin).toBeTruthy();
      expect(character.familiarWord).toBeTruthy();
      expect(character.shortMeaning).toBeTruthy();
      expect(character.components.map((component) => component.glyph)).toEqual(character.sourceMapping.sourceOrderedParts);
      expect(character.components.every((component) => component.id && component.role && component.slotId === component.slot)).toBe(true);
      expect(character.illustrationPath).toMatch(/^\/assets\/hanzi-radical-battle\/visuals\/u[0-9a-f]+\.png$/);
      expect(character.sourceMapping.formulaAuditStatus).toBe("accepted");
      expect(character.sourceMapping.step02RevisionHash).toMatch(/^fnv1a:[0-9a-f]{8}$/);
      expect(character.etymologyClaim).toBeNull();
      expect(character.revisionHash).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    }
  });

  it("keeps the three-to-five minute pace, short child copy, and stable Theme C assets", () => {
    expect(GOLDEN_SLICE_PACING_CONTRACT.totalMinimumSeconds).toBeGreaterThanOrEqual(180);
    expect(GOLDEN_SLICE_PACING_CONTRACT.totalMaximumSeconds).toBeLessThanOrEqual(300);
    expect(GOLDEN_SLICE_PACING_CONTRACT.firstSpellBySeconds).toBeLessThanOrEqual(60);
    expect(GOLDEN_SLICE_PACING_CONTRACT.noCountdownPressure).toBe(true);
    expect(Object.values(GOLDEN_CHILD_COPY).every((copy) => [...copy].length <= GOLDEN_CHILD_COPY_MAX_LENGTH)).toBe(true);
    expect(new Set(THEME_C_PROCEDURAL_ASSETS.map((asset) => asset.key)).size).toBe(THEME_C_PROCEDURAL_ASSETS.length);
    expect(THEME_C_PROCEDURAL_ASSETS.every((asset) => asset.stableProcedural && asset.scale > 0 && asset.anchor.x >= 0 && asset.anchor.x <= 1 && asset.anchor.y >= 0 && asset.anchor.y <= 1)).toBe(true);
  });
});
