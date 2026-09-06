import { createButton, createFeedbackBanner, type FeedbackState } from "../../packages/ui";
import { formatExpr, sourceCardIds, type TargetCard, type TargetOperator } from "./model";
import type { TargetMode } from "./puzzles";

export interface TargetWorkbenchView {
  target: TargetMode;
  puzzleNumber: number;
  cards: readonly TargetCard[];
  selectedIds: readonly string[];
  operator: TargetOperator;
  latestCombinedCardId: string | null;
  canUndo: boolean;
  canCombine: boolean;
  feedback: FeedbackState;
  preview: HTMLElement;
  hint: HTMLElement | null;
  equations: readonly string[];
  historyExpanded: boolean;
  saveNote: string;
  changePrompt: string | null;
  onHistoryExpanded: (open: boolean) => void;
  onTarget: (target: TargetMode) => void;
  onCard: (id: string) => void;
  onOperator: (operator: TargetOperator) => void;
  onCombine: () => void;
  onSwap: () => void;
  onUndo: () => void;
  onHint: () => void;
  onHideHint: () => void;
  onNext: () => void;
  onReplay: () => void;
  onCancelChange: () => void;
  onConfirmChange: () => void;
}

const OPERATORS: readonly TargetOperator[] = ["+", "-", "×", "÷"];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(label: string, key: string, onClick: () => void, options: { primary?: boolean; disabled?: boolean } = {}): HTMLButtonElement {
  const button = createButton(label, onClick, {
    className: options.primary ? "target-action target-action--primary" : "target-action",
    disabled: options.disabled,
  });
  button.dataset.targetAction = key;
  return button;
}

export function cardSourceLabel(card: TargetCard): string {
  const sources = sourceCardIds(card.expr).map((id) => id.slice(id.lastIndexOf("-") + 1));
  return card.expr.kind === "literal" ? "原牌 " + sources[0] : "合成 " + sources.join("·");
}

export function cardAccessibleName(card: TargetCard): string {
  return card.expr.value + "，" + cardSourceLabel(card) + (card.expr.kind === "literal" ? "" : "，" + formatExpr(card.expr));
}

function operand(card: TargetCard | undefined, side: "左" | "右"): HTMLElement {
  const slot = node("div", "target-operand");
  slot.dataset.operand = side === "左" ? "left" : "right";
  slot.classList.toggle("is-filled", Boolean(card));
  // This is a view of a hand card, never another selectable card.
  slot.setAttribute("aria-label", side + "操作数：" + (card ? cardAccessibleName(card) : "待选"));
  slot.append(
    node("span", "target-operand__label", side + "边"),
    node("strong", "target-operand__value", card ? String(card.expr.value) : "?"),
    node("span", "target-operand__source", card ? cardSourceLabel(card) : "选" + side + "边的牌"),
  );
  return slot;
}

export function renderTargetWorkbench(root: HTMLElement, state: TargetWorkbenchView): void {
  const complete = state.cards.length === 1 && state.cards[0].expr.value === state.target;
  root.classList.toggle("is-complete", complete);
  const header = node("header", "target-heading");
  const goal = node("div", "target-goal");
  goal.append(node("span", "target-eyebrow", "合成目标"), node("strong", "target-goal__number", String(state.target)));
  const setup = node("div", "target-setup");
  const targets = node("div", "target-modes");
  targets.setAttribute("role", "group");
  targets.setAttribute("aria-label", "选择目标数");
  for (const target of [10, 12, 24] as const) {
    const control = action("目标 " + target, "target-" + target, () => state.onTarget(target));
    control.setAttribute("aria-pressed", String(target === state.target));
    targets.append(control);
  }
  setup.append(targets, node("p", "target-rule", "四张牌各用一次，合成一张。"));
  header.append(goal, setup);

  const table = node("section", "target-table");
  table.setAttribute("aria-label", "数字牌操作桌");
  const handHeading = node("div", "target-hand-heading");
  handHeading.append(node("h2", "", "手中牌"), node("span", "target-hand-count", "还剩 " + state.cards.length + " 张"));
  const hand = node("div", "make-target-cards target-hand");
  hand.dataset.testid = "target-cards";
  for (const card of state.cards) {
    const selectedPosition = state.selectedIds.indexOf(card.id);
    const button = createButton("", () => state.onCard(card.id), { className: "target-card" });
    button.dataset.cardId = card.id;
    button.dataset.cardValue = String(card.expr.value);
    button.dataset.sourceIds = sourceCardIds(card.expr).join(",");
    button.setAttribute("aria-label", cardAccessibleName(card) + (selectedPosition >= 0 ? "，已选" + (selectedPosition === 0 ? "左" : "右") + "边" : ""));
    button.setAttribute("aria-pressed", String(selectedPosition >= 0));
    button.classList.toggle("is-new", card.id === state.latestCombinedCardId);
    button.classList.toggle("is-selected", selectedPosition >= 0);
    button.append(
      node("span", "target-card__position", selectedPosition === 0 ? "左" : selectedPosition === 1 ? "右" : ""),
      node("strong", "target-card__value", String(card.expr.value)),
      node("span", "target-card__source", cardSourceLabel(card)),
      node("span", "target-card__expression", card.expr.kind === "literal" ? " " : formatExpr(card.expr)),
    );
    hand.append(button);
  }
  hand.classList.toggle("has-final-card", state.cards.length === 1);
  const guide = node("p", "target-selection-guide", complete
    ? "四张原牌都用上了。"
    : state.selectedIds.length === 0 ? "先选左边的牌，再选右边的牌。"
      : state.selectedIds.length === 1 ? "左边选好了，再选右边的牌。"
        : "左右已选好，选择运算后合并。");
  table.append(handHeading, hand, guide);

  const operations = node("section", "target-operation");
  operations.setAttribute("aria-label", "合并操作");
  const equation = node("div", "target-equation");
  const operators = node("div", "target-operators");
  operators.setAttribute("role", "group");
  operators.setAttribute("aria-label", "选择运算符");
  for (const operator of OPERATORS) {
    const control = action(operator, "operator-" + operator, () => state.onOperator(operator));
    control.setAttribute("aria-pressed", String(operator === state.operator));
    operators.append(control);
  }
  equation.append(
    operand(state.cards.find((card) => card.id === state.selectedIds[0]), "左"),
    operators,
    operand(state.cards.find((card) => card.id === state.selectedIds[1]), "右"),
  );
  state.preview.classList.add("target-preview");
  state.preview.id = "target-preview";
  const actions = node("div", "target-actions");
  const combine = action("合并", "combine", state.onCombine, { primary: true, disabled: !state.canCombine });
  combine.setAttribute("aria-describedby", "target-preview");
  actions.append(
    combine,
    action("交换左右", "swap", state.onSwap, { disabled: state.selectedIds.length !== 2 }),
    action("撤销一步", "undo", state.onUndo, { disabled: !state.canUndo }),
  );
  if (complete) {
    const completion = node("section", "target-completion");
    completion.dataset.testid = "target-completion";
    completion.append(
      node("h2", "", "四张牌，合成 " + state.target),
      node("p", "target-completion__expression", formatExpr(state.cards[0].expr) + " = " + state.target),
    );
    const choices = node("div", "target-completion__choices");
    choices.append(action("再试这组", "replay", state.onReplay), action("下一组", "next", state.onNext));
    completion.append(choices);
    operations.append(completion, action("撤销一步", "undo", state.onUndo, { disabled: !state.canUndo }));
  } else {
    operations.append(equation, state.preview, actions);
  }
  if (state.feedback.text) {
    const feedback = createFeedbackBanner(state.feedback);
    feedback.classList.add("target-feedback");
    operations.append(feedback);
  }
  if (state.saveNote) operations.append(node("p", "target-save-note", state.saveNote));
  table.append(operations);

  const help = node("section", "target-help");
  const hintButton = action("给我一点提示", "hint", state.onHint);
  hintButton.setAttribute("aria-expanded", String(Boolean(state.hint)));
  hintButton.setAttribute("aria-controls", "target-hint");
  const hintControls = node("div", "target-hint-controls");
  hintControls.append(hintButton);
  if (state.hint) hintControls.append(action("收起提示", "hide-hint", state.onHideHint));
  help.append(hintControls);
  if (state.hint) {
    state.hint.id = "target-hint";
    state.hint.classList.add("target-hint");
    help.append(state.hint);
  }
  const history = node("section", "make-target-history target-history");
  history.dataset.testid = "target-history";
  history.append(node("h2", "", "最近一步"));
  history.append(node("p", "target-history__latest", state.equations.at(-1) ?? "还没有合并步骤。"));
  if (state.equations.length > 1) {
    const details = node("details", "target-history__all");
    details.open = state.historyExpanded;
    details.append(node("summary", "", "展开全部 " + state.equations.length + " 步"));
    const list = node("ol", "");
    for (const equation of state.equations) list.append(node("li", "", equation));
    details.append(list);
    details.addEventListener("toggle", () => {
      if (details.isConnected) state.onHistoryExpanded(details.open);
    });
    history.append(details);
  }
  const footer = node("footer", "target-footer");
  footer.append(node("span", "", "第 " + state.puzzleNumber + " 组 · 目标 " + state.target));
  if (!complete) footer.append(action("换一组牌", "next", state.onNext));
  const rules = node("details", "target-rules");
  rules.append(node("summary", "", "运算小规则"), node("p", "", "每张原牌都要用上。减法左边不小于右边，0 也可以用；除法要整除，不能除以 0。随时可以撤销。"));
  root.replaceChildren(header, table, help, history, footer, rules);
  if (state.changePrompt) {
    const dialog = node("dialog", "target-change");
    dialog.setAttribute("aria-labelledby", "target-change-title");
    dialog.setAttribute("aria-describedby", "target-change-description");
    const title = node("h2", "", state.changePrompt);
    title.id = "target-change-title";
    const description = node("p", "", "这局还没合完。换牌会结束这次尝试，已完成的记录会保留。");
    description.id = "target-change-description";
    const choices = node("div", "target-change__choices");
    choices.append(
      action("取消，继续这局", "cancel-change", state.onCancelChange),
      action("确认换牌", "confirm-change", state.onConfirmChange),
    );
    dialog.append(title, description, choices);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); state.onCancelChange(); });
    root.append(dialog);
    dialog.showModal();
  }
}
