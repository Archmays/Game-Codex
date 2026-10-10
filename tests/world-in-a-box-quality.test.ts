import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {PlacementGlow} from '../games/world-in-a-box/placement-glow';

describe('World Box placement marker',()=>{
 it('uses the actual footprint and reuses drawable resources across placements',()=>{
  const piece=new T.Mesh(new T.BoxGeometry(2,4,6));piece.position.set(3,5,-2);
  const glow=new PlacementGlow(false),geometry=glow.mesh.geometry,material=glow.mesh.material;
  glow.show(piece);expect(glow.mesh.position.toArray()).toEqual([3,3.035,-2]);expect(glow.mesh.visible).toBe(true);
  const start=glow.mesh.scale.x;glow.frame(.3);expect(glow.mesh.scale.x).toBeGreaterThan(start);expect(glow.mesh.material.opacity).toBeLessThan(.8);
  glow.frame(1);expect(glow.mesh.visible).toBe(false);glow.show(piece);
  expect(glow.mesh.geometry).toBe(geometry);expect(glow.mesh.material).toBe(material);
  glow.clear();expect(glow.mesh.visible).toBe(false);geometry.dispose();material.dispose();piece.geometry.dispose();
 });
 it('keeps a stationary marker for reduced motion and freezes during pause',()=>{
  const piece=new T.Mesh(new T.BoxGeometry(1,1,1)),glow=new PlacementGlow(true);glow.show(piece);
  const scale=glow.mesh.scale.clone();glow.frame(.3);expect(glow.mesh.scale.equals(scale)).toBe(true);
  const opacity=glow.mesh.material.opacity;glow.frame(0);expect(glow.mesh.material.opacity).toBe(opacity);
  glow.frame(1);expect(glow.mesh.visible).toBe(false);glow.mesh.geometry.dispose();glow.mesh.material.dispose();piece.geometry.dispose();
 });
});
