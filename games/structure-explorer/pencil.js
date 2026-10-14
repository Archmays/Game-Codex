import { createPaper, deposit } from '../../public/structure-explorer/pencil-model.js';
import { createPencil3D } from './pencil-3d';

document.documentElement.dataset.buildCommit = (import.meta.env.VITE_BUILD_COMMIT || 'local-source').trim() || 'local-source';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const svgNS = 'http://www.w3.org/2000/svg';
$('.page').innerHTML = `
<header><h1>没有墨水，铅笔怎样留下黑线？</h1><p class="intro">拆开看，公平地比一比，再追踪黑色去了哪里。</p></header>
<nav class="tabs" aria-label="选择演示"><button class="selected" data-mode="0" aria-pressed="true">1 拆开看</button><button data-mode="1" tabindex="-1" aria-pressed="false">2 比一比</button><button data-mode="2" tabindex="-1" aria-pressed="false">3 擦一擦</button></nav>
<p id="question" class="question">真正写字的是哪部分？外面的木壳又帮了什么忙？</p>
<div class="grid"><section aria-label="铅笔探索台"><div class="card iso-plate">
<div class="figure-head"><span id="scene-title">结构观察台</span><button id="expand-view">扩大查看</button></div>
<div id="stage-home"><div id="stage" class="iso-stage" tabindex="0" role="group" aria-label="铅笔操作区。书写和擦除模式左右键移动，Home到起点，End到终点。结构中选择旋转或平移后拖动，滚轮或双指缩放；方向键旋转，＋／－缩放，Home复位，End拆开。"><div id="structure"><div class="drag-mode-controls" role="group" aria-label="拖动方式"><span>拖动方式</span><button id="drag-rotate" aria-pressed="true">旋转</button><button id="drag-pan" aria-pressed="false">平移</button></div><div id="three-host"></div><p id="cut-caption" class="cut-caption" hidden></p><div id="part-tray" class="part-tray" role="group" aria-label="选择一个部件观察" hidden><button data-inspect-part="paint-upper">上半涂层</button><button data-inspect-part="wood-upper" tabindex="-1">上半木材</button><button data-inspect-part="core" tabindex="-1">笔芯</button><button data-inspect-part="wood-lower" tabindex="-1">下半木材</button><button data-inspect-part="paint-lower" tabindex="-1">下半涂层</button><button data-inspect-part="tip" tabindex="-1">笔尖区域</button></div><p id="model-help" class="small">选择旋转或平移，再拖动 · 滚轮或双指缩放</p><p id="three-error" role="status" hidden>三维画面暂时不可用，请重新载入页面。</p></div>
<div id="contact" hidden><svg id="paper-scene" viewBox="0 0 760 430" role="img" aria-label="铅笔或橡皮沿纸面移动，保留笔迹与橡皮屑。"><defs><pattern id="paper-texture" width="17" height="13" patternUnits="userSpaceOnUse"><path d="M1 5l6 -1m4 6l5 -2" stroke="#bcb9aa" opacity=".17" stroke-width=".7"/></pattern></defs><path d="M48 58H712V367H48Z" fill="#fdfcf7" stroke="#c5c8ba" stroke-width="2"/><path d="M48 58H712V367H48Z" fill="url(#paper-texture)"/><g id="marks"></g><g id="crumbs"></g><g id="tool-pencil"><path d="M-9 -137H9V-22L0 0L-9 -22Z" fill="#e4bd50" stroke="#8a6c2d" stroke-width="1.5"/><path d="M-9 -22H9L0 0Z" fill="#e6c9a2"/><path d="M-3 -7H3L0 0Z" fill="#333b3c"/><path d="M-5 -130V-25" stroke="#ffdf7c" stroke-width="2"/></g><g id="tool-eraser"><path d="M-24 -28H24V0H-24Z" fill="#e9b8b7" stroke="#977372" stroke-width="1.5"/><path d="M-24 -28l8 -7h48l-8 7Z" fill="#f3d0cc"/><path d="M24 -28l8 -7V-7L24 0Z" fill="#bd9090"/></g></svg></div></div></div>
<div class="figure-foot"><span id="hint">拖动观察，点 BOOM 看里面。</span><span id="readout">完整铅笔 · 可自由旋转</span></div></div>
<div class="controls"><div data-for="0" class="structure-controls"><div class="control-row"><button id="boom">BOOM！拆开</button><button id="return-parts" hidden>返回零件排列</button><label for="view">怎么看 <select id="view"><option value="assembled">完整铅笔</option><option value="exploded">BOOM 拆开</option><option value="longitudinal">纵向剖开</option><option value="cross">横向剖开</option></select></label><label for="part">观察部件 <select id="part"><option value="all">整支笔</option><option value="wood-upper">上半木材</option><option value="wood-lower">下半木材</option><option value="core">笔芯</option><option value="paint-upper">上半涂层</option><option value="paint-lower">下半涂层</option><option value="tip">笔尖区域</option></select></label></div></div>
<div id="view-tools-home"><div id="observation-tools"><details><summary>键盘与辅助观察</summary><p class="small">图中方向键旋转，＋／－缩放，Home复位，End拆开，Enter开合，Esc返回单件。也可使用下方控件。</p><div class="view-tools" role="group" aria-label="观察视图"><button id="zoom-in">放大</button><button id="zoom-out">缩小</button><button id="pan-left">向左</button><button id="pan-right">向右</button><button id="pan-up">向上</button><button id="pan-down">向下</button><button id="view-reset">视图复位</button><output id="zoom-readout">1×</output></div><div class="control-row" data-for="0"><button id="turn-left">向左转</button><button id="turn-right">向右转</button><button id="turn-up">向上转</button><button id="turn-down">向下转</button></div></details></div></div>
<div data-for="1" hidden><div class="control-row"><label for="pressure">写字力度 <select id="pressure"><option value="0">轻轻写</option><option value="1" selected>平常力度</option><option value="2">稍重一点</option></select></label><label for="grade">笔芯 <select id="grade"><option>2H</option><option selected>HB</option><option>2B</option></select></label><label for="paper">纸面 <select id="paper"><option value="smooth">较光滑</option><option value="ordinary" selected>普通纸</option><option value="rough">较粗糙</option></select></label></div><p class="small">自由试写：换笔后，已经画好的线会保留。前后移动会再画一遍。</p></div>
<div data-for="2" hidden><button id="seed">先画一条线</button></div><div class="control-row"><label id="position-label" for="position">移动工具 <input id="position" type="range" min="0" max="100" value="0"></label><button id="auto" aria-pressed="false">自动演示</button><button id="reset">换一张纸</button></div></div>
<p id="caption" class="caption">笔芯留下笔迹。木壳让细细的笔芯更方便握住，也受到保护。</p><p id="status" class="status" aria-live="polite">先猜一猜，再打开看看。</p>
</section><aside class="aside" aria-label="观察与解释"><div id="structure-key"><h2 id="part-title">各部分怎样配合？</h2><p id="part-description">涂层在表面，木壳围住笔芯。点 BOOM 拆开，再拿起一个部件转着看。</p><dl class="parts"><dt>涂层</dt><dd>覆盖木材表面。</dd><dt>木壳</dt><dd>方便握住，支撑和保护笔芯。</dd><dt>笔芯</dt><dd>主要由石墨和黏土制成，留下痕迹。</dd></dl><p class="small">“铅笔芯”不是金属铅。两片木材与笔芯粘合。BOOM 是教学拆解；涂层剥离用于看清薄层，并非可拆外壳。</p><details><summary>继续追问：只有笔芯行吗？</summary><p>笔芯本身能留下痕迹。想想没有木壳时，握住它、使用它会有什么不同？</p><p>木壳不负责变黑，却仍然有用。一个物件的部件，常常承担不同的工作。</p></details></div>
<div id="zoom-card" hidden><h2 id="micro-title">纸面发生了什么？</h2><svg id="micro-process" viewBox="0 0 400 280" role="img" aria-label="笔尖或橡皮与纸面接触的分步过程示意"><g id="micro-tip"><path d="M177 10L198 4L234 101L219 109Z" fill="#e5c8a1" stroke="#8c7356"/><path d="M219 109L234 101L239 140Z" fill="#3e4446"/></g><g id="micro-eraser"><path d="M68 36H339V135Q275 142 208 135Q139 142 68 135Z" fill="#e6b6b6" stroke="#755b5b"/><g id="picked"></g></g><g id="fibers"><path d="M18 151Q80 135 140 153T270 153T382 151M18 165Q80 149 140 167T270 167T382 165M18 179Q80 163 140 181T270 181T382 179M18 193Q80 177 140 195T270 195T382 193" fill="none" stroke="#bcad94" stroke-width="2"/></g><g id="micro-particles"></g><g id="moving-particles"></g><text id="micro-label" x="20" y="247">笔尖还没有碰到纸。</text></svg><div class="process-controls"><div class="control-row"><button id="process-prev">上一步</button><button id="process-next">下一步</button></div><label for="process-step">过程 <input id="process-step" type="range" min="0" max="3" value="0"></label></div><p id="process-description" aria-live="polite"></p><p class="small">碎片和纸纤维为放大示意，不按比例，不是显微照片。</p><details><summary>为什么换笔会改变痕迹？</summary><p>笔芯的石墨和黏土配比会影响软硬。较软的笔芯，通常更容易留下较深的痕迹。</p><p>纸面也参与了这个过程：它的凹凸会磨下极细的颗粒。所以比较时，要把其他条件保持相同。</p></details></div></aside></div>
<section id="comparison-lab" class="lab" data-for="1" hidden aria-labelledby="lab-title"><div class="lab-heading"><div><h2 id="lab-title">公平地比一比</h2><p>先猜结果，再让三条线在相同条件下写出来。</p></div><label for="compare-kind">这次改变 <select id="compare-kind"><option value="grade">笔芯：2H、HB、2B</option><option value="pressure">力度：轻、中、重</option><option value="paper">纸面：光滑、普通、粗糙</option><option value="passes">遍数：1、2、3遍</option></select></label></div><p id="compare-conditions"></p><button id="compare-run">按相同条件试写</button><div id="comparison-results" class="comparison-results"><p class="empty-result">你猜哪一条会更深？点“按相同条件试写”，留下三条结果。</p></div><p id="compare-result" aria-live="polite"></p><details><summary>继续追问：2B一定更深吗？</summary><p>如果2H写得重，2B写得轻，还能只看编号判断吗？回到上面的自由试写区，换一个条件试试。</p><p>比较笔芯本身时，我们把力度、纸面和遍数保持一样。否则，几种原因会混在一起。</p></details></section>
<section class="thinking" data-for="2" hidden><h2>黑色消失了吗？</h2><p>把过程移到最后一步：一些碎片留在纸上，一些被橡皮带走。看看橡皮和橡皮屑里发生了什么。</p><details><summary>继续追问：为什么有时擦不干净？</summary><p>纸面、笔芯、橡皮和写字力度都会影响结果。很深的笔迹或纸面上的压痕，可能仍然留下痕迹。</p><p>换成圆珠笔，为什么擦除效果会不同？这里还没有模拟墨水，你可以保留猜想。</p></details></section>
<footer class="exhibit-note"><p>结构与过程是教学示意；笔迹模型用于比较趋势，不是实测数据。每一步都可以用按钮和键盘操作。</p><details><summary>来源与示意说明</summary><p>科学说明依据美国化学会及Faber-Castell公开资料。<a tabindex="0" href="./sources.md" target="_blank" rel="noopener">查看来源与模型边界</a></p><p>原离线作品保留不变，本页是结构探索馆的修订版。不保存使用记录。</p></details></footer>`;
document.body.insertAdjacentHTML('beforeend', '<dialog id="inspector-dialog" aria-labelledby="inspector-title"><header><h2 id="inspector-title">靠近观察</h2><button id="close-inspector">关闭大图</button></header><div id="inspector-stage"></div><div id="inspector-tools"></div><p class="small">选择旋转或平移后拖动；Shift＋左键可临时平移。滚轮或双指缩放，Esc返回。</p><p id="inspector-description" class="small"></p></dialog>');
$('.page').removeAttribute('aria-busy');
const stage = $('#stage'), still = matchMedia('(prefers-reduced-motion: reduce)');
let mode=0,open=0,wantOpen=0,pos=0,target=0,lastPos=0,auto=false,clock=0,raf=0,last=0;
let sceneVisible=true,visible=true,gesture=null;
let marks=createPaper(),pressure=1,grade='HB',paper='ordinary',crumbs=[],processStep=0,localRemoved=0;
let view='assembled',part='all',zoom=1,center=[465,210];
let structure;
const baseBox=()=>[0,0,760,430];
const activeSvg=()=>$('#paper-scene');
const pathAt=t=>[100+t*560,237+26*Math.sin(t*Math.PI*3)];
const markEls=marks.map((_,i)=>{const p=pathAt(i/(marks.length-1)),el=document.createElementNS(svgNS,'ellipse');el.setAttribute('cx',p[0]);el.setAttribute('cy',p[1]);el.setAttribute('rx',2.2);el.setAttribute('ry',4.2);el.setAttribute('fill','#343638');$('#marks').append(el);return el;});
function resetView(){if(mode===0){structure?.reset();return;}const b=baseBox();center=[b[0]+b[2]/2,b[1]+b[3]/2];zoom=1;renderView();}
function renderView(){if(mode===0)return;const b=baseBox(),w=b[2]/zoom,h=b[3]/zoom;center[0]=Math.max(b[0],Math.min(b[0]+b[2],center[0]));center[1]=Math.max(b[1],Math.min(b[1]+b[3],center[1]));activeSvg().setAttribute('viewBox',`${center[0]-w/2} ${center[1]-h/2} ${w} ${h}`);$('#zoom-readout').textContent=`${zoom.toFixed(1).replace('.0','')}×`;$('#zoom-out').disabled=zoom<=1;$('#zoom-in').disabled=zoom>=6;}
function renderParts(){
 const descriptions={all:['各部分怎样配合？','涂层贴在木材表面，两片开槽的木材围住连续笔芯。BOOM 拆开后，点一个部件转着看。'],'paint-upper':['上半涂层：薄薄的表面','涂层附着在木材上，削尖处已经没有涂层。这里把它剥离，仅为看清薄层。'],'paint-lower':['下半涂层：覆盖表面','这是附着在下半木材表面的薄层，不是可以抽出的外壳。'],'wood-upper':['上半木材：看里面的槽','沿着槽观察：它与另一片木材粘合，把细细的笔芯固定、保护起来。'],'wood-lower':['下半木材：托住笔芯','这片木材的槽与上半木材对应，合起来围住笔芯。胶合处是接合边界。'],core:['笔芯：留下痕迹','笔芯主要由石墨和黏土制成，从笔尖一直延伸到笔杆内部。它不是金属铅。'],tip:['笔尖区域：工作的地方','削切露出木材和笔芯尖端。笔尖是这两种材料的工作区域，不是额外装上的零件。']};
 const description=descriptions[part]||descriptions.all;$('#part-title').textContent=description[0];$('#part-description').textContent=description[1];
}
function structureChanged(s){
 $('#drag-rotate').setAttribute('aria-pressed',String(s.dragMode==='rotate'));$('#drag-pan').setAttribute('aria-pressed',String(s.dragMode==='pan'));
 view=s.view;part=s.selected||'all';zoom=s.scale;open=s.exploded?1:0;wantOpen=open;
 $('#view').value=view;$('#part').value=part;$('#zoom-readout').textContent=`${zoom.toFixed(1).replace('.0','')}×`;
 $('#zoom-in').disabled=zoom>=8;$('#zoom-out').disabled=zoom<=.6;
 $('#boom').textContent=s.exploded?'合起来':'BOOM！拆开';$('#return-parts').hidden=!s.selected;
 $('#part-tray').hidden=view!=='exploded'||!!s.selected;
 $('#cut-caption').hidden=!['cross','longitudinal'].includes(view)||!!s.selected;
 $('#cut-caption').textContent=view==='cross'?'上方红色面：从笔杆中间横切。下方截片放大，涂层 → 木材 → 笔芯；接合线把两片木材分开。':'上方红色面：沿笔芯中心纵切。下方半支铅笔露出连续笔芯；削尖处是裸露木材。';
 $('#three-error').hidden=!s.contextLost;$('#readout').textContent=s.selected?`${structure?.names[s.selected]||'部件'} · 单独观察`:view==='cross'?'横向切开 · 截片放大':view==='longitudinal'?'纵向切开 · 看连续笔芯':s.exploded?'五个观察对象 · 点选单件':'完整铅笔 · 可自由旋转';
 renderParts();
}
const writeSteps=['笔尖还没有碰到纸。','笔尖碰到纸面，开始摩擦。','极细的碎片从笔尖留下。','笔尖离开，碎片留在纸上。'];
const eraseSteps=['先看纸上的笔迹。','橡皮碰到有笔迹的纸面。','一些碎片被带到橡皮中。','橡皮离开，部分碎片被带走。'];
function grains(count,y,shift=0){return Array.from({length:count},(_,i)=>`<path d="M${38+i*14+shift} ${y+(i%3)*3}l5 -2 4 4 -6 3Z" fill="#333b3d"/>`).join('');}
function renderProcess(){
  const sample=marks[Math.min(marks.length-1,Math.floor(pos*marks.length))];
  const present=mode===1?processStep>=2:sample>.001||localRemoved>.001;
  const blankSteps=['这里还没有笔迹。','橡皮碰到空白纸。','这里没有石墨可带走。','橡皮离开，纸面仍然空白。'];
  const label=(mode===2?(present?eraseSteps:blankSteps):writeSteps)[processStep];
  $('#process-step').value=processStep;$('#process-prev').disabled=processStep===0;$('#process-next').disabled=processStep===3;
  $('#micro-label').textContent=label;$('#micro-title').textContent=mode===2?'石墨去哪里了？':'纸面发生了什么？';
  $('#micro-tip').style.display=mode===1?'':'none';$('#micro-eraser').style.display=mode===2?'':'none';
  const count=present?Math.max(3,Math.round(Math.max(sample,localRemoved/4)*22)):0;
  $('#micro-particles').innerHTML=grains(mode===2&&processStep>=2?Math.ceil(count*.4):count,145);
  $('#moving-particles').innerHTML=mode===1&&processStep===2?grains(4,126,150):'';
  $('#picked').innerHTML=mode===2&&processStep>=2&&present?grains(Math.ceil(count*.6),120,45):'';
  $('#micro-tip').setAttribute('transform',`translate(${processStep===3?60:0},${processStep===0||processStep===3?-28:0})`);
  $('#micro-eraser').setAttribute('transform',`translate(0,${processStep===0||processStep===3?-26:0})`);
  const detail=mode===1?['先猜黑线来自哪里，再移动笔尖。','纸面看起来平，放大后有凹凸。','摩擦会留下极细的笔芯颗粒。这里用深灰碎片表示其中的石墨。','黑色留在纸面上，就成了笔迹。碎片不是墨水。'][processStep]:['放大图跟随当前工具所在的位置。先画一条线，才有碎片可带走。','橡皮与纸面摩擦，开始带走一部分石墨。','黑色从纸面转移到橡皮和橡皮屑中，线逐渐变淡。','还有一些留在纸上；擦除是转移，石墨没有凭空消失。'][processStep];
  $('#process-description').textContent=mode===2&&!present?['当前位置没有笔迹。点“先画一条线”，可以准备擦除观察。','橡皮可以碰到纸，但空白处没有石墨。','没有石墨可带走，放大图中也不会出现黑色碎片。','擦过空白纸，不会凭空生成笔迹。'][processStep]:detail;
}
function touch(from,to){
  if(mode===0)return;
  const result=deposit(marks,from,to,{grade,pressure,paper},mode===2);localRemoved=result.removed;
  if(mode===2&&result.removed>.01){const lo=Math.floor(Math.min(from,to)*marks.length),hi=Math.min(marks.length-1,Math.ceil(Math.max(from,to)*marks.length));for(let i=lo;i<=hi;i++){if(i%8===0&&!crumbs.some(c=>c.i===i))crumbs.push({i,t:i/(marks.length-1)});}}
  processStep=3;
}
function update(){
  $('#structure').hidden=mode!==0;$('#structure-key').hidden=mode!==0;$('#contact').hidden=mode===0;$('#zoom-card').hidden=mode===0;
  $('#position-label').hidden=mode===0;$('#reset').hidden=mode===0;
  $('#tool-pencil').style.display=mode===1?'':'none';$('#tool-eraser').style.display=mode===2?'':'none';
  const p=pathAt(pos);$('#tool-pencil').setAttribute('transform',`translate(${p[0]},${p[1]}) rotate(-18)`);$('#tool-eraser').setAttribute('transform',`translate(${p[0]},${p[1]})`);
  markEls.forEach((el,i)=>el.setAttribute('opacity',marks[i]));
  $('#crumbs').innerHTML=crumbs.map((c,i)=>{const p=pathAt(c.t);return `<path d="M${p[0]} ${p[1]+18+i%3*3}l4 -1 3 3 -5 2Z" fill="#85807b"/>`;}).join('');
  if(mode!==0)$('#readout').textContent=mode===1?`${grade} · ${['轻轻写','平常力度','稍重一点'][pressure]} · 笔尖走过`:marks[Math.min(marks.length-1,Math.floor(pos*marks.length))]>.001||localRemoved>.001?'线变淡 · 石墨被带走':'空白处 · 没有石墨可带走';
  $('#position').value=Math.round(pos*100);$('#auto').hidden=mode===0;
  $('#auto').textContent=still.matches?'演示这一步':auto?'暂停演示':'自动演示';$('#auto').setAttribute('aria-pressed',String(auto));
  renderView();renderProcess();
}
function tick(now){const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;if(auto&&!still.matches){clock+=dt;if(mode===0)wantOpen=(1-Math.cos(clock*.9))/2;else target=(1-Math.cos(clock*1.5))/2;}const f=still.matches?1:1-Math.exp(-dt/.18);open+=(wantOpen-open)*f;pos+=(target-pos)*f;if(Math.abs(pos-target)<.0001)pos=target;if(Math.abs(open-wantOpen)<.0001)open=wantOpen;if(pos!==lastPos){touch(lastPos,pos);lastPos=pos;}update();raf=visible&&(auto||Math.abs(open-wantOpen)>.0001||Math.abs(pos-target)>.0001)?requestAnimationFrame(tick):0;}
function run(){if(!raf&&visible){last=0;raf=requestAnimationFrame(tick);}}
function take(){auto=false;clock=0;target=pos;wantOpen=open;update();}
function snapshot(){return{marks:[...marks],crumbs:[...crumbs],pos,lastPos,target,processStep,localRemoved};}
function cancelGesture(){if(gesture){({marks,crumbs,pos,lastPos,target,processStep,localRemoved}=gesture.state);if(stage.hasPointerCapture(gesture.id))stage.releasePointerCapture(gesture.id);}gesture=null;target=pos;lastPos=pos;wantOpen=open;update();}
function suspend(){structure?.suspend();cancelGesture();take();if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
function setMode(n){cancelGesture();take();mode=n;structure?.setActive(mode===0);pos=target=lastPos=0;processStep=0;localRemoved=0;$$('[data-mode]').forEach((el,i)=>{el.tabIndex=i===mode?0:-1;el.setAttribute('aria-pressed',String(i===mode));el.classList.toggle('selected',i===mode);});$$('[data-for]').forEach(el=>el.hidden=Number(el.dataset.for)!==mode);$('#question').textContent=['真正写字的是哪部分？外面的木壳又帮了什么忙？','换一支笔，痕迹为什么不同？怎样比才公平？','擦过以后，黑色去了哪里？'][mode];$('#scene-title').textContent=mode===0?'结构观察台':mode===1?'自由试写台':'擦除观察台';$('#caption').textContent=['笔芯留下笔迹。木壳让细细的笔芯更方便握住，也受到保护。','笔尖划过纸面，留下极细的颗粒。下方的比较台，每次只改变一个条件。','橡皮带走一部分石墨，黑线变淡。沿右侧过程，看它去了哪里。'][mode];$('#hint').textContent=mode===0?'选择旋转或平移 · 滚轮或双指缩放 · BOOM 后点选单件':'点击纸面或横向拖动，也可以用移动工具滑条。';$('#status').textContent=['先猜一猜，再打开看看。','先自由试写，或到下方公平地比一比。','先有笔迹，才能看见擦除。'][mode];resetView();update();}
$$('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(Number(el.dataset.mode))));
$('#drag-rotate').addEventListener('click',()=>structure.setDragMode('rotate'));
$('#drag-pan').addEventListener('click',()=>structure.setDragMode('pan'));
$('#boom').addEventListener('click',()=>{take();structure.setView(view==='exploded'?'assembled':'exploded');});
$('#view').addEventListener('change',e=>{take();structure.setView(e.target.value);});
$('#part').addEventListener('change',e=>{take();if(e.target.value==='all'){structure.returnParts();}else selectPiece(e.target.value);});
$$('[data-inspect-part]').forEach(el=>el.addEventListener('click',()=>selectPiece(el.dataset.inspectPart)));
$('#part-tray').addEventListener('keydown',e=>{if(guardedKey(e)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const nodes=$$('[data-inspect-part]'),at=nodes.indexOf(document.activeElement),index=e.key==='Home'?0:e.key==='End'?nodes.length-1:(at+(['ArrowLeft','ArrowUp'].includes(e.key)?nodes.length-1:1))%nodes.length;nodes.forEach((el,i)=>el.tabIndex=i===index?0:-1);nodes[index].focus();});
$('#position').addEventListener('input',e=>{const next=Number(e.target.value)/100;take();target=next;run();});
$('#pressure').addEventListener('change',e=>{take();pressure=Number(e.target.value);update();});$('#grade').addEventListener('change',e=>{take();grade=e.target.value;update();});$('#paper').addEventListener('change',e=>{take();paper=e.target.value;update();});
$('#reset').addEventListener('click',()=>{take();marks.fill(0);crumbs=[];pos=target=lastPos=0;localRemoved=0;processStep=0;$('#status').textContent='自由试写区换好新纸了，比较结果仍然保留。';update();});
$('#seed').addEventListener('click',()=>{take();marks.fill(0);deposit(marks,0,1,{grade:'HB',pressure:1,paper:'ordinary'});crumbs=[];pos=target=lastPos=0;processStep=0;localRemoved=0;$('#status').textContent='有一条笔迹了，试着擦一擦。';update();});
$('#auto').addEventListener('click',()=>{if(still.matches){take();const next=pos>.95?0:1;touch(pos,next);pos=target=lastPos=next;update();return;}else{auto=!auto;clock=0;if(!auto)target=pos;}update();run();});
for(const [id,factor]of [['zoom-in',1.5],['zoom-out',1/1.5]])$('#'+id).addEventListener('click',()=>{suspend();if(mode===0)structure.zoom(factor);else{zoom=Math.max(1,Math.min(6,zoom*factor));renderView();}});
for(const [id,x,y]of [['pan-left',-1,0],['pan-right',1,0],['pan-up',0,-1],['pan-down',0,1]])$('#'+id).addEventListener('click',()=>{suspend();if(mode===0){structure.pan(x*.45,y*.45);return;}const b=baseBox();center[0]+=x*b[2]/zoom*.18;center[1]+=y*b[3]/zoom*.18;renderView();});
$('#view-reset').addEventListener('click',()=>{suspend();resetView();});
const dialog=$('#inspector-dialog'),viewTools=$('#observation-tools');
let inspectorDetailsOpen=false,inspectorOpener=$('#expand-view');
for(const [id,x,y] of [['turn-left',-.2,0],['turn-right',.2,0],['turn-up',0,-.2],['turn-down',0,.2]])$('#'+id).addEventListener('click',()=>structure.turn(x,y));
function expand(){if(!dialog.open){inspectorDetailsOpen=viewTools.querySelector('details').open;inspectorOpener=document.activeElement instanceof HTMLElement?document.activeElement:$('#expand-view');}suspend();$('#inspector-stage').append(stage);$('#inspector-tools').append(viewTools);$('#inspector-tools').prepend($('#return-parts'));if(!dialog.open)dialog.showModal();if(window.parent!==window)window.parent.postMessage({type:'pencil-inspector',open:true},location.origin);$('#close-inspector').focus();}
function selectPiece(id){take();structure.inspect(id);expand();$('#inspector-title').textContent=`${structure.names[id]} · 转着看`;$('#inspector-description').textContent=$('#part-description').textContent;}
$('#expand-view').addEventListener('click',expand);
function closeInspector(){structure.returnParts();dialog.close();}
$('#return-parts').addEventListener('click',closeInspector);
$('#close-inspector').addEventListener('click',closeInspector);
dialog.addEventListener('cancel',()=>structure.returnParts());
dialog.addEventListener('close',()=>{suspend();structure.returnParts();$('#stage-home').append(stage);$('#view-tools-home').append(viewTools);viewTools.querySelector('details').open=inspectorDetailsOpen;$('#boom').after($('#return-parts'));$('#inspector-title').textContent='靠近观察';$('#inspector-description').textContent='';if(window.parent!==window)window.parent.postMessage({type:'pencil-inspector',open:false},location.origin);(inspectorOpener.isConnected?inspectorOpener:$('#expand-view')).focus();});
dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const nodes=[...dialog.querySelectorAll('button:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.tabIndex>=0&&el.checkVisibility());const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
for(const [id,delta]of [['process-prev',-1],['process-next',1]])$('#'+id).addEventListener('click',()=>{suspend();processStep=Math.max(0,Math.min(3,processStep+delta));renderProcess();});
$('#process-step').addEventListener('input',e=>{const next=Number(e.target.value);suspend();processStep=next;renderProcess();});
const comparisonConditions={grade:'只换笔芯；普通纸、平常力度、相同笔尖、相同长度，各写一遍。',pressure:'只换力度；HB、普通纸、相同笔尖、相同长度，各写一遍。',paper:'只换纸面；HB、平常力度、相同笔尖、相同长度，各写一遍。',passes:'只换遍数；HB、普通纸、平常力度、相同笔尖和长度。'};
$('#compare-conditions').textContent=comparisonConditions.grade;
$('#compare-kind').addEventListener('change',()=>{$('#compare-conditions').textContent=comparisonConditions[$('#compare-kind').value];$('#compare-result').textContent='条件已选好。重新试写后，下方才会换成这次的结果。';});
$('#compare-run').addEventListener('click',()=>{
  const kind=$('#compare-kind').value;
  const results=[0,1,2].map(i=>{const settings={grade:kind==='grade'?['2H','HB','2B'][i]:'HB',pressure:kind==='pressure'?i:1,paper:kind==='paper'?['smooth','ordinary','rough'][i]:'ordinary'};const passes=kind==='passes'?i+1:1,m=createPaper();for(let p=0;p<passes;p++)deposit(m,0,1,settings);const density=m.reduce((a,b)=>a+b,0)/m.length;const title=kind==='grade'?settings.grade:kind==='pressure'?['轻','中','重'][i]:kind==='paper'?['光滑','普通','粗糙'][i]:passes+'遍';const particles=Array.from({length:160},(_,j)=>`<ellipse cx="${14+j*1.68}" cy="${44+9*Math.sin(j/159*Math.PI*3)+(j%5-2)*1.4}" rx="1.6" ry="2.5" fill="#303738" opacity="${density*(.72+(j%4)*.09)}"/>`).join('');return `<article data-comparison-row><h3>${title}</h3><svg viewBox="0 0 300 94" role="img" aria-label="${title}的试写结果" data-density="${density}" data-grade="${settings.grade}" data-pressure="${settings.pressure}" data-paper="${settings.paper}" data-passes="${passes}"><path d="M10 30H290M10 62H290" stroke="#d6d9cd" stroke-width=".5"/>${particles}</svg><p>${settings.grade} · ${['轻','中','重'][settings.pressure]}力度 · ${['smooth','ordinary','rough'].indexOf(settings.paper)===0?'光滑':settings.paper==='rough'?'粗糙':'普通'}纸 · ${passes}遍</p></article>`;});
  $('#comparison-results').innerHTML=results.join('');$('#compare-result').textContent={grade:'同样条件下，2H较浅、HB居中、2B较深。再想想：是什么改变了？',pressure:'同一支HB，这次较重的力度留下较深的痕迹。',paper:'同一支笔，较粗糙的纸面磨下更多细颗粒，示意笔迹更深。',passes:'同一支笔反复涂画，留下的颗粒累积，痕迹逐渐变深。'}[kind];
});
function targetAt(e){const svg=activeSvg(),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const local=p.matrixTransform(svg.getScreenCTM().inverse());return Math.max(0,Math.min(1,(local.x-100)/560));}
stage.addEventListener('pointerdown',e=>{if(mode===0||!e.isPrimary||e.button!==0){if(gesture)cancelGesture();return;}take();gesture={id:e.pointerId,state:snapshot(),x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);});
stage.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;if(e.pointerType==='touch'&&Math.abs(e.clientY-gesture.y)>Math.abs(e.clientX-gesture.x)+8){cancelGesture();return;}if(Math.abs(e.clientX-gesture.x)>5){target=targetAt(e);run();}});
stage.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;gesture=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);target=targetAt(e);run();});
stage.addEventListener('pointercancel',()=>{cancelGesture();structure?.cancel();});stage.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
function guardedKey(e){return e.defaultPrevented||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey;}
stage.addEventListener('keydown',e=>{if(e.target!==stage||guardedKey(e))return;if(mode===0){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' ','+','=','-','Escape'].includes(e.key))return;e.preventDefault();if(e.repeat&&!e.key.startsWith('Arrow'))return;take();if(e.key.startsWith('Arrow'))structure.turn(e.key==='ArrowLeft'?-.16:e.key==='ArrowRight'?.16:0,e.key==='ArrowUp'?-.16:e.key==='ArrowDown'?.16:0);else if(e.key==='Home')structure.reset();else if(e.key==='End')structure.setView('exploded');else if(e.key==='+'||e.key==='=')structure.zoom(1.2);else if(e.key==='-')structure.zoom(1/1.2);else if(e.key==='Escape'){if(dialog.open)closeInspector();else structure.returnParts();}else structure.setView(view==='exploded'?'assembled':'exploded');return;}if(!['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(e.key))return;e.preventDefault();if(e.repeat)return;take();target=e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,target+(e.key==='ArrowLeft'?-.1:.1)));run();});
$('.tabs').addEventListener('keydown',e=>{if(guardedKey(e)||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(e.repeat)return;const next=e.key==='Home'?0:e.key==='End'?2:(mode+(e.key==='ArrowLeft'?2:1))%3;setMode(next);$('[data-mode="'+next+'"]').focus();});
// On touch, focus may arrive after pointerup. Pause autoplay without canceling that confirmed tap.
stage.addEventListener('focus',()=>{auto=false;clock=0;update();$('#status').textContent=mode===0?'方向键旋转，＋／－缩放，Home复位，End拆开；Tab可选择部件。':'左右键移动；Home回到起点，End到终点。';});
new IntersectionObserver(es=>{sceneVisible=es.at(-1).isIntersecting;visible=sceneVisible&&!document.hidden;if(!visible)suspend();else run();}).observe(stage);
document.addEventListener('visibilitychange',()=>{visible=sceneVisible&&!document.hidden;if(!visible)suspend();else run();});
window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
window.addEventListener('scroll',()=>{if(gesture)cancelGesture();},{passive:true});window.addEventListener('wheel',()=>{if(gesture)cancelGesture();},{passive:true});
window.addEventListener('message',e=>{if(e.source===window.parent&&e.origin===location.origin&&e.data?.type==='pencil-cancel-input'){if(gesture)cancelGesture();structure?.cancel();}});
still.addEventListener('change',()=>{suspend();update();});
if(window.parent!==window){let sent=0;new ResizeObserver(()=>{const h=Math.ceil($('.page').getBoundingClientRect().height+48);if(h!==sent){sent=h;window.parent.postMessage({type:'pencil-height',height:h},location.origin);}}).observe($('.page'));}
window.pencilDemo={state:()=>({mode,open,pos,auto,marks:[...marks],crumbs:crumbs.length,pressure,grade,paper,view,part,zoom,processStep,structure:structure?.state()}),setMode};
structure=createPencil3D($('#three-host'),structureChanged,selectPiece);
structureChanged(structure.state());renderParts();resetView();update();run();
