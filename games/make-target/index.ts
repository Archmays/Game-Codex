import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { playFeedbackSound, type FeedbackState } from "../../packages/ui";
import { readWorldHomeState } from "../../apps/my-game-world/world-state";
import {
  applyTargetOperation,
  cloneExpr,
  createTargetCards,
  formatOperationEquation,
  sourceCardIds,
  type TargetCard,
  type TargetOperator,
} from "./model";
import { puzzlesForTarget, type TargetMode, type TargetPuzzleManifestEntry } from "./puzzles";
import { solveTarget, type SolverMove } from "./solver";
import { createTargetProgressSession } from "./progress";
import { cardAccessibleName, renderTargetWorkbench } from "./view";
import "./styles.css";

export { loadMakeTargetSave, MAKE_TARGET_SAVE_VERSION, type MakeTargetSaveV1, type LoadedMakeTargetSave } from "./progress";

interface ActionSnapshot {
  cards: TargetCard[];
  equations: string[];
  nextCardNumber: number;
}

interface PendingChange {
  target: TargetMode;
  advance: boolean;
  focusKey: string;
}

export const makeTargetGame: GameDefinition = {
  id: "make-target",
  title: "目标工坊",
  description: "依次选择两张数字牌，用四则运算把四张牌合成目标数。",
  subject: "数学",
  recommendedAge: "7-10 岁",
  learningGoal: "练习数感、运算顺序、括号表达和目标数推理。",
  status: "数学世界模块",
  playLabel: "进入工坊",
  mount(context: MountGameContext): MountedGame {
    return mountMakeTarget(context);
  },
};

function mountMakeTarget(context: MountGameContext): MountedGame {
  const root = document.createElement("section");
  root.className = "make-target-game target-workbench";
  root.dataset.testid = "target-workshop";
  context.container.append(root);
  const progress = createTargetProgressSession();
  let target: TargetMode = 10;
  const puzzleIndexByTarget: Record<TargetMode, number> = { 10: 0, 12: 0, 24: 0 };
  let puzzle: TargetPuzzleManifestEntry = puzzlesForTarget(target)[0];
  let cards: TargetCard[] = [];
  let selectedIds: string[] = [];
  let operator: TargetOperator = "+";
  let feedback: FeedbackState = { kind: "info", text: "" };
  let history: ActionSnapshot[] = [];
  let equations: string[] = [];
  let hintLevel = 0;
  let hintMove: SolverMove | null = null;
  let nextCardNumber = 1;
  let latestCombinedCardId: string | null = null;
  let historyExpanded = false;
  let pendingChange: PendingChange | null = null;
  let saveNote = "";
  let renderNumber = 0;
  let destroyed = false;

  const complete = (): boolean => cards.length === 1 && cards[0].expr.value === target;
  const sound = (kind: FeedbackState["kind"]): void => {
    try {
      if (!readWorldHomeState(window.localStorage).settings.muted) playFeedbackSound(kind);
    } catch { /* Storage or audio support must never block an operation. */ }
  };

  const render = (focusKey?: string): void => {
    if (destroyed) return;
    const frame = ++renderNumber;
    try {
      if (readWorldHomeState(window.localStorage).settings.reducedMotion) root.dataset.reducedMotion = "true";
      else delete root.dataset.reducedMotion;
    } catch { /* The device and Math World motion preferences still apply. */ }
    const left = cards.find((card) => card.id === selectedIds[0]);
    const right = cards.find((card) => card.id === selectedIds[1]);
    renderTargetWorkbench(root, {
      target, puzzleNumber: puzzleIndexByTarget[target] + 1, cards, selectedIds, operator,
      latestCombinedCardId, canUndo: history.length > 0,
      canCombine: Boolean(left && right && applyTargetOperation(left.expr, right.expr, operator)),
      feedback, preview: createPreview(), hint: hintLevel > 0 ? createHintPanel() : null,
      equations, historyExpanded, saveNote,
      changePrompt: pendingChange ? pendingChange.target === target ? "换一组牌？" : "改为目标 " + pendingChange.target + "？" : null,
      onHistoryExpanded: (open) => { historyExpanded = open; },
      onTarget: (value) => {
        if (value !== target) requestChange({ target: value, advance: false, focusKey: "target-" + value });
      },
      onCard: toggleCard,
      onOperator: (op) => { operator = op; feedback = { kind: "info", text: "" }; render("operator-" + op); },
      onCombine: combineSelected, onSwap: swapSelection, onUndo: undo, onHint: revealHint,
      onHideHint: () => { hintLevel = 0; render("hint"); },
      onNext: () => requestChange({ target, advance: true, focusKey: "next" }),
      onReplay: () => startPuzzle(false, "first-card"),
      onCancelChange: () => {
        const focus = pendingChange?.focusKey;
        pendingChange = null;
        render(focus);
      },
      onConfirmChange: () => {
        const change = pendingChange;
        if (!change) return;
        target = change.target;
        startPuzzle(change.advance, "first-card");
      },
    });
    // Arrival belongs only to the merge render, not later selection or operator renders.
    latestCombinedCardId = null;
    if (focusKey) {
      queueMicrotask(() => {
        if (destroyed || frame !== renderNumber || !root.isConnected) return;
        const element = focusKey.startsWith("card:")
          ? [...root.querySelectorAll<HTMLButtonElement>("[data-card-id]")].find((button) => button.dataset.cardId === focusKey.slice(5))
          : root.querySelector<HTMLButtonElement>('[data-target-action="' + focusKey + '"]');
        element?.focus();
      });
    }
  };

  const startPuzzle = (advance: boolean, focusKey?: string): void => {
    const candidates = puzzlesForTarget(target);
    if (advance) puzzleIndexByTarget[target] = (puzzleIndexByTarget[target] + 1) % candidates.length;
    puzzle = candidates[puzzleIndexByTarget[target]];
    cards = createTargetCards(puzzle.id, puzzle.cards);
    selectedIds = [];
    operator = "+";
    history = [];
    equations = [];
    historyExpanded = false;
    hintLevel = 0;
    hintMove = null;
    nextCardNumber = 1;
    latestCombinedCardId = null;
    pendingChange = null;
    saveNote = "";
    feedback = { kind: "info", text: "" };
    render(focusKey === "first-card" ? "card:" + cards[0].id : focusKey);
  };

  const requestChange = (change: PendingChange): void => {
    if (history.length > 0 && !complete()) {
      pendingChange = change;
      render("cancel-change");
    } else {
      target = change.target;
      startPuzzle(change.advance, "first-card");
    }
  };

  const toggleCard = (id: string): void => {
    if (destroyed || pendingChange || !cards.some((card) => card.id === id)) return;
    if (complete()) { render("card:" + id); return; }
    if (selectedIds.includes(id)) selectedIds = selectedIds.filter((selectedId) => selectedId !== id);
    else if (selectedIds.length < 2) selectedIds = [...selectedIds, id];
    else {
      feedback = { kind: "info", text: "两边都有牌了。先点一下已选的牌，就能换一张。" };
      render("card:" + id);
      return;
    }
    latestCombinedCardId = null;
    feedback = { kind: "info", text: "" };
    render("card:" + id);
  };

  const swapSelection = (): void => {
    if (pendingChange || selectedIds.length !== 2) return;
    selectedIds = [selectedIds[1], selectedIds[0]];
    feedback = { kind: "info", text: "左右顺序已经交换。" };
    render("swap");
  };

  const combineSelected = (): void => {
    if (destroyed || pendingChange || selectedIds.length !== 2) return;
    const first = cards.find((card) => card.id === selectedIds[0]);
    const second = cards.find((card) => card.id === selectedIds[1]);
    if (!first || !second) return;
    const result = applyTargetOperation(first.expr, second.expr, operator);
    if (!result) return; // Preview explains invalid operations; no state is consumed.
    history = [{
      cards: cards.map((card) => ({ ...card, expr: cloneExpr(card.expr) })),
      equations: [...equations],
      nextCardNumber,
    }, ...history];
    equations = [...equations, formatOperationEquation(result)];
    cards = cards.filter((card) => !selectedIds.includes(card.id));
    latestCombinedCardId = puzzle.id + "-combined-" + nextCardNumber;
    cards.push({ id: latestCombinedCardId, expr: result });
    nextCardNumber += 1;
    selectedIds = [];
    hintLevel = 0;
    hintMove = null;
    if (complete()) {
      const write = progress.complete(puzzle.id);
      saveNote = write === "unavailable" || write === "changed"
        ? "这次完成未写入记录，原来的记录保持不变。" : "";
      feedback = { kind: "success", text: "成功凑出 " + target + "。可以看看完整算式，或换一组继续。" };
      sound("success");
    } else if (cards.length === 1) {
      feedback = { kind: "info", text: "最后得到 " + cards[0].expr.value + "。可以逐步撤销，再换一种组合。" };
      sound("info");
    } else {
      feedback = { kind: "success", text: "这一步得到 " + result.value + "。继续想想下一对。" };
      sound("info");
    }
    render("card:" + latestCombinedCardId);
  };

  const undo = (): void => {
    if (destroyed || pendingChange) return;
    const previous = history.shift();
    if (!previous) return;
    cards = previous.cards.map((card) => ({ ...card, expr: cloneExpr(card.expr) }));
    equations = [...previous.equations];
    nextCardNumber = previous.nextCardNumber;
    selectedIds = [];
    hintLevel = 0;
    hintMove = null;
    latestCombinedCardId = null;
    feedback = { kind: "info", text: "已回到合并前，牌和算式都恢复了。" };
    render(history.length ? "undo" : "card:" + cards[0].id);
  };

  const revealHint = (): void => {
    if (pendingChange) return;
    if (hintLevel === 0 && !complete()) hintMove = solveTarget(cards.map((card) => card.expr), target).legalNextMoves[0] ?? null;
    hintLevel = Math.min(4, hintLevel + 1);
    render("hint");
  };

  const createPreview = (): HTMLElement => {
    const preview = document.createElement("section");
    preview.dataset.testid = "target-preview";
    const selected = selectedIds.map((id) => cards.find((card) => card.id === id)).filter((card): card is TargetCard => Boolean(card));
    if (selected.length !== 2) {
      preview.textContent = selected.length === 0 ? "暂不可合并：还需选两张牌。" : "暂不可合并：再选右边的牌。";
      preview.dataset.valid = "false";
      return preview;
    }
    const result = applyTargetOperation(selected[0].expr, selected[1].expr, operator);
    preview.dataset.valid = String(Boolean(result));
    preview.textContent = result ? "预览：" + formatOperationEquation(result)
      : operator === "-" ? "暂不可合并：会得到负数，试试交换左右。"
        : selected[1].expr.value === 0 ? "暂不可合并：不能除以 0。"
          : "暂不可合并：这两个数不能整除。";
    return preview;
  };

  const createHintPanel = (): HTMLElement => {
    const panel = document.createElement("section");
    panel.dataset.testid = "target-hint";
    const title = document.createElement("strong");
    title.textContent = complete() ? "这组已完成" : "提示台";
    panel.append(title);
    if (complete()) {
      panel.append(" 四张原牌已经合成目标 " + target + "。可以再试这组，或自愿选择下一组。");
      return panel;
    }
    if (!hintMove) {
      panel.append(" 当前组合没有续解。可以逐步撤销，回到能继续尝试的位置。");
      return panel;
    }
    const describe = (ids: readonly string[]): string => {
      const card = cards.find((item) => sourceCardIds(item.expr).join(",") === ids.join(","));
      return card ? cardAccessibleName(card) : "";
    };
    const parts = [
      "先留意哪两个数之间有容易看见的关系。",
      "可以先选【" + describe(hintMove.leftSourceCardIds) + "】，再选【" + describe(hintMove.rightSourceCardIds) + "】。",
      "这一步可以试试“" + hintMove.op + "”。",
      "当前下一步可写成：" + hintMove.leftExpression + " " + hintMove.op + " " + hintMove.rightExpression + " = " + hintMove.value + "。",
    ];
    const list = document.createElement("ol");
    for (const text of parts.slice(0, hintLevel)) {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    }
    panel.append(list);
    return panel;
  };

  startPuzzle(false);
  return { destroy(): void { destroyed = true; renderNumber += 1; root.remove(); } };
}

export function calculate(a: number, b: number, operator: TargetOperator): number | null {
  return applyTargetOperation(
    { kind: "literal", value: a, sourceCardId: "legacy-left" },
    { kind: "literal", value: b, sourceCardId: "legacy-right" },
    operator,
  )?.value ?? null;
}

export function formatCardValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
