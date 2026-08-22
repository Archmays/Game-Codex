import type { SoundRhymeMode } from "./types";

export const PINYIN_SAVE_KEY = "family-games/chinese-support/pinyin/v1";
export const LEGACY_PINYIN_SAVE_KEY = "family-games/pinyin-magic-battle/progress";

export interface PinyinSupportSave {
  readonly version: 1;
  readonly selectedMode: SoundRhymeMode;
  readonly completedChallengeIds: readonly string[];
  readonly hintLevel: number;
  readonly muted: boolean;
  readonly contentRevision: string;
}

export function freshPinyinSave(mode: SoundRhymeMode, revision: string): PinyinSupportSave {
  return { version: 1, selectedMode: mode, completedChallengeIds: [], hintLevel: 0, muted: false, contentRevision: revision };
}

export function readPinyinSave(mode: SoundRhymeMode, revision: string, storage: Storage = window.localStorage): PinyinSupportSave {
  try {
    const parsed = JSON.parse(storage.getItem(PINYIN_SAVE_KEY) ?? "null") as Partial<PinyinSupportSave> | null;
    if (!parsed || parsed.version !== 1) return freshPinyinSave(mode, revision);
    return {
      version: 1,
      selectedMode: ["assemble", "tone", "contrast"].includes(parsed.selectedMode ?? "") ? parsed.selectedMode! : mode,
      completedChallengeIds: Array.isArray(parsed.completedChallengeIds) ? parsed.completedChallengeIds.filter((id): id is string => typeof id === "string") : [],
      hintLevel: Math.max(0, Math.min(4, Number(parsed.hintLevel) || 0)),
      muted: parsed.muted === true,
      contentRevision: typeof parsed.contentRevision === "string" ? parsed.contentRevision : revision,
    };
  } catch {
    return freshPinyinSave(mode, revision);
  }
}

export function writePinyinSave(save: PinyinSupportSave, storage: Storage = window.localStorage): void {
  try { storage.setItem(PINYIN_SAVE_KEY, JSON.stringify(save)); } catch { /* Local play remains available without persistence. */ }
}
