import type { MountedGame } from "../../../../../packages/game-core";
import { M3_HEROES } from "../../../v2/chapter-one/builds";
import { m5AssetUrl } from "../../../v2/chapter-one/m5-assets";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../content-graph/families";
import type { CompleteSlotId } from "../../content-graph/types";
import { COMPLETE_WORD_NODES } from "../../content-graph/words";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../core/complete-machine";
import type { CompleteEngineState } from "../../core/complete-types";
import {
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  writeCompleteSave,
  completeBrowserStorage,
  isCompleteSaveWritable,
  type CompleteSaveState,
  type CompleteStorageLike,
} from "../../save/complete-save";
import {
  CHAPTER_THREE_BEHAVIORS,
  CHAPTER_THREE_BOSSES,
  CHAPTER_THREE_EPILOGUE_TITLE,
  CHAPTER_THREE_EPISODES,
  CHAPTER_THREE_NEW_ABILITIES,
  CHAPTER_THREE_OPTIONAL_CHARACTER_IDS,
  CHAPTER_THREE_OPTIONAL_WORD_IDS,
  CHAPTER_THREE_REPAIRS,
  CHAPTER_THREE_STORY_CHARACTER_IDS,
  type ChapterThreeAbilityId,
} from "./contracts";
import { chapterThreeCoreFamilyOptions, type ChapterThreeAction, type ChapterThreeState } from "./engine";
import "../../ui/chapter-three.css";

export interface MountChapterThreeOptions {
  readonly storage?: CompleteStorageLike;
  readonly fresh?: boolean;
  readonly seed?: string;
  readonly returnHref?: string;
  readonly onStateChange?: (state: ChapterThreeState) => void;
}

export interface MountedChapterThree extends MountedGame {
  getState(): ChapterThreeState | null;
  getSave(): CompleteSaveState;
  dispatch(action: ChapterThreeAction): void;
}



function escapeHtml(value: string): string { return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!); }
function character(id: string) { return COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === id)!; }
function reading(characterId: string) { const node = character(characterId); return COMPLETE_CORE_READING_SENSES.find((candidate) => candidate.id === node.readingSenseIds[0])!; }
function word(id: string) { return COMPLETE_WORD_NODES.find((candidate) => candidate.id === id)!; }
function family(id: string) { return COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === id)!; }
const SLOT_LABELS: Readonly<Record<CompleteSlotId, string>> = { left: "左边", right: "右边", top: "上面", bottom: "下面", outer: "外面", inner: "里面" };
const ABILITY_ASSETS: Readonly<Record<ChapterThreeAbilityId, string>> = { "word-order-ribbon": "ability-wind-order", "word-context-lantern": "ability-word-lantern", "word-resonance-bridge": "ability-word-echo" };

function renderPath(state: ChapterThreeState): string {
  return `<ol class="hmc3-path" aria-label="第三章路线">${CHAPTER_THREE_EPISODES.map((entry, index) => {
    const status = state.completedEpisodeIds.includes(entry.id) ? "complete" : state.episodeIndex === index ? "current" : index < state.episodeIndex ? "complete" : "sleeping";
    return `<li data-episode-id="${entry.id}" data-status="${status}"><span aria-hidden="true">${status === "complete" ? "✦" : status === "current" ? "◆" : "·"}</span><div><b>${entry.name}</b><small>${index < 3 ? "完整字与真实词语" : "只组合已学规则"}</small></div></li>`;
  }).join("")}</ol>`;
}

function renderIntro(state: ChapterThreeState): string {
  const hero = M3_HEROES.find((candidate) => candidate.id === state.heroId)!;
  return `<section class="hmc3-panel hmc3-intro" data-testid="chapter-three-intro"><p class="hmc3-kicker">第三章 · 万象共鸣</p><h2>两个完整字，要沿真实词序一起发光</h2><p>先合第一个字并看清意思，再合第二个字；最后亲手把它们送进词槽。${hero.name}会同行，但不会替你排列。</p><div class="hmc3-hero"><span aria-hidden="true" style="background-image:url('${m5AssetUrl(hero.iconKey)}')"></span><div><b>${hero.name}</b><small>${hero.shortDescription}</small></div></div><button class="hmc3-primary" type="button" data-action="start" data-primary-focus>走进家灯小镇</button></section>`;
}

function renderAbilityChoice(state: ChapterThreeState): string {
  return `<section class="hmc3-panel" data-testid="chapter-three-ability-choice"><p class="hmc3-kicker">${CHAPTER_THREE_EPISODES[state.episodeIndex].name} · 同行字光</p><h2>带一道不会代排词序的能力</h2><p>它们只让词序、语境或世界变化更清楚；汉字和答案都不变。</p><div class="hmc3-ability-grid">${state.abilityOfferIds.map((id) => {
    const ability = CHAPTER_THREE_NEW_ABILITIES.find((candidate) => candidate.id === id)!;
    return `<button type="button" data-ability-id="${ability.id}"><i aria-hidden="true" style="background-image:url('${m5AssetUrl(ABILITY_ASSETS[id])}')"></i><b>${ability.name}</b><span>${ability.childDescription}</span></button>`;
  }).join("")}</div></section>`;
}

function renderBehavior(state: ChapterThreeState): string {
  const effect = state.phase === "behavior-effect";
  const boss = state.currentBossId ? CHAPTER_THREE_BOSSES.find((candidate) => candidate.id === state.currentBossId)! : null;
  return `<section class="hmc3-panel hmc3-behavior" data-testid="chapter-three-behavior" data-stage="${effect ? "effect" : "telegraph"}" data-boss-id="${boss?.id ?? "none"}"><div class="hmc3-creature" aria-hidden="true"><i></i><i></i><span></span></div><p class="hmc3-kicker">${boss ? boss.name : "词语干扰"} · ${effect ? "正在发生" : "先看预告"}</p><h2>${state.activeBehaviorIds.map((id) => CHAPTER_THREE_BEHAVIORS.find((entry) => entry.id === id)!.name).join("＋")}</h2>${state.activeBehaviorIds.map((id) => {
    const behavior = CHAPTER_THREE_BEHAVIORS.find((candidate) => candidate.id === id)!;
    return `<article><p>${effect ? behavior.effect : behavior.telegraph}</p><small><b>总能恢复：</b>${behavior.guaranteedRecovery}</small></article>`;
  }).join("")}<button class="hmc3-primary" type="button" data-action="${effect ? "recover-behavior" : "begin-behavior"}" data-primary-focus>${effect ? "让词带完整显回" : "我看清了"}</button></section>`;
}

function renderBuild(state: ChapterThreeState): string {
  const target = character(state.currentBuildCharacterId!);
  const role = state.currentBuildRole === "discovery" ? "故事新字" : state.currentBuildRole === "word-a" ? "词语第一个完整字" : "词语第二个完整字";
  const currentWord = state.currentWordId ? word(state.currentWordId) : null;
  return `<section class="hmc3-battle" data-testid="chapter-three-build" data-character-id="${target.id}" data-build-role="${state.currentBuildRole}" data-structure="${target.structure}"><div><p class="hmc3-kicker">${role}${currentWord ? ` · ${currentWord.glyphs.join("□")}` : ""}</p><h2>把字灵送回真实位置</h2><p role="status">${escapeHtml(state.gentleMessage)}</p></div><div class="hmc3-board hmc3-board--${target.structure}" role="group" aria-label="${target.glyph}的结构槽位">${target.components.map((component) => {
    const placement = state.placements.find((candidate) => candidate.slotId === component.slotId);
    const card = placement ? state.hand.find((candidate) => candidate.id === placement.cardId) : null;
    return `<button type="button" class="hmc3-slot${card ? " is-filled" : ""}" data-slot-id="${component.slotId}" aria-label="${SLOT_LABELS[component.slotId]}${card ? `，已有${card.glyph}` : "，空"}">${card ? `<b>${card.glyph}</b>` : `<span>${SLOT_LABELS[component.slotId]}</span>`}</button>`;
  }).join("")}</div><div class="hmc3-hand" role="group" aria-label="五张字灵手牌">${state.hand.map((card) => {
    const used = state.placements.some((placement) => placement.cardId === card.id); const selected = state.selectedCardId === card.id;
    return `<button type="button" draggable="${String(!used)}" data-card-id="${card.id}" aria-pressed="${String(selected)}" class="${selected ? "is-selected" : ""}" ${used ? "disabled" : ""}><span>${card.glyph}</span></button>`;
  }).join("")}</div><div class="hmc3-actions"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回上一步</button><span>没有倒计时 · 点选可替代拖动</span></div></section>`;
}

function renderCharacterMeaning(state: ChapterThreeState): string {
  const target = character(state.currentBuildCharacterId!); const sense = reading(target.id);
  const discovery = state.phase === "discovery-meaning";
  return `<section class="hmc3-panel hmc3-meaning" data-testid="chapter-three-character-meaning" data-meaning-role="${discovery ? "discovery" : state.phase === "word-meaning-a" ? "word-a" : "word-b"}"><p class="hmc3-kicker">${discovery ? "故事新字已经完整" : "词语中的完整字"}</p><h2><span>${target.glyph}</span> ${sense.pinyin}</h2><p class="hmc3-fixed">${sense.fixedPhrase}</p><p>${target.shortMeaning}</p><p>${target.magicEffect}</p><small>${target.meaningImageDisclaimer}</small><div class="hmc3-actions"><button type="button" data-action="speak-character">朗读“${target.glyph}，${sense.fixedPhrase}”</button><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>${discovery ? "进入这次词语" : state.phase === "word-meaning-a" ? "合第二个完整字" : state.episodeIndex === 3 ? "连接已学字脉" : "排列真实词序"}</button></div></section>`;
}

function renderCoreFamily(state: ChapterThreeState): string {
  const expectedId = CHAPTER_THREE_EPISODES[3].coreFamilyIds[state.encounterIndex];
  const targetWord = word(state.currentWordId!); const targetCharacter = character(targetWord.characterIds[0]);
  const relation = COMPLETE_COMPONENT_RELATIONS.find((entry) => entry.familyId === expectedId && entry.characterId === targetCharacter.id)!;
  return `<section class="hmc3-panel hmc3-core-family" data-testid="chapter-three-core-family" data-expected-family-id="${expectedId}"><p class="hmc3-kicker">万象字心 · 只复习已学字脉</p><h2>哪个字脉和完整字“${targetCharacter.glyph}”相连？</h2><p>${relation.childFacingClaim}</p><div class="hmc3-family-options">${chapterThreeCoreFamilyOptions(expectedId).map((id) => {
    const entry = family(id);
    return `<button type="button" data-core-family-id="${id}"><b>${entry.name}</b><span>${entry.childFacingExplanation}</span></button>`;
  }).join("")}</div><p role="status">${escapeHtml(state.gentleMessage)}</p></section>`;
}

function renderWordOrder(state: ChapterThreeState): string {
  const target = word(state.currentWordId!);
  return `<section class="hmc3-panel hmc3-order" data-testid="chapter-three-word-order" data-word-id="${target.id}"><p class="hmc3-kicker">真实词序 · 正常阅读方向</p><h2>把两个完整字依次送进词槽</h2><div class="hmc3-word-slots" aria-label="两个词语槽位">${[0, 1].map((index) => {
    const id = state.wordSelectedCharacterIds[index];
    return `<span data-word-slot="${index}">${id ? character(id).glyph : index === 0 ? "先" : "后"}</span>`;
  }).join("<i aria-hidden=\"true\">→</i>")}</div><div class="hmc3-word-pick" role="group" aria-label="完整字选择">${[...target.characterIds].reverse().map((id) => {
    const entry = character(id); const used = state.wordSelectedCharacterIds.includes(id);
    return `<button type="button" data-word-character-id="${id}" ${used ? "disabled" : ""}><b>${entry.glyph}</b><span>${entry.familiarWord}</span></button>`;
  }).join("")}</div><p role="status">${escapeHtml(state.gentleMessage)}</p><button type="button" data-action="clear-word-order" ${state.wordSelectedCharacterIds.length ? "" : "disabled"}>清空词槽</button></section>`;
}

function renderWordResult(state: ChapterThreeState): string {
  const target = word(state.currentWordId!);
  const orderTriggered = state.triggeredAbilityIds.includes("word-order-ribbon");
  const contextTriggered = state.triggeredAbilityIds.includes("word-context-lantern");
  return `<section class="hmc3-panel hmc3-word-result" data-testid="chapter-three-word-result" data-word-id="${target.id}"><p class="hmc3-kicker">完整词语共鸣</p><h2>${target.glyphs.join("")}</h2><p class="hmc3-pinyin">${target.pinyin}</p><p class="hmc3-word-meaning">${target.shortMeaning}</p><p>${target.context}</p>${orderTriggered ? `<p class="hmc3-ability-trigger" data-triggered-ability="word-order-ribbon">词序丝带：从左到右亮起；没有改变答案。</p>` : ""}${contextTriggered ? `<p class="hmc3-ability-trigger" data-triggered-ability="word-context-lantern">语境灯：这次固定语境已亮起；没有代答。</p>` : ""}<div class="hmc3-actions"><button type="button" data-action="speak-word">朗读“${target.glyphs.join("")}”</button><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>让词语改变世界</button></div></section>`;
}

function renderWorldEffect(state: ChapterThreeState): string {
  const target = word(state.currentWordId!); const bridge = state.triggeredAbilityIds.includes("word-resonance-bridge");
  return `<section class="hmc3-panel hmc3-world-effect" data-testid="chapter-three-world-effect" data-word-id="${target.id}"><p class="hmc3-kicker">词语世界魔法</p><div class="hmc3-ribbon-scene" aria-hidden="true"><i></i><span>${target.glyphs[0]}</span><b></b><span>${target.glyphs[1]}</span><i></i></div><h2>${target.glyphs.join("")}正在回应</h2><p>${target.worldMagic}</p>${bridge ? `<p class="hmc3-ability-trigger" data-triggered-ability="word-resonance-bridge">共鸣桥：两道完整字光已经会合；词序没有改变。</p>` : ""}<button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>继续沿光路前行</button></section>`;
}

function renderRepair(state: ChapterThreeState): string {
  const repair = CHAPTER_THREE_REPAIRS.find((candidate) => candidate.id === CHAPTER_THREE_EPISODES[state.episodeIndex].repairId)!;
  return `<section class="hmc3-panel hmc3-repair" data-testid="chapter-three-repair" data-repair-id="${repair.id}"><p class="hmc3-kicker">世界修复会保存在本机</p><h2>${repair.name}重新亮起来了</h2><div class="hmc3-before-after"><article data-state="before"><span aria-hidden="true"></span><b>修复前 · ${repair.before.light}</b><p>${repair.before.shape}，${repair.before.function}。</p></article><article data-state="after"><span aria-hidden="true"></span><b>修复后 · ${repair.after.light}</b><p>${repair.after.shape}，${repair.after.function}。</p></article></div><p>${repair.interaction}</p><small>${repair.learningConnection}</small><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>${state.episodeIndex < 2 ? "保存修复，回到光路" : state.episodeIndex === 2 ? "前往万象字心" : "让字光归林"}</button></section>`;
}

function renderEpisodeComplete(state: ChapterThreeState): string {
  return `<section class="hmc3-panel" data-testid="chapter-three-episode-complete"><p class="hmc3-kicker">安全休息点</p><h2>${CHAPTER_THREE_EPISODES[state.episodeIndex].name}已经恢复</h2><p>刷新或稍后回来都会从这里继续；没有连胜、限时或进度损失。</p><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>去下一片区域</button></section>`;
}

function renderCoreIntro(): string {
  return `<section class="hmc3-panel hmc3-core" data-testid="chapter-three-core-intro"><p class="hmc3-kicker">终章 · 万象字心</p><h2>只组合已经学过的三层规则</h2><p>完整字结构、来源支持的部件字脉、真实词序与语境。这里不会首次出现新规则。</p><button class="hmc3-primary" type="button" data-action="start-core" data-primary-focus>走进万象字心</button></section>`;
}

function renderEnding(): string {
  return `<section class="hmc3-panel hmc3-ending" data-testid="chapter-three-ending"><p class="hmc3-kicker">万象字心恢复</p><h2>结构、字脉与词带各自回到正确位置</h2><p>故事通关不要求找齐 72 个字；可选字和可选词会在自由探索里等你。</p><button class="hmc3-primary" type="button" data-action="finish-ending" data-primary-focus>进入尾声 · 字光归林</button></section>`;
}

function renderEpilogue(state: ChapterThreeState): string {
  if (state.phase === "epilogue-forest") return `<section class="hmc3-panel hmc3-epilogue" data-testid="chapter-three-epilogue" data-epilogue-scene="forest"><p class="hmc3-kicker">尾声 · ${CHAPTER_THREE_EPILOGUE_TITLE}</p><h2>字光沿修好的桥、灯街与星带回到森林</h2><p>每一处世界变化都记得真实完成；没有任何光因为可选内容尚未收集而熄灭。</p><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>沿光路回营地</button></section>`;
  if (state.phase === "epilogue-companions") return `<section class="hmc3-panel hmc3-epilogue" data-testid="chapter-three-epilogue" data-epilogue-scene="companions"><p class="hmc3-kicker">尾声 · 同行伙伴</p><h2>三位伙伴在营地灯旁重新会合</h2><p>他们没有比分、名次或连胜要比较；只是把各自看见的字光放回同一片森林。</p><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>看看远处的家灯</button></section>`;
  return `<section class="hmc3-panel hmc3-epilogue" data-testid="chapter-three-epilogue" data-epilogue-scene="home"><p class="hmc3-kicker">尾声 · 家灯常亮</p><h2>今天可以在这里停下，也可以自由探索</h2><p>以后回来，故事、修复和发现仍在本机。没有每日登录奖励，也不会因离开而损失进度。</p><button class="hmc3-primary" type="button" data-action="continue" data-primary-focus>完成墨迹森林完整篇</button></section>`;
}

function renderSummary(state: ChapterThreeState): string {
  return `<section class="hmc3-panel hmc3-summary" data-testid="chapter-three-summary"><p class="hmc3-kicker">${CHAPTER_THREE_EPILOGUE_TITLE} · 完成</p><h2>墨迹森林的字光已经回家</h2><p>三章故事和尾声已经完成；不需要 72/72，也没有分数、排名、连胜或全收集门槛。</p><div class="hmc3-summary-grid"><span>12 个必经新字</span><span>12 个故事词语</span><span>4 位守护者</span><span>4 处持久修复</span></div><div class="hmc3-trigger-list">${CHAPTER_THREE_NEW_ABILITIES.map((ability) => `<span data-triggered-ability="${ability.id}" data-triggered="${String(state.triggeredAbilityIds.includes(ability.id as ChapterThreeAbilityId))}">${ability.name}</span>`).join("")}</div><a class="hmc3-primary" href="?play=hanzi-magic-complete&from=hub">回到完整墨迹森林</a></section>`;
}

function renderPhase(state: ChapterThreeState): string {
  if (state.phase === "chapter-intro") return renderIntro(state);
  if (state.phase === "ability-choice") return renderAbilityChoice(state);
  if (state.phase === "behavior-telegraph" || state.phase === "behavior-effect") return renderBehavior(state);
  if (["discovery-build", "word-build-a", "word-build-b"].includes(state.phase)) return renderBuild(state);
  if (["discovery-meaning", "word-meaning-a", "word-meaning-b"].includes(state.phase)) return renderCharacterMeaning(state);
  if (state.phase === "core-family") return renderCoreFamily(state);
  if (state.phase === "word-order") return renderWordOrder(state);
  if (state.phase === "word-result") return renderWordResult(state);
  if (state.phase === "world-effect") return renderWorldEffect(state);
  if (state.phase === "episode-repair") return renderRepair(state);
  if (state.phase === "episode-complete") return renderEpisodeComplete(state);
  if (state.phase === "core-intro") return renderCoreIntro();
  if (state.phase === "ending") return renderEnding();
  if (["epilogue-forest", "epilogue-companions", "epilogue-home"].includes(state.phase)) return renderEpilogue(state);
  return renderSummary(state);
}

function renderLocked(returnHref: string): string {
  return `<main class="hmc3-shell hmc3-locked" data-testid="chapter-three-locked"><section class="hmc3-panel"><p class="hmc3-kicker">远处的词带还在沉睡</p><h1>万象共鸣</h1><p>先完成第二章；已有发现、字脉和修复都不会丢失。</p><a class="hmc3-primary" href="?play=hanzi-magic-complete&from=hub">回到墨迹森林</a><a href="${escapeHtml(returnHref)}">返回游戏世界</a></section></main>`;
}

function speak(text: string, muted: boolean) {
  if (muted || typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = .86; speechSynthesis.speak(utterance);
}

export function mountHanziMagicChapterThree(root: HTMLElement, options: MountChapterThreeOptions = {}): MountedChapterThree {
  const storage = options.storage ?? completeBrowserStorage();
  let read = readCompleteSave(storage); let save = read.state;
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";
  if (!save.unlockedChapterIds.includes("chapter-three")) {
    root.innerHTML = renderLocked(returnHref);
    return { getState: () => null, getSave: () => save, dispatch: () => {}, destroy: () => root.replaceChildren() };
  }
  if (options.fresh && isCompleteSaveWritable(save)) {
    save = updateCompleteSave(save, { chapterThreeReplay: null, activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: options.seed ?? "word-light-return", actionCount: 0 } });
    writeCompleteSave(storage, save);
    const consumed = new URL(location.href); consumed.searchParams.delete("fresh"); history.replaceState(history.state, "", `${consumed.pathname}${consumed.search}${consumed.hash}`);
  }
  let master: CompleteEngineState = createCompleteEngineState(options.seed ?? save.activeResume.seed, progressSeedFromCompleteSave(save));
  master = reduceCompleteEngineState(master, { type: "enter-chapter", chapterId: "chapter-three" });
  let state = master.chapterThreeRun!.state;
  let draggedCardId: string | null = null; let destroyed = false;
  const persist = () => { if (!isCompleteSaveWritable(save)) return; save = syncCompleteSaveFromEngine(save, master); writeCompleteSave(storage, save); };
  const focusNext = () => root.querySelector<HTMLElement>(["discovery-build", "word-build-a", "word-build-b"].includes(state.phase) && state.selectedCardId ? ".hmc3-slot:not(.is-filled)" : "[data-primary-focus], button:not([disabled]), a")?.focus({ preventScroll: true });
  const render = () => {
    const epilogue = ["ending", "epilogue-forest", "epilogue-companions", "epilogue-home", "chapter-summary"].includes(state.phase);
    const scene = epilogue ? "chapter-one-restored" : CHAPTER_THREE_EPISODES[state.episodeIndex].sceneKey;
    const storyNewCount = CHAPTER_THREE_STORY_CHARACTER_IDS.filter((id) => state.discoveredCharacterIds.includes(id)).length;
    root.innerHTML = `<main class="hmc3-shell" data-testid="hanzi-complete-chapter-three" data-phase="${state.phase}" data-episode-index="${state.episodeIndex}" data-encounter-index="${state.encounterIndex}" data-action-count="${state.actionCount}" data-current-character-id="${state.currentBuildCharacterId ?? "none"}" data-current-word-id="${state.currentWordId ?? "none"}" data-story-new-count="${storyNewCount}" data-word-count="${state.discoveredWordIds.length}" data-repair-count="${state.repairedObjectIds.length}" data-boss-count="${state.completedBossIds.length}" data-selected-ability-count="${state.selectedAbilityIds.length}" data-triggered-ability-count="${state.triggeredAbilityIds.length}" data-muted="${String(save.settings.muted)}" data-reduced-motion="${String(save.settings.reducedMotion)}" data-save-read-only="${String(!isCompleteSaveWritable(save))}" style="--hmc3-scene:url('${m5AssetUrl(scene)}')"><div class="hmc3-world" aria-hidden="true"><i></i><span></span><b></b><em></em></div><header class="hmc3-header"><a href="${escapeHtml(returnHref)}" aria-label="返回墨迹森林">← 森林</a><div><span>汉字魔法战 · 字光归林</span><h1>${epilogue ? CHAPTER_THREE_EPILOGUE_TITLE : "万象共鸣"}</h1></div><div><button type="button" data-pref="muted" aria-pressed="${String(save.settings.muted)}">${save.settings.muted ? "打开声音" : "静音"}</button><button type="button" data-pref="reduced-motion" aria-pressed="${String(save.settings.reducedMotion)}">${save.settings.reducedMotion ? "恢复动画" : "减少动画"}</button></div></header>${!isCompleteSaveWritable(save) ? `<p class="hmc3-save-note" role="status">本机存档已保护，当前进展暂未保存。回到森林后可以重新读取。</p>` : ""}<div class="hmc3-layout">${renderPath(state)}<div class="hmc3-phase" aria-live="polite">${renderPhase(state)}</div></div><footer class="hmc3-footer"><span>本地匿名保存 · 无登录 · 无排名</span><span>${CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.length} 个可选新字 · ${CHAPTER_THREE_OPTIONAL_WORD_IDS.length} 个可选词不阻塞通关</span></footer></main>`;
    focusNext(); options.onStateChange?.(state);
  };
  const dispatch = (action: ChapterThreeAction) => {
    if (destroyed) return;
    const next = reduceCompleteEngineState(master, { type: "chapter-three-action", action });
    if (next === master) return;
    master = next; state = master.chapterThreeRun!.state; persist(); render();
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, a"); if (!target || !root.contains(target) || target.tagName === "A") return;
    const action = target.dataset.action;
    if (["start", "begin-behavior", "recover-behavior", "undo", "continue", "clear-word-order", "start-core", "finish-ending"].includes(String(action))) dispatch({ type: action } as ChapterThreeAction);
    if (target.dataset.abilityId) dispatch({ type: "choose-ability", abilityId: target.dataset.abilityId as ChapterThreeAbilityId });
    if (target.dataset.cardId) dispatch({ type: "select-card", cardId: target.dataset.cardId });
    if (target.dataset.slotId) dispatch({ type: "place-selected", slotId: target.dataset.slotId as CompleteSlotId });
    if (target.dataset.coreFamilyId) dispatch({ type: "choose-core-family", familyId: target.dataset.coreFamilyId });
    if (target.dataset.wordCharacterId) dispatch({ type: "place-word-character", characterId: target.dataset.wordCharacterId });
    if (action === "speak-character" && state.currentBuildCharacterId) { const entry = character(state.currentBuildCharacterId); speak(`${entry.glyph}，${reading(entry.id).fixedPhrase}`, save.settings.muted); }
    if (action === "speak-word" && state.currentWordId) speak(word(state.currentWordId).glyphs.join(""), save.settings.muted);
    if (target.dataset.pref && isCompleteSaveWritable(save)) {
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

export function createFreshChapterThreeSave(): CompleteSaveState {
  return updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedChapterIds: ["chapter-one", "chapter-two"], activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "word-light-return", actionCount: 0 } });
}
