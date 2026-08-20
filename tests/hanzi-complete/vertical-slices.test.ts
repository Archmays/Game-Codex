import { APP_ROUTE_QUERY_REGISTRY, resolveAppRoute } from "../../src/app-route";
import {
  COMPLETE_SLICE_CHARACTER_NODES,
  COMPLETE_SLICE_COMPONENT_RELATIONS,
  COMPLETE_SLICE_CONTENT_REVISION,
  COMPLETE_SLICE_FAMILIES,
  COMPLETE_SLICE_READING_SENSES,
  COMPLETE_SLICE_SOURCE_RECORDS,
  COMPLETE_SLICE_WORDS,
  getCompleteSliceCharacter,
} from "../../games/hanzi-radical-battle/complete/content-graph/slice-content";
import {
  createCompleteSliceHand,
  createCompleteSliceState,
  reduceCompleteSliceState,
  replayCompleteSliceActions,
  type CompleteSliceAction,
  type CompleteSliceState,
} from "../../games/hanzi-radical-battle/complete/core/slice-machine";
import {
  HANZI_MAGIC_COMPLETE_BACKUP_KEY,
  HANZI_MAGIC_COMPLETE_RECOVERY_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_KEY,
  clearCompleteSliceSession,
  createFreshCompleteSliceSave,
  readCompleteSliceSave,
  updateCompleteSliceSave,
  validateCompleteSliceSave,
  writeCompleteSliceSave,
  type CompleteSliceStorage,
} from "../../games/hanzi-radical-battle/complete/save/slice-save";

class MemoryStorage implements CompleteSliceStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function act(state: CompleteSliceState, action: CompleteSliceAction): CompleteSliceState {
  const next = reduceCompleteSliceState(state, action);
  expect(next.actionCount).toBe(state.actionCount + 1);
  return next;
}

function solveBuild(state: CompleteSliceState): CompleteSliceState {
  expect(state.phase).toBe("build");
  const character = getCompleteSliceCharacter(state.currentCharacterId!);
  for (const component of character.components) {
    const card = state.hand.find((candidate) => candidate.kind === "target" && candidate.expectedSlotId === component.slotId)!;
    state = act(state, { type: "select-card", cardId: card.id });
    state = act(state, { type: "place-selected", slotId: component.slotId });
  }
  expect(state.phase).toBe("composition");
  return state;
}

function finishCharacter(state: CompleteSliceState): CompleteSliceState {
  state = solveBuild(state);
  state = act(state, { type: "continue" });
  expect(state.phase).toBe("meaning");
  return act(state, { type: "continue" });
}

describe("complete-edition vertical slice content", () => {
  test("registers the complete route before both legacy routes", () => {
    expect(resolveAppRoute(new URLSearchParams("play=hanzi-magic-complete&from=hub"))).toEqual({ kind: "play", explicit: true });
    expect(APP_ROUTE_QUERY_REGISTRY.slice(0, 3).map((route) => route.queryValue)).toEqual(["hanzi-magic-complete", "hanzi-v2-chapter-one", "hanzi-v2-v1"]);
  });

  test("keeps one canonical node and reading sense per slice glyph", () => {
    expect(COMPLETE_SLICE_CHARACTER_NODES).toHaveLength(10);
    expect(new Set(COMPLETE_SLICE_CHARACTER_NODES.map((record) => record.glyph)).size).toBe(10);
    expect(new Set(COMPLETE_SLICE_CHARACTER_NODES.map((record) => record.id)).size).toBe(10);
    expect(COMPLETE_SLICE_READING_SENSES).toHaveLength(10);
    expect(COMPLETE_SLICE_CHARACTER_NODES.filter((record) => record.provenance.some((value) => value.startsWith("chapter-one:"))).map((record) => record.glyph).sort()).toEqual(["安", "晴", "清", "花"].sort());
    expect(COMPLETE_SLICE_CONTENT_REVISION).toMatch(/^fnv1a:/);
    expect(COMPLETE_SLICE_SOURCE_RECORDS.every((source) => source.limitation.length > 10)).toBe(true);
  });

  test("models the 青 family as explicit phonetic relations without a shared-meaning claim", () => {
    const family = COMPLETE_SLICE_FAMILIES[0];
    expect(family.memberCharacterIds.map((id) => getCompleteSliceCharacter(id).glyph)).toEqual(["清", "晴", "情", "请"]);
    expect(COMPLETE_SLICE_COMPONENT_RELATIONS).toHaveLength(4);
    expect(COMPLETE_SLICE_COMPONENT_RELATIONS.every((relation) => relation.kind === "phonetic-component")).toBe(true);
    expect(family.childFacingExplanation).toContain("意思也不同");
    expect(family.revisionHash).toMatch(/^fnv1a:/);
  });

  test("ships three exact two-character words with fixed readings and explicit reverse disposition", () => {
    expect(COMPLETE_SLICE_WORDS.map((word) => word.glyphs.join(""))).toEqual(["花香", "眼睛", "安静"]);
    for (const word of COMPLETE_SLICE_WORDS) {
      expect(word.glyphs).toHaveLength(2);
      expect(word.characterIds).toHaveLength(2);
      expect(word.readingSenseIds).toHaveLength(2);
      expect(word.pinyin).not.toBe("");
      expect(word.reverseOrderStatus).toMatch(/^rejected-/);
      expect(word.revisionHash).toMatch(/^fnv1a:/);
    }
  });

  test("every slice hand has exactly one valid two-card assignment", () => {
    for (const character of COMPLETE_SLICE_CHARACTER_NODES) {
      const hand = createCompleteSliceHand(character.id);
      expect(hand).toHaveLength(5);
      let solutions = 0;
      for (const first of hand) for (const second of hand) {
        if (first.id === second.id) continue;
        const matches = character.components.every((component, index) => [first, second][index].expectedSlotId === component.slotId);
        if (matches) solutions += 1;
      }
      expect(solutions, character.glyph).toBe(1);
    }
  });
});

describe("Slice A family loop", () => {
  test("forms two characters, connects a sourced family, reuses the rule in a boss phase and repairs the world", () => {
    let state = createCompleteSliceState("family");
    state = act(state, { type: "start" });
    expect(state.phase).toBe("behavior-telegraph");
    state = act(state, { type: "begin-behavior" });
    expect(state.phase).toBe("behavior-effect");
    state = act(state, { type: "recover-behavior" });
    state = finishCharacter(state);
    expect(state.phase).toBe("build");
    state = finishCharacter(state);
    expect(state.phase).toBe("family-inspect");
    state = act(state, { type: "continue" });
    state = act(state, { type: "toggle-family-character", characterId: "char-u6e05" });
    state = act(state, { type: "toggle-family-character", characterId: "char-u60c5" });
    state = act(state, { type: "connect-family" });
    expect(state.phase).toBe("family-result");
    expect(state.gentleMessage).toContain("完整字义仍各不相同");
    state = act(state, { type: "continue" });
    expect(state.phase).toBe("boss-telegraph");
    state = act(state, { type: "begin-behavior" });
    state = act(state, { type: "recover-behavior" });
    expect(state.bossResolved).toBe(true);
    state = finishCharacter(state);
    expect(state.phase).toBe("repair");
    expect(state.repairedObjectIds).toEqual(["component-root-heart"]);
    state = act(state, { type: "continue" });
    expect(state.phase).toBe("complete");
    expect(state.discoveredCharacterIds).toEqual(expect.arrayContaining(["char-u60c5", "char-u8bf7", "char-u6e05"]));
  });

  test("wrong placement is reversible and never changes the answer", () => {
    let state = createCompleteSliceState("family");
    state = act(state, { type: "start" });
    state = act(state, { type: "begin-behavior" });
    state = act(state, { type: "recover-behavior" });
    const distractor = state.hand.find((card) => card.kind === "distractor")!;
    state = act(state, { type: "place-card", cardId: distractor.id, slotId: "left" });
    expect(state.phase).toBe("build");
    expect(state.placements).toEqual([]);
    expect(state.gentleMessage).toContain("进度都保留");
  });
});

describe("Slice B word loop", () => {
  test("builds both characters, rejects reverse order, keeps fixed reading and repairs after the boss", () => {
    let state = act(createCompleteSliceState("word"), { type: "start" });
    for (let wordIndex = 0; wordIndex < COMPLETE_SLICE_WORDS.length; wordIndex += 1) {
      state = finishCharacter(state);
      expect(state.phase).toBe("build");
      state = finishCharacter(state);
      expect(state.phase).toBe("word-order");
      const word = COMPLETE_SLICE_WORDS[wordIndex];
      state = act(state, { type: "select-word-character", characterId: word.characterIds[1] });
      state = act(state, { type: "select-word-character", characterId: word.characterIds[0] });
      expect(state.phase).toBe("word-order");
      expect(state.wordOrderCharacterIds).toEqual([]);
      expect(state.gentleMessage).toContain(`要读“${word.glyphs.join("")}”`);
      state = act(state, { type: "select-word-character", characterId: word.characterIds[0] });
      state = act(state, { type: "select-word-character", characterId: word.characterIds[1] });
      expect(state.phase).toBe("word-meaning");
      expect(state.gentleMessage).toContain(word.glyphs.join(""));
      state = act(state, { type: "continue" });
      if (wordIndex === 1) {
        expect(state.phase).toBe("boss-telegraph");
        state = act(state, { type: "begin-behavior" });
        state = act(state, { type: "recover-behavior" });
        expect(state.bossResolved).toBe(true);
      }
    }
    expect(state.phase).toBe("repair");
    expect(state.repairedObjectIds).toEqual(["word-heart"]);
    state = act(state, { type: "continue" });
    expect(state.phase).toBe("complete");
    expect(new Set(state.discoveredCharacterIds).size).toBe(6);
  });
});

describe("vertical slice save and resume", () => {
  test("round-trips action replay, preferences and a bounded anonymous save", () => {
    const storage = new MemoryStorage();
    const actions: CompleteSliceAction[] = [{ type: "start" }, { type: "begin-behavior" }, { type: "recover-behavior" }];
    let save = createFreshCompleteSliceSave("family");
    save = updateCompleteSliceSave(save, { sessions: { ...save.sessions, family: actions }, preferences: { muted: true, reducedMotion: true, inputMode: "keyboard" } });
    writeCompleteSliceSave(storage, save);
    const read = readCompleteSliceSave(storage, "family");
    expect(read.source).toBe("v3-slice");
    expect(read.writable).toBe(true);
    expect(read.state.preferences).toEqual({ muted: true, reducedMotion: true, inputMode: "keyboard" });
    expect(replayCompleteSliceActions("family", read.state.sessions.family).phase).toBe("build");
    expect(new TextEncoder().encode(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)!).byteLength).toBeLessThan(500 * 1024);
    expect(JSON.stringify(read.state)).not.toMatch(/name|birthday|school|photo|voice|fingerprint/i);
    expect(validateCompleteSliceSave(read.state)).not.toBeNull();
  });

  test("recovers from backup, captures corrupt raw and protects future versions", () => {
    const storage = new MemoryStorage();
    const first = createFreshCompleteSliceSave("family");
    writeCompleteSliceSave(storage, first);
    const second = clearCompleteSliceSession(updateCompleteSliceSave(first, { activeSlice: "word" }), "word");
    writeCompleteSliceSave(storage, second);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_BACKUP_KEY)).not.toBeNull();
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, "{broken");
    const recovered = readCompleteSliceSave(storage, "family");
    expect(recovered.source).toBe("v3-slice-backup");
    expect(recovered.recovered).toBe(true);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_RECOVERY_KEY)).toContain("{broken");
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify({ schemaVersion: 99 }));
    const future = readCompleteSliceSave(storage, "word");
    expect(future.source).toBe("future-read-only");
    expect(future.writable).toBe(false);
  });
});
