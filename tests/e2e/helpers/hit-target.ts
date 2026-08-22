import { expect, type Locator, type Page } from "@playwright/test";

export type ActivationInput = "pointer" | "touch" | "keyboard";

export interface HitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

export interface HitElement {
  readonly tag: string;
  readonly className: string;
  readonly id: string;
  readonly pointerEvents: string;
  readonly position: string;
  readonly zIndex: string;
  readonly rect: HitRect;
  readonly nearestPositionedAncestor: string | null;
}

export interface HitSample {
  readonly x: number;
  readonly y: number;
  readonly pass: boolean;
  readonly topmost: HitElement | null;
  readonly stack: readonly string[];
}

export interface HitTargetEvidence {
  readonly selector: string;
  readonly label: string;
  readonly rect: HitRect;
  readonly inViewport: boolean;
  readonly computedStyle: {
    readonly display: string;
    readonly visibility: string;
    readonly opacity: string;
    readonly pointerEvents: string;
    readonly position: string;
    readonly zIndex: string;
  };
  readonly overflowAncestors: readonly string[];
  readonly samples: readonly HitSample[];
  readonly hitSuccessRatio: number;
}

function diagnostic(evidence: HitTargetEvidence): string {
  const failed = evidence.samples.filter((sample) => !sample.pass);
  return JSON.stringify({
    controlSelector: evidence.selector,
    controlLabel: evidence.label,
    controlRect: evidence.rect,
    hitSuccessRatio: evidence.hitSuccessRatio,
    computedStyle: evidence.computedStyle,
    overflowAncestors: evidence.overflowAncestors,
    failedSamples: failed,
  }, null, 2);
}

export async function sampleHitTarget(locator: Locator): Promise<HitTargetEvidence> {
  return locator.evaluate((control) => {
    const element = control as HTMLElement;
    const rect = element.getBoundingClientRect();
    const visibleLeft = Math.max(0, rect.left);
    const visibleTop = Math.max(0, rect.top);
    const visibleRight = Math.min(window.innerWidth, rect.right);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const insetX = Math.min(Math.max(3, visibleWidth * 0.14), visibleWidth / 3);
    const insetY = Math.min(Math.max(3, visibleHeight * 0.18), visibleHeight / 3);
    const xs = [visibleLeft + insetX, visibleLeft + visibleWidth / 2, visibleRight - insetX];
    const ys = [visibleTop + insetY, visibleTop + visibleHeight / 2, visibleBottom - insetY];
    const samples = xs.flatMap((x) => ys.map((y) => {
      const stack = document.elementsFromPoint(x, y).filter((candidate) => {
        const style = getComputedStyle(candidate);
        return style.pointerEvents !== "none" && style.visibility !== "hidden" && style.display !== "none";
      });
      const topmost = stack[0] as HTMLElement | undefined;
      const topStyle = topmost ? getComputedStyle(topmost) : null;
      const topRect = topmost?.getBoundingClientRect();
      let nearestPositionedAncestor: string | null = null;
      let positionedCandidate: Element | null = topmost ?? null;
      while (positionedCandidate) {
        if (getComputedStyle(positionedCandidate).position !== "static") {
          const positionedNode = positionedCandidate as HTMLElement;
          const positionedClasses = typeof positionedNode.className === "string" && positionedNode.className.trim() ? `.${positionedNode.className.trim().replace(/\s+/g, ".")}` : "";
          nearestPositionedAncestor = `${positionedNode.tagName.toLowerCase()}${positionedNode.id ? `#${positionedNode.id}` : ""}${positionedClasses}`;
          break;
        }
        positionedCandidate = positionedCandidate.parentElement;
      }
      return {
        x,
        y,
        pass: Boolean(topmost && (topmost === element || element.contains(topmost))),
        topmost: topmost && topStyle ? {
          tag: topmost.tagName,
          className: typeof topmost.className === "string" ? topmost.className : "",
          id: topmost.id,
          pointerEvents: topStyle.pointerEvents,
          position: topStyle.position,
          zIndex: topStyle.zIndex,
          rect: { x: topRect!.x, y: topRect!.y, width: topRect!.width, height: topRect!.height, right: topRect!.right, bottom: topRect!.bottom },
          nearestPositionedAncestor,
        } : null,
        stack: stack.slice(0, 8).map((candidate) => {
          const node = candidate as HTMLElement;
          const classes = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().replace(/\s+/g, ".")}` : "";
          return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${classes}`;
        }),
      };
    }));
    const style = getComputedStyle(element);
    const overflowAncestors: string[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const ancestorStyle = getComputedStyle(ancestor);
      if (![ancestorStyle.overflow, ancestorStyle.overflowX, ancestorStyle.overflowY].every((value) => value === "visible")) {
        const ancestorClasses = typeof ancestor.className === "string" && ancestor.className.trim() ? `.${ancestor.className.trim().replace(/\s+/g, ".")}` : "";
        overflowAncestors.push(`${ancestor.tagName.toLowerCase()}${ancestor.id ? `#${ancestor.id}` : ""}${ancestorClasses} overflow=${ancestorStyle.overflow}/${ancestorStyle.overflowX}/${ancestorStyle.overflowY}`);
      }
      ancestor = ancestor.parentElement;
    }
    const elementClasses = typeof element.className === "string" && element.className.trim() ? `.${element.className.trim().replace(/\s+/g, ".")}` : "";
    return {
      selector: element.matches("[data-word-id]") ? `[data-word-id="${element.dataset.wordId}"]` : `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${elementClasses}`,
      label: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 160),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      inViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
      computedStyle: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        zIndex: style.zIndex,
      },
      overflowAncestors,
      samples,
      hitSuccessRatio: samples.filter((sample) => sample.pass).length / samples.length,
    };
  });
}

export async function expectHitTarget(locator: Locator, options: { minimumRatio?: number; minimumSize?: number } = {}): Promise<HitTargetEvidence> {
  const minimumRatio = options.minimumRatio ?? 1;
  const minimumSize = options.minimumSize ?? 24;
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" }));
  await expect.poll(async () => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1;
  }), { message: "critical control must settle fully inside the viewport", timeout: 3_000 }).toBe(true);
  const evidence = await sampleHitTarget(locator);
  expect(evidence.rect.width, diagnostic(evidence)).toBeGreaterThanOrEqual(minimumSize);
  expect(evidence.rect.height, diagnostic(evidence)).toBeGreaterThanOrEqual(minimumSize);
  expect(evidence.computedStyle.visibility, diagnostic(evidence)).not.toBe("hidden");
  expect(evidence.computedStyle.pointerEvents, diagnostic(evidence)).not.toBe("none");
  expect(evidence.hitSuccessRatio, diagnostic(evidence)).toBeGreaterThanOrEqual(minimumRatio);
  return evidence;
}

async function stateSignature(page: Page, locator: Locator): Promise<string> {
  const url = page.url();
  const app = await page.locator("#app").evaluate((element) => `${element.childElementCount}:${element.innerHTML.length}:${element.textContent?.length ?? 0}`);
  const control = await locator.count() ? await locator.evaluate((element) => {
    const node = element as HTMLElement;
    return `${node.outerHTML}:${node.getAttribute("aria-pressed")}:${node.getAttribute("aria-expanded")}:${node.getAttribute("data-open")}:${node.getAttribute("data-phase")}`;
  }).catch(() => "detached") : "detached";
  return `${url}\n${app}\n${control}`;
}

export async function activateAndExpectStateChange(page: Page, locator: Locator, input: ActivationInput): Promise<void> {
  const before = await stateSignature(page, locator);
  if (input === "keyboard") {
    await locator.focus();
    await expect(locator).toBeFocused();
    await page.keyboard.press("Enter");
  } else if (input === "touch") {
    await locator.tap();
  } else {
    await locator.click();
  }
  await expect.poll(async () => (await stateSignature(page, locator)) !== before, { message: `real ${input} activation must change public route or DOM state`, timeout: 5_000 }).toBe(true);
}
