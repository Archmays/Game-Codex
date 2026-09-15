# 汉字书房数据来源

取得日期：2026-09-15。此文件不更改旧仓库许可证。

| 使用内容 | 固定版本／commit | 许可及来源 |
| --- | --- | --- |
| 9,574 份笔顺 JSON，原字节复制并以码点命名 | hanzi-writer-data 2.0.1 / `68d10a4b21150cae5e1ebbd223eed289cf32d90c` | [上游](https://github.com/chanind/hanzi-writer-data/tree/68d10a4b21150cae5e1ebbd223eed289cf32d90c)；Arphic Public License，见 licenses/ARPHICPL.TXT |
| WASM 识别引擎及 JS 绑定，原字节 | hanzi_lookup 1.0.0 / `01f90c3ab99a8fadf0696c28e5eb097223c500db` | [上游](https://github.com/gugray/hanzi_lookup/tree/01f90c3ab99a8fadf0696c28e5eb097223c500db)；LGPL-3.0，附 LGPL 和 GPL 全文 |
| WASM 内嵌识别数据，9,507 字 | 上述 commit 的 hanzi_lookup/data/mmah.bin；由同版本 mmah.json 转换 | Arphic Public License；来源为 Make Me a Hanzi → HanziLookupJS → hanzi_lookup，不能误标为 MIT |
| 读音与简繁关系索引 | Unicode / Unihan 17.0.0，kTGHZ2013 → kXHC1983 → kMandarin；kSimplifiedVariant / kTraditionalVariant | [Unihan 17.0 ZIP](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip)，Unicode-3.0，见 licenses/UNICODE-LICENSE.txt；没有使用 Make Me a Hanzi 的 LGPL 字典 |
| 显示字体 | 用户设备的系统字体 | 未分发字体文件。SVG 笔顺轮廓的字体来源仍是 Arphic，不因未分发 TTF 而消失 |

## 分发方式

笔顺文件 32,244,359 字节，索引 361,060 字节，WASM 740,534 字节。精确覆盖、差集和 SHA-256 见 coverage.json。索引仅在工具路由加载，单字 JSON 按需加载，识别在进入手写区域后载入。底层识别模型是笔画结构匹配，候选排序受轨迹及笔序影响，非通用神经 OCR。

识别库为独立、可替换的 JS/WASM 文件；允许为调试修改而逆向工程、替换或重新链接。`recognizer/hanzi_lookup-source.tar` 附对应版本的 Rust 源码、模型、Cargo.toml、构建说明及许可。上游在 README 声明 rustc 1.36.0-nightly、wasm-bindgen 0.2.42。Rust crates 从 Cargo.toml 指定上游获取；本次直接使用上游分发二进制并核对其 hash，未声称在新 Rust 工具链复编二进制等价。源码取自上表固定 commit；源码及替换库同样可独立下载。未修改识别库或字形数据；worker.js 是本工具另写的消息适配层。

评估过 Hanzi Writer 的 API 和 MIT 代码许可；最终选择轻量 SVG 中线遮罩实现播放与定位，没有打包 Hanzi Writer 代码或触发其默认 CDN。未同时引入第二种识别器。汉字屋只用于浏览功能，没有复制其脚本、品牌、图片、广告或字库。

## 地区与代表字

Make Me a Hanzi 上游说明目标为 PRC 笔顺，原字形由 Arphic PL KaitiM GB、PL UKai 等字体派生；不等于国家规范逐字认证。参考说明固定在 [Make Me a Hanzi bddc96d](https://github.com/skishore/makemeahanzi/tree/bddc96d41bef78427ed0e034e9f7e31d71fd1b92)。中国大陆简体优先；可用繁体保留自己的字形并标注 Unicode 对应关系，地区差异不静默转换。已对永、女、母、必、火、心、水、长、万、方、为、鸟、国、凹、凸逐笔审阅；审阅明细见项目最终报告。未做路径 override。

## 可重复构建

在项目 `tmp/tasks/HANZI-STROKE-LAB/` 中检出上述两个 GitHub 仓库的固定 commit；把 Unihan ZIP 解压到该目录的 `Unihan/`。运行：

```text
node tools/hanzi-stroke-lab/build-data.mjs tmp/tasks/HANZI-STROKE-LAB
node tools/hanzi-stroke-lab/verify-data.mjs
```

`hanzi_lookup/web_demo/hanzi_lookup.js` 和 `hanzi_lookup_bg.wasm` 原样复制到 recognizer；`git archive` 附对应 `hanzi_lookup/`、Cargo.toml、build_wasm.cmd、README 和许可。字形 JSON 原样复制，未改变内容。Unicode 索引是本项目 2026-09-15 的字段选择派生物，仍适用 Unicode 许可。获取上游需要联网；正常查字、识别和笔顺不需要外网。
