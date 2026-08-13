import type { ChapterRegionId } from "./content-types";

export type M4RepairId =
  | "camp-lamp"
  | "garden-path"
  | "world-gate"
  | "magic-tree"
  | "little-bridge"
  | "spellbook-house"
  | "ink-companion-house"
  | "stargazing-platform";

export interface M4RepairObject {
  readonly id: M4RepairId;
  readonly name: string;
  readonly beforeShape: string;
  readonly afterShape: string;
  readonly beforeColor: string;
  readonly afterColor: string;
  readonly beforeFunction: string;
  readonly afterFunction: string;
  readonly childValue: string;
  readonly hanziLearningValue: string;
  readonly icon: string;
}

export const M4_REPAIR_OBJECTS: readonly M4RepairObject[] = [
  { id: "camp-lamp", name: "营地灯", beforeShape: "歪斜的暗灯罩", afterShape: "完整的叶形灯罩", beforeColor: "灰蓝", afterColor: "暖金", beforeFunction: "小路入口看不清", afterFunction: "照亮下一条安全小路", childValue: "回营时有稳定的方向标记", hanziLearningValue: "完成字光后立即看到世界恢复", icon: "✦" },
  { id: "garden-path", name: "花园小径", beforeShape: "断开的圆石", afterShape: "连成弧线的花纹石", beforeColor: "墨灰", afterColor: "珊瑚粉与叶绿", beforeFunction: "花园入口中断", afterFunction: "可以沿花纹回到营地", childValue: "路径变化清楚且可预期", hanziLearningValue: "包围结构的里外关系映射到真实路径", icon: "❀" },
  { id: "world-gate", name: "世界门", beforeShape: "缺角的门框", afterShape: "完整的双层拱门", beforeColor: "深墨紫", afterColor: "青绿与星金", beforeFunction: "森林方向关闭", afterFunction: "显示三片区域的方向", childValue: "自由选择区域但不会走入死路", hanziLearningValue: "半包围与完整外框保持可见差别", icon: "⌂" },
  { id: "magic-tree", name: "魔法树", beforeShape: "卷起的细枝", afterShape: "展开的三层树冠", beforeColor: "灰褐", afterColor: "森林绿与萤光青", beforeFunction: "部件回声沉睡", afterFunction: "轻触可看最近发现的部件", childValue: "营地里有可重复探索的生命感", hanziLearningValue: "强化不同汉字共享部件的观察", icon: "♧" },
  { id: "little-bridge", name: "小桥", beforeShape: "两块分离木板", afterShape: "带扶手的弧桥", beforeColor: "暗棕", afterColor: "蜂蜜木色与水蓝", beforeFunction: "清泉两侧分开", afterFunction: "连接英雄与书屋", childValue: "完成首区后开放新的营地动线", hanziLearningValue: "把顺序和位置反馈变成可走的连接", icon: "≈" },
  { id: "spellbook-house", name: "魔法书屋", beforeShape: "合拢的小棚", afterShape: "打开书页形屋顶的小屋", beforeColor: "灰紫", afterColor: "莓紫与奶油金", beforeFunction: "只能看到书脊", afterFunction: "可以进入 36 字魔法书", childValue: "随时重看，不用靠分数解锁", hanziLearningValue: "重放合字、读音和字义魔法", icon: "▤" },
  { id: "ink-companion-house", name: "墨点精灵小屋", beforeShape: "低矮墨团", afterShape: "圆窗蘑菇形小屋", beforeColor: "纯墨黑", afterColor: "靛蓝、薄荷绿与暖窗光", beforeFunction: "伙伴没有休息处", afterFunction: "墨点伙伴会提示已恢复的路线", childValue: "同伴持续存在但不催促登录", hanziLearningValue: "用短提示回顾结构，不代替作答", icon: "●" },
  { id: "stargazing-platform", name: "观星台", beforeShape: "散落的三块石片", afterShape: "完整圆台与星图支架", beforeColor: "石灰", afterColor: "夜蓝与柔金", beforeFunction: "第一章字光尚未连成图", afterFunction: "36 道字光组成森林星图", childValue: "第一章完成后仍可自由回看与冒险", hanziLearningValue: "把 36 个完整汉字作为长期可见成果", icon: "✧" },
] as const;

export const M4_REPAIR_IDS = M4_REPAIR_OBJECTS.map((repair) => repair.id);

const V1_CHARACTER_IDS = new Set(["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"]);

export function deriveM4Repairs(
  discoveredCharacterIds: readonly string[],
  completedRegionIds: readonly ChapterRegionId[],
  carried: readonly M4RepairId[] = [],
): readonly M4RepairId[] {
  const count = new Set(discoveredCharacterIds).size;
  const v2Count = new Set(discoveredCharacterIds.filter((id) => !V1_CHARACTER_IDS.has(id))).size;
  const carryable = v2Count > 0 ? M4_REPAIR_IDS : M4_REPAIR_IDS.slice(0, 3);
  const repaired = new Set<M4RepairId>(carried.filter((id) => carryable.includes(id)));
  if (count >= 1) repaired.add("camp-lamp");
  if (count >= 4) repaired.add("garden-path");
  if (count >= 8) repaired.add("world-gate");
  if (v2Count >= 1) repaired.add("magic-tree");
  if (v2Count >= 4 || (v2Count >= 1 && completedRegionIds.includes("glimmer-grove"))) repaired.add("little-bridge");
  if (v2Count >= 8 || (v2Count >= 4 && completedRegionIds.includes("echo-garden"))) repaired.add("spellbook-house");
  if (v2Count >= 12 || (v2Count >= 8 && completedRegionIds.includes("wind-trail"))) repaired.add("ink-companion-house");
  if (count >= 36 || (v2Count >= 1 && completedRegionIds.length === 3)) repaired.add("stargazing-platform");
  return M4_REPAIR_IDS.filter((id) => repaired.has(id));
}

export function getM4Repair(id: M4RepairId): M4RepairObject {
  const repair = M4_REPAIR_OBJECTS.find((entry) => entry.id === id);
  if (!repair) throw new Error(`Unknown Chapter One repair: ${id}`);
  return repair;
}
