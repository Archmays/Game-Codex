import "./styles.css";
import { createStep06EventBridge, readStep06EventLog, type Step06EventBridge } from "../my-game-world/second-use/event-bridge";
import { STEP06_STOP_CODES, type Step06StopCode } from "../my-game-world/second-use/event-types";
import { STEP06_CANONICAL_ORIGIN, type Step06ProgressContinuityResult } from "../my-game-world/second-use/progress-continuity";
import {
  STEP06_INTERVAL_BUCKETS,
  STEP06_SOUND_MODES,
  type Step06IntervalBucket,
  type Step06SoundMode,
} from "../my-game-world/second-use/session";
import { finishStep07Session, stopStep07Session, type Step07SessionGrant } from "../my-game-world/second-use/step07-session";
import { downloadStep07Observation } from "./export";
import {
  buildStep07Observation,
  DEFAULT_STEP07_HUMAN_OBSERVATIONS,
  deriveStep07Actions,
  STEP07_BINARY_VALUES,
  STEP07_ENGAGEMENT_TONES,
  STEP07_OPTIONAL_NOTE_VALUES,
  STEP07_TRI_STATE_VALUES,
  type Step07HumanObservations,
} from "./observation-model";
import {
  isStep07FixtureRoute,
  prepareStep07FixtureProgress,
  recoverStep07ObserverSession,
  resolveStep07RuntimeLaunch,
  preflightStep07Continuity,
  startStep07AuthorizedSession,
  STEP07_FIXTURE_MARKER,
  STEP07_OBSERVER_SESSION_QUERY,
} from "./session-controller";

function optionsMarkup(values: readonly string[]): string {
  return values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function continuityMessage(result: Step06ProgressContinuityResult): string {
  if (result.ok) return "已验证：固定地址与完整上次进度连续。";
  const reasons: Record<string, string> = {
    WRONG_ORIGIN: "请只使用 http://127.0.0.1:5175/。",
    STORAGE_UNAVAILABLE: "浏览器无法读取本地进度；请使用原浏览器 profile，且不要使用无痕模式。",
    CANONICAL_SAVE_MISSING: "没有找到上次正式进度。",
    CANONICAL_SAVE_CORRUPT: "存档损坏；本工具不会修复或重建它。",
    RUN_NOT_COMPLETED: "上次进度尚未完成一局。",
    SPELLBOOK_INCOMPLETE: "上次进度未完整保留明、花、林、星。",
    CAMP_REPAIRS_INCOMPLETE: "上次营地修复未完整保留。",
  };
  return `SECOND_USE_PROGRESS_CONTINUITY_BLOCKED：${reasons[result.reason]}`;
}

function currentSurface(events: ReturnType<typeof readStep06EventLog>): string {
  for (const event of [...events].reverse()) {
    if (event.eventType === "forest_entered") return "FOREST";
    if (event.eventType === "classic_hub_opened") return "TREASURE_BOX";
    if (event.eventType === "world_spellbook_opened") return "SPELLBOOK";
    if (event.eventType === "world_ready" || event.eventType === "returned_to_world") return "WORLD";
  }
  return "WORLD";
}

function renderDerived(root: HTMLElement, grant: Step07SessionGrant): void {
  const events = readStep06EventLog(window.localStorage, grant.sessionId);
  const derived = deriveStep07Actions(events, Date.now() - grant.startedAtMs);
  const values: Record<string, string> = {
    surface: currentSurface(events),
    firstAction: derived.firstActionMs === null ? "—" : `${derived.firstActionMs} ms`,
    firstDestination: derived.firstDestination ?? "—",
    forest: String(derived.forestEntered),
    spellbook: String(derived.spellbookOpened),
    treasure: String(derived.treasureOpened),
    loop: String(derived.worldLoopCompleted),
    run: String(derived.goldenRunCompleted),
    returned: String(derived.returnedToWorld),
    hints: String(derived.hintOrRecoveryCount),
    ability: derived.selectedAbilityId ?? "—",
    errors: String(derived.technicalErrorCount),
    duration: `${derived.durationMs} ms`,
  };
  for (const [key, value] of Object.entries(values)) {
    const target = root.querySelector<HTMLElement>(`[data-derived="${key}"]`);
    if (target) target.textContent = value;
  }
}

export function mountHanziV2Step07Observer(root: HTMLElement): void {
  const search = new URLSearchParams(window.location.search);
  const fixture = isStep07FixtureRoute(search);
  const buildCommit = search.get("build") ?? "";
  const observerSessionAttempt = search.getAll(STEP07_OBSERVER_SESSION_QUERY).length > 0;
  if (fixture && !observerSessionAttempt) prepareStep07FixtureProgress(window.localStorage);
  let runtimeLaunchReady = fixture;
  let machineVerdictSha256: string | null = null;
  const continuity = preflightStep07Continuity(window.location.origin, window.localStorage);
  let grant: Step07SessionGrant | null = null;
  let bridge: Step06EventBridge | null = null;
  let childWindow: Window | null = null;
  let stopReason: Step06StopCode | null = null;
  let pollTimer: number | null = null;
  let human: Step07HumanObservations = { ...DEFAULT_STEP07_HUMAN_OBSERVATIONS };
  const humanFieldsTouched = new Set<keyof Step07HumanObservations>();

  root.className = "step07-observer-mount";
  root.innerHTML = `<main class="step07-observer" data-testid="step07-observer" data-evidence-kind="${fixture ? STEP07_FIXTURE_MARKER : "REAL_CHILD_SECOND_USE"}">
    <header><p class="step07-kicker">家长窗口 · STEP 07</p><h1>真实第二次进入观察</h1><p>机器已经检查技术与界面；这里仅记录机器无法替代的儿童行为。</p>${fixture ? `<strong class="step07-fixture">${STEP07_FIXTURE_MARKER} · NO CHILD DATA</strong>` : ""}</header>
    <section class="step07-card" data-testid="step07-preflight"><h2>开始前</h2>
      <dl><dt>固定地址</dt><dd>${STEP06_CANONICAL_ORIGIN}</dd><dt>Build</dt><dd data-build>${buildCommit || "未由启动器提供"}</dd><dt>证据类别</dt><dd>${fixture ? STEP07_FIXTURE_MARKER : "REAL_CHILD_SECOND_USE"}</dd></dl>
      <p class="step07-continuity ${continuity.ok ? "is-pass" : "is-blocked"}" data-testid="step07-continuity" data-continuity="${continuity.ok ? "pass" : "blocked"}">${continuityMessage(continuity)}</p>
      <p data-machine-grant role="status">${fixture ? "Fixture 不使用真实启动授权。" : "正在核对最终机器 verdict 启动授权…"}</p>
      <label>独立时段间隔<select data-interval><option value="">请选择</option>${optionsMarkup(STEP06_INTERVAL_BUCKETS)}</select></label>
      <label>声音方式<select data-sound>${optionsMarkup(STEP06_SOUND_MODES)}</select></label>
      <label class="step07-privacy"><input type="checkbox" data-privacy-ready> 我确认：不录音、不录像、不收集姓名、学校、年龄、联系方式或完整存档，不发送外部网络请求。</label>
      <p class="step07-neutral-prompt">把游戏交给孩子，只说：“你想去哪里都可以。” 不指定目的地或答案。</p>
      <button type="button" data-ready>READY 后打开儿童窗口</button><p data-ready-status role="status"></p>
    </section>
    <section class="step07-card" aria-labelledby="step07-auto-heading"><h2 id="step07-auto-heading">机器自动记录</h2>
      <dl><dt>当前表面</dt><dd data-derived="surface">WORLD</dd><dt>第一次动作</dt><dd data-derived="firstAction">—</dd><dt>第一次去向</dt><dd data-derived="firstDestination">—</dd><dt>进入森林</dt><dd data-derived="forest">false</dd><dt>打开字灵书</dt><dd data-derived="spellbook">false</dd><dt>打开百宝箱</dt><dd data-derived="treasure">false</dd><dt>完成世界循环</dt><dd data-derived="loop">false</dd><dt>完成一局</dt><dd data-derived="run">false</dd><dt>回到世界</dt><dd data-derived="returned">false</dd><dt>提示/温和恢复</dt><dd data-derived="hints">0</dd><dt>选择能力</dt><dd data-derived="ability">—</dd><dt>技术错误</dt><dd data-derived="errors">0</dd><dt>相对时长</dt><dd data-derived="duration">0 ms</dd></dl>
      <label>停止原因<select data-stop-reason>${optionsMarkup(STEP06_STOP_CODES)}</select></label><button class="stop" type="button" data-stop>结束正式观察</button><p data-stop-status role="status"></p>
    </section>
    <section class="step07-card" aria-labelledby="step07-human-heading" data-testid="step07-human-fields"><h2 id="step07-human-heading">只需记录 5 项</h2>
      <label>认出了上次的世界<select data-human="recognizedWorld"><option value="">请选择</option>${optionsMarkup(STEP07_TRI_STATE_VALUES)}</select></label>
      <label>注意到上次的修复还在<select data-human="noticedPersistentRepairs"><option value="">请选择</option>${optionsMarkup(STEP07_TRI_STATE_VALUES)}</select></label>
      <label>是否需要成人直接回答<select data-human="adultAnswerRequired"><option value="">请选择</option>${optionsMarkup(STEP07_BINARY_VALUES)}</select></label>
      <label>过程是否舒适<select data-human="comfortable"><option value="">请选择</option>${optionsMarkup(STEP07_TRI_STATE_VALUES)}</select></label>
      <label>整体投入状态<select data-human="engagementTone"><option value="">请选择</option>${optionsMarkup(STEP07_ENGAGEMENT_TONES)}</select></label>
      <label>可选补充（只可选择预设，不输入姓名或其他身份信息）<select data-note>${STEP07_OPTIONAL_NOTE_VALUES.map((value) => `<option value="${value}">${value || "无补充"}</option>`).join("")}</select></label>
    </section>
    <section class="step07-card" aria-labelledby="step07-export-heading" data-testid="step07-export"><h2 id="step07-export-heading">导出</h2><p>导出只保留允许字段；不会给出儿童是否“通过”的判断。</p><button type="button" data-export data-final-action>导出 ${fixture ? "STEP-07_SYNTHETIC_TOOLING_TEST_OBSERVATION.json" : "STEP-07_REAL_SECOND_USE_OBSERVATION.json"}</button><div class="step07-summary" data-summary role="status"></div></section>
  </main>`;

  root.querySelectorAll<HTMLSelectElement>("[data-human]").forEach((select) => {
    select.value = "";
    select.addEventListener("change", () => {
      const key = select.dataset.human as keyof Step07HumanObservations;
      if (!select.value) { humanFieldsTouched.delete(key); return; }
      human = { ...human, [key]: select.value } as Step07HumanObservations;
      humanFieldsTouched.add(key);
    });
  });

  const attachObserverBridge = (): void => {
    if (!grant) return;
    bridge?.close();
    bridge = createStep06EventBridge({
      grant,
      storage: window.localStorage,
      onEvent: () => grant && renderDerived(root, grant),
    });
    if (pollTimer !== null) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => grant && renderDerived(root, grant), 250);
    renderDerived(root, grant);
  };

  const bindObserverSessionToUrl = (sessionId: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete(STEP07_OBSERVER_SESSION_QUERY);
    url.searchParams.set(STEP07_OBSERVER_SESSION_QUERY, sessionId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const recovery = recoverStep07ObserverSession({
    search,
    storage: window.localStorage,
    origin: window.location.origin,
    fixture,
  });
  if (recovery.status === "RECOVERED") {
    grant = recovery.grant;
    runtimeLaunchReady = true;
    machineVerdictSha256 = grant.machineVerdictSha256;
    root.querySelector<HTMLSelectElement>("[data-interval]")!.value = grant.intervalBucket;
    root.querySelector<HTMLSelectElement>("[data-interval]")!.disabled = true;
    root.querySelector<HTMLSelectElement>("[data-sound]")!.value = grant.soundMode;
    root.querySelector<HTMLSelectElement>("[data-sound]")!.disabled = true;
    root.querySelector<HTMLInputElement>("[data-privacy-ready]")!.checked = true;
    root.querySelector<HTMLInputElement>("[data-privacy-ready]")!.disabled = true;
    root.querySelector<HTMLButtonElement>("[data-ready]")!.disabled = true;
    root.querySelector<HTMLElement>("[data-machine-grant]")!.textContent = "同一 STEP 07 persisted grant 已严格核对。";
    root.querySelector<HTMLElement>("[data-ready-status]")!.textContent = "STEP07_SESSION_RECOVERED：已恢复观察连接；未重复记录 session_opened。";
    attachObserverBridge();
  } else if (recovery.status === "DENIED") {
    root.querySelector<HTMLButtonElement>("[data-ready]")!.disabled = true;
    root.querySelector<HTMLElement>("[data-machine-grant]")!.textContent = `BLOCK_STEP07_OBSERVER_SESSION_RECOVERY:${recovery.reason}`;
    root.querySelector<HTMLElement>("[data-ready-status]")!.textContent = "恢复请求未通过严格身份核对；未建立新 session。";
  } else if (!fixture) {
    void resolveStep07RuntimeLaunch(search, buildCommit).then((runtimeGrant) => {
      runtimeLaunchReady = runtimeGrant !== null;
      machineVerdictSha256 = runtimeGrant?.verdictSha256 ?? null;
      root.querySelector<HTMLElement>("[data-machine-grant]")!.textContent = runtimeLaunchReady
        ? "最终机器 verdict 启动授权已核对。"
        : "BLOCK_STEP07_MACHINE_VERDICT：请仅使用最终 START 脚本启动。";
    });
  }

  const stop = (reason: Step06StopCode): void => {
    if (!grant || stopReason) return;
    stopReason = reason;
    bridge?.emit("session_stopped");
    bridge?.requestStop(reason);
    bridge?.close();
    bridge = null;
    stopStep07Session(window.localStorage, grant.sessionId, reason);
    if (pollTimer !== null) window.clearInterval(pollTimer);
    root.querySelector<HTMLElement>("[data-stop-status]")!.textContent = "正式观察已结束；游戏进度没有被清除。";
  };

  root.querySelector<HTMLElement>("[data-ready]")!.addEventListener("click", () => {
    const intervalBucket = root.querySelector<HTMLSelectElement>("[data-interval]")!.value as Step06IntervalBucket;
    const soundMode = root.querySelector<HTMLSelectElement>("[data-sound]")!.value as Step06SoundMode;
    const privacyReady = root.querySelector<HTMLInputElement>("[data-privacy-ready]")!.checked;
    const status = root.querySelector<HTMLElement>("[data-ready-status]")!;
    if (grant || stopReason) { status.textContent = "本页已建立过观察；如需重试，请关闭儿童窗口并重新打开 START 工具。"; return; }
    if (!continuity.ok) { status.textContent = "SECOND_USE_PROGRESS_CONTINUITY_BLOCKED；未打开儿童路线。"; return; }
    if (!STEP06_INTERVAL_BUCKETS.includes(intervalBucket)) { status.textContent = "请选择独立时段的间隔。"; return; }
    if (soundMode === "CANCEL") { status.textContent = "已取消；未打开儿童路线。"; return; }
    if (!privacyReady) { status.textContent = "请先确认隐私边界。"; return; }
    if (!/^[0-9a-f]{40}$/i.test(buildCommit)) { status.textContent = "启动器未提供有效的最终 commit。"; return; }
    if (!fixture && !runtimeLaunchReady) { status.textContent = "BLOCK_STEP07_MACHINE_VERDICT；请仅使用最终 START 脚本启动。"; return; }
    grant = startStep07AuthorizedSession({ storage: window.localStorage, origin: window.location.origin, buildCommit, intervalBucket, soundMode, fixture, privacyReady, runtimeLaunchReady, machineVerdictSha256 });
    bindObserverSessionToUrl(grant.sessionId);
    attachObserverBridge();
    bridge?.emit("session_opened");
    const childRoute = `?evidence=hanzi-v2-step07&session=${encodeURIComponent(grant.sessionId)}`;
    childWindow = window.open(childRoute, "hanzi-v2-step07-child");
    root.querySelector<HTMLButtonElement>("[data-ready]")!.disabled = true;
    if (!childWindow) {
      bridge?.emit("technical_error", { errorCode: "POPUP_BLOCKED", recoverable: true });
      stop("TECHNICAL");
      status.textContent = "浏览器阻止了新窗口；本页已安全停止。允许弹窗后请重新运行 START 工具。";
      return;
    }
    status.textContent = "儿童窗口已打开；不要指定目的地。";
  });

  root.querySelector<HTMLElement>("[data-stop]")!.addEventListener("click", () => stop(root.querySelector<HTMLSelectElement>("[data-stop-reason]")!.value as Step06StopCode));
  root.querySelector<HTMLElement>("[data-export]")!.addEventListener("click", () => {
    const summary = root.querySelector<HTMLElement>("[data-summary]")!;
    if (!grant) { summary.textContent = "尚未建立观察 session。"; return; }
    if (humanFieldsTouched.size !== 5) { summary.textContent = "请逐项确认上面的 5 项观察后再导出。"; return; }
    if (!stopReason) stop("NATURAL_END");
    const observation = buildStep07Observation(grant, {
      events: readStep06EventLog(window.localStorage, grant.sessionId),
      humanObservations: human,
      stopReason: stopReason ?? "NATURAL_END",
      humanEntryMode: fixture ? "SYNTHETIC_FIXTURE" : "EXPLICIT_FORM_INPUT",
      optionalNote: root.querySelector<HTMLSelectElement>("[data-note]")!.value as (typeof STEP07_OPTIONAL_NOTE_VALUES)[number],
    });
    try {
      downloadStep07Observation(observation);
      finishStep07Session(window.localStorage, grant.sessionId);
      summary.innerHTML = `<strong data-testid="step07-export-complete">${observation.evidenceKind}</strong><p>已导出；没有生成儿童通过/失败或学习结论。</p>`;
    } catch {
      summary.textContent = "隐私或 schema 检查未通过；请只使用预设补充后重试。没有文件被下载。";
    }
  });

  window.addEventListener("pagehide", () => {
    bridge?.close();
    if (pollTimer !== null) window.clearInterval(pollTimer);
  }, { once: true });
}
