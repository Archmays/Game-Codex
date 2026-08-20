import type { M3Action, M3HeroId, M5AdventureMode } from "../chapters/chapter-one-adapter/engine";
import type { ChapterTwoAction, ChapterTwoRun } from "../chapters/chapter-two/engine";
import type { ChapterThreeAction, ChapterThreeRun } from "../chapters/chapter-three/engine";

export type CompleteEngineChapterId = "chapter-one" | "chapter-two" | "chapter-three";
export type CompleteEngineScreen = "world" | CompleteEngineChapterId | "epilogue" | "postgame";
export type CompletePostgameMode = "free-adventure" | "component-trails" | "word-resonance";

export interface CompleteEngineProgressSeed {
  readonly selectedHeroId: M3HeroId;
  readonly activeChapterId: CompleteEngineChapterId;
  readonly unlockedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedEpisodeIds: readonly string[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredFamilyIds: readonly string[];
  readonly discoveredWordIds: readonly string[];
  readonly repairedObjectIds: readonly string[];
  readonly selectedAbilityIds: readonly string[];
  readonly triggeredAbilityIds: readonly string[];
  readonly completedBehaviorIds: readonly string[];
  readonly completedBossIds: readonly string[];
  readonly chapterOneReplay: {
    readonly seed: string;
    readonly initialHeroId: M3HeroId;
    readonly mode: M5AdventureMode;
    readonly actions: readonly M3Action[];
  } | null;
  readonly chapterTwoReplay: {
    readonly seed: string;
    readonly initialHeroId: M3HeroId;
    readonly actions: readonly ChapterTwoAction[];
  } | null;
  readonly chapterThreeReplay: {
    readonly seed: string;
    readonly initialHeroId: M3HeroId;
    readonly actions: readonly ChapterThreeAction[];
  } | null;
}

export interface CompleteEngineState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly screen: CompleteEngineScreen;
  readonly activeChapterId: CompleteEngineChapterId;
  readonly unlockedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedEpisodeIds: readonly string[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredFamilyIds: readonly string[];
  readonly discoveredWordIds: readonly string[];
  readonly repairedObjectIds: readonly string[];
  readonly selectedAbilityIds: readonly string[];
  readonly triggeredAbilityIds: readonly string[];
  readonly completedBehaviorIds: readonly string[];
  readonly completedBossIds: readonly string[];
  readonly chapterOneRun: import("../chapters/chapter-one-adapter/engine").CompleteChapterOneRun | null;
  readonly chapterTwoRun: ChapterTwoRun | null;
  readonly chapterThreeRun: ChapterThreeRun | null;
  readonly activePostgameMode: CompletePostgameMode | null;
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type CompleteEngineAction =
  | { readonly type: "select-hero"; readonly heroId: M3HeroId }
  | { readonly type: "enter-chapter-one"; readonly seed?: string; readonly mode?: M5AdventureMode }
  | { readonly type: "chapter-one-action"; readonly action: M3Action }
  | { readonly type: "chapter-two-action"; readonly action: ChapterTwoAction }
  | { readonly type: "chapter-three-action"; readonly action: ChapterThreeAction }
  | { readonly type: "enter-chapter"; readonly chapterId: CompleteEngineChapterId }
  | { readonly type: "return-world" }
  | { readonly type: "enter-postgame"; readonly mode: CompletePostgameMode };
