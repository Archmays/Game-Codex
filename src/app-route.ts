export type AppRouteKind = "play" | "observe-step06" | "observe-step04" | "review-step05" | "review-step03" | "review-step02" | "classic-hub" | "world";

export interface ResolvedAppRoute {
  readonly kind: AppRouteKind;
  readonly explicit: boolean;
}

export function isStep06EvidenceAttempt(search: URLSearchParams): boolean {
  return search.get("evidence") === "hanzi-v2-step06" || search.has("session");
}

/** STEP 06 routing contract: play > observe > review > explicit hub > world alias > default world. */
export function resolveAppRoute(search: URLSearchParams): ResolvedAppRoute {
  if (search.get("play") === "hanzi-v2-golden-slice") return { kind: "play", explicit: true };
  if (search.get("observe") === "hanzi-v2-step06") return { kind: "observe-step06", explicit: true };
  if (search.get("observe") === "hanzi-v2-step04") return { kind: "observe-step04", explicit: true };
  if (search.get("review") === "hanzi-v2-step05") return { kind: "review-step05", explicit: true };
  if (search.get("review") === "hanzi-v2-step03") return { kind: "review-step03", explicit: true };
  if (search.get("review") === "hanzi-v2-step02") return { kind: "review-step02", explicit: true };
  if (search.get("hub") === "classic") return { kind: "classic-hub", explicit: true };
  if (search.get("world") === "my-game-world") return { kind: "world", explicit: true };
  return { kind: "world", explicit: false };
}
