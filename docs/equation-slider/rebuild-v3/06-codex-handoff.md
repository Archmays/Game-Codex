# 算式滑轨重构 V3｜Codex 交接

## 基线

- 仓库：`Archmays/family-learning-games`
- 分支：`main`
- WEB 审计前基线：`4d151d78e5d9d910db0beb280031a4becff16a16`
- 本文档基线：**包含本文件及同目录 01–05 的 `main` 提交**。
- 外部交付给 Codex 的完整命令会写明该提交的准确 SHA。Codex 必须 `git fetch` 后验证该 SHA 已包含在 `origin/main`，不得从旧的 `06ec5eeae7a66496c985926e739f86324d3883b8` 直接开始。

## WEB 阶段已经完成

- 核验仓库、当前 main 和功能提交关系；
- 审查教程、pointer preview、reel renderer、首关数据、测试架构；
- 确认 P0 源码根因；
- 建立交互合同；
- 建立 4×50 关质量合同；
- 建立测试/验收矩阵；
- 将 README 状态降级为“修复中”。

WEB 阶段没有：

- 运行 Vite；
- 修改 TypeScript/CSS/JSON；
- 安装 Playwright；
- 生成新关卡；
- 声称缺陷已经修复。

## 必读顺序

1. 根 `AGENTS.md`
2. 本地实际可用的全局/项目 skill 索引
3. `01-current-state-audit.md`
4. `02-source-root-cause-audit.md`
5. `03-interaction-contract.md`
6. `04-level-quality-contract.md`
7. `05-test-and-acceptance-matrix.md`
8. 当前 `games/equation-slider/**`
9. 当前 `tests/equation-slider-*.test.ts`
10. Pages workflow、Vite、Vitest、package scripts

## 职责

本地 Codex 负责所有必须运行环境的工作：

1. 同步 main；
2. 复现旧缺陷；
3. 保存 before 截图和 DOM 证据；
4. 写旧版失败的 E2E；
5. 重构 schema/state/render/pointer；
6. 重做真实教程；
7. 先完成首关；
8. 完成 40 个 gold levels；
9. 重建并补足 200+；
10. 重构响应式 UI；
11. 浏览器真实试玩至少 25 关；
12. 完整测试、build、Pages；
13. 提交/push 到 main；
14. 清理临时文件；
15. 明确真人儿童验证尚未发生。

## 执行顺序

```text
SYNC
  ↓
OLD BASELINE PLAYTEST
  ↓
FAILING E2E
  ↓
ROOT-CAUSE CONFIRMATION
  ↓
SCHEMA + STATE + RENDER
  ↓
FIRST TUTORIAL GOLD LEVEL
  ↓
GATE A
  ↓
40 GOLD LEVELS
  ↓
GATE B
  ↓
200+ LEVEL REBUILD
  ↓
GATE C
  ↓
25-LEVEL AGENT PLAYTEST
  ↓
FULL TEST / BUILD / PAGES
  ↓
GATE D
  ↓
COMMIT / PUSH / CLEANUP
```

任一 Gate 失败不得越过。

## 首批必须修改的运行时事实

在正式修复开始时：

- 将 `equationSliderGame.status` 从“200 关可玩”改为“修复中”；
- 保持该状态，直到 Gate D 全部通过；
- 不允许只恢复 README 的“可玩”而运行时仍未验证。

## 受影响范围

优先限制在：

```text
games/equation-slider/**
tests/equation-slider-*.test.ts
package.json
pnpm-lock.yaml
playwright.config.*
.github/workflows/*（仅在确有必要时）
README.md
docs/equation-slider/**
docs/screenshots/equation-slider/**
```

共享包只有在存在真正可复用需求时修改。不得借机迁移或重构其他游戏。

## 必须保留

- 安全 evaluator 原则；
- solver fail-closed；
- 4 章 × 每章至少 50；
- 本地、无账号、无广告、无支付；
- GitHub Pages 相对路径；
- localStorage 隐私边界；
- main 唯一真源。

## 允许推翻

- 现有 2-tile reel schema；
- 现有首关；
- 当前 200 关 JSON；
- 当前 generator 1.2.0；
- 当前 tutorial modal；
- 当前 board 信息层级；
- 当前“结构唯一即质量合格”的审计阈值。

不要为了保留已有投入而保留错误设计。

## Git 规则

- 单一 `main`；
- 不创建 branch、worktree 或 PR；
- 不 hard reset 未知改动；
- 增量测试；
- 最终 full gate 原则上一次；
- 失败后只重跑失败项及依赖；
- 合法改动全部提交、push；
- 本地/main/origin 一致；
- 工作区 clean；
- 不删除来源不明分支；
- 清理 scratch、trace、缓存；
- 保留 QA 报告、正式截图、manifest 和 audit。

## 最终报告最低字段

```md
Status:
Repository:
Branch:
WEB handoff baseline:
HEAD before:
HEAD after:
origin/main:
Commit:
Pages:

Root causes:
- tutorial:
- 3×9:
- repeated 2-tile projection:
- content:

Gate A:
Gate B:
Gate C:
Gate D:

Levels:
- chapters:
- per chapter:
- total:
- gold:
- solver:
- exact duplicates:
- near duplicates:
- zero distribution:
- movable/fixed operators:

Interaction:
- mouse:
- touch:
- tile click:
- arrow buttons:
- keyboard:
- pointercancel:
- 100-move DOM stability:
- unique tile IDs:

Agent playtest:
- levels:
- drag:
- click:
- keyboard:
- wrong-path recovery:
- hint depth:
- findings:

Tests:
- targeted:
- pnpm test:
- pnpm test:e2e:
- pnpm build:

Child validation: NOT YET PERFORMED / actual user-supplied result
Known limitations:
Persistent evidence:
Temporary files removed:
Skill audit:
```
