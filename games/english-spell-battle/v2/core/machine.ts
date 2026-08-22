import type { EnglishSentenceRecord, EnglishWordRecord, GraphemeUnit } from "../content/types";

export interface MissionTile {
  readonly id: string;
  readonly letters: string;
  readonly targetUnitId: string | null;
}

export interface EnglishMission {
  readonly seed: string;
  readonly word: EnglishWordRecord;
  readonly sentence: EnglishSentenceRecord;
  readonly tiles: readonly MissionTile[];
}

export interface BuildState {
  readonly selectedTileIds: readonly string[];
  readonly hiddenDistractorIds: readonly string[];
  readonly fixedTargetUnitIds: readonly string[];
  readonly hintLevel: number;
}

function seedHash(value: string): number {
  let hash = 1779033703;
  for (const character of value) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 3432918353);
    hash = hash << 13 | hash >>> 19;
  }
  return hash >>> 0;
}

export function englishRandom(seed: string): () => number {
  let value = seedHash(seed) || 1;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(input: readonly T[], seed: string): T[] {
  const items = [...input];
  const random = englishRandom(seed);
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

export function createMission(word: EnglishWordRecord, sentence: EnglishSentenceRecord, seed: string): EnglishMission {
  if (sentence.targetWordId !== word.id) throw new Error(`Sentence ${sentence.id} does not target ${word.id}`);
  const targetTiles: MissionTile[] = word.graphemeUnits.map((unit, index) => ({
    id: `target:${index}:${unit.id}`,
    letters: unit.letters,
    targetUnitId: unit.id,
  }));
  const distractorCount = 1 + Math.floor(englishRandom(`${seed}:distractor-count`)() * Math.min(3, word.distractorUnits.length));
  const distractors: MissionTile[] = seededShuffle(word.distractorUnits, `${seed}:distractors`).slice(0, distractorCount).map((letters, index) => ({
    id: `distractor:${index}:${letters}`,
    letters,
    targetUnitId: null,
  }));
  return { seed, word, sentence, tiles: seededShuffle([...targetTiles, ...distractors], `${seed}:tiles`) };
}

export function initialBuildState(): BuildState {
  return { selectedTileIds: [], hiddenDistractorIds: [], fixedTargetUnitIds: [], hintLevel: 0 };
}

export function selectBuildTile(state: BuildState, mission: EnglishMission, tileId: string): BuildState {
  if (state.selectedTileIds.includes(tileId) || state.hiddenDistractorIds.includes(tileId)) return state;
  const tile = mission.tiles.find((candidate) => candidate.id === tileId);
  if (!tile || (tile.targetUnitId && state.fixedTargetUnitIds.includes(tile.targetUnitId))) return state;
  return { ...state, selectedTileIds: [...state.selectedTileIds, tileId] };
}

export function undoBuildTile(state: BuildState): BuildState {
  if (state.selectedTileIds.length === 0) return state;
  return { ...state, selectedTileIds: state.selectedTileIds.slice(0, -1) };
}

export function resetBuildState(state: BuildState): BuildState {
  return { ...state, selectedTileIds: [] };
}

export function buildSlotTiles(state: BuildState, mission: EnglishMission): readonly (MissionTile | null)[] {
  const selected = state.selectedTileIds.map((id) => mission.tiles.find((tile) => tile.id === id)).filter((tile): tile is MissionTile => Boolean(tile));
  let selectedIndex = 0;
  return mission.word.graphemeUnits.map((unit) => {
    if (state.fixedTargetUnitIds.includes(unit.id)) return mission.tiles.find((tile) => tile.targetUnitId === unit.id) ?? null;
    const tile = selected[selectedIndex] ?? null;
    selectedIndex += 1;
    return tile;
  });
}

export function selectedLetters(state: BuildState, mission: EnglishMission): string {
  return buildSlotTiles(state, mission).map((tile) => tile?.letters ?? "").join("");
}

export function buildIsComplete(state: BuildState, mission: EnglishMission): boolean {
  const slots = buildSlotTiles(state, mission);
  const nonFixedCount = mission.word.graphemeUnits.filter((unit) => !state.fixedTargetUnitIds.includes(unit.id)).length;
  return state.selectedTileIds.length === nonFixedCount
    && slots.every((tile, index) => tile?.letters === mission.word.graphemeUnits[index].letters)
    && selectedLetters(state, mission) === mission.word.displayWord;
}

export function applyBuildHint(state: BuildState, mission: EnglishMission): BuildState {
  const nextLevel = Math.min(5, state.hintLevel + 1);
  if (nextLevel === 2) {
    const distractor = mission.tiles.find((tile) => tile.targetUnitId === null && !state.hiddenDistractorIds.includes(tile.id));
    return { ...state, hintLevel: nextLevel, hiddenDistractorIds: distractor ? [...state.hiddenDistractorIds, distractor.id] : state.hiddenDistractorIds };
  }
  if (nextLevel === 3 || nextLevel === 4) {
    const canFixAnother = state.fixedTargetUnitIds.length < mission.word.graphemeUnits.length - 1;
    const candidate = canFixAnother ? mission.word.graphemeUnits.find((unit) => !state.fixedTargetUnitIds.includes(unit.id) && (
      unit.role === "irregular-heart" || (nextLevel === 3 && mission.word.decodingBand !== "irregular-supported")
    )) : undefined;
    const candidateTileId = candidate ? mission.tiles.find((tile) => tile.targetUnitId === candidate.id)?.id : undefined;
    return {
      ...state,
      hintLevel: nextLevel,
      selectedTileIds: candidateTileId ? state.selectedTileIds.filter((id) => id !== candidateTileId) : state.selectedTileIds,
      fixedTargetUnitIds: candidate ? [...state.fixedTargetUnitIds, candidate.id] : state.fixedTargetUnitIds,
    };
  }
  return { ...state, hintLevel: nextLevel };
}

export function sentenceTokens(sentence: EnglishSentenceRecord): readonly string[] {
  return sentence.text.replace(/[.!?]$/, "").split(/\s+/);
}

export function sentenceHasUniqueTarget(sentence: EnglishSentenceRecord, word: EnglishWordRecord): boolean {
  const tokens = sentenceTokens(sentence).map((token) => token.toLocaleLowerCase("en-US"));
  return tokens[sentence.targetSlotIndex] === word.displayWord.toLocaleLowerCase("en-US")
    && tokens.filter((token) => token === word.displayWord.toLocaleLowerCase("en-US")).length === 1;
}

export function graphemeLetters(word: EnglishWordRecord): string {
  return word.graphemeUnits.map((unit) => unit.letters).join("");
}

export function graphemePhonemes(word: EnglishWordRecord): readonly string[] {
  return word.graphemeUnits.flatMap((unit) => unit.phonemeIds);
}

export function validateWordRecord(word: EnglishWordRecord): readonly string[] {
  const errors: string[] = [];
  if (graphemeLetters(word) !== word.displayWord) errors.push("GRAPHEME_LETTERS_MISMATCH");
  if (graphemePhonemes(word).join(" ") !== word.arpabet.join(" ")) errors.push("PHONEME_COVERAGE_MISMATCH");
  if (word.phonemeCount !== word.arpabet.length) errors.push("PHONEME_COUNT_MISMATCH");
  if (word.decodingBand === "irregular-supported" && !word.graphemeUnits.some((unit) => unit.role === "irregular-heart")) errors.push("IRREGULAR_HEART_MISSING");
  if (word.storyBand === "story-core" && word.sentenceIds.length === 0) errors.push("STORY_SENTENCE_MISSING");
  if (word.sourceIds.length < 3) errors.push("SOURCE_COVERAGE_MISSING");
  if (!word.childDefinitionEn || !word.childGlossZh || !word.senseId) errors.push("MEANING_FIELD_MISSING");
  if (word.visualKind === "asset" && !word.imageAssetId) errors.push("IMAGE_ASSET_MISSING");
  return errors;
}

export function unitHint(unit: GraphemeUnit): string {
  if (unit.childHint) return unit.childHint;
  return unit.role === "irregular-heart" ? "This is a heart part to remember." : `Keep ${unit.letters} together.`;
}
