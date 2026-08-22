import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { PLAY_SURFACE_MANIFEST } from "../../packages/data/playSurfaceManifest";

type RiskType = "absolute-layer" | "fixed-layer" | "sticky-layer" | "z-index" | "overflow-clip" | "pointer-routing" | "transform" | "negative-margin" | "viewport-layer";

interface RiskEntry {
  readonly path: string;
  readonly selector: string;
  readonly line: number;
  readonly riskTypes: readonly RiskType[];
  readonly classification: "interactive" | "decorative" | "layout";
  readonly disposition: "POINTER_TRANSPARENT" | "BROWSER_HITTEST_REQUIRED" | "LAYOUT_CLIP_REVIEWED";
  readonly testedSurfaceIds: readonly string[];
}

const ROOT = resolve(import.meta.dirname, "../..");
const SCAN_ROOTS = ["apps", "games", "packages", "src"];

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  const result: string[] = [];
  for (const name of readdirSync(path)) {
    const child = resolve(path, name);
    if (statSync(child).isDirectory()) result.push(...filesUnder(child));
    else if (child.endsWith(".css")) result.push(child);
  }
  return result;
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function risks(body: string): RiskType[] {
  const result: RiskType[] = [];
  if (/position\s*:\s*absolute\b/i.test(body)) result.push("absolute-layer");
  if (/position\s*:\s*fixed\b/i.test(body)) result.push("fixed-layer");
  if (/position\s*:\s*sticky\b/i.test(body)) result.push("sticky-layer");
  if (/z-index\s*:/i.test(body)) result.push("z-index");
  if (/overflow(?:-x|-y)?\s*:\s*(?:hidden|clip)\b/i.test(body)) result.push("overflow-clip");
  if (/pointer-events\s*:/i.test(body)) result.push("pointer-routing");
  if (/transform\s*:/i.test(body)) result.push("transform");
  if (/margin(?:-\w+)?\s*:\s*-[\d.]/i.test(body)) result.push("negative-margin");
  if (/(?:width|height|min-height|max-height)\s*:\s*100v[wh]\b/i.test(body)) result.push("viewport-layer");
  return result;
}

function surfacesFor(path: string): string[] {
  const ids = (predicate: (productId: string) => boolean): string[] => PLAY_SURFACE_MANIFEST.filter((record) => predicate(record.productId)).map((record) => record.id);
  if (path.includes("english-spell-battle") || path.includes("memory-match")) return ids((id) => id === "english-spell-battle" || id === "memory-card");
  if (path.includes("math-lab") || path.includes("clock-reader") || path.includes("equation-slider")) return ids((id) => ["math-lab", "equation-slider"].includes(id));
  if (path.includes("hanzi-radical-battle") || path.includes("pinyin")) return ids((id) => id === "hanzi-radical-battle");
  if (path.startsWith("apps/") || path.startsWith("packages/") || path.startsWith("src/")) return PLAY_SURFACE_MANIFEST.map((record) => record.id);
  const game = /^games\/([^/]+)/.exec(path)?.[1];
  return game ? ids((id) => id === game) : PLAY_SURFACE_MANIFEST.map((record) => record.id);
}

function classify(selector: string, body: string): Pick<RiskEntry, "classification" | "disposition"> {
  const decorative = /::?(?:before|after)\b|\b(?:art|image|visual|glow|spark|ripple|shadow|backdrop)\b/i.test(selector);
  const interactive = /\bbutton\b|\ba\b|\binput\b|\bselect\b|\btextarea\b|\[role=|\[data-(?:action|word-id|card-id|theme-id)/i.test(selector);
  if (decorative && /pointer-events\s*:\s*none\b/i.test(body)) return { classification: "decorative", disposition: "POINTER_TRANSPARENT" };
  if (interactive || decorative) return { classification: interactive ? "interactive" : "decorative", disposition: "BROWSER_HITTEST_REQUIRED" };
  return { classification: "layout", disposition: /overflow(?:-x|-y)?\s*:\s*(?:hidden|clip)\b/i.test(body) ? "LAYOUT_CLIP_REVIEWED" : "BROWSER_HITTEST_REQUIRED" };
}

function inventory(): RiskEntry[] {
  const result: RiskEntry[] = [];
  const files = SCAN_ROOTS.flatMap((root) => filesUnder(resolve(ROOT, root))).sort();
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = block.exec(source))) {
      const riskTypes = risks(match[2]);
      if (!riskTypes.length) continue;
      const path = relative(ROOT, file).replaceAll("\\", "/");
      const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
      const classification = classify(selector, match[2]);
      result.push({ path, selector, line: lineAt(source, match.index), riskTypes, ...classification, testedSurfaceIds: surfacesFor(path) });
    }
  }
  return result;
}

function blockFor(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, "m").exec(source)?.[1] ?? "";
}

function exactBlockFor(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|}\\s*)${escaped}\\s*\\{([^}]*)\\}`, "m").exec(source)?.[1] ?? "";
}

function validateKnownContracts(entries: readonly RiskEntry[]): string[] {
  const issues: string[] = [];
  if (PLAY_SURFACE_MANIFEST.length !== 42) issues.push(`Expected 42 play surfaces, found ${PLAY_SURFACE_MANIFEST.length}`);
  if (entries.some((entry) => !entry.testedSurfaceIds.length)) issues.push("Every risk entry must map to at least one browser-tested surface");
  const cssPath = resolve(ROOT, "games/english-spell-battle/v2/world/styles.css");
  const css = readFileSync(cssPath, "utf8");
  const artImage = blockFor(css, ".wordlight-mission-list .wordlight-meaning__art img");
  const pointerTransparentArt = exactBlockFor(css, ".wordlight-meaning__art img");
  const media = blockFor(css, ".wordlight-mission-list .wordlight-meaning__art");
  const live = blockFor(css, ".wordlight-live");
  if (!/pointer-events\s*:\s*none\b/.test(pointerTransparentArt)) issues.push("English mission art images must be pointer-transparent");
  if (!["width", "height", "max-height"].every((name) => new RegExp(`${name}\\s*:\\s*100%`).test(artImage))) issues.push("English mission art images must stay within their media box");
  if (!/overflow\s*:\s*hidden\b/.test(media) || !/height\s*:\s*150px\b/.test(media)) issues.push("English mission media must use a fixed clipped box");
  if (!/pointer-events\s*:\s*none\b/.test(live)) issues.push("English live status must not intercept controls");
  for (const selector of [".wordlight-island::before", ".wordlight-island::after", ".wordlight-region::before", ".wordlight-shell::after", ".wordlight-response__ripple"]) {
    if (!/pointer-events\s*:\s*none\b/.test(blockFor(css, selector))) issues.push(`${selector} must be pointer-transparent`);
  }
  const mathCss = readFileSync(resolve(ROOT, "games/math-lab/world/styles.css"), "utf8");
  if (!/min-height\s*:\s*42px\b/.test(exactBlockFor(mathCss, ".math-world-card button"))) issues.push("Math World station buttons must remain near the 44px target at 42px or larger");
  if (/transform\s*:/.test(blockFor(mathCss, ".math-world-card button:hover"))) issues.push("Math World hover/focus feedback must not move the click target");
  const sharedCss = readFileSync(resolve(ROOT, "src/styles.css"), "utf8");
  if (!/min-height\s*:\s*42px\b/.test(exactBlockFor(sharedCss, ".learning-game__pill"))) issues.push("Shared learning-game pills must remain near the 44px target at 42px or larger");
  if (/transform\s*:/.test(exactBlockFor(sharedCss, ".ui-button:hover:not(:disabled)"))) issues.push("Shared button hover feedback must not move the click target");
  return issues;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const entries = inventory();
const issues = validateKnownContracts(entries);
const report = {
  verdict: issues.length ? "FAIL" : "PASS",
  scope: "all runtime CSS under apps/, games/, packages/, and src/",
  surfaceCount: PLAY_SURFACE_MANIFEST.length,
  cssRiskEntryCount: entries.length,
  byRiskType: Object.fromEntries((["absolute-layer", "fixed-layer", "sticky-layer", "z-index", "overflow-clip", "pointer-routing", "transform", "negative-margin", "viewport-layer"] as const).map((risk) => [risk, entries.filter((entry) => entry.riskTypes.includes(risk)).length])),
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
} else {
  process.stdout.write(`Interaction integrity inventory and known blocker contracts: PASS (${PLAY_SURFACE_MANIFEST.length} surfaces, ${entries.length} CSS risk entries).\n`);
}
