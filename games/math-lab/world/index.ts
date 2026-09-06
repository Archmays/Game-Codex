import type { MountedGame } from "../../../packages/game-core";
import { createLocalStorageStore } from "../../../packages/game-core";
import { normalizeRetiredMathRoute } from "../../../src/app-route";
import { MATH_WORLD_ACTIVITIES, findMathWorldActivity, type MathWorldActivity } from "./activity-registry";
import {
  createMathWorldSaveSession,
  visitMathWorldStation,
  type MathWorldSaveV1,
} from "./world-save";
import "./styles.css";
import "./math-map.css";

const HOME_ROUTE = "?world=my-game-world";

function addPageClass(): void {
  document.documentElement.classList.add("math-world-page");
  document.body.classList.add("math-world-page");
}

function removePageClass(): void {
  document.documentElement.classList.remove("math-world-page");
  document.body.classList.remove("math-world-page");
}

function stationHref(id: string): string {
  return `?world=math-world&station=${encodeURIComponent(id)}`;
}

export function mountMathWorld(root: HTMLElement): MountedGame {
  let mountedStation: MountedGame | null = null;
  const saveSession = createMathWorldSaveSession();
  let save = saveSession.save;
  let navigationToken = 0;
  let destroyed = false;
  let lastMapFocusStationId: string | undefined;

  addPageClass();

  const renderMap = (focusStationId?: string): void => {
    navigationToken += 1;
    mountedStation?.destroy();
    mountedStation = null;
    root.className = "math-world-mount";
    root.innerHTML = `<main class="math-world math-map" data-testid="math-world-map">
      <header class="math-world__header">
        <div><span class="math-world__kicker">数学世界</span><h1>数感实验城</h1><p>去滑轨站移动算式，或到工坊组合数字牌。</p></div>
        <nav aria-label="数学世界导航"><a href="${HOME_ROUTE}">回我的游戏世界</a></nav>
      </header>
      ${new URLSearchParams(window.location.search).get("notice") === "retired-game" ? '<p class="math-world__notice" role="status">这个小游戏已收起，可以选择下面的游戏。</p>' : ""}
      <section class="math-world__city" aria-label="数学世界两个开放站点">
        <div class="math-world__stations" data-math-world-stations></div>
      </section>
      <footer class="math-world__footer">
        <p>两站都可以自由进入。完成记录会留在这里。</p>
        <button type="button" class="math-world__motion" data-motion-setting></button>
      </footer>
    </main>`;

    const stationHost = root.querySelector<HTMLElement>("[data-math-world-stations]");
    if (!stationHost) throw new Error("Math World station host is missing");
    for (const activity of MATH_WORLD_ACTIVITIES) {
      stationHost.append(createStationCard(activity, save.visitedStations.includes(activity.id), save.lastStation === activity.id, openStation));
    }
    applyMotionPreference(root, save);
    const motionButton = root.querySelector<HTMLButtonElement>("[data-motion-setting]");
    if (motionButton) {
      updateMotionButton(motionButton, save);
      motionButton.addEventListener("click", () => {
        const nextOverride = save.reducedMotionOverride === undefined
          ? true
          : save.reducedMotionOverride
            ? false
            : undefined;
        save = { ...save, reducedMotionOverride: nextOverride };
        saveSession.write(save);
        applyMotionPreference(root, save);
        updateMotionButton(motionButton, save);
      });
    }
    if (focusStationId) {
      queueMicrotask(() => root.querySelector<HTMLButtonElement>(`[data-station-id="${focusStationId}"] button`)?.focus());
    }
  };

  const renderStation = async (activity: MathWorldActivity, focusHeading = false): Promise<void> => {
    const token = ++navigationToken;
    lastMapFocusStationId = activity.id;
    mountedStation?.destroy();
    mountedStation = null;
    root.className = "math-world-station-mount";
    root.innerHTML = `<div class="math-world-station" data-testid="math-world-station" data-station-id="${activity.id}">
      <header class="math-world-station__bar">
        <button type="button" data-return-map>← 回城市地图</button>
        <div><span>${activity.place}</span><h1 tabindex="-1" data-station-heading>${activity.title}</h1></div>
        <a href="${HOME_ROUTE}">回我的游戏世界</a>
      </header>
      <main class="math-world-station__stage" data-station-stage aria-live="polite"><p class="math-world-station__loading">正在打开${activity.title}……</p></main>
    </div>`;
    root.querySelector<HTMLButtonElement>("[data-return-map]")?.addEventListener("click", () => navigateToMap());
    if (focusHeading) queueMicrotask(() => root.querySelector<HTMLElement>("[data-station-heading]")?.focus());
    applyMotionPreference(root, save);
    const stage = root.querySelector<HTMLElement>("[data-station-stage]");
    if (!stage) throw new Error("Math World station stage is missing");
    if (activity.id === "target") stage.removeAttribute("aria-live");
    try {
      const game = await activity.load();
      if (destroyed || token !== navigationToken) return;
      stage.replaceChildren();
      mountedStation = game.mount({
        container: stage,
        onExit: navigateToMap,
        storage: createLocalStorageStore(game.id),
      });
      save = visitMathWorldStation(save, activity.id);
      saveSession.write(save);
    } catch (error) {
      if (destroyed || token !== navigationToken) return;
      stage.innerHTML = `<section class="math-world-station__error"><h2>这里暂时没有打开</h2><p>进度没有改变，可以回地图再试一次。</p><button type="button" data-error-return>回城市地图</button></section>`;
      stage.querySelector<HTMLButtonElement>("[data-error-return]")?.addEventListener("click", navigateToMap);
      console.error("Failed to load Math World station", error);
    }
  };

  function openStation(activity: MathWorldActivity): void {
    window.history.pushState({}, "", stationHref(activity.id));
    void renderStation(activity, true);
  }

  function navigateToMap(): void {
    window.speechSynthesis?.cancel();
    window.history.pushState({}, "", "?world=math-world");
    renderMap(lastMapFocusStationId);
  }

  const syncFromLocation = (restoreFocus = false): void => {
    const url = new URL(window.location.href);
    if (normalizeRetiredMathRoute(url)) window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const activity = findMathWorldActivity(new URLSearchParams(window.location.search).get("station"));
    if (activity) void renderStation(activity, restoreFocus);
    else renderMap(restoreFocus ? lastMapFocusStationId ?? findMathWorldActivity(save.lastStation)?.id : undefined);
  };

  const handlePopState = (): void => syncFromLocation(true);
  window.addEventListener("popstate", handlePopState);
  syncFromLocation();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      navigationToken += 1;
      window.speechSynthesis?.cancel();
      window.removeEventListener("popstate", handlePopState);
      mountedStation?.destroy();
      mountedStation = null;
      removePageClass();
      root.replaceChildren();
    },
  };
}

function createStationCard(
  activity: MathWorldActivity,
  visited: boolean,
  isLastStation: boolean,
  onOpen: (activity: MathWorldActivity) => void,
): HTMLElement {
  const article = document.createElement("article");
  article.className = `math-world-card math-world-card--${activity.id} math-world-card--${activity.accent}`;
  article.classList.toggle("is-visited", visited);
  article.dataset.stationId = activity.id;
  const art = document.createElement("span");
  art.className = "math-map__scene";
  const image = document.createElement("img");
  image.src = "./assets/math-world/two-station-city.webp";
  image.alt = "";
  image.width = 1600;
  image.height = 800;
  image.decoding = "async";
  image.addEventListener("error", () => {
    art.hidden = true;
    article.classList.add("is-art-unavailable");
  });
  art.append(image);
  const info = document.createElement("span");
  info.className = "math-map__info";
  const place = document.createElement("span");
  place.className = "math-map__place";
  place.textContent = activity.place;
  const title = document.createElement("strong");
  title.className = "math-map__name";
  title.textContent = activity.title;
  const description = document.createElement("span");
  description.className = "math-map__description";
  description.textContent = activity.description;
  const status = document.createElement("span");
  status.className = "math-world-card__visit";
  status.textContent = isLastStation ? "上次到访" : visited ? "来过这里" : "随时可以来玩";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "进入" + activity.title);
  const cta = document.createElement("span");
  cta.className = "math-map__enter";
  cta.textContent = activity.id === "slider" ? "进入滑轨站 →" : "进入工坊 →";
  info.append(place, title, description, status, cta);
  button.append(art, info);
  button.addEventListener("click", () => onOpen(activity));
  article.append(button);
  return article;
}

function applyMotionPreference(root: HTMLElement, save: MathWorldSaveV1): void {
  if (save.reducedMotionOverride === undefined) delete root.dataset.reducedMotion;
  else root.dataset.reducedMotion = String(save.reducedMotionOverride);
}

function updateMotionButton(button: HTMLButtonElement, save: MathWorldSaveV1): void {
  button.textContent = save.reducedMotionOverride === undefined
    ? "动态效果：跟随设备"
    : save.reducedMotionOverride
      ? "动态效果：减少"
      : "动态效果：开启";
}

export { MATH_WORLD_ACTIVITIES } from "./activity-registry";
export { MATH_WORLD_SAVE_KEY, readMathWorldSave } from "./world-save";
