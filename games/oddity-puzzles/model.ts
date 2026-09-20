import layouts from './layout.json';
export type Vec = [number,number,number];
export type ActorId = 'a'|'b'|'npc';
export type Ability = 'ring'|'lamp'|'photo'|'camera'|'key';
export interface Wall {id:string;label:string;center:Vec;size:Vec;glass:boolean;gate:string|null}
export interface Item {id:string;label:string;p:Vec;size:Vec;holder:ActorId|null;fixed?:boolean;magic?:boolean}
export interface Layout {id:number;title:string;goal:string;abilities:Ability[];walls:Wall[];props:Wall[];anchors:Record<string,Vec>;nodes:{id:string;label:string;p:Vec}[];edges:string[][];objects:Item[];slot?:Vec;tray?:Vec}
export const LEVELS=layouts as unknown as Layout[];
export interface Actor {id:ActorId;label:string;node:string;inside:boolean;holding:string|null}
export interface State {level:number;active:ActorId;actors:Actor[];items:Item[];lamp:number;doorRestored:boolean;portal:boolean;latched:boolean;photo:ActorId|null;won:boolean}
export interface Motion {id:string;path:Vec[];kind:'walk'|'carry'|'portal'|'capture'|'release'|'turn'|'restore'}
export type Action = {type:'move';node:string;actor?:ActorId}|{type:'ring';target:string;node?:string;direction?:number}|{type:'lamp';direction:number}|{type:'take'|'drop';item:string;actor?:ActorId}|{type:'give';item:string;to:ActorId}|{type:'capture';target:ActorId}|{type:'release';node:string;actor?:ActorId}|{type:'restore'}|{type:'portal'}|{type:'cross'}|{type:'hold';switch:string;actor?:ActorId}|{type:'switch';actor:ActorId};
export interface Outcome {state:State;error?:string;motions:Motion[];sound?:string}
export const clone=<T>(v:T):T=>structuredClone(v);
export const distance=(a:Vec,b:Vec)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export const add=(p:Vec,v:Vec):Vec=>p.map((x,i)=>x+v[i]) as Vec;
export function initial(level:number):State {const l=LEVELS[level-1];return {level,active:'a',actors:level===3?[{id:'a',label:'蓝衣调查员',node:'outside',inside:false,holding:null},{id:'b',label:'橙衣调查员',node:'friend',inside:false,holding:null},{id:'npc',label:'绿衣接应员',node:'tray',inside:false,holding:null}]:[{id:'a',label:'调查员',node:level===1?'exit':'start',inside:false,holding:null}],items:clone(l.objects),lamp:0,doorRestored:false,portal:false,latched:false,photo:null,won:false};}
export const layout=(s:State)=>LEVELS[s.level-1];
export const actor=(s:State,id=s.active)=>s.actors.find(a=>a.id===id)!;
export const point=(s:State,node:string):Vec=>clone(layout(s).nodes.find(n=>n.id===node)!.p);
export const feet=(s:State,id=s.active)=>point(s,actor(s,id).node);
export const eye=(s:State,id=s.active)=>add(feet(s,id),layout(s).anchors.eye);
export const item=(s:State,id:string)=>s.items.find(o=>o.id===id)!;
export function position(s:State,id:string):Vec {const a=s.actors.find(a=>a.id===id);if(a)return add(feet(s,a.id),[0,.85,0]);const o=item(s,id);return o.holder?add(feet(s,o.holder),layout(s).anchors.hand):o.p;}
export function walls(s:State){return [...layout(s).walls,...layout(s).props].filter(w=>!(w.gate==='lamp'&&s.lamp===1)&&!(w.gate==='latch'&&s.latched)&&!(w.gate==='door'&&s.portal));}
// Slab intersection, shared by visibility and swept-volume collision. Camera picking is separate.
export function intersects(a:Vec,b:Vec,w:Wall,half:Vec=[0,0,0]):boolean {let near=0,far=1;for(let i=0;i<3;i++){const lo=w.center[i]-w.size[i]/2-half[i],hi=w.center[i]+w.size[i]/2+half[i],d=b[i]-a[i];if(Math.abs(d)<1e-8){if(a[i]<lo||a[i]>hi)return false;}else{const t1=(lo-a[i])/d,t2=(hi-a[i])/d;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)return false;}}return true;}
export function sight(s:State,to:Vec,id=s.active):string|null {const from=eye(s,id);const w=walls(s).find(w=>!w.glass&&intersects(from,to,w));return w?`视线被${w.label}挡住了。`:distance(from,to)>10?'太远了，请走近一些。':null;}
export function space(s:State,a:Vec,b:Vec,half:Vec):string|null {const w=walls(s).find(w=>intersects(a,b,w,half));return w?`${w.label}挡住了路径，物件不能穿过去。`:null;}
export function route(s:State,from:string,to:string,person=true):Vec[]|null {const queue=[from],prev=new Map<string,string>();prev.set(from,'');while(queue.length){const n=queue.shift()!;if(n===to){const ids=[to];while(ids[0]!==from)ids.unshift(prev.get(ids[0])!);return ids.map(id=>point(s,id));}for(const edge of layout(s).edges){if(!edge.includes(n))continue;const next=edge.find(id=>id!==n)!;if(prev.has(next))continue;const a=point(s,n),b=point(s,next);if(space(s,add(a,[0,.85,0]),add(b,[0,.85,0]),person?[.26,.84,.26]:[.15,.15,.15]))continue;prev.set(next,n);queue.push(next);}}return null;}
function occupied(s:State,node:string,except?:ActorId){return s.actors.some(a=>a.id!==except&&!a.inside&&distance(feet(s,a.id),point(s,node))<.53);}
/** Explain an actual blocked frontier of the existing route graph, without inventing a route. */
export function routeObstacle(s:State,from:string,to:string):{label:string;p:Vec}|null {
 if(route(s,from,to))return null;
 const reachable=new Set(layout(s).nodes.filter(n=>route(s,from,n.id)).map(n=>n.id));
 const edges=layout(s).edges.flatMap(edge=>{const a=edge.find(n=>reachable.has(n)),b=edge.find(n=>!reachable.has(n));return a&&b?[{a,b}]:[];}).sort((a,b)=>distance(point(s,a.b),point(s,to))-distance(point(s,b.b),point(s,to)));
 for(const {a,b}of edges){const obstacle=walls(s).find(w=>intersects(add(point(s,a),[0,.85,0]),add(point(s,b),[0,.85,0]),w,[.26,.84,.26]));if(obstacle)return {label:obstacle.label,p:clone(obstacle.center)};}
 return s.level===2?{label:'断开的走廊',p:[0,0,-2.6]}:null;
}
function near(s:State,p:Vec,id=s.active){const f=feet(s,id);return Math.hypot(f[0]-p[0],f[2]-p[2])<=1.15&&Math.abs(p[1]-1)<1.4&&!space(s,add(f,[0,1,0]),p,[.04,.04,.04]);}
export function apply(source:State,action:Action,disabled:Ability[]=[]):Outcome {
 const s=clone(source),motions:Motion[]=[];let sound='place';const fail=(error:string):Outcome=>({state:source,error,motions:[]});
 const id='actor'in action&&action.actor?action.actor:s.active;const who=actor(s,id);if(!who)return fail('这里没有这位同伴。');if(who.inside)return fail('照片里的人不能行动，请外面的人拿起照片释放。');
 const capability=(key:Ability,by:ActorId=id)=>!disabled.includes(key)&&!!s.items.find(o=>o.id===key&&(o.holder===by||key==='lamp'));
 const finish=():Outcome=>{const holds=s.actors.filter(a=>!a.inside&&a.holding);if(new Set(holds.map(a=>a.holding)).size===2)s.latched=true;
 s.won=s.level===1?actor(s,'a').node==='exit'&&item(s,'box').holder==='a':s.level===2?actor(s,'a').node==='safe':s.latched&&s.actors.every(a=>!a.inside&&a.node==='exit');return {state:s,motions,sound};};
 if(action.type==='switch'){if(action.actor==='npc')return fail('接应员按你的请求帮忙，不需要切换控制。');if(s.active===id)return fail('已经在控制这位调查员。');s.active=id;return finish();}
 if(action.type==='move'){
  if(!layout(s).nodes.some(n=>n.id===action.node))return fail('那里没有落脚点。');if(who.node===action.node)return fail('已经在这里了。');const path=route(s,who.node,action.node);if(!path){const obstacle=routeObstacle(s,who.node,action.node);return fail(`${obstacle?.label??'墙'}挡住了道路。${s.level===1?'观察灯光照在哪里。':s.level===3?'人物身体穿不过高处的窄投递口。':'需要另一条安全通道。'}`);}
  if(action.node!=='exit'&&occupied(s,action.node,id))return fail('那里有同伴，请换一块空地。');who.node=action.node;who.holding=null;motions.push({id,path,kind:'walk'});return finish();
 }
 if(action.type==='lamp'||action.type==='ring'&&action.target==='lamp'){
  if(!capability('lamp'))return fail('这次台灯的能力不可用。');if(action.type==='ring'){if(!capability('ring'))return fail('扳指不在这位调查员手上。');const block=sight(s,position(s,'lamp'),id);if(block)return fail(block);}else if(!near(s,position(s,'lamp'),id))return fail('够不到台灯，请走到灯座旁。');
  const direction=action.direction??1;if(direction<0||direction>2)return fail('只有三个转向档位。');if(direction===s.lamp)return fail('台灯已经朝向这里。');s.lamp=direction;motions.push({id:'lamp',path:[],kind:'turn'});sound='light';return finish();
 }
 if(action.type==='take'){
  const o=item(s,action.item);if(!o)return fail('这里没有这件物品。');if(o.fixed)return fail('它固定在这里，不能整个拿走。');if(o.holder)return fail(o.holder===id?'已经拿着它了。':'物品在同伴手上，请靠近交接。');if(!near(s,o.p,id))return fail('手够不到，请先走近物品。');const p=clone(o.p);o.holder=id;motions.push({id:o.id,path:[p,position(s,o.id)],kind:'carry'});return finish();
 }
 if(action.type==='drop'){
  const o=item(s,action.item);if(!o||o.holder!==id)return fail('这位同伴没有拿着它。');const p=position(s,o.id);o.holder=null;o.p=s.level===3&&near(s,layout(s).tray!,id)?clone(layout(s).tray!):add(feet(s,id),[.4,.12,0]);if(space(s,o.p,o.p,o.size.map(v=>v/2) as Vec))return fail('这里放不下，请换一块空地。');motions.push({id:o.id,path:[p,o.p],kind:'carry'});return finish();
 }
 if(action.type==='give'){
  const o=item(s,action.item),other=actor(s,action.to);if(!o||o.holder!==id)return fail('物品不在你手里。');if(!other||other.inside||other.id===id||!near(s,position(s,other.id),id))return fail('请走到外面的同伴身边交接。');o.holder=other.id;return finish();
 }
 if(action.type==='capture'){
  if(!capability('photo'))return fail('先实际拿起照片，才能收纳同伴。');if(s.photo)return fail('照片里已经有一人，装不下第二人。');const target=actor(s,action.target);if(!target||target.inside)return fail('这位同伴不在外面。');if(target.id===id)return fail('不能把自己收入自己拿着的照片。');if(!near(s,position(s,target.id),id))return fail('需要拿照片的人接触同伴，请先靠近。');
  for(const o of s.items.filter(o=>o.holder===target.id)){o.holder=null;o.p=add(feet(s,target.id),[.35,.12,0]);}target.inside=true;target.holding=null;s.photo=target.id;if(s.active===target.id)s.active=s.actors.find(a=>a.id!=='npc'&&!a.inside)!.id;motions.push({id:target.id,path:[position(s,target.id),position(s,'photo')],kind:'capture'});sound='photo';return finish();
 }
 if(action.type==='release'){
  if(!capability('photo'))return fail('请外面的人实际拿起照片，再释放同伴。');if(!s.photo)return fail('照片是空的，没有人需要释放。');if(!layout(s).nodes.some(n=>n.id===action.node))return fail('那里没有落脚点。');const p=point(s,action.node);if(distance(feet(s,id),p)>1.6||occupied(s,action.node,id)||distance(feet(s,id),p)<.53||space(s,add(p,[0,.85,0]),add(p,[0,.85,0]),[.26,.84,.26])||space(s,add(feet(s,id),[0,.85,0]),add(p,[0,.85,0]),[.26,.84,.26]))return fail('照片旁没有足够空位。请换空地，或让挡住的同伴先走开。');const target=actor(s,s.photo);target.inside=false;target.node=action.node;motions.push({id:target.id,path:[position(s,'photo'),add(p,[0,.85,0])],kind:'release'});s.photo=null;sound='photo';return finish();
 }
 if(action.type==='restore'){
  if(!capability('camera'))return fail('相机不在这位调查员手上。');if(s.doorRestored)return fail('照片记录的原门已恢复，没有第二扇门可复制。');const door=layout(s).objects.find(o=>o.id==='door')!;if(s.actors.some(a=>!a.inside&&intersects(position(s,a.id),position(s,a.id),{id:'door',label:'门',center:door.p,size:door.size,glass:false,gate:null},[.26,.84,.26])))return fail('门的位置有人，先让开，才不会被复原的门挡住。');item(s,'door').p=clone(door.p);s.doorRestored=true;motions.push({id:'door',path:[],kind:'restore'});sound='repair';return finish();
 }
 if(action.type==='portal'){
  if(!capability('key'))return fail('钥匙不在这位调查员手上。');if(!s.doorRestored)return fail('门坏了，没有可用的完整锁孔。');if(!near(s,[0,1,-1.29],id))return fail('请拿钥匙走到完整门的锁孔旁。');if(s.portal)return fail('门已经连接安全小院。');s.portal=true;motions.push({id:'door',path:[],kind:'turn'});sound='light';return finish();
 }
 if(action.type==='cross'){
  if(!s.portal)return fail('门后是断开的走廊，还没有安全通道。');if(who.node!=='door')return fail('请先走到门前。');motions.push({id,path:[feet(s,id),[0,0,-1.5],point(s,'safe')],kind:'portal'});who.node='safe';sound='portal';return finish();
 }
 if(action.type==='hold'){
  if(!['left','right'].includes(action.switch)||s.level!==3)return fail('这里没有保持开关。');if(who.node!==action.switch)return fail('请走到这个开关旁边，再持续按住。');if(who.holding===action.switch){who.holding=null;}else who.holding=action.switch;return finish();
 }
 if(action.type==='ring'){
  if(!capability('ring'))return fail('扳指不在这位调查员手上。');const targetActor=s.actors.find(a=>a.id===action.target),o=s.items.find(o=>o.id===action.target);if(!o&&!targetActor)return fail('这里没有这个目标。');if(targetActor?.inside)return fail('照片里的人不能成为外面的搬运目标。');if(targetActor?.id===id)return fail('佩戴者不能把自己当作远处目标搬运。');const start=position(s,action.target);const blocked=sight(s,start,id);if(blocked)return fail(blocked);
  if(o?.fixed){if(['left','right'].includes(o.id)){who.holding=who.holding===o.id?null:o.id;return finish();}return fail('它固定在这里，不能整个搬走；活动关节可以单独转动。');}
  if(o?.holder&&o.holder!==id)return fail('物品在别人手上，请让持有者实际放下。');if(!action.node)return fail('请选一处放置地点。');let end:Vec;
  if(action.node==='tray'&&o?.id==='photo')end=clone(layout(s).tray!);else if(action.node==='hand')end=add(feet(s,id),layout(s).anchors.hand);else {if(!layout(s).nodes.some(n=>n.id===action.node))return fail('那里没有放置地点。');end=add(point(s,action.node),[0,targetActor?.85:.16,0]);}
  const path:Vec[]=[start];if(s.level===3&&(start[2]-1)*(end[2]-1)<0){const slot=layout(s).slot!;path.push([slot[0],slot[1],start[2]>1?1.65:.35],[slot[0],slot[1],start[2]>1?.35:1.65]);}path.push(end);
  const half:Vec=targetActor?[.26,.84,.26]:o!.size.map(v=>v/2) as Vec;for(let i=1;i<path.length;i++){const hit=space(s,path[i-1],path[i],half);if(hit)return fail(hit+' 投递口只够扁平照片通过。');const len=distance(path[i-1],path[i]);for(let j=0;j<=Math.ceil(len/.08);j++){const t=j/Math.max(1,Math.ceil(len/.08));const p=path[i-1].map((v,k)=>v+(path[i][k]-v)*t) as Vec;const block=sight(s,p,id);if(block)return fail(block+' 搬运途中也要看得见。');}}
  if(targetActor){if(!layout(s).nodes.some(n=>n.id===action.node)||occupied(s,action.node,targetActor.id))return fail('那块落脚点有人，放不下。');targetActor.node=action.node;targetActor.holding=null;}else{o!.p=end;o!.holder=action.node==='hand'?id:null;}who.holding=null;motions.push({id:action.target,path,kind:'carry'});return finish();
 }
 return fail('先选择要做的动作。');
}

export interface Save {version:1;current:number;unlocked:number;levels:Record<number,{state:State;history:State[];hints:number}>;music:boolean;sfx:boolean;seen:string[]}
export const freshSave=():Save=>({version:1,current:1,unlocked:1,levels:{1:{state:initial(1),history:[],hints:0}},music:true,sfx:true,seen:[]});
export function validState(v:unknown):v is State {try{const s=v as State;if(![1,2,3].includes(s.level)||!Array.isArray(s.items)||!Array.isArray(s.actors))return false;const base=initial(s.level);if(s.items.length!==base.items.length||s.actors.length!==base.actors.length)return false;if(!base.actors.some(a=>a.id===s.active&&a.id!=='npc')||actor(s).inside)return false;if(![0,1,2].includes(s.lamp)||s.portal&&!s.doorRestored)return false;for(const key of ['doorRestored','portal','latched','won'] as const)if(typeof s[key]!=='boolean')return false;for(const a of s.actors)if(!base.actors.some(x=>x.id===a.id&&x.label===a.label)||!layout(s).nodes.some(n=>n.id===a.node)||typeof a.inside!=='boolean'||![null,'left','right'].includes(a.holding))return false;for(const o of s.items){const b=base.items.find(x=>x.id===o.id);if(!b||o.label!==b.label||o.fixed&&JSON.stringify(o.p)!==JSON.stringify(b.p)||o.magic!==b.magic||o.fixed!==b.fixed||JSON.stringify(o.size)!==JSON.stringify(b.size)||!Array.isArray(o.p)||o.p.length!==3||o.p.some(n=>!Number.isFinite(n)||Math.abs(n)>20)||o.holder!==null&&!s.actors.some(a=>a.id===o.holder&&!a.inside))return false;}return new Set(s.items.map(o=>o.id)).size===s.items.length&&new Set(s.actors.map(a=>a.id)).size===s.actors.length&&s.actors.filter(a=>a.inside).length===(s.photo?1:0)&&(!s.photo||s.actors.some(a=>a.id===s.photo&&a.inside));}catch{return false;}}
export function validSave(v:unknown):v is Save {try {const s=v as Save;return s.version===1&&[1,2,3].includes(s.current)&&[1,2,3].includes(s.unlocked)&&s.current<=s.unlocked&&typeof s.music==='boolean'&&typeof s.sfx==='boolean'&&Array.isArray(s.seen)&&s.seen.every(x=>typeof x==='string')&&!!s.levels[s.current]&&Object.entries(s.levels).every(([k,v])=>Number(k)===v.state.level&&validState(v.state)&&Array.isArray(v.history)&&v.history.every(h=>validState(h)&&h.level===v.state.level)&&Number.isInteger(v.hints)&&v.hints>=0&&v.hints<=3);}catch{return false;}}
