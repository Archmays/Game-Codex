# 算式滑轨重构 V3｜学习与关卡质量合同

## 数量硬要求

最终发布必须满足：

- 4 章；
- 每章至少 50 关；
- 每章 5 个站区；
- 每站至少 10 关；
- 总计至少 200 个正式可玩关卡。

“正式可玩”要求数据、solver、UI 和浏览器试玩全部通过。只有 JSON 数量达到 200 不算完成。

## 生产顺序

### Gate A｜1 个首关金标准

先完成 `03-interaction-contract.md` 中的首关。

通过：

- 数学；
- 教程；
- 四种输入；
- DOM 不变量；
- 手机首屏；
- 完整 coverage。

未通过不得扩关。

### Gate B｜40 个手工金标准关

每章至少 10 关，由开发者明确设计，不得由随机生成器直接批量填充。

每个金标准关用于定义：

- 学习目标；
- reel/fixed-token 结构；
- 数值带；
- 合理首步；
- 正确关系；
- coverage 路径；
- 常见误区；
- 提示；
- 趣味节奏。

### Gate C｜补足至 200+

剩余关可用确定性生成器生产，但必须：

- 固定 seed；
- 构建期物化；
- 逐关 solver；
- 逐关质量门禁；
- 与金标准模板对照；
- 每站人工抽查至少 3 关；
- 不在浏览器运行时随机生成。

## 四章学习进阶

### Chapter 1｜加法与组成

- 固定 `+` 为主；
- 20 以内；
- 部分—整体；
- 组成 10；
- 交换加数；
- 凑整；
- 前 10 关不得出现 `0`；
- 不出现 movable operator reel；
- 不要求速度。

### Chapter 2｜减法、相差与逆关系

- 固定 `−` 和固定 `+` 的关卡交错；
- 拿走；
- 相差；
- 加减事实家族；
- 两步加减；
- 可在后半章引入 operator choice，但只有当选择运算符本身是目标时才使用 movable operator reel；
- 不引入乘除作为干扰项。

### Chapter 3｜乘除与运算选择

- 相同分组；
- 2、5、10 乘法；
- 3、4、6 乘法；
- 整除与平均分；
- 乘除互逆；
- 逐步引入有至少两种不同值的 operator reel；
- 至少 20% 关卡交错复习加减；
- 除法只允许整除、非零除数。

### Chapter 4｜平衡与综合推理

- 多目标；
- 等式平衡；
- 四则混合；
- 运算顺序；
- 覆盖规划；
- 唯一最小覆盖作为可选挑战；
- 不用最少步数评价儿童；
- 不把复杂度建立在超大数字上。

## 每站 10 关节奏

建议结构：

1. 引导；
2. 同构练习；
3. 数值变化；
4. 表征变化；
5. 小发现；
6. 混合练习；
7. 误区修正；
8. 迁移；
9. 可选挑战；
10. 回顾。

难度允许“挑战后恢复”，不要机械逐关上升。

## 数据合同

每关至少包括：

```ts
interface PublishedLevel {
  id: string;
  chapterId: string;
  stationId: string;
  order: number;
  mode: "target" | "multi-target" | "equality";
  slots: ExpressionSlot[];
  initialIndexes: number[];
  requiredTileIds: string[];
  learning: {
    objective: string;
    skillTags: string[];
    prerequisiteTags: string[];
    misconceptionTags: string[];
    scaffold: "guided" | "supported" | "independent" | "transfer" | "review";
    reviewOf: string[];
  };
  hints: HintStep[];
  analysis: {
    validArrangements: ValidArrangement[];
    canonicalPlan: Arrangement[];
    minimumMovesToFirstSuccess: number;
    minimumCorrectArrangements: number;
    difficulty: number;
    signatures: QualitySignatures;
  };
  provenance: {
    kind: "hand-authored-gold" | "generated-from-gold";
    templateId?: string;
    seed?: string;
    generatorVersion: string;
  };
}
```

## 数学门禁

每关：

- token 序列合法；
- 禁止 `eval()`、`Function()`；
- 明确运算顺序；
- 除零拒绝；
- 非整除拒绝；
- 主路径中间结果为安全非负整数；
- 初始状态不能已经完成；
- 至少一个完整 coverage 方案；
- required tile 无孤立；
- hint 路径从当前状态可继续；
- published analysis 必须由当前 solver 重算一致。

## 视觉与意义门禁

- movable reel 恰好 3 个 tile ID；
- 同 reel tile ID 不重复；
- 同 reel number 值不能三个相同；
- movable operator reel 至少两种 operator；
- 全同 operator reel 拒绝；
- fixed operator 不参与 coverage；
- 每个可交互 reel 的移动有可解释作用；
- 同一个 tile ID 在 DOM 只出现一次；
- 不用空白克隆冒充正式 tile。

## 数值内容门禁

报告必须统计**所有 number tile**，不能只统计 target。

至少检查：

- 每章 number tile 值分布；
- 每站 number tile 值分布；
- 0、1 的比例；
- 单关重复数字；
- 目标分布；
- 数值范围；
- 首 10 关 zero count；
- 连续关卡数字集合相似度。

硬规则：

- Chapter 1 前 10 关 `0` 数量为 0；
- 同一 number reel 三值全同为失败；
- 同一关某个 number 值过度重复必须有明确学习理由；
- 不允许连续多关只换 target 或 ID；
- 0 只在明确教授 0、恒等关系或必要复习时使用；
- 第一站不得把 0 当成主要凑答案手段。

## 重复与趣味门禁

签名至少包括：

- slot/reel 结构；
- 去 ID 值结构；
- 循环旋转归一化；
- valid arrangement 集合；
- canonical coverage；
- 初始状态到首成功的动作；
- 学习目标；
- number multiset；
- operator pattern。

要求：

- exact duplicate = 0；
- 同站近重复必须有 scaffold fade、spaced review 或 representation transfer 理由；
- 每站前 4 关至少 3 种有意义首步；
- 每站至少 4 种结构/解法族；
- 同一 canonical action pattern 不得在整库重复 16 次而无额外说明；
- 不能把“拓扑不同”当作唯一趣味指标；
- agent 试玩需记录是否能预测下一关只是换数字。

## 学习反馈

每关不强制长反思。

- 每 5 关：一个可跳过的小发现；
- 每 10 关：站区回顾；
- 用二选一、找规律或口头讨论；
- 不要求儿童输入长文本；
- 不把游戏进度当学校能力诊断；
- 不用时间、最少步数、连续登录评价孩子。

## 关卡质量报告

必须输出：

- 每章/站关数；
- gold/generated 数量；
- solver 结果；
- tile 值分布；
- target 分布；
- operator 分布；
- fixed/movable operator 分布；
- exact/near duplicates；
- canonical action pattern；
- 首成功移动分布；
- 完成路径长度；
- 无解/孤立；
- 人工抽查；
- agent 试玩发现；
- 被拒绝候选的主要原因。

报告不得只复制 `generated-audit.json` 的现有字段。
