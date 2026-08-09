export const STEP05_EVIDENCE_SHA256 = "EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8";
export const STEP04_RETURN_PACKAGE_SHA256 = "FEE13257ECF3402CDB85D6153D08FCF9A3082CD208EE88B10BABA8978E1F6612";

export const STEP05_PROVISIONAL_DECISION = "PROMOTE_TO_PRIVATE_WORLD_ENTRY_AFTER_CHANGED_ONLY_FIX" as const;

export const STEP05_SAFE_EVIDENCE = {
  evidenceKind: "REAL_CHILD_OBSERVATION",
  buildCommit: "388370d69ab469b7ee0657047b001485fbe58395",
  durationMs: 63_241,
  firstActionMs: 2_122,
  firstSpellMs: 14_388,
  invalidPlacements: 0,
  builtInHints: 3,
  selectedAbility: "star-path",
  runCount: 1,
  adultInterventions: "NONE",
  againAgain: "AGAIN_NOW",
  favoriteMoment: "HANZI_MAGIC",
  comfortable: "OBSERVED",
  parentNote: "在非战斗阶段，点击读音，依然会把下一次战斗的字的读音读出来，这需要修订。",
  timeline: [
    { label: "第一次操作", relativeMs: 2_122 },
    { label: "明形成", relativeMs: 14_388 },
    { label: "花形成", relativeMs: 27_351 },
    { label: "选择星光路", relativeMs: 32_598 },
    { label: "林形成", relativeMs: 44_934 },
    { label: "星形成", relativeMs: 55_507 },
    { label: "营地修复", relativeMs: 58_974 },
    { label: "打开魔法书", relativeMs: 60_101 },
    { label: "本局完成", relativeMs: 63_241 },
  ],
  checkpointReach: {
    firstScreen: "REACHED",
    firstSpell: "REACHED",
    secondStructure: "REACHED",
    abilityChoice: "REACHED",
    bossIntent: "REACHED",
    safeFailure: "NOT_REACHED",
    campRepair: "REACHED",
    spellbook: "REACHED",
  },
  replay: {
    replayIntent: "AGAIN_NOW",
    parentObservedReplayRequest: "OBSERVED",
    actualReplayAction: false,
    runCount: 1,
    consistencyWarning: "Human replay intent recorded, but no replay_selected event.",
  },
  notConcluded: [
    "learning effectiveness",
    "retention",
    "generalized usability",
    "remaining-8-character readiness",
    "full Ink Forest readiness",
    "production-art readiness",
  ],
} as const;
