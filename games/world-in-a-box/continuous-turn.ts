/** Hold duration owns the angle; click never appends a fixed angle. */
export function continuousTurn(root:HTMLElement,turn:(delta:number)=>void,signal:AbortSignal){
 let direction=0,frame=0,last=0,held:number|string|null=null;
 const stop=()=>{direction=0;held=null;cancelAnimationFrame(frame);};
 const tick=(now:number)=>{if(!direction)return;turn(direction*Math.min(.05,(now-last)/1000)*.9);last=now;frame=requestAnimationFrame(tick);};
 const directionOf=(target:EventTarget|null)=>{const action=(target as HTMLElement)?.closest<HTMLElement>('[data-action]')?.dataset.action;return action==='left'?-1:action==='right'?1:0;};
 const start=(d:number,key:number|string)=>{if(!d||held!==null)return;direction=d;held=key;last=performance.now();frame=requestAnimationFrame(tick);};
 root.addEventListener('pointerdown',e=>{const d=directionOf(e.target);if(d&&e.isPrimary&&e.button===0){start(d,e.pointerId);(e.target as HTMLElement).closest('button')?.setPointerCapture(e.pointerId);}},{signal});
 window.addEventListener('pointerup',stop,{signal});root.addEventListener('pointercancel',stop,{signal});window.addEventListener('blur',stop,{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal});
 root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const d=directionOf(e.target);if(d){e.preventDefault();start(d,e.key);}}},{signal});
 window.addEventListener('keyup',e=>{if(e.key===held)stop();},{signal});root.addEventListener('focusout',e=>{if(directionOf(e.target))stop();},{signal});
 root.addEventListener('box-modal',stop,{signal});signal.addEventListener('abort',stop,{once:true});
 for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action=left],[data-action=right]')){button.title='按住连续转动，松开停止';button.setAttribute('aria-description','按住鼠标、触屏或回车、空格连续转动，松开停止');}
 return stop;
}
