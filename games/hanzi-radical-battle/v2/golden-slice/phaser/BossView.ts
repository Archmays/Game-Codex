import Phaser from "phaser";
import { THEME_C, type GoldenSliceWorldViewModel } from "./WorldView";

export class BossView {
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
    const visible = view.phase.includes("boss") && !view.phase.includes("cleared");
    g.setVisible(visible);
    if (!visible) return;
    const x = 804;
    const y = 408;
    g.fillStyle(THEME_C.ink, 0.94);
    g.fillCircle(x, y, 112);
    g.fillCircle(x - 82, y + 49, 62);
    g.fillCircle(x + 84, y + 50, 62);
    g.fillStyle(THEME_C.paper, 0.88);
    g.fillCircle(x - 31, y - 23, 8);
    g.fillCircle(x + 32, y - 23, 8);
    g.lineStyle(6, THEME_C.coral, 0.78);
    g.beginPath();
    g.arc(x, y + 28, 34, 0.18, Math.PI - 0.18);
    g.strokePath();
    for (let index = 0; index < 2; index += 1) {
      const cleared = index >= view.bossSealsRemaining;
      const sx = x + (index === 0 ? -76 : 76);
      const sy = y + 5;
      g.fillStyle(cleared ? THEME_C.mint : THEME_C.violet, cleared ? 0.24 : 0.92);
      g.fillCircle(sx, sy, 31);
      g.lineStyle(5, cleared ? THEME_C.mint : THEME_C.paper, cleared ? 0.35 : 0.82);
      g.strokeCircle(sx, sy, 25);
      g.lineBetween(sx - 11, sy, sx + 11, sy);
      g.lineBetween(sx, sy - 11, sx, sy + 11);
    }
    if (view.interferenceActive) {
      g.fillStyle(THEME_C.ink, 0.62);
      g.fillRoundedRect(x - 148, y + 114, 296, 46, 20);
      g.lineStyle(3, THEME_C.cyan, 0.42);
      g.strokeRoundedRect(x - 148, y + 114, 296, 46, 20);
    }
    if (view.chosenAbilityId === "guardian-light" && view.abilityVisible) {
      g.lineStyle(8, THEME_C.gold, 0.8);
      g.strokeCircle(390, 510, 58);
    }
    if (view.chosenAbilityId === "star-path" && view.abilityVisible) {
      g.fillStyle(THEME_C.violet, 0.2);
      g.fillRoundedRect(520, 450, 92, 118, 24);
      g.lineStyle(5, THEME_C.violet, 0.9);
      g.strokeRoundedRect(520, 450, 92, 118, 24);
    }
    if (!view.reducedMotion) {
      this.scene.tweens.add({ targets: g, scaleX: 1.018, scaleY: 0.986, duration: 980, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.graphics);
    this.graphics.destroy();
  }
}
