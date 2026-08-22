import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { APP_ROUTE_QUERY_MANIFEST, PLAY_SURFACE_MANIFEST } from "../../packages/data/playSurfaceManifest";

type RiskKind =
  | "overflow-hidden"
  | "overflow-clip"
  | "viewport-height"
  | "max-height"
  | "fixed-sticky"
  | "touch-action"
  | "overscroll"
  | "prevent-default"
  | "wheel-listener"
  | "touchmove-listener"
  | "pointermove-listener"
  | "body-class"
  | "modal";

interface RiskEntry {
  readonly path: string;
  readonly line: number;
  readonly kind: RiskKind;
  readonly excerpt: string;
}

const ROOT = resolve(import.meta.dirname, "../..");
const RUNTIME_ROOTS = ["apps", "games", "packages", "src"];
const PATTERNS: Readonly<Record<RiskKind, RegExp>> = {
  "overflow-hidden": /overflow(?:-y)?\s*:\s*hidden/i,
  "overflow-clip": /overflow(?:-y)?\s*:\s*clip/i,
  "viewport-height": /(?:height|min-height|max-height)\s*:\s*(?:100(?:d|s|l)?vh|calc\([^)]*100(?:d|s|l)?vh)/i,
  "max-height": /max-height\s*:/i,
  "fixed-sticky": /position\s*:\s*(?:fixed|sticky)/i,
  "touch-action": /touch-action\s*:/i,
  overscroll: /overscroll-behavior\s*:/i,
  "prevent-default": /preventDefault\s*\(/i,
  "wheel-listener": /(?:addEventListener\s*\(\s*["']wheel|onwheel)/i,
  "touchmove-listener": /(?:addEventListener\s*\(\s*["']touchmove|ontouchmove)/i,
  "pointermove-listener": /(?:addEventListener\s*\(\s*["']pointermove|onpointermove)/i,
  "body-class": /(?:document\.)?body\.classList/i,
  modal: /(?:aria-modal|role=["']dialog|scroll.?lock)/i,
};

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  const result: string[] = [];
  for (const name of readdirSync(path)) {
    const child = resolve(path, name);
    if (statSync(child).isDirectory()) result.push(...filesUnder(child));
    else if (/\.(?:css|html|js|ts|tsx)$/.test(child)) result.push(child);
  }
  return result;
}

function riskInventory(): RiskEntry[] {
  const result: RiskEntry[] = [];
  for (const file of RUNTIME_ROOTS.flatMap((root) => filesUnder(resolve(ROOT, root))).sort()) {
    const path = relative(ROOT, file).replaceAll("\\", "/");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [kind, pattern] of Object.entries(PATTERNS) as Array<[RiskKind, RegExp]>) {
        if (pattern.test(line)) result.push({ path, line: index + 1, kind, excerpt: line.trim().slice(0, 260) });
      }
    });
  }
  return result;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const entries = riskInventory();
const issues: string[] = [];
const policyCounts = Object.fromEntries(["document", "internal", "locked"].map((policy) => [policy, PLAY_SURFACE_MANIFEST.filter((surface) => surface.scrollPolicy === policy).length]));
if (PLAY_SURFACE_MANIFEST.length !== 42) issues.push(`Expected 42 play surfaces, found ${PLAY_SURFACE_MANIFEST.length}`);
if (policyCounts.document !== 39 || policyCounts.internal !== 2 || policyCounts.locked !== 1) issues.push(`Unexpected scroll classification: ${JSON.stringify(policyCounts)}`);
for (const surface of PLAY_SURFACE_MANIFEST) {
  if (surface.scrollPolicy === "internal") {
    if (!surface.scrollContainerSelector) issues.push(`${surface.id}: internal policy requires scrollContainerSelector`);
    if (surface.lockedReason) issues.push(`${surface.id}: internal policy cannot use lockedReason`);
  } else if (surface.scrollContainerSelector) issues.push(`${surface.id}: only internal policy may declare scrollContainerSelector`);
  if (surface.scrollPolicy === "locked" && !surface.lockedReason) issues.push(`${surface.id}: locked policy requires machine-readable justification`);
  if (surface.scrollPolicy !== "locked" && surface.lockedReason) issues.push(`${surface.id}: only locked policy may declare lockedReason`);
}
if (APP_ROUTE_QUERY_MANIFEST.every((route) => route.defaultScrollPolicy === "locked")) issues.push("Route registry still locks every route family");
if (APP_ROUTE_QUERY_MANIFEST.filter((route) => route.defaultScrollPolicy === "locked").map((route) => route.queryValue).join(",") !== "hanzi-v2-v1") issues.push("Only the fixed Hanzi V1 route family may default to locked");
const appRoute = readFileSync(resolve(ROOT, "src/app-route.ts"), "utf8");
const pageMode = readFileSync(resolve(ROOT, "src/page-mode.css"), "utf8");
const sliceApp = readFileSync(resolve(ROOT, "games/hanzi-radical-battle/complete/app/slice-app.ts"), "utf8");
if (!appRoute.includes("pageModeForSearch") || !appRoute.includes("playSurfaceForSearch")) issues.push("Page mode must resolve the most specific play surface search contract");
if (/APP_ROUTE_QUERY_MANIFEST\.map\([^)]*game-fullscreen/s.test(appRoute)) issues.push("Route registry must not hardcode every route to game-fullscreen");
if (!/body\.game-scrollable-page\s*\{[^}]*overflow-y:\s*auto/s.test(pageMode)) issues.push("game-scrollable must expose document vertical scrolling");
if (!/hmc-shell[^`]*tabindex=\\?"0\\?"[^`]*role=\\?"region\\?"/s.test(sliceApp)) issues.push("Internal Hanzi scroll owner must be keyboard focusable and named");
if (entries.some((entry) => entry.kind === "overflow-clip")) issues.push("Runtime overflow:clip requires an explicit interactive-content exception; none is currently authorized");

const report = {
  taskId: "GAME-CODEX-STABLE-NATURAL-USE-ENTRY-07",
  verdict: issues.length ? "FAIL" : "PASS",
  surfaceCount: PLAY_SURFACE_MANIFEST.length,
  policyCounts,
  routeDefaults: APP_ROUTE_QUERY_MANIFEST.map(({ query, defaultScrollPolicy }) => ({ query, defaultScrollPolicy })),
  riskCounts: Object.fromEntries(Object.keys(PATTERNS).map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])),
  issues,
  entries,
};

const output = option("--output");
if (output) {
  const destination = resolve(ROOT, output);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
  process.exitCode = 1;
} else process.stdout.write(`Scroll integrity contracts and risk inventory: PASS (${PLAY_SURFACE_MANIFEST.length} surfaces; document=${policyCounts.document}, internal=${policyCounts.internal}, locked=${policyCounts.locked}).\n`);
