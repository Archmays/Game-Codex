import { ENGLISH_V2_SENTENCE_BY_ID, ENGLISH_V2_WORDS } from "../../games/english-spell-battle/v2/content/manifest";
import {
  applyBuildHint,
  buildIsComplete,
  buildSlotTiles,
  createMission,
  initialBuildState,
  selectBuildTile,
} from "../../games/english-spell-battle/v2/core/machine";

describe("Wordlight Island V2 machine", () => {
  it("replays every seeded mission exactly and exposes only one target build", () => {
    let simulations = 0;
    for (const word of ENGLISH_V2_WORDS.filter((candidate) => candidate.storyBand === "story-core")) {
      const sentence = ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0])!;
      for (let index = 0; index < 1_667; index += 1) {
        const seed = `slice-${word.id}-${index}`;
        const left = createMission(word, sentence, seed);
        const right = createMission(word, sentence, seed);
        expect(left).toEqual(right);
        expect(left.tiles.filter((tile) => tile.targetUnitId === null).length).toBeGreaterThanOrEqual(1);
        expect(left.tiles.filter((tile) => tile.targetUnitId === null).length).toBeLessThanOrEqual(3);
        let state = initialBuildState();
        for (const unit of word.graphemeUnits) {
          const tile = left.tiles.find((candidate) => candidate.targetUnitId === unit.id)!;
          state = selectBuildTile(state, left, tile.id);
        }
        expect(buildIsComplete(state, left), `${word.id}:${index}`).toBe(true);
        expect(buildSlotTiles(state, left).map((tile) => tile?.letters).join("")).toBe(word.displayWord);
        simulations += 1;
      }
    }
    expect(simulations).toBe(50_010);
  });

  it("keeps the hint ladder deterministic and leaves a child-completed part", () => {
    for (const word of ENGLISH_V2_WORDS.filter((candidate) => candidate.storyBand === "story-core")) {
      const sentence = ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0])!;
      const mission = createMission(word, sentence, `hint-${word.id}`);
      let state = initialBuildState();
      for (let level = 1; level <= 5; level += 1) state = applyBuildHint(state, mission);
      expect(state.hintLevel).toBe(5);
      expect(state.hiddenDistractorIds.length).toBeLessThanOrEqual(1);
      expect(state.fixedTargetUnitIds.length, word.id).toBeLessThan(word.graphemeUnits.length);
      if (word.decodingBand === "irregular-supported") {
        expect(state.fixedTargetUnitIds.some((id) => word.graphemeUnits.find((unit) => unit.id === id)?.role === "irregular-heart")).toBe(true);
      }
    }
  });
});
