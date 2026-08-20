import { describe, expect, test } from "vitest";
import { COMPLETE_BOSS_ARCHIVE, COMPLETE_REPAIR_ARCHIVE, COMPLETE_STORY_ARCHIVE_CHAPTERS } from "../../games/hanzi-radical-battle/complete/archive/contracts";
import { COMPLETE_COMPONENT_FAMILIES } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { COMPLETE_REPAIR_IDS } from "../../games/hanzi-radical-battle/complete/core/world-contracts";
import { COMPLETE_SPELLBOOK_ENTRIES } from "../../games/hanzi-radical-battle/complete/spellbook/catalog";
import { COMPLETE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";
import { createCompleteWorkshopState, getCompleteWorkshopPool, reduceCompleteWorkshopState, simulateCompleteWorkshop } from "../../games/hanzi-radical-battle/complete/workshop-adapter/engine";
import { COMPLETE_WHEEL_GRADE_OPTIONS, getCompleteWheelRecord } from "../../games/hanzi-radical-battle/complete/wheel-adapter/selection";
import { hanziRadicalBattleGame } from "../../games/hanzi-radical-battle";
import { HANZI_MAGIC_COMPLETE_ROUTE, HANZI_MAGIC_V1_ROUTE } from "../../apps/my-game-world/world-routes";

describe("complete-edition world features", () => {
  test("promotes only the hub and world primary portals while preserving the V1 history route", () => {
    expect(hanziRadicalBattleGame.route).toBe("?play=hanzi-magic-complete&from=hub");
    expect(HANZI_MAGIC_COMPLETE_ROUTE).toBe("?play=hanzi-magic-complete&from=world");
    expect(HANZI_MAGIC_V1_ROUTE).toBe("?play=hanzi-v2-v1&from=world");
  });

  test("archives all 16 durable repairs with visible before/after, interaction and learning contracts", () => {
    expect(COMPLETE_REPAIR_ARCHIVE).toHaveLength(16);
    expect(COMPLETE_REPAIR_ARCHIVE.map((repair) => repair.id)).toEqual(COMPLETE_REPAIR_IDS);
    for (const repair of COMPLETE_REPAIR_ARCHIVE) {
      expect(repair.before.shape).not.toBe(repair.after.shape);
      expect(repair.before.function).not.toBe(repair.after.function);
      expect(repair.before.light).not.toBe(repair.after.light);
      expect(repair.interaction.length).toBeGreaterThan(8);
      expect(repair.childValue.length).toBeGreaterThan(8);
      expect(repair.learningConnection.length).toBeGreaterThan(8);
      expect(repair).toMatchObject({ persistence: "local-durable", saveField: "repairedObjectIds" });
    }
  });

  test("story archive replays three chapters and twelve non-punitive boss sequences without reset links", () => {
    expect(COMPLETE_STORY_ARCHIVE_CHAPTERS).toHaveLength(3);
    expect(COMPLETE_BOSS_ARCHIVE).toHaveLength(12);
    for (const chapter of COMPLETE_STORY_ARCHIVE_CHAPTERS) {
      expect(chapter.replayHref).toContain("fresh=1");
      expect(chapter.replayHref).not.toMatch(/reset|clear/);
    }
    for (const boss of COMPLETE_BOSS_ARCHIVE) {
      expect(boss.telegraph.length).toBeGreaterThan(8);
      expect(boss.effect.length).toBeGreaterThan(8);
      expect(boss.recovery.length).toBeGreaterThan(8);
      expect(boss.learningConnection.length).toBeGreaterThan(8);
    }
  });

  test("spellbook exposes exactly 72 child-safe character records with graph links and replay text", () => {
    expect(COMPLETE_SPELLBOOK_ENTRIES).toHaveLength(72);
    expect(new Set(COMPLETE_SPELLBOOK_ENTRIES.map((entry) => entry.glyph)).size).toBe(72);
    for (const entry of COMPLETE_SPELLBOOK_ENTRIES) {
      expect(entry.pinyin).toBeTruthy();
      expect(entry.familiarWord).toBeTruthy();
      expect(entry.shortMeaning).toBeTruthy();
      expect(entry.components.length).toBeGreaterThanOrEqual(2);
      expect(entry.replayFormation).toContain("→");
      expect(entry.replayPronunciation).toContain(entry.glyph);
      expect(entry.replayMeaning).toContain(entry.familiarWord);
      expect(entry.associationDescription).toContain("不是字源说明");
      expect(entry.associationDescription).not.toMatch(/V[123]|source|audit|revision/i);
      expect(entry.familyLinks.every((link) => COMPLETE_COMPONENT_FAMILIES.some((family) => family.id === link.id))).toBe(true);
      expect(entry.wordLinks.every((link) => COMPLETE_WORD_NODES.some((word) => word.id === link.id))).toBe(true);
      expect(entry.auditBoundary.sourceIds.length).toBeGreaterThan(0);
    }
  });

  test("V3 workshop adapts 72 unique audited characters with eight in every p1-j3 band", () => {
    expect(COMPLETE_WHEEL_MANIFEST).toHaveLength(72);
    expect(new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.glyph)).size).toBe(72);
    expect(getCompleteWorkshopPool("journey")).toHaveLength(72);
    for (const grade of COMPLETE_WHEEL_GRADE_OPTIONS.filter((option) => option.id !== "journey")) expect(getCompleteWorkshopPool(grade.id)).toHaveLength(8);
    expect(COMPLETE_WHEEL_MANIFEST.every((record) => record.characterNodeId && record.orderedComponents.length === 2)).toBe(true);
  });

  test.each(COMPLETE_WHEEL_GRADE_OPTIONS.map((grade) => grade.id))("completes a deterministic three-round %s wheel session", (gradeId) => {
    const state = simulateCompleteWorkshop(`workshop-${gradeId}`, gradeId);
    expect(state.phase).toBe("summary");
    expect(state.completedRoundCount).toBe(3);
    expect(new Set(state.sessionRecordIds).size).toBe(3);
  });

  test("wheel rejects a distractor and wrong slot without losing the current round", () => {
    let state = createCompleteWorkshopState("workshop-reversible", "journey");
    state = reduceCompleteWorkshopState(state, { type: "spin" });
    const before = state.currentRound!;
    const wrong = before.cards.find((card) => card.kind === "distractor")!;
    state = reduceCompleteWorkshopState(state, { type: "select-card", cardId: wrong.id });
    const target = getCompleteWheelRecord(before.recordId);
    state = reduceCompleteWorkshopState(state, { type: "place-card", slotId: target.slotIds[1] });
    expect(state.phase).toBe("choose-card");
    expect(state.completedRoundCount).toBe(0);
    expect(state.currentRound?.recordId).toBe(before.recordId);
    expect(state.gentleMessage).toContain("不会失去进度");
  });
});
