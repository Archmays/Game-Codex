import { readFileSync, readdirSync } from "node:fs";
import { LEGACY_WHEEL_SOURCE } from "../games/hanzi-radical-battle/v2/wheel-workshop/library/legacy-wheel-source";
import { englishWords, pinyinCards } from "../packages/data/learningGames";
import { MEMORY_CARD_PAIR_COUNT, memoryCardSets, pickMemoryCardPairs } from "../packages/data/memoryCards";

describe("game catalog", () => {
  it("registers the first batch of migrated single-file games", () => {
    const source = readFileSync("packages/data/gameCatalog.ts", "utf8");

    expect(source).toContain("multiplicationAdventureGame");
    expect(source).toContain("englishSpellBattleGame");
    expect(source).toContain("clockReaderGame");
    expect(source).toContain("makeTargetGame");
    expect(source).toContain("pinyinMagicBattleGame");
    expect(source).toContain("hanziRadicalBattleGame");
    expect(source).toContain('import { equationSliderGame } from "../../games/equation-slider"');
    expect(source).toMatch(/\[[\s\S]*equationSliderGame[\s\S]*\]/);
    expect(source.match(/\bequationSliderGame\b/g)).toHaveLength(2);
  });

  it("has shared learning data for the migrated games", () => {
    expect(englishWords.length).toBeGreaterThanOrEqual(30);
    expect(pinyinCards.length).toBeGreaterThanOrEqual(60);
    expect(LEGACY_WHEEL_SOURCE.length).toBe(9);
    expect(LEGACY_WHEEL_SOURCE.every((set) => set.char.validPairs.length > 0 && set.word.validPairs.length > 0)).toBe(true);
  });

  it("keeps every catalog game documented for the hub", () => {
    const gameDirs = readdirSync("games", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(gameDirs).toHaveLength(9);

    for (const gameDir of gameDirs) {
      const source = readFileSync(`games/${gameDir}/index.ts`, "utf8");
      const readme = readFileSync(`games/${gameDir}/README.md`, "utf8");

      for (const field of ["id", "title", "description", "subject", "recommendedAge", "learningGoal", "status"]) {
        expect(source, `${gameDir} ${field}`).toContain(`${field}:`);
      }

      for (const heading of ["## 游戏目标", "## 适合对象", "## 玩法说明", "## 涉及知识点", "## 设备适配", "## 当前完成度", "## 后续改进建议", "## 接入方式"]) {
        expect(readme, `${gameDir} ${heading}`).toContain(heading);
      }
    }

    const equationSliderSource = readFileSync("games/equation-slider/index.ts", "utf8");
    const equationSliderReadme = readFileSync("games/equation-slider/README.md", "utf8");
    expect(equationSliderSource).toContain('id: "equation-slider"');
    expect(equationSliderSource).toContain('title: "算式滑轨"');
    expect(equationSliderReadme).toContain("200 份 V3 schema 关卡");
    expect(equationSliderReadme).toContain("40 个手工金标准");
    const rootReadme = readFileSync("README.md", "utf8");
    expect(rootReadme).toContain("保留 9 个可挂载定义");
    expect(rootReadme).toContain("经典大厅当前展示 7 个独立入口");
    expect(rootReadme).not.toContain("| 汉字大转盘 |");
    expect(rootReadme.match(/\| 算式滑轨 \|/g)).toHaveLength(1);
  });

  it("keeps memory card grade sets aligned with the preserved raw grade sets", () => {
    expect(memoryCardSets).toHaveLength(9);
    expect(memoryCardSets.map((set) => set.label)).toEqual(LEGACY_WHEEL_SOURCE.map((set) => set.label));

    for (const set of memoryCardSets) {
      const ids = new Set(set.pairs.map((pair) => pair.id));
      const symbols = new Set(set.pairs.map((pair) => pair.symbol));
      const wheelSet = LEGACY_WHEEL_SOURCE.find((item) => item.id === set.id);

      expect(set.pairs.length, set.label).toBe(wheelSet?.char.validPairs.length);
      expect(ids.size, `${set.label} ids`).toBe(set.pairs.length);
      expect(symbols.size, `${set.label} symbols`).toBe(set.pairs.length);
      expect(set.pairs.every((pair) => pair.label.trim() && pair.symbol.trim()), set.label).toBe(true);
    }
  });

  it("samples varied memory card pairs from the full grade pool", () => {
    const secondGrade = memoryCardSets.find((set) => set.label === "二年级");

    expect(secondGrade).toBeTruthy();

    const picked = pickMemoryCardPairs(secondGrade!.pairs, MEMORY_CARD_PAIR_COUNT, () => 0.99);
    const pickedSymbols = new Set(picked.map((pair) => pair.symbol));
    const pickedInnerParts = new Set(picked.map((pair) => pair.inner));

    expect(picked).toHaveLength(MEMORY_CARD_PAIR_COUNT);
    expect(pickedSymbols.size).toBe(MEMORY_CARD_PAIR_COUNT);
    expect(pickedInnerParts.size).toBeGreaterThan(1);
    expect(picked.every((pair) => pair.inner === "青")).toBe(false);
  });

  it("can reshuffle memory card pairs on restart", () => {
    const secondGrade = memoryCardSets.find((set) => set.label === "二年级");

    expect(secondGrade).toBeTruthy();

    const firstPick = pickMemoryCardPairs(secondGrade!.pairs, MEMORY_CARD_PAIR_COUNT, () => 0.99).map((pair) => pair.symbol).join("");
    const secondPick = pickMemoryCardPairs(secondGrade!.pairs, MEMORY_CARD_PAIR_COUNT, () => 0).map((pair) => pair.symbol).join("");

    expect(firstPick).not.toBe(secondPick);
  });

  it("keeps preserved raw options unique and referenced by every source record", () => {
    for (const set of LEGACY_WHEEL_SOURCE) {
      expect(set.char.validPairs.length, `${set.id} char count`).toBeGreaterThanOrEqual(18);
      expect(set.word.validPairs.length, `${set.id} word count`).toBeGreaterThanOrEqual(12);

      for (const mode of [set.char, set.word]) {
        expect(new Set(mode.outerOptions).size, `${set.id} outer`).toBe(mode.outerOptions.length);
        expect(new Set(mode.innerOptions).size, `${set.id} inner`).toBe(mode.innerOptions.length);

        for (const pair of mode.validPairs) {
          expect(mode.outerOptions, `${set.id} ${pair.result} outer`).toContain(pair.outer);
          expect(mode.innerOptions, `${set.id} ${pair.result} inner`).toContain(pair.inner);
          expect(pair.outer.trim(), `${set.id} outer`).toBeTruthy();
          expect(pair.inner.trim(), `${set.id} inner`).toBeTruthy();
          expect(pair.result.length, `${set.id} result`).toBeGreaterThan(0);
          expect(pair.pinyin.trim(), `${set.id} ${pair.result} pinyin`).toBeTruthy();
          expect(pair.words.length, `${set.id} words`).toBeGreaterThan(0);
          expect(pair.words.every((word) => word.trim().length > 0), `${set.id} ${pair.result} words`).toBe(true);
        }
      }
    }
  });

  it("keeps the source component pair for 胆 byte-faithful", () => {
    const badPair = LEGACY_WHEEL_SOURCE
      .flatMap((set) => set.char.validPairs)
      .find((pair) => pair.outer === "月" && pair.inner === "胆" && pair.result === "胆");
    const thirdGrade = LEGACY_WHEEL_SOURCE.find((set) => set.id === "p3");

    expect(badPair).toBeUndefined();
    expect(thirdGrade?.char.validPairs).toContainEqual(
      expect.objectContaining({ outer: "月", inner: "旦", result: "胆" })
    );
  });
});
