# STEP04 参考与来源边界

2026-09-21 查看指定原始网页；未下载参考游戏的模型、录音或整款游戏，未声称试玩或六位真人评审。Firecrawl 余额耗尽，页面核对改用内置网页读取。

| 参考 | 采纳 / 不采纳 | 本轮实际落点 |
| --- | --- | --- |
| [Disney Animation Frozen](https://disneyanimation.com/films/frozen/) 与 [Disney Movies](https://movies.disney.com/frozen/) | 采用第一部人物关系和蓝裙艾莎方向，不复刻电影情节 | 常驻艾莎；安娜、雪宝、克里斯托夫、斯文为整只拼件；标为自制同人玩具 |
| [LEGO Ice Palace 43244](https://www.lego.com/en-us/product/elsas-ice-palace-43244) | 建筑可摆弄；不照搬模型或掉落机关 | 门枢轴、吊灯轻摆；固定梁和柱脚支持上层件先装 |
| [Woodo](https://store.steampowered.com/app/2572040/Woodo/) | 放置与小变化连续；不复制内容 | 短落位、彩绘实体、轻重声音；没有长动画阻塞每次拼装 |
| [Townscaper](https://www.townscapergame.com/) | 少量输入产生世界变化；不扩展成建城编辑器 | 三个场景触点与少量预设路径 |
| [Tiny Glade](https://store.steampowered.com/app/2198150/Tiny_Glade/) | 可逆、低压力；不复制建筑生成系统 | 桥/冰场稳定状态、可见退场、随时停止与重置 |
| [LEGO Builder's Journey](https://store.steampowered.com/app/1544360/LEGO_Builders_Journey/) | 容许试验、有限玩具 | 自由分组与顺序，装配完成不要求魔法计数 |
| [Three animation](https://threejs.org/manual/en/animation-system.html) / [transparency](https://threejs.org/manual/en/transparency.html) | AnimationMixer 运行导入 clip；不靠大面积透明遮掩造型 | 角色局部动作与根节点路径分离；实体冰保持不透明，雪粒子不参与拾取 |

制作来源：`build_frozen.py` 程序化原创建模并保留 `.blend`，没有从电影或游戏提取模型、画面、对白或录音。自制几何和代码不代表 Frozen 原作角色设计权转移；角色元素归 Disney，不标作 CC0，不声称官方授权作品。

`render-frozen-audio.py` 为本项目新作程序编配、模态合成与种子噪声，无歌词、外部采样或原声；仅该新作音乐/合成录音声明 CC0-1.0，不覆盖角色元素。104.35秒、四段变化、钢琴/拨弦/少量高音键与轻弦层。参数和实际字节哈希见音频清单；听感确认与PCM技术检查分开。

本轮没有使用图像生成工具；游戏截图来自实际浏览器，Blender源不是截图替代品。

提供的两个 Three 手册 URL 当前返回404；动画接口另核对了当前官方 [AnimationMixer 文档](https://threejs.org/docs/pages/AnimationMixer.html)。透明处理依据本地 Three 版本及实际材质/拾取验证，不把未取到的网页写作已读取。
