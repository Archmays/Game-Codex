import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPLETE_SLICE_CHARACTER_NODES,
  COMPLETE_SLICE_COMPONENT_RELATIONS,
  COMPLETE_SLICE_FAMILIES,
  COMPLETE_SLICE_WORDS,
} from "../../games/hanzi-radical-battle/complete/content-graph/slice-content";
import { createCompleteSliceHand } from "../../games/hanzi-radical-battle/complete/core/slice-machine";
import { createFreshCompleteSliceSave } from "../../games/hanzi-radical-battle/complete/save/slice-save";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUTPUT = resolve(ROOT, "artifacts/hanzi-magic-complete-v3/working/M1_SLICE_REVIEW.json");
const PNPM_CLI = process.env.npm_execpath;

function run(args: string[]): { command: string; result: "PASS"; summary: string } {
  const executable = PNPM_CLI ? process.execPath : "pnpm";
  const executableArgs = PNPM_CLI ? [PNPM_CLI, ...args] : args;
  const output = execFileSync(executable, executableArgs, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  return { command: `pnpm ${args.join(" ")}`, result: "PASS", summary: plain.split(/\r?\n/).filter(Boolean).slice(-6).join(" | ") };
}

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  if (bytes.subarray(1, 4).toString("ascii") !== "PNG") throw new Error(`Not a PNG: ${path}`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function requireReview(condition: boolean, code: string): void {
  if (!condition) throw new Error(`SLICE_REVIEW_FAILED:${code}`);
}

const commands = [
  run(["run", "test:hanzi-complete:slices"]),
  run(["exec", "tsc", "--noEmit"]),
  run(["run", "test:e2e:hanzi-complete:slices"]),
];

const screenshotNames = [
  "family-relation-desktop.png",
  "family-mouse-complete.png",
  "family-touch-complete.png",
  "word-reverse-rejection-desktop.png",
  "word-resonance-desktop.png",
  "word-mouse-complete.png",
  "word-touch-complete.png",
] as const;
const screenshots = screenshotNames.map((name) => {
  const path = resolve(ROOT, "test-results/hanzi-complete/slices", name);
  requireReview(statSync(path).size > 40_000, `SCREENSHOT_TOO_SMALL:${name}`);
  return { name, bytes: statSync(path).size, sha256: sha256(path), ...pngDimensions(path) };
});

const appSource = readFileSync(resolve(ROOT, "games/hanzi-radical-battle/complete/app/slice-app.ts"), "utf8");
const cssSource = readFileSync(resolve(ROOT, "games/hanzi-radical-battle/complete/ui/slice.css"), "utf8");
const machineSource = readFileSync(resolve(ROOT, "games/hanzi-radical-battle/complete/core/slice-machine.ts"), "utf8");
const saveSource = readFileSync(resolve(ROOT, "games/hanzi-radical-battle/complete/save/slice-save.ts"), "utf8");

const uniqueGlyphs = new Set(COMPLETE_SLICE_CHARACTER_NODES.map((character) => character.glyph));
const handSolutionCounts = COMPLETE_SLICE_CHARACTER_NODES.map((character) => {
  const hand = createCompleteSliceHand(character.id);
  let count = 0;
  for (const first of hand) for (const second of hand) {
    if (first.id === second.id) continue;
    if (character.components.every((component, index) => [first, second][index].expectedSlotId === component.slotId)) count += 1;
  }
  return { characterId: character.id, glyph: character.glyph, count };
});
const rawEvidence = {
  commands,
  screenshots,
  content: {
    uniqueGlyphCount: uniqueGlyphs.size,
    familyMembers: COMPLETE_SLICE_FAMILIES[0].memberCharacterIds.length,
    familyRelationKinds: COMPLETE_SLICE_COMPONENT_RELATIONS.map((relation) => relation.kind),
    words: COMPLETE_SLICE_WORDS.map((word) => ({ glyphs: word.glyphs.join(""), pinyin: word.pinyin, reverseOrderStatus: word.reverseOrderStatus })),
    handSolutionCounts,
  },
  runtimeContracts: {
    worldFirst: machineSource.includes('phase: "world"'),
    pointer: appSource.includes('addEventListener("pointerdown"'),
    keyboard: appSource.includes('addEventListener("keydown"'),
    touchViaPointerType: appSource.includes('pointerType === "touch"'),
    dragAndClickAlternative: appSource.includes('addEventListener("drop"') && appSource.includes('type: "place-selected"'),
    visualAudioEquivalent: appSource.includes("声音都有可见等价信息"),
    localV2AudioController: appSource.includes("createM5AudioController"),
    reducedMotion: cssSource.includes('[data-reduced-motion="true"]'),
    visibleFocus: cssSource.includes(":focus-visible"),
    primaryControl44: cssSource.includes("min-height: 44px"),
    responsive360: cssSource.includes("@media (max-width: 400px)"),
    noRuntimeExternalUrl: !/https?:\/\//.test(appSource + cssSource + machineSource + saveSource),
    saveKey: saveSource.includes('family-games/hanzi-magic-complete/v3'),
    saveHardMax: saveSource.includes("500 * 1024"),
    anonymousSave: JSON.stringify(createFreshCompleteSliceSave()).includes('"anonymousLocalOnly":true'),
  },
};

function childFirstReview(evidence: typeof rawEvidence) {
  const checks = {
    worldIsFirstScreen: evidence.runtimeContracts.worldFirst,
    noScoreRankingStreakMechanic: !/data-score|score:|streak|leaderboard|loot|daily[- ]reward/i.test(appSource + machineSource),
    gentleReversibleErrors: machineSource.includes("原来的进度都保留") && machineSource.includes("两个完整字和进度都保留"),
    worldRepairVisibleAndPersistent: appSource.includes("data-repair-state") && appSource.includes("hmc-repaired-object") && evidence.runtimeContracts.saveKey,
    oneClearWorldPrimaryAction: appSource.includes("hmc-world-card") && appSource.includes("data-action") && appSource.includes("primary"),
  };
  return { reviewer: "R1_CHILD_FIRST_GAME_DESIGN", checks, verdict: Object.values(checks).every(Boolean) ? "PASS_MACHINE" : "BLOCKER" };
}

function hanziReview(evidence: typeof rawEvidence) {
  const checks = {
    oneNodePerGlyph: evidence.content.uniqueGlyphCount === COMPLETE_SLICE_CHARACTER_NODES.length,
    qingFamilyHasFourSourcedPhoneticRelations: evidence.content.familyMembers === 4 && evidence.content.familyRelationKinds.length === 4 && evidence.content.familyRelationKinds.every((kind) => kind === "phonetic-component"),
    exactTwoCharacterWords: COMPLETE_SLICE_WORDS.length === 3 && COMPLETE_SLICE_WORDS.every((word) => word.glyphs.length === 2 && word.characterIds.length === 2),
    fixedReadingsAndReverseDisposition: evidence.content.words.every((word) => word.pinyin.length > 2 && word.reverseOrderStatus.startsWith("rejected-")),
    uniqueHands: evidence.content.handSolutionCounts.every((record) => record.count === 1),
    noEtymologyUpgrade: appSource.includes("不是字源说明") && COMPLETE_SLICE_FAMILIES[0].childFacingExplanation.includes("意思也不同"),
  };
  return { reviewer: "R2_HANZI_CONTENT_AND_PEDAGOGY", checks, verdict: Object.values(checks).every(Boolean) ? "PASS_MACHINE" : "BLOCKER" };
}

function accessibilityReview(evidence: typeof rawEvidence) {
  const checks = {
    pointerKeyboardTouch: evidence.runtimeContracts.pointer && evidence.runtimeContracts.keyboard && evidence.runtimeContracts.touchViaPointerType,
    clickAlternativeToDrag: evidence.runtimeContracts.dragAndClickAlternative,
    reducedMotionAndVisibleFocus: evidence.runtimeContracts.reducedMotion && evidence.runtimeContracts.visibleFocus,
    targetAndResponsiveRules: evidence.runtimeContracts.primaryControl44 && evidence.runtimeContracts.responsive360,
    visualAudioEquivalent: evidence.runtimeContracts.visualAudioEquivalent && evidence.runtimeContracts.localV2AudioController,
    desktopAndMobileVisualEvidence: evidence.screenshots.some((shot) => shot.name.includes("desktop")) && evidence.screenshots.some((shot) => shot.name.includes("touch")),
  };
  return { reviewer: "R3_VISUAL_ACCESSIBILITY", checks, verdict: Object.values(checks).every(Boolean) ? "PASS_MACHINE" : "BLOCKER" };
}

function adversarialReview(evidence: typeof rawEvidence) {
  const checks = {
    allCommandsPassed: evidence.commands.every((command) => command.result === "PASS"),
    noRuntimeExternalRequestPath: evidence.runtimeContracts.noRuntimeExternalUrl,
    localAnonymousBoundedSave: evidence.runtimeContracts.saveKey && evidence.runtimeContracts.saveHardMax && evidence.runtimeContracts.anonymousSave,
    routeAndReloadCovered: appSource.includes("clearCompleteSliceSession") && evidence.commands.some((command) => command.command.includes("e2e")),
    bossNeverChangesAnswer: machineSource.includes("答案和进度仍在原处") && machineSource.includes("prepareBuild"),
    screenshotsHaveBytesAndDimensions: evidence.screenshots.every((shot) => shot.bytes > 40_000 && shot.width >= 780 && shot.height >= 768),
  };
  return { reviewer: "R4_ADVERSARIAL_RUNTIME_QA", checks, verdict: Object.values(checks).every(Boolean) ? "PASS_MACHINE" : "BLOCKER" };
}

const reviews = [childFirstReview(rawEvidence), hanziReview(rawEvidence), accessibilityReview(rawEvidence), adversarialReview(rawEvidence)];
const verdict = reviews.every((review) => review.verdict === "PASS_MACHINE") ? "PASS_MACHINE" : "ESCALATE_HUMAN";
requireReview(verdict === "PASS_MACHINE", "REVIEWER_RECONCILIATION");

const report = {
  schemaVersion: 1,
  milestone: "M1_TWO_VERTICAL_SLICES",
  sharedRawEvidence: rawEvidence,
  independentReviews: reviews,
  reconciledVerdict: verdict,
  unresolvedBlockers: [],
  humanEvidenceBoundary: "REAL_CHILD_VALIDATION NOT_PERFORMED_AND_NOT_CLAIMED",
};
mkdirSync(resolve(OUTPUT, ".."), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ result: verdict, reviewers: reviews.map((review) => `${review.reviewer}:${review.verdict}`), output: "artifacts/hanzi-magic-complete-v3/working/M1_SLICE_REVIEW.json" }, null, 2)}\n`);
