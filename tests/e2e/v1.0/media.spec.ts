import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {activate,keyReach} from '../step4/input-helpers';
import {mediaFaultServer} from './media-fault-server';
const evidence=process.env.GAME_CODEX_EVIDENCE_ROOT??'tmp/tasks/GAME-CODEX-V1.0';
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log('MEDIA_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({hidden:document.hidden,media:((window as any).mediaQA??[]).map((t:HTMLAudioElement)=>({src:t.src,current:t.currentSrc,error:t.error?.code,network:t.networkState,ready:t.readyState,paused:t.paused,time:t.currentTime})),ogg:document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'),mp3:document.createElement('audio').canPlayType('audio/mpeg')}))));});
type MediaObservation={src:string,paused:boolean,time:number,volume:number,error:number|null,ready:number};
async function observe(page:Page):Promise<MediaObservation[]>{return page.evaluate(()=>((window as any).mediaQA as HTMLAudioElement[]).map(t=>({src:t.currentSrc,paused:t.paused,time:t.currentTime,volume:t.volume,error:t.error?.code??null,ready:t.readyState})));}
async function installObserver(page:Page){await page.addInitScript(()=>{const Original=window.Audio;const media:HTMLAudioElement[]=[];(window as any).mediaQA=media;window.Audio=function(src?:string){const t=new Original(src);media.push(t);return t;} as unknown as typeof Audio;});}
for(const product of ['tower','adventure'] as const)test(`@v1-media ${product}: real unlock, separate volume, mute, reload and denied-media retry`,async({page},info)=>{
 test.skip(!['desktop','firefox','webkit'].includes(info.project.name));
 await installObserver(page);
 const route=product==='tower'?'?play=hanzi-tower-defense&scenario=twin-lanes':'?play=hanzi-word-adventure&chapter=companions',owner=product==='tower'?'td':'hway';
 const start=async()=>{await page.goto(route);await expect(page.locator(`[data-${owner}-canvas]`)).toHaveAttribute('data-ready','true');};
 const act=(s:string)=>activate(page,s,'mouse');
 await start();expect(await observe(page)).toEqual([]);
 await act(`[data-${owner}-guide-close]`);
 await expect.poll(async()=>(await observe(page)).filter(t=>!t.paused&&t.time>0&&t.ready>=2).length).toBe(2);
 const playing=await observe(page);expect(playing.every(t=>t.src.includes(`/assets/v1.0/${product}/`))).toBe(true);
 await act(`[data-${owner}-settings]`);
 // Sliders retain native keyboard semantics, without invoking any world action.
 await keyReach(page,'[data-presentation-music]');await page.keyboard.press('Home');
 await expect.poll(async()=>(await observe(page)).every(t=>t.paused&&t.volume===0)).toBe(true);
 await keyReach(page,'[data-presentation-effects]');await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');
 await expect(page.locator('[data-presentation-effects]')).toHaveValue('99');await expect(page.locator('[data-presentation-music]')).toHaveValue('0');
 await keyReach(page,'[data-presentation-music]');await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');
 await expect.poll(async()=>(await observe(page)).every(t=>!t.paused)).toBe(true);
 await act(`[data-${owner}-mute]`);await expect.poll(async()=>(await observe(page)).every(t=>t.paused)).toBe(true);
 await act(`[data-${owner}-settings-close]`);await page.reload();await expect(page.locator(`[data-${owner}-canvas]`)).toHaveAttribute('data-ready','true');
 await act(`[data-${owner}-settings]`);await expect(page.locator(`[data-${owner}-mute]`)).toHaveAttribute('aria-pressed','true');expect(await observe(page)).toEqual([]);
 await expect(page.locator('[data-presentation-effects]')).toHaveValue('99');await act(`[data-${owner}-mute]`);
 await expect.poll(async()=>(await observe(page)).filter(t=>!t.paused).length).toBe(2);
 for(let n=0;n<5;n++){await act('[data-presentation-low]');await act('[data-presentation-low]');}expect((await observe(page)).length).toBe(2);
 await act(`[data-${owner}-settings-close]`);
 mkdirSync(`${evidence}/media`,{recursive:true});writeFileSync(`${evidence}/media/${product}-${info.project.name}.json`,JSON.stringify({playing,maxMusicVoices:2,realGesture:true,muteAndReload:true},null,2));
});
// A fresh isolated browser context prevents an already decoded media cache from masking failure.
for(const product of ['tower','adventure'] as const)test(`@v1-media-failure ${product}: network rejection and real retry`,async({page,baseURL},info)=>{
 test.skip(!['desktop','firefox','webkit'].includes(info.project.name));await installObserver(page);
 const owner=product==='tower'?'td':'hway',route=product==='tower'?'?play=hanzi-tower-defense&scenario=twin-lanes':'?play=hanzi-word-adventure&chapter=companions';
 const act=(s:string)=>activate(page,s,'mouse'),fault=await mediaFaultServer(baseURL!);
 try{
 await page.goto(`${fault.url}/${route}`);await expect(page.locator(`[data-${owner}-canvas]`)).toHaveAttribute('data-ready','true');await act(`[data-${owner}-settings]`);
 await expect(page.locator('[data-presentation-retry]')).toBeVisible();fault.recover();await act('[data-presentation-retry]');
 expect(fault.rejected).toBeGreaterThan(0);
 await expect.poll(async()=>(await observe(page)).filter(t=>!t.paused&&t.time>0).length).toBe(2);
 const recovered=await observe(page);expect(recovered.every(t=>t.error===null)).toBe(true);
 await act(`[data-${owner}-settings-close]`);
 if(product==='adventure'){await page.locator('[data-hway-primary]').click();await expect(page.locator('[data-hway-hand]')).toHaveText('木');}
 else {await page.locator('[data-core="1"]').click();await page.locator('[data-slot="0"]').click();await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-tower-id','1');}
 mkdirSync(`${evidence}/media`,{recursive:true});writeFileSync(`${evidence}/media/${product}-${info.project.name}-failure.json`,JSON.stringify({rejected:fault.rejected,recovered,maxMusicVoices:2,realGesture:true,networkFailureRecovered:true},null,2));
 }finally{await page.goto('about:blank');await fault.close();}
});
