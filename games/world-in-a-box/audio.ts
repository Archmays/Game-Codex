/** Scene-owned local audio. One context, bounded voices, no queued one-shots. */
import {AUDIO_SCENES,type AudioScene} from './scene-config';
export type Channel='music'|'sfx'|'ambient';
export interface SoundPreferences {version:1;muted:boolean;music:number;sfx:number;ambient:number}
export const AUDIO_KEY='audio-v1';
export function soundPreferences(raw:unknown,legacyMuted=false):SoundPreferences {
 const p=raw as Partial<SoundPreferences>|null;
 const volume=(key:Channel,fallback:number)=>typeof p?.[key]==='number'&&Number.isFinite(p[key])?Math.max(0,Math.min(1,p[key]!)):fallback;
 return {version:1,muted:typeof p?.muted==='boolean'?p.muted:legacyMuted,music:volume('music',.25),sfx:volume('sfx',.55),ambient:volume('ambient',.15)};
}
let context:AudioContext|undefined;const owners=new Set<BoxAudio>();let transitions=0;
export function retainBoxAudio(){transitions++;return()=>{transitions--;if(!transitions&&!owners.size&&context){const c=context;context=undefined;void c.close();}};}
type Voice={source:AudioBufferSourceNode;gain:GainNode;started:number;offset:number;name:string;level:number};
const shortNames=['pick','place-light','place-medium','place-heavy','undo','mismatch','complete','shutter','page','cat','cup','steam','chime','boat-start','boat-contact','tram-start','tram-stop','blocked','section'];
export class BoxAudio {
 private ctx?:AudioContext;private output?:GainNode;private buses?:Record<Channel,GainNode>;private limiter?:DynamicsCompressorNode;
 private buffers=new Map<string,AudioBuffer>();private pending=new Map<string,Promise<void>>();private loops=new Map<string,Voice>();private desired=new Map<string,{name:string;channel:Channel;level:number}>();private offsets=new Map<string,number>();
 private voices:Voice[]=[];private abort=new AbortController();private epoch=0;private dead=false;private pauses=new Set<string>();private nextChime=0;private nextPage=0;private chime=false;private breeze=false;private quiet=false;
 readonly events:{name:string;time:number}[]=[];
 constructor(readonly scene:AudioScene='window-breeze',public preferences:SoundPreferences=soundPreferences(null),private status:(text:string)=>void=()=>{},private interruptedState:(paused:boolean)=>void=()=>{}){if(context?.state==='running')void this.unlock();}
 async unlock(){
  if(this.dead)return;
  try{
   this.ctx=context??=new AudioContext();owners.add(this);const c=this.ctx;
   if(!this.output){this.output=c.createGain();this.output.gain.value=0;this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-9;this.limiter.knee.value=12;this.limiter.ratio.value=4;this.output.connect(this.limiter);this.limiter.connect(c.destination);
    this.buses={music:c.createGain(),sfx:c.createGain(),ambient:c.createGain()};Object.values(this.buses).forEach(b=>b.connect(this.output!));
    c.addEventListener('statechange',()=>{if(!this.dead){if(c.state!=='running')this.status('声音暂时暂停；点声音按钮可重试。');this.interruptedState(c.state!=='running');}},{signal:this.abort.signal});
   }
   if(c.state!=='running')await c.resume();if(this.dead)return;
   this.mix();this.want('music',this.scene,'music',.7);this.want('environment',AUDIO_SCENES[this.scene].environment,'ambient',.12);
   for(const name of [...shortNames,...AUDIO_SCENES[this.scene].extra])void this.load(name);
   this.sync();
  }catch{if(!this.dead)this.status('声音暂时未开启；可以继续拼，打开声音设置可重试。');}
 }
 private path(name:string){return `./assets/world-in-a-box/audio/${name===this.scene?'music':'sfx'}/${name}.wav`;}
 private load(name:string):Promise<void>{
  if(this.buffers.has(name))return Promise.resolve();const existing=this.pending.get(name);if(existing)return existing;
  const promise=(async()=>{try{const response=await fetch(this.path(name),{signal:this.abort.signal});if(!response.ok)throw Error('audio');const bytes=await response.arrayBuffer();const buffer=await this.ctx!.decodeAudioData(bytes);if(this.dead)return;this.buffers.set(name,buffer);this.sync();}catch{if(!this.dead)this.status('部分声音暂时没加载好；拼装仍可继续。');}finally{this.pending.delete(name);}})();
  this.pending.set(name,promise);return promise;
 }
 private ramp(param:AudioParam,value:number,time=.09){const t=this.ctx!.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,time);}
 private get interrupted(){return this.pauses.has('background')||document.hidden;}
 private get localPause(){return [...this.pauses].some(p=>p!=='background');}
 private mix(){if(!this.ctx||!this.buses||!this.output)return;this.ramp(this.output.gain,this.preferences.muted||this.interrupted?0:1);this.ramp(this.buses.music.gain,this.preferences.music*(this.localPause?.35:this.quiet?.65:1),.2);this.ramp(this.buses.sfx.gain,this.preferences.sfx);this.ramp(this.buses.ambient.gain,this.preferences.ambient*(this.localPause?.3:this.quiet?.5:1));}
 configure(preferences:SoundPreferences){if(this.dead)return;this.preferences=preferences;this.mix();if(preferences.muted)this.clearObjects();this.sync();}
 setQuiet(value:boolean){if(this.quiet===value)return;this.quiet=value;this.mix();}
 pause(reason:string,on:boolean){if(this.dead)return;if(on)this.pauses.add(reason);else this.pauses.delete(reason);if(on)this.clearObjects();this.mix();this.sync();}
 private start(name:string,channel:Channel,level:number,loop:boolean,offset=0):Voice|undefined{
  const buffer=this.buffers.get(name);if(!this.ctx||!this.buses||!buffer||this.dead||this.ctx.state!=='running')return;
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=loop;gain.gain.value=0;source.connect(gain);gain.connect(this.buses[channel]);source.start(0,offset%buffer.duration);gain.gain.setTargetAtTime(level,this.ctx.currentTime,loop?.12:.003);
  const voice={source,gain,started:this.ctx.currentTime,offset,name,level};source.onended=()=>{source.disconnect();gain.disconnect();this.voices=this.voices.filter(v=>v!==voice);};return voice;
 }
 private stop(v:Voice){if(!this.ctx)return;this.ramp(v.gain.gain,0,.025);try{v.source.stop(this.ctx.currentTime+.15);}catch{/* already stopped */}}
 event(name:string,weight=1){
  if(!this.ctx||this.ctx.state!=='running'||this.preferences.muted||this.preferences.sfx===0||this.interrupted||this.localPause||this.dead)return;
  const voice=this.start(name,'sfx',Math.min(.42,.25*weight),false);if(!voice)return;
  if(this.voices.length>=8)this.stop(this.voices.shift()!);this.voices.push(voice);this.events.push({name,time:this.ctx.currentTime});if(this.events.length>80)this.events.shift();
  if(['complete','boat-start','tram-start'].includes(name)&&this.buses){const t=this.ctx.currentTime,g=this.buses.music.gain;g.cancelScheduledValues(t);g.setTargetAtTime(this.preferences.music*.7,t,.05);g.setTargetAtTime(this.preferences.music*(this.quiet?.65:1),t+.6,.25);}
 }
 place(weight=1){this.event(weight<.8?'place-light':weight>1.2?'place-heavy':'place-medium',weight);}
 want(key:string,name:string,channel:Channel,level:number){if(this.dead)return;if(level<=.0001){this.desired.delete(key);}else this.desired.set(key,{name,channel,level});if(this.ctx&&!this.buffers.has(name)&&level>0)void this.load(name);this.sync();}
 private sync(){
  if(!this.ctx||this.dead)return;
  for(const [key,v] of this.loops){const d=this.desired.get(key);if(!d||this.preferences.muted||this.interrupted||(this.localPause&&d.channel==='sfx')||this.preferences[d.channel]===0){if(key==='music')this.offsets.set(key,(v.offset+this.ctx.currentTime-v.started)%v.source.buffer!.duration);this.stop(v);this.loops.delete(key);}else if(Math.abs(v.level-d.level)>.001){v.level=d.level;this.ramp(v.gain.gain,d.level);}}
  if(this.preferences.muted||this.interrupted)return;
  for(const [key,d] of this.desired)if(!this.loops.has(key)&&this.preferences[d.channel]>0&&!(this.localPause&&d.channel==='sfx')){const v=this.start(d.name,d.channel,d.level,true,this.offsets.get(key)??0);if(v)this.loops.set(key,v);}
 }
 set(wind:boolean,muted:boolean,chime:boolean){if(this.dead)return;this.preferences.muted=muted;this.breeze=wind;this.chime=chime;this.want('wind','wind','sfx',wind?.11:0);this.mix();}
 tick(now:number,pages=false){if(this.localPause||this.interrupted)return;if(this.breeze&&this.chime&&now>=this.nextChime){this.event('chime',.28);this.nextChime=now+3400;}if(this.breeze&&pages&&now>=this.nextPage){this.event('page',.12);this.nextPage=now+4700;}}
 clearObjects(){this.epoch++;for(const v of this.voices)this.stop(v);this.voices=[];for(const [key,v] of this.loops)if(key!=='music'&&key!=='environment'){this.stop(v);this.loops.delete(key);}for(const key of this.desired.keys())if(key!=='music'&&key!=='environment')this.desired.delete(key);this.nextChime=0;this.nextPage=0;}
 suspend(){this.pause('background',true);}
 diagnostics(){return{context:this.ctx?.state??'locked',loops:[...this.loops].map(([key,v])=>({key,name:v.name,offset:v.offset,started:v.started})),voices:this.voices.length,pending:this.pending.size,buffers:this.buffers.size,epoch:this.epoch,pauses:[...this.pauses],preferences:{...this.preferences},events:this.events.slice(-12)};}
 destroy(immediate=false){if(this.dead)return;this.dead=true;owners.delete(this);this.abort.abort();this.clearObjects();for(const v of this.loops.values())this.stop(v);this.loops.clear();this.desired.clear();this.buffers.clear();const output=this.output,buses=this.buses,limiter=this.limiter;if(output&&this.ctx){this.ramp(output.gain,0,.03);const release=()=>{Object.values(buses!).forEach(b=>b.disconnect());output.disconnect();limiter?.disconnect();if(!transitions&&!owners.size&&context===this.ctx){const c=context;context=undefined;void c?.close();}};if(immediate)release();else window.setTimeout(release,180);}}
}
