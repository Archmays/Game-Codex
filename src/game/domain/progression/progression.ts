import { skillDefinitions, type SkillTag, type StageDefinition } from "../content/types";
import type { SaveData } from "../../save/saveStore";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  stickerLabel: string;
  evidenceText: string;
}

export interface StageCompletionMetadata {
  completedAt?: Date;
  usedCombo: boolean;
  usedSubtraction: boolean;
  wrongTypes: Record<string, number>;
  skillResults?: SkillCompletionRecord[];
  stageRewardStickerId?: string;
  stageRewardStickerLabel?: string;
}

export type SkillOutcome = "independent" | "hinted" | "recovered";

export interface SkillCompletionRecord {
  skillTag: SkillTag;
  outcome: SkillOutcome;
  maxHintLevel: number;
  mistakes: number;
  wrongTypes: Record<string, number>;
}

export interface CompletionProgressResult {
  save: SaveData;
  newAchievementIds: string[];
  newStickerLabels: string[];
}

export interface ParentSummary {
  completedStages: number;
  totalStages: number;
  totalStars: number;
  maxStars: number;
  todayCompleted: number;
  todayHints: number;
  todayMistakes: number;
  currentStreak: number;
  focusText: string;
  skillStatusText: string;
  supportText: string;
  reviewText: string;
  nextSuggestion: string;
  recommendationReasonText: string;
}

export interface StageUnlockStatus {
  unlocked: boolean;
  reason: string;
}

export interface StageReadinessStatus {
  ready: boolean;
  reason: string;
  weakSkillTags: SkillTag[];
  starShortfall: number;
}

export interface PracticeRecommendation {
  stageId: string;
  stageTitle: string;
  reason: string;
  skillTag?: SkillTag;
  skillLabel?: string;
}

export interface StickerWallItem {
  id: string;
  kind: "stage-sticker" | "achievement-badge";
  title: string;
  sourceLabel: string;
  evidenceText: string;
  earned: boolean;
  symbol: string;
  color: number;
}

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: "first_patrol",
    title: "第一次巡逻",
    description: "完成任意一组数学场景。",
    stickerLabel: "启程贴纸",
    evidenceText: "完成第一组短场景，开始记录数学练习。"
  },
  {
    id: "perfect_hit",
    title: "稳稳完成",
    description: "一组场景 0 失误完成。",
    stickerLabel: "稳稳贴纸",
    evidenceText: "0 失误完成一组，能稳定比较数量。"
  },
  {
    id: "brave_no_hint",
    title: "自己想出来",
    description: "不使用提示完成一组。",
    stickerLabel: "思考贴纸",
    evidenceText: "不用提示完成一组，独立找到下一步。"
  },
  {
    id: "combo_builder",
    title: "两步小队长",
    description: "完成包含两步计划的关卡组。",
    stickerLabel: "两步贴纸",
    evidenceText: "完成两步计划，能先靠近再完成。"
  },
  {
    id: "subtraction_helper",
    title: "减法帮手",
    description: "在场景中用减法完成数量调整。",
    stickerLabel: "减法贴纸",
    evidenceText: "用减法完成数量调整，能判断多了多少。"
  },
  {
    id: "map_explorer",
    title: "地图探险家",
    description: "自由探索 5 组数学场景。",
    stickerLabel: "地图贴纸",
    evidenceText: "自由探索 5 组，尝试不同数学策略。"
  }
];

const achievementsById = Object.fromEntries(achievementDefinitions.map((achievement) => [achievement.id, achievement]));
const skillLabels = Object.fromEntries(skillDefinitions.map((skill) => [skill.id, skill.label])) as Record<SkillTag, string>;

export function applyStageCompletion(
  save: SaveData,
  stageId: string,
  stars: number,
  hintsUsed: number,
  mistakes: number,
  fallbackWrongType: string,
  metadata: StageCompletionMetadata
): CompletionProgressResult {
  const completedAt = metadata.completedAt ?? new Date();
  const completedDate = formatLocalDate(completedAt);
  const previous = save.stages[stageId];
  const previousBestStars = previous?.stars ?? 0;

  save.stages[stageId] = {
    stars: Math.max(stars, previousBestStars),
    completedAt: completedAt.toISOString(),
    hintsUsed,
    mistakes,
    completions: (previous?.completions ?? 0) + 1,
    bestHintsUsed: Math.min(hintsUsed, previous?.bestHintsUsed ?? hintsUsed),
    bestMistakes: Math.min(mistakes, previous?.bestMistakes ?? mistakes)
  };

  save.totalHintsUsed += hintsUsed;
  save.totalMistakes += mistakes;

  const wrongTypes = Object.keys(metadata.wrongTypes).length > 0 ? metadata.wrongTypes : { [fallbackWrongType]: mistakes };
  for (const [type, count] of Object.entries(wrongTypes)) {
    if (count > 0) {
      save.wrongByType[type] = (save.wrongByType[type] ?? 0) + count;
    }
  }

  recordSkillResults(save, metadata.skillResults ?? [], completedAt);

  const today = save.dailyProgress[completedDate] ?? {
    date: completedDate,
    completedStages: 0,
    hintsUsed: 0,
    mistakes: 0,
    starsEarned: 0
  };
  today.completedStages += 1;
  today.hintsUsed += hintsUsed;
  today.mistakes += mistakes;
  today.starsEarned += Math.max(0, stars - previousBestStars);
  save.dailyProgress[completedDate] = today;

  const newStickerLabels: string[] = [];
  if (metadata.stageRewardStickerId && !save.earnedStickerIds.includes(metadata.stageRewardStickerId)) {
    save.earnedStickerIds.push(metadata.stageRewardStickerId);
    if (metadata.stageRewardStickerLabel) {
      newStickerLabels.push(metadata.stageRewardStickerLabel);
    }
  }

  const newAchievementIds = evaluateNewAchievements(save, {
    stars,
    hintsUsed,
    mistakes,
    usedCombo: metadata.usedCombo,
    usedSubtraction: metadata.usedSubtraction
  });

  for (const achievementId of newAchievementIds) {
    const definition = achievementsById[achievementId];
    if (!definition) {
      continue;
    }

    save.achievements[achievementId] = {
      id: achievementId,
      earnedAt: completedAt.toISOString()
    };

    const stickerId = `achievement/${achievementId}`;
    if (!save.earnedStickerIds.includes(stickerId)) {
      save.earnedStickerIds.push(stickerId);
      newStickerLabels.push(definition.stickerLabel);
    }
  }

  return {
    save,
    newAchievementIds,
    newStickerLabels
  };
}

export function getTotalStars(save: SaveData): number {
  return Object.values(save.stages).reduce((total, stage) => total + stage.stars, 0);
}

export function getMaxStars(stages: StageDefinition[]): number {
  return stages.length * 3;
}

export function isStageUnlocked(stage: StageDefinition, save: SaveData): boolean {
  void stage;
  void save;
  return true;
}

export function getStageUnlockStatus(stage: StageDefinition, save: SaveData): StageUnlockStatus {
  return {
    unlocked: true,
    reason: getStageReadinessStatus(stage, save).reason
  };
}

export function getStageReadinessStatus(stage: StageDefinition, save: SaveData): StageReadinessStatus {
  const gate = stage.masteryGate;
  const minStars = gate?.minStars ?? stage.unlockStars ?? 0;
  const totalStars = getTotalStars(save);

  if (totalStars < minStars) {
    const suggestedSkill = gate?.requiredSkillTags?.[0];
    const suggestion = suggestedSkill ? `建议复练：${getSkillLabel(suggestedSkill)}。` : "可以任选一组。";
    return {
      ready: false,
      reason: `可直接开始；${suggestion}`,
      weakSkillTags: [],
      starShortfall: minStars - totalStars
    };
  }

  if (!gate?.requiredSkillTags?.length) {
    return {
      ready: true,
      reason: "可直接开始。",
      weakSkillTags: [],
      starShortfall: 0
    };
  }

  const weakSkills = gate.requiredSkillTags.filter((skillTag) => !doesSkillMeetGate(save, skillTag, gate));
  if (weakSkills.length > 0) {
    return {
      ready: false,
      reason: `可直接开始；建议复练：${weakSkills.map(getSkillLabel).join("、")}。`,
      weakSkillTags: weakSkills,
      starShortfall: 0
    };
  }

  return {
    ready: true,
    reason: "可直接开始。",
    weakSkillTags: [],
    starShortfall: 0
  };
}

export function getEarnedAchievementDefinitions(save: SaveData): AchievementDefinition[] {
  return achievementDefinitions.filter((achievement) => Boolean(save.achievements[achievement.id]));
}

export function getStickerWallItems(save: SaveData, stages: StageDefinition[]): StickerWallItem[] {
  const stageSymbols = ["苹", "糕", "船", "书", "篮"];
  const stageColors = [0xf8b7c7, 0xf2c178, 0x9bd7f4, 0xd8b4f8, 0x9ee6b8];
  const achievementSymbols = ["启", "准", "思", "连", "减", "星", "图", "持"];
  const achievementColors = [0xffcf6a, 0x8bd39e, 0x9bd7f4, 0xd8b4f8, 0xf2c178, 0xffe08a, 0x9ee6b8, 0xf8b7c7];

  const stageItems = stages
    .filter((stage) => Boolean(stage.rewardStickerId))
    .map((stage, index) => {
      const earned = Boolean(stage.rewardStickerId && save.earnedStickerIds.includes(stage.rewardStickerId));
      return {
        id: stage.rewardStickerId ?? stage.id,
        kind: "stage-sticker" as const,
        title: stage.rewardStickerLabel ?? stage.title,
        sourceLabel: stage.title,
        evidenceText: earned
          ? `完成“${stage.title}”，记录${stage.skillFocus ?? "一组数学练习"}。`
          : `尝试“${stage.title}”，收集一条练习证据。`,
        earned,
        symbol: stageSymbols[index % stageSymbols.length],
        color: stageColors[index % stageColors.length]
      };
    });

  const achievementItems = achievementDefinitions.map((achievement, index) => {
    const earned = Boolean(save.achievements[achievement.id]);
    return {
      id: `achievement/${achievement.id}`,
      kind: "achievement-badge" as const,
      title: achievement.stickerLabel,
      sourceLabel: achievement.title,
      evidenceText: earned ? achievement.evidenceText : achievement.description,
      earned,
      symbol: achievementSymbols[index % achievementSymbols.length],
      color: achievementColors[index % achievementColors.length]
    };
  });

  return [...stageItems, ...achievementItems];
}

export function getParentSummary(save: SaveData, stages: StageDefinition[], now = new Date()): ParentSummary {
  const today = save.dailyProgress[formatLocalDate(now)] ?? {
    date: formatLocalDate(now),
    completedStages: 0,
    hintsUsed: 0,
    mistakes: 0,
    starsEarned: 0
  };
  const completedStages = Object.keys(save.stages).length;
  const totalStars = getTotalStars(save);
  const weakestType = getMostCommonWrongType(save.wrongByType);
  const recommendation = getRecommendedPractice(save, stages, now);

  return {
    completedStages,
    totalStages: stages.length,
    totalStars,
    maxStars: getMaxStars(stages),
    todayCompleted: today.completedStages,
    todayHints: today.hintsUsed,
    todayMistakes: today.mistakes,
    currentStreak: save.currentStreak,
    focusText: weakestType ? getWrongTypeLabel(weakestType) : "目前没有明显易错点。",
    skillStatusText: getSkillStatusText(save),
    supportText: getSupportText(today),
    reviewText: getDueReviewText(save, now),
    nextSuggestion: recommendation?.reason ?? getNextSuggestion(save, stages),
    recommendationReasonText: getRecommendationReasonText(save, recommendation)
  };
}

export function getAchievementTitle(id: string): string {
  return achievementsById[id]?.title ?? id;
}

export function getSkillLabel(skillTag: SkillTag): string {
  return skillLabels[skillTag] ?? skillTag;
}

export function getSkillMasteryStatus(save: SaveData, skillTag: SkillTag): "new" | "stable" | "learning" | "needs_help" {
  const progress = save.skills[skillTag];
  if (!progress || progress.attempts === 0) {
    return "new";
  }

  const latest = progress.recentAttempts.at(-1);
  if (latest?.outcome === "independent" && latest.maxHintLevel === 0 && latest.mistakes === 0) {
    return "stable";
  }

  if (latest?.outcome === "recovered") {
    return progress.independentCompletions > 0 ? "learning" : "needs_help";
  }

  return "learning";
}

export function getRecommendedPractice(
  save: SaveData,
  stages: StageDefinition[],
  now = new Date()
): PracticeRecommendation | null {
  const dueSkill = getDueReviewSkillTags(save, now)[0];
  if (dueSkill) {
    return (
      buildPracticeRecommendation(stages, dueSkill, `今日建议复练：${getSkillLabel(dueSkill)}。`) ?? {
        stageId: stages[0]?.id ?? "",
        stageTitle: stages[0]?.title ?? "任选一组",
        reason: `今日建议复练：${getSkillLabel(dueSkill)}。`,
        skillTag: dueSkill,
        skillLabel: getSkillLabel(dueSkill)
      }
    );
  }

  const needsHelpSkill = skillDefinitions
    .map((skill) => skill.id)
    .find((skillTag) => getSkillMasteryStatus(save, skillTag) === "needs_help");
  if (needsHelpSkill) {
    const recommendation = buildPracticeRecommendation(stages, needsHelpSkill, `建议复练：${getSkillLabel(needsHelpSkill)}。`);
    if (recommendation) {
      return recommendation;
    }
  }

  const needsReadinessStage = stages.find((stage) => !getStageReadinessStatus(stage, save).ready);
  const weakSkill = needsReadinessStage ? getStageReadinessStatus(needsReadinessStage, save).weakSkillTags[0] : undefined;
  if (needsReadinessStage && weakSkill) {
    return (
      buildPracticeRecommendation(stages, weakSkill, `挑战“${needsReadinessStage.title}”前，建议复练：${getSkillLabel(weakSkill)}。`) ?? {
        stageId: needsReadinessStage.id,
        stageTitle: needsReadinessStage.title,
        reason: `挑战“${needsReadinessStage.title}”前，建议复练：${getSkillLabel(weakSkill)}。`,
        skillTag: weakSkill,
        skillLabel: getSkillLabel(weakSkill)
      }
    );
  }

  const lowStarStage = stages.find((stage) => {
    const stars = save.stages[stage.id]?.stars ?? 0;
    return stars > 0 && stars < 3;
  });
  if (lowStarStage) {
    return {
      stageId: lowStarStage.id,
      stageTitle: lowStarStage.title,
      reason: `可以复练“${lowStarStage.title}”，争取更稳定。`
    };
  }

  const unfinishedStage = stages.find((stage) => !save.stages[stage.id]);
  if (unfinishedStage) {
    return {
      stageId: unfinishedStage.id,
      stageTitle: unfinishedStage.title,
      reason: `可以挑战“${unfinishedStage.title}”。`
    };
  }

  return null;
}

export function getGrowthSignalText(save: SaveData, stage: StageDefinition, hintsUsed: number, mistakes: number): string {
  const skillTags = getStageSkillTags(stage);
  const stableSkill = skillTags.find((skillTag) => getSkillMasteryStatus(save, skillTag) === "stable");
  const needsHelpSkill = skillTags.find((skillTag) => getSkillMasteryStatus(save, skillTag) === "needs_help");

  if (hintsUsed === 0 && mistakes === 0) {
    return stableSkill ? `独立完成，${getSkillLabel(stableSkill)}已稳定。` : "独立完成，这次没有用提示。";
  }

  if (hintsUsed === 0) {
    return "这次没有用提示，继续保持观察差距的策略。";
  }

  if (needsHelpSkill) {
    return `${getSkillLabel(needsHelpSkill)}还在练，复练一小关会更稳。`;
  }

  if (stableSkill) {
    return `${getSkillLabel(stableSkill)}正在变稳定，提示会帮助你找到下一步。`;
  }

  return "完成了一组练习，下一次可以试着少用一次提示。";
}

function evaluateNewAchievements(
  save: SaveData,
  context: {
    stars: number;
    hintsUsed: number;
    mistakes: number;
    usedCombo: boolean;
    usedSubtraction: boolean;
  }
): string[] {
  const completedStages = Object.keys(save.stages).length;
  const checks: Array<[string, boolean]> = [
    ["first_patrol", completedStages >= 1],
    ["perfect_hit", context.mistakes === 0],
    ["brave_no_hint", context.hintsUsed === 0],
    ["combo_builder", context.usedCombo],
    ["subtraction_helper", context.usedSubtraction],
    ["map_explorer", completedStages >= 5]
  ];

  return checks.filter(([id, earned]) => earned && !save.achievements[id]).map(([id]) => id);
}

function recordSkillResults(save: SaveData, records: SkillCompletionRecord[], completedAt: Date): void {
  for (const record of records) {
    const previous = save.skills[record.skillTag] ?? {
      tag: record.skillTag,
      attempts: 0,
      independentCompletions: 0,
      hintedCompletions: 0,
      recoveredCompletions: 0,
      lastOutcome: null,
      lastHintLevel: 0,
      lastMistakes: 0,
      lastWrongType: null,
      updatedAt: completedAt.toISOString(),
      recentAttempts: []
    };
    const wrongType = getMostCommonWrongType(record.wrongTypes);

    previous.attempts += 1;
    previous.independentCompletions += record.outcome === "independent" ? 1 : 0;
    previous.hintedCompletions += record.outcome === "hinted" ? 1 : 0;
    previous.recoveredCompletions += record.outcome === "recovered" ? 1 : 0;
    previous.lastOutcome = record.outcome;
    previous.lastHintLevel = record.maxHintLevel;
    previous.lastMistakes = record.mistakes;
    previous.lastWrongType = wrongType;
    previous.updatedAt = completedAt.toISOString();
    previous.recentAttempts = [
      ...previous.recentAttempts,
      {
        outcome: record.outcome,
        maxHintLevel: record.maxHintLevel,
        mistakes: record.mistakes,
        wrongType,
        completedAt: completedAt.toISOString()
      }
    ].slice(-5);

    save.skills[record.skillTag] = previous;
    scheduleSkillReview(save, record, completedAt);
  }
}

function scheduleSkillReview(save: SaveData, record: SkillCompletionRecord, completedAt: Date): void {
  const previous = save.reviewSchedule[record.skillTag];
  const isIndependent = record.outcome === "independent" && record.maxHintLevel === 0 && record.mistakes === 0;
  const nextStepIndex = isIndependent ? Math.min((previous?.stepIndex ?? -1) + 1, 2) : 0;
  const intervalDays = [1, 3, 7][nextStepIndex];

  save.reviewSchedule[record.skillTag] = {
    tag: record.skillTag,
    nextReviewDate: addDays(completedAt, intervalDays),
    stepIndex: nextStepIndex,
    dueCount: previous?.dueCount ?? 0
  };
}

function getDueReviewSkillTags(save: SaveData, now: Date): SkillTag[] {
  const today = formatLocalDate(now);
  return Object.values(save.reviewSchedule)
    .filter((review) => Boolean(review) && review.nextReviewDate <= today)
    .map((review) => review.tag);
}

function getDueReviewText(save: SaveData, now: Date): string {
  const dueSkills = getDueReviewSkillTags(save, now);

  if (dueSkills.length === 0) {
    return "今日没有必须复练的技能，可以自由选择一组。";
  }

  return `今日建议复练：${dueSkills.slice(0, 2).map(getSkillLabel).join("、")}。`;
}

function buildPracticeRecommendation(
  stages: StageDefinition[],
  skillTag: SkillTag,
  reason: string
): PracticeRecommendation | null {
  const stage = stages.find((candidate) => getStageSkillTags(candidate).includes(skillTag));

  if (!stage) {
    return null;
  }

  return {
    stageId: stage.id,
    stageTitle: stage.title,
    reason,
    skillTag,
    skillLabel: getSkillLabel(skillTag)
  };
}

function getStageSkillTags(stage: StageDefinition): SkillTag[] {
  return [...new Set(stage.encounters.flatMap((encounter) => encounter.skillTags ?? []))];
}

function doesSkillMeetGate(
  save: SaveData,
  skillTag: SkillTag,
  gate: NonNullable<StageDefinition["masteryGate"]>
): boolean {
  const progress = save.skills[skillTag];
  const latest = progress?.recentAttempts.at(-1);

  if (!progress || !latest) {
    return false;
  }

  if (progress.independentCompletions < (gate.minIndependentWins ?? 1)) {
    return false;
  }

  if (gate.maxRecentHintLevel !== undefined && latest.maxHintLevel > gate.maxRecentHintLevel) {
    return false;
  }

  if (gate.maxRecentMistakes !== undefined && latest.mistakes > gate.maxRecentMistakes) {
    return false;
  }

  return latest.outcome === "independent" || latest.outcome === "hinted";
}

function getSkillStatusText(save: SaveData): string {
  const practicedSkills = skillDefinitions
    .map((skill) => ({
      label: skill.label,
      status: getSkillMasteryStatus(save, skill.id)
    }))
    .filter((skill) => skill.status !== "new");

  if (practicedSkills.length === 0) {
    return "还没有技能掌握记录。";
  }

  const stable = practicedSkills.filter((skill) => skill.status === "stable").map((skill) => skill.label);
  const needsHelp = practicedSkills.filter((skill) => skill.status === "needs_help").map((skill) => skill.label);
  const learning = practicedSkills.filter((skill) => skill.status === "learning").map((skill) => skill.label);

  if (needsHelp.length > 0) {
    return `${needsHelp[0]}需要帮助；${stable.length > 0 ? `${stable[0]}已稳定。` : "建议先复练一小关。"}`;
  }

  if (stable.length > 0) {
    return `${stable.slice(0, 2).join("、")}已稳定${learning.length > 0 ? `；${learning[0]}正在学习。` : "。"} `;
  }

  return `${learning.slice(0, 2).join("、")}正在学习。`;
}

function getSupportText(today: SaveData["dailyProgress"][string]): string {
  if (today.completedStages === 0) {
    return "今天还没有练习记录。";
  }

  if (today.hintsUsed === 0 && today.mistakes === 0) {
    return "今天能独立完成，可以继续保留观察和试验的空间。";
  }

  if (today.hintsUsed >= today.completedStages) {
    return "今天使用过提示，下一次可以先给轻提示，再等一等。";
  }

  if (today.mistakes > 0) {
    return "今天调整过一些步骤，可以用同类场景再比较一种方法。";
  }

  return "今天练习较平稳，可以自由选择下一组。";
}

function getRecommendationReasonText(save: SaveData, recommendation: PracticeRecommendation | null): string {
  if (!recommendation) {
    return "没有固定路线，孩子可以自由选择任一环节。";
  }

  if (!recommendation.skillTag || !recommendation.skillLabel) {
    return "原因：这组已经玩过，复练可以让策略更稳定。";
  }

  const status = getSkillMasteryStatus(save, recommendation.skillTag);
  if (status === "needs_help") {
    return `原因：${recommendation.skillLabel}最近需要较多帮助，复练可逐步减少支架。`;
  }

  if (status === "stable") {
    return `原因：${recommendation.skillLabel}已稳定，间隔复练能帮助保持。`;
  }

  return `原因：${recommendation.skillLabel}是后续题常用策略，复练能让步骤更清楚。`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

function getMostCommonWrongType(wrongByType: Record<string, number>): string | null {
  let bestType: string | null = null;
  let bestCount = 0;

  for (const [type, count] of Object.entries(wrongByType)) {
    if (count > bestCount) {
      bestType = type;
      bestCount = count;
    }
  }

  return bestType;
}

function getWrongTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    overshoot: "容易算得比目标大，建议多练“差多少”。",
    undershoot: "容易算得比目标小，建议多练补数。",
    combo_hit: "两步计划最近需要再看看，可以比较“先靠近、再完成”的方法。",
    precision_hit: "一步调整最近需要再看看，可以从具体数量开始比较。"
  };

  return labels[type] ?? `需要复练：${type}`;
}

function getNextSuggestion(save: SaveData, stages: StageDefinition[]): string {
  const recommendation = getRecommendedPractice(save, stages);
  if (recommendation) {
    return recommendation.reason;
  }

  const lowStarStage = stages.find((stage) => (save.stages[stage.id]?.stars ?? 0) > 0 && (save.stages[stage.id]?.stars ?? 0) < 3);
  if (lowStarStage) {
    return `可以再看看“${lowStarStage.title}”，尝试另一种方法。`;
  }

  return "今天可以任选一组短场景保持手感。";
}
