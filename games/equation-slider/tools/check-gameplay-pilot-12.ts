import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInitialBoardSession, transitionBoardSession, type BoardSession } from "../board-state";
import { EQUATION_SLIDER_CONTENT_REVISIONS } from "../content-revisions";
import { EQUATION_SLIDER_V3_LEVELS, HAND_AUTHORED_GOLD_TEMPLATES } from "../levels/v3/catalog";
import { CURRENT_EQUATION_SLIDER_CONTENT_VERSION } from "../levels/v3/gameplay-pilot-12";
import { buildCompleteV3Catalog } from "../levels/v3/generator";
import { FIRST_GOLD_LEVEL } from "../levels/v3/gold-levels";
import {
  enumerateArrangements, evaluateArrangementOutcome, findHintContinuation,
  getMovableReels, solveLevel, validatePublishedLevel
} from "../solver";
import type { MoveDirection, PublishedEquationSliderLevel } from "../types";

export function definitionHash(level: PublishedEquationSliderLevel): string {
  const { analysis: _analysis, ...definition } = level;
  return semanticHash(definition);
}

export function gameplayHash(level: PublishedEquationSliderLevel): string {
  const { analysis: _analysis, provenance: _provenance, learning: _learning, hints: _hints, ...board } = level;
  return semanticHash(board);
}

export function retainedDefinitionHash(levels: readonly PublishedEquationSliderLevel[]): string {
  return semanticHash(levels.filter((level) => !isPilot(level))
    .map((level) => [level.id, definitionHash(level)]));
}

/** Deterministic mathematical evidence; this tool does not perform a playtest. */
export function buildGameplayPilot12Evidence() {
  const before = buildCompleteV3Catalog(HAND_AUTHORED_GOLD_TEMPLATES, FIRST_GOLD_LEVEL);
  const after = EQUATION_SLIDER_V3_LEVELS;
  const originalById = new Map(before.map((level) => [level.id, level]));
  const changedDefinitions = after.filter((level) =>
    definitionHash(level) !== definitionHash(originalById.get(level.id)!)
  ).map((level) => level.id);
  const changedBoards = after.filter((level) =>
    gameplayHash(level) !== gameplayHash(originalById.get(level.id)!)
  ).map((level) => level.id);
  const invalid = after.flatMap((level) => {
    const errors = validatePublishedLevel(level);
    const solved = solveLevel(level);
    return errors.length || solved.status !== "solved"
      ? [{ id: level.id, errors, solveStatus: solved.status }] : [];
  });
  const pilot = after.filter(isPilot).map((level) => {
    const old = originalById.get(level.id)!;
    return {
      id: level.id,
      before: summarize(old),
      after: summarize(level),
      definitionChanged: definitionHash(old) !== definitionHash(level),
      boardChanged: gameplayHash(old) !== gameplayHash(level),
      diagnostics: pairedDiagnostics(old, level)
    };
  });
  return {
    evidenceKind: "ENGINEERING_MATHEMATICS_NOT_UI_BLIND_OR_CHILD_PLAY",
    contentVersion: CURRENT_EQUATION_SLIDER_CONTENT_VERSION,
    limits: [
      "Coverage incidence ignores the actual numbers; equal signatures alone do not prove equally interesting play.",
      "Seeded and cyclic actions are diagnostics, not evidence of child enjoyment or learning.",
      "Before/after use identical action schedules and matched reel indexes; values differ because the boards changed.",
      "A requested column absent from the smaller board is recorded as absent and still consumes one attempt; completion rates across different reel counts are not a fair difficulty score.",
      "Coverage accumulates; a minimum cover set does not impose a unique order or create dead ends."
    ],
    totalLevels: after.length,
    invalid,
    retained188: {
      count: after.filter((level) => !isPilot(level)).length,
      beforeSha256: retainedDefinitionHash(before),
      afterSha256: retainedDefinitionHash(after)
    },
    unchangedIdentityAndOrder: semanticHash(before.map(identity)) === semanticHash(after.map(identity)),
    changedDefinitions,
    changedBoards,
    boardRevisionIds: Object.keys(EQUATION_SLIDER_CONTENT_REVISIONS),
    currentSourceCounts: {
      originalTemplates: HAND_AUTHORED_GOLD_TEMPLATES.length,
      authored: after.filter((level) => level.provenance.kind === "hand-authored-gold").length,
      generated: after.filter((level) => level.provenance.kind === "generated-from-gold").length,
      boardRevisions: changedBoards.length,
      copyOnlyRevisions: changedDefinitions.length - changedBoards.length
    },
    beforeCoverageFamilies: familyGroups(pilot.map((level) => [level.id, level.before.coverageIncidence] as const)),
    afterCoverageFamilies: familyGroups(pilot.map((level) => [level.id, level.after.coverageIncidence] as const)),
    pilot
  };
}

function summarize(level: PublishedEquationSliderLevel) {
  const solved = solveLevel(level);
  return {
    columns: getMovableReels(level).map((reel) => reel.tiles.map((tile) => tile.value)),
    mode: level.mode,
    targets: level.targets.map((target) => target.kind === "value" ? target.value : target.rightExpression),
    initialIndexes: level.initialIndexes,
    initialEquation: evaluateArrangementOutcome(level, level.initialIndexes).expressionText,
    valid: solved.validArrangements.map((arrangement) => ({
      indexes: arrangement.indexes,
      expression: arrangement.expressionText,
      result: arrangement.result
    })),
    minimumCover: solved.minimumCorrectArrangements,
    minimumCoverSetCountCapped: solved.minimumCoverSetCountCapped,
    coverageIncidence: coverageIncidenceSignature(level),
    nativeSolverTrace: solverTrace(level)
  };
}

function solverTrace(level: PublishedEquationSliderLevel) {
  let session = createInitialBoardSession(level);
  const trace = [];
  while (session.present.status !== "complete" && trace.length < 100) {
    const hint = findHintContinuation(level, session.present.indexes,
      session.present.coveredTileIds, session.present.completedTargetIds);
    if (hint?.reelIndex === undefined || hint.direction === undefined) {
      throw new Error(`${level.id}: incomplete live-solver trace`);
    }
    const transition = transitionBoardSession(level, session, {
      type: "commit-move", reelId: hint.reelId!, direction: hint.direction, useFeedbackLock: false
    });
    if (!transition.committed) throw new Error(`${level.id}: rejected live-solver move`);
    session = transition.session;
    trace.push({
      reel: hint.reelIndex + 1, direction: hint.direction,
      equation: transition.outcome!.expressionText, result: transition.outcome!.result,
      newCoverage: transition.newlyCoveredTileIds.length,
      covered: session.present.coveredTileIds.size
    });
  }
  if (session.present.status !== "complete") throw new Error(`${level.id}: solver trace exceeded limit`);
  return trace;
}

function pairedDiagnostics(before: PublishedEquationSliderLevel, after: PublishedEquationSliderLevel) {
  const maximumReels = Math.max(getMovableReels(before).length, getMovableReels(after).length);
  const reference = getMovableReels(before).length === maximumReels ? before : after;
  const initial = enumerateArrangements(reference).find(({ indexes }) =>
    !evaluateArrangementOutcome(before, indexes.slice(0, getMovableReels(before).length)).valid
    && !evaluateArrangementOutcome(after, indexes.slice(0, getMovableReels(after).length)).valid
  )!.indexes;
  const seed = 0x45535_12;
  let random = seed;
  const seeded = Array.from({ length: 48 }, () => {
    random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0;
    const reel = Math.floor(random / 0x1_0000_0000 * maximumReels);
    random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0;
    return { reel, direction: random < 0x8000_0000 ? "up" as const : "down" as const };
  });
  const cycle = Array.from({ length: 48 }, (_, index) => ({
    reel: index % maximumReels, direction: "down" as const
  }));
  return {
    seed, commonInitialIndexes: initial,
    policies: [
      { name: "seeded-visible-input", actions: seeded },
      { name: "repeat-column-cycle", actions: cycle }
    ].map(({ name, actions }) => ({
      name,
      actions: actions.map((action) => `${action.reel + 1}${action.direction === "up" ? "U" : "D"}`),
      before: runDiagnostic(before, initial, actions),
      after: runDiagnostic(after, initial, actions)
    }))
  };
}

function runDiagnostic(
  level: PublishedEquationSliderLevel,
  commonInitial: readonly number[],
  actions: readonly { readonly reel: number; readonly direction: MoveDirection }[]
) {
  const reels = getMovableReels(level);
  const initialIndexes = commonInitial.slice(0, reels.length);
  let session: BoardSession = createInitialBoardSession({ ...level, initialIndexes });
  let absentReelAttempts = 0;
  let noNewSuccesses = 0;
  let firstCompletionAttempt: number | null = null;
  const checkpoints: {
    attempts: number;
    committedMoves: number;
    covered: number;
    required: number;
    targetsHit: number;
    noNewSuccesses: number;
    absentReelAttempts: number;
    firstCompletionAttempt: number | null;
  }[] = [];
  actions.forEach((action, index) => {
    if (!reels[action.reel]) absentReelAttempts += 1;
    else {
      const transition = transitionBoardSession(level, session, {
        type: "commit-move", reelId: reels[action.reel].id,
        direction: action.direction, useFeedbackLock: false
      });
      session = transition.session;
      if (transition.committed && transition.outcome?.valid
        && transition.newlyCoveredTileIds.length === 0 && transition.newlyCompletedTargetIds.length === 0) {
        noNewSuccesses += 1;
      }
      if (firstCompletionAttempt === null && session.present.status === "complete") {
        firstCompletionAttempt = index + 1;
      }
    }
    if (index === 23 || index === 47) {
      checkpoints.push({
        attempts: index + 1, committedMoves: session.present.moveCount,
        covered: session.present.coveredTileIds.size, required: level.requiredTileIds.length,
        targetsHit: session.present.completedTargetIds.size,
        noNewSuccesses, absentReelAttempts, firstCompletionAttempt
      });
    }
  });
  return { initialIndexes, initialEquation: evaluateArrangementOutcome(level, initialIndexes).expressionText, checkpoints };
}

// Normalize the successful tile/target incidence under rail, tile, and target
// renaming. This detects mere number replacement without inventing strategy.
function coverageIncidenceSignature(level: PublishedEquationSliderLevel): string {
  const reels = getMovableReels(level);
  const tilePermutations = permutations([0, 1, 2]);
  const targetPermutations = permutations(level.targets.map((_, index) => index));
  let smallest: string | undefined;
  for (const railOrder of permutations(reels.map((_, index) => index))) {
    const tileMaps: number[][] = [];
    const visit = (depth: number): void => {
      if (depth < reels.length) {
        for (const mapping of tilePermutations) {
          tileMaps[depth] = mapping;
          visit(depth + 1);
        }
        return;
      }
      for (const targetMap of targetPermutations) {
        const value = level.analysis.validArrangements.map((arrangement) => {
          const indexes = railOrder.map((originalRail, newRail) =>
            tileMaps[newRail][arrangement.indexes[originalRail]]).join("");
          const targets = arrangement.satisfiedTargetIds.map((id) =>
            targetMap[level.targets.findIndex((target) => target.id === id)]).sort().join("");
          return `${indexes}:${targets}`;
        }).sort().join("|");
        if (smallest === undefined || value < smallest) smallest = value;
      }
    };
    visit(0);
  }
  return `${level.mode}/${reels.length}/${level.targets.length}/${smallest}`;
}

function permutations(values: readonly number[]): number[][] {
  return values.length === 0 ? [[]] : values.flatMap((value, index) =>
    permutations(values.filter((_, other) => other !== index)).map((rest) => [value, ...rest]));
}

function familyGroups(entries: readonly (readonly [string, string])[]) {
  const groups = new Map<string, string[]>();
  for (const [id, signature] of entries) groups.set(signature, [...(groups.get(signature) ?? []), id]);
  return [...groups.values()];
}

function semanticHash(value: unknown): string {
  const normalize = (item: unknown): unknown => Array.isArray(item) ? item.map(normalize)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)])) : item;
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

function isPilot(level: PublishedEquationSliderLevel): boolean {
  return level.chapterId === "chapter-1" && level.order <= 12;
}

function identity(level: PublishedEquationSliderLevel) {
  return [level.id, level.chapterId, level.stationId, level.order, level.stationOrder];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const destination = resolve("docs/equation-slider/gameplay-pilot-12-math.json");
  const evidence = buildGameplayPilot12Evidence();
  if (evidence.invalid.length || evidence.retained188.beforeSha256 !== evidence.retained188.afterSha256
    || !evidence.unchangedIdentityAndOrder) throw new Error("Pilot scope or mathematics validation failed");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    destination, invalid: evidence.invalid, retained188: evidence.retained188,
    changedBoards: evidence.changedBoards, sourceCounts: evidence.currentSourceCounts
  }));
}
