export const OBSERVATION_STORAGE_KEY = "game-codex/parent-observation/v1";
export const OBSERVATION_FORMAT = "game-codex-natural-use-observations";
export const OBSERVATION_SCHEMA_VERSION = 1 as const;
export const OBSERVATION_RETENTION_DAYS = 90;
export const OBSERVATION_MAX_RECORDS = 100;
export const OBSERVATION_NOTE_MAX_CHARS = 240;

export const OBSERVATION_MOMENTS = [
  "entry",
  "first-action",
  "during-play",
  "feedback",
  "exit-return",
  "technical",
  "other",
] as const;

export type ObservationMoment = (typeof OBSERVATION_MOMENTS)[number];

export const OBSERVATION_TAGS = [
  "started-without-prompt",
  "asked-to-play-again",
  "replayed-same-activity",
  "understood-control",
  "hesitated",
  "needed-light-help",
  "needed-substantial-help",
  "feedback-unclear",
  "control-missed",
  "left-before-finish",
  "technical-glitch",
  "other",
] as const;

export type ObservationTag = (typeof OBSERVATION_TAGS)[number];

export const PARENT_HELP_VALUES = ["none", "light", "substantial", "not-applicable"] as const;
export type ParentHelp = (typeof PARENT_HELP_VALUES)[number];

export const OBSERVED_OUTCOMES = ["continued", "replayed", "stopped", "blocked", "not-applicable"] as const;
export type ObservedOutcome = (typeof OBSERVED_OUTCOMES)[number];

export interface NaturalUseObservationRecord {
  readonly id: string;
  readonly schemaVersion: typeof OBSERVATION_SCHEMA_VERSION;
  readonly dateLocal: string;
  readonly buildCommit: string;
  readonly surfaceId: string;
  readonly moment: ObservationMoment;
  readonly tags: readonly ObservationTag[];
  readonly parentHelp: ParentHelp;
  readonly outcome: ObservedOutcome;
  readonly note?: string;
}

export interface NaturalUseObservationDraft {
  readonly dateLocal: string;
  readonly buildCommit: string;
  readonly surfaceId: string;
  readonly moment: ObservationMoment;
  readonly tags: readonly ObservationTag[];
  readonly parentHelp: ParentHelp;
  readonly outcome: ObservedOutcome;
  readonly note?: string;
}

export interface NaturalUseObservationBundle {
  readonly format: typeof OBSERVATION_FORMAT;
  readonly version: typeof OBSERVATION_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly projectBuildCommit: string;
  readonly retentionDays: typeof OBSERVATION_RETENTION_DAYS;
  readonly maxRecords: typeof OBSERVATION_MAX_RECORDS;
  readonly recordCount: number;
  readonly records: readonly NaturalUseObservationRecord[];
  readonly integrity: {
    readonly algorithm: "SHA-256";
    readonly recordsSha256: string;
  };
}

export const FORBIDDEN_OBSERVATION_FIELDS = [
  "childName", "name", "email", "phone", "birthday", "age", "school", "class", "address", "location",
  "deviceId", "ip", "userAgent", "sessionId", "sessionDuration", "routeHistory", "clickHistory", "audio", "video",
  "photo", "screenshot", "transcript", "health", "biometric",
] as const;
