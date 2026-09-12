import Phaser from 'phaser';
import { FONT_STACK } from './content';
import { at, effect, illumination, visible } from './model';
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
  private roomId = '';
  private water: { text: Phaser.GameObjects.Text; y: number; phase: number }[] = [];
  private ready = false;
  constructor(private readonly onReady: () => void) { super('word-adventure'); }
  create() { this.paper = this.add.graphics(); this.marks = this.add.graphics(); this.person = this.text('人').setDepth(5); this.ready = true; if (this.view) this.sync(this.view); this.onReady(); }
  private text(value = '') { return this.add.text(0, 0, value, { fontFamily: FONT_STACK, fontSize: '32px', color: INK, padding: { x: 3, y: 3 } }).setOrigin(.5); }
  private set(text: Phaser.GameObjects.Text, value: string, size: number, color: string) {
    if (text.text !== value) text.setText(value);
    if (text.style.fontSize !== `${size}px`) text.setFontSize(size);
    if (text.style.color !== color) text.setColor(color);
  }
  sync(view: SceneView, from?: number) {
    this.view = view; if (!this.ready) return;
    const { room, state } = view, light = illumination(room, state), cell = this.scale.width / room.width;
    const center = (pos: number) => ({ x: (pos % room.width + .5) * cell, y: (Math.floor(pos / room.width) + .5) * cell });
    if (this.roomId !== room.id) {
      [...this.glyphs, ...this.objects, ...this.notes].forEach(t => t.destroy());
      this.glyphs = room.tiles.map(() => this.text().setDepth(1)); this.objects = room.tiles.map(() => this.text().setDepth(3)); this.notes = room.tiles.map(() => this.text().setDepth(4)); this.roomId = room.id;
    }
    this.tweens.killTweensOf(this.person!); this.paper!.clear(); this.marks!.clear(); this.water = [];
    const g = this.paper!, ink = this.marks!;
    g.fillStyle(0xf5f0e4, 1).fillRect(0, 0, this.scale.width, this.scale.height);
    for (const [pos, tile] of room.tiles.entries()) {
      const { x, y } = center(pos), left = x - cell / 2, top = y - cell / 2, item = visible(room,state,pos) ? at(state, pos) : undefined;
      const occupied = pos === state.player && (item || tile === 'goal' || tile === 'door' || tile === 'wind' || tile === 'shadow');
      let glyph = '', color = INK, size = Math.round(cell * .57), note = '';
      const active = effect(room, state, pos);
      if (light.has(pos)) { g.fillStyle(0xefbd42, .13).fillRect(left+1,top+1,cell-2,cell-2); }
      if (tile === 'shadow') { glyph = item ? '' : '影'; size = Math.round(cell * .48); color = light.has(pos) ? '#725719' : '#626276'; note = light.has(pos) ? `亮·${light.get(pos)}步` : '暗·不通'; g.fillStyle(light.has(pos) ? 0xf4d889 : 0x8b859d, light.has(pos) ? .25 : .22).fillRoundedRect(left+2,top+2,cell-4,cell-4,4); }
      else if (tile === 'wall') {
        // The mountain terrain has no pickup outline; tiny distant strokes stay in this mountain cell.
        glyph = '山'; color = '#8c9d88'; size = Math.round(cell * .56);
        g.fillStyle(0xaab29a, .12).fillRoundedRect(left + 1, top + 1, cell - 2, cell - 2, 5);
      } else if (tile === 'floor') {
        g.fillStyle(0xc8bda7, .6).fillCircle(x, y, 1.1);
      } else if (tile === 'water') {
        g.fillStyle(0x98c7c8, .2).fillRect(left, top, cell, cell); glyph = item ? '' : '水'; color = WATER;
        note = item ? '水' : '';
      } else if (tile === 'goal') {
        glyph = lastInChapter(ROOMS.indexOf(room)) ? '家' : '路'; color = RUST; note = lastInChapter(ROOMS.indexOf(room)) ? '回家' : '前路';
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
      this.set(this.glyphs[pos], glyph, occupied ? Math.round(cell * .32) : size, color);
      this.glyphs[pos].setPosition(x + (occupied ? cell * .29 : 0), tile === 'shadow' ? top + cell * .35 : y).setAlpha(1);
      if (tile === 'water' && !item) this.water.push({ text: this.glyphs[pos], y, phase: pos });
      if (item) {
        const bridge = tile === 'water';
        g.fillStyle(0xfdf9ed, .98).fillRoundedRect(left + 6, top + 4, cell - 12, cell - (bridge ? 14 : 8), 5);
        g.lineStyle(1.8, item.kind === '不' ? 0xaa493a : 0x60755b, .85).strokeRoundedRect(left + 6, top + 4, cell - 12, cell - (bridge ? 14 : 8), 5);
        if (bridge) g.lineStyle(1, 0x97784a, .8).lineBetween(left + 8, top + cell - 9, left + cell - 8, top + cell - 9);
      }
      this.set(this.objects[pos], item?.kind ?? '', Math.round(cell * (occupied ? .32 : tile === 'shadow' ? .48 : .6)), item?.kind === '不' ? RUST : INK);
      this.objects[pos].setPosition(x + (occupied ? cell * .29 : 0), tile === 'shadow' ? top + cell * .35 : y - (tile === 'water' && item ? 3 : 0));
      this.set(this.notes[pos], note, Math.max(11, Math.round(cell * .2)), tile === 'water' ? WATER : INK);
      this.notes[pos].setPosition(x, top + cell - (tile === 'shadow' ? Math.max(8, Math.round(cell * .14)) : 7));
      if (pos === view.target) { ink.lineStyle(3, 0x2a7160, 1).strokeRoundedRect(left+4,top+4,cell-8,cell-8,5); this.set(this.notes[pos], tile === 'shadow' ? note : '目标', Math.max(11,Math.round(cell*.2)), '#235748'); }
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
    const personPoint = (pos: number) => { const p = center(pos); return { x: p.x - (hasSupportGlyph(pos) ? cell * .19 : 0), y: p.y }; };
    const p = personPoint(state.player), besideSupport = hasSupportGlyph(state.player);
    this.set(this.person!, '人', Math.round(cell * (besideSupport ? .53 : .67)), RUST);
    ink.lineStyle(1.5, 0xb34e3d, .55).strokeCircle(p.x, p.y, cell * (besideSupport ? .29 : .4));
    if (from !== undefined && from !== state.player && !view.reducedMotion) {
      const previous = personPoint(from); this.person!.setPosition(previous.x, previous.y);
      this.tweens.add({ targets: this.person, x: p.x, y: p.y, duration: 150, ease: 'Sine.easeOut' });
    } else this.person!.setPosition(p.x, p.y);
  }
  update(time: number) {
    if (!this.view || this.view.reducedMotion) return;
    for (const water of this.water) water.text.y = water.y + Math.sin(time / 1200 + water.phase) * 1.4;
  }
}
