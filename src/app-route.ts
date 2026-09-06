import type { PageMode } from "./page-mode";
import { RETIRED_MATH_WORLD_STATION_IDS } from "../games/math-lab/world/world-save";
import {
  APP_ROUTE_QUERY_MANIFEST,
  PLAY_SURFACE_MANIFEST,
  type AppRouteKind,
  type PlaySurfaceRecord,
  type ScrollPolicy,
} from "../packages/data/playSurfaceManifest";

export type { AppRouteKind } from "../packages/data/playSurfaceManifest";

export interface ResolvedAppRoute {
  readonly kind: AppRouteKind;
  readonly explicit: boolean;
}

/** Current public route inventory, ordered by dispatch precedence. */
export const APP_ROUTE_QUERY_REGISTRY = APP_ROUTE_QUERY_MANIFEST.map((route) => ({
  ...route,
  pageMode: pageModeForScrollPolicy(route.defaultScrollPolicy),
}));

/** Exact retired entries only; replacement preserves Pages subpaths and history. */
export function normalizeRetiredMathRoute(url: URL): boolean {
  const search = url.searchParams;
  // Preserve the existing precedence of supported Chinese and English play routes.
  if (APP_ROUTE_QUERY_MANIFEST.some((route) => route.kind === "play" && search.get("play") === route.queryValue)) return false;
  if (search.get("world") !== "math-world" || search.getAll("station").length !== 1
    || !RETIRED_MATH_WORLD_STATION_IDS.some((id) => id === search.get("station"))) return false;
  search.delete("station");
  search.delete("hub");
  search.set("notice", "retired-game");
  return true;
}

function pageModeForScrollPolicy(policy: ScrollPolicy): PageMode {
  return policy === "document" ? "game-scrollable" : "game-fullscreen";
}

function routeSpecificity(route: string): number {
  return [...new URLSearchParams(route.startsWith("?") ? route.slice(1) : route)].length;
}

function surfaceMatches(search: URLSearchParams, surface: PlaySurfaceRecord): boolean {
  const expected = new URLSearchParams(surface.route.startsWith("?") ? surface.route.slice(1) : surface.route);
  return [...expected].every(([key, value]) => search.get(key) === value);
}

export function playSurfaceForSearch(search: URLSearchParams): PlaySurfaceRecord | null {
  return [...PLAY_SURFACE_MANIFEST]
    .sort((left, right) => routeSpecificity(right.route) - routeSpecificity(left.route))
    .find((surface) => surfaceMatches(search, surface)) ?? null;
}

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

export function pageModeForSearch(search: URLSearchParams): PageMode {
  const surface = playSurfaceForSearch(search);
  if (surface) return pageModeForScrollPolicy(surface.scrollPolicy);
  const registration = APP_ROUTE_QUERY_REGISTRY.find((route) => search.get(route.queryKey) === route.queryValue);
  if (registration) return registration.pageMode;

  // Unknown or absent query parameters render My Game World in mountApp, so
  // they must use that surface's scroll contract as well, including a bare first
  // open, a bookmarked query and a return from a child world.
  const defaultSurface = PLAY_SURFACE_MANIFEST.find((record) => record.id === "my-game-world");
  return pageModeForScrollPolicy(defaultSurface?.scrollPolicy ?? "document");
}
