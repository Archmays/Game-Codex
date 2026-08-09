import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FINAL_GOLDEN_MANIFEST,
  FIRST_RUN_CHARACTER_IDS,
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_SLICE_ENCOUNTERS,
  GOLDEN_SLICE_MANIFEST_REVISION_HASH,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";
import { STEP03_REVIEW_IDENTITY } from "../apps/hanzi-v2-step03-review/review-identity";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 06 semantic freeze", () => {
  it("keeps accepted identities and Golden Slice content exact", () => {
    expect(STEP03_REVIEW_IDENTITY.sourceSnapshots).toEqual({ encounters: "fnv1a:d805357d", abilities: "fnv1a:2d361817", boss: "fnv1a:ee5df70f", themeC: "fnv1a:15133968" });
    expect(GOLDEN_SLICE_MANIFEST_REVISION_HASH).toBe("fnv1a:67ad1fe2");
    expect(FIRST_RUN_CHARACTER_IDS).toEqual(["ming", "hua", "lin", "xing"]);
    expect(FINAL_GOLDEN_MANIFEST).toHaveLength(12);
    expect(GOLDEN_SLICE_ENCOUNTERS).toHaveLength(4);
    expect(GOLDEN_ABILITIES).toHaveLength(3);
    expect(GOLDEN_BOSS_PHASES).toHaveLength(2);
  });

  it("uses onStateChange as an adapter and adds no content, art, pressure, or network", () => {
    const main = readFileSync(resolve(root, "src/main.ts"), "utf8");
    expect(main).toContain("onStateChange(state)");
    expect(main).not.toMatch(/remaining.?8|full.?ink.?forest|leaderboard|streak|daily.?login|loot.?box|fetch\(|WebSocket/iu);
  });
});
