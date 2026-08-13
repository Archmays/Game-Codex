# 第一章新增 24 字来源账本

本账本冻结 M2 的 24 个新增正式字。旧 12 字 `明 花 林 星 草 看 园 回 包 风 猫 跑` 继续使用 V1 的身份与来源映射；本章没有把候选母库直接当作 runtime 内容池。

共同上位核验：Unicode 17.0.0 `Unihan_Readings.txt` 的 `kMandarin` 字段（下载包 SHA-256 `F7A48B2B545ACFAA77B2D607AE28747404CE02BAEFEE16396C5D2D7A8EF34B5E`）与教育部《通用规范汉字表》（2013）。逐字本地核验：`game-data.ts` 组合母库、`formula-audit.ts` accepted 条目、`visuals/uXXXX.png` 视觉提示及本地 CJK 字体渲染。来源只支持规范身份、固定词语语境读音、组合、结构位置与意义联系；不支持字源或真人儿童结论。

| 字 | 拼音与固定词 | 区域 | 结构与有序部件 | 熟悉度 | 公式审计 | 主要风险控制 |
| --- | --- | --- | --- | --- | --- | --- |
| 清 | qīng／清水 | 微光林地 | 左右：氵→青 | 近熟悉 | hanzi-wheel accepted | 与晴共享青；以左槽和完整字区分 |
| 晴 | qíng／晴天 | 微光林地 | 左右：日→青 | 熟悉 | hanzi-wheel accepted | 与清共享青；不靠颜色作唯一提示 |
| 松 | sōng／松树 | 微光林地 | 左右：木→公 | 近熟悉 | hanzi-wheel accepted | 不把部件联想写成字源 |
| 河 | hé／河流 | 微光林地 | 左右：氵→可 | 熟悉 | existing accepted | 可作为独立字；只呈现结构位置 |
| 海 | hǎi／大海 | 微光林地 | 左右：氵→每 | 熟悉 | existing accepted | 意义图不承担部件解释 |
| 洋 | yáng／海洋 | 微光林地 | 左右：氵→羊 | 近熟悉 | existing accepted | 羊可独立成字；不作字源断言 |
| 安 | ān／安全 | 微光林地 | 上下：宀→女 | 熟悉 | existing accepted | 不编造宀与女的字源故事 |
| 闪 | shǎn／闪电 | 微光林地 | 半包围：门→人 | 熟悉 | existing accepted | 无高频闪烁；减少动画保留静态光带 |
| 你 | nǐ／你好 | 回声花园 | 左右：亻→尔 | 熟悉 | existing accepted | 固定在你好语境 |
| 他 | tā／他人 | 回声花园 | 左右：亻→也 | 熟悉 | existing accepted | 不扩展性别判断 |
| 好 | hǎo／美好 | 回声花园 | 左右：女→子 | 熟悉 | existing accepted | 多音字固定在美好 hǎo 语境 |
| 唱 | chàng／唱歌 | 回声花园 | 左右：口→昌 | 熟悉 | existing accepted | 静音仍显示波纹和文字状态 |
| 家 | jiā／家庭 | 回声花园 | 上下：宀→豕 | 熟悉 | existing accepted | 豕用大字卡；不讲字源故事 |
| 苗 | miáo／禾苗 | 回声花园 | 上下：艹→田 | 近熟悉 | existing accepted | 与猫的右部件以完整字和词区分 |
| 菜 | cài／蔬菜 | 回声花园 | 上下：艹→采 | 熟悉 | existing accepted | 求解器排除其他艹组合 |
| 音 | yīn／音乐 | 回声花园 | 上下：立→日 | 熟悉 | existing accepted | 静音用可见音符，不依赖声音 |
| 早 | zǎo／早晨 | 风语小径 | 上下：日→十 | 熟悉 | existing accepted | 十与加号 UI 明确区分 |
| 笔 | bǐ／毛笔 | 风语小径 | 上下：⺮→毛 | 熟悉 | existing accepted | 竹字头保持完整可辨 |
| 尘 | chén／尘土 | 风语小径 | 上下：小→土 | 近熟悉 | existing accepted | 只呈现位置，不把组合当字源 |
| 国 | guó／国家 | 风语小径 | 全包围：囗→玉 | 近熟悉 | existing accepted | 用固定词和外框结构限制抽象度 |
| 图 | tú／图画 | 风语小径 | 全包围：囗→冬 | 近熟悉 | existing accepted | 用图画固定语境，区别母库示例词 |
| 圆 | yuán／圆形 | 风语小径 | 全包围：囗→员 | 熟悉 | existing accepted | 与园同音；靠字形、词和意义图区分 |
| 问 | wèn／问题 | 风语小径 | 半包围：门→口 | 熟悉 | existing accepted | 提示不自动给出答案 |
| 闭 | bì／关闭 | 风语小径 | 半包围：门→才 | 近熟悉 | existing accepted | 门保持半包围，不画成完整囗 |

机器真源与完整逐字段记录由 `CHARACTER-SOURCE-LEDGER.json` 生成；每条状态固定为 `machine-verified-v2`，`etymologyClaim` 固定为 `null`。任何来源、部件、读音或风险字段变化都会改变 revision identity 并重新触发唯一解、渲染和 coverage 门禁。
