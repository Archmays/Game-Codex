import {
  FINAL_GOLDEN_MANIFEST,
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_SLICE_ENCOUNTERS,
  THEME_C_PROCEDURAL_ASSETS,
} from "../../games/hanzi-radical-battle/v2/golden-slice/content";
import { createRevisionHash } from "../../games/hanzi-radical-battle/v2/content/revision-hash";
import { STEP03_REVIEW_IDENTITY } from "./review-identity";
import campSeedPreview from "./assets/imagegen/C-CAMP-01.webp";
import charactersSeedPreview from "./assets/imagegen/C-CHARACTERS-01.webp";
import abilitiesSeedPreview from "./assets/imagegen/C-ABILITIES-01.webp";

export type Step03ReviewItemId =
  | "slice-preview"
  | "final-manifest"
  | "encounter-structure"
  | "ability-trio"
  | "two-phase-boss"
  | "theme-c"
  | "audio-and-accessibility"
  | "child-use-gate";

export interface Step03ReviewItem {
  readonly id: Step03ReviewItemId;
  readonly tabId: Step03ReviewTabId;
  readonly title: string;
  readonly childValue: string;
  readonly learningValue: string;
  readonly automaticEvidence: string;
  readonly observationNeed: string;
  readonly dependsOn: readonly Step03ReviewItemId[];
  readonly alwaysReview: boolean;
  readonly revisionHash: string;
}

export type Step03ReviewTabId =
  | "scope"
  | "golden-slice"
  | "manifest"
  | "abilities"
  | "boss"
  | "assets"
  | "audio"
  | "child-gate"
  | "summary";

export const STEP03_REVIEW_TABS: ReadonlyArray<{ id: Step03ReviewTabId; label: string; number: string }> = [
  { id: "scope", label: "Scope / Carry-forward", number: "01" },
  { id: "golden-slice", label: "完整 Golden Slice", number: "02" },
  { id: "manifest", label: "12 字 Manifest", number: "03" },
  { id: "abilities", label: "三能力", number: "04" },
  { id: "boss", label: "Boss", number: "05" },
  { id: "assets", label: "主题 C / 资产", number: "06" },
  { id: "audio", label: "音频 / 读音", number: "07" },
  { id: "child-gate", label: "儿童 First-Use Gate", number: "08" },
  { id: "summary", label: "总结 / 导出", number: "09" },
];

export const THEME_C_IMAGEGEN_SEED_PREVIEWS = [
  { id: "camp", label: "C-CAMP-01", src: campSeedPreview },
  { id: "characters", label: "C-CHARACTERS-01", src: charactersSeedPreview },
  { id: "abilities", label: "C-ABILITIES-01", src: abilitiesSeedPreview },
] as const;

function itemHash(id: Step03ReviewItemId, payload: unknown): string {
  return createRevisionHash("hanzi-v2-step03-review-item", {
    id,
    implementationReviewVersion: STEP03_REVIEW_IDENTITY.implementationReviewVersion,
    payload,
  });
}

export const STEP03_REVIEW_ITEMS: readonly Step03ReviewItem[] = [
  {
    id: "slice-preview",
    tabId: "golden-slice",
    title: "完整 3–5 分钟黄金样板",
    childValue: "从营地进入、四次成字、一次选择与回营变化组成一条可理解的小冒险。",
    learningValue: "每次完整字形成都先显示真实结构，再连接读音、熟悉词、意义魔法和世界变化。",
    automaticEvidence: "隐藏 play 路由、首个施法时限、关键状态与本地存档可在浏览器验证。",
    observationNeed: "孩子是否主动进入、看懂第一步，并把营地变化归因于汉字魔法。",
    dependsOn: ["final-manifest", "encounter-structure"],
    alwaysReview: false,
    revisionHash: itemHash("slice-preview", {
      identity: STEP03_REVIEW_IDENTITY,
      encounterIds: GOLDEN_SLICE_ENCOUNTERS.map((entry) => entry.id),
    }),
  },
  {
    id: "final-manifest",
    tabId: "manifest",
    title: "最终 12 字可玩清单",
    childValue: "范围小且稳定，不把未审核的大母库随机带进儿童手牌。",
    learningValue: "字形、结构、部件、拼音、熟悉词、短义和意义魔法按同一条目核对。",
    automaticEvidence: "12 个稳定 ID、revision hash、first-run 四字与 accepted-deferred 三字可检查。",
    observationNeed: "成人仍需判断每一条的熟悉度、读音、词义、字形和年龄适配。",
    dependsOn: [],
    alwaysReview: false,
    revisionHash: itemHash("final-manifest", FINAL_GOLDEN_MANIFEST.map((entry) => ({
      id: entry.id,
      revisionHash: entry.revisionHash,
      stage: entry.stage,
    }))),
  },
  {
    id: "encounter-structure",
    tabId: "golden-slice",
    title: "四次五牌真实结构操作",
    childValue: "每次只有五张可点的牌，能尝试、撤回和温和再试。",
    learningValue: "明/林使用左右，花/星使用上下；双木保留实例身份，不能只按字面猜。",
    automaticEvidence: "每场五牌、槽位 ID、两/三部件唯一解审计、44px 控件和键盘路径。",
    observationNeed: "孩子是否会改变左右与上下的放置策略，而不是只等待提示。",
    dependsOn: ["final-manifest"],
    alwaysReview: false,
    revisionHash: itemHash("encounter-structure", GOLDEN_SLICE_ENCOUNTERS),
  },
  {
    id: "ability-trio",
    tabId: "abilities",
    title: "三个不代答的能力",
    childValue: "三种可读的帮助带来不同的恢复方式，而不是压力或数值竞赛。",
    learningValue: "所有能力都只显示槽位、恢复快照或提供提示，不会选牌、移牌或完成汉字。",
    automaticEvidence: "恰好三项、每个首领阶段一次、neverAutoSolves 与 Boss 事件可测试。",
    observationNeed: "孩子能否说出自己选择了什么，并注意到它在后面怎样帮忙。",
    dependsOn: ["encounter-structure"],
    alwaysReview: false,
    revisionHash: itemHash("ability-trio", GOLDEN_ABILITIES),
  },
  {
    id: "two-phase-boss",
    tabId: "boss",
    title: "林→星两阶段小首领",
    childValue: "可预读的高潮允许温和恢复或回营，不依赖生命值消耗战。",
    learningValue: "只综合已经出现过的左右和上下结构，检查迁移而非增加新规则。",
    automaticEvidence: "两阶段状态、干扰意图、safe retry、能力效果和持久进度边界。",
    observationNeed: "遇到干扰时，孩子是否理解下一步并愿意尝试另一种办法。",
    dependsOn: ["encounter-structure", "ability-trio"],
    alwaysReview: false,
    revisionHash: itemHash("two-phase-boss", GOLDEN_BOSS_PHASES),
  },
  {
    id: "theme-c",
    tabId: "assets",
    title: "主题 C 程序化世界方向",
    childValue: "墨迹森林、营地、字灵与首领形成一致的安全冒险氛围。",
    learningValue: "世界画面服务于部件、完整字和对应世界效果，而不遮蔽结构。",
    automaticEvidence: "Theme C 固定程序化资产 key、关键状态截图与无远程素材请求。",
    observationNeed: "成人判断视觉是否舒适、清楚，且不会让孩子误解为练习页或紧张战斗。",
    dependsOn: [],
    alwaysReview: false,
    revisionHash: itemHash("theme-c", THEME_C_PROCEDURAL_ASSETS),
  },
  {
    id: "audio-and-accessibility",
    tabId: "audio",
    title: "可选声音与减少动态",
    childValue: "安静或运动敏感场景仍能完整理解状态，不出现惊吓式强反馈。",
    learningValue: "静音和减少动态时，结构、成字、读音文字和世界变化仍然可见。",
    automaticEvidence: "静音、减少动态、持久化、无外部音频与状态替代提示的浏览器检查。",
    observationNeed: "在静音和减少动态下，孩子是否仍能看懂部件如何组成完整字。",
    dependsOn: ["slice-preview", "theme-c"],
    alwaysReview: false,
    revisionHash: itemHash("audio-and-accessibility", {
      contract: "optional-local-audio-reduced-motion-v1",
      selectedTheme: "C",
    }),
  },
  {
    id: "child-use-gate",
    tabId: "child-gate",
    title: "真实儿童首次使用门禁",
    childValue: "在成人确认前不把技术候选当成默认儿童入口，也不收集儿童画像。",
    learningValue: "观察只关注真实结构使用、选择理解和世界变化注意，不从数据推断学习效果。",
    automaticEvidence: "本地-only、无账号/遥测、家长导出与清除入口、guarded launcher 默认拒绝。",
    observationNeed: "仅在家长明确 YES 后，由真实儿童和观察者完成固定本地观察。",
    dependsOn: ["slice-preview", "final-manifest", "encounter-structure", "ability-trio", "two-phase-boss", "theme-c", "audio-and-accessibility"],
    alwaysReview: true,
    revisionHash: itemHash("child-use-gate", {
      contract: "parent-confirmed-local-child-observation-v1",
      privacy: "no-network-no-account-no-telemetry",
    }),
  },
] as const;

export function getStep03ReviewItem(id: Step03ReviewItemId): Step03ReviewItem {
  const item = STEP03_REVIEW_ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown STEP 03 review item: ${id}`);
  return item;
}
