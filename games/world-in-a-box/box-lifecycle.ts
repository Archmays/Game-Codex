/** A mounted box owns its callbacks. Scene and audio objects retain their own disposal. */
export class BoxLifetime {
  private abort = new AbortController();
  private releases: (() => void)[] = [];
  get signal() { return this.abort.signal; }
  own(release: () => void) { this.releases.push(release); }
  animate(step: (now: number) => void) {
    let frame = 0;
    const tick = (now: number) => {
      if (this.signal.aborted) return;
      step(now);
      if (!this.signal.aborted) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    this.own(() => cancelAnimationFrame(frame));
  }
  destroy() {
    if (this.signal.aborted) return;
    this.abort.abort();
    for (const release of this.releases.splice(0).reverse()) release();
  }
}
