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
  private spellbook: Phaser.GameObjects.Image | null = null;
  private treasure: Phaser.GameObjects.Image | null = null;
  private portal: Phaser.GameObjects.Image | null = null;

  constructor(initialView: WorldHomeState) {
    super({ key: "WorldHomeScene" });
    this.view = initialView;
  }

  preload(): void {
    for (const id of ["A1", "A2", "A3", "A4", "A14", "A15", "A16"] as const) this.load.image(id, v1AssetUrl(id));
  }

  create(): void {
    this.background = this.add.image(600, 340, "A1").setDepth(0).setDisplaySize(1200, 680);
    this.worldGraphics = this.add.graphics().setDepth(1);
    this.hero = this.add.image(470, 618, "A3").setOrigin(0.5, 1).setDepth(3);
    this.companion = this.add.image(615, 590, "A4").setOrigin(0.5, 1).setDepth(4);
    this.spellbook = this.add.image(145, 215, "A14").setDepth(3);
    this.treasure = this.add.image(1060, 360, "A15").setDepth(3);
    this.portal = this.add.image(790, 515, "A16").setOrigin(0.5, 1).setDepth(2);
    this.fit(this.hero, 230, 330); this.fit(this.companion, 130, 150); this.fit(this.spellbook, 185, 150); this.fit(this.treasure, 175, 150); this.fit(this.portal, 260, 310);
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
    const reduced = this.view.save.settings.reducedMotion;
    for (const light of this.ambient) {
      this.tweens.getTweensOf(light).forEach((tween) => { tween.paused = reduced; });
      if (reduced) light.setScale(1).setAlpha(0.58);
    }
  }

  private draw(): void {
    const g = this.worldGraphics;
    if (!g) return;
    g.clear();
    this.background?.setTexture(this.view.completedAndComplete ? "A2" : "A1").setDisplaySize(1200, 680);
    this.portal?.setAlpha(this.view.camp.starPath ? 1 : this.view.camp.flowers ? 0.72 : 0.38);

    this.drawCamp(g);
    this.drawForestPortal(g);
    this.drawSpellbook(g);
    this.drawTreasure(g);
  }

  private fit(image: Phaser.GameObjects.Image | null, maxWidth: number, maxHeight: number): void {
    if (!image) return;
    const source = image.texture.getSourceImage() as { width: number; height: number };
    image.setScale(Math.min(maxWidth / source.width, maxHeight / source.height));
  }

  private drawCamp(g: Phaser.GameObjects.Graphics): void {
    const { camp } = this.view;
    g.fillStyle(THEME_C.coral, 0.28);
    g.fillTriangle(82, 580, 210, 392, 338, 580);
    g.lineStyle(7, THEME_C.coral, 0.72);
    g.strokeTriangle(82, 580, 210, 392, 338, 580);

    g.lineStyle(8, camp.lamp ? THEME_C.gold : THEME_C.ink, camp.lamp ? 0.92 : 0.78);
    g.lineBetween(376, 438, 376, 574);
    g.fillStyle(camp.lamp ? THEME_C.gold : THEME_C.ink, 0.9);
    g.fillRoundedRect(344, 428, 64, 54, 24);
    if (camp.lamp) {
      g.fillStyle(THEME_C.gold, 0.12);
      g.fillCircle(376, 454, 88);
    }

    for (const [x, y] of [[300, 620], [344, 630], [390, 612], [432, 632]] as const) {
      g.lineStyle(4, camp.flowers ? THEME_C.mint : THEME_C.distant, camp.flowers ? 0.8 : 0.32);
      g.lineBetween(x, y, x, y - 26);
      g.fillStyle(camp.flowers ? THEME_C.violet : THEME_C.ink, camp.flowers ? 0.9 : 0.6);
      g.fillCircle(x, y - 34, camp.flowers ? 9 : 5);
    }

    for (const x of [868, 1008]) {
      g.fillStyle(camp.guardianTrees ? THEME_C.coral : THEME_C.ink, camp.guardianTrees ? 0.62 : 0.48);
      g.fillRoundedRect(x - 13, 424, 26, 174, 13);
      g.fillStyle(camp.guardianTrees ? THEME_C.mint : THEME_C.distant, camp.guardianTrees ? 0.74 : 0.34);
      g.fillCircle(x, 394, camp.guardianTrees ? 70 : 48);
      g.fillCircle(x - 38, 426, camp.guardianTrees ? 46 : 30);
      g.fillCircle(x + 40, 430, camp.guardianTrees ? 49 : 32);
    }

    if (camp.starPath) {
      g.lineStyle(4, THEME_C.violet, 0.78);
      g.beginPath();
      g.moveTo(520, 680);
      g.lineTo(594, 522);
      g.lineTo(756, 402);
      g.strokePath();
      for (let index = 0; index < 7; index += 1) {
        g.fillStyle(index % 2 ? THEME_C.gold : THEME_C.violet, 0.92);
        g.fillCircle(544 + index * 31, 632 - index * 34, 4);
      }
    }
  }

  private drawForestPortal(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(THEME_C.ink, 0.5);
    g.fillEllipse(690, 442, 340, 214);
    g.lineStyle(5, THEME_C.mint, 0.56);
    g.strokeEllipse(690, 442, 300, 184);
    g.fillStyle(THEME_C.cyan, 0.16);
    g.fillCircle(690, 442, 92);
  }

  private drawSpellbook(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(THEME_C.paper, 0.88);
    g.fillRoundedRect(60, 90, 172, 122, 16);
    g.lineStyle(4, THEME_C.violet, 0.7);
    g.strokeRoundedRect(60, 90, 172, 122, 16);
    g.lineBetween(146, 98, 146, 204);
    g.fillStyle(THEME_C.ink, 0.66);
    for (let y = 124; y <= 172; y += 24) {
      g.fillRoundedRect(82, y, 44, 5, 2);
      g.fillRoundedRect(166, y, 44, 5, 2);
    }
  }

  private drawTreasure(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(THEME_C.coral, 0.74);
    g.fillRoundedRect(994, 274, 150, 102, 20);
    g.lineStyle(5, THEME_C.gold, 0.74);
    g.strokeRoundedRect(994, 274, 150, 102, 20);
    g.lineBetween(994, 324, 1144, 324);
    g.fillStyle(THEME_C.gold, 0.9);
    g.fillRoundedRect(1058, 306, 24, 38, 7);
  }
}
