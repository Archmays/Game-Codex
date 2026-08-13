import { getV1Encounter } from "../golden-slice/content/adventures";
import { M1_ABILITIES, M1_REGIONS } from "./content";
import { createDeterministicRng, hashSeed } from "./rng";
import type {
  M1AbilityId,
  M1EncounterPlan,
  M1PathDefinition,
  M1RegionPlan,
  M1RunPlan,
} from "./types";

export const M1_RUN_SCHEMA_VERSION = 1 as const;

function planSignature(seed: string, regions: readonly M1RegionPlan[]): string {
  const payload = regions.map((region) => ({
    regionId: region.regionId,
    paths: region.pathOptions.map((path) => [path.id, path.encounterOrder, path.behaviorOrder]),
    offer: region.abilityOffer,
  }));
  return `fnv1a:${hashSeed(`${seed}:${JSON.stringify(payload)}`).toString(16).padStart(8, "0")}`;
}

export function generateM1RunPlan(seed: string): M1RunPlan {
  const normalizedSeed = seed.trim() || "ink-forest-1";
  const rng = createDeterministicRng(`${normalizedSeed}:m1-plan`);
  const shuffledAbilities = rng.shuffle(M1_ABILITIES.map((ability) => ability.id));
  const regions = M1_REGIONS.map((region, index): M1RegionPlan => ({
    regionId: region.id,
    title: region.title,
    pathOptions: region.paths,
    abilityOffer: shuffledAbilities.slice(index * 3, index * 3 + 3) as [M1AbilityId, M1AbilityId, M1AbilityId],
  })) as unknown as [M1RegionPlan, M1RegionPlan, M1RegionPlan];
  return {
    schemaVersion: M1_RUN_SCHEMA_VERSION,
    seed: normalizedSeed,
    regions,
    planSignature: planSignature(normalizedSeed, regions),
  };
}

export function buildM1EncounterPlan(path: M1PathDefinition): readonly M1EncounterPlan[] {
  return path.encounterOrder.map((encounterId, index) => {
    const encounter = getV1Encounter(encounterId);
    return {
      encounterId,
      characterId: encounter.characterId,
      behaviorId: path.behaviorOrder[index],
      sequence: index as 0 | 1 | 2 | 3,
      boss: index === 3,
    };
  });
}

export function defaultM1PathIndex(seed: string, regionIndex: number): 0 | 1 {
  const routeVector = hashSeed(`${seed}:route-vector`);
  return ((routeVector >>> (regionIndex * 7 + 3)) & 1) as 0 | 1;
}

export function defaultM1AbilityIndex(seed: string, regionIndex: number): 0 | 1 | 2 {
  const abilityVector = hashSeed(`${seed}:ability-vector`);
  return ((abilityVector >>> (regionIndex * 8 + 2)) % 3) as 0 | 1 | 2;
}
