import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { auditEquationSliderLevels, type EquationSliderLevelAudit } from "../level-audit";
import { EQUATION_SLIDER_V3_LEVELS } from "../levels/v3/catalog";
import { CURRENT_EQUATION_SLIDER_CONTENT_VERSION } from "../levels/v3/gameplay-pilot-12";
import type { PublishedEquationSliderLevel } from "../types";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TOOL_DIR, "../../..");
const LEVELS_DIR = resolve(REPO_ROOT, "games/equation-slider/levels");

const CHAPTER_FILES = [
  "chapter-1-addition.json",
  "chapter-2-add-sub.json",
  "chapter-3-mul-div.json",
  "chapter-4-reasoning.json"
] as const;

export interface MaterializedFile {
  readonly path: string;
  readonly content: string;
}

export function generatePublishedLevels(): readonly PublishedEquationSliderLevel[] {
  return EQUATION_SLIDER_V3_LEVELS;
}

export function buildGeneratedAudit(
  levels: readonly PublishedEquationSliderLevel[] = EQUATION_SLIDER_V3_LEVELS
): EquationSliderLevelAudit {
  return auditEquationSliderLevels(levels, CURRENT_EQUATION_SLIDER_CONTENT_VERSION);
}

export function createMaterializedFiles(): readonly MaterializedFile[] {
  const levels = generatePublishedLevels();
  const audit = buildGeneratedAudit(levels);
  if (!audit.passes) {
    throw new Error(`V3 level audit failed; refusing to materialize ${levels.length} levels`);
  }
  const files: MaterializedFile[] = CHAPTER_FILES.map((filename, chapterIndex) => ({
    path: resolve(LEVELS_DIR, filename),
    content: serialize(levels.filter((level) => level.chapterId === `chapter-${chapterIndex + 1}`))
  }));
  return [
    ...files,
    {
      path: resolve(LEVELS_DIR, "generated-audit.json"),
      content: serialize(audit)
    }
  ];
}

export async function materializeEquationSliderLevels(checkOnly = false): Promise<void> {
  const files = createMaterializedFiles();
  await mkdir(LEVELS_DIR, { recursive: true });
  const drift: string[] = [];
  for (const file of files) {
    if (checkOnly) {
      const current = await readFile(file.path, "utf8").catch(() => "");
      if (normalizeLineEndings(current) !== normalizeLineEndings(file.content)) drift.push(file.path);
      continue;
    }
    await writeFile(file.path, file.content, "utf8");
  }
  if (drift.length > 0) {
    throw new Error(`Materialized V3 level files are stale:\n${drift.join("\n")}`);
  }
  console.log(`${checkOnly ? "Verified" : "Materialized"} ${files.length} V3 level artifacts (${EQUATION_SLIDER_V3_LEVELS.length} levels).`);
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  void materializeEquationSliderLevels(process.argv.includes("--check")).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
