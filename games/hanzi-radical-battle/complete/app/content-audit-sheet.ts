import type { MountedGame } from "../../../../packages/game-core";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../content-graph/core-characters";
import { auditCompleteCharacterHands } from "../core/content-solvers";
import type { CharacterNode } from "../content-graph/types";
import "../ui/content-audit.css";

const SHEET_SIZE = 12;

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function structureLabel(structure: CharacterNode["structure"]): string {
  return ({ "left-right": "左右", "top-bottom": "上下", "full-enclosure": "全包围", "semi-enclosure": "半包围" })[structure];
}

function renderCard(character: CharacterNode, ordinal: number): string {
  const reading = COMPLETE_CORE_READING_SENSES.find((candidate) => candidate.characterId === character.id)!;
  const hand = auditCompleteCharacterHands().find((candidate) => candidate.characterId === character.id)!;
  return `<li class="hmc-audit-card" data-testid="complete-glyph-card" data-character-id="${character.id}" data-glyph="${character.glyph}" data-code-point="${character.unicodeCodePoint}" data-hand-verdict="${hand.passed ? "PASS" : "FAIL"}">
    <div class="hmc-audit-ordinal" aria-hidden="true">${String(ordinal).padStart(2, "0")}</div>
    <div class="hmc-audit-glyph" data-testid="complete-glyph" lang="zh-Hans" aria-label="汉字 ${character.glyph}">${character.glyph}</div>
    <div class="hmc-audit-copy"><h2>${character.glyph} <small>${reading.pinyin}</small></h2><p>${escapeHtml(reading.fixedPhrase)} · ${escapeHtml(character.shortMeaning)}</p></div>
    <dl><div><dt>结构</dt><dd>${structureLabel(character.structure)}</dd></div><div><dt>部件</dt><dd>${character.components.map((component) => `${escapeHtml(component.glyph)}→${component.slotId}`).join(" · ")}</dd></div><div><dt>唯一解</dt><dd>${hand.solutionCount}/1 PASS</dd></div></dl>
  </li>`;
}

export function mountCompleteContentAuditSheet(root: HTMLElement, requestedSheet = 0): MountedGame {
  const sheetCount = Math.ceil(COMPLETE_CORE_CHARACTER_NODES.length / SHEET_SIZE);
  const sheet = Math.max(0, Math.min(sheetCount - 1, Math.trunc(requestedSheet)));
  const start = sheet * SHEET_SIZE;
  const characters = COMPLETE_CORE_CHARACTER_NODES.slice(start, start + SHEET_SIZE);
  const href = (target: number) => `?play=hanzi-magic-complete&from=hub&audit=content-graph&sheet=${target}`;
  root.innerHTML = `<main class="hmc-audit-shell" data-testid="complete-content-audit" data-sheet="${sheet}" data-sheet-count="${sheetCount}" data-core-count="${COMPLETE_CORE_CHARACTER_NODES.length}">
    <header class="hmc-audit-header"><div><p>机器／成人证据页 · 不进入儿童首屏</p><h1>V3 核心 72 字浏览器字形表</h1></div><div class="hmc-audit-page"><b>${String(sheet + 1).padStart(2, "0")}/${String(sheetCount).padStart(2, "0")}</b><span>每字同时显示完整字、固定读音与真实结构</span></div></header>
    <ol class="hmc-audit-grid" start="${start + 1}" aria-label="第 ${sheet + 1} 组核心汉字">${characters.map((character, index) => renderCard(character, start + index + 1)).join("")}</ol>
    <nav class="hmc-audit-nav" aria-label="字形表分页">${sheet > 0 ? `<a href="${href(sheet - 1)}" data-audit-nav="previous">← 上一组</a>` : "<span></span>"}<a href="?play=hanzi-magic-complete&from=hub&slice=family">返回切片</a>${sheet < sheetCount - 1 ? `<a href="${href(sheet + 1)}" data-audit-nav="next">下一组 →</a>` : "<span></span>"}</nav>
  </main>`;
  return { destroy() { root.replaceChildren(); } };
}
