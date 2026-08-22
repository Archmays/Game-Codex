import { readFileSync } from "node:fs";
import { getSubjectFilters } from "../apps/hub/filters";
import { getClockMismatchHint } from "../games/clock-reader";
import { getEnglishSpellFeedback } from "../games/english-spell-battle";
import { calculate, formatCardValue } from "../games/make-target";
import { getMultiplicationGridCount, getNumberBlockCount } from "../games/multiplication-adventure";
import { createPinyinSession } from "../games/hanzi-radical-battle/complete/support/pinyin/machine";

describe("learning game optimizations", () => {
  it("counts multiplication visual blocks from the displayed factors", () => {
    expect(getNumberBlockCount(8)).toBe(8);
    expect(getMultiplicationGridCount(7, 9)).toBe(63);
  });

  it("keeps make-target card calculations and display values explicit", () => {
    expect(calculate(8, 1, "-")).toBe(7);
    expect(calculate(3, 8, "×")).toBe(24);
    expect(calculate(8, 2, "÷")).toBe(4);
    expect(calculate(5, 2, "÷")).toBeNull();
    expect(formatCardValue(7)).toBe("7");
  });

  it("keeps sound-rhyme sessions short and deterministic", () => {
    expect(createPinyinSession("assemble", "same")).toEqual(createPinyinSession("assemble", "same"));
    expect(createPinyinSession("assemble", "same")).toHaveLength(4);
  });

  it("keeps child-mode return buttons in the migrated games", () => {
    const multiplication = readFileSync("games/multiplication-adventure/index.ts", "utf8");
    const english = readFileSync("games/english-spell-battle/index.ts", "utf8");
    const pinyin = readFileSync("games/pinyin-magic-battle/index.ts", "utf8");

    expect(multiplication).toContain("换一个任务");
    expect(english).toContain("返回英文魔法战");
    expect(pinyin).toContain("mountSoundRhymeTrial");
  });

  it("makes the array itself the multiplication core without score-loop pressure", () => {
    const multiplication = readFileSync("games/multiplication-adventure/index.ts", "utf8");

    expect(multiplication).not.toContain("setTimeout");
    expect(multiplication).toContain("搭阵列");
    expect(multiplication).toContain("看阵列");
    expect(multiplication).toContain("翻转阵列");
    expect(multiplication).not.toContain("bestScore");
    expect(multiplication).not.toContain("plays");
    expect(multiplication).not.toContain("import.meta.glob");
    expect(multiplication).not.toContain("source/number-blocks-character");
  });

  it("keeps the restored learning feedback surfaces in source", () => {
    const clock = readFileSync("games/clock-reader/index.ts", "utf8");
    const english = readFileSync("games/english-spell-battle/index.ts", "utf8");
    const pinyin = readFileSync("games/pinyin-magic-battle/index.ts", "utf8");

    expect(clock).toContain("minute < 60");
    expect(clock).toContain("clock-face__minute-label");
    expect(english).toContain("revealWord = true");
    expect(english).toContain("900");
    expect(pinyin).toContain("声韵试炼");
    expect(pinyin).not.toContain("pinyinCards");
  });

  it("retires the pinyin battle surface in favor of the canonical wrapper", () => {
    const pinyin = readFileSync("games/pinyin-magic-battle/index.ts", "utf8");
    const readme = readFileSync("games/pinyin-magic-battle/README.md", "utf8");

    expect(pinyin).toContain("mountSoundRhymeTrial");
    expect(pinyin).toContain("已并入墨迹森林");
    expect(pinyin).not.toMatch(/HP|damage|streak|score|monster/i);
    expect(readme).not.toContain("气" + "球");
  });

  it("derives stable subject filters for the hub", () => {
    expect(
      getSubjectFilters([
        { subject: "识字" },
        { subject: "数学" },
        { subject: "识字" },
        { subject: "英语" }
      ])
    ).toEqual(["全部", "识字", "数学", "英语"]);
  });

  it("guides clock practice toward the mismatched hand", () => {
    expect(getClockMismatchHint({ hour: 3, minute: 15 }, { hour: 4, minute: 15 })).toContain("先看短针");
    expect(getClockMismatchHint({ hour: 3, minute: 15 }, { hour: 3, minute: 20 })).toContain("再调分针");
    expect(getClockMismatchHint({ hour: 3, minute: 15 }, { hour: 3, minute: 15 })).toBe("");
  });

  it("gives English spelling mistakes a next practice step", () => {
    expect(getEnglishSpellFeedback("cat", "c", 1)).toContain("听一遍 cat");
    expect(getEnglishSpellFeedback("cat", "cae", 2)).toContain("第 3 个字母");
    expect(getEnglishSpellFeedback("cat", "cae", 2)).toContain("重新拼");
  });
});
