import { CHINESE_MEMORY_PACKS, createMemoryState, flipMemoryCard } from "../packages/activity-engines/memory-match";

describe("memory relation engine", () => {
  it("builds a deterministic relational deck", () => {
    const pack = CHINESE_MEMORY_PACKS[1];
    expect(createMemoryState(pack, "same")).toEqual(createMemoryState(pack, "same"));
    expect(createMemoryState(pack, "same").cards).toHaveLength(12);
  });

  it("matches two different faces through one relation", () => {
    const initial = createMemoryState(CHINESE_MEMORY_PACKS[1], "pair", 4);
    const first = initial.cards[0];
    const partner = initial.cards.find((card) => card.relationId === first.relationId && card.instanceId !== first.instanceId)!;
    const opened = flipMemoryCard(initial, first.instanceId);
    const matched = flipMemoryCard(opened, partner.instanceId);
    expect(matched.matchedRelationIds).toEqual([first.relationId]);
    expect(matched.openInstanceIds).toEqual([]);
  });
});
