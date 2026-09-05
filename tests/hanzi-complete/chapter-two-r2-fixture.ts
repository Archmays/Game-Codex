import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { createChapterTwoState, getPilotProgress, getR2Progress, reduceChapterTwoState, type ChapterTwoAction, type ChapterTwoState } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { CHAPTER_TWO_R2_RULESET, getChapterTwoSceneDefinition, getR2Definition } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/chapter-two-r2";
import { pilotReachable } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";

/** Source-driven deterministic fixture, never used by the final UI-only cross-review. */
export function chapterTwoR2Run(options: { seed?: string; branch?: boolean; stop?: (state: ChapterTwoState) => boolean } = {}) {
  const seed = options.seed ?? "chapter-two-r2-fixture";
  let state = createChapterTwoState(seed, "light-speaker", CHAPTER_TWO_R2_RULESET);
  const actions: ChapterTwoAction[] = [];
  const act = (action: ChapterTwoAction) => {
    const next = reduceChapterTwoState(state, action);
    if (next === state) throw new Error(`R2 fixture rejected ${state.phase}/${action.type}`);
    actions.push(action); state = next;
  };
  for (let guard = 0; guard < 800 && state.phase !== "chapter-summary"; guard++) {
    if (options.stop?.(state)) break;
    const definition = getChapterTwoSceneDefinition(state), r2 = getR2Definition(state);
    const progress = getPilotProgress(state);
    if (state.phase === "chapter-intro") act({ type: "start" });
    else if (state.phase === "build") {
      const part = COMPLETE_CORE_CHARACTER_NODES.find(character => character.id === state.currentCharacterId)!.components.find(part => !state.placements.some(placement => placement.slotId === part.slotId))!;
      act({ type: "place-card", cardId: state.hand.find(card => card.kind === "target" && card.expectedSlotId === part.slotId)!.id, slotId: part.slotId });
    } else if (state.phase === "pilot-meaning" && r2) {
      const targets = options.branch ? [...r2.targets].reverse() : r2.targets;
      act({ type: "r2-target", targetId: targets.find(target => !getR2Progress(state).targets.includes(target.id))!.id });
    } else if (state.phase === "pilot-meaning") {
      if (definition!.object === "waterwheel") act({ type: "pilot-move", nodeId: options.branch && progress.wheelNodeId === "char-u8fdb" ? "char-u8ff7" : "char-u9053" });
      else act({ type: "pilot-magic", ...(definition!.object === "vine" ? { expression: options.branch ? "talk" as const : "quiet" as const } : {}) });
    } else if (state.phase === "family-connect") {
      if (definition!.object === "leaf-gate" && !progress.mistCleared) { act({ type: "pilot-observe" }); continue; }
      if (r2?.rootSource !== undefined && pilotReachable(r2.startId, progress.edges).has(r2.endId)) { act({ type: "r2-root" }); continue; }
      const nodes = definition!.nodeIds;
      const branch = options.branch && nodes.length > 2;
      const a = branch && progress.edges.length ? nodes[1] : nodes[0];
      const b = branch && !progress.edges.length ? nodes[1] : nodes.at(-1)!;
      act({ type: "toggle-family-character", characterId: a }); act({ type: "toggle-family-character", characterId: b }); act({ type: "connect-family" });
    } else if (state.phase === "core-intro") act({ type: "start-core" });
    else if (state.phase === "ending") act({ type: "finish-ending" });
    else act({ type: "continue" });
  }
  return { seed, initialHeroId: "light-speaker" as const, ruleset: CHAPTER_TWO_R2_RULESET, actions, state };
}
