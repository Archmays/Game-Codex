import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {act,clone,describeAction,validState,type Action} from '../../../games/hanzi-word-adventure/model';
import {ROOMS,type Room} from '../../../games/hanzi-word-adventure/rooms';
import {solve} from '../../../games/hanzi-word-adventure/solver';
import {companionAction,companionReady,readCompanion,point,type CompanionInput} from './step5-helpers';
const evidence=process.env.HWAY_EVIDENCE_DIR ?? process.env.HWAY_EVIDENCE ?? 'tmp/tasks/GAME-CODEX-STEP5/adventure';

async function currentHints(page:Page,input:CompanionInput,room:Room,expectBridge=false) {
  const before=await readCompanion(page),answer=solve(room,before.state);expect(answer.status).toBe('solved');
  const levels:string[]=[];
  for(let level=0;level<3;level++) {
    if(input==='keyboard') {await expect(page.locator('[data-hway-grid]')).toBeFocused();await page.keyboard.press('h');}
    else await point(page,level===0?'[data-hway-hint]':'[data-hway-hint-more]',input);
    await expect(page.locator('[data-hway-hint-text]')).not.toContainText('正在看');
    levels.push((await page.locator('[data-hway-hint-text]').textContent())!);
    expect(await readCompanion(page)).toEqual(before);
  }
  expect(levels[0]).toContain('先看看');
  if(expectBridge) expect(levels[1]).toContain('岸上的木挡路');
  expect(levels[2]).toBe(describeAction(room,before.state,answer.actions[0]));
  if(input==='keyboard') await page.keyboard.press('Escape');else await point(page,'[data-hway-hint-close]',input);
  await expect(page.locator('[data-hway-hint-box]')).toBeHidden();await expect(page.locator('[data-hway-grid]')).toBeFocused();expect(await readCompanion(page)).toEqual(before);
  return {state:before.state,levels,next:answer.actions[0],unchanged:true};
}

/** One continuous world loop; every key is real and focus is asserted, never repaired. */
async function roomThreePrelude(page:Page,input:CompanionInput,room:Room) {
  let state=(await readCompanion(page)).state;expect(state).toEqual(room.initial);
  const operations:unknown[]=[];
  const execute=async(action:Action)=>{const before=clone(state),next=act(room,state,action);expect(next.ok).toBe(true);await companionAction(page,action,input);state=next.state;expect((await readCompanion(page)).state).toEqual(state);await expect(page.locator('[data-hway-grid]')).toBeFocused();operations.push({action,before,after:state});};
  await execute({type:'take',target:2});await execute({type:'move',direction:'right'});await execute({type:'switch'});
  const beforePreview=await readCompanion(page);
  if(input==='keyboard'){await page.keyboard.press('x');await page.keyboard.press('ArrowLeft');}
  else {await point(page,'[data-hway-cell="4"]',input);await point(page,'[data-hway-action=preview-split]',input);await point(page,'[data-hway-side=left]',input);}
  await expect(page.locator('[data-hway-action=split]')).toBeDisabled();await expect(page.locator('[data-hway-preview-reason]')).toContainText('友');
  const reason=await page.locator('[data-hway-preview-reason]').textContent();expect(await readCompanion(page)).toEqual(beforePreview);
  if(input==='keyboard') await page.keyboard.press('Escape');else await point(page,'[data-hway-action=cancel]',input);
  expect(await readCompanion(page)).toEqual(beforePreview);await expect(page.locator('[data-hway-grid]')).toBeFocused();operations.push({action:'preview-left-cancel',before:beforePreview.state,after:(await readCompanion(page)).state,reason,unchanged:true});
  await execute({type:'split',target:4,side:'right'});await execute({type:'take',target:4});await execute({type:'move',direction:'right'});
  const beforeCombine=clone(state);await execute({type:'combine',target:5});const combined=clone(state);
  if(input==='keyboard') await page.keyboard.press('z');else await point(page,'[data-hway-undo]',input);
  state=(await readCompanion(page)).state;expect(state).toEqual(beforeCombine);await expect(page.locator('[data-hway-grid]')).toBeFocused();operations.push({action:'undo-combine',before:combined,after:state});
  const hintBefore=await readCompanion(page);
  if(input==='keyboard') await page.keyboard.press('h');else await point(page,'[data-hway-hint]',input);
  await expect(page.locator('[data-hway-hint-text]')).not.toContainText('正在看');const hint=await page.locator('[data-hway-hint-text]').textContent();
  if(input==='keyboard') await page.keyboard.press('Escape');else await point(page,'[data-hway-hint-close]',input);
  expect(await readCompanion(page)).toEqual(hintBefore);await expect(page.locator('[data-hway-grid]')).toBeFocused();operations.push({action:'hint-close',hint,before:state,after:state,unchanged:true});
  return operations;
}
test('STEP5 first room complete continuous operations',async({page},info)=>{
  const input: CompanionInput=info.project.name==='touch'?'touch':'keyboard';
  await page.goto('?play=hanzi-word-adventure&chapter=companions'); await companionReady(page);
  const r=ROOMS[15],result=solve(r,r.initial); expect(result.status).toBe('solved');
  let state=clone(r.initial);
  for(const action of result.actions){await companionAction(page,action,input); state=act(r,state,action).state; expect((await readCompanion(page)).state).toEqual(state);}
  expect(state.won).toBe(true); await expect(page.locator('[data-hway-ending]')).toBeVisible();
});
test('STEP5 all five rooms genuine keyboard or touch, reload undo hints and return',async({page},info)=>{
  mkdirSync(evidence,{recursive:true}); const input: CompanionInput=info.project.name==='touch'?'touch':'keyboard'; const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error') errors.push(e.text());});
  await page.goto('?play=hanzi-word-adventure&chapter=companions'); await companionReady(page);
  if(input==='keyboard'){await page.keyboard.press('h');await expect(page.locator('[data-hway-hint-box]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[data-hway-grid]')).toBeFocused();}
  else {await point(page,'[data-hway-hint]',input);await expect(page.locator('[data-hway-hint-box]')).toBeVisible();await point(page,'[data-hway-hint-close]',input);}
  const records=[]; let documentEpoch=0; let stableTake=await page.locator('[data-hway-action=take]').elementHandle();
  for(const room of ROOMS.slice(15)){
    const prelude=room.id==='companions-3'?await roomThreePrelude(page,input,room):[],hints=[];
    let state=(await readCompanion(page)).state;const result=solve(room,state);expect(result.status).toBe('solved');
    for(const [i,action] of result.actions.entries()){
      const before=clone(state),next=act(room,state,action);expect(next.ok).toBe(true);expect(validState(room,next.state)).toBe(true);
      await companionAction(page,action,input);state=next.state;expect((await readCompanion(page)).state).toEqual(state);expect(await stableTake!.evaluate(e=>e.isConnected)).toBe(true);
      if(room.id==='companions-2'&&i===5){const checkpoint=await readCompanion(page);await page.reload();await companionReady(page);documentEpoch++;stableTake=await page.locator('[data-hway-action=take]').elementHandle();expect(await readCompanion(page)).toEqual(checkpoint);if(input==='keyboard') await page.keyboard.press('z');else await point(page,'[data-hway-undo]',input);expect((await readCompanion(page)).state).toEqual(before);await companionAction(page,action,input);expect((await readCompanion(page)).state).toEqual(state);}
      if(room.id==='companions-2'&&(i===5||i===6)) hints.push({afterAction:i,...await currentHints(page,input,room,true)});
    }
    expect(state.won).toBe(true);await expect(page.locator('[data-hway-target]')).toContainText('两人各到一格家');await expect(page.locator('[data-hway-cell][data-target=true]')).toHaveCount(0);records.push({room:room.id,prelude,hints,search:result,won:state.won});
    if(room.id==='companions-2'||room.id==='companions-5')await page.screenshot({path:`${evidence}/${input}-${room.id}.png`,fullPage:true});
    if(room.id!=='companions-5'){if(input==='keyboard'){await page.keyboard.down('Space');await expect(page.locator('.hway')).toHaveAttribute('data-room',ROOMS[ROOMS.indexOf(room)+1].id);await page.keyboard.down('Space');await page.keyboard.up('Space');expect((await readCompanion(page)).state).toEqual(ROOMS[ROOMS.indexOf(room)+1].initial);}else await point(page,'[data-hway-next]',input);await expect(page.locator('.hway')).toHaveAttribute('data-room',ROOMS[ROOMS.indexOf(room)+1].id);}
  }
  if(input==='keyboard'){await page.keyboard.press('Tab');for(let i=0;i<35 && !(await page.locator('[data-hway-exit]').evaluate(e=>e===document.activeElement));i++)await page.keyboard.press('Tab');await expect(page.locator('[data-hway-exit]')).toBeFocused();await page.keyboard.press('Enter');}else await point(page,'[data-hway-exit]',input);
  await expect(page.getByTestId('my-game-world')).toBeVisible();expect(errors).toEqual([]);writeFileSync(`${evidence}/step5-${input}-all-rooms.json`,JSON.stringify({input,records,errors,documentEpoch},null,2));
});
test('STEP5 mouse then keyboard continues immediately; Space native controls and preview stay atomic',async({page},info)=>{
  test.skip(info.project.name==='touch','Mouse/key mixing uses desktop pointer');await page.goto('?play=hanzi-word-adventure&chapter=companions');await companionReady(page);
  await page.locator('[data-hway-cell="9"]').click();await expect(page.locator('[data-hway-grid]')).toBeFocused();await page.keyboard.press('Space');expect((await readCompanion(page)).state.entities.find(e=>e.kind==='木')?.holder).toBe('person');
  await page.keyboard.press('ArrowRight');expect((await readCompanion(page)).state.player).toBe(9);
  await page.locator('[data-hway-undo]').click();await expect(page.locator('[data-hway-grid]')).toBeFocused();await page.keyboard.press('q');expect((await readCompanion(page)).state.active).toBe('friend');
  await page.locator('[data-hway-primary]').click();await expect(page.locator('[data-hway-grid]')).toBeFocused();await page.keyboard.press('ArrowRight');expect((await readCompanion(page)).state.player).toBe(11);
  await page.keyboard.press('h');await page.keyboard.press('Escape');await expect(page.locator('[data-hway-grid]')).toBeFocused();
});
