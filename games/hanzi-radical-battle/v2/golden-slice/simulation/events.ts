import type { AbilityId, GoldenEncounterId } from "../content/types";

export const LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION = 1;
export const LOCAL_PLAYTEST_SEGMENTS = [
  "camp",
  "battle_1",
  "breather",
  "battle_2",
  "ability_choice",
  "boss_phase_1",
  "boss_phase_2",
  "return_to_camp",
  "spellbook",
] as const;
export const LOCAL_PLAYTEST_VIEWPORT_CLASSES = ["phone_portrait", "tablet_landscape", "desktop"] as const;
export const LOCAL_PLAYTEST_EVENT_FIELDS = [
  "schemaVersion",
  "sessionId",
  "runSeed",
  "firstActionMs",
  "firstSpellMs",
  "segmentDurationsMs",
  "invalidPlacementCountByEncounter",
  "maxHintLevelByEncounter",
  "chosenAbilityId",
  "bossPhaseRetryCount",
  "completed",
  "replayClicked",
  "muted",
  "reducedMotion",
  "viewportClass",
] as const;

export type LocalPlaytestSegmentId = (typeof LOCAL_PLAYTEST_SEGMENTS)[number];
export type LocalPlaytestViewportClass = (typeof LOCAL_PLAYTEST_VIEWPORT_CLASSES)[number];

/**
 * A local, anonymous end-of-session summary. It has no child name, notes,
 * timestamp, account, device identifier, or network destination.
 */
export interface LocalPlaytestEvent {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly runSeed: string;
  readonly firstActionMs: number | null;
  readonly firstSpellMs: number | null;
  readonly segmentDurationsMs: Readonly<Record<LocalPlaytestSegmentId, number>>;
  readonly invalidPlacementCountByEncounter: Readonly<Record<GoldenEncounterId, number>>;
  readonly maxHintLevelByEncounter: Readonly<Record<GoldenEncounterId, number>>;
  readonly chosenAbilityId: AbilityId | null;
  readonly bossPhaseRetryCount: Readonly<Record<"lin" | "xing", number>>;
  readonly completed: boolean;
  readonly replayClicked: boolean;
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly viewportClass: LocalPlaytestViewportClass;
}

export const GOLDEN_SLICE_EVENT_IDS = [
  "run_started",
  "encounter_started",
  "card_selected",
  "card_placed",
  "placement_cancelled",
  "placement_retried",
  "structure_completed",
  "character_formed",
  "spell_cast",
  "ability_chosen",
  "ability_used",
  "boss_interference",
  "boss_recovered",
  "safe_retry_started",
  "camp_repaired",
  "spellbook_opened",
  "run_completed",
  "replay_started",
  "review_jumped",
] as const;

export type GoldenSliceEventId = (typeof GOLDEN_SLICE_EVENT_IDS)[number];

/** Deliberately anonymous and free-text-free so the event list is safe to keep locally. */
export interface GoldenSliceEvent {
  readonly id: GoldenSliceEventId;
  readonly sequence: number;
  readonly encounterId: GoldenEncounterId | null;
  readonly abilityId: AbilityId | null;
}

export function appendGoldenSliceEvent(
  events: readonly GoldenSliceEvent[],
  id: GoldenSliceEventId,
  encounterId: GoldenEncounterId | null,
  abilityId: AbilityId | null,
): readonly GoldenSliceEvent[] {
  return [...events, { id, sequence: events.length + 1, encounterId, abilityId }];
}
