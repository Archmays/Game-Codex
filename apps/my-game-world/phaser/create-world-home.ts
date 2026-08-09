import Phaser from "phaser";
import type { WorldHomeState } from "../world-state";
import { WorldHomeScene } from "./WorldHomeScene";

export interface WorldHomeCanvasHandle {
  setView(view: WorldHomeState): void;
  destroy(): void;
}

export function createWorldHome(parent: HTMLElement, initialView: WorldHomeState): WorldHomeCanvasHandle {
  const scene = new WorldHomeScene(initialView);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 1200,
    height: 680,
    backgroundColor: "#071c2a",
    transparent: false,
    render: { antialias: true, pixelArt: false, roundPixels: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1200,
      height: 680,
    },
    input: { activePointers: 1, touch: { capture: false } },
    audio: { disableWebAudio: true },
    scene,
  });
  parent.querySelector("canvas")?.setAttribute("data-testid", "world-home-canvas");
  parent.querySelector("canvas")?.setAttribute("aria-hidden", "true");
  return {
    setView(view) { scene.setView(view); },
    destroy() { game.destroy(true); },
  };
}
