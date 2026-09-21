export const DESK_KEY='chancellor-desk-v1';
export const CONTENT_VERSION='chancellor-desk-2026-09-21-v1';
export type Job='boat-river'|'cart-river'|'cart-mountain';
export const JOBS:Record<Job,string>={'boat-river':'船送河村 · 3袋','cart-river':'车送河村 · 6袋','cart-mountain':'车送山村 · 6袋'};
export interface DeskState {version:1;content:string;warehouse:number;cart:number;boat:number;river:number;mountain:number;bridge:number;repair:boolean;queue:Job[];active:null|{job:Job;step:number};phase:number;log:string[];}
export function freshDesk():DeskState{return{version:1,content:CONTENT_VERSION,warehouse:6,cart:6,boat:0,river:0,mountain:0,bridge:0,repair:false,queue:[],active:null,phase:0,log:[]};}
export const cloneDesk=(s:DeskState):DeskState=>JSON.parse(JSON.stringify(s));
export const totalGrain=(s:DeskState)=>s.warehouse+s.cart+s.boat+s.river+s.mountain;
export const delivered=(s:DeskState)=>s.river===6&&s.mountain===6;
export function validDesk(raw:unknown):raw is DeskState{
 const s=raw as DeskState;if(!s||s.version!==1||s.content!==CONTENT_VERSION)return false;
 if(!['warehouse','cart','boat','river','mountain','bridge','phase'].every(k=>Number.isInteger(s[k as keyof DeskState])&&Number(s[k as keyof DeskState])>=0))return false;
 if(totalGrain(s)!==12||s.cart>6||s.boat>3||s.river>6||s.mountain>6||s.bridge>4)return false;
 if(typeof s.repair!=='boolean'||!Array.isArray(s.queue)||s.queue.length>8||!s.queue.every(j=>Object.hasOwn(JOBS,j))||!Array.isArray(s.log)||!s.log.every(x=>typeof x==='string'&&x.length<160)||s.log.length>100)return false;
 if(s.active!==null&&(!s.active||!Object.hasOwn(JOBS,s.active.job)||!Number.isInteger(s.active.step)||s.active.step<0||s.active.step>3))return false;
 if(s.active){const n=s.active.job==='boat-river'?s.boat:s.cart;if(n!==(s.active.step<3?(s.active.job==='boat-river'?3:6):0))return false;}else if(s.boat!==0)return false;
 return true;
}
export function restoreDesk(raw:unknown):DeskState{return validDesk(raw)?cloneDesk(raw):freshDesk();}
export function obstacle(s:DeskState,j:Job):string{
 if(s.active)return '运输队正在工作。下一张卡会等他们回来。';
 const n=j==='boat-river'?3:6,target=j==='cart-mountain'?'mountain':'river';
 if(s[target]+n>6)return s[target]===6?`${target==='river'?'河村':'山村'}已经够粮了；请移走这张卡或换个目的地。`:`河村还需${6-s.river}袋，这车6袋太多；可移走这张卡，改用船送3袋。`;
 if(j!=='boat-river'&&s.bridge<4)return '桥还没修好。车在桥边等，请给工程队安排修桥。';
 if(j==='boat-river'&&s.warehouse+s.cart<3)return '渡口没有足够的粮食。';
 if(j!=='boat-river'&&s.cart+s.warehouse<6)return '粮仓和车里的粮食不足6袋。';
 return '';
}
export function arrange(s:DeskState,j:Job):DeskState{const n=cloneDesk(s);if(n.queue.length<8)n.queue.push(j);return n;}
export function advanceDesk(input:DeskState):DeskState{
 const s=cloneDesk(input);s.phase++;
 if(s.repair&&s.bridge<4){s.bridge++;if(s.bridge===4){s.repair=false;s.log.push('工程队：桥修好了，可以过车。');}}
 if(s.active){const a=s.active;
  if(a.step===3){s.log.push('运输队：回到起点，可以接下一项。');s.active=null;}
  else{a.step++;if(a.step===3){const boat=a.job==='boat-river',n=boat?s.boat:s.cart;const target=a.job==='cart-mountain'?'mountain':'river';s[target]+=n;if(boat)s.boat=0;else s.cart=0;s.log.push(`运输队：${boat?'船':'车'}把${n}袋送到${target==='river'?'河村':'山村'}。`);}}
 }else if(s.queue.length&&!obstacle(s,s.queue[0])){
  const job=s.queue.shift()!;s.active={job,step:0};
  if(job==='boat-river'){const fromStore=Math.min(3,s.warehouse);s.warehouse-=fromStore;s.cart-=3-fromStore;s.boat=3;}
  else{const load=6-s.cart;s.warehouse-=load;s.cart=6;}
  s.log.push('管粮的人与运输队核对数量：'+JOBS[job]+'，开始装运。');
 }
 if(!validDesk(s))throw Error('Grain or task invariant violated');return s;
}
export function canAdvance(s:DeskState){return !!s.active||(s.repair&&s.bridge<4)||!!(s.queue.length&&!obstacle(s,s.queue[0]));}
