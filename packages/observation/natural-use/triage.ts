export const NATURAL_USE_EVIDENCE_TRIAGE_RULES = {
  version: 1,
  mode: "FUTURE_ANALYSIS_GUARDRAIL_ONLY",
  automaticProductChange: false,
  technicalBlocker: {
    minimumParentObservations: 1,
    requiresMachineReproduction: true,
    result: "06B_PATCH_CANDIDATE_ONLY",
  },
  uxFriction: {
    minimumMatchingSurfaceAndFrictionObservations: 2,
    preferDistinctDates: true,
    requiresMachineReproductionOrExplanation: true,
    result: "06B_PATCH_CANDIDATE_ONLY",
  },
  learningOrContentRedesign: {
    oneOrTwoRecordsSufficient: false,
    requiresRepeatedRealEvidence: true,
    requiresDomainCorrectnessReview: true,
    requiresMachineReproductionOrAnalysis: true,
  },
  preferenceAndReplay: {
    descriptiveOnly: true,
    engagementTarget: false,
    prohibitedMechanics: ["push", "streak", "daily-login", "fomo"],
  },
  prohibitedConclusions: ["engagement-score", "fun-score", "learning-score", "mastery", "retention", "addiction-risk", "child-profile"],
} as const;
