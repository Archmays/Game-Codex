export interface BoxGesture<Piece extends string> {
  id: number; x: number; y: number; lastX: number; start: HTMLElement;
  scrollX: number; scrollY: number;
  scrollers: {node: HTMLElement; x: number; y: number}[];
  piece?: Piece; moved: boolean; blocked: boolean;
}
/** Capture scroll owners at press, before optional dragging changes the camera. */
export function beginBoxGesture<Piece extends string>(event: PointerEvent): BoxGesture<Piece> {
  const start = event.target as HTMLElement;
  const scrollers: BoxGesture<Piece>['scrollers'] = [];
  for (let node: HTMLElement | null = start; node; node = node.parentElement)
    scrollers.push({node, x: node.scrollLeft, y: node.scrollTop});
  return {id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,start,
    scrollX,scrollY,scrollers,piece:start.closest<HTMLElement>('[data-piece]')?.dataset.piece as Piece|undefined,
    moved:false,blocked:false};
}
export function boxGestureScrolled(gesture: BoxGesture<string>) {
  return scrollX !== gesture.scrollX || scrollY !== gesture.scrollY ||
    gesture.scrollers.some(p => p.node.scrollLeft !== p.x || p.node.scrollTop !== p.y);
}
