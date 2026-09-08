import { ROOMS, chapterForRoom, lastInChapter, type ChapterId, type Direction, type Entity, type Room, type Sentence, type WorldState } from './rooms';
export type Action = { type: 'move'; direction: Direction } | { type: 'take'; target: number } | { type: 'put'; target: number } | { type: 'combine'; target: number } | { type: 'split'; target: number; side: 'left' | 'right' };
export interface Transition { ok: boolean; state: WorldState; message: string; trail: number[]; }
export interface Journey { chapterId: ChapterId; roomId: string; room: number; unlocked: number; state: WorldState; history: WorldState[]; }
export const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];
export const DIR_NAMES: Record<Direction, string> = { up: '上', right: '右', down: '下', left: '左' };
export const clone = <T>(value: T): T => structuredClone(value);
export const at = (state: WorldState, pos: number) => state.entities.find(e => e.pos === pos);
export const carried = (state: WorldState) => state.entities.find(e => e.pos === null);
export const distance = (room: Room, a: number, b: number) => Math.abs(a % room.width - b % room.width) + Math.abs(Math.floor(a / room.width) - Math.floor(b / room.width));
export function neighbor(room: Room, pos: number, direction: Direction): number {
  const next = pos + ({ up: -room.width, right: 1, down: room.width, left: -1 })[direction];
  return next >= 0 && next < room.tiles.length && distance(room, pos, next) === 1 ? next : -1;
}
export const enabled = (state: WorldState, sentence: Sentence) => at(state, sentence.cells[1])?.kind !== '不';
export const sentenceText = (state: WorldState, sentence: Sentence) => `${sentence.subject}${enabled(state, sentence) ? '' : '不'}${sentence.verb}`;
export function effect(room: Room, state: WorldState, pos: number): boolean {
  const sentence = room.sentences.find(s => s.targets.includes(pos));
  return sentence ? enabled(state, sentence) : true;
}
/** Light travels through orthogonally adjacent cells, at most three steps. Mountains,
 * sentence cells and closed doors block propagation. Every lit tile has an exact distance. */
export function illumination(room: Room, state: WorldState): Map<number, number> {
  const light = new Map<number, number>(), queue: number[] = [];
  for (const e of state.entities) if (e.kind === '明') { const source = e.pos ?? state.player; light.set(source, 0); queue.push(source); }
  for (let i = 0; i < queue.length; i++) {
    const pos = queue[i], d = light.get(pos)!; if (d >= room.lightRadius) continue;
    for (const direction of DIRECTIONS) {
      const next = neighbor(room, pos, direction), tile = room.tiles[next];
      if (!tile || ['wall', 'rule', 'socket'].includes(tile) || (tile === 'door' && !effect(room, state, next))) continue;
      if ((light.get(next) ?? Infinity) <= d + 1) continue;
      light.set(next, d + 1); queue.push(next);
    }
  }
  return light;
}
export const visible = (room: Room, state: WorldState, pos: number) => room.tiles[pos] !== 'shadow' || illumination(room, state).has(pos);
export function combineKind(a?: Entity, b?: Entity): '林' | '明' | null {
  if (a?.kind === '木' && b?.kind === '木') return '林';
  return (a?.kind === '日' && b?.kind === '月') || (a?.kind === '月' && b?.kind === '日') ? '明' : null;
}
export function passable(room: Room, state: WorldState, pos: number): boolean {
  const tile = room.tiles[pos], entity = at(state, pos);
  if (!tile || tile === 'wall' || tile === 'rule' || tile === 'socket') return false;
  if (tile === 'door' && !effect(room, state, pos)) return false;
  if (tile === 'shadow' && !visible(room, state, pos)) return false;
  if (tile === 'water') return entity?.kind === '木';
  return !entity;
}
export function placementReason(room: Room, state: WorldState, entity: Entity, target: number): string {
  if (target === state.player) return '人正站在这里，先空出这一格。';
  if (at(state, target)) return '这一格已经有字，先腾出地方。';
  const tile = room.tiles[target];
  if (tile === 'socket') return entity.kind === '不' ? '' : '这是句中的“不”字位，只能放“不”。';
  if (tile === 'water') return entity.kind === '木' ? '' : '只有木能铺在水上；林要先在岸上拆开。';
  if (tile === 'wind') return '风格是通路，不是落字处。把字带到岸上再放。';
  if (tile === 'shadow' && !visible(room, state, target)) return '影格还未照亮，不能向不可见处放字。';
  if (tile !== 'floor' && tile !== 'shadow') return '这里没有可放字的地面。';
  return '';
}

/** Pure, atomic world transition. Animation never owns a rule or partial state. */
export function act(room: Room, before: WorldState, input: unknown): Transition {
  const fail = (message: string): Transition => ({ ok: false, state: before, message, trail: [] });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('这个动作没有执行。');
  const action = input as Action;
  if (!['move', 'take', 'put', 'split', 'combine'].includes(action.type)) return fail('这个动作没有执行。');
  if (before.won) return fail('已到达出口。可以继续旅程，或撤销这一步。');
  const state: WorldState = { player: before.player, won: before.won, entities: before.entities.map(e => ({ ...e })) }, hand = carried(state);
  const trail: number[] = []; let message = '';
  if (action.type === 'move') {
    if (!DIRECTIONS.includes(action.direction)) return fail('方向没有执行。');
    const next = neighbor(room, state.player, action.direction);
    // A carried light moves with the person; check the destination using that resulting light.
    const arrival = carried(state)?.kind === '明' ? { ...state, player: next } : state;
    if (!passable(room, arrival, next)) return fail(room.tiles[next] === 'shadow' ? '影格还未照亮，明只能沿相邻通格照三步。' : room.tiles[next] === 'water' ? '水上还没有木。' : room.tiles[next] === 'door' ? '门还没有开，看看绑定的短句。' : '这里走不通，试试相邻的路。');
    state.player = next; trail.push(next);
  } else {
    if (!Number.isSafeInteger(action.target) || action.target < 0 || action.target >= room.tiles.length || distance(room, state.player, action.target) !== 1) return fail('走到字旁边，才能拿、放、拆或合。');
    if (!visible(room, state, action.target)) return fail('影格还未照亮，不能拿走或改变看不见的字。');
    const item = at(state, action.target);
    if (action.type === 'take') {
      if (hand) return fail('手里最多带一个字。先放下，或把两枚木合成林。');
      if (!item) return fail('这里没有可拿的字。');
      item.pos = null; message = `拿起了${item.kind}。手里只能带一个字。`;
    } else if (action.type === 'put') {
      if (!hand) return fail('手里没有字。');
      const reason = placementReason(room, state, hand, action.target); if (reason) return fail(reason);
      hand.pos = action.target; message = room.tiles[action.target] === 'water' ? '木铺在水上，这一步可以走了。' : `放下了${hand.kind}。`;
    } else if (action.type === 'combine') {
      const kind = combineKind(hand, item);
      if (!kind || !hand || !item) return fail('手里与身旁需要两枚木，或一枚日和一枚月。');
      state.entities = state.entities.filter(e => e !== hand && e !== item);
      state.entities.push({ kind, atoms: hand.atoms | item.atoms, pos: null });
      message = kind === '林' ? '木在左，木在右，合成一个完整的林。手里现在带着林。' : '日在左，月在右，合成完整的明。明是游戏中的光源，不是字源解释。';
    } else {
      if (item?.kind !== '林' && item?.kind !== '明') return fail('林能拆成两枚木；明能拆成日和月。');
      if (action.side !== 'left' && action.side !== 'right') return fail(`请选择${item.kind}左边或右边的落字格。`);
      const second = neighbor(room, action.target, action.side);
      if (!['floor', 'shadow'].includes(room.tiles[action.target]) || !['floor', 'shadow'].includes(room.tiles[second])) return fail(`拆${item.kind}需要左右相邻的两格空地。可以先把${item.kind}搬到宽处。`);
      const reason = placementReason(room, state, { kind: '木', atoms: 0, pos: null }, second); if (reason) return fail(`拆出的${item.kind === '明' ? '日和月' : '木'}放不下：${reason}`);
      const firstAtom = item.atoms & -item.atoms;
      state.entities = state.entities.filter(e => e !== item);
      if (item.kind === '林') state.entities.push({ kind: '木', atoms: firstAtom, pos: action.target }, { kind: '木', atoms: item.atoms ^ firstAtom, pos: second });
      else state.entities.push({ kind: '日', atoms: item.atoms & room.sunAtoms, pos: action.side === 'left' ? second : action.target }, { kind: '月', atoms: item.atoms & room.moonAtoms, pos: action.side === 'left' ? action.target : second });
      message = item.kind === '林' ? '林拆成了两枚木，一左一右。两枚都还在这里。' : '明拆成了日和月，日在左，月在右；现在没有光源。';
    }
  }
  // Rule changes cannot close a door on a person or remove the water layer's support.
  if (!passable(room, state, state.player)) return fail('这一步会让人失去落脚处。先离开门格、木桥或将要变暗的影格，再改字。');
  const seen = new Set<number>();
  while (room.tiles[state.player] === 'wind' && effect(room, state, state.player)) {
    if (seen.has(state.player)) return fail('风会绕回原处，这一步没有执行。');
    seen.add(state.player);
    const next = neighbor(room, state.player, room.wind[state.player]!);
    if (!passable(room, carried(state)?.kind === '明' ? { ...state, player: next } : state, next)) return fail('风的落脚处被挡住了。先给人留出落脚处。');
    state.player = next; trail.push(next);
  }
  // A wind that returns the player to exactly the same state is an invalid, free attempt.
  if (action.type === 'move' && state.player === before.player) return fail('风把这条路吹向另一边。可以改短句，或找另一条路。');
  const changes = room.sentences.filter(s => enabled(before, s) !== enabled(state, s));
  if (changes.length) message += ` ${changes.map(s => `${sentenceText(state, s)}了`).join('，')}。`;
  state.won = room.tiles[state.player] === 'goal';
  return { ok: true, state, message: state.won ? room.departure : message || (trail.length > 1 ? '顺着风，到了另一边。' : ''), trail };
}

export function newJourney(roomIndex = 0, unlocked = roomIndex): Journey { return { chapterId: ROOMS[roomIndex].chapterId, roomId: ROOMS[roomIndex].id, room: roomIndex, unlocked, state: clone(ROOMS[roomIndex].initial), history: [] }; }
export function perform(journey: Journey, action: unknown): { journey: Journey; result: Transition } {
  const result = act(ROOMS[journey.room], journey.state, action);
  return { result, journey: result.ok ? { ...journey, state: result.state, history: [...journey.history.slice(-255), journey.state], unlocked: result.state.won ? Math.max(journey.unlocked, lastInChapter(journey.room) ? journey.room : journey.room + 1) : journey.unlocked } : journey };
}
export function undo(journey: Journey): Journey { return journey.history.length ? { ...journey, state: journey.history.at(-1)!, history: journey.history.slice(0, -1) } : journey; }
export const restart = (journey: Journey) => newJourney(journey.room, journey.unlocked);
export function nextRoom(journey: Journey): Journey { return journey.state.won && !lastInChapter(journey.room) ? newJourney(journey.room + 1, journey.unlocked) : journey; }

/** Stable-save and adversarial-test invariant; all initial material atoms survive exactly once. */
export function validState(room: Room, value: unknown): value is WorldState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as WorldState;
  if (!Number.isSafeInteger(s.player) || s.player < 0 || s.player >= room.tiles.length || typeof s.won !== 'boolean' || !Array.isArray(s.entities) || s.entities.length > 8) return false;
  let atoms = 0, woods = 0, nots = 0, suns = 0, moons = 0, hands = 0; const positions = new Set<number>();
  for (const e of s.entities) {
    if (!e || typeof e !== 'object' || !['木', '林', '不', '日', '月', '明'].includes(e.kind) || !Number.isSafeInteger(e.atoms) || e.atoms < 1 || e.atoms > 255 || (atoms & e.atoms)) return false;
    const count = e.atoms.toString(2).replaceAll('0', '').length;
    if (count !== (e.kind === '林' || e.kind === '明' ? 2 : 1)) return false;
    atoms |= e.atoms;
    if (e.kind === '不') nots |= e.atoms;
    else if (e.kind === '木' || e.kind === '林') woods |= e.atoms;
    else if (e.kind === '日') suns |= e.atoms;
    else if (e.kind === '月') moons |= e.atoms;
    else { if (!(e.atoms & room.sunAtoms) || !(e.atoms & room.moonAtoms)) return false; suns |= e.atoms & room.sunAtoms; moons |= e.atoms & room.moonAtoms; }
    if (e.pos === null) { hands++; continue; }
    if (!Number.isSafeInteger(e.pos) || positions.has(e.pos) || e.pos < 0 || e.pos >= room.tiles.length) return false;
    positions.add(e.pos);
    const tile = room.tiles[e.pos];
    if (!(tile === 'floor' || tile === 'shadow' || (tile === 'water' && e.kind === '木') || (tile === 'socket' && e.kind === '不'))) return false;
  }
  return woods === room.woodAtoms && nots === room.notAtoms && suns === room.sunAtoms && moons === room.moonAtoms && hands <= 1 && passable(room, s, s.player)
    && s.won === (room.tiles[s.player] === 'goal') && !(room.tiles[s.player] === 'wind' && effect(room, s, s.player));
}

export function describeAction(room: Room, state: WorldState, action: Action): string {
  if (action.type === 'move') return `向${DIR_NAMES[action.direction]}走一步。`;
  const x = action.target % room.width + 1, y = Math.floor(action.target / room.width) + 1;
  const location = `第${y}行第${x}列`;
  if (action.type === 'take') return `拿起${location}的${at(state, action.target)?.kind ?? '字'}。`;
  if (action.type === 'put') return `把手里的${carried(state)?.kind ?? '字'}放到${location}。`;
  if (action.type === 'combine') return `把手里的${carried(state)?.kind}与${location}的${at(state, action.target)?.kind}合成${combineKind(carried(state), at(state, action.target))}。`;
  return `拆开${location}的${at(state, action.target)?.kind}，第二格在它${action.side === 'left' ? '左' : '右'}边。`;
}
