import type {MountGameContext} from '../../packages/game-core';
import {AUDIO_KEY,BoxAudio,soundPreferences,type Channel} from './audio';
export function boxSound(root:HTMLElement,storage:MountGameContext['storage'],scene:'window-breeze'|'river-campus',legacyMuted:boolean,changed:(muted:boolean)=>void){
 const preferences=soundPreferences(storage.get(AUDIO_KEY,null),legacyMuted);
 const dialog=document.createElement('dialog');dialog.className='wb-dialog wb-sound';dialog.setAttribute('aria-label','声音设置');
 dialog.innerHTML='<h2>声音设置</h2><p data-sound-status>按你的喜好，调小或关掉任一种声音。</p>'+(['music','sfx','ambient'] as Channel[]).map((key,i)=>`<label>${['音乐','音效','环境'][i]} <output data-volume="${key}"></output><input aria-label="${['音乐','音效','环境'][i]}音量" data-channel="${key}" type="range" min="0" max="100" step="1"></label>`).join('')+'<button data-sound-close>继续玩</button>';
 root.querySelector('main')!.append(dialog);const button=document.createElement('button');button.dataset.soundSettings='true';button.textContent='声音设置';root.querySelector('[data-action=mute]')!.after(button);
 const audio=new BoxAudio(scene,preferences,text=>{dialog.querySelector('[data-sound-status]')!.textContent=text;root.querySelector('[data-subtitle]')!.textContent=text;},paused=>root.dispatchEvent(new CustomEvent('box-audio-interrupted',{detail:paused}))); 
 const save=()=>{try{storage.set(AUDIO_KEY,audio.preferences);if(JSON.stringify(storage.get(AUDIO_KEY,null))!==JSON.stringify(audio.preferences))throw Error();}catch{dialog.querySelector('[data-sound-status]')!.textContent='本次设置已生效，暂时无法保存。';}};
 const sync=()=>{for(const input of dialog.querySelectorAll<HTMLInputElement>('input')){const key=input.dataset.channel as Channel;input.value=String(Math.round(audio.preferences[key]*100));dialog.querySelector(`[data-volume=${key}]`)!.textContent=input.value+'%';}};
 sync();button.addEventListener('click',e=>{e.stopPropagation();root.dispatchEvent(new CustomEvent('box-modal',{detail:{reason:'settings',open:true}}));dialog.showModal();dialog.querySelector<HTMLInputElement>('input')!.focus();void audio.unlock();});
 dialog.addEventListener('input',e=>{const input=e.target as HTMLInputElement,key=input.dataset.channel as Channel;if(!key)return;audio.configure({...audio.preferences,[key]:Number(input.value)/100});save();sync();});
 dialog.addEventListener('click',e=>{e.stopPropagation();if((e.target as HTMLElement).closest('[data-sound-close]'))dialog.close();});
 dialog.addEventListener('close',()=>{root.dispatchEvent(new CustomEvent('box-modal',{detail:{reason:'settings',open:false}}));button.focus({preventScroll:true});});
 return {audio,muted:preferences.muted,toggle(){audio.configure({...audio.preferences,muted:!audio.preferences.muted});save();changed(audio.preferences.muted);void audio.unlock();}};
}
