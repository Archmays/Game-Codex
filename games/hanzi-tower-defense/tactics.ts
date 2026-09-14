import { mapFor, type MapId, type Wave, type EnemyKind, type MapDrops } from './maps';
import type { CoreKind } from './content';

export type ScenarioId = 'qinglan-intercept' | 'qinglan-last-bend' | 'twin-lanes' | 'twin-relay' | 'beacon-crowd' | 'beacon-captain';
export interface Scenario {
 id: ScenarioId; mapId: MapId; title: string; question: string; waves: readonly Wave[];
 starting: readonly {kind:CoreKind;slot:number|null}[]; rewards: readonly (readonly CoreKind[])[]; drops: MapDrops;
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
export const SCENARIO_IDS=Object.keys(SCENARIOS) as ScenarioId[];
export const isScenarioId=(value:unknown):value is ScenarioId=>typeof value==='string'&&SCENARIO_IDS.includes(value as ScenarioId);
export const rulesFor=(state:{mapId?:MapId;scenarioId?:ScenarioId})=>{
 const base=mapFor(state.mapId),s=state.scenarioId&&SCENARIOS[state.scenarioId];
 return s?{...base,title:s.title,description:s.question,waves:s.waves,starting:s.starting,drops:s.drops}:base;
};
