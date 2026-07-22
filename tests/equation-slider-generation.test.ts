import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildGeneratedAudit,
  generatePublishedLevels,
  writeMaterializedLevels
} from "../games/equation-slider/tools/generate-levels";
import type { PublishedEquationSliderLevel } from "../games/equation-slider/types";

const filenames = [
  "chapter-1-addition.json",
  "chapter-2-add-sub.json",
  "chapter-3-mul-div.json",
  "chapter-4-reasoning.json"
] as const;

describe("equation slider deterministic generation", () => {
  it("matches the materialized chapter data and audit", () => {
    if (process.env.UPDATE_EQUATION_SLIDER_LEVELS === "1") {
      writeMaterializedLevels(process.cwd());
    }

    const generated = generatePublishedLevels();
    const materialized = filenames.flatMap((filename) => {
      return JSON.parse(readFileSync(resolve("games/equation-slider/levels", filename), "utf8")) as PublishedEquationSliderLevel[];
    });
    const storedAudit = JSON.parse(
      readFileSync(resolve("games/equation-slider/levels/generated-audit.json"), "utf8")
    ) as unknown;

    expect(materialized).toEqual(generated);
    expect(storedAudit).toEqual(buildGeneratedAudit(generated));
  }, 120_000);
});
