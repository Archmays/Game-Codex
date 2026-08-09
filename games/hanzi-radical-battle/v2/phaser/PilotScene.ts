import Phaser from "phaser";
import { getVisualDirection } from "../content/visual-directions";
import type { VisualDirectionId } from "../content/types";
import type { PilotPhase } from "../simulation/pilot-machine";

export interface PilotWorldView {
  phase: PilotPhase;
  themeId: VisualDirectionId;
  reducedMotion: boolean;
  campLampRepaired: boolean;
}

const DEFAULT_VIEW: PilotWorldView = {
  phase: "camp_intro",
  themeId: "A",
  reducedMotion: false,
  campLampRepaired: false,
};

function color(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export class PilotScene extends Phaser.Scene {
  private view: PilotWorldView = DEFAULT_VIEW;
  private backdrop?: Phaser.GameObjects.Graphics;
  private paint?: Phaser.GameObjects.Graphics;
  private glow?: Phaser.GameObjects.Graphics;
  private monster?: Phaser.GameObjects.Graphics;
  private companion?: Phaser.GameObjects.Graphics;
  private ambientTween?: Phaser.Tweens.Tween;

  constructor() {
    super("step02-core-spell-pilot");
  }

  create(): void {
    this.backdrop = this.add.graphics();
    this.paint = this.add.graphics();
    this.glow = this.add.graphics();
    this.monster = this.add.graphics();
    this.companion = this.add.graphics();
    this.redraw();
    this.scale.on("resize", this.redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.redraw, this));
    this.game.events.emit("step02-scene-ready", this);
  }

  setView(next: PilotWorldView): void {
    this.view = next;
    if (this.paint) this.redraw();
  }

  private redraw(): void {
    if (!this.backdrop || !this.paint || !this.glow || !this.monster || !this.companion) return;
    const palette = getVisualDirection(this.view.themeId).tokens;
    const compactWorld = this.scale.parentSize.width / Math.max(1, this.scale.parentSize.height) < 0.8;
    const layerScaleX = compactWorld ? 0.34 : 1;
    const layerX = compactWorld ? 316 : 0;
    const world = this.paint;
    this.backdrop.clear();
    world.clear();
    this.glow.clear();
    this.monster.clear();
    this.companion.clear();
    this.tweens.killAll();

    this.backdrop.fillGradientStyle(
      color(palette.sky),
      color(palette.sky),
      color(palette.ground),
      color(palette.ground),
      1,
    );
    this.backdrop.fillRect(0, 0, 960, 540);

    [world, this.glow, this.monster, this.companion].forEach((layer) => {
      layer.setPosition(layerX, 0);
      layer.setScale(layerScaleX, 1);
    });

    this.drawPaperSky(world, color(palette.distantInk), color(palette.glow));
    this.drawForest(world, color(palette.distantInk));
    this.drawPath(world, color(palette.panel), color(palette.accent));
    this.drawCamp(world, color(palette.primary), color(palette.glow));
    this.drawMage(world, color(palette.panel), color(palette.primary), color(palette.text));
    this.drawCompanion(this.companion, color(palette.text), color(palette.glow));

    const encounterVisible = !["camp_intro", "returning_to_camp", "camp_repaired", "spellbook", "complete"].includes(
      this.view.phase,
    );
    if (encounterVisible) this.drawMonster(this.monster, color(palette.distantInk), color(palette.accent));

    const magicVisible = ["forming_character", "casting_spell", "monster_cleared", "returning_to_camp"].includes(
      this.view.phase,
    );
    if (magicVisible) this.drawMagic(this.glow, color(palette.glow), color(palette.accent));

    if (!this.view.reducedMotion) this.startAmbientMotion(encounterVisible, magicVisible, layerScaleX);
  }

  private drawPaperSky(graphics: Phaser.GameObjects.Graphics, ink: number, glow: number): void {
    graphics.fillStyle(glow, 0.08);
    for (let index = 0; index < 18; index += 1) {
      const x = 40 + ((index * 137) % 860);
      const y = 36 + ((index * 73) % 210);
      graphics.fillCircle(x, y, index % 3 === 0 ? 2.8 : 1.5);
    }
    graphics.lineStyle(2, ink, 0.18);
    graphics.beginPath();
    graphics.moveTo(0, 292);
    graphics.lineTo(170, 220);
    graphics.lineTo(340, 288);
    graphics.lineTo(560, 195);
    graphics.lineTo(760, 280);
    graphics.lineTo(860, 238);
    graphics.lineTo(960, 270);
    graphics.strokePath();
  }

  private drawForest(graphics: Phaser.GameObjects.Graphics, ink: number): void {
    graphics.fillStyle(ink, 0.42);
    const trees = [42, 96, 150, 214, 758, 818, 876, 930];
    trees.forEach((x, index) => {
      const height = 150 + (index % 3) * 28;
      graphics.fillRoundedRect(x - 8, 315 - height, 16, height + 120, 8);
      graphics.fillTriangle(x - 60, 260 - height, x, 105 - height / 2, x + 60, 260 - height);
      graphics.fillTriangle(x - 48, 306 - height, x, 160 - height / 2, x + 48, 306 - height);
    });
    graphics.fillStyle(ink, 0.2);
    graphics.fillEllipse(480, 476, 980, 180);
  }

  private drawPath(graphics: Phaser.GameObjects.Graphics, paper: number, accent: number): void {
    graphics.fillStyle(paper, 0.14);
    graphics.beginPath();
    graphics.moveTo(350, 540);
    graphics.lineTo(450, 410);
    graphics.lineTo(610, 310);
    graphics.lineTo(680, 340);
    graphics.lineTo(555, 430);
    graphics.lineTo(545, 540);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(3, accent, 0.16);
    graphics.beginPath();
    graphics.moveTo(450, 524);
    graphics.lineTo(510, 405);
    graphics.lineTo(635, 325);
    graphics.strokePath();
  }

  private drawCamp(graphics: Phaser.GameObjects.Graphics, primary: number, glow: number): void {
    const lampBright = this.view.campLampRepaired || ["camp_repaired", "spellbook", "complete"].includes(this.view.phase);
    graphics.fillStyle(primary, 0.24);
    graphics.fillTriangle(72, 470, 178, 322, 286, 470);
    graphics.lineStyle(6, primary, 0.62);
    graphics.strokeTriangle(72, 470, 178, 322, 286, 470);
    graphics.fillStyle(primary, 0.38);
    graphics.fillRoundedRect(154, 406, 48, 64, 18);

    graphics.lineStyle(7, primary, 0.72);
    graphics.lineBetween(286, 468, 286, 338);
    graphics.lineBetween(266, 340, 306, 340);
    graphics.fillStyle(glow, lampBright ? 0.94 : 0.2);
    graphics.fillCircle(286, 357, lampBright ? 18 : 10);
    if (lampBright) {
      graphics.fillStyle(glow, 0.13);
      graphics.fillCircle(286, 357, 70);
      graphics.lineStyle(3, glow, 0.46);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        graphics.lineBetween(
          286 + Math.cos(angle) * 28,
          357 + Math.sin(angle) * 28,
          286 + Math.cos(angle) * 42,
          357 + Math.sin(angle) * 42,
        );
      }
    }
  }

  private drawMage(graphics: Phaser.GameObjects.Graphics, paper: number, primary: number, ink: number): void {
    graphics.fillStyle(ink, 0.28);
    graphics.fillEllipse(638, 478, 118, 22);
    graphics.fillStyle(primary, 0.94);
    graphics.fillTriangle(592, 468, 632, 346, 678, 468);
    graphics.fillStyle(paper, 0.98);
    graphics.fillCircle(635, 342, 32);
    graphics.fillStyle(ink, 0.9);
    graphics.fillCircle(624, 340, 3.4);
    graphics.fillCircle(646, 340, 3.4);
    graphics.lineStyle(3, ink, 0.78);
    graphics.beginPath();
    graphics.arc(635, 348, 10, 0.25, Math.PI - 0.25);
    graphics.strokePath();
    graphics.fillStyle(ink, 0.9);
    graphics.fillTriangle(588, 328, 640, 238, 691, 328);
    graphics.fillRoundedRect(580, 320, 116, 16, 8);
    graphics.fillStyle(primary, 0.9);
    graphics.fillCircle(640, 276, 8);
    graphics.lineStyle(7, paper, 0.86);
    graphics.lineBetween(604, 397, 558, 420);
    graphics.lineBetween(664, 397, 704, 419);
  }

  private drawCompanion(graphics: Phaser.GameObjects.Graphics, ink: number, glow: number): void {
    graphics.fillStyle(glow, 0.13);
    graphics.fillCircle(716, 358, 34);
    graphics.fillStyle(ink, 0.92);
    graphics.fillCircle(716, 358, 18);
    graphics.fillStyle(glow, 0.95);
    graphics.fillCircle(710, 354, 2.8);
    graphics.fillCircle(722, 354, 2.8);
    graphics.lineStyle(3, ink, 0.72);
    graphics.beginPath();
    graphics.moveTo(704, 374);
    graphics.lineTo(690, 390);
    graphics.lineTo(704, 400);
    graphics.strokePath();
  }

  private drawMonster(graphics: Phaser.GameObjects.Graphics, ink: number, accent: number): void {
    const clearing = ["monster_cleared", "returning_to_camp"].includes(this.view.phase);
    graphics.fillStyle(ink, clearing ? 0.16 : 0.76);
    graphics.fillCircle(480, 350, clearing ? 40 : 76);
    graphics.fillCircle(424, 374, clearing ? 22 : 48);
    graphics.fillCircle(540, 376, clearing ? 24 : 50);
    graphics.fillStyle(accent, clearing ? 0.25 : 0.9);
    graphics.fillCircle(458, 345, 6);
    graphics.fillCircle(506, 345, 6);
    graphics.lineStyle(5, accent, clearing ? 0.2 : 0.7);
    graphics.beginPath();
    graphics.moveTo(463, 375);
    graphics.lineTo(482, 386);
    graphics.lineTo(503, 375);
    graphics.strokePath();
  }

  private drawMagic(graphics: Phaser.GameObjects.Graphics, glow: number, accent: number): void {
    const radius = this.view.phase === "casting_spell" ? 104 : 74;
    graphics.fillStyle(glow, 0.12);
    graphics.fillCircle(480, 270, radius);
    graphics.lineStyle(5, glow, 0.68);
    graphics.strokeCircle(480, 270, radius - 18);
    graphics.lineStyle(3, accent, 0.66);
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      graphics.lineBetween(
        480 + Math.cos(angle) * (radius - 8),
        270 + Math.sin(angle) * (radius - 8),
        480 + Math.cos(angle) * (radius + 9),
        270 + Math.sin(angle) * (radius + 9),
      );
    }
  }

  private startAmbientMotion(encounterVisible: boolean, magicVisible: boolean, layerScaleX: number): void {
    if (this.companion) {
      this.ambientTween = this.tweens.add({
        targets: this.companion,
        y: -8,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
    if (encounterVisible && this.monster) {
      this.tweens.add({
        targets: this.monster,
        scaleX: layerScaleX * 1.04,
        scaleY: 0.97,
        duration: 760,
        yoyo: true,
        repeat: -1,
      });
    }
    if (magicVisible && this.glow) {
      this.tweens.add({ targets: this.glow, alpha: 0.58, duration: 340, yoyo: true, repeat: -1 });
    }
  }
}
