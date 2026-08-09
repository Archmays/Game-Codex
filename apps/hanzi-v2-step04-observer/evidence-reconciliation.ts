import type { FirstUseTechnicalEvent } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types";
import {
  FIRST_USE_CHECKPOINTS,
  type CheckpointReachValue,
  type FirstUseCheckpointId,
  type FirstUseObservationPackageV2,
} from "./observation-model";

export const REPLAY_INTENT_WITHOUT_ACTION_WARNING =
  "Human replay intent recorded, but no replay_selected event.";
export const PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING =
  "Parent-observed replay request recorded, but no replay_selected event.";
export const REPLAY_EVENT_RUN_COUNT_WARNING =
  "A replay_selected event exists, but the recorded run count is still 1.";
export const RUN_COUNT_WITHOUT_REPLAY_EVENT_WARNING =
  "The recorded run count is 2, but no replay_selected event exists.";

export interface FirstUseTechnicalTimeline {
  readonly firstActionMs: number | null;
  readonly firstSpellMs: number | null;
  readonly spells: readonly { readonly characterId: string; readonly relativeMs: number }[];
  readonly hints: readonly { readonly encounterId: string; readonly hintLevel: number; readonly relativeMs: number }[];
  readonly ability: { readonly abilityId: string; readonly relativeMs: number } | null;
  readonly bossPhases: readonly {
    readonly bossPhase: string;
    readonly intentMs: number | null;
    readonly completedMs: number | null;
  }[];
  readonly campRepairMs: number | null;
  readonly spellbookMs: number | null;
  readonly completionMs: number | null;
  readonly invalidPlacementCount: number;
  readonly replayEventCount: number;
}

function firstEvent(
  events: readonly FirstUseTechnicalEvent[],
  eventType: FirstUseTechnicalEvent["eventType"],
  predicate: (event: FirstUseTechnicalEvent) => boolean = () => true,
): FirstUseTechnicalEvent | null {
  return events.find((event) => event.eventType === eventType && predicate(event)) ?? null;
}

function metadataString(event: FirstUseTechnicalEvent | null, key: string): string | null {
  const value = event?.safeMetadata[key];
  return typeof value === "string" ? value : null;
}

export function deriveFirstUseTechnicalTimeline(
  events: readonly FirstUseTechnicalEvent[],
): FirstUseTechnicalTimeline {
  const firstAction = firstEvent(events, "first_action");
  const spells = events
    .filter((event) => event.eventType === "spell_formed")
    .map((event) => ({
      characterId: metadataString(event, "characterId") ?? "unknown",
      relativeMs: event.relativeMs,
    }));
  const hints = events
    .filter((event) => event.eventType === "built_in_hint_shown")
    .map((event) => ({
      encounterId: metadataString(event, "encounterId") ?? "unknown",
      hintLevel: typeof event.safeMetadata.hintLevel === "number" ? event.safeMetadata.hintLevel : 0,
      relativeMs: event.relativeMs,
    }));
  const abilityEvent = firstEvent(events, "ability_selected");
  const bossPhases = ["lin", "xing"].map((bossPhase) => ({
    bossPhase,
    intentMs: firstEvent(
      events,
      "boss_intent_shown",
      (event) => event.safeMetadata.bossPhase === bossPhase,
    )?.relativeMs ?? null,
    completedMs: firstEvent(
      events,
      "boss_phase_completed",
      (event) => event.safeMetadata.bossPhase === bossPhase,
    )?.relativeMs ?? null,
  }));
  return {
    firstActionMs: firstAction?.relativeMs ?? null,
    firstSpellMs: spells[0]?.relativeMs ?? null,
    spells,
    hints,
    ability: abilityEvent
      ? { abilityId: metadataString(abilityEvent, "abilityId") ?? "unknown", relativeMs: abilityEvent.relativeMs }
      : null,
    bossPhases,
    campRepairMs: firstEvent(events, "camp_repaired")?.relativeMs ?? null,
    spellbookMs: firstEvent(events, "spellbook_opened")?.relativeMs ?? null,
    completionMs: firstEvent(events, "run_completed")?.relativeMs ?? null,
    invalidPlacementCount: events.filter((event) => event.eventType === "invalid_placement").length,
    replayEventCount: events.filter((event) => event.eventType === "replay_selected").length,
  };
}

function reached(
  events: readonly FirstUseTechnicalEvent[],
  checkpointId: FirstUseCheckpointId,
): boolean {
  const has = (
    eventType: FirstUseTechnicalEvent["eventType"],
    predicate: (event: FirstUseTechnicalEvent) => boolean = () => true,
  ): boolean => events.some((event) => event.eventType === eventType && predicate(event));
  const phase = (value: string): boolean => has("phase_entered", (event) => event.safeMetadata.phase === value);
  switch (checkpointId) {
    case "firstScreen": return has("child_route_ready") || has("first_action");
    case "firstSpell": return has("spell_formed", (event) => event.safeMetadata.characterId === "ming") || phase("battle_1_forming");
    case "secondStructure": return has("spell_formed", (event) => event.safeMetadata.characterId === "hua") || phase("battle_2_forming");
    case "abilityChoice": return has("ability_selected") || phase("ability_choice");
    case "bossIntent": return has("boss_intent_shown");
    case "safeFailure": return phase("safe_retry");
    case "campRepair": return has("camp_repaired") || phase("camp_repair");
    case "spellbook": return has("spellbook_opened") || phase("spellbook_review");
  }
}

export function deriveCheckpointReach(
  events: readonly FirstUseTechnicalEvent[],
  sessionStopped = false,
): Record<FirstUseCheckpointId, CheckpointReachValue> {
  const stopped = sessionStopped || events.some((event) => event.eventType === "session_stopped");
  return Object.fromEntries(FIRST_USE_CHECKPOINTS.map((checkpointId) => [
    checkpointId,
    reached(events, checkpointId) ? "REACHED" : stopped ? "STOPPED_BEFORE" : "NOT_REACHED",
  ])) as Record<FirstUseCheckpointId, CheckpointReachValue>;
}

export function evidenceConsistencyWarnings(
  value: Pick<FirstUseObservationPackageV2, "technicalEvents" | "replay" | "completion">,
): string[] {
  const actualReplayAction = value.technicalEvents.some((event) => event.eventType === "replay_selected");
  const warnings: string[] = [];
  if (value.replay.replayIntent === "AGAIN_NOW" && !actualReplayAction) {
    warnings.push(REPLAY_INTENT_WITHOUT_ACTION_WARNING);
  }
  if (value.replay.parentObservedReplayRequest === "OBSERVED" && !actualReplayAction) {
    warnings.push(PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING);
  }
  if (actualReplayAction && value.completion.runCount === 1) warnings.push(REPLAY_EVENT_RUN_COUNT_WARNING);
  if (!actualReplayAction && value.completion.runCount === 2) warnings.push(RUN_COUNT_WITHOUT_REPLAY_EVENT_WARNING);
  return warnings;
}

export function reconcileFirstUseEvidence(
  value: FirstUseObservationPackageV2,
  additionalWarnings: readonly string[] = [],
): FirstUseObservationPackageV2 {
  const actualReplayAction = value.technicalEvents.some((event) => event.eventType === "replay_selected");
  const dynamicWarnings = new Set([
    REPLAY_INTENT_WITHOUT_ACTION_WARNING,
    PARENT_REPLAY_REQUEST_WITHOUT_ACTION_WARNING,
    REPLAY_EVENT_RUN_COUNT_WARNING,
    RUN_COUNT_WITHOUT_REPLAY_EVENT_WARNING,
  ]);
  const retainedWarnings = value.evidenceConsistencyWarnings.filter((warning) => !dynamicWarnings.has(warning));
  const reconciled: FirstUseObservationPackageV2 = {
    ...value,
    observations: {
      ...value.observations,
      checkpointReach: deriveCheckpointReach(value.technicalEvents, value.completion.sessionStopped),
    },
    replay: { ...value.replay, actualReplayAction },
    evidenceConsistencyWarnings: [],
  };
  reconciled.evidenceConsistencyWarnings = [...new Set([
    ...retainedWarnings,
    ...additionalWarnings,
    ...evidenceConsistencyWarnings(reconciled),
  ])];
  return reconciled;
}
