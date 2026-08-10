import "./styles.css";
import { STEP07_MACHINE_REPORT_DATA as report } from "./report-data";

const GATES = [
  ["Compile / tests / build", report.hardGateStatus],
  ["Adult-tool scroll matrix", report.scrollMatrixStatus],
  ["Classic hub + catalog smoke", report.catalogSmokeStatus],
  ["Agent playthrough profiles", report.profileStatus],
  ["External network", report.externalNetworkPolicy],
] as const;

export function mountGameMachineReviewReport(root: HTMLElement): void {
  root.className = "machine-report-mount";
  root.innerHTML = `<main class="machine-report" data-testid="machine-review-report">
    <header><p class="machine-report-kicker">GAME-CODEX · STEP ${report.step}</p><h1>Machine-First Game Review</h1><p>这是只读滚动契约壳；权威结果只在身份绑定的 MACHINE-REVIEW-REPORT.html / JSON / VERDICT.json 中，没有家长 ACCEPT / REVISE 控件。</p></header>
    <section class="machine-report-grid" aria-label="机器审核摘要">
      <article class="machine-report-card"><h2>Report identity</h2><dl><dt>Shell state</dt><dd>${report.state}</dd><dt>Authoritative verdict</dt><dd data-machine-verdict>${report.verdict}</dd><dt>Commit identity</dt><dd>${report.finalCommit}</dd></dl></article>
      <article class="machine-report-card"><h2>Evidence policy</h2><p>${report.externalNetworkPolicy}</p><p>所有测试使用隔离 Playwright context；不读取或清理家庭 Chrome profile。</p></article>
    </section>
    <section class="machine-report-card"><h2>Hard gates</h2><table class="machine-report-table"><thead><tr><th>Gate</th><th>Status</th></tr></thead><tbody>${GATES.map(([gate, status]) => `<tr><td>${gate}</td><td>${status}</td></tr>`).join("")}</tbody></table></section>
    <section class="machine-report-card"><h2>Semantic reviewers</h2><p>R1_CHILD_FIRST_UX、R2_VISUAL_ACCESSIBILITY、R3_ADVERSARIAL_QA 分别读取共同原始证据；只在 merge 时合并 finding JSON。每条 finding 引用截图、ARIA、trace/event 或 route/state。</p></section>
    <section class="machine-report-card"><h2>Deep scope</h2><p>默认世界 fresh/repaired/spellbook/treasure/settings、多 viewport 与 reduced motion；四字 Golden Slice 的 camp、明/花、能力选择、林/星 Boss、修复、魔法书、完成、返回、静音、reduced motion 与损坏存档恢复；全部成人 review/observer/report。</p></section>
    <section class="machine-report-card"><h2>Catalog scope</h2><p>经典大厅与 gameCatalog 自动枚举的 10 个游戏仅做 enter、first-action、screenshot、console/page error、外部网络和 return smoke；未重做旧游戏。</p></section>
    <section class="machine-report-card machine-report-nonclaim"><h2>明确不作结论</h2><p>机器审核不能证明 child fun、长期投入、学习效果、家庭偏好或剩余八字准备度。真实 second-use 状态：${report.realSecondUse}。</p></section>
    <section class="machine-report-card"><h2>Report end</h2><p>这里是 Scroll Matrix 的最后可达、可聚焦动作。</p><button type="button" data-report-back-to-top data-final-action>返回报告顶部</button></section>
  </main>`;
  root.querySelector<HTMLElement>("[data-report-back-to-top]")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "auto" }));
}
