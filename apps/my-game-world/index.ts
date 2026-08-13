import "./styles.css";
import { mountHub } from "../hub";
import type { MountedGame } from "../../packages/game-core";
import type { GoldenSliceStorageLike } from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import { createWorldHome, type WorldHomeCanvasHandle } from "./phaser/create-world-home";
import { mountWorldSpellbook, type WorldSpellbookHandle } from "./ui/WorldSpellbook";
import { mountWorldSettings, type WorldSettingsHandle } from "./ui/WorldSettings";
import { WORLD_COPY } from "./world-copy";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
  HANZI_MAGIC_V1_ROUTE,
  INK_FOREST_ROUTE,
  MY_GAME_WORLD_ROUTE,
  withStep06RouteContext,
  type SecondUseEvidenceId,
  type SecondUseRouteContext,
} from "./world-routes";
import type { Step06EventBridge } from "./second-use/event-bridge";
import type { Step06SessionGrant } from "./second-use/session";
import type { Step07SessionGrant } from "./second-use/step07-session";
import {
  readWorldHomeState,
  updateExistingWorldSettings,
  type WorldHomeState,
} from "./world-state";

export interface MyGameWorldOptions {
  readonly storage?: GoldenSliceStorageLike;
  readonly secondUse?: {
    readonly grant: Step06SessionGrant | Step07SessionGrant;
    readonly bridge: Step06EventBridge;
    readonly evidenceId?: SecondUseEvidenceId;
    readonly from?: string | null;
  };
}

export interface MyGameWorldHandle extends MountedGame {
  getState(): WorldHomeState;
}

function browserStorage(): GoldenSliceStorageLike {
  return window.localStorage;
}

function addPageClass(name: string): void {
  document.documentElement.classList.add(name);
  document.body.classList.add(name);
}

function removePageClass(name: string): void {
  document.documentElement.classList.remove(name);
  document.body.classList.remove(name);
}

export function mountMyGameWorld(root: HTMLElement, options: MyGameWorldOptions = {}): MyGameWorldHandle {
  const storage = options.storage ?? browserStorage();
  let state = readWorldHomeState(storage);
  let canvas: WorldHomeCanvasHandle | null = null;
  let spellbook: WorldSpellbookHandle | null = null;
  let settings: WorldSettingsHandle | null = null;
  let destroyed = false;
  const secondUse = options.secondUse;
  const routeContext: SecondUseRouteContext | undefined = secondUse
    ? { evidence: secondUse.evidenceId ?? "hanzi-v2-step06", sessionId: secondUse.grant.sessionId }
    : undefined;
  const v1FamilyMode = !secondUse;
  const forestHref = withStep06RouteContext(v1FamilyMode ? HANZI_MAGIC_V1_ROUTE : INK_FOREST_ROUTE, routeContext, "world");
  const treasureHref = withStep06RouteContext(CLASSIC_HUB_FROM_WORLD_ROUTE, routeContext, "world");
  const spellbookTitle = v1FamilyMode ? WORLD_COPY.v1SpellbookTitle : WORLD_COPY.spellbookTitle;

  addPageClass("my-game-world-page");
  root.className = "my-game-world-mount";
  root.innerHTML = `<main class="my-game-world" data-testid="my-game-world" data-repaired="${String(state.completedAndComplete)}" data-recovered="${String(state.recoveredCalmly)}">
    <header class="world-header">
      <div><span class="world-kicker">夜光墨林</span><h1>${WORLD_COPY.title}</h1><p>${WORLD_COPY.subtitle}</p></div>
      <button class="world-icon-button" type="button" data-world-settings-open>${WORLD_COPY.settingsAction}</button>
    </header>
    <section class="world-stage" aria-label="夜光森林和字灵营地">
      <div class="world-canvas" data-world-canvas></div>
      <div class="world-vignette" aria-hidden="true"></div>
      <section class="world-object world-object--spellbook" data-testid="world-spellbook-object">
        <span aria-hidden="true" class="world-object__mark world-object__mark--book"></span>
        <h2>${spellbookTitle}</h2>
        <p data-world-discoveries>${state.discoveredCharacterIds.length ? `${state.discoveredCharacterIds.length} 道字光` : "等待字光"}</p>
        <button type="button" data-world-spellbook-open>${WORLD_COPY.spellbookAction}</button>
      </section>
      <section class="world-object world-object--forest is-active" data-testid="world-forest-portal">
        <span aria-hidden="true" class="world-object__mark world-object__mark--forest"></span>
        <h2>${WORLD_COPY.forestTitle}</h2>
        <a class="world-primary-link" href="${forestHref}" data-world-forest-link>${state.completedAndComplete ? WORLD_COPY.forestReturnAction : WORLD_COPY.forestFreshAction}</a>
      </section>
      <section class="world-object world-object--treasure" data-testid="world-treasure-box">
        <span aria-hidden="true" class="world-object__mark world-object__mark--treasure"></span>
        <h2>${WORLD_COPY.treasureTitle}</h2>
        <a class="world-secondary-link" href="${treasureHref}" data-world-treasure-link>${WORLD_COPY.treasureAction}</a>
      </section>
      <div class="world-repair-signals" aria-label="营地变化" data-testid="world-repair-signals">
        <span data-repair="lamp" data-ready="${String(state.camp.lamp)}">营地灯</span>
        <span data-repair="flowers" data-ready="${String(state.camp.flowers)}">墨花</span>
        <span data-repair="trees" data-ready="${String(state.camp.guardianTrees)}">守护树</span>
        <span data-repair="star-path" data-ready="${String(state.camp.starPath)}">星光路</span>
      </div>
    </section>
    <div class="world-modal-layer" data-world-modal-layer></div>
  </main>`;

  const canvasHost = root.querySelector<HTMLElement>("[data-world-canvas]");
  const modalHost = root.querySelector<HTMLElement>("[data-world-modal-layer]");
  if (!canvasHost || !modalHost) throw new Error("My Game World mount surface is incomplete");
  canvas = createWorldHome(canvasHost, state);

  if (secondUse) {
    secondUse.bridge.emit("world_ready");
    if (!secondUse.bridge.events().some((event) => event.eventType === "progress_continuity_verified")) {
      secondUse.bridge.emit("progress_continuity_verified", { completed: true });
    }
    if (secondUse.from === "forest" || secondUse.from === "classic") {
      secondUse.bridge.emit("returned_to_world", { worldReturned: true });
    }
  }

  const emitFirstWorldAction = (): void => {
    if (!secondUse || secondUse.bridge.events().some((event) => event.eventType === "world_first_action")) return;
    secondUse.bridge.emit("world_first_action");
  };

  const closeModal = (): void => {
    spellbook?.destroy();
    settings?.destroy();
    spellbook = null;
    settings = null;
    modalHost.replaceChildren();
    root.querySelector<HTMLElement>("[data-world-spellbook-open]")?.focus();
  };

  root.querySelector<HTMLElement>("[data-world-spellbook-open]")?.addEventListener("click", () => {
    emitFirstWorldAction();
    secondUse?.bridge.emit("world_destination_opened", { destinationId: "SPELLBOOK" });
    secondUse?.bridge.emit("world_spellbook_opened", { destinationId: "SPELLBOOK" });
    closeModal();
    const closeSpellbook = (): void => {
      closeModal();
      secondUse?.bridge.emit("returned_to_world", { worldReturned: true });
    };
    spellbook = mountWorldSpellbook(
      modalHost,
      state.discoveredCharacterIds,
      state.save.settings.muted,
      closeSpellbook,
      spellbookTitle,
    );
  });

  root.querySelector<HTMLElement>("[data-world-settings-open]")?.addEventListener("click", () => {
    emitFirstWorldAction();
    secondUse?.bridge.emit("settings_opened");
    closeModal();
    settings = mountWorldSettings(modalHost, state.save.settings, (patch) => {
      const update = updateExistingWorldSettings(storage, state, patch);
      state = update.state;
      canvas?.setView(state);
      return update.ok;
    }, closeModal);
  });

  root.querySelector<HTMLElement>("[data-world-forest-link]")?.addEventListener("click", () => {
    emitFirstWorldAction();
    secondUse?.bridge.emit("world_destination_opened", { destinationId: "FOREST" });
  });

  root.querySelector<HTMLElement>("[data-world-treasure-link]")?.addEventListener("click", () => {
    emitFirstWorldAction();
    secondUse?.bridge.emit("world_destination_opened", { destinationId: "TREASURE_BOX" });
  });

  return {
    getState: () => state,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      spellbook?.destroy();
      settings?.destroy();
      canvas?.destroy();
      removePageClass("my-game-world-page");
      root.replaceChildren();
    },
  };
}

export function mountClassicHubFromWorld(root: HTMLElement, secondUse?: {
  readonly grant: Step06SessionGrant | Step07SessionGrant;
  readonly bridge: Step06EventBridge;
  readonly evidenceId?: SecondUseEvidenceId;
}): MountedGame {
  const routeContext: SecondUseRouteContext | undefined = secondUse
    ? { evidence: secondUse.evidenceId ?? "hanzi-v2-step06", sessionId: secondUse.grant.sessionId }
    : undefined;
  const worldHref = withStep06RouteContext(MY_GAME_WORLD_ROUTE, routeContext, "classic");
  addPageClass("classic-hub-from-world-page");
  root.className = "classic-hub-from-world-mount";
  root.innerHTML = `<div class="classic-hub-from-world" data-testid="classic-hub-from-world">
    <nav class="classic-hub-world-nav" aria-label="游戏百宝箱导航"><a href="${worldHref}">← 回我的游戏世界</a></nav>
    <div class="classic-hub-world-inner" data-classic-hub-inner></div>
  </div>`;
  const inner = root.querySelector<HTMLElement>("[data-classic-hub-inner]");
  if (!inner) throw new Error("Classic hub inner mount is missing");
  secondUse?.bridge.emit("classic_hub_opened", { destinationId: "TREASURE_BOX" });
  const hub = mountHub(inner);
  return {
    destroy(): void {
      hub.destroy();
      removePageClass("classic-hub-from-world-page");
      root.replaceChildren();
    },
  };
}

export { CLASSIC_HUB_FROM_WORLD_ROUTE, HANZI_MAGIC_V1_ROUTE, INK_FOREST_ROUTE, MY_GAME_WORLD_ROUTE } from "./world-routes";
export { deriveWorldHomeState, readWorldHomeState, updateExistingWorldSettings } from "./world-state";
