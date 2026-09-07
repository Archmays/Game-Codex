import { act, carried, DIRECTIONS, neighbor, type Action } from './model';
import type { Room, WorldState } from './rooms';
export interface SearchResult { status: 'solved' | 'unsolvable' | 'limit'; actions: Action[]; visited: number; expanded: number; limit: number; }
export interface SearchOptions { limit?: number; allow?: (state: WorldState, action: Action) => boolean; }
const piecesKey = (s: WorldState) => s.entities.map(e => `${e.kind}${e.pos ?? 'h'}`).sort().join(',');
type Reach = { state: WorldState; walk: Action[] };
function reachable(room: Room, state: WorldState): Reach[] {
  const found: Reach[] = [{ state, walk: [] }], seen = new Set([state.player]);
  for (let i = 0; i < found.length; i++) {
    const current = found[i]; if (current.state.won) continue;
    for (const direction of DIRECTIONS) {
      const action: Action = { type: 'move', direction }, step = act(room, current.state, action);
      if (step.ok && !seen.has(step.state.player)) { seen.add(step.state.player); found.push({ state: step.state, walk: [...current.walk, action] }); }
    }
  }
  return found;
}
export function manipulationActions(room: Room, state: WorldState): Action[] {
  const actions: Action[] = [], hand = carried(state);
  for (const direction of DIRECTIONS) {
    const target = neighbor(room, state.player, direction); if (target < 0) continue;
    if (hand) actions.push({ type: 'put', target }, { type: 'combine', target });
    else actions.push({ type: 'take', target });
    actions.push({ type: 'split', target, side: 'left' }, { type: 'split', target, side: 'right' });
  }
  return actions;
}
/** Bounded BFS over manipulations and exact directed walking reachability.
 * Macro edges carry every ordinary move; no teleportation or authored solution lookup.
 * Equivalent wood identities are merged only for search, never for runtime saves.
 */
export function solve(room: Room, initial: WorldState, options: SearchOptions = {}): SearchResult {
  const limit = options.limit ?? 40_000;
  type Node = { state: WorldState; reach: Reach[]; parent: number; edge: Action[] };
  const firstReach = reachable(room, initial), nodes: Node[] = [{ state: initial, reach: firstReach, parent: -1, edge: [] }];
  const key = (s: WorldState, reach: Reach[]) => `${piecesKey(s)}|${reach.map(r => r.state.player).sort((a, b) => a - b).join('.')}`;
  const seen = new Set([key(initial, firstReach)]); let expanded = 0;
  const result = (status: SearchResult['status'], actions: Action[] = []): SearchResult => ({ status, actions, visited: seen.size, expanded, limit });
  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i]; expanded++;
    const goal = current.reach.find(r => r.state.won);
    if (goal) {
      const chunks: Action[][] = [goal.walk]; let index = i;
      while (index >= 0) { chunks.push(nodes[index].edge); index = nodes[index].parent; }
      return result('solved', chunks.reverse().flat());
    }
    for (const reach of current.reach) for (const action of manipulationActions(room, reach.state)) {
      if (options.allow && !options.allow(reach.state, action)) continue;
      const step = act(room, reach.state, action); if (!step.ok) continue;
      const nextReach = reachable(room, step.state), nextKey = key(step.state, nextReach); if (seen.has(nextKey)) continue;
      if (seen.size >= limit) return result('limit');
      seen.add(nextKey); nodes.push({ state: step.state, reach: nextReach, parent: i, edge: [...reach.walk, action] });
    }
  }
  return result('unsolvable');
}
