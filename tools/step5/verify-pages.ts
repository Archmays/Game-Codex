import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { chromium, expect, type Page, type BrowserContext } from '@playwright/test';
import { activate, fromHome, keyReach, type InputMode } from '../../tests/e2e/step4/input-helpers';
import { companionAction, companionReady, readCompanion } from '../../tests/e2e/hanzi-word-adventure/step5-helpers';
import { arrangeTacticsUI, tacticsItems, tacticsRegion } from '../../tests/e2e/hanzi-tower-defense/step5-input';
import { act } from '../../games/hanzi-word-adventure/model';
import { ROOMS } from '../../games/hanzi-word-adventure/rooms';
import { solve } from '../../games/hanzi-word-adventure/solver';
import { SCENARIO_IDS } from '../../games/hanzi-tower-defense/tactics';
import { TACTICS_SAVE_KEY, SAVE_KEY as CAMPAIGN_KEY } from '../../games/hanzi-tower-defense/save';
import { RETIRED_LANGUAGE_PLAY_IDS, RETIRED_LANGUAGE_WORLD_IDS } from '../../src/app-route';

const base = new URL(process.argv[2] ?? 'https://archmays.github.io/Game-Codex/');
const expected = process.argv[3];
const local = process.env.STEP5_LOCAL_PREFLIGHT === '1';
if (!expected || !(local ? /^local-[a-z0-9-]+$/.test(expected) && base.hostname === '127.0.0.1' : /^[a-f0-9]{40}$/.test(expected) && base.protocol === 'https:')) throw Error('Provide the exact deployed SHA, or an explicitly labelled local preflight.');
const task = resolve('tmp/tasks/GAME-CODEX-STEP5');
const output = resolve(process.env.STEP5_RELEASE_EVIDENCE ?? `${task}/${local?'release-preflight':'online'}`);
if (!output.startsWith(task + sep)) throw Error('Evidence must stay in the STEP5 task folder.');
mkdirSync(output,{recursive:true});
const errors:string[] = [], external:string[] = [], routes:string[] = [], flows:unknown[] = [];
const browser = await chromium.launch({headless:true});
function observe(page:Page) {
  page.setDefaultTimeout(15_000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')errors.push(`${request.failure()?.errorText} ${request.url()}`);});
  page.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==base.origin)external.push(url.href);});
}
async function identity(page:Page) { await expect(page.locator('html')).toHaveAttribute('data-build-commit',expected); }
async function route(page:Page,query:string,selector:string) {
  await page.goto(new URL(query,base).href); await expect(page.locator(selector).first()).toBeVisible(); await identity(page); routes.push(query);
  if (query === '?playtest=step4') await expect(page).toHaveTitle('本次试玩 · Game-Codex STEP5');
}
async function contextFor(mode:InputMode):Promise<BrowserContext> {
  return browser.newContext({baseURL:base.href,viewport:mode==='touch'?{width:390,height:844}:{width:1440,height:1000},hasTouch:mode==='touch',deviceScaleFactor:mode==='touch'?2:1,reducedMotion:'reduce'});
}
try {
  const inventory=await contextFor('mouse'), page=await inventory.newPage();observe(page);
  const checks:[string,string][]=[['./','[data-testid=my-game-world]'],['?playtest=step4','[data-testid=step4-playtest]'],['?hub=classic&from=world','.hub-grid'],['?world=math-world','[data-testid=math-world-map]'],['?world=math-world&station=slider','[data-equation-board]'],['?world=math-world&station=target','[data-testid=target-cards]'],['?play=memory-card','[data-testid=memory-match]'],
    ...['homeward','lamplight','confluence','companions'].map(id=>[`?play=hanzi-word-adventure&chapter=${id}`,'[data-hway-grid]'] as [string,string]),
    ...['qinglan-pass','twin-bends','beacon-keep'].map(id=>[`?play=hanzi-tower-defense&map=${id}`,'.td-game'] as [string,string]),
    ...SCENARIO_IDS.map(id=>[`?play=hanzi-tower-defense&scenario=${id}`,'.td-game'] as [string,string]),
    ...RETIRED_LANGUAGE_PLAY_IDS.map(id=>[`?play=${id}&chapter=2#old`,'[data-testid=my-game-world]'] as [string,string]),
    ...RETIRED_LANGUAGE_WORLD_IDS.map(id=>[`?world=${id}&view=archive`,'[data-testid=my-game-world]'] as [string,string])];
  for(const [query,selector] of checks){await route(page,query,selector);if(query.includes('scenario='))await expect(page.locator('.td-game')).toHaveAttribute('data-scenario-id',new URL(query,base).searchParams.get('scenario')!);}
  await route(page,'?playtest=step4','[data-testid=step4-playtest]');await expect(page.locator('[data-playtest-entry]')).toHaveCount(13);
  await inventory.close();
  for(const mode of ['keyboard','touch'] as const) {
    const context=await contextFor(mode), page=await context.newPage();observe(page);
    await fromHome(page,mode,'adventure');await identity(page);
    await activate(page,'[data-hway-new]',mode);await activate(page,'[data-hway-chapter=companions]',mode);await companionReady(page);
    let journey=await readCompanion(page);const room=ROOMS[journey.room],result=solve(room,journey.state);expect(result.status).toBe('solved');
    let state=journey.state;
    for(const action of result.actions){await companionAction(page,action,mode);const next=act(room,state,action);expect(next.ok).toBe(true);state=next.state;expect((await readCompanion(page)).state).toEqual(state);}
    await expect(page.locator('.hway')).toHaveAttribute('data-won','true');
    if(mode==='keyboard'){await page.keyboard.press('z');await expect(page.locator('[data-hway-grid]')).toBeFocused();await page.keyboard.press('h');await expect(page.locator('[data-hway-hint-box]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[data-hway-grid]')).toBeFocused();}
    else {await activate(page,'[data-hway-undo]',mode);await activate(page,'[data-hway-hint]',mode);await activate(page,'[data-hway-hint-close]',mode);await expect(page.locator('[data-hway-grid]')).toBeFocused();}
    journey=await readCompanion(page);await page.reload();await companionReady(page);expect(await readCompanion(page)).toEqual(journey);await identity(page);
    await page.screenshot({path:`${output}/companions-${mode}.png`,fullPage:true});
    await activate(page,'[data-hway-exit]',mode);await expect(page.getByTestId('my-game-world')).toBeVisible();
    flows.push({game:'companions',mode,roomId:room.id,actions:result.actions.length,won:true,undoHintReload:true});

    await activate(page,'[data-world-forest-link]',mode);await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await identity(page);
    const old=await page.evaluate(key=>localStorage.getItem(key),CAMPAIGN_KEY);
    await activate(page,'[data-td-tactics]',mode);await activate(page,'[data-scenario-select=beacon-crowd]',mode);
    await arrangeTacticsUI(page,mode,'beacon-crowd','volcano-grove');
    const before=JSON.parse((await page.evaluate(key=>localStorage.getItem(key),TACTICS_SAVE_KEY))!);
    const checkpoint=before.scenarios['beacon-crowd'].checkpoint;
    await activate(page,'[data-td-next]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
    await expect.poll(()=>page.locator('.td-game').getAttribute('data-kills'),{timeout:60_000}).not.toBe('0');
    await activate(page,'[data-td-pause]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');
    const core=(await tacticsItems(page)).find(item=>item.slot!==null)!;
    await activate(page,core.selector,mode,tacticsRegion(core.selector));await expect(page.locator('[data-td-stow]')).toBeDisabled();
    await activate(page,'[data-td-speed]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-speed','2');await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');
    await activate(page,'[data-td-retry]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
    const restored=JSON.parse((await page.evaluate(key=>localStorage.getItem(key),TACTICS_SAVE_KEY))!).scenarios['beacon-crowd'].checkpoint;
    expect(restored).toEqual(checkpoint);expect(await page.evaluate(key=>localStorage.getItem(key),CAMPAIGN_KEY)).toBe(old);
    await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-scenario-id','beacon-crowd');await expect(page.locator('.td-game')).toHaveAttribute('data-speed','1');await identity(page);
    await page.screenshot({path:`${output}/tactics-${mode}.png`,fullPage:true});
    await activate(page,'[data-td-home]',mode);await expect(page.getByTestId('my-game-world')).toBeVisible();await identity(page);
    flows.push({game:'tactics',mode,scenarioId:'beacon-crowd',ordinaryFusionDeploymentKills:true,pausedRestriction:true,retryCheckpointExact:true,campaignRawPreserved:true});
    await context.close();
  }
  expect(errors).toEqual([]);expect(external).toEqual([]);
  writeFileSync(`${output}/verification.json`,JSON.stringify({verdict:local?'PASS_MACHINE_LOCAL_PREFLIGHT':'PASS_MACHINE_RELEASE_READBACK',expectedCommit:expected,base:base.href,routes,flows,errors,external,stateInjection:false,clockAcceleration:false,verifiedAt:new Date().toISOString()},null,2));
  console.log(JSON.stringify({expectedCommit:expected,routes:routes.length,flows:flows.length,output}));
} catch(error) {
  writeFileSync(`${output}/verification.json`,JSON.stringify({verdict:'FAIL',expectedCommit:expected,base:base.href,routes,flows,errors,external,error:String(error)},null,2));throw error;
} finally {await browser.close();}
