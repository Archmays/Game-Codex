import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serializeStep06Observation } from "../apps/hanzi-v2-step06-observer/export";
import { containsStep06ForbiddenEvidence, containsStep06ForbiddenObserverNotes, sanitizeStep06Metadata } from "../apps/my-game-world/second-use/privacy";
import { createStep06Fixture } from "../tools/hanzi-v2-step06/step06-contract";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 06 privacy and neutral observer", () => {
  it("retains only allowed metadata and detects identity/media/input fields", () => {
    expect(sanitizeStep06Metadata({ destinationId: "FOREST", phase: "camp_intro", recoverable: true })).toEqual({ destinationId: "FOREST", phase: "camp_intro", recoverable: true });
    expect(containsStep06ForbiddenEvidence({ childName: "x" })).toBe(true);
    expect(containsStep06ForbiddenEvidence({ audioPath: "x" })).toBe(true);
    expect(containsStep06ForbiddenEvidence({ pointerCoordinates: [1, 2] })).toBe(true);
    expect(containsStep06ForbiddenObserverNotes("姓名：小明")).toBe(true);
    expect(containsStep06ForbiddenObserverNotes("联系 test@example.com")).toBe(true);
    expect(containsStep06ForbiddenObserverNotes("孩子自己选择后回到了世界。")).toBe(false);
  });

  it("contains no correct destination, solver, media capture, network, or pressure prompt", () => {
    const observer = readFileSync(resolve(root, "apps/hanzi-v2-step06-observer/index.ts"), "utf8");
    expect(observer).toContain("你想去哪里都可以");
    expect(observer).not.toMatch(/请让孩子点墨迹森林|正确目的地|正确卡牌|solver|MediaRecorder|fetch\(|WebSocket|倒计时/u);
    expect(observer).toContain("不要为了记录而要求孩子完成");
    expect(observer).toContain("没有文件被下载");
  });

  it("refuses identifying observer notes before browser download serialization", () => {
    const observation = {
      ...createStep06Fixture("0123456789abcdef0123456789abcdef01234567"),
      observerNotes: "姓名：小明",
    };
    expect(() => serializeStep06Observation(observation)).toThrow("Refusing invalid STEP 06 observation export");
  });
});
