import { findChapterManifest } from './levels/manifest';
import { evaluateArrangementOutcome } from './solver';
import type { CompletionCheckpoint, PublishedEquationSliderLevel } from './types';
import type { TilePosition } from './render-model';

export function createPageHeader(title: string, subtitle: string): HTMLElement {
  const header = element("header", "equation-slider__page-header");
  const copy = element("div");
  copy.append(element("h2", "", title), element("p", "", subtitle));
  header.append(copy);
  return header;
}

export function targetLabel(level: PublishedEquationSliderLevel): string {
  if (level.mode === "equality") return "平衡目标";
  return level.mode === "multi-target" ? "多目标" : "目标";
}

export function targetValue(level: PublishedEquationSliderLevel): string {
  if (level.mode === "equality") return `= ${level.targets[0].rightExpression.join(" ")}`;
  return level.targets.map((target) => target.value).join(" · ");
}

export function displayExpression(level: PublishedEquationSliderLevel, indexes: readonly number[]): string {
  const outcome = evaluateArrangementOutcome(level, indexes);
  if (level.mode === "equality") {
    // An equation is an achieved relationship, not an assertion about every
    // attempted board. Never display a false equality as mathematical fact.
    const relation = outcome.result === undefined || outcome.rightResult === undefined
      ? " ? "
      : outcome.valid ? " = " : " ≠ ";
    return outcome.expressionText.replace(" = ", relation);
  }
  return `${outcome.expressionText} = ${outcome.result ?? "?"}`;
}

export function chapterName(level: PublishedEquationSliderLevel): string {
  return findChapterManifest(level.chapterId)?.name ?? "算式滑轨";
}

export function stationName(level: PublishedEquationSliderLevel): string {
  return findChapterManifest(level.chapterId)?.units.find((station) => station.id === level.stationId)?.name
    ?? "学习站";
}

export function completionHeading(checkpoint: CompletionCheckpoint): string {
  if (checkpoint.kind === "chapter-review") return "线路完成";
  if (checkpoint.kind === "station-review") return "站区完成";
  if (checkpoint.kind === "rest") return "本关完成 · 小发现";
  return "本关完成";
}

export function completionReflection(
  checkpoint: CompletionCheckpoint,
  level: PublishedEquationSliderLevel
): string {
  if (checkpoint.kind === "chapter-review") {
    return `线路回顾：${level.learning.reflection}`;
  }
  if (checkpoint.kind === "station-review") {
    return `站区回顾：${level.learning.reflection}`;
  }
  if (checkpoint.kind === "rest") {
    return `小发现（可以直接去下一关）：${level.learning.reflection}`;
  }
  return `本关回顾：${level.learning.reflection}`;
}

export function positionLabel(position: TilePosition): string {
  if (position === "previous") return "上方";
  if (position === "next") return "下方";
  return "中央";
}

export function wrapThree(index: number): number {
  return ((index % 3) + 3) % 3;
}

export function button(
  label: string,
  onClick: () => void,
  className = "ui-button",
  signal?: AbortSignal
): HTMLButtonElement {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", onClick, signal ? { signal } : undefined);
  if (!node.textContent) node.textContent = label;
  return node;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
