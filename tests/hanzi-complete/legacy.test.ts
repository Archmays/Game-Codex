import { describe, expect, test } from "vitest";
import { APP_ROUTE_QUERY_REGISTRY, resolveAppRoute } from "../../src/app-route";
import { CHAPTER_ONE_CHARACTERS } from "../../games/hanzi-radical-battle/v2/chapter-one/characters";
import { CHAPTER_ONE_HANDS } from "../../games/hanzi-radical-battle/v2/chapter-one/hands";
import { M3_BUILD_ABILITIES } from "../../games/hanzi-radical-battle/v2/chapter-one/builds";
import { M5_BEHAVIORS, M5_BOSSES } from "../../games/hanzi-radical-battle/v2/chapter-one/m5-content";
import { simulateM3Run } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-machine";
import { replayCompleteChapterOneRun } from "../../games/hanzi-radical-battle/complete/chapters/chapter-one-adapter/engine";

describe("complete-edition legacy compatibility boundary", () => {
  test("keeps complete, V2, V1, classic and world route precedence", () => {
    expect(APP_ROUTE_QUERY_REGISTRY.slice(0, 3).map((route) => route.queryValue)).toEqual(["hanzi-magic-complete", "hanzi-v2-chapter-one", "hanzi-v2-v1"]);
    expect(resolveAppRoute(new URLSearchParams("play=hanzi-magic-complete&hub=classic&world=my-game-world"))).toEqual({ kind: "play", explicit: true });
    expect(resolveAppRoute(new URLSearchParams("play=hanzi-v2-chapter-one&hub=classic"))).toEqual({ kind: "play", explicit: true });
    expect(resolveAppRoute(new URLSearchParams("play=hanzi-v2-v1&world=my-game-world"))).toEqual({ kind: "play", explicit: true });
  });

  test("references the canonical V2 content instead of creating a parallel copy", () => {
    expect(CHAPTER_ONE_CHARACTERS).toHaveLength(36);
    expect(CHAPTER_ONE_HANDS).toHaveLength(108);
    expect(M3_BUILD_ABILITIES).toHaveLength(18);
    expect(M5_BEHAVIORS).toHaveLength(9);
    expect(M5_BOSSES).toHaveLength(4);
    const legacy = simulateM3Run("adapter-exact", "ink-companion");
    expect(replayCompleteChapterOneRun("adapter-exact", "ink-companion", legacy.actions).state).toEqual(legacy.finalState);
  });
});
