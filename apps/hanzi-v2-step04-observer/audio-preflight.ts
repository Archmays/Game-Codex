import type { FirstUseAudioChoice } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/session";

export interface AudioPreflightCharacter {
  readonly id: "ming" | "hua" | "lin" | "xing";
  readonly glyph: string;
  readonly visualPinyin: string;
  readonly familiarWord: string;
  readonly spokenPhrase: string;
}

export interface AudioPreflightState {
  readonly decision: FirstUseAudioChoice | "CANCEL" | null;
  readonly checkedCharacterIds: readonly AudioPreflightCharacter["id"][];
  readonly adapter: "speech-synthesis" | "silent-visual";
  readonly lang: "zh-CN" | null;
  readonly voiceCategory: "ZH_CN_DEVICE_VOICE" | "ZH_DEVICE_VOICE" | "DEFAULT_DEVICE_VOICE" | "NONE";
}

export interface AudioPreflightHandle {
  getState(): AudioPreflightState;
  destroy(): void;
}

export interface AudioPreflightOptions {
  readonly characters: readonly AudioPreflightCharacter[];
  readonly onStateChange?: (state: AudioPreflightState) => void;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function chineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === "zh-cn") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ?? null;
}

function voiceCategory(voice: SpeechSynthesisVoice | null): AudioPreflightState["voiceCategory"] {
  if (!voice) return "DEFAULT_DEVICE_VOICE";
  return voice.lang.toLowerCase() === "zh-cn" ? "ZH_CN_DEVICE_VOICE" : "ZH_DEVICE_VOICE";
}

function initialDiagnostic(): { adapter: AudioPreflightState["adapter"]; lang: AudioPreflightState["lang"]; voiceCategory: AudioPreflightState["voiceCategory"]; label: string } {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined" || typeof window.SpeechSynthesisUtterance === "undefined") {
    return { adapter: "silent-visual", lang: null, voiceCategory: "NONE", label: "silent-visual · 无可用浏览器 TTS" };
  }
  const voice = chineseVoice();
  return {
    adapter: "speech-synthesis",
    lang: "zh-CN",
    voiceCategory: voiceCategory(voice),
    label: `speech-synthesis · ${voiceCategory(voice)} · zh-CN`,
  };
}

export function mountAudioPreflight(root: HTMLElement, options: AudioPreflightOptions): AudioPreflightHandle {
  if (options.characters.length !== 4 || options.characters.map((entry) => entry.id).join(",") !== "ming,hua,lin,xing") {
    throw new Error("STEP 04 audio preflight requires 明、花、林、星 in accepted first-run order");
  }
  let decision: AudioPreflightState["decision"] = null;
  const checked = new Set<AudioPreflightCharacter["id"]>();
  let diagnostic = initialDiagnostic();
  let destroyed = false;

  const state = (): AudioPreflightState => ({
    decision,
    checkedCharacterIds: options.characters.map((entry) => entry.id).filter((id) => checked.has(id)),
    adapter: diagnostic.adapter,
    lang: diagnostic.lang,
    voiceCategory: diagnostic.voiceCategory,
  });

  const render = (): void => {
    const allChecked = checked.size === options.characters.length;
    root.innerHTML = `<section class="step04-preflight" data-testid="step04-audio-preflight">
      <div class="step04-section-heading">
        <div><span>家长专用 · 每次 session 重新确认</span><h2>音频预检</h2></div>
        <strong class="step04-local-chip">仅本地</strong>
      </div>
      <p class="step04-audio-contract">本轮只修订朗读：拼音继续显示；TTS 只读“汉字 + 熟悉词”，绝不朗读拼音。</p>
      <div class="step04-audio-grid">${options.characters.map((character) => `
        <article class="step04-audio-card ${checked.has(character.id) ? "is-checked" : ""}">
          <div><strong lang="zh-Hans">${escapeHtml(character.glyph)}</strong><span>${escapeHtml(character.visualPinyin)}</span></div>
          <p>${escapeHtml(character.spokenPhrase)}</p>
          <button type="button" data-preflight-speak="${character.id}">${checked.has(character.id) ? "再听一次" : "试听这句"}</button>
        </article>`).join("")}</div>
      <div class="step04-device-diagnostic" aria-live="polite">
        <span>本次设备诊断（不保存 voice name）</span><strong data-audio-diagnostic>${escapeHtml(diagnostic.label)}</strong>
      </div>
      <fieldset class="step04-choice-field"><legend>四句试听后选择本次 session 的声音方式</legend>
        <button type="button" data-audio-decision="SOUND_OK" ${allChecked ? "" : "disabled"} aria-pressed="${decision === "SOUND_OK"}">声音正常</button>
        <button type="button" data-audio-decision="START_MUTED" ${allChecked ? "" : "disabled"} aria-pressed="${decision === "START_MUTED"}">静音开始</button>
        <button type="button" data-audio-decision="CANCEL" aria-pressed="${decision === "CANCEL"}">取消本次</button>
      </fieldset>
      <p class="step04-preflight-status">${allChecked ? "四句已逐一请求试听；请选择声音方式。" : `还需试听 ${options.characters.length - checked.size} 句。即使设备无 TTS，也会保留完整视觉信息。`}</p>
    </section>`;
    bind();
  };

  const notify = (): void => options.onStateChange?.(state());

  const speak = (character: AudioPreflightCharacter): void => {
    checked.add(character.id);
    if (typeof window.speechSynthesis === "undefined" || typeof window.SpeechSynthesisUtterance === "undefined") {
      diagnostic = { adapter: "silent-visual", lang: null, voiceCategory: "NONE", label: "silent-visual · 设备无 TTS，视觉 fallback 完整" };
      render();
      notify();
      return;
    }
    const voice = chineseVoice();
    const utterance = new SpeechSynthesisUtterance(character.spokenPhrase);
    utterance.lang = "zh-CN";
    if (voice) utterance.voice = voice;
    diagnostic = {
      adapter: "speech-synthesis",
      lang: "zh-CN",
      voiceCategory: voiceCategory(voice),
      label: `speech-synthesis · ${voiceCategory(voice)} · zh-CN`,
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    render();
    notify();
  };

  function bind(): void {
    root.querySelectorAll<HTMLButtonElement>("[data-preflight-speak]").forEach((button) => {
      button.addEventListener("click", () => {
        const character = options.characters.find((entry) => entry.id === button.dataset.preflightSpeak);
        if (character) speak(character);
      });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-audio-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.audioDecision;
        if (next !== "SOUND_OK" && next !== "START_MUTED" && next !== "CANCEL") return;
        if (next !== "CANCEL" && checked.size !== options.characters.length) return;
        decision = next;
        render();
        notify();
      });
    });
  }

  render();
  return {
    getState: state,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      root.replaceChildren();
    },
  };
}
