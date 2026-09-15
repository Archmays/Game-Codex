export type Point = [number, number];
export type Strokes = Point[][];
export type IndexRow = [string, number, string, string, string];
export type CharacterIndex = Record<string, IndexRow>;
export interface StrokeData { strokes: string[]; medians: Point[][]; }
export const INPUT_LIMIT = 48;
export const STORAGE_KEY = 'family-games/hanzi-stroke-lab/v1';
export const isHan = (char: string): boolean => /^\p{Script=Han}$/u.test(char) || char === '〇';
export function parseQuery(text: string): {chars: string[]; message: string; valid: boolean} {
  const points = [...text];
  if (points.length > INPUT_LIMIT) return {chars:[], message:`一次最多输入 ${INPUT_LIMIT} 个字符；当前有 ${points.length} 个，请分次查询。`, valid:false};
  const chars = points.filter(isHan);
  const ignored = points.filter(c => !isHan(c));
  return {chars, valid:chars.length > 0, message:!chars.length ? '请输入汉字，或在手写区写一个字。' : ignored.length ? `已忽略 ${ignored.length} 个空格、标点或非汉字；汉字仍按原顺序排列。` : `${chars.length} 个字，按输入顺序排列；重复字保留各自位置。`};
}
export interface ShelfState {version:1; recent:string[]; favorites:string[]; grid:boolean;}
export const emptyShelf = ():ShelfState => ({version:1,recent:[],favorites:[],grid:true});
export interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void; }
export class Shelf {
  state = emptyShelf();
  notice = '';
  writable = true;
  private storedRaw:string|null=null;
  constructor(private storage:StoragePort) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      this.storedRaw=raw;
      if (!raw) return;
      const value:unknown = JSON.parse(raw);
      const v = value as ShelfState;
      const list = (a:unknown):a is string[] => Array.isArray(a) && a.length<=128 && a.every(c=>typeof c==='string' && [...c].length===1 && isHan(c));
      if (!v || v.version!==1 || !list(v.recent) || !list(v.favorites) || typeof v.grid!=='boolean') throw new Error('unknown format');
      this.state={version:1,recent:[...v.recent].slice(0,24),favorites:[...v.favorites],grid:v.grid};
    } catch {
      this.writable=false; this.notice='本地记录暂不可读，原记录已保留。查字与手写仍可使用；本次更改只在当前页面有效。';
    }
  }
  save():void {
    if (!this.writable) return;
    try {
      if(this.storage.getItem(STORAGE_KEY)!==this.storedRaw){this.writable=false;this.notice='本地记录已被其他页面或保险箱更新。请刷新查看新记录；本页不会覆盖它。';return;}
      const raw=JSON.stringify(this.state);this.storage.setItem(STORAGE_KEY,raw);this.storedRaw=raw;
    }
    catch {this.writable=false;this.notice='无法保存本地记录，本次更改只在当前页面有效。';}
  }
  visit(char:string):void {this.state.recent=[char,...this.state.recent.filter(c=>c!==char)].slice(0,24);this.save();}
  favorite(char:string):void {
    const a=this.state.favorites;
    if(a.includes(char)) this.state.favorites=a.filter(c=>c!==char);
    else if(a.length<128) a.push(char);
    else {this.notice='已收藏 128 个字，请先移除一些收藏。';return;}
    this.save();
  }
}
export function normalizeStrokes(strokes:Strokes):Strokes {
  // Keep positions in the square; the upstream recognizer performs its own normalization.
  return strokes.map(s=>s.map(([x,y])=>[Math.round(Math.max(0,Math.min(255,x))),Math.round(Math.max(0,Math.min(255,y)))]));
}
