import "./styles.css";
import { mountHub } from "../hub";
import type { MountedGame } from "../../packages/game-core";
import { ACTIVE_CHILD_PRODUCTS } from "../../packages/data/gamePortfolio";
import { mountWorldSettings, type WorldSettingsHandle } from "./ui/WorldSettings";
import { WORLD_COPY } from "./world-copy";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
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
  // Access to localStorage itself can be denied, before getItem is called.
  try { return window.localStorage; }
  catch { return { getItem() { throw new Error("Storage unavailable"); }, setItem() { throw new Error("Storage unavailable"); } }; }
}

function addPageClass(name: string): void {
  document.documentElement.classList.add(name);
  document.body.classList.add(name);
}

function removePageClass(name: string): void {
  document.documentElement.classList.remove(name);
  document.body.classList.remove(name);
}

function activeProductRoute(id: string): string {
  const product = ACTIVE_CHILD_PRODUCTS.find((record) => record.id === id);
  if (!product?.canonicalRoute) throw new Error(`My Game World active product route is missing: ${id}`);
  return product.canonicalRoute.replace(/([?&])from=hub(?:&|$)/, "$1from=world&").replace(/&$/, "");
}

export function mountMyGameWorld(root: HTMLElement, options: MyGameWorldOptions = {}): MyGameWorldHandle {
  const storage = options.storage ?? browserStorage();
  let state = readWorldHomeState(storage);
  let settings: WorldSettingsHandle | null = null;
  let destroyed = false;

  addPageClass("my-game-world-page");
  root.className = "my-game-world-mount";
  const activeProductIds = ACTIVE_CHILD_PRODUCTS.map((record) => record.id).join(" ");
  root.innerHTML = `<main class="my-game-world" data-testid="my-game-world" data-recovered="${String(state.recoveredCalmly)}" data-active-child-products="${activeProductIds}">
    ${new URLSearchParams(window.location.search).get("notice") === "retired-language" ? '<p class="world-retired-notice" role="status">这个旧游戏已退役。可以从这里选一个游戏；原有存档保留在本机。</p>' : ""}
    <header class="world-header">
      <div><p class="world-kicker">选一个地方，开始玩</p><h1>${WORLD_COPY.title}</h1><p>${WORLD_COPY.subtitle}</p></div>
      <button class="world-icon-button" type="button" data-world-settings-open>${WORLD_COPY.settingsAction}</button>
    </header>
    <section class="world-stage" aria-label="选择游戏世界">
      <section class="world-object world-object--forest" data-testid="world-forest-portal">
        <a tabindex="0" class="world-entry" href="${activeProductRoute("hanzi-tower-defense")}" data-world-forest-link>
          <img src="./assets/hanzi-tower-defense/meadow.png" width="720" height="420" alt="" decoding="async">
          <div class="world-entry__body"><h2>${WORLD_COPY.forestTitle}</h2><p>摆下字塔，合出更强的字阵，守住城门。</p>
          <span class="world-entry__action">${WORLD_COPY.forestFreshAction}<span aria-hidden="true">↗</span></span></div>
        </a>
      </section>
      <section class="world-object world-object--math" data-testid="world-math-portal">
        <a tabindex="0" class="world-entry" href="${activeProductRoute("math-lab")}" data-world-math-link>
          <img src="./assets/home/math-world.webp" width="720" height="420" alt="" decoding="async">
          <div class="world-entry__body"><h2>${WORLD_COPY.mathTitle}</h2><p>滑动算式格，或用数字牌凑出目标。</p>
          <span class="world-entry__action">${WORLD_COPY.mathAction}<span aria-hidden="true">↗</span></span></div>
        </a>
      </section>
    </section>
    <section class="world-object world-object--adventure" data-testid="world-adventure-portal">
      <a tabindex="0" class="world-entry" href="${activeProductRoute("hanzi-word-adventure")}" data-world-adventure-link>
        <img src="./assets/hanzi-word-adventure/scene.png" width="560" height="560" alt="" decoding="async">
        <div class="world-entry__body"><h2>字间行者</h2><p>挪一枚字，变一段路。借来木与不，走回家。</p><span class="world-entry__action">踏上归途<span aria-hidden="true">↗</span></span></div>
      </a>
    </section>
    <nav class="world-more" aria-label="游戏列表" data-testid="world-treasure-box"><span>也可以打开游戏列表</span><a tabindex="0" href="${CLASSIC_HUB_FROM_WORLD_ROUTE}" data-world-treasure-link>${WORLD_COPY.treasureTitle}<span aria-hidden="true">→</span></a><a tabindex="0" href="?playtest=step4" data-world-playtest-link>本次试玩<span aria-hidden="true">→</span></a></nav>
    <div class="world-modal-layer" data-world-modal-layer></div>
  </main>`;

  const modalHost = root.querySelector<HTMLElement>("[data-world-modal-layer]");
  if (!modalHost) throw new Error("My Game World mount surface is incomplete");
  const applySettings = (): void => {
    root.dataset.reducedMotion = String(state.settings.reducedMotion);
  };
  applySettings();

  // Navigation-only state belongs to this history entry, never to a save key.
  const entries = ["forest", "math", "adventure", "treasure", "playtest"] as const;
  for (const entry of entries) {
    root.querySelector(`[data-world-${entry}-link]`)?.addEventListener("click", () => {
      window.history.replaceState({ ...window.history.state, worldHomeReturn: { entry, scrollY: window.scrollY } }, "");
    });
  }
  const restoreEntry = (): void => {
    if (destroyed || settings) return;
    const saved = window.history.state?.worldHomeReturn;
    let entry = entries.includes(saved?.entry) ? saved.entry as typeof entries[number] : null;
    if (!entry && document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin && referrer.pathname === window.location.pathname) {
        const query = referrer.searchParams;
        if (query.get('playtest') === 'step4') entry = 'playtest';
        else if (query.get("hub") === "classic") entry = "treasure";
        else if (query.get("world") === "math-world") entry = "math";
        else if (query.get("play") === "hanzi-tower-defense") entry = "forest";
        else if (query.get("play") === "hanzi-word-adventure") entry = "adventure";
      }
    }
    if (!entry) return;
    const link = root.querySelector<HTMLElement>(`[data-world-${entry}-link]`);
    link?.focus({ preventScroll: true });
    if (Number.isFinite(saved?.scrollY) && saved.scrollY >= 0) window.scrollTo(0, saved.scrollY);
    else link?.scrollIntoView({ block: "nearest" });
  };
  const restoreAfterLayout = (): void => { requestAnimationFrame(restoreEntry); };
  window.addEventListener("pageshow", restoreAfterLayout);
  restoreAfterLayout();

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
      applySettings();
      return update.ok;
    }, closeModal);
  });

  if (new URLSearchParams(window.location.search).get("parent") === "observation") {
    closeModal();
    settings = mountWorldSettings(modalHost, state.settings, (patch) => {
      const update = updateWorldSettings(storage, state, patch);
      state = update.state;
      applySettings();
      return update.ok;
    }, closeModal, { openObservation: true });
  }

  return {
    getState: () => state,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      settings?.destroy();
      window.removeEventListener("pageshow", restoreAfterLayout);
      removePageClass("my-game-world-page");
      root.replaceChildren();
    },
  };
}

export function mountClassicHubFromWorld(root: HTMLElement): MountedGame {
  addPageClass("classic-hub-from-world-page");
  root.className = "classic-hub-from-world-mount";
  root.innerHTML = `<div class="classic-hub-from-world" data-testid="classic-hub-from-world">
    <nav class="classic-hub-world-nav" aria-label="游戏百宝箱导航"><a tabindex="0" href="${MY_GAME_WORLD_ROUTE}">← 回我的游戏世界</a></nav>
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

export { CLASSIC_HUB_FROM_WORLD_ROUTE, HANZI_TOWER_DEFENSE_ROUTE, MATH_WORLD_ROUTE, MY_GAME_WORLD_ROUTE } from "./world-routes";
export { MY_GAME_WORLD_SETTINGS_KEY, readWorldHomeState, updateWorldSettings } from "./world-state";
