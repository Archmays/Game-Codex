import "./styles.css";
import { mountHub } from "../apps/hub";

window.addEventListener("load", async () => {
  const root = document.getElementById("app");

  if (!root) {
    throw new Error("Missing #app container.");
  }

  const search = new URLSearchParams(window.location.search);
  const reviewMode = search.get("review");
  const playMode = search.get("play");
  const observeMode = search.get("observe");
  const worldMode = search.get("world");
  const hubMode = search.get("hub");
  const fromMode = search.get("from");
  const goldenSliceMode = search.get("mode");
  if (playMode === "hanzi-v2-golden-slice") {
    document.documentElement.classList.add("hanzi-v2-golden-slice-page");
    document.body.classList.add("hanzi-v2-golden-slice-page");
    if (goldenSliceMode === "child-first-use") {
      const session = await import(
        "../games/hanzi-radical-battle/v2/golden-slice/first-use/session"
      );
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
          onFirstUseEvent: (eventType, safeMetadata) => {
            bridge.emit(eventType, safeMetadata);
          },
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
    const { mountHanziV2GoldenSlice } = await import(
      "../games/hanzi-radical-battle/v2/golden-slice"
    );
    const mode = goldenSliceMode === "review" ? "review" : "play";
    const handle = mountHanziV2GoldenSlice(root, {
      mode,
      returnToWorldHref: mode === "play" && fromMode === "world" ? "?world=my-game-world" : undefined,
    });
    if (mode === "review") {
      window.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        if (!event.data || typeof event.data !== "object") return;
        const message = event.data as { type?: unknown; action?: unknown; value?: unknown };
        if (message.type !== "hanzi-v2-step03-review-control") return;
        if (message.action === "mute" && typeof message.value === "boolean") {
          handle.setMuted(message.value);
        } else if (message.action === "reduced-motion" && typeof message.value === "boolean") {
          handle.setReducedMotion(message.value);
        } else if (message.action === "reset") {
          handle.resetLocalProgress();
        } else {
          return;
        }
        window.parent.postMessage({
          type: "hanzi-v2-step03-review-control-applied",
          action: message.action,
        }, window.location.origin);
      });
    }
    return;
  }

  if (observeMode === "hanzi-v2-step04") {
    document.documentElement.classList.add("step04-observer-page");
    document.body.classList.add("step04-observer-page");
    const { mountHanziV2Step04Observer } = await import("../apps/hanzi-v2-step04-observer");
    mountHanziV2Step04Observer(root);
    return;
  }

  if (reviewMode === "hanzi-v2-step05") {
    document.documentElement.classList.add("step05-review-page");
    document.body.classList.add("step05-review-page");
    const { mountHanziV2Step05Review } = await import("../apps/hanzi-v2-step05-review");
    mountHanziV2Step05Review(root);
    return;
  }

  if (reviewMode === "hanzi-v2-step03") {
    document.documentElement.classList.add("step03-review-page");
    document.body.classList.add("step03-review-page");
    const { mountHanziV2Step03Review } = await import("../apps/hanzi-v2-step03-review");
    mountHanziV2Step03Review(root);
    return;
  }

  if (reviewMode === "hanzi-v2-step02") {
    document.documentElement.classList.add("step02-review-page");
    document.body.classList.add("step02-review-page");
    const { mountHanziV2Step02Review } = await import("../apps/hanzi-v2-step02-review");
    mountHanziV2Step02Review(root);
    return;
  }

  if (worldMode === "my-game-world") {
    document.documentElement.classList.add("my-game-world-page");
    document.body.classList.add("my-game-world-page");
    const { mountMyGameWorld } = await import("../apps/my-game-world");
    mountMyGameWorld(root);
    return;
  }

  if (hubMode === "classic" && fromMode === "world") {
    const { mountClassicHubFromWorld } = await import("../apps/my-game-world");
    mountClassicHubFromWorld(root);
    return;
  }

  mountHub(root);
});
