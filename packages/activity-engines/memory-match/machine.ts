import type { MatchRelation, MemoryCardInstance, MemoryMatchPack, MemoryMatchState } from "./types";

function seedHash(value: string): number {
  let hash = 1779033703;
  for (const character of value) { hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 3432918353); hash = hash << 13 | hash >>> 19; }
  return hash >>> 0;
}

export function memoryRandom(seed: string): () => number {
  let value = seedHash(seed) || 1;
  return () => { value |= 0; value = value + 0x6d2b79f5 | 0; let result = Math.imul(value ^ value >>> 15, 1 | value); result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result; return ((result ^ result >>> 14) >>> 0) / 4294967296; };
}

function shuffle<T>(input: readonly T[], random: () => number): T[] {
  const items = [...input];
  for (let index = items.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [items[index], items[swap]] = [items[swap], items[index]]; }
  return items;
}

export function validatePack(pack: MemoryMatchPack): string[] {
  const errors: string[] = [];
  if (new Set(pack.relations.map((item) => item.id)).size !== pack.relations.length) errors.push("DUPLICATE_RELATION_ID");
  for (const relation of pack.relations) {
    if (!relation.left.text && !relation.left.assetUrl) errors.push(`${relation.id}:EMPTY_LEFT`);
    if (!relation.right.text && !relation.right.assetUrl) errors.push(`${relation.id}:EMPTY_RIGHT`);
    if (!relation.explanation) errors.push(`${relation.id}:NO_EXPLANATION`);
  }
  return errors;
}

export function validateRoundRelations(relations: readonly MatchRelation[], identicalMode: boolean): string[] {
  const errors: string[] = [];
  const rightKeys = relations.map((item) => `${item.right.kind}:${item.right.text ?? item.right.assetUrl}`);
  if (new Set(rightKeys).size !== rightKeys.length) errors.push("AMBIGUOUS_RIGHT_FACE");
  if (identicalMode) {
    for (const relation of relations) if (relation.left.text !== relation.right.text) errors.push(`${relation.id}:NOT_IDENTICAL`);
  }
  return errors;
}

export function createMemoryDeck(pack: MemoryMatchPack, seed: string, pairCount = pack.defaultPairCount, preferredRelationIds: readonly string[] = []): readonly MemoryCardInstance[] {
  const random = memoryRandom(`${pack.id}:${seed}`);
  const count = Math.max(1, Math.min(Math.floor(pairCount), pack.relations.length));
  const preferred = new Set(preferredRelationIds);
  const preferredRelations = pack.relations.filter((relation) => preferred.has(relation.id));
  const pool = preferredRelations.length >= count ? preferredRelations : pack.relations;
  const relations = shuffle(pool, random).slice(0, count);
  const ambiguity = validateRoundRelations(relations, pack.id === "same-glyph");
  if (ambiguity.length) throw new Error(`Ambiguous memory round: ${ambiguity.join(",")}`);
  const cards = relations.flatMap((relation) => ([
    { instanceId: `${relation.id}:left`, relationId: relation.id, side: "left" as const, face: relation.left, position: -1 },
    { instanceId: `${relation.id}:right`, relationId: relation.id, side: "right" as const, face: relation.right, position: -1 },
  ]));
  return shuffle(cards, random).map((card, position) => ({ ...card, position }));
}

export function createMemoryState(pack: MemoryMatchPack, seed: string, pairCount?: number, preferredRelationIds: readonly string[] = []): MemoryMatchState {
  return { cards: createMemoryDeck(pack, seed, pairCount, preferredRelationIds), openInstanceIds: [], matchedRelationIds: [], locked: false };
}

export function flipMemoryCard(state: MemoryMatchState, instanceId: string): MemoryMatchState {
  if (state.locked || state.openInstanceIds.includes(instanceId)) return state;
  const card = state.cards.find((item) => item.instanceId === instanceId);
  if (!card || state.matchedRelationIds.includes(card.relationId)) return state;
  const open = [...state.openInstanceIds, instanceId];
  if (open.length < 2) return { ...state, openInstanceIds: open };
  const first = state.cards.find((item) => item.instanceId === open[0])!;
  if (first.relationId === card.relationId) return { ...state, openInstanceIds: [], matchedRelationIds: [...state.matchedRelationIds, card.relationId], locked: false };
  return { ...state, openInstanceIds: open, locked: true };
}

export function closeMemoryMismatch(state: MemoryMatchState): MemoryMatchState {
  return state.locked ? { ...state, openInstanceIds: [], locked: false } : state;
}
