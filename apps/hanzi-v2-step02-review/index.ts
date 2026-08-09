import "./styles.css";
import { CANDIDATE_CHARACTERS } from "../../games/hanzi-radical-battle/v2/content/candidate-characters";
import { PILOT_SCENARIOS } from "../../games/hanzi-radical-battle/v2/content/pilot-scenarios";
import { STEP02_STORYBOARD } from "../../games/hanzi-radical-battle/v2/content/storyboard";
import { VISUAL_DIRECTIONS } from "../../games/hanzi-radical-battle/v2/content/visual-directions";
import { mountHanziV2CoreSpellPilot, type PilotState } from "../../games/hanzi-radical-battle/v2";
import {
  REVIEW_DRAFT_KEY,
  REVIEW_FILE_NAME,
  carryForwardReview,
  createReviewDraft,
  finalizeReviewDraft,
  isCurrentReviewDraft,
  missingReviewDecisions,
  type Step02ReviewDraft,
} from "./review-schema";

type ReviewTab = "scope" | "pilot" | "characters" | "themes" | "storyboard" | "summary";
type CandidateFilter = "all" | "pending" | "changed";

const TABS: Array<{ id: ReviewTab; label: string; number: string }> = [
  { id: "scope", label: "范围与北极星", number: "01" },
  { id: "pilot", label: "核心法术 Pilot", number: "02" },
  { id: "characters", label: "15 字候选", number: "03" },
  { id: "themes", label: "视觉方向", number: "04" },
  { id: "storyboard", label: "故事板", number: "05" },
  { id: "summary", label: "汇总与导出", number: "06" },
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readDraft(): Step02ReviewDraft {
  const raw = window.localStorage.getItem(REVIEW_DRAFT_KEY);
  if (!raw) return createReviewDraft();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCurrentReviewDraft(parsed)) return parsed;
  } catch {
    // An invalid adult draft is discarded without touching the child pilot save.
  }
  return createReviewDraft();
}

function optionMarkup(value: string, label: string, current: string): string {
  return `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
}

function decisionPill(value: string): string {
  if (!value) return `<span class="review-pill review-pill--pending">待决定</span>`;
  return `<span class="review-pill review-pill--${value.toLowerCase().replaceAll("_", "-")}">${escapeHtml(value)}</span>`;
}

function downloadJson(draft: Step02ReviewDraft): void {
  const finalDraft = finalizeReviewDraft(draft);
  const blob = new Blob([`${JSON.stringify(finalDraft, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = REVIEW_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function scopeMarkup(): string {
  return `<div class="review-reading review-scope">
    <span class="review-kicker">STEP 02 · 成人审核工作台</span>
    <h2>只验证一件事：完整汉字会不会像真正改变世界的魔法</h2>
    <p class="review-lead">这不是 V2 完整游戏，也不是儿童试玩结论。这里把 60–90 秒核心法术、15 字候选、三种视觉方向和七格故事板放在同一轮家长审核中。</p>
    <blockquote>在一个 60–90 秒的小闭环中，黄小越能否自然理解“把两个字灵放回真实结构位置”，并把完整汉字的形成感受为会永久改变世界的魔法，而不是一道题答对后的奖励？</blockquote>
    <div class="scope-grid">
      <article><span>本轮已做</span><strong>一个“明”字 Pilot</strong><p>营地 → 遭遇 → 五牌 → 结构归位 → 成字施法 → 修灯 → 字灵书。</p></article>
      <article><span>成人要决定</span><strong>玩法、候选、方向、故事板</strong><p>每一项都有独立决定，自动检查不能代替家长接受。</p></article>
      <article><span>明确没做</span><strong>三选一、第二场、Boss</strong><p>没有完整 Ink Forest，没有批量最终美术，没有儿童 playtest。</p></article>
      <article><span>技术状态</span><strong>READY FOR PARENT REVIEW</strong><p>只表示本机技术门槛到位，不表示对儿童已验证。</p></article>
    </div>
    <div class="review-callout"><strong>审核顺序建议</strong><span>先完整玩一次 Pilot，再看候选字与视觉方向，最后决定是否允许进入 STEP 03。</span></div>
  </div>`;
}

function themeMiniMarkup(themeId: string, name: string, sky: string, ground: string, primary: string, accent: string): string {
  return `<div class="theme-mini" style="--theme-sky:${sky};--theme-ground:${ground};--theme-primary:${primary};--theme-accent:${accent}" aria-label="${themeId} ${name} 同场景缩略预览">
    <div class="theme-mini__moon"></div><div class="theme-mini__trees"></div><div class="theme-mini__path"></div>
    <div class="theme-mini__tent"></div><div class="theme-mini__lamp"></div><div class="theme-mini__mage"></div><div class="theme-mini__ink"></div>
    <span>${themeId}</span>
  </div>`;
}

export function mountHanziV2Step02Review(root: HTMLElement): void {
  let draft = readDraft();
  let activeTab: ReviewTab = "pilot";
  let candidateFilter: CandidateFilter = "all";

  root.innerHTML = `<main class="step02-review" data-testid="step02-review-app">
    <header class="review-header">
      <div><span class="review-kicker">Hanzi Radical Battle V2</span><h1>核心法术 · 家长审核</h1></div>
      <div class="review-header__status"><span>Round <strong data-round>${draft.round}</strong></span><span>本机草稿</span><button type="button" data-jump-summary>查看缺项</button></div>
    </header>
    <nav class="review-tabs" aria-label="STEP 02 审核章节">
      ${TABS.map((tab) => `<button type="button" data-review-tab="${tab.id}" ${tab.id === activeTab ? "aria-current=page" : ""}><span>${tab.number}</span>${tab.label}</button>`).join("")}
    </nav>
    <section class="review-body">
      <div class="review-panel" data-review-panel="scope" hidden>${scopeMarkup()}</div>
      <div class="review-panel" data-review-panel="pilot">
        <div class="panel-heading"><div><span class="review-kicker">PLAY FIRST</span><h2>同一块世界里完成核心法术</h2><p>从本页开始，两次点按内进入五牌结构操作。点牌再点槽位，或直接拖放。</p></div><div class="identity-chip">锚点：明 = 日 + 月</div></div>
        <div class="pilot-review-controls" aria-label="成人 Pilot 控制">
          <label>结构预览<select data-scenario-select>${PILOT_SCENARIOS.map((scenario) => `<option value="${scenario.id}">${scenario.id === "pilot-ming-left-right" ? "儿童主 Pilot · 明（左右）" : scenario.id.includes("hua") ? "成人预览 · 花（上下）" : "成人预览 · 风（半包围）"}</option>`).join("")}</select></label>
          <div class="segmented" aria-label="预览宽度"><button type="button" data-viewport="desktop" aria-pressed="true">桌面</button><button type="button" data-viewport="tablet" aria-pressed="false">平板</button><button type="button" data-viewport="mobile" aria-pressed="false">手机</button></div>
          <button type="button" class="review-secondary" data-pilot-reset>重置本次闭环</button>
        </div>
        <div class="review-pilot-frame review-pilot-frame--desktop" data-pilot-frame><div data-pilot-mount></div></div>
        <div class="pilot-review-evidence">
          <article><span>当前阶段</span><strong data-live-phase>camp_intro</strong></article>
          <article><span>事件顺序</span><ol data-live-events><li>pilot_opened</li></ol></article>
          <article><span>五牌生成审计</span><p><strong>目标：</strong>日 + 月 → 明<br><strong>干扰：</strong>氵、亻、讠；母库两/三牌枚举无替代成字。<br><strong>交互：</strong>可撤回；2 次后单槽提示；4 秒墨点引导。</p></article>
          <article><span>审核提示</span><p>重点观察最后一张归位后，部件 → 完整字 → 读音词义 → 法术 → 营地永久变化的因果是否连续。</p></article>
        </div>
        <fieldset class="decision-box"><legend>核心 Pilot 的正式决定</legend><div class="decision-options" data-core-decisions></div><label>具体反馈<textarea rows="3" data-core-notes placeholder="哪里自然？哪里仍像答题？需要怎样修改？">${escapeHtml(draft.decisions.corePilot.notes)}</textarea></label></fieldset>
      </div>
      <div class="review-panel" data-review-panel="characters" hidden>
        <div class="panel-heading"><div><span class="review-kicker">PROVISIONAL CONTENT</span><h2>15 字候选清单</h2><p>9 high + 3 near + 3 new 是待审核的 80/20 假设；拼音、适龄性、围合细分都不是自动通过项。</p></div><div class="candidate-counts" data-candidate-counts></div></div>
        <div class="candidate-toolbar"><div class="segmented"><button type="button" data-candidate-filter="all" aria-pressed="true">全部</button><button type="button" data-candidate-filter="pending" aria-pressed="false">待决定</button><button type="button" data-candidate-filter="changed" aria-pressed="false">本轮需看</button></div><span>图片来自现有本地视觉提示；不是字源图。</span></div>
        <div class="candidate-grid" data-candidate-grid></div>
      </div>
      <div class="review-panel" data-review-panel="themes" hidden>
        <div class="panel-heading"><div><span class="review-kicker">DIRECTION, NOT FINAL ART</span><h2>同一 Pilot 的三种视觉方向</h2><p>这里比较相同世界、相同角色轮廓和相同信息层级，只改变方向性配色与气质。</p></div></div>
        <div class="theme-review-grid">
          ${VISUAL_DIRECTIONS.map((theme) => `<article class="theme-review-card" data-theme-card="${theme.id}">${themeMiniMarkup(theme.id, theme.name, theme.tokens.sky, theme.tokens.ground, theme.tokens.primary, theme.tokens.accent)}<span class="review-kicker">方向 ${theme.id}</span><h3>${theme.name}</h3><p>${theme.summary}</p><small>${theme.reviewQuestion}</small><button type="button" data-theme-select="${theme.id}">选择 ${theme.id}</button></article>`).join("")}
        </div>
        <fieldset class="decision-box"><legend>视觉方向正式决定</legend><div class="decision-options" data-visual-decisions></div><label>混合或重做说明<textarea rows="3" data-visual-notes placeholder="例如：A 的营地光 + B 的森林层次。">${escapeHtml(draft.decisions.visualDirection.notes)}</textarea></label></fieldset>
      </div>
      <div class="review-panel" data-review-panel="storyboard" hidden>
        <div class="panel-heading"><div><span class="review-kicker">STEP 03 · DISPLAY ONLY</span><h2>七格黄金样板故事板</h2><p>营地、第一战、第二战、三选一、小首领、回营修复和魔法书只供审核；STEP 02 只实际实现其中标记为 Pilot 的局部。每格是反馈锚点，不是实现授权。</p></div></div>
        <div class="storyboard-list" data-storyboard-list></div>
      </div>
      <div class="review-panel" data-review-panel="summary" hidden>
        <div class="panel-heading"><div><span class="review-kicker">PARENT GATE</span><h2>汇总、Round 2 与固定导出</h2><p>下载不等于接受。FINISH 会保留缺项并明确报告，不会把不完整决定升级为通过。</p></div></div>
        <div class="summary-grid">
          <article class="summary-card"><span>必需决定</span><strong data-summary-progress></strong><div data-summary-missing></div></article>
          <article class="summary-card"><span>Round 2 changed-only</span><p>revisionHash 覆盖完整审核内容；只有内容与依赖均未变且已 ACCEPT 的候选/故事板会沿用。其余默认进入本轮需看。</p><label class="file-button">导入上一轮 JSON<input type="file" accept="application/json,.json" data-import-review></label><small data-import-status></small></article>
        </div>
        <fieldset class="decision-box decision-box--gate"><legend>是否明确授权进入 STEP 03？</legend><div class="decision-options" data-authorization-decisions></div><label>本轮总体备注<textarea rows="4" data-general-notes placeholder="可记录必须先修的内容；不填写孩子姓名或私人信息。">${escapeHtml(draft.decisions.generalNotes)}</textarea></label></fieldset>
        <div class="export-card"><div><span class="review-kicker">FIXED FILE NAME</span><strong>${REVIEW_FILE_NAME}</strong><p>JSON 会包含 15 个候选与 7 个故事板的稳定 itemId / revisionHash、当前缺项和是否完整。</p></div><button type="button" class="review-primary" data-export-review>导出审核 JSON</button></div>
      </div>
    </section>
    <footer class="review-footer"><span>本地审核应用 · 无联网、无账号、无遥测</span><span>技术状态：CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW</span></footer>
  </main>`;

  const pilotMount = root.querySelector<HTMLElement>("[data-pilot-mount]");
  if (!pilotMount) throw new Error("Missing STEP 02 pilot mount in review app");
  const pilot = mountHanziV2CoreSpellPilot(pilotMount, {
    onStateChange: (state) => updatePilotEvidence(state),
  });

  function saveDraft(): void {
    window.localStorage.setItem(REVIEW_DRAFT_KEY, JSON.stringify(draft));
    updateSummary();
  }

  function showTab(tabId: ReviewTab): void {
    activeTab = tabId;
    root.querySelectorAll<HTMLElement>("[data-review-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.reviewPanel !== activeTab;
    });
    root.querySelectorAll<HTMLElement>("[data-review-tab]").forEach((button) => {
      if (button.dataset.reviewTab === activeTab) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (activeTab === "summary") updateSummary();
  }

  function updatePilotEvidence(state: PilotState): void {
    const phase = root.querySelector<HTMLElement>("[data-live-phase]");
    const events = root.querySelector<HTMLElement>("[data-live-events]");
    if (phase) phase.textContent = state.phase;
    if (events) events.innerHTML = state.events.map((event) => `<li>${escapeHtml(event.id)}</li>`).join("");
  }

  function renderCoreDecision(): void {
    const host = root.querySelector<HTMLElement>("[data-core-decisions]");
    if (!host) return;
    host.innerHTML = (["ACCEPT", "REVISE", "REJECT"] as const)
      .map((decision) => `<button type="button" data-core-decision="${decision}" aria-pressed="${draft.decisions.corePilot.decision === decision}">${decision}</button>`)
      .join("");
    host.querySelectorAll<HTMLElement>("[data-core-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        draft.decisions.corePilot.decision = button.dataset.coreDecision as typeof draft.decisions.corePilot.decision;
        saveDraft();
        renderCoreDecision();
      });
    });
  }

  function renderCandidateGrid(): void {
    const host = root.querySelector<HTMLElement>("[data-candidate-grid]");
    if (!host) return;
    const visible = CANDIDATE_CHARACTERS.filter((candidate) => {
      const decision = draft.decisions.characters.find((item) => item.itemId === candidate.id);
      if (candidateFilter === "pending") return !decision?.decision;
      if (candidateFilter === "changed") return !decision?.carriedForward || decision.decision !== "ACCEPT";
      return true;
    });
    host.innerHTML = visible
      .map((candidate) => {
        const decision = draft.decisions.characters.find((item) => item.itemId === candidate.id)!;
        return `<article class="candidate-card" data-candidate-id="${candidate.id}" data-testid="candidate-card-${candidate.id}">
          <div class="candidate-card__visual"><img src=".${candidate.sourceEvidence.visualAssetPath}" alt="${escapeHtml(candidate.sourceEvidence.visualHintGloss)}的现有联想插图"><span lang="zh-Hans">${candidate.glyph}</span></div>
          <div class="candidate-card__heading"><div><strong>${candidate.glyph} <small>${candidate.pinyin}</small></strong><span>${candidate.familiarWord} · ${candidate.shortMeaning}</span></div>${decisionPill(decision.decision)}</div>
          <div class="candidate-card__tags"><span>${candidate.structure}</span><span>${candidate.components.map((part) => part.glyph).join(" + ")}</span><span>${candidate.familiarityBand}（暂定）</span><span>${candidate.tier}</span></div>
          <dl><div><dt>母库 key</dt><dd>${candidate.sourceCombinationKey}</dd></div><div><dt>母库有序部件</dt><dd>${candidate.sourceOrderedParts.join("、")}</dd></div><div><dt>拟用槽位</dt><dd>${candidate.components.map((part) => `${part.glyph} → ${part.slotId}`).join("；")}</dd></div><div><dt>儿童适配假设</dt><dd>${candidate.childFitRationale}</dd></div><div><dt>魔法方向</dt><dd>${candidate.magicConcept}</dd></div><div><dt>世界效果</dt><dd>${candidate.worldEffect}</dd></div><div><dt>拟用范围</dt><dd>${candidate.recommendedUse} · ${candidate.recommendedForFinalManifest ? "recommended" : "not recommended"}</dd></div><div><dt>证据边界</dt><dd>${candidate.sourceEvidence.evidenceLimit}</dd></div></dl>
          ${candidate.ambiguityRisks.length ? `<details><summary>查看歧义风险</summary><ul>${candidate.ambiguityRisks.map((risk) => `<li>${risk}</li>`).join("")}${candidate.pronunciationRisks.map((risk) => `<li>${risk}</li>`).join("")}</ul></details>` : ""}
          <label>决定<select data-character-decision="${candidate.id}">${optionMarkup("", "请选择", decision.decision)}${optionMarkup("ACCEPT", "ACCEPT", decision.decision)}${optionMarkup("ACCEPT_WITH_EDIT", "ACCEPT WITH EDIT", decision.decision)}${optionMarkup("REJECT", "REJECT", decision.decision)}</select></label>
          <label>备注<textarea rows="2" data-character-notes="${candidate.id}" placeholder="拼音、词义、结构、熟悉度或视觉问题">${escapeHtml(decision.notes)}</textarea></label>
          <small class="revision">${candidate.revisionHash}${decision.carriedForward ? " · 上轮同 revision 已接受并沿用" : ""}</small>
        </article>`;
      })
      .join("");
    host.querySelectorAll<HTMLSelectElement>("[data-character-decision]").forEach((select) => {
      select.addEventListener("change", () => {
        const item = draft.decisions.characters.find((entry) => entry.itemId === select.dataset.characterDecision);
        if (!item) return;
        item.decision = select.value as typeof item.decision;
        item.carriedForward = false;
        saveDraft();
        renderCandidateGrid();
        updateCandidateCounts();
      });
    });
    host.querySelectorAll<HTMLTextAreaElement>("[data-character-notes]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const item = draft.decisions.characters.find((entry) => entry.itemId === textarea.dataset.characterNotes);
        if (!item) return;
        item.notes = textarea.value;
        item.carriedForward = false;
        saveDraft();
      });
    });
  }

  function updateCandidateCounts(): void {
    const counts = root.querySelector<HTMLElement>("[data-candidate-counts]");
    if (!counts) return;
    const decided = draft.decisions.characters.filter((item) => item.decision).length;
    const recommended = CANDIDATE_CHARACTERS.filter((candidate) => candidate.recommendedForFinalManifest).length;
    const carried = draft.decisions.characters.filter((item) => item.carriedForward).length;
    counts.innerHTML = `<span><strong>${decided}</strong>/15 已决定</span><span><strong>${recommended}</strong>/≤12 暂定推荐</span><span><strong>7 / 4 / 4</strong> 左右 / 上下 / 围合</span>${draft.reviewMeta.importedRound ? `<span><strong>${carried}</strong> 项未变并沿用</span>` : ""}`;
  }

  function renderVisualDecision(): void {
    const host = root.querySelector<HTMLElement>("[data-visual-decisions]");
    if (!host) return;
    host.innerHTML = (["A", "B", "C", "MIX", "REDO"] as const)
      .map((selection) => `<button type="button" data-visual-decision="${selection}" aria-pressed="${draft.decisions.visualDirection.selection === selection}">${selection}</button>`)
      .join("");
    root.querySelectorAll<HTMLElement>("[data-theme-card]").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.themeCard === draft.decisions.visualDirection.selection);
    });
    host.querySelectorAll<HTMLElement>("[data-visual-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        draft.decisions.visualDirection.selection = button.dataset.visualDecision as typeof draft.decisions.visualDirection.selection;
        draft.pilotIdentity.selectedTheme = draft.decisions.visualDirection.selection || "A";
        saveDraft();
        renderVisualDecision();
      });
    });
  }

  function renderStoryboard(): void {
    const host = root.querySelector<HTMLElement>("[data-storyboard-list]");
    if (!host) return;
    const carriedBeats = STEP02_STORYBOARD.filter(
      (beat) => draft.decisions.storyboard.find((item) => item.itemId === beat.id)?.carriedForward,
    );
    const visibleBeats = draft.reviewMeta.importedRound
      ? STEP02_STORYBOARD.filter(
          (beat) => !draft.decisions.storyboard.find((item) => item.itemId === beat.id)?.carriedForward,
        )
      : STEP02_STORYBOARD;
    const carriedSummary = carriedBeats.length
      ? `<aside class="review-callout"><strong>已沿用 ${carriedBeats.length} 格 ACCEPT</strong><span>${carriedBeats.map((beat) => beat.title).join("、")}；内容和依赖均未变化，可在导出 JSON 中审计。</span></aside>`
      : "";
    host.innerHTML = carriedSummary + visibleBeats.map((beat) => {
      const decision = draft.decisions.storyboard.find((item) => item.itemId === beat.id)!;
      return `<article class="storyboard-beat"><div class="storyboard-beat__number">${String(beat.order).padStart(2, "0")}</div><div class="storyboard-beat__copy"><div><h3>${beat.title}</h3><span class="story-status">${beat.implementationStatus === "pilot-implemented" ? "Pilot 局部已实现" : "仅展示 · 未实现"}</span>${decisionPill(decision.decision)}</div><p>${beat.childFacingMoment}</p><small><strong>世界变化：</strong>${beat.worldChange}</small><blockquote>${beat.reviewQuestion}</blockquote></div><div class="storyboard-beat__decision"><label>决定<select data-story-decision="${beat.id}">${optionMarkup("", "请选择", decision.decision)}${optionMarkup("ACCEPT", "ACCEPT", decision.decision)}${optionMarkup("REVISE", "REVISE", decision.decision)}${optionMarkup("REJECT", "REJECT", decision.decision)}</select></label><label>备注<textarea rows="3" data-story-notes="${beat.id}">${escapeHtml(decision.notes)}</textarea></label><small>${beat.revisionHash}${decision.carriedForward ? " · carry-forward" : ""}</small></div></article>`;
    }).join("");
    host.querySelectorAll<HTMLSelectElement>("[data-story-decision]").forEach((select) => {
      select.addEventListener("change", () => {
        const item = draft.decisions.storyboard.find((entry) => entry.itemId === select.dataset.storyDecision);
        if (!item) return;
        item.decision = select.value as typeof item.decision;
        item.carriedForward = false;
        saveDraft();
        renderStoryboard();
      });
    });
    host.querySelectorAll<HTMLTextAreaElement>("[data-story-notes]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const item = draft.decisions.storyboard.find((entry) => entry.itemId === textarea.dataset.storyNotes);
        if (!item) return;
        item.notes = textarea.value;
        item.carriedForward = false;
        saveDraft();
      });
    });
  }

  function renderAuthorization(): void {
    const host = root.querySelector<HTMLElement>("[data-authorization-decisions]");
    if (!host) return;
    host.innerHTML = (["YES", "NO", "NOT_YET"] as const)
      .map((decision) => `<button type="button" data-authorization="${decision}" aria-pressed="${draft.decisions.authorizeStep03 === decision}">${decision}</button>`)
      .join("");
    host.querySelectorAll<HTMLElement>("[data-authorization]").forEach((button) => {
      button.addEventListener("click", () => {
        draft.decisions.authorizeStep03 = button.dataset.authorization as typeof draft.decisions.authorizeStep03;
        saveDraft();
        renderAuthorization();
      });
    });
  }

  function updateSummary(): void {
    const missing = missingReviewDecisions(draft);
    const total = 1 + 1 + 15 + 7 + 1;
    const progress = root.querySelector<HTMLElement>("[data-summary-progress]");
    const missingHost = root.querySelector<HTMLElement>("[data-summary-missing]");
    if (progress) progress.textContent = `${total - missing.length} / ${total}`;
    if (missingHost) {
      missingHost.innerHTML = missing.length
        ? `<p>仍缺 ${missing.length} 项：</p><ul>${missing.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${missing.length > 10 ? `<li>以及另外 ${missing.length - 10} 项</li>` : ""}</ul>`
        : `<p class="summary-complete">必需决定齐全；仍须运行 FINISH 做独立结构验证。</p>`;
    }
    const round = root.querySelector<HTMLElement>("[data-round]");
    if (round) round.textContent = String(draft.round);
  }

  root.querySelectorAll<HTMLElement>("[data-review-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.reviewTab as ReviewTab));
  });
  root.querySelector<HTMLElement>("[data-jump-summary]")?.addEventListener("click", () => showTab("summary"));
  root.querySelector<HTMLSelectElement>("[data-scenario-select]")?.addEventListener("change", (event) => {
    pilot.resetScenario((event.currentTarget as HTMLSelectElement).value);
  });
  root.querySelector<HTMLElement>("[data-pilot-reset]")?.addEventListener("click", () => {
    const scenario = root.querySelector<HTMLSelectElement>("[data-scenario-select]")?.value ?? "pilot-ming-left-right";
    pilot.resetScenario(scenario);
  });
  root.querySelectorAll<HTMLElement>("[data-viewport]").forEach((button) => {
    button.addEventListener("click", () => {
      const viewport = button.dataset.viewport ?? "desktop";
      const frame = root.querySelector<HTMLElement>("[data-pilot-frame]");
      if (frame) frame.className = `review-pilot-frame review-pilot-frame--${viewport}`;
      root.querySelectorAll<HTMLElement>("[data-viewport]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  });
  root.querySelector<HTMLTextAreaElement>("[data-core-notes]")?.addEventListener("input", (event) => {
    draft.decisions.corePilot.notes = (event.currentTarget as HTMLTextAreaElement).value;
    saveDraft();
  });
  root.querySelectorAll<HTMLElement>("[data-candidate-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      candidateFilter = button.dataset.candidateFilter as CandidateFilter;
      root.querySelectorAll<HTMLElement>("[data-candidate-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderCandidateGrid();
    });
  });
  root.querySelectorAll<HTMLElement>("[data-theme-select]").forEach((button) => {
    button.addEventListener("click", () => {
      draft.decisions.visualDirection.selection = button.dataset.themeSelect as typeof draft.decisions.visualDirection.selection;
      draft.pilotIdentity.selectedTheme = draft.decisions.visualDirection.selection;
      pilot.setTheme(button.dataset.themeSelect as "A" | "B" | "C");
      saveDraft();
      renderVisualDecision();
    });
  });
  root.querySelector<HTMLTextAreaElement>("[data-visual-notes]")?.addEventListener("input", (event) => {
    draft.decisions.visualDirection.notes = (event.currentTarget as HTMLTextAreaElement).value;
    saveDraft();
  });
  root.querySelector<HTMLTextAreaElement>("[data-general-notes]")?.addEventListener("input", (event) => {
    draft.decisions.generalNotes = (event.currentTarget as HTMLTextAreaElement).value;
    saveDraft();
  });
  root.querySelector<HTMLInputElement>("[data-import-review]")?.addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    const file = input.files?.[0];
    if (!file) return;
    try {
      const carried = carryForwardReview(JSON.parse(await file.text()));
      if (!carried) throw new Error("文件不是兼容的 STEP 02 审核 JSON");
      draft = carried;
      window.localStorage.setItem(REVIEW_DRAFT_KEY, JSON.stringify(draft));
      candidateFilter = "changed";
      if (status) status.textContent = `已导入 Round ${draft.reviewMeta.importedRound}；当前为 Round ${draft.round}。依赖受影响 ${draft.reviewMeta.affectedItemIds.length} 项。`;
      renderCoreDecision();
      renderCandidateGrid();
      updateCandidateCounts();
      renderVisualDecision();
      renderStoryboard();
      renderAuthorization();
      updateSummary();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "导入失败";
    }
  });
  root.querySelector<HTMLElement>("[data-export-review]")?.addEventListener("click", () => downloadJson(draft));

  renderCoreDecision();
  renderCandidateGrid();
  updateCandidateCounts();
  renderVisualDecision();
  renderStoryboard();
  renderAuthorization();
  updateSummary();
  showTab(activeTab);
}
