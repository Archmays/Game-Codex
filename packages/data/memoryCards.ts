import { LEGACY_WHEEL_SOURCE } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source";

export interface MemoryCardPair {
  id: string;
  label: string;
  symbol: string;
  outer: string;
  inner: string;
}

export interface MemoryCardSet {
  id: string;
  label: string;
  pairs: MemoryCardPair[];
}

export const MEMORY_CARD_PAIR_COUNT = 6;

// The memory game still uses the preserved raw character pairs. Corrections for
// Wheel Workshop play remain isolated in its canonical and playable layers.
export const memoryCardSets: MemoryCardSet[] = LEGACY_WHEEL_SOURCE.map((set) => ({
  id: set.id,
  label: set.label,
  pairs: set.char.validPairs.map((pair) => ({
    id: `${set.id}-${pair.result}`,
    label: `${pair.result}：${pair.words[0]}`,
    symbol: pair.result,
    outer: pair.outer,
    inner: pair.inner
  }))
}));

export const memoryCardPairs: MemoryCardPair[] = memoryCardSets[0]?.pairs ?? [];

export function pickMemoryCardPairs(
  pairs: readonly MemoryCardPair[],
  count: number = MEMORY_CARD_PAIR_COUNT,
  random: () => number = Math.random
): MemoryCardPair[] {
  const candidates = shuffle(uniqueBySymbol(pairs), random);
  const picked: MemoryCardPair[] = [];

  pickWithinPartLimit(candidates, picked, count, 2);
  pickWithinPartLimit(candidates, picked, count, 3);

  for (const pair of candidates) {
    if (picked.length >= count) {
      break;
    }
    if (!picked.includes(pair)) {
      picked.push(pair);
    }
  }

  return picked;
}

function pickWithinPartLimit(
  candidates: readonly MemoryCardPair[],
  picked: MemoryCardPair[],
  count: number,
  partLimit: number
): void {
  for (const pair of candidates) {
    if (picked.length >= count) {
      return;
    }
    if (picked.includes(pair)) {
      continue;
    }
    if (countPart(picked, "outer", pair.outer) >= partLimit || countPart(picked, "inner", pair.inner) >= partLimit) {
      continue;
    }
    picked.push(pair);
  }
}

function countPart(pairs: readonly MemoryCardPair[], key: "outer" | "inner", value: string): number {
  return pairs.filter((pair) => pair[key] === value).length;
}

function uniqueBySymbol(pairs: readonly MemoryCardPair[]): MemoryCardPair[] {
  const seen = new Set<string>();
  const uniquePairs: MemoryCardPair[] = [];

  for (const pair of pairs) {
    if (seen.has(pair.symbol)) {
      continue;
    }
    seen.add(pair.symbol);
    uniquePairs.push(pair);
  }

  return uniquePairs;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
