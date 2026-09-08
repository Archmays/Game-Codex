import {describe,it,expect} from 'vitest';
import {coveredRoad,placementEvidence} from '../tools/hanzi-tower-defense/check-placement';
describe('Qinglan requested weak-position correction',()=>{
 it('measures path coverage including partial and tangent intersections',()=>{
  const path=[{x:0,y:0},{x:100,y:0}];
  expect(coveredRoad(path,{x:50,y:0},10)).toBe(20);
  expect(coveredRoad(path,{x:0,y:0},10)).toBe(10);
  expect(coveredRoad(path,{x:50,y:10},10)).toBe(0);
 });
 it('improves slots 3, 7 and 8 across all original ranges and in ordinary model attacks',()=>{
  const result=placementEvidence();
  for(const i of [2,6,7]){
   for(const core of result.coverage[i].cores)expect(core.after).toBeGreaterThan(core.before*1.2);
   expect(result.after[i].shots).toBeGreaterThan(result.before[i].shots);
   expect(result.after[i].kills).toBeGreaterThanOrEqual(result.before[i].kills);
  }
  // Moving the adjacent post for mobile separation must not create a new short-range trap.
  const fire=result.coverage[5].cores.find(c=>c.kind==='fire')!;expect(fire.after).toBeGreaterThanOrEqual(fire.before*.95);
 });
});
