import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { auditCompleteFamilies } from "../../games/hanzi-radical-battle/complete/core/content-solvers";

describe("complete-edition component families", () => {
  test("ships 12 story and 6 optional families with the required playable coverage", () => {
    expect(COMPLETE_COMPONENT_FAMILIES).toHaveLength(18);
    expect(new Set(COMPLETE_COMPONENT_FAMILIES.map((family) => family.id)).size).toBe(18);
    expect(COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "story-core")).toHaveLength(12);
    expect(COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "optional-advanced")).toHaveLength(6);
    expect(COMPLETE_COMPONENT_FAMILIES.filter((family) => family.memberCharacterIds.length >= 3).length).toBeGreaterThanOrEqual(8);
    expect(COMPLETE_COMPONENT_FAMILIES.every((family) => family.memberCharacterIds.length >= 2)).toBe(true);
  });

  test("keeps every member, relation, world representation and browser state explicit", () => {
    const coreIds = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id));
    for (const family of COMPLETE_COMPONENT_FAMILIES) {
      const relations = COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === family.id);
      expect(family.memberCharacterIds.every((id) => coreIds.has(id))).toBe(true);
      expect(relations).toHaveLength(family.memberCharacterIds.length);
      expect(new Set(relations.map((relation) => relation.characterId)).size).toBe(family.memberCharacterIds.length);
      expect(family.worldRepresentation.length).toBeGreaterThan(10);
      expect(family.browserStateId).toMatch(/^family-/);
      expect(family.sourceIds.length).toBeGreaterThan(0);
      expect(family.revisionHash).toMatch(/^fnv1a:/);
    }
    expect(auditCompleteFamilies().every((record) => record.issues.length === 0)).toBe(true);
  });

  test("never promotes cautious visual links into semantic or etymology claims", () => {
    const visualOnly = COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.kind === "modern-visual-link-only");
    expect(visualOnly.length).toBeGreaterThan(0);
    for (const relation of visualOnly) {
      expect(relation.childFacingClaim).toContain("字形");
      expect(relation.childFacingClaim).toContain("不");
      expect(relation.kind).not.toBe("semantic-component");
    }
    const qing = COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === "family-qing-sound");
    expect(qing.find((relation) => relation.characterId === COMPLETE_CORE_CHARACTER_NODES.find((character) => character.glyph === "静")!.id)?.kind).toBe("modern-visual-link-only");
    expect(qing.filter((relation) => ["phonetic-component", "modern-visual-link-only"].includes(relation.kind))).toHaveLength(qing.length);
  });
});
