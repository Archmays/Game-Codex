import { readFileSync } from "node:fs";
import { PLAY_SURFACE_MANIFEST, PRIMARY_PLAY_SURFACES } from "../../packages/data/playSurfaceManifest";
import { PROJECT_LIFECYCLE_TERMINAL_TRUTH, PROJECT_PHASES } from "../../packages/data/projectLifecycle";
import { EXPORTABLE_SAVE_KEYS, KNOWN_SAVE_KEYS } from "../../packages/data/saveKeyInventory";

describe("portfolio play-readiness contracts", () => {
  it("keeps phase five machine-complete while human observation remains pending", () => {
    expect(PROJECT_PHASES.map(({ id, status }) => [id, status])).toEqual([
      ["foundation", "complete"],
      ["math-world", "complete"],
      ["chinese-consolidation", "complete"],
      ["english-v2", "complete"],
      ["play-readiness", "complete"],
      ["natural-use-observation", "pending"],
    ]);
    expect(PROJECT_LIFECYCLE_TERMINAL_TRUTH.realChildValidation).toBe("NOT_PERFORMED_AND_NOT_CLAIMED");
    expect(PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation).toBe("PENDING_REAL_EVIDENCE");
    expect(PROJECT_LIFECYCLE_TERMINAL_TRUTH.observationTooling).toBe("READY");
  });

  it("covers every primary first-use surface and keeps Classic at six", () => {
    expect(PLAY_SURFACE_MANIFEST).toHaveLength(42);
    expect(PRIMARY_PLAY_SURFACES).toHaveLength(8);
    expect(PLAY_SURFACE_MANIFEST.filter((surface) => surface.kind === "classic-entry")).toHaveLength(6);
    expect(PLAY_SURFACE_MANIFEST.every((surface) => surface.expectedInputs.includes("keyboard"))).toBe(true);
  });

  it("keeps Save Vault exact-key-only and excludes its rollback key from exports", () => {
    expect(KNOWN_SAVE_KEYS).toHaveLength(37);
    expect(EXPORTABLE_SAVE_KEYS).toHaveLength(36);
    expect(KNOWN_SAVE_KEYS.filter((record) => !record.exportable).map((record) => record.key)).toEqual(["save-vault/pre-import-backup/v1"]);
    const source = readFileSync("packages/save-vault/index.ts", "utf8");
    expect(source).not.toContain("localStorage.clear(");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("sendBeacon");
  });

  it("keeps top and Classic child surfaces free of adult catalog metadata", () => {
    const top = readFileSync("apps/my-game-world/index.ts", "utf8");
    const classic = readFileSync("apps/hub/index.ts", "utf8");
    expect(top).toContain("三个世界 · 一个百宝箱");
    expect(top).not.toContain("夜光墨林");
    for (const forbidden of ["recommendedAge", "learningGoal", "qualityTier", "statusBadge"]) expect(classic).not.toContain(forbidden);
  });

  it("uses semantic loading recovery and language/focus affordances", () => {
    const main = readFileSync("src/main.ts", "utf8");
    const english = readFileSync("games/english-spell-battle/v2/app/index.ts", "utf8");
    expect(main).toContain("renderRouteLoading");
    expect(main).toContain("renderRouteError");
    expect(main).not.toContain("error.message");
    expect(english).toContain('lang="en-US"');
    expect(english).toContain('event.key === "Escape"');
  });
});
