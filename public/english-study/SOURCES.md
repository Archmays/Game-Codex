# 英语书房词库来源

## 扩展英汉词条

- 来源：[ECDICT](https://github.com/skywind3000/ECDICT)，Linwei / skywind3000，固定提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`。
- 输入文件：`ecdict.csv`，SHA-256 `1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`。原文件不随游戏打包。
- 许可：MIT；本地全文见 [ECDICT-LICENSE.txt](ECDICT-LICENSE.txt)。ECDICT 是第三方社区词库，不是学校官方或项目自编词典。
- 筛选：只取纯英文字母的单词；ECDICT `frq`（当代语料词频位次）为 1–12,000，且有中文释义；同一小写词保留频次更高的一行。对简明展示，解析 CSV 中的换行，优先使用无方括号领域标记的一般性释义；若只有领域释义，则去掉标记、保留词义。最多保留五行，每词上限 480 字符。保留来源音标，不做音标转换。
- 与下述 48 个已审定词义合并后，运行时有 **10,547 个不重复词条**。源文件词频位次 1–8,000 的 7,002 个纯字母词全部在内。数字指此规则下的词条数，不表示某一权威“常用 8,000 词”清单全部被覆盖，也不保证完整释义或适合每位儿童独自阅读。
- 生成文件 `games/english-study/words.json` 的 SHA-256：`69102e7f561e19d5591b57502d4d88421ffd4c365fac8a102857a0105cdcbca7`。

## 已审定儿童词义

原项目的 `docs/english-v2/release/WORD-GRAPH.json` 提供 48 个目标词的中文单义、英文解释与已有例句。这 48 个词优先覆盖同名 ECDICT 词条的释义。来源与写作规则见仓库内 `docs/english-v2/CONTENT-RULES.md`。

## 重建

下载固定提交的 `ecdict.csv` 到任务暂存目录，校验上面的 SHA-256 后运行：

```powershell
python games/english-study/tools/build-words.py <path-to-ecdict.csv> --check
```

生成时省略 `--check`。运行时不请求外部词典服务；单词朗读使用设备的系统语音。字母笔画路径是本项目创建的印刷体手写示范，没有借用外部笔顺图。
