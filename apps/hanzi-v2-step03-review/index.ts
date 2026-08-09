import "./styles.css";
import {
  FINAL_GOLDEN_MANIFEST,
  GOLDEN_ABILITIES,
  GOLDEN_BOSS_PHASES,
  GOLDEN_SLICE_ENCOUNTERS,
  GOLDEN_SLICE_PACING,
  GOLDEN_SLICE_PACING_CONTRACT,
  THEME_C_PROCEDURAL_ASSETS,
} from "../../games/hanzi-radical-battle/v2/golden-slice/content";
import { GOLDEN_SLICE_REVIEW_ROUTE, STEP03_REVIEW_IDENTITY } from "./review-identity";
import {
  STEP03_REVIEW_ITEMS,
  STEP03_REVIEW_TABS,
  THEME_C_IMAGEGEN_SEED_PREVIEWS,
  type Step03ReviewItemId,
  type Step03ReviewTabId,
} from "./review-items";
import {
  ABILITY_DECISION_IDS,
  ASSET_DECISION_IDS,
  REQUIRED_REVIEW_FIELD_COUNT,
  REVIEW_DRAFT_KEY,
  REVIEW_FILE_NAME,
  carryForwardReview,
  createReviewDraft,
  finalizeReviewDraft,
  isCurrentReviewDraft,
  missingReviewDecisions,
  synchronizeFormalFields,
  type AssetDecisionId,
  type AudioDecision,
  type ChildUseDecision,
  type ReviewDecision,
  type Step03ReviewDraft,
} from "./review-schema";

type PreviewWidth = "desktop" | "tablet" | "mobile";
type PreviewControlAction = "mute" | "reduced-motion" | "reset";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function readDraft(): Step03ReviewDraft {
  const raw = window.localStorage.getItem(REVIEW_DRAFT_KEY);
  if (!raw) return createReviewDraft();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCurrentReviewDraft(parsed)) return parsed;
  } catch {
    // Invalid adult-review data is reset locally and never touches child progress.
  }
  return createReviewDraft();
}

function downloadJson(draft: Step03ReviewDraft): void {
  const finalized = finalizeReviewDraft(draft);
  const blob = new Blob([`${JSON.stringify(finalized, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = REVIEW_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function availableVoices(): SpeechSynthesisVoice[] {
  return typeof window.speechSynthesis === "undefined" ? [] : window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("zh"));
}

function itemFor(id: Step03ReviewItemId) {
  const item = STEP03_REVIEW_ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing STEP 03 review item: ${id}`);
  return item;
}

function previewWidthClass(width: PreviewWidth): string {
  return `step03-preview-frame step03-preview-frame--${width}`;
}

export function mountHanziV2Step03Review(root: HTMLElement): void {
  let draft = readDraft();
  let activeTab: Step03ReviewTabId = "scope";
  let previewWidth: PreviewWidth = "desktop";
  let previewStatus = "Parent review mode · local candidate only";
  let ttsStatus = "TTS is a parent-only candidate; visual pronunciation remains required.";

  const saveDraft = (): void => {
    draft = synchronizeFormalFields(draft);
    window.localStorage.setItem(REVIEW_DRAFT_KEY, JSON.stringify(draft));
  };
  const itemDecision = (id: Step03ReviewItemId) => {
    const decision = draft.decisions.items.find((entry) => entry.itemId === id);
    if (!decision) throw new Error(`Missing STEP 03 review item: ${id}`);
    return decision;
  };
  const characterDecision = (id: string) => {
    const decision = draft.decisions.characters.find((entry) => entry.characterId === id);
    if (!decision) throw new Error(`Missing STEP 03 manifest character: ${id}`);
    return decision;
  };
  const carried = (id: string, revisionHash: string) => `<aside class="step03-carried" data-carried-forward="${id}"><strong>已沿用</strong><span>revision hash 与依赖未变，保留上一轮 ACCEPT 和原反馈。</span><small>${escapeHtml(revisionHash)}</small></aside>`;
  const itemEvidence = (id: Step03ReviewItemId) => {
    const item = itemFor(id);
    return `<dl class="step03-evidence"><div><dt>儿童价值</dt><dd>${escapeHtml(item.childValue)}</dd></div><div><dt>汉字学习价值</dt><dd>${escapeHtml(item.learningValue)}</dd></div><div><dt>自动验证</dt><dd>${escapeHtml(item.automaticEvidence)}</dd></div><div><dt>真人观察</dt><dd>${escapeHtml(item.observationNeed)}</dd></div></dl>`;
  };
  const reviewFields = (id: Step03ReviewItemId) => {
    const item = itemFor(id);
    const decision = itemDecision(id);
    if (decision.carriedForward) return carried(id, decision.revisionHash);
    return `<fieldset class="step03-decision" data-review-item="${id}"><legend>${escapeHtml(item.title)} · 正式反馈</legend><p>自动检查只说明技术状态；请写下至少一句观察、担心或具体修改要求。</p><div class="step03-decision__options">${(["ACCEPT", "REVISE", "REJECT"] as const).map((value) => `<button type="button" data-decision="${value}" data-item-id="${id}" aria-pressed="${decision.decision === value}">${value}</button>`).join("")}</div><label>必填反馈<textarea rows="3" data-item-notes="${id}" placeholder="请记录看到的事实、担心或要修改的地方。">${escapeHtml(decision.notes)}</textarea></label><small>stable item ID: ${id} · revision: ${escapeHtml(decision.revisionHash)}</small></fieldset>`;
  };
  const notesOnly = (id: Step03ReviewItemId, title: string) => {
    const decision = itemDecision(id);
    if (decision.carriedForward) return carried(id, decision.revisionHash);
    return `<fieldset class="step03-decision" data-review-item="${id}"><legend>${escapeHtml(title)} · 必填汇总反馈</legend><p>各项决定分别保存在正式 schema；这里记录这一组的整体观察。</p><label>必填反馈<textarea rows="3" data-item-notes="${id}" placeholder="记录本轮观察或具体修改要求。">${escapeHtml(decision.notes)}</textarea></label><small>stable item ID: ${id} · revision: ${escapeHtml(decision.revisionHash)}</small></fieldset>`;
  };
  const individualDecisionButtons = (attribute: string, id: string, selected: ReviewDecision) => `<div class="step03-decision__options">${(["ACCEPT", "REVISE", "REJECT"] as const).map((value) => `<button type="button" ${attribute}="${id}" data-decision-value="${value}" aria-pressed="${selected === value}">${value}</button>`).join("")}</div>`;
  const previewSrc = () => `${GOLDEN_SLICE_REVIEW_ROUTE}&reviewViewport=${previewWidth}`;
  const updatePreviewStatus = (message: string): void => {
    previewStatus = message;
    const status = root.querySelector<HTMLElement>("[data-preview-status]");
    if (status) status.textContent = message;
  };
  const sendPreviewControl = (action: PreviewControlAction, value?: boolean): void => {
    const frame = root.querySelector<HTMLIFrameElement>("[data-testid='golden-slice-preview']");
    if (!frame?.contentWindow) {
      updatePreviewStatus("Preview control unavailable; no setting was claimed.");
      return;
    }
    updatePreviewStatus(`Applying ${action} to the loaded local preview…`);
    const send = () => frame.contentWindow?.postMessage({
      type: "hanzi-v2-step03-review-control",
      action,
      value,
    }, window.location.origin);
    if (frame.contentDocument?.readyState === "complete") send();
    else frame.addEventListener("load", send, { once: true });
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const frame = root.querySelector<HTMLIFrameElement>("[data-testid='golden-slice-preview']");
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    if (!event.data || typeof event.data !== "object") return;
    const message = event.data as { type?: unknown; action?: unknown };
    if (message.type !== "hanzi-v2-step03-review-control-applied") return;
    if (message.action === "mute") updatePreviewStatus("Preview muted locally; visual fallback remains required.");
    else if (message.action === "reduced-motion") updatePreviewStatus("Preview uses reduced motion locally.");
    else if (message.action === "reset") updatePreviewStatus("Preview reset: only the local Golden Slice save was cleared.");
  });

  const panelFor = (): string => {
    if (activeTab === "scope") {
      const carriedCount = draft.decisions.items.filter((item) => item.carriedForward).length + draft.decisions.characters.filter((item) => item.carriedForward).length;
      return `<section class="step03-reading"><span class="step03-kicker">STEP 03 · PARENT REVIEW WORKBENCH</span><h2>Scope / Carry-forward</h2><p class="step03-lead">这是本地成人终审候选，不加入十项大厅、不推断儿童接受、也不启动儿童观察。</p><div class="step03-scope-grid"><article><span>这轮范围</span><strong>3–5 分钟 · 12 字上限</strong><p>首次 run 固定 明、花、林、星；其余八字只在 Manifest 中审核。</p></article><article><span>Carry-forward</span><strong>${carriedCount} 项已沿用</strong><p>只沿用 revision 未变、依赖未受影响且上一轮为 ACCEPT 的记录。</p></article><article><span>明确没有做</span><strong>大厅推广、儿童结论、行为画像</strong><p>技术通过或截图均不代替家长决定。</p></article><article><span>技术状态</span><strong>${escapeHtml(STEP03_REVIEW_IDENTITY.technicalState)}</strong><p>本地、无账号、无遥测、无云端儿童数据。</p></article></div></section>`;
    }
    if (activeTab === "golden-slice") {
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">WHOLE LOCAL CANDIDATE · PARENT MODE</span><h2>完整 Golden Slice</h2><p>iframe 显式使用 <code>mode=review</code>，因此可见 ParentDebugOverlay；普通儿童路由没有该工具。预览没有 transform/scale。</p></div><a class="step03-open-link" href="${GOLDEN_SLICE_REVIEW_ROUTE}" target="_blank" rel="noopener noreferrer">新标签打开审核模式</a></header><div class="step03-preview-controls" data-testid="golden-slice-preview-controls"><span>seed: <strong>hanzi-v2-golden-slice-v1</strong></span>${(["desktop", "tablet", "mobile"] as const).map((width) => `<button type="button" data-preview-width="${width}" aria-pressed="${previewWidth === width}">${width}</button>`).join("")}<button type="button" data-preview-reset>reset preview</button><button type="button" data-preview-mute>mute</button><button type="button" data-preview-reduced-motion>reduced motion</button><small data-preview-status>${escapeHtml(previewStatus)}</small></div><div class="${previewWidthClass(previewWidth)}"><iframe data-testid="golden-slice-preview" title="汉字魔法战 V2 黄金样板完整审核预览" src="${previewSrc()}" allow="autoplay" loading="eager"></iframe></div><section class="step03-pacing"><h3>Beat / event timing（无倒计时压力）</h3><p>目标 ${GOLDEN_SLICE_PACING_CONTRACT.targetMinutes.minimum}–${GOLDEN_SLICE_PACING_CONTRACT.targetMinutes.maximum} 分钟；首个施法技术预算 ≤ ${GOLDEN_SLICE_PACING_CONTRACT.firstSpellBySeconds} 秒，页面不显示儿童倒计时。</p><ul>${GOLDEN_SLICE_PACING.map((beat) => `<li><strong>${escapeHtml(beat.id)}</strong><span>${beat.minimumSeconds}–${beat.maximumSeconds}s · ${escapeHtml(beat.purpose)}</span></li>`).join("")}</ul></section><section class="step03-encounter-list"><h3>四次 encounter 证据</h3>${GOLDEN_SLICE_ENCOUNTERS.map((encounter) => `<article class="step03-encounter" data-testid="golden-encounter-${encounter.id}"><header><span>${String(encounter.sequence).padStart(2, "0")}</span><div><h3>${escapeHtml(encounter.characterId)} · ${escapeHtml(encounter.prompt)}</h3><p>${escapeHtml(encounter.structure)} · ${encounter.kind === "boss-phase" ? "Boss phase" : "普通相遇"}</p></div></header><div class="step03-card-row">${encounter.cards.map((card) => `<span class="${card.kind === "target" ? "is-target" : ""}">${escapeHtml(card.glyph)}<small>${escapeHtml(card.id)}</small></span>`).join("")}</div><p class="step03-slots">槽位：${encounter.slots.map((slot) => `${slot.label} (${slot.id})`).join(" · ")}<br>${escapeHtml(encounter.handAuditNote)}</p></article>`).join("")}</section>${itemEvidence("slice-preview")}${reviewFields("slice-preview")}${itemEvidence("encounter-structure")}${reviewFields("encounter-structure")}</section>`;
    }
    if (activeTab === "manifest") {
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">12 STABLE CHARACTER RECORDS</span><h2>12 字 Manifest</h2><p>每字有独立 stable ID、revision hash、决定和反馈。changed-only 导入时，已 ACCEPT 且未变的字折叠；REVISE、REJECT、新字或变更字仍展开。</p></div><div class="step03-count">${FINAL_GOLDEN_MANIFEST.length} / 12</div></header><div class="step03-manifest-grid">${FINAL_GOLDEN_MANIFEST.map((character) => { const decision = characterDecision(character.id); return `<article class="step03-character" data-testid="final-manifest-card-${character.id}" data-character-review="${character.id}"><div><strong lang="zh-Hans">${character.glyph}</strong><span>${escapeHtml(character.pinyin)}</span></div><h3>${escapeHtml(character.familiarWord)}</h3><p>${escapeHtml(character.shortMeaning)}</p><dl><div><dt>真实结构</dt><dd>${escapeHtml(character.structure)} · ${character.components.map((part) => `${part.glyph}→${part.slotId}`).join("；")}</dd></div><div><dt>字义魔法</dt><dd>${escapeHtml(character.magic.name)}：${escapeHtml(character.magic.effect)}</dd></div><div><dt>范围</dt><dd>${character.stage === "first-run" ? "首次 run" : "成人 manifest 浏览"}</dd></div></dl>${decision.carriedForward ? `<div class="step03-character-carried" data-carried-forward="character:${character.id}">已沿用上一轮 ACCEPT</div>` : `${individualDecisionButtons("data-character-decision", character.id, decision.decision)}<label>必填反馈<textarea rows="2" data-character-notes="${character.id}">${escapeHtml(decision.notes)}</textarea></label>`}<small>${character.id} · ${escapeHtml(decision.revisionHash)}</small></article>`; }).join("")}</div>${itemEvidence("final-manifest")}${notesOnly("final-manifest", "12 字 Manifest 粗粒度决定")}</section>`;
    }
    if (activeTab === "abilities") {
      const grouped = itemDecision("ability-trio");
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">THREE INDEPENDENT DECISIONS</span><h2>三能力</h2><p>每项都必须有独立 ACCEPT / REVISE / REJECT；它们都只能帮助看见下一步，绝不代放或完成汉字。</p></div></header><div class="step03-ability-grid">${GOLDEN_ABILITIES.map((ability) => `<article class="step03-ability" data-testid="ability-review-${ability.id}"><span>${escapeHtml(ability.timing)}</span><h3>${escapeHtml(ability.name)}</h3><p>${escapeHtml(ability.exactEffect)}</p><small>每个 Boss 阶段 ${ability.usesPerBossPhase} 次 · neverAutoSolves: ${String(ability.neverAutoSolves)}</small>${grouped.carriedForward ? `<div class="step03-character-carried">已沿用上一轮 ACCEPT</div>` : `${individualDecisionButtons("data-ability-decision", ability.id, draft.abilityDecisions[ability.id])}<a class="step03-open-link" href="${GOLDEN_SLICE_REVIEW_ROUTE}" target="_blank" rel="noopener noreferrer">打开审核模式并跳转</a>`}</article>`).join("")}</div><aside class="step03-callout"><strong>ParentDebugOverlay</strong><span>在上方审核模式预览或新标签中，用可见的“ 三选一 ”与“ Boss ”跳转按钮检查 ability / Boss 状态。</span></aside>${itemEvidence("ability-trio")}${notesOnly("ability-trio", "三能力汇总")}</section>`;
    }
    if (activeTab === "boss") {
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">SMALL CLIMAX, NO HP GRIND</span><h2>Boss</h2><p>林 → 星只综合已经出现过的结构；干扰可恢复，safe retry 与墨点回声都不会抹去发现。</p></div></header><div class="step03-boss-grid">${GOLDEN_BOSS_PHASES.map((phase, index) => `<article class="step03-boss"><span>阶段 ${index + 1}</span><h3>${phase.id === "lin" ? "林守护" : "星路指引"}</h3><p>${escapeHtml(phase.intent)}</p><dl><div><dt>触发</dt><dd>${escapeHtml(phase.trigger)}</dd></div><div><dt>恢复</dt><dd>${escapeHtml(phase.recovery)}</dd></div><div><dt>代答</dt><dd>${phase.neverAutoSolves ? "不会自动完成" : "需停止审核"}</dd></div></dl></article>`).join("")}</div>${itemEvidence("two-phase-boss")}${reviewFields("two-phase-boss")}</section>`;
    }
    if (activeTab === "assets") {
      const grouped = itemDecision("theme-c");
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">THEME C · PROCEDURAL + FIXED SEEDS</span><h2>主题 C / 资产</h2><p>程序化候选始终是 child route 的运行时画面；三个固定 seed 只作为本地 parent review 的生产候选预览。</p></div></header><div class="step03-seed-grid">${THEME_C_IMAGEGEN_SEED_PREVIEWS.map((preview) => `<figure data-testid="theme-c-seed-${preview.id}"><img src="${preview.src}" alt="${preview.label} Theme C parent-review seed" loading="lazy"><figcaption>${preview.label} · fixed review path</figcaption></figure>`).join("")}</div><div class="step03-theme-grid"><article class="step03-theme-card"><h3>程序化候选</h3><ul>${THEME_C_PROCEDURAL_ASSETS.map((asset) => `<li><strong>${escapeHtml(asset.role)}</strong><span>${escapeHtml(asset.key)}</span></li>`).join("")}</ul></article><article class="step03-theme-card"><h3>资产逐项决定</h3>${grouped.carriedForward ? `<div class="step03-character-carried">已沿用上一轮 ACCEPT</div>` : `<div class="step03-asset-decisions">${ASSET_DECISION_IDS.map((id) => `<div data-testid="asset-review-${id}"><strong>${id}</strong>${individualDecisionButtons("data-asset-decision", id, draft.assetDecisions[id])}</div>`).join("")}</div>`}</article></div>${itemEvidence("theme-c")}${notesOnly("theme-c", "主题 C / 资产汇总")}</section>`;
    }
    if (activeTab === "audio") {
      const voices = availableVoices();
      const audioItem = itemDecision("audio-and-accessibility");
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">PARENT CANDIDATE ONLY</span><h2>音频 / 读音</h2><p>TTS 仅供成人候选审阅；儿童理解不得依赖它。音量关闭、减少动态和文字/画面 fallback 必须仍然可读。</p></div></header><div class="step03-theme-grid"><article class="step03-theme-card"><h3>实际可用 TTS voice</h3>${voices.length ? `<ul data-testid="tts-voice-list">${voices.map((voice) => `<li><strong>${escapeHtml(voice.name)}</strong><span>${escapeHtml(voice.lang)}${voice.default ? " · default" : ""}</span></li>`).join("")}</ul>` : `<p data-testid="tts-no-voice">浏览器没有报告本地中文 voice；保持静音和视觉 fallback。</p>`}</article><article class="step03-theme-card"><h3>静音与视觉 fallback</h3><ul><li><strong>mute</strong><span>声音不承担状态、结构或成字信息。</span></li><li><strong>reduced motion</strong><span>非必要动画有稳定替代。</span></li><li><strong>visual</strong><span>拼音、熟悉词、短义和世界变化保持可见。</span></li></ul></article></div><div class="step03-audio-characters">${FINAL_GOLDEN_MANIFEST.filter((character) => character.stage === "first-run").map((character) => `<article><strong>${character.glyph}</strong><span>${escapeHtml(character.pinyin)} · ${escapeHtml(character.familiarWord)}</span><button type="button" data-parent-tts-character="${character.id}">重听（仅家长候选）</button></article>`).join("")}</div><p class="step03-tts-status" data-tts-status>${escapeHtml(ttsStatus)}</p>${audioItem.carriedForward ? carried("audio-and-accessibility", audioItem.revisionHash) : `<fieldset class="step03-decision" data-review-item="audio-and-accessibility"><legend>audioDecision · 正式决定</legend><p>选择当前 TTS 候选、要求录制音频、修改或拒绝；该专用枚举会精确导出。</p><div class="step03-decision__options">${(["ACCEPT CURRENT CANDIDATE", "NEED RECORDED AUDIO", "REVISE", "REJECT"] as const).map((value) => `<button type="button" data-audio-decision="${value}" aria-pressed="${draft.audioDecision === value}">${value}</button>`).join("")}</div><label>必填反馈<textarea rows="3" data-item-notes="audio-and-accessibility">${escapeHtml(audioItem.notes)}</textarea></label><small>stable item ID: audio-and-accessibility · revision: ${escapeHtml(audioItem.revisionHash)}</small></fieldset>`}${itemEvidence("audio-and-accessibility")}</section>`;
    }
    if (activeTab === "child-gate") {
      const checklist = ["首屏", "first spell", "second structure", "ability", "boss", "failure", "privacy", "observer instructions", "technical device", "是否授权"];
      return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">PREP ONLY · NO IMPLIED CHILD ACCEPTANCE</span><h2>儿童 First-Use Gate</h2><p>本页列出观察准备；最终 YES / NO / NOT_YET 只能在总结/导出页由家长明确选择。</p></div></header><div class="step03-gate-checklist">${checklist.map((label, index) => `<label><input type="checkbox" data-gate-check="${index}"> <span>${label}</span></label>`).join("")}</div><div class="step03-gate-grid"><article><span>技术可检查</span><strong>本地存档、导出/清除、无账号与无遥测</strong></article><article><span>仍需真人观察</span><strong>理解首步、选择、结构变化与营地变化；是否愿意再试</strong></article><article><span>不允许推断</span><strong>代码、截图或 event record 不能替代儿童理解</strong></article></div>${itemEvidence("child-use-gate")}${reviewFields("child-use-gate")}</section>`;
    }
    const missing = missingReviewDecisions(draft);
    const carriedCount = draft.decisions.items.filter((item) => item.carriedForward).length + draft.decisions.characters.filter((item) => item.carriedForward).length;
    return `<section class="step03-panel"><header class="step03-heading"><div><span class="step03-kicker">LOCAL PARENT DECISION</span><h2>总结 / 导出</h2><p>导出 JSON 不等于通过；只有完整、身份精确的家长决定才能传给 observer launcher。</p></div></header><div class="step03-summary-grid"><article><span>完成度</span><strong data-summary-progress>${REQUIRED_REVIEW_FIELD_COUNT - missing.length} / ${REQUIRED_REVIEW_FIELD_COUNT}</strong><p data-summary-missing>${missing.length ? `仍缺 ${missing.length} 项：${missing.join("、")}。` : "所有字段已填写；仍需独立 child-first 门禁判断。"}</p></article><article><span>changed-only</span><strong>${carriedCount} 项已折叠沿用</strong><p>${draft.reviewMeta.importedRound ? `来自 Round ${draft.reviewMeta.importedRound}；受影响：${draft.reviewMeta.affectedItemIds.join("、") || "无"}` : "导入上一轮 JSON 后，仅沿用匹配 revision 与依赖的 ACCEPT 项。"}</p><label class="step03-file-button">导入上一轮 JSON<input type="file" accept="application/json,.json" data-import-review></label><small data-import-status></small></article></div><fieldset class="step03-decision step03-decision--gate"><legend>是否允许按本地观察协议进入真实儿童首次使用？</legend><p>YES 只允许家长在场的本地观察；不上传、不录音录像、不建立儿童画像，且不等于儿童接受或大厅推广。</p><div class="step03-decision__options">${(["YES", "NO", "NOT_YET"] as const).map((value) => `<button type="button" data-child-use="${value}" aria-pressed="${draft.authorizeChildFirstUse === value}">${value}</button>`).join("")}</div><label>必填总反馈<textarea rows="4" data-general-notes placeholder="说明为什么允许、拒绝或暂缓；不要填写儿童私人信息。">${escapeHtml(draft.generalNotes)}</textarea></label></fieldset><div class="step03-export"><div><span class="step03-kicker">FIXED FILE NAME</span><strong>${REVIEW_FILE_NAME}</strong><p>包含 stable item / character ID、revision hash、carry-forward 与正式 gate。</p></div><button type="button" data-export-review>导出审核 JSON</button></div></section>`;
  };

  const render = (): void => {
    root.innerHTML = `<main class="step03-review" data-testid="step03-review-app"><header class="step03-header"><div><span class="step03-kicker">HANZI RADICAL BATTLE V2</span><h1>黄金样板 · 家长终审</h1></div><div class="step03-header__status"><span>Round <strong>${draft.round}</strong></span><span>本地草稿</span><button type="button" data-jump-summary>查看必填项</button></div></header><nav class="step03-tabs" aria-label="STEP 03 审核章节">${STEP03_REVIEW_TABS.map((tab) => `<button type="button" data-review-tab="${tab.id}" ${tab.id === activeTab ? "aria-current=page" : ""}><span>${tab.number}</span>${tab.label}</button>`).join("")}</nav><div class="step03-body">${panelFor()}</div><footer class="step03-footer"><span>本地成人审核 · 无联网、无账号、无遥测</span><span>${escapeHtml(STEP03_REVIEW_IDENTITY.technicalState)}</span></footer></main>`;
    root.querySelectorAll<HTMLElement>("[data-review-tab]").forEach((button) => button.addEventListener("click", () => { activeTab = button.dataset.reviewTab as Step03ReviewTabId; render(); }));
    root.querySelector<HTMLElement>("[data-jump-summary]")?.addEventListener("click", () => { activeTab = "summary"; render(); });
    root.querySelectorAll<HTMLElement>("[data-decision]").forEach((button) => button.addEventListener("click", () => { const item = itemDecision(button.dataset.itemId as Step03ReviewItemId); item.decision = button.dataset.decision as ReviewDecision; item.carriedForward = false; saveDraft(); render(); }));
    root.querySelectorAll<HTMLTextAreaElement>("[data-item-notes]").forEach((textarea) => textarea.addEventListener("input", () => { const item = itemDecision(textarea.dataset.itemNotes as Step03ReviewItemId); item.notes = textarea.value; item.carriedForward = false; saveDraft(); }));
    root.querySelectorAll<HTMLElement>("[data-character-decision]").forEach((button) => button.addEventListener("click", () => { const item = characterDecision(button.dataset.characterDecision!); item.decision = button.dataset.decisionValue as ReviewDecision; item.carriedForward = false; saveDraft(); render(); }));
    root.querySelectorAll<HTMLTextAreaElement>("[data-character-notes]").forEach((textarea) => textarea.addEventListener("input", () => { const item = characterDecision(textarea.dataset.characterNotes!); item.notes = textarea.value; item.carriedForward = false; saveDraft(); }));
    root.querySelectorAll<HTMLElement>("[data-ability-decision]").forEach((button) => button.addEventListener("click", () => { draft.abilityDecisions[button.dataset.abilityDecision as typeof ABILITY_DECISION_IDS[number]] = button.dataset.decisionValue as ReviewDecision; itemDecision("ability-trio").carriedForward = false; saveDraft(); render(); }));
    root.querySelectorAll<HTMLElement>("[data-asset-decision]").forEach((button) => button.addEventListener("click", () => { draft.assetDecisions[button.dataset.assetDecision as AssetDecisionId] = button.dataset.decisionValue as ReviewDecision; itemDecision("theme-c").carriedForward = false; saveDraft(); render(); }));
    root.querySelectorAll<HTMLElement>("[data-audio-decision]").forEach((button) => button.addEventListener("click", () => { draft.audioDecision = button.dataset.audioDecision as AudioDecision; itemDecision("audio-and-accessibility").carriedForward = false; saveDraft(); render(); }));
    root.querySelectorAll<HTMLElement>("[data-child-use]").forEach((button) => button.addEventListener("click", () => { draft.authorizeChildFirstUse = button.dataset.childUse as ChildUseDecision; saveDraft(); render(); }));
    root.querySelector<HTMLTextAreaElement>("[data-general-notes]")?.addEventListener("input", (event) => { draft.generalNotes = (event.currentTarget as HTMLTextAreaElement).value; saveDraft(); });
    root.querySelectorAll<HTMLElement>("[data-preview-width]").forEach((button) => button.addEventListener("click", () => { previewWidth = button.dataset.previewWidth as PreviewWidth; previewStatus = `Parent preview width: ${previewWidth}`; render(); }));
    root.querySelector<HTMLElement>("[data-preview-reset]")?.addEventListener("click", () => sendPreviewControl("reset"));
    root.querySelector<HTMLElement>("[data-preview-mute]")?.addEventListener("click", () => sendPreviewControl("mute", true));
    root.querySelector<HTMLElement>("[data-preview-reduced-motion]")?.addEventListener("click", () => sendPreviewControl("reduced-motion", true));
    root.querySelectorAll<HTMLElement>("[data-parent-tts-character]").forEach((button) => button.addEventListener("click", () => { const character = FINAL_GOLDEN_MANIFEST.find((entry) => entry.id === button.dataset.parentTtsCharacter); if (!character || typeof window.speechSynthesis === "undefined") { ttsStatus = "No browser TTS is available; use the visual pronunciation fallback."; render(); return; } const voices = availableVoices(); const utterance = new SpeechSynthesisUtterance(`${character.glyph}，${character.pinyin}，${character.familiarWord}`); const voice = voices[0]; if (voice) utterance.voice = voice; utterance.lang = voice?.lang ?? "zh-CN"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); ttsStatus = voice ? `Parent candidate played with ${voice.name} (${voice.lang}).` : "Parent candidate requested without a reported Chinese voice; visual fallback remains required."; render(); }));
    root.querySelector<HTMLInputElement>("[data-import-review]")?.addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { const carriedReview = carryForwardReview(JSON.parse(await file.text())); if (!carriedReview) throw new Error("文件缺失、未完成、schema 不匹配或 identity 不兼容；不会沿用任何决定。"); draft = carriedReview; activeTab = "summary"; saveDraft(); render(); } catch (error) { const status = root.querySelector<HTMLElement>("[data-import-status]"); if (status) status.textContent = error instanceof Error ? error.message : "导入失败"; } });
    root.querySelector<HTMLElement>("[data-export-review]")?.addEventListener("click", () => downloadJson(draft));
  };
  if (typeof window.speechSynthesis !== "undefined") {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      if (activeTab === "audio") render();
    });
  }
  render();
}
