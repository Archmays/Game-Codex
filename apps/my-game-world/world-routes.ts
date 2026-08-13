export const MY_GAME_WORLD_ROUTE = "?world=my-game-world";
/** Frozen STEP 05–07 observation route. */
export const INK_FOREST_ROUTE = "?play=hanzi-v2-golden-slice&mode=play&from=world";
/** Current ordinary family-play route; never used inside a historical observer session. */
export const HANZI_MAGIC_V1_ROUTE = "?play=hanzi-v2-v1&from=world";
export const CLASSIC_HUB_FROM_WORLD_ROUTE = "?hub=classic&from=world";

export const MY_GAME_WORLD_TITLE = "我的游戏世界";

export type SecondUseEvidenceId = "hanzi-v2-step06" | "hanzi-v2-step07";

export interface SecondUseRouteContext {
  readonly evidence: SecondUseEvidenceId;
  readonly sessionId: string;
}

/** Backward-compatible name retained for STEP 06 callers. */
export type Step06RouteContext = SecondUseRouteContext;

export function withStep06RouteContext(
  route: string,
  context?: SecondUseRouteContext,
  from?: "world" | "forest" | "classic",
): string {
  if (!context) return route;
  const query = new URLSearchParams(route.startsWith("?") ? route.slice(1) : route);
  query.set("evidence", context.evidence);
  query.set("session", context.sessionId);
  if (from) query.set("from", from);
  return `?${query.toString()}`;
}
