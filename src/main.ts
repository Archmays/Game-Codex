import "./styles.css";
import "./page-mode.css";
import { normalizeRetiredLanguageRoute, normalizeRetiredMathRoute, pageModeForSearch, resolveAppRoute } from "./app-route";
import { activatePageMode } from "./page-mode";
import { bindInputLifecycle } from "../packages/ui/input";

const WORLD_THEME_COLOR = "#071c2a";
const MATH_WORLD_THEME_COLOR = "#dff2eb";
const CLASSIC_THEME_COLOR = "#f6f3e7";
const BUILD_COMMIT = (import.meta.env.VITE_BUILD_COMMIT || "local-source").trim() || "local-source";

document.documentElement.dataset.buildCommit = BUILD_COMMIT;

function setBrowserIdentity(title: string, themeColor: string): void {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = themeColor;
}

function renderRouteLoading(root: HTMLElement): void {
  root.innerHTML = `<main class="route-state" aria-busy="true" aria-labelledby="route-loading-title">
    <span class="route-state__glow" aria-hidden="true"></span>
    <h1 id="route-loading-title">正在打开游戏世界……</h1>
    <p role="status">请稍等一下，已经保存的进度不会改变。</p>
  </main>`;
}

function renderRouteError(root: HTMLElement): void {
  root.innerHTML = `<main class="route-state route-state--error" aria-labelledby="route-error-title">
    <h1 id="route-error-title">这个地方暂时没有打开</h1>
    <p role="alert">可以再试一次，或安全回到我的游戏世界。游戏进度没有被清除。</p>
    <div><button type="button" data-route-retry>再试一次</button><a tabindex="0" href="?world=my-game-world">回到我的游戏世界</a></div>
  </main>`;
  root.querySelector<HTMLButtonElement>("[data-route-retry]")?.addEventListener("click", () => window.location.reload());
}

async function mountApp(root: HTMLElement): Promise<void> {
  const url = new URL(window.location.href);
  if (normalizeRetiredLanguageRoute(url) || normalizeRetiredMathRoute(url)) window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  const search = new URLSearchParams(window.location.search);
  const route = resolveAppRoute(search);
  const play = search.get("play");
  activatePageMode(pageModeForSearch(search));

  if (route.kind === "play" && play === "hanzi-word-adventure") {
    setBrowserIdentity("字间行者", "#f5f0e4");
    const { mountHanziWordAdventure } = await import("../games/hanzi-word-adventure");
    mountHanziWordAdventure(root);
    return;
  }

  if (route.kind === "play" && play === "hanzi-tower-defense") {
    setBrowserIdentity("字阵守城", "#102f2d");
    const { mountHanziTowerDefense } = await import("../games/hanzi-tower-defense");
    mountHanziTowerDefense(root);
    return;
  }

  if (route.kind === "classic-hub") {
    setBrowserIdentity("游戏百宝箱", CLASSIC_THEME_COLOR);
    const { mountClassicHubFromWorld } = await import("../apps/my-game-world");
    mountClassicHubFromWorld(root);
    return;
  }

  if (route.kind === 'play' && play === 'memory-card') {
    setBrowserIdentity('记忆配对', '#f0ead2');
    const { mountMemoryMatch } = await import('../packages/activity-engines/memory-match');
    mountMemoryMatch(root, { context: 'classic', packId: 'same-glyph' });
    return;
  }

  if (route.kind === 'world' && search.getAll('playtest').length === 1 && search.get('playtest') === 'step4') {
    setBrowserIdentity('本次试玩 · Game-Codex STEP4', '#f4f0e5');
    const { mountStep4Playtest } = await import('../apps/step4-playtest');
    mountStep4Playtest(root);
    return;
  }

  if (route.kind === "world" && search.get("world") === "math-world") {
    setBrowserIdentity("数学世界 · 数感实验城", MATH_WORLD_THEME_COLOR);
    const { mountMathWorld } = await import("../games/math-lab/world");
    mountMathWorld(root);
    return;
  }

  setBrowserIdentity("我的游戏世界", WORLD_THEME_COLOR);
  const { mountMyGameWorld } = await import("../apps/my-game-world");
  mountMyGameWorld(root);
}

window.addEventListener("load", () => {
  const root = document.getElementById("app");
  if (!root) return;
  bindInputLifecycle(root, () => {});
  renderRouteLoading(root);
  void mountApp(root).catch(() => renderRouteError(root));
});
