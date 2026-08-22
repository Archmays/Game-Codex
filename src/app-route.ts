import type { PageMode } from "./page-mode";
import { APP_ROUTE_QUERY_MANIFEST, type AppRouteKind } from "../packages/data/playSurfaceManifest";

export type { AppRouteKind } from "../packages/data/playSurfaceManifest";

export interface ResolvedAppRoute {
  readonly kind: AppRouteKind;
  readonly explicit: boolean;
}

/** Current public route inventory, ordered by dispatch precedence. */
export const APP_ROUTE_QUERY_REGISTRY = APP_ROUTE_QUERY_MANIFEST.map((route) => ({
  ...route,
  pageMode: "game-fullscreen" as PageMode,
}));

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
