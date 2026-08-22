import "./styles.css";
import "./page-mode.css";
import { pageModeForSearch, resolveAppRoute } from "./app-route";
import { activatePageMode } from "./page-mode";

const WORLD_THEME_COLOR = "#071c2a";
const MATH_WORLD_THEME_COLOR = "#dff2eb";
const ENGLISH_WORLD_THEME_COLOR = "#d7f1ee";
const CLASSIC_THEME_COLOR = "#f6f3e7";
const BUILD_COMMIT = (import.meta.env.VITE_BUILD_COMMIT || "local-source").trim() || "local-source";

document.documentElement.dataset.buildCommit = BUILD_COMMIT;

function setBrowserIdentity(title: string, themeColor: string): void {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = themeColor;
}

function addPageIdentity(className: string): void {
  document.documentElement.classList.add(className);
  document.body.classList.add(className);
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
    <div><button type="button" data-route-retry>再试一次</button><a href="?world=my-game-world">回到我的游戏世界</a></div>
  </main>`;
  root.querySelector<HTMLButtonElement>("[data-route-retry]")?.addEventListener("click", () => window.location.reload());
}

function preserveHanziReturnContext(root: HTMLElement, from: string | null): void {
  const context = from === "hub" ? "hub" : "world";
  root.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href*="play=hanzi-magic-complete"]');
    if (!link) return;
    const target = new URL(link.href, window.location.href);
    if (target.searchParams.get("play") !== "hanzi-magic-complete") return;
    target.searchParams.set("from", context);
    link.href = `${target.pathname}${target.search}${target.hash}`;
  }, { capture: true });
}

async function mountApp(root: HTMLElement): Promise<void> {

  const search = new URLSearchParams(window.location.search);
  const route = resolveAppRoute(search);
  const play = search.get("play");
  const mode = search.get("mode");
  const from = search.get("from");
  activatePageMode(pageModeForSearch(search));

  if (route.kind === "play" && play === "hanzi-magic-complete") {
    setBrowserIdentity("汉字魔法战 · 字光归林", WORLD_THEME_COLOR);
    addPageIdentity("hanzi-magic-page");
    preserveHanziReturnContext(root, from);
    if (search.get("view") === "pinyin") {
      const requestedMode = search.get("mode");
      const { mountSoundRhymeTrial } = await import("../games/hanzi-radical-battle/complete/support/pinyin/app");
      mountSoundRhymeTrial(root, {
        mode: requestedMode === "tone" || requestedMode === "contrast" ? requestedMode : "assemble",
        seed: search.get("seed") ?? undefined,
        returnHref: "?play=hanzi-magic-complete&from=hub",
      });
      return;
    }
    if (search.get("view") === "memory") {
      const { mountMemoryMatch } = await import("../packages/activity-engines/memory-match");
      mountMemoryMatch(root, {
        context: "hanzi",
        packId: search.get("pack") ?? "glyph-pinyin",
        seed: search.get("seed") ?? undefined,
        returnHref: "?play=hanzi-magic-complete&from=hub",
      });
      return;
    }
    if (search.get("audit") === "content-graph") {
      const { mountCompleteContentAuditSheet } = await import("../games/hanzi-radical-battle/complete/app/content-audit-sheet");
      mountCompleteContentAuditSheet(root, Number(search.get("sheet") ?? "0"));
      return;
    }
    if (search.get("slice") === "family" || search.get("slice") === "word") {
      const { mountHanziMagicCompleteSlice } = await import("../games/hanzi-radical-battle/complete/app/slice-app");
      mountHanziMagicCompleteSlice(root, {
        sliceId: search.get("slice") === "word" ? "word" : "family",
        fresh: search.get("fresh") === "1",
        returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world",
      });
      return;
    }
    if (search.get("view") === "spellbook") {
      const { mountCompleteSpellbook } = await import("../games/hanzi-radical-battle/complete/app/spellbook-app");
      mountCompleteSpellbook(root, { returnHref: "?play=hanzi-magic-complete&from=hub" });
      return;
    }
    if (search.get("view") === "wheel") {
      const { mountCompleteWorkshop } = await import("../games/hanzi-radical-battle/complete/workshop-adapter/app");
      mountCompleteWorkshop(root, { seed: search.get("seed") ?? undefined, returnHref: "?play=hanzi-magic-complete&from=hub" });
      return;
    }
    const requestedPostgame = search.get("postgame");
    if (requestedPostgame === "free-adventure" || requestedPostgame === "component-trails" || requestedPostgame === "word-resonance") {
      const requestedBand = search.get("band");
      const band = requestedBand === "story-path" || requestedBand === "optional-glow" ? requestedBand : "whole-forest";
      const { mountCompletePostgame } = await import("../games/hanzi-radical-battle/complete/postgame/app");
      mountCompletePostgame(root, { mode: requestedPostgame, band, seed: search.get("seed") ?? undefined, restart: search.get("new") === "1", returnHref: "?play=hanzi-magic-complete&from=hub" });
      return;
    }
    if (search.get("chapter") === "one") {
      const { mountHanziMagicChapterOneM3 } = await import("../games/hanzi-radical-battle/v2/chapter-one/m3-app");
      mountHanziMagicChapterOneM3(root, {
        seed: search.get("seed") ?? undefined,
        fresh: search.get("fresh") === "1",
        returnHref: "?play=hanzi-magic-complete&from=hub",
      });
      return;
    }
    if (search.get("chapter") === "two") {
      const { mountHanziMagicChapterTwo } = await import("../games/hanzi-radical-battle/complete/chapters/chapter-two/app");
      mountHanziMagicChapterTwo(root, {
        seed: search.get("seed") ?? undefined,
        fresh: search.get("fresh") === "1",
        returnHref: "?play=hanzi-magic-complete&from=hub",
      });
      return;
    }
    if (search.get("chapter") === "three") {
      const { mountHanziMagicChapterThree } = await import("../games/hanzi-radical-battle/complete/chapters/chapter-three/app");
      mountHanziMagicChapterThree(root, {
        seed: search.get("seed") ?? undefined,
        fresh: search.get("fresh") === "1",
        returnHref: "?play=hanzi-magic-complete&from=hub",
      });
      return;
    }
    const requestedChapter = null;
    const { mountHanziMagicComplete } = await import("../games/hanzi-radical-battle/complete/app/complete-app");
    mountHanziMagicComplete(root, { fresh: search.get("fresh") === "1", requestedChapter, view: search.get("view") === "archive" ? "archive" : "world", returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world" });
    return;
  }

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

  if (route.kind === "play" && play === "pinyin-magic-battle") {
    setBrowserIdentity("声韵试炼 · 墨迹森林", WORLD_THEME_COLOR);
    addPageIdentity("hanzi-magic-page");
    const { mountSoundRhymeTrial } = await import("../games/hanzi-radical-battle/complete/support/pinyin/app");
    mountSoundRhymeTrial(root, { mode: "assemble", seed: search.get("seed") ?? undefined, returnHref: "?hub=classic&from=world" });
    return;
  }

  if (route.kind === "play" && play === "english-spell-battle-legacy") {
    setBrowserIdentity("英文魔法战 · 旧版拼写练习", CLASSIC_THEME_COLOR);
    const [{ englishSpellBattleGame }, { createLocalStorageStore }] = await Promise.all([
      import("../games/english-spell-battle"),
      import("../packages/game-core"),
    ]);
    englishSpellBattleGame.mount({
      container: root,
      onExit: () => window.location.assign("?world=english-world&from=legacy"),
      storage: createLocalStorageStore(englishSpellBattleGame.id),
    });
    return;
  }

  if (route.kind === "classic-hub") {
    setBrowserIdentity("游戏百宝箱", CLASSIC_THEME_COLOR);
    const { mountClassicHubFromWorld } = await import("../apps/my-game-world");
    mountClassicHubFromWorld(root);
    return;
  }

  if (route.kind === "world" && search.get("world") === "english-world") {
    setBrowserIdentity("英语世界 · 词光岛", ENGLISH_WORLD_THEME_COLOR);
    if (search.get("view") === "memory") {
      const { mountMemoryMatch } = await import("../packages/activity-engines/memory-match");
      mountMemoryMatch(root, {
        context: "english",
        packId: "english-word-image",
        seed: search.get("seed") ?? undefined,
        returnHref: "?world=english-world",
      });
      return;
    }
    const { mountEnglishWorld } = await import("../games/english-spell-battle/v2/app");
    mountEnglishWorld(root, {
      seed: search.get("seed") ?? undefined,
      returnHref: from === "hub" ? "?hub=classic&from=world" : "?world=my-game-world",
    });
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
  renderRouteLoading(root);
  void mountApp(root).catch(() => renderRouteError(root));
});
