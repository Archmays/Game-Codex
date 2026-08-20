import { CANONICAL_WHEEL_LIBRARY } from "../../v2/wheel-workshop/library/canonical-wheel-library";
import { createRevisionHash } from "../../v2/content/revision-hash";
import { completeCharacterId, completeComponentId, completeReadingId, completeUnicodeCodePoint, slotsForStructure } from "./ids";
import type { CharacterNode, CompleteStructure, ReadingSense } from "./types";

interface NewCharacterSeed {
  readonly glyph: string;
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly chapterId: "chapter-two" | "chapter-three";
  readonly band: "story-required" | "optional";
  readonly worldTag: string;
  readonly structure: CompleteStructure;
  readonly components: readonly [
    { readonly glyph: string; readonly role: "semantic" | "phonetic" | "both" | "uncertain" },
    { readonly glyph: string; readonly role: "semantic" | "phonetic" | "both" | "uncertain" },
  ];
  readonly illustrationBrief: string;
  readonly magicName: string;
  readonly magicEffect: string;
  readonly familiarity: "high" | "near" | "advanced-optional";
  readonly ambiguityRisk: string;
  readonly pronunciationRisk?: "low-in-fixed-phrase" | "fixed-context-polyphone";
}

export const COMPLETE_NEW_CHARACTER_SEEDS = [
  { glyph: "指", pinyin: "zhǐ", familiarWord: "指路", shortMeaning: "用手指出方向或东西", chapterId: "chapter-two", band: "story-required", worldTag: "wood-voice-canopy", structure: "left-right", components: [{ glyph: "扌", role: "semantic" }, { glyph: "旨", role: "phonetic" }], illustrationBrief: "一只友好手势指向发光林路，不出现文字箭头。", magicName: "指光引路", magicEffect: "一道手形柔光指出被墨叶遮住的安全小路。", familiarity: "high", ambiguityRisk: "旨较不熟悉；只显示真实部件位置，不把组合讲成字源故事。" },
  { glyph: "饱", pinyin: "bǎo", familiarWord: "吃饱", shortMeaning: "吃够了，不再觉得饿", chapterId: "chapter-two", band: "story-required", worldTag: "spring-stone-valley", structure: "left-right", components: [{ glyph: "饣", role: "semantic" }, { glyph: "包", role: "phonetic" }], illustrationBrief: "小伙伴吃完一碗饭后满足地放下勺子。", magicName: "饱足暖光", magicEffect: "温暖饭香补亮溪谷里疲倦的灯苗。", familiarity: "high", ambiguityRisk: "与包、跑共享包；必须依靠饣和固定词语区分。" },
  { glyph: "情", pinyin: "qíng", familiarWord: "心情", shortMeaning: "心里的感受", chapterId: "chapter-two", band: "story-required", worldTag: "wood-voice-canopy", structure: "left-right", components: [{ glyph: "忄", role: "semantic" }, { glyph: "青", role: "phonetic" }], illustrationBrief: "一颗柔和心灯随心情改变明暗，不出现表情评分。", magicName: "心情灯语", magicEffect: "心灯发出柔光，让纠结的树藤慢慢舒展。", familiarity: "high", ambiguityRisk: "与请、晴、清、睛共享青；必须依靠左部件和完整词语区分。" },
  { glyph: "请", pinyin: "qǐng", familiarWord: "请问", shortMeaning: "有礼貌地提出请求", chapterId: "chapter-two", band: "story-required", worldTag: "wood-voice-canopy", structure: "left-right", components: [{ glyph: "讠", role: "semantic" }, { glyph: "青", role: "phonetic" }], illustrationBrief: "伙伴礼貌举手询问，画面不出现对话文字。", magicName: "请问回声", magicEffect: "礼貌的声波打开一扇愿意回应的叶门。", familiarity: "high", ambiguityRisk: "与情、晴、清、睛共享青；固定在请问语境。" },
  { glyph: "路", pinyin: "lù", familiarWord: "道路", shortMeaning: "供人们走过的地方", chapterId: "chapter-two", band: "story-required", worldTag: "spring-stone-valley", structure: "left-right", components: [{ glyph: "⻊", role: "semantic" }, { glyph: "各", role: "phonetic" }], illustrationBrief: "脚印沿石谷小路延伸，终点保持可见。", magicName: "路纹延伸", magicEffect: "断开的石路长出连续金色脚印。", familiarity: "high", ambiguityRisk: "⻊须用正确字体显示为足字旁，不替换成完整足。" },
  { glyph: "进", pinyin: "jìn", familiarWord: "前进", shortMeaning: "向里面或向前走", chapterId: "chapter-two", band: "story-required", worldTag: "spring-stone-valley", structure: "semi-enclosure", components: [{ glyph: "辶", role: "semantic" }, { glyph: "井", role: "phonetic" }], illustrationBrief: "伙伴沿发光弯路向前走，路面没有倒计时。", magicName: "前进流光", magicEffect: "弯曲的走之光带领水轮跨过停滞石阶。", familiarity: "high", ambiguityRisk: "半包围槽位先放辶；不把井解释成前进的共同意思。" },
  { glyph: "迷", pinyin: "mí", familiarWord: "迷路", shortMeaning: "找不到正确的方向", chapterId: "chapter-two", band: "story-required", worldTag: "spring-stone-valley", structure: "semi-enclosure", components: [{ glyph: "辶", role: "semantic" }, { glyph: "米", role: "phonetic" }], illustrationBrief: "几条柔和岔路围绕伙伴，安全出口始终可见。", magicName: "迷雾辨路", magicEffect: "米粒星光落在弯路上，显出真正出口。", familiarity: "high", ambiguityRisk: "不制造假必败路线；提示只恢复可读路径，不代选部件。" },
  { glyph: "思", pinyin: "sī", familiarWord: "思考", shortMeaning: "在心里认真地想", chapterId: "chapter-two", band: "story-required", worldTag: "wood-voice-canopy", structure: "top-bottom", components: [{ glyph: "田", role: "uncertain" }, { glyph: "心", role: "semantic" }], illustrationBrief: "伙伴安静看着几片发光叶子，在心里整理办法。", magicName: "思路叶图", magicEffect: "散乱叶片排成一条可继续探索的思路。", familiarity: "high", ambiguityRisk: "只确认田在上、心在下；不把两部件编成字源故事。" },
  { glyph: "语", pinyin: "yǔ", familiarWord: "语言", shortMeaning: "人们表达意思时所用的话", chapterId: "chapter-two", band: "story-required", worldTag: "door-shadow-corridor", structure: "left-right", components: [{ glyph: "讠", role: "semantic" }, { glyph: "吾", role: "phonetic" }], illustrationBrief: "不同伙伴用柔和波纹交流，静音也能看懂。", magicName: "语言光桥", magicEffect: "可见声纹在长廊两端架起沟通光桥。", familiarity: "high", ambiguityRisk: "静音时必须保留完整可见等价信息；吾不作单独字源故事。" },
  { glyph: "饭", pinyin: "fàn", familiarWord: "米饭", shortMeaning: "做熟的谷物或一顿食物", chapterId: "chapter-two", band: "story-required", worldTag: "door-shadow-corridor", structure: "left-right", components: [{ glyph: "饣", role: "semantic" }, { glyph: "反", role: "phonetic" }], illustrationBrief: "一碗热米饭冒出柔和蒸汽，不出现品牌。", magicName: "饭香补光", magicEffect: "饭香化作暖雾，让长廊小灯重新有力。", familiarity: "high", ambiguityRisk: "固定在米饭语境；反只作部件核对，不讲相反含义。" },
  { glyph: "钟", pinyin: "zhōng", familiarWord: "时钟", shortMeaning: "用来表示时间的器物", chapterId: "chapter-two", band: "story-required", worldTag: "door-shadow-corridor", structure: "left-right", components: [{ glyph: "钅", role: "semantic" }, { glyph: "中", role: "phonetic" }], illustrationBrief: "圆形时钟发出一次柔光，绝不制造倒计时压力。", magicName: "钟声定影", magicEffect: "一圈可见钟声波纹让晃动门影稳定下来。", familiarity: "high", ambiguityRisk: "时钟只表现字义，不设置限时；与盅等同音字不混。" },
  { glyph: "钱", pinyin: "qián", familiarWord: "钱包", shortMeaning: "买东西时使用的钱", chapterId: "chapter-two", band: "story-required", worldTag: "door-shadow-corridor", structure: "left-right", components: [{ glyph: "钅", role: "semantic" }, { glyph: "戋", role: "phonetic" }], illustrationBrief: "小钱包里有几枚普通硬币，不出现价格或购买按钮。", magicName: "钱币清响", magicEffect: "几枚金属光片叮当排列，补好门锁齿轮。", familiarity: "high", ambiguityRisk: "不引入支付、奖励货币或稀有度；戋需清晰大字显示。" },
  { glyph: "初", pinyin: "chū", familiarWord: "最初", shortMeaning: "刚开始的时候", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "衤", role: "semantic" }, { glyph: "刀", role: "uncertain" }], illustrationBrief: "黎明第一束光落在整齐布带上，不出现刀具动作。", magicName: "初光启页", magicEffect: "第一束晨光翻开一页可选字卷。", familiarity: "near", ambiguityRisk: "刀作为部件只显示字形与位置，不呈现危险使用或字源故事。" },
  { glyph: "被", pinyin: "bèi", familiarWord: "被子", shortMeaning: "睡觉时盖在身上的东西", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "衤", role: "semantic" }, { glyph: "皮", role: "phonetic" }], illustrationBrief: "柔软被子盖在小床上，画面温暖安稳。", magicName: "被角暖罩", magicEffect: "柔软光被盖住寒冷墨点，让营地恢复温暖。", familiarity: "near", ambiguityRisk: "固定在被子名词语境，不用被动句首次教学。" },
  { glyph: "祝", pinyin: "zhù", familiarWord: "祝福", shortMeaning: "希望别人平安美好", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "礻", role: "semantic" }, { glyph: "兄", role: "phonetic" }], illustrationBrief: "伙伴送出柔和星光祝福，不出现宗教仪式。", magicName: "祝福星灯", magicEffect: "一盏星灯把温暖愿望送到远处伙伴身边。", familiarity: "near", ambiguityRisk: "只使用日常祝福语境；不扩展宗教或字源断言。" },
  { glyph: "神", pinyin: "shén", familiarWord: "神话", shortMeaning: "传说中有神奇力量的人物或事物", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "礻", role: "semantic" }, { glyph: "申", role: "phonetic" }], illustrationBrief: "一本神话书投出温和幻想剪影，不塑造可怕神像。", magicName: "神话剪影", magicEffect: "书页升起温和传说剪影，为树心讲一段旧故事。", familiarity: "advanced-optional", ambiguityRisk: "仅固定在神话词语；不作宗教判断，不让画面惊吓。" },
  { glyph: "跳", pinyin: "tiào", familiarWord: "跳高", shortMeaning: "双脚用力离开地面的动作", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "⻊", role: "semantic" }, { glyph: "兆", role: "phonetic" }], illustrationBrief: "伙伴轻轻跃过小水洼，落点清楚安全。", magicName: "跳光踏石", magicEffect: "三块光石依次升起，让伙伴轻快越过溪流。", familiarity: "high", ambiguityRisk: "动作不与速度评分或现实危险挑战绑定。" },
  { glyph: "们", pinyin: "men", familiarWord: "他们", shortMeaning: "放在人称后表示不止一个", chapterId: "chapter-two", band: "optional", worldTag: "component-root-core", structure: "left-right", components: [{ glyph: "亻", role: "semantic" }, { glyph: "门", role: "phonetic" }], illustrationBrief: "几位不同伙伴一起提灯前进，不标记真实身份。", magicName: "伙伴们之光", magicEffect: "几盏小灯汇成一条同行的暖光路。", familiarity: "high", ambiguityRisk: "轻声 men 固定在他们语境；不保存或要求儿童真实姓名。" },
  { glyph: "空", pinyin: "kōng", familiarWord: "天空", shortMeaning: "地面上方广阔的地方", chapterId: "chapter-three", band: "story-required", worldTag: "home-lantern-town", structure: "top-bottom", components: [{ glyph: "穴", role: "semantic" }, { glyph: "工", role: "phonetic" }], illustrationBrief: "开阔天空有柔和云层和星光，不写文字。", magicName: "天空开幕", magicEffect: "墨云向两边退开，露出安静宽阔的星空。", familiarity: "high", ambiguityRisk: "空也读 kòng；本章固定在天空 kōng 语境。", pronunciationRisk: "fixed-context-polyphone" },
  { glyph: "静", pinyin: "jìng", familiarWord: "安静", shortMeaning: "没有嘈杂声音，很平稳", chapterId: "chapter-three", band: "story-required", worldTag: "home-lantern-town", structure: "left-right", components: [{ glyph: "青", role: "uncertain" }, { glyph: "争", role: "uncertain" }], illustrationBrief: "灯街和树叶慢慢安定，声音用静止波纹表示。", magicName: "静夜停波", magicEffect: "摇晃的灯影与波纹慢慢停稳，街道恢复安静。", familiarity: "high", ambiguityRisk: "青在现代字形中可见，但不把它提升为共同字义或未经确认的声旁教学。" },
  { glyph: "睛", pinyin: "jīng", familiarWord: "眼睛", shortMeaning: "眼睛里帮助看见事物的部分", chapterId: "chapter-three", band: "story-required", worldTag: "myriad-book-harbor", structure: "left-right", components: [{ glyph: "目", role: "semantic" }, { glyph: "青", role: "phonetic" }], illustrationBrief: "角色眼中映出清楚星光，不出现孤立写实眼球。", magicName: "睛光寻星", magicEffect: "清楚目光找到藏在书页云后的星点。", familiarity: "high", ambiguityRisk: "通常出现在眼睛等固定词中；不把它单独解释成整个视觉器官。" },
  { glyph: "庭", pinyin: "tíng", familiarWord: "家庭", shortMeaning: "家里共同生活的人们", chapterId: "chapter-three", band: "story-required", worldTag: "home-lantern-town", structure: "semi-enclosure", components: [{ glyph: "广", role: "semantic" }, { glyph: "廷", role: "phonetic" }], illustrationBrief: "温暖庭院里几盏家灯围成安全空间。", magicName: "庭院归灯", magicEffect: "庭院小灯逐盏亮起，照出回家的门廊。", familiarity: "high", ambiguityRisk: "固定在家庭语境时强调共同生活，不收集任何真实家庭资料。" },
  { glyph: "歌", pinyin: "gē", familiarWord: "唱歌", shortMeaning: "可以唱出来的曲调和词", chapterId: "chapter-three", band: "optional", worldTag: "word-resonance-postgame", structure: "left-right", components: [{ glyph: "哥", role: "phonetic" }, { glyph: "欠", role: "semantic" }], illustrationBrief: "可见音符波纹从伙伴身边飘出，静音仍完整。", magicName: "歌声帆风", magicEffect: "歌声波纹鼓起书页船帆，静音时仍清楚可见。", familiarity: "high", ambiguityRisk: "声音不是规则前提；哥与欠只按结构位置呈现。" },
  { glyph: "响", pinyin: "xiǎng", familiarWord: "声响", shortMeaning: "耳朵能听见的声音", chapterId: "chapter-three", band: "optional", worldTag: "word-resonance-postgame", structure: "left-right", components: [{ glyph: "口", role: "semantic" }, { glyph: "向", role: "phonetic" }], illustrationBrief: "柔和声波碰到书港灯塔后返回，不闪烁。", magicName: "声响回港", magicEffect: "一圈可见回声找到迷雾里的书页船。", familiarity: "high", ambiguityRisk: "响也可表示发出声音；固定在声响词语且提供视觉等价信息。" },
  { glyph: "香", pinyin: "xiāng", familiarWord: "花香", shortMeaning: "闻起来让人舒服的气味", chapterId: "chapter-three", band: "story-required", worldTag: "myriad-book-harbor", structure: "top-bottom", components: [{ glyph: "禾", role: "uncertain" }, { glyph: "日", role: "uncertain" }], illustrationBrief: "花朵周围有柔和可见香气丝带，不出现文字。", magicName: "花香丝带", magicEffect: "金色香气丝带把花灯与书页船连接起来。", familiarity: "high", ambiguityRisk: "画面只表达字义联想，不把禾与日讲成字源。" },
  { glyph: "间", pinyin: "jiān", familiarWord: "中间", shortMeaning: "两个地方或时候之间", chapterId: "chapter-three", band: "story-required", worldTag: "home-lantern-town", structure: "semi-enclosure", components: [{ glyph: "门", role: "uncertain" }, { glyph: "日", role: "uncertain" }], illustrationBrief: "两盏门灯之间留出清楚通道。", magicName: "中间光隙", magicEffect: "两扇门影之间打开一条正好可走的光隙。", familiarity: "high", ambiguityRisk: "间也读 jiàn；本章固定在中间 jiān 语境，不作字源断言。", pronunciationRisk: "fixed-context-polyphone" },
  { glyph: "围", pinyin: "wéi", familiarWord: "包围", shortMeaning: "从四周环绕起来", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "full-enclosure", components: [{ glyph: "囗", role: "semantic" }, { glyph: "韦", role: "phonetic" }], illustrationBrief: "柔和光环从四周保护一株小树，保留出口。", magicName: "围光护环", magicEffect: "星光从四周围成保护环，不困住任何伙伴。", familiarity: "high", ambiguityRisk: "全包围槽位先放囗；世界效果不呈现困住或惩罚。" },
  { glyph: "道", pinyin: "dào", familiarWord: "道路", shortMeaning: "供人们通行的路线", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "semi-enclosure", components: [{ glyph: "辶", role: "semantic" }, { glyph: "首", role: "uncertain" }], illustrationBrief: "发光道路绕向星图峰顶，方向清楚。", magicName: "星图道路", magicEffect: "走之光沿山脊连起三座星图台。", familiarity: "high", ambiguityRisk: "道有多种抽象意义；主线固定在道路语境。" },
  { glyph: "眼", pinyin: "yǎn", familiarWord: "眼睛", shortMeaning: "用来看见事物的身体部位", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "left-right", components: [{ glyph: "目", role: "semantic" }, { glyph: "艮", role: "phonetic" }], illustrationBrief: "友好角色望向星光，不出现孤立写实眼球。", magicName: "眼光观星", magicEffect: "伙伴抬眼看见一颗被云遮住的星。", familiarity: "high", ambiguityRisk: "不把身体部位做成惊吓视觉；固定在眼睛语境。" },
  { glyph: "圈", pinyin: "quān", familiarWord: "圆圈", shortMeaning: "环绕一周形成的圆形", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "full-enclosure", components: [{ glyph: "囗", role: "semantic" }, { glyph: "卷", role: "phonetic" }], illustrationBrief: "一圈柔光环绕星图台，中心清楚可见。", magicName: "圆圈星轨", magicEffect: "星点沿圆圈轨道归位，点亮峰顶字图。", familiarity: "high", ambiguityRisk: "圈也读 juàn；本章固定在圆圈 quān 语境。", pronunciationRisk: "fixed-context-polyphone" },
  { glyph: "江", pinyin: "jiāng", familiarWord: "江河", shortMeaning: "水量较大的河流", chapterId: "chapter-three", band: "optional", worldTag: "word-heart-core", structure: "left-right", components: [{ glyph: "氵", role: "semantic" }, { glyph: "工", role: "phonetic" }], illustrationBrief: "宽阔江水绕过山脚流向远方。", magicName: "江流长光", magicEffect: "宽阔水光带着书页船稳稳前行。", familiarity: "near", ambiguityRisk: "只用江河普通词义，不借特定地名扩展知识负担。" },
  { glyph: "洁", pinyin: "jié", familiarWord: "清洁", shortMeaning: "干净，没有脏东西", chapterId: "chapter-three", band: "optional", worldTag: "word-heart-core", structure: "left-right", components: [{ glyph: "氵", role: "semantic" }, { glyph: "吉", role: "phonetic" }], illustrationBrief: "清水洗去石灯表面墨点，过程温和。", magicName: "清洁水纹", magicEffect: "清亮水纹洗开薄墨，让灯面重新透光。", familiarity: "near", ambiguityRisk: "不把清洁与儿童表现评价绑定；吉只作部件核对。" },
  { glyph: "树", pinyin: "shù", familiarWord: "树木", shortMeaning: "有木质树干的植物", chapterId: "chapter-three", band: "optional", worldTag: "word-heart-core", structure: "left-right", components: [{ glyph: "木", role: "semantic" }, { glyph: "对", role: "uncertain" }], illustrationBrief: "一棵枝叶清楚的大树托起星灯。", magicName: "树冠托星", magicEffect: "树冠舒展枝叶，把一盏星灯托到高处。", familiarity: "high", ambiguityRisk: "对在简化字形中作为右部件；不作字源断言。" },
  { glyph: "景", pinyin: "jǐng", familiarWord: "风景", shortMeaning: "看到的自然或城市景象", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "top-bottom", components: [{ glyph: "日", role: "semantic" }, { glyph: "京", role: "phonetic" }], illustrationBrief: "晨光照亮远山、河流和灯街的整体景象。", magicName: "风景展开", magicEffect: "一幅无字光景展开，串起已经修复的森林。", familiarity: "near", ambiguityRisk: "画面表达熟悉风景，不把日与京编成字源故事。" },
  { glyph: "晨", pinyin: "chén", familiarWord: "清晨", shortMeaning: "太阳刚升起的早上", chapterId: "chapter-three", band: "story-required", worldTag: "star-map-peak", structure: "top-bottom", components: [{ glyph: "日", role: "semantic" }, { glyph: "辰", role: "phonetic" }], illustrationBrief: "清晨柔光从山后升起，不出现时钟倒计时。", magicName: "晨光归林", magicEffect: "第一束晨光穿过书港，照到森林每条路。", familiarity: "high", ambiguityRisk: "辰需清楚大字；晨光只表现时间语境，不设置每日奖励。" },
  { glyph: "答", pinyin: "dá", familiarWord: "回答", shortMeaning: "对问题作出回应", chapterId: "chapter-three", band: "optional", worldTag: "word-heart-core", structure: "top-bottom", components: [{ glyph: "⺮", role: "uncertain" }, { glyph: "合", role: "phonetic" }], illustrationBrief: "伙伴回应另一位伙伴的提问，画面不显示对错分数。", magicName: "回答回光", magicEffect: "一问一答的可见光纹在字心两侧会合。", familiarity: "high", ambiguityRisk: "答也读 dā；本章固定在回答 dá 语境，不作正确率记录。", pronunciationRisk: "fixed-context-polyphone" },
] as const satisfies readonly NewCharacterSeed[];

const wheelProvenanceByGlyph = new Map<string, string[]>();
for (const record of CANONICAL_WHEEL_LIBRARY) {
  if (record.sourceMode !== "char") continue;
  wheelProvenanceByGlyph.set(record.result, [...(wheelProvenanceByGlyph.get(record.result) ?? []), `wheel:${record.legacyId}`]);
}

export const COMPLETE_NEW_CHARACTER_NODES = COMPLETE_NEW_CHARACTER_SEEDS.map((seed) => {
  const id = completeCharacterId(seed.glyph);
  const slots = slotsForStructure(seed.structure);
  const provenance = ["new-candidate:m0", ...(wheelProvenanceByGlyph.get(seed.glyph) ?? [])];
  const payload = { ...seed, provenance };
  return {
    id,
    glyph: seed.glyph,
    unicodeCodePoint: completeUnicodeCodePoint(seed.glyph),
    chapterId: seed.chapterId,
    band: seed.band,
    worldTag: seed.worldTag,
    structure: seed.structure,
    components: seed.components.map((component, index) => ({
      instanceId: `${id}-component-${index + 1}`,
      componentId: completeComponentId(component.glyph),
      glyph: component.glyph,
      sourceGlyph: component.glyph,
      slotId: slots[index],
      order: (index + 1) as 1 | 2,
      role: component.role,
    })),
    readingSenseIds: [completeReadingId(seed.glyph)],
    familiarWord: seed.familiarWord,
    shortMeaning: seed.shortMeaning,
    illustrationBrief: seed.illustrationBrief,
    magicName: seed.magicName,
    magicEffect: seed.magicEffect,
    meaningImageDisclaimer: "这是字义联想，不是字源说明",
    familiarity: seed.familiarity,
    ambiguityRisk: seed.ambiguityRisk,
    sourceIds: ["unicode-unihan-17", "moe-modern-components", "makemeahanzi-bddc96d", ...(provenance.length > 1 ? ["repo-wheel-audit"] : [])],
    provenance,
    revisionHash: createRevisionHash("hanzi-complete-new-character-1", payload),
  } satisfies CharacterNode;
});

export const COMPLETE_NEW_READING_SENSES = COMPLETE_NEW_CHARACTER_SEEDS.map((seed) => ({
  id: completeReadingId(seed.glyph),
  characterId: completeCharacterId(seed.glyph),
  pinyin: seed.pinyin,
  fixedPhrase: seed.familiarWord,
  shortMeaning: seed.shortMeaning,
  pronunciationRisk: "pronunciationRisk" in seed ? seed.pronunciationRisk : "low-in-fixed-phrase",
  sourceIds: ["unicode-unihan-17", "makemeahanzi-bddc96d", ...(wheelProvenanceByGlyph.has(seed.glyph) ? ["repo-wheel-audit"] : [])],
})) satisfies readonly ReadingSense[];
