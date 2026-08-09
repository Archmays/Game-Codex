import "./styles.css";
import { SpeechSynthesisAdapter } from "../../games/hanzi-radical-battle/v2/golden-slice/phaser/AudioDirector";
import {
  CLASSIC_HUB_FROM_WORLD_ROUTE,
  INK_FOREST_ROUTE,
  MY_GAME_WORLD_ROUTE,
} from "../my-game-world/world-routes";
import { STEP05_AUDIO_MATRIX_RESULTS } from "./audio-matrix";
import {
  STEP05_REVIEW_ITEMS,
  getStep05ReviewItem,
  type Step05ReviewItemId,
} from "./review-items";
import {
  STEP04_RETURN_PACKAGE_SHA256,
  STEP05_EVIDENCE_SHA256,
  STEP05_PROVISIONAL_DECISION,
  STEP05_SAFE_EVIDENCE,
} from "./review-evidence";
import {
  STEP05_REVIEW_DRAFT_KEY,
  STEP05_REVIEW_FILE_NAME,
  carryForwardStep05Feedback,
  createStep05ReviewDraft,
  finalizeStep05ReviewDraft,
  isCurrentStep05Draft,
  missingStep05ReviewFields,
  parseStep05ReviewIdentity,
  type Step05ReviewDraft,
} from "./review-schema";

type Step05ReviewTabId = "evidence" | "audio" | "world" | "navigation" | "authorization";
type PreviewWidth = "desktop" | "tablet" | "mobile";

const TABS: readonly { readonly id: Step05ReviewTabId; readonly label: string }[] = [
  { id: "evidence", label: "真实证据" },
  { id: "audio", label: "Audio context regression" },
  { id: "world", label: "我的游戏世界" },
  { id: "navigation", label: "导航" },
  { id: "authorization", label: "授权" },
] as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function readDraft(identity: ReturnType<typeof parseStep05ReviewIdentity>["identity"]): Step05ReviewDraft {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STEP05_REVIEW_DRAFT_KEY) ?? "null");
    if (isCurrentStep05Draft(parsed, identity)) return parsed;
  } catch {
    // Adult review draft failure never affects child progress.
  }
  return createStep05ReviewDraft(identity);
}

function downloadFeedback(draft: Step05ReviewDraft): void {
  const feedback = finalizeStep05ReviewDraft(draft);
  const blob = new Blob([`${JSON.stringify(feedback, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = STEP05_REVIEW_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function itemDecision(draft: Step05ReviewDraft, itemId: Step05ReviewItemId) {
  const decision = draft.decisions.find((candidate) => candidate.itemId === itemId);
  if (!decision) throw new Error(`Missing STEP 05 decision ${itemId}`);
  return decision;
}

function decisionMarkup(draft: Step05ReviewDraft, itemId: Step05ReviewItemId): string {
  const item = getStep05ReviewItem(itemId);
  const value = itemDecision(draft, itemId);
  if (value.carriedForward) {
    return `<aside class="step05-carried" data-carried-forward="${item.id}"><strong>Round ${draft.reviewRound} 已沿用 ACCEPT</strong><span>item revision 与依赖未变；授权字段仍需本轮重新决定。</span><small>${value.revisionHash}</small></aside>`;
  }
  return `<fieldset class="step05-decision" data-review-item="${item.id}">
    <legend>${escapeHtml(item.title)}</legend>
    <div class="step05-decision__options">${item.allowedDecisions.map((decision) => `<button type="button" data-step05-decision="${decision}" data-item-id="${item.id}" aria-pressed="${String(value.decision === decision)}">${decision}</button>`).join("")}</div>
    <label>必填反馈<textarea rows="3" data-step05-notes="${item.id}" placeholder="只记录观察、担心或具体修改要求，不写身份信息。">${escapeHtml(value.notes)}</textarea></label>
    <small>${item.id} · ${item.revisionHash}</small>
  </fieldset>`;
}

function evidencePanel(draft: Step05ReviewDraft): string {
  const evidence = STEP05_SAFE_EVIDENCE;
  return `<section class="step05-panel" data-testid="step05-evidence-panel">
    <header class="step05-heading"><span class="step05-kicker">DEIDENTIFIED REAL EVIDENCE SYNTHESIS</span><h2>真实首次使用证据</h2><p>这里只展示去身份的事实与推导；原 observation JSON 未复制到应用或 Git。</p></header>
    <div class="step05-identity-grid"><article><span>Raw evidence SHA-256</span><strong>${STEP05_EVIDENCE_SHA256}</strong></article><article><span>Return ZIP SHA-256</span><strong>${STEP04_RETURN_PACKAGE_SHA256}</strong></article><article><span>Build commit</span><strong>${evidence.buildCommit}</strong></article><article><span>本局</span><strong>${evidence.durationMs} ms · run ${evidence.runCount}</strong></article></div>
    <section class="step05-timeline"><h3>Technical timeline</h3><ol>${evidence.timeline.map((entry) => `<li><span>${escapeHtml(entry.label)}</span><strong>${entry.relativeMs} ms</strong></li>`).join("")}</ol></section>
    <section class="step05-reach"><h3>Technical-derived reach</h3>${Object.entries(evidence.checkpointReach).map(([id, value]) => `<span data-reach="${value}">${id}: ${value}</span>`).join("")}</section>
    <div class="step05-two-column"><article><h3>Human observations</h3><ul><li>Again-Again: ${evidence.againAgain}</li><li>Favorite moment: ${evidence.favoriteMoment}</li><li>Comfortable: ${evidence.comfortable}</li><li>Adult interventions: ${evidence.adultInterventions}</li></ul><blockquote>${escapeHtml(evidence.parentNote)}</blockquote></article><article><h3>Replay reconciliation</h3><ul><li>replayIntent = ${evidence.replay.replayIntent}</li><li>parentObservedReplayRequest = ${evidence.replay.parentObservedReplayRequest}</li><li>actualReplayAction = ${String(evidence.replay.actualReplayAction)}</li><li>runCount = ${evidence.replay.runCount}</li></ul><p class="step05-warning">${evidence.replay.consistencyWarning}</p></article></div>
    <aside class="step05-provisional"><span>Provisional evidence decision</span><strong>${STEP05_PROVISIONAL_DECISION}</strong><p>这是私人世界入口候选方向，不是学习、默认入口、完整墨迹森林或正式美术结论。</p></aside>
    <section class="step05-not-concluded"><h3>Not concluded</h3><ul>${evidence.notConcluded.map((entry) => `<li>${entry}</li>`).join("")}</ul></section>
    ${decisionMarkup(draft, "real-first-use-evidence")}
  </section>`;
}

function audioPanel(draft: Step05ReviewDraft): string {
  return `<section class="step05-panel" data-testid="step05-audio-panel"><header class="step05-heading"><span class="step05-kicker">SHARED RUNTIME RESOLVER</span><h2>Audio context regression</h2><p>Actual 结果直接调用 Golden Slice 的 getGoldenVoiceContext。拼音保持可见，但 spokenPhrase 不含拼音。</p></header>
    <div class="step05-audio-matrix" role="table" aria-label="语音上下文阶段矩阵"><div class="step05-audio-row is-header" role="row"><span>阶段</span><span>按钮</span><span>Expected</span><span>Actual</span><span>结果</span></div>${STEP05_AUDIO_MATRIX_RESULTS.map((row) => `<div class="step05-audio-row" role="row" data-audio-matrix-row="${row.id}"><strong>${escapeHtml(row.label)}</strong><span>${row.actualCharacterId ? "visible" : "hidden"}</span><span>${row.expectedCharacterId ?? "none"} / ${row.expectedSource}</span><span>${row.actualCharacterId ?? "none"} / ${row.actualSource}</span><span class="${row.passed ? "is-pass" : "is-fail"}">${row.passed ? "PASS" : "FAIL"}${row.spokenPhrase ? `<button type="button" data-audio-test="${row.id}">实际试听</button>` : ""}</span></div>`).join("")}</div>
    <p class="step05-audio-status" data-audio-status role="status">试听只调用本机设备语音，不上传、不记录 voice name。</p>
    ${decisionMarkup(draft, "audio-context-regression")}
  </section>`;
}

function worldPanel(draft: Step05ReviewDraft, previewWidth: PreviewWidth): string {
  return `<section class="step05-panel" data-testid="step05-world-panel"><header class="step05-heading"><span class="step05-kicker">SAME LIVE WORLD</span><h2>我的游戏世界</h2><p>真实 world route，无 transform/scale mock。检查营地、森林、魔法书、百宝箱、无 dashboard 和无 PII。</p></header>
    <div class="step05-preview-controls">${(["desktop", "tablet", "mobile"] as const).map((width) => `<button type="button" data-preview-width="${width}" aria-pressed="${String(width === previewWidth)}">${width}</button>`).join("")}<a href="${MY_GAME_WORLD_ROUTE}" target="_blank" rel="noopener noreferrer">新标签打开</a></div>
    <div class="step05-world-frame step05-world-frame--${previewWidth}"><iframe title="我的游戏世界 live review" data-testid="step05-world-preview" src="${MY_GAME_WORLD_ROUTE}" loading="eager"></iframe></div>
    ${decisionMarkup(draft, "private-world-shell")}
  </section>`;
}

function navigationPanel(draft: Step05ReviewDraft): string {
  return `<section class="step05-panel" data-testid="step05-navigation-panel"><header class="step05-heading"><span class="step05-kicker">EXPLICIT QUERY CONTEXT</span><h2>导航</h2><p>默认 / 不变；只有 from=world 才显示 Golden Slice 的返回世界动作。</p></header>
    <ol class="step05-navigation-list"><li><strong>world → forest</strong><code>${INK_FOREST_ROUTE}</code><a href="${INK_FOREST_ROUTE}" target="_blank" rel="noopener noreferrer">打开</a></li><li><strong>run complete → world</strong><code>${MY_GAME_WORLD_ROUTE}</code><span>仅 from=world</span></li><li><strong>world → spellbook → world</strong><span>同一 live world DOM modal</span></li><li><strong>world → treasure → classic hub → world</strong><code>${CLASSIC_HUB_FROM_WORLD_ROUTE}</code><a href="${CLASSIC_HUB_FROM_WORLD_ROUTE}" target="_blank" rel="noopener noreferrer">打开</a></li></ol>
    <aside class="step05-callout">Classic hub 仍由原 mountHub 挂到 inner container；外层世界返回键不会被 hub 的清空/换 class 操作移除。</aside>
    ${decisionMarkup(draft, "world-navigation")}
  </section>`;
}

function authorizationPanel(draft: Step05ReviewDraft, identityValid: boolean, identityIssues: readonly string[]): string {
  const missing = missingStep05ReviewFields(draft);
  return `<section class="step05-panel" data-testid="step05-authorization-panel"><header class="step05-heading"><span class="step05-kicker">PARENT GATE · NO AUTOMATIC PROMOTION</span><h2>授权</h2><p>两项授权独立；任何技术 PASS 都不会自动选择 YES。</p></header>
    <div class="step05-authorization-grid"><fieldset><legend>authorizeDefaultWorldEntry</legend>${(["YES", "NO"] as const).map((value) => `<button type="button" data-authorization="default" data-value="${value}" aria-pressed="${String(draft.authorizeDefaultWorldEntry === value)}">${value}</button>`).join("")}</fieldset><fieldset><legend>authorizeSecondUseCheck</legend>${(["YES", "NO"] as const).map((value) => `<button type="button" data-authorization="second-use" data-value="${value}" aria-pressed="${String(draft.authorizeSecondUseCheck === value)}">${value}</button>`).join("")}</fieldset></div>
    <label class="step05-general-notes">总体必填说明<textarea rows="4" data-general-notes placeholder="记录总体决定边界；不要写身份信息。">${escapeHtml(draft.generalNotes)}</textarea></label>
    <div class="step05-summary-grid"><article><span>Review round</span><strong>${draft.reviewRound}</strong></article><article><span>Missing</span><strong data-summary-missing>${missing.length}</strong></article><article><span>Identity</span><strong>${identityValid ? "VALID" : "BLOCKED"}</strong></article><article><span>Carried</span><strong>${draft.decisions.filter((item) => item.carriedForward).length}</strong></article></div>
    ${identityValid ? "" : `<aside class="step05-warning">${identityIssues.map(escapeHtml).join(" · ")}</aside>`}
    <label class="step05-file-button">导入上一轮 changed-only JSON<input type="file" accept="application/json" data-import-feedback></label>
    <div class="step05-export"><div><span>固定导出</span><strong>${STEP05_REVIEW_FILE_NAME}</strong><p>导出只表示家长字段完整，不等于默认推广或学习验证。</p></div><button type="button" data-export-feedback ${identityValid && missing.length === 0 ? "" : "disabled"}>导出家长反馈</button></div>
  </section>`;
}

export function mountHanziV2Step05Review(root: HTMLElement): { destroy(): void } {
  const identityResult = parseStep05ReviewIdentity(window.location.search);
  let draft = readDraft(identityResult.identity);
  let activeTab: Step05ReviewTabId = "evidence";
  let previewWidth: PreviewWidth = "desktop";
  const voice = new SpeechSynthesisAdapter();

  document.documentElement.classList.add("step05-review-page");
  document.body.classList.add("step05-review-page");

  const saveDraft = (): void => {
    try { window.localStorage.setItem(STEP05_REVIEW_DRAFT_KEY, JSON.stringify(draft)); } catch { /* Parent draft remains in memory. */ }
  };

  const setDecision = (itemId: Step05ReviewItemId, decision: "ACCEPT" | "REVISE" | "REJECT"): void => {
    const item = getStep05ReviewItem(itemId);
    if (!item.allowedDecisions.includes(decision as never)) return;
    draft = { ...draft, decisions: draft.decisions.map((entry) => entry.itemId === itemId ? { ...entry, decision, carriedForward: false } : entry) };
    saveDraft();
    render();
  };

  const panel = (): string => {
    if (activeTab === "evidence") return evidencePanel(draft);
    if (activeTab === "audio") return audioPanel(draft);
    if (activeTab === "world") return worldPanel(draft, previewWidth);
    if (activeTab === "navigation") return navigationPanel(draft);
    return authorizationPanel(draft, identityResult.valid, identityResult.issues);
  };

  const bind = (): void => {
    root.querySelectorAll<HTMLElement>("[data-review-tab]").forEach((button) => button.addEventListener("click", () => {
      activeTab = button.dataset.reviewTab as Step05ReviewTabId;
      render();
    }));
    root.querySelectorAll<HTMLElement>("[data-step05-decision]").forEach((button) => button.addEventListener("click", () => {
      setDecision(button.dataset.itemId as Step05ReviewItemId, button.dataset.step05Decision as "ACCEPT" | "REVISE" | "REJECT");
    }));
    root.querySelectorAll<HTMLTextAreaElement>("[data-step05-notes]").forEach((textarea) => textarea.addEventListener("input", () => {
      const itemId = textarea.dataset.step05Notes as Step05ReviewItemId;
      draft = { ...draft, decisions: draft.decisions.map((entry) => entry.itemId === itemId ? { ...entry, notes: textarea.value, carriedForward: false } : entry) };
      saveDraft();
    }));
    root.querySelectorAll<HTMLElement>("[data-preview-width]").forEach((button) => button.addEventListener("click", () => {
      previewWidth = button.dataset.previewWidth as PreviewWidth;
      render();
    }));
    root.querySelectorAll<HTMLElement>("[data-audio-test]").forEach((button) => button.addEventListener("click", async () => {
      const row = STEP05_AUDIO_MATRIX_RESULTS.find((candidate) => candidate.id === button.dataset.audioTest);
      const status = root.querySelector<HTMLElement>("[data-audio-status]");
      if (!row?.spokenPhrase) return;
      if (status) status.textContent = `${row.label}: ${row.spokenPhrase}`;
      try { await voice.speak(row.spokenPhrase, "zh-CN"); } catch { if (status) status.textContent = `${row.label}: 本机语音不可用，视觉内容仍保留。`; }
    }));
    root.querySelectorAll<HTMLElement>("[data-authorization]").forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.value as "YES" | "NO";
      draft = button.dataset.authorization === "default" ? { ...draft, authorizeDefaultWorldEntry: value } : { ...draft, authorizeSecondUseCheck: value };
      saveDraft();
      render();
    }));
    root.querySelector<HTMLTextAreaElement>("[data-general-notes]")?.addEventListener("input", (event) => {
      draft = { ...draft, generalNotes: (event.currentTarget as HTMLTextAreaElement).value };
      saveDraft();
      const missing = missingStep05ReviewFields(draft);
      const missingCount = root.querySelector<HTMLElement>("[data-summary-missing]");
      const exportButton = root.querySelector<HTMLButtonElement>("[data-export-feedback]");
      if (missingCount) missingCount.textContent = String(missing.length);
      if (exportButton) exportButton.disabled = !identityResult.valid || missing.length > 0;
    });
    root.querySelector<HTMLInputElement>("[data-import-feedback]")?.addEventListener("change", async (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const previous: unknown = JSON.parse(await file.text());
        draft = carryForwardStep05Feedback(previous, identityResult.identity);
        saveDraft();
        render();
      } catch {
        window.alert("上一轮 JSON 无法读取；没有沿用任何决定。");
      }
    });
    root.querySelector<HTMLElement>("[data-export-feedback]")?.addEventListener("click", () => downloadFeedback(draft));
  };

  const render = (): void => {
    root.className = "step05-review-mount";
    root.innerHTML = `<main class="step05-review" data-testid="step05-review-app">
      <header class="step05-header"><div><span class="step05-kicker">STEP 05 · CHANGED-ONLY PARENT REVIEW</span><h1>私人游戏世界入口候选</h1></div><div class="step05-header__identity"><span>commit ${escapeHtml(identityResult.identity.candidateCommit || "MISSING")}</span><span>revision ${escapeHtml(identityResult.identity.candidateRevision || "MISSING")}</span><span>evidence ${escapeHtml(identityResult.identity.evidenceSha256 || "MISSING")}</span></div></header>
      <nav class="step05-tabs" aria-label="STEP 05 审核标签">${TABS.map((tab, index) => `<button type="button" data-review-tab="${tab.id}" aria-current="${activeTab === tab.id ? "page" : "false"}"><span>${String(index + 1).padStart(2, "0")}</span>${tab.label}</button>`).join("")}</nav>
      <div class="step05-body">${panel()}</div>
      <footer class="step05-footer"><span>本地家长审核 · 无儿童身份数据 · 无自动推广</span><span>${STEP05_REVIEW_ITEMS.length} changed-only decisions</span></footer>
    </main>`;
    bind();
  };

  render();
  return {
    destroy(): void {
      voice.stop();
      document.documentElement.classList.remove("step05-review-page");
      document.body.classList.remove("step05-review-page");
      root.replaceChildren();
    },
  };
}

export * from "./audio-matrix";
export * from "./review-evidence";
export * from "./review-items";
export * from "./review-schema";
