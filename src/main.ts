import "./styles.css";
import { mountHub } from "../apps/hub";

window.addEventListener("load", async () => {
  const root = document.getElementById("app");

  if (!root) {
    throw new Error("Missing #app container.");
  }

  const reviewMode = new URLSearchParams(window.location.search).get("review");
  const playMode = new URLSearchParams(window.location.search).get("play");
  const goldenSliceMode = new URLSearchParams(window.location.search).get("mode");
  if (playMode === "hanzi-v2-golden-slice") {
    document.documentElement.classList.add("hanzi-v2-golden-slice-page");
    document.body.classList.add("hanzi-v2-golden-slice-page");
    const { mountHanziV2GoldenSlice } = await import(
      "../games/hanzi-radical-battle/v2/golden-slice"
    );
    const mode = goldenSliceMode === "review" ? "review" : "play";
    const handle = mountHanziV2GoldenSlice(root, { mode });
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

  mountHub(root);
});
