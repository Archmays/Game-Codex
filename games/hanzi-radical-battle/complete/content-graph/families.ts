import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_CORE_CHARACTER_NODES } from "./core-characters";
import { completeCharacterId, completeComponentId } from "./ids";
import type { ComponentFamily, ComponentRelation, ComponentRelationKind } from "./types";

interface FamilySeed {
  readonly id: string;
  readonly name: string;
  readonly band: "story-core" | "optional-advanced";
  readonly componentGlyphs: readonly string[];
  readonly memberGlyphs: readonly string[];
  readonly worldRepresentation: string;
  readonly browserStateId: string;
  readonly childFacingExplanation: string;
  readonly relationKind: ComponentRelationKind | ((glyph: string) => ComponentRelationKind);
  readonly relationClaim: (glyph: string) => string;
}

const semanticClaim = (componentName: string) => (glyph: string) => `${glyph}里有${componentName}，它给字义提供一条线索；完整意思仍要看${glyph}的固定词语。`;

const FAMILY_SEEDS = [
  { id: "family-water", name: "水的清泉字脉", band: "story-core", componentGlyphs: ["水", "氵"], memberGlyphs: ["清", "河", "海", "洋", "江", "洁"], worldRepresentation: "清泉沿六块刻着完整字的石头流动，每块石头保留自己的词语图景。", browserStateId: "family-water-stream", childFacingExplanation: "这些字都有三点水，常带来水相关的意思线索。", relationKind: "semantic-component", relationClaim: semanticClaim("三点水") },
  { id: "family-hand", name: "手的指引字脉", band: "story-core", componentGlyphs: ["手", "扌", "龵"], memberGlyphs: ["看", "指"], worldRepresentation: "手形叶片与指路光线连接两块完整字碑。", browserStateId: "family-hand-guide", childFacingExplanation: "扌和龵都与手形有关；它们在字里的位置不同。", relationKind: "semantic-component", relationClaim: semanticClaim("手形部件") },
  { id: "family-foot", name: "足的脚印字脉", band: "story-core", componentGlyphs: ["足", "⻊", "𧾷"], memberGlyphs: ["跑", "路", "跳"], worldRepresentation: "三串脚印分别通向跑步、道路和跳跃的完整字景。", browserStateId: "family-foot-trail", childFacingExplanation: "这些字都有足字旁，常给脚和行走动作提供意思线索。", relationKind: "semantic-component", relationClaim: semanticClaim("足字旁") },
  { id: "family-heart", name: "心的心灯字脉", band: "story-core", componentGlyphs: ["心", "忄", "⺗"], memberGlyphs: ["情", "思"], worldRepresentation: "两盏心灯连接心情与思考的完整字光。", browserStateId: "family-heart-lanterns", childFacingExplanation: "忄和心都能给心里感受或思考提供意思线索。", relationKind: "semantic-component", relationClaim: semanticClaim("心形部件") },
  { id: "family-speech", name: "言的回声字脉", band: "story-core", componentGlyphs: ["言", "讠"], memberGlyphs: ["请", "语"], worldRepresentation: "两圈可见回声从言字旁出发，分别抵达请问与语言。", browserStateId: "family-speech-echo", childFacingExplanation: "这些字都有言字旁，常给说话和表达提供意思线索。", relationKind: "semantic-component", relationClaim: semanticClaim("言字旁") },
  { id: "family-wood", name: "木的树冠字脉", band: "story-core", componentGlyphs: ["木"], memberGlyphs: ["林", "松", "树"], worldRepresentation: "三道树根连接树林、松树和树木的完整字碑。", browserStateId: "family-wood-canopy", childFacingExplanation: "这些字都能看见木，常与树木提供意思联系。", relationKind: "semantic-component", relationClaim: semanticClaim("木") },
  { id: "family-grass", name: "艹的花园字脉", band: "story-core", componentGlyphs: ["艹"], memberGlyphs: ["花", "草", "苗", "菜"], worldRepresentation: "草字头化成四片叶冠，分别照亮花、草、苗和菜。", browserStateId: "family-grass-garden", childFacingExplanation: "这些字都有草字头，常与植物提供意思联系。", relationKind: "semantic-component", relationClaim: semanticClaim("草字头") },
  { id: "family-door", name: "门的长廊字脉", band: "story-core", componentGlyphs: ["门"], memberGlyphs: ["闪", "问", "闭", "间", "们"], worldRepresentation: "五扇门影保留各自完整字，只有门形轮廓用同色细线连接。", browserStateId: "family-door-corridor", childFacingExplanation: "这些现代字形里都能看见门形；这条线只说明字形连接，不说明共同意思。", relationKind: "modern-visual-link-only", relationClaim: (glyph) => `${glyph}的现代字形里能看见门形；完整字义要单独学习，不能从门形直接猜。` },
  { id: "family-enclosure", name: "囗的围合字脉", band: "story-core", componentGlyphs: ["囗"], memberGlyphs: ["园", "回", "国", "图", "圆", "围", "圈"], worldRepresentation: "七个不同内芯的外框沿环形城路排开，外框与里面始终分层。", browserStateId: "family-enclosure-ring", childFacingExplanation: "这些字都有大口框囗；它与小口口不是同一个部件。", relationKind: "semantic-component", relationClaim: semanticClaim("大口框囗") },
  { id: "family-roof", name: "宀的家灯字脉", band: "story-core", componentGlyphs: ["宀"], memberGlyphs: ["安", "家"], worldRepresentation: "两盏屋檐灯连接安全与家庭的完整字景。", browserStateId: "family-roof-home", childFacingExplanation: "这些字上面都有宝盖头；完整意思仍由完整字和词语确认。", relationKind: "semantic-component", relationClaim: semanticClaim("宝盖头") },
  { id: "family-walk", name: "辶的行路字脉", band: "story-core", componentGlyphs: ["辶"], memberGlyphs: ["进", "迷", "道"], worldRepresentation: "三条弯曲光路分别通往前进、迷路和道路的完整场景。", browserStateId: "family-walk-paths", childFacingExplanation: "这些字都有走之，常给行走或道路提供意思线索。", relationKind: "semantic-component", relationClaim: semanticClaim("走之") },
  { id: "family-qing-sound", name: "青的声音字脉", band: "story-core", componentGlyphs: ["青"], memberGlyphs: ["清", "晴", "情", "请", "睛", "静"], worldRepresentation: "六条青色根线连接不同左部件；静使用虚线并标成现代字形连接。", browserStateId: "family-qing-sound", childFacingExplanation: "清、晴、情、请、睛里的青提供读音线索；它们的完整意思也不同。静只保留谨慎的现代字形连接。", relationKind: (glyph) => glyph === "静" ? "modern-visual-link-only" : "phonetic-component", relationClaim: (glyph) => glyph === "静" ? "静里能看见青；这里只连接现代字形，不把它说成共同字义或确定声旁。" : `${glyph}里有青，读音有相近线索；完整字义还要看${glyph}本身。` },
  { id: "family-person", name: "人的伙伴字脉", band: "optional-advanced", componentGlyphs: ["人", "亻"], memberGlyphs: ["你", "他", "们"], worldRepresentation: "三位匿名伙伴的灯影连接你、他、们三个完整字。", browserStateId: "family-person-companions", childFacingExplanation: "这些字都有单人旁，常与人提供意思联系。", relationKind: "semantic-component", relationClaim: semanticClaim("单人旁") },
  { id: "family-food", name: "食的饭香字脉", band: "optional-advanced", componentGlyphs: ["食", "饣"], memberGlyphs: ["饱", "饭"], worldRepresentation: "两缕饭香从食字旁连接吃饱和米饭。", browserStateId: "family-food-aroma", childFacingExplanation: "这些字都有食字旁，常与吃和食物提供意思联系。", relationKind: "semantic-component", relationClaim: semanticClaim("食字旁") },
  { id: "family-metal", name: "金的清响字脉", band: "optional-advanced", componentGlyphs: ["金", "钅"], memberGlyphs: ["钟", "钱"], worldRepresentation: "两圈金属柔光连接时钟和钱的完整字景，不出现购买界面。", browserStateId: "family-metal-chime", childFacingExplanation: "这些字都有金字旁，常与金属提供意思联系。", relationKind: "semantic-component", relationClaim: semanticClaim("金字旁") },
  { id: "family-clothing", name: "衣的布纹字脉", band: "optional-advanced", componentGlyphs: ["衣", "衤"], memberGlyphs: ["初", "被"], worldRepresentation: "两条柔软布纹连接最初和被子的完整词景。", browserStateId: "family-clothing-ribbon", childFacingExplanation: "这些字都有衣字旁；它提供衣物线索时也要结合完整词语。", relationKind: "semantic-component", relationClaim: semanticClaim("衣字旁") },
  { id: "family-spirit", name: "示的星灯字脉", band: "optional-advanced", componentGlyphs: ["示", "礻"], memberGlyphs: ["祝", "神"], worldRepresentation: "两盏非宗教化星灯连接祝福与神话的固定词语场景。", browserStateId: "family-spirit-star", childFacingExplanation: "这些字都有示字旁；本游戏只在祝福和神话的固定词语中学习。", relationKind: "semantic-component", relationClaim: semanticClaim("示字旁") },
  { id: "family-bao-sound", name: "包的声音字脉", band: "optional-advanced", componentGlyphs: ["包"], memberGlyphs: ["包", "跑", "饱"], worldRepresentation: "包位于中心，跑和饱分别用足字旁、食字旁光线连接。", browserStateId: "family-bao-sound", childFacingExplanation: "跑和饱里的包提供读音线索；左边部件帮助分清完整意思。", relationKind: (glyph) => glyph === "包" ? "same-form" : "phonetic-component", relationClaim: (glyph) => glyph === "包" ? "包是这条字脉的完整中心字。" : `${glyph}里有包，读音有相近线索；完整意思要看左边部件和固定词语。` },
] as const satisfies readonly FamilySeed[];

const coreGlyphs = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.glyph));
for (const seed of FAMILY_SEEDS) {
  for (const glyph of seed.memberGlyphs) if (!coreGlyphs.has(glyph)) throw new Error(`Family ${seed.id} references non-core glyph ${glyph}`);
}

export const COMPLETE_COMPONENT_RELATIONS = FAMILY_SEEDS.flatMap((seed) => seed.memberGlyphs.map((glyph) => {
  const kind = typeof seed.relationKind === "function" ? seed.relationKind(glyph) : seed.relationKind;
  const componentGlyph = seed.componentGlyphs.find((candidate) => COMPLETE_CORE_CHARACTER_NODES.find((character) => character.glyph === glyph)?.components.some((component) => component.glyph === candidate)) ?? seed.componentGlyphs[0];
  return {
    id: `relation-${seed.id}-${completeCharacterId(glyph)}`,
    familyId: seed.id,
    characterId: completeCharacterId(glyph),
    componentId: completeComponentId(componentGlyph),
    kind,
    childFacingClaim: seed.relationClaim(glyph),
    sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d", "repo-wheel-audit"],
  } satisfies ComponentRelation;
}));

export const COMPLETE_COMPONENT_FAMILIES = FAMILY_SEEDS.map((seed) => {
  const payload = {
    id: seed.id,
    name: seed.name,
    band: seed.band,
    componentIds: seed.componentGlyphs.map(completeComponentId),
    memberCharacterIds: seed.memberGlyphs.map(completeCharacterId),
    relationIds: COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === seed.id).map((relation) => relation.id),
    worldRepresentation: seed.worldRepresentation,
    browserStateId: seed.browserStateId,
    childFacingExplanation: seed.childFacingExplanation,
    sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d", "repo-wheel-audit"],
  };
  return { ...payload, revisionHash: createRevisionHash("hanzi-complete-family-1", payload) } satisfies ComponentFamily;
});

export const COMPLETE_FAMILY_COMPONENT_GLYPHS = [...new Set(FAMILY_SEEDS.flatMap((seed) => seed.componentGlyphs))];
