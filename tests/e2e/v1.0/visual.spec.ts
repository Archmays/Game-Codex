import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {activate,criticalTargets,type InputMode} from '../step4/input-helpers';
import {tacticsRegion} from '../hanzi-tower-defense/step5-input';
const evidence=process.env.GAME_CODEX_EVIDENCE_ROOT??'tmp/tasks/GAME-CODEX-V1.0';
test('@v1-baseline stable illustrated composition and companion world',async({page},info)=>{
 test.skip(!['desktop','phone-390'].includes(info.project.name));const mode:InputMode=info.project.use.hasTouch?'touch':'keyboard';const act=(s:string)=>activate(page,s,mode,tacticsRegion(s));
 await page.goto('?play=hanzi-tower-defense&scenario=twin-lanes');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await act('[data-td-guide-close]');
 await act('[data-core="1"]');await act('[data-core="2"]');
 await page.locator('[data-td-fuse]').scrollIntoViewIfNeeded();
 const composition=await criticalTargets(page,'[data-td-fuse],.td-selection .has-core,[data-fusion-target]');
 expect(await page.locator('[data-td-board]').evaluate(el=>el.getBoundingClientRect().bottom)).toBeGreaterThan(0);
 await act('[data-td-fuse]');await act('[data-slot="0"]');
 await expect(page.locator('[data-td-synthesis]')).toBeHidden();await expect(page.locator('.td-slot--occupied img')).toHaveJSProperty('naturalWidth',256);
 await act('[data-td-clear]');await page.locator('.td-game').scrollIntoViewIfNeeded();
 mkdirSync(`${evidence}/visual-candidates`,{recursive:true});await page.screenshot({path:`${evidence}/visual-candidates/tower-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 if(process.env.V1_VISUAL)await expect(page).toHaveScreenshot('tower-ready.png',{fullPage:true,animations:'disabled'});
 await page.goto('?play=hanzi-word-adventure&chapter=companions');await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');await activate(page,'[data-hway-guide-close]',mode);
 if(mode==='keyboard'){await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('q');await page.keyboard.press('Space');}
 else{for(const s of ['[data-hway-primary]','[data-hway-move=right]','[data-hway-actor=friend]','[data-hway-primary]'])await activate(page,s,mode);}
 await expect(page.locator('[data-hway-hand]')).toHaveText('明');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
 const primaryContrast=await page.locator('[data-hway-primary]').evaluate(el=>{
  const style=getComputedStyle(el),luminance=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });expect(primaryContrast).toBeGreaterThanOrEqual(4.5);
 await page.locator('.hway').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/visual-candidates/adventure-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 if(process.env.V1_VISUAL)await expect(page).toHaveScreenshot('adventure-companions.png',{fullPage:true,animations:'disabled'});
 writeFileSync(`${evidence}/visual-candidates/${info.project.name}-composition.json`,JSON.stringify({mode,composition,ordinaryActions:true},null,2));
});
