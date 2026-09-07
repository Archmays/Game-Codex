import preserved from "./content/classic-packs.json";
import type { MemoryMatchPack } from "./types";

// Existing independent memory-card records and revisions, detached from retired engines.
export const CHINESE_MEMORY_PACKS = preserved.packs as readonly MemoryMatchPack[];
export const PINYIN_STARTER_CHARACTER_IDS: readonly string[] = preserved.starterCharacterIds;
export const MEMORY_MATCH_PACKS: readonly MemoryMatchPack[] = CHINESE_MEMORY_PACKS;
export function getMemoryPack(id: string | undefined): MemoryMatchPack {
  return MEMORY_MATCH_PACKS.find(pack => pack.id === id) ?? CHINESE_MEMORY_PACKS[0];
}
