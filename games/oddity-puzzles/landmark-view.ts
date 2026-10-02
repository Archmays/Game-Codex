import { landmarkIcon, type Landmark } from './landmarks';
import type { OddityScene } from './scene';
import type { Pick } from './selection';
/** Owns retained accessible labels and their projected leaders, never gameplay state. */
export function createLandmarkView(host: HTMLElement, labels: HTMLElement, leaders: SVGSVGElement, refresh: () => void) {
    let currentMarks: Landmark[] = [], selected = '', picking: Pick | null = null, scene: OddityScene | undefined, labelLayoutKey = '', highlighted = '';
    function render(marks: Landmark[], selection: string, pick: Pick | null, view: OddityScene | undefined) {
        labelLayoutKey = '';
        currentMarks = marks;
        selected = selection;
        picking = pick;
        scene = view;
        const old = new Map([...labels.querySelectorAll<HTMLButtonElement>('button')].map(b => [b.dataset.landmark!, b]));
        for (const mark of currentMarks) {
            let b = old.get(mark.id);
            old.delete(mark.id);
            if (!b) {
                b = document.createElement('button');
                b.type = 'button';
                b.dataset.landmark = mark.id;
                b.dataset.cmd = 'landmark:' + mark.id;
                b.className = 'odd-landmark';
                labels.append(b);
            }
            b.dataset.entityId = mark.entity ?? mark.id;
            b.dataset.kind = mark.kind;
            b.setAttribute('aria-pressed', String(selected === (mark.entity ?? mark.id)));
            const icon = !picking ? landmarkIcon(mark) : mark.kind === 'item' ? landmarkIcon(mark) : '';
            const prefix = mark.kind === 'node' ? (picking?.kind === 'release' ? '♙ ' : picking?.kind === 'ring-place' ? '▧ ' : '👣 ') : icon ? '' : mark.icon + ' ';
            b.innerHTML = icon + `<span>${prefix}${mark.label}</span>`;
            b.setAttribute('aria-label', (mark.kind === 'node' ? (picking?.kind === 'release' ? '释放空位：' : picking?.kind === 'ring-place' ? '搬运落点：' : '走到') : '') + mark.label);
        }
        for (const b of old.values())
            b.remove();
        host.dataset.dense = String(currentMarks.length > 12);
        host.dataset.endpoints = String(picking?.kind === 'ring-place' || picking?.kind === 'npc-move');
        scene?.showNodes(currentMarks.flatMap(m => m.node ? [m.node] : []), picking?.kind === 'release' ? 'release' : picking?.kind === 'ring-place' ? 'carry' : 'walk');
        refresh();
        positionLabels();
    }
    function positionLabels() {
        if (!scene || host.dataset.ready !== 'true')
            return;
        const w = host.clientWidth, h = host.clientHeight, points = currentMarks.map(m => scene!.anchor(m));
        const buttons = currentMarks.map(m => labels.querySelector<HTMLElement>(`[data-landmark="${m.id}"]`)!);
        const sizes = buttons.map(b => ({ w: b.offsetWidth, h: b.offsetHeight }));
        const signature = w + ':' + h + ':' + points.map((p, i) => `${currentMarks[i].id},${Math.round(p.x * 2)},${Math.round(p.y * 2)},${sizes[i].w},${sizes[i].h}`).join(';');
        if (signature === labelLayoutKey)
            return;
        labelLayoutKey = signature;
        const boxes: {
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [], protectedBoxes = currentMarks.map(m => scene!.bounds(m)).filter(b => b !== null);
        let lines = '';
        const priority = (m: Landmark) => m.kind === 'info' ? 0 : m.kind === 'item' ? 1 : m.kind === 'actor' ? 2 : 3;
        const order = currentMarks.map((_, i) => i).sort((a, b) => priority(currentMarks[a]) - priority(currentMarks[b]));
        for (const i of order) {
            const b = buttons[i], p = points[i], bw = sizes[i].w, bh = sizes[i].h;
            let best = { x: 6, y: 6, score: Infinity };
            for (let y = 6; y <= h - bh - 6; y += 14)
                for (let x = 6; x <= w - bw - 6; x += 14) {
                    if (boxes.some(o => x < o.x + o.w + 5 && x + bw + 5 > o.x && y < o.y + o.h + 5 && y + bh + 5 > o.y))
                        continue;
                    const covered = points.filter((a, j) => j !== i && a.x > x - 5 && a.x < x + bw + 5 && a.y > y - 5 && a.y < y + bh + 5).length;
                    const models = protectedBoxes.filter(o => x < o.x + o.w && x + bw > o.x && y < o.y + o.h && y + bh > o.y).length;
                    const score = Math.hypot(x + bw / 2 - p.x, y + bh / 2 - p.y) + covered * 1000 + models * 10000;
                    if (score < best.score)
                        best = { x, y, score };
                }
            b.style.left = best.x + 'px';
            b.style.top = best.y + 'px';
            b.dataset.anchorX = p.x.toFixed(2);
            b.dataset.anchorY = p.y.toFixed(2);
            boxes.push({ ...best, w: bw, h: bh });
            const x = Math.max(best.x, Math.min(best.x + bw, p.x)), y = Math.max(best.y, Math.min(best.y + bh, p.y));
            lines += `<path data-for="${currentMarks[i].id}" d="M${p.x},${p.y} L${x},${y}"/><circle cx="${p.x}" cy="${p.y}" r="3"/>`;
        }
        leaders.setAttribute('viewBox', `0 0 ${w} ${h}`);
        leaders.innerHTML = lines;
        highlightMark(highlighted);
    }
    function highlightMark(id: string) { highlighted = id; for (const line of leaders.querySelectorAll('path'))
        line.classList.toggle('is-focused', line.getAttribute('data-for') === id); const active = leaders.querySelector('[data-for="' + id + '"]'); if (active)
        leaders.append(active); }
    return { render, position: positionLabels, highlight: highlightMark };
}
