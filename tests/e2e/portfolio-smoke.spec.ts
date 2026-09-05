import { expect, test, type Locator, type Page } from "@playwright/test";
import { getChapterOneCharacter } from "../../games/hanzi-radical-battle/v2/chapter-one";

interface RuntimeObservation {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly failedResponses: string[];
  readonly failedRequests: string[];
  readonly externalRequests: string[];
}

interface SmokeGame {
  readonly id: string;
  readonly title: string;
  readonly surface: string;
  readonly canonicalRoute?: string;
  interact(page: Page): Promise<Locator | null>;
}

function observeRuntime(page: Page): RuntimeObservation {
  const result: RuntimeObservation = { pageErrors: [], consoleErrors: [], failedResponses: [], failedRequests: [], externalRequests: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) result.failedResponses.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    // Route changes intentionally cancel Vite module requests that are no longer
    // needed. They are not runtime/network failures of the destination screen.
    if (errorText !== "net::ERR_ABORTED") result.failedRequests.push(`${request.url()} ${errorText}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:5291") result.externalRequests.push(request.url());
  });
  return result;
}

async function expectRuntimeClean(runtime: RuntimeObservation): Promise<void> {
  expect(runtime.pageErrors, "page errors").toEqual([]);
  expect(runtime.consoleErrors, "console errors").toEqual([]);
  expect(runtime.failedResponses, "HTTP responses >= 400").toEqual([]);
  expect(runtime.failedRequests, "failed runtime requests").toEqual([]);
  expect(runtime.externalRequests, "unexpected external requests").toEqual([]);
}

async function expectNoFatalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
}

async function expectUsableTarget(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "primary interaction has a layout box").not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(24);
  expect(box!.height).toBeGreaterThanOrEqual(24);
}

const GAMES: readonly SmokeGame[] = [
  {
    id: "memory-card", title: "记忆配对", surface: '[data-testid="memory-match"]',
    canonicalRoute: "/?play=hanzi-magic-complete&view=memory&pack=same-glyph",
    async interact(page) {
      const card = page.locator("[data-card-id]").first();
      await expectUsableTarget(card);
      await card.click();
      await expect(card).toHaveAttribute("data-open", "true");
      return card;
    },
  },
  {
    id: "math-lab", title: "数学世界", surface: '[data-testid="math-world-map"]',
    async interact(page) {
      const station = page.locator('[data-station-id="slider"] button');
      await expectUsableTarget(station);
      await station.click();
      await expect(page.locator('[data-station-id="slider"] .equation-slider')).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "← 回城市地图" }).click();
      await expect(page.getByTestId("math-world-map")).toBeVisible();
      return station;
    },
  },
  {
    id: "hanzi-radical-battle", title: "汉字魔法战", surface: '[data-testid="hanzi-magic-complete"]',
    async interact(page) {
      const primary = page.locator('[data-testid="complete-primary-action"]');
      await expectUsableTarget(primary);
      await primary.click();
      await expect(page.locator('[data-testid="hanzi-magic-chapter-one-m3"]')).toBeVisible({ timeout: 30_000 });
      const chapter = page.getByTestId("hanzi-magic-chapter-one-m3");
      for (let step = 0; step < 8; step += 1) {
        const phase = await chapter.getAttribute("data-phase");
        if (phase === "composition") break;
        if (phase === "encounter") {
          const id = await page.getByTestId("chapter-one-m3-encounter").getAttribute("data-character-id");
          for (const component of getChapterOneCharacter(id!).orderedComponents) {
            await page.locator(`[data-card-id="${component.id}"]`).click();
            await page.locator(`[data-slot-id="${component.slotId}"]`).click();
          }
        } else {
          const phaseActions: Record<string, string> = { camp: "start-run", "route-choice": "choose-route", "behavior-telegraph": "begin-behavior", "behavior-effect": "recover-behavior" };
          const action = phaseActions[phase ?? ""];
          if (!action) throw new Error(`Unexpected first-chapter phase: ${phase}`);
          await page.locator(`[data-action="${action}"]`).first().click();
        }
      }
      await expect(chapter).toHaveAttribute("data-phase", "composition");
      await page.locator('a[href*="play=hanzi-magic-complete"]').first().click();
      await expect(page.locator('[data-testid="hanzi-magic-complete"]')).toBeVisible();
      return primary;
    },
  },
  {
    id: "english-spell-battle", title: "英语世界", surface: '[data-testid="english-world-map"]',
    async interact(page) {
      const region = page.locator(".wordlight-region button").first();
      await expectUsableTarget(region);
      await region.click();
      await expect(page.getByTestId("english-region")).toBeVisible();
      await page.getByRole("button", { name: "← 回岛屿地图" }).click();
      await expect(page.getByTestId("english-world-map")).toBeVisible();
      return region;
    },
  },
  {
    id: "make-target", title: "目标工坊", surface: ".make-target-game",
    canonicalRoute: "/?world=math-world&station=target",
    async interact(page) {
      const cards = page.locator(".make-target-card");
      await cards.nth(0).click();
      await cards.nth(1).click();
      await page.getByRole("button", { name: "+", exact: true }).click();
      const action = page.getByRole("button", { name: "合并" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator(".make-target-history li")).toHaveCount(1);
      return action;
    },
  },
  {
    id: "equation-slider", title: "算式滑轨", surface: ".equation-slider",
    canonicalRoute: "/?world=math-world&station=slider",
    async interact(page) {
      await page.getByRole("button", { name: "跳过教程" }).click();
      const action = page.getByRole("button", { name: "第 2 列向上移动" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator("[data-coverage-progress]")).toHaveText("2/6");
      return action;
    },
  },
] as const;

for (const game of GAMES) {
  test(`@game:${game.id} enters, completes one primary interaction, and returns`, async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto(game.canonicalRoute ?? "/?hub=classic", { waitUntil: "domcontentloaded" });
    if (!game.canonicalRoute) {
      await expect(page.locator(".game-card")).toHaveCount(3);
      const card = page.locator(`.game-card[data-game-id="${game.id}"]`);
      await expect(card.getByRole("heading", { name: game.title, exact: true })).toBeVisible();
      const entry = card.getByRole("button");
      await expectUsableTarget(entry);
      await entry.focus();
      await expect(entry).toBeFocused();
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(game.surface)).toBeVisible({ timeout: 30_000 });
    await game.interact(page);
    await expectNoFatalOverflow(page);

    if (game.canonicalRoute) {
      await page.goto("/?hub=classic", { waitUntil: "domcontentloaded" });
    } else if (game.id === "hanzi-radical-battle") {
      const returnLink = page.locator('a[href*="hub=classic"]').first();
      await expectUsableTarget(returnLink);
      await returnLink.click();
    } else if (game.id === "math-lab") {
      await page.getByRole("link", { name: "回我的游戏世界" }).click();
      await expect(page.getByTestId("world-treasure-box")).toBeVisible();
      await page.getByTestId("world-treasure-box").getByRole("link").click();
    } else if (game.id === "english-spell-battle") {
      const returnLink = page.getByRole("link", { name: "回我的游戏世界" });
      await expectUsableTarget(returnLink);
      await returnLink.click();
    } else {
      const returnButton = page.getByRole("button", { name: "返回大厅", exact: true });
      await expectUsableTarget(returnButton);
      await returnButton.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(".game-card")).toHaveCount(3);
    await expectRuntimeClean(runtime);
  });
}

test("@portfolio public route registry preserves world, classic, and Hanzi legacy routes", async ({ page }) => {
  const runtime = observeRuntime(page);
  const routes = [
    ["/", '[data-testid="my-game-world"]'],
    ["/?world=my-game-world", '[data-testid="my-game-world"]'],
    ["/?hub=classic", ".hub-grid"],
    ["/?world=english-world", '[data-testid="english-world-map"]'],
    ["/?play=english-spell-battle-legacy&from=hub", ".english-spell-game"],
    ["/?world=math-world", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=lab", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=clock", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=array", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=target", '[data-station-id="target"] .make-target-game'],
    ["/?world=math-world&station=slider", '[data-station-id="slider"] .equation-slider'],
    ["/?play=hanzi-magic-complete&from=hub", '[data-testid="hanzi-magic-complete"]'],
    ["/?play=hanzi-magic-complete&view=pinyin", '[data-testid="sound-rhyme-trial"]'],
    ["/?play=hanzi-magic-complete&view=memory", '[data-testid="memory-match"]'],
    ["/?play=pinyin-magic-battle", '[data-testid="sound-rhyme-trial"]'],
    ["/?play=hanzi-v2-chapter-one&from=hub", '[data-testid="hanzi-magic-chapter-one-m3"]'],
    ["/?play=hanzi-v2-v1&from=hub", '[data-testid="hanzi-magic-v1"]'],
  ] as const;
  for (const [route, selector] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 });
    await expectNoFatalOverflow(page);
  }
  await expectRuntimeClean(runtime);
});

test("@portfolio bare public URL has the same fullscreen geometry as the explicit world route", async ({ page }, testInfo) => {
  const runtime = observeRuntime(page);
  if (testInfo.project.name === "desktop-1440") await page.setViewportSize({ width: 2560, height: 1440 });

  const readWorldGeometry = async () => page.evaluate(() => {
    const app = document.querySelector<HTMLElement>("#app");
    const world = document.querySelector<HTMLElement>("[data-testid=my-game-world]");
    const stage = document.querySelector<HTMLElement>(".world-stage");
    if (!app || !world || !stage) throw new Error("My Game World geometry is unavailable");
    return {
      pageMode: [...document.body.classList].find((name) => name.endsWith("-page") && name.startsWith("game-")) ?? "none",
      viewportHeight: window.innerHeight,
      appHeight: app.getBoundingClientRect().height,
      worldHeight: world.getBoundingClientRect().height,
      stageHeight: stage.getBoundingClientRect().height,
      documentScrollHeight: document.documentElement.scrollHeight,
    };
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("my-game-world")).toBeVisible();
  const firstLoad = await readWorldGeometry();

  await page.goto("/?world=my-game-world", { waitUntil: "networkidle" });
  await expect(page.getByTestId("my-game-world")).toBeVisible();
  const explicitRoute = await readWorldGeometry();

  expect(firstLoad.pageMode).toBe("game-fullscreen-page");
  expect(firstLoad.appHeight).toBeCloseTo(firstLoad.viewportHeight, 0);
  expect(firstLoad.worldHeight).toBeCloseTo(firstLoad.viewportHeight, 0);
  expect(firstLoad.documentScrollHeight).toBeLessThanOrEqual(firstLoad.viewportHeight + 1);
  expect(firstLoad.stageHeight).toBeCloseTo(explicitRoute.stageHeight, 0);
  expect(firstLoad.worldHeight).toBeCloseTo(explicitRoute.worldHeight, 0);
  await expectRuntimeClean(runtime);
});
