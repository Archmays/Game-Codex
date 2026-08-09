import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STEP06_CANONICAL_ORIGIN, verifyStep06ProgressContinuity } from "../apps/my-game-world/second-use/progress-continuity";
import { GOLDEN_SLICE_SAVE_KEY } from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { createStep06SyntheticCompleteSave } from "../apps/my-game-world/second-use/progress-continuity";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi V2 STEP 06 canonical origin", () => {
  it("accepts exactly 127.0.0.1:5175", () => {
    const storage = new MemoryStorage();
    storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(createStep06SyntheticCompleteSave()));
    expect(verifyStep06ProgressContinuity(STEP06_CANONICAL_ORIGIN, storage).ok).toBe(true);
    expect(verifyStep06ProgressContinuity("http://localhost:5175", storage)).toMatchObject({ ok: false, reason: "WRONG_ORIGIN" });
    expect(verifyStep06ProgressContinuity("http://127.0.0.1:5173", storage)).toMatchObject({ ok: false, reason: "WRONG_ORIGIN" });
    expect(verifyStep06ProgressContinuity("http://127.0.0.1:5176", storage)).toMatchObject({ ok: false, reason: "WRONG_ORIGIN" });
  });

  it("binds reusable family Vite process identity to the exact repository root", () => {
    const root = resolve(import.meta.dirname, "..");
    const common = readFileSync(resolve(root, "tools/my-game-world/MyGameWorldTools.Common.ps1"), "utf8");
    const start = readFileSync(resolve(root, "tools/my-game-world/START_MY_GAME_WORLD.ps1"), "utf8");
    expect(common).toContain("$hasExplicitRoot");
    expect(common).toContain("-RepositoryRoot $RepositoryRoot");
    expect(start).toContain("-ArgumentList @($runtime.ViteCliPath, $repositoryRoot");
    expect(start).toContain("-WorkingDirectory $repositoryRoot");
  });
});
