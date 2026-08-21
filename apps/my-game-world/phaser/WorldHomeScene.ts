import Phaser from "phaser";
import { THEME_C } from "../../../games/hanzi-radical-battle/v2/golden-slice/phaser/WorldView";
import type { WorldHomeState } from "../world-state";
import { v1AssetUrl } from "../../../games/hanzi-radical-battle/v2/v1/assets";

export class WorldHomeScene extends Phaser.Scene {
  private view: WorldHomeState;
  private worldGraphics: Phaser.GameObjects.Graphics | null = null;
  private ambient: Phaser.GameObjects.Arc[] = [];
  private background: Phaser.GameObjects.Image | null = null;
  private hero: Phaser.GameObjects.Image | null = null;
  private companion: Phaser.GameObjects.Image | null = null;
  private treasure: Phaser.GameObjects.Image | null = null;
  private portal: Phaser.GameObjects.Image | null = null;

  constructor(initialView: WorldHomeState) {
    super({ key: "WorldHomeScene" });
    this.view = initialView;
  }

  preload(): void {
    for (const id of ["A1", "A3", "A4", "A15", "A16"] as const) this.load.image(id, v1AssetUrl(id));
  }

  create(): void {
    this.background = this.add.image(600, 340, "A1").setDepth(0).setDisplaySize(1200, 680);
    this.worldGraphics = this.add.graphics().setDepth(1);
    this.hero = this.add.image(470, 618, "A3").setOrigin(0.5, 1).setDepth(3);
    this.companion = this.add.image(615, 590, "A4").setOrigin(0.5, 1).setDepth(4);
    this.treasure = this.add.image(1060, 360, "A15").setDepth(3);
    this.portal = this.add.image(790, 515, "A16").setOrigin(0.5, 1).setDepth(2);
    this.fit(this.hero, 230, 330); this.fit(this.companion, 130, 150); this.fit(this.treasure, 175, 150); this.fit(this.portal, 260, 310);
    this.createAmbientLights();
    this.draw();
  }

  setView(view: WorldHomeState): void {
    this.view = view;
    if (this.worldGraphics) this.draw();
    this.setAmbientMotion();
  }

  private createAmbientLights(): void {
    const points = [[154, 174], [354, 108], [682, 154], [934, 100], [1080, 196]] as const;
    this.ambient = points.map(([x, y], index) => {
      const light = this.add.circle(x, y, index % 2 ? 3 : 4, index % 2 ? THEME_C.violet : THEME_C.gold, 0.72);
      this.tweens.add({
        targets: light,
        alpha: { from: 0.34, to: 0.82 },
        scale: { from: 0.8, to: 1.25 },
        duration: 2600 + index * 310,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      return light;
    });
    this.setAmbientMotion();
  }

  private setAmbientMotion(): void {
    const reduced = this.view.settings.reducedMotion;
    for (const light of this.ambient) {
      this.tweens.getTweensOf(light).forEach((tween) => { tween.paused = reduced; });
      if (reduced) light.setScale(1).setAlpha(0.58);
    }
  }

  private draw(): void {
    const g = this.worldGraphics;
    if (!g) return;
    g.clear();
    this.background?.setTexture("A1").setDisplaySize(1200, 680);
    this.portal?.setAlpha(0.82);

  }

  private fit(image: Phaser.GameObjects.Image | null, maxWidth: number, maxHeight: number): void {
    if (!image) return;
    const source = image.texture.getSourceImage() as { width: number; height: number };
    image.setScale(Math.min(maxWidth / source.width, maxHeight / source.height));
  }

}
