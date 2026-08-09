import Phaser from "phaser";
import { THEME_C, type GoldenSliceWorldViewModel } from "./WorldView";

export class MonsterView {
  readonly graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
  }

  draw(view: GoldenSliceWorldViewModel): void {
    this.scene.tweens.killTweensOf(this.graphics);
    const g = this.graphics;
    g.setPosition(0, 0).setScale(1).setAlpha(1);
    g.clear();
    const visible = view.phase.includes("battle") && !view.phase.includes("cleared");
    this.graphics.setVisible(visible);
    if (!visible) return;
    const x = 790;
    const y = 430;
    g.fillStyle(THEME_C.ink, 0.9);
    g.fillCircle(x, y, 70);
    g.fillCircle(x - 54, y + 25, 38);
    g.fillCircle(x + 55, y + 27, 40);
    g.fillStyle(THEME_C.cyan, 0.9);
    g.fillCircle(x - 22, y - 5, 6);
    g.fillCircle(x + 24, y - 5, 6);
    g.lineStyle(4, THEME_C.coral, 0.72);
    g.beginPath();
    g.arc(x, y + 20, 23, 0.18, Math.PI - 0.18);
    g.strokePath();
    g.lineStyle(3, THEME_C.mint, 0.22);
    g.strokeCircle(x, y, 84);
    if (!view.reducedMotion) {
      this.scene.tweens.add({ targets: g, scaleX: 1.035, scaleY: 0.97, duration: 820, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.graphics);
    this.graphics.destroy();
  }
}
