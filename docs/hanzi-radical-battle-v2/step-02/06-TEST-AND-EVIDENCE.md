# STEP 02 测试与证据清单

## 结果状态

2026-08-09 已按下表完成最终复跑。这里的 PASS 只表示技术检查通过，不代表家长或儿童验收。

## 自动检查

| 检查 | 命令 | 覆盖内容 | 当前结果 |
| --- | --- | --- | --- |
| V2 foundation | `pnpm run validate:hanzi-v2-foundation` | 北极星、Skill 路径、运行时锁、禁用依赖、基础范围 | PASS：1 文件、12 项 |
| 结构状态机 | `tests/hanzi-radical-battle-v2-step02-structure.test.ts` | 合法 phase、真实槽位、无效重试、第二次提示、成字事件顺序 | PASS：6 项 |
| 候选内容 | `tests/hanzi-radical-battle-v2-step02-content.test.ts` | 15 个 traceable provisional 候选、`明=日+月` 母库关联、五牌唯一组合、完整 revision hash、依赖失效、A/B/C、七格故事板 | PASS：5 项 |
| 本地存档 | `tests/hanzi-radical-battle-v2-step02-save.test.ts` | versioned key、精确字段、损坏回退、仅清除 Pilot key | PASS：4 项 |
| 文案与边界 | `tests/hanzi-radical-battle-v2-step02-copy.test.ts` | V1/V2 禁用羞辱语、温和恢复语、无排名/付费/FOMO 等压力词 | PASS：3 项 |
| FINISH 身份闸门 | `tests/hanzi-radical-battle-v2-step02-review.test.ts` | 当前导出 fixture 可打包；伪造 Pilot ID、候选 ID/hash、故事板 hash 必须判为无效 | PASS：1 项 |
| STEP 02 定向测试 | `pnpm run test:hanzi-v2:step02` | 上述五个 STEP 02 测试文件 | PASS：5 文件、19 项 |
| foundation + 定向 | `pnpm run validate:hanzi-v2:step02` | foundation 后再跑五项定向测试 | PASS：12 + 19 项 |
| E2E | `pnpm run test:e2e:hanzi-v2:step02` | review query、两步进入、五牌/槽位、重试、修灯存档、6 tab、导出、设置、默认大厅十个入口 | PASS：Chromium、5 项 |
| 全量单元测试 | `pnpm test` | 仓库现有 Vitest 集合 | PASS：28 文件、227 项 |
| 构建 | `pnpm build` | TypeScript 与 Vite production build | PASS：140 modules；保留 Vite 的非阻断 chunk-size warning |

脚本实跑：`START_STEP_02_REVIEW.ps1 -NoBrowser` 在固定 `127.0.0.1:5173` 启动并记录匹配 PID；当前 identity 的完整 fixture 经 FINISH 判为 `VALID`、生成 zip 并只停止该记录进程；当前 identity 的不完整 fixture 被明确列出 25 项决定缺失并仍按约定保留打包。伪造 anchor、候选 ID/hash 与故事板 hash 的完整 fixture 被身份闸门判为 `INVALID_OR_INCOMPLETE`。

## 浏览器人工核验门槛

已在真实 Chromium 中逐项检查：

- 默认 `/` 仍显示 10 个大厅游戏；进入一个既有游戏后可返回大厅。
- 只有 `?review=hanzi-v2-step02` 打开审核页，默认大厅没有 V2 新入口。
- 主 Pilot 两个主动作后进入五牌；点击和拖放都能把部件放进槽位；手机不要求精确拖动。
- 错位时不扣进度，第二次错位只高亮相关槽位；最终按“日左、月右”形成 `明`。
- 完整字、`míng`、`明亮`、法术、迷墨变化、营地灯和字灵书按可见顺序出现；刷新后灯仍亮、字仍在。
- 静音与减少动态不删除结构信息；A/B/C 只改变方向性视觉，不改规则。
- 审核页有六个 tab，15 个候选、3 个方向、7 格故事板、缺项统计和固定 JSON 导出可见。
- Browser console 无错误；Network 中没有非本地的 telemetry、账号、广告或分析请求。

这些浏览器检查仍只构成技术/呈现证据，不是家长或儿童验收。

## 截图证据清单

以下 10 张最终代表性 WebP 已生成并保留；原始 PNG 和捕获报告仅放入 `artifacts/hanzi-radical-battle-v2/step-02/raw-screenshots/`。捕获报告记录 `consoleErrors=[]`、`pageErrors=[]`、`remoteRequests=[]`。

```text
01-camp-before-desktop.webp
02-first-hand-mobile.webp
03-invalid-feedback-tablet.webp
04-character-forming-desktop.webp
05-spell-impact-desktop.webp
06-camp-repaired-mobile.webp
07-spellbook-tablet.webp
08-theme-comparison.webp
09-reduced-motion.webp
10-review-candidate-card.webp
```

每张截图记录对应 URL、viewport、场景/phase、主题、减少动态状态和生成时间。截图不是儿童兴趣或学习证据。

## 最终人工边界

技术复跑完成后，仍必须单独确认：

- 家长逐项决定 15 个候选字的结构、拼音、词义、熟悉度、适龄性与图像语义；候选不能因测试通过自动进入 manifest。
- 家长审核核心 Pilot、A/B/C 与七格故事板，并在固定 JSON 中留下完整决定。
- 真正儿童试玩只在另一次明确授权、相应技术证据齐备后，按项目 playtest gate 观察；本 STEP 02 文档不宣称、也不启动它。

当前技术状态仍为 `CORE_SPELL_PILOT_READY_FOR_PARENT_REVIEW`；STEP 03 未授权。
