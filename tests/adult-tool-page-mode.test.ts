import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADULT_TOOL_ROUTE_REGISTRY, pageModeForAppRoute } from "../src/app-route";
import { activatePageMode, PAGE_MODE_CLASS, resetPageMode, type PageModeDocument } from "../src/page-mode";

class FakeClassList {
  readonly values = new Set<string>();
  add(...tokens: string[]): void { tokens.forEach((token) => this.values.add(token)); }
  remove(...tokens: string[]): void { tokens.forEach((token) => this.values.delete(token)); }
}

function fakeDocument(): PageModeDocument & {
  documentElement: { classList: FakeClassList };
  body: { classList: FakeClassList };
} {
  return {
    documentElement: { classList: new FakeClassList() },
    body: { classList: new FakeClassList() },
  };
}

describe("shared page mode", () => {
  it("keeps exactly one explicit page-mode class on html and body", () => {
    const target = fakeDocument();
    activatePageMode("game-fullscreen", target);
    expect([...target.documentElement.classList.values]).toEqual([PAGE_MODE_CLASS["game-fullscreen"]]);
    expect([...target.body.classList.values]).toEqual([PAGE_MODE_CLASS["game-fullscreen"]]);

    activatePageMode("adult-tool", target);
    expect([...target.documentElement.classList.values]).toEqual([PAGE_MODE_CLASS["adult-tool"]]);
    expect([...target.body.classList.values]).toEqual([PAGE_MODE_CLASS["adult-tool"]]);

    resetPageMode(target);
    expect(target.documentElement.classList.values.size).toBe(0);
    expect(target.body.classList.values.size).toBe(0);
  });

  it("defines scroll ownership through adult-tool-page rather than step identities", () => {
    const contractCss = readFileSync(resolve(process.cwd(), "src/page-mode.css"), "utf8");
    const appCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(contractCss).toMatch(/body\.adult-tool-page\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s);
    expect(contractCss).toMatch(/body\.adult-tool-page #app\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100dvh;[^}]*overflow:\s*visible;/s);
    expect(contractCss).toMatch(/body\.game-fullscreen-page\s*\{[^}]*overflow:\s*hidden;/s);
    expect(`${contractCss}\n${appCss}`).not.toMatch(/body\.step0[2-7]-(?:review|observer)-page\s*\{[^}]*overflow/s);
  });

  it("registers every review, observer, and machine report as an adult tool", () => {
    expect(ADULT_TOOL_ROUTE_REGISTRY.map((route) => route.kind)).toEqual([
      "observe-step07",
      "observe-step06",
      "observe-step04",
      "review-step05",
      "review-step03",
      "review-step02",
      "machine-review-report",
    ]);
    for (const route of ADULT_TOOL_ROUTE_REGISTRY) expect(pageModeForAppRoute(route.kind)).toBe("adult-tool");
    expect(pageModeForAppRoute("play")).toBe("game-fullscreen");
    expect(pageModeForAppRoute("world")).toBe("game-fullscreen");
  });
});
