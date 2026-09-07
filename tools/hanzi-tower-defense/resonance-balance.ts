import { mkdirSync, writeFileSync } from 'node:fs';
import { ENEMIES, equipEnglish, newBattle, previewEquipment, startWave, updateBattle, WAVES, type Core, type Enemy } from '../../games/hanzi-tower-defense/model';
import { RESONANCES } from '../../games/hanzi-tower-defense/resonance';
import { balanceEvidence } from './balance';

const root=process.env.TD_EVIDENCE_DIR;
if (!root) throw Error('Set TD_EVIDENCE_DIR explicitly for STEP3 evidence');
type Loadout='chinese'|'volcano'|'forest'|'both';
const round=(v:number)=>Number(v.toFixed(3));
function comparison(mode:Loadout, immortal:boolean, placement:'front'|'back'='front') {
  const state=newBattle();state.cores=(immortal ? [
    {id:11,kind:'volcano',slot:0,cooldown:0},{id:12,kind:'wildwood',slot:1,cooldown:0},
  ] : [
    {id:11,kind:'volcano',slot:0,cooldown:0},{id:12,kind:'wildwood',slot:1,cooldown:0},
    {id:13,kind:'volcano',slot:7,cooldown:0},{id:14,kind:'wildwood',slot:6,cooldown:0},
  ]) as Core[];state.nextCoreId=15;
  // Same Chinese AND English resource budget in each comparison; only attachment choice changes.
  state.englishCores=RESONANCES.map((r,i)=>({id:i+1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:null}));state.englishClaims=RESONANCES.map(r=>r.grantId);state.nextEnglishId=3;
  if(mode==='volcano'||mode==='both')equipEnglish(state,previewEquipment(state,1,placement==='front'?11:13));
  if(mode==='forest'||mode==='both')equipEnglish(state,previewEquipment(state,2,placement==='front'?12:14));
  state.wave=5;startWave(state);state.spawned=WAVES[5].foes.length;
  state.enemies=immortal ? [{id:101,kind:'stone',distance:400,hp:1e9,maxHp:1e9,slow:0,slowUntil:0}] : Array.from({length:12},(_,i)=>{
    const kind=i%3===0?'stone':i%3===1?'swift':'swarm',hp=ENEMIES[kind].hp*2.1;
    return {id:101+i,kind,distance:100+i*21,hp,maxHp:hp,slow:0,slowUntil:0};
  });
  const initial={cores:structuredClone(state.cores),englishCores:structuredClone(state.englishCores),enemies:structuredClone(state.enemies)};
  let damage=0,slowEnemySeconds=0,equivalentStoppedSeconds=0,shots=0,echoes=0,roots=0,maxZones=0,maxEchoes=0,maxVisuals=0,frames=0;
  while(state.phase==='battle' && frames++<(immortal?600:4000)) {
    if(immortal)state.enemies[0].distance=400;
    // Retain actual enemy object references: the same model mutates them even when defeated/removed this tick.
    const before=state.enemies.map((ref:Enemy)=>({ref,hp:ref.hp,distance:ref.distance}));
    const events=updateBattle(state,.05);
    for(const {ref,hp,distance} of before){damage+=Math.max(0,Math.min(hp,hp-ref.hp));const moved=ref.distance-distance;const equivalent=.05-moved/ENEMIES[ref.kind].speed;equivalentStoppedSeconds+=Math.max(0,equivalent);if(equivalent>1e-8)slowEnemySeconds+=.05;}
    shots+=events.filter(e=>e.type==='shot').length;echoes+=events.filter(e=>e.type==='echo').length;roots+=events.filter(e=>e.type==='roots').length;
    maxZones=Math.max(maxZones,state.rootZones.length);maxEchoes=Math.max(maxEchoes,state.echoes.length);maxVisuals=Math.max(maxVisuals,state.visuals.length);
  }
  return {mode,placement,condition:immortal?'one immortal target reset to distance 400 each tick; actual updateBattle damage; 30 seconds':'twelve real moving mixed enemies; same initial cohort/positions/hp, no added spawn, run until cleared/leaked',initial,seconds:round(state.elapsed),actualDamage:round(damage),kills:state.kills,leaks:state.leaks,health:state.health,slowEnemySeconds:round(slowEnemySeconds),equivalentStoppedSeconds:round(equivalentStoppedSeconds),shots,echoes,roots,maxZones,maxEchoes,maxVisuals};
}
const modes:Loadout[]=['chinese','volcano','forest','both'];
const stationary=modes.map(mode=>comparison(mode,true)),moving=modes.map(mode=>comparison(mode,false)),placement=['front','back'].flatMap(place=>['volcano','forest'].map(mode=>comparison(mode as Loadout,false,place as 'front'|'back')));
const original=balanceEvidence();
const evidence={stationary,moving,placement,originalBuilds:original.builds,notes:['Actual capped damage is measured on model enemy objects, never inferred from the UI.','Slow enemy seconds sums time across enemies; equivalent stopped seconds sums lost movement divided by each normal speed.','An immortal reset target isolates firing; it is not a moving-wave win claim. Moving crowd comparison uses a fixed cohort, not an ordinary save.','Both original construction routes run six original waves without English equipment. Rewards may remain unused in the bag.']};
mkdirSync(root,{recursive:true});writeFileSync(`${root}/resonance-balance.json`,JSON.stringify(evidence,null,2));
const compact=(rows:typeof stationary)=>rows.map(({initial,...rest})=>rest);
console.log(JSON.stringify({stationary:compact(stationary),moving:compact(moving),placement:compact(placement),originalPassed:original.builds.filter(b=>b.result==='won').length},null,2));
if(stationary.slice(1).some(r=>r.actualDamage<=stationary[0].actualDamage)||stationary[3].actualDamage<=Math.max(stationary[1].actualDamage,stationary[2].actualDamage)||original.builds.some(b=>b.result!=='won')||[...stationary,...moving,...placement].some(r=>r.maxZones>3||r.maxEchoes>4||r.maxVisuals>90))process.exitCode=1;
