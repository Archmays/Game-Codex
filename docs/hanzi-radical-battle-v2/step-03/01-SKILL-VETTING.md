# STEP 03 外部 Skill 安全审查

核验日期：2026-08-09。结论：**MEDIUM / 可限域引入**。仅 vendor `level-design` 与 `puzzle` 两个目录及各自唯一的直接 reference；没有安装整个上游仓库，也没有改动已有四个 vendor Skill。上游：[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)，作者/维护者为 Abhishek Barali 与贡献者，固定 commit `2bea8297d9f09d90d6720c0334221417f7c9a928`，Apache-2.0。核验时 GitHub 为 441 stars、35 forks、未归档；流行度不作为安全证明。

## 审查结果

- 审查文件：目标目录 4 个文件，加既有根 `LICENSE`、`NOTICE`，共 6 个。
- 红旗：未发现外部网络请求、凭据/令牌读取、浏览器 cookie、SSH/AWS/config/MEMORY 访问、base64 载荷、`eval`/外部输入执行、提权、系统文件修改、隐蔽持久化或包安装。
- 权限：Skill 本身是 Markdown 指导，不要求运行时权限。若未来使用，只需读设计/规则文件并在明确任务范围内写项目文件；不需要网络、账号、后端或系统级命令。
- 风险来源：示例包含 GDScript、Godot/Unity 路由、match-3 计分/时间限制、震动等通用做法；机械照搬会违反 Phaser 3 技术锁、低压儿童体验和合字核心。
- 控制：`SKILL_INDEX.md` 将 `level-design` 限定为 3–5 分钟关键路径、教—练—验节奏与可读引导；将 `puzzle` 限定为纯规则状态、结构槽合法性、可撤回、可解性与输入锁。禁止把 match-3、分数、倒计时、压力失败或 Godot 示例带入 V2。
- 判定：可安全 vendor 为只读设计参考；真实使用仍须同时服从北极星、`child-first-learning-game` 与 `hanzi-structure-quality`。自动 PASS 不代表家长或儿童接受。

## 文件身份

上游 SHA-256 按 commit 中原始 LF 字节计算。四个新增文件的工作区原始字节与上游完全一致。既有 `LICENSE`/`NOTICE` 按要求未改动，其 CRLF 工作区原始 hash 不同，但转为 LF 后与上游 SHA-256 一致。

| 上游文件 | 本地文件 | Git blob | 字节 | 上游 SHA-256 | 核验 |
| --- | --- | --- | ---: | --- | --- |
| `skills/disciplines/level-design/SKILL.md` | `.agents/skills/vendor/gamedev-skills/level-design/SKILL.md` | `f46ebe758c357a7e78d52f7c15ec6b9f00fe2c33` | 7081 | `f1656cb00b9af8dc625a9655448b410b37ce6f1e523048a5abf09fda25cbfd32` | 原始字节一致 |
| `skills/disciplines/level-design/references/pacing-and-flow.md` | `.agents/skills/vendor/gamedev-skills/level-design/references/pacing-and-flow.md` | `62f19f71cea911dd9ea0d8ed2ed6bc04fd323cf3` | 4500 | `e8e3940f585e376f353aefea009befe8199a1871f99d34d7b2340cb35cb61872` | 原始字节一致 |
| `skills/genres/puzzle/SKILL.md` | `.agents/skills/vendor/gamedev-skills/puzzle/SKILL.md` | `83c9235b5f15452bb95d17a625173d529cb3b4b3` | 7001 | `a2f40c5c684b0d0f09d0b1db1cfcb04ca7e4e6e8bca946022f8318f5fbc44b4c` | 原始字节一致 |
| `skills/genres/puzzle/references/board-and-resolution.md` | `.agents/skills/vendor/gamedev-skills/puzzle/references/board-and-resolution.md` | `8d0d9a83ea766846740c9eb03467d5190787f5a8` | 5157 | `111151fe725f98b2c679f708c7dff11f0eb4d08189a0c41b02782e9a7c37a3d7` | 原始字节一致 |
| `LICENSE` | `.agents/skills/vendor/gamedev-skills/LICENSE` | `c7fc0c6d59cb8129a0e30fe13f5a6118f3933c44` | 11395 | `6f82dcfeb95a1c0a0452180a3b16f21bf82111780018fed59d95a052b5b75f6c` | 既有文件保留；LF 规范化一致 |
| `NOTICE` | `.agents/skills/vendor/gamedev-skills/NOTICE` | `d4204881c3f79f39151a53a6aae476b188a8c51f` | 883 | `2dcb65b1c5be24e5ba11e937f3996100f4e980d8cf8ac5b30ba1d70dae6c40f8` | 既有文件保留；LF 规范化一致 |

既有 CRLF 原始 SHA-256：`LICENSE` 为 `7b6e4f65e5e1d0918447c4b5a371f01b49432098fee25a9ed0832c646e74cd90`，`NOTICE` 为 `18ffe13bb86fbd1f9ec3a4e0987cccc34fdc129b8dc88e2e06c125aad8ac982f`。
