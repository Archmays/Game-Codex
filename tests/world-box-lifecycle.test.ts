import {afterEach,describe,expect,it,vi} from 'vitest';
import * as T from 'three';
import {BoxLifetime} from '../games/world-in-a-box/box-lifecycle';
import {BoxPauses} from '../games/world-in-a-box/box-pause';
import {disposeToy} from '../games/world-in-a-box/toy-view';
import {beginBoxGesture,boxGestureScrolled} from '../games/world-in-a-box/box-gesture';

afterEach(()=>vi.unstubAllGlobals());
describe('box callback and Three resource ownership',()=>{
  it('cancels a gesture when any captured scroll owner changes',()=>{
    vi.stubGlobal('scrollX',0);vi.stubGlobal('scrollY',20);
    const ancestor={scrollLeft:0,scrollTop:5,parentElement:null};
    const target={scrollLeft:0,scrollTop:0,parentElement:ancestor,closest:()=>({dataset:{piece:'cup'}})};
    const gesture=beginBoxGesture<'cup'>({target,pointerId:3,clientX:42,clientY:56} as unknown as PointerEvent);
    expect(gesture.piece).toBe('cup');expect(boxGestureScrolled(gesture)).toBe(false);
    ancestor.scrollTop++;expect(boxGestureScrolled(gesture)).toBe(true);
    ancestor.scrollTop--;vi.stubGlobal('scrollY',21);expect(boxGestureScrolled(gesture)).toBe(true);
  });
  it('cancels the owned frame and suppresses a delivered late callback after repeated destroy',()=>{
    const callbacks=new Map<number,FrameRequestCallback>();let next=0;
    const request=vi.fn((cb:FrameRequestCallback)=>{callbacks.set(++next,cb);return next;});
    const cancel=vi.fn();vi.stubGlobal('requestAnimationFrame',request);vi.stubGlobal('cancelAnimationFrame',cancel);
    const tick=vi.fn(),release=vi.fn(),life=new BoxLifetime();life.own(release);life.animate(tick);
    callbacks.get(1)!(10);expect(tick).toHaveBeenCalledOnce();expect(request).toHaveBeenCalledTimes(2);
    life.destroy();life.destroy();callbacks.get(2)!(20);
    expect(cancel).toHaveBeenCalledWith(2);expect(release).toHaveBeenCalledOnce();expect(tick).toHaveBeenCalledOnce();
  });
  it('does not schedule another frame when exit occurs inside a frame',()=>{
    const request=vi.fn();let cb:FrameRequestCallback=()=>{};request.mockImplementation((f:FrameRequestCallback)=>{cb=f;return 1;});
    vi.stubGlobal('requestAnimationFrame',request);vi.stubGlobal('cancelAnimationFrame',vi.fn());
    const life=new BoxLifetime();life.animate(()=>life.destroy());cb(10);expect(request).toHaveBeenCalledOnce();
  });
  it('retains a second pause reason when the first dialog closes',()=>{
    const pause=vi.fn(),reasons=new BoxPauses(pause);reasons.set('photo',true);reasons.set('reset',true);
    reasons.set('photo',false);expect(reasons.size).toBe(1);reasons.set('reset',false);expect(reasons.size).toBe(0);
    expect(pause.mock.calls).toEqual([['photo',true],['reset',true],['photo',false],['reset',false]]);
  });
  it('releases shared materials/textures once, includes helper lines, particles and replaced materials',()=>{
    const root=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture();
    const material=new T.MeshBasicMaterial({map:texture}),replaced=new T.MeshBasicMaterial({map:texture});
    root.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material),new T.Points(geometry,material),new T.Line(geometry,material),new T.Sprite(new T.SpriteMaterial({map:texture})));
    const geometryDispose=vi.spyOn(geometry,'dispose'),materialDispose=vi.spyOn(material,'dispose'),textureDispose=vi.spyOn(texture,'dispose'),replacedDispose=vi.spyOn(replaced,'dispose');
    disposeToy(root,[replaced]);expect(geometryDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();expect(textureDispose).toHaveBeenCalledOnce();expect(replacedDispose).toHaveBeenCalledOnce();
  });
});
