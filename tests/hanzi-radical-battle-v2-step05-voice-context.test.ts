import { getGoldenCharacter } from "../games/hanzi-radical-battle/v2/golden-slice/content";
import {
  GOLDEN_SLICE_PHASES,
  createGoldenSliceState,
  type GoldenSlicePhase,
  type GoldenSliceState,
} from "../games/hanzi-radical-battle/v2/golden-slice/simulation";
import { getGoldenVoiceContext } from "../games/hanzi-radical-battle/v2/golden-slice/ui/voice-context";

const FORMED_PHASES = new Map<GoldenSlicePhase, "ming" | "hua" | "lin" | "xing">([
  ["battle_1_forming", "ming"],
  ["battle_1_casting", "ming"],
  ["battle_1_cleared", "ming"],
  ["battle_2_forming", "hua"],
  ["battle_2_casting", "hua"],
  ["battle_2_cleared", "hua"],
  ["boss_phase_1_forming", "lin"],
  ["boss_phase_1_cleared", "lin"],
  ["boss_phase_2_forming", "xing"],
  ["boss_cleared", "xing"],
]);

function stateAt(phase: GoldenSlicePhase): GoldenSliceState {
  return {
    ...createGoldenSliceState(),
    phase,
    // Deliberately wrong for most phases: voice resolution must not follow it.
    currentEncounterId: "boss-xing",
  };
}

describe("Hanzi V2 STEP 05 explicit voice context", () => {
  it("exposes ordinary replay only for an explicitly formed character", () => {
    for (const phase of GOLDEN_SLICE_PHASES) {
      const expected = FORMED_PHASES.get(phase) ?? null;
      expect(getGoldenVoiceContext(stateAt(phase), { surface: "narrative" }), phase).toEqual(
        expected
          ? { characterId: expected, source: "formed-character" }
          : { characterId: null, source: "none" },
      );
    }
  });

  it("uses the explicit spellbook page instead of encounter state", () => {
    expect(getGoldenVoiceContext(stateAt("spellbook_review"), {
      surface: "spellbook",
      characterId: "hua",
    })).toEqual({ characterId: "hua", source: "spellbook" });
  });

  it("uses the dedicated Ink Echo boss target and only while the ability is available", () => {
    const base = createGoldenSliceState();
    const echoState: GoldenSliceState = {
      ...base,
      phase: "boss_interference",
      currentEncounterId: "boss-xing",
      selectedAbilityId: "ink-echo",
      bossInterference: {
        bossPhaseId: "lin",
        beforeInterference: base.board,
        obscuredSlotIds: ["right"],
        durationMs: 900,
      },
    };
    expect(getGoldenVoiceContext(echoState, { surface: "ink-echo" })).toEqual({
      characterId: "lin",
      source: "ink-echo",
    });
    expect(getGoldenVoiceContext({ ...echoState, abilityUsedBossPhaseIds: ["lin"] }, { surface: "ink-echo" }))
      .toEqual({ characterId: null, source: "none" });
    expect(getGoldenVoiceContext({ ...echoState, phase: "boss_phase_1_placing" }, { surface: "ink-echo" }))
      .toEqual({ characterId: null, source: "none" });
  });

  it("keeps visible pinyin out of every contextual utterance", () => {
    for (const characterId of ["ming", "hua", "lin", "xing"] as const) {
      const character = getGoldenCharacter(characterId);
      expect(character.visualPinyin).toBeTruthy();
      expect(character.spokenPhrase).not.toContain(character.visualPinyin);
      expect(character.spokenPhrase).not.toMatch(/[A-Za-z0-9]/u);
    }
  });
});
