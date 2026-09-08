import { describe, expect, it } from 'vitest';
import { CHAPTERS, ROOMS } from '../games/hanzi-word-adventure/rooms';
import { act, carried, clone, effect, illumination, visible, combineKind, newJourney, nextRoom, passable, perform, restart, undo, validState, type Action } from '../games/hanzi-word-adventure/model';
import { solve } from '../games/hanzi-word-adventure/solver';
import { openSave, SAVE_KEY, LEGACY_SAVE_KEY, validSaveV2 } from '../games/hanzi-word-adventure/save';
import { WORDS } from '../games/hanzi-word-adventure/content';

describe('word adventure pure rules', () => {
  it('validates every room and whole-glyph record; 林 and 明 have ordered modern components', () => {
    expect(new Set(WORDS.map(w => w.id)).size).toBe(WORDS.length);
    for (const w of WORDS) { expect(w.source).toBe(`https://www.zdic.net/hans/${w.glyph}`); expect(w.word).toContain(w.glyph); expect(w.pinyin).not.toBe(''); }
    expect(WORDS.filter(w => w.components.length).map(w => w.glyph)).toEqual(['明', '林']);
    expect(WORDS.find(w => w.glyph === '林')!.components.map(c => [c.glyph, c.slot, c.role])).toEqual([['木', 'left', '部件'], ['木', 'right', '部件']]);
    ROOMS.forEach(r => {
      expect(validState(r, r.initial)).toBe(true);
      r.sentences.forEach(sentence => expect(sentence.targets.length).toBeGreaterThan(0));
      r.tiles.forEach((tile, pos) => { if (tile === 'wind' || tile === 'door') expect(r.sentences.filter(s => s.targets.includes(pos))).toHaveLength(1); });
    });
  });
  it.each(ROOMS)('$id is solved through actual legal transitions with conserved material, stable occupancy and exact undo', room => {
    const solution = solve(room, room.initial); expect(solution.status).toBe('solved');
    let j = newJourney(ROOMS.indexOf(room), ROOMS.indexOf(room));
    for (const a of solution.actions) {
      const before = clone(j), run = perform(j, a); expect(run.result.ok).toBe(true);
      expect(validState(room, run.journey.state)).toBe(true);
      expect(undo(run.journey).state).toEqual(before.state); j = run.journey;
    }
    expect(j.state.won).toBe(true); expect(undo(j).state.won).toBe(false);
    expect(restart(j).state).toEqual(room.initial);
    if (j.room < 4) expect(nextRoom(j).room).toBe(j.room + 1);
  });
  it.each([{ r: 0, type: 'take' }, { r: 1, type: 'put' }, { r: 2, type: 'split' }, { r: 3, type: 'combine' }, { r: 3, type: 'split' }])('exhausts $r with $type removed, ruling out a core-mechanism bypass', ({ r, type }) => {
    expect(solve(ROOMS[r], ROOMS[r].initial, { allow: (_, a) => a.type !== type }).status).toBe('unsolvable');
  });
  it('allows genuinely different final strategies: negate wind, or bridge the bypass and recover wood', () => {
    const r = ROOMS[4], slot = r.sentences[1].cells[1];
    const normal = solve(r, r.initial), alternate = solve(r, r.initial, { allow: (s, a) => !(a.type === 'put' && a.target === slot && carried(s)?.kind === '不') });
    expect(normal.status).toBe('solved'); expect(alternate.status).toBe('solved');
    const replay = (actions: Action[]) => actions.reduce((s, a) => act(r, s, a).state, r.initial);
    expect(effect(r, replay(normal.actions), r.sentences[1].targets[0])).toBe(false);
    expect(effect(r, replay(alternate.actions), r.sentences[1].targets[0])).toBe(true);
  });
  it('rejects boundary, remote interaction, unknown input and duplicate confirmation without consuming history', () => {
    const j = newJourney();
    for (const input of [null, {}, { type: 'teleport', target: 40 }, { type: 'move', direction: 'diagonal' }, { type: 'move', direction: 'up' }, { type: 'take', target: 10 }, { type: 'put', target: -1 }]) expect(perform(j, input).journey).toBe(j);
    const near = perform(j, { type: 'move', direction: 'right' }).journey;
    const taken = perform(near, { type: 'take', target: 10 }).journey;
    expect(carried(taken.state)?.kind).toBe('木'); expect(perform(taken, { type: 'take', target: 10 }).journey).toBe(taken);
  });
  it('split previews reject walls, the player and occupied output atomically; pickup order cannot change 林', () => {
    const r = ROOMS[2], s = { ...clone(r.initial), player: 9 };
    expect(act(r, s, { type: 'split', target: 10, side: 'left' }).ok).toBe(false);
    const split = act(r, s, { type: 'split', target: 10, side: 'right' }); expect(split.ok).toBe(true);
    expect(act(r, split.state, { type: 'split', target: 10, side: 'right' }).state).toBe(split.state);
    const narrow = clone(r.initial); narrow.player = 17; narrow.entities[0].pos = 24;
    expect(act(r, narrow, { type: 'split', target: 24, side: 'right' }).state).toBe(narrow);
    const fromLeft = act(r, split.state, { type: 'take', target: 10 }).state;
    const combinedLeft = act(r, { ...fromLeft, player: 10 }, { type: 'combine', target: 11 });
    const fromRight = act(r, { ...split.state, player: 12 }, { type: 'take', target: 11 }).state;
    const combinedRight = act(r, { ...fromRight, player: 11 }, { type: 'combine', target: 10 });
    expect(carried(combinedLeft.state)).toEqual(carried(combinedRight.state));
    expect(carried(combinedLeft.state)).toEqual({ kind: '林', atoms: 3, pos: null });
  });
  it('water remains under bridges and nobody can take the support beneath themselves', () => {
    const r = ROOMS[0], bridge = 33, s = clone(r.initial); s.player = 26; s.entities[0].pos = bridge;
    expect(passable(r, s, bridge)).toBe(true);
    const removed = act(r, s, { type: 'take', target: bridge }); expect(removed.ok).toBe(true);
    expect(r.tiles[bridge]).toBe('water'); expect(passable(r, removed.state, bridge)).toBe(false);
    expect(act(r, { ...s, player: bridge }, { type: 'take', target: bridge }).ok).toBe(false);
  });
  it('occupied split outputs and closing a door under the player reject the entire transformation', () => {
    const r = ROOMS[4], s = clone(r.initial); s.player = 9; s.entities.find(e => e.kind === '不')!.pos = 11;
    const rejected = act(r, s, { type: 'split', target: 10, side: 'right' }); expect(rejected.ok).toBe(false); expect(rejected.state).toBe(s); expect(validState(r, s)).toBe(true);
    // Small adjacency fixture exercises an otherwise unreachable safety case, not a shipped map edit.
    const fixture = clone(ROOMS[1]); fixture.sentences[0].cells = [11, 12, 13]; fixture.tiles[11] = 'rule'; fixture.tiles[12] = 'socket'; fixture.tiles[13] = 'rule';
    const underDoor = clone(fixture.initial); underDoor.player = 19; underDoor.entities[0].pos = null;
    expect(validState(fixture, underDoor)).toBe(true);
    expect(act(fixture, underDoor, { type: 'put', target: 12 }).state).toBe(underDoor);
  });
  it('negation is conserved when held, dropped, inserted and retrieved; collision follows the displayed sentence immediately', () => {
    const r = ROOMS[1], s = { ...clone(r.initial), player: 9 }, door = r.sentences[0], wind = r.sentences[1];
    expect(passable(r, s, door.targets[0])).toBe(false);
    const take = act(r, s, { type: 'take', target: door.cells[1] }); expect(take.ok).toBe(true);
    expect(effect(r, take.state, door.targets[0])).toBe(true); expect(passable(r, take.state, door.targets[0])).toBe(true);
    const put = act(r, take.state, { type: 'put', target: wind.cells[1] }); expect(put.ok).toBe(true);
    expect(effect(r, put.state, wind.targets[0])).toBe(false); expect(validState(r, put.state)).toBe(true);
    expect(act(r, put.state, { type: 'put', target: wind.cells[1] }).ok).toBe(false);
    const again = act(r, put.state, { type: 'take', target: wind.cells[1] }); expect(effect(r, again.state, wind.targets[0])).toBe(true);
    const drop = act(r, again.state, { type: 'put', target: 10 }); expect(drop.ok).toBe(true); expect(validState(r, drop.state)).toBe(true);
    expect(drop.state.entities.filter(e => e.kind === '不')).toHaveLength(1);
  });
  it('wind is action based, directed and atomic; a wind crossing without both woods is honestly unsolvable', () => {
    const r = ROOMS[3], s = { ...clone(r.initial), player: 23 };
    const step = act(r, s, { type: 'move', direction: 'right' }); expect(step.ok).toBe(true); expect(step.state.player).toBe(25);
    expect(act(r, step.state, { type: 'move', direction: 'left' }).ok).toBe(false);
    expect(solve(r, step.state).status).toBe('unsolvable');
    const blocked = clone(s); blocked.entities[0].pos = 25;
    expect(act(r, blocked, { type: 'move', direction: 'right' }).state).toBe(blocked);
  });
  it('current-state hints handle deviations and report an explicit search limit instead of a false deadlock', () => {
    const r = ROOMS[2], altered = clone(r.initial); altered.entities[0].pos = 17;
    const found = solve(r, altered); expect(found.status).toBe('solved');
    expect(act(r, altered, found.actions[0]).ok).toBe(true);
    expect(solve(r, r.initial, { limit: 1 }).status).toBe('limit');
  });
  it('denies duplicate or missing atoms, impossible positions, unsupported water entities and dishonest wins', () => {
    const r = ROOMS[2];
    const bad = [ { ...clone(r.initial), won: true }, { ...clone(r.initial), entities: [] }, { ...clone(r.initial), player: 0 } ];
    const duplicate = clone(r.initial); duplicate.entities.push({ ...duplicate.entities[0] }); bad.push(duplicate);
    const wet = clone(r.initial); wet.entities[0].pos = 31; bad.push(wet);
    bad.forEach(s => expect(validState(r, s)).toBe(false));
  });
});

describe('isolated versioned adventure saves', () => {
  const storage = () => { const values = new Map<string, string>(); return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; };
  it('restores complete stable state and undo across refresh without reading another game', () => {
    const store = storage(); store.setItem('family-games/hanzi-tower-defense/v1', 'protected');
    const save = openSave(store, { reducedMotion: true });
    const j = perform(save.journey, { type: 'move', direction: 'right' }).journey;
    expect(save.write(j, { reducedMotion: false })).toBe(true);
    const resumed = openSave(store, { reducedMotion: true }); expect(resumed.journey).toEqual(j); expect(undo(resumed.journey).state).toEqual(ROOMS[0].initial);
    expect(resumed.settings.reducedMotion).toBe(false); expect(store.getItem('family-games/hanzi-tower-defense/v1')).toBe('protected');
  });
  it.each(['{broken', '{"version":2}', '{"version":1,"journey":{}}'])('preserves an unrecognized save byte-for-byte: %s', raw => {
    const store = storage(); store.setItem(SAVE_KEY, raw); const save = openSave(store, { reducedMotion: false });
    expect(save.writable).toBe(false); expect(save.write(newJourney(), save.settings)).toBe(false); expect(store.getItem(SAVE_KEY)).toBe(raw);
  });
  it('preserves unknown envelope fields and never overwrites a competing tab or Vault restore', () => {
    const store = storage(); store.setItem(SAVE_KEY, JSON.stringify({ version: 2, activeChapterId: 'homeward', chapters: { homeward: newJourney() }, futureOptional: 'keep', settings: { reducedMotion: false, extra: 17 } }));
    const save = openSave(store, { reducedMotion: true }); expect(save.write(newJourney(), save.settings)).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_KEY)!).futureOptional).toBe('keep'); expect(JSON.parse(store.getItem(SAVE_KEY)!).settings.extra).toBe(17);
    store.setItem(SAVE_KEY, 'other tab'); expect(save.write(newJourney(), save.settings)).toBe(false); expect(store.getItem(SAVE_KEY)).toBe('other tab');
  });
  it('continues in memory when browser storage throws', () => {
    const save = openSave({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, { reducedMotion: true });
    expect(save.journey.room).toBe(0); expect(save.writable).toBe(false);
  });
});


describe('light, chapter continuity and v2 migration', () => {
  const storage = () => { const values = new Map<string,string>(); return { values, getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>{values.set(k,v);} }; };
  it('keeps five original IDs and fifteen stable chapter-bound room IDs without a final-room constant', () => {
    expect(ROOMS).toHaveLength(15); expect(ROOMS.slice(0,5).map(r=>r.id)).toEqual(['r1','r2','r3','r4','r5']);
    for (const chapter of CHAPTERS) { const rooms = ROOMS.filter(r=>r.chapterId === chapter.id); expect(rooms).toHaveLength(5); const last = newJourney(ROOMS.indexOf(rooms[4])); last.state = solve(rooms[4],last.state).actions.reduce((state,a)=>act(rooms[4],state,a).state,last.state); expect(nextRoom(last)).toBe(last); }
  });
  it('only 明 emits light; light has exact bounded distances and cannot pass walls or a closed door', () => {
    const r = ROOMS[5]; expect(illumination(r,r.initial).size).toBe(0);
    let s = act(r,r.initial,{type:'take',target:9}).state; s = act(r,s,{type:'move',direction:'right'}).state;
    s = act(r,s,{type:'combine',target:10}).state; expect(carried(s)?.kind).toBe('明');
    const lit = illumination(r,s); expect(lit.get(s.player)).toBe(0); expect(Math.max(...lit.values())).toBeLessThanOrEqual(3); expect(lit.has(0)).toBe(false);
    const door = ROOMS[11], before = illumination(door,door.initial); expect(before.has(24)).toBe(false);
    const opened = clone(door.initial); opened.entities.find(e=>e.kind==='不')!.pos=null; expect(illumination(door,opened).has(24)).toBe(true);
  });
  it('modern 明 reconstruction is ordered and conserves the distinct 日/月 atoms regardless of pickup order', () => {
    const r = ROOMS[5], first = clone(r.initial), sun = first.entities.find(e=>e.kind==='日')!, moon = first.entities.find(e=>e.kind==='月')!;
    expect(combineKind(sun,moon)).toBe('明'); expect(combineKind(moon,sun)).toBe('明');
    first.player=9; sun.pos=null; const joined=act(r,first,{type:'combine',target:10}); expect(joined.ok).toBe(true);
    const ground=act(r,joined.state,{type:'put',target:10}); expect(ground.ok).toBe(true);
    const right=act(r,ground.state,{type:'split',target:10,side:'right'}); expect(right.ok).toBe(true);
    expect(right.state.entities.find(e=>e.kind==='日')).toMatchObject({pos:10,atoms:r.sunAtoms}); expect(right.state.entities.find(e=>e.kind==='月')).toMatchObject({pos:11,atoms:r.moonAtoms});
    const other = {...ground.state, player:11};
    const left = act(r,other,{type:'split',target:10,side:'left'}); expect(left.ok).toBe(true); expect(left.state.entities.find(e=>e.kind==='日')?.pos).toBe(9); expect(left.state.entities.find(e=>e.kind==='月')?.pos).toBe(10);
  });
  it('darkness invalidating the player refuses the whole split; invisible pieces cannot be taken', () => {
    const r=clone(ROOMS[5]); r.tiles[17]='shadow'; r.tiles[10]='floor'; r.tiles[11]='floor';
    const s={player:17,won:false,entities:[{kind:'明' as const,atoms:r.sunAtoms|r.moonAtoms,pos:10}]};
    expect(validState(r,s)).toBe(true); const split=act(r,s,{type:'split',target:10,side:'right'}); expect(split.ok).toBe(false); expect(split.state).toBe(s); expect(split.message).toContain('失去落脚处');
    const dark=clone(r.initial); dark.player=10; dark.entities[0].pos=17; expect(visible(r,dark,17)).toBe(false); expect(act(r,dark,{type:'take',target:17}).state).toBe(dark);
  });
  it.each([12,14])('new room %i has a second strategy that leaves wind active, replayed without authored sequence locks', index => {
    const r=ROOMS[index], slot=r.sentences.find(s=>s.subject==='风')!.cells[1];
    const alternate=solve(r,r.initial,{allow:(s,a)=>!(a.type==='put'&&a.target===slot&&carried(s)?.kind==='不')}); expect(alternate.status).toBe('solved');
    let state=clone(r.initial); for(const a of alternate.actions) {const next=act(r,state,a); expect(next.ok).toBe(true); expect(validState(r,next.state)).toBe(true);state=next.state;} expect(state.won).toBe(true); expect(effect(r,state,r.sentences.find(s=>s.subject==='风')!.targets[0])).toBe(true);
  });
  it('copies a valid v1 only into an absent v2, with exact old bytes and usable undo', () => {
    const store=storage(), moved=perform(newJourney(),{type:'move',direction:'right'}).journey;
    const {chapterId,roomId,...legacyJourney}=moved; const old=JSON.stringify({version:1,journey:legacyJourney,settings:{reducedMotion:true}});store.setItem(LEGACY_SAVE_KEY,old);
    const save=openSave(store,{reducedMotion:false});expect(save.restored).toBe(true);expect(save.journey).toEqual(moved);expect(undo(save.journey).state).toEqual(ROOMS[0].initial);expect(store.getItem(LEGACY_SAVE_KEY)).toBe(old);expect(validSaveV2(JSON.parse(store.getItem(SAVE_KEY)!))).toBe(true);
    for(const raw of ['{broken','{"version":99}']) {store.setItem(SAVE_KEY,raw);const blocked=openSave(store,{reducedMotion:false});expect(blocked.writable).toBe(false);expect(blocked.write(newJourney(),blocked.settings)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);expect(store.getItem(LEGACY_SAVE_KEY)).toBe(old);}
  });
  it('chapter switching preserves all current states and reset affects only the explicitly named chapter', () => {
    const store=storage();store.setItem(LEGACY_SAVE_KEY,'{untouched old bytes');const save=openSave(store,{reducedMotion:true});
    const first=perform(newJourney(),{type:'move',direction:'right'}).journey;save.write(first,save.settings);
    const second=newJourney(5);save.write(second,save.settings);expect(save.select('homeward')).toEqual(first);expect(save.select('lamplight')).toEqual(second);
    save.reset('homeward',save.settings);const refreshed=openSave(store,save.settings);expect(refreshed.chapters.homeward?.state).toEqual(ROOMS[0].initial);expect(refreshed.chapters.lamplight).toEqual(second);expect(store.getItem(LEGACY_SAVE_KEY)).toBe('{untouched old bytes');
    store.setItem(SAVE_KEY,'another tab');save.reset('lamplight',save.settings);expect(store.getItem(SAVE_KEY)).toBe('another tab');
  });
});


describe('v1 migration write failures', () => {
  const moved=perform(newJourney(),{type:'move',direction:'right'}).journey;
  const old=JSON.stringify({version:1,journey:moved,settings:{reducedMotion:true}});
  it('resumes the validated old checkpoint and undo in memory when migration storage is full', () => {
    const save=openSave({getItem:k=>k===LEGACY_SAVE_KEY?old:null,setItem:()=>{throw Error('quota');}},{reducedMotion:false});
    expect(save.writable).toBe(false);expect(save.restored).toBe(true);expect(save.journey).toEqual(moved);expect(undo(save.journey).state).toEqual(ROOMS[0].initial);
  });
  it('does not migrate a stale v1 read after another page changes the old source', () => {
    let reads=0,writes=0;const save=openSave({getItem:k=>k===SAVE_KEY?null:++reads===1?old:'changed old source',setItem:()=>{writes++;}},{reducedMotion:false});
    expect(writes).toBe(0);expect(save.writable).toBe(false);expect(save.journey).toEqual(moved);
  });
});


it('woven-1 lamp relocation is necessary, with more than one legal lamp placement strategy', () => {
  const r=ROOMS.find(r=>r.id==='woven-1')!;
  const noLamp=solve(r,r.initial,{allow:(s,a)=>!((a.type==='take'||a.type==='split')&&s.entities.find(e=>e.pos===a.target)?.kind==='明')});expect(noLamp.status).toBe('unsolvable');
  const normal=solve(r,r.initial);expect(normal.status).toBe('solved');let state=clone(r.initial),firstDrop=-1;
  for(const a of normal.actions) {if(a.type==='put'&&carried(state)?.kind==='明'&&firstDrop<0)firstDrop=a.target;state=act(r,state,a).state;}expect(firstDrop).toBeGreaterThanOrEqual(0);expect(state.won).toBe(true);
  const other=solve(r,r.initial,{allow:(s,a)=>!(a.type==='put'&&carried(s)?.kind==='明'&&a.target===firstDrop)});expect(other.status).toBe('solved');
  state=clone(r.initial);for(const a of other.actions){const step=act(r,state,a);expect(step.ok).toBe(true);expect(validState(r,step.state)).toBe(true);state=step.state;}expect(state.won).toBe(true);
});
