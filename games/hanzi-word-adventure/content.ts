/** Whole simplified glyphs. 林 and 明 use ordered modern component slots; light magic is not etymology. */
export interface WordRecord {
  id: string; glyph: string; pinyin: string; structure: string;
  components: { glyph: string; slot: 'left' | 'right'; role: '部件'; name: string }[];
  meaning: string; word: string; scene: string; familiarity: 'common-family-word';
  ageFit: 'family-guided-reading'; world: 'chinese'; source: string;
}
const words = [
  ['sun', '日', 'rì', '独体', '太阳。', '日光', '日只作合明材料，不单独照亮影路'],
  ['moon', '月', 'yuè', '独体', '月亮。', '月亮', '月只作合明材料，不单独照亮影路'],
  ['bright', '明', 'míng', '左右', '明亮，有光。', '明亮', '完整明字是游戏光源；左日右月为现代字形部件'],
  ['shadow', '影', 'yǐng', '左右', '物体挡住光线时形成的暗处。', '影子', '影格由明照亮才可走，是明确标出的游戏规则'],
  ['person', '人', 'rén', '独体', '人；这里是你操纵的行路人。', '行人', '完整的人字沿路移动'],
  ['wood', '木', 'mù', '独体', '树木；也指木头。', '木头', '岸上的木挡路，水上的木搭桥；这是游戏规则'],
  ['forest', '林', 'lín', '左右', '长在一处的许多树木。', '树林', '可搬的完整林字；拆合只表现现代字形部件'],
  ['not', '不', 'bù', '独体', '用在动作前，表示否定。', '不开', '可搬到登记短句中的否定字；不读作其他音'],
  ['home', '家', 'jiā', '上下', '家人一起生活的地方。', '回家', '归途尽头的完整家字'],
  ['door', '门', 'mén', '独体', '供人进出的出入口。', '开门', '门字与绑定的门开或门不开同步'],
  ['wind', '风', 'fēng', '半包围', '流动的空气。', '风吹', '带方向箭头的风字；只随有效行动送人到落脚处'],
  ['water', '水', 'shuǐ', '独体', '河流里的水。', '河水', '完整水字轻轻流动；木桥下面仍是水'],
  ['open', '开', 'kāi', '独体', '使关闭着的东西打开。', '开门', '墙上门的固定谓语，不能任意改写'],
  ['blow', '吹', 'chuī', '左右', '空气流动。', '风吹', '墙上风的固定谓语，不能任意改写'],
  ['mountain', '山', 'shān', '独体', '地面上高起的部分。', '高山', '山字连成不可走的山崖；远处小字仅为景深'],
  ['path', '路', 'lù', '左右', '供人行走的通道。', '走路', '前四房间发光的路字是通向下一处的出口'],
] as const;
export const WORDS: WordRecord[] = words.map(([id, glyph, pinyin, structure, meaning, word, scene]) => ({
  id: `hway-${id}`, glyph, pinyin, structure, meaning, word, scene,
  components: glyph === '明' ? [{ glyph: '日', slot: 'left', role: '部件', name: '日字部件' }, { glyph: '月', slot: 'right', role: '部件', name: '月字部件' }] : glyph === '林' ? [{ glyph: '木', slot: 'left', role: '部件', name: '木字部件' }, { glyph: '木', slot: 'right', role: '部件', name: '木字部件' }] : [],
  familiarity: 'common-family-word', ageFit: 'family-guided-reading', world: 'chinese', source: `https://www.zdic.net/hans/${glyph}`,
}));
export const wordRecord = (glyph: string) => WORDS.find(w => w.glyph === glyph);
export const FONT_STACK = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const WORLD_RULES = [
  '人每次走一格，只能在路、开着的门、停风格或木桥上落脚。山崖和墙上短句不能走。',
  '点字先查看；走到它的上下左右，才能拿、放、拆或合。手里最多带一个字，林也算一个。',
  '岸上的木、林、不挡路。只有木能放在水格上搭桥；拿回木，下面仍是水。不能拿走脚下的木。',
  '林在岸上才能拆。先查看左拆或右拆的两格预览：一格有人、有字或不是岸，整步都不执行。',
  '手里一枚木，身旁一枚木，可以合成林。木在左、木在右；先拿哪枚都一样，不增加材料。',
  '墙上只登记门开／门不开、风吹／风不吹。搬走句中的不，马上变回肯定；只有不可以放入空字位。',
  '风吹时，踏入风格就沿箭头到下一格，手里字一起过去；不能逆风走回来。风格不能放字，停风也一样。',
  '日和月可合成明，明可拆为左日右月；只表现现代部件，不把光魔法当作字源。只有明发光，日和月不照路。',
  '明从所在格（手持时从人格）沿上下左右通格照三步，可绕角；山崖、短句和关门挡光。标明“亮”的影格才可走，明也占一件携带额度。',
  '把明放下、拿走或拆开时，若会让人脚下的影格失去光，整步拒绝；没有材料被吞掉。暗影中的字不能远程拿走。',
  '不动就没有规则时间。无效动作不消费；一步撤销同时恢复人、手里字、桥、短句和出口状态。',
] as const;
