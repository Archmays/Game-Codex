import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Hanzi V2 STEP 04 child-first observation copy", () => {
  it("uses the exact neutral opening and immediate-stop copy", () => {
    const observer = read("apps/hanzi-v2-step04-observer/index.ts");
    const overlay = read("games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts");
    expect(observer).toContain("这里有一段小冒险，你可以自己看看。想停随时可以停。");
    expect(overlay).toContain("先回营地休息，找到的汉字都还在。");
    expect(overlay).toContain("不需要完成，可以关闭这个窗口。");
  });

  it("keeps optional choices skippable, unscored, and separate from learning claims", () => {
    const cards = read("apps/hanzi-v2-step04-observer/optional-cards.ts");
    expect(cards).toContain("结束或停止后 · 可跳过");
    expect(cards).toContain("不评分");
    expect(cards).toContain("“马上再玩”不等于学习");
    expect(cards).toContain("“先不玩了”也不等于失败");
    expect(cards).toContain("你最想再看哪一段？");
    expect(cards).toContain("有没有哪一处让你不知道发生了什么或不舒服？");
    expect(cards).not.toContain("你学会了吗");
  });

  it("codifies parent non-answering, no continuous think-aloud, no profiling, and no synthetic child result", () => {
    const skill = read(".agents/skills/child-first-use-observation/SKILL.md");
    expect(skill).toMatch(/Agent or Playwright activity.*cannot replace a child/u);
    expect(skill).toContain("without continuous Think Aloud");
    expect(skill).toContain("Do not collect names, ages, schools");
    expect(skill).toContain("Do not record audio, video, photographs");
    expect(skill).toContain("Do not upload or make remote requests");
    expect(skill).toContain("Never turn one session into a claim about learning");
    expect(skill).toContain("never present them as a real child result");
    expect(skill).toContain("Never reveal the correct card, component, slot, or next answer");
  });

  it("does not expose answers, debug, identity strings, or parent export/reset chrome in child-first mode", () => {
    const main = read("src/main.ts");
    const overlay = read("games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts");
    const settings = read("games/hanzi-radical-battle/v2/golden-slice/ui/SettingsOverlay.ts");
    expect(main).toContain("validateChildFirstUseSessionRoute");
    expect(overlay).toContain('data-child-first-use="${String(Boolean(options.childFirstUse))}"');
    expect(overlay).toContain('options.childFirstUse ? "" : state.seed');
    expect(overlay).toContain('state.mode === "review" ? parentDebugOverlayMarkup(state) : ""');
    expect(settings).toContain('options.childFirstUse ? ""');
    expect(settings).toContain("家长导出本机试玩记录");
    expect(settings).toContain("家长清除营地记录");
  });

  it("keeps both observer surfaces answer-neutral and fixture child chrome unmistakably synthetic", () => {
    const observer = read("apps/hanzi-v2-step04-observer/index.ts");
    const compact = read("docs/hanzi-radical-battle-v2/step-04/05-COMPACT-OBSERVER-SHEET.html");
    const overlay = read("games/hanzi-radical-battle/v2/golden-slice/ui/GoldenSliceOverlay.ts");
    for (const surface of [observer, compact]) {
      expect(surface).toContain("注意到第一次合字关系");
      expect(surface).toContain("注意到第二种结构变化");
      expect(surface).not.toContain("日/月 → 明");
      expect(surface).not.toMatch(/左右(?:到|变)上下/u);
    }
    expect(overlay).toContain("SYNTHETIC_TOOLING_TEST_ONLY · NO CHILD DATA");
  });
});
