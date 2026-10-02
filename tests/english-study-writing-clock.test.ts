import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWritingClock } from '../games/english-study/writing-clock';
import { WritingPlayer } from '../games/english-study/writing-player';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++serial, callback); return serial; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const player = new WritingPlayer([{ charIndex: 0, length: 140, dot: false }]);
  const sync = vi.fn(), clock = createWritingClock(() => player, sync);
  const frame = (timestamp: number) => {
    const [id, callback] = callbacks.entries().next().value!;
    callbacks.delete(id); callback(timestamp);
  };
  player.play(); clock.startFrame();
  return { player, clock, sync, frame, callbacks };
}

describe('English writing frame ownership', () => {
  it('caps ordinary delayed frames at 100ms while preserving continuous partial ink', () => {
    const { player, frame } = setup();
    frame(0); frame(200);
    const reference = new WritingPlayer(player.strokes);
    reference.play(); reference.advance(100);
    expect(player.fraction).toBe(reference.fraction);
    expect(player.stageElapsed).toBe(reference.stageElapsed);
    expect(player.status).toBe('playing');
  });

  it('pauses after a gap above 500ms and resumes only on a new explicit start', () => {
    const { player, clock, frame, callbacks } = setup();
    for (const timestamp of [0, 100, 200, 300, 400]) frame(timestamp);
    const held = player.fraction; expect(held).toBeGreaterThan(0);
    frame(901);
    expect(player.status).toBe('paused'); expect(player.fraction).toBe(held);
    expect(callbacks.size).toBe(0);
    player.play(); clock.startFrame(); frame(5000);
    expect(player.fraction).toBe(held);
    frame(5100); expect(player.fraction).toBeGreaterThan(held);
    clock.cancelFrame(); expect(callbacks.size).toBe(0);
  });

  it('pause cancels the owned frame and preserves the current stroke fraction', () => {
    const { player, clock, frame, callbacks, sync } = setup();
    for (const timestamp of [0, 100, 200, 300, 390]) frame(timestamp);
    const held = player.fraction; expect(held).toBeGreaterThan(0);
    clock.pauseWriting();
    expect(callbacks.size).toBe(0); expect(player.fraction).toBe(held);
    expect(player.status).toBe('paused'); expect(sync).toHaveBeenCalled();
  });
});
