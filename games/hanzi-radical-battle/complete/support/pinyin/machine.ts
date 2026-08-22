import { PINYIN_CONTRASTS, recordById } from "./contrasts";
import { PINYIN_READING_MANIFEST } from "./manifest";
import type { PinyinChallenge, SoundRhymeMode, ToneNumber } from "./types";

export const SOUND_RHYME_SESSION_LENGTH = 4;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function distinctOptions<T>(correct: T, candidates: readonly T[], count: number, random: () => number): T[] {
  const unique = [...new Set(candidates)].filter((candidate) => candidate !== correct);
  return shuffle([correct, ...shuffle(unique, random).slice(0, count - 1)], random);
}

export function createPinyinSession(mode: SoundRhymeMode, seed = "forest-echo", preferredCharacterIds: readonly string[] = []): readonly PinyinChallenge[] {
  const random = seededRandom(`${mode}:${seed}`);
  if (mode === "contrast") {
    const preferred = new Set(preferredCharacterIds);
    const preferredPairs = PINYIN_CONTRASTS.filter((pair) => preferred.has(recordById(pair.leftRecordId).characterId) && preferred.has(recordById(pair.rightRecordId).characterId));
    const contrastPool = preferredPairs.length >= SOUND_RHYME_SESSION_LENGTH ? preferredPairs : PINYIN_CONTRASTS;
    return shuffle(contrastPool, random).slice(0, Math.min(SOUND_RHYME_SESSION_LENGTH, contrastPool.length)).map((pair, index) => {
      const left = recordById(pair.leftRecordId);
      const right = recordById(pair.rightRecordId);
      const target = random() < 0.5 ? left : right;
      return {
        id: `${mode}:${seed}:${index}:${pair.id}`,
        mode,
        recordId: target.id,
        initialOptions: [],
        finalOptions: [],
        toneOptions: [],
        contrastPairId: pair.id,
        contrastOptions: shuffle([pair.leftValue, pair.rightValue], random),
        correctContrast: pair.dimension === "initial" ? target.teachingInitial ?? "零声母" : target.canonicalFinal,
      };
    });
  }
  const preferred = new Set(preferredCharacterIds);
  const preferredRecords = PINYIN_READING_MANIFEST.filter((record) => preferred.has(record.characterId));
  const starterRecords = PINYIN_READING_MANIFEST.filter((record) => record.band === "starter" && !preferred.has(record.characterId));
  const recordPool = preferredRecords.length >= SOUND_RHYME_SESSION_LENGTH ? preferredRecords : [...preferredRecords, ...starterRecords];
  const records = shuffle(recordPool, random).slice(0, SOUND_RHYME_SESSION_LENGTH);
  const initials = PINYIN_READING_MANIFEST.map((record) => record.teachingInitial ?? "零声母");
  const finals = PINYIN_READING_MANIFEST.map((record) => record.writtenFinal);
  const tones: readonly ToneNumber[] = [1, 2, 3, 4, 5];
  return records.map((record, index) => ({
    id: `${mode}:${seed}:${index}:${record.id}`,
    mode,
    recordId: record.id,
    initialOptions: mode === "assemble" && !record.wholeSyllableTeaching
      ? distinctOptions(record.teachingInitial ?? "零声母", initials, 3, random)
      : [],
    finalOptions: mode === "assemble" && !record.wholeSyllableTeaching
      ? distinctOptions(record.writtenFinal, finals, 3, random)
      : [],
    toneOptions: distinctOptions(record.tone, tones, 5, random),
  }));
}

export function validateChallenge(challenge: PinyinChallenge): string[] {
  const record = recordById(challenge.recordId);
  const errors: string[] = [];
  const checkUnique = (items: readonly unknown[], name: string) => {
    if (new Set(items).size !== items.length) errors.push(`${name}_DUPLICATE`);
  };
  checkUnique(challenge.initialOptions, "INITIAL_OPTIONS");
  checkUnique(challenge.finalOptions, "FINAL_OPTIONS");
  checkUnique(challenge.toneOptions, "TONE_OPTIONS");
  if (challenge.mode === "assemble" && !record.wholeSyllableTeaching) {
    if (!challenge.initialOptions.includes(record.teachingInitial ?? "零声母")) errors.push("INITIAL_NO_SOLUTION");
    if (!challenge.finalOptions.includes(record.writtenFinal)) errors.push("FINAL_NO_SOLUTION");
  }
  if (challenge.mode === "tone" && !challenge.toneOptions.includes(record.tone)) errors.push("TONE_NO_SOLUTION");
  if (challenge.mode === "contrast") {
    if (!challenge.correctContrast || challenge.contrastOptions?.filter((value) => value === challenge.correctContrast).length !== 1) errors.push("CONTRAST_NOT_UNIQUE");
  }
  return errors;
}
