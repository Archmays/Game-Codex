import { COMPLETE_FAMILY_COMPONENT_GLYPHS } from "./families";
import { completeComponentId } from "./ids";
import type { CharacterNode, ComponentNode } from "./types";

const COMPONENT_LABELS: Readonly<Record<string, string>> = {
  "氵": "三点水", "扌": "提手旁", "龵": "手字变形", "⻊": "足字旁", "𧾷": "足字旁字形", "忄": "竖心旁", "⺗": "心字底",
  "讠": "言字旁", "艹": "草字头", "亻": "单人旁", "饣": "食字旁", "钅": "金字旁", "衤": "衣字旁", "礻": "示字旁",
  "囗": "大口框", "宀": "宝盖头", "辶": "走之", "⺮": "竹字头", "犭": "反犬旁", "勹": "包字头", "匸": "三框儿",
};
const VARIANT_GLYPHS = new Set(["氵", "扌", "龵", "⻊", "𧾷", "忄", "⺗", "讠", "亻", "饣", "钅", "衤", "礻", "艹", "辶", "⺮", "犭"]);

export function buildCompleteComponentNodes(characters: readonly CharacterNode[]): ComponentNode[] {
  const wholeGlyphs = new Set(characters.map((character) => character.glyph));
  const glyphs = [...new Set([...characters.flatMap((character) => character.components.map((component) => component.glyph)), ...COMPLETE_FAMILY_COMPONENT_GLYPHS])];
  return glyphs.sort((left, right) => left.localeCompare(right, "zh-Hans-CN")).map((glyph) => ({
    id: completeComponentId(glyph),
    glyph,
    label: COMPONENT_LABELS[glyph] ?? glyph,
    roleLabel: VARIANT_GLYPHS.has(glyph) ? "component-variant" : wholeGlyphs.has(glyph) ? "whole-character-component" : "component",
    sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d"],
  }));
}
