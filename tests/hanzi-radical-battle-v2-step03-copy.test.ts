import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GOLDEN_CHILD_COPY } from "../games/hanzi-radical-battle/v2/golden-slice/content/story-copy";

const root = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Could not isolate child source: ${start}`);
  return source.slice(startIndex, endIndex);
}

function quotedValues(source: string): readonly string[] {
  return [...source.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((match) => match[1]);
}

function hanziLength(value: string): number {
  return [...value].filter((character) => /\p{Script=Han}/u.test(character)).length;
}

describe("Hanzi V2 STEP 03 child copy safety", () => {
  const goldenOverlay = read("games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts");
  const childStoryBubbles = quotedValues(between(goldenOverlay, "const STORY_BY_PHASE", "const PRIMARY_ACTIONS"));
  const childPrimaryActions = quotedValues(between(goldenOverlay, "const PRIMARY_ACTIONS", "const BOARD_PHASES"));
  const childCompletionCard = between(goldenOverlay, "function completeMarkup", "function overlayMarkup");
  const childSurface = [
    ...Object.values(GOLDEN_CHILD_COPY),
    ...childStoryBubbles,
    ...childPrimaryActions,
    childCompletionCard,
    read("games/hanzi-radical-battle/v2/golden-slice/ui/StructureBoard.ts"),
    read("games/hanzi-radical-battle/v2/golden-slice/ui/AbilityChoiceOverlay.ts"),
    read("games/hanzi-radical-battle/v2/golden-slice/ui/SpellbookOverlay.ts"),
    read("games/hanzi-radical-battle/v2/golden-slice/ui/SettingsOverlay.ts"),
  ].join("\n");

  it("keeps all prohibited retention, shaming, score, shop, and recommendation terms out of child surfaces", () => {
    const bannedChinese = [
      "失败", "败北", "做错", "练习", "排行榜", "排名", "登录", "连续登录", "每日任务", "连胜", "抽卡", "盲盒", "倒计时", "奖励", "付费", "商店", "稀有度", "推荐", "最佳", "分数", "正确率", "错题",
    ];
    for (const word of bannedChinese) expect(childSurface, word).not.toContain(word);
    for (const word of ["score", "hp", "mp", "shop", "rarity", "recommended", "best", "leaderboard", "daily login", "streak", "loot box", "fomo"]) {
      expect(childSurface).not.toMatch(new RegExp(`\\b${word.replace(" ", "\\s+")}\\b`, "i"));
    }
  });

  it("keeps companion-story bubbles within sixteen Han characters unless explicitly classified as a result-only exception", () => {
    const RESULT_ONLY_BUBBLE_EXCEPTIONS = new Set<string>();
    const bubbles = childStoryBubbles.filter((value) => /\p{Script=Han}/u.test(value));
    expect(bubbles.length).toBeGreaterThan(0);
    for (const bubble of bubbles) {
      expect(hanziLength(bubble) <= 16 || RESULT_ONLY_BUBBLE_EXCEPTIONS.has(bubble), bubble).toBe(true);
    }
  });

  it("keeps the supplied child copy and child markup emoji-free", () => {
    expect(childSurface).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
