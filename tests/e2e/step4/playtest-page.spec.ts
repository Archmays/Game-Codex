import {mkdirSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {activate,fromHome,criticalTargets} from './input-helpers';
test('@playtest-visual final trial links, version and empty local feedback',async({page},info)=>{
 test.skip(!['desktop','phone-390'].includes(info.project.name));
 const mode=info.project.name==='desktop'?'keyboard':'touch';
 await fromHome(page,mode,'playtest');await expect(page.getByTestId('step4-playtest')).toBeVisible();
 await expect(page.locator('[data-playtest-entry]')).toHaveCount(13);
 await expect(page.locator('[data-step4-sha]')).not.toBeEmpty();
 await expect(page.locator('[data-feedback-save]')).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('family-games/step4-playtest/feedback-v1'))).toBeNull();
 await criticalTargets(page,'[data-playtest-entry], .step4-playtest header a, .step4-other a');
 const evidence=`${process.env.GAME_CODEX_EVIDENCE_ROOT ?? 'tmp/tasks/GAME-CODEX-STEP4'}/input`;
 mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/playtest-${info.project.name}.png`,fullPage:true});
 await activate(page,'a[href="?play=hanzi-tower-defense&map=qinglan-pass&from=world"]',mode);
 await expect(page.locator('.td-game')).toHaveAttribute('data-map-id','qinglan-pass');await expect(page.locator('[data-td-speed]')).toHaveText('速度 1×');
});
