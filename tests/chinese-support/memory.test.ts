import { readFileSync } from "node:fs";
import { CHINESE_MEMORY_PACKS, closeMemoryMismatch, createMemoryDeck, createMemoryState, flipMemoryCard, validatePack, validateRoundRelations, type MemoryMatchPack } from "../../packages/activity-engines/memory-match";

describe("shared memory relation engine", () => {
  it("ships three validated Chinese packs sourced from the canonical graph", () => {
    expect(CHINESE_MEMORY_PACKS.map((pack) => pack.id)).toEqual(["same-glyph", "glyph-pinyin", "glyph-phrase"]);
    for (const pack of CHINESE_MEMORY_PACKS) {
      expect(validatePack(pack), pack.id).toEqual([]);
      expect(pack.relations.length).toBeGreaterThanOrEqual(60);
    }
  });

  it("simulates 10,000 seeded decks without ambiguity or duplicate instances", () => {
    for (let index = 0; index < 10_000; index += 1) {
      const pack = CHINESE_MEMORY_PACKS[index % CHINESE_MEMORY_PACKS.length];
      const deck = createMemoryDeck(pack, `deck-${index}`, index % 2 ? 4 : 6);
      expect(new Set(deck.map((card) => card.instanceId)).size).toBe(deck.length);
      const relations = [...new Set(deck.map((card) => card.relationId))].map((id) => pack.relations.find((item) => item.id === id)!);
      expect(validateRoundRelations(relations, pack.id === "same-glyph"), `deck-${index}`).toEqual([]);
      expect(deck.every((card) => deck.filter((other) => other.relationId === card.relationId).length === 2)).toBe(true);
    }
  });

  it("limits opening to two cards and reverses mismatches", () => {
    const initial = createMemoryState(CHINESE_MEMORY_PACKS[0], "two-card", 4);
    const first = initial.cards[0];
    const second = initial.cards.find((card) => card.relationId !== first.relationId)!;
    const twoOpen = flipMemoryCard(flipMemoryCard(initial, first.instanceId), second.instanceId);
    expect(twoOpen.openInstanceIds).toHaveLength(2);
    expect(twoOpen.locked).toBe(true);
    expect(flipMemoryCard(twoOpen, initial.cards[2].instanceId)).toBe(twoOpen);
    expect(closeMemoryMismatch(twoOpen)).toMatchObject({ openInstanceIds: [], locked: false });
  });

  it("prioritizes discovered relations when a full round is available", () => {
    const pack = CHINESE_MEMORY_PACKS[1];
    const preferred = pack.relations.slice(0, 6).map((relation) => relation.id);
    const deck = createMemoryDeck(pack, "preferred", 6, preferred);
    expect(deck.every((card) => preferred.includes(card.relationId))).toBe(true);
  });

  it("supports cross-disciplinary relations without changing their products", () => {
    const fixture: MemoryMatchPack = { id: "fixture", title: "fixture", subject: "shared", relationType: "synthetic", defaultPairCount: 3, revisionHash: "test", relations: [
      { id: "clock", left: { id: "clock-a", kind: "clock", text: "🕒", ariaLabel: "three o'clock", sourceIds: ["fixture"] }, right: { id: "clock-b", kind: "text", text: "3:00", ariaLabel: "3:00", sourceIds: ["fixture"] }, explanation: "The clock shows 3:00.", sourceIds: ["fixture"], riskFlags: [] },
      { id: "english", left: { id: "english-a", kind: "text", text: "cat", ariaLabel: "cat", sourceIds: ["fixture"] }, right: { id: "english-b", kind: "meaning-image", text: "cat image", ariaLabel: "image of a cat", sourceIds: ["fixture"] }, explanation: "Cat matches the cat image.", sourceIds: ["fixture"], riskFlags: [] },
      { id: "equation", left: { id: "equation-a", kind: "equation", text: "2+3", ariaLabel: "two plus three", sourceIds: ["fixture"] }, right: { id: "equation-b", kind: "quantity", text: "5", ariaLabel: "five objects", sourceIds: ["fixture"] }, explanation: "2+3 makes 5.", sourceIds: ["fixture"], riskFlags: [] },
    ] };
    expect(validatePack(fixture)).toEqual([]);
    expect(createMemoryDeck(fixture, "fixture", 3)).toHaveLength(6);
  });

  it("keeps memory runtime outside the legacy raw wheel boundary", () => {
    const runtime = ["packages/activity-engines/memory-match/packs.ts", "packages/activity-engines/memory-match/machine.ts", "packages/activity-engines/memory-match/app.ts", "games/memory-card/index.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(runtime).not.toContain("LEGACY_WHEEL_SOURCE");
    expect(runtime).not.toContain("memoryCards");
  });
});
