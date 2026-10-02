import { EQUATION_SLIDER_CONTENT_REVISIONS } from './content-revisions';
import { createInitialBoardSession, reduceBoardSession, transitionBoardSession, type BoardSession } from './board-state';
import { createArrangementFeedback, getDynamicHint, type FeedbackMessage, type HintMessage } from './feedback';
import { completeLevelProgress, getLevelRevisionProgress, markCompletionCheckpointSeen, markTutorialCompleted, markUpgradeNoticeSeen, recordHintUse, resolveCompletionCheckpoint, setSoundEnabled, type EquationSliderProgress } from './progress';
import { createBoardRenderModel } from './render-model';
import { getMovableReels } from './solver';
import type { CompletionCheckpoint, MoveDirection, PublishedEquationSliderLevel } from './types';
import { button, element, chapterName, stationName, targetLabel, targetValue, displayExpression, positionLabel } from './view-helpers';
import { createReelBoard, updateReelBoard } from './board-view';
import { bindBoardInputs } from './board-input';
import type { createAudioController } from './audio-controller';
import { createBoardPanels, type TutorialStep } from './board-panels';
export interface BoardOwner {
  root: HTMLElement;
  progress: EquationSliderProgress;
  canPersist: boolean;
  showUpgradeNotice: boolean;
  persist: () => void;
  audio: ReturnType<typeof createAudioController>;
  chapterCache: ReadonlyMap<string, readonly PublishedEquationSliderLevel[]>;
  openLevel: (level: PublishedEquationSliderLevel, tutorial?: boolean) => void;
  openLevelById: (chapter: string, level: string, tutorial?: boolean) => Promise<void>;
  renderChapterMap: (chapter: string) => Promise<void>;
}
export function mountBoard(owner: BoardOwner, level: PublishedEquationSliderLevel, startTutorial: boolean): () => void {
    const { root, persist, audio, openLevel, openLevelById, renderChapterMap, chapterCache } = owner;
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
    let lastMovedReelId: string | undefined;
    let lastMoveText = "";
    let completionRecorded = false;
    let completionCheckpoint: CompletionCheckpoint = { kind: "normal" };
    const saveNotice = element("p", "equation-slider__save-notice", "本次可以玩；现有记录保持不动，暂不保存。");
    saveNotice.dataset.saveNotice = "true";
    saveNotice.hidden = owner.canPersist;

    const header = element("header", "equation-slider__compact-header");
    const heading = element("div", "equation-slider__heading");
    heading.append(
      element("span", "equation-slider__eyebrow", `${chapterName(level)} · 第 ${level.order} 关`),
      element("h2", "", stationName(level))
    );
    const headerActions = element("div", "equation-slider__header-actions");
    const soundButton = button(
      owner.progress.soundEnabled ? "关闭声音" : "开启声音",
      () => {
        const enabled = !owner.progress.soundEnabled;
        owner.progress = setSoundEnabled(owner.progress, enabled);
        persist();
        soundButton.setAttribute("aria-label", owner.progress.soundEnabled ? "关闭声音" : "开启声音");
        soundButton.textContent = owner.progress.soundEnabled ? "🔊" : "🔇";
        if (enabled) audio.play("enabled");
      },
      "ui-button ui-button--ghost",
      signal
    );
    soundButton.textContent = owner.progress.soundEnabled ? "🔊" : "🔇";
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
    const moveCount = element("span", "equation-slider__move-count equation-slider__sr-only", "0");
    moveCount.dataset.moveCount = "true";
    moveCount.setAttribute("aria-label", "移动次数");
    const requiredTileCount = element("span", "equation-slider__sr-only", String(level.requiredTileIds.length));
    requiredTileCount.dataset.requiredTileCount = "true";
    statusStrip.append(targetCard, expression, coverageSummary, moveCount, requiredTileCount);

    const goalLine = element("p", "equation-slider__goal-line");
    const moveChange = element("span", "equation-slider__move-change");

    const { board, reelDoms } = createReelBoard(level, dispatchMove, (id, tile) => inputs.clickTile(id, tile), signal);
    const inputs = bindBoardInputs({
      root, level, reelDoms, signal,
      session: () => session,
      dragStart: () => { session = reduceBoardSession(level, session, { type: "drag-start" }); updateBoard(); },
      dragCancel: () => { session = reduceBoardSession(level, session, { type: "drag-cancel" }); updateBoard(); },
      preview: indexes => { expression.textContent = displayExpression(level, indexes); expression.dataset.preview = "true"; },
      dispatchMove
    });

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
      session = reduceBoardSession(level, session, { type: "undo" });
      hint = null;
      hintDepth = 0;
      lastMovedReelId = undefined;
      lastMoveText = "";
      feedback = { kind: "info", text: "已回到上一步。" };
      if (tutorialStep === "coverage" && session.present.completedTargetIds.size === 0) tutorialStep = "move-target";
      updateBoard();
    }, "ui-button ui-button--secondary", signal);
    const hintButton = button("提示", () => {
      hintDepth = Math.min(3, hintDepth + 1);
      hintsThisSession += 1;
      owner.progress = recordHintUse(owner.progress, level.id, EQUATION_SLIDER_CONTENT_REVISIONS[level.id]);
      persist();
      hint = getDynamicHint(level, session.present, hintDepth);
      updateBoard();
    }, "ui-button ui-button--secondary", signal);
    const resetButton = button("重置", () => {
      session = reduceBoardSession(level, session, { type: "reset" });
      resetCount += 1;
      hint = null;
      hintDepth = 0;
      lastMovedReelId = undefined;
      lastMoveText = "";
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
    const nextLevel = () => (chapterCache.get(level.chapterId) ?? []).find(candidate => candidate.order === level.order + 1);
    const panels = createBoardPanels({
      level, signal, nextLevel,
      skipTutorial: () => { tutorialStep = null; owner.progress = markTutorialCompleted(owner.progress); persist(); updateBoard(); },
      advance: () => { const next = nextLevel(); if (next) openLevel(next, false); else void renderChapterMap(level.chapterId); },
      replay: () => openLevel(level, false)
    });
    const { tutorialPanel, completionPanel } = panels;
    const liveRegion = element("div", "equation-slider__sr-only");
    liveRegion.setAttribute("aria-live", "polite");

    root.append(header, saveNotice, statusStrip, goalLine, board, coverageDock, actions, moveChange, feedbackPanel, hintPanel, tutorialPanel, completionPanel, liveRegion);
    const inputHelp = element('details', 'equation-slider__input-help');
    inputHelp.append(element('summary', '', '怎么玩 · 按键'), element('p', '', 'Tab 切换滑轨和按钮；聚焦滑轨后，↑ 选上格、↓ 选下格。按钮用 Enter／空格确认，Esc 取消正在拖动的预览。鼠标或手指可以点上下格或方向按钮，也可以拖动滑轨；按键和点击的方向相同。'));
    root.append(inputHelp);
    const revision = EQUATION_SLIDER_CONTENT_REVISIONS[level.id];
    if (revision && owner.progress.levels[level.id]?.completed
      && !getLevelRevisionProgress(owner.progress.levels[level.id], revision)?.completed) {
      const revisionNotice = element("p", "equation-slider__revision-notice", "旧版已完成的记录还在。这次可以试试新棋盘。");
      header.after(revisionNotice);
    }

    if (owner.showUpgradeNotice) {
      const notice = element("aside", "equation-slider__upgrade-notice");
      notice.append(
        element("p", "", "滑轨游戏已升级，新的关卡进度从这里开始。"),
        button("知道了", () => {
          owner.showUpgradeNotice = false;
          owner.progress = markUpgradeNoticeSeen(owner.progress);
          persist();
          notice.remove();
          root.querySelector<HTMLElement>('[data-reel-window]')?.focus({ preventScroll: true });
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
      if (source === "direct" && inputs.active) return;
      if (source === "direct" && session.present.status !== "ready") return;
      if (source === "drag" && session.present.status !== "dragging") return;
      const movedIndex = getMovableReels(level).findIndex((reel) => reel.id === reelId);
      const movedReel = getMovableReels(level)[movedIndex];
      const previousValue = movedReel?.tiles[session.present.indexes[movedIndex]]?.value;
      const transition = transitionBoardSession(level, session, {
        type: "commit-move",
        reelId,
        direction,
        source,
        // Feedback never waits to unlock input. The synchronous reducer and
        // active-pointer guard already serialize one committed action.
        useFeedbackLock: false
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
      lastMovedReelId = reelId;
      lastMoveText = `第 ${movedIndex + 1} 轨：${String(previousValue)} → ${String(movedReel.tiles[session.present.indexes[movedIndex]].value)}`;
      hint = null;
      hintDepth = 0;
      feedback = createArrangementFeedback(level, session.present);
      if (transition.outcome?.valid) {
        const newTileCount = transition.newlyCoveredTileIds.length;
        const newTargetCount = transition.newlyCompletedTargetIds.length;
        if (session.present.status === "complete") {
          feedback = { kind: "complete", text: "全部目标和信号都完成了。" };
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
          feedback = { kind: "repeat", text: session.present.coveredTileIds.size === level.requiredTileIds.length
            ? "算式成立，格子已经全部点亮。看看还有哪个目标没到过。"
            : "算式成立，这些格已经亮了，没有新增。找一格没亮的再试。" };
        }
      }
      if (
        tutorialStep === "move-target"
        && transition.outcome?.valid
      ) {
        tutorialStep = "coverage";
        owner.progress = markTutorialCompleted(owner.progress);
        persist();
        liveRegion.textContent = "做到了，中央算式得到6。现在把六个数字都点亮。";
      }
      if (owner.progress.soundEnabled) {
        const madeProgress = transition.newlyCoveredTileIds.length > 0 || transition.newlyCompletedTargetIds.length > 0;
        audio.play(session.present.status === "complete" ? "complete" : madeProgress ? "success" : "move");
      }
      if (session.present.status === "complete") recordCompletion();
      updateBoard();
    }

    function recordCompletion(): void {
      if (completionRecorded) return;
      completionRecorded = true;
      const independent = hintsThisSession === 0 && resetCount === 0;
      owner.progress = completeLevelProgress(owner.progress, level.id, {
        independent,
        moves: session.present.moveCount,
        badges: independent ? ["independent", "all-new"] : ["review-complete"]
      }, EQUATION_SLIDER_CONTENT_REVISIONS[level.id]);
      completionCheckpoint = resolveCompletionCheckpoint(
        owner.progress,
        level,
        chapterCache.get(level.chapterId) ?? [level]
      );
      owner.progress = markCompletionCheckpointSeen(owner.progress, completionCheckpoint, level);
      persist();
    }

    function updateBoard(): void {
      const focused = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
      const model = createBoardRenderModel(level, session.present);
      expression.textContent = displayExpression(level, session.present.indexes);
      expression.removeAttribute("data-preview");
      coverageProgress.textContent = `${session.present.coveredTileIds.size}/${level.requiredTileIds.length}`;
      const remaining = level.requiredTileIds.length - session.present.coveredTileIds.size;
      goalLine.textContent = remaining === 0 && session.present.status === "complete"
        ? "✓ 全部点亮，可以去下一关，也可以回地图。"
        : remaining === 0
          ? "格子已经全部点亮，再让中央算式得到还没到过的目标。"
        : level.mode === "multi-target"
          ? `得到任一目标就能点灯；每个目标都要到过，把 ${level.requiredTileIds.length} 个格都点亮。`
          : level.mode === "equality"
            ? `让两边一样大，把 ${level.requiredTileIds.length} 个格都点亮。`
            : `让中央算式得到 ${targetValue(level)}，把 ${level.requiredTileIds.length} 个格都点亮。`;
      if (remaining > 0 && session.present.coveredTileIds.size > 0) {
        goalLine.textContent = `还剩 ${remaining} 格没亮。让它们也参加成立的算式。${level.mode === "multi-target" ? "每个目标都要到过。" : ""}`;
      }
      moveChange.textContent = lastMoveText || "点上方或下方的格，也能把它放到中央。";
      if (level.mode === "multi-target") {
        targetCard.querySelector("strong")?.replaceChildren(...level.targets.map((target) => {
          const reached = session.present.completedTargetIds.has(target.id);
          const chip = element("span", "equation-slider__target-chip", `${reached ? "✓" : "○"} ${target.value}`);
          chip.setAttribute("aria-label", `目标 ${target.value}，${reached ? "已到过" : "还没到过"}`);
          return chip;
        }));
      }
      moveCount.textContent = String(session.present.moveCount);
      board.dataset.boardStatus = session.present.status;
      const locked = session.present.status !== "ready";
      updateReelBoard(reelDoms, model, session.present, hint?.reelId, lastMovedReelId);
      if (tutorialStep === "move-target" && session.present.indexes[0] === 2) {
        const tutorialTile = reelDoms.get("es-1-01-right")?.tileElements.get("es-1-01-right-2");
        if (tutorialTile) tutorialTile.dataset.tutorialTarget = "true";
      }
      for (const lamp of coverageDock.querySelectorAll<HTMLElement>("[data-coverage-for]")) {
        lamp.classList.toggle("is-lit", session.present.coveredTileIds.has(lamp.dataset.coverageFor ?? ""));
      }
      undoButton.disabled = locked || session.undoStack.length === 0;
      hintButton.disabled = locked;
      resetButton.disabled = locked;
      feedbackPanel.textContent = `${feedback.kind === "complete" ? "★ " : feedback.kind === "success" ? "✦ " : feedback.kind === "repeat" ? "✓ " : ""}${feedback.text}`;
      feedbackPanel.dataset.feedbackKind = feedback.kind;
      feedbackPanel.classList.toggle("is-success", feedback.kind === "success");
      feedbackPanel.classList.toggle("is-complete", feedback.kind === "complete");
      hintPanel.hidden = hint === null;
      hintPanel.textContent = hint?.text ?? "";
      panels.updateTutorial(tutorialStep, session.present.indexes[0]);
      panels.updateCompletion(session.present.status === 'complete', completionCheckpoint, session.present.moveCount, hintsThisSession);
      if (focused && (!focused.isConnected || focused.matches(':disabled') || focused.closest('[hidden]'))) {
        (session.present.status === 'complete' ? completionPanel.querySelector<HTMLElement>('button') : root.querySelector<HTMLElement>('[data-reel-window]'))?.focus({ preventScroll: true });
      }
    }

    return () => {
      abortController.abort();
      inputs.destroy();
    };
}
