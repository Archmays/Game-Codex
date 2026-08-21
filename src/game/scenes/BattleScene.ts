import Phaser from "phaser";
import { formatThreePartFeedback, getThreePartFeedback } from "../domain/math/feedback";
import { getHintForLevel } from "../domain/math/hints";
import {
  BattleEngine,
  type ApplyActionOutcome,
  type BattleAction,
  type BattleState,
  type ActionPreview
} from "../domain/battle/BattleEngine";
import {
  getAvailableOperandsForSource,
  getDirectHitOptions,
  getDirectHitValueIndexes,
  getOperationOptionsForOperand,
  type AvailableOperandOption
} from "../domain/battle/actionOptions";
import { getMaterialValueIndexes, getSelectableValueIndexes } from "../domain/battle/valueOptions";
import type {
  EncounterDefinition,
  RoleDefinition,
  RoleSkin,
  SceneCopyDefinition,
  StageDefinition,
  StageThemeDefinition
} from "../domain/content/types";
import { getRolesFromCache, getSkinPackFromCache, getStagesFromCache } from "../content/loadContent";
import type { SkillCompletionRecord } from "../domain/progression/progression";
import { loadSave, saveStageCompletion } from "../save/saveStore";
import { addPanel, colorFromHex, getHudPanelHeight } from "./ui";
import { sceneKeys } from "./sceneKeys";

interface BattleSceneData {
  stageId: string;
}

const fallbackStageTheme: StageThemeDefinition = {
  backgroundKey: "riverMeadowBg",
  accentColor: "#2363a7",
  bottomColor: "#2f9e6d",
  successEffect: "river-boat"
};

const fallbackSceneCopy: SceneCopyDefinition = {
  targetLabel: "目的数",
  sourceLabel: "起点",
  materialLabel: "材料",
  bonusLabel: "小帮手",
  progressLabel: "进度",
  progressDoneLabel: "完成",
  applyLabel: "确认",
  applyHitLabel: "完成",
  setupLabel: "更接近",
  hitLabel: "完成！准备下一场。",
  addLabel: "加上",
  subtractLabel: "减去"
};

const helperCharacterKeys = Array.from(
  { length: 7 },
  (_, index) => `mathLabHelper${String(index + 1).padStart(2, "0")}`
);

export interface ActionOption {
  action: BattleAction;
  label: string;
  preview: ActionPreview;
  roleLabel: string;
  color: string;
}

export interface HudUpdate {
  stageTitle: string;
  encounterTitle: string;
  encounterIndex: number;
  encounterTotal: number;
  heartsRemaining: number;
  maxMistakes: number;
  selectedValueIndex: number;
  selectedOperand: AvailableOperandOption | null;
  selectedAction: BattleAction | null;
  preview: ActionPreview | null;
  operandOptions: AvailableOperandOption[];
  actionOptions: ActionOption[];
  suggestedValueIndexes: number[];
  materialValueIndexes: number[];
  rescueProgressCurrent: number;
  rescueProgressTotal: number;
  sceneCopy: SceneCopyDefinition;
  message: string;
  hint: string;
  hintLevel: number;
  canApply: boolean;
  isResolving: boolean;
}

export class BattleScene extends Phaser.Scene {
  private roles: Record<string, RoleDefinition> = {};
  private skins: Record<string, RoleSkin> = {};
  private stage!: StageDefinition;
  private encounter!: EncounterDefinition;
  private engine!: BattleEngine;
  private state!: BattleState;
  private selectedValueIndex = 0;
  private selectedOperand: AvailableOperandOption | null = null;
  private selectedAction: BattleAction | null = null;
  private selectedPreview: ActionPreview | null = null;
  private hintLevel = 0;
  private message = "先点一个数字，再选一个运算。";
  private encounterIndex = 0;
  private totalHintsUsed = 0;
  private totalMistakes = 0;
  private usedComboInStage = false;
  private usedSubtractionInStage = false;
  private wrongTypesInStage: Record<string, number> = {};
  private skillResultsInStage: SkillCompletionRecord[] = [];
  private encounterMistakes = 0;
  private encounterMaxHintLevel = 0;
  private encounterWrongTypes: Record<string, number> = {};
  private isResolving = false;
  private lastOutcome: ApplyActionOutcome | null = null;
  private fieldLayer?: Phaser.GameObjects.Container;
  private reducedMotion = false;
  private highContrast = false;
  private conceptExpanded = false;
  private conceptSelectedParts = new Set<"source" | "operand">();
  private conceptCompleted = false;
  private currentHelperKeys: string[] = [];

  constructor() {
    super(sceneKeys.battle);
  }

  create(data: BattleSceneData): void {
    const rolesFile = getRolesFromCache(this.cache);
    const skinPack = getSkinPackFromCache(this.cache);
    const stages = getStagesFromCache(this.cache);

    this.roles = Object.fromEntries(rolesFile.roles.map((role) => [role.id, role]));
    this.skins = skinPack.roleSkins;
    this.stage = stages.find((stage) => stage.id === data.stageId) ?? stages[0];
    this.engine = new BattleEngine(this.roles);
    this.totalHintsUsed = 0;
    this.totalMistakes = 0;
    this.usedComboInStage = false;
    this.usedSubtractionInStage = false;
    this.wrongTypesInStage = {};
    this.skillResultsInStage = [];
    const save = loadSave();
    this.reducedMotion = save.accessibility.reducedMotion;
    this.highContrast = save.accessibility.highContrast;

    this.game.events.on("hud:selectOperand", this.handleOperandSelect, this);
    this.game.events.on("hud:selectAction", this.handleActionSelect, this);
    this.game.events.on("hud:applyAction", this.applySelectedAction, this);
    this.game.events.on("hud:hint", this.showNextHint, this);
    this.game.events.on("hud:resetEncounter", this.restartEncounter, this);
    this.game.events.on("hud:menu", this.returnToMenu, this);
    this.scale.on("resize", this.renderField, this);

    this.scene.launch(sceneKeys.hud);
    this.time.delayedCall(0, () => this.startEncounter(0));
  }

  shutdown(): void {
    this.game.events.off("hud:selectOperand", this.handleOperandSelect, this);
    this.game.events.off("hud:selectAction", this.handleActionSelect, this);
    this.game.events.off("hud:applyAction", this.applySelectedAction, this);
    this.game.events.off("hud:hint", this.showNextHint, this);
    this.game.events.off("hud:resetEncounter", this.restartEncounter, this);
    this.game.events.off("hud:menu", this.returnToMenu, this);
    this.scale.off("resize", this.renderField, this);
  }

  private startEncounter(index: number): void {
    this.encounterIndex = index;
    this.encounter = this.stage.encounters[index];
    this.state = this.engine.createInitialState(this.encounter);
    this.selectedValueIndex = this.getSelectableIndexes()[0] ?? 0;
    this.selectedOperand = null;
    this.selectedAction = null;
    this.selectedPreview = null;
    this.hintLevel = 0;
    this.encounterMistakes = 0;
    this.encounterMaxHintLevel = 0;
    this.encounterWrongTypes = {};
    this.isResolving = false;
    this.lastOutcome = null;
    this.conceptExpanded = false;
    this.conceptSelectedParts = new Set();
    this.conceptCompleted = false;
    this.currentHelperKeys = this.pickHelperCharacters();
    const sceneCopy = this.getSceneCopy();
    this.message = this.encounter.comboText ?? `先选${sceneCopy.sourceLabel}，再选${sceneCopy.materialLabel}或${sceneCopy.bonusLabel}。`;
    this.renderField();
    this.emitHudUpdate();
  }

  private renderField(): void {
    this.fieldLayer?.destroy(true);
    this.fieldLayer = this.add.container(0, 0);

    const width = this.scale.width;
    const height = this.scale.height;
    const bottomHud = getHudPanelHeight(width, height);
    const playHeight = height - bottomHud;

    this.drawBackground(width, playHeight);

    this.drawStageHeader(width);
    this.drawEnemy(width, playHeight);
    this.drawRoleBadges(width, playHeight);
    this.drawConceptCoach(width, playHeight);
    this.drawValueCards(width, playHeight);

    if (this.selectedPreview) {
      const compact = width < 560;
      const panelWidth = Math.min(520, width - 40);
      const panelHeight = compact ? 64 : 52;
      const previewY = compact ? playHeight - 166 : playHeight - 116;
      const previewPanel = addPanel(
        this,
        width / 2 - panelWidth / 2,
        previewY,
        panelWidth,
        panelHeight,
        0xffffff,
        this.getAccessibleStroke(0x4d7f9f)
      );
      this.fieldLayer.add(previewPanel);
      const previewColor = this.selectedPreview.isValid
        ? this.selectedPreview.isHit
          ? "#227a4f"
          : "#9d5b00"
        : "#a04040";
      const previewText = this.getPreviewText(this.selectedPreview);
      this.fieldLayer.add(
        this.add
          .text(width / 2, previewY + panelHeight / 2, previewText, {
            color: previewColor,
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: compact ? "18px" : "20px",
            fontStyle: "800",
            align: "center",
            wordWrap: {
              width: panelWidth - 24
            }
          })
          .setOrigin(0.5)
      );
    }
  }

  private drawBackground(width: number, playHeight: number): void {
    const theme = this.getStageTheme();
    const background = this.add.image(width / 2, playHeight / 2, theme.backgroundKey);
    const coverScale = Math.max(width / background.width, playHeight / background.height);
    background.setScale(coverScale);
    const bottomFade = this.add.rectangle(width / 2, playHeight - 28, width, 88, colorFromHex(theme.bottomColor), 0.24);
    const shade = this.add.rectangle(width / 2, playHeight / 2, width, playHeight, 0xffffff, this.highContrast ? 0.2 : 0.08);
    this.fieldLayer?.add([background, shade, bottomFade]);
  }

  private drawStageHeader(width: number): void {
    const compact = width < 560;
    const panelWidth = compact ? Math.min(width - 28, 226) : Math.min(290, Math.max(232, width * 0.26));
    const panelHeight = compact ? 78 : 94;
    const panel = addPanel(this, 14, 14, panelWidth, panelHeight, 0xfffbef, this.getAccessibleStroke(0xc78a35));
    this.fieldLayer?.add(panel);
    this.fieldLayer?.add(
      this.add
        .text(34, compact ? 36 : 42, `${this.stage.title}  ${this.encounterIndex + 1}/${this.stage.encounters.length}`, {
          color: "#2363a7",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "18px" : "24px",
          fontStyle: "900"
        })
        .setOrigin(0, 0.5)
    );
    const targetText =
      this.state.maxActions > 1
        ? `${this.getSceneCopy().targetLabel}：${this.encounter.targetValue}  第 ${Math.min(this.state.actionsUsedInAttempt + 1, this.state.maxActions)}/${this.state.maxActions} 步`
        : `${this.getSceneCopy().targetLabel}：${this.encounter.targetValue}`;
    this.fieldLayer?.add(
      this.add
        .text(36, compact ? 68 : 82, targetText, {
          color: "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "16px" : "22px",
          fontStyle: "900"
        })
        .setOrigin(0, 0.5)
    );
  }

  private drawEnemy(width: number, playHeight: number): void {
    const compact = width < 560;
    const theme = this.getStageTheme();
    const { x: enemyX, creatureY, cardY, cardWidth, cardHeight } = this.getTargetCardLayout(width, playHeight);
    const targetScale = compact ? Math.min(0.14, Math.max(0.1, width / 3000)) : Math.min(0.2, Math.max(0.13, width / 5600));
    const creature = this.add.image(enemyX, creatureY, "targetGuardian").setScale(targetScale);
    creature.setDepth(2);
    this.fieldLayer?.add(creature);
    this.drawTargetCard(enemyX, cardY, cardWidth, cardHeight, theme, compact);
  }

  private drawTargetCard(
    x: number,
    y: number,
    width: number,
    height: number,
    theme: StageThemeDefinition,
    compact: boolean
  ): void {
    const accent = this.getAccessibleStroke(colorFromHex(theme.accentColor));
    const shadow = this.add.graphics();
    shadow.fillStyle(0x3f2b18, 0.2);
    shadow.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 6, width, height, 10);
    this.fieldLayer?.add(
      shadow
    );

    const card = this.add.graphics();
    card.fillStyle(0xfffdf6, 0.98);
    card.lineStyle(this.highContrast ? 6 : 5, accent, 1);
    card.fillRoundedRect(x - width / 2, y - height / 2, width, height, 10);
    card.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 10);
    this.fieldLayer?.add(card);

    this.fieldLayer?.add(
      this.add
        .text(x, y - height / 2 + (compact ? 14 : 16), this.getSceneCopy().targetLabel, {
          color: this.highContrast ? "#000000" : "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "13px" : "15px",
          fontStyle: "900",
          align: "center",
          fixedWidth: width,
          fixedHeight: compact ? 18 : 20
        })
        .setOrigin(0.5)
    );

    this.fieldLayer?.add(
      this.add
        .text(x, y + (compact ? 10 : 12), `${this.encounter.targetValue}`, {
          color: this.highContrast ? "#000000" : "#4a2d78",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: `${compact ? 34 : 42}px`,
          fontStyle: "900",
          align: "center",
          fixedWidth: width,
          fixedHeight: compact ? 42 : 48
        })
        .setOrigin(0.5)
    );
  }

  private getStageTheme(): StageThemeDefinition {
    return this.stage.theme ?? fallbackStageTheme;
  }

  private getSceneCopy(): SceneCopyDefinition {
    return this.stage.sceneCopy ?? fallbackSceneCopy;
  }

  private getTargetCardLayout(
    width: number,
    playHeight: number
  ): { x: number; creatureY: number; cardY: number; cardWidth: number; cardHeight: number } {
    const compact = width < 560;
    const targetScale = compact ? Math.min(0.14, Math.max(0.1, width / 3000)) : Math.min(0.2, Math.max(0.13, width / 5600));
    const enemyY = compact ? Math.max(126, playHeight * 0.4) : Math.max(134, playHeight * 0.32);
    const creatureY = enemyY - (compact ? 18 : 24);
    return {
      x: width / 2,
      creatureY,
      cardY: creatureY + (compact ? 22 : 23) * (targetScale / 0.16),
      cardWidth: compact ? 94 : 110,
      cardHeight: compact ? 66 : 76
    };
  }

  private drawValueCards(width: number, playHeight: number): void {
    const compact = width < 560;
    const { cardWidth, cardHeight, gap, startX, y } = this.getValueCardLayout(width, playHeight);
    this.drawHelperCharacters(compact, cardWidth, cardHeight, gap, startX, y);

    const suggestedValueIndexes = this.getSuggestedValueIndexes();

    this.state.currentValues.forEach((value, index) => {
      const x = startX + index * (cardWidth + gap);
      const selectable = this.isSelectableValue(index);
      const material = this.isMaterialValue(index);
      const selected = selectable && index === this.selectedValueIndex;
      const selectedMaterial = material && this.selectedOperand?.source === "material" && this.selectedOperand.valueIndex === index;
      const suggested = selectable && suggestedValueIndexes.includes(index);
      const fill = selected ? 0xfffbdb : selectedMaterial ? 0xdff4ff : material ? 0xe9f5ff : 0xfffdf6;
      const stroke = this.highContrast
        ? 0x000000
        : selected
          ? 0xd98f21
          : selectedMaterial
            ? 0x2363a7
            : suggested
              ? 0x2f9e6d
              : material
                ? 0x4d7f9f
                : 0x2c3e50;
      const card = this.add.graphics();
      card.fillStyle(fill, material ? 0.94 : 1);
      card.lineStyle(selected || selectedMaterial || suggested ? 5 : 4, stroke, material ? 0.82 : 1);
      card.fillRoundedRect(x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 8);
      card.strokeRoundedRect(x - cardWidth / 2, y - cardHeight / 2, cardWidth, cardHeight, 8);
      this.fieldLayer?.add(card);

      if (selectable) {
        const hitArea = this.add.zone(x, y, cardWidth, cardHeight).setInteractive({
          useHandCursor: true
        });
        hitArea.on("pointerdown", () => {
          this.selectedValueIndex = index;
          this.selectedOperand = null;
          this.selectedAction = null;
          this.selectedPreview = null;
          this.lastOutcome = null;
          this.message = this.getSelectionMessage(index);
          this.renderField();
          this.emitHudUpdate();
        });
        this.fieldLayer?.add(hitArea);
      } else if (material) {
        const hitArea = this.add.zone(x, y, cardWidth, cardHeight).setInteractive({
          useHandCursor: true
        });
        hitArea.on("pointerdown", () => {
          this.handleOperandSelect({
            value,
            source: "material",
            valueIndex: index,
            label: `${this.getSceneCopy().materialLabel} ${value}`
          });
        });
        this.fieldLayer?.add(hitArea);
      }

      this.fieldLayer?.add(
        this.add
          .text(x, y - 8, `${value}`, {
            color: selected ? "#1f5fa8" : selectedMaterial ? "#2363a7" : material ? "#4d7f9f" : "#25313b",
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: compact ? "36px" : "42px",
            fontStyle: "900"
          })
          .setOrigin(0.5)
      );
      this.fieldLayer?.add(
        this.add
          .text(x, y + (compact ? 27 : 32), material ? this.getSceneCopy().materialLabel : `${this.getSceneCopy().sourceLabel} ${index + 1}`, {
            color: selectedMaterial ? "#2363a7" : material ? "#4d7f9f" : "#4d5b63",
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: compact ? "13px" : "15px",
            fontStyle: "700"
          })
          .setOrigin(0.5)
      );
    });
  }

  private drawHelperCharacters(
    compact: boolean,
    cardWidth: number,
    cardHeight: number,
    gap: number,
    startX: number,
    cardY: number
  ): void {
    const visibleCount = Math.min(3, this.state.currentValues.length, this.currentHelperKeys.length);
    const helperHeight = compact ? Math.min(94, Math.max(78, cardHeight * 1.08)) : Math.min(128, Math.max(108, cardHeight * 1.32));
    const helperY = cardY - cardHeight / 2 - helperHeight * (compact ? 0.4 : 0.42);

    for (let index = 0; index < visibleCount; index += 1) {
      const x = startX + index * (cardWidth + gap);
      const helper = this.add.image(x, helperY, this.currentHelperKeys[index]);
      helper.setDisplaySize(helperHeight, helperHeight);
      helper.setAlpha(0.98);
      this.fieldLayer?.add(helper);
    }
  }

  private pickHelperCharacters(): string[] {
    const pool = [...helperCharacterKeys];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, 3);
  }

  private getValueCardLayout(width: number, playHeight: number): {
    cardWidth: number;
    cardHeight: number;
    gap: number;
    startX: number;
    y: number;
  } {
    const compact = width < 560;
    const cardWidth = compact ? Math.min(94, Math.max(80, (width - 64) / 3)) : Math.min(126, Math.max(96, width * 0.13));
    const cardHeight = compact ? 82 : 96;
    const gap = compact ? 8 : Math.min(22, Math.max(12, width * 0.025));
    const y = compact ? playHeight - cardHeight / 2 - 10 : Math.max(250, playHeight * 0.77);
    const totalWidth = this.state.currentValues.length * cardWidth + (this.state.currentValues.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;
    return { cardWidth, cardHeight, gap, startX, y };
  }

  private getValueCardCenter(index: number): { x: number; y: number } {
    const width = this.scale.width;
    const playHeight = this.scale.height - getHudPanelHeight(width, this.scale.height);
    const layout = this.getValueCardLayout(width, playHeight);
    return {
      x: layout.startX + index * (layout.cardWidth + layout.gap),
      y: layout.y
    };
  }

  private getEnemyCenter(): { x: number; y: number } {
    const width = this.scale.width;
    const playHeight = this.scale.height - getHudPanelHeight(width, this.scale.height);
    const target = this.getTargetCardLayout(width, playHeight);
    return {
      x: target.x,
      y: target.cardY
    };
  }

  private drawRoleBadges(width: number, playHeight: number): void {
    if (width < 560) {
      return;
    }

    const enabledRoles = this.encounter.allowedRoleIds
      .map((roleId) => this.roles[roleId])
      .filter((role): role is RoleDefinition => Boolean(role));
    const xStart = width / 2 - (enabledRoles.length - 1) * 72;
    const y = Math.max(82, playHeight * 0.14);

    enabledRoles.forEach((role, index) => {
      const skin = this.skins[role.skinSlot] ?? this.skins[role.id];
      const x = xStart + index * 144;
      const badge = this.add.graphics();
      badge.fillStyle(colorFromHex(skin?.color ?? "#ffffff"), 1);
      badge.lineStyle(4, colorFromHex(skin?.accentColor ?? "#25313b"), 1);
      badge.fillCircle(x, y, 34);
      badge.strokeCircle(x, y, 34);
      this.fieldLayer?.add(badge);
      this.fieldLayer?.add(
        this.add
          .text(x, y - 2, skin?.shortName ?? role.childLabel.slice(0, 1), {
            color: "#25313b",
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: "24px",
            fontStyle: "900"
          })
          .setOrigin(0.5)
      );
      this.fieldLayer?.add(
        this.add
          .text(x, y + 47, role.childLabel, {
            color: "#25313b",
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: "15px",
            fontStyle: "800"
          })
          .setOrigin(0.5)
      );
    });
  }

  private drawConceptCoach(width: number, playHeight: number): void {
    const concept = this.encounter.conceptInteraction;
    if (!concept) {
      return;
    }

    const source = this.encounter.initialValues[concept.sourceValueIndex];
    if (source === undefined) {
      return;
    }

    const operand = concept.operand;
    const operator = concept.operator ?? "+";
    const compact = width < 560;
    const panelWidth = compact ? Math.min(width - 34, 300) : 306;
    const panelHeight = this.conceptExpanded ? (compact ? 116 : 126) : (compact ? 46 : 52);
    const x = compact ? width / 2 - panelWidth / 2 : width - panelWidth - 16;
    const y = compact ? Math.max(112, playHeight * 0.16) : 16;
    const panel = addPanel(this, x, y, panelWidth, panelHeight, 0xfffbef, this.getAccessibleStroke(0x227a4f));
    this.fieldLayer?.add(panel);
    this.fieldLayer?.add(
      this.add
        .text(x + 14, y + (compact ? 21 : 24), this.conceptExpanded ? concept.title : `${concept.title}：${source}${operator}${operand}`, {
          color: "#227a4f",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "14px" : "16px",
          fontStyle: "900"
        })
        .setOrigin(0, 0.5)
    );

    if (this.conceptExpanded) {
      this.fieldLayer?.add(
        this.add
          .text(x + 14, y + (compact ? 45 : 50), this.conceptCompleted ? concept.successText : concept.prompt, {
            color: this.conceptCompleted ? "#227a4f" : "#4d5b63",
            fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
            fontSize: compact ? "12px" : "14px",
            fontStyle: "800",
            wordWrap: {
              width: panelWidth - 28,
              useAdvancedWrap: true
            }
          })
          .setOrigin(0, 0.5)
      );

      this.drawConceptChip(x + (compact ? 54 : 60), y + (compact ? 86 : 96), `${source}`, "source", compact);
      this.drawConceptOperator(x + (compact ? 104 : 116), y + (compact ? 86 : 96), operator, compact);
      this.drawConceptChip(x + (compact ? 150 : 172), y + (compact ? 86 : 96), `${operand}`, "operand", compact);
      this.drawConceptOperator(x + (compact ? 200 : 226), y + (compact ? 86 : 96), "=", compact);
      this.drawConceptResult(x + (compact ? 248 : 270), y + (compact ? 86 : 96), `${concept.result}`, compact);
    }

    const hitZone = this.add.zone(x + panelWidth / 2, y + (compact ? 21 : 24), panelWidth, compact ? 42 : 46).setInteractive({
      useHandCursor: true
    });
    hitZone.on("pointerdown", () => {
      this.conceptExpanded = !this.conceptExpanded;
      this.message = this.conceptExpanded ? concept.prompt : this.message;
      this.renderField();
      this.emitHudUpdate();
    });
    this.fieldLayer?.add(hitZone);
  }

  private drawConceptChip(
    x: number,
    y: number,
    label: string,
    part: "source" | "operand",
    compact: boolean
  ): void {
    const selected = this.conceptSelectedParts.has(part);
    const chip = this.add.graphics();
    chip.fillStyle(selected ? 0x8bd39e : 0xdff7ea, 1);
    chip.lineStyle(3, this.getAccessibleStroke(selected ? 0x227a4f : 0x4d7f9f), 1);
    chip.fillRoundedRect(x - 26, y - 20, 52, 40, 8);
    chip.strokeRoundedRect(x - 26, y - 20, 52, 40, 8);
    this.fieldLayer?.add(chip);
    this.fieldLayer?.add(
      this.add
        .text(x, y, label, {
          color: "#25313b",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "18px" : "21px",
          fontStyle: "900"
        })
        .setOrigin(0.5)
    );

    const hitZone = this.add.zone(x, y, 58, 46).setInteractive({
      useHandCursor: true
    });
    hitZone.on("pointerdown", (event: Phaser.Input.Pointer) => {
      event.event?.stopPropagation();
      this.conceptExpanded = true;
      if (selected) {
        this.conceptSelectedParts.delete(part);
      } else {
        this.conceptSelectedParts.add(part);
      }
      this.conceptCompleted = this.conceptSelectedParts.has("source") && this.conceptSelectedParts.has("operand");
      const concept = this.encounter.conceptInteraction;
      this.message = this.conceptCompleted && concept ? concept.successText : "点两个数块，看它们怎样改变数量。";
      this.renderField();
      this.emitHudUpdate();
    });
    this.fieldLayer?.add(hitZone);
  }

  private drawConceptOperator(x: number, y: number, label: string, compact: boolean): void {
    this.fieldLayer?.add(
      this.add
        .text(x, y, label, {
          color: "#6b3f15",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "18px" : "21px",
          fontStyle: "900"
        })
        .setOrigin(0.5)
    );
  }

  private drawConceptResult(x: number, y: number, label: string, compact: boolean): void {
    const completed = this.conceptCompleted;
    const result = this.add.graphics();
    result.fillStyle(completed ? 0xffcf6a : 0xffffff, 1);
    result.lineStyle(3, this.getAccessibleStroke(completed ? 0x9d5b00 : 0x728089), 1);
    result.fillRoundedRect(x - 26, y - 20, 52, 40, 8);
    result.strokeRoundedRect(x - 26, y - 20, 52, 40, 8);
    this.fieldLayer?.add(result);
    this.fieldLayer?.add(
      this.add
        .text(x, y, label, {
          color: completed ? "#6b3f15" : "#728089",
          fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
          fontSize: compact ? "18px" : "21px",
          fontStyle: "900"
        })
        .setOrigin(0.5)
    );
  }

  private getAccessibleStroke(color: number): number {
    return this.highContrast ? 0x000000 : color;
  }

  private getActionOptions(): ActionOption[] {
    if (!this.isSelectableValue(this.selectedValueIndex) || !this.selectedOperand) {
      return [];
    }

    return getOperationOptionsForOperand(
      this.engine,
      this.state,
      this.roles,
      this.encounter.allowedRoleIds,
      this.selectedValueIndex,
      this.selectedOperand.value
    ).map((option) => {
      const role = this.roles[option.roleId];
      const skin = this.skins[role.skinSlot] ?? this.skins[role.id];
      return {
        action: option.action,
        label: this.getThemedActionLabel(role, option.action.operand),
        preview: option.preview,
        roleLabel: role.childLabel,
        color: skin?.color ?? "#ffffff"
      };
    });
  }

  private getOperandOptions(): AvailableOperandOption[] {
    if (!this.isSelectableValue(this.selectedValueIndex)) {
      return [];
    }

    return getAvailableOperandsForSource(
      this.state,
      this.roles,
      this.encounter.allowedRoleIds,
      this.selectedValueIndex,
      this.getMaterialIndexes()
    );
  }

  private getThemedActionLabel(role: RoleDefinition, operand: number): string {
    const sceneCopy = this.getSceneCopy();
    if (role.operation === "add") {
      return `${sceneCopy.addLabel} ${operand}\n+${operand}`;
    }

    if (role.operation === "subtract") {
      return `${sceneCopy.subtractLabel} ${operand}\n-${operand}`;
    }

    return `${role.childLabel} ${operand}`;
  }

  private handleOperandSelect(operand: AvailableOperandOption): void {
    if (this.isResolving) {
      return;
    }

    this.selectedOperand = operand;
    this.selectedAction = null;
    this.selectedPreview = null;
    this.lastOutcome = null;
    const sceneCopy = this.getSceneCopy();
    this.message =
      operand.source === "material"
        ? `已选择${sceneCopy.materialLabel} ${operand.value}，再选择${sceneCopy.addLabel}或${sceneCopy.subtractLabel}。`
        : `已选择${sceneCopy.bonusLabel} ${operand.value}，再选择${sceneCopy.addLabel}或${sceneCopy.subtractLabel}。`;
    this.renderField();
    this.emitHudUpdate();
  }

  private handleActionSelect(action: BattleAction): void {
    if (this.isResolving) {
      return;
    }

    this.selectedAction = action;
    this.selectedPreview = this.engine.previewAction(this.state, action);
    this.lastOutcome = null;
    this.message = this.getActionPreviewMessage(this.selectedPreview);
    this.renderField();
    this.emitHudUpdate();
  }

  private getPreviewText(preview: ActionPreview): string {
    const sceneCopy = this.getSceneCopy();
    if (!preview.isValid) {
      return `不能这样做：${preview.reason}`;
    }

    if (preview.isHit) {
      return `试试看：${preview.expression}  ${sceneCopy.applyHitLabel}！`;
    }

    if (this.lastOutcome === "setup" || (this.lastOutcome === null && this.canContinueAfterPreview(preview))) {
      return `试试看：${preview.expression}  ${sceneCopy.setupLabel}，还能再走一步。`;
    }

    return `试试看：${preview.expression}  还没有对上${sceneCopy.targetLabel}。`;
  }

  private getActionPreviewMessage(preview: ActionPreview): string {
    const sceneCopy = this.getSceneCopy();
    if (!preview.isValid) {
      return preview.reason ?? "这一步不能用。";
    }

    if (preview.isHit) {
      return `这一步可以完成，点绿色“${sceneCopy.applyHitLabel}”。`;
    }

    if (this.canContinueAfterPreview(preview)) {
      return `这一步可以先让${sceneCopy.targetLabel}更接近，确认后不会扣心。`;
    }

    return `这一步还没有对上${sceneCopy.targetLabel}，确认会扣 1 颗心。`;
  }

  private canContinueAfterPreview(preview?: ActionPreview): boolean {
    if (preview && (!preview.isValid || preview.isHit)) {
      return false;
    }

    return this.state.maxActions > 1 && this.state.actionsUsedInAttempt + 1 < this.state.maxActions;
  }

  private applySelectedAction(): void {
    if (this.isResolving) {
      return;
    }

    if (!this.selectedOperand) {
      const sceneCopy = this.getSceneCopy();
      this.message = `先选一张${sceneCopy.materialLabel}或${sceneCopy.bonusLabel}。`;
      this.emitHudUpdate();
      return;
    }

    if (!this.selectedAction) {
      const sceneCopy = this.getSceneCopy();
      this.message = `先选择${sceneCopy.addLabel}或${sceneCopy.subtractLabel}。`;
      this.emitHudUpdate();
      return;
    }

    const action = this.selectedAction;
    const sourceValueIndex = action.sourceValueIndex;
    const result = this.engine.applyAction(this.state, action);
    const role = this.roles[action.roleId];
    this.state = result.state;
    this.selectedPreview = result.preview;
    this.lastOutcome = result.outcome;

    if (!result.preview.isValid) {
      this.message = result.preview.reason ?? "这一步不能用。";
    } else if (result.outcome === "hit") {
      this.isResolving = true;
      this.usedComboInStage = this.usedComboInStage || this.encounter.type === "combo_hit";
      this.usedSubtractionInStage = this.usedSubtractionInStage || role?.operation === "subtract";
      this.recordEncounterSkillResults();
      this.message = this.getSceneCopy().hitLabel;
    } else if (result.outcome === "setup") {
      this.usedComboInStage = true;
      this.usedSubtractionInStage = this.usedSubtractionInStage || role?.operation === "subtract";
      this.message = `${this.getSceneCopy().setupLabel}，还能再走一步。`;
    } else {
      this.totalMistakes += result.didConsumeMistake ? 1 : 0;
      this.encounterMistakes += result.didConsumeMistake ? 1 : 0;
      if (result.didConsumeMistake) {
        this.recordWrongType(result.preview);
      }
      this.message =
        result.state.status === "lost"
          ? `${this.getMissFeedback(result.preview)} 心用完了，这一场重新来。`
          : `${this.getMissFeedback(result.preview)} 数量回到开头，再试一次。`;
    }

    this.selectedOperand = null;
    this.selectedAction = null;
    this.renderField();
    this.emitHudUpdate();

    if (result.outcome === "setup") {
      this.playSetupEffect(sourceValueIndex);
    }

    if (result.outcome === "hit") {
      this.playHitEffect(sourceValueIndex, () => this.goToNextEncounter());
    }

    if (result.outcome === "miss" || result.outcome === "lost") {
      this.playMissEffect(sourceValueIndex);
    }

    if (result.outcome === "lost") {
      this.time.delayedCall(900, () => this.restartEncounter());
    }
  }

  private playSetupEffect(sourceValueIndex: number): void {
    const center = this.getValueCardCenter(sourceValueIndex);
    const ring = this.add.circle(center.x, center.y, 46, 0xffd166, 0.28).setStrokeStyle(5, 0x2f9e6d, 1);
    const label = this.add
      .text(center.x, center.y - 70, this.getSceneCopy().setupLabel, {
        color: "#227a4f",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: "22px",
        fontStyle: "900"
      })
      .setOrigin(0.5);
    this.fieldLayer?.add([ring, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(220, () => {
        ring.destroy();
        label.destroy();
      });
      return;
    }

    this.tweens.add({
      targets: ring,
      scale: 1.35,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy()
    });
    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 520,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy()
    });
  }

  private playHitEffect(sourceValueIndex: number, onComplete: () => void): void {
    const start = this.getValueCardCenter(sourceValueIndex);
    const end = this.getEnemyCenter();
    const projectile = this.add.circle(start.x, start.y, 12, 0xffd166, 1).setStrokeStyle(4, 0xffffff, 0.9);
    this.fieldLayer?.add(projectile);
    if (this.reducedMotion) {
      projectile.destroy();
      const duration = this.playStageSuccessEffect(end.x, end.y);
      this.time.delayedCall(duration, onComplete);
      return;
    }

    this.tweens.add({
      targets: projectile,
      x: end.x,
      y: end.y,
      scale: 1.4,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => {
        projectile.destroy();
        const duration = this.playStageSuccessEffect(end.x, end.y);
        this.time.delayedCall(duration, onComplete);
      }
    });
  }

  private playStageSuccessEffect(x: number, y: number): number {
    const theme = this.getStageTheme();
    const duration = this.reducedMotion ? 260 : 720;

    if (theme.successEffect === "apple-tree") {
      this.playAppleTreeEffect(x, y);
    } else if (theme.successEffect === "cake-sparkle") {
      this.playCakeSparkleEffect(x, y);
    } else if (theme.successEffect === "river-boat") {
      this.playRiverBoatEffect(x, y);
    } else if (theme.successEffect === "open-book") {
      this.playOpenBookEffect(x, y);
    } else {
      this.playMarketBasketEffect(x, y);
    }

    if (!this.reducedMotion) {
      this.cameras.main.shake(100, 0.0025);
    }

    return duration;
  }

  private playAppleTreeEffect(x: number, y: number): void {
    const container = this.createSuccessContainer(x + this.getEffectSideOffset(), y + 8);
    const trunk = this.add.rectangle(0, 24, 14, 34, 0x8a5a2b).setStrokeStyle(2, 0x5f3b1d);
    const leaves = [
      this.add.circle(-20, 0, 24, 0x79c95b),
      this.add.circle(0, -14, 28, 0x65b84d),
      this.add.circle(22, 0, 24, 0x86d36a)
    ];
    const apples = [
      this.add.circle(-18, -8, 6, 0xe94f4f),
      this.add.circle(4, -22, 6, 0xf25a4f),
      this.add.circle(22, 3, 6, 0xe94f4f)
    ];
    const stars = apples.map((apple) => this.createStarShape(apple.x, apple.y - 2, 10, 0xffd166, 0));
    container.add([trunk, ...leaves, ...apples, ...stars]);

    if (this.reducedMotion) {
      return;
    }

    container.setScale(0.25).setAlpha(0);
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 220, ease: "Back.easeOut" });
    apples.forEach((apple, index) => {
      apple.setScale(0);
      this.tweens.add({ targets: apple, scale: 1, delay: 190 + index * 90, duration: 150, ease: "Back.easeOut" });
      this.tweens.add({ targets: stars[index], alpha: 1, scale: 1.35, delay: 380 + index * 70, duration: 180, yoyo: true });
    });
  }

  private playCakeSparkleEffect(x: number, y: number): void {
    const container = this.createSuccessContainer(x + this.getEffectSideOffset(), y + 18);
    const tray = this.add.ellipse(0, 34, 96, 16, 0xf1d7a8).setStrokeStyle(3, 0x9d6a2d);
    const cake = this.add.rectangle(0, 12, 70, 34, 0xffc48f).setStrokeStyle(3, 0x9d5b00);
    const frosting = this.add.container(0, -8);
    frosting.add([
      this.add.circle(-26, 0, 12, 0xffe4f0),
      this.add.circle(-9, -5, 14, 0xfff2f7),
      this.add.circle(9, -5, 14, 0xffe4f0),
      this.add.circle(26, 0, 12, 0xfff2f7)
    ]);
    const sprinkles = [0xff5f7e, 0xffd166, 0x62c6ff, 0x8bd39e, 0xc99cff, 0xff9f4a].map((color, index) => {
      const dot = this.add.circle(0, -12, 4, color);
      dot.setData("targetX", Math.cos(index * 1.05) * 58);
      dot.setData("targetY", -18 + Math.sin(index * 1.05) * 34);
      return dot;
    });
    container.add([tray, cake, frosting, ...sprinkles]);

    if (this.reducedMotion) {
      return;
    }

    container.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 220, ease: "Back.easeOut" });
    this.tweens.add({ targets: frosting, angle: 360, duration: 560, ease: "Sine.easeInOut" });
    sprinkles.forEach((dot, index) => {
      this.tweens.add({
        targets: dot,
        x: dot.getData("targetX") as number,
        y: dot.getData("targetY") as number,
        delay: 140 + index * 35,
        duration: 360,
        ease: "Cubic.easeOut"
      });
    });
  }

  private playRiverBoatEffect(x: number, y: number): void {
    const finalX = x + this.getEffectSideOffset();
    const finalY = y + (this.scale.width < 560 ? 58 : 68);
    const container = this.createSuccessContainer(finalX - 70, finalY + 10);
    const hull = this.add.graphics();
    hull.fillStyle(0xb56a31, 1);
    hull.lineStyle(3, 0x6b3f15, 1);
    hull.fillRoundedRect(-34, 5, 68, 22, 8);
    hull.strokeRoundedRect(-34, 5, 68, 22, 8);
    const mast = this.add.rectangle(-2, -12, 5, 46, 0x6b3f15);
    const sail = this.add.triangle(11, -10, -2, 22, -2, -24, 30, 14, 0xfffdf6).setStrokeStyle(2, 0x2574a9);
    const wave = this.add.ellipse(0, 30, 82, 22, 0x7cc7ff, 0.2).setStrokeStyle(3, 0x2574a9, 0.75);
    container.add([wave, hull, mast, sail]);

    if (this.reducedMotion) {
      container.setPosition(finalX, finalY);
      return;
    }

    wave.setAlpha(0);
    this.tweens.add({
      targets: container,
      x: finalX,
      y: finalY,
      duration: 430,
      ease: "Sine.easeInOut",
      onComplete: () => {
        wave.setAlpha(1);
        this.tweens.add({ targets: wave, scale: 1.8, alpha: 0, duration: 260, ease: "Sine.easeOut" });
      }
    });
  }

  private playOpenBookEffect(x: number, y: number): void {
    const container = this.createSuccessContainer(x + this.getEffectSideOffset(), y + 18);
    const leftPage = this.add.rectangle(-29, 0, 56, 62, 0xfff4da).setStrokeStyle(3, 0x7a4a2a);
    const rightPage = this.add.rectangle(29, 0, 56, 62, 0xfff8e8).setStrokeStyle(3, 0x7a4a2a);
    const spine = this.add.rectangle(0, 0, 8, 68, 0xb98247);
    const bookmark = this.add.rectangle(24, 14, 9, 28, 0xd84f4f);
    const stars = [
      this.createStarShape(-34, -40, 10, 0xffd166, 0),
      this.createStarShape(2, -50, 12, 0xffd166, 0),
      this.createStarShape(38, -38, 10, 0xffd166, 0)
    ];
    container.add([leftPage, rightPage, spine, bookmark, ...stars]);

    if (this.reducedMotion) {
      return;
    }

    container.setScale(0.2, 0.9).setAlpha(0);
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: leftPage, angle: -7, delay: 160, duration: 220, yoyo: true });
    this.tweens.add({ targets: rightPage, angle: 7, delay: 160, duration: 220, yoyo: true });
    stars.forEach((star, index) => {
      this.tweens.add({ targets: star, alpha: 1, y: star.y - 16, delay: 280 + index * 70, duration: 220, yoyo: true });
    });
  }

  private playMarketBasketEffect(x: number, y: number): void {
    const container = this.createSuccessContainer(x + this.getEffectSideOffset(), y + 28);
    const handle = this.add.arc(0, -4, 38, 205, 335, false, 0xffffff, 0).setStrokeStyle(5, 0x8a4f14);
    const basket = this.add.graphics();
    basket.fillStyle(0xd98a2e, 1);
    basket.lineStyle(3, 0x8a4f14, 1);
    basket.fillRoundedRect(-42, -4, 84, 42, 8);
    basket.strokeRoundedRect(-42, -4, 84, 42, 8);
    const fruitA = this.add.circle(-18, -72, 12, 0xff6b55).setStrokeStyle(2, 0x8a4f14);
    const fruitB = this.add.circle(18, -92, 12, 0xffd166).setStrokeStyle(2, 0x8a4f14);
    const ribbons = [
      this.add.rectangle(-52, -24, 7, 18, 0xff5f7e),
      this.add.rectangle(50, -30, 7, 18, 0x62c6ff),
      this.add.rectangle(0, -52, 7, 18, 0x8bd39e)
    ];
    container.add([handle, basket, fruitA, fruitB, ...ribbons]);

    if (this.reducedMotion) {
      fruitA.setY(-18);
      fruitB.setY(-22);
      return;
    }

    ribbons.forEach((ribbon) => ribbon.setAlpha(0));
    this.tweens.add({ targets: fruitA, y: -18, duration: 260, ease: "Bounce.easeOut" });
    this.tweens.add({ targets: fruitB, y: -22, delay: 90, duration: 260, ease: "Bounce.easeOut" });
    this.tweens.add({ targets: container, angle: 5, delay: 240, yoyo: true, repeat: 3, duration: 80 });
    ribbons.forEach((ribbon, index) => {
      this.tweens.add({ targets: ribbon, alpha: 1, y: ribbon.y - 14, delay: 330 + index * 50, duration: 180, yoyo: true });
    });
  }

  private createSuccessContainer(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    this.fieldLayer?.add(container);
    return container;
  }

  private getEffectSideOffset(): number {
    return this.scale.width < 560 ? 72 : 150;
  }

  private createStarShape(x: number, y: number, radius: number, color: number, alpha = 1): Phaser.GameObjects.Graphics {
    const star = this.add.graphics();
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const pointRadius = index % 2 === 0 ? radius : radius * 0.45;
      points.push({
        x: x + Math.cos(angle) * pointRadius,
        y: y + Math.sin(angle) * pointRadius
      });
    }
    star.fillStyle(color, 1);
    star.fillPoints(points, true);
    star.setAlpha(alpha);
    return star;
  }

  private playMissEffect(sourceValueIndex: number): void {
    const center = this.getValueCardCenter(sourceValueIndex);
    const label = this.add
      .text(center.x, center.y - 70, "再试一次", {
        color: "#a04040",
        fontFamily: "Trebuchet MS, Microsoft YaHei, Arial",
        fontSize: "21px",
        fontStyle: "900"
      })
      .setOrigin(0.5);
    this.fieldLayer?.add(label);
    if (this.reducedMotion) {
      this.time.delayedCall(220, () => label.destroy());
      return;
    }

    this.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      duration: 520,
      ease: "Sine.easeOut",
      onComplete: () => label.destroy()
    });
    if (!this.reducedMotion) {
      this.cameras.main.shake(160, 0.004);
    }
  }

  private showNextHint(): void {
    this.hintLevel = Math.min(3, this.hintLevel + 1);
    this.encounterMaxHintLevel = Math.max(this.encounterMaxHintLevel, this.hintLevel);
    this.totalHintsUsed += 1;
    this.message = getHintForLevel(this.encounter, this.hintLevel, this.state.actionsUsedInAttempt);
    this.emitHudUpdate();
  }

  private restartEncounter(): void {
    this.state = this.engine.createInitialState(this.encounter);
    this.selectedValueIndex = this.getSelectableIndexes()[0] ?? 0;
    this.selectedOperand = null;
    this.selectedAction = null;
    this.selectedPreview = null;
    this.hintLevel = 0;
    this.isResolving = false;
    this.lastOutcome = null;
    this.currentHelperKeys = this.pickHelperCharacters();
    this.message = "这一场重新来。";
    this.renderField();
    this.emitHudUpdate();
  }

  private goToNextEncounter(): void {
    if (this.encounterIndex + 1 < this.stage.encounters.length) {
      this.startEncounter(this.encounterIndex + 1);
      return;
    }

    const stars = this.calculateStars();
    const wrongType = this.stage.encounters.some((encounter) => encounter.type === "combo_hit") ? "combo_hit" : "precision_hit";
    const progressResult = saveStageCompletion(this.stage.id, stars, this.totalHintsUsed, this.totalMistakes, wrongType, {
      usedCombo: this.usedComboInStage,
      usedSubtraction: this.usedSubtractionInStage,
      wrongTypes: this.wrongTypesInStage,
      skillResults: this.skillResultsInStage,
      stageRewardStickerId: this.stage.rewardStickerId,
      stageRewardStickerLabel: this.stage.rewardStickerLabel
    });
    this.scene.stop(sceneKeys.hud);
    this.scene.start(sceneKeys.result, {
      stageId: this.stage.id,
      stars,
      hintsUsed: this.totalHintsUsed,
      mistakes: this.totalMistakes,
      newAchievementIds: progressResult.newAchievementIds,
      newStickerLabels: progressResult.newStickerLabels
    });
  }

  private calculateStars(): number {
    if (this.totalHintsUsed === 0 && this.totalMistakes === 0) {
      return 3;
    }

    if (this.totalMistakes <= 2) {
      return 2;
    }

    return 1;
  }

  private returnToMenu(): void {
    this.scene.stop(sceneKeys.hud);
    this.scene.start(sceneKeys.menu);
  }

  private emitHudUpdate(): void {
    const update: HudUpdate = {
      stageTitle: this.stage.title,
      encounterTitle: this.encounter.title,
      encounterIndex: this.encounterIndex,
      encounterTotal: this.stage.encounters.length,
      heartsRemaining: Math.max(0, this.state.maxMistakes - this.state.mistakes),
      maxMistakes: this.state.maxMistakes,
      selectedValueIndex: this.selectedValueIndex,
      selectedOperand: this.selectedOperand,
      selectedAction: this.selectedAction,
      preview: this.selectedPreview,
      operandOptions: this.getOperandOptions(),
      actionOptions: this.getActionOptions(),
      suggestedValueIndexes: this.getSuggestedValueIndexes(),
      materialValueIndexes: this.getMaterialIndexes(),
      rescueProgressCurrent: this.getRescueProgressCurrent(),
      rescueProgressTotal: this.state.maxActions,
      sceneCopy: this.getSceneCopy(),
      message: this.message,
      hint: this.hintLevel > 0 ? getHintForLevel(this.encounter, this.hintLevel, this.state.actionsUsedInAttempt) : "",
      hintLevel: this.hintLevel,
      canApply: Boolean(!this.isResolving && this.selectedAction && this.selectedPreview?.isValid),
      isResolving: this.isResolving
    };

    this.game.events.emit("battle:update", update);
  }

  private getSuggestedValueIndexes(): number[] {
    const selectable = new Set(this.getSelectableIndexes());
    return getDirectHitValueIndexes(this.engine, this.state, this.roles, this.encounter.allowedRoleIds).filter((index) =>
      selectable.has(index)
    );
  }

  private getSelectionMessage(index: number): string {
    const sceneCopy = this.getSceneCopy();
    const selectedValue = this.state.currentValues[index];
    if (!this.isSelectableValue(index)) {
      return `${sceneCopy.materialLabel} ${selectedValue} 用来帮助${sceneCopy.sourceLabel}调整数量。`;
    }

    const directOptions = getDirectHitOptions(this.engine, this.state, this.roles, this.encounter.allowedRoleIds, index);

    if (directOptions.length > 0) {
      return `选中了${sceneCopy.sourceLabel} ${selectedValue}，再选${sceneCopy.materialLabel}或${sceneCopy.bonusLabel}完成这一轮。`;
    }

    if (this.canContinueAfterPreview()) {
      return `选中了${sceneCopy.sourceLabel} ${selectedValue}，先选${sceneCopy.materialLabel}或${sceneCopy.bonusLabel}让数量更接近。`;
    }

    return `选中了${sceneCopy.sourceLabel} ${selectedValue}，再选${sceneCopy.materialLabel}或${sceneCopy.bonusLabel}。`;
  }

  private getSelectableIndexes(): number[] {
    return getSelectableValueIndexes(this.encounter, this.state);
  }

  private getMaterialIndexes(): number[] {
    return getMaterialValueIndexes(this.encounter, this.state);
  }

  private isSelectableValue(index: number): boolean {
    return this.getSelectableIndexes().includes(index);
  }

  private isMaterialValue(index: number): boolean {
    return this.getMaterialIndexes().includes(index);
  }

  private getRescueProgressCurrent(): number {
    if (this.state.status === "won") {
      return this.state.maxActions;
    }

    return Math.min(this.state.actionsUsedInAttempt, this.state.maxActions);
  }

  private getMissFeedback(preview: ActionPreview): string {
    return formatThreePartFeedback(getThreePartFeedback(this.encounter, preview));
  }

  private recordWrongType(preview: ActionPreview): void {
    if (preview.result === null) {
      return;
    }

    const type = preview.result > this.encounter.targetValue ? "overshoot" : "undershoot";
    this.wrongTypesInStage[type] = (this.wrongTypesInStage[type] ?? 0) + 1;
    this.encounterWrongTypes[type] = (this.encounterWrongTypes[type] ?? 0) + 1;
  }

  private recordEncounterSkillResults(): void {
    const outcome: SkillCompletionRecord["outcome"] =
      this.encounterMistakes > 0 ? "recovered" : this.encounterMaxHintLevel > 0 ? "hinted" : "independent";

    for (const skillTag of this.encounter.skillTags ?? []) {
      this.skillResultsInStage.push({
        skillTag,
        outcome,
        maxHintLevel: this.encounterMaxHintLevel,
        mistakes: this.encounterMistakes,
        wrongTypes: this.encounterWrongTypes
      });
    }
  }
}
