import { auditAllV1Hands } from "../../games/hanzi-radical-battle/v2/golden-slice/content/v1-hand-auditor";
import { HANZI_MAGIC_V1_ENCOUNTERS, getV1Character } from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";

describe("Hanzi Magic V1 fixed hand solver", () => {
  it("audits all 12 five-card hands against the full two/three-part mother library", () => {
    const audits = auditAllV1Hands();
    expect(audits).toHaveLength(12);
    for (const audit of audits) {
      expect(audit.twoCardSubsets).toBe(10);
      expect(audit.threeCardSubsets).toBe(10);
      expect(audit.permutationsChecked).toBe(80);
      expect(audit.failureCodes, `${audit.encounterId}: ${JSON.stringify(audit.matches)}`).toEqual([]);
      expect(audit.passed, audit.encounterId).toBe(true);
      expect(new Set(audit.matches.flatMap((match) => match.resultGlyphs))).toEqual(new Set([audit.targetGlyph]));
    }
  });

  it("keeps target instance IDs, source glyphs, and slots stable", () => {
    for (const encounter of HANZI_MAGIC_V1_ENCOUNTERS) {
      const character = getV1Character(encounter.characterId);
      const targets = encounter.cards.filter((card) => card.kind === "target");
      expect(targets.map((card) => card.id)).toEqual(character.components.map((component) => component.id));
      expect(targets.map((card) => card.sourceGlyph)).toEqual(character.components.map((component) => component.sourceGlyph));
      expect(targets.map((card) => card.expectedSlotId)).toEqual(character.components.map((component) => component.slotId));
    }
  });
});
