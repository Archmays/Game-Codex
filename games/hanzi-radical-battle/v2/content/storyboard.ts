import { createRevisionHash } from "./revision-hash";

export interface StoryboardBeat {
  id: string;
  order: number;
  title: string;
  implementationStatus: "pilot-implemented" | "display-only-not-implemented";
  childFacingMoment: string;
  worldChange: string;
  reviewQuestion: string;
  dependsOnCandidateIds: readonly string[];
  revisionHash: string;
}

export const STORYBOARD_MANIFEST_VERSION = "step02-storyboard-v2";

type StoryboardReviewPayload = Omit<StoryboardBeat, "revisionHash">;

export function computeStoryboardRevisionHash(beat: StoryboardReviewPayload): string {
  return createRevisionHash(STORYBOARD_MANIFEST_VERSION, beat);
}

const STORYBOARD_SEEDS: readonly StoryboardReviewPayload[] = [
  {
    id: "story-camp",
    order: 1,
    title: "营地",
    implementationStatus: "pilot-implemented",
    childFacingMoment: "先看见属于自己的安全营地、墨点伙伴和一盏暗下来的灯，世界里只有一个可行动作。",
    worldChange: "建立“这里需要光”的冒险原因，不展示课程目录或成绩指标。",
    reviewQuestion: "孩子会想沿着灯路出发，而不是把这里理解为练习首页吗？",
    dependsOnCandidateIds: [],
  },
  {
    id: "story-first-battle",
    order: 2,
    title: "第一战",
    implementationStatus: "pilot-implemented",
    childFacingMoment: "五张字灵出现；把日、月放回左右槽后，完整“明”形成、读出“明亮”，光从汉字本身吹散迷墨。",
    worldChange: "第一场把真实结构操作、完整字与有意义的法术连成一条因果链。",
    reviewQuestion: "第一次完整施法是像魔法冒险，还是仍像答题后播放奖励？",
    dependsOnCandidateIds: ["ming"],
  },
  {
    id: "story-second-battle",
    order: 3,
    title: "第二战",
    implementationStatus: "display-only-not-implemented",
    childFacingMoment: "未来黄金样板才会用另一候选字和已见过的部分组件，观察孩子是否把结构方法迁移到新局面。",
    worldChange: "只规划一次有意义的变化，不增加新系统或随机大牌池。",
    reviewQuestion: "第二战应复现哪些部件，才能检验理解而不是背住第一题？",
    dependsOnCandidateIds: [],
  },
  {
    id: "story-three-choice",
    order: 4,
    title: "三选一",
    implementationStatus: "display-only-not-implemented",
    childFacingMoment: "未来只呈现三个清楚、无稀有度和价格的能力方向；选择改变下一次合字反馈，但不替代合字。",
    worldChange: "让自主选择对随后世界表现有可见后果，不制造错过焦虑。",
    reviewQuestion: "这个选择是否真的影响玩法，又不会成为奖励商店？",
    dependsOnCandidateIds: [],
  },
  {
    id: "story-small-boss",
    order: 5,
    title: "小首领",
    implementationStatus: "display-only-not-implemented",
    childFacingMoment: "未来用已见结构完成一个两阶段小高潮；困难时可以温和再试或回营，永久发现不丢失。",
    worldChange: "让前面的能力选择生效，但不引入生命值羞辱、倒计时或惩罚性损失。",
    reviewQuestion: "高潮能否证明孩子会用已学方法，同时仍保持低压力？",
    dependsOnCandidateIds: [],
  },
  {
    id: "story-return-repair",
    order: 6,
    title: "回营修复",
    implementationStatus: "pilot-implemented",
    childFacingMoment: "回到同一营地，看见被“明”修好的灯持续发光；刷新页面后变化仍然保留。",
    worldChange: "把掌握与永久世界变化连接，不使用连续登录或外部奖励。",
    reviewQuestion: "孩子是否会主动注意到同一个物件改变，并把变化归因于汉字魔法？",
    dependsOnCandidateIds: ["ming"],
  },
  {
    id: "story-spellbook",
    order: 7,
    title: "魔法书",
    implementationStatus: "pilot-implemented",
    childFacingMoment: "“明”进入字灵书，条目重现字形、读音、熟悉词、短义和日/月的真实槽位。",
    worldChange: "给发现一个可回看的本地归宿，不显示分数、排名或儿童画像。",
    reviewQuestion: "结尾是否像一次小冒险完成，并让孩子愿意认出刚获得的字？",
    dependsOnCandidateIds: ["ming"],
  },
] as const;

export const STEP02_STORYBOARD: readonly StoryboardBeat[] = STORYBOARD_SEEDS.map((beat) => ({
  ...beat,
  revisionHash: computeStoryboardRevisionHash(beat),
}));
