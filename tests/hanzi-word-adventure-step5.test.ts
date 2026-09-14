import {describe,it,expect} from 'vitest';
import {ROOMS,CHAPTERS,type WorldState} from '../games/hanzi-word-adventure/rooms';
import {act,carried,clone,illumination,perform,newJourney,undo,validState,effect} from '../games/hanzi-word-adventure/model';
import {solve} from '../games/hanzi-word-adventure/solver';
import {openSave,COMPANION_SAVE_KEY,SAVE_KEY,LEGACY_SAVE_KEY,validCompanionSave,validSaveV2} from '../games/hanzi-word-adventure/save';
const storage=()=>{const data=new Map<string,string>();return{data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}}};
const preferences={reducedMotion:true};
describe('STEP5 companion atomic world',()=>{
  it('keeps original chapters single, new identities stable and exactly two homes',()=>{
    expect(CHAPTERS.map(c=>c.id)).toEqual(['homeward','lamplight','confluence','companions']);
    for(const r of ROOMS.slice(0,15)){expect(r.initial.companion).toBeUndefined();expect(act(r,r.initial,{type:'switch'}).state).toBe(r.initial);expect(validState(r,{...r.initial,companion:1,active:'person'})).toBe(false);}
    expect(ROOMS.slice(15).map(r=>r.id)).toEqual([1,2,3,4,5].map(n=>`companions-${n}`));for(const r of ROOMS.slice(15))expect(r.tiles.filter(t=>t==='goal')).toHaveLength(2);
  });
  it('switch swaps control only, keeps material ownership, illumination and both absolute positions; undo restores all',()=>{
    const r=ROOMS[15];let j=perform(newJourney(15),{type:'switch'}).journey;j=perform(j,{type:'take',target:11}).journey;
    const before=clone(j),lit=[...illumination(r,j.state)];const changed=perform(j,{type:'switch'});expect(changed.result.ok).toBe(true);expect(changed.journey.state.entities).toEqual(before.state.entities);expect([...illumination(r,changed.journey.state)]).toEqual(lit);expect(changed.journey.state.player).toBe(before.state.companion);expect(changed.journey.state.companion).toBe(before.state.player);expect(undo(changed.journey)).toEqual(before);expect(carried(changed.journey.state)).toBeUndefined();
    const invalid=clone(j.state);invalid.entities.push({...invalid.entities.find(e=>e.kind==='木')!,pos:null,holder:'friend'});expect(validState(r,invalid)).toBe(false);
  });
  it('rejects walking through friend and taking their bridge without partial movement/material loss',()=>{
    const r=ROOMS[16],s=clone(r.initial);s.entities.find(e=>e.kind==='木')!.pos=26;s.player=19;s.companion=26;s.entities.find(e=>e.kind==='明')!.pos=12;expect(validState(r,s)).toBe(true);
    for(const a of [{type:'move',direction:'down'},{type:'take',target:26}]){const out=act(r,s,a);expect(out.ok).toBe(false);expect(out.state).toBe(s);}
  });
  it('material changes hands only after a real ground placement and the other actor walks next to it',()=>{
    const room=clone(ROOMS[16]);room.tiles[16]='floor';let state={...clone(room.initial),companion:10};state.entities.find(e=>e.kind==='木')!.pos=9;state.entities.find(e=>e.kind==='明')!.pos=12;expect(validState(room,state)).toBe(true);
    for(const action of [{type:'take',target:9},{type:'move',direction:'right'},{type:'put',target:8},{type:'move',direction:'down'},{type:'switch'},{type:'move',direction:'left'},{type:'take',target:8}]){const out=act(room,state,action);expect(out.ok).toBe(true);expect(validState(room,out.state)).toBe(true);state=out.state as typeof state;}
    expect(carried(state)?.kind).toBe('木');expect(carried(state)?.holder).toBe('friend');expect(state.entities.filter(e=>e.kind==='木')).toHaveLength(1);
  });
  it('both carried lamps and ground lamps illuminate, and moving or splitting light cannot strand the inactive actor',()=>{
    const r=clone(ROOMS[15]);r.tiles[18]='floor';const s:WorldState={...clone(r.initial),player:18,companion:12,active:'friend'};s.entities.find(e=>e.kind==='明')!.pos=11;
    expect(validState(r,s)).toBe(true);const out=act(r,s,{type:'split',target:11,side:'left'});expect(out.ok).toBe(false);expect(out.state).toBe(s);
    s.entities.find(e=>e.kind==='明')!.pos=null;s.entities.find(e=>e.kind==='明')!.holder='person';expect(illumination(r,s).get(12)).toBe(0);expect(illumination(r,act(r,s,{type:'switch'}).state).get(12)).toBe(0);
  });
  it('changing a door checks the waiting partner, not just the controlled actor',()=>{
    const r=clone(ROOMS[18]);r.sentences[0].cells=[10,11,12];r.tiles[10]='rule';r.tiles[11]='socket';r.tiles[12]='rule';r.tiles[18]='floor';const s=clone(r.initial);s.player=18;s.companion=19;s.entities.find(e=>e.pos===1)!.pos=null;s.entities.find(e=>e.pos===null)!.holder='person';expect(validState(r,s)).toBe(true);expect(act(r,s,{type:'put',target:11}).state).toBe(s);
  });
  it('original action-triggered wind applies to controlled actor; inactive blowing-wind transitions refuse atomically',()=>{
    const r=clone(ROOMS[18]),wind=r.sentences[1].targets[0];const s=clone(r.initial);s.player=wind;s.companion=12;const n=s.entities.find(e=>e.pos===13)!;r.sentences[1].cells=[7,8,9];r.tiles[8]='socket';r.tiles[16]='floor';r.wind[wind]='right';n.pos=8;expect(validState(r,s)).toBe(true);
    const switched=act(r,s,{type:'switch'});expect(switched.state.player).toBe(12);expect(switched.state.companion).toBe(wind);expect(switched.trail).toEqual([]);expect(switched.state.entities).toEqual(s.entities);
    const take=act(r,s,{type:'take',target:8});expect(take.ok).toBe(true);expect(take.state.player).toBe(16);expect(take.trail).toEqual([16]);
    const waiting=clone(s);waiting.player=9;waiting.companion=wind;expect(act(r,waiting,{type:'take',target:8}).state).toBe(waiting);
  });
  it('first arrival stays movable and solid; only two occupied homes wins',()=>{
    const r=ROOMS[15],s=clone(r.initial);s.player=19;s.entities.find(e=>e.kind==='明')!.pos=null;s.entities.find(e=>e.kind==='明')!.holder='person';expect(validState(r,s)).toBe(true);expect(s.won).toBe(false);const leave=act(r,s,{type:'move',direction:'down'});expect(leave.ok).toBe(true);expect(leave.state.won).toBe(false);
  });
  it('each new room solution gives both characters meaningful material work, not an extra exit box',()=>{
    for(const room of ROOMS.slice(15)){const result=solve(room,room.initial);expect(result.status).toBe('solved');expect(result.visited).toBeLessThanOrEqual(40000);let state=clone(room.initial);const workers=new Set();for(const action of result.actions){if(!['move','switch'].includes(action.type))workers.add(state.active);const out=act(room,state,action);expect(out.ok).toBe(true);expect(validState(room,out.state)).toBe(true);state=out.state;}expect(workers).toEqual(new Set(['person','friend']));expect(state.won).toBe(true);}
  });
  it('last room has distinct wind and water strategies under the same budget and real-action replay',()=>{
    const room=ROOMS[19],slot=room.sentences[0].cells[1];for(const mode of ['wind','water']){const result=solve(room,room.initial,{allow:(_,a)=>mode==='wind'?!(a.type==='put'&&room.tiles[a.target]==='water'):!(a.type==='put'&&a.target===slot)});expect(result.status).toBe('solved');let state=clone(room.initial);for(const a of result.actions){const out=act(room,state,a);expect(out.ok).toBe(true);expect(validState(room,out.state)).toBe(true);state=out.state;}expect(state.won).toBe(true);expect(effect(room,state,room.sentences[0].targets[0])).toBe(mode==='water');}
  });
});
describe('STEP5 independently owned companion slot',()=>{
  it('direct companion entry never migrates or writes any original slot',()=>{
    const store=storage(),old=JSON.stringify({version:1,journey:newJourney(),settings:preferences});store.setItem(LEGACY_SAVE_KEY,old);const save=openSave(store,preferences,'companions');save.write(save.select('companions'),preferences);expect(store.getItem(SAVE_KEY)).toBeNull();expect(store.getItem(LEGACY_SAVE_KEY)).toBe(old);expect(validCompanionSave(JSON.parse(store.getItem(COMPANION_SAVE_KEY)!))).toBe(true);
  });
  it('switch, undo and ownership round-trip while mode switching preserves exact other bytes',()=>{
    const store=storage(),save=openSave(store,preferences);const old=perform(newJourney(),{type:'move',direction:'right'}).journey;save.write(old,preferences);const raw=store.getItem(SAVE_KEY);const next=perform(perform(newJourney(15),{type:'switch'}).journey,{type:'take',target:11}).journey;save.write(next,preferences);expect(store.getItem(SAVE_KEY)).toBe(raw);const companionRaw=store.getItem(COMPANION_SAVE_KEY);save.write(save.select('homeward'),preferences);expect(store.getItem(COMPANION_SAVE_KEY)).toBe(companionRaw);const reopen=openSave(store,preferences,'companions');expect(reopen.select('companions')).toEqual(next);expect(undo(reopen.select('companions')).state.entities.find(e=>e.kind==='明')?.pos).toBe(11);expect(validSaveV2({version:2,activeChapterId:'companions',chapters:{companions:next},settings:preferences})).toBe(false);
  });
  it.each(['{broken','{"version":99}','{"version":1,"journey":{}}'])('preserves corrupt/future slot through reset: %s',raw=>{const store=storage();store.setItem(COMPANION_SAVE_KEY,raw);const save=openSave(store,preferences,'companions');save.reset('companions',preferences);expect(save.writable).toBe(false);expect(store.getItem(COMPANION_SAVE_KEY)).toBe(raw);});
  it('competing page or Vault raw wins, reset remains available in memory only',()=>{const store=storage(),save=openSave(store,preferences);save.write(newJourney(15),preferences);store.setItem(COMPANION_SAVE_KEY,'other page');save.reset('companions',preferences);expect(store.getItem(COMPANION_SAVE_KEY)).toBe('other page');expect(save.writable).toBe(false);});
});
