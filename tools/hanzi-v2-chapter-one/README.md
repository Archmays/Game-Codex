# 汉字魔法战 V2 当前工具

- 双击 `START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd` 打开 `?play=hanzi-v2-chapter-one&from=hub`。脚本只复用身份匹配的本仓库 Vite 进程；端口冲突时使用 5186–5195 内的空闲端口。
- `STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd` 只关闭 PID、启动时间、仓库、命令与端口均匹配的自有进程。
- `test-launcher-lifecycle.ps1` 验证启动、精确复用与停止；`verify-pages.ts` 验证 Pages、72 个第一章资产、V1 兼容入口和零外部请求。
- `scan-m5-release.ts` 运行 90,000-seed 模拟；`source-identity.ts` 计算排除生成目录后的当前源树 SHA-256。

临时输出位于 `tmp/` 或 `test-results/`，可安全重建，不含儿童身份资料。
