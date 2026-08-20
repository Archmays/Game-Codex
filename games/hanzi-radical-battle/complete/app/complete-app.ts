import type { MountedGame } from "../../../../packages/game-core";
import { M3_HEROES, type M3HeroId } from "../../v2/chapter-one/builds";
import { m5AssetUrl } from "../../v2/chapter-one/m5-assets";
import { createCompleteEngineState, reduceCompleteEngineState } from "../core/complete-machine";
import type { CompleteEngineAction, CompleteEngineState } from "../core/complete-types";
import { COMPLETE_REPAIR_IDS } from "../core/world-contracts";
import {
  clearAllHanziProgress,
  clearCompleteSave,
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  writeCompleteSave,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../save/complete-save";
import "../ui/complete-world.css";

export interface MountCompleteAppOptions {
  readonly storage?: CompleteStorageLike;
  readonly fresh?: boolean;
  readonly returnHref?: string;
  readonly requestedChapter?: "chapter-two" | "chapter-three" | null;
  readonly onStateChange?: (state: CompleteEngineState) => void;
}

export interface MountedCompleteApp extends MountedGame {
  getState(): CompleteEngineState;
  getSave(): CompleteSaveState;
  dispatch(action: CompleteEngineAction): void;
}

const MEMORY_STORAGE = new Map<string, string>();
function browserStorage(): CompleteStorageLike {
  try {
    const key = "family-games/hanzi-complete-storage-test";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return {
      getItem: (key) => MEMORY_STORAGE.get(key) ?? null,
      setItem: (key, value) => { MEMORY_STORAGE.set(key, value); },
      removeItem: (key) => { MEMORY_STORAGE.delete(key); },
    };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

const REPAIR_NAMES: Readonly<Record<string, string>> = {
  "camp-lamp": "营地灯",
  "garden-path": "花园小径",
  "world-gate": "世界门",
  "magic-tree": "魔法树",
  "little-bridge": "清泉小桥",
  "spellbook-house": "魔法书屋",
  "ink-companion-house": "墨点小屋",
  "stargazing-platform": "观星台",
  "tree-canopy-bridge": "树冠桥",
  "spring-waterwheel": "清泉水轮",
  "door-shadow-corridor": "门影长廊",
  "component-root-heart": "部件根心",
  "home-lantern-street": "家灯街",
  "book-page-harbor": "书页港",
  "constellation-lighthouse": "星图灯塔",
  "word-heart": "词语字心",
};

function heroCard(heroId: M3HeroId): string {
  const hero = M3_HEROES.find((candidate) => candidate.id === heroId)!;
  return `<article class="hmc3-hero" data-testid="complete-current-hero" data-hero-id="${hero.id}">
    <div class="hmc3-hero-portrait" style="--hero-image:url('${m5AssetUrl(hero.iconKey)}')" aria-hidden="true"></div>
    <div><p>同行伙伴</p><h2>${hero.name}</h2><span>${hero.shortDescription}</span></div>
  </article>`;
}

function chapterPath(state: CompleteEngineState): string {
  const landmarks = [
    { id: "chapter-one", label: "墨迹初醒", place: "旧林营地" },
    { id: "chapter-two", label: "字脉苏醒", place: "树冠与清泉" },
    { id: "chapter-three", label: "万象共鸣", place: "家灯与书港" },
  ] as const;
  return `<ol class="hmc3-path" aria-label="森林旅途">${landmarks.map((landmark) => {
    const complete = state.completedChapterIds.includes(landmark.id);
    const unlocked = state.unlockedChapterIds.includes(landmark.id);
    const current = state.activeChapterId === landmark.id;
    return `<li data-chapter-id="${landmark.id}" data-status="${complete ? "complete" : current ? "current" : unlocked ? "open" : "sleeping"}"><span aria-hidden="true">${complete ? "✦" : current ? "◆" : unlocked ? "◇" : "·"}</span><div><b>${landmark.label}</b><small>${landmark.place}</small></div></li>`;
  }).join("")}<li data-status="sleeping"><span aria-hidden="true">·</span><div><b>字光归林</b><small>森林深处</small></div></li></ol>`;
}

function worldPrimary(state: CompleteEngineState): string {
  if (state.activeChapterId === "chapter-one") return `<a class="hmc3-primary" data-testid="complete-primary-action" href="?play=hanzi-magic-complete&from=hub&chapter=one">走进第一条发光林路</a>`;
  const chapter = state.activeChapterId === "chapter-two" ? "two" : "three";
  return `<a class="hmc3-primary" data-testid="complete-primary-action" href="?play=hanzi-magic-complete&from=hub&chapter=${chapter}">${state.activeChapterId === "chapter-two" ? "走向字脉树冠" : "沿家灯前往书港"}</a>`;
}

function renderWorld(state: CompleteEngineState, save: CompleteSaveState, readSource: string, readOnly: boolean, parentClearArmed: boolean, returnHref: string): string {
  const repaired = COMPLETE_REPAIR_IDS.filter((id) => save.repairedObjectIds.includes(id)).slice(-3);
  return `<main class="hmc3-shell" data-testid="hanzi-magic-complete" data-screen="world" data-hero-id="${state.heroId}" data-active-chapter="${state.activeChapterId}" data-save-source="${readSource}" data-save-read-only="${String(readOnly)}" data-discovered-count="${save.discoveredCharacterIds.length}" data-repair-count="${save.repairedObjectIds.length}" data-migration-sources="${save.migration.sources.join(",")}" style="--world-image:url('${m5AssetUrl("region-glimmer-grove")}')">
    <div class="hmc3-world-art" aria-hidden="true"><div class="hmc3-canopy"></div><div class="hmc3-lights"></div><div class="hmc3-path-light"></div></div>
    <header class="hmc3-header"><a href="${escapeHtml(returnHref)}" aria-label="返回我的游戏世界">← 游戏世界</a><div><span>汉字魔法战</span><h1>墨迹森林 · 字光归林</h1></div><button type="button" data-action="toggle-parent" aria-label="打开家长角" aria-expanded="${String(parentClearArmed)}">家长角</button></header>
    ${readOnly ? `<div class="hmc3-save-note" role="status">发现较新版本存档：当前只读，不会覆盖。</div>` : readSource.includes("migrated") || readSource === "legacy-merged" ? `<div class="hmc3-save-note" role="status">旧冒险的字光已安全接回；原存档字节仍保留。</div>` : ""}
    <section class="hmc3-world-panel" aria-label="当前森林场景">
      <div class="hmc3-story"><p class="hmc3-place">墨迹森林营地</p><h2>${state.completedChapterIds.includes("chapter-one") ? "树冠上又亮起了一条路" : "营地灯在等第一道完整字光"}</h2><p>${escapeHtml(state.gentleMessage)}</p>${worldPrimary(state)}<small>本地保存 · 无登录 · 无排名 · 随时可以停下</small></div>
      ${heroCard(state.heroId)}
      <section class="hmc3-repairs" aria-label="场景里的修复"><h2>森林里已经亮着</h2>${repaired.length ? `<ul>${repaired.map((id) => `<li data-repair-id="${id}"><span aria-hidden="true">✦</span>${REPAIR_NAMES[id]}</li>`).join("")}</ul>` : `<p>第一盏营地灯会在完成汉字后亮起。</p>`}</section>
      <section class="hmc3-journey" aria-label="森林路线"><h2>前方的林路</h2>${chapterPath(state)}</section>
    </section>
    <footer class="hmc3-footer"><div class="hmc3-hero-switch" aria-label="选择同行伙伴">${M3_HEROES.map((hero) => `<button type="button" data-hero-id="${hero.id}" aria-pressed="${String(hero.id === state.heroId)}">${hero.name.replace("魔法师", "").replace("伙伴师", "伙伴")}</button>`).join("")}</div><div class="hmc3-prefs"><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(save.settings.reducedMotion)}">${save.settings.reducedMotion ? "恢复动画" : "减少动画"}</button></div></footer>
    ${parentClearArmed ? `<aside class="hmc3-parent" data-testid="complete-parent-panel" aria-label="家长角"><h2>本机进度</h2><p>清除本篇只移除 V3；清除全部还会移除 V1、V2 与字轮存档，需要再次确认。</p><div><button type="button" data-action="clear-v3">只清除本篇</button><button type="button" data-action="confirm-clear-all">家长确认：清除全部</button><button type="button" data-action="toggle-parent">返回森林</button></div></aside>` : ""}
  </main>`;
}

function renderChapterPreview(state: CompleteEngineState, requested: "chapter-two" | "chapter-three", returnHref: string): string {
  const unlocked = state.unlockedChapterIds.includes(requested);
  return `<main class="hmc3-shell hmc3-preview" data-testid="complete-chapter-preview" data-chapter-id="${requested}" data-unlocked="${String(unlocked)}" style="--world-image:url('${m5AssetUrl(requested === "chapter-two" ? "region-echo-garden" : "region-wind-trail")}')"><div class="hmc3-world-art" aria-hidden="true"></div><section><p>${unlocked ? "林路已经点亮" : "远处还在沉睡"}</p><h1>${requested === "chapter-two" ? "字脉苏醒" : "万象共鸣"}</h1><p>${unlocked ? "这条路的完整冒险正在接入同一套纯规则引擎。" : "先完成前一章；已有发现和修复都不会丢失。"}</p><a class="hmc3-primary" href="?play=hanzi-magic-complete&from=hub">回到森林</a><a href="${escapeHtml(returnHref)}">返回游戏世界</a></section></main>`;
}

export function mountHanziMagicComplete(root: HTMLElement, options: MountCompleteAppOptions = {}): MountedCompleteApp {
  const storage = options.storage ?? browserStorage();
  if (options.fresh) clearCompleteSave(storage);
  let read = readCompleteSave(storage);
  let save = read.state;
  let state = createCompleteEngineState(save.activeResume.seed, progressSeedFromCompleteSave(save));
  let parentClearArmed = false;
  let destroyed = false;
  const returnHref = options.returnHref ?? "?world=my-game-world";

  const persist = () => {
    if (!read.writable) return;
    save = syncCompleteSaveFromEngine(save, state);
    writeCompleteSave(storage, save);
  };
  const render = () => {
    root.innerHTML = options.requestedChapter ? renderChapterPreview(state, options.requestedChapter, returnHref) : renderWorld(state, save, read.source, !read.writable, parentClearArmed, returnHref);
    options.onStateChange?.(state);
  };
  const dispatch = (action: CompleteEngineAction) => {
    if (destroyed) return;
    state = reduceCompleteEngineState(state, action);
    persist();
    render();
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, a");
    if (!target || target.tagName === "A") return;
    const heroId = target.dataset.heroId as M3HeroId | undefined;
    if (heroId) dispatch({ type: "select-hero", heroId });
    const preference = target.dataset.pref;
    if (preference === "muted" || preference === "reduced-motion") {
      if (!read.writable) return;
      save = updateCompleteSave(save, { settings: { ...save.settings, [preference === "muted" ? "muted" : "reducedMotion"]: !save.settings[preference === "muted" ? "muted" : "reducedMotion"] } });
      writeCompleteSave(storage, save);
      render();
    }
    if (target.dataset.action === "toggle-parent") { parentClearArmed = !parentClearArmed; render(); }
    if (target.dataset.action === "clear-v3") {
      clearCompleteSave(storage);
      save = createFreshCompleteSave();
      state = createCompleteEngineState();
      read = { ...read, state: save, source: "fresh", recovered: false, recoveryReason: "NONE", writable: true, futureVersionProtected: false };
      parentClearArmed = false;
      writeCompleteSave(storage, save);
      render();
    }
    if (target.dataset.action === "confirm-clear-all") {
      clearAllHanziProgress(storage, true);
      save = createFreshCompleteSave();
      state = createCompleteEngineState();
      read = { ...read, state: save, source: "fresh", recovered: false, recoveryReason: "NONE", writable: true, futureVersionProtected: false };
      parentClearArmed = false;
      writeCompleteSave(storage, save);
      render();
    }
  };

  root.addEventListener("click", click);
  if (read.writable) persist();
  render();
  return {
    getState: () => state,
    getSave: () => save,
    dispatch,
    destroy() { destroyed = true; root.removeEventListener("click", click); root.replaceChildren(); },
  };
}
