import { createRevisionHash } from "../../content/revision-hash";
import { CANONICAL_WHEEL_LIBRARY } from "./canonical-wheel-library";
import { LEGACY_WHEEL_SOURCE } from "./legacy-wheel-source";
import type { LegacyWheelGradeId } from "./legacy-wheel-types";
import type { PlayableWheelRecord, WheelComponentRole, WheelGradeSelection, WheelSlotId, WheelStructure } from "../types";

export const PLAYABLE_WHEEL_MANIFEST_VERSION = "wheel-workshop-playable-v1" as const;

interface PlayableBlueprint {
  readonly legacyId: string;
  readonly shortMeaning: string;
}

const PLAYABLE_BLUEPRINTS: readonly PlayableBlueprint[] = [
  { legacyId: "p1.char.000", shortMeaning: "光亮，也可以表示清楚、懂得。" },
  { legacyId: "p1.char.001", shortMeaning: "顶端细小而锐利。" },
  { legacyId: "p1.char.002", shortMeaning: "使火光停止，或让事物不再存在。" },
  { legacyId: "p1.char.004", shortMeaning: "用眼睛观察。" },
  { legacyId: "p2.char.000", shortMeaning: "干净、清澈。" },
  { legacyId: "p2.char.001", shortMeaning: "天空没有雨云。" },
  { legacyId: "p2.char.008", shortMeaning: "两脚快速向前移动。" },
  { legacyId: "p2.char.011", shortMeaning: "一种四季常青的树。" },
  { legacyId: "p3.char.001", shortMeaning: "含有较多脂肪，也可指土壤养分多。" },
  { legacyId: "p3.char.004", shortMeaning: "一种常见的家养动物。" },
  { legacyId: "p3.char.006", shortMeaning: "植物开放的花朵。" },
  { legacyId: "p3.char.013", shortMeaning: "平稳、没有危险。" },
  { legacyId: "p4.char.000", shortMeaning: "海水按时涨落，也指像潮水一样的变化。" },
  { legacyId: "p4.char.010", shortMeaning: "广阔的海域，也可表示外国的。" },
  { legacyId: "p4.char.013", shortMeaning: "进行一件事情。" },
  { legacyId: "p4.char.017", shortMeaning: "听见，也可指听到的消息。" },
  { legacyId: "p5.char.001", shortMeaning: "特别喜欢某种事物。" },
  { legacyId: "p5.char.004", shortMeaning: "受到帮助后记住的情意。" },
  { legacyId: "p5.char.008", shortMeaning: "出众、优秀，也用于英语的英。" },
  { legacyId: "p5.char.006", shortMeaning: "看不见或缺少辨别。" },
  { legacyId: "p6.char.001", shortMeaning: "排列展示，也可表示过去的、旧的。" },
  { legacyId: "p6.char.003", shortMeaning: "雨后天空中弯曲的彩色光带。" },
  { legacyId: "p6.char.006", shortMeaning: "感到不好意思。" },
  { legacyId: "p6.char.009", shortMeaning: "天气寒冷时凝结的白色冰晶。" },
  { legacyId: "j1.char.000", shortMeaning: "事物在形成或准备之中。" },
  { legacyId: "j1.char.002", shortMeaning: "鸟兽居住的窝。" },
  { legacyId: "j1.char.003", shortMeaning: "咽喉，发声和呼吸经过的部位。" },
  { legacyId: "j1.char.007", shortMeaning: "明亮、清楚，也可形容声音响亮。" },
  { legacyId: "j2.char.000", shortMeaning: "崩散、败退，或水冲破阻挡。" },
  { legacyId: "j2.char.002", shortMeaning: "察看并催促。" },
  { legacyId: "j2.char.004", shortMeaning: "程度很深，也可表示很像。" },
  { legacyId: "j2.char.006", shortMeaning: "文雅、熟练。" },
  { legacyId: "j3.char.000", shortMeaning: "传说中能变化的精怪，也可形容异常。" },
  { legacyId: "j3.char.003", shortMeaning: "在“可汗”中读 hán，是古代民族首领的称号用字。" },
  { legacyId: "j3.char.004", shortMeaning: "有彩色花纹的丝织物，也表示华美。" },
  { legacyId: "j3.char.010", shortMeaning: "从中心到边缘距离相等的形状。" },
] as const;

export const WHEEL_GRADE_OPTIONS = [
  { id: "journey", label: "跟随当前旅程", worldName: "旅程回声卷" },
  { id: "p1", label: "一年级", worldName: "晨光启程卷" },
  { id: "p2", label: "二年级", worldName: "清泉伙伴卷" },
  { id: "p3", label: "三年级", worldName: "花园发现卷" },
  { id: "p4", label: "四年级", worldName: "潮声远行卷" },
  { id: "p5", label: "五年级", worldName: "星灯探寻卷" },
  { id: "p6", label: "六年级", worldName: "霜虹守望卷" },
  { id: "j1", label: "初一", worldName: "林间回声卷" },
  { id: "j2", label: "初二", worldName: "深墨辨形卷" },
  { id: "j3", label: "初三", worldName: "锦光远眺卷" },
] as const satisfies readonly { readonly id: WheelGradeSelection; readonly label: string; readonly worldName: string }[];

function findRaw(legacyId: string) {
  for (const set of LEGACY_WHEEL_SOURCE) {
    const record = set.char.validPairs.find((entry) => entry.legacyId === legacyId);
    if (record) return { set, record };
  }
  throw new Error(`Unknown playable legacy wheel record: ${legacyId}`);
}

function structureParts(structure: WheelStructure): {
  readonly slots: readonly [WheelSlotId, WheelSlotId];
  readonly roles: readonly [WheelComponentRole, WheelComponentRole];
} {
  if (structure === "left-right") return { slots: ["left", "right"], roles: ["left-component", "right-component"] };
  if (structure === "top-bottom") return { slots: ["top", "bottom"], roles: ["top-component", "bottom-component"] };
  return { slots: ["outer", "inner"], roles: ["enclosing-component", "inner-component"] };
}

function makePlayable(blueprint: PlayableBlueprint): PlayableWheelRecord {
  const { set, record } = findRaw(blueprint.legacyId);
  const audit = CANONICAL_WHEEL_LIBRARY.find((entry) => entry.legacyId === blueprint.legacyId);
  if (!audit || audit.sourceMode !== "char" || (audit.auditStatus !== "validated" && audit.auditStatus !== "corrected-derived-record")) {
    throw new Error(`Playable record is not audit-approved: ${blueprint.legacyId}`);
  }
  if (audit.structure === "unknown" || audit.structure === "not-applicable" || audit.orderedComponents.length !== 2) {
    throw new Error(`Playable record lacks a two-slot structure: ${blueprint.legacyId}`);
  }
  const { slots, roles } = structureParts(audit.structure);
  const familiarWord = record.words[0];
  const stable = {
    id: `wheel-${record.legacyId.replaceAll(".", "-")}`,
    legacyId: record.legacyId,
    sourceGradeId: set.id,
    sourceGradeLabel: set.label,
    curriculumStage: audit.curriculumStage,
    alignmentStatus: audit.alignmentStatus,
    glyph: record.result,
    pinyin: record.pinyin,
    familiarWord,
    spokenPhrase: `${record.result}，${familiarWord}`,
    shortMeaning: blueprint.shortMeaning,
    meaningClue: familiarWord.includes(record.result) ? familiarWord.replace(record.result, "□") : `想一想：${familiarWord}`,
    structure: audit.structure,
    orderedComponents: [audit.orderedComponents[0], audit.orderedComponents[1]] as const,
    slotIds: slots,
    componentRoles: roles,
    illustrationBrief: `text-structure-only：用“${familiarWord}”的柔和字义光与真实结构槽位表现，不把联想画面写成字源。`,
    sourceEvidence: audit.sourceEvidence,
    auditStatus: audit.auditStatus,
  } as const;
  return { ...stable, revisionHash: createRevisionHash(PLAYABLE_WHEEL_MANIFEST_VERSION, stable) };
}

export const PLAYABLE_WHEEL_MANIFEST: readonly PlayableWheelRecord[] = PLAYABLE_BLUEPRINTS.map(makePlayable);
export const PLAYABLE_WHEEL_MANIFEST_REVISION = createRevisionHash(PLAYABLE_WHEEL_MANIFEST_VERSION, PLAYABLE_WHEEL_MANIFEST);

export function getPlayableWheelRecord(id: string): PlayableWheelRecord {
  const record = PLAYABLE_WHEEL_MANIFEST.find((entry) => entry.id === id);
  if (!record) throw new Error(`Unknown playable wheel record: ${id}`);
  return record;
}

export function getWheelGradeOption(id: WheelGradeSelection) {
  return WHEEL_GRADE_OPTIONS.find((entry) => entry.id === id) ?? WHEEL_GRADE_OPTIONS[0];
}

export function getWheelPool(gradeId: WheelGradeSelection): readonly PlayableWheelRecord[] {
  if (gradeId === "journey") return PLAYABLE_WHEEL_MANIFEST.filter((record) => ["p1", "p2", "p3"].includes(record.sourceGradeId));
  return PLAYABLE_WHEEL_MANIFEST.filter((record) => record.sourceGradeId === gradeId as LegacyWheelGradeId);
}

