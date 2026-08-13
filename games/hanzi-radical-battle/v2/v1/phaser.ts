import Phaser from "phaser";
import type { AbilityId, GoldenCharacterId } from "../golden-slice/content/types";
import { HANZI_MAGIC_V1_RUNTIME_ASSETS, v1AssetUrl } from "./assets";
import type { V1Phase } from "./machine";

export interface V1WorldViewModel {
  readonly phase: V1Phase;
  readonly characterId: GoldenCharacterId | null;
  readonly encounterKind: "normal" | "boss-phase" | null;
  readonly campRepairStage: 0 | 1 | 2 | 3;
  readonly selectedAbilityId: AbilityId | null;
  readonly interferenceActive: boolean;
  readonly reducedMotion: boolean;
}

export interface V1WorldHandle {
  setView(view: V1WorldViewModel): void;
  setInputEnabled(enabled: boolean): void;
  destroy(): void;
}

const DEFAULT_VIEW: V1WorldViewModel = {
  phase: "camp",
  characterId: null,
  encounterKind: null,
  campRepairStage: 0,
  selectedAbilityId: null,
  interferenceActive: false,
  reducedMotion: false,
};

class HanziMagicV1Scene extends Phaser.Scene {
  private view: V1WorldViewModel = DEFAULT_VIEW;
  private background?: Phaser.GameObjects.Image;
  private hero?: Phaser.GameObjects.Image;
  private companion?: Phaser.GameObjects.Image;
  private opponent?: Phaser.GameObjects.Image;
  private ability?: Phaser.GameObjects.Image;
  private meaning?: Phaser.GameObjects.Image;
  private portal?: Phaser.GameObjects.Image;
  private repairs?: Phaser.GameObjects.Graphics;
  private mist?: Phaser.GameObjects.Graphics;

  constructor() { super("hanzi-magic-v2-v1-world"); }

  preload(): void {
    for (const asset of HANZI_MAGIC_V1_RUNTIME_ASSETS) this.load.image(asset.id, v1AssetUrl(asset));
  }

  create(): void {
    this.background = this.add.image(600, 340, "A1").setDepth(0);
    this.repairs = this.add.graphics().setDepth(1);
    this.hero = this.add.image(220, 595, "A3").setOrigin(0.5, 1).setDepth(3);
    this.companion = this.add.image(365, 558, "A4").setOrigin(0.5, 1).setDepth(4);
    this.opponent = this.add.image(965, 565, "A5").setOrigin(0.5, 1).setDepth(3);
    this.ability = this.add.image(325, 405, "A7").setDepth(5);
    this.meaning = this.add.image(600, 300, "A10").setDepth(6);
    this.portal = this.add.image(910, 530, "A16").setOrigin(0.5, 1).setDepth(2);
    this.mist = this.add.graphics().setDepth(7);
    this.redraw();
    this.game.events.emit("hanzi-magic-v1-scene-ready");
  }

  setView(view: V1WorldViewModel): void {
    this.view = { ...view };
    if (this.background) this.redraw();
  }

  private fit(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const source = image.texture.getSourceImage() as { width: number; height: number };
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    image.setScale(scale);
  }

  private redraw(): void {
    this.tweens.killAll();
    if (!this.background || !this.hero || !this.companion || !this.opponent || !this.ability || !this.meaning || !this.portal || !this.repairs || !this.mist) return;
    const inCamp = ["camp", "adventure-intro", "repair", "chapter-report", "ending", "spellbook"].includes(this.view.phase);
    this.background.setTexture(this.view.campRepairStage >= 3 ? "A2" : "A1");
    this.fit(this.background, 1200, 680);
    this.background.setDisplaySize(1200, 680);
    this.fit(this.hero, 235, 330);
    this.fit(this.companion, 125, 150);
    this.hero.setVisible(true);
    this.companion.setVisible(true);

    this.opponent.setVisible(!inCamp);
    if (!inCamp) {
      this.opponent.setTexture(this.view.encounterKind === "boss-phase" ? "A6" : "A5");
      this.fit(this.opponent, this.view.encounterKind === "boss-phase" ? 350 : 250, this.view.encounterKind === "boss-phase" ? 360 : 265);
    }
    this.portal.setVisible(inCamp && this.view.campRepairStage >= 3);
    if (this.portal.visible) this.fit(this.portal, 240, 300);

    const abilityAsset = this.view.selectedAbilityId === "star-path" ? "A8" : this.view.selectedAbilityId === "ink-echo" ? "A9" : "A7";
    this.ability.setTexture(abilityAsset).setVisible(Boolean(this.view.selectedAbilityId) && !inCamp);
    if (this.ability.visible) this.fit(this.ability, 105, 105);

    const meaningId = this.view.characterId
      ? HANZI_MAGIC_V1_RUNTIME_ASSETS.find((asset) => asset.role === "meaning-magic" && asset.characterId === this.view.characterId)?.id
      : undefined;
    // The DOM meaning card is the single semantic focal point. Keep the
    // preloaded Phaser copy hidden so the same illustration never appears as
    // a distracting duplicate behind the accessible card.
    this.meaning.setVisible(false);
    if (meaningId) {
      this.meaning.setTexture(meaningId);
      this.fit(this.meaning, 330, 330);
    }

    this.repairs.clear();
    if (this.view.campRepairStage >= 1) {
      this.repairs.fillStyle(0xffd886, 0.24).fillCircle(600, 470, 80);
      this.repairs.lineStyle(5, 0xffe7a1, 0.8).strokeCircle(600, 470, 38);
    }
    if (this.view.campRepairStage >= 2) {
      this.repairs.lineStyle(8, 0x77e4c3, 0.65);
      this.repairs.beginPath().moveTo(440, 640).lineTo(540, 585).lineTo(660, 552).lineTo(780, 575).lineTo(900, 625).strokePath();
      for (const [x, y] of [[480, 604], [535, 575], [690, 568], [760, 586]] as const) {
        this.repairs.fillStyle(0xff9e9e, 0.82).fillCircle(x, y, 8);
        this.repairs.fillStyle(0xa9f3d0, 0.86).fillCircle(x - 7, y + 7, 5);
      }
    }
    if (this.view.campRepairStage >= 3) {
      this.repairs.lineStyle(3, 0xffe7a1, 0.65);
      for (const [x, y] of [[790, 210], [850, 175], [930, 210], [990, 165]] as const) {
        this.repairs.strokeCircle(x, y, 11);
        this.repairs.lineBetween(x, y + 11, x, y + 34);
      }
    }

    this.mist.clear();
    if (this.view.interferenceActive) {
      this.mist.fillStyle(0x0b1c30, 0.58);
      for (const [x, y, radius] of [[525, 325, 78], [620, 295, 92], [710, 330, 72]] as const) this.mist.fillCircle(x, y, radius);
    }

    if (!this.view.reducedMotion) {
      if (this.ability.visible) this.tweens.add({ targets: this.ability, y: 394, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }
}

export function createHanziMagicV1World(parent: HTMLElement, initialView: V1WorldViewModel): V1WorldHandle {
  const scene = new HanziMagicV1Scene();
  scene.setView(initialView);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 1200,
    height: 680,
    backgroundColor: "#071c2a",
    render: { antialias: true, pixelArt: false, roundPixels: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1200, height: 680 },
    input: { activePointers: 2, touch: { capture: false } },
    audio: { disableWebAudio: true },
    scene,
  });
  let inputEnabled = true;
  const applyGate = () => { if (scene.input) scene.input.enabled = inputEnabled; };
  game.events.on("hanzi-magic-v1-scene-ready", applyGate);
  const canvas = parent.querySelector("canvas");
  canvas?.setAttribute("data-testid", "hanzi-magic-v1-world-canvas");
  canvas?.setAttribute("aria-hidden", "true");
  return {
    setView(view) { scene.setView(view); },
    setInputEnabled(enabled) { inputEnabled = enabled; applyGate(); },
    destroy() { game.events.off("hanzi-magic-v1-scene-ready", applyGate); game.destroy(true); },
  };
}
