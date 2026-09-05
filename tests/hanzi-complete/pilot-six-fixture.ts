import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { createChapterTwoState, reduceChapterTwoState, type ChapterTwoAction, type ChapterTwoState } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { PILOT_SIX_RULESET, getPilotSixDefinition, type PilotExpression } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";

/** Synthetic deterministic input fixture. Never used by the UI-only review. */
export function pilotRun(options: { seed?: string; branch?: boolean; expression?: PilotExpression; stop?: (state: ChapterTwoState) => boolean } = {}) {
  const seed = options.seed ?? "pilot-six-fixture";
  let state = createChapterTwoState(seed, "light-speaker", PILOT_SIX_RULESET);
  const actions: ChapterTwoAction[] = [];
  const act = (action: ChapterTwoAction) => {
    const next = reduceChapterTwoState(state, action);
    if (next === state) throw new Error(`Fixture action rejected: ${state.phase}/${action.type}`);
    actions.push(action); state = next;
  };
  for (let guard = 0; guard < 700 && state.phase !== "chapter-summary"; guard++) {
    if (options.stop?.(state)) break;
    const pilot = getPilotSixDefinition(state);
    if (state.phase === "chapter-intro") act({ type: "start" });
    else if (state.phase === "build") {
      const target = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === state.currentCharacterId)!;
      const component = target.components.find((part) => !state.placements.some((placement) => placement.slotId === part.slotId))!;
      act({ type: "place-card", cardId: state.hand.find((card) => card.kind === "target" && card.expectedSlotId === component.slotId)!.id, slotId: component.slotId });
    } else if (state.phase === "pilot-meaning") {
      if (pilot!.object === "waterwheel") {
        const position = state.pilotProgress![`${pilot!.episodeId}/${pilot!.encounterIndex}`].wheelNodeId;
        act({ type: "pilot-move", nodeId: options.branch && position === "char-u8fdb" ? "char-u8ff7" : "char-u9053" });
      } else act({ type: "pilot-magic", ...(pilot!.object === "vine" ? { expression: options.expression ?? "quiet" } : {}) });
    } else if (state.phase === "family-connect") {
      if (pilot?.object === "leaf-gate" && !state.pilotProgress![`${pilot.episodeId}/${pilot.encounterIndex}`].mistCleared) { act({ type: "pilot-observe" }); continue; }
      const nodes = pilot?.nodeIds ?? COMPLETE_COMPONENT_FAMILIES.find((family) => family.id === state.currentFamilyId)!.memberCharacterIds;
      const edges = pilot ? state.pilotProgress![`${pilot.episodeId}/${pilot.encounterIndex}`].edges : [];
      const a = pilot && options.branch && nodes.length > 2 && edges.length > 0 ? nodes[1] : nodes[0];
      const b = pilot && options.branch && nodes.length > 2 && edges.length === 0 ? nodes[1] : pilot ? nodes.at(-1)! : nodes[1];
      act({ type: "toggle-family-character", characterId: a });
      act({ type: "toggle-family-character", characterId: b });
      act({ type: "connect-family" });
    } else if (state.phase === "ability-choice") act({ type: "choose-ability", abilityId: state.abilityOfferIds[0] });
    else if (state.phase === "behavior-telegraph") act({ type: "begin-behavior" });
    else if (state.phase === "behavior-effect") act({ type: "recover-behavior" });
    else if (state.phase === "core-intro") act({ type: "start-core" });
    else if (state.phase === "ending") act({ type: "finish-ending" });
    else act({ type: "continue" });
  }
  return { seed, initialHeroId: "light-speaker" as const, ruleset: PILOT_SIX_RULESET, actions, state };
}
