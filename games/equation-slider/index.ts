import type { GameDefinition, MountGameContext, MountedGame } from '../../packages/game-core';
import { EQUATION_SLIDER_CONTENT_REVISIONS } from './content-revisions';
import { equationSliderChapterManifest, findChapterManifest, loadEquationSliderChapter } from './levels/manifest';
import { createEquationSliderProgressStore, levelMapState, levelRevisionState, recordLevelStart } from './progress';
import type { PublishedEquationSliderLevel } from './types';
import { createPageHeader, element, button, targetValue } from './view-helpers';
import { createAudioController } from './audio-controller';
import { mountBoard } from './board-controller';
import './styles.css';

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

  const progressStore = createEquationSliderProgressStore({
    // Resolve the browser getter inside the store's guarded operations too.
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  });
  const loaded = progressStore.loaded;
  let progress = loaded.progress;
  let canPersist = loaded.canPersist;
  let showUpgradeNotice = progress.legacy !== undefined && !progress.upgradeNoticeSeen;
  let destroyed = false;
  let requestId = 0;
  let currentLevel: PublishedEquationSliderLevel | null = null;
  let currentChapterId = "chapter-1";
  let disposeActiveBoard: (() => void) | null = null;
  const chapterCache = new Map<string, readonly PublishedEquationSliderLevel[]>();
  const audio = createAudioController();

  const persist = (): void => {
    if (canPersist) canPersist = progressStore.persist(progress);
    const notice = root.querySelector<HTMLElement>("[data-save-notice]");
    if (notice) notice.hidden = canPersist;
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

  const openLevel = (level: PublishedEquationSliderLevel, tutorial = false, focusBoard = root.contains(document.activeElement)): void => {
    if (destroyed) return;
    clearActiveBoard();
    currentLevel = level;
    currentChapterId = level.chapterId;
    progress = recordLevelStart(progress, level.id, EQUATION_SLIDER_CONTENT_REVISIONS[level.id]);
    persist();
    disposeActiveBoard = mountBoard({
      root, persist, audio, chapterCache, openLevel, openLevelById, renderChapterMap,
      get progress() { return progress; }, set progress(value) { progress = value; },
      get canPersist() { return canPersist; },
      get showUpgradeNotice() { return showUpgradeNotice; }, set showUpgradeNotice(value) { showUpgradeNotice = value; }
    }, level, tutorial);
    if (focusBoard) root.querySelector<HTMLElement>('[data-reel-window]')?.focus({ preventScroll: true });
    const stage = root.parentElement;
    if (stage) stage.scrollTop = 0;
  };

  const openLevelById = async (chapterId: string, levelId: string, tutorial = false): Promise<void> => {
    const request = ++requestId;
    const focusBoard = root.contains(document.activeElement);
    renderLoading("正在接通信号……");
    try {
      const levels = await loadChapter(chapterId);
      if (destroyed || request !== requestId) return;
      const level = levels.find((candidate) => candidate.id === levelId);
      if (!level) throw new Error(`找不到关卡 ${levelId}`);
      openLevel(level, tutorial, focusBoard);
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
    const exit = button("回数学世界地图", context.onExit, "ui-button ui-button--secondary");
    exit.dataset.returnDestination = "math-world";
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
    root.querySelector<HTMLElement>(`[data-chapter-id="${CSS.escape(currentChapterId)}"]`)?.focus({ preventScroll: true });
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
          const revision = EQUATION_SLIDER_CONTENT_REVISIONS[level.id];
          const revisionState = levelRevisionState(progress.levels[level.id], revision);
          const revisionLabel = revision === undefined ? "" : revisionState === "previously-played"
            ? "旧版已玩 · 可试新版"
            : revisionState === "completed" || revisionState === "review-suggested"
              ? "新版已玩"
              : revisionState === "in-progress" ? "新版在玩" : "";
          const levelButton = button(
            `第 ${level.order} 关，目标 ${targetValue(level)}，点亮全部要求的格${revisionLabel ? `，${revisionLabel}` : ""}`,
            () => openLevel(level, !progress.tutorialCompleted && level.id === "es-1-01"),
            `equation-slider__level-button is-${state}`
          );
          levelButton.dataset.levelId = level.id;
          levelButton.replaceChildren(
            element("span", "equation-slider__lamp-bulb", ""),
            element("small", "", String(level.order))
          );
          if (revisionLabel) levelButton.append(element("span", "equation-slider__revision-label", revisionLabel));
          lamps.append(levelButton);
        }
        if (stationLevels.length === 0) {
          lamps.append(element("p", "equation-slider__station-pending", "本阶段关卡正在通过质量门禁。"));
        }
        card.append(lamps);
        stations.append(card);
      }
      root.append(header, stations);
      (root.querySelector<HTMLElement>(`button[data-level-id="${CSS.escape(currentLevel?.id ?? '')}"]`) ?? root.querySelector<HTMLElement>('button[data-level-id]'))?.focus({ preventScroll: true });
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
    panel.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  };


  const savedLevelId = progress.lastLevelId;
  const savedChapterNumber = savedLevelId?.match(/^es-(\d+)-/)?.[1];
  const savedChapter = equationSliderChapterManifest.find((chapter) => String(chapter.number) === savedChapterNumber);
  const initialLevelId = savedChapter && savedLevelId ? savedLevelId : "es-1-01";
  void openLevelById(savedChapter?.id ?? "chapter-1", initialLevelId, !progress.tutorialCompleted && initialLevelId === "es-1-01");

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
