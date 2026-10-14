import * as THREE from 'three';

/** World units are explanatory, not a manufacturer's dimensional drawing. */
export const PENCIL_DIMENSIONS = Object.freeze({
  tip: -5, woodTip: -4.62, barrelStart: -3.7, tail: 5,
  coreRadius: 0.11, woodRadius: 0.34, paintRadius: 0.349,
});
export type PencilPartId = 'wood-upper' | 'wood-lower' | 'core' | 'paint-upper' | 'paint-lower';
export interface PencilGeometry { root: THREE.Group; parts: Map<string, THREE.Group> }

const STEPS = 48;
// In the YZ plane the hexagon has a vertex on +Z and a horizontal upper face.
function hexRadius(angle: number, radius: number): number {
  const sector = Math.PI / 3;
  const faceNormal = (Math.floor((angle + 1e-10) / sector) + 0.5) * sector;
  return radius * Math.cos(Math.PI / 6) / Math.cos(angle - faceNormal);
}

/** A half-shell is a simple closed contour: outer surface then the groove.
 * The inner arc is a surface of the wood itself, not another material ring. */
function halfContour(upper: boolean, outer: (a: number) => number, inner: (a: number) => number): THREE.Vector2[] {
  const sign = upper ? 1 : -1;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = i * Math.PI / STEPS, r = outer(a);
    points.push(new THREE.Vector2(r * Math.cos(a), sign * r * Math.sin(a)));
  }
  for (let i = STEPS; i >= 0; i--) {
    const a = i * Math.PI / STEPS, r = inner(a);
    points.push(new THREE.Vector2(r * Math.cos(a), sign * r * Math.sin(a)));
  }
  if (!upper) points.reverse();
  return points;
}

/** Closed manifold loft, with actual groove, seam planes and end faces. */
function loft(rings: { x: number; contour: THREE.Vector2[] }[]): THREE.BufferGeometry {
  const count = rings[0].contour.length, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const ring of rings) for (const point of ring.contour) {
    positions.push(ring.x, point.y, point.x);
    uvs.push((ring.x + 5) / 10, point.x / 0.7 + point.y / 0.7);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < count; i++) {
    const a = j * count + i, b = j * count + (i + 1) % count;
    const c = a + count, d = b + count;
    indices.push(a, c, d, a, d, b);
  }
  const first = THREE.ShapeUtils.triangulateShape(rings[0].contour, []);
  const last = THREE.ShapeUtils.triangulateShape(rings[rings.length - 1].contour, []);
  for (const [a, b, c] of first) indices.push(a, b, c);
  const offset = (rings.length - 1) * count;
  for (const [a, b, c] of last) indices.push(offset + c, offset + b, offset + a);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Separate triangle normals preserve the six flat faces and cut-face boundary.
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingBox();
  flat.computeBoundingSphere();
  return flat;
}

function woodGeometry(upper: boolean, from: number = PENCIL_DIMENSIONS.woodTip, to: number = PENCIL_DIMENSIONS.tail): THREE.BufferGeometry {
  const { coreRadius, woodRadius, woodTip, barrelStart } = PENCIL_DIMENSIONS;
  // A tiny finite front rim avoids zero-area triangles where wood meets the lead.
  const contour = (x: number) => halfContour(upper, a => {
    const t = THREE.MathUtils.clamp((x - woodTip) / (barrelStart - woodTip), 0, 1);
    return THREE.MathUtils.lerp(coreRadius + 0.0005, hexRadius(a, woodRadius), t);
  }, () => coreRadius);
  const xs = [from, ...[barrelStart].filter(x => x > from && x < to), to];
  return loft(xs.map(x => ({ x, contour: contour(x) })));
}

function paintGeometry(upper: boolean, from: number = PENCIL_DIMENSIONS.barrelStart, to: number = PENCIL_DIMENSIONS.tail): THREE.BufferGeometry {
  const contour = halfContour(upper, a => hexRadius(a, PENCIL_DIMENSIONS.paintRadius), a => hexRadius(a, PENCIL_DIMENSIONS.woodRadius));
  return loft([{ x: from, contour }, { x: to, contour }]);
}

function coreGeometry(from: number = PENCIL_DIMENSIONS.tip, to: number = PENCIL_DIMENSIONS.tail, half = false): THREE.BufferGeometry {
  const { tip, woodTip, coreRadius } = PENCIL_DIMENSIONS;
  const shape = (x: number) => {
    const radius = coreRadius * THREE.MathUtils.clamp((x - tip) / (woodTip - tip), 0.0001, 1);
    const points: THREE.Vector2[] = [];
    const steps = half ? STEPS : STEPS * 2;
    for (let i = 0; i < steps + (half ? 1 : 0); i++) {
      const a = i * (half ? Math.PI : Math.PI * 2) / steps;
      points.push(new THREE.Vector2(radius * Math.cos(a), radius * Math.sin(a)));
    }
    // A longitudinal section keeps Y >= 0; its diameter is the actual cut face.
    return points;
  };
  const xs = [from, ...[woodTip].filter(x => x > from && x < to), to];
  return loft(xs.map(x => ({ x, contour: shape(x) })));
}

function woodTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#e4bd89'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Deterministic long fibres run parallel to the pencil axis; no network assets.
  for (let i = 0; i < 96; i++) {
    const y = i * 2.7;
    ctx.strokeStyle = i % 4 === 0 ? '#bc905f' : '#d3a674';
    ctx.globalAlpha = i % 4 === 0 ? 0.5 : 0.35;
    ctx.lineWidth = i % 7 === 0 ? 1.5 : 0.65;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.008 + i * 1.7) * (1 + i % 3));
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function materials(): { wood: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial; core: THREE.MeshStandardMaterial } {
  return {
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture(), roughness: 0.88 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xe6b628, roughness: 0.38, metalness: 0 }),
    core: new THREE.MeshStandardMaterial({ color: 0x34383c, roughness: 0.7, metalness: 0.05 }),
  };
}

function addPart(root: THREE.Group, parts: Map<string, THREE.Group>, id: PencilPartId, geometry: THREE.BufferGeometry, material: THREE.Material): void {
  const part = new THREE.Group(); part.name = id; part.userData.partId = id;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = id; mesh.userData.partId = id;
  mesh.castShadow = mesh.receiveShadow = true;
  part.add(mesh); root.add(part); parts.set(id, part);
}

/** Five semantic groups. Paint halves remain attached in the assembled pose;
 * moving them independently represents a teaching peel, not real disassembly. */
export function createPencilGeometry(): PencilGeometry {
  const root = new THREE.Group(), parts = new Map<string, THREE.Group>(), m = materials();
  root.name = 'pencil';
  addPart(root, parts, 'wood-upper', woodGeometry(true), m.wood);
  addPart(root, parts, 'wood-lower', woodGeometry(false), m.wood);
  addPart(root, parts, 'core', coreGeometry(), m.core);
  addPart(root, parts, 'paint-upper', paintGeometry(true), m.paint);
  addPart(root, parts, 'paint-lower', paintGeometry(false), m.paint);
  return { root, parts };
}

/** Thin real barrel slice along X; wood and core touch with no invented ring. */
export function createCrossSection(): THREE.Group {
  const root = new THREE.Group(), parts = new Map<string, THREE.Group>(), m = materials();
  root.name = 'cross-section'; root.userData.cutAxis = 'X';
  const from = -0.07, to = 0.07;
  addPart(root, parts, 'wood-upper', woodGeometry(true, from, to), m.wood);
  addPart(root, parts, 'wood-lower', woodGeometry(false, from, to), m.wood);
  addPart(root, parts, 'core', coreGeometry(from, to), m.core);
  addPart(root, parts, 'paint-upper', paintGeometry(true, from, to), m.paint);
  addPart(root, parts, 'paint-lower', paintGeometry(false, from, to), m.paint);
  return root;
}

/** Real longitudinal half pencil (Y >= 0), cut along the central XZ plane.
 * Contains exposed wood, continuous lead and paint only on the unshaved barrel. */
export function createLongitudinalSection(): THREE.Group {
  const root = new THREE.Group(), parts = new Map<string, THREE.Group>(), m = materials();
  root.name = 'longitudinal-section'; root.userData.cutAxis = 'Y';
  addPart(root, parts, 'wood-upper', woodGeometry(true), m.wood);
  addPart(root, parts, 'core', coreGeometry(PENCIL_DIMENSIONS.tip, PENCIL_DIMENSIONS.tail, true), m.core);
  addPart(root, parts, 'paint-upper', paintGeometry(true), m.paint);
  return root;
}
