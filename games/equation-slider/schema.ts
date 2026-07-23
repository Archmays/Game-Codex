import { deepFreeze, validatePublishedLevel } from "./solver";
import type { PublishedEquationSliderLevel } from "./types";

export function parsePublishedChapter(
  value: unknown,
  expectedChapterId: string,
  expectedCount = 50
): readonly PublishedEquationSliderLevel[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`${expectedChapterId}: expected ${expectedCount} published levels`);
  }
  const levels: PublishedEquationSliderLevel[] = [];
  const ids = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    if (!isPublishedLevelShape(candidate)) {
      throw new Error(`${expectedChapterId}: level ${index + 1} does not match the V3 published schema`);
    }
    if (candidate.chapterId !== expectedChapterId || candidate.order !== index + 1) {
      throw new Error(`${candidate.id}: chapter or order does not match its published file position`);
    }
    if (ids.has(candidate.id)) throw new Error(`${candidate.id}: duplicate published level ID`);
    ids.add(candidate.id);
    const errors = validatePublishedLevel(candidate);
    if (errors.length > 0) throw new Error(`${candidate.id}: ${errors.join("; ")}`);
    levels.push(deepFreeze(candidate));
  }
  return deepFreeze(levels);
}

export function isPublishedLevelShape(value: unknown): value is PublishedEquationSliderLevel {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== 3
    || !isString(value.id)
    || !isString(value.chapterId)
    || !isString(value.stationId)
    || !isInteger(value.order)
    || !isInteger(value.stationOrder)
    || !["target", "multi-target", "equality"].includes(String(value.mode))
    || !["standard", "unique-minimum-cover"].includes(String(value.challenge))
    || !Array.isArray(value.slots)
    || !value.slots.every(isExpressionSlot)
    || !isIndexArray(value.initialIndexes)
    || !isStringArray(value.requiredTileIds)
    || !Array.isArray(value.targets)
    || !value.targets.every(isTarget)
    || !isLearning(value.learning)
    || !isHints(value.hints)
    || !isProvenance(value.provenance)
    || !isAnalysis(value.analysis)
  ) {
    return false;
  }
  if (value.mode === "target") {
    return value.targets.length === 1 && isRecord(value.targets[0]) && value.targets[0].kind === "value";
  }
  if (value.mode === "multi-target") {
    return value.targets.length >= 2
      && value.targets.length <= 3
      && value.targets.every((target) => isRecord(target) && target.kind === "value");
  }
  return value.targets.length === 1 && isRecord(value.targets[0]) && value.targets[0].kind === "equality";
}

function isExpressionSlot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "fixed-token") {
    return isString(value.id) && isArithmeticToken(value.token) && isString(value.ariaLabel);
  }
  if (value.kind !== "movable-reel" || !isRecord(value.reel)) return false;
  return isString(value.reel.id)
    && (value.reel.kind === "number" || value.reel.kind === "operator")
    && Array.isArray(value.reel.tiles)
    && value.reel.tiles.length === 3
    && value.reel.tiles.every((tile) => isRecord(tile)
      && isString(tile.id)
      && (tile.kind === "number" || tile.kind === "operator")
      && isArithmeticToken(tile.value));
}

function isTarget(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id)) return false;
  if (value.kind === "value") return isNonNegativeInteger(value.value);
  return value.kind === "equality"
    && Array.isArray(value.rightExpression)
    && value.rightExpression.every(isArithmeticToken);
}

function isLearning(value: unknown): boolean {
  return isRecord(value)
    && isString(value.objective)
    && isString(value.primarySkill)
    && isStringArray(value.skillTags)
    && isStringArray(value.prerequisiteTags)
    && isStringArray(value.misconceptionTags)
    && ["guided", "supported", "independent", "review", "transfer"].includes(String(value.scaffold))
    && isStringArray(value.reviewOf)
    && isString(value.reflection)
    && isString(value.recommendedAgeBand);
}

function isHints(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 3
    && value.every((hint, index) => isRecord(hint)
      && hint.kind === ["concept", "position", "direction"][index]
      && isString(hint.text));
}

function isProvenance(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.generatorVersion)) return false;
  if (value.kind === "hand-authored-gold") return true;
  return value.kind === "generated-from-gold" && isString(value.templateId) && isString(value.seed);
}

function isAnalysis(value: unknown): boolean {
  return isRecord(value)
    && isString(value.solverVersion)
    && Array.isArray(value.validArrangements)
    && Array.isArray(value.canonicalPlan)
    && isNonNegativeInteger(value.minimumMovesToFirstSuccess)
    && isNonNegativeInteger(value.minimumCorrectArrangements)
    && typeof value.difficulty === "number"
    && Number.isFinite(value.difficulty)
    && isRecord(value.metrics)
    && isRecord(value.signatures);
}

function isArithmeticToken(value: unknown): boolean {
  return isNonNegativeInteger(value) || ["+", "−", "×", "÷"].includes(String(value));
}

function isIndexArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((index) => index === 0 || index === 1 || index === 2);
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isString);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0 && Number.isSafeInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
