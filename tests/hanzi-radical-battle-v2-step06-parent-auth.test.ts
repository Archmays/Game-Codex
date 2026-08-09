import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
} from "../apps/my-game-world/second-use/session";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 06 parent authorization", () => {
  it("pins the exact accepted STEP 05 identity and two YES grants", () => {
    expect(STEP06_PARENT_FEEDBACK_SHA256).toBe("AF3878C88F68344E2EF649774FCE24C46D2312824D91AD274628B85C8A6E0800");
    expect(STEP06_PARENT_CANDIDATE_COMMIT).toBe("c46e660396257767692e94d61263b4662a11ccfb");
    expect(STEP06_PARENT_EVIDENCE_SHA256).toBe("EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8");
    expect(STEP06_PARENT_CANDIDATE_REVISION).toBe("fnv1a:c9271099");
    const ingest = readFileSync(resolve(root, "docs/hanzi-radical-battle-v2/step-06/00-STEP-05-PARENT-AUTHORIZATION-INGEST.md"), "utf8");
    expect(ingest).toContain("All four exact review items are `ACCEPT`");
    expect(ingest).toContain("`authorizeDefaultWorldEntry` is `YES`");
    expect(ingest).toContain("`authorizeSecondUseCheck` is `YES`");
    expect(ingest).toContain("raw feedback remains uncommitted");
  });

  it("matches the locally ingested raw feedback when that untracked input is present", () => {
    const path = resolve(root, "artifacts/hanzi-radical-battle-v2/step-05/review/STEP-05_PARENT_REVIEW_FEEDBACK.json");
    let raw: Buffer;
    try { raw = readFileSync(path); } catch { return; }
    expect(createHash("sha256").update(raw).digest("hex").toUpperCase()).toBe(STEP06_PARENT_FEEDBACK_SHA256);
  });
});
