import type { PinyinReadingRecord, ToneNumber } from "./types";

const MARKED_VOWELS: Readonly<Record<string, readonly [string, ToneNumber]>> = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

const TONE_MARKS: Readonly<Record<string, readonly [string, string, string, string]>> = {
  a: ["ā", "á", "ǎ", "à"], e: ["ē", "é", "ě", "è"], i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"], u: ["ū", "ú", "ǔ", "ù"], ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

const ATOMIC_INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s"] as const;
const WHOLE_SYLLABLES = new Set(["zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi", "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying"]);

const Y_FINALS: Readonly<Record<string, string>> = {
  yi: "i", ya: "ia", yo: "io", ye: "ie", yao: "iao", you: "iou", yan: "ian", yin: "in", yang: "iang", ying: "ing", yong: "iong",
  yu: "ü", yue: "üe", yuan: "üan", yun: "ün",
};
const W_FINALS: Readonly<Record<string, string>> = {
  wu: "u", wa: "ua", wo: "uo", wai: "uai", wei: "uei", wan: "uan", wen: "uen", wang: "uang", weng: "ueng",
};

export interface MarkedSyllable {
  readonly marked: string;
  readonly plain: string;
  readonly tone: ToneNumber;
  readonly toneMarkVowelIndex: number | null;
}

export interface PinyinDecomposition extends MarkedSyllable {
  readonly phonologicalOnset: string | null;
  readonly teachingInitial: string | null;
  readonly canonicalFinal: string;
  readonly writtenFinal: string;
  readonly medial: "i" | "u" | "ü" | null;
  readonly zeroInitial: boolean;
  readonly yWOrthography: boolean;
  readonly umlautOmissionRule: "none" | "jqxy-u-means-ü";
  readonly contractionRule: "none" | "iou-to-iu" | "uei-to-ui" | "uen-to-un";
  readonly wholeSyllableTeaching: boolean;
}

export function parseMarkedSyllable(value: string): MarkedSyllable {
  const marked = value.trim().toLowerCase().normalize("NFC");
  if (!marked || /\s/.test(marked)) throw new Error(`Expected one Pinyin syllable: ${value}`);
  let tone: ToneNumber = 5;
  let toneMarkVowelIndex: number | null = null;
  let foundMarks = 0;
  const plain = Array.from(marked).map((character, index) => {
    const entry = MARKED_VOWELS[character];
    if (!entry) return character;
    foundMarks += 1;
    tone = entry[1];
    toneMarkVowelIndex = index;
    return entry[0];
  }).join("");
  if (foundMarks > 1) throw new Error(`Multiple tone marks in ${value}`);
  if (!/^[a-zü]+$/.test(plain)) throw new Error(`Unsupported Pinyin spelling: ${value}`);
  return { marked, plain, tone, toneMarkVowelIndex };
}

function markedVowelIndex(plain: string): number {
  const a = plain.indexOf("a");
  if (a >= 0) return a;
  const e = plain.indexOf("e");
  if (e >= 0) return e;
  const ou = plain.indexOf("ou");
  if (ou >= 0) return ou;
  for (let index = plain.length - 1; index >= 0; index -= 1) {
    if ("aeiouü".includes(plain[index])) return index;
  }
  throw new Error(`Pinyin syllable has no vowel: ${plain}`);
}

export function applyToneMark(plainValue: string, tone: ToneNumber): string {
  const plain = plainValue.trim().toLowerCase().normalize("NFC");
  if (!/^[a-zü]+$/.test(plain)) throw new Error(`Unsupported plain Pinyin: ${plainValue}`);
  if (tone === 5) return plain;
  const index = markedVowelIndex(plain);
  const marks = TONE_MARKS[plain[index]];
  if (!marks) throw new Error(`Cannot place tone on ${plainValue}`);
  return `${plain.slice(0, index)}${marks[tone - 1]}${plain.slice(index + 1)}`.normalize("NFC");
}

export function markedToNumbered(marked: string): string {
  const parsed = parseMarkedSyllable(marked);
  return `${parsed.plain}${parsed.tone}`;
}

export function numberedToMarked(numbered: string): string {
  const match = /^([a-zü]+)([1-5])$/i.exec(numbered.trim().normalize("NFC"));
  if (!match) throw new Error(`Unsupported numbered Pinyin: ${numbered}`);
  return applyToneMark(match[1], Number(match[2]) as ToneNumber);
}

function initialFor(plain: string): string | null {
  return ATOMIC_INITIALS.find((initial) => plain.startsWith(initial)) ?? null;
}

function regularFinal(initial: string, writtenFinal: string): {
  canonicalFinal: string;
  contractionRule: PinyinDecomposition["contractionRule"];
  umlautOmissionRule: PinyinDecomposition["umlautOmissionRule"];
} {
  if (["j", "q", "x"].includes(initial) && writtenFinal.startsWith("u")) {
    const suffix = writtenFinal.slice(1);
    return { canonicalFinal: `ü${suffix === "n" ? "n" : suffix}`, contractionRule: "none", umlautOmissionRule: "jqxy-u-means-ü" };
  }
  if (writtenFinal === "iu") return { canonicalFinal: "iou", contractionRule: "iou-to-iu", umlautOmissionRule: "none" };
  if (writtenFinal === "ui") return { canonicalFinal: "uei", contractionRule: "uei-to-ui", umlautOmissionRule: "none" };
  if (writtenFinal === "un") return { canonicalFinal: "uen", contractionRule: "uen-to-un", umlautOmissionRule: "none" };
  return { canonicalFinal: writtenFinal, contractionRule: "none", umlautOmissionRule: "none" };
}

export function decomposeMarkedSyllable(value: string): PinyinDecomposition {
  const parsed = parseMarkedSyllable(value);
  const carrier = parsed.plain.startsWith("y") ? "y" : parsed.plain.startsWith("w") ? "w" : null;
  const phonologicalOnset = carrier ? null : initialFor(parsed.plain);
  const teachingInitial = carrier ?? phonologicalOnset;
  const writtenFinal = teachingInitial ? parsed.plain.slice(teachingInitial.length) : parsed.plain;
  let canonicalFinal: string;
  let contractionRule: PinyinDecomposition["contractionRule"] = "none";
  let umlautOmissionRule: PinyinDecomposition["umlautOmissionRule"] = "none";
  if (carrier === "y") {
    canonicalFinal = Y_FINALS[parsed.plain] ?? (() => { throw new Error(`Unsupported y orthography: ${parsed.plain}`); })();
    if (canonicalFinal.startsWith("ü")) umlautOmissionRule = "jqxy-u-means-ü";
  } else if (carrier === "w") {
    canonicalFinal = W_FINALS[parsed.plain] ?? (() => { throw new Error(`Unsupported w orthography: ${parsed.plain}`); })();
  } else if (phonologicalOnset) {
    const regular = regularFinal(phonologicalOnset, writtenFinal);
    canonicalFinal = regular.canonicalFinal;
    contractionRule = regular.contractionRule;
    umlautOmissionRule = regular.umlautOmissionRule;
  } else {
    canonicalFinal = writtenFinal;
  }
  const medial = canonicalFinal.startsWith("i") ? "i" : canonicalFinal.startsWith("u") ? "u" : canonicalFinal.startsWith("ü") ? "ü" : null;
  return {
    ...parsed,
    phonologicalOnset,
    teachingInitial,
    canonicalFinal,
    writtenFinal,
    medial,
    zeroInitial: phonologicalOnset === null,
    yWOrthography: carrier !== null,
    umlautOmissionRule,
    contractionRule,
    wholeSyllableTeaching: WHOLE_SYLLABLES.has(parsed.plain),
  };
}

export function validatePinyinRecord(record: PinyinReadingRecord): string[] {
  const errors: string[] = [];
  let parsed: PinyinDecomposition;
  try {
    parsed = decomposeMarkedSyllable(record.citationPinyinMarked);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (record.citationPinyinMarked !== record.citationPinyinMarked.normalize("NFC")) errors.push("NOT_NFC");
  if (markedToNumbered(record.citationPinyinMarked) !== record.citationPinyinNumbered) errors.push("NUMBERED_MISMATCH");
  if (numberedToMarked(record.citationPinyinNumbered) !== record.citationPinyinMarked) errors.push("ROUND_TRIP_MISMATCH");
  for (const key of ["phonologicalOnset", "teachingInitial", "canonicalFinal", "writtenFinal", "medial", "tone", "toneMarkVowelIndex", "zeroInitial", "yWOrthography", "umlautOmissionRule", "contractionRule", "wholeSyllableTeaching"] as const) {
    if (record[key] !== parsed[key]) errors.push(`${key.toUpperCase()}_MISMATCH`);
  }
  if (record.neutralTone !== (record.tone === 5)) errors.push("NEUTRAL_TONE_MISMATCH");
  return errors;
}

export const OFFICIAL_WHOLE_SYLLABLE_TEACHING_SET = [...WHOLE_SYLLABLES].sort();
