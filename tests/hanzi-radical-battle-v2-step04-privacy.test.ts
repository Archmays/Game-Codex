import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIRST_USE_PRIVACY_DENIED_KEYS,
  validateEventMetadataPrivacy,
  validateFirstUsePrivacy,
  validateObserverNotes,
} from "../games/hanzi-radical-battle/v2/golden-slice/first-use/privacy";

const root = resolve(import.meta.dirname, "..");

describe("Hanzi V2 STEP 04 privacy boundary", () => {
  it("denies identity, device fingerprint, exact voice, media, coordinates, raw input, and score fields", () => {
    expect(FIRST_USE_PRIVACY_DENIED_KEYS).toEqual(expect.arrayContaining([
      "name", "age", "school", "userAgent", "screenResolution", "pointerCoordinates",
      "rawKey", "voiceName", "audio", "video", "mediaPath", "storageDump", "score", "childQuote",
    ]));
    for (const denied of FIRST_USE_PRIVACY_DENIED_KEYS) {
      const result = validateFirstUsePrivacy({ [denied]: "fixture" });
      expect(result.ok, denied).toBe(false);
    }
  });

  it("allows only contract-valid minimal metadata and rejects free or answer-bearing keys", () => {
    expect(validateEventMetadataPrivacy("phase_entered", { phase: "camp_intro" })).toBe(true);
    expect(validateEventMetadataPrivacy("invalid_placement", { encounterId: "encounter-ming", cardId: "sun" })).toBe(false);
    expect(validateEventMetadataPrivacy("technical_error", { errorCode: "BRIDGE_UNAVAILABLE", recoverable: true, details: "free text" })).toBe(false);
  });

  it("bounds parent notes and blocks common PII or media content", () => {
    expect(validateObserverNotes("短暂困惑后自己继续。" ).ok).toBe(true);
    expect(validateObserverNotes("x".repeat(1001)).ok).toBe(false);
    expect(validateObserverNotes("姓名：示例儿童").ok).toBe(false);
    expect(validateObserverNotes("联系 13812345678").ok).toBe(false);
    expect(validateObserverNotes("C:\\private\\child.mp4").ok).toBe(false);
  });

  it("contains no remote transport and ignores real observation exports in Git", () => {
    const firstUseFiles = ["event-types.ts", "privacy.ts", "session.ts", "event-bridge.ts"]
      .map((name) => resolve(root, "games/hanzi-radical-battle/v2/golden-slice/first-use", name))
      .filter((path) => {
        try { readFileSync(path); return true; } catch { return false; }
      })
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(firstUseFiles).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/u);
    const gitignore = readFileSync(resolve(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("artifacts/hanzi-radical-battle-v2/step-04/observation/");
    expect(gitignore).toContain("artifacts/hanzi-radical-battle-v2/step-04/observation-inbox/");
    expect(gitignore).toContain("STEP-04_CHILD_FIRST_USE_RETURN_TO_CHATGPT.zip");
  });
});
