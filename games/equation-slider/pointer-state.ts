import type { MoveDirection } from "./types";

export const POINTER_DRAG_START_PX = 14;
export const POINTER_COMMIT_RATIO = 0.35;
export const POINTER_MIN_COMMIT_PX = 16;
export const POINTER_VELOCITY_PX_PER_MS = 0.45;

export interface PointerGesture {
  readonly pointerId: number;
  readonly reelId: string;
  readonly startY: number;
  readonly startedAt: number;
  readonly lastY: number;
  readonly lastAt: number;
  readonly dragging: boolean;
}

export interface PointerPreview {
  readonly gesture: PointerGesture;
  readonly offsetY: number;
}

export interface PointerFinish {
  readonly commit: boolean;
  readonly direction?: MoveDirection;
  readonly suppressClick: boolean;
}

export function beginPointerGesture(input: {
  readonly pointerId: number;
  readonly reelId: string;
  readonly clientY: number;
  readonly time: number;
}): PointerGesture {
  return {
    pointerId: input.pointerId,
    reelId: input.reelId,
    startY: input.clientY,
    startedAt: input.time,
    lastY: input.clientY,
    lastAt: input.time,
    dragging: false
  };
}

export function updatePointerGesture(
  gesture: PointerGesture,
  clientY: number,
  time: number,
  tileHeight: number
): PointerPreview {
  const delta = clientY - gesture.startY;
  return {
    gesture: {
      ...gesture,
      lastY: clientY,
      lastAt: time,
      dragging: gesture.dragging || Math.abs(delta) >= POINTER_DRAG_START_PX
    },
    offsetY: clamp(delta, -Math.max(1, tileHeight), Math.max(1, tileHeight))
  };
}

export function finishPointerGesture(gesture: PointerGesture, tileHeight: number): PointerFinish {
  const delta = gesture.lastY - gesture.startY;
  const distance = Math.abs(delta);
  const duration = Math.max(1, gesture.lastAt - gesture.startedAt);
  const velocity = distance / duration;
  const threshold = Math.max(POINTER_MIN_COMMIT_PX, Math.max(1, tileHeight) * POINTER_COMMIT_RATIO);
  const commit = gesture.dragging
    && (distance >= threshold || (distance >= POINTER_MIN_COMMIT_PX && velocity >= POINTER_VELOCITY_PX_PER_MS));
  return {
    commit,
    ...(commit ? { direction: delta > 0 ? "up" : "down" } : {}),
    suppressClick: gesture.dragging
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
