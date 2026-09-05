import { expect, test, type Page, type TestInfo } from "@playwright/test";

const BOARD = "[data-equation-board]";
const COVERAGE = "[data-coverage-progress]";
const FEEDBACK = ".equation-slider__feedback";
const HINT = ".equation-slider__hint";
const COMPLETION = "[data-completion-card]";

type InputMode = "control" | "tile" | "keyboard" | "drag";
type VisibleMode = "target" | "multi-target" | "equality";

interface PlaytestLevel {
  readonly id: string;
  readonly chapterId: string;
  readonly station: number;
  readonly expectedMode: VisibleMode;
  readonly expectedReels: 2 | 3 | 4 | 5;
  readonly inputMode: InputMode;
  readonly wrongPathProbe?: boolean;
}

interface LevelResult {
  readonly id: string;
  readonly chapterId: string;
  readonly station: number;
  readonly mode: VisibleMode;
  readonly reels: number;
  readonly inputMode: InputMode;
  readonly wrongMovesObserved: number;
  readonly hintTriplets: number;
  readonly directedHintTriplets: number;
  readonly fallbackMoves: number;
  readonly moves: number;
  readonly finalCoverage: string;
  readonly elapsedMs: number;
}

interface TutorialResult {
  readonly completedThroughFormalBoard: true;
  readonly moveCount: 1;
}

/*
 * This is deliberately a static acceptance sample, not a data import. One
 * level is selected from every one of the 20 visible stations, then five
 * additional levels strengthen mode/topology/input coverage.
 */
const PLAYTEST_LEVELS: readonly PlaytestLevel[] = [
  { id: "es-1-01", chapterId: "chapter-1", station: 1, expectedMode: "target", expectedReels: 2, inputMode: "control", wrongPathProbe: true },
  { id: "es-1-18", chapterId: "chapter-1", station: 2, expectedMode: "equality", expectedReels: 3, inputMode: "keyboard", wrongPathProbe: true },
  { id: "es-1-30", chapterId: "chapter-1", station: 3, expectedMode: "target", expectedReels: 4, inputMode: "tile" },
  { id: "es-1-31", chapterId: "chapter-1", station: 4, expectedMode: "target", expectedReels: 2, inputMode: "drag" },
  { id: "es-1-50", chapterId: "chapter-1", station: 5, expectedMode: "target", expectedReels: 4, inputMode: "control" },
  { id: "es-1-06", chapterId: "chapter-1", station: 1, expectedMode: "target", expectedReels: 2, inputMode: "keyboard" },

  { id: "es-2-01", chapterId: "chapter-2", station: 1, expectedMode: "multi-target", expectedReels: 3, inputMode: "tile", wrongPathProbe: true },
  { id: "es-2-16", chapterId: "chapter-2", station: 2, expectedMode: "equality", expectedReels: 3, inputMode: "drag" },
  { id: "es-2-27", chapterId: "chapter-2", station: 3, expectedMode: "target", expectedReels: 4, inputMode: "control" },
  { id: "es-2-35", chapterId: "chapter-2", station: 4, expectedMode: "multi-target", expectedReels: 2, inputMode: "keyboard" },
  { id: "es-2-50", chapterId: "chapter-2", station: 5, expectedMode: "target", expectedReels: 4, inputMode: "tile" },
  { id: "es-2-42", chapterId: "chapter-2", station: 5, expectedMode: "target", expectedReels: 2, inputMode: "drag" },

  { id: "es-3-09", chapterId: "chapter-3", station: 1, expectedMode: "target", expectedReels: 5, inputMode: "control" },
  { id: "es-3-16", chapterId: "chapter-3", station: 2, expectedMode: "multi-target", expectedReels: 3, inputMode: "keyboard" },
  { id: "es-3-27", chapterId: "chapter-3", station: 3, expectedMode: "equality", expectedReels: 3, inputMode: "tile" },
  { id: "es-3-39", chapterId: "chapter-3", station: 4, expectedMode: "target", expectedReels: 5, inputMode: "drag" },
  { id: "es-3-50", chapterId: "chapter-3", station: 5, expectedMode: "target", expectedReels: 3, inputMode: "control" },
  { id: "es-3-18", chapterId: "chapter-3", station: 2, expectedMode: "equality", expectedReels: 3, inputMode: "keyboard" },

  { id: "es-4-03", chapterId: "chapter-4", station: 1, expectedMode: "target", expectedReels: 5, inputMode: "tile", wrongPathProbe: true },
  { id: "es-4-14", chapterId: "chapter-4", station: 2, expectedMode: "multi-target", expectedReels: 2, inputMode: "drag" },
  { id: "es-4-29", chapterId: "chapter-4", station: 3, expectedMode: "equality", expectedReels: 4, inputMode: "control" },
  { id: "es-4-36", chapterId: "chapter-4", station: 4, expectedMode: "multi-target", expectedReels: 3, inputMode: "keyboard" },
  { id: "es-4-50", chapterId: "chapter-4", station: 5, expectedMode: "target", expectedReels: 5, inputMode: "tile" },
  { id: "es-4-09", chapterId: "chapter-4", station: 1, expectedMode: "equality", expectedReels: 4, inputMode: "drag" },
  { id: "es-4-44", chapterId: "chapter-4", station: 5, expectedMode: "multi-target", expectedReels: 2, inputMode: "control" }
] as const;

test.describe("@gate-d @agent-playtest equation slider UI-only agent playtest", () => {
  test("completes 25 levels across all chapters and stations using only visible UI", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const tutorial = await completeFormalBoardTutorial(page);

    const startedAt = Date.now();
    const results: LevelResult[] = [];
    let failure: string | undefined;

    try {
      for (let index = 0; index < PLAYTEST_LEVELS.length; index += 1) {
        const sample = PLAYTEST_LEVELS[index];
        await openVisibleLevel(page, sample, index === 0);
        results.push(await playVisibleLevel(page, sample));
      }

      expect(results).toHaveLength(25);
      expect(new Set(results.map((result) => result.chapterId))).toEqual(
        new Set(["chapter-1", "chapter-2", "chapter-3", "chapter-4"])
      );
      expect(new Set(results.map((result) => `${result.chapterId}:${result.station}`)).size).toBe(20);
      expect(new Set(results.map((result) => result.mode))).toEqual(
        new Set<VisibleMode>(["target", "multi-target", "equality"])
      );
      expect(new Set(results.map((result) => result.reels))).toEqual(new Set([2, 3, 4, 5]));
      expect(new Set(results.map((result) => result.inputMode))).toEqual(
        new Set<InputMode>(["control", "tile", "keyboard", "drag"])
      );
      expect(results.every((result) => result.directedHintTriplets > 0)).toBe(true);

      const counts = acceptanceCounts(results);
      for (const chapterId of ["chapter-1", "chapter-2", "chapter-3", "chapter-4"]) {
        expect(counts.levelsPerChapter[chapterId], `${chapterId} sample count`).toBeGreaterThanOrEqual(5);
      }
      for (const finalId of ["es-1-50", "es-2-50", "es-3-50", "es-4-50"]) {
        expect(counts.finalLevelIds, `${finalId} must be in the completed sample`).toContain(finalId);
      }
      expect(counts.dragLevels, "drag sample count").toBeGreaterThanOrEqual(5);
      expect(counts.controlAndTileLevels, "control/tile sample count").toBeGreaterThanOrEqual(5);
      expect(counts.keyboardLevels, "keyboard sample count").toBeGreaterThanOrEqual(2);
      expect(counts.wrongPathLevels, "visible wrong-path sample count").toBeGreaterThanOrEqual(4);
      expect(counts.hintDepthRequests.level1, "level-one visible hint requests").toBeGreaterThanOrEqual(4);
      expect(counts.hintDepthRequests.level2, "level-two visible hint requests").toBeGreaterThanOrEqual(2);
      expect(counts.hintDepthRequests.level3, "level-three visible hint requests").toBeGreaterThanOrEqual(2);
      expect(counts.multiTargetLevels, "multi-target sample count").toBeGreaterThanOrEqual(2);
      expect(counts.equalityLevels, "equality sample count").toBeGreaterThanOrEqual(2);
      expect(counts.fiveReelLevels, "five-reel sample count").toBeGreaterThanOrEqual(2);
    } catch (error) {
      failure = error instanceof Error ? error.stack ?? error.message : String(error);
      throw error;
    } finally {
      await attachSummary(testInfo, startedAt, tutorial, results, failure);
    }
  });
});

async function completeFormalBoardTutorial(page: Page): Promise<TutorialResult> {
  await page.goto("/?world=math-world&station=slider");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(`${BOARD}[data-level-id='es-1-01']`)).toBeVisible();
  await expect(page.locator(".equation-slider__coach[data-tutorial-step='move-target']")).toBeVisible();
  await expect(page.locator(".equation-slider__coach[data-tutorial-step='move-target']")).toContainText(
    "把右边滑轨上的 2 移到中央"
  );
  await expect(page.locator(`${BOARD}[inert]`)).toHaveCount(0);
  await expect(page.locator(`${BOARD} [inert]`)).toHaveCount(0);
  await expect(page.locator(COVERAGE)).toHaveText("0/6");
  await expect(page.locator("[data-move-count]")).toHaveText("0");

  await page.getByRole("button", { name: "第 2 列选上方格" }).click();

  await expect(page.locator(".equation-slider__coach[data-tutorial-step='coverage']")).toBeVisible();
  await expect(page.locator(COVERAGE)).toHaveText("2/6");
  await expect(page.locator("[data-move-count]")).toHaveText("1");
  await expect(page.locator(`${BOARD}[data-board-status='ready']`)).toBeVisible();
  return { completedThroughFormalBoard: true, moveCount: 1 };
}

async function openVisibleLevel(
  page: Page,
  sample: PlaytestLevel,
  isInitialLevel: boolean
): Promise<void> {
  if (!isInitialLevel) {
    await page.getByRole("button", { name: "关卡列表", exact: true }).click();
    await page.getByRole("button", { name: "线路地图", exact: true }).click();
    await page.locator(`button[data-chapter-id='${sample.chapterId}']`).click();
    await page.locator(`button[data-level-id='${sample.id}']`).click();
  }

  const board = page.locator(`${BOARD}[data-level-id='${sample.id}']`);
  await expect(board).toBeVisible();
  await expect(page.locator("[data-reel-id]")).toHaveCount(sample.expectedReels);
  expect(await readVisibleMode(page)).toBe(sample.expectedMode);
}

async function playVisibleLevel(page: Page, sample: PlaytestLevel): Promise<LevelResult> {
  const startedAt = Date.now();
  const initialMoveCount = await readMoveCount(page);
  let wrongMovesObserved = 0;
  let hintTriplets = 0;
  let directedHintTriplets = 0;
  let fallbackMoves = 0;

  if (sample.wrongPathProbe) {
    wrongMovesObserved = await probeVisibleWrongPath(page);
    expect(wrongMovesObserved, `${sample.id} should exercise a visibly wrong path`).toBeGreaterThan(0);
  }

  for (let guard = 0; guard < 80 && !(await page.locator(COMPLETION).isVisible()); guard += 1) {
    await expect(page.getByRole("button", { name: "提示", exact: true })).toBeEnabled();
    const hints = await requestThreeVisibleHints(page);
    hintTriplets += 1;

    const direction = parseVisibleDirection(hints[2]);
    if (direction) {
      directedHintTriplets += 1;
      await performVisibleMove(page, direction.reelIndex, direction.direction, sample.inputMode);
    } else {
      /*
       * A visible level may initially sit on a correct arrangement which has
       * not yet been submitted. The UI intentionally gives no forced direction
       * in that state, so leave it by one visible control and ask again.
       */
      fallbackMoves += 1;
      await performVisibleMove(page, 0, "up", "control");
    }
  }

  await expect(page.locator(COMPLETION), `${sample.id} did not complete through visible UI`).toBeVisible();
  await expect(page.locator(COMPLETION)).toContainText("本关完成");
  const finalCoverage = (await page.locator(COVERAGE).textContent())?.trim() ?? "";
  const [covered, required] = finalCoverage.split("/").map(Number);
  expect(covered).toBe(required);

  return {
    id: sample.id,
    chapterId: sample.chapterId,
    station: sample.station,
    mode: await readVisibleMode(page),
    reels: await page.locator("[data-reel-id]").count(),
    inputMode: sample.inputMode,
    wrongMovesObserved,
    hintTriplets,
    directedHintTriplets,
    fallbackMoves,
    moves: (await readMoveCount(page)) - initialMoveCount,
    finalCoverage,
    elapsedMs: Date.now() - startedAt
  };
}

async function requestThreeVisibleHints(page: Page): Promise<readonly [string, string, string]> {
  const texts: string[] = [];
  for (let depth = 1; depth <= 3; depth += 1) {
    await page.getByRole("button", { name: "提示", exact: true }).click();
    await expect(page.locator(HINT)).toBeVisible();
    const text = (await page.locator(HINT).textContent())?.trim() ?? "";
    expect(text, `hint depth ${depth} should expose visible copy`).not.toBe("");
    texts.push(text);
  }
  return texts as unknown as readonly [string, string, string];
}

function parseVisibleDirection(
  text: string
): { readonly reelIndex: number; readonly direction: "up" | "down" } | null {
  const match = text.match(/第\s*(\d+)\s*条滑轨：选(上|下)方格/);
  if (!match) return null;
  return {
    reelIndex: Number(match[1]) - 1,
    direction: match[2] === "上" ? "up" : "down"
  };
}

async function probeVisibleWrongPath(page: Page): Promise<number> {
  let priorCoverage = (await page.locator(COVERAGE).textContent())?.trim() ?? "";
  const reelCount = await page.locator("[data-reel-id]").count();

  for (let attempt = 0; attempt < reelCount * 3; attempt += 1) {
    const reelIndex = attempt % reelCount;
    await performVisibleMove(page, reelIndex, "up", "control");
    const nextCoverage = (await page.locator(COVERAGE).textContent())?.trim() ?? "";
    const feedback = (await page.locator(FEEDBACK).textContent())?.trim() ?? "";
    if (nextCoverage === priorCoverage && !feedback.includes("算式成立")) return attempt + 1;
    priorCoverage = nextCoverage;
  }

  return 0;
}

async function performVisibleMove(
  page: Page,
  reelIndex: number,
  direction: "up" | "down",
  mode: InputMode
): Promise<void> {
  const before = await readMoveCount(page);
  const reel = page.locator("[data-reel-id]").nth(reelIndex);

  if (mode === "control") {
    await page.getByRole("button", {
      name: `第 ${reelIndex + 1} 列选${direction === "up" ? "上" : "下"}方格`
    }).click();
  } else if (mode === "tile") {
    await reel.locator(`[data-position='${direction === "up" ? "previous" : "next"}']`).click();
  } else if (mode === "keyboard") {
    await reel.locator("[data-reel-window]").focus();
    await page.keyboard.press(direction === "up" ? "ArrowUp" : "ArrowDown");
  } else {
    const window = reel.locator("[data-reel-window]");
    const box = await window.boundingBox();
    if (!box) throw new Error(`Visible reel ${reelIndex + 1} has no drag box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const deltaY = direction === "up" ? 55 : -55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + deltaY, { steps: 4 });
    await page.mouse.up();
  }

  await expect.poll(() => readMoveCount(page), {
    message: `visible ${mode} move should commit exactly once`
  }).toBe(before + 1);
  await expect.poll(() => page.locator(BOARD).getAttribute("data-board-status")).toMatch(/^(ready|complete)$/);
}

async function readMoveCount(page: Page): Promise<number> {
  return Number((await page.locator("[data-move-count]").textContent())?.trim() ?? "0");
}

async function readVisibleMode(page: Page): Promise<VisibleMode> {
  const label = (await page.locator(".equation-slider__target-card > span").textContent())?.trim();
  if (label === "多目标") return "multi-target";
  if (label === "平衡目标") return "equality";
  if (label === "目标") return "target";
  throw new Error(`Unknown visible target label: ${String(label)}`);
}

async function attachSummary(
  testInfo: TestInfo,
  startedAt: number,
  tutorial: TutorialResult,
  results: readonly LevelResult[],
  failure?: string
): Promise<void> {
  const stationKeys = new Set(results.map((result) => `${result.chapterId}:${result.station}`));
  const counts = acceptanceCounts(results);
  const playtestLevelMoves = results.reduce((sum, result) => sum + result.moves, 0);
  const report = {
    schemaVersion: 1,
    kind: "equation-slider-ui-only-agent-playtest",
    uiOnlyContract: {
      sourceImports: ["@playwright/test"],
      runtimeStateWrites: false,
      decisionInputs: ["visible DOM", "visible three-level hints", "visible coverage", "visible feedback"],
      adapters: ["control buttons", "neighbor tiles", "keyboard arrows", "mouse drag"]
    },
    tutorialCompletedThroughFormalBoard: tutorial.completedThroughFormalBoard,
    tutorialMoveCount: tutorial.moveCount,
    status: failure ? "failed" : results.length === PLAYTEST_LEVELS.length ? "passed" : "incomplete",
    expectedLevels: PLAYTEST_LEVELS.length,
    completedLevels: results.length,
    chaptersCovered: [...new Set(results.map((result) => result.chapterId))].sort(),
    stationsCovered: stationKeys.size,
    modesCovered: [...new Set(results.map((result) => result.mode))].sort(),
    reelCountsCovered: [...new Set(results.map((result) => result.reels))].sort(),
    inputModesCovered: [...new Set(results.map((result) => result.inputMode))].sort(),
    wrongPathLevels: results.filter((result) => result.wrongMovesObserved > 0).map((result) => result.id),
    acceptanceCounts: counts,
    moveAccounting: {
      playtestLevelMoves,
      tutorialMoves: tutorial.moveCount,
      totalMovesIncludingTutorial: playtestLevelMoves + tutorial.moveCount
    },
    totalMoves: playtestLevelMoves,
    totalHintTriplets: results.reduce((sum, result) => sum + result.hintTriplets, 0),
    elapsedMs: Date.now() - startedAt,
    levels: results,
    failure
  };
  const json = JSON.stringify(report, null, 2);
  await testInfo.attach("equation-slider-ui-only-25-level-playtest.json", {
    body: Buffer.from(json, "utf8"),
    contentType: "application/json"
  });
  console.log(`[equation-slider-ui-only-playtest]\n${json}`);
}

function acceptanceCounts(results: readonly LevelResult[]): {
  readonly levelsPerChapter: Readonly<Record<string, number>>;
  readonly finalLevelIds: readonly string[];
  readonly dragLevels: number;
  readonly controlAndTileLevels: number;
  readonly keyboardLevels: number;
  readonly wrongPathLevels: number;
  readonly hintDepthRequests: {
    readonly level1: number;
    readonly level2: number;
    readonly level3: number;
  };
  readonly multiTargetLevels: number;
  readonly equalityLevels: number;
  readonly fiveReelLevels: number;
} {
  const hintTriplets = results.reduce((sum, result) => sum + result.hintTriplets, 0);
  return {
    levelsPerChapter: Object.fromEntries(
      ["chapter-1", "chapter-2", "chapter-3", "chapter-4"].map((chapterId) => [
        chapterId,
        results.filter((result) => result.chapterId === chapterId).length
      ])
    ),
    finalLevelIds: results
      .map((result) => result.id)
      .filter((id) => /^es-[1-4]-50$/.test(id))
      .sort(),
    dragLevels: results.filter((result) => result.inputMode === "drag").length,
    controlAndTileLevels: results.filter(
      (result) => result.inputMode === "control" || result.inputMode === "tile"
    ).length,
    keyboardLevels: results.filter((result) => result.inputMode === "keyboard").length,
    wrongPathLevels: results.filter((result) => result.wrongMovesObserved > 0).length,
    hintDepthRequests: {
      level1: hintTriplets,
      level2: hintTriplets,
      level3: hintTriplets
    },
    multiTargetLevels: results.filter((result) => result.mode === "multi-target").length,
    equalityLevels: results.filter((result) => result.mode === "equality").length,
    fiveReelLevels: results.filter((result) => result.reels === 5).length
  };
}
