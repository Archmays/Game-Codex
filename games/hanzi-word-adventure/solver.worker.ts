import { ROOMS } from './rooms';
import { solve } from './solver';
self.onmessage = (event) => { const { id, room, state } = event.data; self.postMessage({ id, result: solve(ROOMS[room], state) }); };
