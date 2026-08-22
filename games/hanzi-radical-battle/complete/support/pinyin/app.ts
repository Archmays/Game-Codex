import type { MountedGame } from "../../../../../packages/game-core";
import { PINYIN_CONTRASTS, recordById } from "./contrasts";
import { createPinyinSession } from "./machine";
import { PINYIN_READING_MANIFEST } from "./manifest";
import { readPinyinSave, writePinyinSave, type PinyinSupportSave } from "./save";
import type { PinyinChallenge, PinyinReadingRecord, SoundRhymeMode, ToneNumber } from "./types";
import "./styles.css";

export interface MountSoundRhymeOptions {
  readonly mode?: SoundRhymeMode;
  readonly seed?: string;
  readonly returnHref?: string;
  readonly storage?: Storage;
}

const MODE_LABELS: Readonly<Record<SoundRhymeMode, string>> = {
  assemble: "拼成音节",
  tone: "声调小径",
  contrast: "易混声韵",
};
const TONE_LABELS: Readonly<Record<ToneNumber, string>> = { 1: "一声，平", 2: "二声，向上", 3: "三声，先降后升", 4: "四声，向下", 5: "轻声，轻短" };
const TONE_SHAPES: Readonly<Record<ToneNumber, string>> = { 1: "—", 2: "↗", 3: "∨", 4: "↘", 5: "·" };

function safeMode(value: string | undefined): SoundRhymeMode {
  return value === "tone" || value === "contrast" ? value : "assemble";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

function contentRevision(): string {
  return PINYIN_READING_MANIFEST.map((record) => record.revisionHash.slice(0, 8)).join("");
}

function discoveredCharacters(storage: Storage): readonly string[] {
  try {
    const value = JSON.parse(storage.getItem("family-games/hanzi-magic-complete/v3") ?? "null") as { discoveredCharacterIds?: unknown } | null;
    return Array.isArray(value?.discoveredCharacterIds) ? value.discoveredCharacterIds.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export function mountSoundRhymeTrial(root: HTMLElement, options: MountSoundRhymeOptions = {}): MountedGame {
  const mode = safeMode(options.mode);
  const seed = options.seed?.trim() || "forest-echo";
  const returnHref = options.returnHref ?? "?play=hanzi-magic-complete&from=hub";
  const storage = options.storage ?? window.localStorage;
  const challenges = createPinyinSession(mode, seed, discoveredCharacters(storage));
  let save: PinyinSupportSave = { ...readPinyinSave(mode, contentRevision(), storage), selectedMode: mode };
  let index = 0;
  let step = 0;
  let hintLevel = 0;
  let feedback = "先看看字和词语，再轻轻选一选。";
  let feedbackKind: "calm" | "try" | "found" = "calm";
  let complete = false;
  let destroyed = false;
  const supportsSpeech = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";

  const persist = () => writePinyinSave({ ...save, selectedMode: mode, hintLevel, contentRevision: contentRevision() }, storage);
  const current = () => challenges[index];
  const currentRecord = () => recordById(current().recordId);

  const modeNav = () => (Object.keys(MODE_LABELS) as SoundRhymeMode[]).map((id) =>
    `<a href="?play=hanzi-magic-complete&view=pinyin&mode=${id}&seed=${encodeURIComponent(seed)}" ${id === mode ? 'aria-current="page"' : ""}>${MODE_LABELS[id]}</a>`
  ).join("");

  const optionButton = (value: string, label = value, slot = "answer") =>
    `<button type="button" draggable="true" data-answer="${escapeHtml(value)}" data-slot="${slot}" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</button>`;

  const hint = (challenge: PinyinChallenge, record: PinyinReadingRecord): string => {
    if (hintLevel === 0) return "";
    const messages = [
      "发光的框就是现在要找的位置。",
      `先看词语：${record.fixedPhrase}。`,
      mode === "assemble" ? `先找开头：${record.wholeSyllableTeaching ? "这是整体认读音节" : record.teachingInitial ?? "零声母"}。` : "看看声调的形状和数字。",
      challenge.mode === "contrast" ? "比较两张卡，只选题目问的那一部分。" : "最后一个动作仍由你来完成。",
    ];
    return `<p class="sound-rhyme__hint" data-testid="pinyin-hint">提示 ${Math.min(hintLevel, 4)}：${escapeHtml(messages[Math.min(hintLevel, 4) - 1])}</p>`;
  };

  const assembleBody = (challenge: PinyinChallenge, record: PinyinReadingRecord): string => {
    if (record.wholeSyllableTeaching) {
      const others = PINYIN_READING_MANIFEST.filter((item) => item.wholeSyllableTeaching && item.id !== record.id).slice(0, 2);
      const options = [record.citationPinyinMarked, ...others.map((item) => item.citationPinyinMarked)].sort((a, b) => `${seed}:${a}`.localeCompare(`${seed}:${b}`));
      return `<p class="sound-rhyme__instruction">这是整体认读音节，找出完整的一张。</p><div class="sound-rhyme__slot is-active" data-drop-slot="whole">整体音节</div><div class="sound-rhyme__options">${options.map((value) => optionButton(value, `整体音节 ${value}`, "whole")).join("")}</div>`;
    }
    const phases = [
      { label: "声母", correct: record.teachingInitial ?? "零声母", options: challenge.initialOptions },
      { label: "韵母", correct: record.writtenFinal, options: challenge.finalOptions },
      { label: "声调", correct: String(record.tone), options: challenge.toneOptions.map(String) },
    ];
    const phase = phases[Math.min(step, 2)];
    return `<p class="sound-rhyme__instruction">${step === 0 ? "先找到音节的开头。" : step === 1 ? "再找到后面的韵母。" : "最后让调号落到正确位置。"}</p>
      <div class="sound-rhyme__assembly" aria-label="拼音槽位"><span class="${step === 0 ? "is-active" : "is-filled"}">${step > 0 ? escapeHtml(phases[0].correct) : "声母"}</span><span class="${step === 1 ? "is-active" : step > 1 ? "is-filled" : ""}">${step > 1 ? escapeHtml(phases[1].correct) : "韵母"}</span><span class="${step === 2 ? "is-active" : ""}">${step > 2 ? record.tone : "声调"}</span></div>
      <div class="sound-rhyme__slot is-active" data-drop-slot="${phase.label}">请放入${phase.label}</div>
      <div class="sound-rhyme__options">${phase.options.map((value) => optionButton(value, `${phase.label} ${value}`, phase.label)).join("")}</div>`;
  };

  const toneBody = (challenge: PinyinChallenge): string => `<p class="sound-rhyme__instruction">沿着形状，找到这个读音的声调。</p><div class="sound-rhyme__tone-paths">${challenge.toneOptions.map((tone) => `<button type="button" data-answer="${tone}" aria-label="${TONE_LABELS[tone]}"><span aria-hidden="true">${TONE_SHAPES[tone]}</span><b>${tone === 5 ? "轻声" : `${tone} 声`}</b></button>`).join("")}</div>`;

  const contrastBody = (challenge: PinyinChallenge, record: PinyinReadingRecord): string => {
    const pair = PINYIN_CONTRASTS.find((item) => item.id === challenge.contrastPairId)!;
    const left = recordById(pair.leftRecordId);
    const right = recordById(pair.rightRecordId);
    return `<p class="sound-rhyme__instruction">比较两张词语卡，找出“${record.glyph}”的${pair.dimension === "initial" ? "声母" : "韵母"}。</p>
      <div class="sound-rhyme__contrast-cards"><article><b>${left.glyph}</b><span>${escapeHtml(left.fixedPhrase)}</span></article><article><b>${right.glyph}</b><span>${escapeHtml(right.fixedPhrase)}</span></article></div>
      <div class="sound-rhyme__slot is-active" data-drop-slot="contrast">${record.glyph}的${pair.dimension === "initial" ? "声母" : "韵母"}</div>
      <div class="sound-rhyme__options">${challenge.contrastOptions!.map((value) => optionButton(value, `${record.glyph}的选择 ${value}`, "contrast")).join("")}</div>`;
  };

  const render = () => {
    if (complete) {
      root.innerHTML = `<main class="sound-rhyme" data-testid="sound-rhyme-trial" data-mode="${mode}" data-complete="true"><header><a href="${escapeHtml(returnHref)}">← 回到墨迹森林</a><p>营地里的回声小径</p><h1>声韵试炼</h1></header><section class="sound-rhyme__done" role="status"><span aria-hidden="true">✦</span><h2>这一小段声音都找到了</h2><p>想再走一次，或换一条小径，都可以。</p><nav>${modeNav()}</nav><button type="button" data-action="replay">再走一次</button></section></main>`;
      return;
    }
    const challenge = current();
    const record = currentRecord();
    const body = mode === "assemble" ? assembleBody(challenge, record) : mode === "tone" ? toneBody(challenge) : contrastBody(challenge, record);
    root.innerHTML = `<main class="sound-rhyme" data-testid="sound-rhyme-trial" data-mode="${mode}" data-index="${index}"><header><a href="${escapeHtml(returnHref)}">← 回到墨迹森林</a><p>营地里的回声小径</p><h1>声韵试炼</h1><nav aria-label="选择声韵小径">${modeNav()}</nav></header>
      <section class="sound-rhyme__card"><div class="sound-rhyme__progress" aria-label="本段进度 ${index + 1}/${challenges.length}">${Array.from({ length: challenges.length }, (_, dot) => `<span class="${dot <= index ? "is-lit" : ""}" aria-hidden="true"></span>`).join("")}</div>
      <div class="sound-rhyme__prompt"><span class="sound-rhyme__glyph">${record.glyph}</span><div><h2>${escapeHtml(record.fixedPhrase)}</h2><p>完整词境会一直留在这里。</p></div></div>
      ${body}${hint(challenge, record)}
      <div class="sound-rhyme__feedback is-${feedbackKind}" role="status" aria-live="polite">${escapeHtml(feedback)}</div>
      <div class="sound-rhyme__tools"><button type="button" data-action="hint">给一点提示</button>${supportsSpeech ? `<button type="button" data-action="speak" aria-pressed="${String(save.muted)}">${save.muted ? "声音已关" : "听完整词语"}</button><button type="button" data-action="mute">${save.muted ? "打开声音" : "静音"}</button>` : `<span data-testid="pinyin-no-voice">这台设备暂时没有朗读功能；所有题目仍可用文字完成。</span>`}</div></section>
      <footer>不计分 · 不排名 · 随时可以停下</footer></main>`;
  };

  const correctValue = (): string => {
    const challenge = current();
    const record = currentRecord();
    if (mode === "contrast") return challenge.correctContrast!;
    if (mode === "tone") return String(record.tone);
    if (record.wholeSyllableTeaching) return record.citationPinyinMarked;
    return [record.teachingInitial ?? "零声母", record.writtenFinal, String(record.tone)][Math.min(step, 2)];
  };

  const answer = (value: string) => {
    if (value !== correctValue()) {
      feedbackKind = "try";
      feedback = mode === "tone" ? "声调不同，读音也会变。再看看它的形状。" : mode === "contrast" ? "先看看词语里的读音，再比较一次。" : "这个部分还没找到自己的音节位置。";
      render();
      return;
    }
    if (mode === "assemble" && !currentRecord().wholeSyllableTeaching && step < 2) {
      step += 1;
      feedbackKind = "found";
      feedback = step === 1 ? "声母找到了，接着找韵母。" : "声韵合在一起了，再放上声调。";
      render();
      root.querySelector<HTMLButtonElement>("[data-answer]")?.focus({ preventScroll: true });
      return;
    }
    const record = currentRecord();
    const contrast = PINYIN_CONTRASTS.find((item) => item.id === current().contrastPairId);
    feedbackKind = "found";
    feedback = contrast?.explanation ?? `找到了：${record.fixedPhrase}，读作 ${record.citationPinyinMarked}。`;
    save = { ...save, completedChallengeIds: [...new Set([...save.completedChallengeIds, current().id])] };
    persist();
    if (index >= challenges.length - 1) complete = true;
    else { index += 1; step = 0; hintLevel = 0; }
    window.setTimeout(() => { if (!destroyed) { render(); root.querySelector<HTMLButtonElement>("[data-answer], [data-action=replay]")?.focus({ preventScroll: true }); } }, 260);
    render();
  };

  const speak = () => {
    if (!supportsSpeech || save.muted) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentRecord().fixedPhrase.replace(/[，,].*$/, ""));
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };
  const click = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!target) return;
    if (target.dataset.answer) answer(target.dataset.answer);
    if (target.dataset.action === "hint") { hintLevel = Math.min(4, hintLevel + 1); persist(); render(); }
    if (target.dataset.action === "speak") speak();
    if (target.dataset.action === "mute") { save = { ...save, muted: !save.muted }; window.speechSynthesis?.cancel(); persist(); render(); }
    if (target.dataset.action === "replay") { index = 0; step = 0; hintLevel = 0; complete = false; feedback = "先看看字和词语，再轻轻选一选。"; feedbackKind = "calm"; render(); }
  };
  const dragStart = (event: DragEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-answer]");
    if (target?.dataset.answer) event.dataTransfer?.setData("text/plain", target.dataset.answer);
  };
  const dragOver = (event: DragEvent) => { if ((event.target as HTMLElement).closest("[data-drop-slot]")) event.preventDefault(); };
  const drop = (event: DragEvent) => { if ((event.target as HTMLElement).closest("[data-drop-slot]")) { event.preventDefault(); answer(event.dataTransfer?.getData("text/plain") ?? ""); } };

  root.addEventListener("click", click);
  root.addEventListener("dragstart", dragStart);
  root.addEventListener("dragover", dragOver);
  root.addEventListener("drop", drop);
  render();
  persist();
  return { destroy() { destroyed = true; window.speechSynthesis?.cancel(); root.removeEventListener("click", click); root.removeEventListener("dragstart", dragStart); root.removeEventListener("dragover", dragOver); root.removeEventListener("drop", drop); root.replaceChildren(); } };
}
