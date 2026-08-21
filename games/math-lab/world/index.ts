import type { MountedGame } from "../../../packages/game-core";
import { createLocalStorageStore } from "../../../packages/game-core";
import { MATH_WORLD_ACTIVITIES, findMathWorldActivity, type MathWorldActivity } from "./activity-registry";
import {
  readMathWorldSave,
  visitMathWorldStation,
  writeMathWorldSave,
  type MathWorldSaveV1,
} from "./world-save";
import "./styles.css";

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
  let save = readMathWorldSave();
  let navigationToken = 0;
  let destroyed = false;

  addPageClass();

  const renderMap = (): void => {
    navigationToken += 1;
    mountedStation?.destroy();
    mountedStation = null;
    root.className = "math-world-mount";
    root.innerHTML = `<main class="math-world" data-testid="math-world-map">
      <header class="math-world__header">
        <div><span class="math-world__kicker">数学世界</span><h1>数感实验城</h1><p>选择一座开放的工坊，用眼睛、双手和算式去发现关系。</p></div>
        <nav aria-label="数学世界导航"><a href="${HOME_ROUTE}">回我的游戏世界</a></nav>
      </header>
      <section class="math-world__city" aria-label="数学世界五个开放站点">
        <img class="math-world__art" src="./assets/math-world/math-world-city-background.webp" alt="温暖的数学实验城市，苹果园、小河、钟楼、方格工坊、数字牌屋和火车站围绕中央广场" />
        <div class="math-world__stations" data-math-world-stations></div>
      </section>
      <footer class="math-world__footer">
        <p>五个地方都可以自由进入，没有顺序，也不会因为离开而失去进度。</p>
        <button type="button" class="math-world__motion" data-motion-setting></button>
      </footer>
    </main>`;

    const stationHost = root.querySelector<HTMLElement>("[data-math-world-stations]");
    if (!stationHost) throw new Error("Math World station host is missing");
    for (const activity of MATH_WORLD_ACTIVITIES) {
      stationHost.append(createStationCard(activity, save.visitedStations.includes(activity.id), openStation));
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
        save = {
          version: 1,
          lastStation: save.lastStation,
          visitedStations: save.visitedStations,
          ...(nextOverride === undefined ? {} : { reducedMotionOverride: nextOverride }),
        };
        writeMathWorldSave(save);
        applyMotionPreference(root, save);
        updateMotionButton(motionButton, save);
      });
    }
  };

  const renderStation = async (activity: MathWorldActivity): Promise<void> => {
    const token = ++navigationToken;
    mountedStation?.destroy();
    mountedStation = null;
    save = visitMathWorldStation(save, activity.id);
    writeMathWorldSave(save);
    root.className = "math-world-station-mount";
    root.innerHTML = `<div class="math-world-station" data-testid="math-world-station" data-station-id="${activity.id}">
      <header class="math-world-station__bar">
        <button type="button" data-return-map>← 回城市地图</button>
        <div><span>${activity.place}</span><strong>${activity.title}</strong></div>
        <a href="${HOME_ROUTE}">回我的游戏世界</a>
      </header>
      <main class="math-world-station__stage" data-station-stage aria-live="polite"><p class="math-world-station__loading">正在打开${activity.title}……</p></main>
    </div>`;
    root.querySelector<HTMLButtonElement>("[data-return-map]")?.addEventListener("click", () => navigateToMap());
    applyMotionPreference(root, save);
    const stage = root.querySelector<HTMLElement>("[data-station-stage]");
    if (!stage) throw new Error("Math World station stage is missing");
    try {
      const game = await activity.load();
      if (destroyed || token !== navigationToken) return;
      stage.replaceChildren();
      mountedStation = game.mount({
        container: stage,
        onExit: navigateToMap,
        storage: createLocalStorageStore(game.id),
      });
    } catch (error) {
      if (destroyed || token !== navigationToken) return;
      stage.innerHTML = `<section class="math-world-station__error"><h2>这里暂时没有打开</h2><p>进度没有改变，可以回地图再试一次。</p><button type="button" data-error-return>回城市地图</button></section>`;
      stage.querySelector<HTMLButtonElement>("[data-error-return]")?.addEventListener("click", navigateToMap);
      console.error("Failed to load Math World station", error);
    }
  };

  function openStation(activity: MathWorldActivity): void {
    window.history.pushState({}, "", stationHref(activity.id));
    void renderStation(activity);
  }

  function navigateToMap(): void {
    window.speechSynthesis?.cancel();
    window.history.pushState({}, "", "?world=math-world");
    renderMap();
  }

  const syncFromLocation = (): void => {
    const activity = findMathWorldActivity(new URLSearchParams(window.location.search).get("station"));
    if (activity) void renderStation(activity);
    else renderMap();
  };

  window.addEventListener("popstate", syncFromLocation);
  syncFromLocation();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      navigationToken += 1;
      window.speechSynthesis?.cancel();
      window.removeEventListener("popstate", syncFromLocation);
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
  onOpen: (activity: MathWorldActivity) => void,
): HTMLElement {
  const article = document.createElement("article");
  article.className = `math-world-card math-world-card--${activity.id} math-world-card--${activity.accent}`;
  article.dataset.stationId = activity.id;
  const place = document.createElement("span");
  place.textContent = activity.place;
  const title = document.createElement("h2");
  title.textContent = activity.title;
  const description = document.createElement("p");
  description.textContent = activity.description;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = visited ? "再去看看" : "进去看看";
  button.addEventListener("click", () => onOpen(activity));
  article.append(place, title, description, button);
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
