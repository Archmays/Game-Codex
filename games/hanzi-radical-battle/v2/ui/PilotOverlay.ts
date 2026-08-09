import { getCandidateCharacter } from "../content/candidate-characters";
import { getPilotScenario } from "../content/pilot-scenarios";
import type { VisualDirectionId } from "../content/types";
import { createPilotGame, type PilotWorldHandle } from "../phaser/create-pilot-game";
import { clearPilotSave, readPilotSave, writePilotSave } from "../save/pilot-store";
import { PILOT_SAVE_KEY, type PilotSaveState } from "../save/schema";
import { createPilotState, stepPilot, type PilotAction, type PilotState } from "../simulation/pilot-machine";
import { settingsOverlayMarkup } from "./SettingsOverlay";
import { spellbookOverlayMarkup } from "./SpellbookOverlay";
import { structureBoardMarkup } from "./StructureBoard";

export interface PilotOverlayOptions {
  scenarioId?: string;
  compact?: boolean;
  onStateChange?: (state: PilotState) => void;
}

export interface PilotOverlayHandle {
  resetScenario(scenarioId: string): void;
  setTheme(themeId: VisualDirectionId): void;
  getState(): PilotState;
  destroy(): void;
}

const ANIMATION_STEPS = new Set([
  "forming_character",
  "casting_spell",
  "monster_cleared",
  "returning_to_camp",
  "camp_repaired",
]);

function uniqueEventIds(state: PilotState): PilotSaveState["minimumPilotEvents"] {
  return [...new Set(state.events.map((event) => event.id))];
}

function playGentleChime(muted: boolean): void {
  if (muted || !("AudioContext" in window)) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 523.25;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {
    // Audio is optional; the visual sequence carries the complete meaning.
  }
}

function speakCharacter(muted: boolean, glyph: string, word: string): void {
  if (muted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${glyph}，${word}的${glyph}`);
  utterance.lang = "zh-CN";
  utterance.volume = 0.68;
  window.speechSynthesis.speak(utterance);
}

export function mountPilotOverlay(root: HTMLElement, options: PilotOverlayOptions = {}): PilotOverlayHandle {
  let state = createPilotState(options.scenarioId);
  const hadPilotSave = window.localStorage.getItem(PILOT_SAVE_KEY) !== null;
  let saveRead = readPilotSave(window.localStorage);
  let save =
    !hadPilotSave && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? { ...saveRead.state, reducedMotion: true }
      : saveRead.state;
  let settingsOpen = false;
  let animationTimer: number | null = null;
  let feedbackTimer: number | null = null;
  let idleTimer: number | null = null;
  let world: PilotWorldHandle;

  root.classList.add("pilot-mount");
  if (options.compact) root.classList.add("pilot-mount--compact");
  root.innerHTML = `<article class="pilot-shell" data-testid="core-spell-pilot">
    <header class="pilot-topbar">
      <div class="pilot-world-label"><span class="pilot-world-label__dot"></span><span>墨林营地 · 核心法术试玩</span></div>
      <div class="pilot-topbar__actions">
        <span class="pilot-save-badge" data-save-badge></span>
        <button class="icon-button" type="button" data-settings-open aria-label="打开声音、动态和视觉方向设置">设置</button>
      </div>
    </header>
    <div class="pilot-stage" data-pilot-stage>
      <div class="pilot-canvas" data-pilot-canvas aria-hidden="true"></div>
      <div class="pilot-stage__vignette" aria-hidden="true"></div>
      <div class="pilot-character-layer" data-character-layer aria-live="polite"></div>
      <div class="pilot-play-layer">
        <div class="pilot-story" data-story role="status" aria-live="polite"></div>
        <div class="pilot-interaction" data-interaction></div>
      </div>
      <div data-settings-layer></div>
      <div class="pilot-corruption-note" data-corruption-note hidden>本机旧记录无法读取，已安全回到新的营地。</div>
    </div>
  </article>`;

  const canvasHost = root.querySelector<HTMLElement>("[data-pilot-canvas]");
  if (!canvasHost) throw new Error("Missing STEP 02 Phaser canvas host");
  world = createPilotGame(canvasHost, {
    phase: state.phase,
    themeId: save.selectedThemeForReview,
    reducedMotion: save.reducedMotion,
    campLampRepaired: save.campLampRepaired,
  });

  function persist(permanentProgress = false): void {
    const anchor = getCandidateCharacter("ming");
    save = {
      ...save,
      campLampRepaired: permanentProgress ? true : save.campLampRepaired,
      spellbookCharacterIds:
        permanentProgress && !save.spellbookCharacterIds.includes(anchor.id)
          ? [...save.spellbookCharacterIds, anchor.id]
          : save.spellbookCharacterIds,
      minimumPilotEvents: uniqueEventIds(state),
    };
    writePilotSave(window.localStorage, save);
  }

  function clearTimers(): void {
    [animationTimer, feedbackTimer, idleTimer].forEach((timer) => {
      if (timer !== null) window.clearTimeout(timer);
    });
    animationTimer = feedbackTimer = idleTimer = null;
  }

  function scheduleIdleHint(): void {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    if (state.phase !== "placing") return;
    idleTimer = window.setTimeout(() => dispatch({ type: "show-idle-hint" }), 4000);
  }

  function schedulePhaseWork(previousPhase: PilotState["phase"]): void {
    if (state.phase === "invalid_feedback") {
      feedbackTimer = window.setTimeout(
        () => dispatch({ type: "feedback-complete" }),
        save.reducedMotion ? 250 : 340,
      );
      return;
    }
    if (ANIMATION_STEPS.has(state.phase)) {
      const perStep = save.reducedMotion ? 125 : 470;
      animationTimer = window.setTimeout(() => dispatch({ type: "animation-complete" }), perStep);
    }
    if (state.phase === "casting_spell" && previousPhase !== "casting_spell") {
      const anchor = getCandidateCharacter("ming");
      speakCharacter(save.muted, anchor.glyph, anchor.familiarWord);
      playGentleChime(save.muted);
    }
    if (state.phase === "camp_repaired" || state.phase === "spellbook" || state.phase === "complete") {
      persist(true);
    } else if (state.events.length > 1) {
      persist(false);
    }
  }

  function dispatch(action: PilotAction): void {
    const previous = state;
    state = stepPilot(state, action);
    if (state === previous) return;
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    render();
    schedulePhaseWork(previous.phase);
    scheduleIdleHint();
    options.onStateChange?.(state);
  }

  function renderCards(): string {
    const scenario = getPilotScenario(state.scenarioId);
    const placedIds = new Set(Object.values(state.board.placements));
    return `<div class="spell-hand" data-testid="spell-hand" aria-label="五张字灵牌">
      ${scenario.cards
        .map(
          (card) => `<button type="button" class="spell-card ${state.board.selectedCardId === card.id ? "is-selected" : ""} ${placedIds.has(card.id) ? "is-placed" : ""}" draggable="${!placedIds.has(card.id)}" data-card-id="${card.id}" data-testid="card-${card.id}" aria-pressed="${state.board.selectedCardId === card.id}" ${placedIds.has(card.id) ? "disabled" : ""}>
            <span class="spell-card__glyph" lang="zh-Hans">${card.glyph}</span>
            <span class="spell-card__caption">字灵</span>
          </button>`,
        )
        .join("")}
    </div>`;
  }

  function renderInteraction(): void {
    const interaction = root.querySelector<HTMLElement>("[data-interaction]");
    if (!interaction) return;
    const scenario = getPilotScenario(state.scenarioId);
    const character = getCandidateCharacter(scenario.characterId);
    const placementVisible = ["placing", "invalid_feedback", "forming_character"].includes(state.phase);

    if (placementVisible) {
      interaction.innerHTML = `<div class="spell-workbench ${state.phase === "invalid_feedback" ? "is-retrying" : ""}">
        ${structureBoardMarkup(scenario, state.board, state.hintSlotId)}
        ${state.hintSlotId ? `<div class="idle-guide" aria-label="墨点正在指向${scenario.slots.find((slot) => slot.id === state.hintSlotId)?.label ?? "结构位置"}"><span></span></div>` : ""}
        ${renderCards()}
      </div>`;
    } else if (state.phase === "spellbook") {
      interaction.innerHTML = `${spellbookOverlayMarkup(character)}<button class="world-action" type="button" data-primary-action>把这道光留在营地</button>`;
    } else if (state.phase === "complete") {
      interaction.innerHTML = `<div class="pilot-complete-card"><strong>灯亮着，字灵也留下了。</strong><span>家长审核前，这仍只是一个技术 Pilot。</span><button class="world-action" type="button" data-primary-action>再走一次灯路</button></div>`;
    } else if (ANIMATION_STEPS.has(state.phase)) {
      interaction.innerHTML = `<div class="phase-caption" data-testid="animation-caption">${state.phase === "forming_character" ? "部件仍然看得见，它们正在聚成完整的字。" : "完整汉字正在施放魔法。"}</div>`;
    } else {
      const actionLabel = state.phase === "camp_intro" ? "沿着灯路出发" : "靠近看看";
      interaction.innerHTML = `<button class="world-action" type="button" data-primary-action>${actionLabel}</button>`;
    }
  }

  function bindInteraction(): void {
    root.querySelectorAll<HTMLElement>("[data-card-id]").forEach((button) => {
      button.addEventListener("click", () => dispatch({ type: "select-card", cardId: button.dataset.cardId ?? "" }));
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", button.dataset.cardId ?? "");
      });
    });
    root.querySelectorAll<HTMLElement>("[data-slot-id]").forEach((slot) => {
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        dispatch({
          type: "place-card",
          cardId: event.dataTransfer?.getData("text/plain") ?? "",
          slotId: slot.dataset.slotId ?? "",
        });
      });
      slot.addEventListener("click", () => {
        const slotId = slot.dataset.slotId ?? "";
        if (state.board.placements[slotId]) {
          dispatch({ type: "remove-card", slotId });
        } else if (state.board.selectedCardId) {
          dispatch({ type: "place-card", cardId: state.board.selectedCardId, slotId });
        }
      });
    });
    root.querySelector<HTMLElement>("[data-primary-action]")?.addEventListener("click", () => {
      if (state.phase === "camp_intro") dispatch({ type: "enter-encounter" });
      else if (state.phase === "encounter_intro") dispatch({ type: "begin-placing" });
      else if (state.phase === "spellbook") dispatch({ type: "finish" });
      else if (state.phase === "complete") dispatch({ type: "reset" });
    });
  }

  function bindSettings(): void {
    root.querySelector<HTMLElement>("[data-settings-open]")?.addEventListener("click", () => {
      settingsOpen = true;
      render();
    });
    root.querySelector<HTMLElement>("[data-settings-close]")?.addEventListener("click", () => {
      settingsOpen = false;
      render();
    });
    root.querySelectorAll<HTMLElement>("[data-setting-theme]").forEach((button) => {
      button.addEventListener("click", () => {
        save = { ...save, selectedThemeForReview: button.dataset.settingTheme as VisualDirectionId };
        persist(false);
        render();
      });
    });
    root.querySelector<HTMLInputElement>("[data-setting-muted]")?.addEventListener("change", (event) => {
      save = { ...save, muted: (event.currentTarget as HTMLInputElement).checked };
      persist(false);
      render();
    });
    root.querySelector<HTMLInputElement>("[data-setting-motion]")?.addEventListener("change", (event) => {
      save = { ...save, reducedMotion: (event.currentTarget as HTMLInputElement).checked };
      persist(false);
      clearTimers();
      render();
      schedulePhaseWork(state.phase);
      scheduleIdleHint();
    });
    root.querySelector<HTMLElement>("[data-reset-progress]")?.addEventListener("click", () => {
      clearPilotSave(window.localStorage);
      saveRead = readPilotSave(window.localStorage);
      save = saveRead.state;
      state = createPilotState(state.scenarioId);
      settingsOpen = false;
      clearTimers();
      render();
      options.onStateChange?.(state);
    });
  }

  function render(): void {
    const scenario = getPilotScenario(state.scenarioId);
    const character = getCandidateCharacter(scenario.characterId);
    const shell = root.querySelector<HTMLElement>("[data-testid='core-spell-pilot']");
    const stage = root.querySelector<HTMLElement>("[data-pilot-stage]");
    const story = root.querySelector<HTMLElement>("[data-story]");
    const characterLayer = root.querySelector<HTMLElement>("[data-character-layer]");
    const settingsLayer = root.querySelector<HTMLElement>("[data-settings-layer]");
    if (!shell || !stage || !story || !characterLayer || !settingsLayer) return;

    shell.dataset.phase = state.phase;
    shell.dataset.scenario = state.scenarioId;
    shell.dataset.theme = save.selectedThemeForReview;
    shell.dataset.reducedMotion = String(save.reducedMotion);
    stage.dataset.phase = state.phase;
    story.innerHTML = `<span class="pilot-story__speaker">墨点</span><p>${state.message}</p>`;
    const showFullCharacter = ["forming_character", "casting_spell", "monster_cleared", "returning_to_camp"].includes(
      state.phase,
    );
    characterLayer.innerHTML = showFullCharacter
      ? `<div class="formed-character formed-character--${state.phase}" data-testid="formed-character"><span lang="zh-Hans">${character.glyph}</span>${state.phase !== "forming_character" ? `<small>${character.pinyin} · ${character.familiarWord}</small>` : ""}</div>`
      : "";
    settingsLayer.innerHTML = settingsOverlayMarkup(save, settingsOpen);
    const saveBadge = root.querySelector<HTMLElement>("[data-save-badge]");
    if (saveBadge) saveBadge.textContent = save.campLampRepaired ? "营地灯已修好" : "营地灯待修复";
    const corruption = root.querySelector<HTMLElement>("[data-corruption-note]");
    if (corruption) corruption.hidden = !saveRead.recoveredFromCorruption;

    renderInteraction();
    bindInteraction();
    bindSettings();
    world.setView({
      phase: state.phase,
      themeId: save.selectedThemeForReview,
      reducedMotion: save.reducedMotion,
      campLampRepaired: save.campLampRepaired,
    });
  }

  render();
  scheduleIdleHint();
  options.onStateChange?.(state);

  return {
    resetScenario(scenarioId) {
      getPilotScenario(scenarioId);
      clearTimers();
      state = createPilotState(scenarioId);
      render();
      scheduleIdleHint();
      options.onStateChange?.(state);
    },
    setTheme(themeId) {
      if (!(themeId === "A" || themeId === "B" || themeId === "C")) return;
      save = { ...save, selectedThemeForReview: themeId };
      persist(false);
      render();
    },
    getState: () => state,
    destroy() {
      clearTimers();
      window.speechSynthesis?.cancel();
      world.destroy();
      root.replaceChildren();
    },
  };
}
