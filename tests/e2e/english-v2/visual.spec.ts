import { expect, test, type Page } from "@playwright/test";
import { ENGLISH_V2_WORDS } from "../../../games/english-spell-battle/v2/content/manifest";

async function settle(page: Page): Promise<void> {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => document.fonts.ready);
}

async function expectAccessibleSurface(page: Page): Promise<void> {
  const audit = await page.evaluate(() => {
    const visible = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const unnamedControls = Array.from(document.querySelectorAll("button,a[href],input,select,textarea"))
      .filter(visible)
      .filter((element) => !(element.getAttribute("aria-label") ?? element.textContent ?? "").trim())
      .map((element) => element.outerHTML.slice(0, 160));
    const unlabelledImages = Array.from(document.querySelectorAll("img")).filter((image) => !image.hasAttribute("alt")).map((image) => image.src);
    return {
      unnamedControls,
      unlabelledImages,
      mains: document.querySelectorAll("main").length,
      headings: document.querySelectorAll("h1").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(audit).toEqual({ unnamedControls: [], unlabelledImages: [], mains: 1, headings: 1, overflow: 0 });
}

async function openBuild(page: Page, wordId: string): Promise<void> {
  const word = ENGLISH_V2_WORDS.find((candidate) => candidate.id === wordId)!;
  await page.goto(`/?world=english-world&region=${word.themeId}&word=${word.id}&seed=visual-v2`);
  await page.getByRole("button", { name: "看看它怎么拼" }).click();
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "build");
  await settle(page);
}

test("@visual English map has a stable responsive baseline and accessible geometry", async ({ page }) => {
  await page.goto("/?world=english-world");
  await settle(page);
  await expectAccessibleSurface(page);
  await expect(page).toHaveScreenshot("english-world-map.png", { fullPage: false });
});

test("@visual representative Wordlight surfaces remain visually stable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");

  await page.goto("/?world=my-game-world");
  await expect(page.getByTestId("world-english-portal")).toBeVisible();
  await settle(page);
  await expectAccessibleSurface(page);
  await expect(page.getByTestId("world-english-portal")).toHaveScreenshot("top-world-english-portal.png");

  for (const [wordId, file] of [
    ["word-cat", "regular-build.png"],
    ["word-fish", "digraph-build.png"],
    ["word-one", "irregular-build.png"],
  ] as const) {
    await openBuild(page, wordId);
    await expectAccessibleSurface(page);
    await expect(page.getByTestId("english-mission")).toHaveScreenshot(file);
  }

  const cake = ENGLISH_V2_WORDS.find((word) => word.id === "word-cake")!;
  await openBuild(page, cake.id);
  for (const unit of cake.graphemeUnits) await page.locator(`[data-tile-id$=":${unit.id}"]`).click();
  await page.getByRole("button", { name: "放好这个词" }).click();
  await page.getByRole("button", { name: "cake", exact: true }).click();
  await page.getByRole("button", { name: "句子中的空位" }).click();
  await settle(page);
  await expect(page.getByTestId("english-mission")).toHaveScreenshot("sentence-world-response.png");

  await page.goto("/?world=english-world&view=journal");
  await settle(page);
  await expectAccessibleSurface(page);
  await expect(page).toHaveScreenshot("word-journal.png", { fullPage: false });

  await page.goto("/?world=english-world&view=memory&seed=visual-v2");
  await settle(page);
  await expectAccessibleSurface(page);
  await expect(page.getByTestId("memory-match")).toHaveScreenshot("english-memory.png");
});
