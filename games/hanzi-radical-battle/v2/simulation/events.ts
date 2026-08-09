export const PILOT_EVENT_IDS = [
  "pilot_opened",
  "encounter_entered",
  "card_selected",
  "card_placed",
  "placement_retried",
  "structure_completed",
  "character_formed",
  "spell_cast",
  "monster_cleared",
  "camp_repaired",
  "spellbook_opened",
  "pilot_completed",
] as const;

export type PilotEventId = (typeof PILOT_EVENT_IDS)[number];

export interface PilotEvent {
  id: PilotEventId;
  sequence: number;
  detail?: string;
}

export function appendPilotEvent(
  events: readonly PilotEvent[],
  id: PilotEventId,
  detail?: string,
): readonly PilotEvent[] {
  return [...events, { id, sequence: events.length + 1, ...(detail ? { detail } : {}) }];
}
