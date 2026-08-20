import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_CORE_CHARACTER_NODES } from "./core-characters";
import { completeCharacterId, completeReadingId } from "./ids";
import type { WordNode } from "./types";

interface WordSeed {
  readonly id: string;
  readonly glyphs: readonly [string, string];
  readonly pinyin: string;
  readonly shortMeaning: string;
  readonly context: string;
  readonly worldMagic: string;
  readonly band: "story" | "optional-postgame";
  readonly reverseOrderStatus?: "rejected-not-word" | "rejected-wrong-context";
  readonly ambiguityRisk?: string;
  readonly sourceNote?: string;
}

const STORY_WORD_SEEDS = [
  { id: "word-flower-garden", glyphs: ["花", "园"], pinyin: "huā yuán", shortMeaning: "种着花草、供人观赏活动的园地", context: "花园里的灯苗正等两个完整字来唤醒。", worldMagic: "花灯沿园路依次亮起，露出安全出口。" },
  { id: "word-pine-grove", glyphs: ["松", "林"], pinyin: "sōng lín", shortMeaning: "长着许多松树的树林", context: "松林树冠挡住墨风，为伙伴留出前路。", worldMagic: "松针绿光从一棵树连到整片树林。" },
  { id: "word-clear-sky", glyphs: ["晴", "空"], pinyin: "qíng kōng", shortMeaning: "晴朗、没有雨云的天空", context: "云幕退开后，晴空照亮清泉石谷。", worldMagic: "明亮天光铺成一条不刺眼的光路。", ambiguityRisk: "空也读 kòng；本词固定读 qíng kōng。" },
  { id: "word-ocean", glyphs: ["海", "洋"], pinyin: "hǎi yáng", shortMeaning: "广阔相连的海水", context: "书页船要借海洋的水光驶向远岸。", worldMagic: "两道蓝色水纹会合成平稳洋流。" },
  { id: "word-quiet", glyphs: ["安", "静"], pinyin: "ān jìng", shortMeaning: "没有嘈杂声音，很平稳", context: "灯街安静下来，伙伴能看见远处风铃的轻摆。", worldMagic: "摇晃的灯影和波纹慢慢停稳。", reverseOrderStatus: "rejected-wrong-context", ambiguityRisk: "反序“静安”可见于专名；本局明确学习普通词语“安静”。" },
  { id: "word-hello", glyphs: ["你", "好"], pinyin: "nǐ hǎo", shortMeaning: "见面时使用的友好问候", context: "两位匿名伙伴在花园路口互相问好。", worldMagic: "两盏伙伴灯互相回应，打开同行小径。" },
  { id: "word-go-home", glyphs: ["回", "家"], pinyin: "huí jiā", shortMeaning: "回到自己生活的家", context: "最后一盏家灯为伙伴指出回家方向。", worldMagic: "温暖灯线从森林一路连回家门。" },
  { id: "word-flower-fragrance", glyphs: ["花", "香"], pinyin: "huā xiāng", shortMeaning: "花朵散发的香气", context: "花港里，花香为书页船指出方向。", worldMagic: "金色香气丝带把花灯和书页船连接起来。", reverseOrderStatus: "rejected-wrong-context", ambiguityRisk: "反序“香花”可以指有香气的花；本局场景明确学习表示气味的“花香”。" },
  { id: "word-running-track", glyphs: ["跑", "道"], pinyin: "pǎo dào", shortMeaning: "供跑步使用的道路", context: "星图峰的跑道被墨点切成了几段。", worldMagic: "连续脚印把断开的环形跑道重新接好。" },
  { id: "word-please-ask", glyphs: ["请", "问"], pinyin: "qǐng wèn", shortMeaning: "有礼貌地提出问题", context: "伙伴在叶门前用请问发出温和回声。", worldMagic: "礼貌声纹让愿意回应的叶门慢慢打开。" },
  { id: "word-early-morning", glyphs: ["清", "晨"], pinyin: "qīng chén", shortMeaning: "天刚亮后的早晨", context: "清晨的第一束柔光落在字脉树心。", worldMagic: "晨雾变薄，清亮小路从树根间出现。" },
  { id: "word-scenery", glyphs: ["风", "景"], pinyin: "fēng jǐng", shortMeaning: "可以观看的自然景色", context: "峰顶风景在墨云散开后重新显现。", worldMagic: "风把云幕推开，星河与树林同时亮起。" },
] as const satisfies readonly Omit<WordSeed, "band">[];

const OPTIONAL_WORD_SEEDS = [
  { id: "word-star", glyphs: ["明", "星"], pinyin: "míng xīng", shortMeaning: "明亮的星星", context: "观星卷里，一颗明星在云后发光。", worldMagic: "星光在字卷上留下清楚轨迹。" },
  { id: "word-tomorrow-morning", glyphs: ["明", "早"], pinyin: "míng zǎo", shortMeaning: "明天早晨", context: "故事档案把下一段约在明早继续。", worldMagic: "晨光书签安稳停在下一页，不设置限时。" },
  { id: "word-tabby-cat", glyphs: ["花", "猫"], pinyin: "huā māo", shortMeaning: "身上有花纹的猫", context: "花猫在修好的园墙边晒太阳。", worldMagic: "柔和花纹光为小猫照亮回窝路。" },
  { id: "word-between-trees", glyphs: ["林", "间"], pinyin: "lín jiān", shortMeaning: "树林里面或树木之间", context: "林间小路藏着一页可选字卷。", worldMagic: "树木之间打开一条清楚光隙。" },
  { id: "word-eyes", glyphs: ["眼", "睛"], pinyin: "yǎn jīng", shortMeaning: "用来看见事物的身体部位", context: "观星塔用眼睛找到隐藏的星光。", worldMagic: "两束清楚星光在灯塔顶端会合。" },
  { id: "word-look-at-picture", glyphs: ["看", "图"], pinyin: "kàn tú", shortMeaning: "观看图画或图示", context: "伙伴先看图，再选择通往书港的路线。", worldMagic: "无文字光图展开，标出可继续探索的路。" },
  { id: "word-return-country", glyphs: ["回", "国"], pinyin: "huí guó", shortMeaning: "回到自己的国家", context: "远行字卷讲完后，书页船准备回国。", worldMagic: "外框光门为远行船标出归航方向。" },
  { id: "word-surround", glyphs: ["包", "围"], pinyin: "bāo wéi", shortMeaning: "从四周环绕起来", context: "保护光从四周包围小树，但始终留有出口。", worldMagic: "柔和光环围住墨风，不困住任何伙伴。" },
  { id: "word-wallet", glyphs: ["钱", "包"], pinyin: "qián bāo", shortMeaning: "装钱和卡片的小包", context: "普通钱包落在门廊边，等伙伴送回失物架。", worldMagic: "几枚金属光片排好，照亮失物架。" },
  { id: "word-sea-breeze", glyphs: ["海", "风"], pinyin: "hǎi fēng", shortMeaning: "从海面吹来的风", context: "海风鼓起书页船的小帆。", worldMagic: "蓝色风纹让船平稳穿过花港。" },
  { id: "word-breakfast", glyphs: ["早", "饭"], pinyin: "zǎo fàn", shortMeaning: "早晨吃的一顿饭", context: "伙伴吃过早饭后再继续探索，不设置每日奖励。", worldMagic: "暖饭香让营地灯苗恢复柔光。" },
  { id: "word-cats-eye", glyphs: ["猫", "眼"], pinyin: "māo yǎn", shortMeaning: "猫的眼睛", context: "猫眼映出一颗藏在树叶后的星。", worldMagic: "细小反光点提示被遮住的星图位置。" },
  { id: "word-clean", glyphs: ["清", "洁"], pinyin: "qīng jié", shortMeaning: "干净，没有脏东西", context: "清洁水纹洗去石灯表面的薄墨。", worldMagic: "清水让灯面重新透出柔光。" },
  { id: "word-river-course", glyphs: ["河", "道"], pinyin: "hé dào", shortMeaning: "河水流过的路线", context: "河道里的石头需要水光重新连接。", worldMagic: "水纹沿真实河道绕开石块前进。" },
  { id: "word-rivers", glyphs: ["江", "河"], pinyin: "jiāng hé", shortMeaning: "江和河，也泛指河流", context: "江河字卷把两种水路画在同一张光图上。", worldMagic: "宽窄水光在远处汇合，托起书页船。" },
  { id: "word-they", glyphs: ["他", "们"], pinyin: "tā men", shortMeaning: "称呼不止一个另外的人", context: "他们一起提灯修好门廊，不记录真实姓名。", worldMagic: "几盏匿名伙伴灯汇成同行暖光。" },
  { id: "word-family", glyphs: ["家", "庭"], pinyin: "jiā tíng", shortMeaning: "共同生活的家人和生活单位", context: "家庭灯影只表现温暖归处，不收集家庭资料。", worldMagic: "庭院里的家灯逐盏亮起。" },
  { id: "word-vegetable-garden", glyphs: ["菜", "园"], pinyin: "cài yuán", shortMeaning: "种蔬菜的园地", context: "菜园叶片在水光回来后重新舒展。", worldMagic: "绿叶光沿园路排成一圈。" },
  { id: "word-point-way", glyphs: ["指", "路"], pinyin: "zhǐ lù", shortMeaning: "指出应该走的方向", context: "伙伴用指路光找到安全出口。", worldMagic: "手形柔光落在正确林路上。" },
  { id: "word-get-lost", glyphs: ["迷", "路"], pinyin: "mí lù", shortMeaning: "找不到正确方向", context: "迷路时所有已得进度保留，出口提示始终可见。", worldMagic: "米粒星光沿弯路标出返回点。" },
  { id: "word-train-of-thought", glyphs: ["思", "路"], pinyin: "sī lù", shortMeaning: "思考时前后连接的办法或线索", context: "伙伴把散乱叶片整理成一条思路。", worldMagic: "叶片光图按前后关系连接起来。" },
  { id: "word-space", glyphs: ["空", "间"], pinyin: "kōng jiān", shortMeaning: "事物存在或活动的地方", context: "书港给每艘小船留出安全空间。", worldMagic: "两盏门灯之间展开宽阔光区。", ambiguityRisk: "空和间都有其他读音；本词固定读 kōng jiān。" },
  { id: "word-mute", glyphs: ["静", "音"], pinyin: "jìng yīn", shortMeaning: "让设备或场景不发出声音", context: "静音后所有规则仍用图形和文字完整显示。", worldMagic: "声波变成静止可见光纹，规则没有消失。" },
  { id: "word-circle", glyphs: ["圆", "圈"], pinyin: "yuán quān", shortMeaning: "环绕一周形成的圆形", context: "星点沿圆圈轨道回到各自位置。", worldMagic: "完整光环修好星图峰的边缘。", ambiguityRisk: "圈也读 juàn；本词固定读 yuán quān。" },
] as const satisfies readonly Omit<WordSeed, "band">[];

const WORD_SEEDS: readonly WordSeed[] = [
  ...STORY_WORD_SEEDS.map((seed) => ({ ...seed, band: "story" as const })),
  ...OPTIONAL_WORD_SEEDS.map((seed) => ({ ...seed, band: "optional-postgame" as const })),
];

const coreGlyphs = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.glyph));

export const COMPLETE_WORD_NODES = WORD_SEEDS.map((seed) => {
  for (const glyph of seed.glyphs) {
    if (!coreGlyphs.has(glyph)) throw new Error(`Word ${seed.id} references non-core glyph ${glyph}`);
  }
  const payload = {
    id: seed.id,
    glyphs: seed.glyphs,
    characterIds: seed.glyphs.map(completeCharacterId) as [string, string],
    readingSenseIds: seed.glyphs.map((glyph) => completeReadingId(glyph)) as [string, string],
    pinyin: seed.pinyin,
    shortMeaning: seed.shortMeaning,
    context: seed.context,
    worldMagic: seed.worldMagic,
    band: seed.band,
    reverseOrderStatus: seed.reverseOrderStatus ?? "rejected-not-word" as const,
    ambiguityRisk: seed.ambiguityRisk ?? "反序不作为本局自然词语；拒绝后保留全部进度。",
    sourceIds: ["moe-dictionary-words", "repo-word-audit-v3"],
    sourceNote: seed.sourceNote ?? "固定词序、读音和普通词义由教育部辞典交叉核对；V3 派生层限定儿童场景与反序处置。",
  };
  return { ...payload, revisionHash: createRevisionHash("hanzi-complete-word-1", payload) } satisfies WordNode;
});

if (COMPLETE_WORD_NODES.length !== 36 || COMPLETE_WORD_NODES.filter((word) => word.band === "story").length !== 12) {
  throw new Error("Complete word contract requires 12 story and 24 optional words");
}

export const COMPLETE_WORD_REVISION = createRevisionHash("hanzi-complete-words-1", COMPLETE_WORD_NODES);
