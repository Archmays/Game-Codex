import { existsSync, readFileSync } from "node:fs";
import { normalizeRetiredLanguageRoute, RETIRED_LANGUAGE_PLAY_IDS, RETIRED_LANGUAGE_WORLD_IDS } from "../src/app-route";
import { GAME_PORTFOLIO } from "../packages/data/gamePortfolio";
import { KNOWN_SAVE_KEYS } from "../packages/data/saveKeyInventory";

describe("authorized old-language retirement", () => {
  for (const path of ["/", "/Game-Codex/"]) for (const [key, ids] of [["play", RETIRED_LANGUAGE_PLAY_IDS], ["game", RETIRED_LANGUAGE_PLAY_IDS], ["world", RETIRED_LANGUAGE_WORLD_IDS]] as const) {
    for (const id of ids) it(`${path} ${key}=${id} retires conflicting bookmark parameters`, () => {
      const url = new URL(`${path}?hub=classic&world=math-world&${key}=${id}&view=memory&chapter=2&mode=word&station=slider#old`, "https://example.com");
      expect(normalizeRetiredLanguageRoute(url)).toBe(true);
      expect(url.pathname).toBe(path); expect(url.search).toBe("?world=my-game-world&notice=retired-language"); expect(url.hash).toBe("");
      expect(normalizeRetiredLanguageRoute(url)).toBe(false);
    });
  }
  it("preserves current routes and retains retired raw save keys without an old runtime", () => {
    for (const query of ["?play=hanzi-tower-defense", "?world=math-world&station=target", "?world=math-world&station=slider", "?world=my-game-world"]) {
      const url = new URL(query, "https://example.com/Game-Codex/"); expect(normalizeRetiredLanguageRoute(url)).toBe(false); expect(url.search).toBe(query);
    }
    for (const path of ["games/hanzi-radical-battle", "games/english-spell-battle", "games/pinyin-magic-battle", "public/assets/hanzi-radical-battle", "public/assets/english-world"]) expect(existsSync(path), path).toBe(false);
    expect(GAME_PORTFOLIO.map(g=>g.id)).toContain("memory-card");
    for (const key of ["family-games/hanzi-magic-complete/v3", "family-games/english-world/v2", "family-games/equation-slider/progress", "family-games/make-target/progress"]) expect(KNOWN_SAVE_KEYS.some(k=>k.key===key),key).toBe(true);
    const main = readFileSync("src/main.ts","utf8"); expect(main).not.toMatch(/import\([^)]*(hanzi-radical|english-spell|pinyin-magic)/);
  });
});
