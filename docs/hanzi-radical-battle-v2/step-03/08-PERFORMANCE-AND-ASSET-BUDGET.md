# STEP 03 性能与资产预算

## 结论

2026-08-09 的最终本地 `pnpm build` 成功，Vite 转换 181 个模块。Golden Slice 儿童路由和 STEP 03 家长审核路由都通过 dynamic import 加载；默认十游戏大厅不预加载儿童路由的规则/UI 块，也不加载三张 ImageGen 家长候选图。

## 构建证据

| 范围 | 未压缩字节 | gzip（Vite 报告） | 说明 |
| --- | ---: | ---: | --- |
| 共享主 JS | 1,814,917 | 438,680 | 现有十游戏/共享 Phaser 主包；STEP 03 只在其中增加小型查询路由与 review-only control bridge |
| Golden Slice 额外 JS | 88,514 | 约 26,690 | `index-CymrZn8H.js` + pacing + candidate-character + structure-board 共享块 |
| Golden Slice 额外 CSS | 16,780 | 4,360 | `index-DEuVBwEW.css` |
| STEP 03 review 初始 JS | 61,548 | 约 19,660 | review 块 + pacing + candidate-character 共享块 |
| STEP 03 review CSS | 14,640 | 3,510 | `index-5p4VlSUY.css` |
| review-only ImageGen previews | 222,400 | 不适用 | 只由 review lazy chunk 引用；切到资产页才需要呈现 |

Golden Slice 的额外程序包合计 105,294 字节（gzip 约 31.1 kB）。这不包括已存在于共享主包的 Phaser 和大厅基础代码。

Vite 仍报告共享主 JS 超过 500 kB。本任务没有将 Golden Slice 或 review 资产并入该块；构建的 module map 明确把两条 V2 路由指向独立 lazy chunks。因此 STEP 03 不是这个大块的实质成因，也没有为消除既有警告重构全仓。

## 儿童路由资产

- 首屏导入的 V2 raster image：0 字节。
- 首屏导入的 V2 audio file：0 字节。
- 导入的 V2 texture：0；游戏画面由 Phaser Graphics / DOM 生成。
- 稳定程序化 asset key：9，每项有 role、anchor 与 scale。
- ImageGen 原图：约 6.0 MB，仅在 `artifacts/` 中作为家长 seed audition 原件，不进入运行包。
- 三张压缩 WebP preview：222,400 字节，仅由家长 review chunk 引用，不是儿童路由依赖。

## 生命周期与内存边界

- `AudioDirector` 将同时轻量音源限制为 5；音源结束后从集合移除。
- 销毁时停止 voice/source、清空 gain/source 引用并关闭 Web Audio context。
- Golden Slice overlay 销毁时移除 `keydown`、`visibilitychange`、`pagehide` 全局监听。
- Phaser handle 调用 `game.destroy(true)`；Scene 逐一销毁 World/Character/Monster/Boss/FX Graphics。
- DOM 控件随每次 render 替换，不把旧节点 listener 保存到长期集合。
- review control bridge 只在 `mode=review` 且同源 parent message 时生效；正常儿童 URL 不安装该 handler。

## 移动端健全性

390×844、768×1024、1024×768、1440×900、横竖屏切换、resize 和 125% browser zoom 已由定向 E2E 与代表截图覆盖。最终 capture report 记录 0 console error、0 page error、0 remote request。这是浏览器健全性证据，不是专用设备堆内存剖析；STEP 03 没有据此声称所有手机的内存均已验证。

## 依赖

本任务没有新增 production 或 development dependency，也没有新增 UI framework、analytics SDK、backend 或账号组件。
