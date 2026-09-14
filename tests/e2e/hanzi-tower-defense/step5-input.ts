import {expect,type Page} from '@playwright/test';
import {activate,type InputMode} from '../step4/input-helpers';
import {CORES,RECIPES,type CoreKind} from '../../../games/hanzi-tower-defense/content';
import {type ScenarioId} from '../../../games/hanzi-tower-defense/tactics';
import {prioritiesFor,orderFor,positionsFor,type TacticsBuild} from '../../../tools/hanzi-tower-defense/step5-balance';
import {newTactics} from '../../../games/hanzi-tower-defense/model';
export interface Item{id:number;slot:number|null;kind:CoreKind;selector:string;}
export async function tacticsItems(page:Page):Promise<Item[]>{const raw=await page.locator('[data-core],.td-slot--occupied').evaluateAll(nodes=>nodes.map(e=>({id:Number(e.getAttribute('data-core')??e.getAttribute('data-tower-id')),slot:e.hasAttribute('data-core')?null:Number(e.getAttribute('data-slot')),glyph:e.querySelector('strong,.td-slot-glyph')?.textContent})));return raw.map(e=>({...e,kind:Object.values(CORES).find(c=>c.glyph===e.glyph)!.id,selector:e.slot===null?`[data-core="${e.id}"]`:`[data-slot="${e.slot}"]`})).sort((a,b)=>a.id-b.id);}
export const tacticsRegion=(selector:string)=>selector.startsWith('[data-core=')?'[data-core]':selector.startsWith('[data-slot=')?'[data-slot]':selector.startsWith('[data-english=')?'[data-english]':undefined;
export async function arrangeTacticsUI(page:Page,mode:InputMode,id:ScenarioId,build:TacticsBuild){
 const act=async(selector:string)=>{if(selector==='[data-td-clear]'&&mode==='keyboard'){await page.keyboard.press('Escape');return;}await activate(page,selector,mode,tacticsRegion(selector));};
 const config=newTactics(id),priorities=prioritiesFor(config,build),order=orderFor(build),positions=positionsFor(config,'distributed');
 for(let n=0;n<100;n++){
  const inventory=await tacticsItems(page);let pair:Item[]|undefined;
  for(const id of priorities){const r=RECIPES.find(r=>r.id===id)!,a=inventory.find(c=>c.kind===r.inputs[0]),b=inventory.find(c=>c.kind===r.inputs[1]&&c.id!==a?.id);if(a&&b){pair=[a,b];break;}}
  if(!pair)break;await act('[data-td-clear]');for(const item of pair)await act(item.selector);await act('[data-td-fuse]');
 }
 const sorted=(await tacticsItems(page)).sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)||a.id-b.id),desired=new Map(sorted.slice(0,8).map((c,i)=>[c.id,positions[i]]));
 for(const c of sorted.filter(c=>c.slot!==null&&desired.get(c.id)!==c.slot)){await act('[data-td-clear]');await act(c.selector);await act('[data-td-stow]');}
 for(const c of await tacticsItems(page)){const slot=desired.get(c.id);if(slot===undefined||slot===c.slot)continue;await act('[data-td-clear]');await act(c.selector);await act(`[data-slot="${slot}"]`);}
 expect((await tacticsItems(page)).filter(c=>c.slot!==null).map(c=>[c.id,c.slot]).sort((a,b)=>a[0]!-b[0]!)).toEqual([...desired].sort((a,b)=>a[0]-b[0]));
}
