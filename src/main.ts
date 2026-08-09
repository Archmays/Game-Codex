import "./styles.css";
import { mountHub } from "../apps/hub";

window.addEventListener("load", async () => {
  const root = document.getElementById("app");

  if (!root) {
    throw new Error("Missing #app container.");
  }

  const reviewMode = new URLSearchParams(window.location.search).get("review");
  if (reviewMode === "hanzi-v2-step02") {
    document.documentElement.classList.add("step02-review-page");
    document.body.classList.add("step02-review-page");
    const { mountHanziV2Step02Review } = await import("../apps/hanzi-v2-step02-review");
    mountHanziV2Step02Review(root);
    return;
  }

  mountHub(root);
});
