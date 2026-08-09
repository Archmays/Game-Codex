import Phaser from "phaser";
import { GoldenSliceScene } from "./GoldenSliceScene";
import type { GoldenSliceWorldViewModel } from "./WorldView";

export interface GoldenSliceWorldHandle {
  setView(view: GoldenSliceWorldViewModel): void;
  setInputEnabled(enabled: boolean): void;
  destroy(): void;
}

export function createGoldenSliceGame(
  parent: HTMLElement,
  initialView: GoldenSliceWorldViewModel,
): GoldenSliceWorldHandle {
  const scene = new GoldenSliceScene();
  scene.setView(initialView);
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
    input: {
      activePointers: 2,
      touch: { capture: false },
    },
    audio: { disableWebAudio: true },
    scene,
  });
  let inputEnabled = true;
  const applyInputGate = () => {
    if (scene.input) scene.input.enabled = inputEnabled;
  };
  game.events.on("hanzi-v2-step03-scene-ready", applyInputGate);
  const canvas = parent.querySelector("canvas");
  canvas?.setAttribute("data-testid", "golden-world-canvas");
  canvas?.setAttribute("aria-hidden", "true");

  return {
    setView(view) {
      scene.setView(view);
    },
    setInputEnabled(enabled) {
      inputEnabled = enabled;
      applyInputGate();
    },
    destroy() {
      game.events.off("hanzi-v2-step03-scene-ready", applyInputGate);
      game.destroy(true);
    },
  };
}
