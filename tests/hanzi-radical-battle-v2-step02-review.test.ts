import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createReviewDraft,
  finalizeReviewDraft,
} from "../apps/hanzi-v2-step02-review/review-schema";

const repositoryRoot = resolve(import.meta.dirname, "..");
const finishScript = join(repositoryRoot, "tools", "hanzi-v2-step02", "FINISH_STEP_02_REVIEW.ps1");
// This Windows external-process functional integration test keeps every assertion fail-closed; the ordinary unit-test budget is not a product performance SLA.
const windowsPackageIntegrationTimeoutMs = 15_000;

function completeReviewFixture() {
  const draft = createReviewDraft();
  draft.decisions.corePilot.decision = "ACCEPT";
  draft.decisions.visualDirection.selection = "A";
  draft.decisions.characters.forEach((item) => (item.decision = "ACCEPT"));
  draft.decisions.storyboard.forEach((item) => (item.decision = "ACCEPT"));
  draft.decisions.authorizeStep03 = "NOT_YET";
  return finalizeReviewDraft(draft);
}

function runFinish(feedbackPath: string, outputRoot: string) {
  return spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      finishScript,
      "-FeedbackPath",
      feedbackPath,
      "-OutputRoot",
      outputRoot,
      "-NoStopServer",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
}

describe("Hanzi V2 STEP 02 FINISH identity gate", () => {
  it.runIf(process.platform === "win32")(
    "accepts the current exported identity and packages but rejects fabricated IDs and hashes",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "hanzi-step02-finish-"));
      try {
        const validFeedbackPath = join(tempRoot, "valid.json");
        const validOutput = join(tempRoot, "valid-output");
        await writeFile(validFeedbackPath, `${JSON.stringify(completeReviewFixture(), null, 2)}\n`, "utf8");
        const valid = runFinish(validFeedbackPath, validOutput);
        expect(valid.status, `${valid.stdout}\n${valid.stderr}`).toBe(0);
        expect(valid.stdout).toContain("All required decisions are valid.");
        expect(existsSync(join(validOutput, "STEP-02_PARENT_REVIEW_RETURN_TO_CHATGPT.zip"))).toBe(true);

        const fabricated = structuredClone(completeReviewFixture());
        fabricated.pilotIdentity.anchorCharacterId = "fabricated" as "ming";
        fabricated.decisions.characters[0].itemId = "fabricated-character";
        fabricated.decisions.characters[0].revisionHash = "fnv1a:00000000";
        fabricated.decisions.storyboard[0].revisionHash = "fnv1a:00000000";
        const fabricatedFeedbackPath = join(tempRoot, "fabricated.json");
        const fabricatedOutput = join(tempRoot, "fabricated-output");
        await writeFile(fabricatedFeedbackPath, `${JSON.stringify(fabricated, null, 2)}\n`, "utf8");
        const invalid = runFinish(fabricatedFeedbackPath, fabricatedOutput);
        expect(invalid.status, `${invalid.stdout}\n${invalid.stderr}`).toBe(0);
        const summary = await readFile(join(fabricatedOutput, "review-summary.md"), "utf8");
        expect(summary).toContain("INVALID_OR_INCOMPLETE");
        expect(summary).toContain("pilotIdentity.anchorCharacterId must match current identity");
        expect(summary).toContain("itemId set must exactly match the current 15-character identity");
        expect(summary).toContain("Storyboard 'story-camp' revisionHash must match current identity");
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
        expect(existsSync(tempRoot), "Windows package test temp root must be removed").toBe(false);
      }
    },
    windowsPackageIntegrationTimeoutMs,
  );
});
