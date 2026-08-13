import type { MountedGame } from "../../../../packages/game-core";
import { CHAPTER_ONE_CHARACTERS } from "./characters";
import { auditAllChapterHands } from "./hands";
import type { ChapterCharacter } from "./content-types";
import "./styles.css";

const SHEET_SIZE = 6;

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function structureLabel(character: ChapterCharacter): string {
  return ({
    "left-right": "左右",
    "top-bottom": "上下",
    "full-enclosure": "全包围",
    "semi-enclosure": "半包围",
  })[character.structure];
}

function slotLabel(slotId: string): string {
  return ({ left: "左", right: "右", top: "上", bottom: "下", outer: "外框", inner: "内部" } as Record<string, string>)[slotId] ?? slotId;
}

function renderStructure(character: ChapterCharacter): string {
  return `<div class="hm2-audit-structure hm2-audit-structure--${character.structure}" data-testid="audit-structure" data-structure="${character.structure}" aria-label="${structureLabel(character)}结构">
    ${character.orderedComponents.map((component) => `<div class="hm2-audit-slot" data-slot-id="${component.slotId}" data-component-glyph="${escapeHtml(component.glyph)}"><span>${slotLabel(component.slotId)}</span><b>${escapeHtml(component.glyph)}</b></div>`).join("")}
  </div>`;
}

function renderCard(character: ChapterCharacter): string {
  const handAudits = auditAllChapterHands().filter((entry) => entry.characterId === character.id);
  const visualUrl = `/${character.sourceMapping.visualHintPath.replace(/^public\//, "")}`;
  return `<article class="hm2-audit-card" data-testid="character-audit-card" data-character-id="${character.id}" data-glyph="${character.glyph}" data-hand-audit="${handAudits.every((entry) => entry.passed) ? "PASS" : "FAIL"}">
    <header><div class="hm2-audit-glyph" data-testid="audit-complete-glyph" aria-label="完整汉字 ${character.glyph}">${character.glyph}</div><div><h2>${character.glyph} <small>${character.pinyinWithToneMarks}</small></h2><p>${character.familiarWord} · ${character.shortMeaning}</p></div></header>
    <div class="hm2-audit-core">${renderStructure(character)}<figure><img src="${visualUrl}" alt="${character.glyph}的本地字义视觉提示"><figcaption>${character.magicName}</figcaption></figure></div>
    <dl><div><dt>有序部件</dt><dd>${character.orderedComponents.map((entry) => `${entry.glyph}→${slotLabel(entry.slotId)}`).join(" · ")}</dd></div><div><dt>来源 ID</dt><dd>${character.sourceMapping.unicodeCodePoint} · ${character.sourceMapping.formulaAuditSource}</dd></div><div><dt>风险</dt><dd>${escapeHtml(character.ambiguityRisk)}</dd></div><div><dt>唯一解</dt><dd>${handAudits.length}/3 变体 PASS</dd></div></dl>
    <p class="hm2-audit-magic"><b>${character.magicName}</b>：${character.magicEffect}</p>
  </article>`;
}

export function mountChapterOneContentAudit(root: HTMLElement, requestedSheet = 0): MountedGame {
  const sheetCount = Math.ceil(CHAPTER_ONE_CHARACTERS.length / SHEET_SIZE);
  const sheet = Math.max(0, Math.min(sheetCount - 1, Math.trunc(requestedSheet)));
  const characters = CHAPTER_ONE_CHARACTERS.slice(sheet * SHEET_SIZE, (sheet + 1) * SHEET_SIZE);
  const link = (target: number, label: string) => `<a href="?play=hanzi-v2-chapter-one&mode=content-audit&sheet=${target}" data-audit-nav="${target}">${label}</a>`;
  root.innerHTML = `<main class="hm2-audit-shell" data-testid="chapter-one-content-audit" data-sheet="${sheet}" data-sheet-count="${sheetCount}">
    <header class="hm2-audit-header"><div><p>机器／成人证据页 · 不进入儿童首屏</p><h1>第一章 36 字结构审查卡</h1></div><div><b>${String(sheet + 1).padStart(2, "0")}/${String(sheetCount).padStart(2, "0")}</b><span>每卡同时显示真实结构与完整字</span></div></header>
    <section class="hm2-audit-grid" aria-label="第 ${sheet + 1} 组结构审查卡">${characters.map(renderCard).join("")}</section>
    <nav class="hm2-audit-nav" aria-label="结构审查卡分页">${sheet > 0 ? link(sheet - 1, "← 上一组") : "<span></span>"}<a href="?play=hanzi-v2-chapter-one&from=hub">返回游戏</a>${sheet < sheetCount - 1 ? link(sheet + 1, "下一组 →") : "<span></span>"}</nav>
  </main>`;
  return { destroy() { root.replaceChildren(); } };
}
