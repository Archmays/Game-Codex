# 声韵试炼兼容定义

## 游戏目标

在固定熟悉词境中观察声母、韵母和声调。

## 适合对象

6–8 岁正在接触汉语拼音的家庭儿童。

## 玩法说明

选择拼成音节、声调小径或易混声韵；每段四条，可随时返回。

## 涉及知识点

规范拼音书写、调号、声韵结构、整体认读教学类别与清楚的单维对比。

## 设备适配

支持鼠标、触控、键盘、静音、无语音降级、移动端和减少动态效果。

## 当前完成度

V1.0.0，72/72 core coverage 与三种模式已纳入稳定门禁。

## 后续改进建议

只有在本地验证音频真实存在后，才考虑纯听音模式。

## 接入方式

正式入口是 `?play=hanzi-magic-complete&view=pinyin`；旧定义仅作兼容包装。

`pinyin-magic-battle` 仍保留在 `allGameDefinitions` 与 Portfolio 中，以维持历史定义和旧存档命名空间；它不再显示为 Classic 独立卡片。

儿童运行时委托给墨迹森林的规范声韵引擎：

- 规范路线：`?play=hanzi-magic-complete&view=pinyin`
- 三种模式：`assemble`、`tone`、`contrast`
- 新存档：`family-games/chinese-support/pinyin/v1`
- 旧存档：保留原字节，不覆盖、不删除

运行时不导入 `pinyinCards` 或 legacy audit；旧数据只用于离线审计。
