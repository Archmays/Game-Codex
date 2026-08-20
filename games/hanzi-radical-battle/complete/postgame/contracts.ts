import type { M3HeroId } from "../../v2/chapter-one/builds";
import { createDeterministicRng } from "../../v2/chapter-one/rng";
import { COMPLETE_CORE_CHARACTER_NODES } from "../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import type { CompletePostgameMode } from "../core/complete-types";

export type CompletePostgameBand = "whole-forest" | "story-path" | "optional-glow";
export type CompletePostgameOfferKind = "character" | "family" | "word";

export interface CompletePostgameModeDefinition {
  readonly id: CompletePostgameMode;
  readonly name: string;
  readonly place: string;
  readonly promise: string;
  readonly estimatedMinutes: readonly [8, 12];
  readonly roundCount: 6;
  readonly offersPerRound: 3;
  readonly noRarity: true;
  readonly noLoss: true;
  readonly noTimeLimit: true;
}

export const COMPLETE_POSTGAME_MODE_DEFINITIONS = [
  { id: "free-adventure", name: "自由冒险", place: "归林小径", promise: "从三道字光中选一条，慢慢完成一段自己的林路。", estimatedMinutes: [8, 12], roundCount: 6, offersPerRound: 3, noRarity: true, noLoss: true, noTimeLimit: true },
  { id: "component-trails", name: "部件字脉", place: "十八根径", promise: "先合成完整字，再把它送回有来源依据的真实字脉。", estimatedMinutes: [8, 12], roundCount: 6, offersPerRound: 3, noRarity: true, noLoss: true, noTimeLimit: true },
  { id: "word-resonance", name: "词语共鸣", place: "万象书港", promise: "亲手合成两个完整字，再按真实词序与语境连接。", estimatedMinutes: [8, 12], roundCount: 6, offersPerRound: 3, noRarity: true, noLoss: true, noTimeLimit: true },
] as const satisfies readonly CompletePostgameModeDefinition[];

export const COMPLETE_POSTGAME_BANDS = [
  { id: "whole-forest", name: "整片森林", childDescription: "主线与可选字光都可以出现。" },
  { id: "story-path", name: "故事林路", childDescription: "优先重遇三章故事里的完整字。" },
  { id: "optional-glow", name: "远处微光", childDescription: "多遇见不阻塞通关的可选字。" },
] as const satisfies readonly { readonly id: CompletePostgameBand; readonly name: string; readonly childDescription: string }[];

export interface CompletePostgameOffer {
  readonly id: string;
  readonly kind: CompletePostgameOfferKind;
  readonly targetId: string;
  readonly characterId: string;
  readonly glyphLabel: string;
  readonly childLabel: string;
  readonly worldHint: string;
}

export interface CompletePostgameRoundPlan {
  readonly id: string;
  readonly offers: readonly [CompletePostgameOffer, CompletePostgameOffer, CompletePostgameOffer];
}

export interface CompletePostgamePlan {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly mode: CompletePostgameMode;
  readonly band: CompletePostgameBand;
  readonly poolIds: readonly string[];
  readonly rounds: readonly CompletePostgameRoundPlan[];
}

function freeCharacterPool(band: CompletePostgameBand) {
  if (band === "story-path") return COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.band === "story-required");
  if (band === "optional-glow") return COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.band === "optional");
  return COMPLETE_CORE_CHARACTER_NODES;
}

function repeatToLength<T>(items: readonly T[], count: number, seed: string): T[] {
  if (!items.length) throw new Error("Postgame pool cannot be empty");
  const result: T[] = [];
  for (let cycle = 0; result.length < count; cycle += 1) {
    result.push(...createDeterministicRng(`${seed}:cycle:${cycle}`).shuffle(items));
  }
  return result.slice(0, count);
}

export function createCompletePostgamePlan(
  seed: string,
  heroId: M3HeroId,
  mode: CompletePostgameMode,
  band: CompletePostgameBand = "whole-forest",
): CompletePostgamePlan {
  const normalizedSeed = seed.trim() || `word-light-postgame:${mode}`;
  const offerCount = 18;
  let offers: CompletePostgameOffer[];
  let poolIds: string[];
  if (mode === "free-adventure") {
    const pool = freeCharacterPool(band);
    poolIds = pool.map((character) => character.id);
    offers = repeatToLength(pool, offerCount, `${normalizedSeed}:characters`).map((character, index) => ({
      id: `postgame-free-${index}-${character.id}`,
      kind: "character",
      targetId: character.id,
      characterId: character.id,
      glyphLabel: character.glyph,
      childLabel: character.magicName,
      worldHint: character.familiarWord,
    }));
  } else if (mode === "component-trails") {
    const pool = createDeterministicRng(`${normalizedSeed}:families`).shuffle(COMPLETE_COMPONENT_FAMILIES);
    poolIds = COMPLETE_COMPONENT_FAMILIES.map((family) => family.id);
    offers = pool.map((family, index) => {
      const members = createDeterministicRng(`${normalizedSeed}:${family.id}:members`).shuffle(family.memberCharacterIds);
      const characterId = members.find((id) => COMPLETE_CORE_CHARACTER_NODES.some((character) => character.id === id))!;
      const character = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId)!;
      return {
        id: `postgame-family-${index}-${family.id}`,
        kind: "family" as const,
        targetId: family.id,
        characterId,
        glyphLabel: character.glyph,
        childLabel: family.name,
        worldHint: character.familiarWord,
      };
    });
  } else {
    const pool = createDeterministicRng(`${normalizedSeed}:words`).shuffle(COMPLETE_WORD_NODES);
    poolIds = COMPLETE_WORD_NODES.map((word) => word.id);
    offers = pool.slice(0, offerCount).map((word, index) => ({
      id: `postgame-word-${index}-${word.id}`,
      kind: "word",
      targetId: word.id,
      characterId: word.characterIds[0],
      glyphLabel: word.glyphs.join(""),
      childLabel: word.worldMagic,
      worldHint: word.shortMeaning,
    }));
  }
  const rounds = Array.from({ length: 6 }, (_, roundIndex) => ({
    id: `postgame-round-${roundIndex + 1}`,
    offers: offers.slice(roundIndex * 3, roundIndex * 3 + 3) as unknown as [CompletePostgameOffer, CompletePostgameOffer, CompletePostgameOffer],
  }));
  if (rounds.some((round) => round.offers.length !== 3)) throw new Error(`Postgame ${mode} requires three offers in every round`);
  return { schemaVersion: 1, seed: normalizedSeed, heroId, mode, band, poolIds, rounds };
}

export function getCompletePostgameMode(mode: CompletePostgameMode): CompletePostgameModeDefinition {
  return COMPLETE_POSTGAME_MODE_DEFINITIONS.find((candidate) => candidate.id === mode)!;
}
