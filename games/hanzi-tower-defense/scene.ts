import {rulesFor} from './tactics';
import {mapFor, pathLength} from "./maps";
import Phaser from "phaser";
import { CORES } from "./content";
import { ENEMIES, MAP, enemyPosition, pointOnPath, updateBattle, type BattleEvent, type BattleState, type Enemy, type Point } from "./model";
import type { Preferences } from "./save";

export const ART = "./assets/hanzi-tower-defense/";
const RUNTIME_ART = "./assets/v1.0/tower/";
interface SceneHooks {
  state(): BattleState;
  preferences(): Preferences & { lowPerformance: boolean };
  assetsFailed(failed:boolean):void;
  speed(): 1 | 2;
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
  private accumulator = 0;
  private assetPaths=new Map<string,string>();
  private failed=new Set<string>();
  private uiElapsed = 0;
  constructor(private readonly hooks: SceneHooks) { super("hanzi-defense"); }
  private queue(key:string,url:string):void { this.assetPaths.set(key,url);if(!this.textures.exists(key))this.load.image(key,url); }
  preload(): void {
    this.load.on('loaderror',(file:Phaser.Loader.File)=>{this.failed.add(file.key);this.hooks.assetsFailed(true);});
    this.load.on('filecomplete',(key:string)=>{this.failed.delete(key);this.hooks.assetsFailed(this.failed.size>0);if(this.terrain){this.drawTerrain();if(key.startsWith('td-enemy')){for(const c of this.monsters.values())c.destroy();this.monsters.clear();for(const c of this.lifeBars.values())c.destroy();this.lifeBars.clear();}}});
    this.queue(`td-env-${this.hooks.state().mapId??'qinglan-pass'}`,`${RUNTIME_ART}${this.hooks.state().mapId??'qinglan-pass'}.webp`);
    this.queueCreatures();
  }
  private queueCreatures():void {
    const kinds=new Set<string>(rulesFor(this.hooks.state()).waves.flatMap(w=>w.foes));if(kinds.has('captain')){kinds.add('captain-call');kinds.add('swarm');}
    for(const kind of kinds)this.queue(`td-enemy-${kind}`,`${RUNTIME_ART}${kind}.webp`);
  }
  retryAssets():void {
    for(const key of this.failed)this.load.image(key,this.assetPaths.get(key)!);
    if(!this.load.isLoading())this.load.start();
  }
  create(): void {
    this.terrain = this.add.image(0, 0, "__WHITE").setOrigin(0);
    this.road = this.add.graphics(); this.trails = this.add.graphics().setDepth(500);
    this.drawTerrain(); this.scale.on("resize", this.drawTerrain, this); this.hooks.ready();
  }
  private point(p: Point): Point { return { x: p.x * this.scale.width / MAP.width, y: p.y * this.scale.height / MAP.height }; }
  private drawTerrain(): void {
    if (!this.terrain) return;
    const key=`td-env-${this.hooks.state().mapId??'qinglan-pass'}`;
    const loaded=this.textures.exists(key);
    if(loaded)this.terrain.setTexture(key);
    this.cameras.main.setBackgroundColor(this.hooks.state().mapId==='beacon-keep'?0x686b59:0x376757);
    this.terrain.setDisplaySize(this.scale.width, this.scale.height);this.terrain.setVisible(loaded); this.road.clear();
    const paths=mapFor(this.hooks.state().mapId).paths;
    const scale = this.scale.width / MAP.width;
    // A continuous three-layer road reads as terrain, with clipped corners and small inset stones.
    for(const PATH of paths) for (const [width, color] of [[53, 0x3d4437], [46, 0x9c8e6a], [36, 0xc1af83]] as const) {
      this.road.lineStyle(Math.max(8, width * scale), color, 1); this.road.beginPath();
      PATH.forEach((p, i) => { const q = this.point(p); if (i === 0) this.road.moveTo(q.x, q.y); else this.road.lineTo(q.x, q.y); }); this.road.strokePath();
      for (const p of PATH.slice(1, -1)) { const q = this.point(p); this.road.fillStyle(color); this.road.fillCircle(q.x, q.y, Math.max(4, width * scale / 2)); }
    }
    for(const [lane,path] of paths.entries()) for (let n = 40; n < pathLength(path); n += 58) {
      const p = this.point(pointOnPath(n,this.hooks.state().mapId,lane)); this.road.fillStyle(0xe5cf9d, .7);
      this.road.fillRoundedRect(p.x - 4 * scale, p.y - 3 * scale, Math.max(3, 9 * scale), Math.max(2, 5 * scale), 2);
    }
  }
  private createMonster(enemy: Enemy): Phaser.GameObjects.Container {
    const key=`td-enemy-${enemy.kind}`,parts:Phaser.GameObjects.GameObject[]=[];
    if(this.textures.exists(key))parts.push(this.add.image(0,8,key).setOrigin(.5,.93).setDisplaySize(enemy.kind==='captain'?55:46,enemy.kind==='captain'?63:53));
    else {
      // Temporary, identifiable recovery art; never a missing-texture checkerboard.
      const color=enemy.kind==='swarm'?0x74b26b:enemy.kind==='swift'?0xcf7549:enemy.kind==='stone'?0x8caaa6:0xd2b26c;
      const body=this.add.graphics().fillStyle(color).fillRoundedRect(-17,-29,34,36,enemy.kind==='swift'?12:6);
      body.lineStyle(2,0xe8dbb4).strokeRoundedRect(-17,-29,34,36,6);parts.push(body);
      parts.push(this.add.text(0,-13,enemy.kind==='captain'?'令':enemy.kind==='stone'?'甲':enemy.kind==='swift'?'快':'团',{fontFamily:'Microsoft YaHei',fontSize:'17px',color:'#17382f'}).setOrigin(.5));
    }
    const container = this.add.container(0, 0, parts); this.monsters.set(enemy.id, container);
    this.lifeBars.set(enemy.id, this.add.graphics().setDepth(400)); return container;
  }
  update(_time: number, delta: number): void {
    if (!this.road) return;
    const state = this.hooks.state(), preferences = this.hooks.preferences();
    if (state.phase === "battle" && !state.paused && !document.hidden) {
      this.accumulator += Math.min(delta / 1000, .1) * this.hooks.speed();
      while (this.accumulator >= .05) { const events = updateBattle(state, .05); this.accumulator -= .05; this.hooks.events(events); }
    } else this.accumulator = 0;
    this.uiElapsed += delta; if (this.uiElapsed > 150) { this.uiElapsed = 0; this.hooks.tick(); }
    const alive = new Set(state.enemies.map(e => e.id));
    for (const [id, container] of this.monsters) if (!alive.has(id)) { container.destroy(); this.monsters.delete(id); this.lifeBars.get(id)?.destroy(); this.lifeBars.delete(id); }
    const scale = Math.max(.64, Math.min(1.15, this.scale.width / MAP.width));
    for (const enemy of state.enemies) {
      const container = this.monsters.get(enemy.id) ?? this.createMonster(enemy), p = this.point(enemyPosition(state,enemy));
      const bob = preferences.reducedMotion || preferences.lowPerformance || state.paused ? 0 : Math.sin(state.elapsed * (enemy.kind === "swift" ? 17 : 8) + enemy.id) * 1.2;
      container.setPosition(p.x, p.y - 10 * scale + bob).setScale(scale * (enemy.kind === "captain" ? 1.23 : enemy.kind === "stone" ? 1.12 : 1)).setDepth(100 + p.y / 10);
      const picture=container.list[0];
      if(picture instanceof Phaser.GameObjects.Image){
        const key=`td-enemy-${enemy.kind==='captain' && enemy.summonAt!==undefined?'captain-call':enemy.kind}`;
        if(this.textures.exists(key) && picture.texture.key!==key)picture.setTexture(key);
        const before=this.point(pointOnPath(Math.max(0,enemy.distance-1),state.mapId,enemy.lane??0));
        if(Math.abs(p.x-before.x)>.01)picture.setFlipX(p.x<before.x);
        const hit=state.visuals.some(v=>v.event.type==='shot' && v.event.enemyId===enemy.id && v.age<.09);
        picture.setAlpha(hit?.82:1);
      }
      const barHeight=enemy.kind==='captain'?80:enemy.kind==='stone'?63:57;
      const life = this.lifeBars.get(enemy.id)!; life.clear().fillStyle(0x142e29, .9).fillRoundedRect(p.x - 17 * scale, p.y - barHeight * scale, 34 * scale, 4, 2);
      life.fillStyle(enemy.zoneSlow ? 0xd5f58c : enemy.slow ? 0x82f2f4 : 0xf5da80).fillRoundedRect(p.x - 17 * scale, p.y - barHeight * scale, Math.max(0, 34 * scale * enemy.hp / enemy.maxHp), 4, 2);
      if(enemy.kind==='captain') {life.lineStyle(3,enemy.summonAt!==undefined?0xffc153:0xc1e7e1,.95).strokeCircle(p.x,p.y-10*scale,34*scale);if(enemy.summonAt!==undefined)life.lineStyle(4,0xffdf79,.8).strokeCircle(p.x,p.y-10*scale,(preferences.reducedMotion?36:36+Math.sin(state.waveTime*3)*2)*scale);}
      if (enemy.slow) life.lineStyle(2, 0x77dfe8, .9).strokeEllipse(p.x, p.y + 9 * scale, 42 * scale, 14 * scale);
    }
    // Attack ranges live in the non-interactive SVG overlay using this same MAP coordinate transform.
    this.trails.clear();
    for (const zone of state.rootZones) {
      const p=this.point(zone.at), sx=this.scale.width/MAP.width, sy=this.scale.height/MAP.height;
      const grow=preferences.reducedMotion?1:Math.min(1,(state.waveTime-zone.born)/.25), alpha=Math.min(1,(zone.expires-state.waveTime)/.3);
      this.trails.fillStyle(0x98bd54,.16*alpha).fillEllipse(p.x,p.y,zone.radius*2*sx,zone.radius*2*sy);
      for(let i=0;i<(preferences.lowPerformance?3:7);i++) {
        const angle=i*Math.PI*2/7, radius=zone.radius*grow;
        const tip={x:p.x+Math.cos(angle)*radius*sx,y:p.y+Math.sin(angle)*radius*sy};
        const bend={x:p.x+Math.cos(angle+.35)*radius*.55*sx,y:p.y+Math.sin(angle+.35)*radius*.55*sy};
        this.trails.lineStyle(3,0x64552b,.85*alpha).beginPath().moveTo(p.x,p.y).lineTo(bend.x,bend.y).lineTo(tip.x,tip.y).strokePath();
        this.trails.lineStyle(1,0xdae99a,alpha).lineBetween(bend.x,bend.y,tip.x,tip.y);
        this.trails.fillStyle(0xc9e58c,alpha).fillEllipse(tip.x,tip.y,6,3);
      }
    }
    for (const echo of state.echoes) {
      const p=this.point(echo.at), w=echo.radius*2*this.scale.width/MAP.width, h=echo.radius*2*this.scale.height/MAP.height;
      this.trails.lineStyle(2,0xffd071,.7).strokeEllipse(p.x,p.y,w,h);
      this.trails.fillStyle(0xff8b36,.12).fillEllipse(p.x,p.y,w,h);
    }
    for (const effect of (preferences.lowPerformance?state.visuals.slice(-18):state.visuals)) {
      const event = effect.event;
      if (event.type === "shot") {
        const c = CORES[event.core], from = this.point(event.from), to = this.point(event.to), t = Math.min(1, effect.age / .2);
        // Damage has already settled in the model. Mark that hit immediately;
        // the short tracer is only a directional after-image.
        this.trails.lineStyle(2,c.color,Math.max(0,1-effect.age/.25)).strokeCircle(to.x,to.y,preferences.reducedMotion?6:5+effect.age*24);
        const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
        if (!preferences.reducedMotion && !preferences.lowPerformance && t < 1) {
          if (event.core === "wood" || event.core === "grove" || event.core === "canopy" || event.core === "forest") {
            this.trails.lineStyle(event.core === "grove" ? 4 : 2, c.color).lineBetween(x, y, x - (to.x - from.x) * .13, y - (to.y - from.y) * .13);
          } else if (event.core === "mountain" || event.core === "volcano" || event.core === "wildwood") {
            this.trails.fillStyle(c.color).fillCircle(x, y - Math.sin(t * Math.PI) * 30, event.core === "volcano" ? 7 : 5);
          } else { this.trails.fillStyle(c.color).fillCircle(x, y, event.core === "flame" ? 6 : 4); }
        } else {
          const r = Math.max(5, c.splash * this.scale.width / MAP.width), age = (effect.age - .2) / .2;
          this.trails.lineStyle(event.core === "volcano" ? 4 : 2, c.color, Math.max(0, 1 - age)).strokeCircle(to.x, to.y, preferences.reducedMotion ? 8 : r * Math.max(.2, age));
          if (event.core === "wash" || event.core === "wildwood") this.trails.lineStyle(2, 0xb7f8e5, .6).strokeEllipse(to.x, to.y, r * 1.7, r * .8);
        }
      } else if (event.type === 'echo') {
        const p=this.point(event.at), t=Math.min(1,effect.age/.6), w=event.radius*2*this.scale.width/MAP.width, h=event.radius*2*this.scale.height/MAP.height;
        this.trails.fillStyle(0xffac3e,.28*(1-t)).fillEllipse(p.x,p.y,w,h);
        this.trails.lineStyle(4,0xffe5a0,1-t).strokeEllipse(p.x,p.y,w*(preferences.reducedMotion?1:.4+.6*t),h*(preferences.reducedMotion?1:.4+.6*t));
        for(let i=0;i<5;i++) { const a=i*Math.PI*2/5; this.trails.fillStyle(0xffb448,1-t).fillCircle(p.x+Math.cos(a)*w*.35*t,p.y+Math.sin(a)*h*.35*t-(preferences.reducedMotion?0:14*Math.sin(t*Math.PI)),3); }
      } else if (event.type === "defeat" && !preferences.reducedMotion && !preferences.lowPerformance) {
        const p = this.point(event.at); this.trails.fillStyle(0xffec9d, Math.max(0, 1 - effect.age * 2));
        for (let i = 0; i < 4; i++) this.trails.fillCircle(p.x + Math.cos(i * Math.PI / 2) * effect.age * 30, p.y + Math.sin(i * Math.PI / 2) * effect.age * 30, 2);
      }
    }
  }
  reset(): void { this.accumulator = 0; this.trails?.clear();
    const id=this.hooks.state().mapId??'qinglan-pass',key=`td-env-${id}`;
    if(!this.textures.exists(key)){this.queue(key,`${RUNTIME_ART}${id}.webp`);if(!this.load.isLoading())this.load.start();}
    this.queueCreatures();if(!this.load.isLoading())this.load.start();
    this.drawTerrain();for(const c of this.monsters.values())c.destroy();this.monsters.clear();for(const c of this.lifeBars.values())c.destroy();this.lifeBars.clear(); }
}
