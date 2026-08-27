import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PLAY_SURFACE_MANIFEST, type PlaySurfaceRecord } from "../../../packages/data/playSurfaceManifest";
import { activateAndExpectStateChange, expectHitTarget } from "../helpers/hit-target";

const REPORTS = resolve("test-results/interaction-integrity/reports");
const RETURN_WORDS = /^(?:←\s*)?(?:回|返回|退出)|回到|回我的|回游戏|回城市|回地图|返回/;

interface RuntimeObservation {
  pageErrors: string[];
  consoleErrors: string[];
  failedResponses: string[];
  failedRequests: string[];
  externalRequests: string[];
}

function observe(page: Page): RuntimeObservation {
  const result: RuntimeObservation = { pageErrors: [], consoleErrors: [], failedResponses: [], failedRequests: [], externalRequests: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) result.failedResponses.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") result.failedRequests.push(`${request.url()} ${request.failure()?.errorText}`); });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (/^https?:$/.test(requestUrl.protocol) && requestUrl.hostname !== "127.0.0.1") result.externalRequests.push(request.url());
  });
  return result;
}

async function visibleEnabled(locator: Locator): Promise<Locator[]> {
  const result: Locator[] = [];
  for (let index = 0; index < await locator.count(); index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible() && await candidate.isEnabled()) result.push(candidate);
  }
  return result;
}

async function label(locator: Locator): Promise<string> {
  return locator.evaluate((element) => (element.getAttribute("aria-label") ?? element.textContent ?? "").trim());
}

async function isAlreadyActive(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const control = element as HTMLElement;
    return control.classList.contains("is-active")
      || control.getAttribute("aria-current") === "true"
      || control.getAttribute("aria-pressed") === "true"
      || control.getAttribute("aria-selected") === "true";
  });
}

function routeMatches(url: string, expectedQuery: string): boolean {
  const actual = new URL(url);
  const expected = new URL(expectedQuery, "http://route.invalid/");
  return [...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value);
}

async function findReturnControl(page: Page, record: PlaySurfaceRecord): Promise<Locator | null> {
  const controls = await visibleEnabled(page.locator("a[href], button"));
  for (const control of controls) {
    const href = await control.getAttribute("href");
    if (href && routeMatches(new URL(href, page.url()).href, record.returnRoute)) return control;
  }
  for (const control of controls) {
    if (RETURN_WORDS.test(await label(control))) return control;
  }
  return null;
}

async function closeIntentionalModal(page: Page): Promise<boolean> {
  const dialogs = page.locator('[role="dialog"][aria-modal="true"]:visible');
  if (!await dialogs.count()) return false;
  const controls = await visibleEnabled(dialogs.last().locator("button, a[href]"));
  let close: Locator | null = null;
  for (const control of controls) {
    if (/关闭|合上|返回|回到/.test(await label(control))) { close = control; break; }
  }
  expect(close, "an intentional modal must expose a visible close control before background return actions are tested").not.toBeNull();
  await expectHitTarget(close!, { minimumRatio: 1, minimumSize: 24 });
  await close!.click({ trial: true });
  await activateAndExpectStateChange(page, close!, "pointer");
  await expect(dialogs).toHaveCount(0);
  return true;
}

test("@hittest @representative @portfolio all manifest surfaces expose topmost critical controls and real actions", async ({ page }, testInfo) => {
  const runtime = observe(page);
  const rows: unknown[] = [];
  const startAt = process.env.HITTEST_START_SURFACE;
  const startIndex = startAt ? PLAY_SURFACE_MANIFEST.findIndex((record) => record.id === startAt) : 0;
  expect(startIndex, `Unknown HITTEST_START_SURFACE=${startAt}`).toBeGreaterThanOrEqual(0);
  const endAt = process.env.HITTEST_END_SURFACE;
  const endIndex = endAt ? PLAY_SURFACE_MANIFEST.findIndex((record) => record.id === endAt) : PLAY_SURFACE_MANIFEST.length - 1;
  expect(endIndex, `Unknown HITTEST_END_SURFACE=${endAt}`).toBeGreaterThanOrEqual(startIndex);
  const records = PLAY_SURFACE_MANIFEST.slice(startIndex, endIndex + 1);
  for (const record of records) {
    await test.step(`${record.id}: hit test, real action, public return`, async () => {
      await page.goto(`/${record.route}`, { waitUntil: "domcontentloaded" });
      await expect.poll(async () => (await visibleEnabled(page.locator(record.primaryActionSelector))).length, { message: `${record.id} must expose a visible enabled manifest action` }).toBeGreaterThan(0);
      const actions = await visibleEnabled(page.locator(record.primaryActionSelector));
      const actionEvidence: unknown[] = [];
      for (const action of actions) {
        // The manifest selector can include secondary text links. Enforce their hit-test
        // integrity here; the chosen child primary action is size-gated below.
        const evidence = await expectHitTarget(action, { minimumRatio: 1, minimumSize: 1 });
        actionEvidence.push({ label: evidence.label, selector: evidence.selector, rect: evidence.rect, hitSuccessRatio: evidence.hitSuccessRatio });
      }
      const nonReturn = [] as Locator[];
      for (const action of actions) {
        if (!RETURN_WORDS.test(await label(action)) && !(await action.getAttribute("data-return-map")) && !await isAlreadyActive(action)) nonReturn.push(action);
      }
      const primary = nonReturn[0] ?? actions[0];
      const primaryLabel = await label(primary);
      await expectHitTarget(primary, { minimumRatio: 1, minimumSize: record.id.startsWith("math-") ? 42 : 44 });
      await primary.click({ trial: true });
      await activateAndExpectStateChange(page, primary, "pointer");
      await expect.poll(async () => {
        const text = await page.locator("body").innerText();
        return !text.includes("正在打开游戏世界") && (await visibleEnabled(page.locator("a[href], button"))).length > 0;
      }, { message: `${record.id} real action destination must finish loading`, timeout: 30_000 }).toBe(true);
      const modalClosed = await closeIntentionalModal(page);

      const returnResult = RETURN_WORDS.test(primaryLabel) ? "PRIMARY_ACTION_WAS_RETURN" : "PASS";
      if (returnResult === "PASS" && !routeMatches(page.url(), record.returnRoute)) {
        const returnControl = await findReturnControl(page, record);
        expect(returnControl, `${record.id} must expose a public return control after its real primary action`).not.toBeNull();
        await expectHitTarget(returnControl!, { minimumRatio: 1, minimumSize: 1 });
        await returnControl!.click({ trial: true });
        await activateAndExpectStateChange(page, returnControl!, "pointer");
        if (record.kind === "classic-hub" && routeMatches(page.url(), record.route) && !routeMatches(page.url(), record.returnRoute)) {
          // A route/placeholder change can precede the lazy Classic wrapper mount on slower CI runners.
          // Bind the next control lookup to the public terminal surface, not that intermediate state.
          await expect(page.getByTestId("classic-hub-from-world")).toBeVisible();
          const parentReturn = await findReturnControl(page, record);
          expect(parentReturn, `${record.id} must expose its parent-world return after the played product returns to Classic`).not.toBeNull();
          await expectHitTarget(parentReturn!, { minimumRatio: 1, minimumSize: 1 });
          await parentReturn!.click({ trial: true });
          await activateAndExpectStateChange(page, parentReturn!, "pointer");
        }
        await expect.poll(() => routeMatches(page.url(), record.returnRoute), { message: `${record.id} return must reach ${record.returnRoute}` }).toBe(true);
      } else if (returnResult === "PRIMARY_ACTION_WAS_RETURN") {
        await expect.poll(() => routeMatches(page.url(), record.returnRoute), { message: `${record.id} primary return must reach ${record.returnRoute}` }).toBe(true);
      }

      rows.push({ surfaceId: record.id, route: record.route, productId: record.productId, kind: record.kind, project: testInfo.project.name, criticalControls: actionEvidence.length, actionEvidence, realPrimaryClick: "PASS", modalClosed, return: returnResult });
    });
  }
  expect(runtime.pageErrors, "page errors").toEqual([]);
  expect(runtime.consoleErrors, "console errors").toEqual([]);
  expect(runtime.failedResponses, "responses >=400").toEqual([]);
  expect(runtime.failedRequests, "failed requests").toEqual([]);
  expect(runtime.externalRequests, "unexpected external requests").toEqual([]);
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, `PLAY_SURFACE_HITTEST_MATRIX.${testInfo.project.name}.json`), `${JSON.stringify({ verdict: "PASS", project: testInfo.project.name, manifestSurfaceCount: PLAY_SURFACE_MANIFEST.length, testedSurfaceCount: rows.length, startAt: startAt ?? null, endAt: endAt ?? null, rows, runtime }, null, 2)}\n`, "utf8");
  expect(rows).toHaveLength(records.length);
});

test("@hittest @representative modal close, fixed-layer, and destructive cancel controls stay reachable", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/?world=my-game-world", { waitUntil: "domcontentloaded" });
  const settings = page.getByRole("button", { name: /家长角/ });
  await expectHitTarget(settings, { minimumRatio: 1, minimumSize: 44 });
  await settings.click();
  const closeWorld = page.getByRole("button", { name: "回到游戏世界" });
  await expectHitTarget(closeWorld, { minimumRatio: 1, minimumSize: 44 });
  const vaultOpen = page.getByRole("button", { name: "打开游戏进度保险箱" });
  await expectHitTarget(vaultOpen, { minimumRatio: 1, minimumSize: 44 });
  await vaultOpen.click();
  const vault = page.getByTestId("save-vault");
  await expect(vault).toBeVisible();
  await expectHitTarget(vault.getByRole("button", { name: "备份游戏进度" }), { minimumRatio: 1, minimumSize: 44 });
  await expect(vault.getByRole("button", { name: "清空已知游戏进度" })).toBeDisabled();
  await expectHitTarget(closeWorld, { minimumRatio: 1, minimumSize: 44 });
  await closeWorld.click();
  await expect(settings).toBeFocused();

  await page.goto("/?play=hanzi-magic-complete", { waitUntil: "domcontentloaded" });
  const parent = page.getByRole("button", { name: "打开家长角" });
  await expectHitTarget(parent, { minimumRatio: 1, minimumSize: 44 });
  await parent.click();
  const closeParent = page.getByRole("button", { name: "返回森林" });
  await expectHitTarget(closeParent, { minimumRatio: 1, minimumSize: 44 });
  await closeParent.click();
  await expect(page.getByTestId("complete-parent-panel")).toHaveCount(0);

  await page.goto("/?world=my-game-world&parent=observation", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("observation-notebook")).toBeVisible();
  const destructive = page.locator("[data-observation-delete-all]");
  await expectHitTarget(destructive, { minimumRatio: 1, minimumSize: 44 });
  const observationKey = "game-codex/parent-observation/v1";
  const sentinel = '{"version":1,"records":[{"id":"cancel-preserves-bytes"}]}';
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [observationKey, sentinel]);
  page.once("dialog", (dialog) => void dialog.dismiss());
  await destructive.click();
  expect(await page.evaluate((key) => localStorage.getItem(key), observationKey)).toBe(sentinel);
});

test("@hittest @full 100 transitions leave no stale overlay before primary hit tests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1366");
  const routes = PLAY_SURFACE_MANIFEST.map((record) => record.route);
  const rows: unknown[] = [];
  for (let transition = 0; transition < 100; transition += 1) {
    const record = PLAY_SURFACE_MANIFEST[transition % PLAY_SURFACE_MANIFEST.length];
    await page.goto(`/${routes[transition % routes.length]}`, { waitUntil: "domcontentloaded" });
    const actions = await expect.poll(async () => (await visibleEnabled(page.locator(record.primaryActionSelector))).length).toBeGreaterThan(0).then(() => visibleEnabled(page.locator(record.primaryActionSelector)));
    const evidence = await expectHitTarget(actions[0], { minimumRatio: 1, minimumSize: 24 });
    expect(await page.locator("#app > *").count()).toBe(1);
    expect(await page.locator(".wordlight-dialog-backdrop:visible, .world-modal:visible, [aria-modal=true]:visible").count()).toBe(0);
    expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);
    rows.push({ transition: transition + 1, surfaceId: record.id, hitSuccessRatio: evidence.hitSuccessRatio });
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, "LONG_TRANSITION_HITTEST.json"), `${JSON.stringify({ verdict: "PASS", transitions: rows.length, staleOverlay: 0, invisibleBackdrop: 0, orphanFixedLayer: 0, doubleMount: 0, rows }, null, 2)}\n`, "utf8");
});
