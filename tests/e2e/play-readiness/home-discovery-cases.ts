import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const KEY = "family-games/my-game-world/v1";
const entrySelector = (id: string) => `[data-world-${id}-link]`;
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), KEY);

export function homeDiscoveryTests(): void {
  test("@play-ready @home-discovery three unified entries preserve history, explicit return and focus", async ({ page }, info) => {
    const activate = async (selector: string) => info.project.use.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    const errors: string[] = [], images: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.resourceType() === "image") images.push(request.url()); });
    await page.goto("/");
    await expect(page.locator(".world-stage .world-entry")).toHaveCount(3);
    await expect(page.locator(".world-stage a a,.world-stage button,canvas")).toHaveCount(0);
    await expect(page.locator(".world-more a")).toHaveCount(1);
    await expect(page.locator(".world-stage")).not.toContainText(/72字|48词|200关|完成率|试点|版本|最新升级/);
    await page.waitForLoadState("networkidle");
    expect(images.filter(url => !url.includes("/assets/home/"))).toEqual([]);

    for (const [id, surface] of [["forest", '[data-testid="hanzi-magic-complete"]'], ["math", '[data-testid="math-world-map"]'], ["english", '[data-testid="english-world-map"]'], ["treasure", '[data-testid="classic-hub-from-world"]']]) {
      const entry = page.locator(entrySelector(id));
      await entry.scrollIntoViewIfNeeded();
      const scroll = await page.evaluate(() => scrollY);
      const box = await entry.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48); expect(box!.height).toBeGreaterThanOrEqual(48);
      const hit = await entry.evaluate(element => {
        const r = element.getBoundingClientRect();
        return [[.2,.2],[.8,.2],[.5,.5],[.2,.8],[.8,.8]].every(([x,y]) => element.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));
      });
      expect(hit).toBe(true);
      await activate(entrySelector(id));
      await expect(page.locator(surface)).toBeVisible();
      await page.reload(); await expect(page.locator(surface)).toBeVisible();
      await page.goBack(); await expect(page.locator(entrySelector(id))).toBeFocused();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
      await page.goForward(); await expect(page.locator(surface)).toBeVisible();
      await activate('a[href="?world=my-game-world"]');
      await expect(page.locator(entrySelector(id))).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test("@play-ready @home-discovery keyboard, settings focus and reduced motion", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-world-settings-open]').focus();
    await page.keyboard.press("Tab"); await expect(page.locator(entrySelector("forest"))).toBeFocused();
    await page.keyboard.press("Tab"); await expect(page.locator(entrySelector("math"))).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page.getByTestId("math-world-map")).toBeVisible();
    await page.goBack(); await expect(page.locator(entrySelector("math"))).toBeFocused();
    await page.locator('[data-world-settings-open]').click();
    await page.locator('[data-world-reduced-motion]').check();
    await expect(page.locator('.my-game-world-mount')).toHaveAttribute("data-reduced-motion", "true");
    await page.keyboard.press("Escape"); await expect(page.locator('[data-world-settings-open]')).toBeFocused();
    expect(JSON.parse((await raw(page))!).settings.reducedMotion).toBe(true);
  });

  test("@play-ready @home-discovery broken or pending cover images cannot block navigation", async ({ page }) => {
    await page.route("**/assets/home/*.webp", route => route.abort());
    await page.goto("/");
    await page.locator(entrySelector("english")).click();
    await expect(page.getByTestId("english-world-map")).toBeVisible();
    await page.unroute("**/assets/home/*.webp");
    const pending: Array<() => Promise<void>> = [];
    await page.route("**/assets/home/*.webp", route => { pending.push(() => route.abort().catch(() => {})); });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator(entrySelector("math")).click();
    await expect(page.getByTestId("math-world-map")).toBeVisible();
    for (const release of pending) await release();
  });

  for (const original of ['{"version":99,"future":[7]}', '{broken', '{"version":1,"settings":{"muted":false,"reducedMotion":false,"extra":"kept"},"extension":{"kept":7}}']) {
    test(`@play-ready @home-discovery protects home settings: ${original.slice(0,24)}`, async ({ page }) => {
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: original });
      await page.goto("/"); await page.locator('[data-world-settings-open]').click();
      await page.locator('[data-world-muted]').click();
      if (original.includes('"version":1,')) {
        expect(JSON.parse((await raw(page))!)).toEqual({ version:1, settings:{muted:true,reducedMotion:false,extra:"kept"},extension:{kept:7} });
      } else {
        expect(await raw(page)).toBe(original);
        await expect(page.locator('[data-world-settings-status]')).toContainText("为保护本机记录");
      }
      await page.keyboard.press("Escape"); await page.locator(entrySelector("forest")).click();
      await expect(page.getByTestId("hanzi-magic-complete")).toBeVisible();
    });
  }

  for (const deny of ["read", "write", "access"] as const) test(`@play-ready @home-discovery storage ${deny} denied stays navigable`, async ({ page }) => {
    await page.addInitScript(({ key, denied }) => {
      if (denied === "access") { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Synthetic denied", "SecurityError"); } }); return; }
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function(k) { if (k === key && denied === "read") throw new DOMException("Synthetic denied", "SecurityError"); return get.call(this,k); };
      Storage.prototype.setItem = function(k,v) { if (k === key && denied === "write") throw new DOMException("Synthetic denied", "QuotaExceededError"); set.call(this,k,v); };
    }, { key: KEY, denied: deny });
    await page.goto("/"); await page.locator('[data-world-settings-open]').click();
    await page.locator('[data-world-muted]').click();
    await expect(page.locator('[data-world-muted]')).not.toBeChecked();
    await expect(page.locator('[data-world-settings-status]')).toContainText("这次没有保存设置");
    await page.keyboard.press("Escape"); await page.locator(entrySelector("treasure")).click();
    await expect(page.locator('.game-card')).toHaveCount(3);
  });

  test("@play-ready @home-discovery cross-page and same-page Vault replacement stop stale writes", async ({ page, context }) => {
    const first = '{"version":1,"settings":{"muted":false,"reducedMotion":false},"extension":"first"}';
    const restored = '{"version":1,"settings":{"muted":false,"reducedMotion":false},"extension":"restored"}';
    await page.goto("/");
    await page.evaluate(({key,value}) => localStorage.setItem(key,value), {key:KEY,value:first});
    await page.reload();
    const other = await context.newPage(); await other.goto("/");
    await other.evaluate(({key,value}) => localStorage.setItem(key,value), {key:KEY,value:restored});
    await page.locator('[data-world-settings-open]').click(); await page.locator('[data-world-muted]').click();
    await expect(page.locator('[data-world-muted]')).not.toBeChecked(); expect(await raw(page)).toBe(restored);
    await other.close();

    await page.reload(); await page.locator('[data-world-settings-open]').click();
    await page.getByRole("button", {name:"打开游戏进度保险箱"}).click();
    const downloading = page.waitForEvent("download"); await page.getByRole("button", {name:"备份游戏进度"}).click();
    const exported = readFileSync((await (await downloading).path())!, "utf8");
    await page.evaluate(({key,value}) => localStorage.setItem(key,value), {key:KEY,value:first});
    // Reload the home mount on the first generation, then restore the exported one.
    await page.reload(); await page.locator('[data-world-settings-open]').click();
    await page.getByRole("button", {name:"打开游戏进度保险箱"}).click();
    await page.locator('[data-vault-file]').setInputFiles({name:"synthetic-home.json",mimeType:"application/json",buffer:Buffer.from(exported)});
    await expect(page.locator('[data-vault-preview-checksum]')).toHaveText("PASS");
    page.once("dialog", dialog => void dialog.accept()); await page.locator('[data-vault-restore]').click();
    await expect(page.locator('[data-vault-status]')).toContainText("已恢复");
    expect(await raw(page)).toBe(restored);
    await page.locator('[data-world-muted]').click(); await expect(page.locator('[data-world-muted]')).not.toBeChecked();
    expect(await raw(page)).toBe(restored);
  });
}
