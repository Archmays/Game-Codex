import "./styles.css";
import { FINAL_GOLDEN_MANIFEST } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import {
  FIRST_USE_STOP_CODES,
  type FirstUseStopCode,
  type FirstUseTechnicalEvent,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types";
import {
  createFirstUseEventReceiver,
  type FirstUseEventReceiver,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/event-bridge";
import {
  markFirstUseSessionFinished,
  markFirstUseSessionStopped,
  type FirstUseAudioChoice,
  type FirstUseSessionGrant,
  type FirstUseSessionMode,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/session";
import { validateObserverNotes } from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/privacy";
import { mountAudioPreflight, type AudioPreflightHandle, type AudioPreflightState } from "./audio-preflight";
import { downloadFirstUseObservation } from "./export";
import {
  CHECKPOINT_NOTICE_VALUES,
  CHECKPOINT_NOTICE_VALUE_LABELS,
  CHECKPOINT_REACH_VALUE_LABELS,
  ENGAGEMENT_OBSERVATION_IDS,
  FIRST_USE_CHECKPOINTS,
  FIRST_USE_CHECKPOINT_LABELS,
  INTERVENTION_CODES,
  LEARNING_VISIBILITY_OBSERVATION_IDS,
  OBSERVATION_VALUES,
  OBSERVATION_VALUE_LABELS,
  PARENT_OBSERVED_REPLAY_LABELS,
  PARENT_OBSERVED_REPLAY_VALUES,
  POINTABLE_REGIONS,
  STEP04_ACCEPTED_SOURCE_SNAPSHOTS,
  USABILITY_OBSERVATION_IDS,
  WELLBEING_VALUES,
  createFirstUseBuildIdentity,
  createFirstUseObservationPackage,
  type CompletionStatus,
  type FirstUseBuildIdentity,
  type FirstUseCheckpointId,
  type FirstUseObservationPackage,
  type InterventionCode,
  type ObservationValue,
  type PointableRegion,
  type WellbeingValue,
} from "./observation-model";
import { normalizeFirstUseObservation } from "./observation-schema";
import { reconcileFirstUseEvidence } from "./evidence-reconciliation";
import {
  AGAIN_AGAIN_OPTIONS,
  FAVORITE_MOMENT_OPTIONS,
  isAgainAgainValue,
  isFavoriteMomentValue,
  optionalCardsMarkup,
} from "./optional-cards";
import {
  createParentSessionController,
  parseParentLaunchContext,
  type ParentSessionController,
} from "./session-controller";

export const FIRST_USE_OBSERVATION_STORAGE_PREFIX = "family-games/hanzi-v2-step04/observation:";

export interface Step04ObserverOptions {
  readonly buildIdentity?: FirstUseBuildIdentity;
  readonly storage?: Storage;
  readonly openChild?: (route: string, target: string) => Window | null;
}

export interface Step04ObserverHandle {
  getObservation(): FirstUseObservationPackage | null;
  destroy(): void;
}

const SESSION_MODE_LABELS: Readonly<Record<FirstUseSessionMode, string>> = {
  LIVE_DASHBOARD: "实时观察面板",
  COMPACT_AFTER_SESSION: "session 后补记",
};

const STOP_CODE_LABELS: Readonly<Record<FirstUseStopCode, string>> = {
  CHILD_REQUEST: "孩子要求停止",
  DISTRESS: "持续不适或挫败",
  SENSORY_DISCOMFORT: "感官不适",
  TECHNICAL: "技术问题",
  PRIVACY: "隐私边界",
  IDENTITY: "身份或构建不匹配",
  ADULT_ANSWER_REQUIRED: "需要成人给答案",
  OTHER: "其他",
};

const INTERVENTION_LABELS: Readonly<Record<InterventionCode, string>> = {
  NONE: "无介入",
  REPEAT_VISIBLE_COPY: "重复屏幕已有文案",
  POINT_TO_REGION_ONLY: "只指区域",
  TECHNICAL_ASSIST: "技术帮助",
  ADULT_ANSWER_REQUIRED: "成人给出答案",
  STOPPED: "已停止",
};

const REGION_LABELS: Readonly<Record<PointableRegion, string>> = {
  WORLD: "世界区域",
  BOARD: "结构板区域",
  HAND: "手牌区域",
};

const WELLBEING_VALUE_LABELS: Readonly<Record<(typeof WELLBEING_VALUES)[number], string>> = {
  OBSERVED: "观察到",
  NOT_OBSERVED: "未观察",
  UNKNOWN: "不确定 / 未询问",
};

const WELLBEING_FIELD_LABELS = {
  comfortable: "舒适",
  briefConfusionRecovered: "短暂困惑后恢复",
  sustainedFrustration: "持续挫败",
  sensoryDiscomfort: "感官不适",
  childInitiatedStop: "主动停止",
  feltForced: "感到被强迫",
} as const;

const USABILITY_LABELS: Readonly<Record<(typeof USABILITY_OBSERVATION_IDS)[number], string>> = {
  firstAction: "首次行动",
  boardCardSlotDistinction: "区分结构板、卡牌和槽位",
  clickOrDrag: "点击或拖动",
  abilityChoice: "能力选择",
  bossIntent: "Boss intent",
  spellbookNavigation: "魔法书翻阅",
};

const ENGAGEMENT_LABELS: Readonly<Record<(typeof ENGAGEMENT_OBSERVATION_IDS)[number], string>> = {
  voluntarilyContinued: "主动继续",
  noticedWorldChange: "注意世界变化",
  replayedAudio: "主动点击重听",
  spontaneousReplay: "自发选择重玩",
};

const LEARNING_LABELS: Readonly<Record<(typeof LEARNING_VISIBILITY_OBSERVATION_IDS)[number], string>> = {
  noticedMingComposition: "注意到第一次合字关系",
  noticedStructureChange: "注意到第二种结构变化",
  noticedMeaningChangedWorld: "看到汉字意义改变世界",
  connectedAbilityToBossSupport: "把能力与 Boss 支持联系起来",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function observationStorageKey(sessionId: string): string {
  return `${FIRST_USE_OBSERVATION_STORAGE_PREFIX}${sessionId}`;
}

function loadObservation(storage: Storage, sessionId: string): FirstUseObservationPackage | null {
  const raw = storage.getItem(observationStorageKey(sessionId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return normalizeFirstUseObservation(value).value;
  } catch {
    return null;
  }
}

function selectedOptions<T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>, selected: T): string {
  return values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(labels[value])}</option>`).join("");
}

function statusClass(status: CompletionStatus): string {
  return ["COMPLETED", "STOPPED", "TECHNICAL_END"].includes(status) ? "is-ended" : status === "RUNNING" ? "is-live" : "";
}

function completionStatus(value: FirstUseObservationPackage): CompletionStatus {
  if (value.completion.sessionStopped) return "STOPPED";
  if (value.completion.runCompleted) return "COMPLETED";
  return value.completion.childRouteLoaded ? "RUNNING" : "NOT_STARTED";
}

function categoryMarkup(
  title: string,
  name: string,
  record: Readonly<Record<string, ObservationValue>>,
  labels: Readonly<Record<string, string>>,
): string {
  return `<section class="step04-evidence-category"><h3>${escapeHtml(title)}</h3><div class="step04-select-grid">${Object.entries(record).map(([id, value]) => `
    <label><span>${escapeHtml(labels[id] ?? id)}</span><select data-observation-category="${name}" data-observation-id="${id}">
      ${selectedOptions(OBSERVATION_VALUES, OBSERVATION_VALUE_LABELS, value)}
    </select></label>`).join("")}</div></section>`;
}

function createAudioStateForReload(grant: FirstUseSessionGrant): AudioPreflightState {
  const hasSpeech = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  return {
    decision: grant.audioChoice,
    checkedCharacterIds: ["ming", "hua", "lin", "xing"],
    adapter: hasSpeech && grant.audioChoice === "SOUND_OK" ? "speech-synthesis" : "silent-visual",
    lang: hasSpeech && grant.audioChoice === "SOUND_OK" ? "zh-CN" : null,
    voiceCategory: hasSpeech && grant.audioChoice === "SOUND_OK" ? "DEFAULT_DEVICE_VOICE" : "NONE",
  };
}

export function mountHanziV2Step04Observer(root: HTMLElement, options: Step04ObserverOptions = {}): Step04ObserverHandle {
  const parsed = parseParentLaunchContext(window.location.search);
  if (!parsed.ok) {
    root.innerHTML = `<main class="step04-observer-shell step04-blocked"><span>STEP 04 · LOCAL PARENT TOOL</span><h1>观察工具未启动</h1><p>${escapeHtml(parsed.reason)}</p><p>请使用项目的 START 脚本生成一次性本地 session；此页面不会直接打开儿童路线。</p></main>`;
    return { getObservation: () => null, destroy: () => root.replaceChildren() };
  }

  const storage = options.storage ?? window.localStorage;
  let controller: ParentSessionController;
  try {
    controller = createParentSessionController({
      search: window.location.search,
      storage,
      openChild: options.openChild,
    });
  } catch (error) {
    root.innerHTML = `<main class="step04-observer-shell step04-blocked"><span>STEP 04 · SESSION GATE</span><h1>本地 session 已拒绝</h1><p>${escapeHtml(error instanceof Error ? error.message : "Unknown local session error")}</p></main>`;
    return { getObservation: () => null, destroy: () => root.replaceChildren() };
  }

  const buildIdentity = options.buildIdentity ?? createFirstUseBuildIdentity(
    controller.context.commitSha,
    controller.context.generatedAtUtc,
    controller.context.buildIdentitySha256,
  );
  let grant = controller.getGrant();
  let observation = loadObservation(storage, grant.sessionId);
  let audioHandle: AudioPreflightHandle | null = null;
  let receiver: FirstUseEventReceiver | null = null;
  let audioState: AudioPreflightState | null = grant.status === "AUTHORIZED" ? createAudioStateForReload(grant) : null;
  let ready = grant.readyConfirmed;
  let sessionMode: FirstUseSessionMode | null = grant.sessionMode;
  let childRoute: string | null = null;
  let currentPhase = "等待儿童路线";
  let technicalSignalReceived = false;
  let builtInHintReceived = false;
  let selectedStopCode: FirstUseStopCode = "CHILD_REQUEST";
  let selectedIntervention: InterventionCode = "NONE";
  let selectedInterventionCheckpoint: FirstUseCheckpointId = "firstScreen";
  let selectedRegion: PointableRegion = "WORLD";
  let destroyed = false;
  const observerStartedAt = performance.now();

  const persist = (): void => {
    if (observation) storage.setItem(observationStorageKey(grant.sessionId), JSON.stringify(observation));
  };

  const relativeNow = (): number => Math.min(3_600_000, Math.max(
    observation?.technicalEvents.at(-1)?.relativeMs ?? 0,
    Math.round(performance.now() - observerStartedAt),
  ));

  const applyTechnicalEvent = (event: FirstUseTechnicalEvent): void => {
    if (!observation || observation.technicalEvents.some((existing) => existing.sequence === event.sequence)) return;
    observation.technicalEvents = [...observation.technicalEvents, event].sort((a, b) => a.sequence - b.sequence);
    technicalSignalReceived = true;
    if (event.eventType === "phase_entered" && typeof event.safeMetadata.phase === "string") currentPhase = event.safeMetadata.phase;
    if (event.eventType === "built_in_hint_shown") builtInHintReceived = true;
    if (event.eventType === "child_route_ready") observation.completion.childRouteLoaded = true;
    if (event.eventType === "run_completed") {
      const runCount = Math.min(2, Math.max(1, Number(event.safeMetadata.replayIndex) + 1)) as 1 | 2;
      observation.sessionIdentity.runCount = runCount;
      observation.completion = {
        childRouteLoaded: true,
        runCompleted: true,
        sessionStopped: false,
        relativeDurationMs: event.relativeMs,
        runCount,
        stopCode: null,
      };
      markFirstUseSessionFinished(storage, grant.sessionId);
    }
    if (event.eventType === "session_stopped" && typeof event.safeMetadata.stopCode === "string") {
      const stopCode = event.safeMetadata.stopCode as FirstUseStopCode;
      observation.completion = { ...observation.completion, sessionStopped: true, relativeDurationMs: event.relativeMs, stopCode };
      observation.wellbeing.stopCode = stopCode;
      markFirstUseSessionStopped(storage, grant.sessionId, stopCode);
    }
    observation = reconcileFirstUseEvidence(observation);
    persist();
    renderDashboard();
  };

  const connectReceiver = (): void => {
    receiver?.close();
    receiver = createFirstUseEventReceiver({ sessionId: grant.sessionId, storage, onEvent: applyTechnicalEvent });
    receiver.getEvents().forEach(applyTechnicalEvent);
  };

  const renderPreparation = (): void => {
    root.innerHTML = `<main class="step04-observer-shell" data-testid="step04-observer-preparation">
      <header class="step04-hero">
        <div><span class="step04-kicker">STEP 04 · PARENT-DIRECTED FIRST USE</span><h1>儿童首次使用 · 本地观察台</h1><p>START 先打开家长准备页；向下完成音频预检、选择观察方式并勾选 READY 后，才会另开儿童游戏窗口。</p></div>
        <div class="step04-hero-actions">
          ${controller.context.fixture ? `<strong class="step04-fixture">SYNTHETIC_TOOLING_TEST_ONLY</strong>` : `<strong class="step04-state">AUTHORIZED_CHILD_FIRST_USE_READY</strong>`}
          <a class="step04-next-link" href="#step04-audio-preflight">继续完成音频预检 ↓</a>
        </div>
      </header>
      <section class="step04-identity" data-testid="step04-build-identity">
        <div class="step04-section-heading"><div><span>精确构建身份</span><h2>Accepted build freeze</h2></div><strong>${escapeHtml(controller.context.buildIdentitySha256.slice(0, 12))}…</strong></div>
        <dl><div><dt>commit</dt><dd>${escapeHtml(buildIdentity.commitSha)}</dd></div><div><dt>parent feedback</dt><dd>${escapeHtml(buildIdentity.parentFeedbackSha256)}</dd></div>${Object.entries(STEP04_ACCEPTED_SOURCE_SNAPSHOTS).map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("")}</dl>
      </section>
      <section class="step04-ready-card">
        <div class="step04-section-heading"><div><span>开始前</span><h2>家长准备</h2></div><strong class="step04-local-chip">不录音 · 不录像 · 不上传</strong></div>
        <ul class="step04-checklist"><li>使用孩子熟悉的设备</li><li>亮度舒适</li><li>关闭通知</li><li>孩子可以随时停止</li><li>家长只提供技术支持；内置提示优先</li></ul>
        <blockquote>这里有一段小冒险，你可以自己看看。想停随时可以停。</blockquote>
      </section>
      <div id="step04-audio-preflight" data-audio-preflight-host></div>
      <section class="step04-launch" data-testid="step04-launch-gate">
        <div class="step04-section-heading"><div><span>最后门禁</span><h2>选择观察方式</h2></div></div>
        <div class="step04-mode-row">${(["LIVE_DASHBOARD", "COMPACT_AFTER_SESSION"] as const).map((mode) => `<button type="button" data-session-mode="${mode}" aria-pressed="${sessionMode === mode}">${SESSION_MODE_LABELS[mode]}</button>`).join("")}<button type="button" data-cancel-session>取消</button></div>
        <label class="step04-ready-check"><input type="checkbox" data-ready-confirm ${ready ? "checked" : ""}><span><strong>READY</strong> 我已完成上面检查，并知道可以立即停止。</span></label>
        <button class="step04-start-button" type="button" data-start-session disabled>音频、方式和 READY 完成后打开儿童路线</button>
        <p data-launch-status>儿童路线尚未打开。</p>
      </section>
    </main>`;

    const firstRunAudio = FINAL_GOLDEN_MANIFEST.filter((character) => character.stage === "first-run").map((character) => ({
      id: character.id as "ming" | "hua" | "lin" | "xing",
      glyph: character.glyph,
      visualPinyin: character.visualPinyin,
      familiarWord: character.familiarWord,
      spokenPhrase: character.spokenPhrase,
    }));
    const audioHost = root.querySelector<HTMLElement>("[data-audio-preflight-host]");
    if (!audioHost) throw new Error("Missing STEP 04 audio preflight host");
    audioHandle = mountAudioPreflight(audioHost, {
      characters: firstRunAudio,
      onStateChange(next) {
        audioState = next;
        if (next.decision === "CANCEL") {
          controller.cancel();
          renderCancelled();
          return;
        }
        updateLaunchGate();
      },
    });

    root.querySelectorAll<HTMLButtonElement>("[data-session-mode]").forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.sessionMode;
      if (next !== "LIVE_DASHBOARD" && next !== "COMPACT_AFTER_SESSION") return;
      sessionMode = next;
      root.querySelectorAll<HTMLButtonElement>("[data-session-mode]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      updateLaunchGate();
    }));
    root.querySelector<HTMLInputElement>("[data-ready-confirm]")?.addEventListener("change", (event) => {
      ready = (event.currentTarget as HTMLInputElement).checked;
      updateLaunchGate();
    });
    root.querySelector<HTMLButtonElement>("[data-cancel-session]")?.addEventListener("click", () => {
      controller.cancel();
      renderCancelled();
    });
    root.querySelector<HTMLButtonElement>("[data-start-session]")?.addEventListener("click", startSession);
    updateLaunchGate();
  };

  const updateLaunchGate = (): void => {
    const start = root.querySelector<HTMLButtonElement>("[data-start-session]");
    const status = root.querySelector<HTMLElement>("[data-launch-status]");
    if (!start || !status) return;
    const audioChoice = audioState?.decision === "SOUND_OK" || audioState?.decision === "START_MUTED" ? audioState.decision : null;
    const canStart = ready && sessionMode !== null && audioChoice !== null;
    start.disabled = !canStart;
    start.textContent = canStart ? "打开儿童冒险路线" : "音频、方式和 READY 完成后打开儿童路线";
    status.textContent = canStart ? "门禁已满足；点击后才会创建本次授权。" : "儿童路线尚未打开。";
  };

  const startSession = (): void => {
    const completedAudioState = audioState;
    const audioChoice = completedAudioState?.decision;
    if (!completedAudioState || !ready || !sessionMode || (audioChoice !== "SOUND_OK" && audioChoice !== "START_MUTED")) return;
    try {
      const result = controller.authorizeAndOpen({ readyConfirmed: true, audioChoice, sessionMode });
      grant = result.grant;
      childRoute = result.childRoute;
      observation = createFirstUseObservationPackage(grant, buildIdentity, {
        decision: audioChoice,
        adapter: completedAudioState.adapter,
        voiceCategory: completedAudioState.voiceCategory,
      }, {
        startedAtUtc: controller.context.startedAtUtc,
        checkedAtUtc: controller.context.checkedAtUtc,
      });
      persist();
      audioHandle?.destroy();
      audioHandle = null;
      connectReceiver();
      renderDashboard();
    } catch (error) {
      const status = root.querySelector<HTMLElement>("[data-launch-status]");
      if (status) status.textContent = error instanceof Error ? error.message : "无法创建本地授权。";
    }
  };

  const renderCancelled = (): void => {
    audioHandle?.destroy();
    audioHandle = null;
    root.innerHTML = `<main class="step04-observer-shell step04-blocked"><span>STEP 04 · SESSION CANCELLED</span><h1>本次 session 已取消</h1><p>儿童路线没有打开，也没有生成儿童观察。</p></main>`;
  };

  const checkpointMarkup = (): string => {
    if (!observation) return "";
    const currentObservation = observation;
    return FIRST_USE_CHECKPOINTS.map((checkpoint) => `<article class="step04-checkpoint">
      <h3>${FIRST_USE_CHECKPOINT_LABELS[checkpoint]}</h3>
      <p class="step04-derived-reach" data-checkpoint-reach="${checkpoint}">${CHECKPOINT_REACH_VALUE_LABELS[currentObservation.observations.checkpointReach[checkpoint]]} · 只读</p>
      <div>${CHECKPOINT_NOTICE_VALUES.map((value) => `<button type="button" data-checkpoint="${checkpoint}" data-checkpoint-notice="${value}" aria-pressed="${currentObservation.observations.checkpointNotice[checkpoint] === value}">${CHECKPOINT_NOTICE_VALUE_LABELS[value]}</button>`).join("")}</div>
    </article>`).join("");
  };

  function renderDashboard(): void {
    if (!observation || destroyed) return;
    const eventCount = observation.technicalEvents.length;
    const lastRelative = observation.technicalEvents.at(-1)?.relativeMs ?? 0;
    const notesPrivacy = validateObserverNotes(observation.observerNotes);
    const currentCompletionStatus = completionStatus(observation);
    const ended = currentCompletionStatus === "COMPLETED" || currentCompletionStatus === "STOPPED";
    root.innerHTML = `<main class="step04-observer-shell" data-testid="step04-observer-dashboard">
      <header class="step04-dashboard-header">
        <div><span class="step04-kicker">STEP 04 · LOCAL PARENT OBSERVER</span><h1>观察事实，不替孩子作答</h1><p>${escapeHtml(SESSION_MODE_LABELS[grant.sessionMode as FirstUseSessionMode])} · ${observation.audioPreflight.decision === "START_MUTED" ? "静音 session" : "声音 session"}</p></div>
        <div class="step04-live-status ${statusClass(currentCompletionStatus)}"><i></i><span>${escapeHtml(currentCompletionStatus)}</span></div>
      </header>
      ${observation.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY" ? `<aside class="step04-fixture-banner">${escapeHtml(observation.fixtureLabel)} · SYNTHETIC_TOOLING_TEST_ONLY · 不得作为真人儿童结果</aside>` : ""}
      ${currentCompletionStatus === "STOPPED" ? `<aside class="step04-rest-message">先回营地休息，找到的汉字都还在。</aside>` : ""}
      <section class="step04-live-grid" data-testid="step04-live-region">
        <article><span>当前 phase</span><strong>${escapeHtml(currentPhase)}</strong></article>
        <article><span>相对时间</span><strong>${Math.round(lastRelative / 1000)} 秒</strong></article>
        <article><span>技术事件</span><strong>${technicalSignalReceived || eventCount ? `${eventCount} 条` : "尚未收到"}</strong></article>
        <article><span>内置提示</span><strong>${builtInHintReceived ? "已出现" : "尚未收到"}</strong></article>
      </section>
      <section class="step04-stop-panel" data-testid="step04-stop-control">
        <div><strong>随时可以停止</strong><span>停止不会显示失败，也不要求完成。</span></div>
        <select data-stop-code>${selectedOptions(FIRST_USE_STOP_CODES, STOP_CODE_LABELS, selectedStopCode)}</select>
        <button type="button" data-stop-now ${ended ? "disabled" : ""}>立即停止</button>
      </section>
      <section class="step04-child-window-link"><span>儿童窗口没有答案、调试或观察控件。</span>${childRoute ? `<a href="${escapeHtml(childRoute)}" target="hanzi-v2-step04-child-${grant.sessionId}" rel="noopener noreferrer">重新聚焦儿童路线</a>` : ""}</section>
      <section class="step04-observation-section">
        <div class="step04-section-heading"><div><span>快速观察 · 中文稳定枚举</span><h2>关键节点</h2></div><strong class="step04-local-chip">事实 ≠ 解释</strong></div>
        <div class="step04-checkpoint-grid">${checkpointMarkup()}</div>
      </section>
      <section class="step04-observation-section">
        <div class="step04-section-heading"><div><span>四类证据</span><h2>可见行为记录</h2></div><p>这里不写“学会了”。</p></div>
        ${categoryMarkup("Usability", "usability", observation.observations.usability, USABILITY_LABELS)}
        ${categoryMarkup("Engagement", "engagement", observation.observations.engagement, ENGAGEMENT_LABELS)}
        ${categoryMarkup("Learning mechanism visibility", "learningMechanismVisibility", observation.observations.learningMechanismVisibility, LEARNING_LABELS)}
      </section>
      <section class="step04-observation-section">
        <div class="step04-section-heading"><div><span>成人介入</span><h2>技术帮助与答案帮助分开</h2></div></div>
        <div class="step04-intervention-builder">
          <label>节点<select data-intervention-checkpoint>${selectedOptions(FIRST_USE_CHECKPOINTS, FIRST_USE_CHECKPOINT_LABELS, selectedInterventionCheckpoint)}</select></label>
          <label>介入<select data-intervention-code>${selectedOptions(INTERVENTION_CODES, INTERVENTION_LABELS, selectedIntervention)}</select></label>
          <label>只指区域<select data-intervention-region>${selectedOptions(POINTABLE_REGIONS, REGION_LABELS, selectedRegion)}</select></label>
          <button type="button" data-add-intervention>记录介入</button>
        </div>
        <p>“只指区域”只能指世界、结构板或手牌；不指某张牌、不指某个槽、不说答案。</p>
        <ul class="step04-intervention-log">${observation.interventions.length ? observation.interventions.map((item) => `<li><strong>${FIRST_USE_CHECKPOINT_LABELS[item.checkpointId]}</strong><span>${INTERVENTION_LABELS[item.code]}${item.region ? ` · ${REGION_LABELS[item.region]}` : ""} · ${item.relativeMs}ms</span></li>`).join("") : "<li>尚未记录成人介入。</li>"}</ul>
      </section>
      <section class="step04-observation-section step04-wellbeing">
        <div class="step04-section-heading"><div><span>Well-being</span><h2>舒适和停止优先</h2></div></div>
        ${Object.entries(WELLBEING_FIELD_LABELS).map(([key, label]) => `<label>${label}<select data-wellbeing-field="${key}">${selectedOptions(WELLBEING_VALUES, WELLBEING_VALUE_LABELS, observation?.wellbeing[key as keyof typeof WELLBEING_FIELD_LABELS] as (typeof WELLBEING_VALUES)[number])}</select></label>`).join("")}
      </section>
      ${ended ? optionalCardsMarkup(observation.optionalChildChoices) : `<section class="step04-optional-locked"><strong>可选卡片尚未显示</strong><span>只在 run 结束或停止后，由家长判断是否展示。</span></section>`}
      ${ended ? `<section class="step04-observation-section"><div class="step04-section-heading"><div><span>可选补充</span><h2>Replay 意图、观察与实际行动分开</h2></div></div>
        <p><strong>Replay intent：</strong>${escapeHtml(observation.replay.replayIntent)}</p>
        <label>家长观察到的重玩请求<select data-parent-replay-request>${selectedOptions(PARENT_OBSERVED_REPLAY_VALUES, PARENT_OBSERVED_REPLAY_LABELS, observation.replay.parentObservedReplayRequest)}</select></label>
        <p data-actual-replay-action><strong>Actual replay action（技术事件，只读）：</strong>${observation.replay.actualReplayAction ? "已收到 replay_selected" : "未收到 replay_selected"}</p>
        <label class="step04-inline-check"><input type="checkbox" data-questions-offered ${observation.optionalChildChoices.optionalQuestionsAsked ? "checked" : ""}>只提供了两条可选结束问题（孩子可以拒绝）</label>
        <div class="step04-consistency-warnings"><strong>Evidence consistency warnings</strong><ul>${observation.evidenceConsistencyWarnings.length ? observation.evidenceConsistencyWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("") : "<li>none</li>"}</ul></div>
      </section>` : ""}
      <section class="step04-export-section">
        <div class="step04-section-heading"><div><span>本地导出</span><h2>保存最小证据</h2></div><strong>${notesPrivacy.ok ? "隐私检查就绪" : "请先修正隐私问题"}</strong></div>
        <label>家长说明（最多 1000 字；不写儿童姓名、学校、联系方式或直接引语）<textarea maxlength="1000" rows="5" data-observer-notes>${escapeHtml(observation.observerNotes)}</textarea></label>
        <p data-privacy-status>${notesPrivacy.ok ? "不会导出 voice name、user agent、坐标、媒体、分数或浏览器 storage dump。" : escapeHtml(notesPrivacy.issues.join("；"))}</p>
        <button type="button" data-export-observation ${ended && notesPrivacy.ok ? "" : "disabled"}>导出 ${escapeHtml("STEP-04_CHILD_FIRST_USE_OBSERVATION.json")}</button>
        <p data-export-status>${ended ? "导出只形成待家长与 ChatGPT 解释的证据，不自动作结论。" : "session 结束或停止后才能导出。"}</p>
      </section>
    </main>`;
    bindDashboard();
  }

  function bindDashboard(): void {
    if (!observation) return;
    root.querySelector<HTMLSelectElement>("[data-stop-code]")?.addEventListener("change", (event) => {
      selectedStopCode = (event.currentTarget as HTMLSelectElement).value as FirstUseStopCode;
    });
    root.querySelector<HTMLButtonElement>("[data-stop-now]")?.addEventListener("click", () => {
      if (!observation || !receiver) return;
      receiver.sendStop(selectedStopCode);
      observation.completion = {
        ...observation.completion,
        sessionStopped: true,
        stopCode: selectedStopCode,
        relativeDurationMs: relativeNow(),
      };
      observation.wellbeing.stopCode = selectedStopCode;
      markFirstUseSessionStopped(storage, grant.sessionId, selectedStopCode);
      observation = reconcileFirstUseEvidence(observation);
      persist();
      renderDashboard();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-checkpoint]").forEach((button) => button.addEventListener("click", () => {
      if (!observation) return;
      const checkpoint = button.dataset.checkpoint as FirstUseCheckpointId;
      const value = button.dataset.checkpointNotice as FirstUseObservationPackage["observations"]["checkpointNotice"][FirstUseCheckpointId];
      if (!FIRST_USE_CHECKPOINTS.includes(checkpoint) || !CHECKPOINT_NOTICE_VALUES.includes(value)) return;
      observation.observations.checkpointNotice[checkpoint] = value;
      persist();
      renderDashboard();
    }));
    root.querySelectorAll<HTMLSelectElement>("[data-observation-category]").forEach((select) => select.addEventListener("change", () => {
      if (!observation) return;
      const category = select.dataset.observationCategory;
      const id = select.dataset.observationId;
      const value = select.value as ObservationValue;
      if (!id || !OBSERVATION_VALUES.includes(value)) return;
      if (category === "usability" && USABILITY_OBSERVATION_IDS.includes(id as never)) observation.observations.usability[id as keyof typeof observation.observations.usability] = value;
      else if (category === "engagement" && ENGAGEMENT_OBSERVATION_IDS.includes(id as never)) observation.observations.engagement[id as keyof typeof observation.observations.engagement] = value;
      else if (category === "learningMechanismVisibility" && LEARNING_VISIBILITY_OBSERVATION_IDS.includes(id as never)) observation.observations.learningMechanismVisibility[id as keyof typeof observation.observations.learningMechanismVisibility] = value;
      persist();
    }));
    root.querySelector<HTMLSelectElement>("[data-intervention-checkpoint]")?.addEventListener("change", (event) => {
      selectedInterventionCheckpoint = (event.currentTarget as HTMLSelectElement).value as FirstUseCheckpointId;
    });
    root.querySelector<HTMLSelectElement>("[data-intervention-code]")?.addEventListener("change", (event) => {
      selectedIntervention = (event.currentTarget as HTMLSelectElement).value as InterventionCode;
    });
    root.querySelector<HTMLSelectElement>("[data-intervention-region]")?.addEventListener("change", (event) => {
      selectedRegion = (event.currentTarget as HTMLSelectElement).value as PointableRegion;
    });
    root.querySelector<HTMLButtonElement>("[data-add-intervention]")?.addEventListener("click", () => {
      if (!observation) return;
      observation.interventions = [...observation.interventions, {
        checkpointId: selectedInterventionCheckpoint,
        code: selectedIntervention,
        region: selectedIntervention === "POINT_TO_REGION_ONLY" ? selectedRegion : null,
        relativeMs: relativeNow(),
      }];
      if (selectedIntervention === "ADULT_ANSWER_REQUIRED") {
        observation.observations.checkpointNotice[selectedInterventionCheckpoint] = "ADULT_ANSWER_REQUIRED";
        receiver?.sendStop("ADULT_ANSWER_REQUIRED");
        observation.completion = {
          ...observation.completion,
          sessionStopped: true,
          relativeDurationMs: relativeNow(),
          stopCode: "ADULT_ANSWER_REQUIRED",
        };
        observation.wellbeing.stopCode = "ADULT_ANSWER_REQUIRED";
        markFirstUseSessionStopped(storage, grant.sessionId, "ADULT_ANSWER_REQUIRED");
      }
      if (selectedIntervention === "STOPPED") observation.observations.checkpointNotice[selectedInterventionCheckpoint] = "STOPPED";
      observation = reconcileFirstUseEvidence(observation);
      persist();
      renderDashboard();
    });
    root.querySelectorAll<HTMLSelectElement>("[data-wellbeing-field]").forEach((select) => select.addEventListener("change", () => {
      if (!observation) return;
      const field = select.dataset.wellbeingField as keyof typeof WELLBEING_FIELD_LABELS;
      const value = select.value as WellbeingValue;
      if (!(field in WELLBEING_FIELD_LABELS) || !WELLBEING_VALUES.includes(value)) return;
      observation.wellbeing[field] = value;
      persist();
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-again-again]").forEach((button) => button.addEventListener("click", () => {
      if (!observation || !isAgainAgainValue(button.dataset.againAgain)) return;
      observation.optionalChildChoices.againAgain = button.dataset.againAgain;
      observation.replay.replayIntent = button.dataset.againAgain;
      observation = reconcileFirstUseEvidence(observation);
      persist();
      renderDashboard();
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-favorite-moment]").forEach((button) => button.addEventListener("click", () => {
      if (!observation || !isFavoriteMomentValue(button.dataset.favoriteMoment)) return;
      observation.optionalChildChoices.favoriteMoment = button.dataset.favoriteMoment;
      persist();
      renderDashboard();
    }));
    root.querySelector<HTMLSelectElement>("[data-parent-replay-request]")?.addEventListener("change", (event) => {
      if (!observation) return;
      const value = (event.currentTarget as HTMLSelectElement).value as FirstUseObservationPackage["replay"]["parentObservedReplayRequest"];
      if (!PARENT_OBSERVED_REPLAY_VALUES.includes(value)) return;
      observation.replay.parentObservedReplayRequest = value;
      observation = reconcileFirstUseEvidence(observation);
      persist();
      renderDashboard();
    });
    root.querySelector<HTMLInputElement>("[data-questions-offered]")?.addEventListener("change", (event) => {
      if (!observation) return;
      observation.optionalChildChoices.optionalQuestionsAsked = (event.currentTarget as HTMLInputElement).checked;
      persist();
    });
    root.querySelector<HTMLTextAreaElement>("[data-observer-notes]")?.addEventListener("input", (event) => {
      if (!observation) return;
      observation.observerNotes = (event.currentTarget as HTMLTextAreaElement).value;
      persist();
      const result = validateObserverNotes(observation.observerNotes);
      const status = root.querySelector<HTMLElement>("[data-privacy-status]");
      const exportButton = root.querySelector<HTMLButtonElement>("[data-export-observation]");
      if (status) status.textContent = result.ok ? "不会导出 voice name、user agent、坐标、媒体、分数或浏览器 storage dump。" : result.issues.join("；");
      const completion = completionStatus(observation);
      if (exportButton) exportButton.disabled = !result.ok || (completion !== "COMPLETED" && completion !== "STOPPED" && completion !== "TECHNICAL_END");
    });
    root.querySelector<HTMLButtonElement>("[data-export-observation]")?.addEventListener("click", () => {
      if (!observation) return;
      const status = root.querySelector<HTMLElement>("[data-export-status]");
      try {
        downloadFirstUseObservation(observation);
        if (status) status.textContent = "已生成本地观察 JSON；请运行 FINISH 校验与打包。";
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "导出未完成。";
      }
    });
  }

  if (["AUTHORIZED", "STOPPED", "FINISHED"].includes(grant.status) && grant.audioChoice && grant.sessionMode) {
    if (!observation && grant.status === "AUTHORIZED") {
      observation = createFirstUseObservationPackage(grant, buildIdentity, {
        decision: grant.audioChoice,
        adapter: audioState?.adapter ?? "silent-visual",
        voiceCategory: audioState?.voiceCategory ?? "NONE",
      }, {
        startedAtUtc: controller.context.startedAtUtc,
        checkedAtUtc: controller.context.checkedAtUtc,
      });
    }
    if (!observation) {
      root.innerHTML = `<main class="step04-observer-shell step04-blocked"><h1>无法恢复本地观察台</h1><p>本地 session 已结束，但没有通过严格校验的观察记录。</p></main>`;
      return { getObservation: () => null, destroy() { audioHandle?.destroy(); receiver?.close(); } };
    }
    try {
      if (grant.status === "AUTHORIZED") childRoute = `?${new URLSearchParams({ play: "hanzi-v2-golden-slice", mode: "child-first-use", session: grant.sessionId, seed: grant.runSeed }).toString()}`;
      connectReceiver();
      renderDashboard();
    } catch (error) {
      root.innerHTML = `<main class="step04-observer-shell step04-blocked"><h1>无法恢复本地观察台</h1><p>${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</p></main>`;
    }
  } else if (grant.status === "PREPARED") {
    renderPreparation();
  } else {
    renderCancelled();
  }

  return {
    getObservation: () => observation,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      audioHandle?.destroy();
      receiver?.close();
      root.replaceChildren();
    },
  };
}

export {
  createFirstUseBuildIdentity,
  createFirstUseObservationPackage,
  createParentSessionController,
  downloadFirstUseObservation,
};
export type { FirstUseBuildIdentity, FirstUseObservationPackage };
