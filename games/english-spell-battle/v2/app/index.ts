import type { MountedGame } from "../../../../packages/game-core";
import {
  ENGLISH_V2_SENTENCE_BY_ID,
  ENGLISH_V2_THEMES,
  ENGLISH_V2_WORD_BY_ID,
  ENGLISH_V2_WORDS,
  optionalWordsForTheme,
  storyWordsForTheme,
} from "../content/manifest";
import type { EnglishSentenceRecord, EnglishThemeId, EnglishWordRecord, GraphemeUnit } from "../content/types";
import {
  applyBuildHint,
  buildSlotTiles,
  buildIsComplete,
  createMission,
  initialBuildState,
  resetBuildState,
  selectBuildTile,
  sentenceTokens,
  unitHint,
  undoBuildTile,
  type BuildState,
  type EnglishMission,
} from "../core/machine";
import {
  readEnglishWorldSave,
  updateEnglishWorldSave,
  writeEnglishWorldSave,
  type EnglishWorldSaveV2,
} from "../save/save";
import "../world/styles.css";

export interface MountEnglishWorldOptions {
  readonly storage?: Storage;
  readonly seed?: string;
  readonly returnHref?: string;
}

type WorldView = "map" | "region" | "journal" | "mission";
type MissionPhase = "meaning" | "build" | "sentence" | "response";

const DEFAULT_RETURN = "?world=my-game-world";

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function wordAssetUrl(word: EnglishWordRecord): string | null {
  return word.imageAssetId ? `./assets/english-world/words/${encodeURIComponent(word.lemma)}.webp` : null;
}

function addPageClass(): void {
  document.documentElement.classList.add("english-world-page");
  document.body.classList.add("english-world-page");
}

function removePageClass(): void {
  document.documentElement.classList.remove("english-world-page");
  document.body.classList.remove("english-world-page");
}

function canSpeakEnglish(): boolean {
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return false;
  const voices = window.speechSynthesis.getVoices();
  return voices.some((voice) => voice.lang.toLowerCase().startsWith("en"));
}

function speakEnglish(text: string): void {
  if (!canSpeakEnglish()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("en-us"))
    ?? window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function sentenceWithBlank(sentence: EnglishSentenceRecord, target: EnglishWordRecord): string[] {
  return sentenceTokens(sentence).map((token, index) => index === sentence.targetSlotIndex ? `__${target.displayWord}__` : token);
}

function visualMarkup(word: EnglishWordRecord, transformed = false): string {
  const asset = wordAssetUrl(word);
  if (asset) return `<div class="wordlight-meaning__art ${transformed ? "is-transformed" : ""}"><img src="${asset}" alt="${escapeHtml(word.imageBrief)}" width="640" height="640" /></div>`;
  if (word.visualKind === "quantity") {
    const count = ({ one: 1, two: 2, three: 3, ten: 10 } as const)[word.lemma as "one" | "two" | "three" | "ten"] ?? 1;
    return `<div class="wordlight-quantity ${transformed ? "is-transformed" : ""}" data-quantity="${count}" role="img" aria-label="${escapeHtml(word.imageBrief)}">${Array.from({ length: count }, () => '<span class="wordlight-shell"></span>').join("")}</div>`;
  }
  return `<div class="wordlight-color" role="img" aria-label="${escapeHtml(word.imageBrief)}" style="--word-color:${escapeHtml(word.lemma)}"></div>`;
}

function themeById(id: string | null) {
  return ENGLISH_V2_THEMES.find((theme) => theme.id === id) ?? null;
}

export function mountEnglishWorld(root: HTMLElement, options: MountEnglishWorldOptions = {}): MountedGame {
  const storage = options.storage ?? window.localStorage;
  const read = readEnglishWorldSave(storage);
  const seed = options.seed?.trim() || "wordlight-island";
  const returnHref = options.returnHref ?? DEFAULT_RETURN;
  let save: EnglishWorldSaveV2 = read.save;
  let writable = read.writable;
  let view: WorldView = "map";
  let activeThemeId: EnglishThemeId | null = null;
  let mission: EnglishMission | null = null;
  let phase: MissionPhase = "meaning";
  let build: BuildState = initialBuildState();
  let sentenceTileSelected = false;
  let announcement = "选择一个地方，让词光亮起来。";
  let destroyed = false;

  addPageClass();

  const persist = (): void => {
    if (!writable) return;
    if (!writeEnglishWorldSave(save, storage)) announcement = "这次进度没有写入；仍可继续探索。";
  };

  const applySettings = (): void => {
    for (const element of [root, root.querySelector<HTMLElement>(".wordlight")]) {
      if (!element) continue;
      element.dataset.reducedMotion = String(save.settings.reducedMotion);
      element.dataset.soundEnabled = String(save.settings.soundEnabled);
      element.dataset.chineseScaffold = String(save.settings.chineseScaffold);
    }
  };

  const navigate = (next: WorldView, params: Record<string, string> = {}): void => {
    const search = new URLSearchParams({ world: "english-world", ...params });
    window.history.pushState({}, "", `?${search.toString()}`);
    view = next;
    render();
  };

  const renderHeader = (compact = false): string => `<header class="wordlight-header ${compact ? "is-compact" : ""}">
    <div><span class="wordlight-kicker">英语世界</span><h1>词光岛 <small>Wordlight Island</small></h1>${compact ? "" : "<p>看见意思，拼出单词，再让一句话点亮小岛。</p>"}</div>
    <nav aria-label="词光岛导航"><button type="button" data-action="map">岛屿地图</button><button type="button" data-action="journal">词光册</button><a href="?world=english-world&amp;view=memory">English Memory</a><a href="${escapeHtml(returnHref)}">回我的游戏世界</a><button type="button" data-action="settings" aria-haspopup="dialog">设置</button></nav>
  </header>`;

  const renderNotice = (): string => {
    if (read.status === "future-readonly") return `<p class="wordlight-notice" role="status">发现更新版本的本机记录。为保护它，这次只读游玩，不会覆盖。</p>`;
    if (read.status === "corrupt-recovered") return `<p class="wordlight-notice" role="status">本机记录没有读完整，词光岛已从安静的新旅程开始；原始记录没有被当作学习进度。</p>`;
    if (read.legacyRaw !== null && read.status === "fresh") return `<p class="wordlight-notice" role="status" data-testid="legacy-upgrade-notice">旧版记录仍保存在本机。V2 从新的岛屿旅程开始。</p>`;
    return "";
  };

  const renderMap = (): void => {
    root.innerHTML = `<main class="wordlight" data-testid="english-world-map">${renderHeader()}${renderNotice()}
      <section class="wordlight-island" aria-labelledby="island-heading">
        <div class="wordlight-island__sky" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="wordlight-island__intro"><h2 id="island-heading">今天先点亮哪里？</h2><p>五个地方都可以自由进入，没有倒计时，也不会因为离开失去已经点亮的词。</p></div>
        <div class="wordlight-regions">${ENGLISH_V2_THEMES.map((theme, index) => {
          const words = storyWordsForTheme(theme.id);
          const completed = words.filter((word) => save.completedStoryWordIds.includes(word.id)).length;
          return `<article class="wordlight-region wordlight-region--${theme.id}" style="--region-accent:${theme.accent}"><span class="wordlight-region__number">${String(index + 1).padStart(2, "0")}</span><h3>${theme.title}</h3><p>${theme.subtitle}</p><span>${words.length ? `${completed} 个词光已亮起` : "完整世界扩展后开放词光"}</span><button type="button" data-theme-id="${theme.id}">${index === 0 ? "从这里看看" : "进去看看"}</button></article>`;
        }).join("")}</div>
      </section>
      <footer class="wordlight-footer"><p>声音是可选的；没有声音也能完成每一步。</p></footer>
      <div data-settings-layer></div><div class="wordlight-live" aria-live="polite">${escapeHtml(announcement)}</div>
    </main>`;
  };

  const renderRegion = (): void => {
    const theme = themeById(activeThemeId);
    if (!theme) { view = "map"; renderMap(); return; }
    const words = storyWordsForTheme(theme.id);
    const optionalWords = optionalWordsForTheme(theme.id);
    root.innerHTML = `<main class="wordlight" data-testid="english-region" data-region="${theme.id}">${renderHeader(true)}
      <section class="wordlight-region-page" style="--region-accent:${theme.accent}"><button type="button" class="wordlight-back" data-action="map">← 回岛屿地图</button><div class="wordlight-region-page__title"><span>${theme.subtitle}</span><h2>${theme.title}</h2><p>${theme.transformationCopy}</p></div>
      <div class="wordlight-mission-list">${words.map((word) => `<article data-complete="${String(save.completedStoryWordIds.includes(word.id))}">${visualMarkup(word, save.completedStoryWordIds.includes(word.id))}<h3>${word.displayWord}</h3>${save.settings.chineseScaffold ? `<p>${word.childGlossZh}</p>` : ""}<button type="button" data-word-id="${word.id}">${save.completedStoryWordIds.includes(word.id) ? "再让它亮一次" : "跟着词光走"}</button></article>`).join("")}</div>
      <aside class="wordlight-optional"><div><span>Optional word shelf</span><h3>想多看几个词？</h3><p>这些词只放在词光册里，不挡住岛屿故事。</p></div><div>${optionalWords.map((word) => `<button type="button" data-action="journal">${word.displayWord}</button>`).join("")}</div></aside></section>
      <div data-settings-layer></div><div class="wordlight-live" aria-live="polite">${escapeHtml(announcement)}</div>
    </main>`;
  };

  const renderJournal = (): void => {
    root.innerHTML = `<main class="wordlight" data-testid="english-journal">${renderHeader(true)}<section class="wordlight-journal"><button type="button" class="wordlight-back" data-action="map">← 回岛屿地图</button><header><span>Word Journal</span><h2>词光册</h2><p>看图片、单词和声音块。这里没有正确率或错误次数。</p></header><div class="wordlight-journal__grid">${ENGLISH_V2_WORDS.map((word) => {
      const sentence = ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0]);
      const status = word.storyBand === "optional" ? "拓展词" : save.completedStoryWordIds.includes(word.id) ? "已遇见" : "还没遇见";
      return `<article data-testid="journal-word" data-word-id="${word.id}" data-story-band="${word.storyBand}">${visualMarkup(word)}<div><span>${status}</span><h3>${word.displayWord}</h3>${save.settings.chineseScaffold ? `<p>${word.childGlossZh}</p>` : ""}<p>${word.childDefinitionEn}</p><div class="wordlight-chunks" aria-label="${word.displayWord} 的拼写块">${word.graphemeUnits.map((unit) => `<span data-role="${unit.role}">${unit.letters}</span>`).join("")}</div>${sentence ? `<p class="wordlight-journal__sentence">${sentence.text}</p>` : `<p class="wordlight-journal__sentence">Optional word · 可以只看图、词义和拼写块。</p>`}${save.settings.soundEnabled && canSpeakEnglish() ? `<button type="button" data-speak="${escapeHtml(word.displayWord)}">听整个单词</button>` : ""}</div></article>`;
    }).join("")}</div></section><div data-settings-layer></div><div class="wordlight-live" aria-live="polite">${escapeHtml(announcement)}</div></main>`;
  };

  const targetUnitForSlot = (word: EnglishWordRecord, index: number): GraphemeUnit => word.graphemeUnits[index];

  const renderMission = (): void => {
    if (!mission) { view = "map"; renderMap(); return; }
    const { word, sentence } = mission;
    const availableTiles = mission.tiles.filter((tile) => !build.hiddenDistractorIds.includes(tile.id));
    const slotTiles = buildSlotTiles(build, mission);
    const blankTokens = sentenceWithBlank(sentence, word);
    root.innerHTML = `<main class="wordlight wordlight-mission" data-testid="english-mission" data-word-id="${word.id}" data-phase="${phase}">${renderHeader(true)}
      <section class="wordlight-mission__stage"><button type="button" class="wordlight-back" data-action="region">← 回到这个地方</button>
      <div class="wordlight-stepper" aria-label="任务步骤"><span data-current="${String(phase === "meaning")}">看懂</span><span data-current="${String(phase === "build")}">拼词</span><span data-current="${String(phase === "sentence")}">放进句子</span><span data-current="${String(phase === "response")}">世界回应</span></div>
      ${phase === "meaning" ? `<section class="wordlight-meaning"><div>${visualMarkup(word)}<div class="wordlight-scene-glow" aria-hidden="true"></div></div><div><span class="wordlight-phase-label">先看懂它</span><h2>${word.displayWord}</h2>${save.settings.chineseScaffold ? `<p class="wordlight-gloss">${word.childGlossZh}</p>` : ""}<p>${word.childDefinitionEn}</p>${save.settings.soundEnabled && canSpeakEnglish() ? `<button type="button" data-speak="${escapeHtml(word.displayWord)}">听整个单词</button>` : `<p class="wordlight-audio-note">没有可用英文声音也没关系，图片和文字会陪你走完。</p>`}<button type="button" data-action="to-build">看看它怎么拼</button></div></section>` : ""}
      ${phase === "build" ? `<section class="wordlight-build"><header><span class="wordlight-phase-label">把词光放到一起</span><h2>Build ${word.displayWord}</h2><p>${word.decodingBand === "irregular-supported" ? "心形部分需要记住；它不是假装规则的声音。" : "同一个拼写块里的字母会一起发光。"}</p></header><div class="wordlight-sound-map" aria-label="${word.displayWord} 的声音与拼写块">${word.graphemeUnits.map((unit) => `<span data-role="${unit.role}" title="${escapeHtml(unitHint(unit))}">${unit.letters}</span>`).join("")}</div><div class="wordlight-build__slots" aria-label="拼词槽位">${word.graphemeUnits.map((unit, index) => {
        const selected = slotTiles[index];
        const fixed = build.fixedTargetUnitIds.includes(unit.id);
        return `<span data-slot-index="${index}" data-fixed="${String(fixed)}">${escapeHtml(fixed ? targetUnitForSlot(word, index).letters : selected?.letters ?? "")}</span>`;
      }).join("")}</div><div class="wordlight-tile-bank" aria-label="可选拼写块">${availableTiles.map((tile) => `<button type="button" data-tile-id="${escapeHtml(tile.id)}" aria-pressed="${String(build.selectedTileIds.includes(tile.id))}" ${build.selectedTileIds.includes(tile.id) || (tile.targetUnitId ? build.fixedTargetUnitIds.includes(tile.targetUnitId) : false) ? "disabled" : ""}>${escapeHtml(tile.letters)}</button>`).join("")}</div><div class="wordlight-controls"><button type="button" data-action="undo" ${build.selectedTileIds.length ? "" : "disabled"}>撤销</button><button type="button" data-action="reset">重新摆</button><button type="button" data-action="hint">给一点提示</button><button type="button" data-action="check-build">放好这个词</button></div>${build.hintLevel ? `<p class="wordlight-hint" role="status">${build.hintLevel === 1 ? "先看亮起的槽位。" : build.hintLevel === 2 ? "一个多余拼写块已经轻轻退开。" : build.hintLevel === 4 ? word.graphemeUnits.find((unit) => unit.role === "irregular-heart")?.childHint ?? "心形部分已经亮起。" : "一个正确拼写块已经固定。"}</p>` : ""}</section>` : ""}
      ${phase === "sentence" ? `<section class="wordlight-sentence"><div>${visualMarkup(word)}<p>${word.childDefinitionEn}</p></div><div><span class="wordlight-phase-label">把完整单词放进句子</span><h2>${blankTokens.map((token, index) => token.startsWith("__") ? `<button type="button" class="wordlight-sentence__slot" data-action="sentence-slot" aria-label="句子中的空位">${sentenceTileSelected ? word.displayWord : "_____"}</button>` : `<span>${escapeHtml(token)}${index === blankTokens.length - 1 ? "." : ""}</span>`).join(" ")}</h2>${save.settings.chineseScaffold && sentence.scaffoldZh ? `<p class="wordlight-gloss">${sentence.scaffoldZh}</p>` : ""}<button type="button" class="wordlight-word-tile" data-action="sentence-tile" aria-pressed="${String(sentenceTileSelected)}">${word.displayWord}</button><p>先选单词，再点句子里的空位。拖动不是必需的。</p></div></section>` : ""}
      ${phase === "response" ? `<section class="wordlight-response" data-world-action="${sentence.worldActionId}"><div>${visualMarkup(word, true)}<span class="wordlight-response__ripple" aria-hidden="true"></span></div><div><span class="wordlight-phase-label">世界听懂了</span><h2>${sentence.text}</h2><p>${word.displayWord} fits here. ${responseCopy(word.id)}</p><button type="button" data-action="next-word">再找一个词光</button></div></section>` : ""}
      </section><div data-settings-layer></div><div class="wordlight-live" aria-live="polite">${escapeHtml(announcement)}</div></main>`;
  };

  const renderSettings = (): void => {
    const layer = root.querySelector<HTMLElement>("[data-settings-layer]");
    if (!layer) return;
    layer.innerHTML = `<div class="wordlight-dialog-backdrop"><section class="wordlight-dialog" role="dialog" aria-modal="true" aria-labelledby="wordlight-settings-title"><h2 id="wordlight-settings-title">声音和帮助</h2><label><input type="checkbox" data-setting="chineseScaffold" ${save.settings.chineseScaffold ? "checked" : ""}/> 中文帮助</label><label><input type="checkbox" data-setting="soundEnabled" ${save.settings.soundEnabled ? "checked" : ""}/> 可选整词和整句声音</label><label><input type="checkbox" data-setting="reducedMotion" ${save.settings.reducedMotion ? "checked" : ""}/> 减少动态效果</label><p>声音不是答题条件；浏览器 TTS 不作为发音质量证据。</p><button type="button" data-action="close-settings">回到词光岛</button></section></div>`;
    layer.querySelector<HTMLInputElement>("input")?.focus();
  };

  const startMission = (word: EnglishWordRecord): void => {
    const sentence = ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0]);
    if (!sentence) throw new Error(`Missing sentence for ${word.id}`);
    mission = createMission(word, sentence, `${seed}:${word.id}`);
    phase = "meaning";
    build = initialBuildState();
    sentenceTileSelected = false;
    announcement = `先看看 ${word.displayWord} 是什么意思。`;
    view = "mission";
    navigate("mission", { region: word.themeId, word: word.id });
  };

  const completeSentence = (): void => {
    if (!mission) return;
    phase = "response";
    save = updateEnglishWorldSave(save, {
      completedStoryWordIds: [...new Set([...save.completedStoryWordIds, mission.word.id])],
      completedSentenceIds: [...new Set([...save.completedSentenceIds, mission.sentence.id])],
      visitedRegionIds: [...new Set([...save.visitedRegionIds, mission.word.themeId])],
      activeRegionId: mission.word.themeId,
    });
    persist();
    announcement = mission.sentence.text;
    renderMission();
    if (save.settings.soundEnabled) speakEnglish(mission.sentence.text);
  };

  const syncFromLocation = (): void => {
    const search = new URLSearchParams(window.location.search);
    const word = ENGLISH_V2_WORD_BY_ID.get(search.get("word") ?? "");
    const region = themeById(search.get("region"));
    if (word?.storyBand === "story-core") { activeThemeId = word.themeId; startMissionWithoutNavigation(word); return; }
    if (word?.storyBand === "optional") { view = "journal"; render(); return; }
    if (search.get("view") === "journal") { view = "journal"; render(); return; }
    if (region) { activeThemeId = region.id; view = "region"; render(); return; }
    view = "map"; render();
  };

  const startMissionWithoutNavigation = (word: EnglishWordRecord): void => {
    const sentence = ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0]);
    if (!sentence) return;
    mission = createMission(word, sentence, `${seed}:${word.id}`);
    phase = "meaning";
    build = initialBuildState();
    sentenceTileSelected = false;
    view = "mission";
    render();
  };

  const render = (): void => {
    if (destroyed) return;
    window.speechSynthesis?.cancel();
    applySettings();
    if (view === "map") renderMap();
    else if (view === "region") renderRegion();
    else if (view === "journal") renderJournal();
    else renderMission();
    applySettings();
  };

  const click = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button, [data-speak]");
    if (!target) return;
    if (target.dataset.speak) { if (save.settings.soundEnabled) speakEnglish(target.dataset.speak); return; }
    if (target.dataset.themeId) {
      const theme = themeById(target.dataset.themeId);
      if (!theme) return;
      activeThemeId = theme.id;
      save = updateEnglishWorldSave(save, { visitedRegionIds: [...new Set([...save.visitedRegionIds, theme.id])], activeRegionId: theme.id });
      persist();
      navigate("region", { region: theme.id });
      return;
    }
    if (target.dataset.wordId) { const word = ENGLISH_V2_WORD_BY_ID.get(target.dataset.wordId); if (word) startMission(word); return; }
    if (target.dataset.tileId && mission) { build = selectBuildTile(build, mission, target.dataset.tileId); announcement = "拼写块放进槽位了。"; renderMission(); return; }
    switch (target.dataset.action) {
      case "map": activeThemeId = null; navigate("map"); break;
      case "region": if (mission) { activeThemeId = mission.word.themeId; navigate("region", { region: mission.word.themeId }); } break;
      case "journal": navigate("journal", { view: "journal" }); break;
      case "settings": renderSettings(); break;
      case "close-settings": target.closest("[data-settings-layer]")?.replaceChildren(); break;
      case "to-build": phase = "build"; build = initialBuildState(); announcement = "按顺序放好拼写块。"; renderMission(); break;
      case "undo": build = undoBuildTile(build); renderMission(); break;
      case "reset": build = resetBuildState(build); announcement = "拼写块回到原位了。"; renderMission(); break;
      case "hint": if (mission) { build = applyBuildHint(build, mission); renderMission(); } break;
      case "check-build":
        if (!mission) break;
        if (buildIsComplete(build, mission)) { phase = "sentence"; sentenceTileSelected = false; announcement = `${mission.word.displayWord} fits here.`; renderMission(); }
        else { announcement = `Look at the picture again. Try ${mission.word.graphemeUnits.map((unit) => unit.letters).join(" · ")}.`; renderMission(); }
        break;
      case "sentence-tile": sentenceTileSelected = !sentenceTileSelected; announcement = sentenceTileSelected ? "单词已经选中，再点句子空位。" : "单词放回原处了。"; renderMission(); break;
      case "sentence-slot": if (sentenceTileSelected) completeSentence(); else { announcement = "先选完整单词，再点这里。"; renderMission(); } break;
      case "next-word": if (mission) { activeThemeId = mission.word.themeId; navigate("region", { region: mission.word.themeId }); } break;
    }
  };

  const change = (event: Event): void => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>("input[data-setting]");
    if (!input) return;
    const key = input.dataset.setting as keyof EnglishWorldSaveV2["settings"];
    save = updateEnglishWorldSave(save, { settings: { ...save.settings, [key]: input.checked } });
    persist();
    if (key === "soundEnabled" && !input.checked) window.speechSynthesis?.cancel();
    announcement = "设置已保存在本机。";
    render();
    renderSettings();
  };

  root.addEventListener("click", click);
  root.addEventListener("change", change);
  window.addEventListener("popstate", syncFromLocation);
  syncFromLocation();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.speechSynthesis?.cancel();
      root.removeEventListener("click", click);
      root.removeEventListener("change", change);
      window.removeEventListener("popstate", syncFromLocation);
      removePageClass();
      root.replaceChildren();
    },
  };
}

function responseCopy(wordId: string): string {
  const copy: Record<string, string> = {
    "word-cat": "Now the cat can come home.",
    "word-fish": "Now the fish can swim through clear water.",
    "word-cake": "Now the market table glows.",
    "word-milk": "Now the cup is full.",
    "word-run": "Now the path wakes up under quick feet.",
    "word-one": "Now one shell shines on the pier.",
  };
  return copy[wordId] ?? "The island heard the sentence.";
}
