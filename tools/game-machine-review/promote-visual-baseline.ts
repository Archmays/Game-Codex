import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_MACHINE_REVIEW_OUTPUT,
  createBaselinePromotionRecord,
  deriveCommandGateResultsDocument,
  findLatestCommandRunRecordFiles,
  validateCommandGateResultsForFinalizer,
  type BaselinePromotionRecord,
  type CommandGateResultsDocument,
} from "./command-evidence";
import { computeMachineReviewSourceTreeSha256 } from "./source-identity";

export interface PromoteVisualBaselineOptions {
  readonly workspaceRoot?: string;
  readonly outputDirectory?: string;
}

export interface PromoteVisualBaselineResult {
  readonly promotion: BaselinePromotionRecord;
  readonly commandGates: CommandGateResultsDocument;
  readonly promotionPath: string;
  readonly commandGatesPath: string;
}

export function promoteVisualBaseline(options: PromoteVisualBaselineOptions = {}): PromoteVisualBaselineResult {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const outputDirectory = resolve(workspaceRoot, options.outputDirectory ?? DEFAULT_MACHINE_REVIEW_OUTPUT);
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const validationOptions = { workspaceRoot, outputDirectory, sourceTreeSha256 };
  const commandRunRecordFiles = findLatestCommandRunRecordFiles(validationOptions);
  const promotion = createBaselinePromotionRecord({
    ...validationOptions,
    visualBaselineUpdateRecordFile: commandRunRecordFiles["visual-baseline-update"],
    visualNoUpdateRecordFile: commandRunRecordFiles["visual-no-update"],
  });
  const promotionAbsolute = resolve(outputDirectory, "hard-gates", "BASELINE-PROMOTION.json");
  const promotionPath = relative(workspaceRoot, promotionAbsolute).replaceAll("\\", "/");
  mkdirSync(dirname(promotionAbsolute), { recursive: true });
  writeFileSync(promotionAbsolute, `${JSON.stringify(promotion, null, 2)}\n`, "utf8");

  const commandGates = deriveCommandGateResultsDocument({
    ...validationOptions,
    commandRunRecordFiles,
    baselinePromotionFile: promotionPath,
  });
  validateCommandGateResultsForFinalizer(commandGates, validationOptions);
  const commandGatesAbsolute = resolve(outputDirectory, "hard-gates", "COMMAND-GATE-RESULTS.json");
  const commandGatesPath = relative(workspaceRoot, commandGatesAbsolute).replaceAll("\\", "/");
  writeFileSync(commandGatesAbsolute, `${JSON.stringify(commandGates, null, 2)}\n`, "utf8");
  return { promotion, commandGates, promotionPath, commandGatesPath };
}

function main(): void {
  if (process.argv.length !== 2) throw new Error("promote-visual-baseline.ts does not accept caller-supplied status, command, or evidence paths");
  const result = promoteVisualBaseline();
  process.stdout.write(`PASS\n${result.promotionPath}\n${result.commandGatesPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

