export const IDS = ['shutter_left','shutter_right','curtain','wind_chime','plant','cup','book','cat'] as const;
export type Piece = typeof IDS[number];
export const LABELS: Record<Piece,string> = { shutter_left:'窗扇一', shutter_right:'窗扇二', curtain:'窗帘',wind_chime:'风铃',plant:'盆栽',cup:'茶杯',book:'小书',cat:'木猫' };
export interface BoxState { version:1; placed:Piece[]; open:Piece[]; help:boolean; muted:boolean }
export const fresh = ():BoxState => ({version:1,placed:[],open:[],help:false,muted:false});
export const shutter = (id:Piece) => id.startsWith('shutter');
export const fits = (a:Piece,b:Piece) => a===b || shutter(a)&&shutter(b);
export const windy = (s:BoxState) => s.open.some(id=>s.placed.includes(id)&&shutter(id));
export function restore(raw:unknown):BoxState {
  if (!raw || typeof raw!=='object') return fresh();
  const r=raw as Partial<BoxState>; if(r.version!==1) return fresh();
  const placed=IDS.filter(id=>Array.isArray(r.placed)&&r.placed.includes(id));
  return {version:1,placed,open:placed.filter(id=>shutter(id)&&Array.isArray(r.open)&&r.open.includes(id)),help:r.help===true,muted:r.muted===true};
}
export type Action = {type:'place';piece:Piece;slot:Piece}|{type:'undo';slot:Piece}|{type:'interact';slot:Piece}|{type:'help'}|{type:'mute'}|{type:'reset'};
export function reduce(s:BoxState,a:Action):BoxState {
  switch(a.type){
    case 'place': return !fits(a.piece,a.slot)||s.placed.includes(a.slot)?s:{...s,placed:[...s.placed,a.slot]};
    case 'undo':return {...s,placed:s.placed.filter(id=>id!==a.slot),open:s.open.filter(id=>id!==a.slot)};
    case 'interact':return !shutter(a.slot)||!s.placed.includes(a.slot)?s:{...s,open:s.open.includes(a.slot)?s.open.filter(id=>id!==a.slot):[...s.open,a.slot]};
    case 'help':return {...s,help:!s.help};
    case 'mute':return {...s,muted:!s.muted};
    case 'reset':return {...fresh(),help:s.help,muted:s.muted};
  }
}
