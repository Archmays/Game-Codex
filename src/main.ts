import "./styles.css";
import { isStep06EvidenceAttempt, resolveAppRoute } from "./app-route";

const WORLD_THEME_COLOR = "#071c2a";
const CLASSIC_THEME_COLOR = "#f6f3e7";

function setBrowserIdentity(title: string, themeColor: string): void {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = themeColor;
}

function showStep06Denied(root: HTMLElement, reason: string): void {
  setBrowserIdentity("家长准备 · 第二次进入检查", CLASSIC_THEME_COLOR);
  root.innerHTML = `<main class="step06-route-denied" role="alert" data-testid="step06-route-denied" data-reason="${reason}">
    <h1>这次观察还没有准备好</h1>
    <p>请让家长回到第二次进入观察页，确认固定地址、同一浏览器和上次游戏进度。</p>
  </main>`;
}

window.addEventListener("load", async () => {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app container.");

  const search = new URLSearchParams(window.location.search);
  const route = resolveAppRoute(search);
  const goldenSliceMode = search.get("mode");
  const fromMode = search.get("from");
  const step06EvidenceAttempt = isStep06EvidenceAttempt(search);

  if (route.kind === "play") {
    setBrowserIdentity("汉字魔法战 · 墨迹森林", WORLD_THEME_COLOR);
    document.documentElement.classList.add("hanzi-v2-golden-slice-page");
    document.body.classList.add("hanzi-v2-golden-slice-page");
    if (goldenSliceMode === "child-first-use") {
      const session = await import("../games/hanzi-radical-battle/v2/golden-slice/first-use/session");
      const authorization = session.validateChildFirstUseSessionRoute(search, window.localStorage);
      if (!authorization.ok) {
        root.innerHTML = `<main role="alert" data-testid="child-first-use-denied"><h1>这次冒险还没有准备好</h1><p>请回到家长准备页完成声音检查和 READY 确认。</p></main>`;
        return;
      }
      const [{ mountHanziV2GoldenSlice }, { createChildFirstUseEventBridge }] = await Promise.all([
        import("../games/hanzi-radical-battle/v2/golden-slice"),
        import("../games/hanzi-radical-battle/v2/golden-slice/first-use/event-bridge"),
      ]);
      let childHandle: ReturnType<typeof mountHanziV2GoldenSlice> | null = null;
      let pendingStop: import("../games/hanzi-radical-battle/v2/golden-slice/first-use/event-types").FirstUseStopCode | null = null;
      const bridge = createChildFirstUseEventBridge({
        mode: goldenSliceMode,
        sessionId: authorization.grant.sessionId,
        storage: window.localStorage,
        onStop(stopCode) {
          session.markFirstUseSessionStopped(window.localStorage, authorization.grant.sessionId, stopCode);
          if (childHandle) childHandle.stopFirstUse(stopCode);
          else pendingStop = stopCode;
        },
      });
      try {
        childHandle = mountHanziV2GoldenSlice(root, {
          mode: "play",
          seed: authorization.grant.runSeed,
          childFirstUse: true,
          technicalFixture: authorization.grant.fixture,
          initialMuted: session.firstUseSessionStartsMuted(authorization.grant),
          onFirstUseEvent: (eventType, safeMetadata) => bridge.emit(eventType, safeMetadata),
        });
        if (pendingStop) childHandle.stopFirstUse(pendingStop);
      } catch {
        bridge.emit("technical_error", { errorCode: "RENDER_ERROR", recoverable: false });
        bridge.close();
        root.innerHTML = `<main role="alert" data-testid="child-first-use-error"><h1>冒险暂时没有打开</h1><p>请让家长在观察页选择“立即停止”。</p></main>`;
        return;
      }
      window.addEventListener("pagehide", () => bridge.close(), { once: true });
      return;
    }

    if (step06EvidenceAttempt) {
      const [{ validateStep06InstrumentedRoute, stopStep06Session }, { createStep06EventBridge }, { withStep06RouteContext }, { mountHanziV2GoldenSlice }] = await Promise.all([
        import("../apps/my-game-world/second-use/session"),
        import("../apps/my-game-world/second-use/event-bridge"),
        import("../apps/my-game-world/world-routes"),
        import("../games/hanzi-radical-battle/v2/golden-slice"),
      ]);
      const authorization = validateStep06InstrumentedRoute(search, window.location.origin, window.localStorage);
      if (!authorization.ok) {
        showStep06Denied(root, authorization.reason);
        return;
      }
      let handle: ReturnType<typeof mountHanziV2GoldenSlice> | null = null;
      const bridge = createStep06EventBridge({
        grant: authorization.grant,
        storage: window.localStorage,
        onStop(stopCode) {
          stopStep06Session(window.localStorage, authorization.grant.sessionId, stopCode);
          bridge.close();
          handle?.destroy();
          root.innerHTML = `<main role="status" data-testid="step06-child-stopped"><h1>这次游戏先到这里</h1><p>可以休息，也可以稍后再玩。</p></main>`;
        },
      });
      let previousPhase: string | null = null;
      let previousAbility: string | null = null;
      bridge.emit("forest_entered");
      try {
        handle = mountHanziV2GoldenSlice(root, {
          mode: "play",
          initialMuted: authorization.grant.soundMode === "START_MUTED" ? true : undefined,
          returnToWorldHref: withStep06RouteContext("?world=my-game-world", {
            evidence: "hanzi-v2-step06",
            sessionId: authorization.grant.sessionId,
          }, "forest"),
          onStateChange(state) {
            if (state.phase !== previousPhase) {
              bridge.emit("golden_phase_entered", { phase: state.phase });
              if (state.phase === "run_complete") bridge.emit("golden_run_completed", { completed: true });
              previousPhase = state.phase;
            }
            if (state.selectedAbilityId && state.selectedAbilityId !== previousAbility) {
              bridge.emit("ability_selected", { abilityId: state.selectedAbilityId });
              previousAbility = state.selectedAbilityId;
            }
          },
        });
      } catch {
        bridge.emit("technical_error", { errorCode: "RENDER_ERROR", recoverable: false });
        bridge.close();
        root.innerHTML = `<main role="alert"><h1>游戏暂时没有打开</h1><p>请让家长结束本次观察。</p></main>`;
        return;
      }
      window.addEventListener("pagehide", () => bridge.close(), { once: true });
      return;
    }

    const { mountHanziV2GoldenSlice } = await import("../games/hanzi-radical-battle/v2/golden-slice");
    const mode = goldenSliceMode === "review" ? "review" : "play";
    const handle = mountHanziV2GoldenSlice(root, {
      mode,
      returnToWorldHref: mode === "play" && fromMode === "world" ? "?world=my-game-world" : undefined,
    });
    if (mode === "review") {
      window.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (event.origin !== window.location.origin || event.source !== window.parent || !event.data || typeof event.data !== "object") return;
        const message = event.data as { type?: unknown; action?: unknown; value?: unknown };
        if (message.type !== "hanzi-v2-step03-review-control") return;
        if (message.action === "mute" && typeof message.value === "boolean") handle.setMuted(message.value);
        else if (message.action === "reduced-motion" && typeof message.value === "boolean") handle.setReducedMotion(message.value);
        else if (message.action === "reset") handle.resetLocalProgress();
        else return;
        window.parent.postMessage({ type: "hanzi-v2-step03-review-control-applied", action: message.action }, window.location.origin);
      });
    }
    return;
  }

  if (route.kind === "observe-step06") {
    setBrowserIdentity("家长观察 · STEP 06 第二次进入", CLASSIC_THEME_COLOR);
    document.documentElement.classList.add("step06-observer-page");
    document.body.classList.add("step06-observer-page");
    const { mountHanziV2Step06Observer } = await import("../apps/hanzi-v2-step06-observer");
    mountHanziV2Step06Observer(root);
    return;
  }
  if (route.kind === "observe-step04") {
    setBrowserIdentity("家长观察 · STEP 04 首次使用", CLASSIC_THEME_COLOR);
    const { mountHanziV2Step04Observer } = await import("../apps/hanzi-v2-step04-observer");
    document.documentElement.classList.add("step04-observer-page");
    document.body.classList.add("step04-observer-page");
    mountHanziV2Step04Observer(root);
    return;
  }
  if (route.kind.startsWith("review-")) {
    const step = route.kind.slice(-2);
    setBrowserIdentity(`家长审核 · STEP ${step}`, CLASSIC_THEME_COLOR);
    document.documentElement.classList.add(`step${step}-review-page`);
    document.body.classList.add(`step${step}-review-page`);
    if (step === "05") (await import("../apps/hanzi-v2-step05-review")).mountHanziV2Step05Review(root);
    else if (step === "03") (await import("../apps/hanzi-v2-step03-review")).mountHanziV2Step03Review(root);
    else (await import("../apps/hanzi-v2-step02-review")).mountHanziV2Step02Review(root);
    return;
  }

  if (route.kind === "classic-hub") {
    setBrowserIdentity("游戏百宝箱", CLASSIC_THEME_COLOR);
    const { mountClassicHubFromWorld } = await import("../apps/my-game-world");
    if (step06EvidenceAttempt) {
      const [{ validateStep06InstrumentedRoute, stopStep06Session }, { createStep06EventBridge }] = await Promise.all([
        import("../apps/my-game-world/second-use/session"),
        import("../apps/my-game-world/second-use/event-bridge"),
      ]);
      const authorization = validateStep06InstrumentedRoute(search, window.location.origin, window.localStorage);
      if (!authorization.ok) {
        showStep06Denied(root, authorization.reason);
        return;
      }
      let classicHandle: ReturnType<typeof mountClassicHubFromWorld> | null = null;
      const bridge = createStep06EventBridge({
        grant: authorization.grant,
        storage: window.localStorage,
        onStop(stopCode) {
          stopStep06Session(window.localStorage, authorization.grant.sessionId, stopCode);
          bridge.close();
          classicHandle?.destroy();
          root.innerHTML = `<main role="status" data-testid="step06-child-stopped"><h1>这次游戏先到这里</h1><p>可以休息，也可以稍后再玩。</p></main>`;
        },
      });
      classicHandle = mountClassicHubFromWorld(root, { grant: authorization.grant, bridge });
      window.addEventListener("pagehide", () => bridge.close(), { once: true });
    } else {
      mountClassicHubFromWorld(root);
    }
    return;
  }

  setBrowserIdentity("我的游戏世界", WORLD_THEME_COLOR);
  const { mountMyGameWorld } = await import("../apps/my-game-world");
  if (step06EvidenceAttempt) {
    const [{ validateStep06InstrumentedRoute, stopStep06Session }, { createStep06EventBridge }] = await Promise.all([
      import("../apps/my-game-world/second-use/session"),
      import("../apps/my-game-world/second-use/event-bridge"),
    ]);
    const authorization = validateStep06InstrumentedRoute(search, window.location.origin, window.localStorage);
    if (!authorization.ok) {
      showStep06Denied(root, authorization.reason);
      return;
    }
    let worldHandle: ReturnType<typeof mountMyGameWorld> | null = null;
    const bridge = createStep06EventBridge({
      grant: authorization.grant,
      storage: window.localStorage,
      onStop(stopCode) {
        stopStep06Session(window.localStorage, authorization.grant.sessionId, stopCode);
        bridge.close();
        worldHandle?.destroy();
        root.innerHTML = `<main role="status" data-testid="step06-child-stopped"><h1>这次游戏先到这里</h1><p>可以休息，也可以稍后再玩。</p></main>`;
      },
    });
    worldHandle = mountMyGameWorld(root, { secondUse: { grant: authorization.grant, bridge, from: fromMode } });
    window.addEventListener("pagehide", () => bridge.close(), { once: true });
  } else {
    mountMyGameWorld(root);
  }
});
