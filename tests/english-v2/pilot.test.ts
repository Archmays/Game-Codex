import { ENGLISH_V2_SENTENCES } from "../../games/english-spell-battle/v2/content/manifest";
import { initialPilotState, transitionPilot, pilotCurrentSentence, pilotDraftSentence, validPilotState, validPilotRecords,
  initialPilotRecord, PILOT_TASK_IDS, PILOT_SENTENCES, PILOT_VARIANTS, LANDINGS, PARK_EDGES, OBJECT_IDS,
  type PilotTaskId, type PilotState, type PilotInput, type ColorState, type NumberState, type ParkState,
} from "../../games/english-spell-battle/v2/pilot/model";

function apply(id: PilotTaskId, state: PilotState, ...inputs: PilotInput[]) {
  let last = transitionPilot(id, state, inputs[0]);
  for (const input of inputs.slice(1)) last = transitionPilot(id, last.state, input);
  expect(validPilotState(id, last.state)).toBe(true);
  return last;
}
describe("six meaning-driven English interactions", () => {
  it("keeps all six canonical sentences exact and isolates only four supported variants", () => {
    for (const id of PILOT_TASK_IDS) expect(PILOT_SENTENCES[id]).toBe(ENGLISH_V2_SENTENCES.find(sentence => sentence.targetWordId === id)!.text);
    expect(PILOT_VARIANTS).toEqual(["The shell is blue.", "The boat is red.", "One boat sails.", "Two shells shine."]);
    expect(ENGLISH_V2_SENTENCES).toHaveLength(30);
  });
  it("cannot complete by repeated execute, choosing words or objects alone", () => {
    for (const id of PILOT_TASK_IDS) {
      let state = initialPilotState(id);
      for (let n = 0; n < 12; n++) {
        const result = transitionPilot(id, state, { type: "execute" });
        expect(result.executed).toBe(false); expect(result.canonical).toBe(false); state = result.state;
      }
      expect(transitionPilot(id, state, { type: "word", word: id.slice(5) }).canonical).toBe(false);
      expect(transitionPilot(id, state, { type: "object", id: "B" }).canonical).toBe(false);
      expect(transitionPilot(id, state, { type: "word", word: "teleport" }).state).toEqual(state);
    }
  });
  it("distinguishes run vs jump on the same small gap and preserves legal non-target effects", () => {
    const id = "word-jump";
    const road = apply(id, initialPilotState(id), { type: "word", word: "run" }, { type: "object", id: "B" }, { type: "execute" });
    expect(road.state).toMatchObject({ position: "B", lastMove: { from: "A", to: "B", word: "run" } });
    expect(road.executed).toBe(true); expect(road.canonical).toBe(false);
    const runGap = apply(id, road.state, { type: "object", id: "C" }, { type: "execute" });
    expect(runGap.executed).toBe(false); expect(runGap.state).toMatchObject({ position: "B" });
    const jumpGap = apply(id, runGap.state, { type: "word", word: "jump" }, { type: "execute" });
    expect(jumpGap.canonical).toBe(true); expect(jumpGap.state).toMatchObject({ position: "C" });
    expect(transitionPilot(id, jumpGap.state, { type: "execute" }).executed).toBe(false);
  });
  it("accepts every connected direction and rejects disconnected, same, or unknown landings", () => {
    for (const from of LANDINGS) for (const to of [...LANDINGS.map(item => item.id), "Z"]) for (const word of ["run", "jump"] as const) {
      const state: ParkState = { kind: "park", position: from.id, word, destination: null, lastMove: null };
      const selected = transitionPilot("word-jump", state, { type: "object", id: to }).state;
      const result = transitionPilot("word-jump", selected, { type: "execute" });
      const edge = PARK_EDGES.find(item => item.from === from.id && item.to === to || item.to === from.id && item.from === to);
      expect(result.executed, `${from.id} ${word} ${to}`).toBe(!!edge && (word === "jump" || edge.kind === "road"));
      expect((result.state as ParkState).position).toBe(result.executed ? to : from.id);
    }
  });
  it("supports two different park routes to E, with explicit words on each step", () => {
    for (const path of [["B", "C", "E"], ["B", "D", "E"]]) {
      let state = initialPilotState("word-jump");
      for (const landing of path) state = apply("word-jump", state, { type: "word", word: "jump" }, { type: "object", id: landing }, { type: "execute" }).state;
      expect(state).toMatchObject({ position: "E" });
    }
  });
  it("changes only the referenced object and recomputes truthful current color after completion", () => {
    for (const id of ["word-red", "word-blue"] as const) for (const objectId of OBJECT_IDS) {
      const start = initialPilotState(id) as ColorState;
      const word = id.slice(5);
      const result = apply(id, start, { type: "word", word }, { type: "object", id: objectId }, { type: "execute" });
      expect(result.canonical).toBe(true);
      for (const other of OBJECT_IDS) expect((result.state as ColorState).colors[other]).toBe(other === objectId ? word : start.colors[other]);
      const opposite = word === "red" ? "blue" : "red";
      const draft = transitionPilot(id, result.state, { type: "word", word: opposite }).state;
      expect(pilotCurrentSentence(id, draft)).toBe(PILOT_SENTENCES[id]);
      expect(pilotDraftSentence(id, draft)).not.toBe(PILOT_SENTENCES[id]);
      const changed = transitionPilot(id, draft, { type: "execute" });
      expect(changed.executed).toBe(true); expect(changed.canonical).toBe(false);
      expect(pilotCurrentSentence(id, changed.state)).toBe(`The ${id === "word-red" ? "shell" : "boat"} is ${opposite}.`);
      const cancelled = transitionPilot(id, changed.state, { type: "cancel" });
      expect(pilotCurrentSentence(id, cancelled.state)).toBe(pilotCurrentSentence(id, changed.state));
    }
  });
  it("accepts every singleton and distinct pair, and keeps all unselected objects inactive", () => {
    for (const id of ["word-one", "word-two"] as const) for (const selected of [["A"], ["B"], ["C"], ["A", "B"], ["A", "C"], ["B", "C"]]) {
      let state = transitionPilot(id, initialPilotState(id), { type: "word", word: selected.length === 1 ? "one" : "two" }).state;
      for (const objectId of selected) state = transitionPilot(id, state, { type: "object", id: objectId }).state;
      const result = apply(id, state, { type: "execute" });
      expect((result.state as NumberState).active).toEqual(selected);
      expect(result.canonical).toBe(id === "word-one" ? selected.length === 1 : selected.length === 2);
      expect(transitionPilot(id, result.state, { type: "execute" }).state).toEqual(result.state);
      const reset = transitionPilot(id, result.state, { type: "reset" });
      expect(pilotCurrentSentence(id, reset.state)).toBeNull();
    }
  });
  it("requires word-selected cardinality, rejects 0/3, and permits deselection and changed selection", () => {
    const id = "word-two";
    let state = apply(id, initialPilotState(id), { type: "word", word: "two" }, { type: "object", id: "A" }, { type: "object", id: "B" }, { type: "execute" }).state;
    state = transitionPilot(id, state, { type: "object", id: "C" }).state;
    expect(transitionPilot(id, state, { type: "execute" }).executed).toBe(false);
    expect((state as NumberState).active).toEqual(["A", "B"]);
    state = transitionPilot(id, state, { type: "object", id: "A" }).state;
    const result = apply(id, state, { type: "execute" });
    expect((result.state as NumberState).active).toEqual(["B", "C"]);
    state = transitionPilot(id, result.state, { type: "word", word: "one" }).state;
    expect(transitionPilot(id, state, { type: "execute" }).executed).toBe(false);
    state = transitionPilot(id, state, { type: "object", id: "B" }).state;
    const one = apply(id, state, { type: "execute" });
    expect((one.state as NumberState).active).toEqual(["C"]);
    expect(pilotCurrentSentence(id, one.state)).toBe("One boat sails.");
  });
  it("rejects impossible saved rules rather than normalizing them into valid progress", () => {
    expect(validPilotRecords({ "word-jump": initialPilotRecord("word-jump") })).toBe(true);
    for (const malformed of [null, [], { other: initialPilotRecord("word-jump") }, { "word-one": { ...initialPilotRecord("word-one"), unknownRule: true } }]) expect(validPilotRecords(malformed)).toBe(false);
    for (const state of [
      { ...initialPilotState("word-two"), active: ["A", "A"], applied: true },
      { ...initialPilotState("word-two"), active: ["A", "B", "C"], applied: true },
      { ...initialPilotState("word-two"), active: ["A"], applied: false },
      { ...initialPilotState("word-two"), word: "three" },
    ]) expect(validPilotState("word-two", state)).toBe(false);
    expect(validPilotState("word-jump", { ...initialPilotState("word-jump"), position: "E" })).toBe(false);
    expect(validPilotState("word-jump", { ...initialPilotState("word-jump"), position: "C", lastMove: { from: "B", to: "C", word: "run" } })).toBe(false);
  });
});
