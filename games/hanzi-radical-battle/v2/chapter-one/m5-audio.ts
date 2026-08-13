export type M5AudioCue =
  | "select"
  | "telegraph"
  | "recover"
  | "snap"
  | "compose"
  | "meaning"
  | "boss"
  | "repair"
  | "camp"
  | "ending"
  | "ambience-glimmer"
  | "ambience-echo"
  | "ambience-wind"
  | "ambience-core";

const CUE_NOTES: Readonly<Record<M5AudioCue, readonly number[]>> = {
  select: [392, 523],
  telegraph: [294, 247],
  recover: [330, 440],
  snap: [523, 659],
  compose: [392, 523, 659],
  meaning: [440, 587, 698],
  boss: [196, 247, 294],
  repair: [330, 415, 523],
  camp: [262, 330],
  ending: [262, 330, 392, 523],
  "ambience-glimmer": [330, 494],
  "ambience-echo": [294, 440, 294],
  "ambience-wind": [349, 523],
  "ambience-core": [196, 294, 392],
};

export interface M5AudioController {
  cue(cue: M5AudioCue, muted: boolean): void;
  destroy(): void;
}

export function createM5AudioController(): M5AudioController {
  let context: AudioContext | null = null;

  const ensureContext = (): AudioContext | null => {
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Context = typeof AudioContext === "undefined" ? audioWindow.webkitAudioContext : AudioContext;
    if (!Context) return null;
    if (!context) context = new Context();
    if (context.state === "suspended") void context.resume();
    return context;
  };

  return {
    cue(cue, muted) {
      if (muted) return;
      const audio = ensureContext();
      if (!audio) return;
      const notes = CUE_NOTES[cue];
      const now = audio.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = cue === "boss" || cue === "ambience-core" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.075);
        gain.gain.setValueAtTime(0.0001, now + index * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.045, now + index * 0.075 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + 0.18);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(now + index * 0.075);
        oscillator.stop(now + index * 0.075 + 0.2);
      });
    },
    destroy() {
      if (context && context.state !== "closed") void context.close();
      context = null;
    },
  };
}
