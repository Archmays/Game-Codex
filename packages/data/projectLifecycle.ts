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
  realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
  next: "Normal family use. New development only when real evidence or a reproducible defect exists.",
} as const;
