import { M1_BEHAVIORS } from "./content";
import { CHAPTER_ONE_CHARACTERS } from "./characters";
import { M3_BUILD_ABILITIES, type M3AbilityId, type M3HeroId } from "./builds";
import { createDeterministicRng, hashSeed } from "./rng";
import type { ChapterRegionId } from "./content-types";
import type { M1BehaviorId } from "./types";
import type { M3EncounterPlan, M3PathPlan, M3RegionPlan, M3RunPlan } from "./m3-types";

const REGION_META: Readonly<Record<ChapterRegionId, { title: string; paths: readonly [{ label: string; promise: string; visual: string }, { label: string; promise: string; visual: string }] }>> = {
  "glimmer-grove": { title: "微光林径", paths: [{ label: "灯影小径", promise: "看清结构灯，再追树影", visual: "lantern-path" }, { label: "萤火桥", promise: "沿萤火走，看部件重逢", visual: "firefly-bridge" }] },
  "echo-garden": { title: "花园回声", paths: [{ label: "花门路", promise: "穿过花门，听见词语回声", visual: "flower-arches" }, { label: "清泉路", promise: "沿着水光，慢慢看位置", visual: "clear-stream" }] },
  "wind-trail": { title: "风的脚印", paths: [{ label: "风铃坡", promise: "风铃带路，手牌清楚", visual: "wind-bells" }, { label: "云影桥", promise: "云影慢移，包围路亮起", visual: "cloud-bridge" }] },
};

const SHARED_COMPONENT_GROUPS: Readonly<Record<ChapterRegionId, readonly (readonly string[])[]>> = {
  "glimmer-grove": [["qing-clear", "qing-sunny"], ["he", "hai", "yang"], ["ming", "xing"], ["lin", "song"]],
  "echo-garden": [["cao", "miao", "cai"], ["ni", "ta"], ["yuan", "hui"]],
  "wind-trail": [["guo", "tu", "yuan-round"], ["wen", "bi-close"]],
};

function encounterCharacters(seed: string, heroId: M3HeroId, regionId: ChapterRegionId, pathIndex: 0 | 1): readonly [string, string, string, string] {
  const rng = createDeterministicRng(`${seed}:${heroId}:${regionId}:path-${pathIndex}:characters`);
  const groups = SHARED_COMPONENT_GROUPS[regionId];
  const group = groups[rng.nextInt(groups.length)];
  const repeatedPair = rng.shuffle(group).slice(0, 2);
  const pool = CHAPTER_ONE_CHARACTERS.filter((entry) => entry.regionId === regionId && !repeatedPair.includes(entry.id)).map((entry) => entry.id);
  const fillers = rng.shuffle(pool).slice(0, 2);
  const opening = rng.shuffle([repeatedPair[0], ...fillers]);
  return [...opening, repeatedPair[1]] as [string, string, string, string];
}

function behaviorSchedule(seed: string, heroId: M3HeroId, regionId: ChapterRegionId, pathIndex: 0 | 1): readonly [M1BehaviorId, M1BehaviorId, M1BehaviorId, M1BehaviorId] {
  const rng = createDeterministicRng(`${seed}:${heroId}:${regionId}:path-${pathIndex}:behaviors`);
  const learned = rng.shuffle(M1_BEHAVIORS.map((entry) => entry.id)).slice(0, 3) as M1BehaviorId[];
  return [learned[0], learned[1], learned[2], learned[rng.nextInt(3)]];
}

function makePath(seed: string, heroId: M3HeroId, regionId: ChapterRegionId, pathIndex: 0 | 1): M3PathPlan {
  const meta = REGION_META[regionId].paths[pathIndex];
  const ids = encounterCharacters(seed, heroId, regionId, pathIndex);
  const behaviors = behaviorSchedule(seed, heroId, regionId, pathIndex);
  const rng = createDeterministicRng(`${seed}:${heroId}:${regionId}:path-${pathIndex}:hands`);
  const encounters = ids.map((characterId, index): M3EncounterPlan => ({
    id: `m3:${regionId}:${pathIndex}:${index}:${characterId}`,
    characterId,
    handVariant: rng.nextInt(3) as 0 | 1 | 2,
    behaviorId: behaviors[index],
    sequence: index as 0 | 1 | 2 | 3,
    boss: index === 3,
  })) as unknown as M3PathPlan["encounters"];
  return { id: `${regionId}:${pathIndex === 0 ? "lantern" : "wild"}`, regionId, label: meta.label, shortPromise: meta.promise, visualKey: meta.visual, encounters };
}

function signature(seed: string, heroId: M3HeroId, regions: readonly M3RegionPlan[]): string {
  const payload = regions.map((region) => ({
    id: region.regionId,
    offer: region.abilityOffer,
    paths: region.pathOptions.map((path) => ({ id: path.id, encounters: path.encounters })),
  }));
  return `fnv1a:${hashSeed(`${seed}:${heroId}:${JSON.stringify(payload)}`).toString(16).padStart(8, "0")}`;
}

export function generateM3RunPlan(seed: string, heroId: M3HeroId): M3RunPlan {
  const normalizedSeed = seed.trim() || "ink-forest-2";
  const rng = createDeterministicRng(`${normalizedSeed}:${heroId}:m3-abilities`);
  const abilities = rng.shuffle(M3_BUILD_ABILITIES.map((entry) => entry.id));
  const regionIds = ["glimmer-grove", "echo-garden", "wind-trail"] as const;
  const regions = regionIds.map((regionId, index): M3RegionPlan => ({
    regionId,
    title: REGION_META[regionId].title,
    pathOptions: [makePath(normalizedSeed, heroId, regionId, 0), makePath(normalizedSeed, heroId, regionId, 1)],
    abilityOffer: abilities.slice(index * 3, index * 3 + 3) as [M3AbilityId, M3AbilityId, M3AbilityId],
  })) as unknown as M3RunPlan["regions"];
  return { schemaVersion: 2, seed: normalizedSeed, heroId, regions, planSignature: signature(normalizedSeed, heroId, regions) };
}

export function defaultM3PathIndex(seed: string, heroId: M3HeroId, regionIndex: number): 0 | 1 {
  return ((hashSeed(`${seed}:${heroId}:m3-route`) >>> (regionIndex * 7 + 2)) & 1) as 0 | 1;
}

export function defaultM3AbilityIndex(seed: string, heroId: M3HeroId, regionIndex: number): 0 | 1 | 2 {
  return ((hashSeed(`${seed}:${heroId}:m3-choice`) >>> (regionIndex * 8 + 1)) % 3) as 0 | 1 | 2;
}
