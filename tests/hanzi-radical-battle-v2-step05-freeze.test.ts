import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FINAL_GOLDEN_MANIFEST,
  FIRST_RUN_CHARACTER_IDS,
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_CHILD_COPY,
  GOLDEN_SLICE_ENCOUNTERS,
  GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  GOLDEN_SLICE_PACING_CONTRACT,
} from "../games/hanzi-radical-battle/v2/golden-slice/content";
import {
  DEFAULT_GOLDEN_SLICE_SAVE,
  GOLDEN_SLICE_SAVE_KEY,
  GOLDEN_SLICE_SAVE_SCHEMA_VERSION,
} from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { STEP03_REVIEW_IDENTITY } from "../apps/hanzi-v2-step03-review/review-identity";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 05 changed-only semantic freeze", () => {
  it("keeps all five accepted source identities exact", () => {
    expect(STEP03_REVIEW_IDENTITY.sourceSnapshots).toEqual({
      encounters: "fnv1a:d805357d",
      abilities: "fnv1a:2d361817",
      boss: "fnv1a:ee5df70f",
      themeC: "fnv1a:15133968",
    });
    expect(GOLDEN_SLICE_MANIFEST_REVISION_HASH).toBe("fnv1a:67ad1fe2");
  });

  it("keeps 12 characters, four first-run encounters, three abilities, and two boss phases", () => {
    expect(FINAL_GOLDEN_MANIFEST).toHaveLength(12);
    expect(FIRST_RUN_CHARACTER_IDS).toEqual(["ming", "hua", "lin", "xing"]);
    expect(GOLDEN_SLICE_ENCOUNTERS).toHaveLength(4);
    expect(GOLDEN_ABILITIES.map((ability) => ability.id)).toEqual(["guardian-light", "star-path", "ink-echo"]);
    expect(GOLDEN_BOSS_PHASES.map((phase) => phase.id)).toEqual(["lin", "xing"]);
    expect(GOLDEN_SLICE_ENCOUNTERS.map((encounter) => encounter.characterId)).toEqual(FIRST_RUN_CHARACTER_IDS);
  });

  it("keeps pacing, save identity/defaults, and safe child copy", () => {
    expect(GOLDEN_SLICE_PACING_CONTRACT).toMatchObject({
      totalMinimumSeconds: 180,
      totalMaximumSeconds: 265,
      firstSpellBySeconds: 60,
      noCountdownPressure: true,
    });
    expect(GOLDEN_SLICE_SAVE_SCHEMA_VERSION).toBe(3);
    expect(GOLDEN_SLICE_SAVE_KEY).toBe("family-games/hanzi-radical-battle-v2/golden-slice/state");
    expect(DEFAULT_GOLDEN_SLICE_SAVE).toMatchObject({ completedRuns: 0, campState: { lamp: false }, spellbookEntries: [] });
    expect(Object.values(GOLDEN_CHILD_COPY).join("\n")).not.toMatch(/笨|失败|扣分|输掉|再也不能/u);
  });

  it("does not add a remaining-eight route or alter the default catalogue", () => {
    const main = readFileSync(resolve(root, "src/main.ts"), "utf8");
    const catalog = readFileSync(resolve(root, "packages/data/gameCatalog.ts"), "utf8");
    expect(main).not.toMatch(/remaining.?8|full.?ink.?forest/iu);
    expect(catalog).not.toContain("hanzi-v2-golden-slice");
  });
});
