/** Own only mounted UI callbacks; the scene and audio keep their own disposal. */
export class OddityLifetime {
    private controller = new AbortController();
    private cleanups: (() => void)[] = [];
    get signal() { return this.controller.signal; }
    own(cleanup: () => void) { this.cleanups.push(cleanup); }
    animate(step: (now: number) => void) {
        let frame = 0;
        const tick = (now: number) => { if (this.signal.aborted)
            return; step(now); if (!this.signal.aborted)
            frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        this.own(() => cancelAnimationFrame(frame));
    }
    destroy() { if (this.signal.aborted)
        return; this.controller.abort(); for (const cleanup of this.cleanups.splice(0).reverse())
        cleanup(); }
}
