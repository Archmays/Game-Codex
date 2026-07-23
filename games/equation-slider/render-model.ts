import { evaluateArrangementOutcome } from "./solver";
import type { BoardState } from "./board-state";
import type {
  ArithmeticToken,
  EquationTile,
  PublishedEquationSliderLevel,
  ReelDefinition
} from "./types";

export type TilePosition = "previous" | "current" | "next";

export interface TileRenderModel {
  readonly tile: EquationTile;
  readonly position: TilePosition;
  readonly selected: boolean;
  readonly lit: boolean;
}

export interface ReelRenderModel {
  readonly kind: "movable-reel";
  readonly reel: ReelDefinition;
  readonly slotIndex: number;
  readonly movableIndex: number;
  readonly currentIndex: number;
  readonly tiles: readonly TileRenderModel[];
}

export interface FixedTokenRenderModel {
  readonly kind: "fixed-token";
  readonly id: string;
  readonly slotIndex: number;
  readonly token: ArithmeticToken;
  readonly ariaLabel: string;
}

export type SlotRenderModel = ReelRenderModel | FixedTokenRenderModel;

export interface BoardRenderModel {
  readonly levelId: string;
  readonly slots: readonly SlotRenderModel[];
  readonly expressionText: string;
  readonly formalTileIds: readonly string[];
}

export function createBoardRenderModel(
  level: PublishedEquationSliderLevel,
  state: BoardState
): BoardRenderModel {
  let movableIndex = 0;
  const slots = level.slots.map((slot, slotIndex): SlotRenderModel => {
    if (slot.kind === "fixed-token") {
      return {
        kind: "fixed-token",
        id: slot.id,
        slotIndex,
        token: slot.token,
        ariaLabel: slot.ariaLabel
      };
    }
    const currentIndex = state.indexes[movableIndex];
    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex > 2) {
      throw new Error(`${level.id}: missing V3 index for movable reel ${slot.reel.id}`);
    }
    const model: ReelRenderModel = {
      kind: "movable-reel",
      reel: slot.reel,
      slotIndex,
      movableIndex,
      currentIndex,
      tiles: slot.reel.tiles.map((tile, tileIndex): TileRenderModel => ({
        tile,
        position: positionFor(tileIndex, currentIndex),
        selected: tileIndex === currentIndex,
        lit: state.coveredTileIds.has(tile.id)
      }))
    };
    movableIndex += 1;
    return model;
  });
  if (movableIndex !== state.indexes.length) {
    throw new Error(`${level.id}: render indexes do not match movable reel count`);
  }
  const formalTileIds = slots.flatMap((slot) =>
    slot.kind === "movable-reel" ? slot.tiles.map((tile) => tile.tile.id) : []
  );
  if (new Set(formalTileIds).size !== formalTileIds.length) {
    throw new Error(`${level.id}: render model contains duplicate formal tile IDs`);
  }
  return {
    levelId: level.id,
    slots,
    expressionText: evaluateArrangementOutcome(level, state.indexes).expressionText,
    formalTileIds
  };
}

function positionFor(tileIndex: number, currentIndex: number): TilePosition {
  if (tileIndex === currentIndex) return "current";
  return tileIndex === wrapThree(currentIndex - 1) ? "previous" : "next";
}

function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}
