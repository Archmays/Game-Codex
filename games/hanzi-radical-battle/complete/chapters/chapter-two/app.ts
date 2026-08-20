import type { MountedGame } from "../../../../../packages/game-core";
import { M3_HEROES } from "../../../v2/chapter-one/builds";
import { m5AssetUrl } from "../../../v2/chapter-one/m5-assets";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../content-graph/families";
import type { CompleteSlotId } from "../../content-graph/types";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../core/complete-machine";
import type { CompleteEngineState } from "../../core/complete-types";
import {
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  writeCompleteSave,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../../save/complete-save";
import {
  CHAPTER_TWO_BEHAVIORS,
  CHAPTER_TWO_BOSSES,
  CHAPTER_TWO_EPISODES,
  CHAPTER_TWO_NEW_ABILITIES,
  CHAPTER_TWO_OPTIONAL_CHARACTER_IDS,
  CHAPTER_TWO_REPAIRS,
  type ChapterTwoAbilityId,
} from "./contracts";
import type { ChapterTwoAction, ChapterTwoState } from "./engine";
import "../../ui/chapter-two.css";

export interface MountChapterTwoOptions {
  readonly storage?: CompleteStorageLike;
  readonly fresh?: boolean;
  readonly seed?: string;
  readonly returnHref?: string;
  readonly onStateChange?: (state: ChapterTwoState) => void;
}

export interface MountedChapterTwo extends MountedGame {
  getState(): ChapterTwoState | null;
  getSave(): CompleteSaveState;
  dispatch(action: ChapterTwoAction): void;
}

const MEMORY_STORAGE = new Map<string, string>();
function browserStorage(): CompleteStorageLike {
  try {
    const key = "family-games/hanzi-complete-chapter-two-storage-test";
    localStorage.setItem(key, "1"); localStorage.removeItem(key);
    return localStorage;
  } catch {
    return { getItem: (key) => MEMORY_STORAGE.get(key) ?? null, setItem: (key, value) => { MEMORY_STORAGE.set(key, value); }, removeItem: (key) => { MEMORY_STORAGE.delete(key); } };
  }
}

function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function character(id: string) { return COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id)!; }
function reading(characterId: string) {
  const record = character(characterId);
  return COMPLETE_CORE_READING_SENSES.find((candidate) => candidate.id === record.readingSenseIds[0])!;
}
function family(id: string) { return COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === id)!; }

const SLOT_LABELS: Readonly<Record<CompleteSlotId, string>> = { left: "左边", right: "右边", top: "上面", bottom: "下面", outer: "外面", inner: "里面" };

function renderPath(state: ChapterTwoState): string {
  return `<ol class="hmc2-path" aria-label="第二章路线">${CHAPTER_TWO_EPISODES.map((episode, index) => {
    const status = state.completedEpisodeIds.includes(episode.id) ? "complete" : state.episodeIndex === index ? "current" : index < state.episodeIndex ? "complete" : "sleeping";
    return `<li data-episode-id="${episode.id}" data-status="${status}"><span aria-hidden="true">${status === "complete" ? "✦" : status === "current" ? "◆" : "·"}</span><div><b>${episode.name}</b><small>${index < 3 ? "完整字与字脉" : "只组合已学规则"}</small></div></li>`;
  }).join("")}</ol>`;
}

function renderIntro(state: ChapterTwoState): string {
  const hero = M3_HEROES.find((candidate) => candidate.id === state.heroId)!;
  return `<section class="hmc2-panel hmc2-intro" data-testid="chapter-two-intro"><p class="hmc2-kicker">第二章 · 字脉苏醒</p><h2>树冠上的根线忘记了怎样连接</h2><p>先把完整字合起来，再亲手连接有来源支持的共享部件。${hero.name}会同行，但不会替你放置答案。</p><div class="hmc2-hero"><span aria-hidden="true" style="background-image:url('${m5AssetUrl(hero.iconKey)}')"></span><div><b>${hero.name}</b><small>${hero.shortDescription}</small></div></div><button class="hmc2-primary" type="button" data-action="start" data-primary-focus>走上木语树冠</button></section>`;
}

function renderAbilityChoice(state: ChapterTwoState): string {
  return `<section class="hmc2-panel" data-testid="chapter-two-ability-choice"><p class="hmc2-kicker">${CHAPTER_TWO_EPISODES[state.episodeIndex].name} · 同行字光</p><h2>带一道不会代答的能力</h2><p>每项只让关系或恢复更清楚；汉字、部件、槽位和答案都不变。</p><div class="hmc2-ability-grid">${state.abilityOfferIds.map((id) => {
    const ability = CHAPTER_TWO_NEW_ABILITIES.find((candidate) => candidate.id === id)!;
    return `<button type="button" data-ability-id="${ability.id}"><b>${ability.name}</b><span>${ability.childDescription}</span></button>`;
  }).join("")}</div></section>`;
}

function renderBehavior(state: ChapterTwoState): string {
  const effect = state.phase === "behavior-effect";
  const boss = state.currentBossId ? CHAPTER_TWO_BOSSES.find((candidate) => candidate.id === state.currentBossId)! : null;
  return `<section class="hmc2-panel hmc2-behavior" data-testid="chapter-two-behavior" data-stage="${effect ? "effect" : "telegraph"}" data-boss-id="${boss?.id ?? "none"}"><div class="hmc2-creature" aria-hidden="true"><i></i><i></i><span></span></div><p class="hmc2-kicker">${boss ? boss.name : "字脉干扰"} · ${effect ? "正在发生" : "先看预告"}</p><h2>${state.activeBehaviorIds.map((id) => CHAPTER_TWO_BEHAVIORS.find((behavior) => behavior.id === id)!.name).join("＋")}</h2>${state.activeBehaviorIds.map((id) => {
    const behavior = CHAPTER_TWO_BEHAVIORS.find((candidate) => candidate.id === id)!;
    return `<article><p>${effect ? behavior.effect : behavior.telegraph}</p><small><b>总能恢复：</b>${behavior.guaranteedRecovery}</small></article>`;
  }).join("")}<button class="hmc2-primary" type="button" data-action="${effect ? "recover-behavior" : "begin-behavior"}" data-primary-focus>${effect ? "让字脉完整显回" : "我看清了"}</button></section>`;
}

function renderBuild(state: ChapterTwoState): string {
  const target = character(state.currentCharacterId!);
  return `<section class="hmc2-battle" data-testid="chapter-two-build" data-character-id="${target.id}" data-structure="${target.structure}"><div><p class="hmc2-kicker">完整字 · ${target.familiarWord}</p><h2>把字灵送回真实位置</h2><p role="status">${escapeHtml(state.gentleMessage)}</p></div><div class="hmc2-board hmc2-board--${target.structure}" role="group" aria-label="${target.glyph}的结构槽位">${target.components.map((component) => {
    const placement = state.placements.find((candidate) => candidate.slotId === component.slotId);
    const card = placement ? state.hand.find((candidate) => candidate.id === placement.cardId) : null;
    return `<button type="button" class="hmc2-slot${card ? " is-filled" : ""}" data-slot-id="${component.slotId}" aria-label="${SLOT_LABELS[component.slotId]}${card ? `，已有${card.glyph}` : "，空"}">${card ? `<b>${card.glyph}</b>` : `<span>${SLOT_LABELS[component.slotId]}</span>`}</button>`;
  }).join("")}</div><div class="hmc2-hand" role="group" aria-label="五张字灵手牌">${state.hand.map((card) => {
    const used = state.placements.some((placement) => placement.cardId === card.id);
    const selected = state.selectedCardId === card.id;
    return `<button type="button" draggable="${String(!used)}" data-card-id="${card.id}" aria-pressed="${String(selected)}" class="${selected ? "is-selected" : ""}" ${used ? "disabled" : ""}><span>${card.glyph}</span></button>`;
  }).join("")}</div><div class="hmc2-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回上一步</button><span>没有倒计时 · 点选可替代拖动</span></div></section>`;
}

function renderComposition(state: ChapterTwoState): string {
  const target = character(state.currentCharacterId!);
  return `<section class="hmc2-panel hmc2-composition" data-testid="chapter-two-composition"><p class="hmc2-kicker">部件合起来了</p><div class="hmc2-glyph" aria-label="完整汉字 ${target.glyph}">${target.glyph}</div><div class="hmc2-equation">${target.components.map((component) => `<span>${component.glyph}</span>`).join("<b>＋</b>")}<b>→</b><strong>${target.glyph}</strong></div><button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>看完整字的意思</button></section>`;
}

function renderMeaning(state: ChapterTwoState): string {
  const target = character(state.currentCharacterId!);
  const sense = reading(target.id);
  return `<section class="hmc2-panel hmc2-meaning" data-testid="chapter-two-meaning"><p class="hmc2-kicker">完整字义魔法</p><h2><span>${target.glyph}</span> ${sense.pinyin}</h2><p class="hmc2-word">${sense.fixedPhrase}</p><p>${target.shortMeaning}</p><p>${target.magicEffect}</p><small>${target.meaningImageDisclaimer}</small><div class="hmc2-actions"><button type="button" data-action="speak-character">朗读“${target.glyph}，${sense.fixedPhrase}”</button><button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>看看这片区域的字脉</button></div></section>`;
}

function renderFamilyInspect(state: ChapterTwoState): string {
  const current = family(state.currentFamilyId!);
  const variantTriggered = state.triggeredAbilityIds.includes("family-variant-lantern");
  return `<section class="hmc2-panel hmc2-family" data-testid="chapter-two-family-inspect" data-family-id="${current.id}"><p class="hmc2-kicker">有来源支持的字脉关系</p><h2>${current.name}</h2><p>${current.childFacingExplanation}</p><div class="hmc2-family-members">${current.memberCharacterIds.map((id) => {
    const member = character(id); const sense = reading(id);
    return `<article><b>${member.glyph}</b><span>${sense.fixedPhrase}</span></article>`;
  }).join("")}</div><p class="hmc2-boundary">${current.worldRepresentation}</p>${variantTriggered ? `<p class="hmc2-ability-trigger" data-triggered-ability="family-variant-lantern">变形灯：原形与变形同时亮起；不会改变完整字。</p>` : ""}<button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>亲手连接两个成员</button></section>`;
}

function renderFamilyConnect(state: ChapterTwoState): string {
  const current = family(state.currentFamilyId!);
  return `<section class="hmc2-panel hmc2-family" data-testid="chapter-two-family-connect" data-family-id="${current.id}"><p class="hmc2-kicker">亲手连接字脉</p><h2>选两个属于“${current.name}”的完整字</h2><div class="hmc2-family-pick" role="group" aria-label="字脉成员">${current.memberCharacterIds.map((id) => {
    const member = character(id); const selected = state.familySelectedCharacterIds.includes(id);
    return `<button type="button" data-family-character-id="${id}" aria-pressed="${String(selected)}" class="${selected ? "is-selected" : ""}"><b>${member.glyph}</b><span>${member.familiarWord}</span></button>`;
  }).join("")}</div><div class="hmc2-root-line" data-selected-count="${state.familySelectedCharacterIds.length}" aria-hidden="true"><i></i><span>字脉</span><i></i></div><p role="status">${escapeHtml(state.gentleMessage)}</p><button class="hmc2-primary" type="button" data-action="connect-family" data-primary-focus>连接这条字脉</button></section>`;
}

function renderFamilyResult(state: ChapterTwoState): string {
  const claims = state.familySelectedCharacterIds.map((id) => COMPLETE_COMPONENT_RELATIONS.find((relation) => relation.familyId === state.currentFamilyId && relation.characterId === id)!);
  const rootTriggered = state.triggeredAbilityIds.includes("family-root-link");
  return `<section class="hmc2-panel hmc2-family-result" data-testid="chapter-two-family-result" data-family-id="${state.currentFamilyId}"><p class="hmc2-kicker">关系连接成立</p><h2>${state.familySelectedCharacterIds.map((id) => character(id).glyph).join(" 和 ")}回到同一条字脉</h2><div class="hmc2-linked-root" aria-hidden="true"><span></span><b>字脉</b><span></span></div>${claims.map((claim) => `<p><b>${claim.kind === "modern-visual-link-only" ? "谨慎字形连接" : claim.kind === "phonetic-component" ? "读音线索" : "部件关系"}：</b>${claim.childFacingClaim}</p>`).join("")}${rootTriggered ? `<p class="hmc2-ability-trigger" data-triggered-ability="family-root-link">根线相连：两道金绿根线托住完整字；答案没有改变。</p>` : ""}<button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>让字脉继续前行</button></section>`;
}

function renderRepair(state: ChapterTwoState): string {
  const repair = CHAPTER_TWO_REPAIRS.find((candidate) => candidate.id === CHAPTER_TWO_EPISODES[state.episodeIndex].repairId)!;
  return `<section class="hmc2-panel hmc2-repair" data-testid="chapter-two-repair" data-repair-id="${repair.id}"><p class="hmc2-kicker">世界修复会保存在本机</p><h2>${repair.name}重新亮起来了</h2><div class="hmc2-before-after"><article data-state="before"><span aria-hidden="true"></span><b>修复前 · ${repair.before.light}</b><p>${repair.before.shape}，${repair.before.function}。</p></article><article data-state="after"><span aria-hidden="true"></span><b>修复后 · ${repair.after.light}</b><p>${repair.after.shape}，${repair.after.function}。</p></article></div><p>${repair.interaction}</p><small>${repair.learningConnection}</small><button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>${state.episodeIndex < 2 ? "保存修复，回到林路" : state.episodeIndex === 2 ? "前往字脉树心" : "让字光回到森林"}</button></section>`;
}

function renderEpisodeComplete(state: ChapterTwoState): string {
  return `<section class="hmc2-panel" data-testid="chapter-two-episode-complete"><p class="hmc2-kicker">安全休息点</p><h2>${CHAPTER_TWO_EPISODES[state.episodeIndex].name}已经恢复</h2><p>刷新或稍后回来都会从这里继续；没有连胜、限时或进度损失。</p><button class="hmc2-primary" type="button" data-action="continue" data-primary-focus>去下一片区域</button></section>`;
}

function renderCoreIntro(): string {
  return `<section class="hmc2-panel hmc2-core" data-testid="chapter-two-core-intro"><p class="hmc2-kicker">核心区域 · 字脉树心</p><h2>只组合已经见过的三种规则</h2><p>合完整字、辨认有来源支持的部件关系、恢复已见干扰。这里不会首次教学新规则。</p><button class="hmc2-primary" type="button" data-action="start-core" data-primary-focus>走进字脉树心</button></section>`;
}

function renderEnding(state: ChapterTwoState): string {
  return `<section class="hmc2-panel hmc2-ending" data-testid="chapter-two-ending"><p class="hmc2-kicker">第二章恢复</p><h2>十二条故事字脉重新把光送进森林</h2><p>树心没有要求找齐所有字；六个可选新字会在之后的部件小径里等你。</p><button class="hmc2-primary" type="button" data-action="finish-ending" data-primary-focus>点亮家灯小镇的路</button></section>`;
}

function renderSummary(state: ChapterTwoState): string {
  return `<section class="hmc2-panel hmc2-summary" data-testid="chapter-two-summary"><p class="hmc2-kicker">字脉苏醒 · 完成</p><h2>家灯小镇的灯已经回应</h2><p>没有分数、排名、连胜或全收集门槛。所有完成字、字脉和四处修复都已保存在本机。</p><div class="hmc2-summary-grid"><span>12 个故事新字</span><span>12 条故事字脉</span><span>4 位守护者</span><span>4 处持久修复</span></div><div class="hmc2-trigger-list">${CHAPTER_TWO_NEW_ABILITIES.map((ability) => `<span data-triggered-ability="${ability.id}" data-triggered="${String(state.triggeredAbilityIds.includes(ability.id as ChapterTwoAbilityId))}">${ability.name}</span>`).join("")}</div><a class="hmc2-primary" href="?play=hanzi-magic-complete&from=hub">回到墨迹森林</a></section>`;
}

function renderPhase(state: ChapterTwoState): string {
  if (state.phase === "chapter-intro") return renderIntro(state);
  if (state.phase === "ability-choice") return renderAbilityChoice(state);
  if (state.phase === "behavior-telegraph" || state.phase === "behavior-effect") return renderBehavior(state);
  if (state.phase === "build") return renderBuild(state);
  if (state.phase === "composition") return renderComposition(state);
  if (state.phase === "meaning") return renderMeaning(state);
  if (state.phase === "family-inspect") return renderFamilyInspect(state);
  if (state.phase === "family-connect") return renderFamilyConnect(state);
  if (state.phase === "family-result") return renderFamilyResult(state);
  if (state.phase === "episode-repair") return renderRepair(state);
  if (state.phase === "episode-complete") return renderEpisodeComplete(state);
  if (state.phase === "core-intro") return renderCoreIntro();
  if (state.phase === "ending") return renderEnding(state);
  return renderSummary(state);
}

function renderLocked(returnHref: string): string {
  return `<main class="hmc2-shell hmc2-locked" data-testid="chapter-two-locked"><section class="hmc2-panel"><p class="hmc2-kicker">这条林路还在沉睡</p><h1>字脉苏醒</h1><p>先完成第一章；已有发现与修复都不会丢失。</p><a class="hmc2-primary" href="?play=hanzi-magic-complete&from=hub">回到墨迹森林</a><a href="${escapeHtml(returnHref)}">返回游戏世界</a></section></main>`;
}

function speak(text: string, muted: boolean) {
  if (muted || typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = .86; speechSynthesis.speak(utterance);
}

export function mountHanziMagicChapterTwo(root: HTMLElement, options: MountChapterTwoOptions = {}): MountedChapterTwo {
  const storage = options.storage ?? browserStorage();
  let read = readCompleteSave(storage);
  let save = read.state;
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";
  const unlocked = save.unlockedChapterIds.includes("chapter-two");
  if (!unlocked) {
    root.innerHTML = renderLocked(returnHref);
    return { getState: () => null, getSave: () => save, dispatch: () => {}, destroy: () => root.replaceChildren() };
  }
  if (options.fresh && read.writable) {
    save = updateCompleteSave(save, { chapterTwoReplay: null, activeResume: { screen: "world", chapterId: "chapter-two", episodeId: null, phase: "world", seed: options.seed ?? "component-roots-return", actionCount: 0 } });
    writeCompleteSave(storage, save);
    const consumed = new URL(location.href); consumed.searchParams.delete("fresh"); history.replaceState(history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`);
  }
  let master: CompleteEngineState = createCompleteEngineState(options.seed ?? save.activeResume.seed, progressSeedFromCompleteSave(save));
  master = reduceCompleteEngineState(master, { type: "enter-chapter", chapterId: "chapter-two" });
  let state = master.chapterTwoRun!.state;
  let draggedCardId: string | null = null;
  let destroyed = false;

  const persist = () => {
    if (!read.writable) return;
    save = syncCompleteSaveFromEngine(save, master);
    writeCompleteSave(storage, save);
  };
  const focusNext = () => root.querySelector<HTMLElement>(state.phase === "build" && state.selectedCardId ? ".hmc2-slot:not(.is-filled)" : "[data-primary-focus], button:not([disabled]), a")?.focus({ preventScroll: true });
  const render = () => {
    const scene = CHAPTER_TWO_EPISODES[state.episodeIndex].sceneKey;
    root.innerHTML = `<main class="hmc2-shell" data-testid="hanzi-complete-chapter-two" data-phase="${state.phase}" data-episode-index="${state.episodeIndex}" data-encounter-index="${state.encounterIndex}" data-action-count="${state.actionCount}" data-current-character-id="${state.currentCharacterId ?? "none"}" data-current-family-id="${state.currentFamilyId ?? "none"}" data-discovered-count="${state.discoveredCharacterIds.length}" data-family-count="${state.discoveredFamilyIds.length}" data-repair-count="${state.repairedObjectIds.length}" data-boss-count="${state.completedBossIds.length}" data-selected-ability-count="${state.selectedAbilityIds.length}" data-triggered-ability-count="${state.triggeredAbilityIds.length}" data-muted="${String(save.settings.muted)}" data-reduced-motion="${String(save.settings.reducedMotion)}" data-save-read-only="${String(!read.writable)}" style="--hmc2-scene:url('${m5AssetUrl(scene)}')"><div class="hmc2-world" aria-hidden="true"><i></i><span></span><b></b></div><header class="hmc2-header"><a href="${escapeHtml(returnHref)}" aria-label="返回墨迹森林">← 森林</a><div><span>汉字魔法战 · 字光归林</span><h1>字脉苏醒</h1></div><div><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(save.settings.reducedMotion)}">${save.settings.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>${!read.writable ? `<p class="hmc2-save-note" role="status">发现较新版本存档：当前只读，不会覆盖。</p>` : ""}<div class="hmc2-layout">${renderPath(state)}<div class="hmc2-phase" aria-live="polite">${renderPhase(state)}</div></div><footer class="hmc2-footer"><span>本地匿名保存 · 无登录 · 无排名</span><span>12 个故事字脉 · ${CHAPTER_TWO_OPTIONAL_CHARACTER_IDS.length} 个可选新字不阻塞通关</span></footer></main>`;
    focusNext(); options.onStateChange?.(state);
  };
  const dispatch = (action: ChapterTwoAction) => {
    if (destroyed) return;
    const next = reduceCompleteEngineState(master, { type: "chapter-two-action", action });
    if (next === master) return;
    master = next; state = master.chapterTwoRun!.state; persist(); render();
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, a"); if (!target || !root.contains(target) || target.tagName === "A") return;
    const action = target.dataset.action;
    if (["start", "begin-behavior", "recover-behavior", "undo", "continue", "connect-family", "start-core", "finish-ending"].includes(String(action))) dispatch({ type: action } as ChapterTwoAction);
    if (target.dataset.abilityId) dispatch({ type: "choose-ability", abilityId: target.dataset.abilityId as ChapterTwoState["abilityOfferIds"][number] });
    if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    if (target.dataset.slotId) dispatch({ type: "place-selected", slotId: target.dataset.slotId as CompleteSlotId });
    if (target.dataset.familyCharacterId) dispatch({ type: "toggle-family-character", characterId: target.dataset.familyCharacterId });
    if (action === "speak-character" && state.currentCharacterId) { const targetCharacter = character(state.currentCharacterId); speak(`${targetCharacter.glyph}，${reading(targetCharacter.id).fixedPhrase}`, save.settings.muted); }
    if (target.dataset.pref && read.writable) {
      const field = target.dataset.pref === "muted" ? "muted" : "reducedMotion";
      save = updateCompleteSave(save, { settings: { ...save.settings, [field]: !save.settings[field] } }); writeCompleteSave(storage, save); render();
    }
  };
  const dragStart = (event: DragEvent) => { const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card-id]"); draggedCardId = card?.dataset.cardId ?? null; if (draggedCardId) event.dataTransfer?.setData("text/plain", draggedCardId); };
  const dragOver = (event: DragEvent) => { if ((event.target as HTMLElement).closest("[data-slot-id]")) event.preventDefault(); };
  const drop = (event: DragEvent) => { const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot-id]"); const cardId = event.dataTransfer?.getData("text/plain") || draggedCardId; if (slot?.dataset.slotId && cardId) { event.preventDefault(); dispatch({ type: "place-card", cardId, slotId: slot.dataset.slotId as CompleteSlotId }); } draggedCardId = null; };
  root.addEventListener("click", click); root.addEventListener("dragstart", dragStart); root.addEventListener("dragover", dragOver); root.addEventListener("drop", drop);
  persist(); render();
  return { getState: () => state, getSave: () => save, dispatch, destroy() { destroyed = true; root.removeEventListener("click", click); root.removeEventListener("dragstart", dragStart); root.removeEventListener("dragover", dragOver); root.removeEventListener("drop", drop); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); root.replaceChildren(); } };
}

export function createFreshChapterTwoSave(): CompleteSaveState {
  return updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two"], activeResume: { screen: "world", chapterId: "chapter-two", episodeId: null, phase: "world", seed: "component-roots-return", actionCount: 0 } });
}
