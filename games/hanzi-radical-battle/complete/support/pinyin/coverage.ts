import { PINYIN_READING_MANIFEST } from "./manifest";

export function pinyinCoverageMatrix() {
  const records = PINYIN_READING_MANIFEST;
  const tones = new Set(records.map((record) => record.tone));
  return {
    characterCount: new Set(records.map((record) => record.characterId)).size,
    readingCount: records.length,
    fourTones: [1, 2, 3, 4].every((tone) => tones.has(tone as 1 | 2 | 3 | 4)),
    neutralTone: tones.has(5),
    zeroInitial: records.some((record) => record.zeroInitial),
    yOrthography: records.some((record) => record.teachingInitial === "y"),
    wOrthography: records.some((record) => record.teachingInitial === "w"),
    underlyingUmlaut: records.some((record) => record.canonicalFinal.startsWith("ü")),
    jqxUmlautSpelling: records.some((record) => record.umlautOmissionRule === "jqxy-u-means-ü" && ["j", "q", "x"].includes(record.teachingInitial ?? "")),
    nasalFinal: records.some((record) => /n$|ng$/.test(record.canonicalFinal)),
    retroflexInitial: records.some((record) => ["zh", "ch", "sh", "r"].includes(record.teachingInitial ?? "")),
    nonRetroflexInitial: records.some((record) => ["z", "c", "s"].includes(record.teachingInitial ?? "")),
    contractedFinal: records.some((record) => record.contractionRule !== "none"),
    wholeSyllableTeaching: records.some((record) => record.wholeSyllableTeaching),
  };
}
