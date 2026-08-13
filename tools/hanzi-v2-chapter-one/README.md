# 汉字魔法战 V2.0.0 第一章启动器

双击 `START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`。启动器会复用自己记录且身份匹配的 Game-Codex 服务；若首选端口被其他程序占用，会在 5186–5195 中选择空闲端口，不会结束那个程序。浏览器打开的固定入口是 `?play=hanzi-v2-chapter-one&from=hub`。

玩完后回到启动窗口按 Enter。它只会核对并关闭本次启动的进程。若窗口被意外中断，可双击 `STOP_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.cmd`；停止脚本在 PID、启动时间、仓库根目录、Vite 命令和监听端口全部匹配前不会结束进程。

启动失败时查看仓库内 `tmp/hanzi-v2-chapter-one/` 的标准输出与错误日志。该目录可安全重建，不包含儿童资料。
