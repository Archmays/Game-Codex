import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { downloadStep07Observation } from "../apps/hanzi-v2-step07-observer/export";
import { validateStep07Observation } from "../apps/hanzi-v2-step07-observer/observation-schema";
import { startStep07AuthorizedSession } from "../apps/hanzi-v2-step07-observer/session-controller";
import {
  containsStep06ForbiddenEvidence,
  containsStep06ForbiddenObserverNotes,
} from "../apps/my-game-world/second-use/privacy";
import { createStep07Fixture } from "../tools/hanzi-v2-step07/step07-contract";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const root = resolve(import.meta.dirname, "..");

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi V2 STEP 07 privacy deny-by-default", () => {
  it("requires an explicit privacy confirmation at the session boundary", () => {
    expect(() => startStep07AuthorizedSession({
      storage: new MemoryStorage(),
      origin: "http://127.0.0.1:5175",
      buildCommit: COMMIT,
      intervalBucket: "ONE_TO_THREE_DAYS",
      soundMode: "START_MUTED",
      fixture: false,
      privacyReady: false,
      runtimeLaunchReady: false,
      machineVerdictSha256: null,
    })).toThrow("STEP07_PRIVACY_CONFIRMATION_REQUIRED");
  });

  it("rejects identifying notes before browser APIs can create a download", () => {
    const identifying = {
      ...createStep07Fixture(COMMIT),
      optionalNote: "姓名：小明，电话：13800138000",
    };

    expect(containsStep06ForbiddenObserverNotes(identifying.optionalNote)).toBe(true);
    expect(validateStep07Observation(identifying)).toBe(false);
    expect(() => downloadStep07Observation(identifying as never)).toThrow(/schema or privacy validation/);
    expect(containsStep06ForbiddenObserverNotes("小明在北京实验小学继续玩。" )).toBe(true);
    expect(containsStep06ForbiddenObserverNotes("孩子叫小明，今天继续玩。" )).toBe(true);
    expect(containsStep06ForbiddenObserverNotes("孩子八岁，今天继续玩。" )).toBe(true);
    for (const note of ["小明今天自己回到世界。", "张伟说还想继续。", "北京海淀区中关村大街1号", "妈妈微信may12345", "My child is Alice."]) {
      const arbitrary = { ...createStep07Fixture(COMMIT), optionalNote: note };
      expect(validateStep07Observation(arbitrary)).toBe(false);
      expect(() => downloadStep07Observation(arbitrary as never)).toThrow(/schema or privacy validation/);
    }
  });

  it("rejects forbidden evidence even when it is hidden in an otherwise allowed metadata key", () => {
    const fixture: any = structuredClone(createStep07Fixture(COMMIT));
    fixture.technicalEvents[0].safeMetadata = { errorCode: "SCREEN_CAPTURE", recoverable: false };

    expect(containsStep06ForbiddenEvidence(fixture.technicalEvents[0].safeMetadata)).toBe(true);
    expect(validateStep07Observation(fixture)).toBe(false);
  });

  it("keeps the observer local, neutral, and free of capture or external transport APIs", () => {
    const observer = readFileSync(resolve(root, "apps/hanzi-v2-step07-observer/index.ts"), "utf8");

    expect(observer).toContain("不录音、不录像、不收集姓名、学校、年龄、联系方式或完整存档");
    expect(observer).toContain("你想去哪里都可以");
    expect(observer).toContain("if (!privacyReady)");
    expect(observer).not.toMatch(/MediaRecorder|navigator\.mediaDevices|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
    expect(containsStep06ForbiddenObserverNotes("孩子自己选择后回到了世界。")).toBe(false);
  });
});
