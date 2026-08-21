import { existsSync, readFileSync } from "node:fs";
import { GAME_PORTFOLIO, PORTFOLIO_TEST_PROFILES } from "../packages/data/gamePortfolio";
import { affectedGateCommands } from "../tools/portfolio/affected-gates";
import { checkGeneratedDocs, validatePortfolio } from "../tools/portfolio/check-portfolio";
import { loadGameCatalogMetadata } from "../tools/portfolio/load-game-catalog-metadata";

describe("game portfolio governance", () => {
  const gameCatalog = loadGameCatalogMetadata();
  const currentClassicGameCatalog = gameCatalog.filter((game) => GAME_PORTFOLIO.find((record) => record.id === game.id)?.currentStandaloneVisible);

  it("represents the live catalog one-to-one with valid governance identities", () => {
    expect(validatePortfolio(gameCatalog, currentClassicGameCatalog)).toEqual([]);
    expect(GAME_PORTFOLIO).toHaveLength(9);
    expect(new Set(GAME_PORTFOLIO.map((record) => record.id)).size).toBe(9);
    expect(new Set(GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces)).size).toBe(
      GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces).length,
    );
    expect(new Set(GAME_PORTFOLIO.map((record) => record.qualityTier))).toEqual(new Set(["S", "A", "B", "C"]));
    expect(GAME_PORTFOLIO.every((record) => record.currentStandaloneVisible)).toBe(true);
  });

  it("binds every game to a same-tier test profile and existing canonical docs", () => {
    const profiles = new Map(PORTFOLIO_TEST_PROFILES.map((profile) => [profile.id, profile]));
    for (const record of GAME_PORTFOLIO) {
      expect(profiles.get(record.testProfile)?.qualityTier).toBe(record.qualityTier);
      expect(record.canonicalDocs.every((path) => existsSync(path))).toBe(true);
    }
  });

  it("keeps generated portfolio documents byte-deterministic and drift-free", () => {
    expect(checkGeneratedDocs()).toEqual([]);
    const status = readFileSync("docs/project-status/portfolio-status.md", "utf8");
    expect(status).toContain("9/9");
    expect(status).toContain("NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE");
  });

  it("maps shared and unknown changes to fail-safe gates", () => {
    const docs = affectedGateCommands(["docs/project-status/portfolio-status.md"]);
    expect(docs.map((command) => command.label)).toEqual(["portfolio consistency"]);

    const game = affectedGateCommands(["games/clock-reader/index.ts"]);
    expect(game.map((command) => command.label)).toContain("clock-reader entry/interaction/return smoke");

    const shared = affectedGateCommands(["packages/game-core/index.ts"]);
    expect(shared.map((command) => command.label)).toEqual([
      "portfolio consistency",
      "unit and content tests",
      "typecheck",
      "production build",
      "all-game portfolio smoke",
    ]);

    expect(affectedGateCommands(["<unknown>"]).at(-1)?.label).toBe("all-game portfolio smoke");
  });
});
