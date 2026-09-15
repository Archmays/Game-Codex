import { describe, expect, it } from 'vitest';
import { openPresentation, PRESENTATION_KEY } from '../packages/presentation/settings';
const storage = () => { const m = new Map<string,string>(); return { m, getItem:(k:string)=>m.get(k)??null, setItem:(k:string,v:string)=>{m.set(k,v);} }; };
describe('presentation preferences isolate checkpoint state', () => {
  it('writes only on an action, keeps both products and unrelated raw bytes', () => {
    const s=storage();s.setItem('family-games/hanzi-tower-defense/v3',' old raw ');
    const p=openPresentation(s,'tower'); expect(s.getItem(PRESENTATION_KEY)).toBeNull();p.value.music=.1;p.value.lastContent='beacon-captain';expect(p.write()).toBe(true);
    const q=openPresentation(s,'adventure');q.value.effects=0;q.write();
    expect(openPresentation(s,'tower').value.music).toBe(.1);expect(openPresentation(s,'adventure').value.effects).toBe(0);
    expect(s.getItem('family-games/hanzi-tower-defense/v3')).toBe(' old raw ');
  });
  it.each(['{broken','{"version":99}', '{"version":1,"tower":null}'])('protects unsupported raw %s',raw=>{
    const s=storage();s.setItem(PRESENTATION_KEY,raw);const p=openPresentation(s,'tower');p.value.music=0;expect(p.write()).toBe(false);expect(s.getItem(PRESENTATION_KEY)).toBe(raw);
  });
  it('stale pages and Vault writes cannot be overwritten',()=>{
    const s=storage(),p=openPresentation(s,'tower'),q=openPresentation(s,'adventure');q.value.music=0;q.write();const raw=s.getItem(PRESENTATION_KEY);expect(p.write()).toBe(false);expect(s.getItem(PRESENTATION_KEY)).toBe(raw);
  });
  it('rejects invalid volume and storage denial without affecting local play settings',()=>{
    const s=storage(),p=openPresentation(s,'tower');p.value.music=Infinity;expect(p.write()).toBe(false);
    const q=openPresentation({getItem(){throw Error();},setItem(){throw Error();}},'adventure');q.value.lowPerformance=true;expect(q.write()).toBe(false);expect(q.value.lowPerformance).toBe(true);
  });
});
