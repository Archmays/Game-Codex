import {afterEach,expect,test,vi} from 'vitest';
import {MusicLoops} from '../packages/presentation/music';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
test('repeated gestures share one pending playback request per voice; exit wins over late playback',async()=>{
 vi.useFakeTimers();const voices:FakeAudio[]=[];
 class FakeAudio extends EventTarget{
  volume=0;loop=false;preload='';paused=true;readyState=0;error=null;calls=0;loads=0;
  resolves:Array<()=>void>=[];
  constructor(public src:string){super();voices.push(this);}
  play(){this.calls++;return new Promise<void>(resolve=>this.resolves.push(()=>{this.paused=false;this.readyState=4;resolve();}));}
  pause(){this.paused=true;}load(){this.loads++;this.paused=true;this.readyState=0;}removeAttribute(){this.src='';}
 }
 vi.stubGlobal('window',globalThis);vi.stubGlobal('document',{hidden:false,baseURI:'https://example.test/game/',createElement:()=>({canPlayType:()=> 'probably'})});vi.stubGlobal('Audio',FakeAudio);
 const music=new MusicLoops('tower',vi.fn());
 for(let n=0;n<12;n++)music.unlock();
 expect(voices).toHaveLength(2);expect(voices.map(v=>v.calls)).toEqual([1,1]);
 music.suspend();voices.forEach(v=>v.resolves.shift()!());await Promise.resolve();expect(voices.every(v=>v.paused)).toBe(true);
 music.unlock();expect(voices.map(v=>v.calls)).toEqual([2,2]);
 music.retry();expect(voices.map(v=>v.calls)).toEqual([3,3]);
 // The canceled request must not erase the new pending request.
 voices.forEach(v=>v.resolves.shift()!());await Promise.resolve();voices.forEach(v=>v.pause());music.unlock();expect(voices.map(v=>v.calls)).toEqual([3,3]);
 music.destroy();voices.forEach(v=>v.resolves.shift()!());await Promise.resolve();expect(voices.every(v=>v.paused&&v.src==='')).toBe(true);
 expect(vi.getTimerCount()).toBe(0);
});
