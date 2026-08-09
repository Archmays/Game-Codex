import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WORLD_COPY, WORLD_PRIMARY_COPY } from "../apps/my-game-world/world-copy";

const repositoryRoot = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 05 child-facing world copy", () => {
  it("uses the exact world invitation and three object labels", () => {
    expect(WORLD_COPY).toMatchObject({
      title: "我的游戏世界",
      subtitle: "今天想去哪里？",
      forestTitle: "墨迹森林",
      forestFreshAction: "走进墨迹森林",
      forestReturnAction: "再去墨迹森林",
      spellbookTitle: "四字魔法书",
      treasureTitle: "游戏百宝箱",
    });
  });

  it("keeps adult catalogue language out of the child-facing primary copy", () => {
    for (const forbidden of ["学习", "学科", "年龄", "正确率", "练习目标", "课程", "可玩"]) {
      expect(WORLD_PRIMARY_COPY).not.toContain(forbidden);
    }
    expect(WORLD_PRIMARY_COPY).not.toContain("儿童学习游戏大厅");
  });

  it("uses local procedural marks instead of emoji or external artwork", () => {
    const source = [
      "apps/my-game-world/index.ts",
      "apps/my-game-world/styles.css",
      "apps/my-game-world/phaser/WorldHomeScene.ts",
    ].map((path) => readFileSync(resolve(repositoryRoot, path), "utf8")).join("\n");
    expect(source).not.toMatch(/https?:\/\/|imagegen|openai/iu);
    expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
