import { describe, expect, it, vi } from 'vitest';
import { createHintSearch, type HintWorker } from '../games/hanzi-word-adventure/hint-search';
import { ROOMS } from '../games/hanzi-word-adventure/rooms';
import type { SearchResult } from '../games/hanzi-word-adventure/solver';

const solved: SearchResult = { status: 'solved', actions: [], visited: 0, expanded: 0, limit: 40000 };
function fixture() {
  const workers: (HintWorker & { messages: { id: number }[] })[] = [];
  const result = vi.fn(), error = vi.fn();
  const search = createHintSearch({ result, error, createWorker: () => {
    const worker = { onmessage: null, onerror: null, messages: [], postMessage(message) { this.messages.push(message); }, terminate: vi.fn() } as HintWorker & { messages: { id: number }[] };
    workers.push(worker); return worker;
  } });
  const request = () => search.request(0, ROOMS[0].initial);
  const reply = (worker: typeof workers[number], id = worker.messages[0].id) => worker.onmessage?.({ data: { id, result: solved } } as MessageEvent);
  return { search, workers, result, error, request, reply };
}
describe('adventure hint worker ownership', () => {
  it('cancels a pending search and ignores its delayed message/error while a successor is active', () => {
    const f = fixture(); f.request(); const first = f.workers[0];
    f.search.cancel(); f.request(); const second = f.workers[1];
    f.reply(first); first.onerror?.({} as ErrorEvent);
    expect(f.result).not.toHaveBeenCalled(); expect(f.error).not.toHaveBeenCalled();
    expect(first.terminate).toHaveBeenCalledTimes(1); expect(second.terminate).not.toHaveBeenCalled();
    expect(f.search.pending).toBe(true);
    f.reply(second); expect(f.result).toHaveBeenCalledExactlyOnceWith(solved);
    expect(second.terminate).toHaveBeenCalledTimes(1); expect(f.search.pending).toBe(false);
  });
  it('serializes requests and ignores wrong IDs, repeated replies and every callback after destroy', () => {
    const f = fixture(); f.request(); f.request(); expect(f.workers).toHaveLength(1);
    f.reply(f.workers[0], -1); expect(f.search.pending).toBe(true);
    f.reply(f.workers[0]); f.reply(f.workers[0]); expect(f.result).toHaveBeenCalledTimes(1);
    f.request(); const second = f.workers[1]; f.search.destroy(); f.search.destroy();
    f.reply(second); second.onerror?.({} as ErrorEvent); f.request();
    expect(f.result).toHaveBeenCalledTimes(1); expect(f.error).not.toHaveBeenCalled();
    expect(second.terminate).toHaveBeenCalledTimes(1); expect(f.workers).toHaveLength(2);
  });
  it('releases ownership after errors and safely retries constructor/post failures', () => {
    const f = fixture(); f.request(); f.workers[0].onerror?.({} as ErrorEvent);
    expect(f.error).toHaveBeenCalledTimes(1); expect(f.search.pending).toBe(false);
    f.request(); f.reply(f.workers[1]); expect(f.result).toHaveBeenCalledTimes(1);
    const error = vi.fn(), terminate = vi.fn(); let construction = true;
    const search = createHintSearch({ result: vi.fn(), error, createWorker: () => {
      if (construction) throw Error('blocked');
      return { onmessage: null, onerror: null, terminate, postMessage() { throw Error('closed'); } };
    } });
    search.request(0, ROOMS[0].initial); construction = false; search.request(0, ROOMS[0].initial);
    expect(error).toHaveBeenCalledTimes(2); expect(terminate).toHaveBeenCalledTimes(1); expect(search.pending).toBe(false);
  });
});
