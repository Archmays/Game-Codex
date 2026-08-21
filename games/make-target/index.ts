import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { clearElement, createButton, createFeedbackBanner, createStatus, playFeedbackSound } from "../../packages/ui";
import type { FeedbackState } from "../../packages/ui";
import {
  applyTargetOperation,
  cloneExpr,
  createTargetCards,
  formatExpr,
  formatOperationEquation,
  type TargetCard,
  type TargetOperator,
} from "./model";
import { puzzlesForTarget, type TargetMode, type TargetPuzzleManifestEntry } from "./puzzles";
import { solveTarget } from "./solver";

interface ActionSnapshot {
  cards: TargetCard[];
  equations: string[];
  nextCardNumber: number;
}

interface MakeTargetSave {
  wins: number;
  completedPuzzleIds?: string[];
}

const OPERATORS: readonly TargetOperator[] = ["+", "-", "×", "÷"];

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
  root.className = "learning-game make-target-game";
  root.dataset.testid = "target-workshop";
  context.container.append(root);

  let target: TargetMode = 10;
  const puzzleIndexByTarget: Record<TargetMode, number> = { 10: 0, 12: 0, 24: 0 };
  let puzzle: TargetPuzzleManifestEntry = puzzlesForTarget(target)[0];
  let cards: TargetCard[] = [];
  let selectedIds: string[] = [];
  let operator: TargetOperator = "+";
  let feedback: FeedbackState = { kind: "info", text: "按顺序选两张牌，再选择运算。" };
  let history: ActionSnapshot[] = [];
  let equations: string[] = [];
  let hintLevel = 0;
  let nextCardNumber = 1;
  const save = context.storage.get<MakeTargetSave>("progress", { wins: 0 });

  const render = (): void => {
    clearElement(root);
    root.append(createHeader("目标工坊", "四张牌每张只用一次。减法看顺序，除法必须整除。"));

    const toolbar = document.createElement("div");
    toolbar.className = "learning-game__toolbar";
    toolbar.setAttribute("aria-label", "选择目标数");
    for (const value of [10, 12, 24] as TargetMode[]) {
      const targetButton = createButton(`目标 ${value}`, () => {
        if (value === target) return;
        target = value;
        startPuzzle(false);
      }, {
        className: value === target ? "ui-button learning-game__pill is-active" : "ui-button learning-game__pill",
      });
      targetButton.setAttribute("aria-pressed", String(value === target));
      toolbar.append(targetButton);
    }

    const status = document.createElement("div");
    status.className = "learning-game__stats";
    status.append(createStatus("目标", target), createStatus("手中牌", cards.length));

    const orderGuide = document.createElement("p");
    orderGuide.className = "make-target-order-guide";
    orderGuide.textContent = selectedIds.length === 0
      ? "先选左边的数，再选右边的数。"
      : selectedIds.length === 1
        ? "已选左边；现在选右边的数。"
        : "两张牌已按左、右排好。需要时可以交换顺序。";

    const cardGrid = document.createElement("div");
    cardGrid.className = "make-target-cards";
    cardGrid.dataset.testid = "target-cards";
    for (const card of cards) {
      const position = selectedIds.indexOf(card.id);
      cardGrid.append(createNumberCardButton(card, position, () => toggleCard(card.id)));
    }

    const ops = document.createElement("div");
    ops.className = "make-target-ops";
    ops.setAttribute("aria-label", "选择运算符");
    for (const op of OPERATORS) {
      const operatorButton = createButton(op, () => {
        operator = op;
        render();
      }, {
        className: op === operator ? "ui-button learning-game__pill is-active" : "ui-button learning-game__pill",
      });
      operatorButton.setAttribute("aria-pressed", String(op === operator));
      ops.append(operatorButton);
    }

    const actions = document.createElement("div");
    actions.className = "learning-game__actions";
    actions.append(
      createButton("合并", combineSelected),
      createButton("交换左右", swapSelection, {
        className: "ui-button ui-button--secondary",
        disabled: selectedIds.length !== 2,
      }),
      createButton("撤销一步", undo, { className: "ui-button ui-button--secondary", disabled: history.length === 0 }),
      createButton("给我一点提示", revealHint, { className: "ui-button ui-button--secondary" }),
      createButton("换一组牌", nextPuzzle, { className: "ui-button ui-button--secondary" }),
    );

    root.append(
      toolbar,
      status,
      orderGuide,
      cardGrid,
      ops,
      createPreview(),
      actions,
      createHintPanel(),
      createHistoryList(),
      createFeedbackBanner(feedback),
    );
  };

  const startPuzzle = (advance: boolean): void => {
    const candidates = puzzlesForTarget(target);
    if (advance) puzzleIndexByTarget[target] = (puzzleIndexByTarget[target] + 1) % candidates.length;
    puzzle = candidates[puzzleIndexByTarget[target]];
    cards = createTargetCards(puzzle.id, puzzle.cards);
    selectedIds = [];
    operator = "+";
    history = [];
    equations = [];
    hintLevel = 0;
    nextCardNumber = 1;
    feedback = { kind: "info", text: "按顺序选两张牌，再选择运算。" };
    render();
  };

  const nextPuzzle = (): void => startPuzzle(true);

  const toggleCard = (id: string): void => {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((selectedId) => selectedId !== id);
    } else if (selectedIds.length < 2) {
      selectedIds = [...selectedIds, id];
    }
    render();
  };

  const swapSelection = (): void => {
    if (selectedIds.length !== 2) return;
    selectedIds = [selectedIds[1], selectedIds[0]];
    feedback = { kind: "info", text: "左右顺序已经交换。" };
    render();
  };

  const combineSelected = (): void => {
    if (selectedIds.length !== 2) {
      feedback = { kind: "info", text: "需要按顺序选两张牌。" };
      render();
      return;
    }

    const first = cards.find((card) => card.id === selectedIds[0]);
    const second = cards.find((card) => card.id === selectedIds[1]);
    if (!first || !second) return;

    const result = applyTargetOperation(first.expr, second.expr, operator);
    if (!result) {
      feedback = operator === "-"
        ? { kind: "error", text: "左边的数要不小于右边；可以交换左右再试。" }
        : { kind: "error", text: "这一步不能整除；可以换顺序、换运算或撤销。" };
      playFeedbackSound("error");
      render();
      return;
    }

    history = [{
      cards: cards.map((card) => ({ ...card, expr: cloneExpr(card.expr) })),
      equations: [...equations],
      nextCardNumber,
    }, ...history];
    equations = [...equations, formatOperationEquation(result)];
    cards = cards.filter((card) => !selectedIds.includes(card.id));
    cards.push({ id: `${puzzle.id}-combined-${nextCardNumber}`, expr: result });
    nextCardNumber += 1;
    selectedIds = [];
    hintLevel = 0;

    if (cards.length === 1 && cards[0].expr.value === target) {
      const completed = new Set(save.completedPuzzleIds ?? []);
      if (!completed.has(puzzle.id)) {
        completed.add(puzzle.id);
        save.wins += 1;
        save.completedPuzzleIds = [...completed].sort();
        context.storage.set("progress", save);
      }
      feedback = { kind: "success", text: `成功凑出 ${target}。可以看看完整算式，或换一组继续。` };
      playFeedbackSound("success");
    } else if (cards.length === 1) {
      feedback = { kind: "info", text: `最后得到 ${cards[0].expr.value}。可以撤销一步，再换一种组合。` };
      playFeedbackSound("info");
    } else {
      feedback = { kind: "success", text: `这一步得到 ${result.value}。继续想想下一对。` };
      playFeedbackSound("info");
    }
    render();
  };

  const undo = (): void => {
    const previous = history.shift();
    if (!previous) return;
    cards = previous.cards.map((card) => ({ ...card, expr: cloneExpr(card.expr) }));
    equations = [...previous.equations];
    nextCardNumber = previous.nextCardNumber;
    selectedIds = [];
    hintLevel = 0;
    feedback = { kind: "info", text: "已回到合并前，牌和算式都恢复了。" };
    render();
  };

  const revealHint = (): void => {
    const solved = solveTarget(cards.map((card) => card.expr), target);
    if (!solved.solvable || !solved.legalNextMoves[0]) {
      feedback = { kind: "info", text: history.length > 0 ? "这里没有通路了，撤销一步会更有帮助。" : "换一组牌再试试。" };
      render();
      return;
    }
    hintLevel = Math.min(4, hintLevel + 1);
    render();
  };

  const createPreview = (): HTMLElement => {
    const preview = document.createElement("section");
    preview.className = "make-target-preview";
    preview.dataset.testid = "target-preview";
    const selected = selectedIds.map((id) => cards.find((card) => card.id === id)).filter((card): card is TargetCard => Boolean(card));
    if (selected.length !== 2) {
      preview.textContent = "预览：先按左右顺序选两张牌。";
      return preview;
    }
    const result = applyTargetOperation(selected[0].expr, selected[1].expr, operator);
    preview.textContent = result
      ? `预览：${formatOperationEquation(result)}`
      : operator === "-"
        ? "预览：左边小于右边，不能这样相减。"
        : "预览：这两个数不能这样整除。";
    return preview;
  };

  const createHintPanel = (): HTMLElement => {
    const panel = document.createElement("section");
    panel.className = "make-target-hint";
    panel.dataset.testid = "target-hint";
    const title = document.createElement("strong");
    title.textContent = "提示台";
    panel.append(title);
    if (hintLevel === 0) {
      panel.append(" 提示会逐层展开，不会直接展示整题答案。");
      return panel;
    }
    const move = solveTarget(cards.map((card) => card.expr), target).legalNextMoves[0];
    if (!move) {
      panel.append(" 当前组合没有通路，可以撤销一步。");
      return panel;
    }
    const parts = [
      "先留意哪两个数之间有容易看见的关系。",
      `可以先选 ${move.leftExpression}，再选 ${move.rightExpression}。`,
      `这一步可以试试“${move.op}”。`,
      `第一步可写成：${move.leftExpression} ${move.op} ${move.rightExpression} = ${move.value}。`,
    ];
    const list = document.createElement("ol");
    for (const itemText of parts.slice(0, hintLevel)) {
      const item = document.createElement("li");
      item.textContent = itemText;
      list.append(item);
    }
    panel.append(list);
    return panel;
  };

  const createHistoryList = (): HTMLElement => {
    const list = document.createElement("section");
    list.className = "make-target-history";
    const title = document.createElement("strong");
    title.textContent = "算式记录";
    list.append(title);
    if (equations.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = " 还没有合并步骤。";
      list.append(empty);
      return list;
    }
    const steps = document.createElement("ol");
    for (const equation of equations) {
      const step = document.createElement("li");
      step.textContent = equation;
      steps.append(step);
    }
    list.append(steps);
    return list;
  };

  startPuzzle(false);

  return {
    destroy(): void {
      root.remove();
    },
  };
}

function createHeader(titleText: string, introText: string): HTMLElement {
  const header = document.createElement("header");
  header.className = "learning-game__header";
  const title = document.createElement("h2");
  title.textContent = titleText;
  const intro = document.createElement("p");
  intro.textContent = introText;
  header.append(title, intro);
  return header;
}

function createNumberCardButton(card: TargetCard, selectedPosition: number, onClick: () => void): HTMLButtonElement {
  const selected = selectedPosition >= 0;
  const button = createButton("", onClick, {
    className: selected ? "ui-button make-target-card is-selected" : "ui-button make-target-card",
  });
  button.setAttribute("aria-pressed", String(selected));
  button.dataset.cardId = card.id;
  const order = document.createElement("span");
  order.className = "make-target-card__order";
  order.textContent = selectedPosition === 0 ? "左" : selectedPosition === 1 ? "右" : "";
  const expression = document.createElement("span");
  expression.textContent = formatExpr(card.expr);
  const value = document.createElement("strong");
  value.textContent = `= ${formatCardValue(card.expr.value)}`;
  button.append(order, expression, value);
  return button;
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
