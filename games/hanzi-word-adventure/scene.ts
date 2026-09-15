import Phaser from 'phaser';
import { FONT_STACK } from './content';
import { at, actorGlyph, effect, illumination, visible } from './model';
import { ROOMS, lastInChapter, type Direction, type Room, type WorldState } from './rooms';
export interface SceneView { room: Room; state: WorldState; selected: number | null; target: number; facing: Direction; binding: string | null; preview: number[]; reducedMotion: boolean; }
const INK = '#28473f', RUST = '#aa493a', WATER = '#538796';
const arrows = { up: '↑', right: '→', down: '↓', left: '←' };

/** Text is the scene, not a label pasted over illustration. All geometry uses tile indices. */
export class AdventureScene extends Phaser.Scene {
  private view?: SceneView;
  private paper?: Phaser.GameObjects.Graphics;
  private marks?: Phaser.GameObjects.Graphics;
  private glyphs: Phaser.GameObjects.Text[] = [];
  private objects: Phaser.GameObjects.Text[] = [];
  private notes: Phaser.GameObjects.Text[] = [];
  private person?: Phaser.GameObjects.Text;
  private companion?: Phaser.GameObjects.Text;
  private roomId = '';
  private water: { text: Phaser.GameObjects.Text; y: number; phase: number }[] = [];
  private ready = false;
  private transitions: Phaser.GameObjects.Text[] = [];
  private changeMarks?: Phaser.GameObjects.Graphics;
  constructor(private readonly onReady: () => void) { super('word-adventure'); }
  create() { this.paper = this.add.graphics(); this.marks = this.add.graphics(); this.changeMarks=this.add.graphics().setDepth(2); this.person = this.text('人').setDepth(5); this.companion = this.text('友').setDepth(5); this.ready = true; if (this.view) this.sync(this.view); this.onReady(); }
  private text(value = '') { return this.add.text(0, 0, value, { fontFamily: FONT_STACK, fontSize: '32px', color: INK, padding: { x: 3, y: 3 } }).setOrigin(.5); }
  private set(text: Phaser.GameObjects.Text, value: string, size: number, color: string) {
    if (text.text !== value) text.setText(value);
    if (text.style.fontSize !== `${size}px`) text.setFontSize(size);
    if (text.style.color !== color) text.setColor(color);
  }
  sync(view: SceneView, from?: number) {
    const previous=this.view;
    this.view = view; if (!this.ready) return;
    for(const ghost of this.transitions){this.tweens.killTweensOf(ghost);ghost.destroy();}this.transitions=[];
    this.tweens.killTweensOf(this.changeMarks!);this.changeMarks!.clear().setAlpha(1);
    const { room, state } = view, light = illumination(room, state), cell = this.scale.width / room.width;
    const center = (pos: number) => ({ x: (pos % room.width + .5) * cell, y: (Math.floor(pos / room.width) + .5) * cell });
    if (this.roomId !== room.id) {
      [...this.glyphs, ...this.objects, ...this.notes].forEach(t => t.destroy());
      this.glyphs = room.tiles.map(() => this.text().setDepth(1)); this.objects = room.tiles.map(() => this.text().setDepth(3)); this.notes = room.tiles.map(() => this.text().setDepth(4)); this.roomId = room.id;
    }
    this.tweens.killTweensOf(this.person!); this.paper!.clear(); this.marks!.clear(); this.water = [];
    const g = this.paper!, ink = this.marks!;
    const paperColors={homeward:0xfaf5e9,lamplight:0xfaf1dc,confluence:0xf0f2e6,companions:0xfaf0e8};
    g.fillStyle(paperColors[room.chapterId], 1).fillRect(0, 0, this.scale.width, this.scale.height);
    for (const [pos, tile] of room.tiles.entries()) {
      const { x, y } = center(pos), left = x - cell / 2, top = y - cell / 2, item = visible(room,state,pos) ? at(state, pos) : undefined;
      const occupied = (pos === state.player || pos === state.companion) && (item || tile === 'goal' || tile === 'door' || tile === 'wind' || tile === 'shadow');
      let glyph = '', color = INK, size = Math.round(cell * .57), note = '';
      const active = effect(room, state, pos);
      if (light.has(pos)) { g.fillStyle(0xefbd42, .13).fillRect(left+1,top+1,cell-2,cell-2); }
      if (tile === 'shadow') { glyph = item ? '' : '影'; size = Math.round(cell * .48); color = light.has(pos) ? '#725719' : '#626276'; note = light.has(pos) ? `亮·${light.get(pos)}步` : '暗·不通'; g.fillStyle(light.has(pos) ? 0xf4d889 : 0x8b859d, light.has(pos) ? .25 : .22).fillRoundedRect(left+2,top+2,cell-4,cell-4,4); }
      else if (tile === 'wall') {
        // The mountain terrain has no pickup outline; tiny distant strokes stay in this mountain cell.
        glyph = '山'; color = '#85917f'; size = Math.round(cell * .54);
        // Quiet terrain ink, not a wall of heavy cards.
        g.lineStyle(Math.max(1,cell*.012),0xa7ad96,.25).lineBetween(left+cell*.2,top+cell*.81,left+cell*.8,top+cell*.81);
      } else if (tile === 'floor') {
        g.fillStyle(0xc8bda7, .6).fillCircle(x, y, 1.1);
      } else if (tile === 'water') {
        g.fillStyle(0x98c7c8, .2).fillRect(left, top, cell, cell); glyph = item ? '' : '水'; color = WATER;
        note = item ? '水' : '';
      } else if (tile === 'goal') {
        glyph = lastInChapter(ROOMS.indexOf(room)) ? '家' : '路'; color = RUST; note = lastInChapter(ROOMS.indexOf(room)) ? '回家' : '前路';
        if (room.chapterId === 'companions') { glyph = '家'; note = `家${room.tiles.slice(0,pos+1).filter(t => t === 'goal').length}`; }
        g.fillStyle(0xc4774c, .1).fillCircle(x, y, cell * .44); g.lineStyle(1.2, 0xb47d52, .6).strokeCircle(x, y, cell * .43);
      } else if (tile === 'door') {
        glyph = '门'; note = active ? '开' : '关'; color = active ? INK : '#896a5b';
        g.lineStyle(active ? 1 : 3, active ? 0x759181 : 0x896a5b, .8).strokeRoundedRect(left + 5, top + 3, cell - 10, cell - 6, 3);
        if (!active) g.lineBetween(left + 5, y, left + cell - 5, y);
      } else if (tile === 'wind') {
        glyph = '风'; color = active ? '#547674' : '#8c9690'; note = active ? arrows[room.wind[pos]!] : '停';
        g.fillStyle(0x97b4ad, active ? .2 : .08).fillRoundedRect(left + 2, top + 2, cell - 4, cell - 4, 5);
      }
      const sentence = room.sentences.find(s => s.cells.includes(pos));
      if (sentence) {
        const slot = sentence.cells.indexOf(pos); glyph = slot === 0 ? sentence.subject : slot === 2 ? sentence.verb : item ? '' : '·';
        color = '#4f7068'; size = Math.round(cell * .55);
        g.fillStyle(0xd7e3d7, .55).fillRect(left + 1, top + 3, cell - 2, cell - 6);
        g.lineStyle(1, 0x759084, .7).lineBetween(left + 2, top + cell - 5, left + cell - 2, top + cell - 5);
        if (slot === 1 && !item) { g.lineStyle(1, 0x759084, .5).strokeRect(left + 9, top + 9, cell - 18, cell - 18); }
      }
      // The person and its support stay in one logical tile, with separate whole glyphs.
      this.set(this.glyphs[pos], occupied && tile === 'goal' && room.chapterId === 'companions' ? '' : glyph, occupied ? Math.round(cell * .32) : size, color);
      this.glyphs[pos].setPosition(x + (occupied ? cell * .29 : 0), tile === 'shadow' ? top + cell * .35 : y).setAlpha(1);
      if (tile === 'water' && !item) this.water.push({ text: this.glyphs[pos], y, phase: pos });
      if (item) {
        const bridge = tile === 'water';
        g.fillStyle(0xfffcf4, .95).fillRoundedRect(left + 6, top + 4, cell - 12, cell - (bridge ? 14 : 8), 3);
        g.lineStyle(Math.max(1.4,cell*.018), item.kind === '不' ? 0xaa493a : 0x60755b, .85).strokeRoundedRect(left + 6, top + 4, cell - 12, cell - (bridge ? 14 : 8), 3);
        if (bridge) g.lineStyle(1, 0x97784a, .8).lineBetween(left + 8, top + cell - 9, left + cell - 8, top + cell - 9);
      }
      this.set(this.objects[pos], item?.kind ?? '', Math.round(cell * (occupied ? .32 : tile === 'shadow' ? .48 : .6)), item?.kind === '不' ? RUST : INK);
      this.objects[pos].setPosition(x + (occupied ? cell * .29 : 0), tile === 'shadow' ? top + cell * .35 : y - (tile === 'water' && item ? 3 : 0));
      this.set(this.notes[pos], note, Math.max(11, Math.round(cell * .2)), tile === 'water' ? WATER : INK);
      this.notes[pos].setPosition(x, top + cell - (tile === 'shadow' ? Math.max(8, Math.round(cell * .14)) : 7));
      if (pos === view.target) { ink.lineStyle(3, 0x2a7160, 1).strokeRoundedRect(left+4,top+4,cell-8,cell-8,5); this.set(this.notes[pos], tile === 'shadow' || tile === 'goal' ? note : '目标', Math.max(11,Math.round(cell*.2)), '#235748'); }
      if (view.preview.includes(pos)) ink.lineStyle(2, 0xb56c31, .9).strokeRoundedRect(left + 2, top + 2, cell - 4, cell - 4, 7);
      if (pos === view.selected) {
        ink.lineStyle(2.5, 0xb34e3d, 1).strokeRoundedRect(left + 1, top + 1, cell - 2, cell - 2, 6);
        ink.fillStyle(0xb34e3d, 1).fillTriangle(left + 5, top + 2, left + 14, top + 2, left + 5, top + 11);
      }
    }
    const binding = room.sentences.find(s => s.id === view.binding);
    if (binding) {
      const origin = center(binding.cells[1]);
      for (const target of binding.targets) {
        const end = center(target); ink.lineStyle(2, 0x326d69, .8).strokeRect(end.x - cell / 2 + 1, end.y - cell / 2 + 1, cell - 2, cell - 2);
        // Dotted binding guide, deliberately below glyphs and without input capture.
        const length = Phaser.Math.Distance.Between(origin.x, origin.y, end.x, end.y);
        for (let d = 0; d <= length; d += 9) { const t = length ? d / length : 0; ink.fillStyle(0x326d69, .6).fillCircle(origin.x + (end.x - origin.x) * t, origin.y + (end.y - origin.y) * t, 1.3); }
      }
      binding.cells.forEach(p => { const c = center(p); ink.lineStyle(2, 0x326d69, 1).strokeRect(c.x - cell / 2 + 1, c.y - cell / 2 + 1, cell - 2, cell - 2); });
    }
    const hasSupportGlyph = (pos: number) => !!at(state, pos) || ['goal', 'door', 'wind', 'shadow'].includes(room.tiles[pos]);
    const companionHome = (pos: number) => room.chapterId === 'companions' && room.tiles[pos] === 'goal';
    const personPoint = (pos: number) => { const p = center(pos); return companionHome(pos) ? { x:p.x, y:p.y-cell*.13 } : { x: p.x - (hasSupportGlyph(pos) ? cell * .19 : 0), y: p.y }; };
    const p = personPoint(state.player), besideSupport = hasSupportGlyph(state.player);
    this.set(this.person!, actorGlyph(state), Math.round(cell * (companionHome(state.player) ? .49 : besideSupport ? .53 : .67)), RUST);
    ink.lineStyle(1.5, 0xb34e3d, .55).strokeCircle(p.x, p.y, cell * (companionHome(state.player) ? .28 : besideSupport ? .29 : .4));
    this.companion!.setVisible(state.companion !== undefined);
    if (state.companion !== undefined) { const other = personPoint(state.companion), support = hasSupportGlyph(state.companion), home = companionHome(state.companion); this.set(this.companion!, state.active === 'person' ? '友' : '人', Math.round(cell*(home ? .49 : support ? .53 : .67)), INK); this.companion!.setPosition(other.x,other.y); ink.lineStyle(1,0x28473f,.6).strokeRoundedRect(other.x-cell*.3,other.y-cell*(home ? .28 : .34),cell*.6,cell*(home ? .56 : .68),4); }
    if (from !== undefined && from !== state.player && !view.reducedMotion) {
      const previous = personPoint(from); this.person!.setPosition(previous.x, previous.y);
      this.tweens.add({ targets: this.person, x: p.x, y: p.y, duration: 150, ease: 'Sine.easeOut' });
    } else this.person!.setPosition(p.x, p.y);
    // Transient presentation is always derived AFTER the atomic model transition.
    // A later input discards its ghosts and paints the new authoritative state immediately.
    if(previous && previous.room.id===room.id && previous.state!==state){
      const oldLight=illumination(room,previous.state), changedLight=[...new Set([...oldLight.keys(),...light.keys()])].filter(pos=>oldLight.get(pos)!==light.get(pos));
      for(const pos of changedLight){const c=center(pos);this.changeMarks!.lineStyle(Math.max(2,cell*.025),light.has(pos)?0xc69235:0x69617d,.8).strokeRect(c.x-cell*.46,c.y-cell*.46,cell*.92,cell*.92);}
      for(const entity of state.entities){
        const old=previous.state.entities.find(e=>e.atoms===entity.atoms);
        if(entity.pos===null || (old && old.pos===entity.pos && old.kind===entity.kind))continue;
        const end=center(entity.pos);this.changeMarks!.lineStyle(Math.max(2,cell*.025),0xaa493a,.75).strokeCircle(end.x,end.y,cell*.43);
        if(!view.reducedMotion){
          // Split pieces originate at their ground parent; undo follows the same conserved atoms.
          const source=old??previous.state.entities.find(e=>(e.atoms&entity.atoms)!==0);
          const origin=center(source?.pos??previous.state.player),ghost=this.text(entity.kind).setFontSize(Math.round(cell*.52)).setColor('#aa493a').setDepth(6).setPosition(origin.x,origin.y);
          this.transitions.push(ghost);this.tweens.add({targets:ghost,x:end.x,y:end.y,alpha:0,duration:170,ease:'Sine.easeOut'});
        }
      }
      if(previous.state.active!==state.active){this.changeMarks!.lineStyle(Math.max(2,cell*.035),0xaa493a,.85).strokeCircle(p.x,p.y,cell*.43);}
      if(!view.reducedMotion)this.tweens.add({targets:this.changeMarks,alpha:0,duration:220});
    }
  }
  update(time: number) {
    if (!this.view || this.view.reducedMotion) return;
    for (const water of this.water) water.text.y = water.y + Math.sin(time / 1200 + water.phase) * 1.4;
  }
}
