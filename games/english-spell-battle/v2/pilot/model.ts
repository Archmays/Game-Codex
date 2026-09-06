/** Six local interactions. The canonical content and original spelling engine are unchanged. */
export const ENGLISH_INTERACTION_REVISION = "english-interactive-six-r1";
export const PILOT_TASK_IDS = ["word-run", "word-jump", "word-red", "word-blue", "word-one", "word-two"] as const;
export type PilotTaskId = typeof PILOT_TASK_IDS[number];
export type ActionWord = "run" | "jump";
export type ColorWord = "red" | "blue";
export type NumberWord = "one" | "two";
export type PilotWord = ActionWord | ColorWord | NumberWord;
export const LANDINGS = [
  { id: "A", x: 13, y: 80, label: "起点" },
  { id: "B", x: 39, y: 80, label: "草地" },
  { id: "C", x: 53, y: 39, label: "小石台" },
  { id: "D", x: 68, y: 80, label: "弯道" },
  { id: "E", x: 83, y: 39, label: "高处草地" },
] as const;
export type LandingId = typeof LANDINGS[number]["id"];
export const PARK_EDGES: readonly { from: LandingId; to: LandingId; kind: "road" | "step" }[] = [
  { from: "A", to: "B", kind: "road" }, { from: "B", to: "D", kind: "road" },
  { from: "D", to: "E", kind: "road" }, { from: "B", to: "C", kind: "step" },
  { from: "C", to: "E", kind: "step" },
];
export const OBJECT_IDS = ["A", "B", "C"] as const;
export type ObjectId = typeof OBJECT_IDS[number];
export interface ParkMove { readonly from: LandingId; readonly to: LandingId; readonly word: ActionWord }
export interface ParkState {
  readonly kind: "park";
  readonly position: LandingId;
  readonly word: ActionWord | null;
  readonly destination: LandingId | null;
  readonly lastMove: ParkMove | null;
}
export interface ColorState {
  readonly kind: "color";
  readonly colors: Readonly<Record<ObjectId, ColorWord>>;
  readonly word: ColorWord | null;
  readonly selected: ObjectId | null;
  readonly referent: ObjectId | null;
}
export interface NumberState {
  readonly kind: "number";
  readonly word: NumberWord | null;
  readonly selected: readonly ObjectId[];
  readonly active: readonly ObjectId[];
  readonly applied: boolean;
}
export type PilotState = ParkState | ColorState | NumberState;
export interface PilotRecord {
  readonly state: PilotState;
  readonly interactionCompleted: boolean;
  /** Set only by an unassisted successful call to the original build validator. */
  readonly spellingVerified: boolean;
  readonly canonicalUsed: boolean;
}
export type PilotRecords = Partial<Record<PilotTaskId, PilotRecord>>;
export type PilotInput = { type: "word"; word: string } | { type: "object"; id: string }
  | { type: "execute" } | { type: "cancel" } | { type: "reset" };
export interface PilotTransition {
  readonly state: PilotState;
  readonly executed: boolean;
  readonly canonical: boolean;
  readonly message: string;
  readonly move?: ParkMove;
}

/** Project-original, supported language; never enters the 30-sentence canonical corpus. */
export const PILOT_VARIANTS = ["The shell is blue.", "The boat is red.", "One boat sails.", "Two shells shine."] as const;
export const PILOT_SENTENCES: Record<PilotTaskId, string> = {
  "word-run": "I can run.", "word-jump": "I can jump.", "word-red": "The shell is red.",
  "word-blue": "The boat is blue.", "word-one": "One shell shines.", "word-two": "Two boats sail.",
};
export function isPilotTask(id: string): id is PilotTaskId { return (PILOT_TASK_IDS as readonly string[]).includes(id); }
export function pilotWords(id: PilotTaskId): readonly PilotWord[] {
  return id === "word-run" || id === "word-jump" ? ["run", "jump"] : id === "word-red" || id === "word-blue" ? ["red", "blue"] : ["one", "two"];
}
export function initialPilotState(id: PilotTaskId): PilotState {
  if (id === "word-run" || id === "word-jump") return { kind: "park", position: "A", word: null, destination: null, lastMove: null };
  if (id === "word-red" || id === "word-blue") {
    const color = id === "word-red" ? "blue" : "red";
    return { kind: "color", colors: { A: color, B: color, C: color }, word: null, selected: null, referent: null };
  }
  return { kind: "number", word: null, selected: [], active: [], applied: false };
}
export function initialPilotRecord(id: PilotTaskId): PilotRecord {
  return { state: initialPilotState(id), interactionCompleted: false, spellingVerified: false, canonicalUsed: false };
}
export function parkEdge(from: LandingId, to: LandingId) {
  return PARK_EDGES.find(edge => edge.from === from && edge.to === to || edge.from === to && edge.to === from);
}
export function pilotCurrentSentence(id: PilotTaskId, state: PilotState): string | null {
  if (state.kind === "park") return state.lastMove ? `I can ${state.lastMove.word}.` : null;
  if (state.kind === "color") return state.referent ? `The ${id === "word-red" ? "shell" : "boat"} is ${state.colors[state.referent]}.` : null;
  if (!state.applied || !state.active.length) return null;
  return id === "word-one" ? state.active.length === 1 ? "One shell shines." : "Two shells shine."
    : state.active.length === 1 ? "One boat sails." : "Two boats sail.";
}
export function pilotDraftSentence(id: PilotTaskId, state: PilotState): string | null {
  if (!state.word) return null;
  if (state.kind === "park") return `I can ${state.word}.`;
  if (state.kind === "color") return `The ${id === "word-red" ? "shell" : "boat"} is ${state.word}.`;
  return id === "word-one" ? state.word === "one" ? "One shell shines." : "Two shells shine."
    : state.word === "one" ? "One boat sails." : "Two boats sail.";
}
export function transitionPilot(id: PilotTaskId, state: PilotState, input: PilotInput): PilotTransition {
  const result = (next: PilotState, message: string, executed = false, move?: ParkMove): PilotTransition => ({
    state: next, message, executed, canonical: executed && pilotCurrentSentence(id, next) === PILOT_SENTENCES[id], ...(move ? { move } : {}),
  });
  if (input.type === "reset") return result(initialPilotState(id), "Scene reset. Choose a word and an object.");
  if (input.type === "cancel") {
    return result(state.kind === "park" ? { ...state, word: null, destination: null } : state.kind === "color" ? { ...state, word: null, selected: null } : { ...state, word: null, selected: [] }, "Selection cleared. The scene stays the same.");
  }
  if (input.type === "word") {
    if (!pilotWords(id).includes(input.word as PilotWord)) return result(state, "Choose a word on this card.");
    return result({ ...state, word: input.word } as PilotState, "Word selected. Choose where it will act.");
  }
  if (input.type === "object") {
    if (state.kind === "park") return LANDINGS.some(spot => spot.id === input.id)
      ? result({ ...state, destination: input.id as LandingId }, "Landing selected. Choose run or jump, then try it.") : result(state, "Choose a marked landing.");
    if (!(OBJECT_IDS as readonly string[]).includes(input.id)) return result(state, "Choose an object in this scene.");
    const objectId = input.id as ObjectId;
    if (state.kind === "color") return result({ ...state, selected: objectId }, "Object selected. Choose red or blue, then apply it.");
    return result({ ...state, selected: state.selected.includes(objectId) ? state.selected.filter(item => item !== objectId) : [...state.selected, objectId].sort() }, "Selection changed. Only apply when the word and count match.");
  }
  if (!state.word) return result(state, "Choose a word first.");
  if (state.kind === "park") {
    if (!state.destination) return result(state, "Choose a marked landing first.");
    if (state.destination === state.position) return result(state, "Already here. Choose another landing.");
    const edge = parkEdge(state.position, state.destination);
    if (!edge) return result(state, "No direct connection. Choose a neighboring landing.");
    if (state.word === "run" && edge.kind === "step") return result(state, "There is a gap. Try jump here, or run along the continuous path.");
    const move: ParkMove = { from: state.position, to: state.destination, word: state.word };
    return result({ ...state, position: state.destination, destination: null, lastMove: move }, `I can ${state.word}.`, true, move);
  }
  if (state.kind === "color") {
    if (!state.selected) return result(state, "Choose one object first.");
    const next: ColorState = { ...state, colors: { ...state.colors, [state.selected]: state.word }, referent: state.selected };
    return result(next, pilotCurrentSentence(id, next)!, true);
  }
  const count = state.word === "one" ? 1 : 2;
  if (state.selected.length !== count) return result(state, `Choose ${state.word} ${count === 1 ? "object" : "different objects"}. Tap a selected object to put it back.`);
  const next: NumberState = { ...state, active: [...state.selected], applied: true };
  return result(next, pilotCurrentSentence(id, next)!, true);
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).sort().join() === [...keys].sort().join(); }
function oneOf(value: unknown, options: readonly unknown[]): boolean { return options.includes(value); }
function ids(value: unknown, max = 3): value is ObjectId[] {
  return Array.isArray(value) && value.length <= max && value.every(item => oneOf(item, OBJECT_IDS)) && new Set(value).size === value.length;
}
/** Unknown rule fields are read-only, unlike opaque top-level save extensions. */
export function validPilotState(id: PilotTaskId, value: unknown): value is PilotState {
  if (!object(value)) return false;
  const expected = initialPilotState(id).kind;
  if (value.kind !== expected || !oneOf(value.word, [null, ...pilotWords(id)])) return false;
  if (value.kind === "park") {
    if (!exactKeys(value, ["kind", "position", "word", "destination", "lastMove"]) || !oneOf(value.position, LANDINGS.map(item => item.id)) || !oneOf(value.destination, [null, ...LANDINGS.map(item => item.id)])) return false;
    if (value.lastMove === null) return value.position === "A";
    if (!object(value.lastMove) || !exactKeys(value.lastMove, ["from", "to", "word"]) || value.lastMove.to !== value.position || !oneOf(value.lastMove.word, ["run", "jump"])) return false;
    const edge = parkEdge(value.lastMove.from as LandingId, value.lastMove.to as LandingId);
    return !!edge && (value.lastMove.word === "jump" || edge.kind === "road");
  }
  if (value.kind === "color") return exactKeys(value, ["kind", "colors", "word", "selected", "referent"])
    && object(value.colors) && exactKeys(value.colors, [...OBJECT_IDS]) && Object.values(value.colors).every(color => oneOf(color, ["red", "blue"]))
    && oneOf(value.selected, [null, ...OBJECT_IDS]) && oneOf(value.referent, [null, ...OBJECT_IDS]);
  return exactKeys(value, ["kind", "word", "selected", "active", "applied"]) && ids(value.selected) && ids(value.active, 2)
    && typeof value.applied === "boolean" && (value.applied ? value.active.length > 0 : value.active.length === 0);
}
export function validPilotRecords(value: unknown): value is PilotRecords {
  return object(value) && Object.keys(value).length <= 6 && Object.entries(value).every(([id, record]) => isPilotTask(id)
    && object(record) && exactKeys(record, ["state", "interactionCompleted", "spellingVerified", "canonicalUsed"])
    && validPilotState(id, record.state) && typeof record.interactionCompleted === "boolean" && typeof record.spellingVerified === "boolean"
    && typeof record.canonicalUsed === "boolean" && record.interactionCompleted === record.canonicalUsed);
}
