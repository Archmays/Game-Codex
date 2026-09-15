import {normalizeStrokes,type Point,type Strokes} from './model';
import {svgNode} from './stroke-view';
export interface Match {hanzi:string;score:number;}
export class Handwriting {
  readonly strokes:Strokes=[];
  revision=0;
  private worker:Worker|null=null;private timer=0;private ready=false;private destroyed=false;private wanted=false;
  private pending:Point[]|null=null;private pointer:number|null=null;
  private keyboard=false;private down=false;private pen:Point=[128,128];
  private abort=new AbortController();
  constructor(readonly canvas:SVGSVGElement,private status:(text:string)=>void,private candidates:(m:Match[])=>void,private changed:()=>void){
    const o={signal:this.abort.signal};
    canvas.addEventListener('pointerdown',e=>{
      if(!e.isPrimary){this.cancel();return;}
      if(e.button!==0||this.pointer!==null)return;
      // The stable SVG owns the gesture; avoid a compatibility mouse focus move
      // interrupting touch drawing when child vector nodes are redrawn.
      e.preventDefault();
      this.keyboard=false;this.down=false;this.cancel();
      this.invalidate();this.pointer=e.pointerId;this.pending=[this.point(e)];canvas.setPointerCapture(e.pointerId);this.redraw();
    },o);
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.pointer||!this.pending)return;
      const p=this.point(e);
      if(p.some(n=>n<0||n>255)){this.cancel();return;}
      if(this.pending.length<2048)this.pending.push(p);this.redraw();
    },o);
    canvas.addEventListener('pointerup',e=>{if(e.pointerId===this.pointer){this.pending?.push(this.point(e));this.finish();}},o);
    canvas.addEventListener('pointercancel',()=>this.cancel(),o);
    canvas.addEventListener('lostpointercapture',()=>{if(this.pending)this.cancel();},o);
    canvas.addEventListener('keydown',e=>this.key(e),o);
    canvas.addEventListener('blur',()=>{if(this.pending)this.cancel();this.keyboard=false;this.redraw();},o);
    window.addEventListener('blur',()=>this.cancel(),o);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();},o);
    this.redraw();
  }
  start():void {
    if(this.worker||this.destroyed)return;
    this.status('正在载入本地手写模型……');
    this.worker=new Worker(new URL('./hanzi-stroke-lab/recognizer/worker.js',document.baseURI));
    this.worker.onmessage=({data})=>{
      if(this.destroyed)return;
      if(data.type==='ready'){this.ready=true;this.status('写一个字，停笔后选候选。');if(this.wanted&&this.strokes.length)this.schedule();return;}
      if(data.revision!==undefined&&data.revision!==this.revision)return;
      if(data.type==='error'){this.status(data.message);return;}
      if(data.type==='result'&&this.strokes.length){this.candidates(data.matches);this.status(`${this.strokes.length} 笔 · 候选仅供选择，不会自动替你选字。`);}
    };
    this.worker.onerror=()=>{this.status('手写模型暂不可用，请点“重新载入识别”。');this.worker?.terminate();this.worker=null;this.ready=false;};
  }
  retry():void {this.invalidate();this.worker?.terminate();this.worker=null;this.ready=false;this.start();}
  invalidate():void {this.revision++;this.wanted=false;clearTimeout(this.timer);this.candidates([]);}
  private schedule():void {
    clearTimeout(this.timer);this.wanted=true;const revision=this.revision;
    if(!this.strokes.length){this.status('写一个字，停笔后选候选。');return;}
    this.status(this.ready?'正在识别……':'正在载入本地手写模型……');
    if(this.ready)this.timer=window.setTimeout(()=>{
      if(revision===this.revision&&!this.destroyed)this.worker?.postMessage({revision,strokes:normalizeStrokes(this.strokes)});
    },220);
  }
  private point(e:PointerEvent):Point {const r=this.canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width*255,(e.clientY-r.top)/r.height*255];}
  private release():void {const id=this.pointer;this.pointer=null;if(id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
  private finish():void {
    const stroke=this.pending;this.pending=null;this.release();this.down=false;
    if(stroke&&this.strokes.length<64){if(stroke.length===1)stroke.push([stroke[0][0]+0.1,stroke[0][1]+0.1]);this.strokes.push(stroke);}
    this.invalidate();this.redraw();this.changed();
    if(this.strokes.length>=64)this.status('已到 64 笔上限，可撤销或重新书写。');
    this.schedule();
  }
  cancel():void {const incomplete=Boolean(this.pending);this.pending=null;this.down=false;this.release();this.invalidate();this.redraw();if(incomplete)this.status('未完成的一笔已取消；已写笔画保留。');}
  suspend():void {this.cancel();this.keyboard=false;this.redraw();}
  undo():void {this.cancel();this.strokes.pop();this.redraw();this.changed();this.schedule();}
  clear():void {this.cancel();this.strokes.length=0;this.redraw();this.changed();this.status('已清空，可以重新写一个字。');}
  enterKeyboard():void {this.start();this.cancel();this.keyboard=true;this.canvas.focus();this.redraw();this.status('键盘画笔已进入：方向键移动，空格落笔或抬笔，Esc 取消并退出，Tab 离开。');}
  private key(e:KeyboardEvent):void {
    if(!this.keyboard||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();this.cancel();this.keyboard=false;this.redraw();this.changed();return;}
    if(e.key===' '){e.preventDefault();if(e.repeat)return;if(this.down)this.finish();else{this.invalidate();this.down=true;this.pending=[[...this.pen]];}this.redraw();return;}
    const delta:Record<string,Point>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(delta[e.key]){e.preventDefault();const [dx,dy]=delta[e.key];const n=e.shiftKey?12:4;this.pen=[Math.max(2,Math.min(253,this.pen[0]+dx*n)),Math.max(2,Math.min(253,this.pen[1]+dy*n))];if(this.down&&this.pending&&this.pending.length<2048)this.pending.push([...this.pen]);this.redraw();}
  }
  redraw():void {
    this.canvas.replaceChildren(svgNode('path',{d:'M128 0V256 M0 128H256',stroke:'#d2c6b6','stroke-width':0.7,'stroke-dasharray':'3 3',fill:'none'}));
    for(const s of [...this.strokes,...(this.pending?[this.pending]:[])])this.canvas.append(svgNode('polyline',{points:s.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#273d38','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round'}));
    if(!this.strokes.length&&!this.pending){const t=svgNode('text',{x:128,y:118,'text-anchor':'middle',fill:'#817c71','font-size':15});t.textContent='在这里写一个字';this.canvas.append(t);}
    if(this.keyboard){this.canvas.append(svgNode('circle',{cx:this.pen[0],cy:this.pen[1],r:5,fill:this.down?'#b45a36':'white',stroke:'#b45a36','stroke-width':1.5}));this.canvas.append(svgNode('path',{d:`M${this.pen[0]-9} ${this.pen[1]}h18 M${this.pen[0]} ${this.pen[1]-9}v18`,stroke:'#b45a36','stroke-width':0.8}));}
    this.canvas.dataset.strokeCount=String(this.strokes.length);this.canvas.dataset.penMode=String(this.keyboard);this.canvas.dataset.penDown=String(this.down);
  }
  destroy():void {this.destroyed=true;this.invalidate();this.worker?.terminate();this.worker=null;this.abort.abort();this.pending=null;this.release();}
}
