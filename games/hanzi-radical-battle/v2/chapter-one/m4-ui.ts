import { getM3Hero, M3_HEROES } from "./builds";
import { getM4Repair, M4_REPAIR_OBJECTS, type M4RepairId } from "./camp";
import { getChapterOneCharacter } from "./characters";
import { CHAPTER_ONE_SPELLBOOK } from "./spellbook";
import type { ChapterCharacterStructure, ChapterRegionId } from "./content-types";
import type { M3GameState } from "./m3-types";
import type { M4SaveState } from "./m4-save";
import { m5AssetUrl, m5MeaningAssetUrl } from "./m5-assets";
import { v1MeaningAssetUrl } from "../v1/assets";

export type M4OverlayKind = "none" | "spellbook" | "parent" | "repair" | "wheel-workshop";
export type M4SpellbookFilter = "all" | ChapterRegionId | ChapterCharacterStructure;
export interface M4SpellbookView {
  readonly query: string;
  readonly filter: M4SpellbookFilter;
  readonly page: number;
  readonly selectedCharacterId: string | null;
  readonly replayKind: "pronunciation" | "formation" | "meaning" | null;
}

export const FRESH_M4_SPELLBOOK_VIEW: M4SpellbookView = { query: "", filter: "all", page: 0, selectedCharacterId: null, replayKind: null };
export const M4_SPELLBOOK_PAGE_SIZE = 6;

function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function regionLabel(id: ChapterRegionId): string { return ({ "glimmer-grove": "微光林径", "echo-garden": "花园回声", "wind-trail": "风的脚印" })[id]; }
function structureLabel(id: ChapterCharacterStructure): string { return ({ "left-right": "左右", "top-bottom": "上下", "full-enclosure": "全包围", "semi-enclosure": "半包围" })[id]; }

export function renderM4Camp(state: M3GameState, progress: M4SaveState): string {
  const repaired = new Set(progress.repairedObjectIds);
  const workshopReady = repaired.has("magic-tree");
  return `<section class="hm2-panel hm2-camp hm2-m3-camp hm2-m4-camp" data-testid="chapter-one-m3-camp" data-m4-camp data-repair-count="${repaired.size}">
    <div class="hm2-camp-sky" aria-hidden="true"><i></i><i></i><i></i></div><p class="hm2-kicker">第一章营地 · 世界会记住字光</p><h2>墨迹森林在这里慢慢恢复</h2><p>轻触营地里的朋友和物件，或选一位同行伙伴出发。没有金币，也不会因为休息而退步。</p>
    <div class="hm2-camp-world" role="group" aria-label="八个持久营地修复">${M4_REPAIR_OBJECTS.map((repair, index) => {
      const ready = repaired.has(repair.id);
      return `<button type="button" class="hm2-repair-object${ready ? " is-repaired" : ""}" style="--repair-index:${index};--repair-image:url('${m5AssetUrl(`repair-${repair.id}`)}')" data-action="open-repair" data-repair-id="${repair.id}" data-repaired="${String(ready)}" aria-label="${repair.name}，${ready ? "已经修好" : "等待字光"}"><span class="hm2-repair-shape" aria-hidden="true"></span><b>${repair.name}</b><small>${ready ? repair.afterFunction : repair.beforeFunction}</small></button>`;
    }).join("")}</div>
    <div class="hm2-camp-portals"><button type="button" data-action="open-spellbook" class="hm2-spellbook-door"><span aria-hidden="true">▤</span><b>进入魔法书屋</b><small>${progress.discoveredCharacterIds.length}/36 道字光已遇见</small></button><button type="button" class="ww-camp-door${workshopReady ? " is-awake" : " is-sleeping"}" data-action="open-wheel-workshop" data-testid="wheel-workshop-entry" data-wheel-state="${workshopReady ? "ready" : "sleeping"}" ${workshopReady ? "" : "disabled"} aria-label="字轮工坊，${workshopReady ? "魔法树已经唤醒，可以进入" : "魔法树修复后开放"}"><span aria-hidden="true">轮</span><b>字轮工坊</b><small>${workshopReady ? "魔法树的部件回声醒来了" : "修复魔法树后醒来"}</small></button><button type="button" data-action="open-parent" class="hm2-parent-door">家长区</button></div>
    <div class="hm2-hero-grid" role="group" aria-label="三位英雄">${M3_HEROES.map((hero) => `<button type="button" class="hm2-hero-card${state.heroId === hero.id ? " is-selected" : ""}" data-action="select-hero" data-hero-id="${hero.id}" aria-pressed="${String(state.heroId === hero.id)}"><span data-icon-key="${hero.iconKey}" aria-hidden="true" style="background-image:url('${m5AssetUrl(`hero-${hero.id}`)}')"></span><b>${hero.name}</b><small>${hero.shortDescription}</small><em>${hero.innateName}</em></button>`).join("")}</div>
    <button class="hm2-primary" type="button" data-action="start-run">和${getM3Hero(state.heroId).name}出发</button>
  </section>`;
}

function matchesSpellbook(entry: (typeof CHAPTER_ONE_SPELLBOOK)[number], view: M4SpellbookView): boolean {
  const query = view.query.trim().toLocaleLowerCase();
  const matchesQuery = !query || [entry.glyph, entry.pinyinWithToneMarks, entry.familiarWord, entry.shortMeaning, entry.componentGlyphs.join("")].some((value) => value.toLocaleLowerCase().includes(query));
  const matchesFilter = view.filter === "all" || entry.regionId === view.filter || entry.structure === view.filter;
  return matchesQuery && matchesFilter;
}

export function spellbookPageCount(view: M4SpellbookView): number { return Math.max(1, Math.ceil(CHAPTER_ONE_SPELLBOOK.filter((entry) => matchesSpellbook(entry, view)).length / M4_SPELLBOOK_PAGE_SIZE)); }

export function renderM4Spellbook(progress: M4SaveState, view: M4SpellbookView): string {
  const discovered = new Set(progress.discoveredCharacterIds);
  const filtered = CHAPTER_ONE_SPELLBOOK.filter((entry) => matchesSpellbook(entry, view));
  const pageCount = Math.max(1, Math.ceil(filtered.length / M4_SPELLBOOK_PAGE_SIZE));
  const page = Math.min(view.page, pageCount - 1);
  const visible = filtered.slice(page * M4_SPELLBOOK_PAGE_SIZE, (page + 1) * M4_SPELLBOOK_PAGE_SIZE);
  const selected = view.selectedCharacterId ? CHAPTER_ONE_SPELLBOOK.find((entry) => entry.characterId === view.selectedCharacterId) ?? null : null;
  const selectedCharacter = selected ? getChapterOneCharacter(selected.characterId) : null;
  return `<section class="hm2-panel hm2-book" role="dialog" aria-modal="true" aria-labelledby="hm2-book-title" data-testid="chapter-one-spellbook" data-total-entries="36" data-filtered-count="${filtered.length}" data-page="${page + 1}" data-page-count="${pageCount}">
    <div class="hm2-overlay-heading"><div><p class="hm2-kicker">36 字魔法书 · 不记录正确率</p><h2 id="hm2-book-title">重看完整字、读音和字义魔法</h2></div><button type="button" data-action="close-overlay" aria-label="关闭魔法书">关闭</button></div>
    <label class="hm2-book-search">找一个字、词、拼音或部件<input type="search" data-spellbook-search value="${escapeHtml(view.query)}" autocomplete="off" /></label>
    <div class="hm2-book-filters" role="group" aria-label="按区域或结构查看">${([
      ["all", "全部"], ["glimmer-grove", "微光"], ["echo-garden", "花园"], ["wind-trail", "风路"], ["left-right", "左右"], ["top-bottom", "上下"], ["full-enclosure", "全包围"], ["semi-enclosure", "半包围"],
    ] as const).map(([id, label]) => `<button type="button" data-action="filter-spellbook" data-filter="${id}" aria-pressed="${String(view.filter === id)}">${label}</button>`).join("")}</div>
    ${selected && selectedCharacter ? `<article class="hm2-book-detail" data-testid="spellbook-detail" data-character-id="${selected.characterId}" data-replay-kind="${view.replayKind ?? "none"}"><div class="hm2-book-glyph"><span>${selected.glyph}</span><small>${selected.pinyinWithToneMarks}</small></div><div><h3>${selected.familiarWord}</h3><p>${selected.shortMeaning}</p><p><b>${structureLabel(selected.structure)}：</b>${selected.componentGlyphs.join(" ＋ ")} → ${selected.glyph}</p><p><b>${selected.magicName}：</b>${selected.magicEffect}</p><p><b>世界关联：</b>${selected.worldAssociation}</p><small>${selected.meaningImageDisclaimer}</small><div class="hm2-replay-actions"><button type="button" data-action="replay-pronunciation" data-character-id="${selected.characterId}">朗读“${selected.spokenPhrase}”</button><button type="button" data-action="replay-formation" data-character-id="${selected.characterId}">重看合字</button><button type="button" data-action="replay-meaning" data-character-id="${selected.characterId}">重看字义魔法</button></div>${view.replayKind === "formation" ? `<div class="hm2-formation-replay" aria-live="polite">${selected.componentGlyphs.map((glyph) => `<span>${glyph}</span>`).join("<b>＋</b>")}<b>→</b><strong>${selected.glyph}</strong></div>` : view.replayKind === "meaning" ? `<div class="hm2-magic-replay" data-meaning-asset-key="${selected.meaningAssetKey}" aria-live="polite"><i aria-hidden="true" style="background-image:url('${m5MeaningAssetUrl(selected.characterId) ?? v1MeaningAssetUrl(selected.characterId as Parameters<typeof v1MeaningAssetUrl>[0])}')"></i>${selected.magicEffect}</div>` : view.replayKind === "pronunciation" ? `<div class="hm2-pronunciation-replay" aria-live="polite">正在重听：${selected.spokenPhrase}</div>` : ""}</div></article>` : ""}
    <div class="hm2-book-grid" role="list">${visible.length ? visible.map((entry) => { const found = discovered.has(entry.characterId); return `<button type="button" role="listitem" class="hm2-book-card${found ? " is-discovered" : ""}" data-action="select-spellbook-entry" data-character-id="${entry.characterId}" aria-label="${entry.glyph}，${entry.familiarWord}，${found ? "已经遇见" : "还没遇见"}"><span>${entry.glyph}</span><b>${entry.pinyinWithToneMarks}</b><small>${entry.familiarWord} · ${regionLabel(entry.regionId)}</small><em>${found ? "字光已遇见" : "以后会相遇"}</em></button>`; }).join("") : `<p class="hm2-book-empty">没有找到。换一个字、词或部件试试看。</p>`}</div>
    <nav class="hm2-book-pages" aria-label="魔法书分页"><button type="button" data-action="spellbook-previous" ${page === 0 ? "disabled" : ""}>上一页</button><span>${page + 1}/${pageCount}</span><button type="button" data-action="spellbook-next" ${page >= pageCount - 1 ? "disabled" : ""}>下一页</button></nav>
  </section>`;
}

export function renderM4RepairDetail(progress: M4SaveState, repairId: M4RepairId): string {
  const repair = getM4Repair(repairId); const ready = progress.repairedObjectIds.includes(repairId);
  return `<section class="hm2-panel hm2-repair-detail" role="dialog" aria-modal="true" aria-labelledby="hm2-repair-title" data-testid="chapter-one-repair-detail" data-repair-id="${repair.id}" data-repaired="${String(ready)}"><div class="hm2-overlay-heading"><div><p class="hm2-kicker">营地里的持久变化</p><h2 id="hm2-repair-title">${repair.name}</h2></div><button type="button" data-action="close-overlay">回到营地</button></div><div class="hm2-repair-compare"><div data-state="before"><span class="hm2-repair-art" style="background-image:url('${m5AssetUrl(`repair-${repair.id}`)}')"></span><b>修复前 · ${repair.beforeColor}</b><p>${repair.beforeShape}，${repair.beforeFunction}。</p></div><div data-state="after" class="${ready ? "is-visible" : ""}"><span class="hm2-repair-art" style="background-image:url('${m5AssetUrl(`repair-${repair.id}`)}')"></span><b>修复后 · ${repair.afterColor}</b><p>${repair.afterShape}，${repair.afterFunction}。</p></div></div><p>${ready ? "这份修复已经保存在本机。休息多久都不会退步。" : "继续发现完整汉字，这里会自然恢复；不需要金币或每日任务。"}</p><dl><div><dt>给孩子的变化</dt><dd>${repair.childValue}</dd></div><div><dt>汉字学习联系</dt><dd>${repair.hanziLearningValue}</dd></div></dl></section>`;
}

export function renderM4Parent(progress: M4SaveState, clearArmed: boolean, readOnly: boolean, wheelDiscoveredCount = 0, wheelReadOnly = false): string {
  return `<section class="hm2-panel hm2-parent" role="dialog" aria-modal="true" aria-labelledby="hm2-parent-title" data-testid="chapter-one-parent" data-clear-armed="${String(clearArmed)}"><div class="hm2-overlay-heading"><div><p class="hm2-kicker">家长区 · 本机摘要</p><h2 id="hm2-parent-title">隐私与本地进度</h2></div><button type="button" data-action="close-overlay">关闭</button></div><p>无账号、无上传、无广告；只保存发现字、八个修复、英雄、设置、当前安全路线、已见能力、聚合事件，以及字轮工坊的最低必要发现。不会保存详细按键历史。</p><dl><div><dt>发现字</dt><dd>${progress.discoveredCharacterIds.length}/36</dd></div><div><dt>营地修复</dt><dd>${progress.repairedObjectIds.length}/8</dd></div><div><dt>字轮发现</dt><dd>${wheelDiscoveredCount}</dd></div><div><dt>完成冒险</dt><dd>${progress.minimalLocalEvents.completedRuns}</dd></div><div><dt>存档状态</dt><dd>${readOnly ? "较新版本，只读保护" : progress.migration.source === "v1-schema-4" ? "已保留并迁移 V1" : "V2 本地存档"}${wheelReadOnly ? "；工坊较新版本只读" : ""}</dd></div></dl><div class="hm2-clear-zone"><p>${clearArmed ? `再次确认会清除 V2 第一章${wheelReadOnly ? "本地进度；较新版本工坊存档仍受只读保护" : "与字轮工坊本地进度"}；V1 冻结存档与旧路由不会被删除。` : "清除需要两次明确确认，避免误触。"}</p><button type="button" data-action="${clearArmed ? "confirm-clear-progress" : "arm-clear-progress"}" ${readOnly ? "disabled" : ""}>${clearArmed ? "再次确认清除" : "清除本地进度"}</button>${clearArmed ? `<button type="button" data-action="cancel-clear-progress">取消</button>` : ""}</div></section>`;
}
