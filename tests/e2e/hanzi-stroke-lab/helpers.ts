import {expect,type Page} from '@playwright/test';
export const route='?play=hanzi-stroke-lab';
export const strokes=[[[43,102],[215,100]],[[129,34],[126,118],[100,175],[45,218]],[[130,114],[165,171],[218,216]]];
export const one=[[[45,128],[200,128]]];
export async function ready(p:Page){await p.locator('[data-index-ready=true]').waitFor();}
export async function pane(p:Page,name:string){
 if(await p.locator('[data-detail]').isVisible())await p.locator('[data-close-detail]').click();
 if(name==='hand'){if(await p.locator('#hsl-hand').isHidden())await p.locator('[data-pane=hand]').click();}
 else await p.locator('[data-pane=query]').click();
}
export async function query(p:Page,q:string){await pane(p,'query');await p.locator('#hsl-input').fill(q);await p.locator('[data-search] button').click();}
export async function details(p:Page,i=0){await p.locator('[data-open-detail]').nth(i).click();}
export async function tabTo(p:Page,selector:string){
 for(let i=0;i<100;i++){if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;await p.keyboard.press('Tab');}
 throw Error(`keyboard could not reach ${selector}`);
}
export async function mouseDraw(p:Page,ss=strokes){
 const pad=p.locator('[data-pad]');await pad.scrollIntoViewIfNeeded();const r=(await pad.boundingBox())!;
 const count=Number(await pad.getAttribute('data-stroke-count'));
 for(const s of ss){await p.mouse.move(r.x+s[0][0]/256*r.width,r.y+s[0][1]/256*r.height);await p.mouse.down();for(const [x,y] of s.slice(1))await p.mouse.move(r.x+x/256*r.width,r.y+y/256*r.height,{steps:8});await p.mouse.up();}
 await expect(pad).toHaveAttribute('data-stroke-count',String(count+ss.length));
}
