import "./styles.css";
import { mountHub } from "../hub";
import type { MountedGame } from "../../packages/game-core";
import { createWorldHome, type WorldHomeCanvasHandle } from "./phaser/create-world-home";
import { mountWorldSettings, type WorldSettingsHandle } from "./ui/WorldSettings";
import { WORLD_COPY } from "./world-copy";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
  ENGLISH_WORLD_ROUTE,
  HANZI_MAGIC_COMPLETE_ROUTE,
  MATH_WORLD_ROUTE,
  MY_GAME_WORLD_ROUTE,
} from "./world-routes";
import {
  readWorldHomeState,
  updateWorldSettings,
  type WorldHomeStorageLike,
  type WorldHomeState,
} from "./world-state";

export interface MyGameWorldOptions {
  readonly storage?: WorldHomeStorageLike;
}

export interface MyGameWorldHandle extends MountedGame {
  getState(): WorldHomeState;
}

function browserStorage(): WorldHomeStorageLike {
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
  let settings: WorldSettingsHandle | null = null;
  let destroyed = false;

  addPageClass("my-game-world-page");
  root.className = "my-game-world-mount";
  root.innerHTML = `<main class="my-game-world" data-testid="my-game-world" data-recovered="${String(state.recoveredCalmly)}">
    <header class="world-header">
      <div><span class="world-kicker">夜光墨林</span><h1>${WORLD_COPY.title}</h1><p>${WORLD_COPY.subtitle}</p></div>
      <button class="world-icon-button" type="button" data-world-settings-open>${WORLD_COPY.settingsAction}</button>
    </header>
    <section class="world-stage" aria-label="墨迹森林、数学世界、英语世界和游戏百宝箱入口">
      <div class="world-canvas" data-world-canvas></div>
      <div class="world-vignette" aria-hidden="true"></div>
      <section class="world-object world-object--forest is-active" data-testid="world-forest-portal">
        <span aria-hidden="true" class="world-object__mark world-object__mark--forest"></span>
        <h2>${WORLD_COPY.forestTitle}</h2>
        <a class="world-primary-link" href="${HANZI_MAGIC_COMPLETE_ROUTE}" data-world-forest-link>${WORLD_COPY.forestFreshAction}</a>
      </section>
      <section class="world-object world-object--math" data-testid="world-math-portal">
        <span aria-hidden="true" class="world-object__mark world-object__mark--math"></span>
        <h2>${WORLD_COPY.mathTitle}</h2>
        <p>钟楼、阵列、数字牌与算式轨道</p>
        <a class="world-secondary-link" href="${MATH_WORLD_ROUTE}" data-world-math-link>${WORLD_COPY.mathAction}</a>
      </section>
      <section class="world-object world-object--english" data-testid="world-english-portal">
        <span aria-hidden="true" class="world-object__mark world-object__mark--english"></span>
        <h2>${WORLD_COPY.englishTitle}</h2>
        <p>词义、拼词、句子与世界回应</p>
        <a class="world-secondary-link" href="${ENGLISH_WORLD_ROUTE}" data-world-english-link>${WORLD_COPY.englishAction}</a>
      </section>
      <section class="world-object world-object--treasure" data-testid="world-treasure-box">
        <span aria-hidden="true" class="world-object__mark world-object__mark--treasure"></span>
        <h2>${WORLD_COPY.treasureTitle}</h2>
        <a class="world-secondary-link" href="${CLASSIC_HUB_FROM_WORLD_ROUTE}" data-world-treasure-link>${WORLD_COPY.treasureAction}</a>
      </section>
    </section>
    <div class="world-modal-layer" data-world-modal-layer></div>
  </main>`;

  const canvasHost = root.querySelector<HTMLElement>("[data-world-canvas]");
  const modalHost = root.querySelector<HTMLElement>("[data-world-modal-layer]");
  if (!canvasHost || !modalHost) throw new Error("My Game World mount surface is incomplete");
  canvas = createWorldHome(canvasHost, state);

  const closeModal = (): void => {
    settings?.destroy();
    settings = null;
    modalHost.replaceChildren();
    root.querySelector<HTMLElement>("[data-world-settings-open]")?.focus();
  };

  root.querySelector<HTMLElement>("[data-world-settings-open]")?.addEventListener("click", () => {
    closeModal();
    settings = mountWorldSettings(modalHost, state.settings, (patch) => {
      const update = updateWorldSettings(storage, state, patch);
      state = update.state;
      canvas?.setView(state);
      return update.ok;
    }, closeModal);
  });

  return {
    getState: () => state,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      settings?.destroy();
      canvas?.destroy();
      removePageClass("my-game-world-page");
      root.replaceChildren();
    },
  };
}

export function mountClassicHubFromWorld(root: HTMLElement): MountedGame {
  addPageClass("classic-hub-from-world-page");
  root.className = "classic-hub-from-world-mount";
  root.innerHTML = `<div class="classic-hub-from-world" data-testid="classic-hub-from-world">
    <nav class="classic-hub-world-nav" aria-label="游戏百宝箱导航"><a href="${MY_GAME_WORLD_ROUTE}">← 回我的游戏世界</a></nav>
    <div class="classic-hub-world-inner" data-classic-hub-inner></div>
  </div>`;
  const inner = root.querySelector<HTMLElement>("[data-classic-hub-inner]");
  if (!inner) throw new Error("Classic hub inner mount is missing");
  const hub = mountHub(inner);
  return {
    destroy(): void {
      hub.destroy();
      removePageClass("classic-hub-from-world-page");
      root.replaceChildren();
    },
  };
}

export { CLASSIC_HUB_FROM_WORLD_ROUTE, ENGLISH_WORLD_ROUTE, HANZI_MAGIC_COMPLETE_ROUTE, HANZI_MAGIC_V1_ROUTE, MATH_WORLD_ROUTE, MY_GAME_WORLD_ROUTE } from "./world-routes";
export { MY_GAME_WORLD_SETTINGS_KEY, readWorldHomeState, updateWorldSettings } from "./world-state";
