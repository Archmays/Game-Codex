import {describe,it,expect} from 'vitest';
import {shortMissionEvidence,assertShortMissionEvidence,SHORT_STRATEGIES,runShortStrategy} from '../tools/hanzi-tower-defense/short-missions-balance';

describe('three short missions: ordinary, reproducible strategy evidence',()=>{
 const evidence=shortMissionEvidence();
 it('wins with eighteen distinct prepared strategies, including pack-specific and mixed compositions, using no English',()=>{
  expect(()=>assertShortMissionEvidence(evidence)).not.toThrow();expect(evidence.strategies).toHaveLength(18);
  for(const r of evidence.strategies){expect(r.end.phase).toBe('won');expect(r.waves).toHaveLength(3);expect(r.wavePreparations.every(w=>w.cores.every(c=>c.kind!=='canopy'&&c.kind!=='forest'))).toBe(true);expect(r.end.english.every(e=>e.attachedTo===null)).toBe(true);}
  for(const packId of ['ember','leaf']){const runs=evidence.strategies.filter(r=>r.scenarioId==='qinglan-elite'&&r.choice?.packId===packId);expect(new Set(runs.map(r=>r.wavePreparations[0].cores.filter(c=>c.slot!==null).map(c=>c.kind).sort().join(','))).size).toBe(5);for(const r of runs)expect(r.wavePreparations.every(w=>w.cores.filter(c=>c.slot!==null).length===3)).toBe(true);}
 });
 it('allows one fused tower with two basic towers or two fused towers with a basic tower at a real health cost',()=>{
  for(const packId of ['ember','leaf'])for(const suffix of ['wildwood-basics','volcano-grove-water']){
   const r=evidence.strategies.find(r=>r.id===`elite-${packId}-${suffix}`)!;expect(r.end.phase).toBe('won');expect(r.end.health).toBe(13);expect(r.end.kills).toBe(59);expect(r.end.leaks).toBe(1);
   expect(r.wavePreparations[0].cores.filter(c=>c.slot!==null&&['fire','wood','water','mountain'].includes(c.kind))).toHaveLength(suffix==='wildwood-basics'?2:1);
  }
 });
 it('makes fusion and repair affect actual battle outcomes, while unchanged repair remains survivable',()=>{
  for(const r of evidence.comparisons.filter(r=>r.scenarioId==='qinglan-elite')){expect(r.end.phase).toBe('lost');expect(r.end.health).toBe(0);}
  for(const variant of [0,1]){
   const unchanged=evidence.comparisons.find(r=>r.id===`repair-${variant}-unchanged`)!,move=evidence.strategies.find(r=>r.id===`repair-${variant}-move-original`)!,change=evidence.strategies.find(r=>r.id===`repair-${variant}-change-composition`)!;
   expect(unchanged.end.phase).toBe('won');expect([unchanged.end.health,move.end.health,change.end.health]).toEqual([7,10,16]);expect([unchanged.end.leaks,move.end.leaks,change.end.leaks]).toEqual([3,2,0]);
   expect(move.operations.filter(o=>o.action.startsWith('fuse'))).toHaveLength(0);expect(move.operations.filter(o=>o.wave===2).map(o=>o.action)).toEqual(['stow','deploy']);expect(move.initial.cores.find(c=>c.kind==='grove')!.slot).toBe(variant===0?7:5);
   expect(change.operations.filter(o=>o.action.startsWith('fuse')).map(o=>o.wave)).toEqual([2,2]);
  }
 });
 it('requires retaining starting goal materials: spending them can win combat and miss both tightened pack goals',()=>{
  for(const goalId of ['fire-mountain','wood-water']){
   const success=evidence.strategies.filter(r=>r.choice?.goalId===goalId),spent=evidence.comparisons.find(r=>r.id===`packs-${goalId}-spend-starting-goal`)!;
   expect(success).toHaveLength(2);for(const r of success){expect(r.end.goal?.complete).toBe(true);expect(r.end.goal?.items.every(i=>i.count>=i.required)).toBe(true);}
   expect(spent.end.phase).toBe('won');expect(spent.end.health).toBe(16);expect(spent.end.goal?.complete).toBe(false);expect(spent.end.goal?.items.every(i=>i.count<i.required)).toBe(true);
  }
  const spentReward=evidence.comparisons.find(r=>r.id==='packs-fire-mountain-spend-reward')!;expect(spentReward.operations.some(o=>o.wave===2&&o.action==='fuse:fire-mountain')).toBe(true);expect(spentReward.end.goal?.items.map(i=>i.count)).toEqual([0,1]);
 });
 it('retries an ordinary placement/synthesis mistake, restores exact economy, then wins the full run',()=>{
  const r=evidence.retry;expect(r.mistake.phase).toBe('lost');expect(r.mistake.health).toBe(0);expect(r.exactRestore).toBe(true);expect(r.correctedPreparation.health).toBe(16);expect(r.correctedPreparation.kills).toBe(0);expect(r.recovered.health).toBe(16);expect(r.recovered.leaks).toBe(0);expect(r.end.phase).toBe('won');expect(r.end.health).toBe(16);expect(r.remainingWaves).toHaveLength(2);
 });
 it('replays from public initial state to identical complete evidence',()=>{
  expect(runShortStrategy(SHORT_STRATEGIES[0])).toEqual(evidence.strategies[0]);
  expect(shortMissionEvidence()).toEqual(evidence);
 });
});
