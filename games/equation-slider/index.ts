import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import {
  createInitialBoardSession,
  reduceBoardSession,
  transitionBoardSession,
  type BoardSession
} from "./board-state";
import {
  createArrangementFeedback,
  getDynamicHint,
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
  markCompletionCheckpointSeen,
  markTutorialCompleted,
  markUpgradeNoticeSeen,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  setSoundEnabled,
  type EquationSliderProgress
} from "./progress";
import {
  beginPointerGesture,
  finishPointerGesture,
  updatePointerGesture,
  type PointerGesture
} from "./pointer-state";
import { createBoardRenderModel, type TilePosition } from "./render-model";
import { evaluateArrangementOutcome, getMovableReels } from "./solver";
import type {
  CompletionCheckpoint,
  MoveDirection,
  PublishedEquationSliderLevel,
  ReelDefinition
} from "./types";
import "./styles.css";

type TutorialStep = "move-target" | "coverage" | null;
type AudioCue = "move" | "success" | "complete" | "enabled";

interface ActivePointer {
  readonly window: HTMLElement;
  readonly reelRoot: HTMLElement;
  readonly tileHeight: number;
  readonly tapTileId: string;
  gesture: PointerGesture;
}

interface ReelDom {
  readonly reel: ReelDefinition;
  readonly root: HTMLElement;
  readonly window: HTMLElement;
  readonly controls: readonly HTMLButtonElement[];
  readonly tileElements: ReadonlyMap<string, HTMLButtonElement>;
}

export const equationSliderGame: GameDefinition = {
  id: "equation-slider",
  title: "算式滑轨",
  description: "移动数字与运算滑轨，组成正确关系并点亮每一枚信号灯。",
  subject: "数学",
  recommendedAge: "6-10 岁",
  learningGoal: "练习数感、四则运算、运算顺序、等式理解和组合推理。",
  status: "可玩",
  playLabel: "进入轨道站",
  mount(context: MountGameContext): MountedGame {
    return mountEquationSlider(context);
  }
};

function mountEquationSlider(context: MountGameContext): MountedGame {
  const root = element("section", "equation-slider");
  root.dataset.gameRuntime = "equation-slider-v3";
  context.container.append(root);

  const v3Value = context.storage.get<unknown>("progress-v3", null);
  const legacyValue = v3Value ?? context.storage.get<unknown>("progress", null);
  const loaded = loadEquationSliderProgress(legacyValue);
  let progress = loaded.progress;
  const canPersist = loaded.canPersist;
  let showUpgradeNotice = progress.legacy !== undefined && !progress.upgradeNoticeSeen;
  let destroyed = false;
  let requestId = 0;
  let currentLevel: PublishedEquationSliderLevel | null = null;
  let currentChapterId = "chapter-1";
  let disposeActiveBoard: (() => void) | null = null;
  const chapterCache = new Map<string, readonly PublishedEquationSliderLevel[]>();
  const audio = createAudioController();

  const persist = (): void => {
    if (canPersist) context.storage.set("progress-v3", progress);
  };
  if (loaded.migrated) persist();

  const clearActiveBoard = (): void => {
    disposeActiveBoard?.();
    disposeActiveBoard = null;
  };

  const loadChapter = async (chapterId: string): Promise<readonly PublishedEquationSliderLevel[]> => {
    const cached = chapterCache.get(chapterId);
    if (cached) return cached;
    const levels = await loadEquationSliderChapter(chapterId);
    chapterCache.set(chapterId, levels);
    return levels;
  };

  const openLevel = (level: PublishedEquationSliderLevel, tutorial = false): void => {
    if (destroyed) return;
    clearActiveBoard();
    currentLevel = level;
    currentChapterId = level.chapterId;
    progress = recordLevelStart(progress, level.id);
    persist();
    disposeActiveBoard = renderBoard(level, tutorial);
    const stage = root.parentElement;
    if (stage) stage.scrollTop = 0;
  };

  const openLevelById = async (chapterId: string, levelId: string, tutorial = false): Promise<void> => {
    const request = ++requestId;
    renderLoading("正在接通信号……");
    try {
      const levels = await loadChapter(chapterId);
      if (destroyed || request !== requestId) return;
      const level = levels.find((candidate) => candidate.id === levelId);
      if (!level) throw new Error(`找不到关卡 ${levelId}`);
      openLevel(level, tutorial);
    } catch (error) {
      if (destroyed || request !== requestId) return;
      renderError(error instanceof Error ? error.message : "关卡加载失败");
    }
  };

  const renderRouteMap = (): void => {
    clearActiveBoard();
    currentLevel = null;
    root.replaceChildren();
    const header = createPageHeader("算式滑轨线路图", "四条线路、二十个学习站，按自己的节奏出发。");
    const exit = button("返回大厅", context.onExit, "ui-button ui-button--secondary");
    header.append(exit);
    const routes = element("div", "equation-slider__routes");
    for (const chapter of equationSliderChapterManifest) {
      const completed = Object.entries(progress.levels)
        .filter(([id, record]) => id.startsWith(`es-${chapter.number}-`) && record.completed).length;
      const route = button(
        `${chapter.name}，已完成 ${completed} / ${chapter.levelCount} 关`,
        () => void renderChapterMap(chapter.id),
        `equation-slider__route route-${chapter.color}`
      );
      route.dataset.chapterId = chapter.id;
      route.replaceChildren(
        element("span", "equation-slider__route-number", String(chapter.number)),
        element("strong", "", chapter.name),
        element("small", "", chapter.subtitle),
        element("span", "equation-slider__route-progress", `${completed}/${chapter.levelCount}`)
      );
      routes.append(route);
    }
    root.append(header, routes);
  };

  const renderChapterMap = async (chapterId: string): Promise<void> => {
    const request = ++requestId;
    currentChapterId = chapterId;
    renderLoading("正在展开关卡线路……");
    try {
      const levels = await loadChapter(chapterId);
      if (destroyed || request !== requestId) return;
      clearActiveBoard();
      root.replaceChildren();
      const chapter = findChapterManifest(chapterId);
      if (!chapter) throw new Error("线路资料缺失");
      const header = createPageHeader(chapter.name, chapter.subtitle);
      header.append(button("线路地图", renderRouteMap, "ui-button ui-button--secondary"));
      const stations = element("div", `equation-slider__station-line route-${chapter.color}`);
      for (let stationIndex = 0; stationIndex < 5; stationIndex += 1) {
        const station = chapter.units[stationIndex];
        const stationLevels = levels.filter((level) => Math.floor((level.order - 1) / 10) === stationIndex);
        const card = element("section", "equation-slider__station");
        card.dataset.stationId = station?.id ?? `${chapterId}-station-${stationIndex + 1}`;
        card.append(
          element("span", "equation-slider__station-sign", String(stationIndex + 1)),
          element("h3", "", station?.name ?? `第 ${stationIndex + 1} 站`),
          element("p", "", station?.shortGoal ?? "关卡正在重建")
        );
        const lamps = element("div", "equation-slider__level-lamps");
        for (const level of stationLevels) {
          const state = levelMapState(progress.levels[level.id]);
          const levelButton = button(
            `第 ${level.order} 关，${level.learning.objective}`,
            () => openLevel(level, !progress.tutorialCompleted && level.id === "es-1-01"),
            `equation-slider__level-button is-${state}`
          );
          levelButton.dataset.levelId = level.id;
          levelButton.replaceChildren(
            element("span", "equation-slider__lamp-bulb", ""),
            element("small", "", String(level.order))
          );
          lamps.append(levelButton);
        }
        if (stationLevels.length === 0) {
          lamps.append(element("p", "equation-slider__station-pending", "本阶段关卡正在通过质量门禁。"));
        }
        card.append(lamps);
        stations.append(card);
      }
      root.append(header, stations);
    } catch (error) {
      if (destroyed || request !== requestId) return;
      renderError(error instanceof Error ? error.message : "线路加载失败");
    }
  };

  const renderLoading = (message: string): void => {
    clearActiveBoard();
    root.replaceChildren(element("div", "equation-slider__loading", message));
  };

  const renderError = (message: string): void => {
    clearActiveBoard();
    const panel = element("section", "equation-slider__error");
    panel.append(
      element("h2", "", "信号暂时中断"),
      element("p", "", message),
      button("返回线路地图", renderRouteMap, "ui-button")
    );
    root.replaceChildren(panel);
  };

  const renderBoard = (level: PublishedEquationSliderLevel, startTutorial: boolean): (() => void) => {
    root.replaceChildren();
    const abortController = new AbortController();
    const signal = abortController.signal;
    let session: BoardSession = createInitialBoardSession(level);
    let feedback: FeedbackMessage = { kind: "info", text: "移动一条滑轨，让中央算式命中目标。" };
    let hint: HintMessage | null = null;
    let hintDepth = 0;
    let hintsThisSession = 0;
    let resetCount = 0;
    let tutorialStep: TutorialStep = startTutorial ? "move-target" : null;
    let pointer: ActivePointer | null = null;
    let feedbackTimer: number | undefined;
    let suppressClickUntil = 0;
    let completionRecorded = false;
    let completionCheckpoint: CompletionCheckpoint = { kind: "normal" };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const header = element("header", "equation-slider__compact-header");
    const heading = element("div", "equation-slider__heading");
    heading.append(
      element("span", "equation-slider__eyebrow", `${chapterName(level)} · 第 ${level.order} 关`),
      element("h2", "", stationName(level))
    );
    const headerActions = element("div", "equation-slider__header-actions");
    const soundButton = button(
      progress.soundEnabled ? "关闭声音" : "开启声音",
      () => {
        const enabled = !progress.soundEnabled;
        progress = setSoundEnabled(progress, enabled);
        persist();
        soundButton.setAttribute("aria-label", progress.soundEnabled ? "关闭声音" : "开启声音");
        soundButton.textContent = progress.soundEnabled ? "🔊" : "🔇";
        if (enabled) audio.play("enabled");
      },
      "ui-button ui-button--ghost",
      signal
    );
    soundButton.textContent = progress.soundEnabled ? "🔊" : "🔇";
    headerActions.append(
      button("关卡列表", () => void renderChapterMap(level.chapterId), "ui-button ui-button--secondary", signal),
      button("重新教程", () => void openLevelById("chapter-1", "es-1-01", true), "ui-button ui-button--ghost", signal),
      soundButton
    );
    header.append(heading, headerActions);

    const statusStrip = element("section", "equation-slider__core-status");
    const targetCard = element("div", "equation-slider__target-card");
    targetCard.dataset.levelTarget = "true";
    targetCard.append(
      element("span", "", targetLabel(level)),
      element("strong", "", targetValue(level))
    );
    const expression = element("output", "equation-slider__current-expression");
    const coverageSummary = element("div", "equation-slider__coverage-summary");
    coverageSummary.append(element("span", "", "信号灯"));
    const coverageProgress = element("strong", "", `0/${level.requiredTileIds.length}`);
    coverageProgress.dataset.coverageProgress = "true";
    coverageSummary.append(coverageProgress);
    const moveCount = element("span", "equation-slider__move-count", "0");
    moveCount.dataset.moveCount = "true";
    moveCount.setAttribute("aria-label", "移动次数");
    const requiredTileCount = element("span", "equation-slider__sr-only", String(level.requiredTileIds.length));
    requiredTileCount.dataset.requiredTileCount = "true";
    statusStrip.append(targetCard, expression, coverageSummary, moveCount, requiredTileCount);

    const board = element("section", "equation-slider__track");
    board.dataset.equationBoard = "true";
    board.dataset.levelId = level.id;
    board.setAttribute("aria-label", "算式滑轨棋盘");
    board.style.setProperty("--slot-count", String(level.slots.length));
    const reelDoms = new Map<string, ReelDom>();
    let movableIndex = 0;
    for (const slot of level.slots) {
      if (slot.kind === "fixed-token") {
        const fixed = element("span", "equation-slider__fixed-token", String(slot.token));
        fixed.dataset.fixedToken = String(slot.token);
        fixed.setAttribute("role", "math");
        fixed.setAttribute("aria-label", slot.ariaLabel);
        board.append(fixed);
        continue;
      }
      const reelNumber = movableIndex + 1;
      const reelRoot = element("div", "equation-slider__reel");
      reelRoot.dataset.reelId = slot.reel.id;
      reelRoot.dataset.movableIndex = String(movableIndex);
      const up = button("↑", () => dispatchMove(slot.reel.id, "up"), "equation-slider__reel-control", signal);
      up.dataset.controlDirection = "up";
      up.setAttribute("aria-label", `第 ${reelNumber} 列向上移动`);
      const reelWindow = element("div", "equation-slider__reel-window");
      reelWindow.dataset.reelWindow = "true";
      reelWindow.tabIndex = 0;
      reelWindow.setAttribute("role", "group");
      reelWindow.setAttribute("aria-roledescription", slot.reel.kind === "number" ? "数字滑轨" : "运算符滑轨");
      const tileElements = new Map<string, HTMLButtonElement>();
      for (const tile of slot.reel.tiles) {
        const tileButton = element("button", "equation-slider__tile");
        tileButton.type = "button";
        tileButton.tabIndex = -1;
        tileButton.dataset.tileId = tile.id;
        tileButton.textContent = String(tile.value);
        tileButton.addEventListener("click", () => {
          if (performance.now() < suppressClickUntil) return;
          const position = tileButton.dataset.position as TilePosition | undefined;
          if (position === "previous") dispatchMove(slot.reel.id, "up");
          if (position === "next") dispatchMove(slot.reel.id, "down");
        }, { signal });
        tileElements.set(tile.id, tileButton);
        reelWindow.append(tileButton);
      }
      const down = button("↓", () => dispatchMove(slot.reel.id, "down"), "equation-slider__reel-control", signal);
      down.dataset.controlDirection = "down";
      down.setAttribute("aria-label", `第 ${reelNumber} 列向下移动`);
      reelRoot.append(up, reelWindow, down);
      board.append(reelRoot);
      const reelDom: ReelDom = {
        reel: slot.reel,
        root: reelRoot,
        window: reelWindow,
        controls: [up, down],
        tileElements
      };
      reelDoms.set(slot.reel.id, reelDom);
      installPointerAdapter(reelDom);
      reelWindow.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        dispatchMove(slot.reel.id, event.key === "ArrowUp" ? "up" : "down");
      }, { signal });
      movableIndex += 1;
    }

    const coverageDock = element("div", "equation-slider__coverage-dock");
    coverageDock.setAttribute("aria-label", "需要点亮的滑轨方块");
    for (const tileId of level.requiredTileIds) {
      const lamp = element("span", "equation-slider__coverage-lamp");
      lamp.dataset.coverageFor = tileId;
      coverageDock.append(lamp);
    }

    const actions = element("div", "equation-slider__actions");
    actions.dataset.primaryActions = "true";
    const undoButton = button("撤销", () => {
      window.clearTimeout(feedbackTimer);
      session = reduceBoardSession(level, session, { type: "undo" });
      hint = null;
      feedback = { kind: "info", text: "已回到上一步。" };
      if (tutorialStep === "coverage" && session.present.completedTargetIds.size === 0) tutorialStep = "move-target";
      updateBoard();
    }, "ui-button ui-button--secondary", signal);
    const hintButton = button("提示", () => {
      hintDepth = Math.min(3, hintDepth + 1);
      hintsThisSession += 1;
      progress = recordHintUse(progress, level.id);
      persist();
      hint = getDynamicHint(level, session.present, hintDepth);
      updateBoard();
    }, "ui-button ui-button--secondary", signal);
    const resetButton = button("重置", () => {
      window.clearTimeout(feedbackTimer);
      session = reduceBoardSession(level, session, { type: "reset" });
      resetCount += 1;
      hint = null;
      hintDepth = 0;
      feedback = { kind: "info", text: "轨道已回到本关起点。" };
      if (tutorialStep !== null) tutorialStep = "move-target";
      updateBoard();
    }, "ui-button ui-button--secondary", signal);
    actions.append(undoButton, hintButton, resetButton);

    const feedbackPanel = element("output", "equation-slider__feedback", feedback.text);
    feedbackPanel.setAttribute("role", "status");
    feedbackPanel.setAttribute("aria-live", "polite");
    const hintPanel = element("aside", "equation-slider__hint");
    hintPanel.hidden = true;
    const tutorialPanel = element("aside", "equation-slider__coach");
    const completionPanel = element("section", "equation-slider__completion");
    completionPanel.hidden = true;
    const liveRegion = element("div", "equation-slider__sr-only");
    liveRegion.setAttribute("aria-live", "polite");

    root.append(header, statusStrip, board, coverageDock, actions, feedbackPanel, hintPanel, tutorialPanel, completionPanel, liveRegion);

    if (showUpgradeNotice) {
      const notice = element("aside", "equation-slider__upgrade-notice");
      notice.append(
        element("p", "", "滑轨游戏已升级，新的关卡进度从这里开始。"),
        button("知道了", () => {
          showUpgradeNotice = false;
          progress = markUpgradeNoticeSeen(progress);
          persist();
          notice.remove();
        }, "ui-button ui-button--secondary", signal)
      );
      root.insertBefore(notice, board);
    }

    updateBoard();

    function dispatchMove(
      reelId: string,
      direction: MoveDirection,
      source: "direct" | "drag" = "direct"
    ): void {
      if (source === "direct" && pointer !== null) return;
      if (source === "direct" && session.present.status !== "ready") return;
      if (source === "drag" && session.present.status !== "dragging") return;
      const transition = transitionBoardSession(level, session, {
        type: "commit-move",
        reelId,
        direction,
        source,
        useFeedbackLock: !reducedMotion
      });
      if (!transition.committed) {
        session = transition.session;
        if (transition.rejectionReason === "same-visible-value") {
          hint = null;
          hintDepth = 0;
          feedback = {
            kind: "info",
            text: `相邻方块也是 ${transition.rejectedValue ?? "同一个值"}，中央算式不会改变。向另一方向移动，让数学关系发生变化。`
          };
          updateBoard();
        }
        return;
      }
      session = transition.session;
      hint = null;
      hintDepth = 0;
      feedback = createArrangementFeedback(level, session.present);
      if (transition.outcome?.valid) {
        const newTileCount = transition.newlyCoveredTileIds.length;
        const newTargetCount = transition.newlyCompletedTargetIds.length;
        if (session.present.status === "complete") {
          feedback = { kind: "success", text: "全部目标和信号都完成了。" };
        } else if (newTargetCount > 0 && newTileCount > 0) {
          feedback = {
            kind: "success",
            text: `命中 ${newTargetCount} 个新目标，并点亮 ${newTileCount} 个新方块。`
          };
        } else if (newTargetCount > 0) {
          feedback = { kind: "success", text: `命中 ${newTargetCount} 个新目标，继续寻找新方块。` };
        } else if (newTileCount > 0) {
          feedback = { kind: "success", text: `目标已经命中过，这次又点亮 ${newTileCount} 个新方块。` };
        } else {
          feedback = { kind: "success", text: "算式成立，但这些目标和方块已经亮了；试试另一组。" };
        }
      }
      if (
        tutorialStep === "move-target"
        && transition.outcome?.valid
        && session.present.indexes[0] === 2
        && session.present.indexes[1] === 2
      ) {
        tutorialStep = "coverage";
        progress = markTutorialCompleted(progress);
        persist();
        liveRegion.textContent = "做到了，4 加 2 等于 6。现在把六个数字都点亮。";
      }
      if (session.present.status === "feedback-lock") {
        window.clearTimeout(feedbackTimer);
        feedbackTimer = window.setTimeout(() => {
          session = reduceBoardSession(level, session, { type: "feedback-unlock" });
          updateBoard();
        }, 280);
      }
      if (progress.soundEnabled) {
        audio.play(session.present.status === "complete" ? "complete" : transition.outcome?.valid ? "success" : "move");
      }
      if (session.present.status === "complete") recordCompletion();
      updateBoard();
    }

    function installPointerAdapter(reelDom: ReelDom): void {
      reelDom.window.addEventListener("pointerdown", (event) => {
        if (pointer || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        if (session.present.status !== "ready") return;
        const tile = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tile-id]") : null;
        if (!tile) return;
        const tileHeight = tile.getBoundingClientRect().height || 42;
        pointer = {
          window: reelDom.window,
          reelRoot: reelDom.root,
          tileHeight,
          tapTileId: tile.dataset.tileId ?? "",
          gesture: beginPointerGesture({
            pointerId: event.pointerId,
            reelId: reelDom.reel.id,
            clientY: event.clientY,
            time: event.timeStamp
          })
        };
        reelDom.window.setPointerCapture(event.pointerId);
      }, { signal });

      reelDom.window.addEventListener("pointermove", (event) => {
        if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
        const wasDragging = pointer.gesture.dragging;
        const preview = updatePointerGesture(pointer.gesture, event.clientY, event.timeStamp, pointer.tileHeight);
        pointer.gesture = preview.gesture;
        if (!wasDragging && preview.gesture.dragging) {
          session = reduceBoardSession(level, session, { type: "drag-start" });
          pointer.reelRoot.classList.add("is-dragging");
          updateBoard();
        }
        if (!preview.gesture.dragging) return;
        event.preventDefault();
        pointer.reelRoot.style.setProperty("--preview-y", `${preview.offsetY}px`);
        const previewIndexes = [...session.present.indexes];
        const reelIndex = getMovableReels(level).findIndex((reel) => reel.id === pointer?.gesture.reelId);
        if (reelIndex >= 0) {
          previewIndexes[reelIndex] = wrapThree(previewIndexes[reelIndex] + (preview.offsetY > 0 ? -1 : 1));
          expression.textContent = displayExpression(level, previewIndexes);
          expression.dataset.preview = "true";
        }
      }, { signal });

      reelDom.window.addEventListener("pointerup", (event) => finishPointer(event, false), { signal });
      reelDom.window.addEventListener("pointercancel", (event) => finishPointer(event, true), { signal });
      reelDom.window.addEventListener("lostpointercapture", (event) => {
        if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
        cancelPointer();
      }, { signal });
    }

    function finishPointer(event: PointerEvent, cancelled: boolean): void {
      if (!pointer || pointer.gesture.pointerId !== event.pointerId) return;
      const active = pointer;
      const preview = updatePointerGesture(active.gesture, event.clientY, event.timeStamp, active.tileHeight);
      active.gesture = preview.gesture;
      const result = finishPointerGesture(active.gesture, active.tileHeight);
      pointer = null;
      active.reelRoot.classList.remove("is-dragging");
      active.reelRoot.style.removeProperty("--preview-y");
      if (result.suppressClick) suppressClickUntil = performance.now() + 400;
      if (active.window.hasPointerCapture(event.pointerId)) active.window.releasePointerCapture(event.pointerId);
      if (!cancelled && !active.gesture.dragging) {
        suppressClickUntil = performance.now() + 400;
        const tappedTile = reelDoms.get(active.gesture.reelId)?.tileElements.get(active.tapTileId);
        const position = tappedTile?.dataset.position as TilePosition | undefined;
        if (position === "previous") dispatchMove(active.gesture.reelId, "up");
        if (position === "next") dispatchMove(active.gesture.reelId, "down");
        return;
      }
      if (cancelled || !result.commit || !result.direction) {
        session = reduceBoardSession(level, session, { type: "drag-cancel" });
        updateBoard();
        return;
      }
      dispatchMove(active.gesture.reelId, result.direction, "drag");
    }

    function cancelPointer(): void {
      if (!pointer) return;
      pointer.reelRoot.classList.remove("is-dragging");
      pointer.reelRoot.style.removeProperty("--preview-y");
      pointer = null;
      session = reduceBoardSession(level, session, { type: "drag-cancel" });
      updateBoard();
    }

    function recordCompletion(): void {
      if (completionRecorded) return;
      completionRecorded = true;
      const independent = hintsThisSession === 0 && resetCount === 0;
      progress = completeLevelProgress(progress, level.id, {
        independent,
        moves: session.present.moveCount,
        badges: independent ? ["independent", "all-new"] : ["review-complete"]
      });
      completionCheckpoint = resolveCompletionCheckpoint(
        progress,
        level,
        chapterCache.get(level.chapterId) ?? [level]
      );
      progress = markCompletionCheckpointSeen(progress, completionCheckpoint, level);
      persist();
    }

    function updateBoard(): void {
      const model = createBoardRenderModel(level, session.present);
      expression.textContent = displayExpression(level, session.present.indexes);
      expression.removeAttribute("data-preview");
      coverageProgress.textContent = `${session.present.coveredTileIds.size}/${level.requiredTileIds.length}`;
      moveCount.textContent = String(session.present.moveCount);
      board.dataset.boardStatus = session.present.status;
      const locked = session.present.status !== "ready";
      for (const slot of model.slots) {
        if (slot.kind !== "movable-reel") continue;
        const dom = reelDoms.get(slot.reel.id);
        if (!dom) continue;
        dom.root.classList.toggle("is-hinted", hint?.reelId === slot.reel.id);
        const currentIndex = session.present.indexes[slot.movableIndex];
        for (const [controlIndex, control] of dom.controls.entries()) {
          const direction: MoveDirection = controlIndex === 0 ? "up" : "down";
          const nextIndex = wrapThree(currentIndex + (direction === "up" ? -1 : 1));
          const sameVisibleValue = slot.reel.tiles[currentIndex]?.value === slot.reel.tiles[nextIndex]?.value;
          control.disabled = locked;
          control.dataset.sameVisibleValue = String(sameVisibleValue);
          control.setAttribute(
            "aria-label",
            `第 ${slot.movableIndex + 1} 列向${direction === "up" ? "上" : "下"}移动${sameVisibleValue ? "；相邻方块数值相同，按下会提示改走另一方向" : ""}`
          );
          control.title = sameVisibleValue ? "相邻方块数值相同；改走另一方向会改变算式" : "";
        }
        dom.window.setAttribute("aria-disabled", String(locked));
        const current = slot.tiles.find((tile) => tile.position === "current");
        const reelStateDescription = slot.tiles
          .map((tile) => `${positionLabel(tile.position)} ${String(tile.tile.value)}，${tile.lit ? "已点亮" : "未点亮"}`)
          .join("；");
        dom.window.setAttribute(
          "aria-label",
          `第 ${slot.movableIndex + 1} 列，${slot.reel.kind === "number" ? "数字" : "运算符"}滑轨；${reelStateDescription}；中央值是 ${String(current?.tile.value ?? "未知")}；可用上下方向键移动`
        );
        for (const tileModel of slot.tiles) {
          const tile = dom.tileElements.get(tileModel.tile.id);
          if (!tile) continue;
          tile.dataset.position = tileModel.position;
          // Keep the pressed tile enabled while dragging so disabling it cannot
          // cancel the browser's active pointer capture. Direct adapters are
          // still serialized by dispatchMove and all other controls are locked.
          tile.disabled = session.present.status === "feedback-lock" || session.present.status === "complete";
          tile.classList.toggle("is-current", tileModel.selected);
          tile.classList.toggle("is-lit", tileModel.lit);
          tile.setAttribute("aria-pressed", String(tileModel.selected));
          tile.setAttribute("aria-label", `${positionLabel(tileModel.position)}${String(tileModel.tile.value)}${tileModel.lit ? "，已点亮" : "，未点亮"}`);
          tile.removeAttribute("data-tutorial-target");
        }
      }
      if (tutorialStep === "move-target") {
        const tutorialTile = reelDoms.get("es-1-01-right")?.tileElements.get("es-1-01-right-2");
        if (tutorialTile) tutorialTile.dataset.tutorialTarget = "true";
      }
      for (const lamp of coverageDock.querySelectorAll<HTMLElement>("[data-coverage-for]")) {
        lamp.classList.toggle("is-lit", session.present.coveredTileIds.has(lamp.dataset.coverageFor ?? ""));
      }
      undoButton.disabled = locked || session.undoStack.length === 0;
      hintButton.disabled = locked;
      resetButton.disabled = locked;
      feedbackPanel.textContent = feedback.text;
      feedbackPanel.classList.toggle("is-success", feedback.kind === "success");
      hintPanel.hidden = hint === null;
      hintPanel.textContent = hint?.text ?? "";
      renderTutorial();
      renderCompletion();
    }

    function renderTutorial(): void {
      tutorialPanel.replaceChildren();
      tutorialPanel.hidden = tutorialStep === null;
      tutorialPanel.removeAttribute("data-tutorial-step");
      if (tutorialStep === null) return;
      tutorialPanel.dataset.tutorialStep = tutorialStep;
      const copy = tutorialStep === "move-target"
        ? "把右边滑轨上方的 2 移到中央，让中央算式得到 6。"
        : "正确关系会点亮用到的数字。把六个数字都点亮。";
      tutorialPanel.append(
        element("p", "", copy),
        button("跳过教程", () => {
          tutorialStep = null;
          progress = markTutorialCompleted(progress);
          persist();
          updateBoard();
        }, "ui-button ui-button--secondary", signal)
      );
    }

    function renderCompletion(): void {
      completionPanel.replaceChildren();
      completionPanel.hidden = session.present.status !== "complete";
      if (session.present.status !== "complete") return;
      completionPanel.dataset.completionCard = "true";
      completionPanel.dataset.checkpointKind = completionCheckpoint.kind;
      const chapterLevels = chapterCache.get(level.chapterId) ?? [];
      const nextLevel = chapterLevels.find((candidate) => candidate.order === level.order + 1);
      completionPanel.append(
        element("span", "equation-slider__completion-signal", "✓"),
        element("h3", "", completionHeading(completionCheckpoint)),
        element(
          "p",
          "",
          `${level.requiredTileIds.length} 个信号都已点亮，共移动 ${session.present.moveCount} 次，使用提示 ${hintsThisSession} 次。${completionReflection(completionCheckpoint, level)}`
        ),
        button(nextLevel ? "下一关" : "查看关卡列表", () => {
          if (nextLevel) openLevel(nextLevel, false);
          else void renderChapterMap(level.chapterId);
        }, "ui-button", signal),
        button("再玩一次", () => openLevel(level, false), "ui-button ui-button--secondary", signal)
      );
    }

    return () => {
      abortController.abort();
      window.clearTimeout(feedbackTimer);
      if (pointer?.window.hasPointerCapture(pointer.gesture.pointerId)) {
        pointer.window.releasePointerCapture(pointer.gesture.pointerId);
      }
      pointer = null;
    };
  };

  void openLevelById("chapter-1", "es-1-01", !progress.tutorialCompleted);

  return {
    destroy(): void {
      destroyed = true;
      requestId += 1;
      clearActiveBoard();
      audio.destroy();
      root.replaceChildren();
      root.remove();
    }
  };
}

function createPageHeader(title: string, subtitle: string): HTMLElement {
  const header = element("header", "equation-slider__page-header");
  const copy = element("div");
  copy.append(element("h2", "", title), element("p", "", subtitle));
  header.append(copy);
  return header;
}

function targetLabel(level: PublishedEquationSliderLevel): string {
  if (level.mode === "equality") return "平衡目标";
  return level.mode === "multi-target" ? "多目标" : "目标";
}

function targetValue(level: PublishedEquationSliderLevel): string {
  if (level.mode === "equality") return `= ${level.targets[0].rightExpression.join(" ")}`;
  return level.targets.map((target) => target.value).join(" · ");
}

function displayExpression(level: PublishedEquationSliderLevel, indexes: readonly number[]): string {
  const outcome = evaluateArrangementOutcome(level, indexes);
  if (level.mode === "equality") return outcome.expressionText;
  return `${outcome.expressionText} = ${outcome.result ?? "?"}`;
}

function chapterName(level: PublishedEquationSliderLevel): string {
  return findChapterManifest(level.chapterId)?.name ?? "算式滑轨";
}

function stationName(level: PublishedEquationSliderLevel): string {
  return findChapterManifest(level.chapterId)?.units.find((station) => station.id === level.stationId)?.name
    ?? "学习站";
}

function completionHeading(checkpoint: CompletionCheckpoint): string {
  if (checkpoint.kind === "chapter-review") return "线路完成";
  if (checkpoint.kind === "station-review") return "站区完成";
  if (checkpoint.kind === "rest") return "本关完成 · 小发现";
  return "本关完成";
}

function completionReflection(
  checkpoint: CompletionCheckpoint,
  level: PublishedEquationSliderLevel
): string {
  if (checkpoint.kind === "chapter-review") {
    return `线路回顾：${level.learning.reflection}`;
  }
  if (checkpoint.kind === "station-review") {
    return `站区回顾：${level.learning.reflection}`;
  }
  if (checkpoint.kind === "rest") {
    return `小发现（可以直接去下一关）：${level.learning.reflection}`;
  }
  return `本关回顾：${level.learning.reflection}`;
}

function createAudioController(): {
  readonly play: (cue: AudioCue) => void;
  readonly destroy: () => void;
} {
  type AudioContextConstructor = new () => AudioContext;
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  let audioContext: AudioContext | undefined;

  const schedule = (cue: AudioCue): void => {
    if (!AudioContextClass) return;
    try {
      audioContext ??= new AudioContextClass();
      const notes = cue === "complete"
        ? [523, 659]
        : [cue === "success" ? 523 : cue === "enabled" ? 440 : 294];
      const playNotes = (): void => {
        if (!audioContext || audioContext.state === "closed") return;
        const start = audioContext.currentTime;
        notes.forEach((frequency, index) => {
          const oscillator = audioContext!.createOscillator();
          const gain = audioContext!.createGain();
          const noteStart = start + index * 0.07;
          const noteEnd = noteStart + (cue === "complete" ? 0.11 : 0.055);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, noteStart);
          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.exponentialRampToValueAtTime(cue === "move" ? 0.025 : 0.045, noteStart + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
          oscillator.connect(gain);
          gain.connect(audioContext!.destination);
          oscillator.start(noteStart);
          oscillator.stop(noteEnd + 0.01);
        });
      };
      if (audioContext.state === "suspended") {
        void audioContext.resume().then(playNotes).catch(() => undefined);
      } else {
        playNotes();
      }
    } catch {
      // Audio is optional; unsupported or policy-blocked contexts fail silently.
    }
  };

  return {
    play: schedule,
    destroy: () => {
      if (!audioContext || audioContext.state === "closed") return;
      void audioContext.close().catch(() => undefined);
      audioContext = undefined;
    }
  };
}

function positionLabel(position: TilePosition): string {
  if (position === "previous") return "上方";
  if (position === "next") return "下方";
  return "中央";
}

function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}

function button(
  label: string,
  onClick: () => void,
  className = "ui-button",
  signal?: AbortSignal
): HTMLButtonElement {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", onClick, signal ? { signal } : undefined);
  if (!node.textContent) node.textContent = label;
  return node;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
