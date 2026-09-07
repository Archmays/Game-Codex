import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

export interface GateCommand { readonly program: string; readonly args: readonly string[]; readonly label: string }

const PORTFOLIO_CHECK: GateCommand = { program: "pnpm", args: ["run", "portfolio:check"], label: "portfolio consistency" };
const PORTFOLIO_EVOLUTION_CHECK: GateCommand = { program: "pnpm", args: ["run", "portfolio:evolution:check"], label: "Portfolio Evolution evidence and generated audit" };
const EQUATION_LEVELS: GateCommand = { program: "pnpm", args: ["run", "levels:check"], label: "Equation Slider deterministic 200-level audit" };
const EQUATION_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:equation-slider"], label: "Equation Slider core browser profile" };
const EQUATION_RELEASE: GateCommand = { program: "pnpm", args: ["run", "test:e2e:equation-slider:release"], label: "Equation Slider S release browser profile" };
const EQUATION_VISUAL: GateCommand = { program: "pnpm", args: ["run", "test:e2e:equation-slider:visual"], label: "Equation Slider visual and geometry profile" };
const EQUATION_PLAYTEST: GateCommand = { program: "pnpm", args: ["run", "test:e2e:equation-slider:playtest"], label: "Equation Slider bounded agent playtest" };
const UNIT: GateCommand = { program: "pnpm", args: ["test"], label: "unit and content tests" };
const TYPECHECK: GateCommand = { program: "pnpm", args: ["exec", "tsc", "--noEmit"], label: "typecheck" };
const BUILD: GateCommand = { program: "pnpm", args: ["build"], label: "production build" };
const SMOKE: GateCommand = { program: "pnpm", args: ["run", "test:portfolio:smoke"], label: "all-game portfolio smoke" };
const INTERACTION_STATIC: GateCommand = { program: "pnpm", args: ["run", "validate:interaction-integrity"], label: "UI occlusion inventory and interaction-integrity contracts" };
const INTERACTION_HITTEST: GateCommand = { program: "pnpm", args: ["run", "test:e2e:hittest:representative"], label: "representative play-surface browser hit-test matrix" };
const SCROLL_STATIC: GateCommand = { program: "pnpm", args: ["run", "validate:scroll-integrity"], label: "play-surface scroll ownership contracts" };
const SCROLL_REACHABILITY: GateCommand = { program: "pnpm", args: ["run", "test:e2e:scroll-reachability:representative"], label: "representative scroll and bottom reachability matrix" };
const MATH_WORLD_UNIT: GateCommand = { program: "pnpm", args: ["run", "test:math-world"], label: "Math World model, content, and save gates" };
const MATH_WORLD_VALIDATE: GateCommand = { program: "pnpm", args: ["run", "validate:math-world"], label: "Math World portfolio and replacement contract" };
const MATH_WORLD_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:math-world"], label: "Math World routes, interactions, and lifecycle" };

const DEFENSE: GateCommand = { program: "pnpm", args: ["run", "validate:hanzi-tower-defense"], label: "Hanzi tower defense deterministic balance" };
const DEFENSE_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:hanzi-tower-defense"], label: "Hanzi tower defense full browser battle" };
const ADVENTURE: GateCommand = { program: "pnpm", args: ["run", "validate:hanzi-word-adventure"], label: "Word adventure bounded state search and replay" };
const ADVENTURE_E2E: GateCommand = { program: "pnpm", args: ["run", "test:e2e:hanzi-word-adventure"], label: "Word adventure five-room keyboard and touch play" };
const MEMORY: GateCommand = { program: "pnpm", args: ["run", "test:memory-match"], label: "Independent memory-match content and save contracts" };
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
  const equationAffected = files.some((file) => file.startsWith("games/equation-slider/") || file.startsWith("tests/equation-slider-") || file.startsWith("tests/e2e/equation-slider"));
  const equationCommands = equationAffected ? [EQUATION_LEVELS, EQUATION_E2E, EQUATION_RELEASE, EQUATION_VISUAL, EQUATION_PLAYTEST] : [];
  const hanziCommands = files.some(file => file.includes("hanzi-tower-defense")) ? [DEFENSE, DEFENSE_E2E] : [];
  if (full) return unique([PORTFOLIO_CHECK, PORTFOLIO_EVOLUTION_CHECK, ...equationCommands, ...hanziCommands, INTERACTION_STATIC, SCROLL_STATIC, UNIT, MATH_WORLD_VALIDATE, MEMORY, TYPECHECK, BUILD, MATH_WORLD_E2E, DEFENSE_E2E, ADVENTURE, ADVENTURE_E2E, INTERACTION_HITTEST, SCROLL_REACHABILITY, SMOKE]);
  const commands: GateCommand[] = [PORTFOLIO_CHECK, PORTFOLIO_EVOLUTION_CHECK];
  for (const file of files) {
    const game = /^games\/([^/]+)\//.exec(file)?.[1];
    if (/^(?:apps|games|packages|src)\/.+\.css$/.test(file)) commands.push(INTERACTION_STATIC, SCROLL_STATIC, INTERACTION_HITTEST, SCROLL_REACHABILITY);
    if (file.startsWith("packages/activity-engines/memory-match/")) commands.push(MEMORY, SMOKE);
    else if (game && ["math-lab", "clock-reader", "multiplication-adventure", "make-target"].includes(game)) commands.push(MATH_WORLD_UNIT, MATH_WORLD_VALIDATE, MATH_WORLD_E2E);
    else if (game === "memory-card") commands.push(MEMORY);
    else if (game === "equation-slider") commands.push(UNIT, ...equationCommands, gameSmoke(game));
    else if (game === "hanzi-word-adventure") commands.push(UNIT, ADVENTURE, ADVENTURE_E2E, gameSmoke(game));
    else if (game) commands.push(UNIT, gameSmoke(game));
    else if (file.startsWith("apps/hub/") || file.startsWith("packages/ui/") || file.startsWith("packages/data/") || file.startsWith("public/assets/")) commands.push(INTERACTION_STATIC, SCROLL_STATIC, UNIT, MATH_WORLD_VALIDATE, INTERACTION_HITTEST, SCROLL_REACHABILITY, SMOKE);
    else if (!file.startsWith("docs/") && file !== "README.md" && file !== "AGENTS.md") commands.push(UNIT, TYPECHECK, BUILD, SMOKE);
  }
  commands.push(...hanziCommands);
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
