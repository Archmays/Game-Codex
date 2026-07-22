export type ArithmeticOperator = "+" | "−" | "×" | "÷";
export type ArithmeticToken = number | ArithmeticOperator;
export type TileKind = "number" | "operator";
export type LevelMode = "target" | "multi-target" | "equality";
export type ScaffoldLevel = "guided" | "supported" | "independent" | "review" | "transfer";
export type ChallengeKind = "standard" | "unique-minimum-cover";

export interface EquationTile {
  readonly id: string;
  readonly kind: TileKind;
  readonly value: ArithmeticToken;
}

export interface EquationReel {
  readonly id: string;
  readonly kind: TileKind;
  readonly tiles: readonly EquationTile[];
  readonly initialIndex: number;
}

export interface LearningMetadata {
  readonly learningObjective: string;
  readonly primarySkill: string;
  readonly skillTags: readonly string[];
  readonly misconceptionTags: readonly string[];
  readonly scaffoldLevel: ScaffoldLevel;
  readonly reviewOf: readonly string[];
  readonly reflectionText: string;
  readonly recommendedAgeBand: string;
}

export interface LevelProvenance {
  readonly generatorVersion: string;
  readonly seed: string;
  readonly familyId: string;
  readonly repetitionPurpose?: "spaced-review" | "scaffold-fade" | "representation-transfer";
}

export interface DifficultyMetrics {
  readonly arrangementCount: number;
  readonly validArrangementCount: number;
  readonly invalidArrangementRatio: number;
  readonly minimumCorrectExpressions: number;
  readonly minimumCoverSetCountCapped: 1 | 2;
  readonly initialToFirstValidMoves: number;
  readonly reachableCoverageStates: number;
  readonly meanNovelTilesOnCanonicalPlan: number;
  readonly solutionBranchingScore: number;
  readonly operatorComplexity: number;
  readonly numericMagnitude: number;
  readonly recommendedHintDepth: 2 | 3 | 4 | 5;
  readonly compositeDifficulty: number;
}

export interface PublishedLevelAnalysis {
  readonly solverVersion: string;
  readonly solvable: true;
  readonly orphanTileIds: readonly [];
  readonly canonicalPlan: readonly (readonly number[])[];
  readonly difficultyMetrics: DifficultyMetrics;
  readonly structureSignature: string;
  readonly topologySignature: string;
}

interface LevelBase {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly chapterId: string;
  readonly unitId: string;
  readonly levelNumber: number;
  readonly unitLevelNumber: number;
  readonly mode: LevelMode;
  readonly challenge: ChallengeKind;
  readonly reels: readonly EquationReel[];
  readonly learning: LearningMetadata;
  readonly provenance: LevelProvenance;
  readonly conceptHint: string;
}

export interface TargetLevel extends LevelBase {
  readonly mode: "target";
  readonly target: number;
}

export interface MultiTargetLevel extends LevelBase {
  readonly mode: "multi-target";
  readonly targets: readonly [number, number] | readonly [number, number, number];
}

export interface EqualityLevel extends LevelBase {
  readonly mode: "equality";
  readonly rightExpression: readonly ArithmeticToken[];
}

export type EquationSliderLevelDefinition = TargetLevel | MultiTargetLevel | EqualityLevel;
export type PublishedEquationSliderLevel = EquationSliderLevelDefinition & {
  readonly analysis: PublishedLevelAnalysis;
};

export interface Arrangement {
  readonly indexes: readonly number[];
}

export interface ValidArrangement extends Arrangement {
  readonly key: string;
  readonly selectedTileIds: readonly string[];
  readonly tileMask: number;
  readonly targetMask: number;
  readonly expressionText: string;
  readonly result: number;
  readonly rightResult?: number;
}

export interface SolveStartState {
  readonly coveredTileIds?: readonly string[];
  readonly completedTargetIndexes?: readonly number[];
}

export interface SolveLimits {
  readonly maxArrangements: number;
  readonly maxCoverageStates: number;
  readonly maxMinimumCoverSearchNodes: number;
}

export type SolveStatus = "solved" | "invalid-level" | "unsolvable" | "limit-exceeded";

export interface SolveAnalysis {
  readonly status: SolveStatus;
  readonly errors: readonly string[];
  readonly arrangementCount: number;
  readonly validArrangements: readonly ValidArrangement[];
  readonly orphanTileIds: readonly string[];
  readonly missingTargetIndexes: readonly number[];
  readonly minimumCorrectExpressions: number | null;
  readonly minimumCoverSetCountCapped: 0 | 1 | 2;
  readonly canonicalPlan: readonly Arrangement[];
  readonly difficultyMetrics?: DifficultyMetrics;
}

export interface UnitManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly shortGoal: string;
  readonly skillTags: readonly string[];
  readonly levelCount: 10;
}

export interface ChapterManifestEntry {
  readonly id: string;
  readonly number: 1 | 2 | 3 | 4;
  readonly name: string;
  readonly subtitle: string;
  readonly recommendedAgeBand: string;
  readonly readinessNote: string;
  readonly color: string;
  readonly units: readonly UnitManifestEntry[];
  readonly levelCount: 50;
}
