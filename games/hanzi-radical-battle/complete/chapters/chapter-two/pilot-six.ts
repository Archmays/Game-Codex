import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../content-graph/families";
import { completeCharacterId } from "../../content-graph/ids";
import { CHAPTER_TWO_EPISODES } from "./contracts";

export const PILOT_SIX_RULESET = "pilot-six-r1" as const;
export type ChapterTwoRuleset = typeof PILOT_SIX_RULESET;
export type PilotExpression = "quiet" | "talk";
export type PilotEdge = readonly [string, string];

export interface PilotEncounterProgress {
  readonly magicApplied: boolean;
  readonly expression: PilotExpression | null;
  readonly edges: readonly PilotEdge[];
  readonly wheelNodeId: string;
  readonly mistCleared: boolean;
}

export interface PilotSixDefinition {
  readonly episodeId: string;
  readonly encounterIndex: number;
  readonly characterId: string;
  readonly scene: "canopy" | "valley";
  readonly object: "ink-leaves" | "lamp" | "vine" | "leaf-gate" | "stone-path" | "waterwheel";
  readonly familyId: string;
  readonly nodeIds: readonly string[];
  readonly decoyId: string;
  readonly startId: string;
  readonly endId: string;
  readonly goal: string;
  readonly magicLabel: string;
  readonly afterMessage: string;
}

const canopy = "chapter-two:wood-voice-canopy";
const valley = "chapter-two:spring-stone-valley";
const id = completeCharacterId;
function define(episodeId: string, encounterIndex: number, glyph: string, object: PilotSixDefinition["object"], familyId: string, nodes: string[], decoy: string, goal: string, magicLabel: string, afterMessage: string): PilotSixDefinition {
  const nodeIds = nodes.map(id);
  return { episodeId, encounterIndex, characterId: id(glyph), scene: episodeId === canopy ? "canopy" : "valley", object, familyId, nodeIds, decoyId: id(decoy), startId: nodeIds[0], endId: nodeIds.at(-1)!, goal, magicLabel, afterMessage };
}

export const PILOT_SIX_DEFINITIONS: readonly PilotSixDefinition[] = [
  define(canopy, 0, "指", "ink-leaves", "family-hand", ["看", "指"], "请", "用指光看清被墨叶挡住的通路", "用指光照向墨叶", "墨叶退开了。把两端的手形字脉接起来，让桥接通。"),
  define(canopy, 1, "饱", "lamp", "family-heart", ["情", "思"], "饱", "把吃饱后的暖光送给灯苗", "把饱足暖光送给灯苗", "灯苗亮起来了。连接心形部件，让亮光照过桥。"),
  define(canopy, 2, "情", "vine", "family-speech", ["请", "语"], "情", "表达心情，让一弯树藤舒展", "把心灯送给树藤", "这一弯树藤舒展了。连接言字旁，让回声沿藤路过去。"),
  define(canopy, 3, "请", "leaf-gate", "family-foot", ["跑", "路", "跳"], "饱", "请问叶门，再接通门前的路", "请问，可以过去吗？", "叶门回应：可以呀。连接足字旁，接通入口到叶门的路。"),
  define(valley, 0, "路", "stone-path", "family-walk", ["进", "迷", "道"], "路", "用路纹接通石阶前的道路", "把路纹送到断开的踏石", "脚印照出了接路的方向。连接走之字脉，让踏石从入口接到石阶。"),
  define(valley, 1, "进", "waterwheel", "family-water", ["清", "河", "海"], "请", "沿已经接好的路，让小水轮前进", "让小水轮沿通路前进", "小水轮来到石阶了。连接三点水，接通这一小段引水沟。"),
];

export function pilotEncounterKey(definition: Pick<PilotSixDefinition, "episodeId" | "encounterIndex">): string {
  return `${definition.episodeId}/${definition.encounterIndex}`;
}

export function getPilotSixDefinition(state: { readonly ruleset?: ChapterTwoRuleset; readonly episodeIndex: number; readonly encounterIndex: number }): PilotSixDefinition | undefined {
  if (state.ruleset !== PILOT_SIX_RULESET) return undefined;
  const episodeId = CHAPTER_TWO_EPISODES[state.episodeIndex]?.id;
  return PILOT_SIX_DEFINITIONS.find((definition) => definition.episodeId === episodeId && definition.encounterIndex === state.encounterIndex);
}

export function freshPilotProgress(): PilotEncounterProgress {
  return { magicApplied: false, expression: null, edges: [], wheelNodeId: id("进"), mistCleared: false };
}

export function samePilotEdge(edge: PilotEdge, a: string, b: string): boolean {
  return (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a);
}

export function pilotReachable(start: string, edges: readonly PilotEdge[]): ReadonlySet<string> {
  const reached = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of edges) {
      if (reached.has(a) && !reached.has(b)) { reached.add(b); changed = true; }
      if (reached.has(b) && !reached.has(a)) { reached.add(a); changed = true; }
    }
  }
  return reached;
}

// The scene is an adapter over the existing allocation, never a new content graph.
for (const definition of PILOT_SIX_DEFINITIONS) {
  const episode = CHAPTER_TWO_EPISODES.find((candidate) => candidate.id === definition.episodeId)!;
  const family = COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === definition.familyId)!;
  if (episode.storyCharacterIds[definition.encounterIndex] !== definition.characterId || episode.familyIds[definition.encounterIndex] !== definition.familyId) throw new Error("PILOT_ENCOUNTER_ALLOCATION_DRIFT");
  if (!definition.nodeIds.every((node) => family.memberCharacterIds.includes(node)) || family.memberCharacterIds.includes(definition.decoyId)) throw new Error("PILOT_FAMILY_MEMBERSHIP_DRIFT");
  if (![...definition.nodeIds, definition.decoyId].every((node) => COMPLETE_CORE_CHARACTER_NODES.some((character) => character.id === node) && COMPLETE_COMPONENT_RELATIONS.some((relation) => relation.characterId === node))) throw new Error("PILOT_RELATION_EVIDENCE_MISSING");
}
