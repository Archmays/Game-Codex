import type { MountedGame } from "../../../../packages/game-core";
import { COMPLETE_SPELLBOOK_ENTRIES, getCompleteSpellbookEntry } from "../spellbook/catalog";
import {
  readCompleteSave,
  updateCompleteSave,
  writeCompleteSave,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../save/complete-save";
import "../ui/spellbook.css";

export interface MountCompleteSpellbookOptions {
  readonly storage?: CompleteStorageLike;
  readonly returnHref?: string;
}

type SpellbookFilter = "all" | "story" | "optional" | "visited";
const MEMORY_STORAGE = new Map<string, string>();

function browserStorage(): CompleteStorageLike {
  try { return window.localStorage; } catch {
    return { getItem: (key) => MEMORY_STORAGE.get(key) ?? null, setItem: (key, value) => { MEMORY_STORAGE.set(key, value); }, removeItem: (key) => { MEMORY_STORAGE.delete(key); } };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function slotLabel(slotId: string): string {
  return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面" } as Record<string, string>)[slotId] ?? slotId;
}

function entryDetail(entryId: string, visualStatus: string): string {
  const entry = getCompleteSpellbookEntry(entryId);
  return `<article class="hmcs-detail" data-testid="complete-spellbook-detail" data-character-id="${entry.id}">
    <div class="hmcs-glyph" aria-label="汉字 ${entry.glyph}">${entry.glyph}</div>
    <div class="hmcs-meaning"><p class="hmcs-kicker">${entry.magicName}</p><h2>${entry.pinyin}</h2><b>${entry.familiarWord}</b><p>${entry.shortMeaning}</p></div>
    <section><h3>结构与部件</h3><p>${entry.structureLabel}</p><div class="hmcs-equation">${entry.components.map((component) => `<span>${component.glyph}<small>${slotLabel(component.slotId)}</small></span>`).join("<b>＋</b>")}<b>→</b><strong>${entry.glyph}</strong></div></section>
    <section><h3>字脉</h3>${entry.familyLinks.length ? `<ul>${entry.familyLinks.map((family) => `<li><b>${family.name}</b><span>${family.explanation}</span></li>`).join("")}</ul>` : `<p>这道字光暂时没有放进十八条共享部件字脉。</p>`}</section>
    <section><h3>词语</h3>${entry.wordLinks.length ? `<div class="hmcs-word-links">${entry.wordLinks.map((word) => `<span><b>${word.glyphs}</b><small>${word.pinyin} · ${word.shortMeaning}</small></span>`).join("")}</div>` : `<p>先用熟悉词“${entry.familiarWord}”理解这道字光。</p>`}</section>
    <section><h3>字义魔法与联想图</h3><p><b>${entry.magicName}：</b>${entry.magicEffect}</p><p>${entry.associationDescription}</p></section>
    <div class="hmcs-replays" aria-label="重看这道字光"><button type="button" data-replay="formation">重看合字</button><button type="button" data-replay="pronunciation">听完整字和词</button><button type="button" data-replay="meaning">重看字义</button></div>
    <p class="hmcs-status" role="status">${escapeHtml(visualStatus || "选择一种重看方式，文字反馈会留在这里。")}</p>
    <p class="hmcs-future">未来笔灵台还在远处睡着；这里不会放进没完成的书写关卡。</p>
  </article>`;
}

export function mountCompleteSpellbook(root: HTMLElement, options: MountCompleteSpellbookOptions = {}): MountedGame {
  const storage = options.storage ?? browserStorage();
  const read = readCompleteSave(storage);
  let save: CompleteSaveState = read.state;
  let filter: SpellbookFilter = "all";
  let selectedId = COMPLETE_SPELLBOOK_ENTRIES[0].id;
  let visualStatus = "";
  let destroyed = false;
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";

  const visibleEntries = () => COMPLETE_SPELLBOOK_ENTRIES.filter((entry) => filter === "all"
    || (filter === "story" && entry.band === "story-required")
    || (filter === "optional" && entry.band === "optional")
    || (filter === "visited" && save.discoveredCharacterIds.includes(entry.id)));
  const render = () => {
    const entries = visibleEntries();
    if (!entries.some((entry) => entry.id === selectedId)) selectedId = entries[0]?.id ?? COMPLETE_SPELLBOOK_ENTRIES[0].id;
    root.innerHTML = `<main class="hmcs-shell" data-testid="complete-spellbook" data-entry-count="${COMPLETE_SPELLBOOK_ENTRIES.length}" data-filter="${filter}" data-muted="${String(save.settings.muted)}">
      <header><a href="${escapeHtml(returnHref)}" aria-label="返回墨迹森林">← 森林</a><div><span>万象书屋</span><h1>七十二道完整字光</h1></div><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button></header>
      ${!read.writable ? `<p class="hmcs-save-note" role="status">发现较新版本存档：当前只读，不会覆盖。</p>` : ""}
      <nav class="hmcs-filters" aria-label="选择字卷"><button type="button" data-filter="all" aria-pressed="${String(filter === "all")}">整片森林</button><button type="button" data-filter="story" aria-pressed="${String(filter === "story")}">故事字光</button><button type="button" data-filter="optional" aria-pressed="${String(filter === "optional")}">可选微光</button><button type="button" data-filter="visited" aria-pressed="${String(filter === "visited")}">旅途中见过</button></nav>
      <div class="hmcs-layout"><section class="hmcs-index" aria-label="汉字字卷">${entries.length ? entries.map((entry) => `<button type="button" data-character-id="${entry.id}" aria-pressed="${String(entry.id === selectedId)}"><b>${entry.glyph}</b><span>${entry.pinyin}</span></button>`).join("") : `<p>这条筛选里还没有旅途中见过的字；换一本字卷就能继续看。</p>`}</section>${entryDetail(selectedId, visualStatus)}</div>
      <footer>本地匿名保存 · 无排名 · 随时重看 · 不要求集齐</footer>
    </main>`;
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!target || !root.contains(target)) return;
    if (target.dataset.characterId) { selectedId = target.dataset.characterId; visualStatus = ""; render(); root.querySelector<HTMLElement>(`[data-character-id="${selectedId}"]`)?.focus(); return; }
    if (target.dataset.filter) { filter = target.dataset.filter as SpellbookFilter; visualStatus = ""; render(); root.querySelector<HTMLElement>(`[data-filter="${filter}"]`)?.focus(); return; }
    if (target.dataset.pref === "muted" && read.writable) {
      save = updateCompleteSave(save, { settings: { ...save.settings, muted: !save.settings.muted } }); writeCompleteSave(storage, save); render(); return;
    }
    const entry = getCompleteSpellbookEntry(selectedId);
    if (target.dataset.replay === "formation") visualStatus = `${entry.glyph}的真实合字顺序：${entry.replayFormation}`;
    if (target.dataset.replay === "meaning") visualStatus = entry.replayMeaning;
    if (target.dataset.replay === "pronunciation") {
      visualStatus = `正在重看：${entry.replayPronunciation}`;
      if (!save.settings.muted && typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined") {
        speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(entry.replayPronunciation); utterance.lang = "zh-CN"; utterance.rate = .86; speechSynthesis.speak(utterance);
      }
    }
    if (target.dataset.replay) { render(); root.querySelector<HTMLElement>(`[data-replay="${target.dataset.replay}"]`)?.focus(); }
  };
  root.addEventListener("click", click); render();
  return { destroy() { destroyed = true; void destroyed; root.removeEventListener("click", click); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); root.replaceChildren(); } };
}
