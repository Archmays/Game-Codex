import { M4_REPAIR_IDS, type M4RepairId } from "../../../v2/chapter-one/camp";
import { CHAPTER_ONE_CHARACTERS } from "../../../v2/chapter-one/characters";
import { createM3GameState, reduceM3State, replayM3Actions } from "../../../v2/chapter-one/m3-machine";
import type { M3AbilityId, M3HeroId } from "../../../v2/chapter-one/builds";
import type { M3Action, M3GameState, M5AdventureMode } from "../../../v2/chapter-one/m3-types";
import { completeCharacterId } from "../../content-graph/ids";

const characterByLegacyId = new Map(CHAPTER_ONE_CHARACTERS.map((character) => [character.id, character]));

export interface CompleteChapterOneRun {
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly mode: M5AdventureMode;
  readonly actions: readonly M3Action[];
  readonly state: M3GameState;
}

export function createCompleteChapterOneRun(seed: string, heroId: M3HeroId, mode: M5AdventureMode = "story"): CompleteChapterOneRun {
  return { seed, initialHeroId: heroId, mode, actions: [], state: createM3GameState(seed, heroId, mode) };
}

export function replayCompleteChapterOneRun(seed: string, initialHeroId: M3HeroId, actions: readonly M3Action[], mode: M5AdventureMode = "story"): CompleteChapterOneRun {
  return { seed, initialHeroId, mode, actions: [...actions], state: replayM3Actions(seed, initialHeroId, actions, mode) };
}

export function reduceCompleteChapterOneRun(run: CompleteChapterOneRun, action: M3Action): CompleteChapterOneRun {
  return { ...run, actions: [...run.actions, action], state: reduceM3State(run.state, action) };
}

export function toCompleteChapterOneCharacterIds(legacyIds: readonly string[]): string[] {
  return [...new Set(legacyIds.map((legacyId) => characterByLegacyId.get(legacyId)).filter((character) => character !== undefined).map((character) => completeCharacterId(character.glyph)))];
}

export function toCompleteChapterOneCharacterId(legacyId: string): string | null {
  const character = characterByLegacyId.get(legacyId);
  return character ? completeCharacterId(character.glyph) : null;
}

export function completeChapterOneEpisodeIds(state: M3GameState): string[] {
  const completedRegionCount = state.chapterStage !== "regions" || state.phase === "final-intro"
    ? 3
    : Math.min(3, state.regionIndex + (state.phase === "region-complete" ? 1 : 0));
  const completed = state.plan.regions.slice(0, completedRegionCount).map((region) => `chapter-one:${region.regionId}`);
  if (state.chapterStage === "complete") completed.push("chapter-one:ink-king-core");
  return [...new Set(completed)];
}

export function isCompleteChapterOneRun(state: M3GameState): boolean {
  return state.chapterStage === "complete" && state.phase === "run-summary";
}

export function completeChapterOneRepairIds(state: M3GameState): M4RepairId[] {
  if (isCompleteChapterOneRun(state)) return [...M4_REPAIR_IDS];
  const count = completeChapterOneEpisodeIds(state).length;
  return M4_REPAIR_IDS.slice(0, Math.min(M4_REPAIR_IDS.length, count * 2));
}

export function completeChapterOneAbilityIds(state: M3GameState): { readonly selected: readonly M3AbilityId[]; readonly triggered: readonly M3AbilityId[] } {
  return { selected: state.selectedAbilityIds, triggered: state.triggeredAbilityIds };
}

export { createM3GameState, reduceM3State, replayM3Actions };
export type { M3Action, M3GameState, M3HeroId, M5AdventureMode };
