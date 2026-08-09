import type { GoldenCharacterId } from "../content/types";
import type { GoldenSlicePhase, GoldenSliceState } from "../simulation/machine";

export type GoldenVoiceUiContext =
  | { readonly surface: "narrative" }
  | { readonly surface: "spellbook"; readonly characterId: GoldenCharacterId }
  | { readonly surface: "ink-echo" };

export interface GoldenVoiceContext {
  readonly characterId: GoldenCharacterId | null;
  readonly source: "formed-character" | "spellbook" | "ink-echo" | "none";
}

const FORMED_CHARACTER_BY_PHASE: Partial<Record<GoldenSlicePhase, GoldenCharacterId>> = {
  battle_1_forming: "ming",
  battle_1_casting: "ming",
  battle_1_cleared: "ming",
  battle_2_forming: "hua",
  battle_2_casting: "hua",
  battle_2_cleared: "hua",
  boss_phase_1_forming: "lin",
  boss_phase_1_cleared: "lin",
  boss_phase_2_forming: "xing",
  boss_cleared: "xing",
};

const NO_VOICE_CONTEXT: GoldenVoiceContext = { characterId: null, source: "none" };

/** Resolves only the Hanzi that the named UI surface explicitly exposes. */
export function getGoldenVoiceContext(
  state: GoldenSliceState,
  uiContext: GoldenVoiceUiContext,
): GoldenVoiceContext {
  if (uiContext.surface === "spellbook") {
    return { characterId: uiContext.characterId, source: "spellbook" };
  }

  if (uiContext.surface === "ink-echo") {
    const bossPhaseId = state.bossInterference?.bossPhaseId;
    if (
      state.phase !== "boss_interference" ||
      state.selectedAbilityId !== "ink-echo" ||
      !bossPhaseId ||
      state.abilityUsedBossPhaseIds.includes(bossPhaseId)
    ) {
      return NO_VOICE_CONTEXT;
    }
    return { characterId: bossPhaseId, source: "ink-echo" };
  }

  const characterId = FORMED_CHARACTER_BY_PHASE[state.phase];
  return characterId
    ? { characterId, source: "formed-character" }
    : NO_VOICE_CONTEXT;
}
