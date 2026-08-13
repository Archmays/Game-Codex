import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { HANZI_MAGIC_V1_ROUTE, INK_FOREST_ROUTE } from "../apps/my-game-world/world-routes";

interface NorthStar {
  schema_version: number;
  initiative_id: string;
  initiative_name: string;
  current_version: string;
  active_authorization_id: string;
  target_player: {
    name: string;
    stage: string;
    experience_goal: string;
  };
  north_star: string;
  core_learning_mechanic: string;
  runtime_lock: {
    engine: string;
    language: string;
    build: string;
    text_heavy_ui: string;
    persistence: string;
    distribution: string;
  };
  golden_slice: {
    duration_minutes_min: number;
    duration_minutes_max: number;
    playable_characters_max: number;
    persistent_spellbook: boolean;
  };
  v1_release_scope: {
    playable_characters: number;
    adventures: number;
    encounters: number;
    ability_options: number;
    camp_repairs: number;
    runtime_assets: number;
    machine_playthroughs: number;
    real_child_validation: string;
  };
  required_experience: string[];
  prohibited_mechanics: string[];
  non_goals: string[];
  promotion_gates: string[];
  drift_alerts: string[];
  status: string;
}

interface PackageJson {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const root = resolve(import.meta.dirname, "..");
const docsDir = join(root, "docs", "hanzi-radical-battle-v2");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

function findNamedFile(directory: string, target: string): string[] {
  const ignored = new Set([".git", "node_modules", "dist", "tmp", "artifacts", "coverage", "test-results", "playwright-report"]);
  const matches: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findNamedFile(path, target));
    } else if (basename(path).toLowerCase() === target.toLowerCase()) {
      matches.push(path);
    }
  }

  return matches;
}

describe("Hanzi Radical Battle V2 foundation guardrail", () => {
  const northStarPath = join(docsDir, "00-NORTH-STAR.json");
  const northStar = readJson<NorthStar>(northStarPath);
  const packageJson = readJson<PackageJson>(join(root, "package.json"));

  it("keeps the machine-readable north star parseable and complete", () => {
    expect(northStar.schema_version).toBe(1);
    expect(northStar.initiative_id).toBe("hanzi-radical-battle-v2");
    expect(northStar.initiative_name).toContain("墨迹森林");
    expect(northStar.target_player.name).toBe("黄小越");
    expect(northStar.target_player.experience_goal).toBeTruthy();
    expect(northStar.north_star).toBeTruthy();
    expect(northStar.core_learning_mechanic).toContain("动作本身就是施法");
    expect(northStar.required_experience.length).toBeGreaterThan(0);
    expect(northStar.promotion_gates.length).toBeGreaterThan(0);
    expect(northStar.current_version).toBe("V1.0.0");
    expect(northStar.active_authorization_id).toBe("HUMAN_AUTHORIZED_SKIP_REAL_SECOND_USE_AND_COMPLETE_V1_ONE_SHOT_01");
    expect(northStar.v1_release_scope).toEqual({
      playable_characters: 12,
      adventures: 3,
      encounters: 12,
      ability_options: 3,
      camp_repairs: 3,
      runtime_assets: 24,
      machine_playthroughs: 8,
      real_child_validation: "NO_BY_USER_DIRECTION",
    });
    expect(northStar.status).toBe("V1_MACHINE_RELEASE_CANDIDATE_COMPLETE");
  });

  it("locks the approved browser runtime", () => {
    expect(northStar.runtime_lock).toEqual({
      engine: "Phaser 3",
      language: "TypeScript",
      build: "Vite",
      text_heavy_ui: "DOM overlay",
      persistence: "localStorage",
      distribution: "GitHub Pages"
    });
  });

  it("keeps the golden slice small", () => {
    expect(northStar.golden_slice.playable_characters_max).toBeLessThanOrEqual(12);
    expect(northStar.golden_slice.duration_minutes_min).toBeGreaterThanOrEqual(3);
    expect(northStar.golden_slice.duration_minutes_max).toBeLessThanOrEqual(5);
    expect(northStar.golden_slice.persistent_spellbook).toBe(true);
  });

  it("contains the required prohibited mechanics", () => {
    const required = [
      "daily login reward",
      "streak pressure",
      "leaderboard",
      "loot box",
      "FOMO timer",
      "shaming failure language"
    ];

    expect(northStar.prohibited_mechanics).toEqual(expect.arrayContaining(required));
  });

  it("contains the required non-goals", () => {
    const joined = northStar.non_goals.join("\n");
    expect(joined).toContain("完整开放世界");
    expect(joined).toContain("同时重做其余游戏");
    expect(joined).toContain("超过固定12字");
    expect(joined).toContain("机器审核写成真人儿童验证");
  });

  it("authorizes only the fixed V1 boundary and preserves negative drift gates", () => {
    expect(northStar.promotion_gates).toContain("精确V1授权ID匹配");
    const drift = northStar.drift_alerts.join("\n");
    expect(drift).toContain("没有精确V1授权ID");
    expect(drift).toContain("超过12个汉字");
    expect(northStar.prohibited_mechanics).toEqual(expect.arrayContaining(["backend account", "loot box", "FOMO timer"]));
  });

  it("keeps the historical observer route separate from ordinary V1 family play", () => {
    expect(INK_FOREST_ROUTE).toBe("?play=hanzi-v2-golden-slice&mode=play&from=world");
    expect(HANZI_MAGIC_V1_ROUTE).toBe("?play=hanzi-v2-v1&from=world");
  });

  it("keeps both project Skills and the single index available", () => {
    expect(existsSync(join(root, ".agents", "skills", "child-first-learning-game", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".agents", "skills", "hanzi-structure-quality", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".agents", "skills", "SKILL_INDEX.md"))).toBe(true);
    expect(existsSync(join(root, "skill", "SKILL_INDEX.md"))).toBe(false);
  });

  it("resolves every canonical Skill path in the index", () => {
    const index = read(join(root, ".agents", "skills", "SKILL_INDEX.md"));
    const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
    const listedPaths = [...index.matchAll(/`([^`]+\/SKILL\.md)`/g)].map((match) => match[1]);
    const canonicalPaths = [...new Set(listedPaths)];

    expect(canonicalPaths.length).toBeGreaterThanOrEqual(13);
    for (const listedPath of canonicalPaths) {
      const resolvedPath = listedPath.startsWith("$CODEX_HOME/")
        ? join(codexHome, listedPath.slice("$CODEX_HOME/".length))
        : resolve(root, listedPath);
      expect(existsSync(resolvedPath), listedPath).toBe(true);
    }
  });

  it("lists every required golden-slice feature in the traceability matrix", () => {
    const matrix = read(join(docsDir, "03-TRACEABILITY-MATRIX.md"));
    const requiredFeatures = [
      "游戏世界首页",
      "字灵营地",
      "墨点精灵",
      "五张手牌",
      "结构槽位",
      "合字动画",
      "字义魔法",
      "三选一",
      "小首领",
      "营地修复",
      "魔法书",
      "安全失败",
      "本地存档",
      "减少动画"
    ];

    for (const feature of requiredFeatures) {
      expect(matrix, feature).toContain(`| ${feature} |`);
    }
  });

  it("does not introduce Godot project files or backend/cloud-tracking dependencies", () => {
    expect(findNamedFile(root, "project.godot")).toEqual([]);

    const dependencyNames = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    });
    const prohibitedDependency = /godot|firebase|supabase|express|fastify|(^|\/)koa($|\/)|nestjs|hapi|prisma|mongodb/i;

    expect(dependencyNames.filter((name) => prohibitedDependency.test(name))).toEqual([]);
  });

  it("keeps Phaser on the established major version", () => {
    const phaserRange = packageJson.dependencies?.phaser;
    expect(phaserRange).toBeTruthy();
    expect(phaserRange?.match(/\d+/)?.[0]).toBe("3");
  });

  it("keeps AGENTS and package scripts wired to the real guardrail", () => {
    const agents = read(join(root, "AGENTS.md"));
    expect(agents).toContain(".agents/skills/SKILL_INDEX.md");
    expect(agents).not.toContain("`skill/SKILL_INDEX.md`");
    expect(agents).toContain("## Hanzi Radical Battle V2 guardrail");
    expect(packageJson.scripts["validate:hanzi-v2-foundation"]).toBe(
      "vitest run tests/hanzi-radical-battle-v2-foundation.test.ts"
    );
  });

  it("records pinned external Skill identities and licenses", () => {
    const audit = read(join(docsDir, "01-REFERENCE-AND-SKILL-AUDIT.md"));
    expect(audit).toContain("11c74d6ba24d3a6d48f54a194cd00ef3beea18f9");
    expect(audit).toContain("2bea8297d9f09d90d6720c0334221417f7c9a928");
    expect(audit).toContain("MIT");
    expect(audit).toContain("Apache-2.0");
  });
});
