import type { CompleteSlotId, CompleteStructure } from "./types";

export function completeCharacterId(glyph: string): string {
  return `char-u${glyph.codePointAt(0)!.toString(16)}`;
}

export function completeReadingId(glyph: string, sense = "primary"): string {
  return `reading-u${glyph.codePointAt(0)!.toString(16)}-${sense}`;
}

export function completeComponentId(glyph: string): string {
  return `component-u${glyph.codePointAt(0)!.toString(16)}`;
}

export function completeUnicodeCodePoint(glyph: string): `U+${string}` {
  return `U+${glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function slotsForStructure(structure: CompleteStructure): readonly [CompleteSlotId, CompleteSlotId] {
  if (structure === "left-right") return ["left", "right"];
  if (structure === "top-bottom") return ["top", "bottom"];
  return ["outer", "inner"];
}
