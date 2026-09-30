import { mapFor, type MapId, type Wave, type EnemyKind, type MapDrops } from './maps';
import type { CoreKind } from './content';

export type ScenarioId = 'qinglan-intercept' | 'qinglan-last-bend' | 'twin-lanes' | 'twin-relay' | 'beacon-crowd' | 'beacon-captain' | 'qinglan-elite' | 'qinglan-repair' | 'qinglan-packs';
export interface ChallengeParameters { packId?: 'ember'|'leaf'; goalId?: 'fire-mountain'|'wood-water'; variant?: 0|1; confirmed?: boolean; }
export interface MaterialPack { id:'ember'|'leaf'; title:string; starting:readonly {kind:CoreKind;slot:number|null}[]; }
export interface PackGoal { id:'fire-mountain'|'wood-water'; title:string; items:readonly {kind:CoreKind;required:number}[]; }
export interface Scenario {
 id: ScenarioId; mapId: MapId; title: string; question: string; waves: readonly Wave[];
 starting: readonly {kind:CoreKind;slot:number|null}[]; rewards: readonly (readonly CoreKind[])[]; drops: MapDrops;
 challengeRule?:string; materialPacks?:readonly MaterialPack[]; packGoals?:readonly PackGoal[]; variationHint?:string;
}
const starting = (expanded:boolean) => (['fire','fire','fire',...Array(expanded?5:3).fill('wood'),'water','water','mountain','mountain'] as CoreKind[]).map(kind=>({kind,slot:null}));
const wave = (label:string,hint:string,count:number,interval:number,strength:number,kind:(n:number)=>EnemyKind,lanes?:(n:number)=>number):Wave => ({label,hint,foes:Array.from({length:count},(_,n)=>kind(n)),interval,strength,...(lanes?{lanes:Array.from({length:count},(_,n)=>lanes(n))}:{})});
const swarm = ():EnemyKind=>'swarm';
const mixed = (n:number):EnemyKind=>n%6===0?'stone':n%3===0?'swift':'swarm';
const drops = (expanded:boolean):MapDrops=>({baseKinds:['wood','fire'],milestones:[1,5],english:[{grantId:'wave-2-volcano',wave:0,kill:3},{grantId:'wave-4-mountain-forest',wave:1,kill:3},...(expanded?[{grantId:'wave-3-forest' as const,wave:0,kill:5}]:[])]});
function scenario(id:ScenarioId,mapId:MapId,title:string,question:string,waves:Wave[]):Scenario {
 return {id,mapId,title,question,waves,starting:starting(mapFor(mapId).expanded),rewards:waves.map((_,i)=>i===1?['mountain','water']:['wood','fire']),drops:drops(mapFor(mapId).expanded)};
}
export const SCENARIOS:Readonly<Record<ScenarioId,Scenario>> = {
 'qinglan-elite':{
  ...scenario('qinglan-elite','qinglan-pass','少塔精兵','只带三座塔上场：分开守，还是合成省名额？',[
   wave('入口成群','团团怪从入口结伴而来，前弯适合清群。',18,.9,2.2,swarm),
   wave('疾风过弯','团团与疾风交替；慢住快怪再接力。',20,1.1,2.4,n=>n%2?'swift':'swarm'),
   wave('快慢接力','石甲耐打，疾风跑快；三座塔要分工。',22,1.2,2.6,mixed),
  ]),
  challengeRule:'最多上场三座塔；合成能把两份材料放进一个名额。',
  materialPacks:[
   {id:'ember',title:'熔岩包',starting:(['fire','fire','fire','wood','wood','wood','water','water','mountain','mountain'] as CoreKind[]).map(kind=>({kind,slot:null}))},
   {id:'leaf',title:'林间包',starting:(['fire','fire','wood','wood','wood','wood','wood','water','water','mountain'] as CoreKind[]).map(kind=>({kind,slot:null}))},
  ],
 },
 'qinglan-repair':{
  ...scenario('qinglan-repair','qinglan-pass','接手残局','林留在城门边：把空白长弯补起来。',[
   wave('慢步探路','团团怪慢慢探路；第一波可以先试布位。',12,1.6,2.2,swarm),
   wave('快步补漏','疾风穿过长弯，后段还要有人接住。',18,1.2,2.6,n=>n%3?'swarm':'swift'),
   wave('石甲与疾风','石甲与疾风交错；清群、重击和减速各有作用。',22,1.2,3.0,mixed),
  ]),
  starting:[{kind:'volcano',slot:0},{kind:'grove',slot:7},{kind:'water',slot:6},{kind:'wood',slot:null},{kind:'wood',slot:null},{kind:'water',slot:null},{kind:'mountain',slot:null},{kind:'fire',slot:null}],
  challengeRule:'林守在后路，长弯还空着；移动整塔或用补料改变阵容。',
  variationHint:'变化：林从城门守卫移到后路侧翼；其他条件相同。',
 },
 'qinglan-packs':{
  ...scenario('qinglan-packs','qinglan-pass','带着行囊出发','守住城门，也试着留下你选的行囊。',[
   wave('结伴出发','先看入口群怪，再决定哪些材料上场。',18,1.1,2.4,swarm),
   wave('疾风同行','团团与疾风交替，减速或后排接力都能帮忙。',20,1.2,2.8,n=>n%2?'swift':'swarm'),
   wave('长路归来','石甲带着疾风过弯；最后补给也会进入背包。',22,1.3,3.2,mixed),
  ]),
  rewards:[['wood','fire'],['mountain','water'],['wood','water']],
  challengeRule:'行囊只数背包里的基础字核；部署、合成或修门都会用掉它。',
  packGoals:[{id:'fire-mountain',title:'火＋山各留两枚',items:[{kind:'fire',required:2},{kind:'mountain',required:2}]},{id:'wood-water',title:'木＋氵各留三枚',items:[{kind:'wood',required:3},{kind:'water',required:3}]}],
 },
 'qinglan-intercept':scenario('qinglan-intercept','qinglan-pass','入口接力','前段先拦，后段接住漏网的快怪。',[
  wave('结伴入关','团团怪密集进入；前弯可以连续覆盖。',22,.9,3.4,swarm),
  wave('疾步追来','快怪穿过前排；留出后路覆盖。',22,1.2,3.4,n=>n%2?'swift':'swarm'),
  wave('前后接力','石甲带队，快怪跟上；让前后塔分工。',24,1.25,4.0,mixed),
 ]),
 'qinglan-last-bend':scenario('qinglan-last-bend','qinglan-pass','末弯补漏','重击磨掉石甲，末弯接住疾风。',[
  wave('石甲探路','石甲耐打；长弯的覆盖能持续攻击。',18,1.4,3.0,n=>n%3===0?'stone':'swarm'),
  wave('快慢错开','快慢相间，看看谁先走出前排。',24,1.1,3.6,n=>n%4===0?'stone':'swift'),
  wave('最后一弯','留意城门前的空白路段。',26,1.1,4.0,mixed),
 ]),
 'twin-lanes':scenario('twin-lanes','twin-bends','南北分守','两路同时来怪；两边都需要有效覆盖。',[
  wave('两路齐来','北南交替进入；点塔查看每条路的覆盖。',30,.65,4.25,swarm,n=>n%2),
  wave('南快北重','北路石甲，南路疾风。',28,.85,4.5,n=>n%2?'swift':n%4===0?'stone':'swarm',n=>n%2),
  wave('合守城门','两路群怪在后段接近城门。',34,.65,5.0,mixed,n=>n%2),
 ]),
 'twin-relay':scenario('twin-relay','twin-bends','轮换守望','每波压力换边；波间可以调整已部署的塔。',[
  wave('北路先行','这一波北路为主，南路有少量快怪。',28,.8,4.5,n=>n%5===0?'swift':'swarm',n=>n%5===0?1:0),
  wave('南路接棒','现在南路为主；出发前再看塔位。',28,.8,5.0,n=>n%5===0?'swift':mixed(n),n=>n%5===0?0:1),
  wave('南北轮转','两路各有一段密集队伍。',34,.65,5.0,n=>n%7===0?'stone':'swarm',n=>Math.floor(n/8)%2),
 ]),
 'beacon-crowd':scenario('beacon-crowd','beacon-keep','林箭清群','密集来客让多目标箭与范围攻击各显身手。',[
  wave('成群过弯','团团怪挤成队伍，多目标塔可以分箭。',32,.45,5.0,swarm),
  wave('林中快步','群怪里混着疾风，控制能延长覆盖。',34,.5,5.5,n=>n%5===0?'swift':'swarm'),
  wave('护甲穿群','石甲在密集队伍里；重击与清群要分工。',38,.5,5.75,mixed),
 ]),
 'beacon-captain':scenario('beacon-captain','beacon-keep','首领与护卫','长弯消磨首领，同时照顾它身后的护卫。',[
  wave('护卫前行','石甲护卫先到，观察长弯和后路。',22,1,3.6,mixed),
  wave('集结来客','密集护卫经过，准备后排接力。',28,.6,4.0,n=>n%6===0?'stone':'swarm'),
  wave('首领呼援','首领最多呼援两次，每次先预告两秒。',24,.95,2.7,n=>n===0?'captain':n%6===0?'stone':n%3===0?'swift':'swarm'),
 ]),
};
export const SCENARIO_IDS=(Object.keys(SCENARIOS) as ScenarioId[]).sort((a,b)=>Number(!!SCENARIOS[a].challengeRule)-Number(!!SCENARIOS[b].challengeRule));
export const LEGACY_SCENARIO_IDS=SCENARIO_IDS.filter(id=>!SCENARIOS[id].challengeRule);
export const isScenarioId=(value:unknown):value is ScenarioId=>typeof value==='string'&&SCENARIO_IDS.includes(value as ScenarioId);
export const rulesFor=(state:{mapId?:MapId;scenarioId?:ScenarioId;challenge?:ChallengeParameters})=>{
 const base=mapFor(state.mapId),s=state.scenarioId&&SCENARIOS[state.scenarioId];
 const starting=s?.materialPacks?.find(p=>p.id===(state.challenge?.packId??'ember'))?.starting??s?.starting;
 const varied=state.scenarioId==='qinglan-repair'&&state.challenge?.variant===1?starting?.map(c=>c.kind==='grove'?{...c,slot:5}:c):starting;
 return s?{...base,title:s.title,description:s.question,waves:s.waves,starting:varied!,drops:s.drops}:base;
};
