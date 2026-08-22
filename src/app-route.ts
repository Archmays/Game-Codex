import type { PageMode } from "./page-mode";

export type AppRouteKind = "play" | "classic-hub" | "world";

export interface ResolvedAppRoute {
  readonly kind: AppRouteKind;
  readonly explicit: boolean;
}

export interface AppRouteQueryRegistration {
  readonly kind: AppRouteKind;
  readonly queryKey: "play" | "hub" | "world";
  readonly queryValue: string;
  readonly query: string;
  readonly pageMode: PageMode;
}

/** Current public route inventory, ordered by dispatch precedence. */
export const APP_ROUTE_QUERY_REGISTRY = [
  { kind: "play", queryKey: "play", queryValue: "hanzi-magic-complete", query: "?play=hanzi-magic-complete", pageMode: "game-fullscreen" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-chapter-one", query: "?play=hanzi-v2-chapter-one", pageMode: "game-fullscreen" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-v1", query: "?play=hanzi-v2-v1", pageMode: "game-fullscreen" },
  { kind: "play", queryKey: "play", queryValue: "pinyin-magic-battle", query: "?play=pinyin-magic-battle", pageMode: "game-fullscreen" },
  { kind: "play", queryKey: "play", queryValue: "english-spell-battle-legacy", query: "?play=english-spell-battle-legacy", pageMode: "game-fullscreen" },
  { kind: "classic-hub", queryKey: "hub", queryValue: "classic", query: "?hub=classic", pageMode: "game-fullscreen" },
  { kind: "world", queryKey: "world", queryValue: "english-world", query: "?world=english-world", pageMode: "game-fullscreen" },
  { kind: "world", queryKey: "world", queryValue: "math-world", query: "?world=math-world", pageMode: "game-fullscreen" },
  { kind: "world", queryKey: "world", queryValue: "my-game-world", query: "?world=my-game-world", pageMode: "game-fullscreen" },
] as const satisfies readonly AppRouteQueryRegistration[];

/** Route precedence: complete edition > current/legacy play > classic hub > family world. */
export function resolveAppRoute(search: URLSearchParams): ResolvedAppRoute {
  for (const route of APP_ROUTE_QUERY_REGISTRY) {
    if (search.get(route.queryKey) === route.queryValue) return { kind: route.kind, explicit: true };
  }
  return { kind: "world", explicit: false };
}

export function pageModeForAppRoute(kind: AppRouteKind): PageMode {
  const registration = APP_ROUTE_QUERY_REGISTRY.find((route) => route.kind === kind);
  if (!registration) throw new Error(`Missing page mode registration for ${kind}`);
  return registration.pageMode;
}
