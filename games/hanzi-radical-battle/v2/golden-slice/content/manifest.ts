import { getCandidateCharacter } from "../../content/candidate-characters";
import { createRevisionHash } from "../../content/revision-hash";
import {
  DEFERRED_CHARACTER_IDS,
  FINAL_GOLDEN_CHARACTER_IDS,
  type DeferredCharacter,
  type GoldenCharacter,
  type GoldenCharacterId,
  type GoldenStage,
} from "./types";

export const GOLDEN_SLICE_MANIFEST_VERSION = "hanzi-v2-step03-golden-slice-v1";
export const FIRST_RUN_CHARACTER_IDS = ["ming", "hua", "lin", "xing"] as const satisfies readonly GoldenCharacterId[];

const FINAL_STAGES: Readonly<Record<GoldenCharacterId, GoldenStage>> = {
  ming: "first-run",
  hua: "first-run",
  lin: "first-run",
  xing: "first-run",
  cao: "manifest-only",
  kan: "manifest-only",
  yuan: "manifest-only",
  hui: "manifest-only",
  bao: "manifest-only",
  feng: "manifest-only",
  mao: "manifest-only",
  pao: "manifest-only",
};

const FINAL_MAGIC: Readonly<Record<GoldenCharacterId, { id: string; name: string; effect: string }>> = {
  ming: { id: "light-return", name: "明光归来", effect: "让营地灯重新发亮" },
  hua: { id: "flower-trail", name: "花径展开", effect: "让墨迹路开出花" },
  lin: { id: "forest-guard", name: "林守护", effect: "让两棵树挡住迷墨" },
  xing: { id: "star-guide", name: "星路指引", effect: "让星光带路回营地" },
  cao: { id: "grass-whisper", name: "草语", effect: "让草叶轻轻指路" },
  kan: { id: "clear-sight", name: "看清楚", effect: "让前方轮廓更清楚" },
  yuan: { id: "garden-ring", name: "园之环", effect: "围出安全的小花园" },
  hui: { id: "homeward-ring", name: "回营之环", effect: "画出回营的小路" },
  bao: { id: "safe-wrap", name: "包裹光", effect: "把微光稳稳护住" },
  feng: { id: "gentle-wind", name: "轻风", effect: "吹开不挡路的墨点" },
  mao: { id: "cat-step", name: "猫步", effect: "留下轻轻的探索脚印" },
  pao: { id: "run-spark", name: "跑光", effect: "让路上的星点跳起来" },
};

function toSourceMapping(id: GoldenCharacterId | (typeof DEFERRED_CHARACTER_IDS)[number]) {
  const candidate = getCandidateCharacter(id);
  return {
    sourceCandidateId: id,
    step02RevisionHash: candidate.revisionHash,
    sourceOrderedParts: [...candidate.sourceOrderedParts],
    sourceCombinationKey: candidate.sourceCombinationKey,
    formulaAuditStatus: candidate.sourceEvidence.formulaAuditStatus,
    visualHintPath: candidate.visualHintPath,
  } as const;
}

function toFinalCharacter(id: GoldenCharacterId): GoldenCharacter {
  const candidate = getCandidateCharacter(id);
  const payload = {
    id,
    glyph: candidate.glyph,
    status: "accepted" as const,
    reviewStatus: "accepted" as const,
    pinyin: candidate.pinyin,
    familiarWord: candidate.familiarWord,
    shortMeaning: candidate.shortMeaning,
    structure: candidate.structure,
    components: candidate.components.map((component) => ({ ...component })),
    illustrationPath: candidate.visualHintPath,
    magic: FINAL_MAGIC[id],
    stage: FINAL_STAGES[id],
    sourceMapping: toSourceMapping(id),
    etymologyClaim: null,
  };
  return {
    ...payload,
    visualPinyin: candidate.pinyin,
    spokenPhrase: `${candidate.glyph}，${candidate.familiarWord}的${candidate.glyph}。`,
    revisionHash: createRevisionHash(GOLDEN_SLICE_MANIFEST_VERSION, payload),
  };
}

function toDeferredCharacter(id: (typeof DEFERRED_CHARACTER_IDS)[number]): DeferredCharacter {
  const candidate = getCandidateCharacter(id);
  const payload = {
    id,
    glyph: candidate.glyph,
    status: "accepted" as const,
    reviewStatus: "accepted" as const,
    disposition: "accepted-deferred" as const,
    pinyin: candidate.pinyin,
    familiarWord: candidate.familiarWord,
    shortMeaning: candidate.shortMeaning,
    structure: candidate.structure,
    components: candidate.components.map((component) => ({ ...component })),
    illustrationPath: candidate.visualHintPath,
    sourceMapping: toSourceMapping(id),
    etymologyClaim: null,
  };
  return { ...payload, revisionHash: createRevisionHash(GOLDEN_SLICE_MANIFEST_VERSION, payload) };
}

export const FINAL_GOLDEN_MANIFEST: readonly GoldenCharacter[] = FINAL_GOLDEN_CHARACTER_IDS.map(toFinalCharacter);
export const ACCEPTED_DEFERRED_CHARACTERS: readonly DeferredCharacter[] = DEFERRED_CHARACTER_IDS.map(toDeferredCharacter);
export const GOLDEN_SLICE_MANIFEST_REVISION_HASH = createRevisionHash(GOLDEN_SLICE_MANIFEST_VERSION, {
  final: FINAL_GOLDEN_MANIFEST.map(({ revisionHash, visualPinyin, spokenPhrase, ...entry }) => entry),
  deferred: ACCEPTED_DEFERRED_CHARACTERS.map(({ revisionHash, ...entry }) => entry),
});

export function getGoldenCharacter(id: GoldenCharacterId): GoldenCharacter {
  const character = FINAL_GOLDEN_MANIFEST.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown final golden-slice character: ${id}`);
  return character;
}
