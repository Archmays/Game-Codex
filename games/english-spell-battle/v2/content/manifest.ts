import { ENGLISH_V2_SENTENCES, ENGLISH_V2_SUPPORT_WORDS } from "./sentences";
import { ENGLISH_V2_WORDS } from "./words";
import type { EnglishThemeRecord } from "./types";

export const ENGLISH_V2_CONTENT_REVISION = "wordlight-v2.0.0-20260822";

export const ENGLISH_V2_THEMES: readonly EnglishThemeRecord[] = [
  { id: "animals", title: "动物草甸", subtitle: "Animal Meadow", accent: "#3f9c78", transformationCopy: "草叶亮起来，小动物找到了回家的路。" },
  { id: "home", title: "家与朋友湾", subtitle: "Home & Friends Bay", accent: "#eb8f6a", transformationCopy: "窗灯一盏盏亮起，海湾变得温暖。" },
  { id: "food", title: "阳光食集", subtitle: "Sunlit Food Market", accent: "#e5aa3d", transformationCopy: "摊位摆好了，香气飘过小路。" },
  { id: "actions", title: "动起来公园", subtitle: "Action Park", accent: "#4b83c4", transformationCopy: "风车转动，小路充满脚步声。" },
  { id: "colors", title: "彩数码头", subtitle: "Color & Number Pier", accent: "#8e65bc", transformationCopy: "海面映出颜色，贝壳像星星一样发光。" },
] as const;

export const ENGLISH_V2_SUPPORT_MANIFEST = ENGLISH_V2_SUPPORT_WORDS;

export const ENGLISH_V2_WORD_BY_ID = new Map(ENGLISH_V2_WORDS.map((word) => [word.id, word]));
export const ENGLISH_V2_SENTENCE_BY_ID = new Map(ENGLISH_V2_SENTENCES.map((sentence) => [sentence.id, sentence]));

export function wordsForTheme(themeId: string) {
  return ENGLISH_V2_WORDS.filter((word) => word.themeId === themeId);
}

export function storyWordsForTheme(themeId: string) {
  return ENGLISH_V2_WORDS.filter((word) => word.themeId === themeId && word.storyBand === "story-core");
}

export function optionalWordsForTheme(themeId: string) {
  return ENGLISH_V2_WORDS.filter((word) => word.themeId === themeId && word.storyBand === "optional");
}

export { ENGLISH_V2_WORDS, ENGLISH_V2_SENTENCES };
