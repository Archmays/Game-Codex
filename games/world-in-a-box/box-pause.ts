/** Reasons compose: closing one dialog cannot resume another paused activity. */
export class BoxPauses {
  private reasons = new Set<string>();
  constructor(private audioPause: (reason:string,open:boolean) => void) {}
  get size() { return this.reasons.size; }
  set(reason:string,open:boolean) {
    if (open) this.reasons.add(reason); else this.reasons.delete(reason);
    this.audioPause(reason,open);
  }
}
