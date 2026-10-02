import { WritingPlayer } from './writing-player';

export function createWritingClock(activePlayer:()=>WritingPlayer|null,syncUi:()=>void) {
let frame=0,lastFrame:number|null=null;
function cancelFrame(): void { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = null; }
function animate(timestamp: number): void {
    frame = 0;
    const player = activePlayer();
    if (!player || player.status !== 'playing' || document.hidden) return;
    if (lastFrame !== null && timestamp - lastFrame > 500) {
      // Some desktop browsers keep document.hidden=false when their window is
      // minimized, but throttle animation frames to roughly one per second.
      player.pause(); lastFrame = null; syncUi(); return;
    }
    if (lastFrame !== null) player.advance(Math.min(100, timestamp - lastFrame));
    lastFrame = timestamp;
    syncUi();
    if (player.status === 'playing') frame = requestAnimationFrame(animate);
    else lastFrame = null;
  }
function startFrame(): void { cancelFrame(); frame = requestAnimationFrame(animate); }
function pauseWriting(): void { activePlayer()?.pause(); cancelFrame(); syncUi(); }
return {cancelFrame,startFrame,pauseWriting};
}
