export type AudioBusId = "master" | "music" | "ambience" | "sfx" | "voice" | "ui";

export interface GoldenSliceAudioSettings {
  muted: boolean;
  volumes: Record<AudioBusId, number>;
}

export interface VoiceResult {
  adapter: "recorded" | "speech-synthesis" | "silent-visual";
  voiceName: string | null;
  lang: string | null;
}

export interface VoiceAdapter {
  readonly id: VoiceResult["adapter"];
  speak(text: string, lang: string): Promise<VoiceResult>;
  stop(): void;
}

export const DEFAULT_AUDIO_SETTINGS: GoldenSliceAudioSettings = {
  muted: false,
  volumes: {
    master: 0.72,
    music: 0.26,
    ambience: 0.22,
    sfx: 0.62,
    voice: 0.82,
    ui: 0.46,
  },
};

export class RecordedVoiceAdapter implements VoiceAdapter {
  readonly id = "recorded" as const;

  constructor(private readonly clips: Readonly<Record<string, string>> = {}) {}

  async speak(text: string, lang: string): Promise<VoiceResult> {
    const source = this.clips[text];
    if (!source) throw new Error("No approved recorded clip is available");
    const audio = new Audio(source);
    audio.preload = "auto";
    await audio.play();
    return { adapter: this.id, voiceName: "project-approved-recording", lang };
  }

  stop(): void {
    // Each approved clip is short and self-contained. A future recorder adapter can
    // retain its element here; STEP 03 intentionally ships no recorded child voice.
  }
}

export class SpeechSynthesisAdapter implements VoiceAdapter {
  readonly id = "speech-synthesis" as const;

  speak(text: string, lang: string): Promise<VoiceResult> {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return Promise.reject(new Error("Speech synthesis is unavailable"));
    }
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((candidate) => candidate.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((candidate) => candidate.lang.toLowerCase().startsWith("zh")) ??
      null;
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? lang;
      utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.pitch = 1.02;
      utterance.volume = 0.82;
      utterance.onend = () =>
        resolve({ adapter: this.id, voiceName: voice?.name ?? "device-default", lang: utterance.lang });
      utterance.onerror = () => reject(new Error("Speech synthesis failed"));
      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    window.speechSynthesis?.cancel();
  }
}

export class SilentVisualFallback implements VoiceAdapter {
  readonly id = "silent-visual" as const;

  async speak(_text: string, lang: string): Promise<VoiceResult> {
    return { adapter: this.id, voiceName: null, lang };
  }

  stop(): void {}
}

const BUS_IDS: readonly AudioBusId[] = ["master", "music", "ambience", "sfx", "voice", "ui"];

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export class AudioDirector {
  private context: AudioContext | null = null;
  private gains = new Map<AudioBusId, GainNode>();
  private activeSources = new Set<AudioScheduledSourceNode>();
  private settings: GoldenSliceAudioSettings;
  private voiceAdapters: readonly VoiceAdapter[];
  private voiceSequence = 0;
  private lastVoice: VoiceResult = { adapter: "silent-visual", voiceName: null, lang: "zh-CN" };
  private sfxVariation = 0;

  constructor(
    settings: GoldenSliceAudioSettings = DEFAULT_AUDIO_SETTINGS,
    voiceAdapters: readonly VoiceAdapter[] = [
      new RecordedVoiceAdapter(),
      new SpeechSynthesisAdapter(),
      new SilentVisualFallback(),
    ],
  ) {
    this.settings = {
      muted: settings.muted,
      volumes: Object.fromEntries(
        BUS_IDS.map((id) => [id, clampVolume(settings.volumes[id])]),
      ) as Record<AudioBusId, number>,
    };
    this.voiceAdapters = voiceAdapters;
  }

  getSettings(): GoldenSliceAudioSettings {
    return { muted: this.settings.muted, volumes: { ...this.settings.volumes } };
  }

  getLastVoiceResult(): VoiceResult {
    return { ...this.lastVoice };
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    this.applyGains();
    if (muted) this.stopVoice();
  }

  setBusVolume(bus: AudioBusId, volume: number): void {
    this.settings = {
      ...this.settings,
      volumes: { ...this.settings.volumes, [bus]: clampVolume(volume) },
    };
    this.applyGains();
  }

  private ensureContext(): AudioContext | null {
    if (this.settings.muted || !("AudioContext" in window)) return null;
    if (this.context) return this.context;
    try {
      const context = new AudioContext();
      const master = context.createGain();
      master.connect(context.destination);
      this.gains.set("master", master);
      for (const id of BUS_IDS.filter((item) => item !== "master")) {
        const gain = context.createGain();
        gain.connect(master);
        this.gains.set(id, gain);
      }
      this.context = context;
      this.applyGains();
      return context;
    } catch {
      return null;
    }
  }

  private applyGains(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const id of BUS_IDS) {
      const gain = this.gains.get(id);
      if (!gain) continue;
      const level = this.settings.muted ? 0 : this.settings.volumes[id];
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(level, now, 0.012);
    }
  }

  playSfx(kind: "place" | "invalid" | "form" | "magic" | "choice" | "ui"): void {
    const context = this.ensureContext();
    if (!context) return;
    const bus = this.gains.get(kind === "ui" ? "ui" : "sfx");
    if (!bus || this.activeSources.size >= 5) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const baseByKind: Record<typeof kind, number> = {
      place: 420,
      invalid: 245,
      form: 520,
      magic: 660,
      choice: 480,
      ui: 360,
    };
    const variations = [-9, 0, 12];
    oscillator.type = kind === "invalid" ? "triangle" : kind === "magic" ? "sine" : "sine";
    oscillator.frequency.setValueAtTime(baseByKind[kind] + variations[this.sfxVariation % variations.length], now);
    this.sfxVariation += 1;
    if (kind === "magic" || kind === "form") {
      oscillator.frequency.exponentialRampToValueAtTime(baseByKind[kind] * 1.42, now + 0.28);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "invalid" ? 0.045 : 0.065, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "magic" ? 0.48 : 0.24));
    oscillator.connect(gain).connect(bus);
    this.activeSources.add(oscillator);
    oscillator.addEventListener("ended", () => this.activeSources.delete(oscillator), { once: true });
    oscillator.start(now);
    oscillator.stop(now + (kind === "magic" ? 0.5 : 0.26));
  }

  async speak(text: string, lang = "zh-CN"): Promise<VoiceResult> {
    const sequence = ++this.voiceSequence;
    this.stopVoice(false);
    if (this.settings.muted || this.settings.volumes.voice === 0) {
      this.lastVoice = { adapter: "silent-visual", voiceName: null, lang };
      return this.lastVoice;
    }
    this.duckMusic(true);
    try {
      for (const adapter of this.voiceAdapters) {
        try {
          const result = await adapter.speak(text, lang);
          if (sequence === this.voiceSequence) this.lastVoice = result;
          return result;
        } catch {
          // Try the next local adapter. The final adapter is the visual fallback.
        }
      }
      this.lastVoice = { adapter: "silent-visual", voiceName: null, lang };
      return this.lastVoice;
    } finally {
      if (sequence === this.voiceSequence) this.duckMusic(false);
    }
  }

  stopVoice(incrementSequence = true): void {
    if (incrementSequence) this.voiceSequence += 1;
    this.voiceAdapters.forEach((adapter) => adapter.stop());
    this.duckMusic(false);
  }

  private duckMusic(ducked: boolean): void {
    const context = this.context;
    const music = this.gains.get("music");
    if (!context || !music) return;
    const target = this.settings.muted ? 0 : this.settings.volumes.music * (ducked ? 0.32 : 1);
    music.gain.cancelScheduledValues(context.currentTime);
    music.gain.setTargetAtTime(target, context.currentTime, ducked ? 0.045 : 0.16);
  }

  destroy(): void {
    this.stopVoice();
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped sources are harmless.
      }
    }
    this.activeSources.clear();
    const context = this.context;
    this.context = null;
    this.gains.clear();
    if (context && context.state !== "closed") void context.close();
  }
}
