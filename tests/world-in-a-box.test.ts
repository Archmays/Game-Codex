import { IDS,fresh,reduce,restore,windy,fits } from '../games/world-in-a-box/model';
import { readFileSync } from 'node:fs';
describe('window breeze model and Blender export',()=>{
  it('accepts every order without dependencies and preserves unrelated wrong choices',()=>{
    let orders=0;
    function visit(state:ReturnType<typeof fresh>){if(state.placed.length===8){orders++;expect(new Set(state.placed).size).toBe(8);return;}for(const id of IDS.filter(id=>!state.placed.includes(id)))visit(reduce(state,{type:'place',piece:id,slot:id}));}
    visit(fresh());expect(orders).toBe(40320);
    expect(reduce(fresh(),{type:'place',piece:'cup',slot:'cat'})).toEqual(fresh());
    expect(fits('shutter_left','shutter_right')).toBe(true);
  });
  it('wind is derived from installed open shutters, including late installation and undo',()=>{
    let s=reduce(fresh(),{type:'interact',slot:'shutter_left'});expect(windy(s)).toBe(false);
    s=reduce(s,{type:'place',piece:'shutter_left',slot:'shutter_left'});expect(windy(s)).toBe(false);
    s=reduce(s,{type:'interact',slot:'shutter_left'});expect(windy(s)).toBe(true);
    for(const piece of ['curtain','wind_chime','plant','book'] as const){s=reduce(s,{type:'place',piece,slot:piece});expect(windy(s)).toBe(true);}
    expect(restore(JSON.parse(JSON.stringify(s)))).toEqual(s);
    s=reduce(s,{type:'undo',slot:'shutter_left'});expect(windy(s)).toBe(false);expect(s.open).toEqual([]);
    s=reduce(s,{type:'place',piece:'shutter_left',slot:'shutter_left'});expect(windy(s)).toBe(false);
  });
  it('filters corrupt data and duplicate ids; rejects duplicate placement',()=>{
    expect(restore({version:1,placed:['cup','cup','invalid'],open:['shutter_left'],name:'not retained'})).toEqual({...fresh(),placed:['cup']});
    expect(restore(null)).toEqual(fresh());const s=reduce(fresh(),{type:'place',piece:'cat',slot:'cat'});expect(reduce(s,{type:'place',piece:'cat',slot:'cat'})).toBe(s);
  });
  it('exports exactly eight independent piece/slot roots with local textures and articulated nodes',()=>{
    const bytes=readFileSync('public/assets/world-in-a-box/window-breeze.glb');expect(bytes.subarray(0,4).toString()).toBe('glTF');const length=bytes.readUInt32LE(12);const gltf=JSON.parse(bytes.subarray(20,20+length).toString());
    const names=gltf.nodes.map((n:{name:string})=>n.name);expect(names.filter((n:string)=>n.startsWith('piece_')).sort()).toEqual(IDS.map(id=>'piece_'+id).sort());
    expect(names.filter((n:string)=>n.startsWith('slot_')).sort()).toEqual(IDS.map(id=>'slot_'+id).sort());
    for(const name of ['pivot_shutter_left','pivot_shutter_right','pivot_chime','pivot_curtain','pivot_leaves','pivot_pages','pivot_tail'])expect(names).toContain(name);
    expect(gltf.meshes.length).toBeGreaterThan(100);expect(gltf.images.every((i:{uri?:string;bufferView?:number})=>i.uri===undefined&&typeof i.bufferView==='number')).toBe(true);
  });
});
