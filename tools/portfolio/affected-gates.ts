import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

export interface GateCommand { readonly program: string; readonly args: readonly string[]; readonly label: string }

const PORTFOLIO_CHECK: GateCommand = { program: "pnpm", args: ["run", "portfolio:check"], label: "portfolio consistency" };
const UNIT: GateCommand = { program: "pnpm", args: ["test"], label: "unit and content tests" };
const TYPECHECK: GateCommand = { program: "pnpm", args: ["exec", "tsc", "--noEmit"], label: "typecheck" };
const BUILD: GateCommand = { program: "pnpm", args: ["build"], label: "production build" };
const SMOKE: GateCommand = { program: "pnpm", args: ["run", "test:portfolio:smoke"], label: "all-game portfolio smoke" };
const INTERACTION_STATIC: GateCommand = { program: "pnpm", args: ["run", "validate:interaction-integrity"], label: "UI occlusion inventory and interaction-integrity contracts" };
const INTERACTION_HITTEST: GateCommand = { program: "pnpm", args: ["run", "test:e2e:hittest:representative"], label: "representative 42-surface browser hit-test matrix" };
const SCROLL_STATIC: GateCommand = { program: "pnpm", args: ["run", "validate:scroll-integrity"], label: "play-surface scroll ownership contracts" };
const SCROLL_REACHABILITY: GateCommand = { program: "pnpm", args: ["run", "test:e2e:scroll-reachability:representative"], label: "representative scroll and bottom reachability matrix" };
const ENGLISH_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:english-v2"], label: "English World routes, interactions, and geometry" };
const MATH_WORLD_UNIT: GateCommand = { program: "pnpm", args: ["run", "test:math-world"], label: "Math World model, content, and save gates" };
const MATH_WORLD_VALIDATE: GateCommand = { program: "pnpm", args: ["run", "validate:math-world"], label: "Math World portfolio and replacement contract" };
const MATH_WORLD_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:math-world"], label: "Math World routes, interactions, and lifecycle" };
const CHINESE_SUPPORT_VALIDATE: GateCommand = { program: "pnpm", args: ["run", "validate:chinese-support"], label: "canonical Pinyin, source audit, and memory relation contracts" };
const CHINESE_SUPPORT_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:chinese-support"], label: "Chinese support routes, inputs, saves, and fallbacks" };

function gameSmoke(id: string): GateCommand {
  return { program: "pnpm", args: ["run", "test:portfolio:smoke", "--", "--grep", `@game:${id}`], label: `${id} entry/interaction/return smoke` };
}

function unique(commands: readonly GateCommand[]): GateCommand[] {
  const seen = new Set<string>();
  return commands.filter((command) => { const key = `${command.program}\0${command.args.join("\0")}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function affectedGateCommands(changedFiles: readonly string[]): GateCommand[] {
  const files = changedFiles.map((file) => file.replaceAll("\\", "/").replace(/^\.\//, ""));
  if (!files.length) return [PORTFOLIO_CHECK];
  const full = files.some((file) => /^(src\/main\.ts|src\/app-route\.ts|package\.json|pnpm-lock\.yaml|tsconfig\.json|vite\.config\.ts|vitest\.config\.ts|playwright.*\.config\.ts)$/.test(file)
    || file.startsWith("packages/game-core/") || file.startsWith("apps/my-game-world/") || file === "<unknown>");
  if (full) return [PORTFOLIO_CHECK, INTERACTION_STATIC, SCROLL_STATIC, UNIT, MATH_WORLD_VALIDATE, CHINESE_SUPPORT_VALIDATE, TYPECHECK, BUILD, MATH_WORLD_E2E, CHINESE_SUPPORT_E2E, ENGLISH_E2E, INTERACTION_HITTEST, SCROLL_REACHABILITY, SMOKE];
  const commands: GateCommand[] = [PORTFOLIO_CHECK];
  for (const file of files) {
    const game = /^games\/([^/]+)\//.exec(file)?.[1];
    if (/^(?:apps|games|packages|src)\/.+\.css$/.test(file)) commands.push(INTERACTION_STATIC, SCROLL_STATIC, INTERACTION_HITTEST, SCROLL_REACHABILITY);
    if (file.startsWith("packages/activity-engines/memory-match/") || file.includes("support/pinyin/")) commands.push(CHINESE_SUPPORT_VALIDATE, CHINESE_SUPPORT_E2E, SMOKE);
    else if (game === "english-spell-battle") commands.push(INTERACTION_STATIC, SCROLL_STATIC, ENGLISH_E2E, INTERACTION_HITTEST, SCROLL_REACHABILITY, SMOKE);
    else if (game && ["math-lab", "clock-reader", "multiplication-adventure", "make-target"].includes(game)) commands.push(MATH_WORLD_UNIT, MATH_WORLD_VALIDATE, MATH_WORLD_E2E);
    else if (game === "pinyin-magic-battle") commands.push(CHINESE_SUPPORT_VALIDATE, CHINESE_SUPPORT_E2E, SMOKE);
    else if (game === "memory-card") commands.push(CHINESE_SUPPORT_VALIDATE, CHINESE_SUPPORT_E2E, gameSmoke(game));
    else if (game) commands.push(UNIT, gameSmoke(game));
    else if (file.startsWith("apps/hub/") || file.startsWith("packages/ui/") || file.startsWith("packages/data/") || file.startsWith("public/assets/")) commands.push(INTERACTION_STATIC, SCROLL_STATIC, UNIT, MATH_WORLD_VALIDATE, INTERACTION_HITTEST, SCROLL_REACHABILITY, SMOKE);
    else if (!file.startsWith("docs/") && file !== "README.md" && file !== "AGENTS.md") commands.push(UNIT, TYPECHECK, BUILD, SMOKE);
  }
  return unique(commands);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function discoverChangedFiles(): string[] {
  const explicit = option("--changed-files");
  if (explicit) return explicit.split(",").map((file) => file.trim()).filter(Boolean);
  const base = option("--base") ?? "origin/main";
  const head = option("--head") ?? "HEAD";
  try {
    const committed = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    if (head !== "HEAD") return committed;
    const working = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    return [...new Set([...committed, ...working, ...untracked])];
  } catch {
    return ["<unknown>"];
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const changedFiles = discoverChangedFiles();
  const commands = affectedGateCommands(changedFiles);
  process.stdout.write(`${JSON.stringify({ changedFiles, commands }, null, 2)}\n`);
  if (process.argv.includes("--run")) {
    for (const command of commands) {
      const result = spawnSync(command.program, command.args, { cwd: resolve(import.meta.dirname, "../.."), shell: process.platform === "win32", stdio: "inherit" });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
