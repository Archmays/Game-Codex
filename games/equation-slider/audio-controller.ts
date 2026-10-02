export type AudioCue = "move" | "success" | "complete" | "enabled";
export function createAudioController(): {
  readonly play: (cue: AudioCue) => void;
  readonly destroy: () => void;
} {
  type AudioContextConstructor = new () => AudioContext;
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  let audioContext: AudioContext | undefined;

  const schedule = (cue: AudioCue): void => {
    if (!AudioContextClass) return;
    try {
      audioContext ??= new AudioContextClass();
      const notes = cue === "complete"
        ? [523, 659]
        : [cue === "success" ? 523 : cue === "enabled" ? 440 : 294];
      const playNotes = (): void => {
        if (!audioContext || audioContext.state === "closed") return;
        const start = audioContext.currentTime;
        notes.forEach((frequency, index) => {
          const oscillator = audioContext!.createOscillator();
          const gain = audioContext!.createGain();
          const noteStart = start + index * 0.07;
          const noteEnd = noteStart + (cue === "complete" ? 0.11 : 0.055);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, noteStart);
          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.exponentialRampToValueAtTime(cue === "move" ? 0.025 : 0.045, noteStart + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
          oscillator.connect(gain);
          gain.connect(audioContext!.destination);
          oscillator.start(noteStart);
          oscillator.stop(noteEnd + 0.01);
        });
      };
      if (audioContext.state === "suspended") {
        void audioContext.resume().then(playNotes).catch(() => undefined);
      } else {
        playNotes();
      }
    } catch {
      // Audio is optional; unsupported or policy-blocked contexts fail silently.
    }
  };

  return {
    play: schedule,
    destroy: () => {
      if (!audioContext || audioContext.state === "closed") return;
      void audioContext.close().catch(() => undefined);
      audioContext = undefined;
    }
  };
}
