import {apply,layout,clone,actor,routeObstacle,type State,type Action,type Motion,type ActorId,type Vec} from './model';

/** An intention contains only explicit rule actions and ordinary walking. */
export interface Plan {actions:Action[];motions:Motion[];error?:string;obstacle?:{label:string;p:Vec}}
const length=(motions:Motion[])=>motions.reduce((sum,m)=>sum+m.path.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.map((v,j)=>v-m.path[i][j])),0),0);
export function planAction(s:State,action:Action,approach=false):Plan {
 const direct=apply(s,action);
 if(!direct.error)return {actions:[action],motions:direct.motions};
 if(!approach||!['take','give','capture','portal','hold','cross'].includes(action.type))return {actions:[],motions:[],error:direct.error};
 const who='actor'in action&&action.actor?action.actor:s.active;
 const candidates:Plan[]=[];
 for(const n of layout(s).nodes){
  const move:Action={type:'move',node:n.id,actor:who};const walked=apply(s,move);
  if(walked.error)continue;
  const done=apply(walked.state,action);
  if(!done.error)candidates.push({actions:[move,action],motions:[...walked.motions,...done.motions]});
 }
 candidates.sort((a,b)=>length(a.motions)-length(b.motions));
 if(candidates[0])return candidates[0];
 for(const n of layout(s).nodes){const hypothetical=clone(s);actor(hypothetical,who).node=n.id;if(apply(hypothetical,action).error)continue;const obstacle=routeObstacle(s,actor(s,who).node,n.id);if(obstacle)return {actions:[],motions:[],error:`${obstacle.label}挡住了走近的道路。需要先解决这里的阻挡。`,obstacle};}
 return {actions:[],motions:[],error:direct.error};
}
export function planTogether(s:State):Plan {
 if(s.level!==3||!s.latched||s.actors.some(a=>a.inside))return {actions:[],motions:[],error:'先让所有人回到外面，并解除双开关门锁。'};
 let copy=clone(s);const actions:Action[]=[],motions:Motion[]=[];
 for(const a of s.actors){if(a.node==='exit')continue;const action:Action={type:'move',node:'exit',actor:a.id};const r=apply(copy,action);if(r.error)return {actions:[],motions:[],error:r.error};actions.push(action);motions.push(...r.motions);copy=r.state;}
 return {actions,motions,error:actions.length?undefined:'大家已经在出口。'};
}
export function planReturnPhoto(s:State):Plan {
 const drop:Action={type:'drop',item:'photo',actor:'npc'},direct=apply(s,drop);
 if(direct.error)return {actions:[],motions:[],error:direct.error};
 const atTray=(next:State)=>JSON.stringify(next.items.find(o=>o.id==='photo')!.p)===JSON.stringify(layout(next).tray);
 if(atTray(direct.state))return {actions:[drop],motions:direct.motions};
 const move:Action={type:'move',node:'tray',actor:'npc'},walked=apply(s,move);
 if(walked.error)return {actions:[],motions:[],error:walked.error};
 const placed=apply(walked.state,drop);if(placed.error||!atTray(placed.state))return {actions:[],motions:[],error:placed.error??'接应员还不能把照片放回托盘。'};
 return {actions:[move,drop],motions:[...walked.motions,...placed.motions]};
}
/** One history entry, revalidated steps, no timers or UI rule duplication. */
export class Intention {
 private steps:Action[]=[];private baseline:State|null=null;
 label='';
 get active(){return this.baseline!==null;}
 begin(s:State,plan:Plan,label:string){if(this.active)throw Error('An intention is already running');if(plan.error||!plan.actions.length)return false;this.baseline=clone(s);this.steps=clone(plan.actions);this.label=label;return true;}
 next(s:State){const action=this.steps.shift();if(!action)return null;const result=apply(s,action);if(result.error)this.steps=[];return {action,...result};}
 get pending(){return this.steps.length>0;}
 finish(){this.steps=[];this.baseline=null;this.label='';}
 cancel():State|null{const before=this.baseline;this.finish();return before;}
}
export const actorName=(s:State,id:ActorId=s.active)=>id==='npc'?'接应员':s.level===3?(id==='a'?'蓝衣':'橙衣'):'调查员';
