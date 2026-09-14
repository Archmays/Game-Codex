import {mkdirSync,writeFileSync} from 'node:fs';
import {CORES,type CoreKind} from '../../games/hanzi-tower-defense/content';
import {SCENARIOS,SCENARIO_IDS,type ScenarioId} from '../../games/hanzi-tower-defense/tactics';
import {newTactics,deploy,stow,fuse,startWave,updateBattle,routeCoverage,previewEquipment,equipEnglish,type BattleState} from '../../games/hanzi-tower-defense/model';
export type TacticsBuild='volcano-grove'|'flame-wildwood';
export type Placement='distributed'|'late-only'|'one-side';
export const prioritiesFor=(s:BattleState,build:TacticsBuild)=>build==='volcano-grove'?(s.mapId==='qinglan-pass'?['fire-mountain','wood-wood','water-wood']:['canopy-grove','wood-grove','wood-wood','fire-mountain','water-wood']):['fire-fire','mountain-grove','wood-wood','water-wood'];
export const orderFor=(build:TacticsBuild):CoreKind[]=>build==='volcano-grove'?['forest','volcano','canopy','grove','wash','flame','wildwood','mountain','fire','wood','water']:['wildwood','flame','wash','grove','volcano','mountain','fire','wood','water','canopy','forest'];
export function positionsFor(s:BattleState,placement:Placement):number[]{
 if(placement==='one-side')return s.mapId==='twin-bends'?[0,2,5,7]:[1,3,4];
 const positions=s.mapId==='twin-bends'?[0,1,4,2,3,5,6,7]:s.mapId==='beacon-keep'?[0,1,4,3,5,6,2,7]:[0,1,3,6,2,4,5,7];
 return placement==='late-only'?[...positions].reverse().slice(0,4):positions;
}
export function arrangeTactics(s:BattleState,build:TacticsBuild,placement:Placement='distributed',english:boolean|'forest-only'=false){
 // Ordinary wave-between transactions only. No injected material or battle result.
 for(const c of s.cores)if(c.slot!==null)stow(s,c.id);
 const combine=(aKind:CoreKind,bKind:CoreKind)=>{const a=s.cores.find(c=>c.kind===aKind),b=s.cores.find(c=>c.kind===bKind&&c.id!==a?.id);return a&&b?fuse(s,a.id,b.id,null):null;};
 for(let n=0;n<100;n++){
  if(build==='volcano-grove'){
   if(s.mapId!=='qinglan-pass'){if(combine('canopy','grove'))continue;if(combine('wood','grove'))continue;}
   if(combine('fire','mountain'))continue;if(combine('wood','wood'))continue;
  }else{if(combine('fire','fire'))continue;if(combine('mountain','grove'))continue;if(combine('wood','wood'))continue;}
  if(combine('water','wood'))continue;break;
 }
 const order=orderFor(build),positions=positionsFor(s,placement),ordered=[...s.cores].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)||a.id-b.id);
 for(const [i,c] of ordered.slice(0,positions.length).entries())if(!deploy(s,c.id,positions[i]))throw Error('Illegal preparation');
 if(english)for(const e of s.englishCores)if(e.attachedTo===null&&(english!=='forest-only'||e.lexemeId==='en-forest'))for(const c of ordered){const p=previewEquipment(s,e.id,c.id);if(p.ok){equipEnglish(s,p);break;}}
}
export function runTactics(id:ScenarioId,build:TacticsBuild,placement:Placement='distributed',english:boolean|'forest-only'=false){
 const s=newTactics(id),waves:unknown[]=[];let steps=0,shots=0,fourthTargetHits=0,echoes=0,roots=0;
 while(s.phase!=='won'&&s.phase!=='lost'&&steps++<18000){
  if(s.phase==='ready'){arrangeTactics(s,build,placement,english);startWave(s);}
  const events=updateBattle(s,.05),volleys=new Map<number,Set<number>>();
  for(const e of events){if(e.type==='shot'){shots++;if(e.resonance==='branching-volley'){const ids=volleys.get(e.coreId)??new Set();ids.add(e.enemyId);volleys.set(e.coreId,ids);}}if(e.type==='echo')echoes++;if(e.type==='roots')roots++;}
  fourthTargetHits+=[...volleys.values()].filter(ids=>ids.size===4).length;
  if(events.some(e=>e.type==='wave-end')||s.health<=0)waves.push({...s.summaries.at(-1),towers:s.cores.filter(c=>c.slot!==null).map(c=>({kind:c.kind,slot:c.slot})),coverage:routeCoverage(s)});
 }
 return {scenarioId:id,build,placement,english,result:s.phase,kills:s.kills,leaks:s.leaks,health:s.health,seconds:+s.elapsed.toFixed(2),shots,fourthTargetHits,echoes,roots,waves};
}
export function tacticsEvidence(){return {forestOnly:(['twin-lanes','beacon-crowd'] as const).map(id=>runTactics(id,'volcano-grove','distributed','forest-only')),builds:SCENARIO_IDS.flatMap(id=>(['volcano-grove','flame-wildwood'] as const).map(build=>runTactics(id,build))),comparisons:SCENARIO_IDS.map(id=>runTactics(id,'volcano-grove',SCENARIOS[id].mapId==='twin-bends'?'one-side':'late-only')),resonance:SCENARIO_IDS.flatMap(id=>(['volcano-grove','flame-wildwood'] as const).map(build=>runTactics(id,build,'distributed',true)))};}
export function assertTacticsEvidence(evidence:ReturnType<typeof tacticsEvidence>):void {
 const failures:string[]=[];
 if(SCENARIO_IDS.length!==6||evidence.builds.length!==12)failures.push('Expected six scenarios and two no-English builds each');
 for(const r of evidence.builds)if(r.result!=='won'||r.waves.length!==3||r.health<=0||r.english)failures.push(`${r.scenarioId}/${r.build}: no-English three-wave victory missing`);
 for(const r of evidence.comparisons){const base=evidence.builds.find(b=>b.scenarioId===r.scenarioId&&b.build===r.build);if(!base||r.leaks<=base.leaks||r.health>=base.health||r.kills>=base.kills)failures.push(`${r.scenarioId}: actual poor-placement kill/leak/gate contrast missing`);}
 for(const r of evidence.forestOnly)if(r.result!=='won'||r.fourthTargetHits<=0||r.echoes!==0||r.roots!==0)failures.push(`${r.scenarioId}: isolated fourth-target evidence missing`);
 if(!evidence.resonance.some(r=>r.echoes>0)||!evidence.resonance.some(r=>r.roots>0))failures.push('Existing volcano/wildwood effects missing');
 if(failures.length)throw Error(failures.join('\n'));
}
if(process.argv.includes('--write')){const out=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP5/tower';mkdirSync(out,{recursive:true});const evidence=tacticsEvidence();writeFileSync(`${out}/tactics-model-balance.json`,JSON.stringify(evidence,null,2));assertTacticsEvidence(evidence);console.log(JSON.stringify({...evidence,builds:evidence.builds.map(({waves,...r})=>r),comparisons:evidence.comparisons.map(({waves,...r})=>r),resonance:evidence.resonance.map(({waves,...r})=>r)},null,2));}
