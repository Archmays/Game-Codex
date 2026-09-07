import { pageModeForSearch, playSurfaceForSearch } from "../src/app-route";
import { activatePageMode, PAGE_MODE_CLASS, resetPageMode, type PageModeDocument } from "../src/page-mode";
import { PLAY_SURFACE_MANIFEST } from "../packages/data/playSurfaceManifest";

function classTarget() {
  const values = new Set<string>();
  return {
    values,
    classList: {
      add: (...tokens: string[]) => tokens.forEach((token) => values.add(token)),
      remove: (...tokens: string[]) => tokens.forEach((token) => values.delete(token)),
    },
  };
}

describe("play-surface scroll integrity", () => {
  it("classifies every current surface as naturally document-scrollable", () => {
    expect(PLAY_SURFACE_MANIFEST.filter(surface => surface.kind === "station").map(surface => surface.id)).toEqual(["math-slider", "math-target"]);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "document")).toHaveLength(PLAY_SURFACE_MANIFEST.length);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "internal").map((surface) => surface.id)).toEqual([
    ]);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "locked")).toEqual([]);
    expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === "my-game-world")?.scrollPolicy).toBe("document");
  });

  it("uses the most specific surface query instead of a route-family fullscreen default", () => {
    const tower = new URLSearchParams("play=hanzi-tower-defense&from=world");
    expect(playSurfaceForSearch(tower)?.id).toBe("hanzi-tower-defense");
    expect(pageModeForSearch(tower)).toBe("game-scrollable");
    const station = new URLSearchParams("world=math-world&station=target&from=hub");
    expect(playSurfaceForSearch(station)?.id).toBe("math-target");
    for (const retired of ["world=english-world&view=journal", "play=hanzi-magic-complete&slice=family", "play=hanzi-v2-v1&from=world"]) {
      expect(playSurfaceForSearch(new URLSearchParams(retired))).toBeNull();
      expect(pageModeForSearch(new URLSearchParams(retired))).toBe("game-scrollable");
    }

    const familyWorld = new URLSearchParams("world=my-game-world&parent=observation");
    expect(playSurfaceForSearch(familyWorld)?.id).toBe("my-game-world");
    expect(pageModeForSearch(familyWorld)).toBe("game-scrollable");

    expect(pageModeForSearch(new URLSearchParams("world=english-world"))).toBe("game-scrollable");
    expect(pageModeForSearch(new URLSearchParams())).toBe("game-scrollable");
    expect(pageModeForSearch(new URLSearchParams("utm_source=bookmark"))).toBe("game-scrollable");
  });

  it("resets scrollable and fullscreen page classes without leaving stale locks", () => {
    const html = classTarget();
    const body = classTarget();
    const target = { documentElement: html, body } satisfies PageModeDocument;
    activatePageMode("game-fullscreen", target);
    expect(body.values).toEqual(new Set([PAGE_MODE_CLASS["game-fullscreen"]]));
    activatePageMode("game-scrollable", target);
    expect(body.values).toEqual(new Set([PAGE_MODE_CLASS["game-scrollable"]]));
    resetPageMode(target);
    expect(html.values.size).toBe(0);
    expect(body.values.size).toBe(0);
  });
});
