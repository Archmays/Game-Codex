import { createWriteStream } from "node:fs";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createBuildIdentity } from "./step04-contract";

type CaptureEntry = Readonly<{
  fileName: string;
  verifies: string;
  route: string;
}>;

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const requestedPort = process.env.STEP04_CAPTURE_PORT ?? "5177";
const port = Number(requestedPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`STEP04_CAPTURE_PORT must be an integer from 1 to 65535; received '${requestedPort}'.`);
}

const baseUrl = `http://127.0.0.1:${port}`;
const outputRoot = resolve(repositoryRoot, "artifacts/hanzi-radical-battle-v2/step-04/screenshots");
const representativeRoot = resolve(outputRoot, "representative");
const diagnosticsRoot = resolve(repositoryRoot, "tmp/hanzi-v2-step04/readiness-capture");
const viteCli = resolve(repositoryRoot, "node_modules/vite/bin/vite.js");
const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
const generatedAtUtc = "2026-08-09T02:00:00.000Z";
const checkedAtUtc = "2026-08-09T02:01:00.000Z";
const startedAtUtc = "2026-08-09T02:02:00.000Z";
const buildIdentity = createBuildIdentity(commitSha, generatedAtUtc);
const buildIdentitySha256 = buildIdentity.buildIdentitySha256;
if (typeof buildIdentitySha256 !== "string") throw new Error("STEP 04 build identity did not include its SHA-256.");

const captures: CaptureEntry[] = [];
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const remoteRequests: string[] = [];
const requiredNames = [
  "01-parent-audio-preflight.webp",
  "02-pinyin-visible-phrase-spoken.webp",
  "03-observer-ready.webp",
  "04-child-clean-route.webp",
  "05-live-phase-sync.webp",
  "06-stop-control.webp",
  "07-optional-again-again.webp",
  "08-compact-observer.webp",
  "09-completed-observer-summary.webp",
  "10-privacy-validation.webp",
] as const;

function makeLaunch(marker: string, fixture = true) {
  const sessionId = `s04-${marker.repeat(32)}`;
  const runSeed = `${marker}123456789abcde0`.slice(0, 16);
  const launchNonce = (marker === "a" ? "b" : "a").repeat(32);
  const query = new URLSearchParams({
    observe: "hanzi-v2-step04",
    session: sessionId,
    seed: runSeed,
    build: buildIdentitySha256,
    launch: launchNonce,
    commit: commitSha,
    generated: generatedAtUtc,
    checked: checkedAtUtc,
    started: startedAtUtc,
  });
  if (fixture) query.set("fixture", "1");
  return {
    sessionId,
    runSeed,
    launchNonce,
    observerUrl: `${baseUrl}/?${query}`,
    childUrl: `${baseUrl}/?${new URLSearchParams({
      play: "hanzi-v2-golden-slice",
      mode: "child-first-use",
      session: sessionId,
      seed: runSeed,
    })}`,
  };
}

async function waitForServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`STEP 04 capture server exited early with ${server.exitCode}.`);
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Dedicated strict-port server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`STEP 04 capture server did not respond at ${baseUrl}.`);
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
    if (message.type() === "error") consoleErrors.push(`${page.url()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) {
      remoteRequests.push(request.url());
    }
  });
}

async function installBrowserFixtures(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: `(() => {
    function FixtureUtterance(text) {
      this.text = text;
      this.lang = "";
      this.voice = null;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.onend = null;
      this.onerror = null;
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FixtureUtterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {},
      getVoices() { return []; },
      addEventListener() {},
      removeEventListener() {},
      speak(utterance) { setTimeout(() => { if (utterance.onend) utterance.onend(); }, 0); },
    } });
  })();` });
}

async function addFixtureBadge(locator: Locator): Promise<void> {
  await locator.evaluate((host) => {
    if (host.querySelector("[data-step04-capture-badge]")) return;
    const badge = document.createElement("strong");
    badge.dataset.step04CaptureBadge = "true";
    badge.textContent = "AUTOMATED TECHNICAL FIXTURE · NO CHILD DATA";
    badge.setAttribute("style", "position:sticky;top:8px;z-index:9999;display:block;width:max-content;max-width:calc(100% - 24px);margin:8px auto;padding:8px 12px;border:2px solid #7c2d12;border-radius:999px;background:#fff7ed;color:#7c2d12;font:700 12px/1.2 system-ui;letter-spacing:.04em;text-align:center");
    host.prepend(badge);
  });
}

async function saveWebp(page: Page, locator: Locator, fileName: string, verifies: string): Promise<void> {
  await addFixtureBadge(locator);
  const png = await locator.screenshot({ animations: "disabled" });
  const dataUrl = await page.evaluate(async (pngBase64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${pngBase64}`;
    await new Promise<void>((resolveImage, rejectImage) => {
      image.addEventListener("load", () => resolveImage(), { once: true });
      image.addEventListener("error", () => rejectImage(new Error("Screenshot decode failed.")), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.92);
  }, png.toString("base64"));
  const prefix = "data:image/webp;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error(`Chromium did not encode ${fileName} as WebP.`);
  const webp = Buffer.from(dataUrl.slice(prefix.length), "base64");
  if (webp.subarray(0, 4).toString("ascii") !== "RIFF" || webp.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`WebP signature validation failed for ${fileName}.`);
  }
  await writeFile(resolve(representativeRoot, fileName), webp);
  captures.push({ fileName, verifies, route: new URL(page.url()).pathname + new URL(page.url()).search });
}

async function startFixtureObserver(page: Page, context: BrowserContext, launch: ReturnType<typeof makeLaunch>): Promise<void> {
  await page.goto(launch.observerUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("step04-observer-preparation").waitFor();
  for (const id of ["ming", "hua", "lin", "xing"]) await page.locator(`[data-preflight-speak='${id}']`).click();
  await page.locator("[data-audio-decision='START_MUTED']").click();
  await page.locator("[data-session-mode='LIVE_DASHBOARD']").click();
  await page.locator("[data-ready-confirm]").check();
  const popupPromise = context.waitForEvent("page");
  await page.locator("[data-start-session]").click();
  const popup = await popupPromise;
  await popup.getByTestId("child-first-use-fixture-banner").waitFor();
  await popup.close();
  await page.getByTestId("step04-observer-dashboard").waitFor();
}

async function sendEvents(page: Page, sessionId: string, events: ReadonlyArray<Record<string, unknown>>): Promise<void> {
  await page.evaluate(({ id, values }) => {
    const channel = new BroadcastChannel(`hanzi-v2-step04:${id}`);
    for (const event of values) channel.postMessage({ kind: "event", event });
    channel.close();
  }, { id: sessionId, values: events });
}

function event(sessionId: string, sequence: number, relativeMs: number, eventType: string, safeMetadata: Record<string, string | number | boolean>) {
  return { schemaVersion: 1, sessionId, sequence, relativeMs, eventType, safeMetadata };
}

async function authorizeTechnicalChild(page: Page, launch: ReturnType<typeof makeLaunch>): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, grant }) => localStorage.setItem(key, JSON.stringify(grant)), {
    key: `family-games/hanzi-v2-step04/session:${launch.sessionId}`,
    grant: {
      schemaVersion: 1,
      initiativeId: "hanzi-radical-battle-v2",
      step: "04",
      sessionId: launch.sessionId,
      runSeed: launch.runSeed,
      buildIdentitySha256,
      parentFeedbackSha256: "3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C",
      launchNonce: launch.launchNonce,
      sessionMode: "LIVE_DASHBOARD",
      fixture: false,
      audioChoice: "SOUND_OK",
      readyConfirmed: true,
      status: "AUTHORIZED",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      stopCode: null,
    },
  });
  await page.goto(launch.childUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("hanzi-v2-golden-slice").waitFor();
}

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await page.waitForFunction((expected) => document.querySelector("[data-testid='hanzi-v2-golden-slice']")?.getAttribute("data-visual-state-id") === expected, phase);
}

async function clickPrimary(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

await access(viteCli);
await mkdir(representativeRoot, { recursive: true });
await mkdir(diagnosticsRoot, { recursive: true });
const stdout = createWriteStream(resolve(diagnosticsRoot, "vite.stdout.log"));
const stderr = createWriteStream(resolve(diagnosticsRoot, "vite.stderr.log"));
const server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: repositoryRoot,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(stdout);
server.stderr.pipe(stderr);

let browser: Browser | null = null;
let failure: unknown = null;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });

  const observerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await installBrowserFixtures(observerContext);
  const observer = await observerContext.newPage();
  observe(observer);

  const stoppedLaunch = makeLaunch("a");
  await observer.goto(stoppedLaunch.observerUrl, { waitUntil: "domcontentloaded" });
  await observer.getByTestId("step04-observer-preparation").waitFor();
  await observer.locator("[data-preflight-speak='ming']").click();
  await saveWebp(observer, observer.getByTestId("step04-audio-preflight"), requiredNames[0], "Parent-only preflight shows visual pinyin, exact spoken phrases, local adapter category, and three explicit decisions.");
  for (const id of ["hua", "lin", "xing"]) await observer.locator(`[data-preflight-speak='${id}']`).click();
  await observer.locator("[data-audio-decision='START_MUTED']").click();
  await observer.locator("[data-session-mode='LIVE_DASHBOARD']").click();
  await observer.locator("[data-ready-confirm]").check();
  await saveWebp(observer, observer.getByTestId("step04-observer-preparation"), requiredNames[2], "READY, session mode, accepted build identity, and parent stop/privacy preparation are visible before launch.");
  const popupPromise = observerContext.waitForEvent("page");
  await observer.locator("[data-start-session]").click();
  const fixtureChild = await popupPromise;
  observe(fixtureChild);
  await fixtureChild.getByTestId("child-first-use-fixture-banner").waitFor();
  await observer.getByTestId("step04-observer-dashboard").waitFor();
  await clickPrimary(fixtureChild, "走进墨林");
  await observer.getByTestId("step04-live-region").getByText("camp_intro", { exact: true }).waitFor();
  await saveWebp(observer, observer.getByTestId("step04-live-region"), requiredNames[4], "A same-origin minimal technical event updates only phase, relative time, signal, built-in hint, and mute status.");
  await saveWebp(observer, observer.getByTestId("step04-stop-control"), requiredNames[5], "The always-visible immediate stop control exposes only approved stop codes and neutral local handling.");
  await observer.locator("[data-stop-code]").selectOption("TECHNICAL");
  await observer.locator("[data-stop-now]").click();
  await fixtureChild.getByTestId("child-first-use-stopped").waitFor();
  await observer.getByTestId("step04-optional-cards").waitFor();
  await saveWebp(observer, observer.getByTestId("step04-optional-cards"), requiredNames[6], "Again-Again and favorite-moment cards are optional, score-free, accepted-art-only choices after stop.");
  await saveWebp(observer, observer.locator(".step04-export-section"), requiredNames[9], "The local export surface explicitly confirms that voice name, user agent, coordinates, media, score, and storage dump are excluded.");
  await fixtureChild.close();

  const completed = await observerContext.newPage();
  observe(completed);
  const completedLaunch = makeLaunch("b");
  await startFixtureObserver(completed, observerContext, completedLaunch);
  await sendEvents(completed, completedLaunch.sessionId, [
    event(completedLaunch.sessionId, 1, 0, "session_opened", { muted: true, replayIndex: 0 }),
    event(completedLaunch.sessionId, 2, 40, "child_route_ready", { muted: true }),
    event(completedLaunch.sessionId, 3, 300, "phase_entered", { phase: "camp_intro" }),
    event(completedLaunch.sessionId, 4, 210_000, "run_completed", { replayIndex: 0 }),
  ]);
  await completed.locator(".step04-live-status").getByText("COMPLETED", { exact: true }).waitFor();
  await saveWebp(completed, completed.getByTestId("step04-observer-dashboard"), requiredNames[8], "A synthetic completed dashboard separates technical facts, observations, optional choices, wellbeing, and non-conclusions.");
  await completed.close();
  await observer.close();
  await observerContext.close();

  const childContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await installBrowserFixtures(childContext);
  const child = await childContext.newPage();
  observe(child);
  const childLaunch = makeLaunch("c", false);
  await authorizeTechnicalChild(child, childLaunch);
  await saveWebp(child, child.getByTestId("hanzi-v2-golden-slice"), requiredNames[3], "The authorized child route contains the accepted game and child settings, with no review identity, debug, observer, or test chrome.");
  for (const name of ["走进墨林", "看看营地灯", "沿着灯路出发", "跳过小路", "开始合字施法"]) await clickPrimary(child, name);
  await waitForPhase(child, "battle_1_placing");
  await child.getByTestId("component-card-ming-ri").click();
  await child.getByTestId("slot-left").click();
  await child.getByTestId("component-card-ming-yue").click();
  await child.getByTestId("slot-right").click();
  await waitForPhase(child, "battle_1_casting");
  await saveWebp(child, child.getByTestId("hanzi-v2-golden-slice"), requiredNames[1], "The formed character keeps visible pinyin while the accepted exact character-plus-familiar-word phrase is the separate speech source.");
  await child.close();
  await childContext.close();

  const compactContext = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
  const compact = await compactContext.newPage();
  observe(compact);
  await compact.goto(`${baseUrl}/docs/hanzi-radical-battle-v2/step-04/05-COMPACT-OBSERVER-SHEET.html`, { waitUntil: "domcontentloaded" });
  await compact.getByRole("heading", { name: "STEP 04 紧凑观察表", exact: true }).waitFor();
  await saveWebp(compact, compact.locator("body"), requiredNames[7], "The printable phone-friendly fallback retains observation enums, intervention boundaries, stop code, privacy, and optional questions.");
  await compact.close();
  await compactContext.close();

  if (captures.length !== requiredNames.length || requiredNames.some((name) => !captures.some((entry) => entry.fileName === name))) {
    throw new Error("STEP 04 capture did not produce the exact required ten representative screenshots.");
  }
  const ordered = requiredNames.map((name) => captures.find((entry) => entry.fileName === name)!);
  const index = [
    "# STEP 04 Representative Screenshot Index",
    "",
    "All ten images are automated technical fixtures. No child participated and no child result is represented.",
    "",
    "| File | Technical evidence only |",
    "| --- | --- |",
    ...ordered.map((entry) => `| ${entry.fileName} | ${entry.verifies} |`),
    "",
    `Build identity SHA-256: \`${buildIdentitySha256}\``,
    `Commit: \`${commitSha}\``,
    "",
  ].join("\r\n");
  await writeFile(resolve(outputRoot, "SCREENSHOT-INDEX.md"), index, "utf8");
} catch (error) {
  failure = error;
} finally {
  if (browser) await browser.close();
  await stopOwnServer(server);
  for (const stream of [stdout, stderr]) {
    if (!stream.writableFinished) await new Promise<void>((resolveStream) => stream.end(resolveStream));
  }
  await writeFile(resolve(diagnosticsRoot, "capture-report.json"), `${JSON.stringify({
    commitSha,
    buildIdentitySha256,
    captures,
    consoleErrors,
    pageErrors,
    remoteRequests,
    failure: failure instanceof Error ? failure.message : failure ? String(failure) : null,
  }, null, 2)}\n`, "utf8");
}

if (failure) throw failure;
if (consoleErrors.length || pageErrors.length || remoteRequests.length) {
  throw new Error(`STEP 04 capture recorded browser errors or remote requests. See ${resolve(diagnosticsRoot, "capture-report.json")}.`);
}
console.log(`Captured ${captures.length} STEP 04 automated WebP evidence images in ${representativeRoot}`);
