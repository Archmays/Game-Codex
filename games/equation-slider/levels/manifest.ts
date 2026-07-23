import type { ChapterManifestEntry, PublishedEquationSliderLevel } from "../types";
import { parsePublishedChapter } from "../schema";

export const equationSliderChapterManifest: readonly ChapterManifestEntry[] = [
  {
    id: "chapter-1",
    number: 1,
    name: "加法启程线",
    subtitle: "从两个部分出发，沿着轨道找到和与组成 10。",
    recommendedAgeBand: "约 6–7 岁",
    readinessNote: "能辨认 0–20 就可以开始；前 3 关会带你认识滑轨。",
    color: "coral",
    levelCount: 50,
    units: [
      { id: "chapter-1-station-1", name: "小数合成站", shortGoal: "认识中央线与部分—整体", skillTags: ["part-whole", "addition"], levelCount: 10 },
      { id: "chapter-1-station-2", name: "组成 10 站", shortGoal: "找到组成 10 的数对", skillTags: ["make-ten", "commutative-addition"], levelCount: 10 },
      { id: "chapter-1-station-3", name: "跨十桥站", shortGoal: "完成 20 以内与两步加法", skillTags: ["within-20-addition", "make-ten"], levelCount: 10 },
      { id: "chapter-1-station-4", name: "灵活凑整站", shortGoal: "比较不同凑整与覆盖路线", skillTags: ["compensation", "coverage-strategy"], levelCount: 10 },
      { id: "chapter-1-station-5", name: "加法总站", shortGoal: "迁移并复习加法关系", skillTags: ["addition-transfer", "coverage-strategy"], levelCount: 10 }
    ]
  },
  {
    id: "chapter-2",
    number: 2,
    name: "加减换轨线",
    subtitle: "从拿走、比较到算式家族，看见加减之间的联系。",
    recommendedAgeBand: "约 6–8 岁",
    readinessNote: "接触过 20 以内加减会更顺手，也可以随时回到加法线复习。",
    color: "teal",
    levelCount: 50,
    units: [
      { id: "chapter-2-station-1", name: "拿走站", shortGoal: "理解减法表示还剩多少", skillTags: ["take-away", "subtraction"], levelCount: 10 },
      { id: "chapter-2-station-2", name: "相差站", shortGoal: "用减法比较相差多少", skillTags: ["difference", "subtraction"], levelCount: 10 },
      { id: "chapter-2-station-3", name: "算式家族站", shortGoal: "联系加法与减法", skillTags: ["fact-family", "inverse-operations"], levelCount: 10 },
      { id: "chapter-2-station-4", name: "两步换轨站", shortGoal: "按从左到右完成两步加减", skillTags: ["left-to-right-add-sub", "two-step"], levelCount: 10 },
      { id: "chapter-2-station-5", name: "加减总站", shortGoal: "交错使用加减与覆盖策略", skillTags: ["add-sub-transfer", "coverage-strategy"], levelCount: 10 }
    ]
  },
  {
    id: "chapter-3",
    number: 3,
    name: "乘除工坊线",
    subtitle: "把相同的组装进工坊，再用平均分把关系倒过来看。",
    recommendedAgeBand: "约 7–10 岁",
    readinessNote: "知道“几组相同数量”会更容易；不要求快速背诵乘法表。",
    color: "gold",
    levelCount: 50,
    units: [
      { id: "chapter-3-station-1", name: "二五十工坊", shortGoal: "观察 2、5、10 的乘法规律", skillTags: ["multiplication-groups", "times-2-5-10"], levelCount: 10 },
      { id: "chapter-3-station-2", name: "三四六工坊", shortGoal: "组合 3、4、6 的乘法事实", skillTags: ["multiplication-facts", "doubling"], levelCount: 10 },
      { id: "chapter-3-station-3", name: "平均分站", shortGoal: "理解整除与平均分", skillTags: ["exact-division", "equal-sharing"], levelCount: 10 },
      { id: "chapter-3-station-4", name: "乘除互逆站", shortGoal: "用乘法检查除法", skillTags: ["multiply-divide-inverse", "inverse-operations"], levelCount: 10 },
      { id: "chapter-3-station-5", name: "顺序工坊", shortGoal: "先乘除、后加减", skillTags: ["order-of-operations", "mixed-operations"], levelCount: 10 }
    ]
  },
  {
    id: "chapter-4",
    number: 4,
    name: "平衡与推理总线",
    subtitle: "同时看目标、等号与覆盖路线，把四则关系连成一张网。",
    recommendedAgeBand: "约 8–10 岁",
    readinessNote: "理解基本四则和简单等式即可挑战；前三条线路始终可以自由复习。",
    color: "lilac",
    levelCount: 50,
    units: [
      { id: "chapter-4-station-1", name: "多目标站", shortGoal: "规划 2–3 个目标与 tile 覆盖", skillTags: ["multi-target", "coverage-planning"], levelCount: 10 },
      { id: "chapter-4-station-2", name: "等式平衡站", shortGoal: "理解等号表示两边同值", skillTags: ["equal-sign", "balance"], levelCount: 10 },
      { id: "chapter-4-station-3", name: "综合策略站", shortGoal: "比较四则运算的覆盖路线", skillTags: ["mixed-operations", "coverage-strategy"], levelCount: 10 },
      { id: "chapter-4-station-4", name: "唯一路线站", shortGoal: "排除分支，找到唯一最小覆盖集合", skillTags: ["unique-route", "deductive-reasoning"], levelCount: 10 },
      { id: "chapter-4-station-5", name: "全线路总站", shortGoal: "迁移四章关系并自由复习", skillTags: ["cross-chapter-transfer", "equation-reasoning"], levelCount: 10 }
    ]
  }
];

export async function loadEquationSliderChapter(chapterId: string): Promise<readonly PublishedEquationSliderLevel[]> {
  if (chapterId === "chapter-1") {
    const chapter = await import("./chapter-1-addition.json");
    return parsePublishedChapter(chapter.default, chapterId);
  }
  if (chapterId === "chapter-2") {
    const chapter = await import("./chapter-2-add-sub.json");
    return parsePublishedChapter(chapter.default, chapterId);
  }
  if (chapterId === "chapter-3") {
    const chapter = await import("./chapter-3-mul-div.json");
    return parsePublishedChapter(chapter.default, chapterId);
  }
  if (chapterId === "chapter-4") {
    const chapter = await import("./chapter-4-reasoning.json");
    return parsePublishedChapter(chapter.default, chapterId);
  }
  throw new Error(`Unknown equation slider chapter: ${chapterId}`);
}

export function findChapterManifest(chapterId: string): ChapterManifestEntry | undefined {
  return equationSliderChapterManifest.find((chapter) => chapter.id === chapterId);
}
