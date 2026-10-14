import * as THREE from 'three';
import { createPencilGeometry, createCrossSection, createLongitudinalSection } from './pencil-geometry';

export type StructureView = 'assembled' | 'exploded' | 'cross' | 'longitudinal';
export type StructureState = { rotation: [number, number]; pan: [number, number]; dragMode: 'rotate' | 'pan'; scale: number; selected: string | null; gesturing: boolean; ready: boolean; view: StructureView; exploded: boolean; contextLost: boolean };
const names: Record<string, string> = { 'wood-upper': '上半木材', 'wood-lower': '下半木材', core: '笔芯', 'paint-upper': '上半涂层', 'paint-lower': '下半涂层', tip: '笔尖区域' };
const offsets: Record<string, number> = { 'paint-upper': 3.3, 'wood-upper': 1.65, core: 0, 'wood-lower': -1.65, 'paint-lower': -3.3 };

/** The same meshes are assembled, exploded and ray-picked. No projected SVG substitutes. */
export function createPencil3D(host: HTMLElement, notify: (state: StructureState) => void, picked: (id: string) => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f7f3');
  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
  camera.position.set(0, 0, 24);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#f4f7f3');
  const canvas = renderer.domElement;
  canvas.id = 'pencil-3d'; canvas.setAttribute('aria-label', '三维铅笔。选择旋转或平移后拖动，滚轮或双指缩放；点击部件单独观察。');
  host.prepend(canvas);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8172, 2.6));
  const light = new THREE.DirectionalLight(0xffffff, 3.2); light.position.set(-3, 6, 12); scene.add(light);
  const fill = new THREE.DirectionalLight(0xf3d6aa, 1.1); fill.position.set(4, -3, -7); scene.add(fill);
  const pivot = new THREE.Group(); scene.add(pivot);
  const { root, parts } = createPencilGeometry(); pivot.add(root);
  const cross = createCrossSection(), longitudinal = createLongitudinalSection(); pivot.add(cross, longitudinal);
  const seamGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(.071, 0, -.337), new THREE.Vector3(.071, 0, -.111),
    new THREE.Vector3(.071, 0, .111), new THREE.Vector3(.071, 0, .337),
  ]);
  const seam = new THREE.LineSegments(seamGeometry, new THREE.LineDashedMaterial({ color: '#936747', dashSize: .025, gapSize: .018 }));
  seam.computeLineDistances(); cross.add(seam);
  const cutReference = createPencilGeometry().root;
  cutReference.scale.setScalar(.48); cutReference.position.set(0, 2.5, 0);
  cutReference.traverse(o => { if (o instanceof THREE.Mesh) { const ghost = (m: THREE.Material) => { const c = m.clone(); c.transparent = true; c.opacity = .35; c.depthWrite = false; return c; }; o.material = Array.isArray(o.material) ? o.material.map(ghost) : ghost(o.material); } });
  pivot.add(cutReference);
  const cuttingPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ color: '#bb634d', transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
  cutReference.add(cuttingPlane);
  const ray = new THREE.Raycaster();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let view: StructureView = 'assembled', selected: string | null = null, scale = 1, rotation: [number, number] = [.55, -.22];
  let pan = [0, 0], amount = 0, desired = 0, raf = 0, active = true, disposed = false, contextLost = false;
  let dragMode: 'rotate' | 'pan' = 'rotate', dragAction: 'rotate' | 'pan' = 'rotate';
  let saved: { view: StructureView; rotation: [number, number]; scale: number; pan: number[] } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let initial: { rotation: [number, number]; scale: number; pan: number[] } | null = null;
  let down: { x: number; y: number } | null = null, moved = false, multi = false;
  const state = (): StructureState => ({ rotation: [...rotation], pan: [pan[0], pan[1]], dragMode, scale, selected, gesturing: pointers.size > 0, ready: !disposed && !contextLost, view, exploded: view === 'exploded', contextLost });
  function publish() { host.dataset.view = view; host.dataset.selected = selected ?? ''; host.dataset.exploded = String(view === 'exploded'); notify(state()); }
  function layout() {
    const section = view === 'cross' || view === 'longitudinal';
    root.visible = !section; cross.visible = view === 'cross'; longitudinal.visible = view === 'longitudinal'; cutReference.visible = section;
    cuttingPlane.rotation.set(view === 'longitudinal' ? Math.PI / 2 : 0, view === 'cross' ? Math.PI / 2 : 0, 0);
    cuttingPlane.scale.set(view === 'cross' ? 1 : 9, 1, 1);
    cross.rotation.set(0, -Math.PI / 2, 0); cross.scale.setScalar(4.5); cross.position.y = -.5;
    longitudinal.rotation.x = -Math.PI / 2; longitudinal.position.y = -.5;
    for (const [id, group] of parts) {
      group.visible = !selected || selected === 'tip' || selected === id;
      group.position.set(0, selected ? 0 : offsets[id] * amount, 0);
      // A separated wooden half turns its groove toward the observer.
      group.rotation.x = selected && id.startsWith('wood') ? (id === 'wood-upper' ? -1.1 : 1.1) : (id === 'wood-upper' ? -.9 : id === 'wood-lower' ? .9 : 0) * amount;
    }
    const aspect = Math.max(.2, host.clientWidth / Math.max(1, canvas.clientHeight));
    pivot.rotation.set(rotation[0], rotation[1], selected && selected !== 'tip' && aspect < 1 ? .9 : -.04);
    pivot.position.set(pan[0] + (selected === 'tip' ? 4.3 : 0), pan[1], 0);
    const width = selected && selected !== 'tip' && aspect < 1 ? 8 : selected ? 11.2 : 13.4;
    const height = Math.max(selected && aspect < 1 ? 10.8 : selected ? 2.4 : view === 'exploded' ? 9.8 : section ? 6.2 : 4.5, width / aspect);
    camera.left = -height * aspect / (2 * scale); camera.right = -camera.left;
    camera.top = height / (2 * scale); camera.bottom = -camera.top; camera.updateProjectionMatrix();
  }
  function draw() { if (disposed || contextLost || !active) return; layout(); renderer.render(scene, camera); publish(); }
  function resize() { if (disposed) return; const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); draw(); }
  const observer = new ResizeObserver(resize); observer.observe(host);
  function animate() {
    raf = 0; if (!active || disposed) return;
    amount += (desired - amount) * .18;
    if (Math.abs(amount - desired) < .002) amount = desired;
    draw(); if (amount !== desired) raf = requestAnimationFrame(animate);
  }
  function settle() { if (raf) cancelAnimationFrame(raf); raf = 0; amount = desired; }
  function cancel(rollback = true) {
    const ids = [...pointers.keys()]; pointers.clear();
    if (rollback && initial) { rotation = initial.rotation; scale = initial.scale; pan = initial.pan; }
    initial = null; down = null; moved = false; multi = false;
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    draw();
  }
  function reset() { cancel(); rotation = [.55, -.22]; scale = selected === 'tip' ? 3.2 : 1; pan = [0, 0]; draw(); }
  function setView(next: StructureView) {
    cancel(); selected = null; saved = null; view = next; desired = next === 'exploded' ? 1 : 0;
    rotation = [.55, -.22]; scale = 1; pan = [0, 0];
    if (motion.matches || next === 'cross' || next === 'longitudinal') { settle(); draw(); }
    else { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(animate); draw(); }
  }
  function inspect(id: string) {
    if (!parts.has(id) && id !== 'tip') return;
    cancel(); settle(); if (!saved) saved = { view, rotation: [...rotation], scale, pan: [...pan] };
    selected = id; view = 'exploded'; scale = id === 'tip' ? 3.2 : 1; rotation = [.25, -.15]; pan = [0, 0]; draw();
  }
  function returnParts() {
    cancel(); selected = null;
    if (saved) { view = saved.view; rotation = saved.rotation; scale = saved.scale; pan = saved.pan; saved = null; }
    desired = view === 'exploded' ? 1 : 0; settle(); draw();
  }
  function zoom(factor: number) { scale = THREE.MathUtils.clamp(scale * factor, .6, 8); draw(); }
  function turn(x: number, y: number) { rotation[0] += y; rotation[1] += x; draw(); }
  function moveByPixels(dx: number, dy: number) {
    pan[0] += dx * (camera.right - camera.left) / canvas.clientWidth;
    pan[1] -= dy * (camera.top - camera.bottom) / canvas.clientHeight;
    draw();
  }
  function hit(x: number, y: number) {
    if (selected || view === 'cross' || view === 'longitudinal') return;
    const rect = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
    const hits = ray.intersectObject(root, true).filter(h => { let o: THREE.Object3D | null = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
    if (!hits.length) return;
    let node: THREE.Object3D | null = hits[0].object;
    while (node && node !== root) { if (parts.has(node.name)) { picked(node.name); return; } node = node.parent; }
  }
  canvas.addEventListener('pointerdown', e => {
    if (!active || contextLost || e.button !== 0) return;
    host.closest<HTMLElement>('#stage')?.focus({ preventScroll: true });
    settle(); if (!pointers.size) { initial = { rotation: [...rotation], scale, pan: [...pan] }; down = { x: e.clientX, y: e.clientY }; moved = false; multi = false; dragAction = e.shiftKey ? 'pan' : dragMode; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); multi ||= pointers.size > 1;
    canvas.setPointerCapture(e.pointerId); draw();
  });
  canvas.addEventListener('pointermove', e => {
    const previous = pointers.get(e.pointerId); if (!previous) return;
    const before = [...pointers.values()]; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) moved = true;
    if (pointers.size === 1 && moved) {
      if (dragAction === 'pan') moveByPixels(e.clientX - previous.x, e.clientY - previous.y);
      else turn((e.clientX - previous.x) * .012, (e.clientY - previous.y) * .012);
    }
    else if (pointers.size === 2) {
      const after = [...pointers.values()]; const distance = (ps: { x: number; y: number }[]) => Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      const old = distance(before); if (old > 2) zoom(distance(after) / old);
      const dx = (after[0].x + after[1].x - before[0].x - before[1].x) / 2, dy = (after[0].y + after[1].y - before[0].y - before[1].y) / 2;
      moveByPixels(dx, dy);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!pointers.has(e.pointerId)) return;
    const click = !moved && !multi; pointers.delete(e.pointerId);
    if (!pointers.size) initial = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    draw(); if (click) hit(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointercancel', () => cancel());
  canvas.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) cancel(); });
  canvas.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey || !active) return; e.preventDefault(); cancel(); zoom(Math.exp(-e.deltaY * .002)); }, { passive: false });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancel(); settle(); contextLost = true; publish(); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; resize(); });
  const stop = () => { cancel(); settle(); };
  window.addEventListener('blur', stop);
  const hidden = () => { if (document.hidden) stop(); }; document.addEventListener('visibilitychange', hidden);
  const scroll = () => { if (pointers.size) cancel(); }; window.addEventListener('scroll', scroll, { passive: true });
  const hidePage = (event: PageTransitionEvent) => { if (event.persisted) stop(); else destroy(); };
  const showPage = (event: PageTransitionEvent) => { if (event.persisted && !disposed) resize(); };
  window.addEventListener('pagehide', hidePage); window.addEventListener('pageshow', showPage);
  function destroy() {
    if (disposed) return; stop(); disposed = true; observer.disconnect();
    window.removeEventListener('blur', stop); window.removeEventListener('scroll', scroll); window.removeEventListener('pagehide', hidePage); window.removeEventListener('pageshow', showPage); document.removeEventListener('visibilitychange', hidden);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); if ('map' in m && m.map instanceof THREE.Texture) textures.add(m.map); } } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); canvas.remove();
  }
  resize();
  return { state, setView, inspect, returnParts, reset, zoom, turn, setDragMode(next: 'rotate' | 'pan') { cancel(); dragMode = next; draw(); }, pan(x: number, y: number) { pan[0] += x; pan[1] += y; draw(); }, cancel, suspend: stop, setActive(value: boolean) { stop(); active = value; if (active) resize(); }, destroy, names };
}
