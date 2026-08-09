import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
  INK_FOREST_ROUTE,
  MY_GAME_WORLD_ROUTE,
  withStep06RouteContext,
} from "../apps/my-game-world/world-routes";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 06 route compatibility", () => {
  it("keeps ten canonical games and query-only base-safe routes", () => {
    const catalog = readFileSync(resolve(root, "packages/data/gameCatalog.ts"), "utf8");
    const entries = catalog.match(/export const gameCatalog[^[]*\[([\s\S]*?)\];/u)?.[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];
    expect(entries).toHaveLength(10);
    expect([MY_GAME_WORLD_ROUTE, INK_FOREST_ROUTE, CLASSIC_HUB_FROM_WORLD_ROUTE].every((route) => route.startsWith("?") && !route.startsWith("/"))).toBe(true);
    expect(withStep06RouteContext(INK_FOREST_ROUTE, { evidence: "hanzi-v2-step06", sessionId: "s06-12345678" }, "world"))
      .toContain("evidence=hanzi-v2-step06");
  });

  it("mounts the unchanged catalog inside the explicit classic wrapper", () => {
    const world = readFileSync(resolve(root, "apps/my-game-world/index.ts"), "utf8");
    const hub = readFileSync(resolve(root, "apps/hub/index.ts"), "utf8");
    expect(world).toContain("mountHub(inner)");
    expect(world).toContain("回我的游戏世界");
    expect(hub).not.toContain("hanzi-v2-step06");
  });
});
