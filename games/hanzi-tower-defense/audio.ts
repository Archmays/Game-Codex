type Sound = "shot" | "heavy" | "defeat" | "drop" | "fusion" | "leak" | "wave" | "deploy";
const db = (value: number) => 10 ** (value / 20);

/** A small synthesized SFX instrument, with bounded voices and separate UI/combat buses. No microphone. */
export class BattleAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private combat: GainNode | null = null;
  private ui: GainNode | null = null;
  private voices = 0;
  private lastShot = -10;
  private serial = 0;
  muted = false;
  unlock(): void {
    if (this.muted || document.hidden) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = db(-15); this.master.connect(this.context.destination);
        this.combat = this.context.createGain(); this.combat.gain.value = db(-7); this.combat.connect(this.master);
        this.ui = this.context.createGain(); this.ui.gain.value = db(-3); this.ui.connect(this.master);
      }
      void this.context.resume().catch(() => {});
    } catch { /* Browsers without WebAudio remain fully playable. */ }
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setValueAtTime(muted ? 0 : db(-15), this.context.currentTime);
    if (muted) this.suspend(); else this.unlock();
  }
  suspend(): void { if (this.context?.state === "running") void this.context.suspend().catch(() => {}); }
  play(sound: Sound): void {
    const ctx = this.context;
    if (!ctx || this.muted || document.hidden || ctx.state !== "running" || this.voices >= 8) return;
    const time = ctx.currentTime;
    if ((sound === "shot" || sound === "heavy") && time - this.lastShot < .11) return;
    if (sound === "shot" || sound === "heavy") this.lastShot = time;
    const frequencies: Record<Sound, number[]> = { shot: [480], heavy: [145], defeat: [760, 450], drop: [880, 1174], fusion: [523, 659, 784, 1047], leak: [185, 140], wave: [523, 784, 1047], deploy: [620, 830] };
    const important = sound === "fusion" || sound === "wave";
    if (important && this.combat) { this.combat.gain.setValueAtTime(db(-17), time); this.combat.gain.linearRampToValueAtTime(db(-7), time + .6); }
    for (const [index, frequency] of frequencies[sound].entries()) {
      if (this.voices >= 8) break;
      const osc = ctx.createOscillator(), gain = ctx.createGain(), start = time + index * .07, duration = important ? .25 : .12;
      osc.type = sound === "heavy" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency * (1 + ((this.serial++ % 5) - 2) * .012), start);
      if (sound === "shot" || sound === "heavy") osc.frequency.exponentialRampToValueAtTime(frequency * .45, start + duration);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.8, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      osc.connect(gain); gain.connect((sound === "shot" || sound === "heavy" ? this.combat : this.ui)!);
      this.voices++; osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices--; };
      osc.start(start); osc.stop(start + duration + .01);
    }
  }
  destroy(): void { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}
