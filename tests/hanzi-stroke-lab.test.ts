import {readFileSync} from 'node:fs';
import {parseQuery,Shelf,STORAGE_KEY,normalizeStrokes} from '../games/hanzi-stroke-lab/model';
import {GAME_PORTFOLIO,ACTIVE_CHILD_PRODUCTS,CLASSIC_CARD_PRODUCTS} from '../packages/data/gamePortfolio';
import {resolveAppRoute,pageModeForSearch} from '../src/app-route';
describe('Hanzi study tool contracts',()=>{
 it('retains codepoints, repeated positions and gives explicit limits/filter feedback',()=>{
   expect(parseQuery('你好学习').chars).toEqual([...'你好学习']);expect(parseQuery('人人永').chars).toEqual([...'人人永']);expect(parseQuery('𠮷𰻞').chars).toEqual(['𠮷','𰻞']);expect(parseQuery('A你，!').chars).toEqual(['你']);expect(parseQuery('A你，!').message).toContain('3');expect(parseQuery('').valid).toBe(false);expect(parseQuery('永'.repeat(49))).toMatchObject({valid:false,chars:[]});expect(parseQuery('⺀').chars).toEqual(['⺀']);
 });
 it('preserves corrupt/future/denied storage while querying continues',()=>{
   for(const raw of ['{bad','{"version":2,"recent":["永"]}','null','{"version":1,"recent":[],"favorites":[],"grid":"yes"}']){
     const store=new Map([[STORAGE_KEY,raw],['legacy','sentinel']]);const s=new Shelf({getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)});s.visit('永');s.favorite('永');expect(store.get(STORAGE_KEY)).toBe(raw);expect(store.get('legacy')).toBe('sentinel');expect(s.writable).toBe(false);
   }
   const s=new Shelf({getItem(){throw Error();},setItem(){throw Error();}});s.visit('水');expect(s.state.recent).toEqual(['水']);
 });
 it('only writes its own bounded, versioned anonymous state',()=>{
   const store=new Map<string,string>([['legacy','raw']]);const s=new Shelf({getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)});s.visit('永');s.visit('水');s.visit('永');s.favorite('永');expect(s.state.recent).toEqual(['永','水']);expect(s.state.favorites).toEqual(['永']);s.favorite('永');expect(s.state.favorites).toEqual([]);expect([...store.keys()].sort()).toEqual([STORAGE_KEY,'legacy'].sort());expect(store.get(STORAGE_KEY)).not.toContain('strokes');
 });
 it('does not overwrite a Vault restore made after this shelf was mounted',()=>{
   const original=JSON.stringify({version:1,recent:['永'],favorites:['水'],grid:true});
   const restored='{ "version":1,"recent":["向"],"favorites":["天"],"grid":false }';
   const store=new Map([[STORAGE_KEY,original]]);const shelf=new Shelf({getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)});
   store.set(STORAGE_KEY,restored);shelf.favorite('永');shelf.visit('你');
   expect(store.get(STORAGE_KEY)).toBe(restored);expect(shelf.writable).toBe(false);expect(shelf.notice).toContain('刷新');
 });
 it('is a lazy independent tool without inflating active game counts',()=>{
   expect(GAME_PORTFOLIO.find(r=>r.id==='hanzi-stroke-lab')).toMatchObject({definitionRole:'independent-tool',activeChildProduct:false,classicCardVisible:false,loadingPolicy:'route-lazy'});expect(ACTIVE_CHILD_PRODUCTS).toHaveLength(3);expect(CLASSIC_CARD_PRODUCTS).toHaveLength(3);
   expect(resolveAppRoute(new URLSearchParams('play=hanzi-stroke-lab&world=math-world')).kind).toBe('play');expect(pageModeForSearch(new URLSearchParams('play=hanzi-stroke-lab'))).toBe('game-scrollable');
 });
 it('keeps trajectory packets answer-free and explicitly local',()=>{
   expect(normalizeStrokes([[[300,-5],[12.3,20.8]]])).toEqual([[[255,0],[12,21]]]);const worker=readFileSync('public/hanzi-stroke-lab/recognizer/worker.js','utf8');expect(worker).toContain('wasm_bindgen.lookup(strokes, 10)');expect(worker).not.toMatch(/https?:|fixture|expectedAnswer/);expect(readFileSync('games/hanzi-stroke-lab/index.ts','utf8')).toContain("import('./workbench')");
 });
});
