import type { GrantId } from "./resonance";
import type { CoreKind } from "./content";
export interface Point { x: number; y: number; }
export type MapId = "qinglan-pass" | "twin-bends" | "beacon-keep";
export type EnemyKind = "swarm" | "swift" | "stone" | "captain";
export interface Wave { label: string; hint: string; foes: readonly EnemyKind[]; interval: number; strength: number; lanes?: readonly number[]; }
export const PATH: readonly Point[] = [{ x: -25, y: 115 }, { x: 255, y: 115 }, { x: 255, y: 395 }, { x: 505, y: 395 }, { x: 505, y: 170 }, { x: 750, y: 170 }, { x: 750, y: 480 }, { x: 870, y: 435 }];
export const SLOTS = [
  { x: 150, y: 220, name: "入口弯内" }, { x: 365, y: 250, name: "双弯中心" },
  { x: 390, y: 455, name: "下弯回射" }, { x: 620, y: 300, name: "三路交汇" },
  { x: 630, y: 80, name: "上路远射" }, { x: 825, y: 205, name: "后路侧翼" },
  { x: 640, y: 430, name: "末弯内侧" }, { x: 870, y: 355, name: "城门守卫" },
] as const;
const ORIGINAL_WAVES: readonly { label: string; hint: string; foes: readonly EnemyKind[]; interval: number; strength: number }[] = [
  { label: "林口来客", hint: "团团怪结伴而来，弯道能多打几下。", foes: Array(12).fill("swarm"), interval: 2.3, strength: 1 },
  { label: "风中的脚步", hint: "疾风怪跑得快，试试氵的减速。", foes: ["swarm", "swift", "swarm", "swarm", "swift", "swarm", "swift", "swarm", "swarm", "swift", "swarm", "swarm", "swift", "swarm", "swarm", "swift"], interval: 2.0, strength: 1.2 },
  { label: "石头的回声", hint: "石甲怪走得慢、耐打，让重击塔覆盖长弯。", foes: ["stone", "swarm", "swarm", "swift", "stone", "swarm", "swarm", "swift", "stone", "swarm", "swarm", "swift", "stone", "swarm", "swift", "swarm", "stone", "swarm"], interval: 1.9, strength: 1.3 },
  { label: "成群穿林", hint: "一大群挤在路上，范围攻击能同时击中它们。", foes: Array.from({ length: 24 }, (_, i) => i % 8 === 0 ? "stone" : i % 5 === 0 ? "swift" : "swarm"), interval: 1.45, strength: 1.5 },
  { label: "两面来风", hint: "快慢混合，前路清群，后路接住疾风怪。", foes: Array.from({ length: 24 }, (_, i) => i % 5 === 0 ? "stone" : i % 2 === 0 ? "swift" : "swarm"), interval: 1.55, strength: 1.8 },
  { label: "守住最后一弯", hint: "最后一波！先部署好，再打开城外的路。", foes: Array.from({ length: 28 }, (_, i) => i % 4 === 0 ? "stone" : i % 3 === 0 ? "swift" : "swarm"), interval: 1.55, strength: 2.1 },
];

export interface MapDrops { baseKinds: readonly CoreKind[]; milestones: readonly number[]; english: readonly {grantId:GrantId;wave:number;kill:number}[]; }
export interface DefenseMap { id: MapId; title: string; description: string; paths: readonly (readonly Point[])[]; slots: readonly {x:number;y:number;name:string}[]; waves: readonly Wave[]; starting: readonly {kind:CoreKind;slot:number|null}[]; drops: MapDrops; expanded: boolean; }
const originalStart = [{kind:"fire",slot:0},{kind:"fire",slot:null},{kind:"wood",slot:null},{kind:"wood",slot:null},{kind:"water",slot:null},{kind:"mountain",slot:null}] as const;
const extendedStart = [...originalStart, {kind:"wood",slot:null},{kind:"wood",slot:null},{kind:"wood",slot:null},{kind:"mountain",slot:null},{kind:"fire",slot:null},{kind:"water",slot:null}] as const;
const dualPaths = [
 [{x:-25,y:125},{x:285,y:125},{x:285,y:285},{x:585,y:285},{x:585,y:130},{x:790,y:130},{x:790,y:400},{x:870,y:435}],
 [{x:-25,y:515},{x:220,y:515},{x:220,y:375},{x:500,y:375},{x:500,y:535},{x:710,y:535},{x:710,y:430},{x:870,y:435}],
] as const;
const dualSlots=[{x:165,y:225,name:"北路入口"},{x:170,y:410,name:"南路入口"},{x:390,y:200,name:"北弯回射"},{x:390,y:480,name:"南弯回射"},{x:550,y:365,name:"两路交接"},{x:690,y:225,name:"北路后援"},{x:630,y:510,name:"南路后援"},{x:875,y:300,name:"城门前沿"}] as const;
const bossPaths=[[{x:-25,y:145},{x:320,y:145},{x:320,y:440},{x:535,y:440},{x:535,y:245},{x:770,y:245},{x:770,y:510},{x:870,y:435}]] as const;
const bossSlots=[{x:170,y:250,name:"前哨长射"},{x:420,y:265,name:"中央双弯"},{x:210,y:490,name:"下弯侧翼"},{x:420,y:530,name:"回弯内侧"},{x:635,y:355,name:"烽台交点"},{x:660,y:145,name:"高处远射"},{x:885,y:360,name:"首领截击"},{x:680,y:535,name:"城门侧翼"}] as const;
function extendedWaves(boss:boolean): Wave[] {
 return Array.from({length:8},(_,i)=>({
  label:(boss?["烽台来客","疾步过桥","护甲回声","林箭列阵","前后夹击","重甲队列","守门准备","烽台首领"]:["分守两路","南北疾风","两弯石甲","林箭分流","交接之处","快慢相间","双路压境","合守城门"])[i],
  hint:boss?(i===7?"首领只呼援两次：先亮起预告，再从它身后出现两只团团怪。预留多目标塔照顾援兵。":"长弯可以持续攻击；前排清群，后排接住疾风怪。"):"南北两路轮流来怪。两路都要有覆盖，中间塔位能照顾交接处。",
  foes: boss&&i===7?["captain",...Array.from({length:18},(_,n)=>n%5===0?"stone" as const:n%3===0?"swift" as const:"swarm" as const)]:Array.from({length:14+i*2},(_,n)=>i>1&&n%6===0?"stone" as const:i>0&&n%3===0?"swift" as const:"swarm" as const),
  interval: i<3?1.7:1.35, strength:1+i*.20,
  ...(!boss?{lanes:Array.from({length:14+i*2},(_,n)=>(n+i)%2)}:{}),
 }));
}
// A map owns its drop contract. These initial policies deliberately retain the original Chinese RNG and milestones.
const baseDrops={baseKinds:["fire","wood","water","mountain"] as const,milestones:[1,3,5,8,11] as const};
const originalEnglish=[{grantId:"wave-2-volcano",wave:1,kill:3},{grantId:"wave-4-mountain-forest",wave:3,kill:3}] as const;
const expandedEnglish=[...originalEnglish,{grantId:"wave-3-forest",wave:2,kill:3}] as const;
export const DEFENSE_MAPS: Readonly<Record<MapId, DefenseMap>> = {
 "qinglan-pass":{id:"qinglan-pass",title:"青岚关",description:"一条弯路 · 原六波",paths:[PATH],slots:SLOTS,waves:ORIGINAL_WAVES,starting:originalStart,drops:{...baseDrops,english:originalEnglish},expanded:false},
 "twin-bends":{id:"twin-bends",title:"双岔湾",description:"南北两路 · 八波 · 分配覆盖",paths:dualPaths,slots:dualSlots,waves:extendedWaves(false),starting:extendedStart,drops:{...baseDrops,english:[...expandedEnglish]},expanded:true},
 "beacon-keep":{id:"beacon-keep",title:"烽台关",description:"长弯守门 · 八波 · 首领呼援",paths:bossPaths,slots:bossSlots,waves:extendedWaves(true),starting:extendedStart,drops:{...baseDrops,english:[...expandedEnglish]},expanded:true},
};
export const MAP_IDS=Object.keys(DEFENSE_MAPS) as MapId[];
export const isMapId=(value:unknown):value is MapId=>typeof value==='string'&&MAP_IDS.includes(value as MapId);
export const mapFor=(id:MapId|undefined):DefenseMap=>DEFENSE_MAPS[id??"qinglan-pass"];
export const pathLength=(path:readonly Point[])=>path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
