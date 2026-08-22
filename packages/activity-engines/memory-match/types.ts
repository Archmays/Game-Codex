export type MatchFaceKind = "glyph" | "pinyin" | "phrase" | "meaning-image" | "text" | "clock" | "equation" | "quantity";

export interface MatchFace {
  readonly id: string;
  readonly kind: MatchFaceKind;
  readonly text?: string;
  readonly assetUrl?: string;
  readonly ariaLabel: string;
  readonly sourceIds: readonly string[];
}

export interface MatchRelation {
  readonly id: string;
  readonly left: MatchFace;
  readonly right: MatchFace;
  readonly explanation: string;
  readonly sourceIds: readonly string[];
  readonly riskFlags: readonly string[];
}

export interface MemoryMatchPack {
  readonly id: string;
  readonly title: string;
  readonly subject: "chinese" | "math" | "english" | "shared";
  readonly relationType: string;
  readonly defaultPairCount: number;
  readonly relations: readonly MatchRelation[];
  readonly revisionHash: string;
}

export interface MemoryCardInstance {
  readonly instanceId: string;
  readonly relationId: string;
  readonly side: "left" | "right";
  readonly face: MatchFace;
  readonly position: number;
}

export interface MemoryMatchState {
  readonly cards: readonly MemoryCardInstance[];
  readonly openInstanceIds: readonly string[];
  readonly matchedRelationIds: readonly string[];
  readonly locked: boolean;
}
