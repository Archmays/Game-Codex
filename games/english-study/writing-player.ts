export type WritingStatus = 'idle' | 'playing' | 'paused' | 'completed';
export type WritingStage = 'lead' | 'stroke' | 'gap' | 'complete';
export type WritingSpeed = 'slow' | 'standard' | 'fast';

export interface PlannedStroke { charIndex: number; length: number; dot: boolean; }
export const SPEED_FACTOR: Record<WritingSpeed, number> = { slow: 0.7, standard: 1, fast: 1.35 };
const BODY_HEIGHT = 94 - 48;
export function strokeDuration(stroke: PlannedStroke): number {
  return stroke.dot ? 300 : Math.max(350, stroke.length / (2.2 * BODY_HEIGHT) * 1000);
}

/** A viewport-independent timeline. The DOM layer supplies SVG path lengths and paints
 * this state; it never drives progress from frame count or rendered pixel size. */
export class WritingPlayer {
  status: WritingStatus = 'idle';
  stage: WritingStage = 'lead';
  strokeIndex = 0;
  fraction = 0;
  stageElapsed = 0;
  speed: WritingSpeed = 'standard';
  disposed = false;

  constructor(readonly strokes: readonly PlannedStroke[]) {}

  play(): void {
    if (this.disposed || this.status === 'completed' || !this.strokes.length) return;
    this.status = 'playing';
  }
  pause(): void { if (this.status === 'playing') this.status = 'paused'; }
  replay(): void {
    if (this.disposed) return;
    this.strokeIndex = 0; this.fraction = 0; this.stage = 'lead'; this.stageElapsed = 0;
    this.status = 'playing';
  }
  setSpeed(speed: WritingSpeed): void { this.speed = speed; }
  next(): void {
    if (this.disposed || this.status === 'completed') return;
    this.strokeIndex++;
    this.fraction = 0; this.stageElapsed = 0;
    this.stage = this.strokeIndex >= this.strokes.length ? 'complete' : 'stroke';
    this.status = this.stage === 'complete' ? 'completed' : 'paused';
  }
  previous(): void {
    if (this.disposed) return;
    if (this.fraction > 0) this.fraction = 0;
    else this.strokeIndex = Math.max(0, this.strokeIndex - 1);
    this.stage = 'stroke'; this.stageElapsed = 0; this.status = 'paused';
  }
  showAll(): void {
    if (this.disposed) return;
    this.strokeIndex = this.strokes.length; this.fraction = 0;
    this.stage = 'complete'; this.stageElapsed = 0; this.status = 'completed';
  }
  advance(milliseconds: number): void {
    if (this.disposed || this.status !== 'playing') return;
    let remaining = Math.max(0, milliseconds) * SPEED_FACTOR[this.speed];
    while (remaining > 0 && this.status === 'playing') {
      const duration = this.stage === 'lead' ? 300 : this.stage === 'gap'
        ? this.strokes[this.strokeIndex - 1]?.charIndex === this.strokes[this.strokeIndex]?.charIndex ? 220 : 470
        : strokeDuration(this.strokes[this.strokeIndex]);
      const take = Math.min(remaining, duration - this.stageElapsed);
      this.stageElapsed += take; remaining -= take;
      if (this.stage === 'stroke') this.fraction = Math.min(1, this.stageElapsed / duration);
      if (this.stageElapsed < duration) break;
      this.stageElapsed = 0;
      if (this.stage === 'lead' || this.stage === 'gap') this.stage = 'stroke';
      else {
        this.strokeIndex++; this.fraction = 0;
        if (this.strokeIndex >= this.strokes.length) {
          this.stage = 'complete'; this.status = 'completed';
        } else this.stage = 'gap';
      }
    }
  }
  dispose(): void { this.disposed = true; this.status = 'paused'; }
}
