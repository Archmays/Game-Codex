import {describe,it,expect} from 'vitest';
import {CORES,RECIPES,ORIGINAL_CORE_ORDER,ORIGINAL_RECIPES} from '../games/hanzi-tower-defense/content';
import {DEFENSE_MAPS,MAP_IDS,mapFor,pathLength,type MapId} from '../games/hanzi-tower-defense/maps';
import {checkpointOf,newBattle,startWave,updateBattle,fuse,plannedDrops,remainingDistance,pointOnPath,deploy,stow,previewEquipment,equipEnglish,type Enemy} from '../games/hanzi-tower-defense/model';
import {LEGACY_SAVE_KEY,V2_SAVE_KEY,SAVE_KEY,openSave,validCheckpoint} from '../games/hanzi-tower-defense/save';
import {RESONANCES} from '../games/hanzi-tower-defense/resonance';
import {runStep4,step4Evidence} from '../tools/hanzi-tower-defense/step4-balance';
const prefs={muted:true,reducedMotion:true};
function storage(initial:Record<string,string>={}){const data=new Map(Object.entries(initial));return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};}
const foe=(id:number,lane:number,distance:number,hp=10000):Enemy=>({id,kind:'swarm',lane,distance,hp,maxHp:hp,slow:0,slowUntil:0});
describe('STEP4 independent maps, correct content and transactions',()=>{
 it('keeps 3 maps / 22 waves, original nine cores / five recipes, fixed legal starts and two explicit lanes',()=>{
  expect(MAP_IDS).toHaveLength(3);expect(MAP_IDS.map(id=>mapFor(id).waves.length)).toEqual([6,8,8]);expect(ORIGINAL_CORE_ORDER).toHaveLength(9);expect(ORIGINAL_RECIPES).toHaveLength(5);
  for(const id of MAP_IDS){const s=newBattle(undefined,[],id);expect(validCheckpoint(s.checkpoint)).toBe(true);expect(s.cores).toEqual(newBattle(undefined,[],id).cores);expect(new Set(s.cores.map(c=>c.id)).size).toBe(s.cores.length);}
  const m=DEFENSE_MAPS['twin-bends'];expect(m.paths).toHaveLength(2);expect(pathLength(m.paths[0])).not.toBe(pathLength(m.paths[1]));expect(m.waves.every(w=>new Set(w.lanes).size===2)).toBe(true);
 });
 it('map-owned Chinese and English drop schedules preserve the old values and explicitly bound new grants',()=>{
  for(const id of MAP_IDS){const drops=mapFor(id).drops;expect(drops.baseKinds).toEqual(['fire','wood','water','mountain']);expect(drops.milestones).toEqual([1,3,5,8,11]);expect(drops.english).toHaveLength(id==='qinglan-pass'?2:3);expect(new Set(drops.english.map(d=>d.grantId)).size).toBe(drops.english.length);expect(drops.english.every(d=>d.wave<mapFor(id).waves.length&&d.kill===3)).toBe(true);expect(drops.english.filter(d=>d.grantId!=='wave-3-forest')).toEqual([{grantId:'wave-2-volcano',wave:1,kill:3},{grantId:'wave-4-mountain-forest',wave:3,kill:3}]);for(let wave=0;wave<6;wave++)expect(plannedDrops(20260907,wave,id)).toEqual(plannedDrops(20260907,wave));}
 });
 it('binds 森 to upper 木 / lower 林 and 森林 to whole ordered word with the forest area sense',()=>{
  expect(CORES.canopy.glyph).toBe('森');expect(CORES.canopy.structure).toBe('pyramid');expect(CORES.canopy.components).toEqual(['木','林']);expect(CORES.canopy.slots).toEqual(['上部木','下部林（左木、右木）']);
  expect(CORES.forest.components).toEqual(['森','林']);expect(CORES.forest.glyph).toBe('森林');expect(RESONANCES[2]).toMatchObject({coreId:'forest',text:'forest',senseId:'zh-forest-large-wooded-area',form:'word'});
 });
 it('old map rejects expanded fusion without consuming inputs; new map consumes exactly the two IDs',()=>{
  for(const id of MAP_IDS){const s=newBattle(undefined,[],id);s.cores=[{id:1,kind:'wood',slot:0,cooldown:.4},{id:2,kind:'grove',slot:1,cooldown:.9},{id:3,kind:'mountain',slot:2,cooldown:0}];s.nextCoreId=4;const raw=JSON.stringify(s);const output=fuse(s,2,1,1,'wood-grove');if(id==='qinglan-pass'){expect(output).toBeNull();expect(JSON.stringify(s)).toBe(raw);}else{expect(output).toMatchObject({id:4,kind:'canopy',slot:1,cooldown:.9});expect(s.cores.map(c=>c.id)).toEqual([3,4]);expect(fuse(s,2,1,1,'wood-grove')).toBeNull();}}
 });
 it('selects the smallest remaining route distance, not largest raw distance across lanes',()=>{
  const s=newBattle(undefined,[],'twin-bends');startWave(s);s.spawned=mapFor(s.mapId).waves[0].foes.length;s.waveTime=1;s.cores=[{id:1,kind:'forest',slot:4,cooldown:0}];
  // Both points are in the central tower circle. Lane 0 has a larger raw distance but a longer remaining journey.
  const lengths=mapFor(s.mapId).paths.map(pathLength);s.enemies=[foe(10,0,760),foe(20,1,625)];
  expect(s.enemies[0].distance).toBeGreaterThan(s.enemies[1].distance);expect(remainingDistance(s,s.enemies[0])).toBeGreaterThan(remainingDistance(s,s.enemies[1]));
  const events=updateBattle(s,.001).filter(e=>e.type==='shot');expect(events[0]).toMatchObject({enemyId:20});expect(lengths[0]).toBeGreaterThan(lengths[1]);
 });
 it('forest fires once per distinct target with fixed main/secondary damage and a strict 3/4 cap',()=>{
  for(const english of [false,true]){const s=newBattle(undefined,[],'twin-bends');startWave(s);s.waveTime=1;s.spawned=mapFor(s.mapId).waves[0].foes.length;s.cores=[{id:1,kind:'forest',slot:4,cooldown:0}];s.enemies=Array.from({length:7},(_,i)=>foe(i+1,i%2,i%2?640+i:710+i));
   if(english){const r=RESONANCES[2];s.englishCores=[{id:1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:1}];s.englishClaims=[r.grantId];s.nextEnglishId=2;}
   const events=updateBattle(s,.001).filter(e=>e.type==='shot');expect(events).toHaveLength(english?4:3);expect(new Set(events.map(e=>e.type==='shot'&&e.enemyId)).size).toBe(events.length);expect(s.enemies.filter(e=>e.hp<10000)).toHaveLength(events.length);expect(s.enemies.reduce((a,e)=>a+10000-e.hp,0)).toBeCloseTo(42+(events.length-1)*27.3);expect(s.rootZones).toEqual([]);expect(s.enemies.every(e=>e.slow===0)).toBe(true);
   expect(updateBattle(s,.05).filter(e=>e.type==='shot')).toHaveLength(0);
  }
 });
 it('forest grant belongs only to new maps and kill/fallback cannot duplicate it',()=>{
  for(const mapId of MAP_IDS){const s=newBattle(undefined,[],mapId);s.wave=2;startWave(s);s.spawned=mapFor(mapId).waves[2].foes.length;s.waveKills=3;updateBattle(s,.05);expect(s.englishCores.some(e=>e.lexemeId==='en-forest')).toBe(mapId!=='qinglan-pass');const raw=JSON.stringify(s.englishCores);updateBattle(s,.05);expect(JSON.stringify(s.englishCores)).toBe(raw);}
 });
 it('boss announces two limited summons, survives pause without advancing a countdown, and never adds an immunity',()=>{
  const s=newBattle(undefined,[],'beacon-keep');s.wave=7;startWave(s);s.spawned=mapFor(s.mapId).waves[7].foes.length;s.cores=[];const boss:Enemy={...foe(1,0,200,600),kind:'captain',maxHp:1000,summons:0};s.enemies=[boss];updateBattle(s,.05);expect(boss.summonAt).toBeCloseTo(2.05);expect(s.enemies).toHaveLength(1);s.paused=true;const paused=JSON.stringify(s);for(let n=0;n<80;n++)updateBattle(s,.05);expect(JSON.stringify(s)).toBe(paused);s.paused=false;for(let n=0;n<41;n++)updateBattle(s,.05);expect(boss.summons).toBe(1);expect(s.enemies).toHaveLength(3);boss.hp=300;for(let n=0;n<43;n++)updateBattle(s,.05);expect(boss.summons).toBe(2);expect(s.enemies).toHaveLength(5);for(let n=0;n<50;n++)updateBattle(s,.05);expect(boss.summons).toBe(2);
 });
 for(const mapId of ['twin-bends','beacon-keep'] as const)for(const route of ['forest-volcano','flame-wildwood'] as const)it(`${mapId} ${route} passes all 8 waves with legal actions and no English`,()=>{const run=runStep4(mapId,route);expect(run.result).toBe('won');expect(run.waves).toHaveLength(8);expect(run.seconds).toBeGreaterThan(200);expect(run.health).toBeGreaterThan(0);});
 it('English has an observed benefit and placement changes natural completion time',()=>{const e=step4Evidence();for(const boosted of e.english){const base=e.builds.find(b=>b.mapId===boosted.mapId&&b.route===boosted.route&&!b.reverse)!;expect(boosted.result).toBe('won');expect(boosted.forestResonanceShots).toBeGreaterThan(0);expect(boosted.seconds).toBeLessThan(base.seconds);}expect(e.builds.filter(b=>b.reverse).every(reverse=>reverse.seconds!==e.builds.find(b=>b.mapId===reverse.mapId&&b.route===reverse.route&&!b.reverse)!.seconds)).toBe(true);expect(e.single[1].after.damage).toBeLessThan(e.single[1].before.damage);});
 it('forest alone adds a fourth real target in natural new-map battles without another English effect',()=>{
  const runs=(['twin-bends','beacon-keep'] as const).map(id=>runStep4(id,'forest-volcano',false,'forest-only'));
  for(const run of runs){expect(run.result).toBe('won');expect(run.waves).toHaveLength(8);expect(run.equippedEnglish).toEqual(['en-forest']);expect(run.forestResonanceShots).toBeGreaterThan(0);}
  expect(runs.reduce((sum,run)=>sum+run.fourthTargetHits,0)).toBeGreaterThan(0);
 });
 it('new recipes compare equal precursor value on real first waves and legal alternative tower positions',()=>{
  for(const pair of step4Evidence().naturalRecipes){
   expect(pair.before.deployment).toHaveLength(2);expect(new Set(pair.before.deployment.map(c=>c.slot)).size).toBe(2);
   for(const after of pair.after){expect(after.deployment).toHaveLength(1);expect(after.unusedStart).toEqual(pair.before.unusedStart);expect(after.materialUnits).toBe(pair.before.materialUnits);}
   for(const run of [pair.before,...pair.after]){expect(run.materialUnits).toBe(pair.recipeId==='wood-grove'?3:5);expect(run.wave).toBe(1);expect(run.result).toBe('ready');expect(run.kills+run.leaks).toBe(14);expect(run.health).toBe(16-run.leaks);expect(run.seconds).toBeGreaterThan(20);}
  }
 });
});
describe('STEP4 v3 per-map save and non-destructive copy migration',()=>{
 it('copies v2 checkpoint and complete English ownership without modifying either legacy raw string',()=>{const s=newBattle();s.wave=4;const r=RESONANCES[0];s.cores=[{id:1,kind:'volcano',slot:3,cooldown:.9}];s.englishCores=[{id:1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:1}];s.englishClaims=[r.grantId];s.nextEnglishId=2;const old=JSON.stringify({version:2,checkpoint:checkpointOf(s),unlocked:['fire-mountain'],preferences:prefs}),store=storage({[V2_SAVE_KEY]:old,[LEGACY_SAVE_KEY]:'original legacy raw'});const session=openSave(store,prefs);expect(session.migrated).toBe(true);expect(session.state.wave).toBe(4);expect(session.state.cores).toEqual(s.cores);expect(session.state.englishCores).toEqual(s.englishCores);expect(store.getItem(V2_SAVE_KEY)).toBe(old);expect(store.getItem(LEGACY_SAVE_KEY)).toBe('original legacy raw');expect(session.list()).toEqual([{mapId:'qinglan-pass',wave:4,won:false}]);});
 it.each(['{broken','{"version":99}','{"version":3,"maps":{}}'])('never replaces bad/future v3 with a valid old key: %s',raw=>{const old=JSON.stringify({version:2,checkpoint:newBattle().checkpoint,unlocked:[],preferences:prefs}),store=storage({[V2_SAVE_KEY]:old,[SAVE_KEY]:raw}),session=openSave(store,prefs);expect(session.writable).toBe(false);expect(session.write(newBattle(undefined,[],'twin-bends'),prefs)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);expect(store.getItem(V2_SAVE_KEY)).toBe(old);});
 it('keeps each map economy, claims and discoveries independent across switching and selected-map reset',()=>{const store=storage(),session=openSave(store,prefs),a=newBattle(undefined,[],'twin-bends'),b=newBattle(undefined,[],'beacon-keep');a.wave=3;a.unlocked=['wood-grove'];a.cores[0].cooldown=.8;session.write(a,prefs);b.wave=5;session.write(b,prefs);expect(session.load('twin-bends')?.wave).toBe(3);expect(session.load('twin-bends')?.cores[0].cooldown).toBe(.8);session.write(newBattle(undefined,[],'beacon-keep'),prefs);expect(session.load('beacon-keep')?.wave).toBe(0);expect(session.load('twin-bends')?.wave).toBe(3);expect(session.load('twin-bends')?.unlocked).toEqual(['wood-grove']);});
 it('switch/write unfinished wave rolls back all resource mutations and cross-tab recovery locks the stale writer',()=>{const store=storage(),session=openSave(store,prefs),s=newBattle(undefined,[],'twin-bends');session.write(s,prefs);startWave(s);fuse(s,1,2,0);session.write(s,prefs);expect(session.load('twin-bends')?.cores).toEqual(s.checkpoint.cores);const other=openSave(store,prefs);other.write(newBattle(undefined,[],'beacon-keep'),prefs);const raw=store.getItem(SAVE_KEY);expect(session.write(s,prefs)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);});
 it('rejects cross-map mismatch, new characters in the old map, invalid lanes/schema and unknown map IDs',()=>{const cp=newBattle(undefined,[],'twin-bends').checkpoint;expect(validCheckpoint({...cp,mapId:'unknown'})).toBe(false);expect(validCheckpoint({...cp,mapId:'qinglan-pass',cores:[{id:1,kind:'forest',slot:null,cooldown:0}]})).toBe(false);const raw=JSON.stringify({version:3,activeMapId:'beacon-keep',maps:{'beacon-keep':{checkpoint:cp,unlocked:[]}},preferences:prefs});const store=storage({[SAVE_KEY]:raw});expect(openSave(store,prefs).writable).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);});
});
