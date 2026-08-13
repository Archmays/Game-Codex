export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface DeterministicRng {
  nextUint32(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export function createDeterministicRng(seed: string): DeterministicRng {
  let state = hashSeed(seed) || 0x9e3779b9;
  const nextUint32 = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return {
    nextUint32,
    nextInt(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new Error("maxExclusive must be a positive safe integer");
      return nextUint32() % maxExclusive;
    },
    pick<T>(items: readonly T[]): T {
      if (!items.length) throw new Error("Cannot pick from an empty collection");
      return items[this.nextInt(items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = this.nextInt(index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }
      return result;
    },
  };
}
