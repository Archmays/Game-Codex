import { createWriteStream } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";

type Viewport = { width: number; height: number; label: string };

type ScreenshotEntry = {
  readonly fileName: string;
  readonly verifies: string;
  readonly viewport: string;
  readonly visualStateId: string;
  readonly url: string;
};

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const requestedPort = process.env.STEP03_CAPTURE_PORT ?? "5176";
const port = Number(requestedPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`STEP03_CAPTURE_PORT must be an integer from 1 to 65535; received '${requestedPort}'.`);
}

const baseUrl = `http://127.0.0.1:${port}`;
const screenshotsRoot = resolve(repositoryRoot, "artifacts/hanzi-radical-battle-v2/step-03/screenshots");
const representativeRoot = resolve(screenshotsRoot, "representative");
const rawRoot = resolve(screenshotsRoot, "raw");
const traceRoot = resolve(screenshotsRoot, "trace");
const viteCli = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const screenshotEntries: ScreenshotEntry[] = [];
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const remoteRequests: string[] = [];

const desktop: Viewport = { width: 1440, height: 900, label: "desktop 1440x900" };
const tablet: Viewport = { width: 1024, height: 768, label: "tablet landscape 1024x768" };
const mobile: Viewport = { width: 390, height: 844, label: "phone portrait 390x844" };

function playUrl(): string {
  return `${baseUrl}/?play=hanzi-v2-golden-slice`;
}

function reviewUrl(): string {
  return `${baseUrl}/?review=hanzi-v2-step03`;
}

async function waitForServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Dedicated STEP 03 Vite process exited before it became ready (exit ${server.exitCode}).`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The strict-port Vite process is still booting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Dedicated STEP 03 Vite server did not respond at ${baseUrl} within 60 seconds.`);
}

async function stopOwnServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.exitCode !== null || server.killed) return;
  server.kill("SIGTERM");
  const stopped = await Promise.race([
    once(server, "exit").then(() => true),
    new Promise<boolean>((resolveDelay) => setTimeout(() => resolveDelay(false), 5_000)),
  ]);
  if (!stopped && server.exitCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

function observe(page: Page): void {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) remoteRequests.push(request.url());
  });
}

async function withPlayScenario(
  browser: Browser,
  traceName: string,
  viewport: Viewport,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await context.addInitScript(() => window.localStorage.clear());
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  observe(page);
  try {
    await page.goto(playUrl(), { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-v2-golden-slice").waitFor({ timeout: 15_000 });
    await waitForVisualState(page, "boot");
    await run(page);
  } finally {
    await context.tracing.stop({ path: resolve(traceRoot, `${traceName}.zip`) });
    await context.close();
  }
}

async function withReviewScenario(browser: Browser, run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: desktop.width, height: desktop.height }, deviceScaleFactor: 1 });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  observe(page);
  try {
    await page.goto(reviewUrl(), { waitUntil: "domcontentloaded" });
    await page.getByTestId("step03-review-app").waitFor({ timeout: 15_000 });
    await run(page);
  } finally {
    await context.tracing.stop({ path: resolve(traceRoot, "review-surfaces.zip") });
    await context.close();
  }
}

async function waitForVisualState(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(
    (state) => document.querySelector("[data-testid='hanzi-v2-golden-slice']")?.getAttribute("data-visual-state-id") === state,
    expected,
    { timeout: 12_000 },
  );
}

async function currentVisualState(page: Page): Promise<string> {
  return (await page.getByTestId("hanzi-v2-golden-slice").getAttribute("data-visual-state-id")) ?? "MISSING";
}

async function saveWebp(page: Page, locator: Locator, fileName: string): Promise<void> {
  const png = await locator.screenshot({ animations: "disabled" });
  await writeFile(resolve(rawRoot, fileName.replace(/\.webp$/i, ".png")), png);
  const dataUrl = await page.evaluate(async (pngBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${pngBase64}`;
    await new Promise<void>((resolveImage, rejectImage) => {
      image.addEventListener("load", () => resolveImage(), { once: true });
      image.addEventListener("error", () => rejectImage(new Error("Raw screenshot could not be decoded for WebP export.")), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.92);
  }, png.toString("base64"));
  if (!dataUrl.startsWith("data:image/webp;base64,")) {
    throw new Error(`Chromium did not encode ${fileName} as WebP.`);
  }
  const webp = Buffer.from(dataUrl.slice("data:image/webp;base64,".length), "base64");
  if (webp.subarray(0, 4).toString("ascii") !== "RIFF" || webp.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`WebP byte signature check failed for ${fileName}.`);
  }
  await writeFile(resolve(representativeRoot, fileName), webp);
}

async function capturePlay(
  page: Page,
  fileName: string,
  verifies: string,
  viewport: Viewport,
  expectedState: string,
): Promise<void> {
  const visualStateId = await currentVisualState(page);
  if (visualStateId !== expectedState) {
    throw new Error(`${fileName} expected visual state '${expectedState}', received '${visualStateId}'.`);
  }
  await saveWebp(page, page.getByTestId("hanzi-v2-golden-slice"), fileName);
  screenshotEntries.push({ fileName, verifies, viewport: viewport.label, visualStateId, url: page.url() });
}

async function captureReview(
  page: Page,
  fileName: string,
  verifies: string,
  stateId: string,
  locatorSelector = "[data-testid='step03-review-app']",
): Promise<void> {
  await saveWebp(page, page.locator(locatorSelector).first(), fileName);
  screenshotEntries.push({ fileName, verifies, viewport: desktop.label, visualStateId: stateId, url: page.url() });
}

async function clickPrimary(page: Page, label: string, expectedState: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
  await waitForVisualState(page, expectedState);
}

async function selectAndPlace(page: Page, cardId: string, slotId: string): Promise<void> {
  await page.locator(`[data-card-id='${cardId}']`).click();
  await page.locator(`[data-slot-id='${slotId}']`).click();
}

async function enterMing(page: Page): Promise<void> {
  await clickPrimary(page, "走进墨林", "camp_intro");
  await clickPrimary(page, "看看营地灯", "camp_objective");
  await clickPrimary(page, "沿着灯路出发", "travel_to_battle_1");
  await clickPrimary(page, "跳过小路", "battle_1_intro");
  await clickPrimary(page, "开始合字施法", "battle_1_placing");
}

async function finishMingToBreather(page: Page): Promise<void> {
  await selectAndPlace(page, "ming-ri", "left");
  await selectAndPlace(page, "ming-yue", "right");
  await waitForVisualState(page, "battle_1_forming");
  await waitForVisualState(page, "battle_1_casting");
  await waitForVisualState(page, "battle_1_cleared");
  await clickPrimary(page, "看看光留下什么", "breather_1");
}

async function enterHua(page: Page): Promise<void> {
  await clickPrimary(page, "继续看前路", "travel_to_battle_2");
  await clickPrimary(page, "跳过花径", "battle_2_intro");
  await clickPrimary(page, "试试新的结构", "battle_2_placing");
}

async function finishHuaToAbilityChoice(page: Page): Promise<void> {
  await selectAndPlace(page, "hua-cao", "top");
  await selectAndPlace(page, "hua-hua", "bottom");
  await waitForVisualState(page, "battle_2_forming");
  await waitForVisualState(page, "battle_2_casting");
  await waitForVisualState(page, "battle_2_cleared");
  await clickPrimary(page, "看看三道光", "ability_choice");
}

async function enterBoss(page: Page, abilityId: "guardian-light" | "star-path" | "ink-echo"): Promise<void> {
  await page.getByTestId(`ability-${abilityId}`).click();
  await waitForVisualState(page, "travel_to_boss");
  await clickPrimary(page, "走向双印墨守", "boss_intro");
  await clickPrimary(page, "先看清它的动作", "boss_phase_1_placing");
}

async function waitForInterferenceToClear(page: Page, expectedState: "boss_phase_1_placing" | "boss_phase_2_placing"): Promise<void> {
  await waitForVisualState(page, "boss_interference");
  await waitForVisualState(page, expectedState);
}

async function solveBossAfterLin(page: Page): Promise<void> {
  await selectAndPlace(page, "lin-mu-left", "left");
  await selectAndPlace(page, "lin-mu-right", "right");
  await waitForVisualState(page, "boss_phase_1_forming");
  await waitForVisualState(page, "boss_phase_1_cleared");
  await clickPrimary(page, "解开第二枚墨印", "boss_phase_2_placing");
  await selectAndPlace(page, "xing-ri", "top");
  await waitForInterferenceToClear(page, "boss_phase_2_placing");
  await selectAndPlace(page, "xing-sheng", "bottom");
  await waitForVisualState(page, "boss_phase_2_forming");
  await waitForVisualState(page, "boss_cleared");
}

async function solveFullRunFromBoss(page: Page): Promise<void> {
  await selectAndPlace(page, "lin-mu-left", "left");
  await waitForInterferenceToClear(page, "boss_phase_1_placing");
  await selectAndPlace(page, "lin-mu-right", "right");
  await waitForVisualState(page, "boss_phase_1_cleared");
  await clickPrimary(page, "解开第二枚墨印", "boss_phase_2_placing");
  await selectAndPlace(page, "xing-ri", "top");
  await waitForInterferenceToClear(page, "boss_phase_2_placing");
  await selectAndPlace(page, "xing-sheng", "bottom");
  await waitForVisualState(page, "boss_cleared");
  await clickPrimary(page, "沿星路回营地", "return_to_camp");
  await waitForVisualState(page, "camp_repair");
  await clickPrimary(page, "翻开四字魔法书", "spellbook_review");
  await page.getByRole("button", { name: "让营地继续亮着", exact: true }).click();
  await waitForVisualState(page, "run_complete");
}

async function writeIndex(): Promise<void> {
  const requiredNames = [
    "01-camp-objective-desktop.webp",
    "02-battle-ming-mobile.webp",
    "03-ming-meaning-magic-desktop.webp",
    "04-breather-world-change.webp",
    "05-battle-hua-tablet.webp",
    "06-ability-choice-mobile.webp",
    "07-guardian-light-boss.webp",
    "08-star-path-boss.webp",
    "09-ink-echo-boss.webp",
    "10-boss-phase-lin.webp",
    "11-boss-phase-xing.webp",
    "12-camp-full-repair.webp",
    "13-spellbook-four-pages.webp",
    "14-reduced-motion.webp",
    "15-theme-c-production-candidate.webp",
    "16-audio-review.webp",
    "17-final-manifest-review.webp",
    "18-child-gate-review.webp",
    "19-mobile-complete-run.webp",
    "20-review-summary.webp",
  ];
  const orderedEntries = requiredNames.map((name) => screenshotEntries.find((entry) => entry.fileName === name));
  if (screenshotEntries.length !== requiredNames.length || new Set(screenshotEntries.map((entry) => entry.fileName)).size !== requiredNames.length || orderedEntries.some((entry) => !entry)) {
    throw new Error("Capture did not produce the required 20 representative WebP files in their exact order.");
  }

  const lines = [
    "# STEP 03 Screenshot Index",
    "",
    `- Generated by: tools/hanzi-v2-step03/capture-step03.ts`,
    `- Local server: ${baseUrl} (dedicated strict port; process stopped by this script)`,
    `- Representative output: ${representativeRoot}`,
    `- Raw report: ${resolve(rawRoot, "capture-report.json")}`,
    `- Playwright traces: ${traceRoot}`,
    "",
    "| File | What it verifies | Viewport | Visual state ID |",
    "| --- | --- | --- | --- |",
    ...orderedEntries.map((entry) => `| [${entry!.fileName}](representative/${entry!.fileName}) | ${entry!.verifies} | ${entry!.viewport} | \`${entry!.visualStateId}\` |`),
    "",
    "Technical screenshot evidence verifies rendered states and visible control paths only. It is not parent or child acceptance evidence.",
    "",
  ];
  await writeFile(resolve(screenshotsRoot, "SCREENSHOT-INDEX.md"), lines.join("\r\n"), "utf8");
}

await access(viteCli);
await mkdir(representativeRoot, { recursive: true });
await mkdir(rawRoot, { recursive: true });
await mkdir(traceRoot, { recursive: true });

const stdout = createWriteStream(resolve(rawRoot, "vite.stdout.log"));
const stderr = createWriteStream(resolve(rawRoot, "vite.stderr.log"));
const server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: repositoryRoot,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(stdout);
server.stderr.pipe(stderr);
await writeFile(resolve(rawRoot, "capture-server.json"), `${JSON.stringify({
  task: "hanzi-v2-step03-capture",
  pid: server.pid,
  port,
  baseUrl,
  repositoryRoot,
  startedAtUtc: new Date().toISOString(),
}, null, 2)}\n`, "utf8");

let browser: Browser | null = null;
let failure: unknown = null;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });

  await withPlayScenario(browser, "desktop-guardian", desktop, async (page) => {
    await clickPrimary(page, "走进墨林", "camp_intro");
    await clickPrimary(page, "看看营地灯", "camp_objective");
    await capturePlay(page, "01-camp-objective-desktop.webp", "Camp objective is a world-first invitation before the first structure board.", desktop, "camp_objective");
    await clickPrimary(page, "沿着灯路出发", "travel_to_battle_1");
    await clickPrimary(page, "跳过小路", "battle_1_intro");
    await clickPrimary(page, "开始合字施法", "battle_1_placing");
    await selectAndPlace(page, "ming-ri", "left");
    await selectAndPlace(page, "ming-yue", "right");
    await waitForVisualState(page, "battle_1_forming");
    await waitForVisualState(page, "battle_1_casting");
    await capturePlay(page, "03-ming-meaning-magic-desktop.webp", "The formed character, pinyin, familiar word, and meaning magic are shown together.", desktop, "battle_1_casting");
    await waitForVisualState(page, "battle_1_cleared");
    await clickPrimary(page, "看看光留下什么", "breather_1");
    await capturePlay(page, "04-breather-world-change.webp", "The first spell leaves a visible world change before the next encounter.", desktop, "breather_1");
    await enterHua(page);
    await finishHuaToAbilityChoice(page);
    await enterBoss(page, "guardian-light");
    await selectAndPlace(page, "lin-mu-left", "right");
    await waitForVisualState(page, "invalid_feedback");
    await capturePlay(page, "07-guardian-light-boss.webp", "Guardian Light exposes the correct boss slot after a wrong placement without moving a card.", desktop, "invalid_feedback");
    await page.locator("[data-safe-retry]").click();
    await waitForVisualState(page, "safe_retry");
    await clickPrimary(page, "从这里再试", "boss_phase_1_placing");
    await capturePlay(page, "10-boss-phase-lin.webp", "The Lin boss phase keeps the two wood instances and left-right slots visible after a calm retry.", desktop, "boss_phase_1_placing");
    await solveBossAfterLin(page);
    await clickPrimary(page, "沿星路回营地", "return_to_camp");
    await waitForVisualState(page, "camp_repair");
    await capturePlay(page, "12-camp-full-repair.webp", "All four completed spells visibly repair the camp without a score or countdown.", desktop, "camp_repair");
    await clickPrimary(page, "翻开四字魔法书", "spellbook_review");
    for (const glyph of ["明", "花", "林", "星"]) await page.getByRole("button", { name: new RegExp(glyph) }).click();
    await capturePlay(page, "13-spellbook-four-pages.webp", "The spellbook exposes all four discovered characters through visible tabs and a local replay surface.", desktop, "spellbook_review");
  });

  await withPlayScenario(browser, "mobile-full-run", mobile, async (page) => {
    await enterMing(page);
    await capturePlay(page, "02-battle-ming-mobile.webp", "The five-card Ming structure board remains readable and touch-ready in portrait phone layout.", mobile, "battle_1_placing");
    await finishMingToBreather(page);
    await enterHua(page);
    await finishHuaToAbilityChoice(page);
    await capturePlay(page, "06-ability-choice-mobile.webp", "All three meaningful ability choices remain visible in portrait phone layout.", mobile, "ability_choice");
    await enterBoss(page, "guardian-light");
    await solveFullRunFromBoss(page);
    await capturePlay(page, "19-mobile-complete-run.webp", "The complete-run replay choice and repaired world remain usable on a phone without pressure mechanics.", mobile, "run_complete");
  });

  await withPlayScenario(browser, "tablet-star-path", tablet, async (page) => {
    await enterMing(page);
    await finishMingToBreather(page);
    await enterHua(page);
    await capturePlay(page, "05-battle-hua-tablet.webp", "The Hua encounter presents a real top-bottom structure with five visible cards on a tablet.", tablet, "battle_2_placing");
    await finishHuaToAbilityChoice(page);
    await enterBoss(page, "star-path");
    await capturePlay(page, "08-star-path-boss.webp", "Star Path visibly highlights an empty real boss slot without choosing or placing a component.", tablet, "boss_phase_1_placing");
    await selectAndPlace(page, "lin-mu-left", "left");
    await waitForInterferenceToClear(page, "boss_phase_1_placing");
    await selectAndPlace(page, "lin-mu-right", "right");
    await waitForVisualState(page, "boss_phase_1_cleared");
    await clickPrimary(page, "解开第二枚墨印", "boss_phase_2_placing");
    await capturePlay(page, "11-boss-phase-xing.webp", "The Xing boss phase reuses the taught top-bottom structure and displays one remaining seal.", tablet, "boss_phase_2_placing");
  });

  await withPlayScenario(browser, "desktop-ink-echo", desktop, async (page) => {
    await enterMing(page);
    await finishMingToBreather(page);
    await enterHua(page);
    await finishHuaToAbilityChoice(page);
    await enterBoss(page, "ink-echo");
    await selectAndPlace(page, "lin-mu-left", "left");
    await waitForVisualState(page, "boss_interference");
    await page.getByRole("button", { name: "重听当前汉字和熟悉词", exact: true }).click();
    await capturePlay(page, "09-ink-echo-boss.webp", "Ink Echo is activated from the visible replay control during interference and does not auto-solve the board.", desktop, "boss_interference");
  });

  await withPlayScenario(browser, "desktop-accessibility", desktop, async (page) => {
    await enterMing(page);
    await page.getByRole("button", { name: "声音与画面", exact: true }).click();
    await waitForVisualState(page, "settings_open");
    await page.getByLabel("静音").check();
    await page.getByLabel("减少动态").check();
    await capturePlay(page, "14-reduced-motion.webp", "Visible settings confirm both reduced motion and mute, while the local structure state remains understandable.", desktop, "settings_open");
  });

  await withReviewScenario(browser, async (page) => {
    await page.locator("[data-review-tab='assets']").click();
    await page.locator(".step03-seed-grid").waitFor();
    await captureReview(page, "15-theme-c-production-candidate.webp", "The parent-review assets tab renders both the procedural asset registry and the fixed review-only ImageGen seed grid; no seed is a child-runtime asset.", "review:assets", ".step03-panel");
    await page.locator("[data-review-tab='audio']").click();
    await page.locator("[data-review-item='audio-and-accessibility']").waitFor();
    await captureReview(page, "16-audio-review.webp", "The parent audio tab presents the actual reported Chinese TTS voice or explicit visual fallback, plus its dedicated audioDecision choices.", "review:audio", ".step03-panel");
    await page.locator("[data-review-tab='manifest']").click();
    await captureReview(page, "17-final-manifest-review.webp", "The fixed final 12-character manifest is available for parent review with structure and meaning-magic mapping.", "review:manifest");
    await page.locator("[data-review-tab='child-gate']").click();
    await captureReview(page, "18-child-gate-review.webp", "The child-use gate states that technical evidence cannot imply child acceptance or start use by itself.", "review:child-gate");
    await page.locator("[data-review-tab='summary']").click();
    await captureReview(page, "20-review-summary.webp", "The local parent summary exposes required decisions, changed-only handling, and the explicit YES/NO/NOT_YET gate.", "review:summary");
  });

  await writeIndex();
} catch (error) {
  failure = error;
} finally {
  if (browser) await browser.close();
  await stopOwnServer(server);
  await Promise.all([stdout, stderr].map((stream) => new Promise<void>((resolveStream) => {
    if (stream.writableFinished) {
      resolveStream();
      return;
    }
    stream.end(resolveStream);
  })));
  await writeFile(resolve(rawRoot, "capture-report.json"), `${JSON.stringify({
    baseUrl,
    port,
    representativeRoot,
    screenshotEntries,
    consoleErrors,
    pageErrors,
    remoteRequests,
    failure: failure instanceof Error ? failure.message : failure ? String(failure) : null,
    finishedAtUtc: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
}

if (failure) throw failure;
if (consoleErrors.length || pageErrors.length || remoteRequests.length) {
  throw new Error(`Capture completed with console errors, page errors, or remote requests. See ${resolve(rawRoot, "capture-report.json")}`);
}

console.log(`Captured ${screenshotEntries.length} STEP 03 representative screenshots in ${representativeRoot}`);
