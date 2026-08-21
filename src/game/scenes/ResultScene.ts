import Phaser from "phaser";
import { getGrowthSignalText, getStageReadinessStatus } from "../domain/progression/progression";
import { getStagesFromCache } from "../content/loadContent";
import { loadSave } from "../save/saveStore";
import { addButton, addPanel } from "./ui";
import { sceneKeys } from "./sceneKeys";

interface ResultSceneData {
  stageId: string;
  stars: number;
  hintsUsed: number;
  mistakes: number;
  newAchievementIds?: string[];
  newStickerLabels?: string[];
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(sceneKeys.result);
  }

  create(data: ResultSceneData): void {
    const stages = getStagesFromCache(this.cache);
    const stageIndex = stages.findIndex((stage) => stage.id === data.stageId);
    const currentStage = stages[stageIndex] ?? stages[0];
    const nextStage = stages[stageIndex + 1] ?? stages[0];
    const save = loadSave();
    const nextReadiness = getStageReadinessStatus(nextStage, save);
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 560;
    const fontBoost = save.accessibility.largeText ? 2 : 0;
    const panelStroke = save.accessibility.highContrast ? 0x000000 : 0xc78a35;
    const panelWidth = Math.min(compact ? width - 28 : 500, width - 32);
    const panelHeight = compact ? Math.min(save.accessibility.largeText ? 500 : 460, height - 28) : Math.min(500, height - 36);
    const panelX = width / 2 - panelWidth / 2;
    const panelY = Math.max(24, height / 2 - panelHeight / 2);

    this.add.image(width / 2, height / 2, "riverMeadowBg").setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.2);
    this.add.rectangle(width / 2, height - 44, width, 88, 0x72cfa6, 0.22);

    addPanel(this, panelX, panelY, panelWidth, panelHeight, 0xfffdf6, panelStroke);

    const guardianScale = compact ? 0.1 : 0.14;
    this.add.image(width / 2, panelY + (compact ? 72 : 84), "targetGuardian").setScale(guardianScale);

    this.add
      .text(width / 2, panelY + (compact ? 126 : 154), "巡逻完成", {
        color: "#2363a7",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${(compact ? 30 : 38) + fontBoost}px`,
        fontStyle: "900"
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, panelY + (compact ? 164 : 200), currentStage.title, {
        color: "#6b3f15",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${(compact ? 18 : 22) + fontBoost}px`,
        fontStyle: "900"
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, panelY + (compact ? 212 : 252), "这组已经完成。可以继续探索，也可以再试一种方法。", {
        color: "#4d5b63",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${(compact ? 16 : 19) + fontBoost}px`,
        fontStyle: "800",
        align: "center",
        wordWrap: { width: panelWidth - 46, useAdvancedWrap: true }
      })
      .setOrigin(0.5);

    const growthText = getGrowthSignalText(save, currentStage, data.hintsUsed, data.mistakes);
    const rewardText = this.getRewardText(data);
    this.add
      .text(width / 2, panelY + panelHeight - (compact ? 152 : 176), growthText, {
        color: "#2363a7",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${(compact ? 14 : 16) + fontBoost}px`,
        fontStyle: "900",
        lineSpacing: 4,
        align: "center",
        wordWrap: {
          width: panelWidth - 32,
          useAdvancedWrap: true
        }
      })
      .setOrigin(0.5);

    if (rewardText) {
      this.add
        .text(width / 2, panelY + panelHeight - (compact ? 112 : 132), rewardText, {
          color: "#227a4f",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${(compact ? 14 : 16) + fontBoost}px`,
          fontStyle: "900",
          lineSpacing: 4,
          align: "center",
          wordWrap: {
            width: panelWidth - 32,
            useAdvancedWrap: true
          }
        })
        .setOrigin(0.5);
    }

    const buttonY = panelY + panelHeight - (compact ? 40 : 48);
    const buttonGap = compact ? 10 : 20;
    const buttonWidth = compact ? Math.min(132, (panelWidth - 46) / 2) : 142;
    addButton(this, width / 2 - buttonWidth / 2 - buttonGap / 2, buttonY, buttonWidth, 56, "回菜单", () => {
      this.scene.start(sceneKeys.menu);
    }, {
      fill: 0xe8f6ff,
      stroke: save.accessibility.highContrast ? 0x000000 : 0x2f78b8,
      fontSize: (compact ? 17 : 19) + fontBoost
    });
    const nextLabel = nextReadiness.ready ? "下一组" : "继续挑战";
    addButton(this, width / 2 + buttonWidth / 2 + buttonGap / 2, buttonY, buttonWidth, 56, nextLabel, () => {
      this.scene.start(sceneKeys.battle, {
        stageId: nextStage.id
      });
    }, {
      fill: 0xffcf6a,
      stroke: save.accessibility.highContrast ? 0x000000 : 0x9d5b00,
      fontSize: (compact ? 17 : 19) + fontBoost
    });

    if (!nextReadiness.ready) {
      this.add
        .text(width / 2, buttonY - (rewardText ? (compact ? 36 : 40) : (compact ? 44 : 50)), nextReadiness.reason, {
          color: "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${(compact ? 12 : 14) + fontBoost}px`,
          fontStyle: "800",
          align: "center",
          wordWrap: {
            width: panelWidth - 32,
            useAdvancedWrap: true
          }
        })
        .setOrigin(0.5);
    }
  }

  private getRewardText(data: ResultSceneData): string {
    const stickers = data.newStickerLabels ?? [];
    const achievements = data.newAchievementIds ?? [];

    if (stickers.length === 0 && achievements.length === 0) {
      return "";
    }

    if (stickers.length > 0 && achievements.length > 0) {
      return "新的场景贴纸和探索纪念已经放进贴纸墙。";
    }

    if (stickers.length > 0) {
      return `“${stickers.join("、")}”已经放进贴纸墙。`;
    }

    return "新的探索纪念已经放进贴纸墙。";
  }
}
