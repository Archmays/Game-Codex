import { Intention, type Plan } from './intent';
import { clone, type State } from './model';
interface CaseRecord {
    state: State;
    history: State[];
}
/** Animation gates each revalidated step. A whole intention owns one undo record. */
export class ActionCoordinator {
    private intention = new Intention();
    constructor(private record: () => CaseRecord) { }
    get active() { return this.intention.active; }
    get label() { return this.intention.label; }
    begin(plan: Plan, label: string) {
        const record = this.record();
        if (!this.intention.begin(record.state, plan, label))
            return false;
        record.history.push(clone(record.state));
        return true;
    }
    next() {
        const record = this.record(), next = this.intention.next(record.state);
        if (next && !next.error)
            record.state = next.state;
        return next;
    }
    advance(busy: boolean, paused: boolean, modal: boolean, hidden: boolean, step: () => void) {
        if (this.active && !busy && !paused && !modal && !hidden)
            step();
    }
    finish() { this.intention.finish(); }
    cancel() {
        const before = this.intention.cancel();
        if (before) {
            const record = this.record();
            record.state = before;
            record.history.pop();
        }
        return before;
    }
}
