import { ROOMS, type Direction, type Entity, type Room, type Sentence, type WorldState } from './rooms';
export type Action = { type: 'move'; direction: Direction } | { type: 'take'; target: number } | { type: 'put'; target: number } | { type: 'combine'; target: number } | { type: 'split'; target: number; side: 'left' | 'right' };
export interface Transition { ok: boolean; state: WorldState; message: string; trail: number[]; }
export interface Journey { room: number; unlocked: number; state: WorldState; history: WorldState[]; }
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
export function passable(room: Room, state: WorldState, pos: number): boolean {
  const tile = room.tiles[pos], entity = at(state, pos);
  if (!tile || tile === 'wall' || tile === 'rule' || tile === 'socket') return false;
  if (tile === 'door' && !effect(room, state, pos)) return false;
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
  if (tile !== 'floor') return '这里没有可放字的地面。';
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
    if (!passable(room, state, next)) return fail(room.tiles[next] === 'water' ? '水上还没有木。' : room.tiles[next] === 'door' ? '门还没有开，看看绑定的短句。' : '这里走不通，试试相邻的路。');
    state.player = next; trail.push(next);
  } else {
    if (!Number.isSafeInteger(action.target) || action.target < 0 || action.target >= room.tiles.length || distance(room, state.player, action.target) !== 1) return fail('走到字旁边，才能拿、放、拆或合。');
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
      if (hand?.kind !== '木' || item?.kind !== '木') return fail('手里一枚木，身旁一枚木，才能合成林。');
      state.entities = state.entities.filter(e => e !== hand && e !== item);
      state.entities.push({ kind: '林', atoms: hand.atoms | item.atoms, pos: null });
      message = '木在左，木在右，合成一个完整的林。手里现在带着林。';
    } else {
      if (item?.kind !== '林') return fail('只有林能拆成两枚木。');
      if (action.side !== 'left' && action.side !== 'right') return fail('请选择林左边或右边的落字格。');
      const second = neighbor(room, action.target, action.side);
      if (room.tiles[action.target] !== 'floor' || room.tiles[second] !== 'floor') return fail('拆林需要左右相邻的两格岸上空地。可以先把林搬到宽处。');
      const reason = placementReason(room, state, { kind: '木', atoms: 0, pos: null }, second); if (reason) return fail(`拆出的木放不下：${reason}`);
      const firstAtom = item.atoms & -item.atoms;
      state.entities = state.entities.filter(e => e !== item);
      state.entities.push({ kind: '木', atoms: firstAtom, pos: action.target }, { kind: '木', atoms: item.atoms ^ firstAtom, pos: second });
      message = '林拆成了两枚木，一左一右。两枚都还在这里。';
    }
  }
  // Rule changes cannot close a door on a person or remove the water layer's support.
  if (!passable(room, state, state.player)) return fail('这一步会让人失去落脚处。先离开门格或木桥，再改字。');
  const seen = new Set<number>();
  while (room.tiles[state.player] === 'wind' && effect(room, state, state.player)) {
    if (seen.has(state.player)) return fail('风会绕回原处，这一步没有执行。');
    seen.add(state.player);
    const next = neighbor(room, state.player, room.wind[state.player]!);
    if (!passable(room, state, next)) return fail('风的落脚处被挡住了。先给人留出落脚处。');
    state.player = next; trail.push(next);
  }
  // A wind that returns the player to exactly the same state is an invalid, free attempt.
  if (action.type === 'move' && state.player === before.player) return fail('风把这条路吹向另一边。可以改短句，或找另一条路。');
  const changes = room.sentences.filter(s => enabled(before, s) !== enabled(state, s));
  if (changes.length) message += ` ${changes.map(s => `${sentenceText(state, s)}了`).join('，')}。`;
  state.won = room.tiles[state.player] === 'goal';
  return { ok: true, state, message: state.won ? room.departure : message || (trail.length > 1 ? '顺着风，到了另一边。' : ''), trail };
}

export function newJourney(roomIndex = 0, unlocked = 0): Journey { return { room: roomIndex, unlocked, state: clone(ROOMS[roomIndex].initial), history: [] }; }
export function perform(journey: Journey, action: unknown): { journey: Journey; result: Transition } {
  const result = act(ROOMS[journey.room], journey.state, action);
  return { result, journey: result.ok ? { ...journey, state: result.state, history: [...journey.history.slice(-255), journey.state], unlocked: result.state.won ? Math.max(journey.unlocked, Math.min(4, journey.room + 1)) : journey.unlocked } : journey };
}
export function undo(journey: Journey): Journey { return journey.history.length ? { ...journey, state: journey.history.at(-1)!, history: journey.history.slice(0, -1) } : journey; }
export const restart = (journey: Journey) => newJourney(journey.room, journey.unlocked);
export function nextRoom(journey: Journey): Journey { return journey.state.won && journey.room < ROOMS.length - 1 ? newJourney(journey.room + 1, journey.unlocked) : journey; }

/** Stable-save and adversarial-test invariant; all initial material atoms survive exactly once. */
export function validState(room: Room, value: unknown): value is WorldState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as WorldState;
  if (!Number.isSafeInteger(s.player) || s.player < 0 || s.player >= room.tiles.length || typeof s.won !== 'boolean' || !Array.isArray(s.entities) || s.entities.length > 8) return false;
  let atoms = 0, woods = 0, nots = 0, hands = 0; const positions = new Set<number>();
  for (const e of s.entities) {
    if (!e || typeof e !== 'object' || !['木', '林', '不'].includes(e.kind) || !Number.isSafeInteger(e.atoms) || e.atoms < 1 || e.atoms > 255 || (atoms & e.atoms)) return false;
    const count = e.atoms.toString(2).replaceAll('0', '').length;
    if (count !== (e.kind === '林' ? 2 : 1)) return false;
    atoms |= e.atoms; if (e.kind === '不') nots |= e.atoms; else woods |= e.atoms;
    if (e.pos === null) { hands++; continue; }
    if (!Number.isSafeInteger(e.pos) || positions.has(e.pos) || e.pos < 0 || e.pos >= room.tiles.length) return false;
    positions.add(e.pos);
    const tile = room.tiles[e.pos];
    if (!(tile === 'floor' || (tile === 'water' && e.kind === '木') || (tile === 'socket' && e.kind === '不'))) return false;
  }
  return woods === room.woodAtoms && nots === room.notAtoms && hands <= 1 && passable(room, s, s.player)
    && s.won === (room.tiles[s.player] === 'goal') && !(room.tiles[s.player] === 'wind' && effect(room, s, s.player));
}

export function describeAction(room: Room, state: WorldState, action: Action): string {
  if (action.type === 'move') return `向${DIR_NAMES[action.direction]}走一步。`;
  const x = action.target % room.width + 1, y = Math.floor(action.target / room.width) + 1;
  const location = `第${y}行第${x}列`;
  if (action.type === 'take') return `拿起${location}的${at(state, action.target)?.kind ?? '字'}。`;
  if (action.type === 'put') return `把手里的${carried(state)?.kind ?? '字'}放到${location}。`;
  if (action.type === 'combine') return `把手里的木与${location}的木合成林。`;
  return `拆开${location}的林，另一枚木放在它${action.side === 'left' ? '左' : '右'}边。`;
}
