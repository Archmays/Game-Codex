import { PILOT_EVENT_IDS, type PilotEventId } from "../simulation/events";
import type { VisualDirectionId } from "../content/types";

export const PILOT_SAVE_KEY = "family-games/hanzi-radical-battle-v2-pilot/state";
export const PILOT_SAVE_SCHEMA_VERSION = 1;

export interface PilotSaveState {
  schemaVersion: 1;
  campLampRepaired: boolean;
  spellbookCharacterIds: string[];
  muted: boolean;
  reducedMotion: boolean;
  selectedThemeForReview: VisualDirectionId;
  minimumPilotEvents: PilotEventId[];
}

export interface PilotSaveReadResult {
  state: PilotSaveState;
  recoveredFromCorruption: boolean;
}

export const DEFAULT_PILOT_SAVE: PilotSaveState = {
  schemaVersion: PILOT_SAVE_SCHEMA_VERSION,
  campLampRepaired: false,
  spellbookCharacterIds: [],
  muted: false,
  reducedMotion: false,
  selectedThemeForReview: "A",
  minimumPilotEvents: [],
};

const EXACT_KEYS = [
  "schemaVersion",
  "campLampRepaired",
  "spellbookCharacterIds",
  "muted",
  "reducedMotion",
  "selectedThemeForReview",
  "minimumPilotEvents",
] as const;

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === EXACT_KEYS.length && keys.every((key) => EXACT_KEYS.includes(key as never));
}

export function validatePilotSave(value: unknown): PilotSaveState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!hasExactKeys(candidate) || candidate.schemaVersion !== PILOT_SAVE_SCHEMA_VERSION) return null;
  if (typeof candidate.campLampRepaired !== "boolean") return null;
  if (typeof candidate.muted !== "boolean" || typeof candidate.reducedMotion !== "boolean") return null;
  if (!(["A", "B", "C"] as const).includes(candidate.selectedThemeForReview as VisualDirectionId)) return null;
  if (
    !Array.isArray(candidate.spellbookCharacterIds) ||
    candidate.spellbookCharacterIds.some((item) => typeof item !== "string") ||
    new Set(candidate.spellbookCharacterIds).size !== candidate.spellbookCharacterIds.length
  ) {
    return null;
  }
  if (
    !Array.isArray(candidate.minimumPilotEvents) ||
    candidate.minimumPilotEvents.some(
      (item) => typeof item !== "string" || !PILOT_EVENT_IDS.includes(item as PilotEventId),
    )
  ) {
    return null;
  }
  return {
    schemaVersion: PILOT_SAVE_SCHEMA_VERSION,
    campLampRepaired: candidate.campLampRepaired,
    spellbookCharacterIds: [...candidate.spellbookCharacterIds] as string[],
    muted: candidate.muted,
    reducedMotion: candidate.reducedMotion,
    selectedThemeForReview: candidate.selectedThemeForReview as VisualDirectionId,
    minimumPilotEvents: [...new Set(candidate.minimumPilotEvents as PilotEventId[])],
  };
}
