import {describe,it,expect} from 'vitest';
import {SCENARIOS,SCENARIO_IDS,rulesFor} from '../games/hanzi-tower-defense/tactics';
import {MAP_IDS,mapFor} from '../games/hanzi-tower-defense/maps';
import {newBattle,newTactics,startWave,updateBattle,deploy,stow,fuse,retryWave,checkpointOf,equipEnglish,previewEquipment,type BattleState} from '../games/hanzi-tower-defense/model';
import {openTacticsSave,TACTICS_SAVE_KEY,SAVE_KEY,V2_SAVE_KEY,validTacticsPayload,validTacticsCheckpoint,validCheckpoint} from '../games/hanzi-tower-defense/save';
import {arrangeTactics,tacticsEvidence} from '../tools/hanzi-tower-defense/step5-balance';
const prefs={muted:true,reducedMotion:true};
const storage=(initial:Record<string,string>={})=>{const data=new Map(Object.entries(initial)),reads:string[]=[];return {data,reads,getItem:(key:string)=>{reads.push(key);return data.get(key)??null;},setItem:(k:string,v:string)=>{data.set(k,v);}};};
function finishWave(s:BattleState){let steps=0;while(s.phase==='battle'&&steps++<5000)updateBattle(s,.05);expect(s.phase).not.toBe('battle');}
describe('STEP5 six independent tactical scenarios',()=>{
 it('retains three campaign maps and 22 waves; six short runs inherit only their map content pool',()=>{
  expect(MAP_IDS.map(id=>mapFor(id).waves.length)).toEqual([6,8,8]);expect(SCENARIO_IDS).toHaveLength(6);
  for(const id of SCENARIO_IDS){const s=newTactics(id);expect(rulesFor(s).waves).toHaveLength(3);expect(validTacticsCheckpoint(checkpointOf(s))).toBe(true);expect(validCheckpoint(checkpointOf(s))).toBe(false);expect(rulesFor(s).expanded).toBe(s.mapId!=='qinglan-pass');expect(s.cores).toEqual(newTactics(id).cores);expect(SCENARIOS[id].rewards.every(r=>r.length===2)).toBe(true);expect(rulesFor(s).drops.english).toHaveLength(s.mapId==='qinglan-pass'?2:3);}
  expect(checkpointOf(newBattle())).not.toHaveProperty('scenarioId');
 });
 it('permits first deployment and synthesis in battle, atomically rejects movement/stow even paused, and leaves campaign behavior alone',()=>{
  const s=newTactics('qinglan-intercept');deploy(s,1,0);startWave(s);
  for(const paused of [false,true]){s.paused=paused;const before=JSON.stringify(s);expect(deploy(s,1,1)).toBe(false);expect(stow(s,1)).toBe(false);expect(JSON.stringify(s)).toBe(before);}
  expect(deploy(s,2,1)).toBe(true);expect(fuse(s,2,3,1,'fire-fire')).not.toBeNull();const before=JSON.stringify(s);expect(fuse(s,1,4,0)).toBeNull();expect(JSON.stringify(s)).toBe(before);
  const old=newBattle();startWave(old);expect(deploy(old,1,1)).toBe(true);expect(stow(old,1)).toBe(true);
 });
 it('restores the exact wave-before economy after loss, pause, completion and repeated retry/refresh',()=>{
  const store=storage(),save=openTacticsSave(store,prefs);let s=newTactics('qinglan-intercept');arrangeTactics(s,'volcano-grove');startWave(s);const before=checkpointOf(s.checkpoint);
  finishWave(s);expect(s.wave).toBe(1);expect(s.englishCores).toHaveLength(1);expect(save.write(s,prefs)).toBe(true);
  s=retryWave(save.load('qinglan-intercept')!)!;expect(s.phase).toBe('ready');expect(checkpointOf(s)).toEqual(before);expect(s.enemies).toEqual([]);expect(s.echoes).toEqual([]);expect(s.rootZones).toEqual([]);expect(s.summaries).toHaveLength(1);
  startWave(s);finishWave(s);expect(s.englishCores).toHaveLength(1);expect(s.summaries).toHaveLength(2);const earned=checkpointOf(s);
  s=retryWave(s)!;startWave(s);finishWave(s);expect(checkpointOf(s)).toEqual(earned);expect(s.summaries).toHaveLength(2);
  startWave(s);s.paused=true;const current=checkpointOf(s.checkpoint);expect(deploy(s,s.cores.find(c=>c.slot===null)!.id,7)).toBe(true);s.echoes.push({id:1,effectId:'echo-eruption',sourceCoreId:1,sourceEnglishId:1,at:{x:0,y:0},due:1,damage:2,radius:3});s.rootZones.push({id:2,effectId:'spreading-roots',sourceCoreId:1,sourceEnglishId:1,at:{x:0,y:0},born:0,expires:2,damage:1,radius:2,slow:.4});
  const restored=retryWave(s)!;expect(checkpointOf(restored)).toEqual(current);expect(restored.echoes).toEqual([]);expect(restored.rootZones).toEqual([]);expect(restored.paused).toBe(false);
  const lost=newTactics('qinglan-intercept');startWave(lost);finishWave(lost);expect(lost.phase).toBe('lost');expect(retryWave(lost)?.health).toBe(16);expect(retryWave(lost)?.cores).toEqual(lost.checkpoint.cores);
 });
 it('allows a natural first English equip but transfer stays blocked during battle and pause',()=>{
  const s=newTactics('qinglan-intercept');arrangeTactics(s,'volcano-grove');startWave(s);finishWave(s);const towers=s.cores.filter(c=>c.kind==='volcano'),e=s.englishCores[0];
  startWave(s);expect(equipEnglish(s,previewEquipment(s,e.id,towers[0].id))).toBe(true);
  for(const paused of [false,true]){s.paused=paused;const before=JSON.stringify(s);expect(equipEnglish(s,previewEquipment(s,e.id,towers[1].id))).toBe(false);expect(JSON.stringify(s)).toBe(before);}
  expect(retryWave(s)?.englishCores[0].attachedTo).toBeNull();
 });
 it('records only two bounded per-wave summaries with exact lane totals',()=>{
  const s=newTactics('twin-lanes');while(s.phase!=='won'){arrangeTactics(s,'volcano-grove');startWave(s);finishWave(s);}
  expect(s.summaries).toHaveLength(2);for(const r of s.summaries){expect(r.lanes).toHaveLength(2);expect(r.lanes.reduce((n,l)=>n+l.kills,0)).toBe(r.kills);expect(r.lanes.reduce((n,l)=>n+l.leaks,0)).toBe(r.leaks);expect(r.coverage.every(n=>n>=0&&n<=100)).toBe(true);}
 });
 it('two no-English builds win every short run and equal-resource poor placement causes observable loss of gate health',()=>{
  const evidence=tacticsEvidence();expect(evidence.builds).toHaveLength(12);for(const r of evidence.builds){expect(r.result).toBe('won');expect(r.waves).toHaveLength(3);expect(r.english).toBe(false);expect(r.health).toBeGreaterThan(0);}
  for(const r of evidence.comparisons){const base=evidence.builds.find(b=>b.scenarioId===r.scenarioId&&b.build===r.build)!;expect(r.leaks).toBeGreaterThan(base.leaks);expect(r.health).toBeLessThan(base.health);expect(r.kills).toBeLessThan(base.kills);}
  for(const r of evidence.forestOnly){expect(r.result).toBe('won');expect(r.fourthTargetHits).toBeGreaterThan(0);expect(r.echoes).toBe(0);expect(r.roots).toBe(0);}
  expect(evidence.resonance.some(r=>r.echoes>0)).toBe(true);expect(evidence.resonance.some(r=>r.roots>0)).toBe(true);
 });
});
describe('STEP5 separate raw-byte guarded slot',()=>{
 it('does not read/migrate/write any campaign key and preserves all scenario slots',()=>{
  const store=storage({[SAVE_KEY]:'campaign raw',[V2_SAVE_KEY]:'v2 raw'}),save=openTacticsSave(store,prefs);expect(store.reads).toEqual([TACTICS_SAVE_KEY]);
  for(const id of SCENARIO_IDS){const s=newTactics(id);deploy(s,1,2);expect(save.write(s,prefs)).toBe(true);}
  expect(save.list()).toHaveLength(6);for(const id of SCENARIO_IDS)expect(save.load(id)?.cores[0].slot).toBe(2);expect(store.data.get(SAVE_KEY)).toBe('campaign raw');expect(store.data.get(V2_SAVE_KEY)).toBe('v2 raw');
 });
 it.each(['{bad','{"version":99}','{"version":1,"scenarios":{}}'])('protects unrecognized raw %s through reset attempts',raw=>{const store=storage({[TACTICS_SAVE_KEY]:raw}),save=openTacticsSave(store,prefs);expect(save.writable).toBe(false);expect(save.write(newTactics('qinglan-intercept'),prefs)).toBe(false);expect(store.getItem(TACTICS_SAVE_KEY)).toBe(raw);});
 it('locks stale cross-page writers and rejects mismatched IDs, future shapes and summary extras',()=>{
  const store=storage(),a=openTacticsSave(store,prefs),b=openTacticsSave(store,prefs);expect(a.write(newTactics('qinglan-intercept'),prefs)).toBe(true);const raw=store.getItem(TACTICS_SAVE_KEY);expect(b.write(newTactics('twin-lanes'),prefs)).toBe(false);expect(store.getItem(TACTICS_SAVE_KEY)).toBe(raw);
  const payload=JSON.parse(raw!);payload.scenarios['qinglan-intercept'].checkpoint.mapId='twin-bends';expect(validTacticsPayload(payload)).toBe(false);
  const s=newTactics('qinglan-intercept');expect(validTacticsCheckpoint({...checkpointOf(s),wave:4})).toBe(false);expect(validTacticsCheckpoint({...checkpointOf(s),scenarioId:'future'})).toBe(false);
 });
});
