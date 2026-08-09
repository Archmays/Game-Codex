import { GOLDEN_ABILITIES } from "../content/abilities";
import { getGoldenEncounter } from "../content/encounters";
import { FINAL_GOLDEN_MANIFEST, FIRST_RUN_CHARACTER_IDS, getGoldenCharacter } from "../content/manifest";
import type { AbilityId, GoldenEncounterId } from "../content/types";
import { AudioDirector, DEFAULT_AUDIO_SETTINGS, type AudioBusId, type GoldenSliceAudioSettings } from "../phaser/AudioDirector";
import { createGoldenSliceGame, type GoldenSliceWorldHandle } from "../phaser/create-golden-slice-game";
import type { GoldenSliceWorldViewModel } from "../phaser/WorldView";
import {
  clearGoldenSliceSave,
  exportGoldenSliceSave,
  readGoldenSliceSave,
  writeGoldenSliceSave,
} from "../save/store";
import {
  cloneDefaultGoldenSliceSave,
  type GoldenSliceSaveReadResult,
  type GoldenSliceSaveState,
} from "../save/schema";
import {
  LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION,
  LOCAL_PLAYTEST_SEGMENTS,
  type LocalPlaytestEvent,
  type LocalPlaytestSegmentId,
  type LocalPlaytestViewportClass,
} from "../simulation/events";
import {
  createGoldenSliceState,
  getLegalGoldenSliceActions,
  stepGoldenSlice,
  type GoldenSliceAction,
  type GoldenSliceMode,
  type GoldenSlicePhase,
  type GoldenSliceState,
} from "../simulation/machine";
import { abilityChoiceOverlayMarkup } from "./AbilityChoiceOverlay";
import { parentDebugOverlayMarkup } from "./ParentDebugOverlay";
import { settingsOverlayMarkup } from "./SettingsOverlay";
import { spellbookOverlayMarkup } from "./SpellbookOverlay";
import { goldenStructureBoardMarkup } from "./StructureBoard";
import type { FirstUseActionKind, FirstUseEventType, FirstUseSafeMetadata, FirstUseStopCode } from "../first-use/event-types";

const AUDIO_SETTINGS_KEY = "family-games/hanzi-radical-battle-v2/golden-slice/audio-settings";
const FIRST_RUN_IDS = [...FIRST_RUN_CHARACTER_IDS];
const ENCOUNTER_IDS: readonly GoldenEncounterId[] = ["encounter-ming", "encounter-hua", "boss-lin", "boss-xing"];

export interface GoldenSliceOverlayOptions {
  mode?: GoldenSliceMode;
  seed?: string;
  onStateChange?: (state: GoldenSliceState) => void;
  childFirstUse?: boolean;
  technicalFixture?: boolean;
  initialMuted?: boolean;
  onFirstUseEvent?: (eventType: FirstUseEventType, safeMetadata?: FirstUseSafeMetadata) => void;
}

export interface GoldenSliceOverlayHandle {
  getState(): GoldenSliceState;
  dispatch(action: GoldenSliceAction): void;
  setMuted(muted: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  resetRun(): void;
  resetLocalProgress(): void;
  stopFirstUse(stopCode: FirstUseStopCode): void;
  destroy(): void;
}

interface MutableSession {
  schemaVersion: 1;
  sessionId: string;
  runSeed: string;
  firstActionMs: number | null;
  firstSpellMs: number | null;
  segmentDurationsMs: Record<LocalPlaytestSegmentId, number>;
  invalidPlacementCountByEncounter: Record<GoldenEncounterId, number>;
  maxHintLevelByEncounter: Record<GoldenEncounterId, number>;
  chosenAbilityId: AbilityId | null;
  bossPhaseRetryCount: Record<"lin" | "xing", number>;
  completed: boolean;
  replayClicked: boolean;
  muted: boolean;
  reducedMotion: boolean;
  viewportClass: LocalPlaytestViewportClass;
}

const STORY_BY_PHASE: Partial<Record<GoldenSlicePhase, string>> = {
  boot: "墨林的灯路正在等你。",
  camp_intro: "墨点精灵在等你。",
  camp_objective: "点亮营地灯，找回字灵。",
  travel_to_battle_1: "沿着微光向前走。",
  battle_1_intro: "把日和月送回真实位置。",
  battle_1_placing: "把日和月送回位置。",
  battle_1_forming: "日和月合成了明。",
  battle_1_casting: "明，míng，明亮的明。",
  battle_1_cleared: "明的光点亮了一小块。",
  breather_1: "光留在路边，看看花开。",
  travel_to_battle_2: "花香在前面带路。",
  battle_2_intro: "这次看看上边和下边。",
  battle_2_placing: "这次看看上边和下边。",
  battle_2_forming: "艹和化合成了花。",
  battle_2_casting: "花，huā，花朵的花。",
  battle_2_cleared: "墨花重新开放，道路亮了。",
  ability_choice: "选一道同行的光。",
  travel_to_boss: "两枚墨印就在前面。",
  boss_intro: "墨守将短暂遮住空位。",
  boss_phase_1_placing: "两个木，要站在左右两边。",
  boss_phase_1_forming: "木和木合成了林。",
  boss_phase_1_cleared: "第一枚墨印散开了。",
  boss_phase_2_placing: "这次看看上边和下边。",
  boss_phase_2_forming: "日和生合成了星。",
  boss_cleared: "第二枚墨印散开了。",
  return_to_camp: "星路带我们回营地。",
  camp_repair: "营地记住了这些字。",
  spellbook_review: "营地记住了这些字。",
  run_complete: "营地会等你再来。",
  invalid_feedback: "字灵还在，换个位置看看。",
  boss_interference: "空位会回来，不用着急。",
  paused: "冒险停在安全的地方。",
  settings_open: "声音和画面由你决定。",
  safe_retry: "字灵都在这里，慢慢来。",
};

const PRIMARY_ACTIONS: Partial<Record<GoldenSlicePhase, { label: string; action: GoldenSliceAction }>> = {
  boot: { label: "走进墨林", action: { type: "start" } },
  camp_intro: { label: "看看营地灯", action: { type: "continue" } },
  camp_objective: { label: "沿着灯路出发", action: { type: "continue" } },
  travel_to_battle_1: { label: "跳过小路", action: { type: "continue" } },
  battle_1_intro: { label: "开始合字施法", action: { type: "begin-placing" } },
  battle_1_cleared: { label: "看看光留下什么", action: { type: "continue" } },
  breather_1: { label: "继续看前路", action: { type: "continue" } },
  travel_to_battle_2: { label: "跳过花径", action: { type: "continue" } },
  battle_2_intro: { label: "试试新的结构", action: { type: "begin-placing" } },
  battle_2_cleared: { label: "看看三道光", action: { type: "continue" } },
  travel_to_boss: { label: "走向双印墨守", action: { type: "continue" } },
  boss_intro: { label: "先看清它的动作", action: { type: "begin-placing" } },
  boss_phase_1_cleared: { label: "解开第二枚墨印", action: { type: "continue" } },
  boss_cleared: { label: "沿星路回营地", action: { type: "continue" } },
  camp_repair: { label: "翻开四字魔法书", action: { type: "continue" } },
  paused: { label: "继续冒险", action: { type: "resume" } },
  safe_retry: { label: "从这里再试", action: { type: "continue-after-safe-retry" } },
};

const BOARD_PHASES = new Set<GoldenSlicePhase>([
  "battle_1_placing",
  "battle_2_placing",
  "boss_phase_1_placing",
  "boss_phase_2_placing",
]);
const FORMATION_PHASES = new Set<GoldenSlicePhase>([
  "battle_1_forming",
  "battle_1_casting",
  "battle_1_cleared",
  "battle_2_forming",
  "battle_2_casting",
  "battle_2_cleared",
  "boss_phase_1_forming",
  "boss_phase_1_cleared",
  "boss_phase_2_forming",
  "boss_cleared",
]);
const AUTO_SPEECH_PHASES = new Set<GoldenSlicePhase>([
  "battle_1_casting",
  "battle_2_casting",
  "boss_phase_1_forming",
  "boss_phase_2_forming",
]);

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function viewportClass(): LocalPlaytestViewportClass {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width <= 520 && height >= width) return "phone_portrait";
  if (width <= 1100) return "tablet_landscape";
  return "desktop";
}

function createSession(seed: string, settings: GoldenSliceSaveState["settings"]): MutableSession {
  const random = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return {
    schemaVersion: LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION,
    sessionId: `session-${random.toLowerCase().slice(0, 40)}`,
    runSeed: seed,
    firstActionMs: null,
    firstSpellMs: null,
    segmentDurationsMs: zeroRecord(LOCAL_PLAYTEST_SEGMENTS),
    invalidPlacementCountByEncounter: zeroRecord(ENCOUNTER_IDS),
    maxHintLevelByEncounter: zeroRecord(ENCOUNTER_IDS),
    chosenAbilityId: null,
    bossPhaseRetryCount: { lin: 0, xing: 0 },
    completed: false,
    replayClicked: false,
    muted: settings.muted,
    reducedMotion: settings.reducedMotion,
    viewportClass: viewportClass(),
  };
}

function segmentForPhase(phase: GoldenSlicePhase): LocalPlaytestSegmentId {
  if (phase.startsWith("battle_1")) return "battle_1";
  if (phase === "breather_1") return "breather";
  if (phase.startsWith("battle_2")) return "battle_2";
  if (phase === "ability_choice") return "ability_choice";
  if (phase.startsWith("boss_phase_1") || (phase === "boss_interference")) return "boss_phase_1";
  if (phase.startsWith("boss_phase_2")) return "boss_phase_2";
  if (phase === "return_to_camp" || phase === "camp_repair") return "return_to_camp";
  if (phase === "spellbook_review" || phase === "run_complete") return "spellbook";
  return "camp";
}

function readAudioSettings(storage: Storage): GoldenSliceAudioSettings {
  try {
    const value = JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY) ?? "null") as Partial<GoldenSliceAudioSettings> | null;
    if (!value || typeof value.muted !== "boolean" || !value.volumes || typeof value.volumes !== "object") {
      return { muted: DEFAULT_AUDIO_SETTINGS.muted, volumes: { ...DEFAULT_AUDIO_SETTINGS.volumes } };
    }
    const volumes = { ...DEFAULT_AUDIO_SETTINGS.volumes };
    for (const id of Object.keys(volumes) as AudioBusId[]) {
      const next = value.volumes[id];
      if (typeof next !== "number" || !Number.isFinite(next)) return { muted: value.muted, volumes };
      volumes[id] = Math.min(1, Math.max(0, next));
    }
    return { muted: value.muted, volumes };
  } catch {
    return { muted: DEFAULT_AUDIO_SETTINGS.muted, volumes: { ...DEFAULT_AUDIO_SETTINGS.volumes } };
  }
}

function downloadJson(fileName: string, payload: string): void {
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function activeGlyph(state: GoldenSliceState): string | null {
  return FORMATION_PHASES.has(state.phase) ? getGoldenCharacter(getGoldenEncounter(state.currentEncounterId).characterId).glyph : null;
}

export function mountGoldenSliceOverlay(
  root: HTMLElement,
  options: GoldenSliceOverlayOptions = {},
): GoldenSliceOverlayHandle {
  if (options.technicalFixture && !options.childFirstUse) {
    throw new Error("STEP 04 technical fixture chrome is only valid on the guarded child-first-use route");
  }
  let saveRead: GoldenSliceSaveReadResult = readGoldenSliceSave(window.localStorage);
  let save = saveRead.state;
  if (
    window.localStorage.getItem("family-games/hanzi-radical-battle-v2/golden-slice/state") === null &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    save = { ...save, settings: { ...save.settings, reducedMotion: true } };
  }
  const seed = options.seed?.trim() || save.lastRunSeed;
  let state = createGoldenSliceState({ seed, mode: options.mode ?? "play" });
  let audioSettings = readAudioSettings(window.localStorage);
  const initialMuted = options.childFirstUse && typeof options.initialMuted === "boolean"
    ? options.initialMuted
    : save.settings.muted;
  audioSettings = { ...audioSettings, muted: initialMuted };
  if (options.childFirstUse) save = { ...save, settings: { ...save.settings, muted: initialMuted } };
  const audio = new AudioDirector(audioSettings);
  let world: GoldenSliceWorldHandle;
  let destroyed = false;
  let timer: number | null = null;
  let idleTimer: number | null = null;
  let phaseStartedAt = performance.now();
  const sessionStartedAt = phaseStartedAt;
  let session = createSession(seed, save.settings);
  let uiHintSlotId: string | null = null;
  let echoVisible = false;
  let activeSpellbookId = "ming";
  let spellbookReplayMode: "formation" | "magic" | null = null;
  let resetArmed = false;
  let completionPersisted = false;
  let firstUseStopped = false;
  let firstUseActionEmitted = false;

  root.classList.add("golden-slice-mount");
  root.innerHTML = `<main class="golden-shell" data-testid="hanzi-v2-golden-slice" data-visual-state-id="boot" data-child-first-use="${String(Boolean(options.childFirstUse))}">
    <header class="golden-topbar">
      <div class="golden-world-name"><i class="golden-world-name__lamp" aria-hidden="true"></i><span>汉字魔法战 · 墨迹森林</span></div>
      <div class="golden-topbar__actions"><span class="golden-seed" ${options.childFirstUse ? "hidden" : ""}></span><button class="golden-icon-button" type="button" data-settings-open>声音与画面</button></div>
    </header>
    ${options.technicalFixture ? `<aside class="golden-fixture-banner" data-testid="child-first-use-fixture-banner">SYNTHETIC_TOOLING_TEST_ONLY · NO CHILD DATA</aside>` : ""}
    <section class="golden-stage">
      <div class="golden-world-canvas" data-world-canvas aria-hidden="true"></div>
      <div class="golden-vignette" aria-hidden="true"></div>
      <div class="golden-story" data-story role="status" aria-live="polite"></div>
      <div data-formed-layer></div>
      <div data-intent-layer></div>
      <div data-board-layer></div>
      <div data-action-layer></div>
      <div data-overlay-layer></div>
      <div data-debug-layer></div>
    </section>
  </main>`;

  const canvasHost = root.querySelector<HTMLElement>("[data-world-canvas]");
  if (!canvasHost) throw new Error("Golden Slice canvas host is missing");
  world = createGoldenSliceGame(canvasHost, worldView());

  function clearTimers(): void {
    if (timer !== null) window.clearTimeout(timer);
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    timer = null;
    idleTimer = null;
  }

  function elapsedMs(): number {
    return Math.max(0, Math.round(performance.now() - sessionStartedAt));
  }

  function recordPhaseDuration(previousPhase: GoldenSlicePhase): void {
    const segment = segmentForPhase(previousPhase);
    session.segmentDurationsMs[segment] += Math.max(0, Math.round(performance.now() - phaseStartedAt));
    phaseStartedAt = performance.now();
  }

  function persistAudioSettings(): void {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audio.getSettings()));
  }

  function persistSave(): void {
    writeGoldenSliceSave(window.localStorage, save);
  }

  function flushSession(completed = session.completed): void {
    session.completed = completed;
    session.muted = save.settings.muted;
    session.reducedMotion = save.settings.reducedMotion;
    session.viewportClass = viewportClass();
    const snapshot: LocalPlaytestEvent = {
      ...session,
      segmentDurationsMs: { ...session.segmentDurationsMs },
      invalidPlacementCountByEncounter: { ...session.invalidPlacementCountByEncounter },
      maxHintLevelByEncounter: { ...session.maxHintLevelByEncounter },
      bossPhaseRetryCount: { ...session.bossPhaseRetryCount },
    };
    const withoutCurrent = save.localPlaytestEvents.filter((event) => event.sessionId !== snapshot.sessionId);
    save = { ...save, localPlaytestEvents: [...withoutCurrent.slice(-23), snapshot] };
    persistSave();
  }

  function persistPermanentState(): void {
    if (state.selectedAbilityId && !save.chosenAbilityHistory.includes(state.selectedAbilityId)) {
      save = { ...save, chosenAbilityHistory: [...save.chosenAbilityHistory, state.selectedAbilityId] };
    }
    if (state.campRepaired || state.phase === "spellbook_review" || state.phase === "run_complete") {
      save = {
        ...save,
        campState: { lamp: true },
        spellbookEntries: [...new Set([...save.spellbookEntries, ...FIRST_RUN_IDS])],
      };
    }
    if (state.phase === "run_complete" && !completionPersisted) {
      completionPersisted = true;
      save = {
        ...save,
        completedRuns: save.completedRuns + 1,
        lastRunSeed: state.seed,
      };
      session.completed = true;
    }
    persistSave();
  }

  function currentCampState(): GoldenSliceWorldViewModel["campState"] {
    const prior = new Set(save.spellbookEntries);
    const complete = new Set(state.completedEncounterIds);
    return {
      lamp: save.campState.lamp || complete.has("encounter-ming") || state.campRepaired,
      flowers: prior.has("hua") || complete.has("encounter-hua") || state.campRepaired,
      guardianTrees: prior.has("lin") || complete.has("boss-lin") || state.campRepaired,
      starPath: prior.has("xing") || complete.has("boss-xing") || state.campRepaired,
    };
  }

  function worldView(): GoldenSliceWorldViewModel {
    const bossPhase = state.currentEncounterId === "boss-lin" ? 1 : state.currentEncounterId === "boss-xing" ? 2 : 0;
    const seals = state.phase === "boss_cleared" || state.phase === "return_to_camp" || state.campRepaired
      ? 0
      : state.completedEncounterIds.includes("boss-lin") || bossPhase === 2
        ? 1
        : 2;
    const abilityVisible =
      echoVisible ||
      state.copyId === "guardianLight" ||
      state.copyId === "starPath" ||
      (state.selectedAbilityId !== null && state.abilityUsedBossPhaseIds.includes(bossPhase === 2 ? "xing" : "lin"));
    return {
      phase: state.phase,
      encounterId: state.currentEncounterId,
      formedGlyph: activeGlyph(state),
      reducedMotion: save.settings.reducedMotion,
      chosenAbilityId: state.selectedAbilityId,
      bossPhase,
      bossSealsRemaining: seals as 0 | 1 | 2,
      interferenceActive: state.phase === "boss_interference",
      abilityVisible,
      campState: currentCampState(),
    };
  }

  function updateHintLevel(level: number, slotId: string | null): void {
    const encounterId = state.currentEncounterId;
    const priorLevel = session.maxHintLevelByEncounter[encounterId];
    session.maxHintLevelByEncounter[encounterId] = Math.max(session.maxHintLevelByEncounter[encounterId], level);
    uiHintSlotId = slotId;
    if (level > priorLevel) emitFirstUseEvent("built_in_hint_shown", { hintLevel: level, encounterId });
  }

  function emitFirstUseEvent(eventType: FirstUseEventType, safeMetadata?: FirstUseSafeMetadata): void {
    if (!options.childFirstUse) return;
    try {
      options.onFirstUseEvent?.(eventType, safeMetadata);
    } catch {
      // The local observer bridge is evidence-only and must never change game rules.
    }
  }

  function scheduleIdleHint(): void {
    if (!BOARD_PHASES.has(state.phase)) return;
    idleTimer = window.setTimeout(() => {
      const encounter = getGoldenEncounter(state.currentEncounterId);
      const slot = encounter.slots.find((candidate) => !state.board.placements[candidate.id]);
      updateHintLevel(1, slot?.id ?? null);
      render();
    }, 4000);
  }

  function schedulePhaseWork(): void {
    clearTimers();
    scheduleIdleHint();
    const short = save.settings.reducedMotion ? 100 : 680;
    if (["battle_1_forming", "battle_2_forming"].includes(state.phase)) {
      timer = window.setTimeout(() => dispatchInternal({ type: "animation-complete" }), short);
    } else if (["battle_1_casting", "battle_2_casting"].includes(state.phase)) {
      timer = window.setTimeout(() => dispatchInternal({ type: "animation-complete" }), save.settings.reducedMotion ? 120 : 1050);
    } else if (["boss_phase_1_forming", "boss_phase_2_forming", "return_to_camp"].includes(state.phase)) {
      timer = window.setTimeout(() => dispatchInternal({ type: "animation-complete" }), save.settings.reducedMotion ? 140 : 1250);
    } else if (state.phase === "invalid_feedback") {
      timer = window.setTimeout(() => dispatchInternal({ type: "feedback-complete" }), save.settings.reducedMotion ? 180 : 760);
    } else if (state.phase === "boss_interference") {
      timer = window.setTimeout(
        () => dispatchInternal({ type: "interference-complete" }),
        state.bossInterference?.durationMs ?? 1000,
      );
    } else if (state.phase === "breather_1") {
      timer = window.setTimeout(() => dispatchInternal({ type: "continue" }), 7000);
    } else if (state.phase === "ability_choice" && state.replayCount > 0 && state.selectedAbilityId) {
      timer = window.setTimeout(
        () => dispatchInternal({ type: "choose-ability", abilityId: state.selectedAbilityId as AbilityId }),
        120,
      );
    }
  }

  function dispatchInternal(action: GoldenSliceAction, userInitiated = false, actionKind: FirstUseActionKind = "pointer"): void {
    if (destroyed || firstUseStopped) return;
    const previous = state;
    if (userInitiated) {
      if (session.firstActionMs === null) session.firstActionMs = elapsedMs();
      if (!firstUseActionEmitted) {
        firstUseActionEmitted = true;
        emitFirstUseEvent("first_action", { actionKind });
      }
      uiHintSlotId = null;
      echoVisible = false;
    }
    const next = stepGoldenSlice(state, action);
    if (next === state) return;
    recordPhaseDuration(previous.phase);
    state = next;

    if (action.type === "place-card" && state.phase === "invalid_feedback") {
      session.invalidPlacementCountByEncounter[state.currentEncounterId] += 1;
      emitFirstUseEvent("invalid_placement", { encounterId: state.currentEncounterId });
      if (session.invalidPlacementCountByEncounter[state.currentEncounterId] >= 2) {
        const encounter = getGoldenEncounter(state.currentEncounterId);
        updateHintLevel(2, state.hintSlotId ?? encounter.slots.find((slot) => !state.board.placements[slot.id])?.id ?? null);
      }
    }
    if (state.phase === "battle_1_casting" && session.firstSpellMs === null) session.firstSpellMs = elapsedMs();
    if (action.type === "choose-ability") {
      session.chosenAbilityId = action.abilityId;
      emitFirstUseEvent("ability_selected", { abilityId: action.abilityId });
      audio.playSfx("choice");
    }
    if (action.type === "safe-retry" && (previous.currentEncounterId === "boss-lin" || previous.currentEncounterId === "boss-xing")) {
      session.bossPhaseRetryCount[previous.currentEncounterId === "boss-lin" ? "lin" : "xing"] += 1;
    }
    if (action.type === "use-ability" && previous.selectedAbilityId === "ink-echo") {
      echoVisible = true;
      void speakCurrentCharacter();
    }
    if (action.type === "replay") {
      session.replayClicked = true;
      emitFirstUseEvent("replay_selected", { origin: "spontaneous", replayIndex: 1 });
      flushSession();
      completionPersisted = false;
      session = createSession(state.seed, save.settings);
      emitFirstUseEvent("session_opened", { muted: save.settings.muted, replayIndex: state.replayCount });
    }
    if (state.phase.includes("forming")) audio.playSfx("form");
    if (state.phase.includes("casting") || state.phase === "boss_cleared") audio.playSfx("magic");

    if (state.phase !== previous.phase) {
      emitFirstUseEvent("phase_entered", { phase: state.phase });
      if (FORMATION_PHASES.has(state.phase) && state.phase.includes("forming")) {
        emitFirstUseEvent("spell_formed", { characterId: currentCharacter().id, encounterId: state.currentEncounterId });
      }
      if (["battle_1_cleared", "battle_2_cleared", "boss_phase_1_cleared", "boss_cleared"].includes(state.phase)) {
        emitFirstUseEvent("meaning_magic_completed", { characterId: currentCharacter().id, encounterId: state.currentEncounterId });
      }
      if (state.phase === "boss_intro") emitFirstUseEvent("boss_intent_shown", { bossPhase: "lin" });
      if (state.phase === "boss_phase_2_placing") emitFirstUseEvent("boss_intent_shown", { bossPhase: "xing" });
      if (state.phase === "boss_phase_1_cleared") emitFirstUseEvent("boss_phase_completed", { bossPhase: "lin" });
      if (state.phase === "boss_cleared") emitFirstUseEvent("boss_phase_completed", { bossPhase: "xing" });
      if (state.phase === "camp_repair") emitFirstUseEvent("camp_repaired");
      if (state.phase === "spellbook_review") emitFirstUseEvent("spellbook_opened");
      if (state.phase === "run_complete") emitFirstUseEvent("run_completed", { replayIndex: state.replayCount });
      if (AUTO_SPEECH_PHASES.has(state.phase)) void speakCurrentCharacter();
    }

    persistPermanentState();
    if (state.phase === "run_complete") flushSession(true);
    render();
    schedulePhaseWork();
    options.onStateChange?.(state);
  }

  function currentCharacter() {
    return getGoldenCharacter(getGoldenEncounter(state.currentEncounterId).characterId);
  }

  async function speakCurrentCharacter(): Promise<void> {
    const character = currentCharacter();
    await audio.speak(character.spokenPhrase);
  }

  function storyMarkup(): string {
    const character = currentCharacter();
    const text = state.phase === "invalid_feedback" && state.currentEncounterId.startsWith("boss-")
      ? "墨印还在，换个方法再试"
      : state.phase === "battle_1_casting" || state.phase === "battle_2_casting"
        ? `${character.glyph}，${character.visualPinyin}，${character.familiarWord}的${character.glyph}。`
        : STORY_BY_PHASE[state.phase] ?? "墨点在这里陪你。";
    return `<i class="golden-story__companion" aria-hidden="true"></i><p>${text}</p><button class="golden-story__voice" type="button" data-replay-voice aria-label="重听当前汉字和熟悉词">重听</button>`;
  }

  function formedMarkup(): string {
    const glyph = activeGlyph(state);
    if (!glyph) return "";
    const character = currentCharacter();
    const showWord = state.phase.includes("casting") || state.phase.includes("cleared") || state.phase === "boss_cleared";
    return `<div class="golden-formed-character" data-testid="formed-character-${character.id}">
      <div class="golden-formed-character__glyph" lang="zh-Hans">${glyph}</div>
      ${showWord ? `<strong>${character.visualPinyin} · ${character.familiarWord}</strong><span>${character.shortMeaning}</span>` : ""}
    </div>`;
  }

  function intentMarkup(): string {
    if (!state.phase.startsWith("boss") || state.phase === "boss_cleared") return "";
    const copy = state.currentEncounterId === "boss-xing" ? "墨印会遮一下下边空位" : "墨印会遮一下右边空位";
    return `<aside class="golden-intent" data-testid="boss-intent"><i class="golden-intent__mark" aria-hidden="true"></i><span>${copy}</span></aside>`;
  }

  function boardMarkup(): string {
    if (!BOARD_PHASES.has(state.phase) && state.phase !== "boss_interference" && state.phase !== "invalid_feedback") return "";
    const encounter = getGoldenEncounter(state.currentEncounterId);
    const locked = state.phase === "boss_interference" || state.phase === "invalid_feedback";
    const board = goldenStructureBoardMarkup(
      encounter,
      state.board,
      state.presentedCardIds,
      state.hintSlotId ?? uiHintSlotId,
      locked,
    );
    return `${board}${state.phase === "boss_interference" ? `<div class="golden-interference-mask" data-testid="boss-interference-mask"></div>` : ""}`;
  }

  function actionMarkup(): string {
    const primary = PRIMARY_ACTIONS[state.phase];
    if (!primary) return "";
    return `<div class="golden-action-layer"><button class="golden-primary" type="button" data-primary-action>${primary.label}</button></div>`;
  }

  function completeMarkup(): string {
    if (state.phase !== "run_complete") return "";
    const remaining = GOLDEN_ABILITIES.filter((ability) => ability.id !== state.selectedAbilityId);
    if (options.childFirstUse) {
      return `<section class="golden-complete-card" data-testid="run-complete">
        <h2>四道字光留在了营地</h2><p>这次冒险到这里。你可以停下来；如果你自己还想走一次，也可以选另一道光。</p>
        ${state.replayCount < 1 ? `<div class="golden-replay-abilities">${remaining.map((ability) => `<button type="button" data-replay-ability="${ability.id}">${ability.name}</button>`).join("")}</div>` : "<p>正式观察的两次短路已经结束。</p>"}
      </section>`;
    }
    return `<section class="golden-complete-card" data-testid="run-complete">
      <h2>四道字光留在了营地</h2><p>想换一道能力，再走一次相同的短路吗？</p>
      <div class="golden-replay-abilities">${remaining.map((ability) => `<button type="button" data-replay-ability="${ability.id}">${ability.name}再冒险</button>`).join("")}</div>
    </section>`;
  }

  function overlayMarkup(): string {
    if (firstUseStopped) {
      return `<section class="golden-complete-card" role="status" data-testid="child-first-use-stopped">
        <h2>先回营地休息，找到的汉字都还在。</h2><p>不需要完成，可以关闭这个窗口。</p>
      </section>`;
    }
    if (state.phase === "ability_choice") return abilityChoiceOverlayMarkup();
    if (state.phase === "settings_open") return settingsOverlayMarkup({ open: true, reducedMotion: save.settings.reducedMotion, audio: audio.getSettings(), childFirstUse: options.childFirstUse });
    if (state.phase === "spellbook_review") return spellbookOverlayMarkup(activeSpellbookId, spellbookReplayMode);
    return completeMarkup();
  }

  function bindPointerDrag(card: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let moved = false;
    let suppressClick = false;
    card.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      suppressClick = false;
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointermove", (event) => {
      moved ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 9;
      card.classList.toggle("is-dragging", moved);
    });
    card.addEventListener("pointerup", (event) => {
      card.classList.remove("is-dragging");
      if (!moved) return;
      suppressClick = true;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-slot-id]");
      if (target) {
        dispatchInternal({ type: "place-card", cardId: card.dataset.cardId ?? "", slotId: target.dataset.slotId ?? "" }, true, "drag");
      }
    });
    card.addEventListener("click", () => {
      if (suppressClick) return;
      dispatchInternal({ type: "select-card", cardId: card.dataset.cardId ?? "" }, true);
    });
  }

  function bindDynamicControls(): void {
    root.querySelector<HTMLElement>("[data-primary-action]")?.addEventListener("click", () => {
      const primary = PRIMARY_ACTIONS[state.phase];
      if (primary) dispatchInternal(primary.action, true);
    });
    root.querySelectorAll<HTMLElement>("[data-card-id]").forEach((card) => {
      bindPointerDrag(card);
      card.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", card.dataset.cardId ?? ""));
    });
    root.querySelectorAll<HTMLElement>("[data-slot-id]").forEach((slot) => {
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        dispatchInternal({ type: "place-card", cardId: event.dataTransfer?.getData("text/plain") ?? "", slotId: slot.dataset.slotId ?? "" }, true, "drag");
      });
      slot.addEventListener("click", () => {
        const slotId = slot.dataset.slotId ?? "";
        if (state.board.placements[slotId]) dispatchInternal({ type: "remove-card", slotId }, true);
        else if (state.board.selectedCardId) dispatchInternal({ type: "place-card", cardId: state.board.selectedCardId, slotId }, true);
      });
    });
    root.querySelector<HTMLElement>("[data-undo]")?.addEventListener("click", () => dispatchInternal({ type: "cancel-placement" }, true));
    root.querySelector<HTMLElement>("[data-safe-retry]")?.addEventListener("click", () => dispatchInternal({ type: "safe-retry" }, true));
    root.querySelectorAll<HTMLElement>("[data-ability-id]").forEach((button) => {
      button.addEventListener("click", () => dispatchInternal({ type: "choose-ability", abilityId: button.dataset.abilityId as AbilityId }, true));
    });
    root.querySelectorAll<HTMLElement>("[data-replay-ability]").forEach((button) => {
      button.addEventListener("click", () => dispatchInternal({ type: "replay", abilityId: button.dataset.replayAbility as AbilityId }, true));
    });
    root.querySelector<HTMLElement>("[data-replay-voice]")?.addEventListener("click", () => {
      if (state.selectedAbilityId === "ink-echo" && state.phase === "boss_interference") dispatchInternal({ type: "use-ability" }, true);
      else void speakCurrentCharacter();
    });
    root.querySelectorAll<HTMLElement>("[data-spellbook-id]").forEach((button) => {
      button.addEventListener("click", () => {
        activeSpellbookId = button.dataset.spellbookId ?? "ming";
        spellbookReplayMode = null;
        render();
      });
    });
    root.querySelectorAll<HTMLElement>("[data-read-character]").forEach((button) => {
      button.addEventListener("click", () => {
        const character = getGoldenCharacter(button.dataset.readCharacter as typeof FIRST_RUN_CHARACTER_IDS[number]);
        void audio.speak(character.spokenPhrase);
      });
    });
    root.querySelectorAll<HTMLElement>("[data-replay-formation], [data-replay-magic]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.replayFormation ?? button.dataset.replayMagic ?? "ming";
        activeSpellbookId = id;
        spellbookReplayMode = button.hasAttribute("data-replay-magic") ? "magic" : "formation";
        audio.playSfx(button.hasAttribute("data-replay-magic") ? "magic" : "form");
        render();
      });
    });
    root.querySelector<HTMLElement>("[data-finish-run]")?.addEventListener("click", () => dispatchInternal({ type: "finish" }, true));
    root.querySelector<HTMLElement>("[data-settings-close]")?.addEventListener("click", () => dispatchInternal({ type: "close-settings" }, true));
    root.querySelector<HTMLInputElement>("[data-setting-muted]")?.addEventListener("change", (event) => {
      const muted = (event.currentTarget as HTMLInputElement).checked;
      save = { ...save, settings: { ...save.settings, muted } };
      audio.setMuted(muted);
      persistAudioSettings();
      persistSave();
      render();
    });
    root.querySelector<HTMLInputElement>("[data-setting-motion]")?.addEventListener("change", (event) => {
      const reducedMotion = (event.currentTarget as HTMLInputElement).checked;
      save = { ...save, settings: { ...save.settings, reducedMotion } };
      persistSave();
      render();
      schedulePhaseWork();
    });
    root.querySelectorAll<HTMLInputElement>("[data-audio-bus]").forEach((input) => {
      input.addEventListener("input", () => {
        audio.setBusVolume(input.dataset.audioBus as AudioBusId, Number(input.value));
        persistAudioSettings();
      });
    });
    root.querySelector<HTMLElement>("[data-export-events]")?.addEventListener("click", () => {
      flushSession();
      downloadJson("STEP-03_LOCAL_PLAYTEST_EVENTS.json", JSON.stringify(save.localPlaytestEvents, null, 2));
    });
    root.querySelector<HTMLElement>("[data-reset-progress]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      if (!resetArmed) {
        resetArmed = true;
        button.textContent = "再点一次，只清除本游戏记录";
        return;
      }
      clearGoldenSliceSave(window.localStorage);
      const clean = cloneDefaultGoldenSliceSave();
      save = { ...clean, settings: { ...save.settings } };
      persistSave();
      resetArmed = false;
      completionPersisted = false;
      state = createGoldenSliceState({ seed: clean.lastRunSeed, mode: options.mode ?? "play" });
      session = createSession(state.seed, save.settings);
      activeSpellbookId = "ming";
      spellbookReplayMode = null;
      dispatchInternal({ type: "start" });
    });
    root.querySelectorAll<HTMLElement>("[data-review-jump]").forEach((button) => {
      button.addEventListener("click", () => dispatchInternal({ type: "review-jump", phase: button.dataset.reviewJump as never }, true));
    });
  }

  function render(): void {
    const shell = root.querySelector<HTMLElement>("[data-testid='hanzi-v2-golden-slice']");
    const story = root.querySelector<HTMLElement>("[data-story]");
    const formed = root.querySelector<HTMLElement>("[data-formed-layer]");
    const intent = root.querySelector<HTMLElement>("[data-intent-layer]");
    const board = root.querySelector<HTMLElement>("[data-board-layer]");
    const action = root.querySelector<HTMLElement>("[data-action-layer]");
    const overlay = root.querySelector<HTMLElement>("[data-overlay-layer]");
    const debug = root.querySelector<HTMLElement>("[data-debug-layer]");
    const seedLabel = root.querySelector<HTMLElement>(".golden-seed");
    if (!shell || !story || !formed || !intent || !board || !action || !overlay || !debug) return;
    shell.dataset.visualStateId = state.phase;
    shell.dataset.reducedMotion = String(save.settings.reducedMotion);
    shell.dataset.encounterId = state.currentEncounterId;
    shell.dataset.selectedAbilityId = state.selectedAbilityId ?? "none";
    if (seedLabel) seedLabel.textContent = options.childFirstUse ? "" : state.seed;
    story.innerHTML = storyMarkup();
    story.hidden = firstUseStopped || state.phase === "ability_choice" || state.phase === "settings_open" || state.phase === "spellbook_review" || state.phase === "run_complete";
    formed.innerHTML = firstUseStopped ? "" : formedMarkup();
    intent.innerHTML = firstUseStopped ? "" : intentMarkup();
    board.innerHTML = firstUseStopped ? "" : boardMarkup();
    action.innerHTML = firstUseStopped ? "" : actionMarkup();
    overlay.innerHTML = overlayMarkup();
    debug.innerHTML = state.mode === "review" ? parentDebugOverlayMarkup(state) : "";
    world.setInputEnabled(!firstUseStopped && !["settings_open", "paused", "ability_choice", "spellbook_review", "run_complete"].includes(state.phase));
    world.setView(worldView());
    bindDynamicControls();
  }

  root.querySelector<HTMLElement>("[data-settings-open]")?.addEventListener("click", () => {
    if (getLegalGoldenSliceActions(state).includes("open-settings")) dispatchInternal({ type: "open-settings" }, true);
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (state.phase === "settings_open") dispatchInternal({ type: "close-settings" }, true, "keyboard");
    else if (state.board.selectedCardId && BOARD_PHASES.has(state.phase)) dispatchInternal({ type: "cancel-placement" }, true, "keyboard");
    else if (getLegalGoldenSliceActions(state).includes("pause")) dispatchInternal({ type: "pause" }, true, "keyboard");
  };
  const onVisibility = () => {
    if (document.hidden && getLegalGoldenSliceActions(state).includes("pause")) dispatchInternal({ type: "pause" });
  };
  const onPageHide = () => {
    if (!destroyed) flushSession();
  };
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  persistSave();
  render();
  schedulePhaseWork();
  options.onStateChange?.(state);
  emitFirstUseEvent("session_opened", { muted: save.settings.muted, replayIndex: 0 });
  emitFirstUseEvent("child_route_ready", { muted: save.settings.muted });
  emitFirstUseEvent("phase_entered", { phase: state.phase });

  return {
    getState: () => state,
    dispatch(action) {
      dispatchInternal(action, true, "other");
    },
    setMuted(muted) {
      save = { ...save, settings: { ...save.settings, muted } };
      audio.setMuted(muted);
      persistAudioSettings();
      persistSave();
      render();
    },
    setReducedMotion(reducedMotion) {
      save = { ...save, settings: { ...save.settings, reducedMotion } };
      persistSave();
      render();
      schedulePhaseWork();
    },
    resetRun() {
      clearTimers();
      completionPersisted = false;
      state = createGoldenSliceState({ seed: state.seed, mode: options.mode ?? "play" });
      session = createSession(state.seed, save.settings);
      uiHintSlotId = null;
      render();
      schedulePhaseWork();
    },
    resetLocalProgress() {
      clearTimers();
      clearGoldenSliceSave(window.localStorage);
      save = cloneDefaultGoldenSliceSave();
      persistSave();
      resetArmed = false;
      completionPersisted = false;
      state = createGoldenSliceState({ seed: save.lastRunSeed, mode: options.mode ?? "play" });
      session = createSession(state.seed, save.settings);
      uiHintSlotId = null;
      echoVisible = false;
      activeSpellbookId = "ming";
      spellbookReplayMode = null;
      audio.setMuted(save.settings.muted);
      persistAudioSettings();
      render();
      schedulePhaseWork();
      options.onStateChange?.(state);
    },
    stopFirstUse(stopCode) {
      if (!options.childFirstUse || firstUseStopped) return;
      firstUseStopped = true;
      clearTimers();
      audio.stopAll();
      if (getLegalGoldenSliceActions(state).includes("pause")) {
        const paused = stepGoldenSlice(state, { type: "pause" });
        if (paused !== state) state = paused;
      }
      flushSession(false);
      emitFirstUseEvent("session_stopped", { stopCode });
      render();
      options.onStateChange?.(state);
    },
    destroy() {
      if (destroyed) return;
      flushSession();
      destroyed = true;
      clearTimers();
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      audio.destroy();
      world.destroy();
      root.classList.remove("golden-slice-mount");
      root.replaceChildren();
    },
  };
}
