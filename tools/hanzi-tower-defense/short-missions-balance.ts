import {mkdirSync,writeFileSync} from 'node:fs';
import {RECIPES,type CoreKind} from '../../games/hanzi-tower-defense/content';
import {newTactics,choosePreparation,deploy,stow,fuse,startWave,updateBattle,packProgress,retryWave,checkpointOf,type BattleState} from '../../games/hanzi-tower-defense/model';
import type {ChallengeParameters,ScenarioId} from '../../games/hanzi-tower-defense/tactics';

export interface Strategy {id:string;scenarioId:ScenarioId;choice?:ChallengeParameters;towers:readonly (readonly [CoreKind,number])[];waveTowers?:readonly (readonly (readonly [CoreKind,number])[])[];}
export const SHORT_STRATEGIES:readonly Strategy[]=[
 ...(['ember','leaf'] as const).flatMap(packId=>[
  {id:`elite-${packId}-volcano-grove`,scenarioId:'qinglan-elite' as const,choice:{packId},towers:[['volcano',0],['grove',1],['wash',3]] as const},
  {id:`elite-${packId}-flame-wildwood`,scenarioId:'qinglan-elite' as const,choice:{packId},towers:[['flame',0],['wildwood',1],['wash',3]] as const},
  {id:`elite-${packId}-wildwood-basics`,scenarioId:'qinglan-elite' as const,choice:{packId},towers:[['wildwood',0],['fire',1],['water',3]] as const},
  {id:`elite-${packId}-volcano-grove-water`,scenarioId:'qinglan-elite' as const,choice:{packId},towers:[['volcano',0],['grove',1],['water',3]] as const},
 ]),
 {id:'elite-ember-two-volcanoes',scenarioId:'qinglan-elite',choice:{packId:'ember'},towers:[['volcano',0],['volcano',1],['wash',3]]},
 {id:'elite-leaf-wildwood-two-washes',scenarioId:'qinglan-elite',choice:{packId:'leaf'},towers:[['wildwood',0],['wash',1],['wash',3]]},
 ...([0,1] as const).flatMap(variant=>[
  {id:`repair-${variant}-move-original`,scenarioId:'qinglan-repair' as const,choice:{variant},towers:[['volcano',0],['grove',1],['water',6]] as const,waveTowers:[[['volcano',0],['grove',variant===0?7:5],['water',6]]] as const},
  {id:`repair-${variant}-change-composition`,scenarioId:'qinglan-repair' as const,choice:{variant},towers:[['volcano',0],['wildwood',1],['wash',3]] as const,waveTowers:[[['volcano',0],['grove',variant===0?7:5],['water',6]]] as const},
 ]),
 {id:'packs-fire-mountain-volcano',scenarioId:'qinglan-packs',choice:{goalId:'fire-mountain'},towers:[['volcano',0],['grove',1],['wash',3]]},
 {id:'packs-fire-mountain-wildwood',scenarioId:'qinglan-packs',choice:{goalId:'fire-mountain'},towers:[['flame',0],['wildwood',1],['wash',3]]},
 {id:'packs-wood-water-volcano',scenarioId:'qinglan-packs',choice:{goalId:'wood-water'},towers:[['volcano',0],['flame',1],['grove',3]]},
 {id:'packs-wood-water-wildwood',scenarioId:'qinglan-packs',choice:{goalId:'wood-water'},towers:[['flame',0],['wildwood',1],['fire',3]]},
];
export const SHORT_COMPARISONS:readonly Strategy[]=[
 ...(['ember','leaf'] as const).map(packId=>({id:`elite-${packId}-unfused-basics`,scenarioId:'qinglan-elite' as const,choice:{packId},towers:[['fire',0],['wood',1],['water',3]] as const})),
 ...([0,1] as const).map(variant=>({id:`repair-${variant}-unchanged`,scenarioId:'qinglan-repair' as const,choice:{variant},towers:[['volcano',0],['grove',variant===0?7:5],['water',6]] as const})),
 {id:'packs-fire-mountain-spend-starting-goal',scenarioId:'qinglan-packs',choice:{goalId:'fire-mountain'},towers:[['volcano',0],['flame',1],['grove',3],['wash',6],['mountain',4]]},
 {id:'packs-wood-water-spend-starting-goal',scenarioId:'qinglan-packs',choice:{goalId:'wood-water'},towers:[['volcano',0],['flame',1],['grove',3],['wash',6],['water',7]]},
 {id:'packs-fire-mountain-spend-reward',scenarioId:'qinglan-packs',choice:{goalId:'fire-mountain'},towers:[['volcano',0],['flame',1],['grove',3],['wash',6],['volcano',4]],waveTowers:[[['volcano',0],['flame',1],['grove',3],['wash',6]]]},
];
const snapshot=(s:BattleState)=>({phase:s.phase,wave:s.wave,health:s.health,kills:s.kills,leaks:s.leaks,cores:s.cores.map(({id,kind,slot})=>({id,kind,slot})),english:s.englishCores.map(({id,lexemeId,attachedTo})=>({id,lexemeId,attachedTo})),goal:packProgress(s)});
export interface Operation {wave:number;phase:string;seconds:number;action:string;ids:number[];kind?:CoreKind;slot?:number|null;inputs?:readonly CoreKind[];}
function prepare(s:BattleState, towers:Strategy['towers'],operations:Operation[]){
 if(s.cores.filter(c=>c.slot!==null).length===towers.length&&towers.every(([kind,slot])=>s.cores.some(c=>c.kind===kind&&c.slot===slot)))return;
 const record=(action:string,ids:number[],kind?:CoreKind,slot?:number|null,inputs?:readonly CoreKind[])=>operations.push({wave:s.wave+1,phase:s.phase,seconds:+s.waveTime.toFixed(2),action,ids,kind,slot,inputs});
 for(const c of [...s.cores])if(c.slot!==null&&!towers.some(([kind,slot])=>kind===c.kind&&slot===c.slot)){if(!stow(s,c.id))throw Error('Illegal stow');record('stow',[c.id],c.kind);}
 const selected=new Set<number>();
 const get=(kind:CoreKind):number=>{
  const existing=s.cores.find(c=>c.kind===kind&&!selected.has(c.id));if(existing)return existing.id;
  const recipe=RECIPES.find(r=>r.result===kind);if(!recipe)throw Error(`Missing ${kind}`);
  const first=get(recipe.inputs[0]);selected.add(first);const second=get(recipe.inputs[1]);selected.delete(first);
  const result=fuse(s,first,second,null,recipe.id);if(!result)throw Error(`Illegal ${recipe.id}`);record(`fuse:${recipe.id}`,[first,second,result.id],result.kind,null,recipe.inputs);return result.id;
 };
 for(const [kind,slot]of towers){const id=get(kind);selected.add(id);if(s.cores.find(c=>c.id===id)!.slot===slot)continue;if(!deploy(s,id,slot))throw Error(`Illegal deployment ${kind}@${slot}`);record('deploy',[id],kind,slot);}
}
function finishPreparedWave(s:BattleState){
 if(!startWave(s))throw Error('Wave start rejected');let steps=0;
 while(s.phase==='battle'&&steps++<5000)updateBattle(s,.05);
 if(s.phase==='battle')throw Error('Unfinished simulation');
}
export function runShortStrategy(strategy:Strategy){
 let s=newTactics(strategy.scenarioId,[],strategy.choice);
 const initial=snapshot(s),operations:Operation[]=[];
 if(strategy.scenarioId==='qinglan-elite'||strategy.scenarioId==='qinglan-packs'){
  const chosen=choosePreparation(s,strategy.choice!);if(!chosen)throw Error('Preparation choice rejected');s=chosen;
 }
 const waves:unknown[]=[],wavePreparations:ReturnType<typeof snapshot>[]=[];
 while(s.phase==='ready'){
  const wave=s.wave+1,operationIndex=operations.length;
  prepare(s,strategy.waveTowers?.[s.wave]??strategy.towers,operations);wavePreparations.push(snapshot(s));finishPreparedWave(s);
  waves.push({...s.summaries.at(-1),preparationActions:operations.slice(operationIndex),betweenWaveDecision:operations.length===operationIndex?'keep towers and retain all earned materials':`ordinary preparation before wave ${wave}`,end:snapshot(s)});
 }
 return {id:strategy.id,scenarioId:strategy.scenarioId,choice:strategy.choice,englishUsed:false,initial,wavePreparations,operations,waves,end:snapshot(s)};
}
export function retryRecovery(){
 const strategy=SHORT_STRATEGIES[0];let s=choosePreparation(newTactics('qinglan-elite'),{packId:'ember'})!;
 const operations:Operation[]=[];prepare(s,[['fire',5],['wood',7],['water',6]],operations);startWave(s);
 const before=checkpointOf(s.checkpoint);let steps=0;
 while(s.phase==='battle'&&steps++<5000)updateBattle(s,.05);
 const mistake=snapshot(s),restored=retryWave(s);if(!restored)throw Error('Retry unavailable');
 s=restored;const exactRestore=JSON.stringify(checkpointOf(s))===JSON.stringify(before);prepare(s,strategy.towers,operations);
 const correctedPreparation=snapshot(s);if(!startWave(s))throw Error('Retry start rejected');
 steps=0;while(s.phase==='battle'&&steps++<5000)updateBattle(s,.05);
 const recovered=snapshot(s),summary=s.summaries.at(-1),remainingWaves:unknown[]=[];
 while(s.phase==='ready'){prepare(s,strategy.towers,operations);finishPreparedWave(s);remainingWaves.push({...s.summaries.at(-1),end:snapshot(s)});}
 return {mistake,exactRestore,correctedPreparation,recovered,operations,summary,remainingWaves,end:snapshot(s)};
}
export function shortMissionEvidence(){return {strategies:SHORT_STRATEGIES.map(runShortStrategy),comparisons:SHORT_COMPARISONS.map(runShortStrategy),retry:retryRecovery()};}
export function assertShortMissionEvidence(e:ReturnType<typeof shortMissionEvidence>){
 for(const r of e.strategies){if(r.end.phase!=='won'||r.end.health<=0||r.waves.length!==3)throw Error(`${r.id}: victory missing`);if(r.end.goal&&!r.end.goal.complete)throw Error(`${r.id}: pack goal missing`);if(r.wavePreparations.some(w=>w.cores.some(c=>c.kind==='forest'||c.kind==='canopy')))throw Error('Forbidden Qinglan tower');}
 for(const r of e.strategies.filter(r=>r.id.endsWith('-wildwood-basics')||r.id.endsWith('-volcano-grove-water')))if(r.end.health!==13||r.end.leaks!==1)throw Error(`${r.id}: mixed basic/fused health tradeoff missing`);
 for(const r of e.comparisons){if(r.scenarioId==='qinglan-elite'&&r.end.phase!=='lost')throw Error(`${r.id}: synthesis contrast missing`);if(r.scenarioId==='qinglan-repair'&&r.end.health>=e.strategies.find(s=>s.id===`repair-${r.choice?.variant}-move-original`)!.end.health)throw Error(`${r.id}: repair contrast missing`);if(r.scenarioId==='qinglan-packs'&&(r.end.phase!=='won'||r.end.goal?.complete))throw Error(`${r.id}: preserve versus spend contrast missing`);}
 if(!e.retry.exactRestore||e.retry.mistake.phase!=='lost'||e.retry.recovered.phase!=='ready'||e.retry.recovered.health<=e.retry.mistake.health||e.retry.end.phase!=='won')throw Error('Retry did not recover ordinary placement error');
}
if(process.argv.includes('--write')||process.argv.includes('--scan')){
 const e=shortMissionEvidence();console.log(JSON.stringify({strategies:e.strategies.map(r=>({id:r.id,health:r.end.health,leaks:r.end.leaks,result:r.end.phase,goal:r.end.goal})),comparisons:e.comparisons.map(r=>({id:r.id,health:r.end.health,leaks:r.end.leaks,result:r.end.phase,goal:r.end.goal})),retry:{mistake:e.retry.mistake.phase,exactRestore:e.retry.exactRestore,recoveredHealth:e.retry.recovered.health,end:e.retry.end.phase}},null,2));
 if(process.argv.includes('--write')){const dir='tmp/tasks/SHORT-MISSIONS/evidence';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/short-missions-balance.json`,JSON.stringify(e,null,2));assertShortMissionEvidence(e);}
}
