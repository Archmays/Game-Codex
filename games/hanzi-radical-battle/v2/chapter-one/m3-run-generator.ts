import { CHAPTER_ONE_CHARACTERS, getChapterOneCharacter } from "./characters";
import { M3_BUILD_ABILITIES, type M3AbilityId, type M3HeroId } from "./builds";
import { M5_REGION_META, type M5BehaviorId } from "./m5-content";
import { createDeterministicRng, hashSeed } from "./rng";
import type { ChapterRegionId } from "./content-types";
import type { M3EncounterPlan, M3PathPlan, M3RegionPlan, M3RunPlan, M5AdventureMode } from "./m3-types";

const REGION_IDS = ["glimmer-grove", "echo-garden", "wind-trail"] as const;

const SHARED_COMPONENT_GROUPS: Readonly<Record<ChapterRegionId, readonly (readonly string[])[]>> = {
  "glimmer-grove": [["qing-clear", "qing-sunny"], ["he", "hai", "yang"], ["ming", "xing"], ["lin", "song"]],
  "echo-garden": [["cao", "miao", "cai"], ["ni", "ta"], ["yuan", "hui"]],
  "wind-trail": [["guo", "tu", "yuan-round"], ["wen", "bi-close"]],
};

function chooseDifferentStructure(ids: readonly string[], excludedId: string, rng: ReturnType<typeof createDeterministicRng>): string {
  const excluded = getChapterOneCharacter(excludedId);
  const different = rng.shuffle(ids.filter((id) => getChapterOneCharacter(id).structure !== excluded.structure));
  return different[0] ?? rng.shuffle(ids)[0];
}

function encounterCharacters(seed: string, heroId: M3HeroId, regionId: ChapterRegionId, pathIndex: 0 | 1): readonly [string, string, string, string] {
  const rng = createDeterministicRng(`${seed}:${heroId}:${regionId}:path-${pathIndex}:characters:v2`);
  const groups = SHARED_COMPONENT_GROUPS[regionId];
  const group = rng.shuffle(groups)[pathIndex % groups.length];
  const repeatedPair = rng.shuffle(group).slice(0, 2);
  const regionPool = CHAPTER_ONE_CHARACTERS.filter((entry) => entry.regionId === regionId).map((entry) => entry.id);
  const remaining = rng.shuffle(regionPool.filter((id) => !repeatedPair.includes(id)));
  const normalTwo = remaining[0];
  const bossTwo = chooseDifferentStructure(remaining.slice(1), repeatedPair[1], rng);
  return [repeatedPair[0], normalTwo, repeatedPair[1], bossTwo];
}

function behaviorSchedule(regionId: ChapterRegionId, pathIndex: 0 | 1): readonly [M5BehaviorId, M5BehaviorId, M5BehaviorId, M5BehaviorId] {
  const [first, shared, third] = M5_REGION_META[regionId].behaviorIds;
  return pathIndex === 0 ? [first, shared, first, shared] : [shared, third, shared, third];
}

function makeEncounter(args: {
  readonly id: string;
  readonly characterId: string;
  readonly handVariant: 0 | 1 | 2;
  readonly behaviorId: M5BehaviorId;
  readonly sequence: 0 | 1 | 2 | 3;
  readonly boss: boolean;
  readonly bossId: M3EncounterPlan["bossId"];
  readonly bossPhase: M3EncounterPlan["bossPhase"];
  readonly combinedBehaviorIds?: readonly M5BehaviorId[];
  readonly finalChallenge?: M3EncounterPlan["finalChallenge"];
}): M3EncounterPlan {
  return {
    ...args,
    combinedBehaviorIds: args.combinedBehaviorIds ?? [args.behaviorId],
    finalChallenge: args.finalChallenge ?? "none",
  };
}

function makePath(seed: string, heroId: M3HeroId, regionId: ChapterRegionId, pathIndex: 0 | 1): M3PathPlan {
  const meta = M5_REGION_META[regionId];
  const pathMeta = meta.paths[pathIndex];
  const ids = encounterCharacters(seed, heroId, regionId, pathIndex);
  const behaviors = behaviorSchedule(regionId, pathIndex);
  const rng = createDeterministicRng(`${seed}:${heroId}:${regionId}:path-${pathIndex}:hands:v2`);
  const encounters = ids.map((characterId, index) => makeEncounter({
    id: `m5:${regionId}:${pathIndex}:${index}:${characterId}`,
    characterId,
    handVariant: rng.nextInt(3) as 0 | 1 | 2,
    behaviorId: behaviors[index],
    sequence: index as 0 | 1 | 2 | 3,
    boss: index >= 2,
    bossId: index >= 2 ? meta.bossId : null,
    bossPhase: index >= 2 ? (index - 1) as 1 | 2 : 0,
  })) as unknown as M3PathPlan["encounters"];
  return {
    id: `${regionId}:${pathIndex === 0 ? "lantern" : "wild"}`,
    regionId,
    label: pathMeta.label,
    shortPromise: pathMeta.promise,
    visualKey: pathMeta.visual,
    encounters,
  };
}

function selectFinalCharacters(seed: string, heroId: M3HeroId, regions: readonly M3RegionPlan[]): readonly [string, string, string] {
  const alternativePathIds = new Set(regions.flatMap((region) => region.pathOptions.flatMap((path) => path.encounters.map((entry) => entry.characterId))));
  const rng = createDeterministicRng(`${seed}:${heroId}:ink-king:characters`);
  const preferred = rng.shuffle(CHAPTER_ONE_CHARACTERS.filter((entry) => !alternativePathIds.has(entry.id)));
  const fallback = rng.shuffle(CHAPTER_ONE_CHARACTERS);
  const selected: string[] = [];
  for (const entry of preferred) {
    if (selected.includes(entry.id)) continue;
    if (selected.length < 3 && selected.every((id) => getChapterOneCharacter(id).structure !== entry.structure)) selected.push(entry.id);
    if (selected.length === 3) break;
  }
  for (const entry of preferred) {
    if (selected.length === 3) break;
    if (!selected.includes(entry.id)) selected.push(entry.id);
  }
  for (const entry of fallback) {
    if (selected.length === 3) break;
    if (!selected.includes(entry.id)) selected.push(entry.id);
  }
  return selected as unknown as readonly [string, string, string];
}

function makeFinalCore(seed: string, heroId: M3HeroId, regions: readonly M3RegionPlan[]): M3RunPlan["finalCore"] {
  const ids = selectFinalCharacters(seed, heroId, regions);
  const guaranteedSeen = regions.map((region) => M5_REGION_META[region.regionId].behaviorIds[1]);
  const rng = createDeterministicRng(`${seed}:${heroId}:ink-king:hands`);
  return {
    title: "墨王核心",
    sceneKey: "region-ink-king-core",
    ambienceKey: "ambience-core",
    encounters: [
      makeEncounter({ id: `m5:core:0:${ids[0]}`, characterId: ids[0], handVariant: rng.nextInt(3) as 0 | 1 | 2, behaviorId: guaranteedSeen[0], combinedBehaviorIds: [guaranteedSeen[0]], sequence: 0, boss: true, bossId: "ink-king-core", bossPhase: 1, finalChallenge: "structure-review" }),
      makeEncounter({ id: `m5:core:1:${ids[1]}`, characterId: ids[1], handVariant: rng.nextInt(3) as 0 | 1 | 2, behaviorId: guaranteedSeen[1], combinedBehaviorIds: [guaranteedSeen[0], guaranteedSeen[1]], sequence: 1, boss: true, bossId: "ink-king-core", bossPhase: 2, finalChallenge: "behavior-combination" }),
      makeEncounter({ id: `m5:core:2:${ids[2]}`, characterId: ids[2], handVariant: rng.nextInt(3) as 0 | 1 | 2, behaviorId: guaranteedSeen[2], combinedBehaviorIds: [guaranteedSeen[2]], sequence: 2, boss: true, bossId: "ink-king-core", bossPhase: 3, finalChallenge: "meaning-restoration" }),
    ],
  };
}

function signature(seed: string, heroId: M3HeroId, mode: M5AdventureMode, regions: readonly M3RegionPlan[], finalCore: M3RunPlan["finalCore"]): string {
  const payload = regions.map((region) => ({ id: region.regionId, offer: region.abilityOffer, paths: region.pathOptions.map((path) => ({ id: path.id, encounters: path.encounters })) }));
  return `fnv1a:${hashSeed(`${seed}:${heroId}:${mode}:${JSON.stringify(payload)}:${JSON.stringify(finalCore.encounters)}`).toString(16).padStart(8, "0")}`;
}

export function generateM3RunPlan(seed: string, heroId: M3HeroId, mode: M5AdventureMode = "story"): M3RunPlan {
  const normalizedSeed = seed.trim() || "ink-forest-2";
  const abilityRng = createDeterministicRng(`${normalizedSeed}:${heroId}:${mode}:m5-abilities`);
  const abilities = abilityRng.shuffle(M3_BUILD_ABILITIES.map((entry) => entry.id));
  const regionOrder = mode === "story" ? [...REGION_IDS] : createDeterministicRng(`${normalizedSeed}:${heroId}:free-region-order`).shuffle(REGION_IDS);
  const regions = regionOrder.map((regionId, index): M3RegionPlan => ({
    regionId,
    title: M5_REGION_META[regionId].title,
    pathOptions: [makePath(normalizedSeed, heroId, regionId, 0), makePath(normalizedSeed, heroId, regionId, 1)],
    abilityOffer: abilities.slice(index * 3, index * 3 + 3) as [M3AbilityId, M3AbilityId, M3AbilityId],
  })) as unknown as M3RunPlan["regions"];
  const finalCore = makeFinalCore(normalizedSeed, heroId, regions);
  const allEncounters = [...regions.flatMap((region) => region.pathOptions.flatMap((path) => path.encounters)), ...finalCore.encounters];
  return {
    schemaVersion: 3,
    seed: normalizedSeed,
    heroId,
    mode,
    regions,
    finalCore,
    regionOrder,
    characterCoverage: [...new Set(allEncounters.map((entry) => entry.characterId))],
    monsterBehaviorSchedule: [...new Set(allEncounters.flatMap((entry) => entry.combinedBehaviorIds))],
    planSignature: signature(normalizedSeed, heroId, mode, regions, finalCore),
  };
}

export function defaultM3PathIndex(seed: string, heroId: M3HeroId, regionIndex: number): 0 | 1 {
  return ((hashSeed(`${seed}:${heroId}:m5-route`) >>> (regionIndex * 7 + 2)) & 1) as 0 | 1;
}

export function defaultM3AbilityIndex(seed: string, heroId: M3HeroId, regionIndex: number): 0 | 1 | 2 {
  return ((hashSeed(`${seed}:${heroId}:m5-choice`) >>> (regionIndex * 8 + 1)) % 3) as 0 | 1 | 2;
}
