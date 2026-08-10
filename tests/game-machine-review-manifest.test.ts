vi.mock("phaser", () => ({
  default: {
    AUTO: 0,
    Scene: class {},
    Game: class {},
    Scale: { FIT: 0, CENTER_BOTH: 0 },
    Math: { Between: () => 0 },
  },
}));

import { ADULT_TOOL_ROUTE_REGISTRY } from "../src/app-route";
import { gameCatalog } from "../packages/data/gameCatalog";
import {
  GOLDEN_SLICE_DEEP_STATES,
  MACHINE_REVIEW_MANIFEST,
  WORLD_DEEP_STATES,
  assertMachineReviewManifest,
  createMachineReviewManifest,
} from "../tools/game-machine-review/machine-review-manifest";

describe("game machine review manifest", () => {
  it("derives the complete classic-game smoke inventory from gameCatalog", () => {
    expect(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes).toHaveLength(gameCatalog.length);
    expect(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId)).toEqual(
      gameCatalog.map((game) => game.id),
    );
    expect(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.title)).toEqual(
      gameCatalog.map((game) => game.title),
    );
    expect(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.playLabel)).toEqual(
      gameCatalog.map((game) => game.playLabel ?? "开始游戏"),
    );
  });

  it("derives every adult tool route from the canonical route registry", () => {
    expect(MACHINE_REVIEW_MANIFEST.adultToolRoutes).toEqual(
      ADULT_TOOL_ROUTE_REGISTRY.map((route) => ({
        id: route.kind,
        routeKind: route.kind,
        route: route.query,
        fixtureRequired: route.kind.startsWith("observe-"),
      })),
    );
  });

  it("declares the bounded world and Golden Slice deep-state matrices", () => {
    const world = MACHINE_REVIEW_MANIFEST.deepRoutes.find((entry) => entry.id === "my-game-world");
    const goldenSlice = MACHINE_REVIEW_MANIFEST.deepRoutes.find((entry) => entry.id === "hanzi-golden-slice");
    expect(world?.states).toEqual(WORLD_DEEP_STATES);
    expect(goldenSlice?.states).toEqual(GOLDEN_SLICE_DEEP_STATES);
    expect(world?.viewportIds).toEqual(["mobile", "tablet", "desktop"]);
    expect(goldenSlice?.viewportIds).toEqual(["mobile", "tablet", "desktop"]);
  });

  it("rejects catalog drift instead of accepting a copied inventory", () => {
    const manifest = createMachineReviewManifest();
    const drifted = {
      ...manifest,
      catalogSmokeRoutes: manifest.catalogSmokeRoutes.slice(1),
    };
    expect(() => assertMachineReviewManifest(drifted)).toThrow(/gameCatalog/);
  });
});
