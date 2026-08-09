import {
  FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256,
  FIRST_USE_PARENT_FEEDBACK_SHA256,
  type FirstUseAudioChoice,
  type FirstUseSessionGrant,
  type FirstUseSessionMode,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/session";
import type {
  FirstUseStopCode,
  FirstUseTechnicalEvent,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types";

export const STEP04_TECHNICAL_STATE = "AUTHORIZED_CHILD_FIRST_USE_READY" as const;
export const STEP04_AUDIO_CONTRACT_VERSION = "hanzi-v2-step04-spoken-phrase-v1" as const;
export const STEP04_RUNTIME_VERSION = "hanzi-v2-step04-runtime-v1" as const;

export const STEP04_ACCEPTED_SOURCE_SNAPSHOTS = {
  encounters: "fnv1a:d805357d",
  abilities: "fnv1a:2d361817",
  boss: "fnv1a:ee5df70f",
  themeC: "fnv1a:15133968",
  manifest: "fnv1a:67ad1fe2",
} as const;

export const OBSERVATION_VALUES = [
  "NOT_REACHED",
  "NOTICED_WITHOUT_PROMPT",
  "NOTICED_AFTER_BUILT_IN_SUPPORT",
  "NOTICED_AFTER_REGION_ONLY_PROMPT",
  "ADULT_ANSWER_REQUIRED",
  "STOPPED",
] as const;

export const CHECKPOINT_REACH_VALUES = ["REACHED", "NOT_REACHED", "STOPPED_BEFORE"] as const;

export const CHECKPOINT_NOTICE_VALUES = [
  "UNRECORDED",
  "NOTICED_WITHOUT_PROMPT",
  "NOTICED_AFTER_BUILT_IN_SUPPORT",
  "NOTICED_AFTER_REGION_ONLY_PROMPT",
  "ADULT_ANSWER_REQUIRED",
  "STOPPED",
] as const;

export const PARENT_OBSERVED_REPLAY_VALUES = ["UNRECORDED", "OBSERVED", "NOT_OBSERVED"] as const;

export const SYNTHETIC_SCHEMA_FIXTURE_LABEL = "SYNTHETIC_FROM_SCHEMA_ONLY" as const;

export const CHECKPOINT_REACH_VALUE_LABELS: Readonly<Record<CheckpointReachValue, string>> = {
  REACHED: "技术事件已到达",
  NOT_REACHED: "技术事件未到达",
  STOPPED_BEFORE: "停止前未到达",
};

export const CHECKPOINT_NOTICE_VALUE_LABELS: Readonly<Record<CheckpointNoticeValue, string>> = {
  UNRECORDED: "未记录是否注意到",
  NOTICED_WITHOUT_PROMPT: "无成人提示注意到",
  NOTICED_AFTER_BUILT_IN_SUPPORT: "内置支持后注意到",
  NOTICED_AFTER_REGION_ONLY_PROMPT: "只指区域后注意到",
  ADULT_ANSWER_REQUIRED: "需要成人给答案",
  STOPPED: "已停止",
};

export const PARENT_OBSERVED_REPLAY_LABELS: Readonly<Record<ParentObservedReplayValue, string>> = {
  UNRECORDED: "未记录",
  OBSERVED: "家长观察到重玩请求",
  NOT_OBSERVED: "家长未观察到重玩请求",
};

export const OBSERVATION_VALUE_LABELS: Readonly<Record<ObservationValue, string>> = {
  NOT_REACHED: "未到达",
  NOTICED_WITHOUT_PROMPT: "无成人提示注意到",
  NOTICED_AFTER_BUILT_IN_SUPPORT: "内置支持后注意到",
  NOTICED_AFTER_REGION_ONLY_PROMPT: "只指区域后注意到",
  ADULT_ANSWER_REQUIRED: "需要成人给答案",
  STOPPED: "已停止",
};

export const FIRST_USE_CHECKPOINTS = [
  "firstScreen",
  "firstSpell",
  "secondStructure",
  "abilityChoice",
  "bossIntent",
  "safeFailure",
  "campRepair",
  "spellbook",
] as const;

export const FIRST_USE_CHECKPOINT_LABELS: Readonly<Record<FirstUseCheckpointId, string>> = {
  firstScreen: "首屏",
  firstSpell: "首次施法",
  secondStructure: "第二结构",
  abilityChoice: "能力选择",
  bossIntent: "Boss intent",
  safeFailure: "安全失败",
  campRepair: "营地修复",
  spellbook: "魔法书",
};

export const USABILITY_OBSERVATION_IDS = [
  "firstAction",
  "boardCardSlotDistinction",
  "clickOrDrag",
  "abilityChoice",
  "bossIntent",
  "spellbookNavigation",
] as const;

export const ENGAGEMENT_OBSERVATION_IDS = [
  "voluntarilyContinued",
  "noticedWorldChange",
  "replayedAudio",
  "spontaneousReplay",
] as const;

export const LEARNING_VISIBILITY_OBSERVATION_IDS = [
  "noticedMingComposition",
  "noticedStructureChange",
  "noticedMeaningChangedWorld",
  "connectedAbilityToBossSupport",
] as const;

export const INTERVENTION_CODES = [
  "NONE",
  "REPEAT_VISIBLE_COPY",
  "POINT_TO_REGION_ONLY",
  "TECHNICAL_ASSIST",
  "ADULT_ANSWER_REQUIRED",
  "STOPPED",
] as const;

export const POINTABLE_REGIONS = ["WORLD", "BOARD", "HAND"] as const;
export const WELLBEING_VALUES = ["OBSERVED", "NOT_OBSERVED", "UNKNOWN"] as const;
export const AGAIN_AGAIN_VALUES = ["AGAIN_NOW", "MAYBE_LATER", "STOP", "DECLINED", "NOT_ASKED"] as const;
export const FAVORITE_MOMENT_VALUES = ["CAMP", "HANZI_MAGIC", "THREE_CHOICE", "BOSS", "SPELLBOOK", "NO_SELECTION", "NOT_ASKED"] as const;
export const COMPLETION_STATUSES = ["NOT_STARTED", "RUNNING", "COMPLETED", "STOPPED", "TECHNICAL_END"] as const;

export type ObservationValue = (typeof OBSERVATION_VALUES)[number];
export type CheckpointReachValue = (typeof CHECKPOINT_REACH_VALUES)[number];
export type CheckpointNoticeValue = (typeof CHECKPOINT_NOTICE_VALUES)[number];
export type ParentObservedReplayValue = (typeof PARENT_OBSERVED_REPLAY_VALUES)[number];
export type FirstUseCheckpointId = (typeof FIRST_USE_CHECKPOINTS)[number];
export type UsabilityObservationId = (typeof USABILITY_OBSERVATION_IDS)[number];
export type EngagementObservationId = (typeof ENGAGEMENT_OBSERVATION_IDS)[number];
export type LearningVisibilityObservationId = (typeof LEARNING_VISIBILITY_OBSERVATION_IDS)[number];
export type InterventionCode = (typeof INTERVENTION_CODES)[number];
export type PointableRegion = (typeof POINTABLE_REGIONS)[number];
export type WellbeingValue = (typeof WELLBEING_VALUES)[number];
export type AgainAgainValue = (typeof AGAIN_AGAIN_VALUES)[number];
export type FavoriteMomentValue = (typeof FAVORITE_MOMENT_VALUES)[number];
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export interface FirstUseBuildIdentity {
  readonly schemaVersion: 1;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "04";
  readonly technicalState: typeof STEP04_TECHNICAL_STATE;
  readonly parentFeedbackSha256: typeof FIRST_USE_PARENT_FEEDBACK_SHA256;
  readonly acceptedReviewIdentitySha256: typeof FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256;
  readonly acceptedSourceSnapshots: typeof STEP04_ACCEPTED_SOURCE_SNAPSHOTS;
  readonly audioContractVersion: typeof STEP04_AUDIO_CONTRACT_VERSION;
  readonly runtimeVersion: typeof STEP04_RUNTIME_VERSION;
  readonly commitSha: string;
  readonly generatedAtUtc: string;
  readonly buildIdentitySha256: string;
}

export interface FirstUseIntervention {
  readonly checkpointId: FirstUseCheckpointId;
  readonly code: InterventionCode;
  readonly region: PointableRegion | null;
  readonly relativeMs: number;
}

export interface FirstUseObservationPackageV1 {
  readonly schemaVersion: 1;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "04";
  readonly evidenceKind: "REAL_CHILD_OBSERVATION" | "SYNTHETIC_TOOLING_TEST_ONLY";
  sessionIdentity: {
    sessionId: string;
    runSeed: string;
    sessionMode: FirstUseSessionMode;
    startedAtUtc: string;
    runCount: 1 | 2;
  };
  buildIdentity: FirstUseBuildIdentity;
  parentAuthorization: {
    schemaVersion: 1;
    initiativeId: "hanzi-radical-battle-v2";
    step: "04";
    authorized: true;
    authorizeChildFirstUse: "YES";
    audioDecision: "REVISE";
    parentFeedbackSha256: typeof FIRST_USE_PARENT_FEEDBACK_SHA256;
    acceptedReviewIdentitySha256: typeof FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256;
    checkedAtUtc: string;
  };
  audioPreflight: {
    decision: FirstUseAudioChoice;
    lang: "zh-CN";
    adapterStatus: "SPEECH_SYNTHESIS" | "UNAVAILABLE";
    voiceCategory: "ZH_CN_DEVICE_VOICE" | "ZH_DEVICE_VOICE" | "DEFAULT_DEVICE_VOICE" | "NONE";
    visualPinyinConfirmed: true;
    phraseChecks: readonly {
      visualPinyin: string;
      spokenPhrase: string;
      result: "HEARD_OK" | "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE";
    }[];
  };
  technicalEvents: FirstUseTechnicalEvent[];
  observations: {
    checkpoints: Record<FirstUseCheckpointId, ObservationValue>;
    usability: Record<UsabilityObservationId, ObservationValue>;
    engagement: Record<EngagementObservationId, ObservationValue>;
    learningMechanismVisibility: Record<LearningVisibilityObservationId, ObservationValue>;
  };
  interventions: FirstUseIntervention[];
  wellbeing: {
    comfortable: WellbeingValue;
    briefConfusionRecovered: WellbeingValue;
    sustainedFrustration: WellbeingValue;
    sensoryDiscomfort: WellbeingValue;
    childInitiatedStop: WellbeingValue;
    feltForced: WellbeingValue;
    stopCode: FirstUseStopCode | null;
  };
  optionalChildChoices: {
    againAgain: AgainAgainValue;
    favoriteMoment: FavoriteMomentValue;
    spontaneousReplay: boolean;
    promptedReplay: boolean;
    optionalQuestionsAsked: boolean;
  };
  completion: {
    childRouteLoaded: boolean;
    runCompleted: boolean;
    sessionStopped: boolean;
    relativeDurationMs: number;
    runCount: 1 | 2;
    stopCode: FirstUseStopCode | null;
  };
  privacyConfirmed: true;
  observerNotes: string;
}

export interface FirstUseObservationPackageV2 {
  readonly schemaVersion: 2;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "04";
  readonly evidenceKind: "REAL_CHILD_OBSERVATION" | "SYNTHETIC_TOOLING_TEST_ONLY";
  readonly fixtureLabel: typeof SYNTHETIC_SCHEMA_FIXTURE_LABEL | null;
  sessionIdentity: FirstUseObservationPackageV1["sessionIdentity"];
  buildIdentity: FirstUseBuildIdentity;
  parentAuthorization: FirstUseObservationPackageV1["parentAuthorization"];
  audioPreflight: FirstUseObservationPackageV1["audioPreflight"];
  technicalEvents: FirstUseTechnicalEvent[];
  observations: {
    checkpointReach: Record<FirstUseCheckpointId, CheckpointReachValue>;
    checkpointNotice: Record<FirstUseCheckpointId, CheckpointNoticeValue>;
    usability: Record<UsabilityObservationId, ObservationValue>;
    engagement: Record<EngagementObservationId, ObservationValue>;
    learningMechanismVisibility: Record<LearningVisibilityObservationId, ObservationValue>;
  };
  interventions: FirstUseIntervention[];
  wellbeing: FirstUseObservationPackageV1["wellbeing"];
  optionalChildChoices: FirstUseObservationPackageV1["optionalChildChoices"];
  replay: {
    replayIntent: AgainAgainValue;
    parentObservedReplayRequest: ParentObservedReplayValue;
    actualReplayAction: boolean;
  };
  completion: FirstUseObservationPackageV1["completion"];
  privacyConfirmed: true;
  observerNotes: string;
  evidenceConsistencyWarnings: string[];
}

export type FirstUseObservationPackage = FirstUseObservationPackageV2;

export type FirstUseObservationPackageAnyVersion = FirstUseObservationPackageV1 | FirstUseObservationPackageV2;

function enumRecord<T extends readonly string[]>(keys: T): Record<T[number], ObservationValue> {
  return Object.fromEntries(keys.map((key) => [key, "NOT_REACHED"])) as Record<T[number], ObservationValue>;
}

function checkpointReachRecord(): Record<FirstUseCheckpointId, CheckpointReachValue> {
  return Object.fromEntries(FIRST_USE_CHECKPOINTS.map((key) => [key, "NOT_REACHED"])) as Record<FirstUseCheckpointId, CheckpointReachValue>;
}

function checkpointNoticeRecord(): Record<FirstUseCheckpointId, CheckpointNoticeValue> {
  return Object.fromEntries(FIRST_USE_CHECKPOINTS.map((key) => [key, "UNRECORDED"])) as Record<FirstUseCheckpointId, CheckpointNoticeValue>;
}

export function createFirstUseBuildIdentity(
  commitSha: string,
  generatedAtUtc: string,
  buildIdentitySha256: string,
): FirstUseBuildIdentity {
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) throw new Error("STEP 04 commit SHA must contain 40 hexadecimal characters");
  if (Number.isNaN(Date.parse(generatedAtUtc))) throw new Error("STEP 04 generatedAtUtc must be an ISO date-time");
  if (!/^[A-F0-9]{64}$/.test(buildIdentitySha256)) throw new Error("STEP 04 build identity SHA-256 is invalid");
  return {
    schemaVersion: 1,
    initiativeId: "hanzi-radical-battle-v2",
    step: "04",
    technicalState: STEP04_TECHNICAL_STATE,
    parentFeedbackSha256: FIRST_USE_PARENT_FEEDBACK_SHA256,
    acceptedReviewIdentitySha256: FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256,
    acceptedSourceSnapshots: { ...STEP04_ACCEPTED_SOURCE_SNAPSHOTS },
    audioContractVersion: STEP04_AUDIO_CONTRACT_VERSION,
    runtimeVersion: STEP04_RUNTIME_VERSION,
    commitSha: commitSha.toLowerCase(),
    generatedAtUtc,
    buildIdentitySha256,
  };
}

export function createFirstUseObservationPackage(
  grant: FirstUseSessionGrant,
  buildIdentity: FirstUseBuildIdentity,
  audio: {
    readonly decision: FirstUseAudioChoice;
    readonly adapter: "speech-synthesis" | "silent-visual";
    readonly voiceCategory: "ZH_CN_DEVICE_VOICE" | "ZH_DEVICE_VOICE" | "DEFAULT_DEVICE_VOICE" | "NONE";
  },
  identityTimes: { readonly startedAtUtc: string; readonly checkedAtUtc: string },
): FirstUseObservationPackage {
  if (grant.status !== "AUTHORIZED" || !grant.sessionMode || !grant.audioChoice || !grant.readyConfirmed) {
    throw new Error("An authorized STEP 04 grant is required to create an observation package");
  }
  if (audio.decision !== grant.audioChoice) throw new Error("Audio preflight does not match the authorized grant");
  return {
    schemaVersion: 2,
    initiativeId: "hanzi-radical-battle-v2",
    step: "04",
    evidenceKind: grant.fixture ? "SYNTHETIC_TOOLING_TEST_ONLY" : "REAL_CHILD_OBSERVATION",
    fixtureLabel: grant.fixture ? SYNTHETIC_SCHEMA_FIXTURE_LABEL : null,
    sessionIdentity: {
      sessionId: grant.sessionId,
      runSeed: grant.runSeed,
      sessionMode: grant.sessionMode,
      startedAtUtc: identityTimes.startedAtUtc,
      runCount: 1,
    },
    buildIdentity,
    parentAuthorization: {
      schemaVersion: 1,
      initiativeId: "hanzi-radical-battle-v2",
      step: "04",
      authorized: true,
      authorizeChildFirstUse: "YES",
      audioDecision: "REVISE",
      parentFeedbackSha256: FIRST_USE_PARENT_FEEDBACK_SHA256,
      acceptedReviewIdentitySha256: FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256,
      checkedAtUtc: identityTimes.checkedAtUtc,
    },
    audioPreflight: {
      decision: grant.audioChoice,
      lang: "zh-CN",
      adapterStatus: audio.adapter === "speech-synthesis" ? "SPEECH_SYNTHESIS" : "UNAVAILABLE",
      voiceCategory: audio.voiceCategory,
      visualPinyinConfirmed: true,
      phraseChecks: [
        { visualPinyin: "míng", spokenPhrase: "明，明亮的明。", result: grant.audioChoice === "SOUND_OK" && audio.adapter === "speech-synthesis" ? "HEARD_OK" : "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE" },
        { visualPinyin: "huā", spokenPhrase: "花，花朵的花。", result: grant.audioChoice === "SOUND_OK" && audio.adapter === "speech-synthesis" ? "HEARD_OK" : "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE" },
        { visualPinyin: "lín", spokenPhrase: "林，树林的林。", result: grant.audioChoice === "SOUND_OK" && audio.adapter === "speech-synthesis" ? "HEARD_OK" : "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE" },
        { visualPinyin: "xīng", spokenPhrase: "星，星星的星。", result: grant.audioChoice === "SOUND_OK" && audio.adapter === "speech-synthesis" ? "HEARD_OK" : "DISPLAY_ONLY_MUTED_OR_UNAVAILABLE" },
      ],
    },
    technicalEvents: [],
    observations: {
      checkpointReach: checkpointReachRecord(),
      checkpointNotice: checkpointNoticeRecord(),
      usability: enumRecord(USABILITY_OBSERVATION_IDS),
      engagement: enumRecord(ENGAGEMENT_OBSERVATION_IDS),
      learningMechanismVisibility: enumRecord(LEARNING_VISIBILITY_OBSERVATION_IDS),
    },
    interventions: [],
    wellbeing: {
      comfortable: "NOT_OBSERVED",
      briefConfusionRecovered: "NOT_OBSERVED",
      sustainedFrustration: "NOT_OBSERVED",
      sensoryDiscomfort: "NOT_OBSERVED",
      childInitiatedStop: "NOT_OBSERVED",
      feltForced: "NOT_OBSERVED",
      stopCode: null,
    },
    optionalChildChoices: {
      againAgain: "NOT_ASKED",
      favoriteMoment: "NOT_ASKED",
      spontaneousReplay: false,
      promptedReplay: false,
      optionalQuestionsAsked: false,
    },
    replay: {
      replayIntent: "NOT_ASKED",
      parentObservedReplayRequest: "UNRECORDED",
      actualReplayAction: false,
    },
    completion: { childRouteLoaded: false, runCompleted: false, sessionStopped: false, relativeDurationMs: 0, runCount: 1, stopCode: null },
    privacyConfirmed: true,
    observerNotes: "",
    evidenceConsistencyWarnings: [],
  };
}

export function interventionCreatesCoreUsabilityRisk(intervention: FirstUseIntervention): boolean {
  return intervention.code === "ADULT_ANSWER_REQUIRED";
}
