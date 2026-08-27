import {
  evaluateArrangementOutcome,
  getMovableReels,
  getRequiredTargetIds
} from "./solver";
import type {
  ArrangementOutcome,
  MoveDirection,
  PublishedEquationSliderLevel
} from "./types";

export type BoardStatus = "ready" | "dragging" | "feedback-lock" | "complete";

export interface BoardState {
  readonly indexes: readonly number[];
  readonly coveredTileIds: ReadonlySet<string>;
  readonly completedTargetIds: ReadonlySet<string>;
  readonly moveCount: number;
  readonly status: BoardStatus;
}

export interface BoardSnapshot {
  readonly indexes: readonly number[];
  readonly coveredTileIds: readonly string[];
  readonly completedTargetIds: readonly string[];
  readonly moveCount: number;
}

export interface BoardSession {
  readonly present: BoardState;
  readonly undoStack: readonly BoardSnapshot[];
  readonly initial: BoardSnapshot;
}

export type BoardAction =
  | { readonly type: "drag-start" }
  | { readonly type: "drag-cancel" }
  | {
      readonly type: "commit-move";
      readonly reelId: string;
      readonly direction: MoveDirection;
      readonly source?: "direct" | "drag";
      readonly useFeedbackLock?: boolean;
    }
  | { readonly type: "feedback-unlock" }
  | { readonly type: "undo" }
  | { readonly type: "reset" };

export interface BoardTransition {
  readonly session: BoardSession;
  readonly committed: boolean;
  readonly rejectionReason?: "same-visible-value";
  readonly rejectedValue?: string;
  readonly outcome?: ArrangementOutcome;
  readonly newlyCoveredTileIds: readonly string[];
  readonly newlyCompletedTargetIds: readonly string[];
}

export function createInitialBoardSession(level: PublishedEquationSliderLevel): BoardSession {
  const initial = createSnapshot({
    indexes: [...level.initialIndexes],
    coveredTileIds: new Set(),
    completedTargetIds: new Set(),
    moveCount: 0,
    status: "ready"
  });
  return {
    present: restoreSnapshot(initial),
    undoStack: [],
    initial
  };
}

export function reduceBoardSession(
  level: PublishedEquationSliderLevel,
  session: BoardSession,
  action: BoardAction
): BoardSession {
  return transitionBoardSession(level, session, action).session;
}

export function transitionBoardSession(
  level: PublishedEquationSliderLevel,
  session: BoardSession,
  action: BoardAction
): BoardTransition {
  assertSessionShape(level, session);
  if (session.present.status === "complete") return unchanged(session);
  if (session.present.status === "feedback-lock" && action.type !== "feedback-unlock") {
    return unchanged(session);
  }
  if (
    session.present.status === "dragging"
    && action.type !== "drag-cancel"
    && !(action.type === "commit-move" && action.source === "drag")
  ) {
    return unchanged(session);
  }
  if (action.type === "drag-start") {
    if (session.present.status !== "ready") return unchanged(session);
    return changed({ ...session, present: { ...session.present, status: "dragging" } });
  }
  if (action.type === "drag-cancel") {
    if (session.present.status !== "dragging") return unchanged(session);
    return changed({ ...session, present: { ...session.present, status: "ready" } });
  }
  if (action.type === "feedback-unlock") {
    if (session.present.status !== "feedback-lock") return unchanged(session);
    return changed({ ...session, present: { ...session.present, status: "ready" } });
  }
  if (action.type === "undo") {
    const previous = session.undoStack.at(-1);
    if (!previous) return unchanged(session);
    return changed({
      ...session,
      present: restoreSnapshot(previous),
      undoStack: session.undoStack.slice(0, -1)
    });
  }
  if (action.type === "reset") {
    return changed({
      ...session,
      present: restoreSnapshot(session.initial),
      undoStack: []
    });
  }
  return commitMove(level, session, action);
}

export function commitMove(
  level: PublishedEquationSliderLevel,
  session: BoardSession,
  action: Extract<BoardAction, { type: "commit-move" }>
): BoardTransition {
  if (session.present.status === "complete" || session.present.status === "feedback-lock") {
    return unchanged(session);
  }
  if (session.present.status === "dragging" && action.source !== "drag") {
    return unchanged(session);
  }
  if (session.present.status === "ready" && action.source === "drag") {
    return unchanged(session);
  }
  const reels = getMovableReels(level);
  const reelIndex = reels.findIndex((reel) => reel.id === action.reelId);
  if (reelIndex < 0) return unchanged(session);

  const snapshot = createSnapshot(session.present);
  const indexes = [...session.present.indexes];
  const currentIndex = indexes[reelIndex];
  const nextIndex = wrapThree(currentIndex + (action.direction === "up" ? -1 : 1));
  const currentValue = reels[reelIndex].tiles[currentIndex]?.value;
  const nextValue = reels[reelIndex].tiles[nextIndex]?.value;
  if (currentValue === nextValue) {
    return {
      session: session.present.status === "dragging"
        ? { ...session, present: { ...session.present, status: "ready" } }
        : session,
      committed: false,
      rejectionReason: "same-visible-value",
      rejectedValue: String(currentValue),
      newlyCoveredTileIds: [],
      newlyCompletedTargetIds: []
    };
  }
  indexes[reelIndex] = nextIndex;
  const outcome = evaluateArrangementOutcome(level, indexes);
  const coveredTileIds = new Set(session.present.coveredTileIds);
  const completedTargetIds = new Set(session.present.completedTargetIds);
  const newlyCoveredTileIds: string[] = [];
  const newlyCompletedTargetIds: string[] = [];

  if (outcome.valid) {
    for (const tileId of outcome.selectedTileIds) {
      if (level.requiredTileIds.includes(tileId) && !coveredTileIds.has(tileId)) {
        coveredTileIds.add(tileId);
        newlyCoveredTileIds.push(tileId);
      }
    }
    for (const targetId of outcome.satisfiedTargetIds) {
      if (!completedTargetIds.has(targetId)) {
        completedTargetIds.add(targetId);
        newlyCompletedTargetIds.push(targetId);
      }
    }
  }

  const complete = level.requiredTileIds.every((tileId) => coveredTileIds.has(tileId))
    && getRequiredTargetIds(level).every((targetId) => completedTargetIds.has(targetId));
  const status: BoardStatus = complete
    ? "complete"
    : outcome.valid && action.useFeedbackLock !== false
      ? "feedback-lock"
      : "ready";
  const next: BoardSession = {
    ...session,
    present: {
      indexes,
      coveredTileIds,
      completedTargetIds,
      moveCount: session.present.moveCount + 1,
      status
    },
    undoStack: [...session.undoStack, snapshot]
  };
  return {
    session: next,
    committed: true,
    outcome,
    newlyCoveredTileIds,
    newlyCompletedTargetIds
  };
}

export function createSnapshot(state: BoardState): BoardSnapshot {
  return {
    indexes: [...state.indexes],
    coveredTileIds: [...state.coveredTileIds].sort(),
    completedTargetIds: [...state.completedTargetIds].sort(),
    moveCount: state.moveCount
  };
}

function restoreSnapshot(snapshot: BoardSnapshot): BoardState {
  return {
    indexes: [...snapshot.indexes],
    coveredTileIds: new Set(snapshot.coveredTileIds),
    completedTargetIds: new Set(snapshot.completedTargetIds),
    moveCount: snapshot.moveCount,
    status: "ready"
  };
}

function assertSessionShape(level: PublishedEquationSliderLevel, session: BoardSession): void {
  const reelCount = getMovableReels(level).length;
  if (session.present.indexes.length !== reelCount) {
    throw new Error(`${level.id}: board index count does not match movable reels`);
  }
  if (session.present.indexes.some((index) => !Number.isInteger(index) || index < 0 || index > 2)) {
    throw new Error(`${level.id}: board indexes must stay inside 0..2`);
  }
}

function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}

function unchanged(session: BoardSession): BoardTransition {
  return {
    session,
    committed: false,
    newlyCoveredTileIds: [],
    newlyCompletedTargetIds: []
  };
}

function changed(session: BoardSession): BoardTransition {
  return {
    session,
    committed: false,
    newlyCoveredTileIds: [],
    newlyCompletedTargetIds: []
  };
}
