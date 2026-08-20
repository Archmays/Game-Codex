import type { MountedGame } from "../../../../packages/game-core";
import { createM5AudioController, type M5AudioCue } from "../../v2/chapter-one/m5-audio";
import { m5AssetUrl } from "../../v2/chapter-one/m5-assets";
import {
  COMPLETE_SLICE_FAMILIES,
  getCompleteSliceCharacter,
  getCompleteSliceReading,
  getCompleteSliceWord,
} from "../content-graph/slice-content";
import {
  createCompleteSliceState,
  reduceCompleteSliceState,
  replayCompleteSliceActions,
  type CompleteSliceAction,
  type CompleteSliceId,
  type CompleteSlicePhase,
  type CompleteSliceState,
} from "../core/slice-machine";
import {
  clearCompleteSliceSession,
  readCompleteSliceSave,
  updateCompleteSliceSave,
  writeCompleteSliceSave,
  type CompleteSliceSave,
  type CompleteSliceStorage,
} from "../save/slice-save";
import type { CompleteSlotId } from "../content-graph/types";
import "../ui/slice.css";

export interface MountCompleteSliceOptions {
  readonly sliceId?: CompleteSliceId;
  readonly storage?: CompleteSliceStorage;
  readonly fresh?: boolean;
  readonly returnHref?: string;
  readonly onStateChange?: (state: CompleteSliceState) => void;
}

export interface MountedCompleteSlice extends MountedGame {
  getState(): CompleteSliceState;
  dispatch(action: CompleteSliceAction): void;
}

const MEMORY_STORAGE = new Map<string, string>();
function browserStorage(): CompleteSliceStorage {
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

const SLOT_LABELS: Readonly<Record<CompleteSlotId, string>> = {
  left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面",
};

const SLICE_COPY = {
  family: {
    chapter: "字脉苏醒",
    place: "字脉树心",
    primary: "唤醒青的字脉",
    scene: "region-glimmer-grove",
    hero: "hero-forest-speaker",
    path: ["木语树冠", "清泉石谷", "字脉树心"],
    repair: "部件根心",
  },
  word: {
    chapter: "万象共鸣",
    place: "书页花港",
    primary: "让两个完整字相遇",
    scene: "region-echo-garden",
    hero: "hero-light-speaker",
    path: ["家灯小镇", "万象书港", "万象字心"],
    repair: "词语字心",
  },
} as const;

function phaseProgress(phase: CompleteSlicePhase): number {
  if (["world", "behavior-telegraph", "behavior-effect"].includes(phase)) return 0;
  if (["repair", "complete"].includes(phase)) return 2;
  return 1;
}

function renderPath(state: CompleteSliceState): string {
  const copy = SLICE_COPY[state.sliceId];
  const current = phaseProgress(state.phase);
  return `<ol class="hmc-path" aria-label="${copy.chapter}冒险路径">${copy.path.map((label, index) => `<li data-status="${index < current ? "complete" : index === current ? "current" : "future"}"><span aria-hidden="true"></span><b>${label}</b></li>`).join("")}</ol>`;
}

function renderWorld(state: CompleteSliceState): string {
  const copy = SLICE_COPY[state.sliceId];
  return `<section class="hmc-world-card" data-testid="complete-slice-world">
    <div class="hmc-hero" style="--hmc-hero-image:url('${m5AssetUrl(copy.hero)}')" aria-label="当前伙伴：${state.sliceId === "family" ? "森语者" : "光语者"}"></div>
    <div class="hmc-world-copy"><p class="hmc-kicker">${copy.place}</p><h2>${state.sliceId === "family" ? "树根里有一条字脉睡着了" : "书页船正在等一个真实词语"}</h2><p>${state.gentleMessage}</p><div class="hmc-repair-preview" data-repair-state="before"><span aria-hidden="true"></span><b>${copy.repair}</b><small>等待字光修复</small></div><button class="hmc-primary" data-action="start" data-primary-focus type="button">${copy.primary}</button></div>
  </section>`;
}

function renderBehavior(state: CompleteSliceState): string {
  const boss = state.phase === "boss-telegraph" || state.phase === "boss-effect";
  const effect = state.phase === "behavior-effect" || state.phase === "boss-effect";
  const asset = boss ? (state.sliceId === "family" ? "boss-lantern-root" : "boss-echo-bloom") : "monster-slot-veil";
  return `<section class="hmc-panel hmc-behavior" data-testid="complete-slice-behavior" data-kind="${boss ? "boss" : "ordinary"}" data-stage="${effect ? "effect" : "telegraph"}">
    <div class="hmc-creature" style="--hmc-creature-image:url('${m5AssetUrl(asset)}')" aria-hidden="true"></div>
    <p class="hmc-kicker">${boss ? "守护兽 · 已见动作" : "墨藤动作"} · ${effect ? "正在发生" : "先看预告"}</p>
    <h2>${boss ? (state.sliceId === "family" ? "灯根守护兽" : "回声花守护兽") : "薄雾遮槽"}</h2>
    <p>${state.gentleMessage}</p>
    <p class="hmc-recovery"><b>总能恢复：</b>${boss ? "轻触后背景安定，刚才学过的规则、答案和进度都不改变。" : "轻触后所有槽位恢复同样清楚，正确部件从未消失。"}</p>
    <button class="hmc-primary" type="button" data-action="${effect ? "recover-behavior" : "begin-behavior"}" data-primary-focus>${effect ? (boss ? "让根线安定" : "吹开薄雾") : "我看清预告了"}</button>
  </section>`;
}

function renderBuild(state: CompleteSliceState): string {
  if (!state.currentCharacterId) return "";
  const character = getCompleteSliceCharacter(state.currentCharacterId);
  const placementFor = (slotId: CompleteSlotId) => state.placements.find((placement) => placement.slotId === slotId);
  return `<section class="hmc-build" data-testid="complete-slice-build" data-character-id="${character.id}" data-structure="${character.structure}">
    <div class="hmc-build-copy"><p class="hmc-kicker">${state.sliceId === "family" ? (state.bossResolved ? "守护兽阶段" : "合字字脉") : `词语里的第 ${state.wordPart === 0 ? "一" : "二"} 个完整字`}</p><h2>把字灵送回真实位置</h2><p>${state.gentleMessage}</p></div>
    <div class="hmc-board hmc-board--${character.structure}" role="group" aria-label="${character.glyph}的结构槽位">${character.components.map((component) => {
      const placement = placementFor(component.slotId);
      const card = placement ? state.hand.find((candidate) => candidate.id === placement.cardId) : null;
      return `<button type="button" class="hmc-slot${card ? " is-filled" : ""}" data-slot-id="${component.slotId}" aria-label="${SLOT_LABELS[component.slotId]}${card ? `，已有${card.glyph}` : "，空"}">${card ? `<b>${card.glyph}</b>` : `<span>${SLOT_LABELS[component.slotId]}</span>`}</button>`;
    }).join("")}</div>
    <div class="hmc-hand" role="group" aria-label="五张字灵手牌">${state.hand.map((card, index) => {
      const used = state.placements.some((placement) => placement.cardId === card.id);
      const selected = state.selectedCardId === card.id;
      return `<button type="button" draggable="${String(!used)}" class="hmc-card${selected ? " is-selected" : ""}" data-card-id="${card.id}" aria-pressed="${String(selected)}" ${used ? "disabled" : ""} ${index === 0 && !state.selectedCardId ? "data-primary-focus" : ""}><span>${card.glyph}</span></button>`;
    }).join("")}</div>
    <div class="hmc-build-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回上一步</button><span>没有倒计时，点选可替代拖动</span></div>
  </section>`;
}

function renderComposition(state: CompleteSliceState): string {
  if (!state.currentCharacterId) return "";
  const character = getCompleteSliceCharacter(state.currentCharacterId);
  return `<section class="hmc-panel hmc-composition" data-testid="complete-slice-composition" data-character-id="${character.id}"><p class="hmc-kicker">两个部件合起来了</p><div class="hmc-formed-glyph" aria-label="完整汉字 ${character.glyph}">${character.glyph}</div><div class="hmc-equation">${character.components.map((component) => `<span>${component.glyph}</span>`).join("<b>＋</b>")}<b>→</b><span>${character.glyph}</span></div><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>看完整字的意思</button></section>`;
}

function renderMeaning(state: CompleteSliceState): string {
  if (!state.currentCharacterId) return "";
  const character = getCompleteSliceCharacter(state.currentCharacterId);
  const reading = getCompleteSliceReading(character.readingSenseIds[0]);
  return `<section class="hmc-panel hmc-meaning" data-testid="complete-slice-meaning" data-character-id="${character.id}"><div class="hmc-meaning-light" aria-hidden="true"></div><p class="hmc-kicker">完整字义魔法</p><h2><span>${character.glyph}</span> ${reading.pinyin}</h2><p class="hmc-word">${reading.fixedPhrase}</p><p>${character.shortMeaning}</p><p class="hmc-disclaimer">联想画面帮助理解字义，不是字源说明。</p><div class="hmc-inline-actions"><button type="button" data-action="speak-character">朗读“${character.glyph}，${reading.fixedPhrase}”</button><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>${state.sliceId === "word" && state.wordPart === 0 ? "去完成第二个字" : "让字光继续"}</button></div></section>`;
}

function renderFamilyInspect(): string {
  const family = COMPLETE_SLICE_FAMILIES[0];
  return `<section class="hmc-panel" data-testid="complete-slice-family-inspect"><p class="hmc-kicker">先看四个完整字</p><h2>${family.name}</h2><div class="hmc-family-grid">${family.memberCharacterIds.map((id) => {
    const character = getCompleteSliceCharacter(id);
    const other = character.components.find((component) => component.glyph !== "青")!;
    const reading = getCompleteSliceReading(character.readingSenseIds[0]);
    return `<article><div><span>${other.glyph}</span><b>＋</b><span>青</span><b>→</b><strong>${character.glyph}</strong></div><p>${reading.pinyin} · ${reading.fixedPhrase}</p></article>`;
  }).join("")}</div><p class="hmc-relation-note">共同的“青”提供读音线索；不同左部件帮助区分完整字。这里不把“青”说成四个字的共同意思。</p><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>亲手连接一条字脉</button></section>`;
}

function renderFamilyConnect(state: CompleteSliceState): string {
  const family = COMPLETE_SLICE_FAMILIES[0];
  return `<section class="hmc-panel" data-testid="complete-slice-family-connect"><p class="hmc-kicker">共享部件连接</p><h2>选两个带“青”的完整字</h2><div class="hmc-family-pick" role="group" aria-label="可连接的完整字">${family.memberCharacterIds.map((id) => {
    const character = getCompleteSliceCharacter(id);
    const selected = state.familySelectedCharacterIds.includes(id);
    return `<button type="button" data-family-character-id="${id}" aria-pressed="${String(selected)}" class="${selected ? "is-selected" : ""}"><b>${character.glyph}</b><span>${character.familiarWord}</span></button>`;
  }).join("")}</div><div class="hmc-connection" data-selected-count="${state.familySelectedCharacterIds.length}" aria-hidden="true"><i></i><span>青</span><i></i></div><p>${state.gentleMessage}</p><button class="hmc-primary" type="button" data-action="connect-family" data-primary-focus>连接共有的青</button></section>`;
}

function renderFamilyResult(state: CompleteSliceState): string {
  return `<section class="hmc-panel hmc-family-result" data-testid="complete-slice-family-result"><p class="hmc-kicker">字脉连接准确</p><h2>${state.familySelectedCharacterIds.map((id) => getCompleteSliceCharacter(id).glyph).join(" 和 ")}共享“青”</h2><div class="hmc-root-lines" aria-hidden="true"><span></span><b>青</b><span></span></div><p>${state.gentleMessage}</p><p class="hmc-relation-note">关系类型：声旁线索。完整字的意思由完整词语和语境确认。</p><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>去见树心守护兽</button></section>`;
}

function renderWordOrder(state: CompleteSliceState): string {
  if (!state.currentWordId) return "";
  const word = getCompleteSliceWord(state.currentWordId);
  return `<section class="hmc-panel" data-testid="complete-slice-word-order" data-word-id="${word.id}"><p class="hmc-kicker">两个完整字都完成了</p><h2>按真实词序放进光槽</h2><div class="hmc-word-slots" aria-label="词语顺序槽位">${[0, 1].map((index) => {
    const id = state.wordOrderCharacterIds[index];
    return `<span data-word-slot="${index + 1}">${id ? getCompleteSliceCharacter(id).glyph : index === 0 ? "第一字" : "第二字"}</span>`;
  }).join("")}</div><div class="hmc-word-pick" role="group" aria-label="两个完整字">${word.characterIds.map((id) => {
    const character = getCompleteSliceCharacter(id);
    const used = state.wordOrderCharacterIds.includes(id);
    return `<button type="button" data-word-character-id="${id}" ${used ? "disabled" : ""}><b>${character.glyph}</b><span>${character.familiarWord}</span></button>`;
  }).join("")}</div><p class="hmc-order-status" role="status">${escapeHtml(state.gentleMessage)}</p></section>`;
}

function renderWordMeaning(state: CompleteSliceState): string {
  if (!state.currentWordId) return "";
  const word = getCompleteSliceWord(state.currentWordId);
  return `<section class="hmc-panel hmc-word-meaning" data-testid="complete-slice-word-meaning" data-word-id="${word.id}"><p class="hmc-kicker">词语共鸣</p><h2>${word.glyphs.join("")} <small>${word.pinyin}</small></h2><p class="hmc-word-definition">${word.shortMeaning}</p><p>${word.context}</p><div class="hmc-word-ribbon" aria-hidden="true"><span>${word.glyphs[0]}</span><i></i><span>${word.glyphs[1]}</span></div><p>${word.worldMagic}</p><div class="hmc-inline-actions"><button type="button" data-action="speak-word">朗读“${word.glyphs.join("")}”</button><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>${state.encounterIndex === 2 ? "让词光回到字心" : "寻找下一个词语"}</button></div></section>`;
}

function renderRepair(state: CompleteSliceState): string {
  const copy = SLICE_COPY[state.sliceId];
  return `<section class="hmc-panel hmc-repair" data-testid="complete-slice-repair" data-repair-id="${state.repairedObjectIds[0]}" data-repair-state="after"><p class="hmc-kicker">世界修复会留下来</p><div class="hmc-repaired-object" aria-hidden="true"><i></i><span></span><b></b></div><h2>${copy.repair}重新亮起来了</h2><p>${state.gentleMessage}</p><p>${state.sliceId === "family" ? "这次修复来自真实合字和准确的共享部件连接。" : "这次修复来自两个完整字和真实词序。"}</p><button class="hmc-primary" type="button" data-action="continue" data-primary-focus>把修复保存到森林</button></section>`;
}

function renderComplete(state: CompleteSliceState): string {
  const copy = SLICE_COPY[state.sliceId];
  return `<section class="hmc-panel hmc-complete" data-testid="complete-slice-summary"><p class="hmc-kicker">${copy.chapter} · 纵向切片完成</p><h2>${copy.repair}的字光已经归位</h2><p>没有分数、排名、连胜或进度损失。刷新页面仍会从这里继续。</p><div class="hmc-complete-actions"><a class="hmc-primary" href="?play=hanzi-magic-complete&from=hub&slice=${state.sliceId === "family" ? "word" : "family"}">${state.sliceId === "family" ? "去书页花港" : "去字脉树心"}</a><a href="?world=my-game-world">回到游戏世界</a></div></section>`;
}

function renderPhase(state: CompleteSliceState): string {
  if (state.phase === "world") return renderWorld(state);
  if (["behavior-telegraph", "behavior-effect", "boss-telegraph", "boss-effect"].includes(state.phase)) return renderBehavior(state);
  if (state.phase === "build") return renderBuild(state);
  if (state.phase === "composition") return renderComposition(state);
  if (state.phase === "meaning") return renderMeaning(state);
  if (state.phase === "family-inspect") return renderFamilyInspect();
  if (state.phase === "family-connect") return renderFamilyConnect(state);
  if (state.phase === "family-result") return renderFamilyResult(state);
  if (state.phase === "word-order") return renderWordOrder(state);
  if (state.phase === "word-meaning") return renderWordMeaning(state);
  if (state.phase === "repair") return renderRepair(state);
  return renderComplete(state);
}

function cueForPhase(phase: CompleteSlicePhase): M5AudioCue {
  if (phase === "behavior-telegraph") return "telegraph";
  if (phase === "behavior-effect" || phase === "boss-effect") return "boss";
  if (phase === "build") return "recover";
  if (phase === "composition") return "compose";
  if (phase === "meaning" || phase === "word-meaning" || phase === "family-result") return "meaning";
  if (phase === "repair") return "repair";
  if (phase === "complete") return "ending";
  return "select";
}

function speak(text: string, muted: boolean): void {
  if (muted || typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

export function mountHanziMagicCompleteSlice(root: HTMLElement, options: MountCompleteSliceOptions = {}): MountedCompleteSlice {
  const sliceId = options.sliceId ?? "family";
  const storage = options.storage ?? browserStorage();
  const saveRead = readCompleteSliceSave(storage, sliceId);
  let save: CompleteSliceSave = saveRead.state;
  if (options.fresh && saveRead.writable) {
    save = clearCompleteSliceSession(save, sliceId);
    writeCompleteSliceSave(storage, save);
    const consumed = new URL(window.location.href);
    consumed.searchParams.delete("fresh");
    window.history.replaceState(window.history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`);
  } else if (saveRead.writable && save.activeSlice !== sliceId) {
    save = updateCompleteSliceSave(save, { activeSlice: sliceId });
    writeCompleteSliceSave(storage, save);
  }
  let actions = [...save.sessions[sliceId]];
  let state = replayCompleteSliceActions(sliceId, actions);
  let preferences = { ...save.preferences, reducedMotion: save.preferences.reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true };
  let draggedCardId: string | null = null;
  let destroyed = false;
  const audio = createM5AudioController();
  const returnHref = options.returnHref ?? "?world=my-game-world";

  const persist = () => {
    if (!saveRead.writable) return;
    save = updateCompleteSliceSave(save, { activeSlice: sliceId, sessions: { ...save.sessions, [sliceId]: actions }, preferences });
    writeCompleteSliceSave(storage, save);
  };

  const focusNext = () => {
    const selector = state.phase === "build" && state.selectedCardId ? ".hmc-slot:not(.is-filled)" : state.phase === "word-order" ? ".hmc-word-pick button:not([disabled])" : "[data-primary-focus], button:not([disabled]), a";
    root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  };

  const render = () => {
    const copy = SLICE_COPY[sliceId];
    root.innerHTML = `<main class="hmc-shell hmc-shell--${sliceId}" data-testid="hanzi-complete-slice" data-slice="${sliceId}" data-phase="${state.phase}" data-action-count="${state.actionCount}" data-current-character-id="${state.currentCharacterId ?? "none"}" data-current-word-id="${state.currentWordId ?? "none"}" data-boss-resolved="${String(state.bossResolved)}" data-repaired="${String(state.repairedObjectIds.length > 0)}" data-muted="${String(preferences.muted)}" data-reduced-motion="${String(preferences.reducedMotion)}" data-save-source="${saveRead.source}" data-save-read-only="${String(!saveRead.writable)}" style="--hmc-scene-image:url('${m5AssetUrl(copy.scene)}')">
      <div class="hmc-scene" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
      <header class="hmc-header"><a href="${returnHref}" aria-label="返回我的游戏世界">← 世界</a><div><span>汉字魔法战 · 字光归林</span><h1>${copy.chapter}</h1></div><div class="hmc-settings"><button type="button" data-pref="muted" aria-pressed="${String(preferences.muted)}">${preferences.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(preferences.reducedMotion)}">${preferences.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>
      ${saveRead.recovered || !saveRead.writable ? `<p class="hmc-save-note" role="status">${!saveRead.writable ? "发现较新版本存档：本页只读，不会覆盖。" : "损坏内容已隔离，并从安全状态恢复。"}</p>` : ""}
      <div class="hmc-ui">${renderPath(state)}<div class="hmc-phase" aria-live="polite">${renderPhase(state)}</div></div>
      <footer class="hmc-footer"><span>本地匿名保存 · 无登录 · 无排名</span><span>声音都有可见等价信息</span></footer>
    </main>`;
    focusNext();
    options.onStateChange?.(state);
  };

  const dispatch = (action: CompleteSliceAction) => {
    if (destroyed) return;
    const next = reduceCompleteSliceState(state, action);
    if (next.actionCount !== state.actionCount + 1) return;
    actions = [...actions, action];
    state = next;
    persist();
    render();
    audio.cue(cueForPhase(state.phase), preferences.muted);
  };

  const clickHandler = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, a");
    if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    if (action === "start" || action === "begin-behavior" || action === "recover-behavior" || action === "undo" || action === "continue" || action === "connect-family") dispatch({ type: action });
    const cardId = target.dataset.cardId;
    if (cardId) dispatch({ type: "select-card", cardId });
    const slotId = target.dataset.slotId as CompleteSlotId | undefined;
    if (slotId) dispatch({ type: "place-selected", slotId });
    const familyCharacterId = target.dataset.familyCharacterId;
    if (familyCharacterId) dispatch({ type: "toggle-family-character", characterId: familyCharacterId });
    const wordCharacterId = target.dataset.wordCharacterId;
    if (wordCharacterId) dispatch({ type: "select-word-character", characterId: wordCharacterId });
    if (action === "speak-character" && state.currentCharacterId) {
      const character = getCompleteSliceCharacter(state.currentCharacterId);
      const reading = getCompleteSliceReading(character.readingSenseIds[0]);
      speak(`${character.glyph}，${reading.fixedPhrase}`, preferences.muted);
    }
    if (action === "speak-word" && state.currentWordId) speak(getCompleteSliceWord(state.currentWordId).glyphs.join(""), preferences.muted);
    const preference = target.dataset.pref;
    if (preference === "muted" || preference === "reduced-motion") {
      preferences = { ...preferences, [preference === "muted" ? "muted" : "reducedMotion"]: !preferences[preference === "muted" ? "muted" : "reducedMotion"] };
      persist();
      render();
      if (preference === "muted" && !preferences.muted) audio.cue("select", false);
    }
  };

  const dragStartHandler = (event: DragEvent) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card-id]");
    draggedCardId = card?.dataset.cardId ?? null;
    if (draggedCardId && event.dataTransfer) event.dataTransfer.setData("text/plain", draggedCardId);
  };
  const dragOverHandler = (event: DragEvent) => {
    if ((event.target as HTMLElement).closest("[data-slot-id]")) event.preventDefault();
  };
  const dropHandler = (event: DragEvent) => {
    const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-id]");
    const slotId = slot?.dataset.slotId as CompleteSlotId | undefined;
    const cardId = event.dataTransfer?.getData("text/plain") || draggedCardId;
    if (slotId && cardId) { event.preventDefault(); dispatch({ type: "place-card", cardId, slotId }); }
    draggedCardId = null;
  };
  const keyHandler = (event: KeyboardEvent) => {
    if (event.key === "Tab" || event.key === "Enter" || event.key === " ") {
      preferences = { ...preferences, inputMode: "keyboard" };
      persist();
    }
  };
  const pointerHandler = (event: PointerEvent) => {
    preferences = { ...preferences, inputMode: event.pointerType === "touch" ? "touch" : "mouse" };
    persist();
  };

  root.addEventListener("click", clickHandler);
  root.addEventListener("dragstart", dragStartHandler);
  root.addEventListener("dragover", dragOverHandler);
  root.addEventListener("drop", dropHandler);
  root.addEventListener("keydown", keyHandler);
  root.addEventListener("pointerdown", pointerHandler);
  render();

  return {
    getState: () => state,
    dispatch,
    destroy() {
      destroyed = true;
      root.removeEventListener("click", clickHandler);
      root.removeEventListener("dragstart", dragStartHandler);
      root.removeEventListener("dragover", dragOverHandler);
      root.removeEventListener("drop", dropHandler);
      root.removeEventListener("keydown", keyHandler);
      root.removeEventListener("pointerdown", pointerHandler);
      window.speechSynthesis?.cancel();
      audio.destroy();
      root.replaceChildren();
    },
  };
}

export function createEmptyCompleteSliceState(sliceId: CompleteSliceId): CompleteSliceState {
  return createCompleteSliceState(sliceId);
}
