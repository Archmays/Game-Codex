import Phaser from "phaser";

export const THEME_C = {
  nightTop: 0x071c2a,
  nightBottom: 0x123d43,
  distant: 0x174d4f,
  canopy: 0x0f3439,
  ground: 0x0a292f,
  paper: 0xfff7df,
  mint: 0x7ee8c7,
  cyan: 0x72dfe8,
  violet: 0xa7a6ff,
  coral: 0xff9b82,
  gold: 0xffd483,
  ink: 0x142e45,
} as const;

export interface GoldenSliceWorldViewModel {
  phase: string;
  encounterId: string | null;
  formedGlyph: string | null;
  reducedMotion: boolean;
  chosenAbilityId: string | null;
  bossPhase: 0 | 1 | 2;
  bossSealsRemaining: 0 | 1 | 2;
  interferenceActive: boolean;
  abilityVisible: boolean;
  campState: {
    lamp: boolean;
    flowers: boolean;
    guardianTrees: boolean;
    starPath: boolean;
  };
}

export class WorldView {
  readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  draw(view: GoldenSliceWorldViewModel): void {
    const g = this.graphics;
    g.setPosition(0, 0).setScale(1).setAlpha(1).setVisible(true);
    g.clear();
    g.fillGradientStyle(THEME_C.nightTop, THEME_C.nightTop, THEME_C.nightBottom, THEME_C.nightBottom, 1);
    g.fillRect(0, 0, 1200, 680);
    this.drawMoonAndStars(g, view);
    this.drawForestLayers(g);
    this.drawGround(g);
    this.drawPath(g, view.campState.starPath);
    this.drawCamp(g, view);
    if (view.phase.includes("battle") || view.phase.includes("boss")) this.drawBattleClearing(g, view);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private drawMoonAndStars(g: Phaser.GameObjects.Graphics, view: GoldenSliceWorldViewModel): void {
    g.fillStyle(THEME_C.violet, 0.12);
    g.fillCircle(930, 116, 68);
    g.fillStyle(THEME_C.paper, 0.82);
    g.fillCircle(930, 116, 28);
    const stars = [
      [150, 92], [242, 154], [346, 76], [464, 128], [650, 86], [774, 162], [1054, 80],
    ] as const;
    for (const [x, y] of stars) {
      g.fillStyle(view.campState.starPath ? THEME_C.gold : THEME_C.cyan, view.campState.starPath ? 0.82 : 0.34);
      g.fillCircle(x, y, view.campState.starPath ? 3.5 : 2);
      if (view.campState.starPath) {
        g.lineStyle(1.5, THEME_C.gold, 0.34);
        g.lineBetween(x - 7, y, x + 7, y);
        g.lineBetween(x, y - 7, x, y + 7);
      }
    }
  }

  private drawForestLayers(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(THEME_C.distant, 0.42);
    for (let x = 10; x < 1200; x += 86) {
      const height = 118 + ((x * 7) % 74);
      g.fillRoundedRect(x, 338 - height, 22, height + 154, 11);
      g.fillCircle(x + 11, 244 - height, 62);
      g.fillCircle(x - 22, 279 - height, 44);
      g.fillCircle(x + 48, 284 - height, 49);
    }
    g.fillStyle(THEME_C.canopy, 0.82);
    for (const x of [26, 110, 198, 1008, 1096, 1170]) {
      g.fillRoundedRect(x - 10, 190, 30, 310, 15);
      g.fillCircle(x, 166, 82);
      g.fillCircle(x + 44, 126, 66);
    }
    g.lineStyle(2, THEME_C.mint, 0.12);
    for (let x = 310; x < 930; x += 92) g.lineBetween(x, 224, x + 28, 194);
  }

  private drawGround(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(THEME_C.ground, 0.96);
    g.fillEllipse(600, 634, 1380, 330);
    g.fillStyle(THEME_C.mint, 0.14);
    for (let x = 66; x < 1160; x += 71) g.fillEllipse(x, 564 + ((x * 5) % 50), 10, 28);
  }

  private drawPath(g: Phaser.GameObjects.Graphics, repaired: boolean): void {
    g.fillStyle(repaired ? THEME_C.violet : THEME_C.paper, repaired ? 0.22 : 0.1);
    g.beginPath();
    g.moveTo(430, 680);
    g.lineTo(540, 484);
    g.lineTo(710, 386);
    g.lineTo(774, 414);
    g.lineTo(652, 508);
    g.lineTo(655, 680);
    g.closePath();
    g.fillPath();
    if (repaired) {
      g.lineStyle(4, THEME_C.violet, 0.76);
      g.beginPath();
      g.moveTo(536, 650);
      g.lineTo(586, 514);
      g.lineTo(730, 408);
      g.strokePath();
      for (let index = 0; index < 7; index += 1) {
        const x = 545 + index * 27;
        const y = 622 - index * 31;
        g.fillStyle(index % 2 ? THEME_C.gold : THEME_C.violet, 0.9);
        g.fillCircle(x, y, 4);
      }
    }
  }

  private drawCamp(g: Phaser.GameObjects.Graphics, view: GoldenSliceWorldViewModel): void {
    g.fillStyle(THEME_C.coral, 0.2);
    g.fillTriangle(70, 576, 192, 396, 314, 576);
    g.lineStyle(7, THEME_C.coral, 0.78);
    g.strokeTriangle(70, 576, 192, 396, 314, 576);
    g.fillStyle(THEME_C.paper, 0.16);
    g.fillRoundedRect(164, 504, 56, 72, 25);

    this.drawLamp(g, 342, 446, view.campState.lamp);
    this.drawFlowers(g, view.campState.flowers);
    this.drawGuardianTrees(g, view.campState.guardianTrees);
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number, repaired: boolean): void {
    g.lineStyle(8, repaired ? THEME_C.gold : THEME_C.coral, repaired ? 0.9 : 0.46);
    g.lineBetween(x, y, x, y + 130);
    g.fillStyle(repaired ? THEME_C.gold : THEME_C.ink, repaired ? 0.94 : 0.85);
    g.fillRoundedRect(x - 31, y - 10, 62, 54, 24);
    g.lineStyle(4, THEME_C.paper, repaired ? 0.8 : 0.28);
    g.strokeRoundedRect(x - 31, y - 10, 62, 54, 24);
    if (repaired) {
      g.fillStyle(THEME_C.gold, 0.12);
      g.fillCircle(x, y + 16, 82);
      g.lineStyle(3, THEME_C.mint, 0.42);
      g.strokeCircle(x, y + 16, 58);
    } else {
      g.fillStyle(THEME_C.ink, 0.84);
      g.fillCircle(x + 8, y + 12, 20);
    }
  }

  private drawFlowers(g: Phaser.GameObjects.Graphics, repaired: boolean): void {
    const points = [[300, 612], [346, 624], [392, 602], [430, 630]] as const;
    for (const [x, y] of points) {
      g.lineStyle(4, repaired ? THEME_C.mint : THEME_C.distant, repaired ? 0.82 : 0.34);
      g.lineBetween(x, y, x, y - 28);
      if (repaired) {
        for (let index = 0; index < 5; index += 1) {
          const angle = (Math.PI * 2 * index) / 5;
          g.fillStyle(index % 2 ? THEME_C.coral : THEME_C.violet, 0.92);
          g.fillCircle(x + Math.cos(angle) * 11, y - 37 + Math.sin(angle) * 11, 7);
        }
        g.fillStyle(THEME_C.gold, 0.94);
        g.fillCircle(x, y - 37, 5);
      } else {
        g.fillStyle(THEME_C.ink, 0.68);
        g.fillEllipse(x, y - 30, 22, 12);
      }
    }
  }

  private drawGuardianTrees(g: Phaser.GameObjects.Graphics, repaired: boolean): void {
    for (const x of [866, 1010]) {
      g.fillStyle(repaired ? THEME_C.coral : THEME_C.ink, repaired ? 0.65 : 0.42);
      g.fillRoundedRect(x - 13, 414, 26, 176, 13);
      g.fillStyle(repaired ? THEME_C.mint : THEME_C.distant, repaired ? 0.72 : 0.28);
      g.fillCircle(x, 382, repaired ? 74 : 44);
      g.fillCircle(x - 38, 420, repaired ? 50 : 30);
      g.fillCircle(x + 42, 424, repaired ? 53 : 31);
      if (repaired) {
        g.lineStyle(3, THEME_C.violet, 0.66);
        g.strokeCircle(x, 382, 60);
        g.fillStyle(THEME_C.gold, 0.78);
        g.fillCircle(x - 18, 364, 5);
        g.fillCircle(x + 28, 402, 4);
      }
    }
  }

  private drawBattleClearing(g: Phaser.GameObjects.Graphics, view: GoldenSliceWorldViewModel): void {
    g.fillStyle(THEME_C.ink, 0.42);
    g.fillEllipse(690, 504, view.phase.includes("boss") ? 430 : 330, 180);
    g.lineStyle(3, view.phase.includes("boss") ? THEME_C.violet : THEME_C.cyan, 0.28);
    g.strokeEllipse(690, 504, view.phase.includes("boss") ? 390 : 295, 150);
  }
}
