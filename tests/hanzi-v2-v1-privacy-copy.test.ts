import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const runtimeFiles = [
  "games/hanzi-radical-battle/v2/v1/app.ts",
  "games/hanzi-radical-battle/v2/v1/machine.ts",
  "games/hanzi-radical-battle/v2/golden-slice/content/adventures.ts",
];

describe("Hanzi Magic V1 privacy and child-copy gate", () => {
  it("contains no external runtime transport, telemetry, account, or child-data collection", () => {
    const source = runtimeFiles.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|telemetry|analytics|login|payment|camera|microphone|getUserMedia/i);
    expect(source).not.toMatch(/<textarea|type=["'](?:text|email|tel|file)["']|contenteditable|FormData\s*\(/i);
    expect(source).toContain("不上传姓名、语音、照片、自由文本或使用记录");
  });

  it("keeps pressure, ranking, shame, random-reward, and etymology claims out of child runtime copy", () => {
    const source = runtimeFiles.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
    for (const banned of ["败北", "做错了", "你还需要练习", "连续登录", "连胜", "排名", "稀有", "抽取概率", "限时领取", "每日任务"]) {
      expect(source, banned).not.toContain(banned);
    }
    expect(source).toContain("不是字源说明");
    expect(source).not.toMatch(/这个字来自|字源是|本义就是/);
  });
});
