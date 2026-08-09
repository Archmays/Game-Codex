# STEP 02 候选汉字审核账本

状态：PROVISIONAL_PENDING_PARENT_REVIEW
用途：为 STEP 02 家长审核工具提供一个可追溯的 15 字候选账本；它不是已批准的可玩 manifest，也不是儿童试玩或成人语言审核结论。

## 审核边界

- 母库只提供 V1 组合、结构粗分类、V1 描述、公式审核状态和既有插图提示。它不提供标准拼音、儿童熟悉度、年龄适配、部件角色、V2 槽位、字源或最终魔法。
- 每个候选的 pinyin、familiarityBand、childFitRationale、围合细分、角色标签和 reviewStatus 都保持 provisional，等待家长／合格成人逐字审核。
- 下文的 component、top-component、side-component、enclosure-component 和 semi-enclosure-component 仅描述 V2 操作中的显示角色；不把所有部件称为“部首”，也不提出字源解释。
- V2 必须把本账本派生为版本化、确定性的候选 manifest；不得在运行时从 V1 的完整母库随机抽取。

## 分布假设与决策分层

这是用于控制审核负荷的精确假设，而不是已证实的儿童认字水平：

| 项目 | 数量 | 占比 | 候选 |
| --- | ---: | ---: | --- |
| 暂定 high | 9 | 60% | 明、林、花、草、星、看、园、回、包 |
| 暂定 near | 3 | 20% | 风、猫、跑 |
| 暂定 new | 3 | 20% | 清、晴、松 |
| high + near | 12 | 80% | 上述 12 字 |
| new | 3 | 20% | 清、晴、松 |
| 建议进入下一轮审核 | 10 | 66.7% | 明、林、花、草、星、看、园、回、包、风 |
| 条件候选 | 3 | 20% | 猫、跑、清 |
| 备用候选 | 2 | 13.3% | 晴、松 |

“recommended／conditional／reserve”只表示 STEP 02 的审核优先级，不表示它们已经获准进入最终清单。任何 STEP 03 最终 manifest 仍须不超过 12 字，且须有独立的家长决定。

## 母库证据说明

证据坐标采用 G / A / V：

- G：games/hanzi-radical-battle/game-data.ts，包含有序 parts、V1 desc、type、struct。
- A：games/hanzi-radical-battle/formula-audit.ts，包含 accepted 和 source 标签。
- V：games/hanzi-radical-battle/visual-hints.ts，包含公式文本、标签、图片路径和 alt。

sourceCombinationKey 依照 V1 combinationKey：将 parts 排序后直接拼接。该键仅供追溯；V2 同时必须保存 sourceOrderedParts，因为 V1 存在有序选择才可区分的组合。所有表内图片均为现有 custom visual hint，路径相对于当前 Vite base URL。

| ID | 审核优先级 | 暂定 band | 母库结构与 sourceOrderedParts | sourceCombinationKey | V2 显示槽位与部件角色（provisional） | 词／短义的现有证据 | visualHintPath（verified existing） | G / A / V | 需家长确认的风险 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ming | recommended；pilot-anchor | high | lr；日、月 | 日月 | 日 component/left；月 component/right | V 是“明亮”；G 是“明天” | ./assets/hanzi-radical-battle/visuals/u660e.png | 4233 / 323 / 212 | 拼音未提供；“明亮”与 V1 desc“明天”不同；日月插图只能作联想，不作字源。 |
| lin | recommended | high | lr；木、木 | 木木 | 木 component/left；木 component/right | 树林 | ./assets/hanzi-radical-battle/visuals/u6797.png | 4236 / 326 / 192 | 需要两张独立木牌；木与许多部件可另成字。 |
| hua | recommended | high | tb；艹、化 | 化艹 | 艹 top-component/top；化 component/bottom | 花朵 | ./assets/hanzi-radical-battle/visuals/u82b1.png | 1558 / 119 / 132 | 艹只是本场的顶端部件标签；不将图像联想写成字源。 |
| cao | recommended | high | tb；艹、早 | 早艹 | 艹 top-component/top；早 component/bottom | 小草 | ./assets/hanzi-radical-battle/visuals/u8349.png | 1571 / 120 / 46 | 早为整体组件；艹与田、采等会形成其他组合。 |
| xing | recommended | high | tb；日、生 | 日生 | 日 component/top；生 component/bottom | 星星 | ./assets/hanzi-radical-battle/visuals/u661f.png | 2612 / 199 / 348 | 日与月、十、青、召等有其他组合；拼音和儿童熟悉度待审。 |
| kan | recommended | high | tb；手、目 | 手目 | 手 component/top；目 component/bottom | 看见 | ./assets/hanzi-radical-battle/visuals/u770b.png | 4235 / 325 / 165 | 目标字体中顶部“手”的缩放和槽位轮廓需真实浏览器检查。 |
| yuan | recommended | high | sur；囗、元 | 元囗 | 囗 enclosure-component/outer；元 component/inner | 花园 | ./assets/hanzi-radical-battle/visuals/u56ed.png | 2885 / 220 / 382 | V1 的 sur 未细分完整包围；囗与多项内件会形成其他字。 |
| hui | recommended | high | sur；囗、口 | 口囗 | 囗 enclosure-component/outer；口 component/inner | 回家 | ./assets/hanzi-radical-battle/visuals/u56de.png | 2950 / 225 / 135 | 同为完整包围预览的候选；不得与园的内外槽概念混淆。 |
| bao | recommended | high | sur；勹、巳 | 勹巳 | 勹 semi-enclosure-component/outer；巳 component/inner | 书包 | ./assets/hanzi-radical-battle/visuals/u5305.png | 4029 / 308 / 29 | V1 的 sur 未证明半包围细分；勹与口、一另有组合。 |
| feng | recommended | near | sur；几、乂 | 乂几 | 几 semi-enclosure-component/outer；乂 component/inner | 大风 | ./assets/hanzi-radical-battle/visuals/u98ce.png | 4068 / 311 / 94 | 几与木、又另有组合；围合细分、拼音和儿童负荷待审。 |
| mao | conditional | near | lr；犭、苗 | 犭苗 | 犭 side-component/left；苗 component/right | 花猫 | ./assets/hanzi-radical-battle/visuals/u732b.png | 4259 / 349 / 202 | 不把犭强行写成“犬部首”；犭与王、青另有组合。 |
| pao | conditional | near | lr；足、包 | 包足 | 足 component/left；包 component/right | 跑步 | ./assets/hanzi-radical-battle/visuals/u8dd1.png | 4248 / 338 / 228 | 包与氵、火、口、饣会形成其他结果；与“包”候选的复现是否有益待审。 |
| qing-clear | conditional | new | lr；氵、青 | 氵青 | 氵 side-component/left；青 component/right | 清水 | ./assets/hanzi-radical-battle/visuals/u6e05.png | 4239 / 329 / 249 | 与晴共享青；青还能与日、目、忄、虫、犭组合；拼音、字义与新字比例待审。 |
| qing-sunny | reserve | new | lr；日、青 | 日青 | 日 component/left；青 component/right | 晴天 | ./assets/hanzi-radical-battle/visuals/u6674.png | 4242 / 332 / 252 | 与清共享青，且日也高碰撞；不可把“晴”与“清”混为同一读音条目。 |
| song | reserve | new | lr；木、公 | 公木 | 木 component/left；公 component/right | 松树 | ./assets/hanzi-radical-battle/visuals/u677e.png | 4251 / 341 / 291 | 木的组合面很广；拼音、熟悉度和部件独立可读性待审。 |

所有 15 个条目的 `pinyin` 都只是供审核的暂定显示值，独立的 `pinyinReview` 固定为 `pending-parent-review`；母库不提供标准读音证据。正式审阅时还必须核对：简体字形、标准读音、熟悉词、短义、插图、魔法概念是否指向同一字义。

## 五张手牌的全量 solver 门槛

V2 不得直接复用 V1 的“任意抽牌后找答案”体验。每一手固定为恰好五张，solver 必须对手牌的每个二部件和三部件多重集合进行枚举，并同时保留用户选择顺序。

一手牌可以进入儿童 Pilot 或成人 preview，只有在全部条件成立时：

1. 恰好五张，且目标所需的每个 componentId 都存在；林需要两张不同 cardId 的木。
2. 目标组合按 sourceOrderedParts 与 slot/component ID 完整匹配。
3. 所有二部件、三部件子集在候选表和受控母库快照中都被检查。
4. 除明确展示并解释的目标外，没有第二个有效完整字；有序选择可得不同结果时，也视为歧义并拒绝。
5. 不以坐标、颜色、hover 或动画结束事件决定合法性；点击、拖放、撤回和 reduced motion 使用同一 solver。

只读母库枚举得到的安全起始手牌如下。它们在当前 390 个非空 V1 组合中仅包含指定目标；每次变更 distractor 都必须重新运行 solver。

| 目标 | 五张安全起始牌 |
| --- | --- |
| 明 | 日、月、氵、亻、讠 |
| 林 | 木、木、氵、亻、讠 |
| 花 | 艹、化、氵、亻、讠 |
| 草 | 艹、早、氵、亻、讠 |
| 星 | 日、生、氵、亻、讠 |
| 看 | 手、目、亻、讠、木 |
| 园 | 囗、元、氵、亻、讠 |
| 回 | 囗、口、氵、亻、讠 |
| 包 | 勹、巳、氵、亻、讠 |
| 风 | 几、乂、氵、亻、讠 |
| 猫 | 犭、苗、氵、亻、讠 |
| 跑 | 足、包、亻、讠、木 |
| 清 | 氵、青、亻、木、女 |
| 晴 | 日、青、亻、木、女 |
| 松 | 木、公、氵、亻、讠 |

## 已知冲突样例

这些不是穷尽清单，正因如此必须由 solver 全量拒绝：

- 日加十、生、青、召可分别形成早、星、晴、昭。
- 木加口或几是有序歧义：木加口为杏、口加木为呆；木加几为机、几加木为朵。木还可与公、兆、肖形成松、桃、梢。
- 囗加口、大、才、木、人可形成回、因、团、困、囚。
- 勹加口或一可形成句、勺；几加又可形成凤。
- 包加氵、火、口、饣可形成泡、炮、咆、饱。
- 青加日、目、忄、虫、犭可形成晴、睛、情、蜻、猜。

## 验收仍待发生

- 自动：候选字段完整性、V1 sourceOrderedParts／key／图片引用一致性、五牌 solver、结构槽、无歧义和不超过 12 个最终推荐字。
- 浏览器：在目标字体中渲染每个组件与完整字，检查左右、上下、完整包围和半包围槽位的视觉真实性。
- 家长／成人：逐字批准拼音、词义、熟悉词、熟悉度、儿童适配、插图一致性和最终用途。
- 儿童：本步骤尚未进入儿童试玩；任何自动 PASS 均不得写成儿童接受或适龄性结论。
