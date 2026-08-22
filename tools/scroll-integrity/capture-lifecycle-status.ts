import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { ACTIVE_PROJECT_PHASE, NEXT_PROJECT_PHASE, PROJECT_LIFECYCLE_TERMINAL_TRUTH, PROJECT_PHASES } from "../../packages/data/projectLifecycle";

const ROOT = resolve(import.meta.dirname, "../..");
const output = resolve(ROOT, "tmp/tasks/GAME-CODEX-STABLE-NATURAL-USE-ENTRY-07/selected-screenshots/natural-use-generated-project-status.png");
const stableState = (PROJECT_LIFECYCLE_TERMINAL_TRUTH as { familyStableBaseline?: string }).familyStableBaseline ?? "PENDING";
mkdirSync(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Game-Codex Natural-Use Status</title><style>
    *{box-sizing:border-box}body{margin:0;padding:56px;color:#173b35;background:linear-gradient(145deg,#dff4ec,#f9f1d5);font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif}.sheet{max-width:1240px;margin:auto;padding:46px 52px;border:2px solid #417c69;border-radius:32px;background:#fffdf5;box-shadow:0 24px 70px #23483b25}p.kicker{margin:0;color:#8a5a23;font-weight:900;letter-spacing:.13em}h1{margin:8px 0 12px;font-size:50px;line-height:1.05}p.lead{margin:0 0 28px;font-size:21px}.badges{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:30px}.badge{padding:10px 16px;border-radius:999px;color:#fff;background:#356f5d;font-weight:900}.badge.gold{color:#3b2a10;background:#f0c85d}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:22px}.panel{padding:24px;border:1px solid #8bb5a7;border-radius:22px;background:#f5fbf7}.panel h2{margin:0 0 14px;font-size:24px}.phases{display:grid;gap:9px}.phase{display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:#e6f3ed}.phase.active{border:2px solid #b88622;background:#fff2c9}.rules{margin:0;padding-left:23px;font-size:18px;line-height:1.65}.footer{margin:24px 0 0;padding-top:18px;border-top:1px solid #b7cbc3;color:#48655c;font-size:16px}</style><main class="sheet"><p class="kicker">GAME-CODEX · GENERATED PROJECT STATUS</p><h1>Natural-Use 正式启用</h1><p class="lead">家庭稳定基线已冻结。默认状态是正常使用，不安排周期性 review、Observation 或大型开发。</p><div class="badges"><span class="badge gold">ACTIVE: ${ACTIVE_PROJECT_PHASE}</span><span class="badge">BASELINE: ${stableState}</span><span class="badge">NEXT AUTOMATIC PHASE: ${NEXT_PROJECT_PHASE === null ? "NONE" : NEXT_PROJECT_PHASE}</span><span class="badge">OBSERVATION: ${PROJECT_LIFECYCLE_TERMINAL_TRUTH.observationTooling}</span></div><section class="grid"><article class="panel"><h2>项目阶段真源</h2><div class="phases">${PROJECT_PHASES.map((phase) => `<div class="phase ${phase.status === "active" ? "active" : ""}"><strong>${phase.title}</strong><span>${phase.status.toUpperCase()}</span></div>`).join("")}</div></article><article class="panel"><h2>自然使用边界</h2><ul class="rules"><li>正常使用三个世界与 Classic。</li><li>技术 bug：可机器复现后立即小步修复。</li><li>UX / 内容重做：只随重复真实证据推进。</li><li>Observation 仅家长主动、本机、默认不记录。</li><li>不声称真人儿童乐趣、学习、保持或接受。</li></ul></article></section><p class="footer">${PROJECT_LIFECYCLE_TERMINAL_TRUTH.next}</p></main></html>`, { waitUntil: "load" });
  await page.screenshot({ path: output, animations: "disabled" });
  process.stdout.write(`${JSON.stringify({ verdict: "PASS", output })}\n`);
} finally {
  await browser.close();
}
