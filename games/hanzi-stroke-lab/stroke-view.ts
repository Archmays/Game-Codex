import type {StrokeData} from './model';
const NS='http://www.w3.org/2000/svg';
let uid=0;
export function svgNode<K extends keyof SVGElementTagNameMap>(tag:K, attrs:Record<string,string|number>={}):SVGElementTagNameMap[K] {
  const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;
}
export function makeGlyph(data:StrokeData, step:number, grid:boolean, animated=false):SVGSVGElement {
  const svg=svgNode('svg',{viewBox:'0 0 1024 1024','aria-hidden':'true'});
  if(grid){svg.append(svgNode('path',{d:'M512 0V1024 M0 512H1024',stroke:'#d9cdc0','stroke-width':3,'stroke-dasharray':'14 14',fill:'none'}));}
  const g=svgNode('g',{transform:'translate(0 900) scale(1 -1)'});svg.append(g);
  for(let i=0;i<data.strokes.length;i++){
    const current=i===step,done=i<step || step===data.strokes.length;
    g.append(svgNode('path',{d:data.strokes[i],fill:done?'#273d38':current?'#b45a36':'none',stroke:current?'#593525':!done?'#9a9c92':'none','stroke-width':current?6:3,'stroke-dasharray':!done&&!current?'10 7':'none','data-stroke':i,'data-state':done?'written':current?'current':'outline'}));
  }
  if(animated && step<data.strokes.length){
    const median=data.medians[step], path=g.querySelector<SVGPathElement>(`[data-stroke="${step}"]`)!;
    const id=`hsl-mask-${++uid}`,mask=svgNode('mask',{id,maskUnits:'userSpaceOnUse',x:-100,y:-200,width:1300,height:1300});
    const line=svgNode('polyline',{points:median.map(p=>p.join(',')).join(' '),fill:'none',stroke:'white','stroke-width':180,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':1,'stroke-dashoffset':1,'data-reveal':''});
    mask.append(line);const defs=svgNode('defs');defs.append(mask);g.prepend(defs);path.setAttribute('mask',`url(#${id})`);
  }
  return svg;
}
/** One scheduler and one active glyph. No timers or rendering work survives destroy. */
export class StrokeView {
  step=0; playing=false; speed=1; grid=true; complete=true;
  private frame=0;private elapsed=0;private previous=0;private data:StrokeData|null=null;
  constructor(private host:HTMLElement,private change:()=>void){}
  setData(data:StrokeData|null):void {this.stop();this.data=data;this.step=0;this.complete=true;this.render();this.change();}
  private render(animated=false):void {this.host.replaceChildren();if(this.data)this.host.append(makeGlyph(this.data,this.complete?this.data.strokes.length:this.step,this.grid,animated));}
  stop():void {cancelAnimationFrame(this.frame);this.playing=false;this.previous=0;}
  go(step:number):void {this.stop();this.complete=false;this.step=Math.max(0,Math.min((this.data?.strokes.length??1)-1,step));this.elapsed=0;this.render();this.change();}
  showAll():void {this.stop();this.complete=true;this.elapsed=0;this.render();this.change();}
  restart():void {this.go(0);this.play();}
  toggle():void {if(this.playing){this.stop();this.change();}else this.play();}
  play():void {
    if(!this.data)return;
    if(this.complete){this.step=0;this.elapsed=0;this.complete=false;}
    this.playing=true;this.previous=0;this.render(true);this.change();
    const tick=(now:number)=>{
      if(!this.playing||!this.data)return;
      if(this.previous)this.elapsed+=(now-this.previous)*this.speed;
      this.previous=now;
      const duration=650+this.data.medians[this.step].length*35;
      const progress=Math.min(1,this.elapsed/duration);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.host.querySelector('[data-reveal]')?.setAttribute('stroke-dashoffset',String(reduced?1-Math.floor(progress):1-progress));
      if(this.elapsed>=duration+220){
        this.elapsed=0;this.step++;
        if(this.step>=this.data.strokes.length){this.step=this.data.strokes.length-1;this.showAll();return;}
        this.render(true);this.change();
      }
      this.frame=requestAnimationFrame(tick);
    };
    this.frame=requestAnimationFrame(tick);
  }
  setGrid(grid:boolean):void {this.grid=grid;this.render(this.playing);}
  destroy():void {this.stop();this.data=null;this.host.replaceChildren();}
}
