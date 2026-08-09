import Phaser from "phaser";
import { THEME_C, type GoldenSliceWorldViewModel } from "./WorldView";

export class MeaningMagicFx {
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
    const active = Boolean(view.formedGlyph) && (view.phase.includes("forming") || view.phase.includes("casting") || view.phase.includes("cleared"));
    g.setVisible(active);
    if (!active) return;
    const colors: Record<string, number> = { 明: THEME_C.gold, 花: THEME_C.coral, 林: THEME_C.mint, 星: THEME_C.violet };
    const fxColor = colors[view.formedGlyph ?? ""] ?? THEME_C.cyan;
    g.fillStyle(fxColor, 0.13);
    g.fillCircle(600, 270, 118);
    g.lineStyle(5, fxColor, 0.74);
    g.strokeCircle(600, 270, 91);
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const inner = 100;
      const outer = 116;
      g.lineBetween(
        600 + Math.cos(angle) * inner,
        270 + Math.sin(angle) * inner,
        600 + Math.cos(angle) * outer,
        270 + Math.sin(angle) * outer,
      );
    }
    if (!view.reducedMotion) {
      this.scene.tweens.add({ targets: g, alpha: 0.68, duration: 420, yoyo: true, repeat: 1, ease: "Sine.InOut" });
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.graphics);
    this.graphics.destroy();
  }
}
