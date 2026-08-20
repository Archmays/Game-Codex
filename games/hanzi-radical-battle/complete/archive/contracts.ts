import { M4_REPAIR_OBJECTS } from "../../v2/chapter-one/camp";
import { M5_BEHAVIORS, M5_BOSSES } from "../../v2/chapter-one/m5-content";
import { CHAPTER_TWO_BEHAVIORS, CHAPTER_TWO_BOSSES, CHAPTER_TWO_REPAIRS } from "../chapters/chapter-two/contracts";
import { CHAPTER_THREE_BEHAVIORS, CHAPTER_THREE_BOSSES, CHAPTER_THREE_REPAIRS } from "../chapters/chapter-three/contracts";
import type { CompleteEngineChapterId } from "../core/complete-types";
import { COMPLETE_REPAIR_IDS, type CompleteRepairId } from "../core/world-contracts";

export interface CompleteRepairArchiveEntry {
  readonly id: CompleteRepairId;
  readonly name: string;
  readonly chapterId: CompleteEngineChapterId;
  readonly before: { readonly shape: string; readonly function: string; readonly light: string };
  readonly after: { readonly shape: string; readonly function: string; readonly light: string };
  readonly interaction: string;
  readonly childValue: string;
  readonly learningConnection: string;
  readonly persistence: "local-durable";
  readonly saveField: "repairedObjectIds";
}

const chapterOneRepairs = M4_REPAIR_OBJECTS.map((repair) => ({
  id: repair.id,
  name: repair.name,
  chapterId: "chapter-one" as const,
  before: { shape: repair.beforeShape, function: repair.beforeFunction, light: repair.beforeColor },
  after: {
    shape: repair.afterShape,
    function: repair.id === "spellbook-house" ? "可以进入七十二字魔法书" : repair.id === "stargazing-platform" ? "七十二道核心字光组成森林星图" : repair.afterFunction,
    light: repair.afterColor,
  },
  interaction: `轻触${repair.name}可重看它从“${repair.beforeShape}”恢复成“${repair.afterShape}”的变化，不会重置故事。`,
  childValue: repair.childValue,
  learningConnection: repair.id === "spellbook-house" ? "重放七十二个核心完整字的合字、读音和字义魔法" : repair.id === "stargazing-platform" ? "把七十二个核心完整汉字作为长期可见成果" : repair.hanziLearningValue,
  persistence: "local-durable" as const,
  saveField: "repairedObjectIds" as const,
}));

export const COMPLETE_REPAIR_ARCHIVE = [
  ...chapterOneRepairs,
  ...CHAPTER_TWO_REPAIRS.map((repair) => ({ ...repair, chapterId: "chapter-two" as const })),
  ...CHAPTER_THREE_REPAIRS.map((repair) => ({ ...repair, chapterId: "chapter-three" as const })),
] as const satisfies readonly CompleteRepairArchiveEntry[];

export interface CompleteBossArchiveEntry {
  readonly id: string;
  readonly name: string;
  readonly chapterId: CompleteEngineChapterId;
  readonly shortStory: string;
  readonly phaseCount: number;
  readonly telegraph: string;
  readonly effect: string;
  readonly recovery: string;
  readonly learningConnection: string;
  readonly replayHref: string;
}

const chapterOneBosses = M5_BOSSES.map((boss, index) => {
  const behaviors = boss.id === "ink-king-core"
    ? [M5_BEHAVIORS[0], M5_BEHAVIORS[4], M5_BEHAVIORS[8]]
    : M5_BEHAVIORS.filter((behavior) => behavior.regionId === boss.regionId);
  return {
    id: boss.id,
    name: boss.name,
    chapterId: "chapter-one" as const,
    shortStory: boss.shortStory,
    phaseCount: boss.phaseCount,
    telegraph: behaviors.map((behavior) => behavior.telegraph).join(" "),
    effect: behaviors.map((behavior) => behavior.effect).join(" "),
    recovery: behaviors.map((behavior) => behavior.guaranteedRecovery).join(" "),
    learningConnection: boss.hanziLearningValue,
    replayHref: `?play=hanzi-magic-complete&from=hub&chapter=one&fresh=1&seed=archive-boss-${index + 1}`,
  };
});

const chapterTwoBosses = CHAPTER_TWO_BOSSES.map((boss, index) => {
  const behaviors = boss.behaviorIds.map((id) => CHAPTER_TWO_BEHAVIORS.find((behavior) => behavior.id === id)!);
  return {
    id: boss.id,
    name: boss.name,
    chapterId: "chapter-two" as const,
    shortStory: `${boss.name}守着已经学过的字脉动作，等待完整字把根线重新理清。`,
    phaseCount: Math.max(1, behaviors.length),
    telegraph: behaviors.map((behavior) => behavior.telegraph).join(" "),
    effect: behaviors.map((behavior) => behavior.effect).join(" "),
    recovery: behaviors.map((behavior) => behavior.guaranteedRecovery).join(" "),
    learningConnection: "只复用已经练过的完整合字与真实共享部件连接，不在守关时加入新规则。",
    replayHref: `?play=hanzi-magic-complete&from=hub&chapter=two&fresh=1&seed=archive-boss-${index + 1}`,
  };
});

const chapterThreeBosses = CHAPTER_THREE_BOSSES.map((boss, index) => {
  const behaviors = boss.behaviorIds.map((id) => CHAPTER_THREE_BEHAVIORS.find((behavior) => behavior.id === id)!);
  return {
    id: boss.id,
    name: boss.name,
    chapterId: "chapter-three" as const,
    shortStory: `${boss.name}守着词带与灯路，等待两个完整字按真实词序重新共鸣。`,
    phaseCount: Math.max(1, behaviors.length),
    telegraph: behaviors.map((behavior) => behavior.telegraph).join(" "),
    effect: behaviors.map((behavior) => behavior.effect).join(" "),
    recovery: behaviors.map((behavior) => behavior.guaranteedRecovery).join(" "),
    learningConnection: "只复用已经出现的词序、语境和共鸣规则，不在守关时加入新答案。",
    replayHref: `?play=hanzi-magic-complete&from=hub&chapter=three&fresh=1&seed=archive-boss-${index + 1}`,
  };
});

export const COMPLETE_BOSS_ARCHIVE = [
  ...chapterOneBosses,
  ...chapterTwoBosses,
  ...chapterThreeBosses,
] as const satisfies readonly CompleteBossArchiveEntry[];

export const COMPLETE_STORY_ARCHIVE_CHAPTERS = [
  { id: "chapter-one", name: "墨迹初醒", place: "旧林营地", replayHref: "?play=hanzi-magic-complete&from=hub&chapter=one&fresh=1&seed=archive-chapter-one" },
  { id: "chapter-two", name: "字脉苏醒", place: "树冠与清泉", replayHref: "?play=hanzi-magic-complete&from=hub&chapter=two&fresh=1&seed=archive-chapter-two" },
  { id: "chapter-three", name: "万象共鸣", place: "家灯与书港", replayHref: "?play=hanzi-magic-complete&from=hub&chapter=three&fresh=1&seed=archive-chapter-three" },
] as const;

if (COMPLETE_REPAIR_ARCHIVE.length !== 16 || new Set(COMPLETE_REPAIR_ARCHIVE.map((repair) => repair.id)).size !== 16 || !COMPLETE_REPAIR_IDS.every((id) => COMPLETE_REPAIR_ARCHIVE.some((repair) => repair.id === id))) {
  throw new Error("Complete repair archive requires all 16 persistent world repairs exactly once");
}
if (COMPLETE_BOSS_ARCHIVE.length !== 12 || new Set(COMPLETE_BOSS_ARCHIVE.map((boss) => boss.id)).size !== 12) {
  throw new Error("Complete story archive requires all 12 bosses exactly once");
}
