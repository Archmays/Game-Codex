export const FROZEN_IDS=['anna','olaf','kristoff','sven','arendelle_castle','town_houses','town_lanterns','snow_pines','sleigh','forest_lantern','palace_steps','palace_column_left','palace_column_right','palace_gate','palace_spire','palace_chandelier'] as const;
export type FrozenPiece=typeof FROZEN_IDS[number];
export const FROZEN_LABELS:Record<FrozenPiece,string>={anna:'安娜',olaf:'雪宝',kristoff:'克里斯托夫',sven:'斯文',arendelle_castle:'阿伦黛尔城堡',town_houses:'彩色小屋',town_lanterns:'城镇灯柱',snow_pines:'覆雪松树',sleigh:'雪橇',forest_lantern:'雪林灯架',palace_steps:'冰晶台阶',palace_column_left:'左冰柱',palace_column_right:'右冰柱',palace_gate:'冰宫双扇门',palace_spire:'中央尖塔',palace_chandelier:'冰晶吊灯'};
export const GROUPS=['伙伴','城镇','雪林','冰宫'] as const;
export const frozenGroup=(id:FrozenPiece)=>{const n=FROZEN_IDS.indexOf(id);return n<4?0:n<7?1:n<10?2:3;};
export const FROZEN_KEY='frozen-elsa-playground-v1';
export interface FrozenState{schemaVersion:1;placed:FrozenPiece[];help:boolean;bridge:boolean;rink:boolean}
export const freshFrozen=():FrozenState=>({schemaVersion:1,placed:[],help:false,bridge:false,rink:false});
export function restoreFrozen(raw:unknown):FrozenState{const s=raw as Partial<FrozenState>|null;if(s?.schemaVersion!==1)return freshFrozen();return{schemaVersion:1,placed:FROZEN_IDS.filter(id=>Array.isArray(s.placed)&&s.placed.includes(id)),help:s.help===true,bridge:s.bridge===true,rink:s.rink===true};}
export type Phase='off'|'growing'|'ready'|'clearing';
export type Magic='bridge'|'rink'|'snow';
export interface FrozenMotion{
 revision:number;paused:boolean;elsaTrip:number;bridge:Phase;rink:Phase;bridgeAmount:number;rinkAmount:number;snow:number;
 cast:Magic|null;castTime:number;ride:{route:'lake'|'palace';t:number;destination:number;running:boolean;blocked:boolean;speed:number;anna:boolean;direction:number};
 skate:{pattern:'circle'|'eight'|null;t:number;exiting:boolean;entry:number};
 follow:boolean;door:boolean;chandelier:number;wave:number;bridgeWalk:number;bridgeWalkRunning:boolean;
 pending:{kind:'bridge'|'rink'|'undo';id?:FrozenPiece;revision:number}|null;
}
export function freshFrozenMotion(s:FrozenState,revision=0):FrozenMotion{return{revision,paused:false,elsaTrip:0,bridge:s.bridge?'ready':'off',rink:s.rink?'ready':'off',bridgeAmount:s.bridge?1:0,rinkAmount:s.rink?1:0,snow:0,cast:null,castTime:0,ride:{route:'lake',t:0,destination:0,running:false,blocked:false,speed:0,anna:false,direction:1},skate:{pattern:null,t:0,exiting:false,entry:0},follow:false,door:false,chandelier:0,wave:0,bridgeWalk:0,bridgeWalkRunning:false,pending:null};}
export const rideMissing=(s:FrozenState)=>FROZEN_IDS.filter(id=>['sven','sleigh','kristoff'].includes(id)&&!s.placed.includes(id));
// Clearance includes the deer ahead and the whole sleigh, not just its root.
export const BRIDGE_CLEARANCE=[.22,.94] as const;
export const onBridge=(m:FrozenMotion)=>m.ride.route==='palace'&&m.ride.t>BRIDGE_CLEARANCE[0]&&m.ride.t<BRIDGE_CLEARANCE[1];
export function assemble(s:FrozenState,id:FrozenPiece,slot:FrozenPiece){const pillars=id.startsWith('palace_column_')&&slot.startsWith('palace_column_');if(s.placed.includes(slot)||(!pillars&&id!==slot))return false;s.placed.push(slot);return true;}
export function magic(s:FrozenState,m:FrozenMotion,kind:Magic):string{
 if(m.pending)return '正在安全停靠，稍等一下。';
 if(kind==='snow'&&m.snow>0){m.snow=0;if(m.cast==='snow')m.cast=null;return '飘雪停下了。';}
 if(m.cast)return '艾莎正在施法，可以继续观察。';
 if(kind==='bridge'&&m.bridge==='ready'){
  if(onBridge(m)||m.bridgeWalk>0||m.elsaTrip>0){m.pending={kind:'bridge',revision:m.revision};m.ride.destination=m.ride.t<.555?BRIDGE_CLEARANCE[0]:BRIDGE_CLEARANCE[1];m.ride.running=onBridge(m);m.bridgeWalkRunning=false;return '先到平台，再收起。';}
  m.bridge='clearing';return '冰桥正在收起。';
 }
 if(kind==='rink'&&m.rink==='ready'){
  if(m.skate.pattern||m.skate.entry>0){m.pending={kind:'rink',revision:m.revision};m.skate.exiting=true;return '雪宝先到场边，再收起。';}
  m.rink='clearing';return '冰场正在收起。';
 }
 if(kind!=='snow'&&m[kind]!=='off')return '魔法正在变化。';
 m.cast=kind;m.castTime=0;if(kind==='snow')m.snow=10;else m[kind]='growing';return '艾莎收到啦！';
}
export function startRide(s:FrozenState,m:FrozenMotion,route:'lake'|'palace'):boolean{if(rideMissing(s).length||m.pending||route==='palace'&&m.bridgeWalk>0)return false;if(m.ride.t!==0&&route!==m.ride.route)return false;m.ride.route=route;m.ride.destination=1;m.ride.running=m.ride.t!==1;m.ride.blocked=false;return true;}
export function startSkate(s:FrozenState,m:FrozenMotion,pattern:'circle'|'eight'){if(!s.placed.includes('olaf')||m.rink!=='ready'||m.pending||m.bridgeWalk>0)return false;m.skate.pattern=pattern;m.skate.exiting=false;return true;}
export function undoFrozen(s:FrozenState,m:FrozenMotion,id:FrozenPiece){
 m.revision++;m.pending=null;
 if(['sleigh','sven','kristoff','anna'].includes(id)&&m.ride.t>0){m.pending={kind:'undo',id,revision:m.revision};m.ride.destination=0;m.ride.running=true;return false;}
 if(id==='olaf'&&(m.skate.entry>0||m.bridgeWalk>0)){m.pending={kind:'undo',id,revision:m.revision};m.skate.exiting=true;m.bridgeWalkRunning=false;return false;}
 removeFrozen(s,m,id);return true;
}
function removeFrozen(s:FrozenState,m:FrozenMotion,id:FrozenPiece){s.placed=s.placed.filter(p=>p!==id);if(['sleigh','sven','kristoff','anna'].includes(id)){m.ride={...freshFrozenMotion(s).ride};m.follow=false;}if(id==='olaf'){m.skate={pattern:null,t:0,exiting:false,entry:0};m.wave=0;}if(id==='palace_gate')m.door=false;if(id==='palace_chandelier')m.chandelier=0;}
const approach=(x:number,to:number,amount:number)=>x+Math.sign(to-x)*Math.min(Math.abs(to-x),amount);
export function stepFrozen(s:FrozenState,m:FrozenMotion,dt:number){
 if(m.paused)return;dt=Math.min(.05,Math.max(0,dt));m.snow=Math.max(0,m.snow-dt);m.wave=Math.max(0,m.wave-dt);m.chandelier=Math.max(0,m.chandelier-dt);
 if(m.cast){m.castTime+=dt;if(m.castTime>=2.8)m.cast=null;}
 for(const k of ['bridge','rink'] as const){const amount=k==='bridge'?'bridgeAmount':'rinkAmount';if(m[k]==='growing'&&m.castTime>.65){m[amount]=approach(m[amount],1,dt/2);if(m[amount]===1){m[k]='ready';s[k]=true;if(m.cast===k)m.cast=null;}}if(m[k]==='clearing'){m[amount]=approach(m[amount],0,dt/1.5);if(m[amount]===0){m[k]='off';s[k]=false;}}}
 const r=m.ride;
 if(!m.cast&&m.bridge==='ready'){const meeting=!m.pending&&!r.running&&r.route==='palace'&&r.t===1&&r.anna;m.elsaTrip=approach(m.elsaTrip,meeting?1:0,dt*.065);}
 const occupied=r.route==='palace'&&(m.bridgeWalk>0||m.elsaTrip>0&&m.elsaTrip<1);
 if(r.running&&!occupied){const dir=Math.sign(r.destination-r.t);r.direction=dir||r.direction;r.speed=approach(r.speed,Math.min(.075,.015+Math.abs(r.destination-r.t)*1.4),dt*.13);let next=approach(r.t,r.destination,dt*r.speed);
  if(r.route==='palace'&&m.bridge!=='ready'){const [low,high]=BRIDGE_CLEARANCE;if(dir>0&&r.t<=low&&next>low)next=low;if(dir<0&&r.t>=high&&next<high)next=high;if(next===low||next===high){r.blocked=true;r.running=false;}}
  r.t=next;if(r.t===r.destination){r.running=false;r.speed=0;}
 }else r.speed=0;
 const sk=m.skate;if(sk.pattern||sk.entry>0){sk.entry=approach(sk.entry,sk.exiting?0:1,dt*.55);if(!sk.exiting)sk.t+=dt*.6;if(sk.exiting&&sk.entry===0){sk.pattern=null;sk.exiting=false;sk.t=0;}}
 if(m.bridgeWalkRunning&&m.bridge==='ready')m.bridgeWalk=Math.min(1,m.bridgeWalk+dt*.13);else if(m.bridgeWalk>0)m.bridgeWalk=Math.max(0,m.bridgeWalk-dt*.13);
 const p=m.pending;if(p&&p.revision===m.revision){const rideSafe=!r.running&&!onBridge(m),olafSafe=sk.entry===0&&m.bridgeWalk===0;
  if(p.kind==='bridge'&&rideSafe&&m.bridgeWalk===0&&m.elsaTrip===0){m.bridge='clearing';m.pending=null;}
  if(p.kind==='rink'&&olafSafe){m.rink='clearing';m.pending=null;}
  if(p.kind==='undo'&&p.id&&(p.id==='olaf'?olafSafe:r.t===0)){removeFrozen(s,m,p.id);m.pending=null;}
 }
}
