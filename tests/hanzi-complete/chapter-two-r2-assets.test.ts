import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { affectedGateCommands } from "../../tools/portfolio/affected-gates";

const root = "assets/images/hanzi-radical-battle/chapter-two/r2";
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));
test("accepted r2 sources and runtime bytes match the reviewed manifest with real alpha", () => {
  expect(manifest.assets).toHaveLength(9);
  expect(readdirSync("public/assets/hanzi-radical-battle/chapter-two/r2").sort()).toEqual(manifest.assets.map((asset: any) => `${asset.name}.webp`).sort());
  for (const asset of manifest.assets) {
    for (const image of [asset.source, asset.runtime]) {
      const bytes = readFileSync(image.file);
      expect(bytes.length).toBe(image.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(image.sha256);
      expect(image.width).toBeGreaterThan(0); expect(image.height).toBeGreaterThan(0);
      if (asset.name !== "corridor-environment") {
        expect(image.hasAlpha).toBe(true); expect(image.transparent).toBeGreaterThan(0); expect(image.borderAbove20).toBe(0);
      }
    }
  }
  expect(readFileSync(`${root}/PROMPTS.md`, "utf8").match(/【ChatGPT image】/g)).toHaveLength(9);
});
test("runtime-only or source-only r2 art changes select the complete chapter browser gate", () => {
  for (const file of ["public/assets/hanzi-radical-battle/chapter-two/r2/lock-body.webp", `${root}/lock-body.png`]) {
    expect(affectedGateCommands([file]).some(gate => gate.args.includes("tests/e2e/hanzi-complete/chapter-two-r2.spec.ts"))).toBe(true);
  }
});
