import {
  createInitialBoardSession,
  transitionBoardSession
} from "../games/equation-slider/board-state";
import { EQUATION_SLIDER_V3_LEVELS } from "../games/equation-slider/levels/v3/catalog";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import { getMovableReels, getRequiredTargetIds } from "../games/equation-slider/solver";

const LEFT_REEL_ID = "es-1-01-left";
const RIGHT_REEL_ID = "es-1-01-right";

describe("equation slider V3 board state", () => {
  it("wraps every reel index modulo three in both directions", () => {
    const initial = createInitialBoardSession(FIRST_GOLD_LEVEL);
    const rightUp = transitionBoardSession(FIRST_GOLD_LEVEL, initial, {
      type: "commit-move",
      reelId: RIGHT_REEL_ID,
      direction: "up",
      useFeedbackLock: false
    }).session;
    const rightDown = transitionBoardSession(FIRST_GOLD_LEVEL, initial, {
      type: "commit-move",
      reelId: RIGHT_REEL_ID,
      direction: "down",
      useFeedbackLock: false
    }).session;

    expect(rightUp.present.indexes).toEqual([2, 2]);
    expect(rightDown.present.indexes).toEqual([2, 1]);
  });

  it("does not add coverage or target progress for an invalid expression", () => {
    const initial = createInitialBoardSession(FIRST_GOLD_LEVEL);
    const transition = transitionBoardSession(FIRST_GOLD_LEVEL, initial, {
      type: "commit-move",
      reelId: LEFT_REEL_ID,
      direction: "up",
      useFeedbackLock: false
    });

    expect(transition.outcome).toMatchObject({
      valid: false,
      expressionText: "2 + 5"
    });
    expect(transition.newlyCoveredTileIds).toEqual([]);
    expect(transition.newlyCompletedTargetIds).toEqual([]);
    expect(transition.session.present.coveredTileIds.size).toBe(0);
    expect(transition.session.present.completedTargetIds.size).toBe(0);
  });

  it("completes only after all three correct expressions cover six tile identities", () => {
    let session = createInitialBoardSession(FIRST_GOLD_LEVEL);

    session = commit(session, RIGHT_REEL_ID, "up");
    expect(session.present.indexes).toEqual([2, 2]);
    expect(session.present.coveredTileIds).toEqual(
      new Set(["es-1-01-left-4", "es-1-01-right-2"])
    );
    expect(session.present.status).toBe("ready");

    session = commit(session, LEFT_REEL_ID, "down");
    expect(session.present.coveredTileIds.size).toBe(2);
    session = commit(session, RIGHT_REEL_ID, "down");
    expect(session.present.indexes).toEqual([0, 0]);
    expect(session.present.coveredTileIds.size).toBe(4);

    session = commit(session, LEFT_REEL_ID, "down");
    expect(session.present.coveredTileIds.size).toBe(4);
    session = commit(session, RIGHT_REEL_ID, "down");

    expect(session.present.indexes).toEqual([1, 1]);
    expect(session.present.coveredTileIds).toEqual(new Set(FIRST_GOLD_LEVEL.requiredTileIds));
    expect(session.present.completedTargetIds).toEqual(new Set(["es-1-01-target-6"]));
    expect(session.present.moveCount).toBe(5);
    expect(session.present.status).toBe("complete");
    expect(session.present.coveredTileIds.has("es-1-01-plus")).toBe(false);
  });

  it("undoes one committed move and reset restores the exact initial snapshot", () => {
    const initial = createInitialBoardSession(FIRST_GOLD_LEVEL);
    const afterOne = commit(initial, LEFT_REEL_ID, "up");
    const afterTwo = commit(afterOne, RIGHT_REEL_ID, "down");
    const undone = transitionBoardSession(FIRST_GOLD_LEVEL, afterTwo, { type: "undo" }).session;
    const reset = transitionBoardSession(FIRST_GOLD_LEVEL, afterTwo, { type: "reset" }).session;

    expect(undone.present.indexes).toEqual(afterOne.present.indexes);
    expect(undone.present.moveCount).toBe(1);
    expect(undone.undoStack).toHaveLength(1);
    expect(reset.present.indexes).toEqual(FIRST_GOLD_LEVEL.initialIndexes);
    expect(reset.present.coveredTileIds.size).toBe(0);
    expect(reset.present.completedTargetIds.size).toBe(0);
    expect(reset.present.moveCount).toBe(0);
    expect(reset.present.status).toBe("ready");
    expect(reset.undoStack).toEqual([]);
  });

  it("returns new snapshots without mutating the previous session", () => {
    const initial = createInitialBoardSession(FIRST_GOLD_LEVEL);
    const originalIndexes = [...initial.present.indexes];
    const originalCovered = initial.present.coveredTileIds;
    const transition = transitionBoardSession(FIRST_GOLD_LEVEL, initial, {
      type: "commit-move",
      reelId: RIGHT_REEL_ID,
      direction: "up",
      useFeedbackLock: false
    });

    expect(transition.session).not.toBe(initial);
    expect(transition.session.present).not.toBe(initial.present);
    expect(transition.session.present.indexes).not.toBe(initial.present.indexes);
    expect(transition.session.present.coveredTileIds).not.toBe(originalCovered);
    expect(initial.present.indexes).toEqual(originalIndexes);
    expect(initial.present.coveredTileIds.size).toBe(0);
    expect(initial.present.completedTargetIds.size).toBe(0);
    expect(initial.present.moveCount).toBe(0);
    expect(initial.undoStack).toEqual([]);
  });

  it("serializes drag input so a direct second adapter cannot commit concurrently", () => {
    const initial = createInitialBoardSession(FIRST_GOLD_LEVEL);
    const dragging = transitionBoardSession(FIRST_GOLD_LEVEL, initial, { type: "drag-start" }).session;
    const rejectedDirect = transitionBoardSession(FIRST_GOLD_LEVEL, dragging, {
      type: "commit-move",
      reelId: RIGHT_REEL_ID,
      direction: "up",
      source: "direct",
      useFeedbackLock: false
    });
    const committedDrag = transitionBoardSession(FIRST_GOLD_LEVEL, dragging, {
      type: "commit-move",
      reelId: RIGHT_REEL_ID,
      direction: "up",
      source: "drag",
      useFeedbackLock: false
    });

    expect(rejectedDirect.committed).toBe(false);
    expect(rejectedDirect.session).toBe(dragging);
    expect(rejectedDirect.session.present.indexes).toEqual(initial.present.indexes);
    expect(committedDrag.committed).toBe(true);
    expect(committedDrag.session.present.indexes).toEqual([2, 2]);
    expect(committedDrag.session.present.status).toBe("ready");
  });

  it("rejects value-identical reel moves while preserving a visible two-step route", () => {
    const level = EQUATION_SLIDER_V3_LEVELS.find((candidate) => {
      const reels = getMovableReels(candidate);
      return reels.some((reel, reelIndex) => {
        const current = candidate.initialIndexes[reelIndex];
        return (["up", "down"] as const).some((direction) => {
          const next = wrapThree(current + (direction === "up" ? -1 : 1));
          return reel.tiles[current].value === reel.tiles[next].value;
        });
      });
    });
    if (!level) throw new Error("Expected a published same-visible-value fixture");
    const reels = getMovableReels(level);
    const reelIndex = reels.findIndex((reel, index) => {
      const current = level.initialIndexes[index];
      return (["up", "down"] as const).some((direction) => {
        const next = wrapThree(current + (direction === "up" ? -1 : 1));
        return reel.tiles[current].value === reel.tiles[next].value;
      });
    });
    const reel = reels[reelIndex];
    const current = level.initialIndexes[reelIndex];
    const blockedDirection = (["up", "down"] as const).find((direction) => {
      const next = wrapThree(current + (direction === "up" ? -1 : 1));
      return reel.tiles[current].value === reel.tiles[next].value;
    });
    if (!blockedDirection) throw new Error("Expected a blocked direction");

    const initial = createInitialBoardSession(level);
    const rejected = transitionBoardSession(level, initial, {
      type: "commit-move",
      reelId: reel.id,
      direction: blockedDirection,
      useFeedbackLock: false
    });
    expect(rejected).toMatchObject({ committed: false, rejectionReason: "same-visible-value" });
    expect(rejected.session.present.indexes).toEqual(initial.present.indexes);
    expect(rejected.session.present.moveCount).toBe(0);

    const visibleDirection = blockedDirection === "up" ? "down" : "up";
    const firstVisible = transitionBoardSession(level, initial, {
      type: "commit-move",
      reelId: reel.id,
      direction: visibleDirection,
      useFeedbackLock: false
    });
    const secondVisible = transitionBoardSession(level, firstVisible.session, {
      type: "commit-move",
      reelId: reel.id,
      direction: visibleDirection,
      useFeedbackLock: false
    });
    expect(firstVisible.committed).toBe(true);
    expect(secondVisible.committed).toBe(true);
    expect(secondVisible.session.present.indexes[reelIndex]).toBe(
      wrapThree(current + (blockedDirection === "up" ? -1 : 1))
    );
  });

  it("preserves board invariants after 1000 deterministic mixed actions", () => {
    let randomState = 0x45_53_56_33;
    let session = createInitialBoardSession(EQUATION_SLIDER_V3_LEVELS[0]);
    let activeLevel = EQUATION_SLIDER_V3_LEVELS[0];

    const nextRandom = (): number => {
      randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
      return randomState;
    };

    for (let step = 0; step < 1_000; step += 1) {
      if (step % 37 === 0) {
        activeLevel = EQUATION_SLIDER_V3_LEVELS[nextRandom() % EQUATION_SLIDER_V3_LEVELS.length];
        session = createInitialBoardSession(activeLevel);
      }

      const previous = session;
      const previousIndexes = [...previous.present.indexes];
      const previousCovered = [...previous.present.coveredTileIds];
      const previousTargets = [...previous.present.completedTargetIds];
      const actionChoice = nextRandom() % 8;
      const reels = getMovableReels(activeLevel);

      if (actionChoice < 4) {
        const reel = reels[nextRandom() % reels.length];
        session = transitionBoardSession(activeLevel, session, {
          type: "commit-move",
          reelId: reel.id,
          direction: nextRandom() % 2 === 0 ? "up" : "down",
          source: session.present.status === "dragging" && nextRandom() % 2 === 0 ? "drag" : "direct",
          useFeedbackLock: false
        }).session;
      } else if (actionChoice === 4) {
        session = transitionBoardSession(activeLevel, session, { type: "undo" }).session;
      } else if (actionChoice === 5) {
        session = transitionBoardSession(activeLevel, session, { type: "reset" }).session;
      } else if (actionChoice === 6) {
        session = transitionBoardSession(activeLevel, session, { type: "drag-start" }).session;
      } else {
        session = transitionBoardSession(activeLevel, session, { type: "drag-cancel" }).session;
      }

      expect(previous.present.indexes).toEqual(previousIndexes);
      expect([...previous.present.coveredTileIds]).toEqual(previousCovered);
      expect([...previous.present.completedTargetIds]).toEqual(previousTargets);
      expect(session.present.indexes).toHaveLength(reels.length);
      expect(session.present.indexes.every((index) => Number.isInteger(index) && index >= 0 && index <= 2)).toBe(true);
      expect([...session.present.coveredTileIds].every((tileId) => activeLevel.requiredTileIds.includes(tileId))).toBe(true);
      expect([...session.present.completedTargetIds].every((targetId) => getRequiredTargetIds(activeLevel).includes(targetId))).toBe(true);
      expect(Number.isInteger(session.present.moveCount) && session.present.moveCount >= 0).toBe(true);
      expect(["ready", "dragging", "feedback-lock", "complete"]).toContain(session.present.status);

      if (session.present.status === "complete") {
        expect(activeLevel.requiredTileIds.every((tileId) => session.present.coveredTileIds.has(tileId))).toBe(true);
        expect(getRequiredTargetIds(activeLevel).every((targetId) => session.present.completedTargetIds.has(targetId))).toBe(true);
      }
    }
  });
});

function commit(
  session: ReturnType<typeof createInitialBoardSession>,
  reelId: string,
  direction: "up" | "down"
): ReturnType<typeof createInitialBoardSession> {
  return transitionBoardSession(FIRST_GOLD_LEVEL, session, {
    type: "commit-move",
    reelId,
    direction,
    useFeedbackLock: false
  }).session;
}

function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}
