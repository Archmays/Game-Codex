import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CORES, ORIGINAL_CORE_ORDER } from '../../games/hanzi-tower-defense/content';
import { DEFENSE_MAPS, PATH, SLOTS, type DefenseMap, type Point } from '../../games/hanzi-tower-defense/maps';
import { deploy, newBattle, startWave, updateBattle } from '../../games/hanzi-tower-defense/model';

// Frozen prior coordinates, used only for the explicitly requested before/after comparison.
export const PRIOR_SLOTS = [
  {x:150,y:220},{x:365,y:250},{x:390,y:510},{x:620,y:300},
  {x:630,y:80},{x:865,y:270},{x:640,y:530},{x:870,y:555},
];
export function coveredRoad(path:readonly Point[], point:Point, radius:number):number {
  return path.slice(1).reduce((total,b,i)=>{
    const a=path[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    const along=(point.x-a.x)*ux+(point.y-a.y)*uy;
    const perpendicularSquared=(point.x-a.x)**2+(point.y-a.y)**2-along**2;
    if(perpendicularSquared>radius*radius)return total;
    const half=Math.sqrt(Math.max(0,radius*radius-perpendicularSquared));
    return total+Math.max(0,Math.min(length,along+half)-Math.max(0,along-half));
  },0);
}
function firstWave(slot:number){
  const state=newBattle();deploy(state,1,slot);startWave(state);
  let shots=0;
  for(let n=0;state.phase==='battle'&&n<10000;n++)shots+=updateBattle(state,.05).filter(event=>event.type==='shot').length;
  return {slot:slot+1,shots,kills:state.kills,leaks:state.leaks,health:state.health,seconds:+state.elapsed.toFixed(2)};
}
export function placementEvidence(){
  const map=DEFENSE_MAPS['qinglan-pass'] as DefenseMap, current=map.slots;
  let before;
  try {
    // Controlled map-configuration fixture. The battle uses only legal deploy/start/update actions.
    map.slots=PRIOR_SLOTS.map((p,i)=>({...p,name:current[i].name}));
    before=PRIOR_SLOTS.map((_,i)=>firstWave(i));
  } finally {map.slots=current;}
  const after=SLOTS.map((_,i)=>firstWave(i));
  const coverage=SLOTS.map((point,i)=>({slot:i+1,before:PRIOR_SLOTS[i],after:point,cores:ORIGINAL_CORE_ORDER.map(kind=>({kind,range:CORES[kind].range,before:+coveredRoad(PATH,PRIOR_SLOTS[i],CORES[kind].range).toFixed(1),after:+coveredRoad(PATH,point,CORES[kind].range).toFixed(1)}))}));
  return {method:'Exact circle/road intersection plus isolated first-wave model; same one fire tower, other starting materials remain in bag, no extra resources or battle-state injection',coverage,before,after};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const result=placementEvidence(),evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP4/tower';
  mkdirSync(evidence,{recursive:true});writeFileSync(`${evidence}/qinglan-placement.json`,JSON.stringify(result,null,2));
  const changed=[2,6,7];
  for(const i of changed){
    if(result.coverage[i].cores.some(c=>c.after<c.before*1.2)||result.after[i].kills<result.before[i].kills||result.after[i].shots<=result.before[i].shots)throw new Error(`Slot ${i+1} did not improve geometry and actual attack opportunity`);
  }
  console.log(JSON.stringify({coverage:result.coverage.map(s=>({slot:s.slot,...s.cores.find(c=>c.kind==='fire')})),before:result.before,after:result.after},null,2));
}
