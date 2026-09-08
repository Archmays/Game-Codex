import {RESONANCES} from '../../games/hanzi-tower-defense/resonance';
import {writeFileSync,mkdirSync} from 'node:fs';
import {CORES, RECIPES,type CoreKind} from '../../games/hanzi-tower-defense/content';
import {mapFor,type MapId} from '../../games/hanzi-tower-defense/maps';
import {newBattle,startWave,updateBattle,fuse,stow,deploy,firingRange,previewEquipment,equipEnglish,type BattleState} from '../../games/hanzi-tower-defense/model';
export type NewBuild='forest-volcano'|'flame-wildwood';
export type EnglishPolicy=boolean|'forest-only';
export function arrangeStep4(s:BattleState,route:NewBuild,reverse=false,english:EnglishPolicy=false) {
 const combine=(aKind:CoreKind,bKind:CoreKind)=>{const a=s.cores.find(c=>c.kind===aKind),b=s.cores.find(c=>c.kind===bKind&&c.id!==a?.id);return a&&b?fuse(s,a.id,b.id,a.slot??b.slot):null;};
 for(let n=0;n<100;n++) {
  if(route==='forest-volcano') {if(combine('canopy','grove'))continue;if(combine('wood','grove'))continue;if(combine('wood','wood'))continue;if(combine('fire','mountain'))continue;}
  else {if(combine('fire','fire'))continue;if(combine('mountain','grove'))continue;if(combine('wood','wood'))continue;}
  if(combine('water','wood'))continue;break;
 }
 const order:CoreKind[]=route==='forest-volcano'?['forest','volcano','canopy','grove','wash','flame','wildwood','mountain','fire','wood','water']:['wildwood','flame','wash','grove','volcano','mountain','fire','wood','water','canopy','forest'];
 const positions=s.mapId==='twin-bends'?[0,1,4,2,3,5,6,7]:[0,1,4,3,5,6,2,7];if(reverse)positions.reverse();
 for(const c of s.cores)if(c.slot!==null)stow(s,c.id);
 const ordered=[...s.cores].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)||a.id-b.id);
 for(const [i,c] of ordered.slice(0,8).entries())deploy(s,c.id,positions[i]);
 if(english)for(const e of s.englishCores)if(e.attachedTo===null&&(english!=='forest-only'||e.lexemeId==='en-forest'))for(const c of ordered){const p=previewEquipment(s,e.id,c.id);if(p.ok){equipEnglish(s,p);break;}}
}
export function runStep4(mapId:MapId,route:NewBuild,reverse=false,english:EnglishPolicy=false) {
 const s=newBattle(undefined,[],mapId),waves=[];let steps=0,shots=0,forestResonanceShots=0,fourthTargetHits=0;
 while(s.phase!=='won'&&s.phase!=='lost'&&steps++<18000){
  if(s.phase==='ready'){arrangeStep4(s,route,reverse,english);startWave(s);}
  const events=updateBattle(s,.05),volleys=new Map<number,Set<number>>();
  for(const event of events)if(event.type==='shot'){
   shots++;
   if(event.resonance==='branching-volley'){forestResonanceShots++;const targets=volleys.get(event.coreId)??new Set<number>();targets.add(event.enemyId);volleys.set(event.coreId,targets);}
  }
  // At a .05s model step, a .85s forest tower can fire only one volley. Four distinct hits prove the added target.
  fourthTargetHits += [...volleys.values()].filter(targets=>targets.size===4).length;
  if(events.some(e=>e.type==='wave-end'))waves.push({wave:s.wave,health:s.health,kills:s.kills,leaks:s.leaks,seconds:+s.elapsed.toFixed(2),towers:s.cores.filter(c=>c.slot!==null).map(c=>({kind:c.kind,slot:c.slot}))});
 }
 return {mapId,route,reverse,english,result:s.phase,health:s.health,kills:s.kills,leaks:s.leaks,seconds:+s.elapsed.toFixed(2),shots,forestResonanceShots,fourthTargetHits,equippedEnglish:s.englishCores.filter(e=>e.attachedTo!==null).map(e=>e.lexemeId),waves};
}
/** A controlled real first wave: legal recipes/slots only; identical spare resources stay unused in the bag. */
export function naturalRecipeComparison(mapId:MapId,recipeId:'wood-grove'|'canopy-grove',mergedAt:0|1|null){
 const s=newBattle(undefined,[],mapId);
 if(!mapFor(mapId).expanded)throw Error('New recipe comparisons require an expanded map');
 for(const c of s.cores)if(c.slot!==null&&!stow(s,c.id))throw Error('Initial stow rejected');
 const craft=(aKind:CoreKind,bKind:CoreKind)=>{const a=s.cores.find(c=>c.kind===aKind),b=s.cores.find(c=>c.kind===bKind&&c.id!==a?.id);const result=a&&b?fuse(s,a.id,b.id,null):null;if(!result)throw Error('Legal ingredient construction failed');return result;};
 const firstGrove=craft('wood','wood');
 const ingredients=recipeId==='wood-grove'?[s.cores.find(c=>c.kind==='wood')!,firstGrove]:[craft('wood','grove'),craft('wood','wood')];
 let subjects=ingredients;
 if(mergedAt!==null){const result=fuse(s,ingredients[0].id,ingredients[1].id,null,recipeId);if(!result)throw Error('Legal comparison fusion rejected');subjects=[result];}
 const materialUnits=subjects.reduce((sum,c)=>sum+CORES[c.kind].recycle,0);
 const unusedStart=s.cores.filter(c=>!subjects.some(subject=>subject.id===c.id)).map(c=>({id:c.id,kind:c.kind}));
 for(const [i,c] of subjects.entries())if(!deploy(s,c.id,mergedAt??i))throw Error('Legal comparison deployment rejected');
 const deployment=subjects.map(c=>({id:c.id,kind:c.kind,slot:c.slot}));
 if(!startWave(s))throw Error('Legal comparison wave rejected');
 let steps=0;while(s.phase==='battle'&&steps++<18000)updateBattle(s,.05);
 if(s.phase==='battle')throw Error('Natural comparison exceeded its bound');
 return {mapId,recipeId,mergedAt,condition:'actual first wave; legal distinct slots; equal ingredient value; identical unused starting resources',materialUnits,unusedStart,deployment,result:s.phase,wave:s.wave,kills:s.kills,leaks:s.leaks,health:s.health,seconds:+s.elapsed.toFixed(2)};
}
/** Controlled moving-group fixture: equal material value and exactly the same attack origin. Co-location is only a comparison fixture, not a playable placement. */
export function movingGroup(kinds:readonly CoreKind[],english=false){
 const s=newBattle(undefined,[],'beacon-keep');s.cores=kinds.map((kind,i)=>({id:i+1,kind,slot:0,cooldown:0}));startWave(s);s.spawned=mapFor(s.mapId).waves[0].foes.length;s.waveTime=1;
 s.enemies=Array.from({length:12},(_,i)=>({id:i+100,kind:'swarm' as const,distance:80+i*12,hp:1000,maxHp:1000,slow:0,slowUntil:0,lane:0}));
 if(english){const r=RESONANCES[2],c=s.cores.find(c=>c.kind==='forest')!;s.englishCores=[{id:1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:c.id}];s.englishClaims=[r.grantId];s.nextEnglishId=2;}
 let damage=0,shots=0,steps=0;while(s.phase==='battle'&&steps++<600){const before=s.enemies.map(e=>({id:e.id,hp:e.hp,ref:e}));const events=updateBattle(s,.05);for(const e of before){const after=s.enemies.find(a=>a.id===e.id);damage+=e.hp-Math.max(0,e.ref.hp);}shots+=events.filter(e=>e.type==='shot').length;}
 return {kinds,english,damage:+damage.toFixed(2),shots,kills:s.kills,leaks:s.leaks,seconds:+s.elapsed.toFixed(2)};
}
export function step4Evidence(){return {builds: ['twin-bends','beacon-keep'].flatMap(id=>(['forest-volcano','flame-wildwood'] as const).flatMap(route=>[false,true].map(reverse=>runStep4(id as MapId,route,reverse)))),english:['twin-bends','beacon-keep'].map(id=>runStep4(id as MapId,'forest-volcano',false,true)),forestOnly:['twin-bends','beacon-keep'].map(id=>runStep4(id as MapId,'forest-volcano',false,'forest-only')),naturalRecipes:(['twin-bends','beacon-keep'] as const).flatMap(id=>(['wood-grove','canopy-grove'] as const).map(recipeId=>({mapId:id,recipeId,before:naturalRecipeComparison(id,recipeId,null),after:[0,1].map(slot=>naturalRecipeComparison(id,recipeId,slot as 0|1))}))),moving:RECIPES.slice(5).map(r=>({recipe:r.id,before:movingGroup(r.inputs),after:movingGroup([r.result]),...(r.result==='forest'?{english:movingGroup([r.result],true)}:{})})),single:RECIPES.slice(5).map(r=>({recipe:r.id,condition:'30 seconds immortal stationary target, equal ingredients',before:firingRange(r.inputs),after:firingRange([r.result])})),maps:['qinglan-pass','twin-bends','beacon-keep'].map(id=>({id,waves:mapFor(id as MapId).waves.length,paths:mapFor(id as MapId).paths.length}))};}
if(process.argv.includes('--write')){const root=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP4/tower';mkdirSync(root,{recursive:true});const result=step4Evidence();writeFileSync(`${root}/model-balance.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({builds:result.builds.map(({waves,...r})=>r),forestOnly:result.forestOnly.map(({waves,...r})=>r),naturalRecipes:result.naturalRecipes},null,2));}
