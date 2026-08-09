import "./styles.css";
import { createStep06EventBridge, readStep06EventLog, type Step06EventBridge } from "../my-game-world/second-use/event-bridge";
import { STEP06_STOP_CODES, type Step06StopCode } from "../my-game-world/second-use/event-types";
import {
  STEP06_CANONICAL_ORIGIN,
  type Step06ProgressContinuityResult,
} from "../my-game-world/second-use/progress-continuity";
import {
  finishStep06Session,
  STEP06_INTERVAL_BUCKETS,
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
  STEP06_SOUND_MODES,
  stopStep06Session,
  type Step06IntervalBucket,
  type Step06SessionGrant,
  type Step06SoundMode,
} from "../my-game-world/second-use/session";
import {
  buildStep06Observation,
  deriveStep06Actions,
  emptyStep06Observations,
  emptyStep06Wellbeing,
  STEP06_INTERVENTION_CODES,
  STEP06_INTERVENTION_CHECKPOINTS,
  STEP06_OBSERVATION_VALUES,
  STEP06_POINTABLE_REGIONS,
  STEP06_WELLBEING_VALUES,
  type Step06HumanObservations,
  type Step06Intervention,
  type Step06ObservationValue,
  type Step06Wellbeing,
  type Step06WellbeingValue,
} from "./observation-model";
import { downloadStep06Observation } from "./export";
import { renderStep06FixtureSummary } from "./summary";
import {
  isStep06FixtureRoute,
  prepareStep06FixtureProgress,
  preflightStep06Continuity,
  startStep06AuthorizedSession,
  STEP06_FIXTURE_MARKER,
} from "./session-controller";

const OBSERVATION_LABELS: Record<string, string> = {
  recognizedWorld: "认出这是上次的世界",
  noticedPersistentRepairs: "注意到上次修复仍在",
  selectedDestination: "自己选择了去向",
  understoodForestPortal: "理解森林入口",
  understoodSpellbook: "理解字灵书",
  understoodTreasureBox: "理解游戏百宝箱",
  returnedToWorld: "理解返回世界",
  rememberedCorePlacement: "记得核心摆放方法",
  usedBuiltInHintsOnly: "只使用内建提示",
  neededAdultAnswer: "需要成人直接回答",
  showedBoredomWithRepeatedRoute: "对重复路线显得无聊",
  voluntarilyContinued: "自愿继续",
  exploredAnotherWorldObject: "探索另一个世界物件",
  askedForMoreAfterOfficialCheck: "正式观察结束后还想继续",
};

function optionsMarkup(values: readonly string[]): string {
  return values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function continuityMessage(result: Step06ProgressContinuityResult): string {
  if (result.ok) return "已验证：同一固定地址、同一浏览器中的完整上次进度。";
  const messages: Record<string, string> = {
    WRONG_ORIGIN: "地址不对：请只使用 http://127.0.0.1:5175/。localhost 或其他端口属于不同进度空间。",
    STORAGE_UNAVAILABLE: "浏览器无法读取本地进度；请退出无痕模式并使用原浏览器 profile。",
    CANONICAL_SAVE_MISSING: "没有找到上次正式进度；可能换了浏览器 profile、使用了无痕模式或清除了存档。",
    CANONICAL_SAVE_CORRUPT: "存档损坏，本次连续性检查不会修复或重建它。",
    RUN_NOT_COMPLETED: "上次进度还没有完成一局。",
    SPELLBOOK_INCOMPLETE: "上次进度中没有完整保留明、花、林、星。",
    CAMP_REPAIRS_INCOMPLETE: "上次营地修复没有完整保留。",
  };
  return `SECOND_USE_PROGRESS_CONTINUITY_BLOCKED：${messages[result.reason]}`;
}

function currentSurface(events: ReturnType<typeof readStep06EventLog>): string {
  for (const event of [...events].reverse()) {
    if (event.eventType === "forest_entered") return "FOREST";
    if (event.eventType === "classic_hub_opened") return "CLASSIC_HUB";
    if (event.eventType === "world_spellbook_opened") return "SPELLBOOK";
    if (event.eventType === "world_ready" || event.eventType === "returned_to_world") return "WORLD";
  }
  return "WORLD";
}

export function mountHanziV2Step06Observer(root: HTMLElement): void {
  const search = new URLSearchParams(window.location.search);
  const fixture = isStep06FixtureRoute(search);
  const buildCommit = search.get("build") ?? "";
  let fixtureInjected = false;
  if (fixture) fixtureInjected = prepareStep06FixtureProgress(window.localStorage);
  const continuity = preflightStep06Continuity(window.location.origin, window.localStorage);
  let grant: Step06SessionGrant | null = null;
  let bridge: Step06EventBridge | null = null;
  let childWindow: Window | null = null;
  let stopCode: Step06StopCode | null = null;
  let pollTimer: number | null = null;
  let observations = emptyStep06Observations();
  let wellbeing = emptyStep06Wellbeing();
  const interventions: Step06Intervention[] = [];

  root.className = "step06-observer-mount";
  root.innerHTML = `<main class="step06-observer" data-testid="step06-observer" data-evidence-kind="${fixture ? STEP06_FIXTURE_MARKER : "REAL_CHILD_SECOND_USE"}">
    <header><p class="step06-kicker">家长窗口 · STEP 06</p><h1>第二次进入 / 返回世界观察</h1><p>请在下一次自然、独立的游戏时段使用，不要把它接在第一场后面。</p>${fixture ? `<strong class="fixture-label">${STEP06_FIXTURE_MARKER} · NO CHILD DATA</strong>` : ""}</header>
    <section class="step06-card" data-testid="step06-preflight"><h2>开始前检查</h2>
      <dl><dt>STEP 05 feedback</dt><dd>${STEP06_PARENT_FEEDBACK_SHA256}</dd><dt>候选 commit</dt><dd>${STEP06_PARENT_CANDIDATE_COMMIT}</dd><dt>evidence</dt><dd>${STEP06_PARENT_EVIDENCE_SHA256}</dd><dt>revision</dt><dd>${STEP06_PARENT_CANDIDATE_REVISION}</dd><dt>默认世界 / 第二次进入授权</dt><dd>YES / YES</dd><dt>STEP 06 build</dt><dd data-build-commit></dd><dt>默认路线</dt><dd>/ → 我的游戏世界</dd><dt>固定地址</dt><dd>${STEP06_CANONICAL_ORIGIN}</dd></dl>
      <p class="continuity ${continuity.ok ? "is-pass" : "is-blocked"}" data-testid="step06-continuity" data-continuity="${continuity.ok ? "pass" : "blocked"}">${continuityMessage(continuity)}</p>
      <label>间隔区间<select data-interval><option value="">请选择</option>${optionsMarkup(STEP06_INTERVAL_BUCKETS)}</select></label>
      <label>声音方式<select data-sound>${optionsMarkup(STEP06_SOUND_MODES)}</select></label>
      <label class="privacy"><input type="checkbox" data-privacy-ready> 我确认：只记录相对时间和最小技术事件，不录音、不录像、不收集身份信息、不联网。</label>
      <p class="neutral-prompt">把游戏交给孩子，先不要指定目的地。<br>如果孩子问，可以只说：“你想去哪里都可以。”</p>
      <button type="button" data-ready>READY 后打开儿童窗口</button><p data-ready-status role="status"></p>
    </section>
    <section class="step06-card" data-dashboard><h2>实时观察</h2><p>建议 3–5 分钟以内；不要为了记录而要求孩子完成。</p>
      <dl><dt>当前表面</dt><dd data-current-surface>WORLD</dd><dt>当前阶段</dt><dd data-current-phase>—</dd><dt>相对时间</dt><dd data-relative-time>0 ms</dd><dt>进度连续</dt><dd>${continuity.ok ? "VERIFIED" : "BLOCKED"}</dd><dt>第一次去向</dt><dd data-first-destination>—</dd></dl>
      <label>停止原因<select data-stop-code>${optionsMarkup(STEP06_STOP_CODES)}</select></label><button type="button" class="stop" data-stop>结束本次观察</button><p data-stop-status role="status"></p>
    </section>
    <section class="step06-card"><h2>人工观察</h2><p>这些选择由家长记录，不由技术事件代填，也不是学习测验。</p><div data-observation-fields></div>
      <h3>干预</h3><label>观察点<select data-intervention-checkpoint>${optionsMarkup(STEP06_INTERVENTION_CHECKPOINTS)}</select></label><label>方式<select data-intervention-code>${optionsMarkup(STEP06_INTERVENTION_CODES)}</select></label><label>区域<select data-intervention-region><option value="">不指区域</option>${optionsMarkup(STEP06_POINTABLE_REGIONS)}</select></label><button type="button" data-add-intervention>记录一次干预</button><ol data-intervention-list></ol>
      <h3>身心感受</h3><div data-wellbeing-fields></div>
      <label>家长备注（不要填写姓名、学校或自由儿童话语）<textarea data-observer-notes maxlength="1000"></textarea></label>
    </section>
    <section class="step06-card"><h2>结束与导出</h2><p>完成一次去向→世界、一次森林→世界、孩子主动停止、技术停止或自然结束时都可以结束。孩子还想继续时，先结束正式观察，之后自由玩不再进入本次证据。</p><button type="button" data-natural-end>按自然结束停止</button><button type="button" data-export>导出 STEP-06_SECOND_USE_OBSERVATION.json</button><div data-summary></div></section>
  </main>`;

  root.querySelector<HTMLElement>("[data-build-commit]")!.textContent = buildCommit || "未由启动器提供";

  const observationsHost = root.querySelector<HTMLElement>("[data-observation-fields]")!;
  for (const [group, values] of Object.entries(observations)) {
    const fieldset = document.createElement("fieldset");
    fieldset.innerHTML = `<legend>${group}</legend>`;
    for (const key of Object.keys(values)) fieldset.insertAdjacentHTML("beforeend", `<label>${OBSERVATION_LABELS[key] ?? key}<select data-observation-group="${group}" data-observation-key="${key}">${optionsMarkup(STEP06_OBSERVATION_VALUES)}</select></label>`);
    observationsHost.append(fieldset);
  }
  const wellbeingHost = root.querySelector<HTMLElement>("[data-wellbeing-fields]")!;
  for (const key of Object.keys(wellbeing)) wellbeingHost.insertAdjacentHTML("beforeend", `<label>${key}<select data-wellbeing-key="${key}">${optionsMarkup(STEP06_WELLBEING_VALUES)}</select></label>`);

  const updateDashboard = (): void => {
    if (!grant) return;
    const events = readStep06EventLog(window.localStorage, grant.sessionId);
    const derived = deriveStep06Actions(events);
    root.querySelector<HTMLElement>("[data-current-surface]")!.textContent = currentSurface(events);
    root.querySelector<HTMLElement>("[data-current-phase]")!.textContent = [...events].reverse().find((event) => event.safeMetadata.phase)?.safeMetadata.phase ?? "—";
    root.querySelector<HTMLElement>("[data-relative-time]")!.textContent = `${Math.max(0, Date.now() - grant.startedAtMs)} ms`;
    root.querySelector<HTMLElement>("[data-first-destination]")!.textContent = derived.firstDestination ?? "—";
  };

  const stop = (code: Step06StopCode): void => {
    if (!grant || stopCode) return;
    stopCode = code;
    bridge?.emit("session_stopped");
    bridge?.requestStop(code);
    bridge?.close();
    bridge = null;
    stopStep06Session(window.localStorage, grant.sessionId, code);
    window.speechSynthesis?.cancel();
    if (pollTimer !== null) window.clearInterval(pollTimer);
    root.querySelector<HTMLElement>("[data-stop-status]")!.textContent = "正式观察已结束；游戏进度没有被清除。";
  };

  root.querySelector<HTMLElement>("[data-ready]")!.addEventListener("click", () => {
    const interval = (root.querySelector<HTMLSelectElement>("[data-interval]")!.value) as Step06IntervalBucket;
    const soundMode = (root.querySelector<HTMLSelectElement>("[data-sound]")!.value) as Step06SoundMode;
    const privacyReady = root.querySelector<HTMLInputElement>("[data-privacy-ready]")!.checked;
    const status = root.querySelector<HTMLElement>("[data-ready-status]")!;
    if (!continuity.ok) { status.textContent = "SECOND_USE_PROGRESS_CONTINUITY_BLOCKED；未打开儿童路线。"; return; }
    if (!STEP06_INTERVAL_BUCKETS.includes(interval)) { status.textContent = "请选择独立时段的间隔区间。"; return; }
    if (soundMode === "CANCEL") { status.textContent = "已取消；未打开儿童路线。"; return; }
    if (!privacyReady) { status.textContent = "请先确认隐私边界。"; return; }
    if (!/^[0-9a-f]{40}$/i.test(buildCommit)) { status.textContent = "启动器未提供有效的最终 STEP 06 commit。"; return; }
    grant = startStep06AuthorizedSession({ storage: window.localStorage, origin: window.location.origin, buildCommit, intervalBucket: interval, soundMode, fixture });
    bridge = createStep06EventBridge({ grant, storage: window.localStorage, onEvent: updateDashboard });
    bridge.emit("session_opened");
    const childRoute = `?evidence=hanzi-v2-step06&session=${encodeURIComponent(grant.sessionId)}`;
    childWindow = window.open(childRoute, "hanzi-v2-step06-child");
    status.textContent = childWindow ? "儿童窗口已打开。先不要指定目的地。" : "浏览器阻止了新窗口；请允许此页打开窗口后重试。";
    pollTimer = window.setInterval(updateDashboard, 250);
    updateDashboard();
  });
  root.querySelector<HTMLElement>("[data-stop]")!.addEventListener("click", () => stop(root.querySelector<HTMLSelectElement>("[data-stop-code]")!.value as Step06StopCode));
  root.querySelector<HTMLElement>("[data-natural-end]")!.addEventListener("click", () => stop("NATURAL_END"));
  root.querySelector<HTMLElement>("[data-add-intervention]")!.addEventListener("click", () => {
    if (!grant) return;
    const code = root.querySelector<HTMLSelectElement>("[data-intervention-code]")!.value as Step06Intervention["code"];
    const checkpointId = root.querySelector<HTMLSelectElement>("[data-intervention-checkpoint]")!.value as Step06Intervention["checkpointId"];
    const rawRegion = root.querySelector<HTMLSelectElement>("[data-intervention-region]")!.value;
    const list = root.querySelector<HTMLElement>("[data-intervention-list]")!;
    if (code === "POINT_TO_REGION_ONLY" && !STEP06_POINTABLE_REGIONS.includes(rawRegion as never)) {
      list.textContent = "区域提示必须先选择一个允许的大区域，不能指向具体对象。";
      return;
    }
    const region = code === "POINT_TO_REGION_ONLY" ? rawRegion as Step06Intervention["region"] : null;
    const item: Step06Intervention = { checkpointId, relativeMs: Date.now() - grant.startedAtMs, code, region };
    interventions.push(item);
    list.insertAdjacentHTML("beforeend", `<li>${item.relativeMs} ms · ${item.checkpointId} · ${item.code} · ${item.region ?? "无区域"}</li>`);
  });
  root.querySelectorAll<HTMLSelectElement>("[data-observation-group]").forEach((select) => select.addEventListener("change", () => {
    const group = select.dataset.observationGroup as keyof Step06HumanObservations;
    const key = select.dataset.observationKey!;
    observations = { ...observations, [group]: { ...observations[group], [key]: select.value as Step06ObservationValue } } as Step06HumanObservations;
  }));
  root.querySelectorAll<HTMLSelectElement>("[data-wellbeing-key]").forEach((select) => select.addEventListener("change", () => {
    const key = select.dataset.wellbeingKey as keyof Step06Wellbeing;
    wellbeing = { ...wellbeing, [key]: select.value as Step06WellbeingValue };
  }));
  root.querySelector<HTMLElement>("[data-export]")!.addEventListener("click", () => {
    if (!grant) { root.querySelector<HTMLElement>("[data-summary]")!.textContent = "尚未建立正式观察 session。"; return; }
    if (!stopCode) stop("NATURAL_END");
    const finalStopCode = stopCode ?? "NATURAL_END";
    const events = readStep06EventLog(window.localStorage, grant.sessionId);
    const observation = buildStep06Observation(grant, {
      events,
      observations,
      interventions,
      wellbeing,
      childRouteLoaded: childWindow !== null,
      stopCode: finalStopCode,
      observerNotes: root.querySelector<HTMLTextAreaElement>("[data-observer-notes]")!.value,
    });
    try {
      downloadStep06Observation(observation);
      finishStep06Session(window.localStorage, grant.sessionId);
      root.querySelector<HTMLElement>("[data-summary]")!.innerHTML = renderStep06FixtureSummary(observation);
    } catch {
      root.querySelector<HTMLElement>("[data-summary]")!.textContent = "隐私检查未通过：请删除姓名、学校、年龄、联系方式、地址或链接后再导出。没有文件被下载。";
    }
  });

  window.addEventListener("pagehide", () => {
    bridge?.close();
    if (pollTimer !== null) window.clearInterval(pollTimer);
    if (fixture && fixtureInjected) {
      // Fixture mode is designed for an isolated profile; cleanup prevents accidental persistence.
      window.localStorage.removeItem("family-games/hanzi-radical-battle-v2/golden-slice/state");
    }
  }, { once: true });
}
