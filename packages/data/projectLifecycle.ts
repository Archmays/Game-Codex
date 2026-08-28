export type ProjectPhaseId =
  | "foundation"
  | "math-world"
  | "chinese-consolidation"
  | "english-v2"
  | "play-readiness"
  | "natural-use-observation";

export type ProjectPhaseStatus = "complete" | "active" | "pending";

export interface ProjectPhaseRecord {
  readonly id: ProjectPhaseId;
  readonly title: string;
  readonly status: ProjectPhaseStatus;
  readonly releaseTag?: string;
  readonly canonicalRoute?: string;
  readonly summary: string;
}

export interface AuthorizedDevelopmentCycleRecord {
  readonly id: "portfolio-evolution-01" | "gameplay-coherence-02";
  readonly title: string;
  readonly trigger: "EXPLICIT_USER_AUTHORIZATION";
  readonly status: "release-bound";
  readonly completionCondition: "RELEASE_TAG_TARGET";
  readonly startCommit: string;
  readonly releaseTag: string;
  readonly summary: string;
  readonly naturalUseObservationImpact: "ONGOING_NOT_CLOSED";
  readonly realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED";
}

export const ACTIVE_PROJECT_PHASE: ProjectPhaseId = "natural-use-observation";
export const NEXT_PROJECT_PHASE: ProjectPhaseId | null = null;
export const PRIMARY_WORLDS = ["chinese", "math", "english"] as const;

export const PROJECT_PHASES: readonly ProjectPhaseRecord[] = [
  {
    id: "foundation",
    title: "Foundation",
    status: "complete",
    summary: "Portfolio 真源、分级门禁、安全维护事务、CI 与 Pages 组合验证。",
  },
  {
    id: "math-world",
    title: "Math World",
    status: "complete",
    releaseTag: "math-world-v1.0.0",
    canonicalRoute: "?world=math-world",
    summary: "数感实验城与五个自由开放站点。",
  },
  {
    id: "chinese-consolidation",
    title: "Chinese Consolidation",
    status: "complete",
    releaseTag: "chinese-consolidation-v1.0.0",
    canonicalRoute: "?play=hanzi-magic-complete",
    summary: "墨迹森林、声韵试炼与字光配对完成收拢。",
  },
  {
    id: "english-v2",
    title: "English V2",
    status: "complete",
    releaseTag: "english-world-v2.0.0",
    canonicalRoute: "?world=english-world",
    summary: "词光岛五个区域、词光册、句子任务与 English Memory。",
  },
  {
    id: "play-readiness",
    title: "Play Readiness",
    status: "complete",
    releaseTag: "game-codex-play-ready-v1.0.0",
    canonicalRoute: "?world=my-game-world",
    summary: "首用、反馈、返回、存档保险箱、无障碍、性能与长期家庭使用准备。",
  },
  {
    id: "natural-use-observation",
    title: "Natural-use Observation",
    status: "active",
    releaseTag: "game-codex-observation-kit-v1.0.0",
    canonicalRoute: "?world=my-game-world&parent=observation",
    summary: "普通家庭使用已开始；Observation Kit 保持家长主动、本机最小化、默认零记录，只在自然出现的真实证据需要时使用。",
  },
] as const;

/**
 * Explicit bounded development cycles are recorded separately from the
 * long-running family-use operating mode. Completing one of these cycles does
 * not close Natural-use Observation and does not create an automatic next job.
 */
export const AUTHORIZED_DEVELOPMENT_CYCLES: readonly AuthorizedDevelopmentCycleRecord[] = [
  {
    id: "portfolio-evolution-01",
    title: "Portfolio Evolution",
    trigger: "EXPLICIT_USER_AUTHORIZATION",
    status: "release-bound",
    completionCondition: "RELEASE_TAG_TARGET",
    startCommit: "73ae9d6be140c9e8294781b9f8e6ed296590c438",
    releaseTag: "game-codex-portfolio-evolution-v1.0.0",
    summary: "组合真源分层、重复独立入口收敛、算式滑轨可见动作修复、兼容与发布验证。",
    naturalUseObservationImpact: "ONGOING_NOT_CLOSED",
    realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
  },
  {
    id: "gameplay-coherence-02",
    title: "World Coherence and Gameplay Lift",
    trigger: "EXPLICIT_USER_AUTHORIZATION",
    status: "release-bound",
    completionCondition: "RELEASE_TAG_TARGET",
    startCommit: "90eb3b242b38b1d7a8cd98c8e0cafce14a6984a0",
    releaseTag: "game-codex-gameplay-coherence-v1.0.1",
    summary: "三世界层级真值、Equation 数学世界归位、运行时归属/质量档/存档分层，以及五个数学站点的继续、焦点与游戏体验修复。",
    naturalUseObservationImpact: "ONGOING_NOT_CLOSED",
    realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
  },
] as const;

export const PROJECT_PHASE_BY_ID: ReadonlyMap<ProjectPhaseId, ProjectPhaseRecord> = new Map(
  PROJECT_PHASES.map((phase) => [phase.id, phase]),
);

export const PROJECT_LIFECYCLE_TERMINAL_TRUTH = {
  completed: PROJECT_PHASES.filter((phase) => phase.status === "complete").map((phase) => phase.id),
  active: PROJECT_PHASES.filter((phase) => phase.status === "active").map((phase) => phase.id),
  pending: PROJECT_PHASES.filter((phase) => phase.status === "pending").map((phase) => phase.id),
  naturalUseMode: "ACTIVE",
  naturalUseObservation: "ACTIVE",
  observationTooling: "READY",
  familyStableBaseline: "FROZEN",
  familyStableBaselineTag: "game-codex-family-stable-v1.0.0",
  familyStableBaselineCommit: "8b890ff14880bcb576dd1ced37e14e6e3df28af1",
  familyStableBaselineStatus: "FROZEN",
  realEvidencePatchCount: 2,
  interactionIntegrity: "HITTEST_AND_REACHABILITY_GUARD_ACTIVE",
  automaticLargeTask: "NONE",
  authorizedBoundedDevelopmentCycle: "gameplay-coherence-02",
  authorizedBoundedDevelopmentCycleStatus: "RELEASE_BOUND",
  realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
  next: "Normal family use. New development only when real evidence or a reproducible defect exists.",
} as const;
