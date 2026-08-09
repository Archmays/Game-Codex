import Phaser from "phaser";
import { PilotScene, type PilotWorldView } from "./PilotScene";

export interface PilotWorldHandle {
  setView(view: PilotWorldView): void;
  destroy(): void;
}

export function createPilotGame(parent: HTMLElement, initialView: PilotWorldView): PilotWorldHandle {
  const scene = new PilotScene();
  scene.setView(initialView);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#18243a",
    transparent: false,
    render: { antialias: true, pixelArt: false, roundPixels: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    audio: { disableWebAudio: true },
    scene,
  });

  return {
    setView(view) {
      scene.setView(view);
    },
    destroy() {
      game.destroy(true);
    },
  };
}
