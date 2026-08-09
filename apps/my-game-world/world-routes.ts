export const MY_GAME_WORLD_ROUTE = "?world=my-game-world";
export const INK_FOREST_ROUTE = "?play=hanzi-v2-golden-slice&mode=play&from=world";
export const CLASSIC_HUB_FROM_WORLD_ROUTE = "?hub=classic&from=world";

export const MY_GAME_WORLD_TITLE = "我的游戏世界";

export interface Step06RouteContext {
  readonly evidence: "hanzi-v2-step06";
  readonly sessionId: string;
}

export function withStep06RouteContext(
  route: string,
  context?: Step06RouteContext,
  from?: "world" | "forest" | "classic",
): string {
  if (!context) return route;
  const query = new URLSearchParams(route.startsWith("?") ? route.slice(1) : route);
  query.set("evidence", context.evidence);
  query.set("session", context.sessionId);
  if (from) query.set("from", from);
  return `?${query.toString()}`;
}
