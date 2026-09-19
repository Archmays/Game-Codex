/** Small locally synthesized resonances. No stream, network, music or narration. */
export class BoxAudio {
  private ctx?:AudioContext; private output?:GainNode; private windBus?:GainNode; private timer=0; private wind=false; private muted=false; private dead=false;
  async unlock(){if(this.dead)return;this.ctx??=new AudioContext();if(!this.output){this.output=this.ctx.createGain();this.output.connect(this.ctx.destination);this.windBus=this.ctx.createGain();this.windBus.gain.value=0;this.windBus.connect(this.output);}if(this.ctx.state==='suspended')await this.ctx.resume();}
  private note(hz:number,volume:number,duration:number,bell=false){if(!this.ctx||!this.output||this.muted||this.dead||this.ctx.state!=='running')return;const t=this.ctx.currentTime;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,t);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(bell?this.windBus!:this.output);osc.start(t);osc.stop(t+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
  place(){this.note(460,.10,.10);this.note(920,.035,.06);}
  set(wind:boolean,muted:boolean,chime:boolean){this.muted=muted;this.wind=wind;this.output?.gain.setTargetAtTime(muted||document.hidden?0:.85,this.ctx!.currentTime,.16);this.windBus?.gain.setTargetAtTime(wind&&chime?1:0,this.ctx!.currentTime,.16);window.clearTimeout(this.timer);if(wind&&chime&&!muted&&!document.hidden)this.schedule();}
  private schedule(){this.timer=window.setTimeout(()=>{if(this.wind&&!this.muted){this.note(1320,.025,1,true);this.note(1760,.014,.8,true);this.schedule();}},2300);}
  suspend(){window.clearTimeout(this.timer);this.output?.gain.setTargetAtTime(0,this.ctx!.currentTime,.08);}
  destroy(){this.dead=true;window.clearTimeout(this.timer);void this.ctx?.close();}
}
