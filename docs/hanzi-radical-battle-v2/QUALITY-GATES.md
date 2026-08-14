# 当前质量门禁

日常修改只跑受影响的最小充分检查；发布、跨层或正式验收工作再跑完整集合。机器验收遵循 `.agents/skills/machine-first-game-review/SKILL.md`，失败时修根因并重跑受影响门禁，不以固定重试轮数停止。

## 当前命令

- `pnpm run test:hanzi-v2`：第一章与 V1 compatibility 的 unit/content/hand/save/privacy contracts
- `pnpm run simulate:hanzi-v2`：90,000 deterministic seeds、replay、coverage 与 impossible-state 检查
- `pnpm run test:e2e:hanzi-v2`：当前第一章功能与 18-run playthrough matrix
- `pnpm run test:e2e:hanzi-v2:v1`：V1 legacy route
- `pnpm run test:visual:hanzi-v2`：30 个 current visual/ARIA states，必须 no-update
- `pnpm run test:geometry:hanzi-v2`：critical controls、hit targets、overlap 与 overflow
- `pnpm run test:visual:hanzi-v2:v1`：V1 baseline compatibility
- `pnpm run validate:hanzi-v2`：unit + TypeScript + simulation
- `pnpm run test:launcher:hanzi-v2`：启动、复用与自有进程清理
- `pnpm run verify:pages:hanzi-v2`：Pages deep link、刷新、72 资产、V1 route、浏览器错误和外部请求
- `pnpm run build`、`pnpm test`：跨仓回归与生产构建

## 必须保护的 contract

- 36 字、3 英雄、3 区域 + 核心、18 可选 + 3 固有能力、9 行为、4 首领、8 修复、36 魔法书
- 结构位置、唯一解/手牌歧义与 deterministic replay
- V1→V2 migration、损坏存档恢复、较新存档只读保护
- 鼠标、键盘、触控；手机、平板、桌面；静音与 reduced motion
- hub/返回/launcher/Pages route；无资产 404、console/page error 或意外外部请求
- visual、ARIA 与 geometry baseline 两轮 no-update（正式发布/结构收口时）
- 无排行榜、连胜/FOMO、惩罚性损失、羞辱性失败或儿童网络追踪回归

测试输出只写入 `test-results/` 或 `tmp/`；baseline 更新必须由明确视觉变更授权，不能用来掩盖回归。
