# 英语书房

独立英语查阅工具，入口 `?play=english-study`，从“我的游戏世界”进入。它不恢复已经退役的英语世界，也不计入活跃游戏产品。

## 使用

- 输入英语词（一次最多 12 个，保留重复）或中文意思；中文搜索只匹配已收录词。
- 本地词库收录 10,547 个词条：取 ECDICT 当代语料词频 12,000 名以内、有中文释义的纯字母词，并用项目 English V2 已审定的 48 个词义覆盖同名词。已审定词展示一个中文意思、英文释义及已有例句；扩展词条显示第三方词典的简明中文释义和来源音标。未知词明确标明未收录，仍可逐字母看写法。
- 已收录词可用浏览器系统语音朗读；音色、离线能力取决于设备。本站不下载音频。
- 26 个字母的大写、小写都有具体笔画路径和落笔顺序。可以逐笔前进、后退、播放和查看完整字母。笔顺是统一的印刷体手写示范，不声称是唯一标准。
- 最近查看（最多 24）和收藏（最多 128）仅记录已收录的单词，使用独立 `family-games/english-study/v1`。损坏、未来版本或另一页更新的原记录不会被覆盖；未知词不写入存储。
- Tab 跨区域；词卡和字母区域用方向键、Home/End 移动，Enter/Space 激活。按钮支持鼠标和触摸；弹窗 Esc 关闭并恢复焦点。

词义与例句由 `docs/english-v2/release/WORD-GRAPH.json` 和固定版本的 ECDICT 生成 `words.json`；完整筛选、哈希和许可见 [`public/english-study/SOURCES.md`](../../public/english-study/SOURCES.md)。字母笔顺路径为本项目绘制的教学示范。扩展词条未逐项做儿童适读审定，不声称其包含全部释义。

源 CSV 的前 8,000 个词频位次中，7,002 个纯字母词全部进入当前词库。自动检查与浏览器检查验证词条数量、笔顺结构、输入、本机存储、实际鼠标/触摸/键盘、窄屏和返回焦点；不证明儿童喜好、实际学习效果或特定学校的书写要求。

验证命令：`pnpm exec vitest run tests/english-study.test.ts tests/portfolio-governance.test.ts`、`pnpm exec playwright test --config playwright.english-study.config.ts`、`pnpm run portfolio:check`、`pnpm build`。
