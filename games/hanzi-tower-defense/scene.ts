import Phaser from "phaser";
import { CORES } from "./content";
import { ENEMIES, MAP, PATH, pointOnPath, SLOTS, updateBattle, type BattleEvent, type BattleState, type Enemy, type Point } from "./model";
import type { Preferences } from "./save";

export const ART = "./assets/hanzi-tower-defense/";
const PARTS = ["body_greenC", "body_redF", "body_blueA", "eye_cute_light", "mouth_closed_happy", "detail_green_horn_small", "detail_red_ear", "detail_white_horn_large", "leg_greenE", "leg_redE", "leg_blueE"];
interface SceneHooks {
  state(): BattleState;
  preferences(): Preferences;
  events(events: BattleEvent[]): void;
  tick(): void;
  ready(): void;
}

export class DefenseScene extends Phaser.Scene {
  private terrain!: Phaser.GameObjects.Image;
  private road!: Phaser.GameObjects.Graphics;
  private trails!: Phaser.GameObjects.Graphics;
  private monsters = new Map<number, Phaser.GameObjects.Container>();
  private lifeBars = new Map<number, Phaser.GameObjects.Graphics>();
  private effects: { event: BattleEvent; age: number }[] = [];
  private accumulator = 0;
  private uiElapsed = 0;
  constructor(private readonly hooks: SceneHooks) { super("hanzi-defense"); }
  preload(): void {
    this.load.image("td-meadow", `${ART}meadow.png`);
    for (const part of PARTS) this.load.image(part, `${ART}${part}.png`);
  }
  create(): void {
    this.terrain = this.add.image(0, 0, "td-meadow").setOrigin(0);
    this.road = this.add.graphics(); this.trails = this.add.graphics().setDepth(500);
    this.drawTerrain(); this.scale.on("resize", this.drawTerrain, this); this.hooks.ready();
  }
  private point(p: Point): Point { return { x: p.x * this.scale.width / MAP.width, y: p.y * this.scale.height / MAP.height }; }
  private drawTerrain(): void {
    if (!this.terrain) return;
    this.terrain.setDisplaySize(this.scale.width, this.scale.height); this.road.clear();
    const scale = this.scale.width / MAP.width;
    // A continuous three-layer road reads as terrain, with clipped corners and small inset stones.
    for (const [width, color] of [[61, 0x756747], [52, 0xb39664], [41, 0xd6bc84]] as const) {
      this.road.lineStyle(Math.max(8, width * scale), color, 1); this.road.beginPath();
      PATH.forEach((p, i) => { const q = this.point(p); if (i === 0) this.road.moveTo(q.x, q.y); else this.road.lineTo(q.x, q.y); }); this.road.strokePath();
      for (const p of PATH.slice(1, -1)) { const q = this.point(p); this.road.fillStyle(color); this.road.fillCircle(q.x, q.y, Math.max(4, width * scale / 2)); }
    }
    for (let n = 40; n < 1700; n += 58) {
      const p = this.point(pointOnPath(n)); this.road.fillStyle(0xe5cf9d, .7);
      this.road.fillRoundedRect(p.x - 4 * scale, p.y - 3 * scale, Math.max(3, 9 * scale), Math.max(2, 5 * scale), 2);
    }
  }
  private createMonster(enemy: Enemy): Phaser.GameObjects.Container {
    const type = enemy.kind, bodyKey = type === "swarm" ? "body_greenC" : type === "swift" ? "body_redF" : "body_blueA";
    const parts: Phaser.GameObjects.GameObject[] = [];
    const sprite = (key: string, x: number, y: number, w: number, h: number) => { const item = this.add.image(x, y, key).setDisplaySize(w, h); parts.push(item); return item; };
    const legs = type === "swarm" ? "leg_greenE" : type === "swift" ? "leg_redE" : "leg_blueE";
    sprite(legs, -9, 18, 14, 15); sprite(legs, 9, 18, 14, 15).setFlipX(true);
    sprite(bodyKey, 0, 0, type === "stone" ? 39 : 31, type === "swift" ? 38 : 33);
    const horn = type === "swarm" ? "detail_green_horn_small" : type === "swift" ? "detail_red_ear" : "detail_white_horn_large";
    sprite(horn, -12, -18, type === "swift" ? 11 : 10, type === "swift" ? 23 : 13); sprite(horn, 12, -18, type === "swift" ? 11 : 10, type === "swift" ? 23 : 13).setFlipX(true);
    sprite("eye_cute_light", -7, -4, 12, 12); sprite("eye_cute_light", 7, -4, 12, 12);
    sprite("mouth_closed_happy", 0, 10, 11, 5);
    if (type === "stone") {
      const armor = this.add.graphics().lineStyle(3, 0x537f91).strokeRoundedRect(-20, -14, 40, 34, 5);
      armor.fillStyle(0xa2cbd3, .85).fillTriangle(-13, 13, 0, 5, 13, 13); parts.push(armor);
    }
    const container = this.add.container(0, 0, parts); this.monsters.set(enemy.id, container);
    this.lifeBars.set(enemy.id, this.add.graphics().setDepth(400)); return container;
  }
  update(_time: number, delta: number): void {
    if (!this.road) return;
    const state = this.hooks.state(), preferences = this.hooks.preferences();
    if (state.phase === "battle" && !state.paused && !document.hidden) {
      this.accumulator += Math.min(delta / 1000, .1);
      while (this.accumulator >= .05) { const events = updateBattle(state, .05); this.accumulator -= .05; this.effects.push(...events.map(event => ({ event, age: 0 }))); this.hooks.events(events); }
    } else this.accumulator = 0;
    this.uiElapsed += delta; if (this.uiElapsed > 150) { this.uiElapsed = 0; this.hooks.tick(); }
    const alive = new Set(state.enemies.map(e => e.id));
    for (const [id, container] of this.monsters) if (!alive.has(id)) { container.destroy(); this.monsters.delete(id); this.lifeBars.get(id)?.destroy(); this.lifeBars.delete(id); }
    const scale = Math.max(.64, Math.min(1.15, this.scale.width / MAP.width));
    for (const enemy of state.enemies) {
      const container = this.monsters.get(enemy.id) ?? this.createMonster(enemy), p = this.point(pointOnPath(enemy.distance));
      const bob = preferences.reducedMotion || state.paused ? 0 : Math.sin(state.elapsed * (enemy.kind === "swift" ? 17 : 8) + enemy.id) * 1.2;
      container.setPosition(p.x, p.y - 10 * scale + bob).setScale(scale * (enemy.kind === "stone" ? 1.25 : 1)).setDepth(100 + p.y / 10);
      const life = this.lifeBars.get(enemy.id)!; life.clear().fillStyle(0x142e29, .9).fillRoundedRect(p.x - 17 * scale, p.y - 35 * scale, 34 * scale, 4, 2);
      life.fillStyle(enemy.slow ? 0x82f2f4 : 0xf5da80).fillRoundedRect(p.x - 17 * scale, p.y - 35 * scale, Math.max(0, 34 * scale * enemy.hp / enemy.maxHp), 4, 2);
      if (enemy.slow) life.lineStyle(2, 0x77dfe8, .9).strokeEllipse(p.x, p.y + 9 * scale, 42 * scale, 14 * scale);
    }
    // Attack ranges live in the non-interactive SVG overlay using this same MAP coordinate transform.
    this.trails.clear();
    for (const effect of this.effects) {
      effect.age += Math.min(delta / 1000, .05); const event = effect.event;
      if (event.type === "shot") {
        const c = CORES[event.core], from = this.point(event.from), to = this.point(event.to), t = Math.min(1, effect.age / .2);
        const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
        if (!preferences.reducedMotion && t < 1) {
          if (event.core === "wood" || event.core === "grove") {
            this.trails.lineStyle(event.core === "grove" ? 4 : 2, c.color).lineBetween(x, y, x - (to.x - from.x) * .13, y - (to.y - from.y) * .13);
          } else if (event.core === "mountain" || event.core === "volcano" || event.core === "wildwood") {
            this.trails.fillStyle(c.color).fillCircle(x, y - Math.sin(t * Math.PI) * 30, event.core === "volcano" ? 7 : 5);
          } else { this.trails.fillStyle(c.color).fillCircle(x, y, event.core === "flame" ? 6 : 4); }
        } else {
          const r = Math.max(5, c.splash * this.scale.width / MAP.width), age = (effect.age - .2) / .2;
          this.trails.lineStyle(event.core === "volcano" ? 4 : 2, c.color, Math.max(0, 1 - age)).strokeCircle(to.x, to.y, preferences.reducedMotion ? 8 : r * Math.max(.2, age));
          if (event.core === "wash" || event.core === "wildwood") this.trails.lineStyle(2, 0xb7f8e5, .6).strokeEllipse(to.x, to.y, r * 1.7, r * .8);
        }
      } else if (event.type === "defeat" && !preferences.reducedMotion) {
        const p = this.point(event.at); this.trails.fillStyle(0xffec9d, Math.max(0, 1 - effect.age * 2));
        for (let i = 0; i < 4; i++) this.trails.fillCircle(p.x + Math.cos(i * Math.PI / 2) * effect.age * 30, p.y + Math.sin(i * Math.PI / 2) * effect.age * 30, 2);
      }
    }
    this.effects = this.effects.filter(e => e.age < .43).slice(-90);
  }
  reset(): void { this.effects = []; this.accumulator = 0; }
}
