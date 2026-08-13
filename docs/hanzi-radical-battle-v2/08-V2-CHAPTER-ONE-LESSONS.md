# 第一章 V2.0.0 可复用经验

## 36 字内容管线

- 把 V1 十二字当 identity-bound anchor，新 24 字分别绑定规范身份、固定语境拼音、熟悉词、短义、结构槽位、部件、风险和 revision hash。
- 上位规范来源只支持字形身份与读音边界；局部组合和视觉位置仍需本地公式/提示账本与运行时求解交叉验证。不要把部件组合讲成字源。
- 正式汉字、拼音和熟悉词必须由浏览器文字层渲染；生成图只表达字义联想与世界结果。

## 唯一解手牌与受约束路线

- 手牌实例 ID、部件 glyph、source glyph、目标/干扰类型和 expected slot 要分离；对全部两部件组合枚举顺序与槽位，而不是只看 glyph set。
- 路线由 seed、hero、mode 和正式 manifest 纯生成；同 seed 重放必须完全一致。分支只能改变遭遇、已见行为和候选能力，不得改变字符事实。
- 首领只组合分支上已经见过的行为。最终首领使用每条分支共同必见的行为，避免“某个 seed 第一次在 Boss 学规则”。

## 英雄和能力覆盖

- 英雄差异保持在反馈、预告、恢复、重复部件和世界变化层；不自动完成整字，也不把错误字变成正确。
- 每次三选一同时记录 offered、selected、triggered。只检查“存在 18 项”不够，纯 simulation 和浏览器矩阵都要证明可提供和实际触发。
- 儿童 HUD 只保留一个固有能力加三项本局选择，避免装备栏和稀有度语义。

## Theme C 批量一致性

- 大图 atlas 的 prompt 必须固定调色板、轮廓、光照、非恐怖边界、无文字和单元格语义；每张 atlas 视觉检查后再裁切。
- rejected atlas 不进入 runtime 或最终包。selected 原图、prompt pack、处理脚本与优化 runtime 分开保存。
- 即使生成主体正确，裁切边缘也可能暴露 atlas 背景；运行时 frame 应有语义相容底色、overflow clip 和适度 crop，而不是修改主体内容。

## 机器实玩与 no-update

- 纯 simulation 负责 30,000+ seed 的软锁、replay、resume 和 coverage；真实浏览器负责输入、焦点、存档迁移、console/page/network、DOM 几何和完整结尾。
- 浏览器 harness 的 selector 必须绑定 action 与 identity，避免状态根节点和交互按钮共享 data 字段导致 strict selector 假失败。
- 对固定 seed 与存档生成 visual/ARIA fixture，先合法更新一次 baseline，再在同一 source tree 连续两轮 exact PNG byte 与 exact ARIA 比较。滚动门禁应轮询实际滚动容器的终态。

## 存档迁移和有效修复

- V1 与 V2 分键；迁移复制原始 V1 bytes 并保留 V1 主键。V2 schema 保持整数版本、checksum、backup、recovery 和 future-version read-only。
- 修复阈值不能只依赖“总发现字”或“非 V1 字数量”；V1→V2 重叠会改变计数。章节完成这种语义事件应显式授予终局修复，并通过 canonical derive 函数持久化。
- launcher 复用与清理必须验证 PID、启动时间、根目录、命令和端口。端口占用时选择空闲端口，绝不以方便为由结束未知进程。
