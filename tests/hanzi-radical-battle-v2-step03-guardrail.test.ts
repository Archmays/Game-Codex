import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createReviewDraft,
  finalizeReviewDraft,
} from "../apps/hanzi-v2-step03-review/review-schema";

const repositoryRoot = resolve(import.meta.dirname, "..");
const finishLauncher = join(repositoryRoot, "tools", "hanzi-v2-step03", "FINISH_STEP_03_REVIEW.cmd");
const observerLauncher = join(repositoryRoot, "tools", "hanzi-v2-step03", "START_CHILD_FIRST_USE_OBSERVER.cmd");

function completeReviewFixture(authorizeChildFirstUse: "YES" | "NOT_YET" = "YES") {
  const draft = createReviewDraft();
  draft.decisions.items.forEach((item) => {
    item.decision = "ACCEPT";
    item.notes = `Reviewed ${item.itemId} locally.`;
  });
  draft.decisions.characters.forEach((character) => {
    character.decision = "ACCEPT";
    character.notes = `Reviewed ${character.characterId} locally.`;
  });
  draft.abilityDecisions["guardian-light"] = "ACCEPT";
  draft.abilityDecisions["star-path"] = "ACCEPT";
  draft.abilityDecisions["ink-echo"] = "ACCEPT";
  Object.keys(draft.assetDecisions).forEach((assetId) => {
    draft.assetDecisions[assetId as keyof typeof draft.assetDecisions] = "ACCEPT";
  });
  draft.audioDecision = "ACCEPT CURRENT CANDIDATE";
  draft.authorizeChildFirstUse = authorizeChildFirstUse;
  draft.generalNotes = "Local observation is authorized only under the fixed child-first protocol.";
  return finalizeReviewDraft(draft);
}

function runFinish(feedbackPath: string, outputRoot: string) {
  const command = `call ${finishLauncher} -FeedbackPath ${feedbackPath} -OutputRoot ${outputRoot} -FixtureMode -NoStopServer`;
  return spawnSync(
    "cmd.exe",
    ["/d", "/s", "/c", command],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
}

describe("Hanzi V2 STEP 03 parent-review and child-use guardrail", () => {
  it.runIf(process.platform === "win32")(
    "packages a temporary valid fixture but reports an identity-mismatched fixture without touching canonical feedback",
    async () => {
      const tempRoot = await mkdtemp(join(tmpdir(), "hanzi-step03-guardrail-"));
      try {
        const validFeedback = join(tempRoot, "valid.json");
        const validOutput = join(tempRoot, "valid-output");
        await writeFile(validFeedback, `${JSON.stringify(completeReviewFixture(), null, 2)}\n`, "utf8");

        const valid = runFinish(validFeedback, validOutput);
        expect(valid.status, `${valid.stdout}\n${valid.stderr}`).toBe(0);
        expect(valid.stdout).toContain("All required STEP 03 parent-review fields and revision identities are valid.");
        expect(existsSync(join(validOutput, "STEP-03_PARENT_REVIEW_RETURN_TO_CHATGPT.zip"))).toBe(true);
        const validManifest = JSON.parse(await readFile(join(validOutput, "return-package-manifest.json"), "utf8"));
        expect(validManifest.feedbackValidation).toEqual({ valid: true, errorCount: 0 });
        expect(await readFile(join(validOutput, "child-first-use-gate-summary.md"), "utf8")).toContain("AUTHORIZED_FOR_LOCAL_OBSERVATION_ONLY");
        const packageNames = validManifest.files
          .flatMap((entry: unknown) => Array.isArray(entry) ? entry : [entry])
          .map((entry: unknown) => (entry as { name: string }).name);
        expect(packageNames).toEqual(expect.arrayContaining([
          "feedback",
          "review-identity",
          "golden-slice-identity",
          "final-golden-manifest",
          "theme-c-asset-manifest",
          "audio-and-voice-audit",
          "child-first-use-gate-summary",
          "screenshot-index",
          "commit-sha",
        ]));

        const mismatched = structuredClone(completeReviewFixture()) as any;
        mismatched.goldenSliceIdentity = {
          ...mismatched.goldenSliceIdentity,
          goldenSliceManifestRevisionHash: "fnv1a:00000000",
        };
        const invalidFeedback = join(tempRoot, "mismatched.json");
        const invalidOutput = join(tempRoot, "invalid-output");
        await writeFile(invalidFeedback, `${JSON.stringify(mismatched, null, 2)}\n`, "utf8");

        const invalid = runFinish(invalidFeedback, invalidOutput);
        expect(invalid.status, `${invalid.stdout}\n${invalid.stderr}`).toBe(0);
        const summary = await readFile(join(invalidOutput, "review-summary.md"), "utf8");
        expect(summary).toContain("INVALID_OR_INCOMPLETE");
        expect(summary).toContain("goldenSliceIdentity must exactly match the current STEP 03 review identity and revision snapshots.");
        expect(await readFile(join(invalidOutput, "child-first-use-gate-summary.md"), "utf8")).toContain("Gate status: DENY");

        const notYetFeedback = join(tempRoot, "not-yet.json");
        const notYetOutput = join(tempRoot, "not-yet-output");
        await writeFile(notYetFeedback, `${JSON.stringify(completeReviewFixture("NOT_YET"), null, 2)}\n`, "utf8");
        const notYet = runFinish(notYetFeedback, notYetOutput);
        expect(notYet.status, `${notYet.stdout}\n${notYet.stderr}`).toBe(0);
        expect(await readFile(join(notYetOutput, "child-first-use-gate-summary.md"), "utf8")).toContain("Gate status: DENY");
        expect(resolve(validOutput)).not.toBe(resolve(repositoryRoot, "artifacts", "hanzi-radical-battle-v2", "step-03"));
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    20_000,
  );

  it.runIf(process.platform === "win32")(
    "fails closed without canonical feedback and never opens the child route",
    () => {
      const canonicalFeedback = join(repositoryRoot, "artifacts", "hanzi-radical-battle-v2", "step-03", "review", "STEP-03_PARENT_REVIEW_FEEDBACK.json");
      if (existsSync(canonicalFeedback)) return;
      const observer = spawnSync("cmd.exe", ["/d", "/s", "/c", `call ${observerLauncher} -NoBrowser`], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });
      expect(observer.status).not.toBe(0);
      expect(`${observer.stdout}\n${observer.stderr}`).toContain("No child route or observation sheet was opened.");
    },
    20_000,
  );
});
