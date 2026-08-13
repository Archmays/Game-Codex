# 汉字魔法战 V2.0.0 第一章启动器

双击 `START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`。启动器会复用自己记录且身份匹配的 Game-Codex 服务；若首选端口被其他程序占用，会在 5186–5195 中选择空闲端口，不会结束那个程序。浏览器打开的固定入口是 `?play=hanzi-v2-chapter-one&from=hub`。

玩完后回到启动窗口按 Enter。它只会核对并关闭本次启动的进程。若窗口被意外中断，可双击 `STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`；停止脚本在 PID、启动时间、仓库根目录、Vite 命令和监听端口全部匹配前不会结束进程。

启动失败时查看仓库内 `tmp/hanzi-v2-chapter-one/` 的标准输出与错误日志。该目录可安全重建，不包含儿童资料。

机器维护命令：`test-launcher-lifecycle.ps1` 验证启动、精确复用和自有进程清理；`verify-pages.ts` 在发布后验证 canonical deep link、刷新、V1 legacy route、全部 72 个第一章运行素材和零外部请求；`CLEANUP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1` 只清理脚本内列出的可重建目录；`PACKAGE_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1` 只打包显式白名单并验证 staging 清理前后 ZIP 身份不变。
