export class OddityAudio {
 private context?:AudioContext;private buffers=new Map<string,AudioBuffer>();private active=new Map<AudioBufferSourceNode,GainNode>();private musicNode?:AudioBufferSourceNode;private epoch=0;private dead=false;
 music=true;sfx=true;paused=false;
 async unlock(){if(this.dead)return;this.context??=new AudioContext();const c=this.context;if(c.state==='suspended')await c.resume();if(!this.buffers.size){const epoch=this.epoch;await Promise.all(['music','place','light','photo','repair','portal'].map(async n=>{const r=await fetch(`./assets/oddity-puzzles/audio/${n}.wav`);const b=await c.decodeAudioData(await r.arrayBuffer());if(!this.dead)this.buffers.set(n,b);}));if(epoch!==this.epoch)return;}this.sync();}
 private play(name:string,loop=false){const c=this.context,b=this.buffers.get(name);if(!c||!b||this.paused||this.dead)return;const source=c.createBufferSource(),gain=c.createGain();source.buffer=b;source.loop=loop;gain.gain.value=loop?.65:.7;source.connect(gain).connect(c.destination);source.start();this.active.set(source,gain);source.onended=()=>{this.active.delete(source);source.disconnect();gain.disconnect();};return source;}
 cue(name:string){if(this.sfx)this.play(name);}
 sync(){if(!this.music||this.paused){this.musicNode?.stop();this.musicNode=undefined;}else if(!this.musicNode)this.musicNode=this.play('music',true);}
 stop(){this.epoch++;for(const [s,gain] of this.active){s.onended=null;try{s.stop();}catch{}s.disconnect();gain.disconnect();}this.active.clear();this.musicNode=undefined;}
 pause(){this.paused=true;this.stop();void this.context?.suspend();}
 resume(){this.paused=false;void this.unlock();}
 destroy(){this.dead=true;this.stop();void this.context?.close();}
}
