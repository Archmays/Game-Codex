import { GUIDE_LINES, type WordLayout } from './letter-strokes';
import { WritingPlayer, type PlannedStroke } from './writing-player';

const NS = 'http://www.w3.org/2000/svg';
export interface StrokeView { path: SVGPathElement; length: number; x: number; charIndex: number; }
export interface BoardView { svg: SVGSVGElement; strokes: StrokeView[]; tip: SVGCircleElement; }
export function makeSvg<T extends SVGElement>(tag: string, attributes: Record<string, string>): T {
    const node = document.createElementNS(NS, tag) as T;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
export function createBoard(host: HTMLElement, layout: WordLayout, zoom = false): BoardView {
    host.replaceChildren();
    const width = Math.max(340, layout.width);
    const shift = (width - layout.width) / 2;
    const svg = makeSvg<SVGSVGElement>('svg', { viewBox: `0 0 ${width} 132`, class: 'es-word-board', role: 'img', 'aria-label': `${layout.instances.map(item => item.char).join('')}，四线三格书写板` });
    if (zoom) svg.style.width = `${Math.round(width * 1.45)}px`;
    const paper = makeSvg<SVGRectElement>('rect', { x: '0', y: '0', width: String(width), height: '132', class: 'es-paper' }); svg.append(paper);
    GUIDE_LINES.forEach((y, index) => svg.append(makeSvg<SVGLineElement>('line', { x1: '0', x2: String(width), y1: String(y), y2: String(y), class: index === 2 ? 'es-guide-line es-baseline' : 'es-guide-line', 'data-guide': String(index + 1) })));
    const strokes: StrokeView[] = [];
    layout.instances.forEach(instance => instance.strokes.forEach((d, strokeIndex) => {
      const x = instance.x + shift;
      const transform = `translate(${x} 0)`;
      const ghost = makeSvg<SVGPathElement>('path', { d, transform, class: 'es-stroke-ghost', 'data-char-index': String(instance.index), 'data-stroke-index': String(strokeIndex) });
      const path = makeSvg<SVGPathElement>('path', { d, transform, class: 'es-stroke-ink', 'data-char-index': String(instance.index), 'data-stroke-index': String(strokeIndex) });
      svg.append(ghost, path);
      strokes.push({ path, length: path.getTotalLength(), x, charIndex: instance.index });
    }));
    const tip = makeSvg<SVGCircleElement>('circle', { r: '3.4', class: 'es-pen-tip', visibility: 'hidden' }); svg.append(tip);
    host.append(svg);
    return { svg, strokes, tip };
  }
export function planFor(board: BoardView): PlannedStroke[] {
    return board.strokes.map(item => ({ charIndex: item.charIndex, length: item.length, dot: item.length <= 2.5 }));
  }
export function paintBoard(board: BoardView, player: WritingPlayer, ghostVisible: boolean): void {
    board.svg.classList.toggle('es-hide-ghost', !ghostVisible);
    board.strokes.forEach((item, index) => {
      const amount = index < player.strokeIndex ? 1 : index === player.strokeIndex ? player.fraction : 0;
      item.path.style.strokeDasharray = String(item.length);
      item.path.style.strokeDashoffset = String(item.length * (1 - amount));
      item.path.style.opacity = amount > 0 ? '1' : '0';
      item.path.style.strokeWidth = item.length <= 2.5 ? String(5.2 * amount) : '';
    });
    const active = board.strokes[player.strokeIndex];
    if (active && player.status !== 'idle' && player.status !== 'completed' && (player.stage === 'stroke' || player.fraction > 0)) {
      const point = active.path.getPointAtLength(active.length * player.fraction);
      board.tip.setAttribute('cx', String(point.x + active.x)); board.tip.setAttribute('cy', String(point.y));
      board.tip.setAttribute('visibility', 'visible');
    } else board.tip.setAttribute('visibility', 'hidden');
  }
