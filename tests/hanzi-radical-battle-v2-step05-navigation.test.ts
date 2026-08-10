import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAppRoute } from "../src/app-route";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
  INK_FOREST_ROUTE,
  MY_GAME_WORLD_ROUTE,
} from "../apps/my-game-world/world-routes";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 05 navigation contract", () => {
  it("freezes the opt-in world, forest, and classic-hub routes", () => {
    expect(MY_GAME_WORLD_ROUTE).toBe("?world=my-game-world");
    expect(INK_FOREST_ROUTE).toBe("?play=hanzi-v2-golden-slice&mode=play&from=world");
    expect(CLASSIC_HUB_FROM_WORLD_ROUTE).toBe("?hub=classic&from=world");
  });

  it("promotes the default world while keeping explicit classic and ordinary return context", () => {
    const main = readFileSync(resolve(root, "src/main.ts"), "utf8");
    expect(resolveAppRoute(new URLSearchParams("review=hanzi-v2-step05"))).toEqual({ kind: "review-step05", explicit: true });
    expect(resolveAppRoute(new URLSearchParams("hub=classic"))).toEqual({ kind: "classic-hub", explicit: true });
    expect(resolveAppRoute(new URLSearchParams("world=my-game-world"))).toEqual({ kind: "world", explicit: true });
    expect(resolveAppRoute(new URLSearchParams())).toEqual({ kind: "world", explicit: false });
    expect(main).toContain('mode === "play" && fromMode === "world" ? "?world=my-game-world" : undefined');
    expect(main).toContain("mountMyGameWorld(root)");
  });

  it("mounts the unchanged classic hub inside a wrapper that owns the world-return link", () => {
    const world = readFileSync(resolve(root, "apps/my-game-world/index.ts"), "utf8");
    const hub = readFileSync(resolve(root, "apps/hub/index.ts"), "utf8");
    expect(world).toContain("mountHub(inner)");
    expect(world).toContain("← 回我的游戏世界");
    expect(hub).not.toContain("my-game-world");
  });

  it("adds a completion anchor without dispatching or writing save state", () => {
    const overlay = readFileSync(resolve(root, "games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts"), "utf8");
    expect(overlay).toContain("data-return-to-world");
    expect(overlay).toContain("options.returnToWorldHref");
    expect(overlay).not.toMatch(/data-return-to-world[^\n]*(?:dispatchInternal|writeGoldenSliceSave)/u);
  });
});
