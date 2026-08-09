import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173";
const outputRoot = resolve(
  process.argv[3] ?? "artifacts/hanzi-radical-battle-v2/step-02/raw-screenshots",
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
const pageErrors = [];
const remoteRequests = [];

function observe(page) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) remoteRequests.push(request.url());
  });
}

async function freshPage(viewport) {
  const page = await browser.newPage({ viewport });
  observe(page);
  await page.goto(`${baseUrl}/?review=hanzi-v2-step02`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("step02-review-app").waitFor();
  return page;
}

async function waitPhase(page, phase) {
  await page.getByTestId("core-spell-pilot").waitFor();
  await page.waitForFunction(
    (expected) => document.querySelector("[data-testid='core-spell-pilot']")?.getAttribute("data-phase") === expected,
    phase,
    { timeout: 8_000 },
  );
}

async function enterHand(page) {
  await page.getByRole("button", { name: "沿着灯路出发" }).click();
  await page.getByRole("button", { name: "靠近看看" }).click();
  await waitPhase(page, "placing");
}

async function solveMing(page) {
  await page.getByTestId("card-ming-ri").click();
  await page.getByTestId("slot-left").click();
  await page.getByTestId("card-ming-yue").click();
  await page.getByTestId("slot-right").click();
}

async function shot(locator, name) {
  await locator.screenshot({ path: resolve(outputRoot, `${name}.png`), animations: "disabled" });
}

const desktop = await freshPage({ width: 1440, height: 900 });
await shot(desktop.getByTestId("core-spell-pilot"), "01-camp-before-desktop");
await enterHand(desktop);
await solveMing(desktop);
await waitPhase(desktop, "forming_character");
await shot(desktop.getByTestId("core-spell-pilot"), "04-character-forming-desktop");
await waitPhase(desktop, "casting_spell");
await shot(desktop.getByTestId("core-spell-pilot"), "05-spell-impact-desktop");

const mobile = await freshPage({ width: 390, height: 844 });
await enterHand(mobile);
await shot(mobile.getByTestId("core-spell-pilot"), "02-first-hand-mobile");
await solveMing(mobile);
await waitPhase(mobile, "camp_repaired");
await shot(mobile.getByTestId("core-spell-pilot"), "06-camp-repaired-mobile");

const tablet = await freshPage({ width: 768, height: 1024 });
await enterHand(tablet);
await tablet.getByTestId("card-ming-yue").click();
await tablet.getByTestId("slot-left").click();
await waitPhase(tablet, "invalid_feedback");
await shot(tablet.getByTestId("core-spell-pilot"), "03-invalid-feedback-tablet");
await waitPhase(tablet, "placing");
await tablet.getByTestId("card-ming-ri").click();
await tablet.getByTestId("slot-left").click();
await tablet.getByTestId("card-ming-yue").click();
await tablet.getByTestId("slot-right").click();
await waitPhase(tablet, "spellbook");
await shot(tablet.getByTestId("core-spell-pilot"), "07-spellbook-tablet");

await desktop.locator("[data-review-tab='themes']").click();
await shot(desktop.locator(".theme-review-grid"), "08-theme-comparison");
await desktop.locator("[data-review-tab='pilot']").click();
await desktop.getByRole("button", { name: /打开声音、动态和视觉方向设置/ }).click();
await desktop.getByTestId("settings-overlay").getByLabel("减少动态").check();
await shot(desktop.getByTestId("core-spell-pilot"), "09-reduced-motion");
await desktop.locator("[data-review-tab='characters']").click();
await shot(desktop.getByTestId("candidate-card-ming"), "10-review-candidate-card");

const report = {
  baseUrl,
  outputRoot,
  screenshots: [
    "01-camp-before-desktop",
    "02-first-hand-mobile",
    "03-invalid-feedback-tablet",
    "04-character-forming-desktop",
    "05-spell-impact-desktop",
    "06-camp-repaired-mobile",
    "07-spellbook-tablet",
    "08-theme-comparison",
    "09-reduced-motion",
    "10-review-candidate-card",
  ],
  consoleErrors,
  pageErrors,
  remoteRequests,
};
await writeFile(resolve(outputRoot, "capture-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await browser.close();

if (consoleErrors.length || pageErrors.length || remoteRequests.length) {
  throw new Error(`Evidence capture found errors or remote requests. See ${resolve(outputRoot, "capture-report.json")}`);
}

console.log(`Captured 10 STEP 02 evidence screenshots in ${outputRoot}`);
