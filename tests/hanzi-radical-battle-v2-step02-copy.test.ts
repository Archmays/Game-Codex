import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const banned = ["败北", "还需要多加练习书法", "战斗失败", "你的生命值归零", "做错了", "你还需要练习"];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".css", ".html"].includes(extname(path)) ? [path] : [];
  });
}

describe("Hanzi V2 STEP 02 child-facing copy", () => {
  it("removes all six prohibited phrases from V1 and STEP 02 runtime source", () => {
    const files = [
      join(root, "games", "hanzi-radical-battle", "index.ts"),
      ...sourceFiles(join(root, "games", "hanzi-radical-battle", "v2")),
      ...sourceFiles(join(root, "apps", "hanzi-v2-step02-review")),
    ];
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      for (const phrase of banned) expect(source, `${path}: ${phrase}`).not.toContain(phrase);
    }
  });

  it("keeps the V1 recovery copy warm and progress-preserving", () => {
    const source = readFileSync(join(root, "games", "hanzi-radical-battle", "index.ts"), "utf8");
    expect(source).toContain("先回营地休息一下");
    expect(source).toContain("这次发现的汉字都还在。换个方法再试一次。");
    expect(source).toContain("发现的汉字都还在");
  });

  it("does not introduce pressure, rankings, monetization, or shame into the pilot", () => {
    const runtime = sourceFiles(join(root, "games", "hanzi-radical-battle", "v2"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const runtimeWithoutNoAdsPromise = runtime.replace("无账号、无上传、无广告", "无账号、无上传");
    for (const term of ["leaderboard", "loot box", "daily login", "streak pressure", "FOMO", "付费", "广告"]) {
      expect(runtimeWithoutNoAdsPromise.toLowerCase(), term).not.toContain(term.toLowerCase());
    }
    expect(runtime).toContain("无账号、无上传、无广告");
    expect(runtime).toContain("字灵没有丢");
    expect(runtime).toContain("换个位置看看");
  });
});
