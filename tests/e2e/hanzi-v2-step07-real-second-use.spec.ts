import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { validateStep07Observation } from "../../apps/hanzi-v2-step07-observer/observation-schema";

const BUILD_COMMIT = "b".repeat(40);
const FIXTURE_URL = `/?observe=hanzi-v2-step07&fixture=SYNTHETIC_TOOLING_TEST_ONLY&build=${BUILD_COMMIT}`;

test.describe("Hanzi Radical Battle V2 STEP 07 second-use tooling", () => {
  test("fails closed without completed progress and never guesses STEP 06 from a session", async ({ page }) => {
    await page.goto(`/?observe=hanzi-v2-step07&build=${BUILD_COMMIT}`);
    await expect(page.getByTestId("step07-continuity")).toHaveAttribute("data-continuity", "blocked");
    await page.locator("[data-interval]").selectOption("ONE_TO_THREE_DAYS");
    await page.locator("[data-sound]").selectOption("START_MUTED");
    await page.locator("[data-privacy-ready]").check();
    await page.locator("[data-ready]").click();
    await expect(page.locator("[data-ready-status]")).toContainText("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");

    await page.goto("/?world=my-game-world&session=s07-abcdefgh");
    await expect(page.getByTestId("observation-route-denied")).toBeVisible();
    await expect(page.getByTestId("step06-route-denied")).toHaveCount(0);
    await expect(page.getByTestId("step07-route-denied")).toHaveCount(0);
  });

  test("runs an isolated synthetic fixture, exports the five-field schema, and preserves non-claims", async ({ page, context }, testInfo) => {
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    context.on("request", (request) => {
      if (!/^https?:/i.test(request.url())) return;
      if (new URL(request.url()).origin !== "http://127.0.0.1:5175") externalRequests.push(request.url());
    });

    await page.goto(FIXTURE_URL);
    await expect(page.getByTestId("step07-observer")).toHaveAttribute("data-evidence-kind", "SYNTHETIC_TOOLING_TEST_ONLY");
    await expect(page.getByTestId("step07-observer")).toContainText("NO CHILD DATA");
    await expect(page.getByTestId("step07-continuity")).toHaveAttribute("data-continuity", "pass");
    await expect(page.locator("[data-human]")).toHaveCount(5);
    await expect(page.locator("[data-note]")).toHaveValue("");

    await page.locator("[data-interval]").selectOption("ONE_TO_THREE_DAYS");
    await page.locator("[data-sound]").selectOption("START_MUTED");
    await page.locator("[data-privacy-ready]").check();
    const popupPromise = page.waitForEvent("popup");
    await page.locator("[data-ready]").click();
    const child = await popupPromise;
    await child.waitForLoadState("domcontentloaded");
    await expect(child.getByTestId("my-game-world")).toBeVisible();
    const childUrl = new URL(child.url());
    expect(childUrl.searchParams.get("evidence")).toBe("hanzi-v2-step07");
    expect(childUrl.searchParams.get("session")).toMatch(/^s07-/);
    await expect(child.getByTestId("step06-route-denied")).toHaveCount(0);

    await child.locator("[data-world-spellbook-open]").click();
    await expect(child.getByTestId("world-spellbook")).toBeVisible();
    await child.locator("[data-world-modal-close]").click();
    await child.locator("[data-world-forest-link]").click();
    await expect(child.getByTestId("hanzi-v2-golden-slice")).toBeVisible();
    await expect.poll(async () => page.locator('[data-derived="forest"]').textContent()).toBe("true");

    await page.locator('[data-human="recognizedWorld"]').selectOption("YES");
    await page.locator('[data-human="noticedPersistentRepairs"]').selectOption("YES");
    await page.locator('[data-human="adultAnswerRequired"]').selectOption("NO");
    await page.locator('[data-human="comfortable"]').selectOption("YES");
    await page.locator('[data-human="engagementTone"]').selectOption("CONTINUE");
    await page.locator("[data-note]").selectOption({ label: "合成工具检查；没有真实儿童数据。" });
    await page.locator("[data-stop-reason]").selectOption("NATURAL_END");
    await page.locator("[data-stop]").click();
    await expect(page.locator("[data-stop-status]")).toContainText("已结束");
    await expect(child.getByTestId("step07-child-stopped")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-export]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("STEP-07_SYNTHETIC_TOOLING_TEST_OBSERVATION.json");
    const path = await download.path();
    expect(path).not.toBeNull();
    const document = JSON.parse(await readFile(path!, "utf8"));
    expect(validateStep07Observation(document)).toBe(true);
    expect(document.evidenceKind).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(Object.keys(document.humanObservations).sort()).toEqual([
      "adultAnswerRequired",
      "comfortable",
      "engagementTone",
      "noticedPersistentRepairs",
      "recognizedWorld",
    ]);
    expect(document.buildIdentity.commitSha).toBe(BUILD_COMMIT);
    expect(document.buildIdentity.machineVerdictSha256).toBeNull();
    expect(JSON.stringify(document)).not.toMatch(/name|school|email|phone|address/i);
    await expect(page.getByTestId("step07-export-complete")).toContainText("SYNTHETIC_TOOLING_TEST_ONLY");
    mkdirSync("artifacts/game-machine-review/step-07/screenshots", { recursive: true });
    await page.screenshot({
      path: `artifacts/game-machine-review/step-07/screenshots/step07-observer-${testInfo.project.name}.png`,
      fullPage: true,
    });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    await child.close();
  });
});
