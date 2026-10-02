import type { BoardSession } from './board-state';
import type { createBoardRenderModel } from './render-model';
import type { MoveDirection, PublishedEquationSliderLevel, ReelDefinition } from './types';
import { element, button, positionLabel, wrapThree } from './view-helpers';
interface ReelDom {
  readonly reel: ReelDefinition;
  readonly root: HTMLElement;
  readonly window: HTMLElement;
  readonly controls: readonly HTMLButtonElement[];
  readonly tileElements: ReadonlyMap<string, HTMLButtonElement>;
}


/** Construct once per board; ordinary renders keep every tile and control node. */
export function createReelBoard(level: PublishedEquationSliderLevel, dispatchMove: (id: string, direction: MoveDirection) => void, onTileClick: (id: string, tile: HTMLButtonElement) => void, signal: AbortSignal) {
    const board = element("section", "equation-slider__track");
    board.dataset.equationBoard = "true";
    board.dataset.levelId = level.id;
    board.setAttribute("aria-label", "算式滑轨棋盘");
    board.style.setProperty("--slot-count", String(level.slots.length));
    const reelDoms = new Map<string, ReelDom>();
    let movableIndex = 0;
    for (const slot of level.slots) {
      if (slot.kind === "fixed-token") {
        const fixed = element("span", "equation-slider__fixed-token", String(slot.token));
        fixed.dataset.fixedToken = String(slot.token);
        fixed.setAttribute("role", "math");
        fixed.setAttribute("aria-label", slot.ariaLabel);
        board.append(fixed);
        continue;
      }
      const reelNumber = movableIndex + 1;
      const reelRoot = element("div", "equation-slider__reel");
      reelRoot.dataset.reelId = slot.reel.id;
      reelRoot.dataset.movableIndex = String(movableIndex);
      const up = button("↑ 选上格", () => dispatchMove(slot.reel.id, "up"), "equation-slider__reel-control", signal);
      up.dataset.controlDirection = "up";
      up.setAttribute("aria-label", `第 ${reelNumber} 列选上方格`);
      const reelWindow = element("div", "equation-slider__reel-window");
      reelWindow.dataset.reelWindow = "true";
      reelWindow.tabIndex = 0;
      reelWindow.setAttribute("role", "group");
      reelWindow.setAttribute("aria-roledescription", slot.reel.kind === "number" ? "数字滑轨" : "运算符滑轨");
      const tileElements = new Map<string, HTMLButtonElement>();
      for (const tile of slot.reel.tiles) {
        const tileButton = element("button", "equation-slider__tile");
        tileButton.type = "button";
        tileButton.tabIndex = -1;
        tileButton.dataset.tileId = tile.id;
        tileButton.textContent = String(tile.value);
        tileButton.addEventListener("click", () => onTileClick(slot.reel.id, tileButton), { signal });
        tileElements.set(tile.id, tileButton);
        reelWindow.append(tileButton);
      }
      const down = button("↓ 选下格", () => dispatchMove(slot.reel.id, "down"), "equation-slider__reel-control", signal);
      down.dataset.controlDirection = "down";
      down.setAttribute("aria-label", `第 ${reelNumber} 列选下方格`);
      reelRoot.append(up, reelWindow, down);
      board.append(reelRoot);
      const reelDom: ReelDom = {
        reel: slot.reel,
        root: reelRoot,
        window: reelWindow,
        controls: [up, down],
        tileElements
      };
      reelDoms.set(slot.reel.id, reelDom);
      movableIndex += 1;
    }
    return { board, reelDoms };
}
export type { ReelDom };

/** Paint from the established render model without replacing focused or captured nodes. */
export function updateReelBoard(reelDoms: ReadonlyMap<string, ReelDom>, model: ReturnType<typeof createBoardRenderModel>, state: BoardSession['present'], hintReelId?: string, lastMovedReelId?: string): void {
  const locked = state.status !== 'ready';
      for (const slot of model.slots) {
        if (slot.kind !== "movable-reel") continue;
        const dom = reelDoms.get(slot.reel.id);
        if (!dom) continue;
        dom.root.classList.toggle("is-hinted", hintReelId === slot.reel.id);
        dom.root.classList.toggle("is-last-moved", lastMovedReelId === slot.reel.id);
        const currentIndex = state.indexes[slot.movableIndex];
        for (const [controlIndex, control] of dom.controls.entries()) {
          const direction: MoveDirection = controlIndex === 0 ? "up" : "down";
          const nextIndex = wrapThree(currentIndex + (direction === "up" ? -1 : 1));
          const sameVisibleValue = slot.reel.tiles[currentIndex]?.value === slot.reel.tiles[nextIndex]?.value;
          control.disabled = locked;
          control.dataset.sameVisibleValue = String(sameVisibleValue);
          control.setAttribute(
            "aria-label",
            `第 ${slot.movableIndex + 1} 列选${direction === "up" ? "上" : "下"}方格${sameVisibleValue ? "；相邻方块数值相同，按下会提示改走另一方向" : ""}`
          );
          control.title = sameVisibleValue ? "相邻方块数值相同；改走另一方向会改变算式" : "";
        }
        dom.window.setAttribute("aria-disabled", String(locked));
        const current = slot.tiles.find((tile) => tile.position === "current");
        const reelStateDescription = slot.tiles
          .map((tile) => `${positionLabel(tile.position)} ${String(tile.tile.value)}，${tile.lit ? "已点亮" : "未点亮"}`)
          .join("；");
        dom.window.setAttribute(
          "aria-label",
          `第 ${slot.movableIndex + 1} 列，${slot.reel.kind === "number" ? "数字" : "运算符"}滑轨；${reelStateDescription}；中央值是 ${String(current?.tile.value ?? "未知")}；可用上下方向键移动`
        );
        for (const tileModel of slot.tiles) {
          const tile = dom.tileElements.get(tileModel.tile.id);
          if (!tile) continue;
          tile.dataset.position = tileModel.position;
          // Keep the pressed tile enabled while dragging so disabling it cannot
          // cancel the browser's active pointer capture. Direct adapters are
          // still serialized by dispatchMove and all other controls are locked.
          tile.disabled = state.status === "feedback-lock" || state.status === "complete";
          tile.classList.toggle("is-current", tileModel.selected);
          tile.classList.toggle("is-lit", tileModel.lit);
          tile.setAttribute("aria-pressed", String(tileModel.selected));
          tile.setAttribute("aria-label", `${positionLabel(tileModel.position)}${String(tileModel.tile.value)}${tileModel.lit ? "，已点亮" : "，未点亮"}`);
          tile.removeAttribute("data-tutorial-target");
        }
      }
}
