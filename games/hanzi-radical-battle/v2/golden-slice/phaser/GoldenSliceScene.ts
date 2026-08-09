import Phaser from "phaser";
import { BossView } from "./BossView";
import { CharacterView } from "./CharacterView";
import { MeaningMagicFx } from "./MeaningMagicFx";
import { MonsterView } from "./MonsterView";
import { WorldView, type GoldenSliceWorldViewModel } from "./WorldView";

export const DEFAULT_GOLDEN_WORLD_VIEW: GoldenSliceWorldViewModel = {
  phase: "boot",
  encounterId: null,
  formedGlyph: null,
  reducedMotion: false,
  chosenAbilityId: null,
  bossPhase: 0,
  bossSealsRemaining: 2,
  interferenceActive: false,
  abilityVisible: false,
  campState: { lamp: false, flowers: false, guardianTrees: false, starPath: false },
};

export class GoldenSliceScene extends Phaser.Scene {
  private view: GoldenSliceWorldViewModel = DEFAULT_GOLDEN_WORLD_VIEW;
  private world?: WorldView;
  private characters?: CharacterView;
  private monster?: MonsterView;
  private boss?: BossView;
  private meaningMagic?: MeaningMagicFx;

  constructor() {
    super("hanzi-v2-golden-slice-world");
  }

  create(): void {
    this.world = new WorldView(this);
    this.characters = new CharacterView(this);
    this.monster = new MonsterView(this);
    this.boss = new BossView(this);
    this.meaningMagic = new MeaningMagicFx(this);
    this.redraw();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.redraw, this);
      this.world?.destroy();
      this.characters?.destroy();
      this.monster?.destroy();
      this.boss?.destroy();
      this.meaningMagic?.destroy();
    });
    this.game.events.emit("hanzi-v2-step03-scene-ready", this);
  }

  setView(view: GoldenSliceWorldViewModel): void {
    this.view = {
      ...view,
      campState: { ...view.campState },
    };
    if (this.world) this.redraw();
  }

  private redraw(): void {
    this.tweens.killAll();
    this.world?.draw(this.view);
    this.characters?.draw(this.view);
    this.monster?.draw(this.view);
    this.boss?.draw(this.view);
    this.meaningMagic?.draw(this.view);
  }
}
