import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

type JsonRecord = Record<string, unknown>;

const REVIEW_FILE_NAME = "STEP-03_PARENT_REVIEW_FEEDBACK.json";
const DECISIONS = new Set(["ACCEPT", "REVISE", "REJECT"]);
const AUDIO_DECISIONS = new Set(["ACCEPT CURRENT CANDIDATE", "NEED RECORDED AUDIO", "REVISE", "REJECT"]);
const CHILD_AUTHORIZATIONS = new Set(["YES", "NO", "NOT_YET"]);
const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const moduleServer = await createServer({
  configFile: false,
  root: repositoryRoot,
  appType: "custom",
  server: {
    middlewareMode: true,
    hmr: false,
    watch: null,
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});
let expectedIdentity: JsonRecord;
let expectedItems: Array<{ id: string; revisionHash: string }>;
let expectedCharacters: Array<{ id: string; revisionHash: string }>;
try {
  const identityModule = await moduleServer.ssrLoadModule("/apps/hanzi-v2-step03-review/review-identity.ts");
  const itemsModule = await moduleServer.ssrLoadModule("/apps/hanzi-v2-step03-review/review-items.ts");
  const contentModule = await moduleServer.ssrLoadModule("/games/hanzi-radical-battle/v2/golden-slice/content/index.ts");
  expectedIdentity = JSON.parse(JSON.stringify(identityModule.STEP03_REVIEW_IDENTITY)) as JsonRecord;
  expectedItems = itemsModule.STEP03_REVIEW_ITEMS.map((item: { id: string; revisionHash: string }) => ({
    id: item.id,
    revisionHash: item.revisionHash,
  }));
  expectedCharacters = contentModule.FINAL_GOLDEN_MANIFEST.map((character: { id: string; revisionHash: string }) => ({
    id: character.id,
    revisionHash: character.revisionHash,
  }));
} finally {
  await moduleServer.close();
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: readonly string[], label: string, errors: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  const missing = expected.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !expected.includes(key));
  if (missing.length) errors.push(`${label} is missing required field(s): ${missing.join(", ")}.`);
  if (unexpected.length) errors.push(`${label} has unsupported field(s): ${unexpected.join(", ")}.`);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (typeof left !== typeof right) return false;
  if (left === null || right === null || typeof left !== "object") return Object.is(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameJson(value, right[index]));
  }
  const leftRecord = left as JsonRecord;
  const rightRecord = right as JsonRecord;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(leftRecord[key], rightRecord[key]));
}

function requiredText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateFeedback(value: unknown): { errors: string[]; authorization: string | null } {
  const errors: string[] = [];
  let authorization: string | null = null;
  if (!isRecord(value)) {
    return { errors: ["Feedback root must be a JSON object."], authorization };
  }

  hasExactKeys(value, [
    "schemaVersion",
    "initiativeId",
    "round",
    "goldenSliceIdentity",
    "goldenSliceDecision",
    "manifestDecision",
    "abilityDecisions",
    "bossDecision",
    "assetDecisions",
    "audioDecision",
    "authorizeChildFirstUse",
    "generalNotes",
    "decisions",
    "reviewMeta",
  ], "feedback", errors);
  if (value.schemaVersion !== 2) errors.push("schemaVersion must equal 2.");
  if (value.initiativeId !== "hanzi-radical-battle-v2") errors.push("initiativeId must equal hanzi-radical-battle-v2.");
  if (!Number.isInteger(value.round) || (value.round as number) < 1) errors.push("round must be an integer greater than or equal to 1.");

  if (!sameJson(value.goldenSliceIdentity, expectedIdentity)) {
    errors.push("goldenSliceIdentity must exactly match the current STEP 03 review identity and revision snapshots.");
  }

  const decisionByItemId = new Map<string, unknown>();
  if (!isRecord(value.decisions)) {
    errors.push("decisions must be an object.");
  } else {
    hasExactKeys(value.decisions, ["items", "characters"], "decisions", errors);
    if (!Array.isArray(value.decisions.items)) {
      errors.push("decisions.items must be an array.");
    } else {
      if (value.decisions.items.length !== expectedItems.length) {
        errors.push(`decisions.items must contain exactly ${expectedItems.length} current review decisions.`);
      }
      const seenIds = new Set<string>();
      for (const [index, item] of value.decisions.items.entries()) {
        if (!isRecord(item)) {
          errors.push(`decisions.items[${index}] must be an object.`);
          continue;
        }
        hasExactKeys(item, ["itemId", "revisionHash", "decision", "notes", "carriedForward"], `decisions.items[${index}]`, errors);
        if (!requiredText(item.itemId)) {
          errors.push(`decisions.items[${index}].itemId is required.`);
          continue;
        }
        const itemId = item.itemId;
        seenIds.add(itemId);
        decisionByItemId.set(itemId, item.decision);
        const expected = expectedItems.find((candidate) => candidate.id === itemId);
        if (!expected) {
          errors.push(`decisions.items[${index}].itemId '${itemId}' is not a current review item.`);
        } else if (item.revisionHash !== expected.revisionHash) {
          errors.push(`decisions.items[${index}].revisionHash for '${itemId}' must match current identity '${expected.revisionHash}'.`);
        }
        if (!DECISIONS.has(item.decision as string)) errors.push(`decisions.items[${index}].decision must be ACCEPT, REVISE, or REJECT.`);
        if (!requiredText(item.notes)) errors.push(`decisions.items[${index}].notes is required.`);
        if (typeof item.carriedForward !== "boolean") errors.push(`decisions.items[${index}].carriedForward must be boolean.`);
      }
      const expectedIds = expectedItems.map((item) => item.id);
      if (seenIds.size !== value.decisions.items.length) errors.push("decisions.items itemId values must be unique.");
      const omitted = expectedIds.filter((id) => !seenIds.has(id));
      if (omitted.length) errors.push(`decisions.items is missing current itemId value(s): ${omitted.join(", ")}.`);
    }
    if (!Array.isArray(value.decisions.characters)) {
      errors.push("decisions.characters must be an array.");
    } else {
      if (value.decisions.characters.length !== expectedCharacters.length) {
        errors.push(`decisions.characters must contain exactly ${expectedCharacters.length} current character decisions.`);
      }
      const seenCharacterIds = new Set<string>();
      for (const [index, character] of value.decisions.characters.entries()) {
        if (!isRecord(character)) {
          errors.push(`decisions.characters[${index}] must be an object.`);
          continue;
        }
        hasExactKeys(character, ["characterId", "revisionHash", "decision", "notes", "carriedForward"], `decisions.characters[${index}]`, errors);
        if (!requiredText(character.characterId)) {
          errors.push(`decisions.characters[${index}].characterId is required.`);
          continue;
        }
        const characterId = character.characterId;
        seenCharacterIds.add(characterId);
        const expected = expectedCharacters.find((candidate) => candidate.id === characterId);
        if (!expected) {
          errors.push(`decisions.characters[${index}].characterId '${characterId}' is not a current manifest character.`);
        } else if (character.revisionHash !== expected.revisionHash) {
          errors.push(`decisions.characters[${index}].revisionHash for '${characterId}' must match current manifest '${expected.revisionHash}'.`);
        }
        if (!DECISIONS.has(character.decision as string)) errors.push(`decisions.characters[${index}].decision must be ACCEPT, REVISE, or REJECT.`);
        if (!requiredText(character.notes)) errors.push(`decisions.characters[${index}].notes is required.`);
        if (typeof character.carriedForward !== "boolean") errors.push(`decisions.characters[${index}].carriedForward must be boolean.`);
      }
      const expectedIds = expectedCharacters.map((character) => character.id);
      if (seenCharacterIds.size !== value.decisions.characters.length) errors.push("decisions.characters characterId values must be unique.");
      const omitted = expectedIds.filter((id) => !seenCharacterIds.has(id));
      if (omitted.length) errors.push(`decisions.characters is missing current characterId value(s): ${omitted.join(", ")}.`);
    }
  }

  const exactDecisionFor = (field: string, itemId: string): void => {
    if (!DECISIONS.has(value[field] as string)) {
      errors.push(`${field} must be ACCEPT, REVISE, or REJECT.`);
    }
    if (decisionByItemId.has(itemId) && value[field] !== decisionByItemId.get(itemId)) {
      errors.push(`${field} must match decisions.items '${itemId}' decision.`);
    }
  };
  exactDecisionFor("goldenSliceDecision", "slice-preview");
  exactDecisionFor("bossDecision", "two-phase-boss");

  const aggregateDecision = (values: unknown[]): string | null => {
    if (!values.length) return null;
    if (values.some((entry) => !DECISIONS.has(entry as string))) return null;
    if (values.some((entry) => entry === "REJECT")) return "REJECT";
    if (values.some((entry) => entry === "REVISE")) return "REVISE";
    return "ACCEPT";
  };
  const characterDecisions = isRecord(value.decisions) && Array.isArray(value.decisions.characters)
    ? value.decisions.characters.filter(isRecord).map((character) => character.decision)
    : [];
  const expectedManifestDecision = aggregateDecision(characterDecisions);
  if (!DECISIONS.has(value.manifestDecision as string)) {
    errors.push("manifestDecision must be ACCEPT, REVISE, or REJECT.");
  }
  if (expectedManifestDecision && value.manifestDecision !== expectedManifestDecision) {
    errors.push("manifestDecision must equal the aggregate of decisions.characters.");
  }
  if (decisionByItemId.has("final-manifest") && value.manifestDecision !== decisionByItemId.get("final-manifest")) {
    errors.push("manifestDecision must match decisions.items 'final-manifest' decision.");
  }

  if (!isRecord(value.abilityDecisions)) {
    errors.push("abilityDecisions must be an object.");
  } else {
    hasExactKeys(value.abilityDecisions, ["guardian-light", "star-path", "ink-echo"], "abilityDecisions", errors);
    const abilityValues: unknown[] = [];
    for (const abilityId of ["guardian-light", "star-path", "ink-echo"]) {
      if (!DECISIONS.has(value.abilityDecisions[abilityId] as string)) {
        errors.push(`abilityDecisions.${abilityId} must be ACCEPT, REVISE, or REJECT.`);
      }
      abilityValues.push(value.abilityDecisions[abilityId]);
    }
    const expectedAbilityDecision = aggregateDecision(abilityValues);
    if (expectedAbilityDecision && decisionByItemId.has("ability-trio") && expectedAbilityDecision !== decisionByItemId.get("ability-trio")) {
      errors.push("decisions.items 'ability-trio' must equal the aggregate of abilityDecisions.");
    }
  }

  if (!isRecord(value.assetDecisions)) {
    errors.push("assetDecisions must be an object.");
  } else {
    const assetIds = ["themeC", "mage", "companion", "commonMonster", "boss", "camp", "abilityCards", "meaningMagic"];
    hasExactKeys(value.assetDecisions, assetIds, "assetDecisions", errors);
    const assetValues: unknown[] = [];
    for (const assetId of assetIds) {
      if (!DECISIONS.has(value.assetDecisions[assetId] as string)) {
        errors.push(`assetDecisions.${assetId} must be ACCEPT, REVISE, or REJECT.`);
      }
      assetValues.push(value.assetDecisions[assetId]);
    }
    const expectedAssetDecision = aggregateDecision(assetValues);
    if (expectedAssetDecision && decisionByItemId.has("theme-c") && expectedAssetDecision !== decisionByItemId.get("theme-c")) {
      errors.push("decisions.items 'theme-c' must equal the aggregate of assetDecisions.");
    }
  }

  if (!AUDIO_DECISIONS.has(value.audioDecision as string)) {
    errors.push("audioDecision must be ACCEPT CURRENT CANDIDATE, NEED RECORDED AUDIO, REVISE, or REJECT.");
  }
  const expectedAudioItemDecision = value.audioDecision === "ACCEPT CURRENT CANDIDATE" ? "ACCEPT"
    : value.audioDecision === "REJECT" ? "REJECT"
      : value.audioDecision === "NEED RECORDED AUDIO" || value.audioDecision === "REVISE" ? "REVISE" : null;
  if (expectedAudioItemDecision && decisionByItemId.has("audio-and-accessibility") && expectedAudioItemDecision !== decisionByItemId.get("audio-and-accessibility")) {
    errors.push("decisions.items 'audio-and-accessibility' must match audioDecision.");
  }

  authorization = typeof value.authorizeChildFirstUse === "string" ? value.authorizeChildFirstUse : null;
  if (!CHILD_AUTHORIZATIONS.has(authorization ?? "")) {
    errors.push("authorizeChildFirstUse must be YES, NO, or NOT_YET.");
  }
  if (!requiredText(value.generalNotes)) errors.push("generalNotes is required.");

  if (!isRecord(value.reviewMeta)) {
    errors.push("reviewMeta must be an object.");
  } else {
    hasExactKeys(value.reviewMeta, ["technicalState", "completed", "missingRequiredDecisionIds", "importedRound", "affectedItemIds"], "reviewMeta", errors);
    if (value.reviewMeta.technicalState !== "GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW") {
      errors.push("reviewMeta.technicalState must equal GOLDEN_SLICE_CANDIDATE_READY_FOR_PARENT_REVIEW.");
    }
    if (value.reviewMeta.completed !== true) errors.push("reviewMeta.completed must be true after every required decision is supplied.");
    if (!Array.isArray(value.reviewMeta.missingRequiredDecisionIds) || value.reviewMeta.missingRequiredDecisionIds.length !== 0) {
      errors.push("reviewMeta.missingRequiredDecisionIds must be an empty array for a completed review.");
    }
    if (value.reviewMeta.importedRound !== null && (!Number.isInteger(value.reviewMeta.importedRound) || (value.reviewMeta.importedRound as number) < 1)) {
      errors.push("reviewMeta.importedRound must be null or an integer greater than or equal to 1.");
    }
    if (!Array.isArray(value.reviewMeta.affectedItemIds) || value.reviewMeta.affectedItemIds.some((item) => typeof item !== "string")) {
      errors.push("reviewMeta.affectedItemIds must be an array of strings.");
    }
  }

  return { errors, authorization };
}

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function identityPayload(): JsonRecord {
  const identityText = JSON.stringify(expectedIdentity);
  return {
    schemaVersion: 2,
    feedbackFileName: REVIEW_FILE_NAME,
    reviewIdentity: expectedIdentity,
    goldenSliceIdentity: {
      goldenSliceManifestVersion: expectedIdentity.goldenSliceManifestVersion,
      goldenSliceManifestRevisionHash: expectedIdentity.goldenSliceManifestRevisionHash,
      implementationReviewVersion: expectedIdentity.implementationReviewVersion,
      previewRoute: expectedIdentity.previewRoute,
      selectedTheme: expectedIdentity.selectedTheme,
      sourceSnapshots: expectedIdentity.sourceSnapshots,
    },
    reviewItems: expectedItems,
    identitySha256: createHash("sha256").update(identityText).digest("hex").toUpperCase(),
  };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const output = getArgument("--output");
  if (!output || !["identity", "validate"].includes(command ?? "")) {
    throw new Error("Usage: step03-review-contract.ts identity --output <path> | validate --feedback <path> --output <path>");
  }
  const outputPath = resolve(output);
  if (command === "identity") {
    await writeJson(outputPath, identityPayload());
    return;
  }

  const feedback = getArgument("--feedback");
  if (!feedback) throw new Error("validate requires --feedback <path>.");
  let parsed: unknown = null;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(await readFile(resolve(feedback), "utf8"));
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
  const result = parseError ? { errors: [`Feedback JSON could not be parsed: ${parseError}`], authorization: null } : validateFeedback(parsed);
  await writeJson(outputPath, {
    schemaVersion: 2,
    valid: result.errors.length === 0,
    errors: result.errors,
    authorizeChildFirstUse: result.authorization,
    expectedIdentity: expectedIdentity,
    expectedReviewItems: expectedItems,
    expectedManifestCharacters: expectedCharacters,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
