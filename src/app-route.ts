import { resolveObservationContext } from "./observation-context";
import type { PageMode } from "./page-mode";

export type AppRouteKind =
  | "play"
  | "observe-step07"
  | "observe-step06"
  | "observe-step04"
  | "review-step05"
  | "review-step03"
  | "review-step02"
  | "machine-review-report"
  | "classic-hub"
  | "world";

export interface ResolvedAppRoute {
  readonly kind: AppRouteKind;
  readonly explicit: boolean;
}

export interface AppRouteQueryRegistration {
  readonly kind: AppRouteKind;
  readonly queryKey: "play" | "observe" | "review" | "report" | "hub" | "world";
  readonly queryValue: string;
  readonly query: string;
  readonly pageMode: PageMode;
}

/** Canonical, precedence-ordered route inventory for dispatch and machine review. */
export const APP_ROUTE_QUERY_REGISTRY = [
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-v1", query: "?play=hanzi-v2-v1", pageMode: "game-fullscreen" },
  { kind: "play", queryKey: "play", queryValue: "hanzi-v2-golden-slice", query: "?play=hanzi-v2-golden-slice", pageMode: "game-fullscreen" },
  { kind: "observe-step07", queryKey: "observe", queryValue: "hanzi-v2-step07", query: "?observe=hanzi-v2-step07", pageMode: "adult-tool" },
  { kind: "observe-step06", queryKey: "observe", queryValue: "hanzi-v2-step06", query: "?observe=hanzi-v2-step06", pageMode: "adult-tool" },
  { kind: "observe-step04", queryKey: "observe", queryValue: "hanzi-v2-step04", query: "?observe=hanzi-v2-step04", pageMode: "adult-tool" },
  { kind: "review-step05", queryKey: "review", queryValue: "hanzi-v2-step05", query: "?review=hanzi-v2-step05", pageMode: "adult-tool" },
  { kind: "review-step03", queryKey: "review", queryValue: "hanzi-v2-step03", query: "?review=hanzi-v2-step03", pageMode: "adult-tool" },
  { kind: "review-step02", queryKey: "review", queryValue: "hanzi-v2-step02", query: "?review=hanzi-v2-step02", pageMode: "adult-tool" },
  { kind: "machine-review-report", queryKey: "report", queryValue: "game-machine-review", query: "?report=game-machine-review", pageMode: "adult-tool" },
  { kind: "classic-hub", queryKey: "hub", queryValue: "classic", query: "?hub=classic", pageMode: "game-fullscreen" },
  { kind: "world", queryKey: "world", queryValue: "my-game-world", query: "?world=my-game-world", pageMode: "game-fullscreen" },
] as const satisfies readonly AppRouteQueryRegistration[];

export const ADULT_TOOL_ROUTE_REGISTRY = Object.freeze(
  APP_ROUTE_QUERY_REGISTRY.filter((route) => route.pageMode === "adult-tool"),
);

/** Backward-compatible STEP 06 predicate; explicit evidence + matching session only. */
export function isStep06EvidenceAttempt(search: URLSearchParams): boolean {
  return resolveObservationContext(search).kind === "step06";
}

/** Route precedence: play > observers > reviews > machine report > classic hub > world. */
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
