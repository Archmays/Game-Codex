import type { Product } from './settings';

/** Two reusable media voices per mount. URLs are fetched only after a real gesture. */
export class MusicLoops {
  private tracks: HTMLAudioElement[] = [];
  private unlocked = false;
  private disposed = false;
  private volume = .28;
  private blocked = false;
  private generation = 0;
  private desiredPlaying = false;
  private duckedUntil = 0;
  private duckTimer = 0;
  private loadTimer = 0;
  private pending = new Map<HTMLAudioElement, object>();
  constructor(private product: Product, private failed: (failed: boolean) => void) {}
  configure(volume: number, blocked: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume)); this.blocked = blocked;
    this.applyGain();
    if (blocked || !volume) this.suspend();
  }
  private applyGain():void {const gain=performance.now()<this.duckedUntil ? 10**(-9/20) : 1;this.tracks.forEach((track,i)=>{track.volume=this.volume*(i?.3:.65)*gain;});}
  /** One bounded release timer; important cues get 9 dB of space, without changing simulation time. */
  duck():void {this.duckedUntil=performance.now()+700;window.clearTimeout(this.duckTimer);this.applyGain();this.duckTimer=window.setTimeout(()=>this.applyGain(),720);}
  unlock(): void {
    if (this.disposed || document.hidden || this.blocked || this.volume === 0) return;
    this.unlocked = true;
    this.desiredPlaying = true;
    if (!this.tracks.length) this.tracks = ['theme', 'air'].map(name => {
      // PCM avoids native MP3 decoder crashes reproduced outside the game on Windows WebKit.
      const format=document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"')?'ogg':'wav';
      const track = new Audio(new URL(`./assets/v1.0/${this.product}/${name}.${format}`, document.baseURI).href);
      track.preload = 'none'; track.loop = true;
      track.addEventListener('error', () => { if (!this.disposed) this.failed(true); });
      track.addEventListener('stalled',()=>{if(!this.disposed&&track.readyState<2)this.failed(true);});
      return track;
    });
    const generation = ++this.generation;
    // Some media backends leave play() pending after a broken request instead of rejecting it.
    // Expose retry without cancelling play or blocking the game.
    if(!this.loadTimer&&this.tracks.some(t=>t.readyState<2))this.loadTimer=window.setTimeout(()=>{this.loadTimer=0;if(!this.disposed&&this.desiredPlaying&&this.tracks.some(t=>t.readyState<2))this.failed(true);},8000);
    this.tracks.forEach((track, i) => {
      this.applyGain();
      if (!track.paused || this.pending.has(track)) return;
      const attempt={};this.pending.set(track,attempt);
      void track.play().then(() => {
        if(this.pending.get(track)===attempt)this.pending.delete(track);
        if (this.disposed || !this.desiredPlaying || document.hidden || this.blocked) track.pause();
        else if(this.tracks.every(t=>!t.error&&t.readyState>=2)){window.clearTimeout(this.loadTimer);this.loadTimer=0;this.failed(false);}
      }).catch(() => { if(this.pending.get(track)!==attempt)return;this.pending.delete(track);if (!this.disposed && generation === this.generation) this.failed(true); });
    });
  }
  suspend(): void { this.desiredPlaying=false; this.generation++; this.tracks.forEach(track => track.pause()); }
  retry(): void {
    window.clearTimeout(this.loadTimer);this.loadTimer=0;
    this.suspend();this.pending.clear();this.failed(false); this.tracks.forEach(track => track.load());
    if (this.unlocked) this.unlock();
  }
  destroy(): void {
    this.disposed = true; window.clearTimeout(this.duckTimer);window.clearTimeout(this.loadTimer);this.suspend();
    this.tracks.forEach(track => { track.removeAttribute('src'); track.load(); }); this.tracks = [];this.pending.clear();
  }
}
