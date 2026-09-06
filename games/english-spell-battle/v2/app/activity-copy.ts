import { ENGLISH_V2_WORD_BY_ID } from "../content/manifest";
import type { EnglishThemeId } from "../content/types";
import { isPilotTask, type PilotTaskId } from "../pilot/model";
import type { EnglishWorldSaveV3 } from "../save/save";

const SCENE_ACTIONS: Record<PilotTaskId, string> = {
  "word-run": "选落点，让角色跑起来",
  "word-jump": "选落点，让角色跳过去",
  "word-red": "选贝壳，涂成红色",
  "word-blue": "选小船，涂成蓝色",
  "word-one": "选一枚贝壳，让它发光",
  "word-two": "选两艘小船，让它们启航",
};

export function activityAction(id: string): string {
  return isPilotTask(id) ? SCENE_ACTIONS[id] : "看图拼词";
}

export function regionActivityCopy(id: EnglishThemeId): string {
  if (id === "actions") return "用 run、jump 选落点，让角色跑或跳；也能看图拼词。";
  if (id === "colors") return "给贝壳、小船换颜色，选数量让它们发光或启航；也能看图拼词。";
  return "看图片，跟着词光拼一拼，再把词放进句子。";
}

/** Labels describe existing historical events, never inferred spelling mastery. */
export function activityHistory(id: string, save: EnglishWorldSaveV3): string {
  const word = ENGLISH_V2_WORD_BY_ID.get(id);
  const labels: string[] = [];
  if (isPilotTask(id) && save.interactions[id]?.interactionCompleted) labels.push("场景玩过");
  if (save.completedStoryWordIds.includes(id) || word?.sentenceIds.some(sentenceId => save.completedSentenceIds.includes(sentenceId))) labels.push("词卡活动完成过");
  if (labels.length) return labels.join(" · ");
  return word?.storyBand === "optional" ? "拓展词 · 来看看这个词" : isPilotTask(id) ? "来场景里试一试" : "来看看、拼一拼";
}
