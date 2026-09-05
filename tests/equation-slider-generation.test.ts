import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { auditEquationSliderLevels } from "../games/equation-slider/level-audit";
import {
  EQUATION_SLIDER_V3_LEVELS,
  GENERATED_V3_LEVELS,
  HAND_AUTHORED_GOLD_TEMPLATES,
  HAND_AUTHORED_V3_GOLD_LEVELS
} from "../games/equation-slider/levels/v3/catalog";
import {
  buildCompleteV3Catalog,
  generateLevelsFromGold,
  V3_GENERATOR_VERSION
} from "../games/equation-slider/levels/v3/generator";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import { applyGameplayPilot12 } from "../games/equation-slider/levels/v3/gameplay-pilot-12";
import {
  buildGeneratedAudit,
  createMaterializedFiles
} from "../games/equation-slider/tools/generate-levels";
import type { PublishedEquationSliderLevel } from "../games/equation-slider/types";

const CHAPTER_FILES = [
  "chapter-1-addition.json",
  "chapter-2-add-sub.json",
  "chapter-3-mul-div.json",
  "chapter-4-reasoning.json"
] as const;

describe("equation slider V3 deterministic generation", () => {
  it("regenerates the 160 derived definitions byte-for-byte from the 40 gold templates", () => {
    const first = generateLevelsFromGold(HAND_AUTHORED_GOLD_TEMPLATES);
    const second = generateLevelsFromGold(HAND_AUTHORED_GOLD_TEMPLATES);

    expect(first).toHaveLength(160);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(sortByCatalogOrder(first)
      .filter((level) => level.id !== "es-1-11" && level.id !== "es-1-12")
      .map(withoutInitialStateProof)).toEqual(
      GENERATED_V3_LEVELS.map(withoutInitialStateProof)
    );
    expect(
      first.every((level) =>
        level.provenance.kind === "generated-from-gold"
        && level.provenance.generatorVersion === V3_GENERATOR_VERSION
      )
    ).toBe(true);
  }, 120_000);

  it("recomposes the canonical 200-level catalog from gold and generated levels", () => {
    const recomposed = [
      ...HAND_AUTHORED_V3_GOLD_LEVELS,
      ...GENERATED_V3_LEVELS
    ].sort((left, right) =>
      left.chapterId.localeCompare(right.chapterId) || left.order - right.order
    );

    expect(recomposed).toEqual(EQUATION_SLIDER_V3_LEVELS);
  }, 120_000);

  it("rebuilds the complete diversified catalog byte-for-byte", () => {
    const rebuilt = applyGameplayPilot12(buildCompleteV3Catalog(
      HAND_AUTHORED_GOLD_TEMPLATES,
      FIRST_GOLD_LEVEL
    ));

    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(EQUATION_SLIDER_V3_LEVELS));
  }, 120_000);

  it("creates four 50-level chapter artifacts plus the audit without writing files", () => {
    const files = createMaterializedFiles();
    expect(files).toHaveLength(5);
    expect(files.map((file) => basename(file.path))).toEqual([
      ...CHAPTER_FILES,
      "generated-audit.json"
    ]);

    for (let chapterIndex = 0; chapterIndex < CHAPTER_FILES.length; chapterIndex += 1) {
      const filename = CHAPTER_FILES[chapterIndex];
      const artifact = files.find((file) => basename(file.path) === filename);
      expect(artifact, filename).toBeDefined();

      const parsed = JSON.parse(artifact!.content) as PublishedEquationSliderLevel[];
      const expected = EQUATION_SLIDER_V3_LEVELS.filter(
        (level) => level.chapterId === `chapter-${chapterIndex + 1}`
      );
      expect(parsed, filename).toHaveLength(50);
      expect(parsed, filename).toEqual(expected);
      expect(normalize(readFileSync(artifact!.path, "utf8")), filename)
        .toBe(normalize(artifact!.content));
    }

    const auditArtifact = files.find(
      (file) => basename(file.path) === "generated-audit.json"
    );
    expect(auditArtifact).toBeDefined();
    const parsedAudit = JSON.parse(auditArtifact!.content) as ReturnType<
      typeof auditEquationSliderLevels
    >;
    expect(parsedAudit).toEqual(buildGeneratedAudit(EQUATION_SLIDER_V3_LEVELS));
    expect(parsedAudit.passes).toBe(true);
    expect(normalize(readFileSync(auditArtifact!.path, "utf8")))
      .toBe(normalize(auditArtifact!.content));
  }, 120_000);
});

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function withoutInitialStateProof(level: PublishedEquationSliderLevel): unknown {
  const {
    initialIndexes: _initialIndexes,
    analysis: _analysis,
    ...authoredAndGeneratedDefinition
  } = level;
  return authoredAndGeneratedDefinition;
}

function sortByCatalogOrder(
  levels: readonly PublishedEquationSliderLevel[]
): PublishedEquationSliderLevel[] {
  return [...levels].sort((left, right) =>
    left.chapterId.localeCompare(right.chapterId) || left.order - right.order
  );
}
