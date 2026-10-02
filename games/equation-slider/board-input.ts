import { bindInputLifecycle, ignoreGameKey } from '../../packages/ui/input';
import { beginPointerGesture, finishPointerGesture, updatePointerGesture, type PointerGesture } from './pointer-state';
import type { BoardSession } from './board-state';
import type { TilePosition } from './render-model';
import type { MoveDirection, PublishedEquationSliderLevel } from './types';
import type { ReelDom } from './board-view';
import { getMovableReels } from './solver';
import { wrapThree } from './view-helpers';
interface ActivePointer {
  readonly window: HTMLElement;
  readonly reelRoot: HTMLElement;
  readonly tileHeight: number;
  readonly tapTileId: string;
  gesture: PointerGesture;
}


interface BoardInputPorts {
  root: HTMLElement;
  level: PublishedEquationSliderLevel;
  reelDoms: ReadonlyMap<string, ReelDom>;
  signal: AbortSignal;
  session: () => BoardSession;
  dragStart: () => void;
  dragCancel: () => void;
  preview: (indexes: readonly number[]) => void;
  dispatchMove: (id: string, direction: MoveDirection, source?: 'direct' | 'drag') => void;
}
/** One binding per mounted board. Pointer capture never belongs to a render. */
export function bindBoardInputs(ports: BoardInputPorts) {
  const { root, level, reelDoms, signal, dispatchMove } = ports;
  let pointer: ActivePointer | null = null;
  let suppressClickUntil = 0;
  function clickTile(reelId: string, tile: HTMLButtonElement): void {
    if (performance.now() < suppressClickUntil) return;
    const position = tile.dataset.position as TilePosition | undefined;
    if (position === 'previous') dispatchMove(reelId, 'up');
    if (position === 'next') dispatchMove(reelId, 'down');
  }
  for (const dom of reelDoms.values()) {
    installPointerAdapter(dom);
    dom.window.addEventListener('keydown', event => {
      if (ignoreGameKey(event, dom.window) || event.shiftKey) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      dispatchMove(dom.reel.id, event.key === 'ArrowUp' ? 'up' : 'down');
    }, { signal });
  }
    function installPointerAdapter(reelDom: ReelDom): void {
      reelDom.window.addEventListener("pointerdown", (event) => {
        if (pointer || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        if (ports.session().present.status !== "ready") return;
        const tile = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tile-id]") : null;
        if (!tile) return;
        const tileHeight = tile.getBoundingClientRect().height || 42;
        pointer = {
          window: reelDom.window,
          reelRoot: reelDom.root,
          tileHeight,
          tapTileId: tile.dataset.tileId ?? "",
          gesture: beginPointerGesture({
            pointerId: event.pointerId,
            reelId: reelDom.reel.id,
            clientY: event.clientY,
            time: event.timeStamp
          })
        };
        reelDom.window.setPointerCapture(event.pointerId);
      }, { signal });

      reelDom.window.addEventListener("pointermove", (event) => {
        if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
        const wasDragging = pointer.gesture.dragging;
        const preview = updatePointerGesture(pointer.gesture, event.clientY, event.timeStamp, pointer.tileHeight);
        pointer.gesture = preview.gesture;
        if (!wasDragging && preview.gesture.dragging) {
          pointer.reelRoot.classList.add("is-dragging");
          ports.dragStart();
        }
        if (!preview.gesture.dragging) return;
        event.preventDefault();
        pointer.reelRoot.style.setProperty("--preview-y", `${preview.offsetY}px`);
        const previewIndexes = [...ports.session().present.indexes];
        const reelIndex = getMovableReels(level).findIndex((reel) => reel.id === pointer?.gesture.reelId);
        if (reelIndex >= 0) {
          previewIndexes[reelIndex] = wrapThree(previewIndexes[reelIndex] + (preview.offsetY > 0 ? -1 : 1));
          ports.preview(previewIndexes);
        }
      }, { signal });

      reelDom.window.addEventListener("pointerup", (event) => finishPointer(event, false), { signal });
      reelDom.window.addEventListener("pointercancel", (event) => finishPointer(event, true), { signal });
      reelDom.window.addEventListener("lostpointercapture", (event) => {
        if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
        cancelPointer();
      }, { signal });
    }

    function finishPointer(event: PointerEvent, cancelled: boolean): void {
      if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
      const active = pointer;
      const preview = updatePointerGesture(active.gesture, event.clientY, event.timeStamp, active.tileHeight);
      active.gesture = preview.gesture;
      const result = finishPointerGesture(active.gesture, active.tileHeight);
      pointer = null;
      active.reelRoot.classList.remove("is-dragging");
      active.reelRoot.style.removeProperty("--preview-y");
      if (result.suppressClick) suppressClickUntil = performance.now() + 400;
      if (active.window.hasPointerCapture(event.pointerId)) active.window.releasePointerCapture(event.pointerId);
      if (!cancelled && !active.gesture.dragging) {
        suppressClickUntil = performance.now() + 400;
        const tappedTile = reelDoms.get(active.gesture.reelId)?.tileElements.get(active.tapTileId);
        const position = tappedTile?.dataset.position as TilePosition | undefined;
        if (position === "previous") dispatchMove(active.gesture.reelId, "up");
        if (position === "next") dispatchMove(active.gesture.reelId, "down");
        return;
      }
      if (cancelled || !result.commit || !result.direction) {
        ports.dragCancel();
        return;
      }
      dispatchMove(active.gesture.reelId, result.direction, "drag");
    }

    function cancelPointer(): void {
      if (!pointer) return;
      const active = pointer;
      pointer = null;
      active.reelRoot.classList.remove("is-dragging");
      active.reelRoot.style.removeProperty("--preview-y");
      if (active.window.hasPointerCapture(active.gesture.pointerId)) active.window.releasePointerCapture(active.gesture.pointerId);
      suppressClickUntil = performance.now() + 400;
      ports.dragCancel();
    }


  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !pointer || ignoreGameKey(event, root)) return;
    event.preventDefault(); cancelPointer();
  }, { signal });
  const stopInputs = bindInputLifecycle(root, cancelPointer);
  return {
    get active() { return pointer !== null; },
    clickTile,
    destroy() {
      stopInputs();
      // Drop ownership before release so lostpointercapture cannot repaint a disposed board.
      const active = pointer; pointer = null;
      if (active?.window.hasPointerCapture(active.gesture.pointerId)) active.window.releasePointerCapture(active.gesture.pointerId);
    }
  };
}
