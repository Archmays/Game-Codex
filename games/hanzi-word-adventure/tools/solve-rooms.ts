import { mkdirSync, writeFileSync } from 'node:fs';
import { ROOMS } from '../rooms';
import { act, carried, validState } from '../model';
import { solve } from '../solver';
const directory = process.env.HWAY_EVIDENCE_DIR ?? 'tmp/tasks/GAME-CODEX-STEP4/adventure'; mkdirSync(directory, { recursive: true });
const records = ROOMS.map(room => {
  if (!validState(room, room.initial)) throw Error(`Invalid initial ${room.id}`);
  const start = performance.now(), search = solve(room, room.initial);
  let state = room.initial;
  for (const action of search.actions) { const step = act(room, state, action); if (!step.ok || !validState(room, step.state)) throw Error(`Invalid replay ${room.id}: ${JSON.stringify(action)}`); state = step.state; }
  console.log(room.id, search.status, search.actions.length, search.visited, Math.round(performance.now() - start), 'ms');
  if (!state.won) throw Error(`Unsolved ${room.id}`);
  return { room: room.id, search, replayWon: state.won };
});
const necessity = [
  { room: 0, without: 'take' }, { room: 1, without: 'put' }, { room: 2, without: 'split' }, { room: 3, without: 'combine' }, { room: 3, without: 'split' },
].map(test => { const room = ROOMS[test.room]; const search = solve(room, room.initial, { allow: (_, a) => a.type !== test.without }); console.log(room.id, 'without', test.without, search.status, search.visited); return { ...test, search }; });
const final = ROOMS[4], windSlot = final.sentences.find(s => s.subject === '风')!.cells[1];
const alternate = solve(final, final.initial, { allow: (s, a) => !(a.type === 'put' && a.target === windSlot && carried(s)?.kind === '不') });
console.log('r5 wind remains on:', alternate.status, alternate.actions.length, alternate.visited);
writeFileSync(`${directory}/room-search.json`, JSON.stringify({ algorithm: 'manipulation BFS with directed movement closure; not shortest total action count', records, necessity, alternate }, null, 2));
if (necessity.some(n => n.search.status !== 'unsolvable') || alternate.status !== 'solved') process.exitCode = 1;
