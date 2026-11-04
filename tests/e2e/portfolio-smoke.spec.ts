import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

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
    id: "structure-explorer", title: "结构探索馆", surface: ".structure-explorer",
    canonicalRoute: "/?play=structure-explorer",
    async interact(page) {
      await page.locator('[data-structure-pencil]').click();
      const demo = page.frameLocator('[data-pencil-frame]');
      await expect(demo.locator('canvas#pencil-3d')).toBeVisible();
      await demo.locator('#boom').click();
      await expect(demo.locator('#three-host')).toHaveAttribute('data-exploded', 'true');
      await expect(demo.locator('#readout')).toContainText('五个观察对象');
      await page.locator('[data-structure-directory]').click();
      await expect(page.locator('[data-structure-pencil]')).toBeVisible();
      await page.locator('[data-structure-home]').click();
      await expect(page.locator('[data-world-structure-link]')).toBeFocused();
      return null;
    },
  },
  {
    id: "oddity-puzzles", title: "奇物事务所", surface: ".oddity-mount",
    canonicalRoute: "/?play=oddity-puzzles",
    async interact(page) {
      await expect(page.locator('.odd-stage')).toHaveAttribute('data-ready', 'true');
      for (let i=0;i<2;i++) await page.locator('[data-cmd=skipDemo]').click();
      await page.locator('[data-landmark="node:window"]').click();
      await expect(page.locator('.oddity-mount')).toHaveAttribute('data-intent','none');
      expect(JSON.parse(await page.locator('.oddity-mount').getAttribute('data-state') ?? '{}').actors[0].node).toBe('window');
      await expect(page.locator('.oddity-mount')).toHaveAttribute('data-history','1');
      await page.locator('[data-cmd=undo]').click();
      await expect(page.locator('.oddity-mount')).toHaveAttribute('data-history','0');
      expect(JSON.parse(await page.locator('.oddity-mount').getAttribute('data-state') ?? '{}').actors[0].node).toBe('exit');
      await page.locator('.odd-home').click();
      await expect(page.locator('[data-world-oddity-link]')).toBeVisible();
      return null;
    },
  },
  {
    id: "hanzi-word-adventure", title: "字间行者", surface: '[data-testid="hanzi-word-adventure"]',
    canonicalRoute: "/?play=hanzi-word-adventure",
    async interact(page) {
      await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready', 'true');
      await page.locator('[data-hway-new]').click();
      await page.locator('[data-hway-chapter="homeward"]').click();
      const move = page.locator('[data-hway-move="right"]'); await expectUsableTarget(move); await move.click();
      await expect(page.locator('.hway')).toHaveAttribute('data-player', '9');
      await page.locator('[data-hway-undo]').click(); await expect(page.locator('.hway')).toHaveAttribute('data-player', '8');
      await page.locator('[data-hway-exit]').click(); await expect(page.getByTestId('my-game-world')).toBeVisible();
      return null;
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
    id: "hanzi-tower-defense", title: "字阵守城", surface: '[data-testid="hanzi-tower-defense"]',
    async interact(page) {
      const pause = page.locator("[data-td-pause]");
      await expect(pause).toBeEnabled(); await pause.click();
      await expect(page.locator(".td-game")).toHaveAttribute("data-paused", "true");
      await page.locator('[data-core="2"]').click(); await page.locator('[data-slot="0"]').click();
      await expect(page.locator('[data-structure="top-bottom"]')).toBeVisible();
      await page.locator('[data-td-fuse]').click();
      await expect(page.locator('[data-slot="0"]')).toContainText("炎");
      return pause;
    },
  },
  {
    id: "make-target", title: "目标工坊", surface: ".make-target-game",
    canonicalRoute: "/?world=math-world&station=target",
    async interact(page) {
      const cards = page.getByTestId("target-cards").locator("button");
      await cards.nth(0).click();
      await cards.nth(1).click();
      await page.getByRole("button", { name: "+", exact: true }).click();
      const action = page.getByRole("button", { name: "合并" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.getByTestId("target-history")).toContainText("1 + 2 = 3");
      return action;
    },
  },
  {
    id: "equation-slider", title: "算式滑轨", surface: ".equation-slider",
    canonicalRoute: "/?world=math-world&station=slider",
    async interact(page) {
      await page.getByRole("button", { name: "跳过教程" }).click();
      const action = page.getByRole("button", { name: "第 2 列选上方格" });
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
      await expect(page.locator(".game-card")).toHaveCount(5);
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
    } else if (game.id === "hanzi-tower-defense") {
      await page.locator('[data-td-home]').click();
    } else if (game.id === "math-lab") {
      await page.getByRole("link", { name: "回我的游戏世界" }).click();
      await expect(page.getByTestId("world-treasure-box")).toBeVisible();
      await page.getByTestId("world-treasure-box").locator('[data-world-treasure-link]').click();
    } else {
      const returnButton = page.getByRole("button", { name: "返回大厅", exact: true });
      await expectUsableTarget(returnButton);
      await returnButton.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(".game-card")).toHaveCount(5);
    await expectRuntimeClean(runtime);
  });
}

test("@portfolio public route registry preserves current routes and retires old language links", async ({ page }) => {
  const runtime = observeRuntime(page);
  const routes = [
    ["/", '[data-testid="my-game-world"]'],
    ["/?world=my-game-world", '[data-testid="my-game-world"]'],
    ["/?hub=classic", ".hub-grid"],
    ["/?world=english-world", '[data-testid="my-game-world"]'],
    ["/?play=english-spell-battle-legacy&from=hub", '[data-testid="my-game-world"]'],
    ["/?play=hanzi-tower-defense", '[data-testid="hanzi-tower-defense"]'],
    ["/?play=hanzi-word-adventure", '[data-testid="hanzi-word-adventure"]'],
    ["/?world=math-world", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=lab", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=clock", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=array", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=target", '[data-station-id="target"] .make-target-game'],
    ["/?world=math-world&station=slider", '[data-station-id="slider"] .equation-slider'],
    ["/?play=hanzi-magic-complete&from=hub", '[data-testid="my-game-world"]'],
    ["/?play=hanzi-magic-complete&view=pinyin", '[data-testid="my-game-world"]'],
    ["/?play=hanzi-magic-complete&view=memory", '[data-testid="my-game-world"]'],
    ["/?play=pinyin-magic-battle", '[data-testid="my-game-world"]'],
    ["/?play=hanzi-v2-chapter-one&from=hub", '[data-testid="my-game-world"]'],
    ["/?play=hanzi-v2-v1&from=hub", '[data-testid="my-game-world"]'],
  ] as const;
  for (const [route, selector] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 });
    await expectNoFatalOverflow(page);
  }
  await expectRuntimeClean(runtime);
});

test("@portfolio bare public URL has the same document-scroll geometry as the explicit world route", async ({ page }, testInfo) => {
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
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      overflowY: getComputedStyle(document.body).overflowY,
    };
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("my-game-world")).toBeVisible();
  const firstLoad = await readWorldGeometry();

  await page.goto("/?world=my-game-world", { waitUntil: "networkidle" });
  await expect(page.getByTestId("my-game-world")).toBeVisible();
  const explicitRoute = await readWorldGeometry();

  expect(firstLoad.pageMode).toBe("game-scrollable-page");
  expect(firstLoad.overflowY).toBe("auto");
  expect(firstLoad.worldHeight).toBeGreaterThanOrEqual(firstLoad.viewportHeight);
  expect(firstLoad.documentScrollWidth).toBe(firstLoad.viewportWidth);
  expect(firstLoad.documentScrollHeight).toBe(explicitRoute.documentScrollHeight);
  expect(firstLoad.appHeight).toBeCloseTo(explicitRoute.appHeight, 0);
  expect(firstLoad.stageHeight).toBeCloseTo(explicitRoute.stageHeight, 0);
  expect(firstLoad.worldHeight).toBeCloseTo(explicitRoute.worldHeight, 0);
  await expectRuntimeClean(runtime);
});

const BOX_ENTRY_MODULE = /\/(?:games\/world-in-a-box\/boxes\.ts|assets\/boxes-[^/]+\.js)(?:\?.*)?$/;
const DRESDEN_MODULE = /\/(?:games\/world-in-a-box\/dresden-runtime\.ts|assets\/dresden-runtime-[^/]+\.js)(?:\?.*)?$/;
const BOX_CARD = '.game-card[data-game-id="world-in-a-box"] button';
const SWITCH_BOX = '[data-action="boxes"]';

async function pressTabTo(page: Page, control: Locator): Promise<void> {
  for (let step = 0; step < 24; step++) {
    await page.keyboard.press("Tab");
    if (await control.evaluate(element => element === document.activeElement)) return;
  }
  await expect(control).toBeFocused();
}

async function holdRequest(page: Page, matcher: Parameters<Page["route"]>[0]) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: (url: string) => void;
  const requested = new Promise<string>(resolve => { started = resolve; });
  const handle = async (route: Route) => {
    started(route.request().url());
    await gate;
    await route.continue().catch(() => { /* Leaving can cancel the held browser request. */ });
  };
  await page.route(matcher, handle);
  return { requested, release, unroute: () => page.unroute(matcher, handle) };
}

test("@recovery a failed game entry can retry and return to its Classic card", async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const keyboard = testInfo.project.name === "desktop-1440";
  await page.goto("/?hub=classic");
  const card = page.locator(BOX_CARD);
  await expect(card).toBeVisible();
  await page.evaluate(() => localStorage.setItem("family-games/world-in-a-box/v1", '{"synthetic":"keep these bytes"}'));
  const originalStorage = await page.evaluate(() => ({ ...localStorage }));
  await context.route(BOX_ENTRY_MODULE, route => route.abort());
  if (keyboard) {
    await pressTabTo(page, card);
    await page.keyboard.press("Enter");
  } else await card.tap();
  const heading = page.getByRole("heading", { name: "这个地方暂时没有打开" });
  await expect(heading).toBeFocused();
  const retry = page.getByRole("button", { name: "再试一次" });
  if (keyboard) {
    await page.keyboard.press("Tab");
    await expect(retry).toBeFocused();
  }
  await expect(page.getByRole("link", { name: "回游戏百宝箱" })).toHaveAttribute("href", "?hub=classic&from=world");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(originalStorage);
  await context.unroute(BOX_ENTRY_MODULE);
  await (keyboard ? page.keyboard.press("Enter") : retry.tap());
  await expect(page.locator(SWITCH_BOX)).toBeVisible();
  const exit = page.locator('[data-action="exit"]');
  if (keyboard) {
    await pressTabTo(page, exit);
    await page.keyboard.press("Enter");
  } else await exit.tap();
  await expect(card).toBeFocused();
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(originalStorage);
  expect(errors).toEqual([]);
});

test("@recovery a pending route and a pending box switch can both be exited", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile-390";
  const activateControl = (control: Locator) => mobile ? control.tap() : control.click();
  await page.goto("/");
  const homeEntry = page.locator("[data-world-box-link]");
  for (const target of [BOX_ENTRY_MODULE, DRESDEN_MODULE]) {
    const held = await holdRequest(page, target);
    try {
      await activateControl(homeEntry);
      if (target === DRESDEN_MODULE) {
        await activateControl(page.locator(SWITCH_BOX));
        await activateControl(page.locator('[data-box="dresden-river-campus"]'));
      }
      await held.requested;
      const back = target === BOX_ENTRY_MODULE
        ? page.locator(".route-state").getByRole("link", { name: "回我的游戏世界" })
        : page.locator(".box-entry").getByRole("button", { name: "返回", exact: true });
      await activateControl(back);
      await expect(homeEntry).toBeFocused();
    } finally {
      held.release();
      await held.unroute();
    }
    await expect(page.locator("canvas, .box-entry")).toHaveCount(0);
  }
  await activateControl(homeEntry);
  await expect(page.locator(SWITCH_BOX)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("@recovery a failed box switch keeps its retry URL and updates it on fallback", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile-390";
  const activateControl = (control: Locator) => mobile ? control.tap() : control.click();
  await page.route(DRESDEN_MODULE, route => route.abort());
  await page.goto("/?play=world-in-a-box");
  await activateControl(page.locator(SWITCH_BOX));
  await activateControl(page.locator('[data-box="dresden-river-campus"]'));
  await expect(page.getByRole("heading", { name: "盒子暂时打不开" })).toBeFocused();
  await expect(page).toHaveURL(/scene=dresden-river-campus/);
  await activateControl(page.getByRole("button", { name: "返回窗边有风" }));
  await expect(page.locator(SWITCH_BOX)).toBeFocused();
  await expect(page).toHaveURL(/scene=window-breeze/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "窗边有风" })).toBeVisible();

  await activateControl(page.locator(SWITCH_BOX));
  await activateControl(page.locator('[data-box="dresden-river-campus"]'));
  await expect(page.getByRole("heading", { name: "盒子暂时打不开" })).toBeFocused();
  await page.unroute(DRESDEN_MODULE);
  await activateControl(page.getByRole("button", { name: "再试一次" }));
  await expect(page.getByRole("heading", { name: "河流、桥与大学" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("@recovery a restored document ignores a stale scene import in the same document", async ({ page }) => {
  const held = await holdRequest(page, DRESDEN_MODULE);
  const frozen = page.getByRole("heading", { name: "艾莎的冰雪游乐日" });
  try {
    await page.goto("/?play=world-in-a-box");
    await page.locator(SWITCH_BOX).click();
    await page.locator('[data-box="dresden-river-campus"]').click();
    const oldModule = await held.requested;
    // While a switch is pending the UI only offers exit. Simulate a persisted
    // restore with a newer scene selection so both imports run in one document.
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      const url = new URL(location.href);
      url.searchParams.set("scene", "frozen-elsa-playground");
      history.replaceState(history.state, "", url);
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await expect(frozen).toBeVisible();
    await expect(page.locator(SWITCH_BOX)).toBeFocused();
    held.release();
    await page.evaluate(async url => {
      await import(url);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }, oldModule);
    await expect(frozen).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator(SWITCH_BOX)).toHaveCount(1);
    await expect(page).toHaveURL(/scene=frozen-elsa-playground/);
  } finally {
    held.release();
    await held.unroute();
  }
});

test("@recovery a pending home entry can be refreshed", async ({ page }) => {
  const shell = await page.request.get("/");
  const entry = (await shell.text()).match(/<script type="module"[^>]+src="([^"]+)"/)?.[1];
  expect(entry).toBeTruthy();
  const bootstrap = new URL(entry!, shell.url()).pathname;
  let holdHome = true;
  const held = await holdRequest(page, url => holdHome && (url.pathname === "/apps/my-game-world/index.ts"
    || (url.pathname !== bootstrap && /^\/assets\/index-.*\.js$/.test(url.pathname))));
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await held.requested;
    const refresh = page.getByRole("button", { name: "刷新" });
    await expect(refresh).toBeVisible();
    // Keep the original request held while allowing the new document's request.
    holdHome = false;
    await Promise.all([page.waitForEvent("framenavigated"), refresh.click()]);
    await expect(page.getByTestId("my-game-world")).toBeVisible();
  } finally {
    held.release();
    await held.unroute();
  }
});
