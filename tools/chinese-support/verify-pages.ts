import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const workspace = resolve(process.cwd());
const base = new URL(process.argv[2] ?? process.env.CHINESE_SUPPORT_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (process.argv[3] ?? process.env.CHINESE_SUPPORT_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" })).trim();
const output = resolve(process.env.CHINESE_SUPPORT_PAGES_OUTPUT ?? "tmp/tasks/GAME-CODEX-CHINESE-CONSOLIDATION-03/pages/PAGES_VERDICT.json");

function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export async function verifyChineseSupportPages() {
  requireValue(base.protocol === "https:" && base.pathname.endsWith("/Game-Codex/"), "Expected the HTTPS Game-Codex Pages root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected a full Git commit SHA");
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  const httpErrors: string[] = [];
  const externalRequests: string[] = [];
  const routes: Record<string, string> = {};
  try {
    for (const viewport of [{ name: "desktop", width: 1366, height: 850 }, { name: "mobile", width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce", locale: "zh-CN" });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${viewport.name}: ${error.message}`));
      page.on("console", (message) => { if (message.type() === "error") errors.push(`${viewport.name}: ${message.text()}`); });
      page.on("response", (response) => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });
      page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== base.origin) externalRequests.push(url.href); });
      const check = async (name: string, query: string, selector: string) => {
        await page.goto(new URL(query, base).href, { waitUntil: "domcontentloaded" });
        await page.locator(selector).waitFor({ state: "visible", timeout: 120_000 });
        requireValue(await page.evaluate(() => document.documentElement.dataset.buildCommit) === expectedCommit, `${name} deployed commit mismatch`);
        const geometry = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        requireValue(geometry <= 1, `${name} has horizontal overflow`);
        routes[`${viewport.name}:${name}`] = "PASS";
      };
      await check("top-world", "?world=my-game-world", '[data-testid="my-game-world"]');
      await check("classic-four", "?hub=classic", ".hub-grid");
      requireValue(await page.locator(".game-card").count() === 3, "Classic does not contain exactly three world-product cards");
      await check("math-world", "?world=math-world", '[data-testid="math-world-map"]');
      await check("hanzi-world", "?play=hanzi-magic-complete&from=hub", '[data-testid="hanzi-magic-complete"]');
      await check("pinyin", "?play=hanzi-magic-complete&view=pinyin&mode=assemble&seed=pages", '[data-testid="sound-rhyme-trial"]');
      await page.locator("[data-answer]").first().click();
      await page.reload({ waitUntil: "domcontentloaded" });
      requireValue(await page.evaluate(() => localStorage.getItem("family-games/chinese-support/pinyin/v1") !== null), "Pinyin save/reload failed");
      await check("memory", "?play=hanzi-magic-complete&view=memory&pack=glyph-pinyin&seed=pages", '[data-testid="memory-match"]');
      await page.locator("[data-card-id]").first().click();
      await page.reload({ waitUntil: "domcontentloaded" });
      requireValue(await page.evaluate(() => localStorage.getItem("family-games/memory-match/v1") !== null), "Memory save/reload failed");
      await check("spellbook", "?play=hanzi-magic-complete&view=spellbook", '[data-testid="complete-spellbook"]');
      await check("wheel", "?play=hanzi-magic-complete&view=wheel", '[data-testid^="complete-workshop"]');
      await check("archive", "?play=hanzi-magic-complete&view=archive", '[data-testid="complete-story-archive"]');
      await check("postgame", "?play=hanzi-magic-complete&postgame=free-adventure", '[data-testid^="complete-postgame"]');
      await check("legacy-v2", "?play=hanzi-v2-chapter-one&from=hub", '[data-testid="hanzi-magic-chapter-one-m3"]');
      await check("legacy-v1", "?play=hanzi-v2-v1&from=hub", '[data-testid="hanzi-magic-v1"]');
      await context.close();
    }
    requireValue(errors.length === 0 && httpErrors.length === 0 && externalRequests.length === 0, "Pages emitted browser, HTTP, or unexpected external request errors");
    const verdict = { schemaVersion: 1, verdict: "PASS_MACHINE", expectedCommit, deployedCommit: expectedCommit, pagesBase: base.href, routes, consoleAndPageErrors: errors, httpErrors, externalRequests, verifiedAtUtc: new Date().toISOString() };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
    return verdict;
  } catch (error) {
    const verdict = { schemaVersion: 1, verdict: "FAIL", expectedCommit, pagesBase: base.href, routes, consoleAndPageErrors: errors, httpErrors, externalRequests, error: error instanceof Error ? error.message : String(error), verifiedAtUtc: new Date().toISOString() };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
    throw error;
  } finally { await browser.close(); }
}

const result = await verifyChineseSupportPages();
process.stdout.write(`${JSON.stringify({ verdict: result.verdict, expectedCommit, output })}\n`);
