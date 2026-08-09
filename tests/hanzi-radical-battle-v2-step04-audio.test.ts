import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FINAL_GOLDEN_MANIFEST,
  FIRST_RUN_CHARACTER_IDS,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";
import {
  AudioDirector,
  DEFAULT_AUDIO_SETTINGS,
  SilentVisualFallback,
  type VoiceAdapter,
  type VoiceResult,
} from "../games/hanzi-radical-battle/v2/golden-slice/phaser/AudioDirector";

const repositoryRoot = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 04 audio revision", () => {
  it("keeps pinyin visual while defining the four exact parent-requested utterances", () => {
    const firstRun = FINAL_GOLDEN_MANIFEST.filter((character) => FIRST_RUN_CHARACTER_IDS.includes(character.id as never));
    expect(firstRun.map((character) => character.spokenPhrase)).toEqual([
      "明，明亮的明。",
      "花，花朵的花。",
      "林，树林的林。",
      "星，星星的星。",
    ]);
    expect(firstRun.map((character) => character.visualPinyin)).toEqual(["míng", "huā", "lín", "xīng"]);
  });

  it("gives all twelve a non-pinyin Chinese phrase derived from accepted glyph and familiar word", () => {
    expect(FINAL_GOLDEN_MANIFEST).toHaveLength(12);
    for (const character of FINAL_GOLDEN_MANIFEST) {
      expect(character.visualPinyin).toBe(character.pinyin);
      expect(character.spokenPhrase).toBe(`${character.glyph}，${character.familiarWord}的${character.glyph}。`);
      expect(character.spokenPhrase).not.toMatch(/[A-Za-z0-9]/u);
      expect(character.spokenPhrase).not.toContain(character.visualPinyin);
    }
  });

  it("passes only spokenPhrase to voice adapters and preserves mute and silent fallback", async () => {
    const spoken: Array<{ text: string; lang: string }> = [];
    const adapter: VoiceAdapter = {
      id: "speech-synthesis",
      async speak(text, lang): Promise<VoiceResult> {
        spoken.push({ text, lang });
        return { adapter: "speech-synthesis", voiceName: "fixture-only", lang };
      },
      stop() {},
    };
    const director = new AudioDirector(DEFAULT_AUDIO_SETTINGS, [adapter, new SilentVisualFallback()]);
    const character = FINAL_GOLDEN_MANIFEST[0];
    await director.speak(character.spokenPhrase);
    expect(spoken).toEqual([{ text: "明，明亮的明。", lang: "zh-CN" }]);

    director.setMuted(true);
    expect(await director.speak(character.spokenPhrase)).toEqual({ adapter: "silent-visual", voiceName: null, lang: "zh-CN" });
    expect(spoken).toHaveLength(1);

    const fallback = new AudioDirector(DEFAULT_AUDIO_SETTINGS, [{ ...adapter, speak: async () => { throw new Error("fixture failure"); } }, new SilentVisualFallback()]);
    expect(await fallback.speak(character.spokenPhrase)).toEqual({ adapter: "silent-visual", voiceName: null, lang: "zh-CN" });
    director.destroy();
    fallback.destroy();
  });

  it("binds runtime and STEP 03 review TTS directly to the shared spokenPhrase field", () => {
    const overlay = readFileSync(resolve(repositoryRoot, "games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts"), "utf8");
    const review = readFileSync(resolve(repositoryRoot, "apps/hanzi-v2-step03-review/index.ts"), "utf8");
    expect(overlay).toContain("audio.speak(character.spokenPhrase)");
    expect(review).toContain("new SpeechSynthesisUtterance(character.spokenPhrase)");
    expect(`${overlay}\n${review}`).not.toMatch(/(?:audio\.speak|SpeechSynthesisUtterance)\([^\n)]*\.pinyin/u);
  });
});
