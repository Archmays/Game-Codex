import {
  CHECKPOINT_NOTICE_VALUE_LABELS,
  CHECKPOINT_REACH_VALUE_LABELS,
  FIRST_USE_CHECKPOINT_LABELS,
  OBSERVATION_VALUE_LABELS,
  interventionCreatesCoreUsabilityRisk,
  type FirstUseObservationPackage,
  type ObservationValue,
} from "./observation-model";
import { assertValidFirstUseObservation, validateFirstUseObservation } from "./observation-schema";
import { validateObserverNotes } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/privacy";
import { deriveFirstUseTechnicalTimeline } from "./evidence-reconciliation";

export const FIRST_USE_OBSERVATION_FILE_NAME = "STEP-04_CHILD_FIRST_USE_OBSERVATION.json";
export const FIRST_USE_SUMMARY_FILE_NAME = "STEP-04-CHILD-FIRST-USE-SUMMARY.md";

function eventCount(packageValue: FirstUseObservationPackage, eventType: string): number {
  return packageValue.technicalEvents.filter((event) => event.eventType === eventType).length;
}

function lastMetadata(packageValue: FirstUseObservationPackage, eventType: string, key: string): string {
  const event = [...packageValue.technicalEvents].reverse().find((candidate) => candidate.eventType === eventType);
  const value = event?.safeMetadata[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "未记录";
}

function observationLines(record: Readonly<Record<string, ObservationValue>>, labels?: Readonly<Record<string, string>>): string[] {
  return Object.entries(record).map(([key, value]) => `- ${labels?.[key] ?? key}: ${OBSERVATION_VALUE_LABELS[value]}`);
}

export function serializeFirstUseObservation(packageValue: FirstUseObservationPackage): string {
  assertValidFirstUseObservation(packageValue);
  return `${JSON.stringify(packageValue, null, 2)}\n`;
}

export function buildFirstUseSummaryMarkdown(packageValue: FirstUseObservationPackage): string {
  assertValidFirstUseObservation(packageValue);
  const timeline = deriveFirstUseTechnicalTimeline(packageValue.technicalEvents);
  const lastRelativeMs = packageValue.technicalEvents.at(-1)?.relativeMs ?? packageValue.completion.relativeDurationMs;
  const technicalErrors = packageValue.technicalEvents.filter((event) => event.eventType === "technical_error")
    .map((event) => String(event.safeMetadata.errorCode));
  const adultAnswerRisk = packageValue.interventions.some(interventionCreatesCoreUsabilityRisk);
  const fixtureWarning = packageValue.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
    ? "> SYNTHETIC_TOOLING_TEST_ONLY：这是工具 fixture，不是真实儿童观察。\n\n"
    : "";
  const completionState = packageValue.completion.sessionStopped ? "STOPPED" : packageValue.completion.runCompleted ? "COMPLETED" : packageValue.completion.childRouteLoaded ? "RUNNING" : "NOT_STARTED";
  return `# STEP 04 Child First-Use Summary

${fixtureWarning}## Technical facts

- Child route ready: ${eventCount(packageValue, "child_route_ready") > 0 ? "yes" : "no technical event received"}
- Event sequence: ${packageValue.technicalEvents.length ? `1–${packageValue.technicalEvents.at(-1)?.sequence}` : "none"}
- Technical errors: ${technicalErrors.length ? technicalErrors.join(", ") : "none reported"}
- Completion state: ${completionState}
- Last relative time: ${lastRelativeMs} ms
- Invalid placements: ${eventCount(packageValue, "invalid_placement")}
- Built-in hints shown: ${eventCount(packageValue, "built_in_hint_shown")}
- Selected ability: ${lastMetadata(packageValue, "ability_selected", "abilityId")}
- Camp repaired event: ${eventCount(packageValue, "camp_repaired") > 0 ? "received" : "not received"}
- Spellbook event: ${eventCount(packageValue, "spellbook_opened") > 0 ? "received" : "not received"}
- Replay signal: ${eventCount(packageValue, "replay_selected") > 0 ? lastMetadata(packageValue, "replay_selected", "origin") : "not received"}
- First action: ${timeline.firstActionMs ?? "not received"} ms
- First spell: ${timeline.firstSpellMs ?? "not received"} ms

## Human observations

### Checkpoint reach (technical-derived, read-only)

${Object.entries(packageValue.observations.checkpointReach).map(([key, value]) => `- ${FIRST_USE_CHECKPOINT_LABELS[key as keyof typeof FIRST_USE_CHECKPOINT_LABELS] ?? key}: ${CHECKPOINT_REACH_VALUE_LABELS[value]}`).join("\n")}

### Checkpoint notice (human observation)

${Object.entries(packageValue.observations.checkpointNotice).map(([key, value]) => `- ${FIRST_USE_CHECKPOINT_LABELS[key as keyof typeof FIRST_USE_CHECKPOINT_LABELS] ?? key}: ${CHECKPOINT_NOTICE_VALUE_LABELS[value]}`).join("\n")}

### Usability

${observationLines(packageValue.observations.usability).join("\n")}

### Engagement

${observationLines(packageValue.observations.engagement).join("\n")}

### Learning mechanism visibility

${observationLines(packageValue.observations.learningMechanismVisibility).join("\n")}

### Interventions and wellbeing

- Intervention count: ${packageValue.interventions.length}
- Adult answer required risk: ${adultAnswerRisk ? "recorded for parent interpretation" : "not recorded"}
- Wellbeing: ${JSON.stringify(packageValue.wellbeing)}
- Again-Again: ${packageValue.optionalChildChoices.againAgain}
- Favorite moment: ${packageValue.optionalChildChoices.favoriteMoment}

## Replay reconciliation

- replayIntent: ${packageValue.replay.replayIntent}
- parentObservedReplayRequest: ${packageValue.replay.parentObservedReplayRequest}
- actualReplayAction: ${packageValue.replay.actualReplayAction}
- runCount: ${packageValue.completion.runCount}

## Evidence consistency warnings

${packageValue.evidenceConsistencyWarnings.length ? packageValue.evidenceConsistencyWarnings.map((warning) => `- ${warning}`).join("\n") : "- none"}

## Parent notes

${packageValue.observerNotes || "No parent notes entered."}

## Explicitly not concluded

- Learning effectiveness
- Generalized usability
- Child acceptance
- Default-world promotion
- Comparative preference
- Long-term retention
`;
}

export function downloadFirstUseObservation(packageValue: FirstUseObservationPackage): void {
  const notes = validateObserverNotes(packageValue.observerNotes);
  if (!notes.ok) throw new Error(notes.issues.join("; "));
  const validation = validateFirstUseObservation(packageValue);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  const blob = new Blob([serializeFirstUseObservation(packageValue)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = FIRST_USE_OBSERVATION_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}
