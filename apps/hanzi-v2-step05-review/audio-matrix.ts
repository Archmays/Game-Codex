import { getGoldenCharacter } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import type { GoldenCharacterId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import {
  createGoldenSliceState,
  type GoldenSlicePhase,
  type GoldenSliceState,
} from "../../games/hanzi-radical-battle/v2/golden-slice/simulation/machine";
import {
  getGoldenVoiceContext,
  type GoldenVoiceUiContext,
} from "../../games/hanzi-radical-battle/v2/golden-slice/ui/voice-context";

export interface Step05AudioMatrixRow {
  readonly id: string;
  readonly label: string;
  readonly phase: GoldenSlicePhase;
  readonly uiContext: GoldenVoiceUiContext;
  readonly expectedCharacterId: GoldenCharacterId | null;
  readonly expectedSource: "formed-character" | "spellbook" | "ink-echo" | "none";
}

export const STEP05_AUDIO_MATRIX: readonly Step05AudioMatrixRow[] = [
  { id: "camp", label: "camp", phase: "camp_intro", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "travel-ming", label: "travel", phase: "travel_to_battle_1", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "ming", label: "明", phase: "battle_1_forming", uiContext: { surface: "narrative" }, expectedCharacterId: "ming", expectedSource: "formed-character" },
  { id: "breather", label: "breather", phase: "breather_1", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "travel-hua", label: "to 花", phase: "travel_to_battle_2", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "hua", label: "花", phase: "battle_2_cleared", uiContext: { surface: "narrative" }, expectedCharacterId: "hua", expectedSource: "formed-character" },
  { id: "ability", label: "ability", phase: "ability_choice", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "boss-intro", label: "boss 林 before formation", phase: "boss_intro", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "lin", label: "林 formed", phase: "boss_phase_1_cleared", uiContext: { surface: "narrative" }, expectedCharacterId: "lin", expectedSource: "formed-character" },
  { id: "xing-before", label: "boss 星 before formation", phase: "boss_phase_2_placing", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "xing", label: "星 formed", phase: "boss_cleared", uiContext: { surface: "narrative" }, expectedCharacterId: "xing", expectedSource: "formed-character" },
  { id: "return", label: "return", phase: "return_to_camp", uiContext: { surface: "narrative" }, expectedCharacterId: null, expectedSource: "none" },
  { id: "spellbook", label: "spellbook 明 tab", phase: "spellbook_review", uiContext: { surface: "spellbook", characterId: "ming" }, expectedCharacterId: "ming", expectedSource: "spellbook" },
  { id: "ink-echo", label: "Ink Echo 林 target", phase: "boss_interference", uiContext: { surface: "ink-echo" }, expectedCharacterId: "lin", expectedSource: "ink-echo" },
] as const;

function stateFor(row: Step05AudioMatrixRow): GoldenSliceState {
  const base = createGoldenSliceState({ seed: "step05-audio-matrix", mode: "review" });
  if (row.uiContext.surface !== "ink-echo") return { ...base, phase: row.phase };
  return {
    ...base,
    phase: "boss_interference",
    selectedAbilityId: "ink-echo",
    bossInterference: {
      bossPhaseId: "lin",
      beforeInterference: base.board,
      obscuredSlotIds: ["right"],
      durationMs: 1_000,
    },
    abilityUsedBossPhaseIds: [],
  };
}

export function evaluateAudioMatrixRow(row: Step05AudioMatrixRow) {
  const context = getGoldenVoiceContext(stateFor(row), row.uiContext);
  return {
    ...row,
    actualCharacterId: context.characterId,
    actualSource: context.source,
    passed: context.characterId === row.expectedCharacterId && context.source === row.expectedSource,
    spokenPhrase: context.characterId ? getGoldenCharacter(context.characterId).spokenPhrase : null,
  } as const;
}

export const STEP05_AUDIO_MATRIX_RESULTS = STEP05_AUDIO_MATRIX.map(evaluateAudioMatrixRow);
