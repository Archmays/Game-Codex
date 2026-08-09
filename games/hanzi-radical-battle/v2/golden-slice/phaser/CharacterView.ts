import Phaser from "phaser";
import { THEME_C, type GoldenSliceWorldViewModel } from "./WorldView";

export class CharacterView {
  readonly mage: Phaser.GameObjects.Graphics;
  readonly companion: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.mage = scene.add.graphics();
    this.companion = scene.add.graphics();
  }

  draw(view: GoldenSliceWorldViewModel): void {
    this.scene.tweens.killTweensOf([this.mage, this.companion]);
    this.mage.setPosition(0, 0).setScale(1).setAlpha(1).setVisible(true);
    this.companion.setPosition(0, 0).setScale(1).setAlpha(1).setVisible(true);
    this.mage.clear();
    this.companion.clear();
    const battle = view.phase.includes("battle") || view.phase.includes("boss");
    const mageX = battle ? 366 : 580;
    const mageY = battle ? 360 : 420;
    this.drawMage(mageX, mageY, view.chosenAbilityId);
    this.drawCompanion(mageX + 126, mageY - 48, view);
    if (!view.reducedMotion) {
      this.scene.tweens.add({ targets: this.companion, y: -8, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.mage, this.companion]);
    this.mage.destroy();
    this.companion.destroy();
  }

  private drawMage(x: number, y: number, ability: string | null): void {
    const g = this.mage;
    g.fillStyle(THEME_C.ink, 0.32);
    g.fillEllipse(x, y + 178, 130, 24);
    g.fillStyle(THEME_C.mint, 0.94);
    g.fillTriangle(x - 52, y + 164, x, y + 44, x + 54, y + 164);
    g.fillStyle(THEME_C.violet, 0.72);
    g.fillTriangle(x - 60, y + 158, x - 18, y + 64, x - 2, y + 165);
    g.fillStyle(THEME_C.paper, 0.98);
    g.fillCircle(x, y + 38, 36);
    g.fillStyle(THEME_C.ink, 0.92);
    g.fillCircle(x - 12, y + 34, 4);
    g.fillCircle(x + 12, y + 34, 4);
    g.lineStyle(3, THEME_C.coral, 0.9);
    g.beginPath();
    g.arc(x, y + 43, 11, 0.2, Math.PI - 0.2);
    g.strokePath();
    g.fillStyle(THEME_C.ink, 0.96);
    g.fillTriangle(x - 56, y + 21, x, y - 62, x + 56, y + 21);
    g.fillRoundedRect(x - 63, y + 13, 126, 16, 8);
    g.fillStyle(THEME_C.coral, 0.94);
    g.fillCircle(x, y - 28, 9);
    g.lineStyle(8, THEME_C.paper, 0.88);
    g.lineBetween(x - 34, y + 92, x - 82, y + 119);
    g.lineBetween(x + 36, y + 92, x + 78, y + 113);
    g.lineStyle(8, THEME_C.coral, 0.82);
    g.lineBetween(x + 74, y + 112, x + 108, y + 50);
    g.fillStyle(THEME_C.paper, 0.9);
    g.fillCircle(x + 112, y + 42, 10);

    if (ability) {
      const abilityColor = ability === "guardian-light" ? THEME_C.gold : ability === "star-path" ? THEME_C.violet : THEME_C.cyan;
      g.lineStyle(4, abilityColor, 0.84);
      g.strokeCircle(x, y + 96, 72);
      g.fillStyle(abilityColor, 0.16);
      g.fillCircle(x, y + 96, 76);
    }
  }

  private drawCompanion(x: number, y: number, view: GoldenSliceWorldViewModel): void {
    const g = this.companion;
    const route = view.chosenAbilityId === "ink-echo" && view.abilityVisible;
    g.fillStyle(THEME_C.cyan, 0.14);
    g.fillCircle(x, y, route ? 46 : 38);
    g.fillStyle(THEME_C.ink, 0.96);
    g.fillCircle(x, y + 8, 24);
    g.fillTriangle(x - 22, y + 4, x, y - 34, x + 22, y + 4);
    g.fillStyle(THEME_C.paper, 0.92);
    g.fillCircle(x - 7, y + 5, 3.5);
    g.fillCircle(x + 7, y + 5, 3.5);
    if (route) {
      g.lineStyle(3, THEME_C.cyan, 0.88);
      g.beginPath();
      g.moveTo(x, y + 40);
      g.lineTo(x + 84, y + 76);
      g.lineTo(x + 130, y + 24);
      g.strokePath();
      g.fillStyle(THEME_C.coral, 0.9);
      g.fillCircle(x + 84, y + 76, 5);
    }
  }
}
