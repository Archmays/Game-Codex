import Phaser from "phaser";
import {
  getParentSummary,
  getRecommendedPractice,
  getStickerWallItems,
  getStageReadinessStatus
} from "../domain/progression/progression";
import { getStagesFromCache } from "../content/loadContent";
import { loadSave, resetSave, updateAccessibilitySettings } from "../save/saveStore";
import { addButton, addPanel } from "./ui";
import { sceneKeys } from "./sceneKeys";

type MenuView = "map" | "rewards" | "parent" | "settings";

const stageAccents = [0xf8b7c7, 0xf2c178, 0x9bd7f4, 0xd8b4f8, 0x9ee6b8];
const stageStrokes = [0x9f4360, 0x8a4f14, 0x275a8a, 0x5f4285, 0x227a4f];

export class MenuScene extends Phaser.Scene {
  private view: MenuView = "map";
  private resetConfirmationPending = false;

  constructor() {
    super(sceneKeys.menu);
  }

  create(): void {
    this.render();
    this.scale.on("resize", this.render, this);
    this.input.keyboard?.on("keydown-ESC", this.cancelReset, this);
  }

  shutdown(): void {
    this.scale.off("resize", this.render, this);
    this.input.keyboard?.off("keydown-ESC", this.cancelReset, this);
  }

  private render(): void {
    this.children.removeAll();

    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 560;
    const stages = getStagesFromCache(this.cache);
    const save = loadSave();

    this.drawBackground(width, height, compact);
    this.drawTitle(width, compact);
    this.drawTabs(width, compact, save);

    if (this.view === "map") {
      this.drawMap(width, height, compact, stages, save);
    } else if (this.view === "rewards") {
      this.drawRewards(width, height, compact, stages, save);
    } else if (this.view === "parent") {
      this.drawParentSummary(width, height, compact, stages, save);
    } else {
      this.drawSettings(width, height, compact, save);
    }

  }

  private drawMap(
    width: number,
    height: number,
    compact: boolean,
    stages: ReturnType<typeof getStagesFromCache>,
    save: ReturnType<typeof loadSave>
  ): void {
    const statsText = "所有场景都可以自由进入；想从哪里开始都可以。";

    this.add
      .text(width / 2, compact ? 138 : 150, statsText, {
        color: "#25313b",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "13px" : "16px",
        fontStyle: "900",
        align: "center",
        wordWrap: {
          width: width - 30,
          useAdvancedWrap: true
        }
      })
      .setOrigin(0.5);

    const columns = compact ? 1 : 2;
    const gap = compact ? 8 : 12;
    const top = compact ? 164 : 176;
    const bottom = compact ? 60 : 66;
    const rows = Math.ceil(stages.length / columns);
    const cardWidth = compact ? Math.min(width - 28, 420) : Math.min((width - 52) / 2, 430);
    const availableHeight = Math.max(230, height - top - bottom);
    const cardHeight = Math.min(compact ? 58 : 78, Math.max(compact ? 50 : 68, (availableHeight - (rows - 1) * gap) / rows));
    const gridWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = width / 2 - gridWidth / 2 + cardWidth / 2;

    stages.forEach((stage, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = top + row * (cardHeight + gap) + cardHeight / 2;
      const visited = Boolean(save.stages[stage.id]);
      const readiness = getStageReadinessStatus(stage, save);
      const accent = stageAccents[index % stageAccents.length];
      const stroke = save.accessibility.highContrast ? 0x25313b : stageStrokes[index % stageStrokes.length];

      addPanel(this, x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 0xfffdf6, stroke);

      const markerRadius = compact ? 15 : 19;
      const marker = this.add.graphics();
      marker.fillStyle(accent, 1);
      marker.lineStyle(3, stroke, 1);
      marker.fillCircle(x - cardWidth / 2 + (compact ? 24 : 30), y, markerRadius);
      marker.strokeCircle(x - cardWidth / 2 + (compact ? 24 : 30), y, markerRadius);
      this.add
        .text(x - cardWidth / 2 + (compact ? 24 : 30), y, `${index + 1}`, {
          color: "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "15px" : "19px",
          fontStyle: "900"
        })
        .setOrigin(0.5);

      const textX = x - cardWidth / 2 + (compact ? 48 : 58);
      this.add
        .text(textX, y - (compact ? 13 : 20), stage.title, {
          color: "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 15 : 19, save)}px`,
          fontStyle: "900"
        })
        .setOrigin(0, 0.5);

      const baseDetail = compact ? stage.chapter ?? stage.skillFocus ?? "" : `${stage.chapter ?? ""} · ${stage.skillFocus ?? stage.description}`;
      const detail = readiness.ready ? baseDetail : compact ? this.getShortReadinessReason(readiness.reason) : readiness.reason;
      this.add
        .text(textX, y + (compact ? 11 : 12), detail, {
          color: readiness.ready ? "#4d5b63" : "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 11 : 13, save)}px`,
          fontStyle: "700",
          wordWrap: {
            width: cardWidth - (compact ? 160 : 190),
            useAdvancedWrap: true
          }
        })
        .setOrigin(0, 0.5);

      this.add
        .text(x + cardWidth / 2 - (compact ? 78 : 96), y - (compact ? 12 : 18), visited ? "去过这里" : "可探索", {
          color: visited ? "#227a4f" : "#728089",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "12px" : "15px",
          fontStyle: "900"
        })
        .setOrigin(0.5);

      addButton(
        this,
        x + cardWidth / 2 - (compact ? 42 : 56),
        y + (compact ? 12 : 16),
        compact ? 72 : 92,
        compact ? 34 : 40,
        "开始",
        () => {
          this.scene.start(sceneKeys.battle, {
            stageId: stage.id
          });
        },
        {
          fill: 0xffcf6a,
          stroke: 0x9d5b00,
          fontSize: this.getFontSize(compact ? 13 : 16, save)
        }
      );
    });
  }

  private drawRewards(
    width: number,
    height: number,
    compact: boolean,
    stages: ReturnType<typeof getStagesFromCache>,
    save: ReturnType<typeof loadSave>
  ): void {
    const rewards = getStickerWallItems(save, stages);
    const columns = compact ? 2 : 4;
    const gap = compact ? 8 : 10;
    const top = compact ? 156 : 164;
    const bottom = compact ? 64 : 74;
    const rows = Math.ceil(rewards.length / columns);
    const cardWidth = Math.min(compact ? (width - 38) / 2 : (width - 62) / 4, compact ? 178 : 198);
    const availableHeight = Math.max(360, height - top - bottom);
    const cardHeight = Math.min(compact ? 76 : 96, Math.max(compact ? 64 : 82, (availableHeight - (rows - 1) * gap) / rows));
    const gridWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = width / 2 - gridWidth / 2 + cardWidth / 2;
    const stroke = save.accessibility.highContrast ? 0x000000 : 0xc78a35;

    this.add
      .text(width / 2, compact ? 138 : 146, "贴纸墙：玩过的场景会留下小小纪念", {
        color: "#25313b",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "14px" : "17px",
        fontStyle: "900"
      })
      .setOrigin(0.5);

    rewards.forEach((reward, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = top + row * (cardHeight + gap) + cardHeight / 2;
      const fill = reward.earned ? 0xfffdf6 : 0xf4f0e6;
      const itemStroke = reward.earned ? stroke : save.accessibility.highContrast ? 0x25313b : 0x728089;

      addPanel(this, x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, fill, itemStroke);
      const token = this.add.graphics();
      token.fillStyle(reward.earned ? reward.color : 0xffffff, 1);
      token.lineStyle(3, itemStroke, 1);
      token.fillCircle(x - cardWidth / 2 + (compact ? 23 : 28), y - (compact ? 17 : 24), compact ? 16 : 20);
      token.strokeCircle(x - cardWidth / 2 + (compact ? 23 : 28), y - (compact ? 17 : 24), compact ? 16 : 20);
      this.add
        .text(x - cardWidth / 2 + (compact ? 23 : 28), y - (compact ? 17 : 24), reward.symbol, {
          color: reward.earned ? "#25313b" : "#728089",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "13px" : "16px",
          fontStyle: "900"
        })
        .setOrigin(0.5);
      this.add
        .text(x - cardWidth / 2 + (compact ? 46 : 56), y - (compact ? 22 : 30), reward.title, {
          color: reward.earned ? "#2363a7" : "#4d5b63",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 12 : 15, save)}px`,
          fontStyle: "900",
          wordWrap: {
            width: cardWidth - (compact ? 56 : 70),
            useAdvancedWrap: true
          }
        })
        .setOrigin(0, 0.5);
      this.add
        .text(x - cardWidth / 2 + 14, y + (compact ? 8 : 10), reward.evidenceText, {
          color: reward.earned ? "#6b3f15" : "#728089",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 10 : 12, save)}px`,
          fontStyle: "700",
          wordWrap: {
            width: cardWidth - 28,
            useAdvancedWrap: true
          }
        })
        .setOrigin(0, 0.5);
      this.add
        .text(x + cardWidth / 2 - 16, y - cardHeight / 2 + 14, reward.kind === "stage-sticker" ? "贴" : "徽", {
          color: reward.earned ? "#227a4f" : "#728089",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "10px" : "11px",
          fontStyle: "900"
        })
        .setOrigin(1, 0.5);
    });

    if (height < 500 && !compact) {
      this.add
        .text(width / 2, height - 82, "奖励只记录练会的策略，不提供战力、排行或付费优势。", {
          color: "#4d5b63",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: "13px",
          fontStyle: "700"
        })
        .setOrigin(0.5);
    }
  }

  private drawParentSummary(
    width: number,
    height: number,
    compact: boolean,
    stages: ReturnType<typeof getStagesFromCache>,
    save: ReturnType<typeof loadSave>
  ): void {
    const summary = getParentSummary(save, stages);
    const recommendation = getRecommendedPractice(save, stages);
    const panelWidth = Math.min(compact ? width - 28 : 620, width - 32);
    const panelHeight = Math.min(compact ? 330 : 346, height - (compact ? 178 : 198));
    const panelX = width / 2 - panelWidth / 2;
    const panelY = compact ? 150 : 164;

    addPanel(this, panelX, panelY, panelWidth, panelHeight, 0xfffdf6, save.accessibility.highContrast ? 0x000000 : 0x2f78b8);

    const lines = [
      `探索记录：已经去过 ${summary.completedStages} 个场景；全部 ${summary.totalStages} 个场景始终开放。`,
      `技能观察：${summary.skillStatusText}`,
      `支持方式：${summary.supportText}`,
      `复练节奏：${summary.reviewText}`,
      `最近可能需要再看看：${summary.focusText}`,
      recommendation ? `建议入口：${recommendation.reason}` : summary.nextSuggestion,
      summary.recommendationReasonText
    ];
    const rowGap = compact ? 25 : 29;

    this.add
      .text(panelX + 24, panelY + 24, "家长摘要", {
        color: "#2363a7",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "22px" : "26px",
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);

    lines.forEach((line, index) => {
      this.add
        .text(panelX + 24, panelY + (compact ? 58 : 64) + index * rowGap, line, {
          color: index >= 1 ? "#6b3f15" : "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 13 : 16, save)}px`,
          fontStyle: "800",
          wordWrap: {
            width: panelWidth - 48,
            useAdvancedWrap: true
          }
        })
        .setOrigin(0, 0.5);
    });

    const stickerCount = save.earnedStickerIds.length;
    this.add
      .text(panelX + 24, panelY + panelHeight - 28, `贴纸收藏：${stickerCount} 张`, {
        color: "#227a4f",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "14px" : "17px",
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);
  }

  private drawTabs(width: number, compact: boolean, save: ReturnType<typeof loadSave>): void {
    const tabs: Array<{ view: MenuView; label: string }> = [
      { view: "map", label: "地图" },
      { view: "rewards", label: "奖励" },
      { view: "parent", label: "家长" },
      { view: "settings", label: "设置" }
    ];
    const tabWidth = compact ? 70 : 94;
    const tabGap = compact ? 6 : 10;
    const y = compact ? 108 : 116;
    const totalWidth = tabs.length * tabWidth + (tabs.length - 1) * tabGap;
    const startX = width / 2 - totalWidth / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const selected = this.view === tab.view;
      addButton(
        this,
        startX + index * (tabWidth + tabGap),
        y,
        tabWidth,
        compact ? 34 : 38,
        tab.label,
        () => {
          this.view = tab.view;
          this.render();
        },
        {
          fill: selected ? 0xffcf6a : 0xffffff,
          stroke: save.accessibility.highContrast ? 0x000000 : selected ? 0x9d5b00 : 0x728089,
          fontSize: this.getFontSize(compact ? 13 : 15, save)
        }
      );
    });
  }

  private drawSettings(width: number, height: number, compact: boolean, save: ReturnType<typeof loadSave>): void {
    const short = height < 650;
    const panelWidth = Math.min(compact ? width - 28 : 560, width - 32);
    const panelHeight = compact
      ? Math.min(430, height - 166)
      : short
        ? height - 154
        : Math.min(440, height - 184);
    const panelX = width / 2 - panelWidth / 2;
    const panelY = compact ? 150 : short ? 144 : 164;
    const settings = [
      { key: "largeText", label: "大字模式" },
      { key: "reducedMotion", label: "减少动画" },
      { key: "highContrast", label: "高对比度" },
      { key: "leftHanded", label: "左手布局" }
    ] as const;

    addPanel(this, panelX, panelY, panelWidth, panelHeight, 0xfffdf6, save.accessibility.highContrast ? 0x000000 : 0x2f78b8);
    this.add
      .text(panelX + 24, panelY + 28, "设置", {
        color: "#2363a7",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${this.getFontSize(compact ? 22 : 26, save)}px`,
        fontStyle: "900"
      })
      .setOrigin(0, 0.5);
    this.add
      .text(panelX + 24, panelY + 58, "只改变显示和操作，不影响进度。", {
        color: "#4d5b63",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: `${this.getFontSize(compact ? 13 : 15, save)}px`,
        fontStyle: "700",
        wordWrap: {
          width: panelWidth - 48,
          useAdvancedWrap: true
        }
      })
      .setOrigin(0, 0.5);

    settings.forEach((setting, index) => {
      const enabled = save.accessibility[setting.key];
      const y = panelY + (short ? 86 : 98) + index * (compact ? 46 : short ? 40 : 50);
      this.add
        .text(panelX + 24, y, setting.label, {
          color: "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 15 : 17, save)}px`,
          fontStyle: "800"
        })
        .setOrigin(0, 0.5);
      addButton(
        this,
        panelX + panelWidth - (compact ? 58 : 70),
        y,
        compact ? 82 : 98,
        compact ? 34 : 38,
        enabled ? "开" : "关",
        () => {
          updateAccessibilitySettings({
            [setting.key]: !enabled
          });
          this.render();
        },
        {
          fill: enabled ? 0x8bd39e : 0xffffff,
          stroke: save.accessibility.highContrast ? 0x000000 : enabled ? 0x227a4f : 0x728089,
          fontSize: this.getFontSize(compact ? 14 : 16, save)
        }
      );
    });

    const resetTop = panelY + (short ? 86 : 98) + settings.length * (compact ? 46 : short ? 40 : 50) + (short ? 0 : 6);
    this.add.rectangle(panelX + panelWidth / 2, resetTop, panelWidth - 44, 2, save.accessibility.highContrast ? 0x000000 : 0xd4c8af);

    if (!this.resetConfirmationPending) {
      this.add
        .text(panelX + 24, resetTop + (compact ? 26 : short ? 20 : 30), "本机数据", {
          color: "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 14 : 16, save)}px`,
          fontStyle: "900"
        })
        .setOrigin(0, 0.5);
      addButton(
        this,
        panelX + panelWidth - (compact ? 92 : 110),
        resetTop + (compact ? 30 : short ? 24 : 34),
        compact ? 150 : 176,
        compact ? 38 : 42,
        "清空本机进度",
        () => {
          this.resetConfirmationPending = true;
          this.render();
        },
        {
          fill: 0xfff3e3,
          stroke: save.accessibility.highContrast ? 0x000000 : 0x9d5b00,
          fontSize: this.getFontSize(compact ? 13 : 15, save)
        }
      );
    } else {
      this.add
        .text(panelX + 24, resetTop + (compact ? 24 : short ? 14 : 26), "只会删除本机键 math-battle-web/save-v1 中的数学实验室场景、贴纸、练习记录和显示设置；其他数学世界站点不受影响。", {
          color: "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${this.getFontSize(compact ? 11 : 13, save)}px`,
          fontStyle: "800",
          wordWrap: { width: panelWidth - 48, useAdvancedWrap: true }
        })
        .setOrigin(0, 0);
      const buttonY = resetTop + (compact ? 86 : short ? 76 : 88);
      addButton(this, panelX + panelWidth * 0.34, buttonY, compact ? 126 : 148, compact ? 38 : 42, "确认清空", () => {
        resetSave();
        this.resetConfirmationPending = false;
        this.render();
      }, {
        fill: 0xffe1d8,
        stroke: save.accessibility.highContrast ? 0x000000 : 0x9d3d2f,
        fontSize: this.getFontSize(compact ? 13 : 15, save)
      });
      addButton(this, panelX + panelWidth * 0.68, buttonY, compact ? 100 : 120, compact ? 38 : 42, "取消", () => {
        this.resetConfirmationPending = false;
        this.render();
      }, {
        fill: 0xffffff,
        stroke: save.accessibility.highContrast ? 0x000000 : 0x728089,
        fontSize: this.getFontSize(compact ? 13 : 15, save)
      });
    }
  }

  private cancelReset(): void {
    if (!this.resetConfirmationPending) return;
    this.resetConfirmationPending = false;
    this.render();
  }

  private getShortReadinessReason(reason: string): string {
    return reason.replace("可直接开始；", "").replace("建议复练：", "复练：");
  }

  private getFontSize(baseSize: number, save: ReturnType<typeof loadSave>): number {
    return save.accessibility.largeText ? baseSize + 2 : baseSize;
  }

  private drawBackground(width: number, height: number, compact: boolean): void {
    this.add.image(width / 2, height / 2, "riverMeadowBg").setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.18);
    this.add.rectangle(width / 2, compact ? 54 : 60, width, compact ? 108 : 120, 0xd7f3ff, 0.58);
    this.add.rectangle(width / 2, height - 36, width, 72, 0x72cfa6, 0.24);

    if (!compact) {
      this.add.image(width - 132, height - 116, "targetGuardian").setScale(0.13).setAlpha(0.92);
      this.add.image(132, height - 98, "helperTrio").setScale(0.14).setAlpha(0.88);
    }
  }

  private drawTitle(width: number, compact: boolean): void {
    this.add
      .text(width / 2, compact ? 34 : 38, "数学实验室", {
        color: "#2363a7",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "26px" : `${Math.min(40, Math.max(32, width * 0.04))}px`,
        fontStyle: "900"
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, compact ? 68 : 76, "自由选择一组短场景，沿着地图练习加减法。", {
        color: "#25313b",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: compact ? "13px" : "17px",
        fontStyle: "800",
        align: "center",
        wordWrap: {
          width: width - 34,
          useAdvancedWrap: true
        }
      })
      .setOrigin(0.5);
  }
}
