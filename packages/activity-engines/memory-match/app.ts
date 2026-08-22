import type { MountedGame } from "../../game-core";
import { closeMemoryMismatch, createMemoryState, flipMemoryCard } from "./machine";
import { CHINESE_MEMORY_PACKS, getMemoryPack, PINYIN_STARTER_CHARACTER_IDS } from "./packs";
import { readLegacyMemoryPresence, readMemorySave, writeMemorySave, type MemoryMatchSave } from "./save";
import type { MatchRelation, MemoryMatchPack, MemoryMatchState } from "./types";
import "./styles.css";

export interface MountMemoryMatchOptions {
  readonly packId?: string;
  readonly seed?: string;
  readonly pairCount?: number;
  readonly returnHref?: string;
  readonly context?: "classic" | "hanzi";
  readonly storage?: Storage;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

export function mountMemoryMatch(root: HTMLElement, options: MountMemoryMatchOptions = {}): MountedGame {
  let pack = getMemoryPack(options.packId ?? (options.context === "hanzi" ? "glyph-pinyin" : "same-glyph"));
  const seed = options.seed?.trim() || "forest-light";
  const pairCount = Math.max(4, Math.min(6, options.pairCount ?? pack.defaultPairCount));
  const storage = options.storage ?? window.localStorage;
  const returnHref = options.returnHref ?? (options.context === "hanzi" ? "?play=hanzi-magic-complete&from=hub" : "?hub=classic&from=world");
  const discoveredCharacterIds = (() => {
    if (options.context !== "hanzi") return [] as string[];
    try { const parsed = JSON.parse(storage.getItem("family-games/hanzi-magic-complete/v3") ?? "null") as { discoveredCharacterIds?: unknown } | null; return Array.isArray(parsed?.discoveredCharacterIds) ? parsed.discoveredCharacterIds.filter((id): id is string => typeof id === "string") : []; }
    catch { return []; }
  })();
  const preferredRelationIds = (activePack: MemoryMatchPack) => {
    const preferred = activePack.relations.filter((relation) => discoveredCharacterIds.some((id) => relation.id.includes(id))).map((relation) => relation.id);
    if (preferred.length >= pairCount) return preferred;
    const starters = activePack.relations.filter((relation) => PINYIN_STARTER_CHARACTER_IDS.some((id) => relation.id.includes(id))).map((relation) => relation.id);
    return [...new Set([...preferred, ...starters])];
  };
  let state = createMemoryState(pack, seed, pairCount, preferredRelationIds(pack));
  let save: MemoryMatchSave = readMemorySave(pack.id, pack.revisionHash, storage);
  readLegacyMemoryPresence(storage);
  let timer: number | undefined;
  let destroyed = false;
  let announcement = "每次翻开两张，找到有关系的一对。";
  let focusInstanceId: string | null = null;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const relationById = (id: string): MatchRelation => pack.relations.find((relation) => relation.id === id)!;
  const isComplete = () => state.matchedRelationIds.length === state.cards.length / 2;
  const persist = () => writeMemorySave({ ...save, selectedPackId: pack.id, contentRevision: pack.revisionHash }, storage);

  const render = () => {
    const completed = isComplete();
    root.innerHTML = `<main class="memory-match ${options.context === "hanzi" ? "is-hanzi" : "is-classic"}" data-testid="memory-match" data-pack="${pack.id}" data-complete="${String(completed)}">
      <header><a href="${escapeHtml(returnHref)}">← ${options.context === "hanzi" ? "回到墨迹森林" : "回到游戏百宝箱"}</a><p>${options.context === "hanzi" ? "营地里的回声小径" : "看一看，想一想，再翻开"}</p><h1>${options.context === "hanzi" ? "字光配对" : "记忆配对"}</h1><span>不计时 · 不排名 · 可以慢慢找</span></header>
      <nav class="memory-match__packs" aria-label="选择配对内容">${CHINESE_MEMORY_PACKS.map((item) => `<button type="button" data-pack-id="${item.id}" aria-pressed="${String(item.id === pack.id)}"><b>${item.title}</b><small>${item.id === "same-glyph" ? "找到两张同样的字" : item.id === "glyph-pinyin" ? "把汉字和读音连起来" : "把汉字放回熟悉词语"}</small></button>`).join("")}</nav>
      <section class="memory-match__play"><div class="memory-match__found" role="status">已找到 ${state.matchedRelationIds.length}/${state.cards.length / 2}</div>
      <div class="memory-match__grid" role="grid" aria-label="${pack.title}，${state.cards.length} 张卡片" style="--card-count:${state.cards.length}">${state.cards.map((card) => {
        const open = state.openInstanceIds.includes(card.instanceId) || state.matchedRelationIds.includes(card.relationId);
        const matched = state.matchedRelationIds.includes(card.relationId);
        return `<button type="button" role="gridcell" data-card-id="${escapeHtml(card.instanceId)}" data-relation-id="${escapeHtml(card.relationId)}" data-open="${String(open)}" data-matched="${String(matched)}" ${matched ? "disabled" : ""} aria-label="${open ? escapeHtml(card.face.ariaLabel) : `第 ${card.position + 1} 张，未翻开的卡片`}" aria-rowindex="${Math.floor(card.position / (state.cards.length > 8 ? 4 : 3)) + 1}" aria-colindex="${card.position % (state.cards.length > 8 ? 4 : 3) + 1}"><span class="memory-match__back" aria-hidden="true">光</span><span class="memory-match__face">${escapeHtml(card.face.text ?? "")}</span></button>`;
      }).join("")}</div>
      <div class="memory-match__announcement" aria-live="polite">${escapeHtml(completed ? "这些关系都找到了。" : announcement)}</div>
      <div class="memory-match__controls"><button type="button" data-action="restart">重新铺开</button></div></section>
      ${completed ? `<section class="memory-match__done" data-testid="memory-complete"><span aria-hidden="true">✦</span><h2>这些关系都找到了。</h2><p>每一对字光都回到了自己的位置。</p><button type="button" data-action="restart">再找一轮</button></section>` : ""}
      </main>`;
    if (focusInstanceId) root.querySelector<HTMLButtonElement>(`[data-card-id="${CSS.escape(focusInstanceId)}"]`)?.focus({ preventScroll: true });
  };

  const restart = () => {
    window.clearTimeout(timer);
    state = createMemoryState(pack, seed, pairCount, preferredRelationIds(pack));
    announcement = "卡片重新铺好了。";
    focusInstanceId = state.cards[0]?.instanceId ?? null;
    render();
  };
  const choosePack = (next: MemoryMatchPack) => {
    pack = next;
    save = { ...save, selectedPackId: pack.id, contentRevision: pack.revisionHash };
    persist();
    restart();
  };
  const flip = (instanceId: string) => {
    if (state.locked) return;
    focusInstanceId = instanceId;
    const beforeMatched = state.matchedRelationIds.length;
    state = flipMemoryCard(state, instanceId);
    if (state.matchedRelationIds.length > beforeMatched) {
      const relationId = state.matchedRelationIds.at(-1)!;
      const relation = relationById(relationId);
      announcement = relation.explanation;
      save = { ...save, recentRelationIds: [...new Set([...save.recentRelationIds, relationId])].slice(-24) };
      persist();
    } else if (state.locked) {
      announcement = "这两张关系还没连上，记住它们的位置，再找一找。";
      timer = window.setTimeout(() => { if (!destroyed) { state = closeMemoryMismatch(state); render(); } }, reducedMotion ? 80 : 650);
    } else {
      announcement = "第一张已经翻开，再找它的伙伴。";
    }
    render();
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!target) return;
    if (target.dataset.cardId) flip(target.dataset.cardId);
    if (target.dataset.packId) choosePack(getMemoryPack(target.dataset.packId));
    if (target.dataset.action === "restart") restart();
  };
  const keydown = (event: KeyboardEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-card-id]");
    if (!target) return;
    const index = state.cards.findIndex((card) => card.instanceId === target.dataset.cardId);
    const columns = state.cards.length > 8 ? 4 : 3;
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : 0;
    if (!delta) return;
    event.preventDefault();
    const nextIndex = (index + delta + state.cards.length) % state.cards.length;
    focusInstanceId = state.cards[nextIndex].instanceId;
    root.querySelector<HTMLButtonElement>(`[data-card-id="${CSS.escape(focusInstanceId)}"]`)?.focus();
  };

  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  render();
  persist();
  return { destroy() { destroyed = true; window.clearTimeout(timer); root.removeEventListener("click", click); root.removeEventListener("keydown", keydown); root.replaceChildren(); } };
}
