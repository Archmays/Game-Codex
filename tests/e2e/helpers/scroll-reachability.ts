import { expect, type Locator, type Page } from "@playwright/test";
import type { PlaySurfaceRecord } from "../../../packages/data/playSurfaceManifest";

export interface ScrollMetrics {
  readonly policy: PlaySurfaceRecord["scrollPolicy"];
  readonly owner: string;
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly maxScroll: number;
  readonly overflowY: string;
  readonly documentScrollWidth: number;
  readonly documentClientWidth: number;
  readonly bodyOverflowY: string;
  readonly htmlOverflowY: string;
  readonly pageModeClass: string;
}

export interface ScrollMovement {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface WheelBottomEvidence extends ScrollMetrics {
  readonly reachableMaxScroll: number;
}

function ownerSelector(surface: PlaySurfaceRecord): string {
  return surface.scrollPolicy === "internal" ? surface.scrollContainerSelector! : "html";
}

export async function readScrollMetrics(page: Page, surface: PlaySurfaceRecord): Promise<ScrollMetrics> {
  return page.evaluate(({ policy, selector }) => {
    const owner = policy === "internal"
      ? document.querySelector<HTMLElement>(selector)
      : document.scrollingElement as HTMLElement | null;
    if (!owner) throw new Error(`Missing scroll owner for ${policy}: ${selector}`);
    const ownerStyle = getComputedStyle(owner);
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    return {
      policy,
      owner: policy === "internal" ? selector : owner === document.documentElement ? "html" : owner === document.body ? "body" : owner.tagName.toLowerCase(),
      scrollTop: owner.scrollTop,
      scrollHeight: owner.scrollHeight,
      clientHeight: owner.clientHeight,
      maxScroll: Math.max(0, owner.scrollHeight - owner.clientHeight),
      overflowY: ownerStyle.overflowY,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      bodyOverflowY: bodyStyle.overflowY,
      htmlOverflowY: htmlStyle.overflowY,
      pageModeClass: [...document.body.classList].find((name) => name.endsWith("-page") && ["game-fullscreen-page", "game-scrollable-page", "adult-tool-page", "document-page"].includes(name)) ?? "none",
    };
  }, { policy: surface.scrollPolicy, selector: ownerSelector(surface) });
}

export async function resetScrollToTop(page: Page, surface: PlaySurfaceRecord): Promise<void> {
  await page.evaluate(({ policy, selector }) => {
    const owner = policy === "internal" ? document.querySelector<HTMLElement>(selector) : document.scrollingElement as HTMLElement | null;
    if (!owner) throw new Error(`Missing scroll owner for ${policy}: ${selector}`);
    owner.scrollTop = 0;
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, { policy: surface.scrollPolicy, selector: ownerSelector(surface) });
  await expect.poll(async () => (await readScrollMetrics(page, surface)).scrollTop).toBeLessThanOrEqual(1);
}

async function position(page: Page, surface: PlaySurfaceRecord): Promise<number> {
  return (await readScrollMetrics(page, surface)).scrollTop;
}

async function measureReachableMaxScroll(page: Page, surface: PlaySurfaceRecord): Promise<number> {
  return page.evaluate(({ policy, selector }) => {
    const owner = policy === "internal" ? document.querySelector<HTMLElement>(selector) : document.scrollingElement as HTMLElement | null;
    if (!owner) throw new Error(`Missing scroll owner for ${policy}: ${selector}`);
    const stored = owner.scrollTop;
    owner.scrollTop = Number.MAX_SAFE_INTEGER;
    const reachableMax = owner.scrollTop;
    owner.scrollTop = stored;
    return reachableMax;
  }, { policy: surface.scrollPolicy, selector: ownerSelector(surface) });
}

async function waitForScrollToSettle(page: Page, surface: PlaySurfaceRecord): Promise<void> {
  let previous = await position(page, surface);
  let stableSamples = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(50);
    const current = await position(page, surface);
    stableSamples = Math.abs(current - previous) <= 1 ? stableSamples + 1 : 0;
    if (stableSamples >= 3) return;
    previous = current;
  }
  throw new Error(`${surface.id} scroll motion did not settle`);
}

async function pointInsideOwner(page: Page, surface: PlaySurfaceRecord): Promise<{ x: number; y: number }> {
  if (surface.scrollPolicy !== "internal") return page.evaluate(() => ({ x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) }));
  const box = await page.locator(surface.scrollContainerSelector!).boundingBox();
  if (!box) throw new Error(`Internal scroll owner is not visible: ${surface.scrollContainerSelector}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

export async function wheelMoves(page: Page, surface: PlaySurfaceRecord, deltaY = 720): Promise<ScrollMovement> {
  const before = await position(page, surface);
  const point = await pointInsideOwner(page, surface);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, deltaY);
  await expect.poll(async () => position(page, surface), { message: `${surface.id} wheel must move its declared owner`, timeout: 3_000 }).toBeGreaterThan(before);
  const after = await position(page, surface);
  return { before, after, delta: after - before };
}

export async function keyboardMoves(page: Page, surface: PlaySurfaceRecord, key: "PageDown" | "Space" | "ArrowDown" | "End"): Promise<ScrollMovement> {
  await resetScrollToTop(page, surface);
  if (surface.scrollPolicy === "internal") {
    const owner = page.locator(surface.scrollContainerSelector!);
    await owner.focus();
    await expect(owner).toBeFocused();
  }
  const before = await position(page, surface);
  await page.keyboard.press(key);
  await expect.poll(async () => position(page, surface), { message: `${surface.id} ${key} must move its declared owner`, timeout: 3_000 }).toBeGreaterThan(before);
  await waitForScrollToSettle(page, surface);
  const after = await position(page, surface);
  if (key === "End") {
    const metrics = await readScrollMetrics(page, surface);
    expect(metrics.maxScroll - after, `${surface.id} End must reach the bottom viewport`).toBeLessThanOrEqual(metrics.clientHeight);
  }
  return { before, after, delta: after - before };
}

export async function touchSwipeMoves(page: Page, surface: PlaySurfaceRecord): Promise<ScrollMovement> {
  await resetScrollToTop(page, surface);
  const before = await position(page, surface);
  const point = await pointInsideOwner(page, surface);
  const ownerBox = surface.scrollPolicy === "internal" ? await page.locator(surface.scrollContainerSelector!).boundingBox() : null;
  const travel = Math.max(160, Math.round((ownerBox?.height ?? page.viewportSize()?.height ?? 800) * 0.48));
  const startY = Math.round(Math.min((ownerBox?.y ?? 0) + (ownerBox?.height ?? page.viewportSize()!.height) * 0.78, point.y + travel / 2));
  const endY = Math.round(Math.max((ownerBox?.y ?? 0) + 20, startY - travel));
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: startY }] });
  for (let step = 1; step <= 8; step += 1) {
    const y = Math.round(startY + ((endY - startY) * step) / 8);
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await expect.poll(async () => position(page, surface), { message: `${surface.id} touch swipe must move its declared owner`, timeout: 3_000 }).toBeGreaterThan(before);
  const after = await position(page, surface);
  return { before, after, delta: after - before };
}

export async function wheelToBottom(page: Page, surface: PlaySurfaceRecord): Promise<WheelBottomEvidence> {
  await resetScrollToTop(page, surface);
  const reachableMaxScroll = await measureReachableMaxScroll(page, surface);
  const point = await pointInsideOwner(page, surface);
  await page.mouse.move(point.x, point.y);
  for (let step = 0; step < 48; step += 1) {
    const metrics = await readScrollMetrics(page, surface);
    if (reachableMaxScroll - metrics.scrollTop <= 2) return { ...metrics, reachableMaxScroll };
    await page.mouse.wheel(0, Math.max(720, Math.min(2_400, metrics.clientHeight * 1.6)));
    await expect.poll(async () => (await readScrollMetrics(page, surface)).scrollTop, {
      message: `${surface.id} wheel step ${step + 1} must settle before the next input`,
      timeout: 2_000,
    }).toBeGreaterThan(metrics.scrollTop);
  }
  await expect.poll(async () => {
    const metrics = await readScrollMetrics(page, surface);
    return reachableMaxScroll - metrics.scrollTop;
  }, { message: `${surface.id} must reach bottom with user-style wheel`, timeout: 3_000 }).toBeLessThanOrEqual(2);
  return { ...await readScrollMetrics(page, surface), reachableMaxScroll };
}

export async function wheelToFraction(page: Page, surface: PlaySurfaceRecord, fraction: number): Promise<ScrollMetrics> {
  const target = Math.max(0, Math.min(1, fraction));
  const point = await pointInsideOwner(page, surface);
  await page.mouse.move(point.x, point.y);
  for (let step = 0; step < 48; step += 1) {
    const metrics = await readScrollMetrics(page, surface);
    if (metrics.scrollTop >= metrics.maxScroll * target) return metrics;
    await page.mouse.wheel(0, Math.max(480, Math.min(1_200, metrics.clientHeight)));
    await expect.poll(async () => (await readScrollMetrics(page, surface)).scrollTop, {
      message: `${surface.id} wheel step ${step + 1} must settle on the way to ${Math.round(target * 100)}%`,
      timeout: 2_000,
    }).toBeGreaterThan(metrics.scrollTop);
  }
  throw new Error(`${surface.id} did not reach ${Math.round(target * 100)}% with user-style wheel input`);
}

export async function lastMeaningfulAction(page: Page, surface: PlaySurfaceRecord): Promise<Locator | null> {
  const candidates = page.locator(surface.primaryActionSelector);
  const count = await candidates.count();
  if (!count) return null;
  const index = await candidates.evaluateAll((elements) => {
    const rows = elements.map((element, index) => {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return { index, eligible: !["none", "hidden"].includes(style.display) && style.visibility !== "hidden" && !node.hasAttribute("disabled") && rect.width > 0 && rect.height > 0 && !["fixed", "sticky"].includes(style.position), documentBottom: rect.bottom + scrollY };
    }).filter((row) => row.eligible).sort((left, right) => right.documentBottom - left.documentBottom);
    return rows[0]?.index ?? -1;
  });
  return index >= 0 ? candidates.nth(index) : null;
}

export async function expectFullyVisibleInScrollport(page: Page, surface: PlaySurfaceRecord, locator: Locator): Promise<void> {
  await expect.poll(async () => locator.evaluate((element, input) => {
    const rect = element.getBoundingClientRect();
    if (input.policy !== "internal") return rect.top >= -1 && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
    const owner = document.querySelector<HTMLElement>(input.selector);
    if (!owner) return false;
    const port = owner.getBoundingClientRect();
    return rect.top >= port.top - 1 && rect.left >= port.left - 1 && rect.right <= port.right + 1 && rect.bottom <= port.bottom + 1;
  }, { policy: surface.scrollPolicy, selector: surface.scrollContainerSelector ?? "" }), { message: `${surface.id} bottom control must be fully visible in its scrollport`, timeout: 3_000 }).toBe(true);
}

export async function expectMeaningfullyVisibleInScrollport(page: Page, surface: PlaySurfaceRecord, locator: Locator): Promise<void> {
  await expect.poll(async () => locator.evaluate((element, input) => {
    const rect = element.getBoundingClientRect();
    const port = input.policy === "internal"
      ? document.querySelector<HTMLElement>(input.selector)?.getBoundingClientRect()
      : { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
    if (!port) return false;
    const visibleWidth = Math.max(0, Math.min(rect.right, port.right) - Math.max(rect.left, port.left));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, port.bottom) - Math.max(rect.top, port.top));
    return visibleWidth >= Math.min(44, rect.width) && visibleHeight >= Math.min(44, rect.height);
  }, { policy: surface.scrollPolicy, selector: surface.scrollContainerSelector ?? "" }), { message: `${surface.id} bottom content must be meaningfully visible in its scrollport`, timeout: 3_000 }).toBe(true);
}

export async function horizontalScrollIsAbsent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scrolling = document.scrollingElement as HTMLElement;
    const fitsViewport = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
    const clippedInteractive = [...document.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])")].some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      return visible && (rect.left < -1 || rect.right > innerWidth + 1);
    });
    const before = scrolling.scrollLeft;
    scrolling.scrollLeft = 10_000;
    const moved = scrolling.scrollLeft !== before;
    scrolling.scrollLeft = before;
    return fitsViewport && !moved && !clippedInteractive;
  });
}
