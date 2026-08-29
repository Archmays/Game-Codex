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
  it("classifies all 39 surfaces with explicit internal and locked exceptions", () => {
    expect(PLAY_SURFACE_MANIFEST).toHaveLength(39);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "document")).toHaveLength(35);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "internal").map((surface) => surface.id)).toEqual([
      "hanzi-family-slice",
      "hanzi-word-slice",
    ]);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "locked").map((surface) => surface.id)).toEqual(["my-game-world", "hanzi-v1-compat"]);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === "internal").every((surface) => surface.scrollContainerSelector === ".hmc-shell")).toBe(true);
    expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === "hanzi-v1-compat")?.lockedReason).toMatch(/fixed inset Phaser/);
    expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === "my-game-world")?.lockedReason).toMatch(/fixed viewport canvas/);
  });

  it("uses the most specific surface query instead of a route-family fullscreen default", () => {
    const journal = new URLSearchParams("world=english-world&view=journal");
    expect(playSurfaceForSearch(journal)?.id).toBe("english-journal");
    expect(pageModeForSearch(journal)).toBe("game-scrollable");

    const internal = new URLSearchParams("play=hanzi-magic-complete&from=hub&slice=family&seed=stable");
    expect(playSurfaceForSearch(internal)?.id).toBe("hanzi-family-slice");
    expect(pageModeForSearch(internal)).toBe("game-fullscreen");

    const fixed = new URLSearchParams("play=hanzi-v2-v1&from=world");
    expect(playSurfaceForSearch(fixed)?.id).toBe("hanzi-v1-compat");
    expect(pageModeForSearch(fixed)).toBe("game-fullscreen");

    const familyWorld = new URLSearchParams("world=my-game-world&parent=observation");
    expect(playSurfaceForSearch(familyWorld)?.id).toBe("my-game-world");
    expect(pageModeForSearch(familyWorld)).toBe("game-fullscreen");

    expect(pageModeForSearch(new URLSearchParams("world=english-world"))).toBe("game-scrollable");
    expect(pageModeForSearch(new URLSearchParams())).toBe("game-fullscreen");
    expect(pageModeForSearch(new URLSearchParams("utm_source=bookmark"))).toBe("game-fullscreen");
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
