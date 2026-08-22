import { PINYIN_READING_MANIFEST } from "./manifest";
import type { PinyinContrastPair, PinyinReadingRecord } from "./types";

const byGlyph = new Map<string, PinyinReadingRecord>(PINYIN_READING_MANIFEST.map((record) => [record.glyph, record]));

function pair(
  id: string,
  leftGlyph: string,
  rightGlyph: string,
  dimension: PinyinContrastPair["dimension"],
  explanation: string,
): PinyinContrastPair {
  const left = byGlyph.get(leftGlyph);
  const right = byGlyph.get(rightGlyph);
  if (!left || !right) throw new Error(`Missing contrast record: ${leftGlyph}/${rightGlyph}`);
  return {
    id,
    leftRecordId: left.id,
    rightRecordId: right.id,
    dimension,
    leftValue: dimension === "initial" ? left.teachingInitial ?? "零声母" : left.canonicalFinal,
    rightValue: dimension === "initial" ? right.teachingInitial ?? "零声母" : right.canonicalFinal,
    explanation,
    sourceIds: ["pinyin-scheme-1958", "gbt-16159-2012", "repo-hanzi-v3-reading-senses"],
  };
}

/** Only contrasts present in the validated 72-character graph are playable. */
export const PINYIN_CONTRASTS: readonly PinyinContrastPair[] = [
  pair("contrast-x-j-ing", "星", "睛", "initial", "“星”的声母是 x；“睛”的声母是 j，韵母和声调相同。"),
  pair("contrast-b-m-ao", "包", "猫", "initial", "“包”的声母是 b；“猫”的声母是 m，韵母和声调相同。"),
  pair("contrast-b-n-i", "笔", "你", "initial", "“笔”的声母是 b；“你”的声母是 n，韵母和声调相同。"),
  pair("contrast-q-j-ing", "清", "睛", "initial", "“清”的声母是 q；“睛”的声母是 j，韵母和声调相同。"),
  pair("contrast-ing-in", "静", "进", "final", "“静”的韵母是 ing；“进”的韵母是 in，声母和声调相同。"),
  pair("contrast-zh-s-ong", "钟", "松", "initial", "“钟”的声母是 zh；“松”的声母是 s，韵母和声调相同。"),
] as const;

export function recordById(id: string): PinyinReadingRecord {
  const record = PINYIN_READING_MANIFEST.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Unknown Pinyin reading: ${id}`);
  return record;
}

export function validateContrast(pairValue: PinyinContrastPair): string[] {
  const left = recordById(pairValue.leftRecordId);
  const right = recordById(pairValue.rightRecordId);
  const errors: string[] = [];
  if (left.tone !== right.tone) errors.push("TONE_DIFFERS");
  if (pairValue.dimension === "initial") {
    if (left.canonicalFinal !== right.canonicalFinal) errors.push("FINAL_DIFFERS");
    if (left.teachingInitial === right.teachingInitial) errors.push("INITIAL_NOT_DIFFERENT");
  } else {
    if (left.teachingInitial !== right.teachingInitial) errors.push("INITIAL_DIFFERS");
    if (left.canonicalFinal === right.canonicalFinal) errors.push("FINAL_NOT_DIFFERENT");
  }
  return errors;
}
