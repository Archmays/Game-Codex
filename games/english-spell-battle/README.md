# 英语世界 · 词光岛（Wordlight Island）

## 接入方式

- 英语世界 V2：`?world=english-world`
- Word Journal：`?world=english-world&view=journal`
- English Memory：`?world=english-world&view=memory`
- Classic 英语卡：从 `?hub=classic&from=world` 进入英语世界 V2。
- 旧版兼容入口：`?play=english-spell-battle-legacy&from=hub`；旧题库和旧本机数据保留，不作为 V2 学习证据。

## 游戏目标

让初学英语的孩子把固定词义、可见拼写单元和短句语境连成一次完整的世界互动；任何区域都可自由进入，离开不会丢失已点亮内容。

## 适合对象

适合家庭场景中的英语初学儿童与亲子共玩。中文帮助可关闭，声音是可选辅助，不是完成任务的前提。

## 玩法说明

孩子先看固定词义与正式词图，再按手工审核的 grapheme 单元拼出单词，把完整单词放回原创短句，最后由岛屿场景对句意作出可见回应。没有分数、排名、连胜、倒计时、生命值、伤害、闯关锁或失败惩罚。

五个区域均可自由进入：动物草甸、家与朋友湾、阳光食集、动起来公园、彩数码头。正式内容为 48 词，其中 30 个 story-core 词各对应一条 2–6 词短句；18 个 optional 词只在词光册中作为拓展，不阻挡故事。

## 涉及知识点

- 发音记录：CMU Pronouncing Dictionary 固定提交 `74790861f652b15e4ac49015a90074ad62a27690`；仅使用 ARPABET 记录，未自动推导 G2P。
- 词义记录：Open English WordNet 2025；每词固定一个 sense ID，儿童释义为项目原创短释义。
- grapheme↔phoneme：逐词手工映射；不规则部分明确标为 heart part，不伪装成通则。
- 句子：30 条均为项目原创；support word 与 target word 清单分离。
- 旧版 `Raz aa-A` 标签因没有可验证来源而隔离，V2 不声称任何 RAZ/品牌分级。

## 图像、声音与隐私

40 个具体名词/动作词使用逐词生成并经过透明通道、尺寸、体积和运行时检查的原创 WebP；4 个颜色词使用 CSS 色块；one/two/three/ten 使用可数的 DOM 贝壳。儿童人物均为虚构插图，不含真实儿童或家庭身份信息。

浏览器英语 TTS 仅为可选整词/整句播放，不用于逐音素质量证明；无可用语音时全部任务仍可完成。进度只保存在匿名、本机的 `family-games/english-world/v2`。旧键 `family-games/english-spell-battle/progress` 不被解释、迁移或删除。

## 设备适配

正式交互覆盖键盘、鼠标、触控，以及 360、390、768、1440 像素代表视口；关键操作目标最小 44×44 CSS 像素，并支持减少动态效果。

## 当前完成度

V2.0.0 产品源已完成：48 个词、30 个故事任务、5 个自由区域、词光册、共享英语翻牌、版本化本机保存，以及顶层游戏世界入口。

自动化覆盖内容图谱、50,010 次 seeded 模拟、保存损坏/未来版本保护、键盘/触控、360/390/768/1440 视口、几何、控制台、网络、视觉快照和完整 30 词故事遍历。自动化 PASS 不代表真实儿童好玩、学习有效、记忆保持或家长/教师验收；本次明确为 `REAL_CHILD_VALIDATION=NO_BY_USER_DIRECTION`。

## 后续改进建议

下一阶段只建议在明确授权的 `GAME-CODEX-OBSERVATION-POLISH-05` 中进行低干扰真实使用观察；在获得真实观察前，不把机器结果写成儿童体验或学习效果结论。
