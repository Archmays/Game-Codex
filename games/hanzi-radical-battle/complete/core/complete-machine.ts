import {
  completeChapterOneAbilityIds,
  completeChapterOneEpisodeIds,
  completeChapterOneRepairIds,
  createCompleteChapterOneRun,
  isCompleteChapterOneRun,
  reduceCompleteChapterOneRun,
  replayCompleteChapterOneRun,
  toCompleteChapterOneCharacterIds,
} from "../chapters/chapter-one-adapter/engine";
import type { CompleteEngineAction, CompleteEngineProgressSeed, CompleteEngineState } from "./complete-types";

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

const FRESH_PROGRESS: CompleteEngineProgressSeed = {
  selectedHeroId: "light-speaker",
  activeChapterId: "chapter-one",
  unlockedChapterIds: ["chapter-one"],
  completedChapterIds: [],
  completedEpisodeIds: [],
  discoveredCharacterIds: [],
  discoveredFamilyIds: [],
  discoveredWordIds: [],
  repairedObjectIds: [],
  selectedAbilityIds: [],
  triggeredAbilityIds: [],
  completedBehaviorIds: [],
  completedBossIds: [],
  chapterOneReplay: null,
};

export function createCompleteEngineState(seed = "character-light-return", progress: CompleteEngineProgressSeed = FRESH_PROGRESS): CompleteEngineState {
  const chapterOneRun = progress.chapterOneReplay
    ? replayCompleteChapterOneRun(progress.chapterOneReplay.seed, progress.chapterOneReplay.initialHeroId, progress.chapterOneReplay.actions, progress.chapterOneReplay.mode)
    : null;
  return {
    schemaVersion: 1,
    seed,
    heroId: progress.selectedHeroId,
    screen: "world",
    activeChapterId: progress.activeChapterId,
    unlockedChapterIds: unique(["chapter-one", ...progress.unlockedChapterIds]),
    completedChapterIds: unique(progress.completedChapterIds),
    completedEpisodeIds: unique(progress.completedEpisodeIds),
    discoveredCharacterIds: unique(progress.discoveredCharacterIds),
    discoveredFamilyIds: unique(progress.discoveredFamilyIds),
    discoveredWordIds: unique(progress.discoveredWordIds),
    repairedObjectIds: unique(progress.repairedObjectIds),
    selectedAbilityIds: unique(progress.selectedAbilityIds),
    triggeredAbilityIds: unique(progress.triggeredAbilityIds),
    completedBehaviorIds: unique(progress.completedBehaviorIds),
    completedBossIds: unique(progress.completedBossIds),
    chapterOneRun,
    activePostgameMode: null,
    gentleMessage: progress.completedChapterIds.length ? "森林记得已经完成的修复，下一盏字光正在路上。" : "墨迹森林的第一盏营地灯正在等你。",
    actionCount: 0,
  };
}

function counted(state: CompleteEngineState, patch: Partial<CompleteEngineState>): CompleteEngineState {
  return { ...state, ...patch, actionCount: state.actionCount + 1 };
}

export function reduceCompleteEngineState(state: CompleteEngineState, action: CompleteEngineAction): CompleteEngineState {
  if (action.type === "select-hero" && state.screen === "world") {
    return counted(state, { heroId: action.heroId, gentleMessage: "伙伴已经来到营地，所有答案和进度都没有改变。" });
  }
  if (action.type === "enter-chapter-one" && state.screen === "world") {
    const chapterOneRun = createCompleteChapterOneRun(action.seed?.trim() || `${state.seed}:chapter-one`, state.heroId, action.mode ?? "story");
    return counted(state, { screen: "chapter-one", activeChapterId: "chapter-one", chapterOneRun, activePostgameMode: null, gentleMessage: "第一章沿用已验证的 V2 冒险规则。" });
  }
  if (action.type === "chapter-one-action" && state.screen === "chapter-one" && state.chapterOneRun) {
    const chapterOneRun = reduceCompleteChapterOneRun(state.chapterOneRun, action.action);
    const chapter = chapterOneRun.state;
    const complete = isCompleteChapterOneRun(chapter);
    const abilities = completeChapterOneAbilityIds(chapter);
    return counted(state, {
      chapterOneRun,
      discoveredCharacterIds: unique([...state.discoveredCharacterIds, ...toCompleteChapterOneCharacterIds(chapter.discoveredCharacterIds)]),
      completedEpisodeIds: unique([...state.completedEpisodeIds, ...completeChapterOneEpisodeIds(chapter)]),
      repairedObjectIds: unique([...state.repairedObjectIds, ...completeChapterOneRepairIds(chapter)]),
      selectedAbilityIds: unique([...state.selectedAbilityIds, ...abilities.selected]),
      triggeredAbilityIds: unique([...state.triggeredAbilityIds, ...abilities.triggered]),
      completedBehaviorIds: unique([...state.completedBehaviorIds, ...chapter.completedBehaviorCycles]),
      completedBossIds: unique([...state.completedBossIds, ...chapter.completedBossIds]),
      completedChapterIds: complete ? unique([...state.completedChapterIds, "chapter-one"]) : state.completedChapterIds,
      unlockedChapterIds: complete ? unique([...state.unlockedChapterIds, "chapter-two"]) : state.unlockedChapterIds,
      activeChapterId: complete ? "chapter-two" : "chapter-one",
      gentleMessage: chapter.gentleMessage,
    });
  }
  if (action.type === "enter-chapter" && state.screen === "world") {
    if (!state.unlockedChapterIds.includes(action.chapterId)) return counted(state, { gentleMessage: "这条林路还没有亮起；先完成前一章，已有进度都会保留。" });
    if (action.chapterId === "chapter-one") {
      const chapterOneRun = state.chapterOneRun ?? createCompleteChapterOneRun(`${state.seed}:chapter-one`, state.heroId, "story");
      return counted(state, { screen: "chapter-one", activeChapterId: "chapter-one", chapterOneRun, gentleMessage: "第一章冒险已经安全恢复。" });
    }
    return counted(state, { screen: action.chapterId, activeChapterId: action.chapterId, activePostgameMode: null, gentleMessage: action.chapterId === "chapter-two" ? "字脉树冠的路已经打开。" : "万象书港的灯正在远处回应。" });
  }
  if (action.type === "return-world") {
    return counted(state, { screen: "world", activePostgameMode: null, gentleMessage: "回到墨迹森林；修复和发现都保留在本机。" });
  }
  if (action.type === "enter-postgame" && state.screen === "world" && state.completedChapterIds.includes("chapter-three")) {
    return counted(state, { screen: "postgame", activePostgameMode: action.mode, gentleMessage: "自由探索不会扣除任何进度。" });
  }
  return counted(state, { gentleMessage: "这里暂时不能这样走；原来的发现和修复都保留。" });
}

export function replayCompleteEngineActions(seed: string, progress: CompleteEngineProgressSeed, actions: readonly CompleteEngineAction[]): CompleteEngineState {
  return actions.reduce(reduceCompleteEngineState, createCompleteEngineState(seed, progress));
}
