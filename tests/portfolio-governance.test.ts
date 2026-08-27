import { existsSync, readFileSync } from "node:fs";
import {
  ACTIVE_CHILD_PRODUCTS,
  CLASSIC_CARD_PRODUCTS,
  COMPATIBILITY_SURFACES,
  GAME_PORTFOLIO,
  PORTFOLIO_TEST_PROFILES,
  SHARED_ENGINES,
  WORLD_MODULES
} from "../packages/data/gamePortfolio";
import { PLAY_SURFACE_MANIFEST, PRIMARY_PLAY_SURFACES } from "../packages/data/playSurfaceManifest";
import { ACTIVE_PROJECT_PHASE, NEXT_PROJECT_PHASE, PROJECT_LIFECYCLE_TERMINAL_TRUTH, PROJECT_PHASES } from "../packages/data/projectLifecycle";
import { KNOWN_SAVE_KEYS, portfolioNamespacesWithoutKnownKey } from "../packages/data/saveKeyInventory";
import { affectedGateCommands } from "../tools/portfolio/affected-gates";
import { checkGeneratedDocs, validatePortfolio } from "../tools/portfolio/check-portfolio";
import { loadGameCatalogMetadata } from "../tools/portfolio/load-game-catalog-metadata";

describe("game portfolio governance", () => {
  const gameCatalog = loadGameCatalogMetadata();
  const currentClassicGameCatalog = gameCatalog.filter((game) => GAME_PORTFOLIO.find((record) => record.id === game.id)?.classicCardVisible);

  it("represents the live catalog one-to-one with valid governance identities", () => {
    expect(validatePortfolio(gameCatalog, currentClassicGameCatalog)).toEqual([]);
    expect(GAME_PORTFOLIO).toHaveLength(9);
    expect(new Set(GAME_PORTFOLIO.map((record) => record.id)).size).toBe(9);
    expect(new Set(GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces)).size).toBe(
      GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces).length,
    );
    expect(new Set(GAME_PORTFOLIO.map((record) => record.qualityTier))).toEqual(new Set(["S", "A", "B", "C"]));
    expect(ACTIVE_CHILD_PRODUCTS.map((record) => record.id)).toEqual([
      "hanzi-radical-battle", "math-lab", "english-spell-battle", "equation-slider"
    ]);
    expect(CLASSIC_CARD_PRODUCTS.map((record) => record.id)).toEqual([
      "hanzi-radical-battle", "math-lab", "english-spell-battle", "equation-slider"
    ]);
    expect(WORLD_MODULES).toHaveLength(11);
    expect(COMPATIBILITY_SURFACES).toHaveLength(6);
    expect(SHARED_ENGINES).toHaveLength(2);
    expect(currentClassicGameCatalog).toHaveLength(4);
    expect(GAME_PORTFOLIO.filter((record) => !record.classicCardVisible).map((record) => record.id).sort()).toEqual([
      "clock-reader",
      "make-target",
      "memory-card",
      "multiplication-adventure",
      "pinyin-magic-battle",
    ]);
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
    expect(status).toContain("Mount definitions：`9`");
    expect(status).toContain("Active child products：`4`");
    expect(status).toContain("NO_BY_USER_DIRECTION_AND_NOT_A_DEVELOPMENT_GATE");
  });

  it("binds the terminal lifecycle, first-use surfaces, and exact save inventory", () => {
    expect(PROJECT_PHASES.filter((phase) => phase.status === "complete")).toHaveLength(5);
    expect(PROJECT_PHASES.find((phase) => phase.id === ACTIVE_PROJECT_PHASE)?.status).toBe("active");
    expect(NEXT_PROJECT_PHASE).toBeNull();
    expect(PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag).toBe("game-codex-family-stable-v1.0.0");
    expect(PROJECT_LIFECYCLE_TERMINAL_TRUTH.automaticLargeTask).toBe("NONE");
    expect(new Set(PLAY_SURFACE_MANIFEST.map((surface) => surface.id)).size).toBe(PLAY_SURFACE_MANIFEST.length);
    expect(PRIMARY_PLAY_SURFACES.map((surface) => surface.id)).toEqual([
      "my-game-world", "classic-hub", "hanzi-world", "math-world", "english-world", "classic-equation",
    ]);
    expect(new Set(KNOWN_SAVE_KEYS.map((record) => record.key)).size).toBe(KNOWN_SAVE_KEYS.length);
    expect(portfolioNamespacesWithoutKnownKey()).toEqual([]);
  });

  it("maps shared and unknown changes to fail-safe gates", () => {
    const docs = affectedGateCommands(["docs/project-status/portfolio-status.md"]);
    expect(docs.map((command) => command.label)).toEqual([
      "portfolio consistency",
      "Portfolio Evolution evidence and generated audit",
    ]);

    const game = affectedGateCommands(["games/clock-reader/index.ts"]);
    expect(game.map((command) => command.label)).toEqual([
      "portfolio consistency",
      "Portfolio Evolution evidence and generated audit",
      "Math World model, content, and save gates",
      "Math World portfolio and replacement contract",
      "Math World routes, interactions, and lifecycle",
    ]);

    const equation = affectedGateCommands(["games/equation-slider/board-state.ts"]);
    expect(equation.map((command) => command.label)).toEqual([
      "portfolio consistency",
      "Portfolio Evolution evidence and generated audit",
      "unit and content tests",
      "Equation Slider deterministic 200-level audit",
      "Equation Slider core browser profile",
      "Equation Slider S release browser profile",
      "Equation Slider visual and geometry profile",
      "Equation Slider bounded agent playtest",
      "equation-slider entry/interaction/return smoke",
    ]);

    const shared = affectedGateCommands(["packages/game-core/index.ts"]);
    expect(shared.map((command) => command.label)).toEqual([
      "portfolio consistency",
      "Portfolio Evolution evidence and generated audit",
      "UI occlusion inventory and interaction-integrity contracts",
      "play-surface scroll ownership contracts",
      "unit and content tests",
      "Math World portfolio and replacement contract",
      "canonical Pinyin, source audit, and memory relation contracts",
      "typecheck",
      "production build",
      "Math World routes, interactions, and lifecycle",
      "Chinese support routes, inputs, saves, and fallbacks",
      "English World routes, interactions, and geometry",
      "representative play-surface browser hit-test matrix",
      "representative scroll and bottom reachability matrix",
      "all-game portfolio smoke",
    ]);

    expect(affectedGateCommands(["<unknown>"]).at(-1)?.label).toBe("all-game portfolio smoke");
  });

  it("keeps consolidated support and Classic return routes aligned with runtime context", () => {
    for (const id of ["hanzi-pinyin-assemble", "hanzi-pinyin-tone", "hanzi-pinyin-contrast", "hanzi-memory-same-glyph", "hanzi-memory-glyph-pinyin", "hanzi-memory-glyph-phrase"]) {
      expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === id)?.returnRoute).toBe("?play=hanzi-magic-complete&from=world");
    }
    expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === "classic-math")?.returnRoute).toBe("?world=my-game-world");
    for (const id of ["classic-hanzi", "classic-english", "classic-equation"]) {
      expect(PLAY_SURFACE_MANIFEST.find((surface) => surface.id === id)?.returnRoute).toBe("?hub=classic&from=world");
    }
  });
});
