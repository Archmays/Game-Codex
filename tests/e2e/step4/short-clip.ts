import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Read-only screen recording. No game state, clock, focus or input is changed. */
export async function shortClip(page:Page, directory:string, milliseconds=20000):Promise<()=>Promise<number>> {
  mkdirSync(directory,{recursive:true});
  const session=await page.context().newCDPSession(page);
  const frames:{file:string;timestamp:number}[]=[];
  session.on('Page.screencastFrame',event=>{
    const file=`frame-${String(frames.length).padStart(4,'0')}.jpg`;
    writeFileSync(`${directory}/${file}`,Buffer.from(event.data,'base64'));
    frames.push({file,timestamp:event.metadata.timestamp??Date.now()/1000});
    void session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  });
  await session.send('Page.startScreencast',{format:'jpeg',quality:72,maxWidth:1280,maxHeight:960,everyNthFrame:4});
  // The timer bounds this requested visual sample; it never advances the simulation clock.
  const finish=new Promise<void>(resolve=>setTimeout(resolve,milliseconds)).then(async()=>{
    await session.send('Page.stopScreencast');
    writeFileSync(`${directory}/frames.json`,JSON.stringify({durationMs:milliseconds,stateInjection:false,clockAcceleration:false,frames},null,2));
    await session.detach();
  });
  return async()=>{await finish;return frames.length;};
}
