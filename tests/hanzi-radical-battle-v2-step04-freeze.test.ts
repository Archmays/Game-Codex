import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FINAL_GOLDEN_MANIFEST,
  FIRST_RUN_CHARACTER_IDS,
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_SLICE_ENCOUNTERS,
  GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  THEME_C_PROCEDURAL_ASSETS,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";
import { STEP03_REVIEW_IDENTITY } from "../apps/hanzi-v2-step03-review/review-identity";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 04 changed-only freeze", () => {
  it("fails closed if any accepted source snapshot drifts", () => {
    expect(STEP03_REVIEW_IDENTITY.sourceSnapshots).toEqual({
      encounters: "fnv1a:d805357d",
      abilities: "fnv1a:2d361817",
      boss: "fnv1a:ee5df70f",
      themeC: "fnv1a:15133968",
    });
    expect(GOLDEN_SLICE_MANIFEST_REVISION_HASH).toBe("fnv1a:67ad1fe2");
  });

  it("keeps the accepted content, encounter, ability, boss, and Theme C cardinalities", () => {
    expect(FINAL_GOLDEN_MANIFEST).toHaveLength(12);
    expect(FIRST_RUN_CHARACTER_IDS).toEqual(["ming", "hua", "lin", "xing"]);
    expect(GOLDEN_SLICE_ENCOUNTERS).toHaveLength(4);
    expect(GOLDEN_ABILITIES.map(({ id }) => id)).toEqual(["guardian-light", "star-path", "ink-echo"]);
    expect(GOLDEN_BOSS_PHASES.map(({ id }) => id)).toEqual(["lin", "xing"]);
    expect(THEME_C_PROCEDURAL_ASSETS.length).toBeGreaterThan(0);
  });

  it("does not add the accepted golden slice to the default hub or introduce ImageGen runtime", () => {
    const catalog = readFileSync(resolve(root, "packages/data/gameCatalog.ts"), "utf8");
    const main = readFileSync(resolve(root, "src/main.ts"), "utf8");
    const runtime = [
      resolve(root, "games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts"),
      resolve(root, "games/hanzi-radical-battle/v2/golden-slice/phaser/create-golden-slice-game.ts"),
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(catalog).not.toContain("hanzi-v2-golden-slice");
    expect(main).not.toMatch(/mountHub\([^)]*hanzi-v2-golden-slice/u);
    expect(runtime).not.toMatch(/imagegen|openai|https?:\/\//iu);
  });
});
