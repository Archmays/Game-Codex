import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { clearElement, createButton } from "../../packages/ui";
import {
  createArrangementFeedback,
  evaluateArrangementOutcome,
  formatCurrentExpression,
  getHintMessage,
  type FeedbackMessage,
  type HintMessage
} from "./feedback";
import {
  equationSliderChapterManifest,
  findChapterManifest,
  loadEquationSliderChapter
} from "./levels/manifest";
import {
  completeLevelProgress,
  levelMapState,
  loadEquationSliderProgress,
  markCheckpointSeen,
  markTutorialCompleted,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  setSoundEnabled,
  type EquationSliderBadge,
  type EquationSliderProgress
} from "./progress";
import type { ChapterManifestEntry, EquationReel, PublishedEquationSliderLevel } from "./types";
import "./styles.css";

type Screen = "map" | "loading" | "station" | "board" | "complete" | "error";
type CompletionKind = "normal" | "rest" | "station-review" | "chapter-review";
type ReelFocusPart = "up" | "window" | "down";

interface ReelFocusTarget {
  readonly reelIndex: number;
  readonly part: ReelFocusPart;
}

interface SelectorFocusTarget {
  readonly selector: string;
}

type PendingFocusTarget = ReelFocusTarget | SelectorFocusTarget;

interface BoardSnapshot {
  readonly indexes: readonly number[];
  readonly coveredTileIds: readonly string[];
  readonly completedTargetIndexes: readonly number[];
  readonly moves: number;
  readonly blockedAttempts: number;
  readonly allCorrectAddedNew: boolean;
}

interface DragState {
  readonly pointerId: number;
  readonly reelIndex: number;
  readonly startY: number;
  readonly startIndexes: readonly number[];
  readonly snapshot: BoardSnapshot;
  readonly element: HTMLElement;
  moved: boolean;
  lastStep: number;
}

const TUTORIAL_STEPS = [
  { title: "上下移动一列", text: "拖动滑轨、点上半区或下半区，也可以使用箭头按钮。" },
  { title: "看中央算式", text: "穿过滑轨的亮带是运算轨道；中央 tile 会组成当前算式。" },
  { title: "逐步点亮", text: "找到成立算式会点亮方块。换不同组合，把所有灯都点亮。" }
] as const;

export const equationSliderGame: GameDefinition = {
  id: "equation-slider",
  title: "算式滑轨",
  description: "上下移动数字与运算符滑轨，组成成立算式，点亮四条数学线路。",
  subject: "数学",
  recommendedAge: "6-10 岁",
  learningGoal: "练习数感、四则运算、运算顺序、等式理解和组合推理。",
  status: "200 关可玩",
  playLabel: "进入轨道站",
  mount(context: MountGameContext): MountedGame {
    return mountEquationSlider(context);
  }
};

function mountEquationSlider(context: MountGameContext): MountedGame {
  const root = document.createElement("section");
  root.className = "equation-slider";
  const liveRegion = element("div", "equation-slider__live-region");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  context.container.append(root, liveRegion);

  const loaded = loadEquationSliderProgress(context.storage.get<unknown>("progress", null));
  let progress = loaded.progress;
  const canPersist = loaded.canPersist;
  if (loaded.migrated && canPersist) {
    context.storage.set("progress", progress);
  }

  let destroyed = false;
  let screen: Screen = "map";
  let selectedChapterId: string | null = null;
  let selectedUnitId: string | null = null;
  let loadError = "";
  let loadRequest = 0;
  const chapterCache = new Map<string, readonly PublishedEquationSliderLevel[]>();
  let currentLevel: PublishedEquationSliderLevel | null = null;
  let indexes: number[] = [];
  let coveredTileIds = new Set<string>();
  let completedTargetIndexes = new Set<number>();
  let history: BoardSnapshot[] = [];
  let moves = 0;
  let hintsThisSession = 0;
  let hintDepth = 0;
  let blockedAttempts = 0;
  let resetCount = 0;
  let allCorrectAddedNew = true;
  let locked = false;
  let feedback: FeedbackMessage = { kind: "info", text: "移动任意一列，开始点亮轨道。" };
  let hintMessage: HintMessage | null = null;
  let activePointer: DragState | null = null;
  let lockTimer: number | undefined;
  let pendingFocusTarget: PendingFocusTarget | null = null;
  let tutorialStep: number | null = progress.tutorialCompleted ? null : 0;
  let returnFocusToTutorialTrigger = false;
  let completionKind: CompletionKind = "normal";
  let completionBadges: readonly EquationSliderBadge[] = [];
  let lastSuccessfulExpression = "";
  let lastAnnouncement = "";
  const sound = createEquationSound();

  const persist = (): void => {
    if (canPersist) {
      context.storage.set("progress", progress);
    }
  };

  const clearTransientState = (): void => {
    window.clearTimeout(lockTimer);
    lockTimer = undefined;
    locked = false;
    if (activePointer) {
      try {
        if (activePointer.element.hasPointerCapture(activePointer.pointerId)) {
          activePointer.element.releasePointerCapture(activePointer.pointerId);
        }
      } catch {
        // The element may already have left the DOM.
      }
    }
    activePointer = null;
  };

  const scrollStageToTop = (): void => {
    const stage = root.parentElement;
    if (stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }
  };

  const clearBoardAnnouncement = (): void => {
    liveRegion.textContent = "";
    lastAnnouncement = "";
  };

  const focusAfterRender = (selector: string): void => {
    pendingFocusTarget = { selector };
  };

  const restorePendingFocus = (): void => {
    const target = pendingFocusTarget;
    if (!target || tutorialStep !== null || (locked && "reelIndex" in target)) {
      return;
    }
    pendingFocusTarget = null;
    window.queueMicrotask(() => {
      if (destroyed) {
        return;
      }
      if ("selector" in target) {
        root.querySelector<HTMLElement>(target.selector)?.focus();
        return;
      }
      root.querySelector<HTMLElement>(
        `[data-reel-index="${target.reelIndex}"][data-reel-focus="${target.part}"]`
      )?.focus();
    });
  };

  const renderCurrentScreen = (): void => {
    if (destroyed) {
      return;
    }
    if (screen === "map") {
      renderMap();
    } else if (screen === "loading") {
      renderLoading();
    } else if (screen === "station") {
      renderStation();
    } else if (screen === "board") {
      renderBoard();
    } else if (screen === "complete") {
      renderCompletion();
    } else {
      renderError();
    }
  };

  const appendTutorial = (): void => {
    if (tutorialStep === null) {
      return;
    }
    const currentTutorialStep = tutorialStep;
    const step = TUTORIAL_STEPS[currentTutorialStep];
    [...root.children].forEach((child) => {
      if (child instanceof HTMLElement) {
        child.inert = true;
      }
    });
    const backdrop = element("div", "equation-slider__modal-backdrop");
    const dialog = element("section", "equation-slider__tutorial");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "equation-slider-tutorial-title");
    dialog.append(
      element("span", "equation-slider__eyebrow", `三步玩法 · ${currentTutorialStep + 1}/3`),
      element("h2", "", step.title),
      element("p", "", step.text)
    );
    dialog.querySelector("h2")!.id = "equation-slider-tutorial-title";
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishTutorial();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    const diagram = element("div", `equation-slider__tutorial-diagram step-${currentTutorialStep + 1}`);
    diagram.setAttribute("aria-hidden", "true");
    diagram.append(element("span", "", "3"), element("span", "is-center", "+"), element("span", "", "4"));
    const actions = element("div", "equation-slider__tutorial-actions");
    actions.append(
      createButton("跳过", () => finishTutorial(), { className: "ui-button ui-button--secondary" }),
      createButton(currentTutorialStep === 2 ? "开始点亮" : "下一步", () => {
        if (currentTutorialStep === 2) {
          finishTutorial();
        } else {
          tutorialStep = currentTutorialStep + 1;
          renderCurrentScreen();
        }
      })
    );
    dialog.append(diagram, actions);
    backdrop.append(dialog);
    root.append(backdrop);
    window.queueMicrotask(() => dialog.querySelector<HTMLButtonElement>("button:last-child")?.focus());
  };

  const finishTutorial = (): void => {
    const shouldReturnFocus = returnFocusToTutorialTrigger;
    returnFocusToTutorialTrigger = false;
    progress = markTutorialCompleted(progress);
    persist();
    tutorialStep = null;
    renderCurrentScreen();
    if (shouldReturnFocus) {
      window.queueMicrotask(() => root.querySelector<HTMLButtonElement>("[data-tutorial-trigger]")?.focus());
    }
  };

  const createShellHeader = (eyebrow: string, title: string, intro: string): HTMLElement => {
    const header = element("header", "equation-slider__header");
    const titleGroup = element("div", "equation-slider__title-group");
    const heading = element("h2", "", title);
    heading.tabIndex = -1;
    heading.dataset.screenHeading = "true";
    titleGroup.append(element("span", "equation-slider__eyebrow", eyebrow), heading, element("p", "", intro));
    const train = element("div", "equation-slider__train-mark");
    train.setAttribute("aria-hidden", "true");
    train.append(element("span", "", "∑"), element("i", ""), element("i", ""));
    header.append(titleGroup, train);
    return header;
  };

  const createUtilityActions = (includeMap = false): HTMLElement => {
    const actions = element("div", "equation-slider__utility-actions");
    if (includeMap) {
      actions.append(createButton("线路地图", () => {
        clearTransientState();
        scrollStageToTop();
        screen = "map";
        focusAfterRender('[data-screen-heading="true"]');
        renderMap();
      }, { className: "ui-button ui-button--secondary" }));
    }
    const tutorialButton = createButton("三步玩法", () => {
      returnFocusToTutorialTrigger = true;
      tutorialStep = 0;
      renderCurrentScreen();
    }, { className: "ui-button ui-button--secondary" });
    tutorialButton.dataset.tutorialTrigger = "true";
    const soundButton = createButton(progress.soundEnabled ? "声音：开" : "声音：关", toggleSound, {
      className: "ui-button ui-button--secondary"
    });
    soundButton.dataset.focusKey = "sound";
    actions.append(soundButton, tutorialButton);
    return actions;
  };

  const toggleSound = (): void => {
    if (activePointer) {
      return;
    }
    progress = setSoundEnabled(progress, !progress.soundEnabled);
    persist();
    if (progress.soundEnabled) {
      sound.play("move");
    }
    focusAfterRender('[data-focus-key="sound"]');
    renderCurrentScreen();
  };

  const renderMap = (): void => {
    clearTransientState();
    clearBoardAnnouncement();
    clearElement(root);
    root.append(
      createShellHeader("数学轨道站", "算式滑轨", "四条线路、二十个站区。每次只玩一小站，也可以随时休息。"),
      createUtilityActions()
    );

    const summary = element("section", "equation-slider__summary");
    const records = Object.values(progress.levels);
    summary.append(
      summaryItem("已点亮", `${records.filter((record) => record.completed).length}/200`),
      summaryItem("自己找到", String(records.filter((record) => record.independent).length)),
      summaryItem("复习站", String(records.filter((record) => record.badges.includes("review-complete")).length))
    );
    if (!canPersist) {
      summary.append(element("p", "equation-slider__save-warning", "发现更高版本的本地进度。本次可以游玩，但不会覆盖原存档。"));
    }

    const routes = element("section", "equation-slider__routes");
    routes.setAttribute("aria-label", "四条数学线路");
    for (const chapter of equationSliderChapterManifest) {
      const completed = completedCountForChapter(progress, chapter.number);
      const route = document.createElement("button");
      route.type = "button";
      route.className = `equation-slider__route route-${chapter.color}`;
      route.setAttribute("aria-label", `${chapter.name}，已完成 ${completed} / 50 关`);
      route.addEventListener("click", () => void openChapter(chapter.id));
      const heading = element("div", "equation-slider__route-heading");
      heading.append(
        element("span", "equation-slider__route-number", `线路 ${chapter.number}`),
        element("h3", "", chapter.name),
        element("p", "", chapter.subtitle)
      );
      const rail = element("div", "equation-slider__route-rail");
      chapter.units.forEach((unit, unitIndex) => {
        const unitCompleted = completedCountForUnit(progress, chapter.number, unitIndex + 1);
        const station = element("span", unitCompleted === 10 ? "is-complete" : unitCompleted > 0 ? "is-current" : "");
        station.textContent = `${unitIndex + 1}`;
        station.title = `${unit.name}：${unitCompleted}/10`;
        rail.append(station);
      });
      const footer = element("div", "equation-slider__route-footer");
      footer.append(element("strong", "", `${completed}/50 盏灯`), element("span", "", chapter.readinessNote));
      route.append(heading, rail, footer);
      routes.append(route);
    }

    const mapFooter = element("footer", "equation-slider__map-footer");
    mapFooter.append(
      element("p", "", "没有倒计时、生命值或排行榜。提示不会影响通关。"),
      createButton("返回游戏大厅", context.onExit, { className: "ui-button ui-button--secondary" })
    );
    root.append(summary, routes, mapFooter);
    appendTutorial();
    restorePendingFocus();
  };

  const openChapter = async (chapterId: string): Promise<void> => {
    selectedChapterId = chapterId;
    scrollStageToTop();
    const request = ++loadRequest;
    const cached = chapterCache.get(chapterId);
    if (cached) {
      screen = "station";
      selectedUnitId = cached[0]?.unitId ?? null;
      focusAfterRender('[data-screen-heading="true"]');
      renderStation();
      return;
    }
    screen = "loading";
    focusAfterRender('[data-screen-heading="true"]');
    renderLoading();
    try {
      const levels = await loadEquationSliderChapter(chapterId);
      if (destroyed || request !== loadRequest) {
        return;
      }
      chapterCache.set(chapterId, levels);
      selectedUnitId = levels[0]?.unitId ?? null;
      screen = "station";
      focusAfterRender('[data-screen-heading="true"]');
      renderStation();
    } catch (error) {
      if (destroyed || request !== loadRequest) {
        return;
      }
      loadError = error instanceof Error ? error.message : "章节加载失败";
      screen = "error";
      focusAfterRender('[data-screen-heading="true"]');
      renderError();
    }
  };

  const renderLoading = (): void => {
    clearBoardAnnouncement();
    clearElement(root);
    root.append(createShellHeader("列车进站中", "正在打开线路", "只加载这一条线路的 50 关固定数据。"));
    const loading = element("div", "equation-slider__loading");
    loading.setAttribute("role", "status");
    loading.append(element("span", "equation-slider__loading-train", "▰"), element("p", "", "正在铺好轨道……"));
    root.append(loading);
    appendTutorial();
    restorePendingFocus();
  };

  const renderError = (): void => {
    clearBoardAnnouncement();
    clearElement(root);
    root.append(createShellHeader("线路暂未接通", "没有打开这一章", "本地数据没有成功加载，其他线路和大厅仍然可用。"));
    const panel = element("section", "equation-slider__error");
    panel.append(
      element("p", "", loadError),
      createButton("回到线路地图", () => {
        scrollStageToTop();
        screen = "map";
        focusAfterRender('[data-screen-heading="true"]');
        renderMap();
      })
    );
    root.append(panel);
    restorePendingFocus();
  };

  const renderStation = (): void => {
    clearTransientState();
    clearBoardAnnouncement();
    const chapter = selectedChapterId ? findChapterManifest(selectedChapterId) : undefined;
    const levels = selectedChapterId ? chapterCache.get(selectedChapterId) : undefined;
    if (!chapter || !levels) {
      loadError = "没有找到已加载的章节。";
      screen = "error";
      focusAfterRender('[data-screen-heading="true"]');
      renderError();
      return;
    }
    clearElement(root);
    root.append(createShellHeader(`线路 ${chapter.number} · 50 关`, chapter.name, chapter.readinessNote));
    const nav = createUtilityActions(true);
    root.append(nav);

    const line = element("div", `equation-slider__station-line route-${chapter.color}`);
    chapter.units.forEach((unit, unitIndex) => {
      const unitLevels = levels.filter((level) => level.unitId === unit.id);
      const completed = unitLevels.filter((level) => progress.levels[level.id]?.completed).length;
      const station = element("section", "equation-slider__station");
      if (selectedUnitId === unit.id) {
        station.classList.add("is-selected");
      }
      const header = element("button", "equation-slider__station-heading");
      header.setAttribute("type", "button");
      header.dataset.unitId = unit.id;
      header.addEventListener("click", () => {
        selectedUnitId = unit.id;
        focusAfterRender(`[data-unit-id="${unit.id}"]`);
        renderStation();
      });
      header.append(
        element("span", "equation-slider__station-sign", `站 ${unitIndex + 1}`),
        element("h3", "", unit.name),
        element("p", "", unit.shortGoal),
        element("strong", "", `${completed}/10`)
      );
      const lamps = element("div", "equation-slider__level-lamps");
      for (const level of unitLevels) {
        const record = progress.levels[level.id];
        const isRecommended = !record?.completed && level.id === nextIncompleteLevelId(levels, progress);
        const mapState = levelMapState(record);
        const stateText = mapState === "completed"
          ? "已完成"
          : mapState === "review-suggested"
            ? "建议复习"
            : mapState === "in-progress"
              ? "进行中"
              : isRecommended
                ? "继续"
                : "未开始";
        const lamp = document.createElement("button");
        lamp.type = "button";
        lamp.className = mapState === "completed"
          ? "is-complete"
          : mapState === "review-suggested"
            ? "is-complete is-review"
            : mapState === "in-progress"
              ? "is-in-progress"
              : "";
        if (isRecommended) {
          lamp.classList.add("is-current");
        }
        lamp.setAttribute("aria-label", `第 ${level.levelNumber} 关，${stateText}${isRecommended && mapState !== "unstarted" ? "，推荐继续" : ""}`);
        lamp.addEventListener("click", () => startLevel(level));
        lamp.append(
          element("span", "equation-slider__lamp-bulb", mapState === "review-suggested" ? "↻" : record?.completed ? "✓" : String(level.unitLevelNumber)),
          element("small", "", mapState === "unstarted" && level.unitLevelNumber === 10 ? "复习" : stateText)
        );
        lamps.append(lamp);
      }
      station.append(header, lamps);
      line.append(station);
    });
    root.append(line);
    appendTutorial();
    restorePendingFocus();
  };

  const startLevel = (level: PublishedEquationSliderLevel): void => {
    clearTransientState();
    clearBoardAnnouncement();
    scrollStageToTop();
    currentLevel = level;
    selectedChapterId = level.chapterId;
    selectedUnitId = level.unitId;
    indexes = level.reels.map((reel) => reel.initialIndex);
    coveredTileIds = new Set();
    completedTargetIndexes = new Set();
    history = [];
    moves = 0;
    hintsThisSession = 0;
    hintDepth = 0;
    blockedAttempts = 0;
    resetCount = 0;
    allCorrectAddedNew = true;
    lastSuccessfulExpression = "";
    pendingFocusTarget = null;
    hintMessage = null;
    feedback = level.learning.scaffoldLevel === "guided"
      ? { kind: "info", text: `先移动一列。${level.conceptHint}` }
      : { kind: "info", text: "移动任意一列，中央算式吸附后会给出线索。" };
    progress = recordLevelStart(progress, level.id);
    persist();
    screen = "board";
    focusAfterRender('[data-screen-heading="true"]');
    renderBoard();
  };

  const renderBoard = (): void => {
    const level = currentLevel;
    if (!level) {
      scrollStageToTop();
      screen = "station";
      focusAfterRender('[data-screen-heading="true"]');
      renderStation();
      return;
    }
    clearElement(root);
    const chapter = findChapterManifest(level.chapterId);
    const unit = chapter?.units.find((item) => item.id === level.unitId);
    const boardHeader = element("header", "equation-slider__board-header");
    const boardTitle = element("div", "");
    const boardHeading = element("h2", "", `第 ${level.levelNumber} 关`);
    boardHeading.tabIndex = -1;
    boardHeading.dataset.screenHeading = "true";
    boardTitle.append(
      element("span", "equation-slider__eyebrow", `${chapter?.name ?? "线路"} · ${unit?.name ?? "站区"}`),
      boardHeading,
      element("p", "", scaffoldLabel(level.learning.scaffoldLevel))
    );
    const headerActions = element("div", "equation-slider__board-header-actions");
    const headerListButton = createButton("关卡列表", goBackToStation, { className: "ui-button ui-button--secondary" });
    const boardSoundButton = createButton(progress.soundEnabled ? "声音开" : "静音", toggleSound, {
      className: "ui-button ui-button--secondary"
    });
    boardSoundButton.dataset.focusKey = "sound";
    headerActions.append(headerListButton, boardSoundButton);
    boardHeader.append(boardTitle, headerActions);

    const target = element("section", "equation-slider__target-panel");
    if (level.challenge === "unique-minimum-cover") {
      target.append(element("span", "equation-slider__challenge-flag", "唯一路线挑战"));
    }
    target.append(element("span", "equation-slider__target-label", targetLabel(level)));
    if (level.mode === "multi-target") {
      const targets = element("div", "equation-slider__target-chips");
      level.targets.forEach((value, targetIndex) => {
        const chip = element("span", completedTargetIndexes.has(targetIndex) ? "is-complete" : "", String(value));
        chip.append(element("small", "", completedTargetIndexes.has(targetIndex) ? "已命中" : "待命中"));
        targets.append(chip);
      });
      target.append(targets);
    } else if (level.mode === "target") {
      target.append(element("strong", "equation-slider__target-number", String(level.target)));
    } else {
      target.append(element("strong", "equation-slider__target-number equation-slider__target-number--equal", `= ${level.rightExpression.join(" ")}`));
    }

    const stats = element("section", "equation-slider__board-stats");
    const totalTiles = level.reels.reduce((count, reel) => count + reel.tiles.length, 0);
    stats.append(
      summaryItem("已点亮", `${coveredTileIds.size}/${totalTiles}`),
      summaryItem("尝试移动", String(moves)),
      summaryItem("已看提示", String(hintsThisSession))
    );

    const equationPanel = element("section", "equation-slider__equation-panel");
    equationPanel.append(
      element("span", "", "中央算式"),
      element("strong", "equation-slider__current-expression", formatCurrentExpression(level, indexes)),
      element("small", "equation-slider__preview-result", previewResultText(level, indexes))
    );

    const track = element("section", level.mode === "equality" ? "equation-slider__track has-equality" : "equation-slider__track");
    track.style.setProperty("--reel-count", String(level.reels.length));
    track.setAttribute("aria-label", "算式滑轨棋盘");
    level.reels.forEach((reel, reelIndex) => track.append(createReelControl(level, reel, reelIndex)));
    if (level.mode === "equality") {
      const fixed = element("div", "equation-slider__fixed-expression");
      fixed.append(element("span", "", "="), element("strong", "", level.rightExpression.join(" ")));
      fixed.setAttribute("aria-label", `等于 ${level.rightExpression.join(" ")}`);
      track.append(fixed);
    }

    const coverage = element("div", "equation-slider__coverage-bar");
    coverage.setAttribute("aria-label", `已点亮 ${coveredTileIds.size} / ${totalTiles} 个方块`);
    level.reels.flatMap((reel) => reel.tiles).forEach((tile) => {
      const light = element("span", coveredTileIds.has(tile.id) ? "is-lit" : "", coveredTileIds.has(tile.id) ? "✓" : "·");
      light.title = coveredTileIds.has(tile.id) ? `${tile.value} 已点亮` : `${tile.value} 未点亮`;
      coverage.append(light);
    });

    const feedbackElement = element("div", `equation-slider__feedback is-${feedback.kind}`, feedback.text);

    const actions = element("div", "equation-slider__board-actions");
    const hintButtonLabel = hintDepth === 0
      ? "看一点提示"
      : hintDepth >= 5
        ? "提示已完整"
        : `再看一点 ${hintDepth + 1}/5`;
    const undoButton = createButton("撤销", undoMove, {
      className: "ui-button ui-button--secondary",
      disabled: locked || history.length === 0
    });
    undoButton.dataset.focusKey = "undo";
    const resetButton = createButton("重置", resetLevel, {
      className: "ui-button ui-button--secondary",
      disabled: locked
    });
    resetButton.dataset.focusKey = "reset";
    const hintButton = createButton(hintButtonLabel, requestHint, { disabled: locked || hintDepth >= 5 });
    hintButton.dataset.focusKey = "hint";
    actions.append(
      undoButton,
      resetButton,
      hintButton,
      createButton("关卡列表", goBackToStation, { className: "ui-button ui-button--secondary" })
    );

    const learning = document.createElement("details");
    learning.className = "equation-slider__learning-note";
    const learningSummary = document.createElement("summary");
    learningSummary.textContent = "这关在学什么？";
    learning.append(learningSummary, element("p", "", level.learning.learningObjective));
    const tags = element("div", "equation-slider__skill-tags");
    level.learning.skillTags.forEach((tag) => tags.append(element("span", "", skillLabel(tag))));
    learning.append(tags);

    root.append(boardHeader, target, stats, equationPanel);
    if (level.learning.scaffoldLevel === "guided") {
      const microTutorial = element("aside", "equation-slider__micro-tutorial");
      microTutorial.append(
        element("strong", "", level.unitLevelNumber === 1 ? "本关微教程" : "提示正在变少"),
        element("p", "", level.unitLevelNumber === 1
          ? `先移动发光边框的滑轨，再看中央结果怎样变化。${level.conceptHint}`
          : `这次先观察目标与中央结果的差，再决定移动哪一列。${level.conceptHint}`)
      );
      root.append(microTutorial);
    } else if (level.learning.scaffoldLevel === "supported" && blockedAttempts >= 3) {
      const supportHint = element("aside", "equation-slider__micro-tutorial is-subtle");
      supportHint.append(element("strong", "", "给你一条关系线索"), element("p", "", level.conceptHint));
      root.append(supportHint);
    }
    root.append(track, coverage, feedbackElement);
    if (hintMessage) {
      const hint = element("aside", "equation-slider__hint", hintMessage.text);
      hint.setAttribute("role", "note");
      root.append(hint);
    }
    if (blockedAttempts >= 5) {
      const support = element("aside", "equation-slider__support-card");
      support.append(element("strong", "", "换一种走法也可以"), element("p", "", "这关可以先放一放，进度会留在本机。"));
      const supportActions = element("div", "");
      const practiceLevel = previousPracticeLevel(level);
      supportActions.append(
        createButton(hintDepth >= 5 ? "提示已完整" : "看一点提示", requestHint, { disabled: hintDepth >= 5 }),
        ...(practiceLevel
          ? [createButton("先练上一关", () => startLevel(practiceLevel), { className: "ui-button ui-button--secondary" })]
          : []),
        createButton("换一关再回来", goBackToStation, { className: "ui-button ui-button--secondary" })
      );
      support.append(supportActions);
      root.append(support);
    }
    root.append(actions, learning);
    appendTutorial();

    announceBoardUpdate(level);
    restorePendingFocus();
  };

  const createReelControl = (
    level: PublishedEquationSliderLevel,
    reel: EquationReel,
    reelIndex: number
  ): HTMLElement => {
    const control = element("div", "equation-slider__reel");
    if (hintMessage?.reelIndex === reelIndex) {
      control.classList.add("is-hinted");
    }
    if (level.learning.scaffoldLevel === "guided" && moves === 0 && guidedReelIndex(level) === reelIndex) {
      control.classList.add("is-guided");
    }
    const up = createButton("↑", () => commitMove(reelIndex, -1, "up"), {
      className: "equation-slider__reel-button",
      disabled: locked
    });
    up.dataset.reelIndex = String(reelIndex);
    up.dataset.reelFocus = "up";
    up.setAttribute("aria-label", `第 ${reelIndex + 1} 列向上移动`);
    const windowElement = element("div", "equation-slider__reel-window");
    windowElement.tabIndex = 0;
    windowElement.dataset.reelIndex = String(reelIndex);
    windowElement.dataset.reelFocus = "window";
    windowElement.setAttribute("role", "group");
    windowElement.setAttribute("aria-disabled", String(locked));
    updateReelWindow(windowElement, level, reel, reelIndex);
    windowElement.addEventListener("keydown", (event) => {
      if (locked || activePointer) {
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        commitMove(reelIndex, event.key === "ArrowUp" ? -1 : 1, "window");
      }
    });
    windowElement.addEventListener("pointerdown", (event) => beginPointerDrag(event, reelIndex, windowElement));
    windowElement.addEventListener("pointermove", updatePointerDrag);
    windowElement.addEventListener("pointerup", finishPointerDrag);
    windowElement.addEventListener("pointercancel", cancelPointerDrag);
    windowElement.addEventListener("lostpointercapture", cancelPointerDrag);

    const down = createButton("↓", () => commitMove(reelIndex, 1, "down"), {
      className: "equation-slider__reel-button",
      disabled: locked
    });
    down.dataset.reelIndex = String(reelIndex);
    down.dataset.reelFocus = "down";
    down.setAttribute("aria-label", `第 ${reelIndex + 1} 列向下移动`);
    control.append(up, windowElement, down);
    return control;
  };

  const updateReelWindow = (
    windowElement: HTMLElement,
    level: PublishedEquationSliderLevel,
    reel: EquationReel,
    reelIndex: number
  ): void => {
    const currentIndex = wrapIndex(indexes[reelIndex] ?? 0, reel.tiles.length);
    const positions = [
      { index: wrapIndex(currentIndex - 1, reel.tiles.length), className: "is-neighbor", label: "上一格" },
      { index: currentIndex, className: "is-current", label: "中央" },
      { index: wrapIndex(currentIndex + 1, reel.tiles.length), className: "is-neighbor", label: "下一格" }
    ];
    windowElement.replaceChildren();
    for (const position of positions) {
      const tile = reel.tiles[position.index];
      const tileElement = element("span", `equation-slider__tile ${position.className}`);
      if (coveredTileIds.has(tile.id)) {
        tileElement.classList.add("is-lit");
      }
      tileElement.append(element("small", "", coveredTileIds.has(tile.id) ? "✓ 已亮" : position.label), element("strong", "", String(tile.value)));
      windowElement.append(tileElement);
    }
    const currentTile = reel.tiles[currentIndex];
    windowElement.setAttribute(
      "aria-label",
      `第 ${reelIndex + 1} 列，当前 ${currentTile.value}，可上下移动`
    );
    windowElement.dataset.currentValue = String(currentTile.value);
    windowElement.dataset.levelId = level.id;
  };

  const beginPointerDrag = (event: PointerEvent, reelIndex: number, windowElement: HTMLElement): void => {
    if (locked || activePointer || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    activePointer = {
      pointerId: event.pointerId,
      reelIndex,
      startY: event.clientY,
      startIndexes: [...indexes],
      snapshot: makeSnapshot(),
      element: windowElement,
      moved: false,
      lastStep: 0
    };
    windowElement.setPointerCapture(event.pointerId);
    windowElement.classList.add("is-dragging");
  };

  const updatePointerDrag = (event: PointerEvent): void => {
    const drag = activePointer;
    if (!drag || event.pointerId !== drag.pointerId || !currentLevel) {
      return;
    }
    const delta = event.clientY - drag.startY;
    if (Math.abs(delta) < 12) {
      return;
    }
    event.preventDefault();
    drag.moved = true;
    const step = delta > 0
      ? Math.floor((delta - 12) / 44) + 1
      : -(Math.floor((Math.abs(delta) - 12) / 44) + 1);
    if (step === drag.lastStep) {
      return;
    }
    drag.lastStep = step;
    const length = currentLevel.reels[drag.reelIndex].tiles.length;
    indexes[drag.reelIndex] = wrapIndex(drag.startIndexes[drag.reelIndex] + step, length);
    refreshBoardPreview();
  };

  const finishPointerDrag = (event: PointerEvent): void => {
    const drag = activePointer;
    if (!drag || event.pointerId !== drag.pointerId || !currentLevel) {
      return;
    }
    activePointer = null;
    drag.element.classList.remove("is-dragging");
    try {
      if (drag.element.hasPointerCapture(event.pointerId)) {
        drag.element.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (drag.moved && indexes.some((index, position) => index !== drag.startIndexes[position])) {
      history.push(drag.snapshot);
      moves += 1;
      pendingFocusTarget = { reelIndex: drag.reelIndex, part: "window" };
      sound.playIfEnabled("move", progress.soundEnabled);
      resolveCommittedMove();
      return;
    }
    indexes = [...drag.startIndexes];
    const rect = drag.element.getBoundingClientRect();
    commitMove(drag.reelIndex, event.clientY < rect.top + rect.height / 2 ? -1 : 1);
  };

  const cancelPointerDrag = (event: PointerEvent): void => {
    const drag = activePointer;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    indexes = [...drag.startIndexes];
    drag.element.classList.remove("is-dragging");
    activePointer = null;
    refreshBoardPreview();
  };

  const refreshBoardPreview = (): void => {
    const level = currentLevel;
    if (!level || screen !== "board") {
      return;
    }
    root.querySelectorAll<HTMLElement>("[data-reel-index]").forEach((windowElement) => {
      const reelIndex = Number(windowElement.dataset.reelIndex);
      const reel = level.reels[reelIndex];
      if (reel) {
        updateReelWindow(windowElement, level, reel, reelIndex);
      }
    });
    const expression = root.querySelector<HTMLElement>(".equation-slider__current-expression");
    const result = root.querySelector<HTMLElement>(".equation-slider__preview-result");
    if (expression) {
      expression.textContent = formatCurrentExpression(level, indexes);
    }
    if (result) {
      result.textContent = previewResultText(level, indexes);
    }
  };

  const commitMove = (reelIndex: number, delta: -1 | 1, focusPart: ReelFocusPart = "window"): void => {
    const level = currentLevel;
    if (!level || locked || activePointer) {
      return;
    }
    pendingFocusTarget = { reelIndex, part: focusPart };
    history.push(makeSnapshot());
    indexes[reelIndex] = wrapIndex(indexes[reelIndex] + delta, level.reels[reelIndex].tiles.length);
    moves += 1;
    sound.playIfEnabled("move", progress.soundEnabled);
    resolveCommittedMove();
  };

  const resolveCommittedMove = (): void => {
    const level = currentLevel;
    if (!level) {
      return;
    }
    hintMessage = null;
    const outcome = evaluateArrangementOutcome(level, indexes);
    if (!outcome.valid) {
      blockedAttempts += 1;
      feedback = createArrangementFeedback(level, indexes, completedTargetIndexes);
      renderBoard();
      return;
    }

    const newTileIds = outcome.selectedTileIds.filter((id) => !coveredTileIds.has(id));
    const addsTarget = outcome.targetIndex !== undefined && !completedTargetIndexes.has(outcome.targetIndex);
    if (newTileIds.length === 0 && !addsTarget) {
      allCorrectAddedNew = false;
      blockedAttempts += 1;
      feedback = { kind: "success", text: "算式成立了，再找一组，点亮新的方块。" };
      renderBoard();
      return;
    }

    const base = createArrangementFeedback(level, indexes, completedTargetIndexes);
    newTileIds.forEach((id) => coveredTileIds.add(id));
    if (outcome.targetIndex !== undefined) {
      completedTargetIndexes.add(outcome.targetIndex);
    }
    blockedAttempts = 0;
    lastSuccessfulExpression = outcome.expressionText;
    feedback = {
      kind: "success",
      text: `${base.text}${newTileIds.length > 0 ? ` 新点亮 ${newTileIds.length} 格。` : ""}`
    };
    sound.playIfEnabled("success", progress.soundEnabled);

    if (isLevelComplete(level)) {
      finishLevel();
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    locked = !reducedMotion;
    renderBoard();
    if (locked) {
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        if (destroyed || screen !== "board") {
          return;
        }
        locked = false;
        renderBoard();
      }, 280);
    }
  };

  const requestHint = (): void => {
    const level = currentLevel;
    if (!level || locked || activePointer || hintDepth >= 5) {
      return;
    }
    hintDepth = Math.min(5, hintDepth + 1);
    hintsThisSession += 1;
    progress = recordHintUse(progress, level.id);
    persist();
    hintMessage = getHintMessage(level, indexes, coveredTileIds, completedTargetIndexes, hintDepth);
    feedback = { kind: "info", text: `提示 ${hintDepth}/5：${hintMessage.text}` };
    focusAfterRender(hintDepth >= 5 ? '[data-focus-key="reset"]' : '[data-focus-key="hint"]');
    renderBoard();
  };

  const undoMove = (): void => {
    if (locked || activePointer) {
      return;
    }
    const previous = history.pop();
    if (!previous) {
      return;
    }
    restoreSnapshot(previous);
    hintMessage = null;
    feedback = { kind: "info", text: "已撤销上一次滑轨移动；提示记录不会倒退。" };
    focusAfterRender(history.length === 0 ? '[data-focus-key="reset"]' : '[data-focus-key="undo"]');
    renderBoard();
  };

  const resetLevel = (): void => {
    const level = currentLevel;
    if (!level || locked || activePointer) {
      return;
    }
    resetCount += 1;
    indexes = level.reels.map((reel) => reel.initialIndex);
    coveredTileIds = new Set();
    completedTargetIndexes = new Set();
    history = [];
    moves = 0;
    blockedAttempts = 0;
    allCorrectAddedNew = true;
    hintMessage = null;
    feedback = { kind: "info", text: "已回到固定起点。再试一次，也是在学习。" };
    focusAfterRender('[data-focus-key="reset"]');
    renderBoard();
  };

  const goBackToStation = (): void => {
    clearTransientState();
    scrollStageToTop();
    screen = "station";
    focusAfterRender('[data-screen-heading="true"]');
    renderStation();
  };

  const isLevelComplete = (level: PublishedEquationSliderLevel): boolean => {
    const tileCount = level.reels.reduce((count, reel) => count + reel.tiles.length, 0);
    const targetsComplete = level.mode !== "multi-target" || completedTargetIndexes.size === level.targets.length;
    return coveredTileIds.size === tileCount && targetsComplete;
  };

  const finishLevel = (): void => {
    const level = currentLevel;
    if (!level) {
      return;
    }
    window.clearTimeout(lockTimer);
    locked = false;
    const prior = progress.levels[level.id];
    const badges: EquationSliderBadge[] = [];
    if (hintsThisSession === 0) {
      badges.push("independent");
    }
    if (allCorrectAddedNew) {
      badges.push("all-new");
    }
    if (level.unitLevelNumber === 10) {
      badges.push("review-complete");
    }
    if (resetCount > 0 || (prior?.startedCount ?? 0) > 1) {
      badges.push("try-again");
    }
    completionBadges = badges;
    progress = completeLevelProgress(progress, level.id, {
      independent: hintsThisSession === 0,
      moves,
      badges
    });

    const checkpoint = resolveCompletionCheckpoint(progress, level, chapterCache.get(level.chapterId) ?? []);
    completionKind = checkpoint.kind;
    if (checkpoint.checkpointId) {
      progress = markCheckpointSeen(progress, checkpoint.checkpointId);
      if (checkpoint.kind === "chapter-review") {
        progress = markCheckpointSeen(progress, `${level.unitId}-review`);
      }
    }
    pendingFocusTarget = null;
    persist();
    sound.playIfEnabled("complete", progress.soundEnabled);
    scrollStageToTop();
    screen = "complete";
    renderCompletion();
  };

  const renderCompletion = (): void => {
    clearBoardAnnouncement();
    const level = currentLevel;
    if (!level) {
      scrollStageToTop();
      screen = "map";
      focusAfterRender('[data-screen-heading="true"]');
      renderMap();
      return;
    }
    clearElement(root);
    const chapter = findChapterManifest(level.chapterId);
    const unit = chapter?.units.find((item) => item.id === level.unitId);
    const title = completionKind === "chapter-review"
      ? "整条线路亮起来了"
      : completionKind === "station-review"
        ? "这一站到达了"
        : completionKind === "rest"
          ? "已经走过半站"
          : "轨道点亮";
    const completionHeader = createShellHeader(
      "本关完成",
      title,
      lastSuccessfulExpression ? `你刚才用 ${lastSuccessfulExpression} 点亮了最后一组。` : "你找到了完整的点亮路线。"
    );
    const completionHeading = completionHeader.querySelector<HTMLHeadingElement>("h2");
    completionHeading?.setAttribute("tabindex", "-1");
    root.append(completionHeader);

    const ticket = element("section", "equation-slider__completion-ticket");
    ticket.append(element("span", "equation-slider__ticket-notch", "✦"), element("h3", "", `${chapter?.name ?? "线路"} · 第 ${level.levelNumber} 关`));
    const badges = element("div", "equation-slider__badges");
    if (completionBadges.length === 0) {
      badges.append(element("span", "", "完成本关"));
    } else {
      completionBadges.forEach((badge) => badges.append(element("span", "", badgeLabel(badge))));
    }
    ticket.append(badges);
    ticket.append(element("p", "equation-slider__why", `这关的数学发现：${level.learning.reflectionText}`));

    if (completionKind === "station-review" || completionKind === "chapter-review") {
      const levels = chapterCache.get(level.chapterId) ?? [];
      const reviewLevels = completionKind === "chapter-review"
        ? levels
        : levels.filter((item) => item.unitId === level.unitId);
      const total = completionKind === "chapter-review" ? 50 : 10;
      const completed = reviewLevels.filter((item) => progress.levels[item.id]?.completed).length;
      const independent = reviewLevels.filter((item) => progress.levels[item.id]?.independent).length;
      const review = element("section", "equation-slider__review-summary");
      review.append(
        element("h4", "", completionKind === "chapter-review" ? "线路学习回顾" : `${unit?.name ?? "站区"}回顾`),
        element("p", "", `完成 ${completed}/${total} 关，其中 ${independent} 关曾自己找到路线。`)
      );
      const skills = element("ul", "");
      const reviewSkills = completionKind === "chapter-review"
        ? [...new Set(chapter?.units.flatMap((chapterUnit) => chapterUnit.skillTags) ?? level.learning.skillTags)]
        : (unit?.skillTags ?? level.learning.skillTags);
      reviewSkills.slice(0, completionKind === "chapter-review" ? 5 : 3)
        .forEach((skill) => skills.append(element("li", "", skillLabel(skill))));
      review.append(skills);
      ticket.append(review);
    } else if (completionKind === "rest") {
      const rest = element("section", "equation-slider__rest-card");
      rest.append(element("h4", "", "继续一小站，还是先休息？"), element("p", "", "没有连续签到，也不会丢进度。伸伸手、看看远处，再决定。"));
      ticket.append(rest);
    }

    const actions = element("div", "equation-slider__completion-actions");
    const next = nextLevelInLoadedChapter(level);
    if (completionKind === "rest") {
      if (next) {
        actions.append(createButton("继续一小站", () => startLevel(next)));
      }
      actions.append(createButton("先休息", goBackToStation, { className: "ui-button ui-button--secondary" }));
    } else {
      if (next) {
        actions.append(createButton(level.unitLevelNumber === 10 ? "前往下一站" : "下一关", () => startLevel(next)));
      } else {
        actions.append(createButton("回到线路地图", () => {
          scrollStageToTop();
          screen = "map";
          focusAfterRender('[data-screen-heading="true"]');
          renderMap();
        }));
      }
      actions.append(createButton("关卡列表", goBackToStation, { className: "ui-button ui-button--secondary" }));
    }
    actions.append(createButton("重玩本关", () => startLevel(level), { className: "ui-button ui-button--secondary" }));
    ticket.append(actions);
    root.append(ticket);
    completionHeading?.focus({ preventScroll: true });
  };

  const nextLevelInLoadedChapter = (level: PublishedEquationSliderLevel): PublishedEquationSliderLevel | undefined => {
    return chapterCache.get(level.chapterId)?.find((candidate) => candidate.levelNumber === level.levelNumber + 1);
  };

  const previousPracticeLevel = (level: PublishedEquationSliderLevel): PublishedEquationSliderLevel | undefined => {
    return [...(chapterCache.get(level.chapterId) ?? [])]
      .filter((candidate) => candidate.unitId === level.unitId && candidate.levelNumber < level.levelNumber)
      .sort((a, b) => b.levelNumber - a.levelNumber)[0];
  };

  const guidedReelIndex = (level: PublishedEquationSliderLevel): number => {
    const nextPlan = level.analysis.canonicalPlan[0];
    return nextPlan?.findIndex((targetIndex, reelIndex) => targetIndex !== indexes[reelIndex]) ?? -1;
  };

  const announceBoardUpdate = (level: PublishedEquationSliderLevel): void => {
    const announcement = `${formatCurrentExpression(level, indexes)}。${feedback.text}`;
    if (announcement === lastAnnouncement) {
      return;
    }
    lastAnnouncement = announcement;
    liveRegion.textContent = "";
    window.queueMicrotask(() => {
      if (!destroyed) {
        liveRegion.textContent = announcement;
      }
    });
  };

  const makeSnapshot = (): BoardSnapshot => ({
    indexes: [...indexes],
    coveredTileIds: [...coveredTileIds],
    completedTargetIndexes: [...completedTargetIndexes],
    moves,
    blockedAttempts,
    allCorrectAddedNew
  });

  const restoreSnapshot = (snapshot: BoardSnapshot): void => {
    indexes = [...snapshot.indexes];
    coveredTileIds = new Set(snapshot.coveredTileIds);
    completedTargetIndexes = new Set(snapshot.completedTargetIndexes);
    moves = snapshot.moves;
    blockedAttempts = snapshot.blockedAttempts;
    allCorrectAddedNew = snapshot.allCorrectAddedNew;
  };

  focusAfterRender('[data-screen-heading="true"]');
  renderMap();

  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      loadRequest += 1;
      clearTransientState();
      chapterCache.clear();
      currentLevel = null;
      sound.destroy();
      root.remove();
      liveRegion.remove();
    }
  };
}

function previewResultText(level: PublishedEquationSliderLevel, indexes: readonly number[]): string {
  const outcome = evaluateArrangementOutcome(level, indexes);
  if (outcome.failureReason) {
    return "当前组合暂不能得到非负整数";
  }
  if (level.mode === "equality") {
    return `左边 ${outcome.result ?? "?"} · 右边 ${outcome.rightResult ?? "?"}`;
  }
  return `当前结果 ${outcome.result ?? "?"}`;
}

function targetLabel(level: PublishedEquationSliderLevel): string {
  if (level.mode === "target") {
    return "让中央算式得到";
  }
  if (level.mode === "multi-target") {
    return "依次命中这些目标";
  }
  return "让等号两边一样大";
}

function scaffoldLabel(scaffold: PublishedEquationSliderLevel["learning"]["scaffoldLevel"]): string {
  return {
    guided: "引导关 · 可以跟着提示认识新关系",
    supported: "支持关 · 先自己试，再看一点提示",
    independent: "独立练习 · 提示随时可用",
    transfer: "迁移挑战 · 换一种表达来思考",
    review: "低压力复习站 · 不计时"
  }[scaffold];
}

function badgeLabel(badge: EquationSliderBadge): string {
  return {
    independent: "独立完成",
    "all-new": "一路点亮",
    "review-complete": "复习完成",
    "try-again": "再试一次"
  }[badge];
}

function skillLabel(skill: string): string {
  const labels: Record<string, string> = {
    "part-whole": "部分合成整体",
    addition: "加法关系",
    "addition-transfer": "灵活运用加法",
    "add-sub-transfer": "灵活运用加减",
    "make-ten": "组成 10",
    "commutative-addition": "交换加数",
    "within-20-addition": "20 以内加法",
    compensation: "凑整补偿",
    "two-step": "两步运算",
    subtraction: "减法关系",
    "take-away": "拿走一部分",
    difference: "比较相差",
    "fact-family": "算式家族",
    "inverse-operations": "逆运算",
    "left-to-right-add-sub": "加减从左往右",
    "multiplication-groups": "相同数量分组",
    "times-2-5-10": "2、5、10 的乘法",
    "multiplication-facts": "乘法事实",
    doubling: "加倍关系",
    "exact-division": "整除",
    "equal-sharing": "平均分",
    "multiply-divide-inverse": "乘除互逆",
    "order-of-operations": "运算顺序",
    "mixed-operations": "四则混合",
    "multi-target": "多目标规划",
    "coverage-planning": "点亮路线规划",
    "equal-sign": "等式平衡",
    balance: "左右同值",
    "unique-route": "唯一路线",
    "deductive-reasoning": "排除与推理",
    "coverage-strategy": "覆盖策略",
    "cross-chapter-transfer": "跨章迁移",
    "equation-reasoning": "等式推理"
  };
  return labels[skill] ?? "综合数学关系";
}

function completedCountForChapter(progress: EquationSliderProgress, chapterNumber: number): number {
  const prefix = `es-${chapterNumber}-`;
  return Object.entries(progress.levels).filter(([id, record]) => id.startsWith(prefix) && record.completed).length;
}

function completedCountForUnit(progress: EquationSliderProgress, chapterNumber: number, unitNumber: number): number {
  const start = (unitNumber - 1) * 10 + 1;
  const end = unitNumber * 10;
  let count = 0;
  for (let levelNumber = start; levelNumber <= end; levelNumber += 1) {
    const id = `es-${chapterNumber}-${String(levelNumber).padStart(2, "0")}`;
    if (progress.levels[id]?.completed) {
      count += 1;
    }
  }
  return count;
}

function nextIncompleteLevelId(
  levels: readonly PublishedEquationSliderLevel[],
  progress: EquationSliderProgress
): string | undefined {
  return levels.find((level) => !progress.levels[level.id]?.completed)?.id;
}

function summaryItem(label: string, value: string): HTMLElement {
  const item = element("div", "equation-slider__summary-item");
  item.append(element("span", "", label), element("strong", "", value));
  return item;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function createEquationSound(): {
  readonly play: (kind: "move" | "success" | "complete") => void;
  readonly playIfEnabled: (kind: "move" | "success" | "complete", enabled: boolean) => void;
  readonly destroy: () => void;
} {
  let audioContext: AudioContext | null = null;
  const oscillators = new Set<OscillatorNode>();
  let destroyed = false;

  const play = (kind: "move" | "success" | "complete"): void => {
    if (destroyed || typeof AudioContext === "undefined") {
      return;
    }
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    const notes = kind === "move"
      ? [{ frequency: 330, delay: 0, duration: 0.045 }]
      : kind === "success"
        ? [{ frequency: 523, delay: 0, duration: 0.08 }, { frequency: 659, delay: 0.07, duration: 0.1 }]
        : [{ frequency: 523, delay: 0, duration: 0.09 }, { frequency: 659, delay: 0.08, duration: 0.1 }, { frequency: 784, delay: 0.17, duration: 0.14 }];
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + note.delay;
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "move" ? 0.035 : 0.075, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.addEventListener("ended", () => oscillators.delete(oscillator), { once: true });
      oscillators.add(oscillator);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.02);
    }
  };

  return {
    play,
    playIfEnabled(kind, enabled): void {
      if (enabled) {
        play(kind);
      }
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const oscillator of oscillators) {
        try {
          oscillator.stop();
          oscillator.disconnect();
        } catch {
          // A short oscillator may already have stopped.
        }
      }
      oscillators.clear();
      if (audioContext) {
        void audioContext.close();
        audioContext = null;
      }
    }
  };
}
