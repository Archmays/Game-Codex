import type { PublishedEquationSliderLevel } from "../../types";
import { FIRST_GOLD_LEVEL } from "./gold-levels";
import { applyGameplayPilot12 } from "./gameplay-pilot-12";
import {
  buildCompleteV3Catalog,
  type GoldTemplateSpec
} from "./generator";

const CHAPTER_1_CONTEXT = {
  prerequisiteTags: ["recognize-1-to-20", "count-forward"],
  misconceptionTags: ["count-all-instead-of-compose", "treat-plus-as-a-tile"],
  recommendedAgeBand: "约 6–7 岁",
  scaffold: "guided",
  conceptHint: "先找总数不变时，两个部分怎样配对。",
  positionHint: "观察中央数字和还没点亮的滑轨格。",
  directionHint: "每次只移动一格，再读一遍完整算式。"
} as const;

const CHAPTER_2_CONTEXT = {
  prerequisiteTags: ["addition-within-20", "compare-quantities"],
  misconceptionTags: ["reverse-subtraction-order", "ignore-operator-change"],
  recommendedAgeBand: "约 7–8 岁",
  scaffold: "supported",
  conceptHint: "先判断这里是在合起来，还是在求相差多少。",
  positionHint: "比较两边数字与中央运算符的组合。",
  directionHint: "先移动能改变运算关系的那条滑轨。"
} as const;

const CHAPTER_3_CONTEXT = {
  prerequisiteTags: ["equal-groups", "basic-facts"],
  misconceptionTags: ["multiply-as-add-once", "divide-with-remainder"],
  recommendedAgeBand: "约 8–9 岁",
  scaffold: "independent",
  conceptHint: "把乘法看成等组，把除法看成平均分。",
  positionHint: "寻找同一积或同一商对应的成对数字。",
  directionHint: "先移动因数或除数，再核对结果是否为整数。"
} as const;

const CHAPTER_4_CONTEXT = {
  prerequisiteTags: ["four-operations", "operation-precedence"],
  misconceptionTags: ["always-left-to-right", "equality-means-answer-next"],
  recommendedAgeBand: "约 9–10 岁",
  scaffold: "transfer",
  conceptHint: "先看等号或目标，再按运算顺序反推每一格。",
  positionHint: "把还没点亮的格与能保持等值的组合一起考虑。",
  directionHint: "一次改变一条滑轨，并解释结果为什么仍满足条件。"
} as const;

export const HAND_AUTHORED_GOLD_TEMPLATES = [
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 1,
    family: "pair-sum",
    target: 6,
    left: [1, 2, 4],
    objective: "用不同的两个数合成 6，并观察加法中的部分与整体。",
    primarySkill: "part-whole-addition",
    skillTags: ["addition", "part-whole", "number-bonds"],
    reflection: "哪两组数字交换了位置，但仍然得到 6？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 2,
    family: "pair-sum",
    target: 7,
    left: [1, 3, 5],
    objective: "找出三组不同的 7 的数对，建立奇数分合表象。",
    primarySkill: "odd-number-bonds",
    skillTags: ["addition", "number-bonds", "odd-numbers"],
    reflection: "离 7 越近的第一个加数，另一个加数怎样变化？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 3,
    family: "pair-sum",
    target: 8,
    left: [1, 2, 5],
    objective: "用补数关系凑成 8，并区分相邻数与补数。",
    primarySkill: "complements-to-eight",
    skillTags: ["addition", "complements", "mental-math"],
    reflection: "你能不逐个数，直接说出 5 还缺几吗？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 4,
    family: "pair-sum",
    target: 9,
    left: [2, 3, 6],
    objective: "借助已知的 10 的分合，推想 9 的数对。",
    primarySkill: "near-ten-bonds",
    skillTags: ["addition", "near-ten", "number-bonds"],
    reflection: "哪一组最接近 5 和 5？为什么？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 5,
    family: "pair-sum",
    target: 10,
    left: [1, 4, 7],
    objective: "熟练识别三组 10 的互补数并用语言说明。",
    primarySkill: "complements-to-ten",
    skillTags: ["addition", "make-ten", "fluency"],
    reflection: "看到 7 时，你怎样最快想到另一个数？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 6,
    family: "three-number-sum",
    target: 12,
    rows: [[1, 4, 7], [2, 5, 5], [3, 6, 3]],
    objective: "把 12 分成三个部分，比较平衡与不平衡的分法。",
    primarySkill: "three-part-composition",
    skillTags: ["addition", "three-addends", "composition"],
    reflection: "三个部分中哪一组最平均？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 7,
    family: "three-number-sum",
    target: 13,
    rows: [[1, 4, 8], [2, 5, 6], [3, 7, 3]],
    objective: "用三个部分组成 13，巩固较大数的部分与整体关系。",
    primarySkill: "three-part-thirteen",
    skillTags: ["addition", "three-addends", "part-whole"],
    reflection: "哪一组可以先把两个数凑成 10？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 8,
    family: "three-number-sum",
    target: 11,
    rows: [[1, 3, 7], [2, 4, 5], [3, 6, 2]],
    mode: "equality",
    rightExpression: [5, "+", 6],
    objective: "用三个加数跨过 10，并验证它们与 5+6 等值。",
    primarySkill: "bridge-through-ten-equality",
    skillTags: ["addition", "bridge-ten", "equality"],
    reflection: "哪一组最适合先凑十再添一？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 9,
    family: "three-number-sum",
    target: 15,
    rows: [[2, 5, 8], [3, 6, 6], [4, 7, 4]],
    objective: "用三个加数合成 15，并寻找成对简算机会。",
    primarySkill: "three-addend-strategy",
    skillTags: ["addition", "three-addends", "associative-strategy"],
    reflection: "你会先把哪两个数合起来？"
  },
  {
    ...CHAPTER_1_CONTEXT,
    chapter: 1,
    order: 10,
    family: "four-number-sum",
    target: 12,
    rows: [[1, 2, 3, 6], [2, 3, 4, 3], [3, 4, 2, 3]],
    objective: "用四个部分组成 12，综合运用补数与凑十策略。",
    primarySkill: "four-part-composition",
    skillTags: ["addition", "four-addends", "strategy-choice"],
    reflection: "四个数中，你会先合并哪一对？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 1,
    family: "mixed-three-reel",
    left: [3, 6, 4],
    operators: ["+", "−", "+"],
    right: [4, 1, 6],
    objective: "同时调节两个数和运算符，辨认加与减的不同关系。",
    primarySkill: "mixed-operation-reading",
    skillTags: ["mixed-operations", "operator-meaning", "comparison"],
    reflection: "哪一种运算让较小的数得到最大的结果？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 2,
    family: "pair-difference",
    difference: 4,
    right: [1, 3, 5],
    objective: "保持差为 4，发现被减数和减数同步变化的规律。",
    primarySkill: "constant-difference",
    skillTags: ["subtraction", "difference", "invariance"],
    reflection: "两个数都增加 2，差为什么不变？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 3,
    family: "pair-difference",
    difference: 5,
    right: [2, 4, 7],
    objective: "用数对表示相差 5，连接比较与减法算式。",
    primarySkill: "compare-by-subtraction",
    skillTags: ["subtraction", "comparison", "difference"],
    reflection: "哪一组数可以画成最容易比较的线段图？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 4,
    family: "three-number-sum",
    target: 14,
    rows: [[2, 4, 8], [3, 5, 6], [4, 7, 3]],
    objective: "在加减混合章节中复习组成 14，建立逆运算准备。",
    primarySkill: "addition-subtraction-link",
    skillTags: ["addition", "inverse-operations", "three-addends"],
    reflection: "每一组三数加法可以怎样拆成两步？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 5,
    family: "operator-choice",
    fixedLeft: 9,
    operators: ["+", "−", "+"],
    right: [2, 4, 3],
    objective: "根据结果范围判断应选加还是减。",
    primarySkill: "add-subtract-estimation",
    skillTags: ["operator-choice", "estimation", "addition-subtraction"],
    reflection: "不精算时，怎样先排除不可能的运算符？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 6,
    family: "three-number-difference",
    target: 6,
    rows: [[9, 4, 1], [11, 7, 2], [14, 9, 1]],
    mode: "equality",
    rightExpression: [3, "+", 3],
    objective: "把先减后加得到 6 的算式与右侧等值算式连接起来。",
    primarySkill: "subtraction-equality",
    skillTags: ["subtraction", "equality", "equivalence"],
    reflection: "等号两边可以都是算式吗？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 7,
    family: "four-reel",
    target: 14,
    objective: "在加号固定、第二个运算符可变时遵守运算顺序。",
    primarySkill: "two-operation-sequence",
    skillTags: ["mixed-operations", "precedence", "reasoning"],
    reflection: "第二个运算符是减号时，怎样按从左到右计算？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 8,
    family: "mixed-three-reel",
    left: [8, 10, 3],
    operators: ["−", "+", "+"],
    right: [3, 2, 5],
    objective: "从三个候选结果反推数字与运算符的匹配。",
    primarySkill: "inverse-operation-selection",
    skillTags: ["mixed-operations", "inverse-reasoning", "targets"],
    reflection: "你先锁定数字还是先锁定运算符？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 9,
    family: "three-number-difference",
    target: 7,
    rows: [[9, 3, 1], [12, 7, 2], [15, 9, 1]],
    objective: "在更大数域中用先减后加保持结果为 7。",
    primarySkill: "two-step-difference-fluency",
    skillTags: ["subtraction", "two-step", "fluency"],
    reflection: "先减后加时，怎样快速检查最终结果？"
  },
  {
    ...CHAPTER_2_CONTEXT,
    chapter: 2,
    order: 10,
    family: "four-reel",
    target: 18,
    objective: "综合两步运算，比较加减与先乘后加的等值路径。",
    primarySkill: "mixed-operation-equivalence",
    skillTags: ["mixed-operations", "equivalence", "precedence"],
    reflection: "不同运算路径为什么能得到同一个 18？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 1,
    family: "pair-product",
    target: 12,
    left: [2, 3, 4],
    objective: "列出 12 的三组因数对，理解交换因数不改变积。",
    primarySkill: "factor-pairs-twelve",
    skillTags: ["multiplication", "factor-pairs", "commutativity"],
    reflection: "2×6 与 6×2 表示的组数有什么不同？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 2,
    family: "pair-product",
    target: 18,
    left: [2, 3, 6],
    objective: "用因数对组成 18，辨认 3 和 6 的倍数关系。",
    primarySkill: "factor-pairs-eighteen",
    skillTags: ["multiplication", "factors", "multiples"],
    reflection: "哪一个因数在两组算式中交换了位置？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 3,
    family: "pair-quotient",
    quotient: 3,
    denominators: [2, 3, 4],
    objective: "构造商为 3 的三组除法，连接乘除互逆。",
    primarySkill: "quotient-three",
    skillTags: ["division", "inverse-operations", "equal-groups"],
    reflection: "每组除法可以还原成哪一道乘法？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 4,
    family: "three-number-product",
    target: 24,
    rows: [[2, 3, 4], [3, 2, 4], [4, 3, 2]],
    objective: "用三个因数组成 24，并比较不同的分组次序。",
    primarySkill: "three-factors-twenty-four",
    skillTags: ["multiplication", "three-factors", "associativity"],
    reflection: "先乘哪两个因数会让心算更容易？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 5,
    family: "three-number-quotient",
    target: 4,
    rows: [[6, 2, 1], [8, 4, 2], [5, 5, 3]],
    objective: "先整除再补足到 4，比较商与加数的共同作用。",
    primarySkill: "division-then-add",
    skillTags: ["division", "two-step", "integer-quotient"],
    reflection: "商变小时，最后一个加数要怎样补足？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 6,
    family: "mixed-three-reel",
    left: [2, 7, 10],
    operators: ["×", "+", "−"],
    right: [5, 4, 3],
    objective: "在乘、加、减之间切换，并按结果特征识别运算。",
    primarySkill: "mixed-fact-selection",
    skillTags: ["mixed-operations", "multiplication", "reasoning"],
    reflection: "哪个结果可以用乘法事实最快确认？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 7,
    family: "three-number-product",
    target: 20,
    rows: [[2, 2, 5], [4, 1, 5], [5, 2, 2]],
    mode: "equality",
    rightExpression: [4, "×", 5],
    objective: "用三个因数保持等号两边同为 20。",
    primarySkill: "multiplicative-equality",
    skillTags: ["multiplication", "equality", "factor-pairs"],
    reflection: "等号右边已经是乘法，左边还可以怎样写？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 8,
    family: "three-number-quotient",
    target: 5,
    rows: [[8, 2, 1], [12, 3, 1], [15, 5, 2]],
    mode: "equality",
    rightExpression: [10, "÷", 2],
    objective: "比较先除后加得到 5 的多组等式，强化等值观念。",
    primarySkill: "division-equality",
    skillTags: ["division", "equality", "quotient"],
    reflection: "等号两边的被除数不同，为什么仍然相等？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 9,
    family: "five-reel",
    target: 10,
    objective: "调节五条滑轨，综合乘法优先与加减关系得到 10。",
    primarySkill: "five-reel-precedence",
    skillTags: ["mixed-operations", "precedence", "multi-reel"],
    reflection: "哪一行必须先算乘法？"
  },
  {
    ...CHAPTER_3_CONTEXT,
    chapter: 3,
    order: 10,
    family: "three-number-product",
    target: 36,
    rows: [[3, 3, 4], [4, 3, 3], [6, 2, 3]],
    objective: "用三个因数整合 36 的乘法事实与因数判断。",
    primarySkill: "three-factors-thirty-six",
    skillTags: ["multiplication", "three-factors", "fact-fluency"],
    reflection: "怎样重组三个因数，让 36 更容易心算？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 1,
    family: "three-number-sum",
    target: 18,
    rows: [[2, 7, 9], [4, 6, 8], [5, 5, 8]],
    mode: "equality",
    rightExpression: [9, "+", 9],
    objective: "用三个加数构造与 9+9 等值的表达式。",
    primarySkill: "three-part-equality",
    skillTags: ["equality", "three-addends", "equivalence"],
    reflection: "等号左边有三个数，会影响等值判断吗？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 2,
    family: "four-reel",
    target: 20,
    objective: "在四条滑轨中反推能得到 20 的三种运算结构。",
    primarySkill: "four-reel-backward-reasoning",
    skillTags: ["mixed-operations", "backward-reasoning", "precedence"],
    reflection: "从目标 20 倒推时，你先确定哪一项？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 3,
    family: "five-reel",
    target: 11,
    objective: "协调两个运算符和三个数字，保持多步表达式结果为 11。",
    primarySkill: "five-reel-coordination",
    skillTags: ["mixed-operations", "multi-reel", "planning"],
    reflection: "哪一条滑轨的改变对结果影响最大？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 4,
    family: "operator-choice",
    fixedLeft: 12,
    operators: ["+", "−", "×"],
    right: [3, 5, 2],
    objective: "根据多个目标结果反推 12 应搭配的运算符和数字。",
    primarySkill: "multi-target-operation-reasoning",
    skillTags: ["multi-target", "operator-choice", "inverse-reasoning"],
    reflection: "哪个目标只可能由乘法得到？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 5,
    family: "three-number-sum",
    target: 20,
    rows: [[2, 6, 12], [4, 7, 9], [5, 8, 7]],
    mode: "equality",
    rightExpression: [4, "×", 5],
    objective: "把三数加法与乘法表达式 4×5 建立等值连接。",
    primarySkill: "cross-operation-equivalence",
    skillTags: ["equality", "addition", "multiplication"],
    reflection: "不同运算为什么可以出现在等号两边？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 6,
    family: "mixed-three-reel",
    left: [5, 12, 4],
    operators: ["+", "−", "×"],
    right: [7, 3, 4],
    objective: "在三条可动滑轨上同时追踪数字、运算符与多目标。",
    primarySkill: "three-reel-target-planning",
    skillTags: ["multi-target", "mixed-operations", "planning"],
    reflection: "怎样安排移动顺序才能少走回头路？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 7,
    family: "three-number-difference",
    target: 8,
    rows: [[10, 4, 2], [14, 9, 3], [18, 11, 1]],
    mode: "equality",
    rightExpression: [2, "×", 4],
    objective: "用多组先减后加得到 8 的算式验证与 2×4 等值。",
    primarySkill: "difference-product-equivalence",
    skillTags: ["equality", "subtraction", "multiplication"],
    reflection: "怎样用逆运算快速检查这些减法？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 8,
    family: "three-number-sum",
    target: 24,
    rows: [[3, 8, 13], [5, 9, 10], [7, 11, 6]],
    objective: "规划三条数字滑轨的覆盖顺序，同时保持和为 24。",
    primarySkill: "coverage-planning",
    skillTags: ["three-addends", "planning", "coverage"],
    reflection: "你选择的三次正确算式能否不重复任何格？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 9,
    family: "four-reel",
    target: 22,
    mode: "equality",
    rightExpression: [11, "+", 11],
    objective: "用不同两步运算结构保持与 11+11 等值。",
    primarySkill: "two-step-equality",
    skillTags: ["equality", "mixed-operations", "precedence"],
    reflection: "哪一种结构最容易在心里验证？"
  },
  {
    ...CHAPTER_4_CONTEXT,
    chapter: 4,
    order: 10,
    family: "five-reel",
    target: 10,
    objective: "在最终挑战中协调五条滑轨并解释完整求解计划。",
    primarySkill: "five-reel-transfer",
    skillTags: ["mixed-operations", "multi-reel", "transfer"],
    reflection: "如果只允许一次移动一格，你会怎样规划整条路线？"
  }
] as const satisfies readonly GoldTemplateSpec[];

export const EQUATION_SLIDER_V3_LEVELS: readonly PublishedEquationSliderLevel[] =
  applyGameplayPilot12(buildCompleteV3Catalog(HAND_AUTHORED_GOLD_TEMPLATES, FIRST_GOLD_LEVEL));

export const HAND_AUTHORED_V3_GOLD_LEVELS: readonly PublishedEquationSliderLevel[] =
  EQUATION_SLIDER_V3_LEVELS.filter(
    (level) => level.provenance.kind === "hand-authored-gold"
  );

export const GENERATED_V3_LEVELS: readonly PublishedEquationSliderLevel[] =
  EQUATION_SLIDER_V3_LEVELS.filter(
    (level) => level.provenance.kind === "generated-from-gold"
  );

export function getV3LevelById(id: string): PublishedEquationSliderLevel | undefined {
  return EQUATION_SLIDER_V3_LEVELS.find((level) => level.id === id);
}
