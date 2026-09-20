import {describe,it,expect} from 'vitest';
import {initial,apply,clone,actor,item,routeObstacle,type Action,type State} from '../games/oddity-puzzles/model';
import {Intention,planAction,planTogether,planReturnPhoto} from '../games/oddity-puzzles/intent';
import {landmarks} from '../games/oddity-puzzles/landmarks';
const run=(s:State,actions:Action[])=>{for(const a of actions){const r=apply(s,a);if(r.error)throw Error(r.error);s=r.state;}return s;};
const lit=()=>run(initial(1),[{type:'move',node:'window'},{type:'ring',target:'lamp',direction:1}]);
const released=()=>run(initial(3),[{type:'capture',target:'b'},{type:'ring',target:'photo',node:'tray'},{type:'take',item:'photo',actor:'npc'},{type:'release',node:'release',actor:'npc'}]);
describe('explicit, cancellable intentions over existing model rules',()=>{
 it('walks the actual bent path before taking, with a complete pre-action snapshot',()=>{
  const before=lit(),plan=planAction(before,{type:'take',item:'box'},true),intent=new Intention();
  expect(plan.error).toBeUndefined();expect(plan.actions).toEqual([{type:'move',node:'box',actor:'a'},{type:'take',item:'box'}]);
  expect(plan.motions[0].path.length).toBeGreaterThan(3);expect(intent.begin(before,plan,'取盒')).toBe(true);
  const walk=intent.next(before)!;expect(item(walk.state,'box').holder).toBeNull();expect(actor(walk.state).node).toBe('box');
  expect(intent.cancel()).toEqual(before);expect(intent.next(walk.state)).toBeNull();
 });
 it('does not secretly turn the lamp or find a casting viewpoint',()=>{
  const s=initial(1),copy=clone(s),plan=planAction(s,{type:'take',item:'box'},true);
  expect(plan.actions).toEqual([]);expect(plan.error).toContain('挡住');expect(plan.obstacle?.label).toBeTruthy();expect(s).toEqual(copy);
  expect(planAction(s,{type:'lamp',direction:1},true).actions).toEqual([]);
  expect(planAction(s,{type:'ring',target:'box',node:'hand'},true).error).toContain('挡');
 });
 it('rechecks the final action and discards invalid remaining steps',()=>{
  const before=lit(),intent=new Intention();intent.begin(before,planAction(before,{type:'take',item:'box'},true),'取盒');
  const walked=intent.next(before)!.state;item(walked,'box').holder='a';
  expect(intent.next(walked)?.error).toContain('已经拿');expect(intent.pending).toBe(false);expect(intent.next(walked)).toBeNull();
 });
 it('never merges restore, connect and cross into one decision',()=>{
  const s=initial(2);expect(planAction(s,{type:'portal'},true).error).toContain('门坏');
  const restored=apply(s,{type:'restore'}).state,plan=planAction(restored,{type:'portal'},true);
  expect(plan.actions.map(a=>a.type)).toEqual(['move','portal']);const connected=run(restored,plan.actions);
  expect(connected.won).toBe(false);expect(connected.portal).toBe(true);expect(connected.items.filter(o=>o.id==='door')).toHaveLength(1);
 });
 it('NPC take/release leaves the active investigator and ownership decisions intact',()=>{
  let s=run(initial(3),[{type:'capture',target:'b'},{type:'ring',target:'photo',node:'tray'}]);
  s=run(s,planAction(s,{type:'take',item:'photo',actor:'npc'},true).actions);
  expect(s.active).toBe('a');expect(item(s,'photo').holder).toBe('npc');expect(s.photo).toBe('b');
  expect(planAction(s,{type:'release',node:'friend',actor:'npc'},true).actions).toEqual([]);
  expect(planAction(s,{type:'release',node:'release',actor:'npc'}).actions).toHaveLength(1);
 });
 it('a hold intention does not pick the other switch or change controlled actor',()=>{
  const s=released(),plan=planAction(s,{type:'hold',switch:'right',actor:'b'},true);
  expect(plan.actions).toEqual([{type:'move',node:'right',actor:'b'},{type:'hold',switch:'right',actor:'b'}]);
  const next=run(s,plan.actions);expect(next.active).toBe('a');expect(actor(next,'b').holding).toBe('right');expect(next.latched).toBe(false);
 });
 it('returning a photo means the actual tray, even after the NPC walked away',()=>{
  const s=run(initial(3),[{type:'ring',target:'photo',node:'tray'},{type:'take',item:'photo',actor:'npc'},{type:'move',node:'center',actor:'npc'}]);
  const plan=planReturnPhoto(s);expect(plan.actions.map(a=>a.type)).toEqual(['move','drop']);
  const returned=run(s,plan.actions);expect(item(returned,'photo').holder).toBeNull();expect(item(returned,'photo').p).toEqual([0,.91,-.25]);expect(returned.active).toBe('a');
 });
 it('both switch orders work, together is explicit and remains cancellable as a whole',()=>{
  for(const [first,second] of [['left','right'],['right','left']]){
   let s=released();expect(planTogether(s).error).toBeTruthy();
   s=run(s,planAction(s,{type:'hold',switch:first,actor:'b'},true).actions);
   expect(planTogether(s).error).toBeTruthy();s=run(s,planAction(s,{type:'hold',switch:second,actor:'npc'},true).actions);
   const plan=planTogether(s),intent=new Intention();expect(plan.error).toBeUndefined();expect(plan.actions).toHaveLength(3);
   intent.begin(s,plan,'一起出去');const firstStep=intent.next(s)!;expect(firstStep.state.won).toBe(false);expect(intent.cancel()).toEqual(s);
   expect(run(s,plan.actions).won).toBe(true);
  }
 });
 it('keeps intermediate path nodes available only when placement is a real choice',()=>{
  const s=initial(1);expect(landmarks(s).some(m=>m.node==='bend')).toBe(false);expect(landmarks(s,true).some(m=>m.node==='bend')).toBe(true);
  expect(landmarks(initial(2)).some(m=>m.node==='safe')).toBe(false);
  const connected=run(initial(2),[{type:'restore'},{type:'move',node:'door'},{type:'portal'}]);expect(landmarks(connected).some(m=>m.node==='safe')).toBe(true);
 });
 it('route diagnostics identify real walls and never claim a route through the closed cut',()=>{
  expect(routeObstacle(initial(1),'exit','box')?.label).toBeTruthy();expect(routeObstacle(lit(),'window','box')).toBeNull();
  expect(routeObstacle(initial(3),'outside','left')?.label).toContain('门');
 });
});
