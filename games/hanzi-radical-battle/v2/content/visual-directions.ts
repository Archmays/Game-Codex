import type { VisualDirection, VisualDirectionId } from "./types";

export const VISUAL_DIRECTIONS: readonly VisualDirection[] = [
  {
    id: "A",
    name: "暖墨绘本",
    summary: "米白纸张、柔和水彩、温暖珊瑚与青绿色圆润角色，强调安全、亲近、归家和修复。",
    tokens: {
      sky: "#18243a",
      distantInk: "#31445d",
      ground: "#26384a",
      panel: "#fff8e8",
      primary: "#f6b94f",
      accent: "#7fd4c1",
      glow: "#ffe7a1",
      text: "#243044",
    },
    reviewQuestion: "暖墨绘本是否足以让第一次进入像魔法冒险，而不显得紧张或像练习页？",
    productionStatus: "procedural-review-direction-only",
  },
  {
    id: "B",
    name: "剪纸字灵",
    summary: "分层剪纸、清晰阴影、高轮廓与明亮不过饱和的纸片触感，结构槽像可操作的纸艺拼图。",
    tokens: {
      sky: "#173b3a",
      distantInk: "#2d5a50",
      ground: "#21483e",
      panel: "#f4f1dc",
      primary: "#75c88f",
      accent: "#ffd274",
      glow: "#d7ffd7",
      text: "#193a35",
    },
    reviewQuestion: "剪纸字灵是否让可操作层级更清楚，同时仍保留柔和的世界感？",
    productionStatus: "procedural-review-direction-only",
  },
  {
    id: "C",
    name: "夜光墨林",
    summary: "深蓝绿森林、柔和荧光、克制星点与高对比汉字区域，强调冒险感但避免黑暗恐怖。",
    tokens: {
      sky: "#151c42",
      distantInk: "#303c6b",
      ground: "#202d55",
      panel: "#f8f4ee",
      primary: "#7d8cff",
      accent: "#ff9a7a",
      glow: "#c9d4ff",
      text: "#202744",
    },
    reviewQuestion: "夜光墨林的魔法感是否更强，又不会盖过部件位置或变得阴森？",
    productionStatus: "procedural-review-direction-only",
  },
] as const;

export function getVisualDirection(id: VisualDirectionId): VisualDirection {
  return VISUAL_DIRECTIONS.find((direction) => direction.id === id) ?? VISUAL_DIRECTIONS[0];
}
