import { createRevisionHash } from "../../v2/content/revision-hash";
import { CANONICAL_WHEEL_LIBRARY } from "../../v2/wheel-workshop/library/canonical-wheel-library";
import { PLAYABLE_WHEEL_MANIFEST, WHEEL_GRADE_OPTIONS } from "../../v2/wheel-workshop/library/playable-wheel-manifest";
import type { LegacyWheelGradeId } from "../../v2/wheel-workshop/library/legacy-wheel-types";
import type {
  PlayableWheelRecord,
  WheelComponentRole,
  WheelSlotId,
  WheelStructure,
} from "../../v2/wheel-workshop/types";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import { completeCharacterId } from "../content-graph/ids";
import { COMPLETE_WORD_NODES } from "../content-graph/words";

export interface CompleteWheelRecord extends PlayableWheelRecord {
  readonly characterNodeId: string;
  readonly familyIds: readonly string[];
  readonly wordIds: readonly string[];
  readonly adapterRevisionHash: string;
}

interface AddedWheelBlueprint {
  readonly legacyId: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
}

const ADDED_WHEEL_BLUEPRINTS = [
  { legacyId: "p1.char.004", familiarWord: "看见", shortMeaning: "用眼睛注意事物，也可以表示阅读。" },
  { legacyId: "p1.char.006", familiarWord: "树林", shortMeaning: "成片生长的许多树木。" },
  { legacyId: "p1.char.009", familiarWord: "问题", shortMeaning: "想知道时提出疑问。" },
  { legacyId: "p1.char.011", familiarWord: "妈妈", shortMeaning: "家庭中称呼母亲的常用词。" },
  { legacyId: "p2.char.004", familiarWord: "心情", shortMeaning: "心里的感受。" },
  { legacyId: "p2.char.003", familiarWord: "请求", shortMeaning: "有礼貌地希望别人帮助或同意。" },
  { legacyId: "p2.char.008", familiarWord: "跑步", shortMeaning: "双脚较快地向前移动。" },
  { legacyId: "p2.char.015", familiarWord: "河水", shortMeaning: "在河道里流动的水。" },
  { legacyId: "p3.char.009", familiarWord: "天空", shortMeaning: "地面上方广阔的地方。" },
  { legacyId: "p3.char.012", familiarWord: "宝贝", shortMeaning: "珍爱的东西，也可作亲切称呼。" },
  { legacyId: "p3.char.014", familiarWord: "毛笔", shortMeaning: "写字和画画使用的工具。" },
  { legacyId: "p3.char.015", familiarWord: "思考", shortMeaning: "在心里认真地想。" },
  { legacyId: "p4.char.011", familiarWord: "淡水", shortMeaning: "含盐很少的水，也可表示颜色或味道不浓。" },
  { legacyId: "p4.char.014", familiarWord: "作文", shortMeaning: "进行、完成一件事；在作文中表示写文章。" },
  { legacyId: "p4.char.015", familiarWord: "手指", shortMeaning: "手掌前端可以弯曲的部分，也可表示指出。" },
  { legacyId: "p4.char.016", familiarWord: "讨论", shortMeaning: "几个人交换想法，一起研究问题。" },
  { legacyId: "p5.char.009", familiarWord: "芬芳", shortMeaning: "花草散发的好闻气味。" },
  { legacyId: "p5.char.010", familiarWord: "芳香", shortMeaning: "好闻的香气。" },
  { legacyId: "p5.char.012", familiarWord: "客人", shortMeaning: "被邀请来做客或来访的人。" },
  { legacyId: "p5.char.014", familiarWord: "回答", shortMeaning: "对问题作出回应。" },
  { legacyId: "p6.char.010", familiarWord: "零星", shortMeaning: "数量少而分散，也表示数字零。" },
  { legacyId: "p6.char.011", familiarWord: "穿过", shortMeaning: "从一边经过内部到达另一边。" },
  { legacyId: "p6.char.015", familiarWord: "迷路", shortMeaning: "找不到正确的方向。" },
  { legacyId: "p6.char.016", familiarWord: "道路", shortMeaning: "供人们通行的路线。" },
  { legacyId: "j1.char.011", familiarWord: "根系", shortMeaning: "植物在土里吸收水分并固定身体的部分。" },
  { legacyId: "j1.char.012", familiarWord: "停止", shortMeaning: "不再继续移动或进行。" },
  { legacyId: "j1.char.013", familiarWord: "好像", shortMeaning: "在某些方面看起来相似。" },
  { legacyId: "j1.char.014", familiarWord: "道谢", shortMeaning: "向别人表达感谢。" },
  { legacyId: "j2.char.010", familiarWord: "健康", shortMeaning: "身体和生活状态良好。" },
  { legacyId: "j2.char.011", familiarWord: "走廊", shortMeaning: "连接房间或建筑部分的通道。" },
  { legacyId: "j2.char.014", familiarWord: "屋子", shortMeaning: "供人居住或活动的房间、房屋。" },
  { legacyId: "j2.char.015", familiarWord: "云层", shortMeaning: "成层分布的一片云。" },
  { legacyId: "j3.char.009", familiarWord: "圆圈", shortMeaning: "环绕一周形成的圆形。" },
  { legacyId: "j3.char.011", familiarWord: "逃跑", shortMeaning: "为了离开危险或不愿停留而跑开。" },
  { legacyId: "j3.char.012", familiarWord: "足迹", shortMeaning: "脚走过后留下的痕迹。" },
  { legacyId: "j3.char.017", familiarWord: "医生", shortMeaning: "帮助人们检查和治疗疾病的专业人员。" },
] as const satisfies readonly AddedWheelBlueprint[];

function structureParts(structure: WheelStructure): {
  readonly slots: readonly [WheelSlotId, WheelSlotId];
  readonly roles: readonly [WheelComponentRole, WheelComponentRole];
} {
  if (structure === "left-right") return { slots: ["left", "right"], roles: ["left-component", "right-component"] };
  if (structure === "top-bottom") return { slots: ["top", "bottom"], roles: ["top-component", "bottom-component"] };
  return { slots: ["outer", "inner"], roles: ["enclosing-component", "inner-component"] };
}

function makeAddedRecord(blueprint: AddedWheelBlueprint): PlayableWheelRecord {
  const audit = CANONICAL_WHEEL_LIBRARY.find((record) => record.legacyId === blueprint.legacyId);
  if (!audit || audit.sourceMode !== "char" || (audit.auditStatus !== "validated" && audit.auditStatus !== "corrected-derived-record")) {
    throw new Error(`V3 wheel addition is not audit-approved: ${blueprint.legacyId}`);
  }
  if (audit.structure === "unknown" || audit.structure === "not-applicable" || audit.orderedComponents.length !== 2) {
    throw new Error(`V3 wheel addition lacks a two-slot structure: ${blueprint.legacyId}`);
  }
  if (!audit.familiarWords.includes(blueprint.familiarWord)) {
    throw new Error(`V3 wheel familiar word is not preserved by audit: ${blueprint.legacyId} ${blueprint.familiarWord}`);
  }
  const { slots, roles } = structureParts(audit.structure);
  const stable = {
    id: `wheel-${audit.legacyId.replaceAll(".", "-")}`,
    legacyId: audit.legacyId,
    sourceGradeId: audit.sourceGradeId,
    sourceGradeLabel: audit.sourceGradeLabel,
    curriculumStage: audit.curriculumStage,
    alignmentStatus: audit.alignmentStatus,
    glyph: audit.result,
    pinyin: audit.pinyin,
    familiarWord: blueprint.familiarWord,
    spokenPhrase: `${audit.result}，${blueprint.familiarWord}`,
    shortMeaning: blueprint.shortMeaning,
    meaningClue: blueprint.familiarWord.includes(audit.result) ? blueprint.familiarWord.replace(audit.result, "□") : `想一想：${blueprint.familiarWord}`,
    structure: audit.structure,
    orderedComponents: [audit.orderedComponents[0], audit.orderedComponents[1]] as const,
    slotIds: slots,
    componentRoles: roles,
    illustrationBrief: `text-structure-only：用“${blueprint.familiarWord}”的柔和字义光与真实结构槽位表现，不把联想画面写成字源。`,
    sourceEvidence: audit.sourceEvidence,
    auditStatus: audit.auditStatus,
  } as const;
  return { ...stable, revisionHash: createRevisionHash("wheel-workshop-playable-v3-adapter-1", stable) };
}

function withGraphLinks(record: PlayableWheelRecord): CompleteWheelRecord {
  const characterNodeId = completeCharacterId(record.glyph);
  const stable = {
    ...record,
    characterNodeId,
    familyIds: COMPLETE_COMPONENT_FAMILIES.filter((family) => family.memberCharacterIds.includes(characterNodeId)).map((family) => family.id),
    wordIds: COMPLETE_WORD_NODES.filter((word) => word.characterIds.includes(characterNodeId)).map((word) => word.id),
  };
  return { ...stable, adapterRevisionHash: createRevisionHash("hanzi-complete-wheel-adapter-1", stable) };
}

const addedRecords = ADDED_WHEEL_BLUEPRINTS.map(makeAddedRecord);

export const COMPLETE_WHEEL_MANIFEST = (["p1", "p2", "p3", "p4", "p5", "p6", "j1", "j2", "j3"] as const)
  .flatMap((gradeId) => [
    ...PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId),
    ...addedRecords.filter((record) => record.sourceGradeId === gradeId),
  ])
  .map(withGraphLinks);

const wheelGlyphs = new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.glyph));
const wheelIds = new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.id));
if (COMPLETE_WHEEL_MANIFEST.length !== 72 || wheelGlyphs.size !== 72 || wheelIds.size !== 72) {
  throw new Error(`Complete wheel contract failed: records=${COMPLETE_WHEEL_MANIFEST.length} glyphs=${wheelGlyphs.size} ids=${wheelIds.size}`);
}
for (const gradeId of ["p1", "p2", "p3", "p4", "p5", "p6", "j1", "j2", "j3"] as const) {
  const count = COMPLETE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId).length;
  if (count !== 8) throw new Error(`Complete wheel grade ${gradeId} requires 8 records, received ${count}`);
}

export const COMPLETE_WHEEL_MANIFEST_REVISION = createRevisionHash("hanzi-complete-wheel-manifest-1", COMPLETE_WHEEL_MANIFEST);
export const COMPLETE_WHEEL_GRADE_OPTIONS = WHEEL_GRADE_OPTIONS;

export function getCompleteWheelPool(gradeId: LegacyWheelGradeId): readonly CompleteWheelRecord[] {
  return COMPLETE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId);
}

export function getCompleteWheelRecord(id: string): CompleteWheelRecord {
  const record = COMPLETE_WHEEL_MANIFEST.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Unknown complete wheel record: ${id}`);
  return record;
}
