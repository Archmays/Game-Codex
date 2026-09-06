import { expect, type Locator, type Page } from "@playwright/test";
import { applyTargetOperation, createTargetCards, sourceCardIds, type TargetCard, type TargetOperator } from "../../../games/make-target/model";
import { solveTarget } from "../../../games/make-target/solver";
import type { TargetPuzzleManifestEntry } from "../../../games/make-target/puzzles";

export const TARGET_PROGRESS_KEY = "family-games/make-target/progress";
export const targetInputs = new WeakMap<Page, string[]>();

export async function activateTarget(page: Page, control: Locator, touch = false): Promise<void> {
  const label = await control.getAttribute("aria-label") ?? await control.textContent();
  const actions = targetInputs.get(page) ?? [];
  actions.push(label ?? "(unnamed)");
  targetInputs.set(page, actions);
  if (touch) await control.tap();
  else await control.click();
}

export async function targetAction(page: Page, action: string, touch = false): Promise<void> {
  await activateTarget(page, page.locator('[data-target-action="' + action + '"]'), touch);
}

export async function selectTargetCards(page: Page, left: string, right: string, touch = false): Promise<void> {
  await activateTarget(page, page.locator('[data-card-id="' + left + '"]'), touch);
  await activateTarget(page, page.locator('[data-card-id="' + right + '"]'), touch);
}

export async function mergeTargetCards(page: Page, left: string, right: string, op: TargetOperator = "+", touch = false): Promise<void> {
  await selectTargetCards(page, left, right, touch);
  await targetAction(page, "operator-" + op, touch);
  await targetAction(page, "combine", touch);
}

/** Solver chooses moves; only real visible card/operator/button inputs change the game. */
export async function solveTargetByInput(page: Page, puzzle: TargetPuzzleManifestEntry, touch = false): Promise<void> {
  let cards: TargetCard[] = createTargetCards(puzzle.id, puzzle.cards);
  const paths = solveTarget(cards.map((card) => card.expr), puzzle.target).solutionPaths;
  const solution = touch ? paths.at(-1)! : paths[0];
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
  let index = 1;
  for (const move of solution.steps) {
    const find = (ids: readonly string[]) => cards.find((card) => sourceCardIds(card.expr).join(",") === ids.join(","))!;
    const left = find(move.leftSourceCardIds), right = find(move.rightSourceCardIds);
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    await mergeTargetCards(page, left.id, right.id, move.op, touch);
    const id = puzzle.id + "-combined-" + index++;
    cards = cards.filter((card) => card !== left && card !== right);
    cards.push({ id, expr: applyTargetOperation(left.expr, right.expr, move.op)! });
    await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(cards.length);
    const newCard = page.locator('[data-card-id="' + id + '"]');
    await expect(newCard).toBeFocused();
    await expect(newCard).toHaveAttribute("data-source-ids", sourceCardIds(cards.at(-1)!.expr).join(","));
    await expect(newCard).toHaveAttribute("data-card-value", String(move.value));
  }
  await expect(page.getByTestId("target-completion")).toContainText("四张牌，合成 " + puzzle.target);
}
