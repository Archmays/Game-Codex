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

export const ACTIVE_PROJECT_PHASE: ProjectPhaseId = "play-readiness";
export const NEXT_PROJECT_PHASE: ProjectPhaseId = "natural-use-observation";
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
    status: "pending",
    summary: "只在真实自然家庭使用证据出现后做小范围修订；当前不安排自动大型开发。",
  },
] as const;

export const PROJECT_PHASE_BY_ID: ReadonlyMap<ProjectPhaseId, ProjectPhaseRecord> = new Map(
  PROJECT_PHASES.map((phase) => [phase.id, phase]),
);

export const PROJECT_LIFECYCLE_TERMINAL_TRUTH = {
  completed: PROJECT_PHASES.filter((phase) => phase.status === "complete").map((phase) => phase.id),
  pending: PROJECT_PHASES.filter((phase) => phase.status === "pending").map((phase) => phase.id),
  naturalUseObservation: "PENDING_REAL_EVIDENCE",
  realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
  next: "Natural-use observation only when real family-use evidence exists.",
} as const;
