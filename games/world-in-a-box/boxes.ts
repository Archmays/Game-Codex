import type { MountGameContext,MountedGame } from '../../packages/game-core';
export function mountBoxes(context:MountGameContext):MountedGame{
  let active:MountedGame|undefined,dead=false,generation=0;
  const root=context.container;let sceneEvents:AbortController|undefined;
  async function open(scene:string){
    document.title=scene==='dresden-river-campus'?'世界盒子 · 德累斯顿':'世界盒子 · 窗边有风';
    sceneEvents?.abort();sceneEvents=new AbortController();const signal=sceneEvents.signal;
    const token=++generation;active?.destroy();active=undefined;root.replaceChildren();for(const key of Object.keys(root.dataset))delete root.dataset[key];
    root.textContent='正在打开盒子……';
    try{
      const module=scene==='dresden-river-campus'?await import('./dresden-runtime'):await import('./runtime');
      if(dead||token!==generation)return;
      active='mountDresden' in module?module.mountDresden(context):module.mountWorldBox(context);
      const header=root.querySelector('.wb-header');
      const button=document.createElement('button');button.dataset.action='boxes';button.textContent='换盒子';header?.append(button);
      const dialog=document.createElement('dialog');dialog.className='wb-dialog';dialog.setAttribute('aria-label','换一个世界盒子');
      dialog.innerHTML='<h2>打开哪个盒子？</h2><button data-box="window-breeze">01 · 窗边有风</button><button data-box="dresden-river-campus">02 · 德累斯顿</button><button data-close-boxes>继续玩</button>';root.querySelector('main')?.append(dialog);
      button.addEventListener('click',e=>{e.stopPropagation();window.dispatchEvent(new Event('blur'));dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-box]')!.focus();},{signal});
      dialog.addEventListener('click',e=>{e.stopPropagation();const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(target?.dataset.box){const url=new URL(location.href);url.searchParams.set('scene',target.dataset.box);history.replaceState(null,'',url);void open(target.dataset.box);}else if(target?.hasAttribute('data-close-boxes'))dialog.close();},{signal});
      dialog.addEventListener('close',()=>button.focus(),{signal});
      if(scene==='unknown'){const p=document.createElement('p');p.className='wb-subtitle';p.textContent='这个盒子还没有收录，先打开窗边有风。';header?.after(p);}
    }catch{
      if(dead||token!==generation)return;root.textContent='盒子暂时打不开，已有进度保留。';const b=document.createElement('button');b.textContent='返回窗边有风';b.onclick=()=>void open('window-breeze');root.append(b);const exit=document.createElement('button');exit.textContent='返回游戏世界';exit.onclick=context.onExit;root.append(exit);
    }
  }
  const values=new URLSearchParams(location.search).getAll('scene');const scene=values.length===0?'window-breeze':values.length===1&&['window-breeze','dresden-river-campus'].includes(values[0])?values[0]:'unknown';void open(scene);
  return{destroy(){dead=true;generation++;sceneEvents?.abort();active?.destroy();root.replaceChildren();}};
}
