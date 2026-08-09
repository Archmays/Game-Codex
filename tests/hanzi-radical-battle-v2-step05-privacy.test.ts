import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const scopedRoots = [
  "apps/my-game-world",
  "apps/hanzi-v2-step05-review",
  "docs/hanzi-radical-battle-v2/step-05",
];

function filesUnder(relativeRoot: string): string[] {
  const absolute = resolve(repositoryRoot, relativeRoot);
  return readdirSync(absolute).flatMap((name) => {
    const candidate = resolve(absolute, name);
    if (statSync(candidate).isDirectory()) {
      return filesUnder(`${relativeRoot}/${name}`);
    }
    return [candidate];
  });
}

describe("Hanzi V2 STEP 05 privacy and local-only boundary", () => {
  it("contains no embedded local session identity or child media", () => {
    const content = scopedRoots.flatMap(filesUnder).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(content).not.toMatch(/s04-[a-f0-9]{32}|session-[a-z0-9-]{8,}/iu);
    expect(content).not.toMatch(/"sessionId"\s*:\s*"[^"\r\n]+"/iu);
    expect(content).not.toMatch(/\.mp4|\.webm|\.wav|\.m4a/iu);
  });

  it("keeps the raw observation and derived artifact out of committed STEP 05 sources", () => {
    const trackedContent = scopedRoots.flatMap(filesUnder).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(trackedContent).not.toMatch(/"technicalEvents"\s*:\s*\[/u);
    expect(trackedContent).not.toMatch(/"sessionIdentity"\s*:\s*\{\s*"sessionId"/u);
    const ignore = readFileSync(resolve(repositoryRoot, ".gitignore"), "utf8");
    expect(ignore).toContain("artifacts/hanzi-radical-battle-v2/step-05/");
  });

  it("has no network, account, login, payment, ad, or tracking implementation in the child world", () => {
    const world = filesUnder("apps/my-game-world").map((path) => readFileSync(path, "utf8")).join("\n");
    expect(world).not.toMatch(/https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/iu);
    expect(world).not.toMatch(/login|sign.?in|payment|checkout|advert|analytics|tracker/iu);
  });
});
