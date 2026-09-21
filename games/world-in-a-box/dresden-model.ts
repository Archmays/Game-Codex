export const CITY_IDS=['augustus_bridge','paddle_steamer','yellow_tram','river_pier','riverside_trees','frauenkirche_body','frauenkirche_dome','semperoper','zwinger_galleries','zwinger_crown_gate','beyer_body','beyer_tower','slub_surface','slub_skylight','campus_bikes','street_houses','bakery_front','bench_scene'] as const;
export type CityPiece=typeof CITY_IDS[number];
export type Region='river'|'oldtown'|'campus'|'street';
export const REGIONS:Record<Region,string>={river:'河边',oldtown:'老城',campus:'校园',street:'街区'};
export const CITY_LABELS:Record<CityPiece,string>={augustus_bridge:'奥古斯都桥',paddle_steamer:'轮桨船',yellow_tram:'黄色电车',river_pier:'码头',riverside_trees:'河岸树组',frauenkirche_body:'圣母教堂主体',frauenkirche_dome:'圣母教堂圆顶',semperoper:'森帕歌剧院',zwinger_galleries:'茨温格庭院长廊',zwinger_crown_gate:'冠门',beyer_body:'贝耶尔楼主体',beyer_tower:'贝耶尔楼观测塔',slub_surface:'SLUB地面建筑组',slub_skylight:'中央采光顶',campus_bikes:'校园自行车架',street_houses:'街屋组',bakery_front:'面包店门面',bench_scene:'长椅小景'};
export const regionOf=(id:CityPiece):Region=>{const n=CITY_IDS.indexOf(id);return n<5?'river':n<10?'oldtown':n<15?'campus':'street';};
export const CITY_KEY='dresden-river-campus-v2';
export interface CityState{schemaVersion:2;placed:CityPiece[];help:boolean;muted:boolean;night:boolean}
export const freshCity=():CityState=>({schemaVersion:2,placed:[],help:false,muted:false,night:false});
export function restoreCity(raw:unknown):CityState{
  if(!raw||typeof raw!=='object'||(raw as CityState).schemaVersion!==2)return freshCity();
  const s=raw as CityState;return{schemaVersion:2,placed:CITY_IDS.filter(id=>Array.isArray(s.placed)&&s.placed.includes(id)),help:s.help===true,muted:s.muted===true,night:s.night===true};
}
export function placeCity(s:CityState,piece:CityPiece,slot:CityPiece):CityState{return piece!==slot||s.placed.includes(slot)?s:{...s,placed:[...s.placed,slot]};}
export const canSection=(s:CityState)=>s.placed.includes('slub_surface')&&s.placed.includes('slub_skylight');
export interface Ride{position:number;destination:number;running:boolean;blocked:boolean;direction:number;speed:number}
export interface CityMotion{tram:Ride;boat:Ride;boatNorth:number;boatSpeed:number;dock:boolean;section:boolean;follow:'tram'|'boat'|null}
export interface Routes{tramStart:number;tramStops:Record<'north'|'oldtown'|'campus',number>;bridge:[number,number];boatStart:number;boatEnd:number;berth:{x:number;north:number}}
export const freshMotion=(r:Routes):CityMotion=>({tram:{position:r.tramStart,destination:r.tramStart,running:false,blocked:false,direction:1,speed:0},boat:{position:r.boatStart,destination:r.boatEnd,running:false,blocked:false,direction:1,speed:0},boatNorth:4,boatSpeed:0,dock:false,section:false,follow:null});
export function moveRide(ride:Ride,dt:number,speed:number,barrier?:[number,number]):Ride{
  if(!ride.running)return ride.speed?{...ride,speed:0}:ride;
  const delta=ride.destination-ride.position,dir=Math.sign(delta),next=ride.position+dir*Math.min(Math.abs(delta),Math.min(.05,Math.max(0,dt))*speed);
  if(barrier){const [low,high]=barrier;if(dir>0&&ride.position<=low&&next>=low)return{...ride,position:low,running:false,blocked:true,speed:0,direction:dir};if(dir<0&&ride.position>=high&&next<=high)return{...ride,position:high,running:false,blocked:true,speed:0,direction:dir};}
  return{...ride,position:next,running:next!==ride.destination,blocked:false,direction:dir||ride.direction,speed:dt>0?Math.abs(next-ride.position)/Math.min(.05,dt):0};
}
export function stepMotion(m:CityMotion,s:CityState,r:Routes,dt:number):CityMotion{
  dt=Math.min(.05,Math.max(0,dt));
  const tram=s.placed.includes('yellow_tram')?moveRide(m.tram,dt,1.7,s.placed.includes('augustus_bridge')?undefined:r.bridge):{...m.tram,running:false,speed:0};
  let boat={...m.boat,speed:0},north=m.boatNorth;
  if(s.placed.includes('paddle_steamer')&&boat.running&&dt>0){
    // Leave the bank sideways first; approach it only after longitudinal alignment.
    if(!m.dock&&north!==4)north+=Math.sign(4-north)*Math.min(Math.abs(4-north),dt*.55);
    else if(m.dock&&Math.abs(boat.position-r.berth.x)<.001){boat.position=r.berth.x;north+=Math.sign(r.berth.north-north)*Math.min(Math.abs(r.berth.north-north),dt*.45);boat.running=north!==r.berth.north;}
    else{boat=moveRide(boat,dt,Math.min(1.8,.3+Math.abs(boat.destination-boat.position)*1.7));if(m.dock&&boat.position===boat.destination)boat.running=true;}
  }else if(!s.placed.includes('paddle_steamer'))boat.running=false;
  return{...m,tram,boat,boatNorth:north,boatSpeed:dt>0?Math.hypot(boat.position-m.boat.position,north-m.boatNorth)/dt:0};
}
export function removeCity(s:CityState,m:CityMotion,id:CityPiece,r:Routes){
  const next={...s,placed:s.placed.filter(p=>p!==id)},motion={...m,tram:{...m.tram},boat:{...m.boat}};let bridgeReset=false;
  if(id==='augustus_bridge'&&motion.tram.position>r.bridge[0]&&motion.tram.position<r.bridge[1]){motion.tram={...freshMotion(r).tram};bridgeReset=true;}
  if(id==='yellow_tram')motion.tram={...freshMotion(r).tram};
  if(id==='paddle_steamer'){motion.boat={...freshMotion(r).boat};motion.boatNorth=4;motion.boatSpeed=0;motion.dock=false;}
  if(id==='river_pier'){if(motion.dock){motion.boat={...freshMotion(r).boat};motion.boatNorth=4;motion.boatSpeed=0;}motion.dock=false;}
  if(!canSection(next))motion.section=false;
  if((id==='yellow_tram'&&motion.follow==='tram')||(id==='paddle_steamer'&&motion.follow==='boat'))motion.follow=null;
  return{state:next,motion,bridgeReset};
}
export function clockParts(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('zh-CN',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const value=(type:string)=>parts.find(p=>p.type===type)!.value;const hour=+value('hour'),minute=+value('minute'),second=+value('second');
  return{text:`${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}`,hourAngle:(hour%12+minute/60+second/3600)*30,minuteAngle:(minute+second/60)*6};
}
