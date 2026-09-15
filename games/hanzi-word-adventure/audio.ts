/** A quiet wood / paper / bell instrument. Bounded voices; no gameplay callbacks. */
export class AdventureAudio {
  private context?: AudioContext;
  private voices = 0;
  volume = .65;
  unlock(): void { if (document.hidden || !this.volume) return; try { this.context ??= new AudioContext(); void this.context.resume().catch(()=>{}); } catch { /* Silent play. */ } }
  play(cue: string): void {
    if(cue==='put')cue='place';
    const ctx=this.context;if (!ctx || ctx.state!=='running' || document.hidden || this.voices>=6 || !this.volume) return;
    const notes:Record<string,number[]>={move:[160],take:[330,440],place:[250,370],split:[440,330],combine:[392,494,587],switch:[440,523],undo:[370,294],won:[392,494,587,784],rule:[294,440],light:[587,784]};
    for(const [i,hz] of (notes[cue]??[260]).entries()) {
      if(this.voices>=6)break;
      const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+i*.055,d=cue==='move'?.055:.19;
      o.type=['move','take','place','split'].includes(cue)?'triangle':'sine';o.frequency.value=hz;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(this.volume*(cue==='move'?.018:.07),t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(g);g.connect(ctx.destination);this.voices++;o.onended=()=>{o.disconnect();g.disconnect();this.voices--;};o.start(t);o.stop(t+d+.01);
    }
  }
  suspend():void {if(this.context?.state==='running')void this.context.suspend().catch(()=>{});}
  destroy():void {if(this.context)void this.context.close().catch(()=>{});this.context=undefined;}
}
