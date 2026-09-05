import { createInitialBoardSession, transitionBoardSession } from "../games/equation-slider/board-state";
import { EQUATION_SLIDER_CONTENT_REVISIONS } from "../games/equation-slider/content-revisions";
import { EQUATION_SLIDER_V3_LEVELS, HAND_AUTHORED_GOLD_TEMPLATES } from "../games/equation-slider/levels/v3/catalog";
import { buildCompleteV3Catalog } from "../games/equation-slider/levels/v3/generator";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import { enumerateArrangements, evaluateArrangementOutcome, findHintContinuation, getMovableReels } from "../games/equation-slider/solver";
import { buildGameplayPilot12Evidence, definitionHash, gameplayHash, retainedDefinitionHash } from "../games/equation-slider/tools/check-gameplay-pilot-12";
import publishedEvidence from "../docs/equation-slider/gameplay-pilot-12-math.json";

describe("equation slider first-chapter gameplay pilot", () => {
  const baseline = buildCompleteV3Catalog(HAND_AUTHORED_GOLD_TEMPLATES, FIRST_GOLD_LEVEL);
  const current = EQUATION_SLIDER_V3_LEVELS;

  it("retains the original 188 definition hashes, exact route order, first board, and level11 board semantics", () => {
    const originalRetainedHash = "2c01404e63c3a627c8d7ce966b7cced980826ed769b11894741846d60d476bbe";
    expect(retainedDefinitionHash(baseline)).toBe(originalRetainedHash);
    expect(retainedDefinitionHash(current)).toBe(originalRetainedHash);
    expect(current.map((level) => [level.id, level.chapterId, level.stationId, level.order, level.stationOrder]))
      .toEqual(baseline.map((level) => [level.id, level.chapterId, level.stationId, level.order, level.stationOrder]));
    expect(current.filter((level, index) => definitionHash(level) !== definitionHash(baseline[index]))
      .map((level) => level.id)).toEqual(Array.from({ length: 11 }, (_, index) => `es-1-${String(index + 2).padStart(2, "0")}`));
    expect(current.filter((level, index) => gameplayHash(level) !== gameplayHash(baseline[index]))
      .map((level) => level.id)).toEqual(Object.keys(EQUATION_SLIDER_CONTENT_REVISIONS));
    expect(current[0]).toEqual(baseline[0]);
    expect(gameplayHash(current[10])).toBe(gameplayHash(baseline[10]));
    expect(current[10].learning.objective).toContain("合成 8");
    expect(current[10].learning.reflection).toContain("得到 8");
    expect(EQUATION_SLIDER_CONTENT_REVISIONS["es-1-11"]).toBeUndefined();
  });

  it("keeps all twelve fixed-plus, at most three number rails and every possible interim result within20", () => {
    for (const level of current.slice(0, 12)) {
      const reels = getMovableReels(level);
      expect(reels.length, level.id).toBeLessThanOrEqual(3);
      expect(reels.every((reel) => reel.kind === "number"), level.id).toBe(true);
      expect(level.slots.filter((slot) => slot.kind === "fixed-token")
        .every((slot) => slot.token === "+"), level.id).toBe(true);
      expect(reels.flatMap((reel) => reel.tiles).every((tile) =>
        Number(tile.value) > 0 && Number(tile.value) <= 10), level.id).toBe(true);
      for (const arrangement of enumerateArrangements(level)) {
        const outcome = evaluateArrangementOutcome(level, arrangement.indexes);
        expect(outcome.failureReason, level.id).toBeUndefined();
        expect(outcome.result, level.id).toBeLessThanOrEqual(20);
      }
    }
  });

  it("continues with legal live hints after arbitrary visible inputs and an undo", () => {
    let seed = 0x4553512;
    for (const level of current.slice(0, 12)) {
      const reels = getMovableReels(level);
      let session = createInitialBoardSession(level);
      for (let step = 0; step < 17 && session.present.status !== "complete"; step += 1) {
        seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
        session = transitionBoardSession(level, session, {
          type: "commit-move", reelId: reels[seed % reels.length].id,
          direction: seed < 0x8000_0000 ? "up" : "down", useFeedbackLock: false
        }).session;
      }
      if (session.present.status !== "complete") {
        const previousMoves = session.present.moveCount;
        session = transitionBoardSession(level, session, { type: "undo" }).session;
        expect(session.present.moveCount, level.id).toBe(previousMoves - 1);
      }
      for (let step = 0; step < 100 && session.present.status !== "complete"; step += 1) {
        const hint = findHintContinuation(level, session.present.indexes,
          session.present.coveredTileIds, session.present.completedTargetIds);
        expect(hint?.reelId, level.id).toBeDefined();
        expect(hint?.direction, level.id).toBeDefined();
        const transition = transitionBoardSession(level, session, {
          type: "commit-move", reelId: hint!.reelId!, direction: hint!.direction!, useFeedbackLock: false
        });
        expect(transition.committed, level.id).toBe(true);
        session = transition.session;
      }
      expect(session.present.status, level.id).toBe("complete");
      expect(session.present.coveredTileIds.size, level.id).toBe(level.requiredTileIds.length);
    }
  });

  it("reproduces source-bound evidence, including honest isomorphism and fixed-input diagnostics", () => {
    const evidence = buildGameplayPilot12Evidence();
    expect(evidence).toEqual(publishedEvidence);
    expect(evidence.invalid).toEqual([]);
    expect(evidence.currentSourceCounts).toEqual({
      originalTemplates: 40, authored: 42, generated: 158, boardRevisions: 10, copyOnlyRevisions: 1
    });
    expect(evidence.beforeCoverageFamilies[0]).toEqual([
      "es-1-01", "es-1-02", "es-1-03", "es-1-04", "es-1-05", "es-1-11", "es-1-12"
    ]);
    expect(evidence.afterCoverageFamilies[0]).toEqual([
      "es-1-01", "es-1-02", "es-1-03", "es-1-04", "es-1-05", "es-1-06", "es-1-11"
    ]);
    for (const level of evidence.pilot) {
      for (const policy of level.diagnostics.policies) {
        expect(policy.actions).toHaveLength(48);
        expect(policy.before.checkpoints.map((checkpoint) => checkpoint.attempts)).toEqual([24, 48]);
        expect(policy.after.checkpoints.map((checkpoint) => checkpoint.attempts)).toEqual([24, 48]);
      }
    }
  });
});
