import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../content-graph/families";
import { completeCharacterId } from "../../content-graph/ids";
import { CHAPTER_TWO_EPISODES } from "./contracts";
import { getPilotSixDefinition, PILOT_SIX_RULESET, type ChapterTwoRuleset, type PilotSixDefinition } from "./pilot-six";

export const CHAPTER_TWO_R2_RULESET = "chapter-two-r2" as const;
export type R2Object = "star-path" | "thought-leaves" | "voice-bridge" | "rice-lamps" | "clock-doors" | "metal-lock" | "root-vine" | "root-road" | "root-guide";
export type R2Target = "upper-bend" | "lower-bend" | "water-clue" | "stone-clue" | "voice-left" | "voice-right" | "lamps-left" | "lamps-right" | "clock-face" | "tooth-left" | "tooth-right" | "quiet" | "talk" | "valley-light" | "root-light";
export interface R2EncounterProgress {
  readonly targets: readonly R2Target[];
  readonly choice: R2Target | null;
  readonly rootConnected: boolean;
}
export interface R2Definition extends Omit<PilotSixDefinition, "scene" | "object"> {
  readonly scene: "valley" | "corridor" | "core";
  readonly object: R2Object;
  readonly targets: readonly { readonly id: R2Target; readonly label: string; readonly after: string }[];
  readonly choice: boolean;
  readonly rootSource?: 0 | 1 | 2;
}
export type ChapterTwoSceneDefinition = PilotSixDefinition | R2Definition;
type Location = { readonly ruleset?: ChapterTwoRuleset; readonly episodeIndex: number; readonly encounterIndex: number };
const target = (id: R2Target, label: string, after: string) => ({ id, label, after });
function define(episodeIndex: 1 | 2 | 3, encounterIndex: number, object: R2Object, goal: string, targets: R2Definition["targets"], choice = false, rootSource?: 0 | 1 | 2): R2Definition {
  const episode = CHAPTER_TWO_EPISODES[episodeIndex];
  const characterId = episode.storyCharacterIds[encounterIndex];
  const familyId = episode.familyIds[encounterIndex];
  const family = COMPLETE_COMPONENT_FAMILIES.find(family => family.id === familyId)!;
  const nodeIds = family.memberCharacterIds;
  // Keep every current family member, including its qualified relationship evidence.
  const decoyId = family.memberCharacterIds.includes(characterId) ? completeCharacterId(object === "root-road" ? "路" : object === "root-guide" ? "请" : "饭") : characterId;
  return { episodeId: episode.id, encounterIndex, characterId, scene: episodeIndex === 1 ? "valley" : episodeIndex === 2 ? "corridor" : "core", object, familyId, nodeIds, decoyId, startId: nodeIds[0], endId: nodeIds.at(-1)!, goal, magicLabel: targets[0].label, afterMessage: "魔法已经落在场景里。再用这片区域的部件字脉接通入口和终点。", targets, choice, ...(rootSource !== undefined ? { rootSource } : {}) };
}
export const CHAPTER_TWO_R2_DEFINITIONS: readonly R2Definition[] = [
  define(1, 2, "star-path", "用星光辨清岔路，找到可见的出口", [target("upper-bend", "照亮上方弯路", "上方弯路的星点亮了，出口就在前面。"), target("lower-bend", "照亮下方弯路", "下方弯路的星点亮了，同样通向前面的出口。")], true),
  define(1, 3, "thought-leaves", "看看水流和踏石，再整理思路叶片", [target("water-clue", "先看水流线索", "水流、引水沟、小水轮的叶片排好了。"), target("stone-clue", "先看踏石线索", "踏石、脚印、出口的叶片排好了。")], true),
  define(2, 0, "voice-bridge", "让长廊两端互相回应，架起语言光桥", [target("voice-left", "让左端发出回应", "左端的声纹伸过来了，右端也可以回应。"), target("voice-right", "让右端发出回应", "右端的声纹伸过来了，左端也可以回应。")]),
  define(2, 1, "rice-lamps", "把米饭的暖雾送到两组疲倦小灯", [target("lamps-left", "把暖雾送给左灯组", "左边两盏灯挺起来了，照亮了左侧通路。"), target("lamps-right", "把暖雾送给右灯组", "右边两盏灯挺起来了，照亮了右侧通路。")]),
  define(2, 2, "clock-doors", "让可见钟声把两扇重叠门影稳住", [target("clock-face", "从时钟送出定影波纹", "两扇门影各归其位了。慢慢看，不用赶时间。")]),
  define(2, 3, "metal-lock", "把金属光片送回锁齿的两个缺口", [target("tooth-left", "把光片送进左齿口", "左齿口补好了，右边仍留着清楚的缺口。"), target("tooth-right", "把光片送进右齿口", "右齿口补好了，左边仍留着清楚的缺口。")]),
  define(3, 0, "root-vine", "用心灯舒开树冠根藤，把树冠字光接入树心", [target("quiet", "想静静，舒开上方根藤", "上方根藤舒展开了。接好青字脉，再让树冠根线入心。"), target("talk", "想聊聊，舒开下方根藤", "下方根藤舒展开了。接好青字脉，再让树冠根线入心。")], true, 0),
  define(3, 1, "root-road", "沿已经接好的踏石，把清泉字光送到树心", [target("valley-light", "沿已有踏石送来清泉字光", "字光沿先前接通的踏石前进了。接好走之字脉，再让清泉根线入心。")], false, 1),
  define(3, 2, "root-guide", "用指光照清门廊根线，让最后一条根线入心", [target("root-light", "用已学指光照清根线", "根线显回来了。接好手形字脉，再让门廊根线入心。")], false, 2),
];

export function getR2Definition(state: Location): R2Definition | undefined {
  if (state.ruleset !== CHAPTER_TWO_R2_RULESET) return undefined;
  return CHAPTER_TWO_R2_DEFINITIONS.find(definition => definition.episodeId === CHAPTER_TWO_EPISODES[state.episodeIndex]?.id && definition.encounterIndex === state.encounterIndex);
}
/** The published first six definitions and reducer branches are reused verbatim. */
export function getChapterTwoSceneDefinition(state: Location): ChapterTwoSceneDefinition | undefined {
  return getR2Definition(state) ?? getPilotSixDefinition(state.ruleset === CHAPTER_TWO_R2_RULESET ? { ...state, ruleset: PILOT_SIX_RULESET } : state);
}
export function freshR2Progress(): R2EncounterProgress { return { targets: [], choice: null, rootConnected: false }; }
export function isR2Target(value: unknown): value is R2Target { return CHAPTER_TWO_R2_DEFINITIONS.some(definition => definition.targets.some(target => target.id === value)); }

for (const definition of CHAPTER_TWO_R2_DEFINITIONS) {
  const family = COMPLETE_COMPONENT_FAMILIES.find(family => family.id === definition.familyId)!;
  if (family.memberCharacterIds.includes(definition.decoyId)) throw new Error("R2_DECOY_IS_MEMBER");
  for (const id of [...definition.nodeIds, definition.decoyId]) {
    if (!COMPLETE_CORE_CHARACTER_NODES.some(character => character.id === id) || !COMPLETE_COMPONENT_RELATIONS.some(relation => relation.characterId === id && (id === definition.decoyId || relation.familyId === definition.familyId))) throw new Error("R2_RELATION_EVIDENCE_MISSING");
  }
}
