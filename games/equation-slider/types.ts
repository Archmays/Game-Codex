export type ArithmeticOperator = "+" | "−" | "×" | "÷";
export type ArithmeticToken = number | ArithmeticOperator;
export type TileKind = "number" | "operator";
export type LevelMode = "target" | "multi-target" | "equality";
export type ScaffoldLevel = "guided" | "supported" | "independent" | "review" | "transfer";
export type ChallengeKind = "standard" | "unique-minimum-cover";
export type MoveDirection = "up" | "down";

export interface ValueTarget {
  readonly kind: "value";
  readonly id: string;
  readonly value: number;
}

export interface EqualityTarget {
  readonly kind: "equality";
  readonly id: string;
  readonly rightExpression: readonly ArithmeticToken[];
}

export type EquationTarget = ValueTarget | EqualityTarget;

export interface EquationTile {
  readonly id: string;
  readonly kind: TileKind;
  readonly value: ArithmeticToken;
}

export interface ReelDefinition {
  readonly id: string;
  readonly kind: TileKind;
  readonly tiles: readonly [EquationTile, EquationTile, EquationTile];
}

export interface MovableReelSlot {
  readonly kind: "movable-reel";
  readonly reel: ReelDefinition;
}

export interface FixedTokenSlot {
  readonly kind: "fixed-token";
  readonly id: string;
  readonly token: ArithmeticToken;
  readonly ariaLabel: string;
}

export type ExpressionSlot = MovableReelSlot | FixedTokenSlot;

export interface LearningMetadata {
  readonly objective: string;
  readonly primarySkill: string;
  readonly skillTags: readonly string[];
  readonly prerequisiteTags: readonly string[];
  readonly misconceptionTags: readonly string[];
  readonly scaffold: ScaffoldLevel;
  readonly reviewOf: readonly string[];
  readonly reflection: string;
  readonly recommendedAgeBand: string;
}

export interface HintStep {
  readonly kind: "concept" | "position" | "direction";
  readonly text: string;
}

export interface LevelProvenance {
  readonly kind: "hand-authored-gold" | "generated-from-gold";
  readonly templateId?: string;
  readonly seed?: string;
  readonly generatorVersion: string;
  /** Absent for boards whose original content is unchanged. */
  readonly contentRevision?: string;
  readonly revisionSource?: string;
}

export interface QualitySignatures {
  readonly slotStructure: string;
  readonly valueStructure: string;
  readonly rotationNormalized: string;
  readonly operatorPattern: string;
  readonly validArrangements: string;
  readonly canonicalCoverage: string;
  readonly firstSuccessAction: string;
  readonly numberMultiset: string;
  readonly learningBand: string;
}

export interface DifficultyMetrics {
  readonly arrangementCount: number;
  readonly validArrangementCount: number;
  readonly invalidArrangementRatio: number;
  readonly minimumCorrectArrangements: number;
  readonly minimumCoverSetCountCapped: 1 | 2;
  readonly minimumMovesToFirstSuccess: number;
  readonly reachableCoverageStates: number;
  readonly operatorComplexity: number;
  readonly numericMagnitude: number;
  readonly difficulty: number;
}

export interface Arrangement {
  readonly indexes: readonly number[];
}

export interface ValidArrangement extends Arrangement {
  readonly key: string;
  readonly selectedTileIds: readonly string[];
  readonly tileMask: number;
  readonly targetMask: number;
  readonly satisfiedTargetIds: readonly string[];
  readonly expressionText: string;
  readonly result: number;
  readonly rightResult?: number;
}

export interface PublishedLevelAnalysis {
  readonly solverVersion: string;
  readonly validArrangements: readonly ValidArrangement[];
  readonly canonicalPlan: readonly Arrangement[];
  readonly minimumMovesToFirstSuccess: number;
  readonly minimumCorrectArrangements: number;
  readonly difficulty: number;
  readonly metrics: DifficultyMetrics;
  readonly signatures: QualitySignatures;
}

interface LevelBase {
  readonly schemaVersion: 3;
  readonly id: string;
  readonly chapterId: string;
  readonly stationId: string;
  readonly order: number;
  readonly stationOrder: number;
  readonly mode: LevelMode;
  readonly challenge: ChallengeKind;
  readonly slots: readonly ExpressionSlot[];
  readonly initialIndexes: readonly number[];
  readonly requiredTileIds: readonly string[];
  readonly learning: LearningMetadata;
  readonly hints: readonly [HintStep, HintStep, HintStep];
  readonly provenance: LevelProvenance;
}

export interface TargetLevel extends LevelBase {
  readonly mode: "target";
  readonly targets: readonly [ValueTarget];
}

export interface MultiTargetLevel extends LevelBase {
  readonly mode: "multi-target";
  readonly targets: readonly [ValueTarget, ValueTarget] | readonly [ValueTarget, ValueTarget, ValueTarget];
}

export interface EqualityLevel extends LevelBase {
  readonly mode: "equality";
  readonly targets: readonly [EqualityTarget];
}

export type EquationSliderLevelDefinition = TargetLevel | MultiTargetLevel | EqualityLevel;
export type PublishedEquationSliderLevel = EquationSliderLevelDefinition & {
  readonly analysis: PublishedLevelAnalysis;
};

export interface SolveStartState {
  readonly coveredTileIds?: readonly string[];
  readonly completedTargetIds?: readonly string[];
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
  readonly missingTargetIds: readonly string[];
  readonly minimumCorrectArrangements: number | null;
  readonly minimumCoverSetCountCapped: 0 | 1 | 2;
  readonly canonicalPlan: readonly Arrangement[];
  readonly minimumMovesToFirstSuccess: number | null;
  readonly metrics?: DifficultyMetrics;
  readonly signatures?: QualitySignatures;
}

export interface ArrangementOutcome {
  readonly valid: boolean;
  readonly selectedTileIds: readonly string[];
  readonly satisfiedTargetIds: readonly string[];
  readonly expressionText: string;
  readonly result?: number;
  readonly rightResult?: number;
  readonly failureReason?:
    | "division-by-zero"
    | "non-integer-division"
    | "negative-intermediate"
    | "invalid-token-sequence"
    | "unsafe-integer";
  readonly equalityDifference?: number;
}

export interface HintContinuation {
  readonly targetIndexes: readonly number[];
  readonly reelId?: string;
  readonly reelIndex?: number;
  readonly direction?: MoveDirection;
  readonly remainingMoves: number;
  readonly expressionText: string;
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

export const EQUATION_SLIDER_SAVE_VERSION = 2;

export type EquationSliderBadge = "independent" | "all-new" | "review-complete" | "try-again";

export interface LevelRevisionProgressRecord {
  readonly startedCount: number;
  readonly completed: boolean;
  readonly independent: boolean;
  readonly hintCount: number;
  readonly badges: readonly EquationSliderBadge[];
  readonly bestMoves?: number;
}

export interface LevelProgressRecord extends LevelRevisionProgressRecord {
  /** Statistics for revised boards never inherit an earlier board's best/hints. */
  readonly revisions?: Readonly<Record<string, LevelRevisionProgressRecord>>;
}

export interface LegacyProgressArchive {
  readonly sourceSaveVersion: number;
  readonly completedLevelIds: readonly string[];
  readonly lastLevelId?: string;
}

export interface EquationSliderProgress {
  readonly saveVersion: 2;
  readonly tutorialCompleted: boolean;
  readonly upgradeNoticeSeen: boolean;
  readonly soundEnabled: boolean;
  readonly lastLevelId?: string;
  readonly levels: Readonly<Record<string, LevelProgressRecord>>;
  readonly seenCheckpoints: readonly string[];
  readonly legacy?: LegacyProgressArchive;
}

export interface LoadedEquationSliderProgress {
  readonly progress: EquationSliderProgress;
  readonly canPersist: boolean;
  readonly migrated: boolean;
}

export type LevelMapState = "unstarted" | "in-progress" | "completed" | "review-suggested";
export type LevelRevisionState = LevelMapState | "previously-played";
export type EquationSliderCheckpointKind = "normal" | "rest" | "station-review" | "chapter-review";

export interface CheckpointLevelDescriptor {
  readonly id: string;
  readonly chapterId: string;
  readonly stationId: string;
  readonly stationOrder: number;
}

export interface CompletionCheckpoint {
  readonly kind: EquationSliderCheckpointKind;
  readonly checkpointId?: string;
}
