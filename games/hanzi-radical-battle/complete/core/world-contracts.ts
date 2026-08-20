import type { CompleteEngineChapterId, CompletePostgameMode } from "./complete-types";

export const COMPLETE_EPISODE_IDS = [
  "chapter-one:glimmer-grove",
  "chapter-one:echo-garden",
  "chapter-one:wind-trail",
  "chapter-one:ink-king-core",
  "chapter-two:wood-voice-canopy",
  "chapter-two:spring-stone-valley",
  "chapter-two:door-shadow-corridor",
  "chapter-two:component-root-core",
  "chapter-three:home-lantern-town",
  "chapter-three:myriad-book-harbor",
  "chapter-three:star-map-peak",
  "chapter-three:word-heart-core",
] as const;

export type CompleteEpisodeId = typeof COMPLETE_EPISODE_IDS[number];

export const COMPLETE_REPAIR_IDS = [
  "camp-lamp",
  "garden-path",
  "world-gate",
  "magic-tree",
  "little-bridge",
  "spellbook-house",
  "ink-companion-house",
  "stargazing-platform",
  "tree-canopy-bridge",
  "spring-waterwheel",
  "door-shadow-corridor",
  "component-root-heart",
  "home-lantern-street",
  "book-page-harbor",
  "constellation-lighthouse",
  "word-heart",
] as const;

export type CompleteRepairId = typeof COMPLETE_REPAIR_IDS[number];

export const COMPLETE_CHAPTER_IDS = ["chapter-one", "chapter-two", "chapter-three"] as const satisfies readonly CompleteEngineChapterId[];
export const COMPLETE_POSTGAME_MODES = ["free-adventure", "component-trails", "word-resonance"] as const satisfies readonly CompletePostgameMode[];

export const COMPLETE_NEW_ABILITY_IDS = [
  "family-root-link",
  "family-variant-lantern",
  "family-echo-trace",
  "word-order-ribbon",
  "word-context-lantern",
  "word-resonance-bridge",
] as const;

export const COMPLETE_NEW_BEHAVIOR_IDS = [
  "family-root-mist",
  "family-variant-shadow",
  "family-echo-knot",
  "word-order-gust",
  "word-context-fog",
  "word-resonance-ripple",
] as const;

export const COMPLETE_NEW_BOSS_IDS = [
  "canopy-keeper",
  "spring-wheel-guardian",
  "door-shadow-keeper",
  "component-root-guardian",
  "lantern-town-keeper",
  "book-harbor-guardian",
  "constellation-keeper",
  "word-heart-guardian",
] as const;
