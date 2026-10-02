import {describe,expect,it,vi,afterEach} from 'vitest';
import {ActionCoordinator} from '../games/oddity-puzzles/action-coordinator';
import {OddityLifetime} from '../games/oddity-puzzles/runtime-lifecycle';
import {planAction} from '../games/oddity-puzzles/intent';
import {initial,apply,item,clone,type State} from '../games/oddity-puzzles/model';
import {selectionLandmarks} from '../games/oddity-puzzles/landmarks';
import * as T from 'three';
import {disposeOddityTree} from '../games/oddity-puzzles/scene-resources';
afterEach(()=>vi.unstubAllGlobals());
const lit=()=>apply(apply(initial(1),{type:'move',node:'window'}).state,{type:'ring',target:'lamp',direction:1}).state;
describe('animated case action coordination',()=>{
 it('disposes borrowed portrait references once and leaves render-target attachment disposal to its owner',()=>{
  const root=new T.Group(),portrait=new T.Texture(),target=new T.WebGLRenderTarget(1,1);
  const shared=new T.MeshBasicMaterial({map:portrait}),replaced=new T.MeshBasicMaterial({map:portrait});
  root.add(new T.Mesh(new T.BoxGeometry(),shared),new T.Line(new T.BufferGeometry(),shared),new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({map:target.texture})));
  const portraitDispose=vi.spyOn(portrait,'dispose'),targetDispose=vi.spyOn(target,'dispose'),attachmentDispose=vi.spyOn(target.texture,'dispose'),replacedDispose=vi.spyOn(replaced,'dispose');
  disposeOddityTree(root,[replaced],[portrait],[target]);expect(portraitDispose).toHaveBeenCalledOnce();expect(targetDispose).toHaveBeenCalledOnce();expect(attachmentDispose).not.toHaveBeenCalled();expect(replacedDispose).toHaveBeenCalledOnce();
 });
 it('restores the entire approach and action from exactly one history entry',()=>{
  const before=lit(),record={state:clone(before),history:[] as State[]},coordinator=new ActionCoordinator(()=>record);
  expect(coordinator.begin(planAction(record.state,{type:'take',item:'box'},true),'拿盒')).toBe(true);
  expect(record.history).toEqual([before]);coordinator.next();expect(record.state.actors[0].node).toBe('box');
  coordinator.next();expect(item(record.state,'box').holder).toBe('a');
  expect(coordinator.cancel()).toEqual(before);expect(record.state).toEqual(before);expect(record.history).toEqual([]);
  expect(coordinator.cancel()).toBeNull();expect(coordinator.next()).toBeNull();
 });
 it('rechecks ownership at each step and never runs after pause, modal or busy animation',()=>{
  const record={state:lit(),history:[] as State[]},coordinator=new ActionCoordinator(()=>record),step=vi.fn();
  coordinator.begin(planAction(record.state,{type:'take',item:'box'},true),'拿盒');
  for(const gate of [[true,false,false,false],[false,true,false,false],[false,false,true,false],[false,false,false,true]])coordinator.advance(...gate as [boolean,boolean,boolean,boolean],step);
  expect(step).not.toHaveBeenCalled();coordinator.next();item(record.state,'box').holder='a';
  const before=clone(record.state);expect(coordinator.next()?.error).toContain('已经拿');expect(record.state).toEqual(before);
  coordinator.finish();coordinator.advance(false,false,false,false,step);expect(step).not.toHaveBeenCalled();
 });
 it('derives release choices from the explicit holder and leaves ordinary tray selection unchanged',()=>{
  let state=initial(3);for(const action of [{type:'capture',target:'b'},{type:'ring',target:'photo',node:'tray'},{type:'take',item:'photo',actor:'npc'}] as const)state=apply(state,action).state;
  const copy=clone(state),marks=selectionLandmarks(state,{kind:'release',who:'npc',target:'b'},'photo',true);
  const actor=state.actors.find(a=>a.id==='npc')!;
  expect(marks.some(m=>m.node==='release')).toBe(true);expect(marks.some(m=>m.node==='start')).toBe(false);
  expect(selectionLandmarks(state,null,'tray',false).some(m=>m.entity==='tray')).toBe(true);expect(state).toEqual(copy);expect(actor.node).toBe('tray');
 });
 it('removes mounted callbacks once and ignores late frames after exit',()=>{
  let callback:FrameRequestCallback=()=>{};const cancel=vi.fn(),release=vi.fn(),step=vi.fn();
  vi.stubGlobal('requestAnimationFrame',vi.fn((f:FrameRequestCallback)=>{callback=f;return 4;}));vi.stubGlobal('cancelAnimationFrame',cancel);
  const lifetime=new OddityLifetime();lifetime.own(release);lifetime.animate(step);lifetime.destroy();lifetime.destroy();callback(100);
  expect(step).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalledWith(4);expect(release).toHaveBeenCalledOnce();
 });
});
