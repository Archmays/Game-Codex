import {
  auditAllGoldenHands,
  GOLDEN_HAND_AUDIT_SEED,
  GOLDEN_SLICE_ENCOUNTERS,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";

describe("Hanzi V2 STEP 03 fixed five-card hand auditor", () => {
  it("enumerates every two/three-card subset and ordered permutation against the V1 mother library", () => {
    const audits = auditAllGoldenHands(GOLDEN_SLICE_ENCOUNTERS);
    expect(audits).toHaveLength(4);
    for (const audit of audits) {
      expect(audit.seed).toBe(GOLDEN_HAND_AUDIT_SEED);
      expect(audit.cardInstanceIds).toHaveLength(5);
      expect(new Set(audit.cardInstanceIds).size).toBe(5);
      expect(audit.enumeratedSubsets).toEqual({ twoCard: 10, threeCard: 10 });
      expect(audit.orderedPermutationsChecked).toEqual({ twoCard: 20, threeCard: 60 });
      expect(audit.passed, `${audit.encounterId}:${audit.failureCodes.join(",")}`).toBe(true);
      expect(new Set(audit.matches.flatMap((match) => match.resultGlyphs))).toEqual(new Set([audit.targetGlyph]));
    }
  });

  it("keeps two visual 木 cards as distinct instances while auditing the same target glyph", () => {
    const lin = auditAllGoldenHands(GOLDEN_SLICE_ENCOUNTERS).find((audit) => audit.encounterId === "boss-lin")!;
    expect(lin.cardInstanceIds.filter((id) => id.startsWith("lin-mu-"))).toEqual(["lin-mu-left", "lin-mu-right"]);
    expect(lin.matches.length).toBeGreaterThan(1);
    expect(lin.matches.every((match) => match.resultGlyphs.includes("林"))).toBe(true);
  });
});
