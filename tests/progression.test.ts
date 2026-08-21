import { readFileSync } from "node:fs";
import {
  applyStageCompletion,
  getGrowthSignalText,
  getParentSummary,
  getRecommendedPractice,
  getStickerWallItems,
  getStageReadinessStatus,
  getTotalStars,
  isStageUnlocked
} from "../src/game/domain/progression/progression";
import type { StageDefinition } from "../src/game/domain/content/types";
import type { SaveData } from "../src/game/save/saveStore";

function createSave(): SaveData {
  return {
    stages: {},
    totalHintsUsed: 0,
    totalMistakes: 0,
    wrongByType: {},
    achievements: {},
    earnedStickerIds: [],
    dailyProgress: {},
    skills: {},
    reviewSchedule: {},
    accessibility: {
      largeText: false,
      reducedMotion: false,
      highContrast: false,
      leftHanded: false
    },
    currentStreak: 0,
    lastPlayDate: null
  };
}

const stages: StageDefinition[] = [
  {
    id: "stage-1",
    title: "第一组",
    difficulty: "sprout",
    unlockStars: 0,
    rewardStickerId: "stage/test-1",
    rewardStickerLabel: "测试贴纸",
    description: "测试",
    encounters: []
  },
  {
    id: "stage-2",
    title: "第二组",
    difficulty: "sprout",
    unlockStars: 2,
    masteryGate: {
      minStars: 2,
      requiredSkillTags: ["number-bonds"],
      minIndependentWins: 1,
      maxRecentHintLevel: 0,
      maxRecentMistakes: 0
    },
    rewardStickerId: "stage/test-2",
    rewardStickerLabel: "进阶贴纸",
    description: "测试",
    encounters: []
  }
];

describe("progression", () => {
  it("keeps best stars while recording attempts and daily progress", () => {
    const save = createSave();

    const first = applyStageCompletion(save, "stage-1", 2, 1, 1, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: { undershoot: 1 },
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "hinted",
          maxHintLevel: 1,
          mistakes: 0,
          wrongTypes: {}
        }
      ],
      stageRewardStickerId: "stage/test",
      stageRewardStickerLabel: "测试贴纸"
    });
    const second = applyStageCompletion(first.save, "stage-1", 1, 2, 2, "precision_hit", {
      completedAt: new Date("2026-06-06T11:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: { overshoot: 2 }
    });

    expect(second.save.stages["stage-1"].stars).toBe(2);
    expect(second.save.stages["stage-1"].completions).toBe(2);
    expect(second.save.dailyProgress["2026-06-06"].completedStages).toBe(2);
    expect(second.save.wrongByType).toEqual({ undershoot: 1, overshoot: 2 });
    expect(second.save.skills["number-bonds"]?.hintedCompletions).toBe(1);
    expect(first.newStickerLabels).toContain("测试贴纸");
  });

  it("preserves legacy streak bytes without extending or awarding them", () => {
    const save = createSave();
    save.currentStreak = 7;
    save.lastPlayDate = "2026-06-05";
    save.achievements.three_day_streak = {
      id: "three_day_streak",
      earnedAt: "2026-06-05T10:00:00.000Z"
    };
    const result = applyStageCompletion(save, "stage-1", 3, 0, 0, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: {}
    });
    expect(result.save.currentStreak).toBe(7);
    expect(result.save.lastPlayDate).toBe("2026-06-05");
    expect(result.save.achievements.three_day_streak?.earnedAt).toBe("2026-06-05T10:00:00.000Z");
    expect(result.newAchievementIds).not.toContain("three_day_streak");
    expect(getStickerWallItems(result.save, stages).some((item) => item.id === "achievement/three_day_streak")).toBe(false);
  });

  it("does not expose an encounter streak message in the child battle scene", () => {
    const battleSource = readFileSync("src/game/scenes/BattleScene.ts", "utf8");

    expect(battleSource).not.toContain("cleanHitStreak");
    expect(battleSource).not.toContain("连续完成 3 次");
  });

  it("records independent skill mastery and unlocks stages from mastery gates", () => {
    const save = createSave();

    const result = applyStageCompletion(save, "stage-1", 3, 0, 0, "combo_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: true,
      usedSubtraction: true,
      wrongTypes: {},
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "independent",
          maxHintLevel: 0,
          mistakes: 0,
          wrongTypes: {}
        }
      ]
    });

    expect(result.newAchievementIds).toEqual([
      "first_patrol",
      "perfect_hit",
      "brave_no_hint",
      "combo_builder",
      "subtraction_helper"
    ]);
    expect(getTotalStars(result.save)).toBe(3);
    expect(isStageUnlocked(stages[1], result.save)).toBe(true);
  });

  it("keeps all stages playable while surfacing readiness practice advice", () => {
    const save = createSave();
    const result = applyStageCompletion(save, "stage-1", 3, 1, 0, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: {},
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "hinted",
          maxHintLevel: 1,
          mistakes: 0,
          wrongTypes: {}
        }
      ]
    });

    expect(getTotalStars(result.save)).toBe(3);
    expect(isStageUnlocked(stages[1], result.save)).toBe(true);
    expect(getStageReadinessStatus(stages[1], result.save).ready).toBe(false);
    expect(getStageReadinessStatus(stages[1], result.save).reason).toContain("建议复练");
    expect(getRecommendedPractice(result.save, stages)?.reason).toContain("复练");
  });

  it("summarizes parent-facing practice signals", () => {
    const save = createSave();
    const result = applyStageCompletion(save, "stage-1", 2, 1, 2, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: { overshoot: 2 },
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "recovered",
          maxHintLevel: 2,
          mistakes: 2,
          wrongTypes: { overshoot: 2 }
        }
      ]
    });

    const summary = getParentSummary(result.save, stages, new Date("2026-06-06T18:00:00"));

    expect(summary.todayCompleted).toBe(1);
    expect(summary.focusText).toContain("比目标大");
    expect(summary.skillStatusText).toContain("需要帮助");
    expect(summary.supportText).toContain("使用过提示");
    expect(summary.reviewText).toContain("自由选择");
    expect(summary.nextSuggestion).toContain("复练");
    expect(summary.recommendationReasonText).toContain("逐步减少支架");
  });

  it("schedules 1/3/7 day reviews after independent practice", () => {
    const save = createSave();
    const first = applyStageCompletion(save, "stage-1", 3, 0, 0, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: {},
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "independent",
          maxHintLevel: 0,
          mistakes: 0,
          wrongTypes: {}
        }
      ]
    });
    const firstReviewDate = first.save.reviewSchedule["number-bonds"]?.nextReviewDate;
    const firstRecommendation = getRecommendedPractice(first.save, stages, new Date("2026-06-07T09:00:00"));
    const second = applyStageCompletion(first.save, "stage-1", 3, 0, 0, "precision_hit", {
      completedAt: new Date("2026-06-07T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: {},
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "independent",
          maxHintLevel: 0,
          mistakes: 0,
          wrongTypes: {}
        }
      ]
    });

    expect(firstReviewDate).toBe("2026-06-07");
    expect(second.save.reviewSchedule["number-bonds"]?.nextReviewDate).toBe("2026-06-10");
    expect(firstRecommendation?.skillTag).toBe("number-bonds");
  });

  it("generates child-facing growth signals from mastery evidence", () => {
    const save = createSave();
    const result = applyStageCompletion(save, "stage-1", 3, 0, 0, "precision_hit", {
      completedAt: new Date("2026-06-06T10:00:00"),
      usedCombo: false,
      usedSubtraction: false,
      wrongTypes: {},
      skillResults: [
        {
          skillTag: "number-bonds",
          outcome: "independent",
          maxHintLevel: 0,
          mistakes: 0,
          wrongTypes: {}
        }
      ]
    });

    expect(getGrowthSignalText(result.save, stages[1], 0, 0)).toContain("独立完成");
  });

  it("builds a low-pressure reward wall from stickers and achievement evidence", () => {
    const save = createSave();
    save.earnedStickerIds = ["stage/test-1"];
    save.achievements.first_patrol = {
      id: "first_patrol",
      earnedAt: "2026-06-06T10:00:00.000Z"
    };

    const items = getStickerWallItems(save, stages);
    const stageSticker = items.find((item) => item.id === "stage/test-1");
    const unearnedStageSticker = items.find((item) => item.id === "stage/test-2");
    const earnedBadge = items.find((item) => item.id === "achievement/first_patrol");

    expect(items.some((item) => item.kind === "stage-sticker")).toBe(true);
    expect(items.some((item) => item.kind === "achievement-badge")).toBe(true);
    expect(stageSticker?.earned).toBe(true);
    expect(stageSticker?.evidenceText).toContain("完成");
    expect(unearnedStageSticker?.earned).toBe(false);
    expect(unearnedStageSticker?.evidenceText).toContain("尝试");
    expect(unearnedStageSticker?.evidenceText).not.toContain("未解锁");
    expect(earnedBadge?.evidenceText).toContain("完成第一组");
  });
});
