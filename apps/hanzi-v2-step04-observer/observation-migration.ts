import {
  FIRST_USE_CHECKPOINTS,
  SYNTHETIC_SCHEMA_FIXTURE_LABEL,
  type CheckpointNoticeValue,
  type FirstUseCheckpointId,
  type FirstUseObservationPackageV1,
  type FirstUseObservationPackageV2,
} from "./observation-model";
import { reconcileFirstUseEvidence } from "./evidence-reconciliation";

export const V1_REACH_NOTICE_SPLIT_WARNING =
  "Schema v1 checkpoint values mixed reach and notice; reach was derived from technical events.";
export const V1_NOT_REACHED_NOTICE_WARNING =
  "Schema v1 NOT_REACHED does not establish that the child did not notice; checkpoint notice migrated to UNRECORDED.";

export interface FirstUseObservationMigrationResult {
  readonly value: FirstUseObservationPackageV2;
  readonly warnings: readonly string[];
  readonly migratedFromSchemaVersion: 1;
}

function migrateCheckpointNotice(
  value: FirstUseObservationPackageV1["observations"]["checkpoints"],
): Record<FirstUseCheckpointId, CheckpointNoticeValue> {
  return Object.fromEntries(FIRST_USE_CHECKPOINTS.map((checkpointId) => {
    const legacy = value[checkpointId];
    return [checkpointId, legacy === "NOT_REACHED" ? "UNRECORDED" : legacy];
  })) as Record<FirstUseCheckpointId, CheckpointNoticeValue>;
}

function cloneV1HumanFields(value: FirstUseObservationPackageV1): Pick<
  FirstUseObservationPackageV2,
  "interventions" | "wellbeing" | "optionalChildChoices" | "observerNotes"
> {
  return {
    interventions: value.interventions.map((intervention) => ({ ...intervention })),
    wellbeing: { ...value.wellbeing },
    optionalChildChoices: { ...value.optionalChildChoices },
    observerNotes: value.observerNotes,
  };
}

export function migrateFirstUseObservationV1ToV2(
  source: FirstUseObservationPackageV1,
): FirstUseObservationMigrationResult {
  const humanReplayRecorded = source.optionalChildChoices.spontaneousReplay ||
    source.optionalChildChoices.promptedReplay ||
    source.observations.engagement.spontaneousReplay !== "NOT_REACHED";
  const migrationWarnings = [V1_REACH_NOTICE_SPLIT_WARNING];
  if (FIRST_USE_CHECKPOINTS.some((checkpointId) => source.observations.checkpoints[checkpointId] === "NOT_REACHED")) {
    migrationWarnings.push(V1_NOT_REACHED_NOTICE_WARNING);
  }

  const humanFields = cloneV1HumanFields(source);
  const value: FirstUseObservationPackageV2 = {
    schemaVersion: 2,
    initiativeId: source.initiativeId,
    step: source.step,
    evidenceKind: source.evidenceKind,
    fixtureLabel: source.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
      ? SYNTHETIC_SCHEMA_FIXTURE_LABEL
      : null,
    sessionIdentity: { ...source.sessionIdentity },
    buildIdentity: {
      ...source.buildIdentity,
      acceptedSourceSnapshots: { ...source.buildIdentity.acceptedSourceSnapshots },
    },
    parentAuthorization: { ...source.parentAuthorization },
    audioPreflight: {
      ...source.audioPreflight,
      phraseChecks: source.audioPreflight.phraseChecks.map((phrase) => ({ ...phrase })),
    },
    technicalEvents: source.technicalEvents.map((event) => ({
      ...event,
      safeMetadata: { ...event.safeMetadata },
    })),
    observations: {
      checkpointReach: Object.fromEntries(FIRST_USE_CHECKPOINTS.map((checkpointId) => [checkpointId, "NOT_REACHED"])) as FirstUseObservationPackageV2["observations"]["checkpointReach"],
      checkpointNotice: migrateCheckpointNotice(source.observations.checkpoints),
      usability: { ...source.observations.usability },
      engagement: { ...source.observations.engagement },
      learningMechanismVisibility: { ...source.observations.learningMechanismVisibility },
    },
    ...humanFields,
    replay: {
      replayIntent: source.optionalChildChoices.againAgain,
      parentObservedReplayRequest: humanReplayRecorded ? "OBSERVED" : "UNRECORDED",
      actualReplayAction: false,
    },
    completion: { ...source.completion },
    privacyConfirmed: true,
    evidenceConsistencyWarnings: [],
  };
  const reconciled = reconcileFirstUseEvidence(value, migrationWarnings);
  return {
    value: reconciled,
    warnings: reconciled.evidenceConsistencyWarnings,
    migratedFromSchemaVersion: 1,
  };
}
