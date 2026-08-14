import "./styles.css";
import "./page-mode.css";
import { pageModeForAppRoute, resolveAppRoute } from "./app-route";
import { activatePageMode } from "./page-mode";

const WORLD_THEME_COLOR = "#071c2a";
const CLASSIC_THEME_COLOR = "#f6f3e7";

function setBrowserIdentity(title: string, themeColor: string): void {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = themeColor;
}

function addPageIdentity(className: string): void {
  document.documentElement.classList.add(className);
  document.body.classList.add(className);
}

window.addEventListener("load", async () => {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app container.");

  const search = new URLSearchParams(window.location.search);
  const route = resolveAppRoute(search);
  const play = search.get("play");
  const mode = search.get("mode");
  const from = search.get("from");
  activatePageMode(pageModeForAppRoute(route.kind));

  if (route.kind === "play" && play === "hanzi-v2-chapter-one") {
    setBrowserIdentity("汉字魔法战 · 第一章", WORLD_THEME_COLOR);
    addPageIdentity("hanzi-magic-page");
    if (mode === "content-audit") {
      const { mountChapterOneContentAudit } = await import("../games/hanzi-radical-battle/v2/chapter-one/content-audit");
      mountChapterOneContentAudit(root, Number(search.get("sheet") ?? "0"));
      return;
    }
    if (mode === "m1-proxy") {
      const { mountHanziMagicChapterOne } = await import("../games/hanzi-radical-battle/v2/chapter-one/app");
      mountHanziMagicChapterOne(root, {
        seed: search.get("seed") ?? undefined,
        fresh: search.get("fresh") === "1",
        returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world",
      });
      return;
    }
    const { mountHanziMagicChapterOneM3 } = await import("../games/hanzi-radical-battle/v2/chapter-one/m3-app");
    const requestedHero = search.get("hero");
    mountHanziMagicChapterOneM3(root, {
      seed: search.get("seed") ?? undefined,
      heroId: requestedHero === "light-speaker" || requestedHero === "forest-speaker" || requestedHero === "ink-companion" ? requestedHero : undefined,
      adventureMode: search.get("adventure") === "free" ? "free" : "story",
      fresh: search.get("fresh") === "1",
      returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world",
    });
    return;
  }

  if (route.kind === "play" && play === "hanzi-v2-v1") {
    setBrowserIdentity("汉字魔法战 · 墨迹森林 V1", WORLD_THEME_COLOR);
    addPageIdentity("hanzi-magic-page");
    const { mountHanziMagicV1 } = await import("../games/hanzi-radical-battle/v2/v1");
    mountHanziMagicV1(root, {
      returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world",
    });
    return;
  }

  if (route.kind === "classic-hub") {
    setBrowserIdentity("游戏百宝箱", CLASSIC_THEME_COLOR);
    const { mountClassicHubFromWorld } = await import("../apps/my-game-world");
    mountClassicHubFromWorld(root);
    return;
  }

  setBrowserIdentity("我的游戏世界", WORLD_THEME_COLOR);
  const { mountMyGameWorld } = await import("../apps/my-game-world");
  mountMyGameWorld(root);
});
