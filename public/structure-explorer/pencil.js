import { createPaper, deposit } from './pencil-model.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const svgNS = 'http://www.w3.org/2000/svg';
const source = await fetch('./pencil-structure.svg');
if (!source.ok) throw new Error('Pencil structure unavailable');
const original = await source.text();
$('.page').innerHTML = `
<header><h1>没有墨水，铅笔怎样留下黑线？</h1><p class="intro">拆开看，公平地比一比，再追踪黑色去了哪里。</p></header>
<nav class="tabs" aria-label="选择演示"><button class="selected" data-mode="0" aria-pressed="true">1 拆开看</button><button data-mode="1" tabindex="-1" aria-pressed="false">2 比一比</button><button data-mode="2" tabindex="-1" aria-pressed="false">3 擦一擦</button></nav>
<p id="question" class="question">真正写字的是哪部分？外面的木壳又帮了什么忙？</p>
<div class="grid"><section aria-label="铅笔探索台"><div class="card iso-plate">
<div class="figure-head"><span id="scene-title">结构观察台</span><button id="expand-view">扩大查看</button></div>
<div id="stage-home"><div id="stage" class="iso-stage" tabindex="0" role="group" aria-label="铅笔操作区。结构模式左右键开合；书写和擦除模式左右键移动，Home到起点，End到终点。放大与剖面请用下方按钮。"><div id="structure">${original}
<svg id="model-longitudinal" class="iso-svg" viewBox="0 0 900 430" role="img" aria-label="铅笔纵剖面：木材围住连续的笔芯，外侧覆盖涂层。" hidden><defs><pattern id="wood-grain" width="80" height="25" patternUnits="userSpaceOnUse"><path d="M0 10Q35 2 80 10M0 20Q45 12 80 20" fill="none" stroke="#ab825b" stroke-width="1" opacity=".4"/></pattern></defs><g data-section-part="paint"><path d="M180 120H795V132H180L92 199Z" fill="#dfbd56" stroke="#876e29" stroke-width="2"/><path d="M180 288H795V300H180L92 221Z" fill="#dfbd56" stroke="#876e29" stroke-width="2"/></g><g data-section-part="wood"><path d="M180 132H795V203H180L72 210Z" fill="#e8cba5" stroke="#997951" stroke-width="2"/><path d="M180 132H795V203H180Z" fill="url(#wood-grain)"/><path d="M180 217H795V288H180L72 210Z" fill="#e8cba5" stroke="#997951" stroke-width="2"/><path d="M180 217H795V288H180Z" fill="url(#wood-grain)"/></g><path data-section-part="core" d="M180 203H795V217H180L72 210Z" fill="#41464a" stroke="#20282b" stroke-width="2"/><text x="235" y="80">沿着笔杆剖开，看见里面</text><text x="235" y="354">笔芯一直延伸到笔杆内部</text></svg>
<svg id="model-cross" class="iso-svg" viewBox="0 0 900 430" role="img" aria-label="铅笔横剖面：外层薄涂层、木壳与中央笔芯。虚线表示两片木材粘合处。" hidden><path data-section-part="paint" d="M330 70L455 70L518 178L455 286H330L267 178Z" fill="#dfbd56" stroke="#8a6b29" stroke-width="3"/><g data-section-part="wood"><path d="M339 86L446 86L500 178L446 270H339L285 178Z" fill="#e8cba5" stroke="#ac855d" stroke-width="2"/><path d="M285 178H500" stroke="#ac855d" stroke-width="2" stroke-dasharray="7 5"/><circle cx="392" cy="178" r="33" fill="#a07852"/></g><circle data-section-part="core" cx="392" cy="178" r="27" fill="#41464a" stroke="#242a2c" stroke-width="2"/><path d="M465 88L585 58H730M478 233L585 249H730M422 178H585" fill="none" stroke="#53686b" stroke-width="2"/><text x="596" y="45">薄薄的涂层</text><text x="596" y="285">木壳</text><text x="596" y="166">笔芯</text><text x="225" y="358">沿虚线，两片木材粘合在一起</text></svg></div>
<div id="contact" hidden><svg id="paper-scene" viewBox="0 0 760 430" role="img" aria-label="铅笔或橡皮沿纸面移动，保留笔迹与橡皮屑。"><defs><pattern id="paper-texture" width="17" height="13" patternUnits="userSpaceOnUse"><path d="M1 5l6 -1m4 6l5 -2" stroke="#bcb9aa" opacity=".17" stroke-width=".7"/></pattern></defs><path d="M48 58H712V367H48Z" fill="#fdfcf7" stroke="#c5c8ba" stroke-width="2"/><path d="M48 58H712V367H48Z" fill="url(#paper-texture)"/><g id="marks"></g><g id="crumbs"></g><g id="tool-pencil"><path d="M-9 -137H9V-22L0 0L-9 -22Z" fill="#e4bd50" stroke="#8a6c2d" stroke-width="1.5"/><path d="M-9 -22H9L0 0Z" fill="#e6c9a2"/><path d="M-3 -7H3L0 0Z" fill="#333b3c"/><path d="M-5 -130V-25" stroke="#ffdf7c" stroke-width="2"/></g><g id="tool-eraser"><path d="M-24 -28H24V0H-24Z" fill="#e9b8b7" stroke="#977372" stroke-width="1.5"/><path d="M-24 -28l8 -7h48l-8 7Z" fill="#f3d0cc"/><path d="M24 -28l8 -7V-7L24 0Z" fill="#bd9090"/></g></svg></div></div></div>
<div class="figure-foot"><span id="hint">先打开木壳，看看里面。</span><span id="readout">木壳合上 · 笔芯在里面</span></div></div>
<div class="controls"><div data-for="0" class="structure-controls"><div class="control-row"><label for="view">怎么看 <select id="view"><option value="assembled">完整铅笔</option><option value="exploded">拆开看</option><option value="longitudinal">纵向剖开</option><option value="cross">横向剖开</option></select></label><label for="part">观察部位 <select id="part"><option value="all">整支笔</option><option value="paint">涂层</option><option value="wood">木壳</option><option value="core">笔芯</option><option value="tip">笔尖</option></select></label></div><div class="control-row" id="shell-controls"><label for="open">木壳打开程度 <input id="open" type="range" min="0" max="100" value="0"></label><button id="toggle-open">打开／合上</button></div></div>
<div id="view-tools-home"><div class="view-tools" role="group" aria-label="观察视图"><button id="zoom-in">放大</button><button id="zoom-out">缩小</button><button id="pan-left">向左</button><button id="pan-right">向右</button><button id="pan-up">向上</button><button id="pan-down">向下</button><button id="view-reset">视图复位</button><output id="zoom-readout">1×</output></div></div>
<div data-for="1" hidden><div class="control-row"><label for="pressure">写字力度 <select id="pressure"><option value="0">轻轻写</option><option value="1" selected>平常力度</option><option value="2">稍重一点</option></select></label><label for="grade">笔芯 <select id="grade"><option>2H</option><option selected>HB</option><option>2B</option></select></label><label for="paper">纸面 <select id="paper"><option value="smooth">较光滑</option><option value="ordinary" selected>普通纸</option><option value="rough">较粗糙</option></select></label></div><p class="small">自由试写：换笔后，已经画好的线会保留。前后移动会再画一遍。</p></div>
<div data-for="2" hidden><button id="seed">先画一条线</button></div><div class="control-row"><label id="position-label" for="position">移动工具 <input id="position" type="range" min="0" max="100" value="0"></label><button id="auto" aria-pressed="false">自动演示</button><button id="reset">换一张纸</button></div></div>
<p id="caption" class="caption">笔芯留下笔迹。木壳让细细的笔芯更方便握住，也受到保护。</p><p id="status" class="status" aria-live="polite">先猜一猜，再打开看看。</p>
</section><aside class="aside" aria-label="观察与解释"><div id="structure-key"><h2 id="part-title">各部分怎样配合？</h2><p id="part-description">涂层在表面，木壳围住笔芯。选择一个部位，就能靠近观察它。</p><dl class="parts"><dt>涂层</dt><dd>覆盖木材表面。</dd><dt>木壳</dt><dd>方便握住，支撑和保护笔芯。</dd><dt>笔芯</dt><dd>主要由石墨和黏土制成，留下痕迹。</dd></dl><p class="small">“铅笔芯”不是金属铅。拆开图把粘合的木壳分开，帮助看清内部。</p><details><summary>继续追问：只有笔芯行吗？</summary><p>笔芯本身能留下痕迹。想想没有木壳时，握住它、使用它会有什么不同？</p><p>木壳不负责变黑，却仍然有用。一个物件的部件，常常承担不同的工作。</p></details></div>
<div id="zoom-card" hidden><h2 id="micro-title">纸面发生了什么？</h2><svg id="micro-process" viewBox="0 0 400 280" role="img" aria-label="笔尖或橡皮与纸面接触的分步过程示意"><g id="micro-tip"><path d="M177 10L198 4L234 101L219 109Z" fill="#e5c8a1" stroke="#8c7356"/><path d="M219 109L234 101L239 140Z" fill="#3e4446"/></g><g id="micro-eraser"><path d="M68 36H339V135Q275 142 208 135Q139 142 68 135Z" fill="#e6b6b6" stroke="#755b5b"/><g id="picked"></g></g><g id="fibers"><path d="M18 151Q80 135 140 153T270 153T382 151M18 165Q80 149 140 167T270 167T382 165M18 179Q80 163 140 181T270 181T382 179M18 193Q80 177 140 195T270 195T382 193" fill="none" stroke="#bcad94" stroke-width="2"/></g><g id="micro-particles"></g><g id="moving-particles"></g><text id="micro-label" x="20" y="247">笔尖还没有碰到纸。</text></svg><div class="process-controls"><div class="control-row"><button id="process-prev">上一步</button><button id="process-next">下一步</button></div><label for="process-step">过程 <input id="process-step" type="range" min="0" max="3" value="0"></label></div><p id="process-description" aria-live="polite"></p><p class="small">碎片和纸纤维为放大示意，不按比例，不是显微照片。</p><details><summary>为什么换笔会改变痕迹？</summary><p>笔芯的石墨和黏土配比会影响软硬。较软的笔芯，通常更容易留下较深的痕迹。</p><p>纸面也参与了这个过程：它的凹凸会磨下极细的颗粒。所以比较时，要把其他条件保持相同。</p></details></div></aside></div>
<section id="comparison-lab" class="lab" data-for="1" hidden aria-labelledby="lab-title"><div class="lab-heading"><div><h2 id="lab-title">公平地比一比</h2><p>先猜结果，再让三条线在相同条件下写出来。</p></div><label for="compare-kind">这次改变 <select id="compare-kind"><option value="grade">笔芯：2H、HB、2B</option><option value="pressure">力度：轻、中、重</option><option value="paper">纸面：光滑、普通、粗糙</option><option value="passes">遍数：1、2、3遍</option></select></label></div><p id="compare-conditions"></p><button id="compare-run">按相同条件试写</button><div id="comparison-results" class="comparison-results"><p class="empty-result">你猜哪一条会更深？点“按相同条件试写”，留下三条结果。</p></div><p id="compare-result" aria-live="polite"></p><details><summary>继续追问：2B一定更深吗？</summary><p>如果2H写得重，2B写得轻，还能只看编号判断吗？回到上面的自由试写区，换一个条件试试。</p><p>比较笔芯本身时，我们把力度、纸面和遍数保持一样。否则，几种原因会混在一起。</p></details></section>
<section class="thinking" data-for="2" hidden><h2>黑色消失了吗？</h2><p>把过程移到最后一步：一些碎片留在纸上，一些被橡皮带走。看看橡皮和橡皮屑里发生了什么。</p><details><summary>继续追问：为什么有时擦不干净？</summary><p>纸面、笔芯、橡皮和写字力度都会影响结果。很深的笔迹或纸面上的压痕，可能仍然留下痕迹。</p><p>换成圆珠笔，为什么擦除效果会不同？这里还没有模拟墨水，你可以保留猜想。</p></details></section>
<footer class="exhibit-note"><p>结构与过程是教学示意；笔迹模型用于比较趋势，不是实测数据。每一步都可以用按钮和键盘操作。</p><details><summary>来源与示意说明</summary><p>科学说明依据美国化学会及Faber-Castell公开资料。<a tabindex="0" href="./sources.md" target="_blank" rel="noopener">查看来源与模型边界</a></p><p>原离线作品保留不变，本页是结构探索馆的修订版。不保存使用记录。</p></details></footer>`;
document.body.insertAdjacentHTML('beforeend', '<dialog id="inspector-dialog" aria-labelledby="inspector-title"><header><h2 id="inspector-title">靠近观察</h2><button id="close-inspector">关闭大图</button></header><div id="inspector-stage"></div><div id="inspector-tools"></div><p class="small">用放大和移动按钮查看细节。按Esc返回。</p></dialog>');
$('.page').removeAttribute('aria-busy');
const model = $('#structure > svg'); model.id = 'model-structure';
model.setAttribute('viewBox','140 30 650 360');
const stage = $('#stage'), still = matchMedia('(prefers-reduced-motion: reduce)');
let mode=0,open=0,wantOpen=0,pos=0,target=0,lastPos=0,auto=false,clock=0,raf=0,last=0;
let sceneVisible=true,visible=true,gesture=null;
let marks=createPaper(),pressure=1,grade='HB',paper='ordinary',crumbs=[],processStep=0,localRemoved=0;
let view='assembled',part='all',zoom=1,center=[465,210];
const baseBox=()=>mode!==0?[0,0,760,430]:['cross','longitudinal'].includes(view)?[0,0,900,430]:[140,30,650,360];
const activeSvg=()=>mode!==0?$('#paper-scene'):view==='cross'?$('#model-cross'):view==='longitudinal'?$('#model-longitudinal'):model;
const pathAt=t=>[100+t*560,237+26*Math.sin(t*Math.PI*3)];
const markEls=marks.map((_,i)=>{const p=pathAt(i/(marks.length-1)),el=document.createElementNS(svgNS,'ellipse');el.setAttribute('cx',p[0]);el.setAttribute('cy',p[1]);el.setAttribute('rx',2.2);el.setAttribute('ry',4.2);el.setAttribute('fill','#343638');$('#marks').append(el);return el;});
function resetView(){const b=baseBox();center=[b[0]+b[2]/2,b[1]+b[3]/2];zoom=1;renderView();}
function renderView(){const b=baseBox(),w=b[2]/zoom,h=b[3]/zoom;center[0]=Math.max(b[0],Math.min(b[0]+b[2],center[0]));center[1]=Math.max(b[1],Math.min(b[1]+b[3],center[1]));activeSvg().setAttribute('viewBox',`${center[0]-w/2} ${center[1]-h/2} ${w} ${h}`);$('#zoom-readout').textContent=`${zoom.toFixed(1).replace('.0','')}×`;$('#zoom-out').disabled=zoom<=1;$('#zoom-in').disabled=zoom>=6;}
function focusPart(){
  if(part==='all'){resetView();return;}
  const b=baseBox();
  if(view==='cross'){center=[392,178];zoom=part==='core'?4:2.2;}
  else if(view==='longitudinal'){center=part==='tip'?[145,210]:[480,210];zoom=part==='tip'?4:1.4;}
  else {
    const selected=[...model.querySelectorAll('.iso-solid')].filter(el=>el.style.opacity==='1');
    const points=selected.flatMap(el=>{const box=el.getBBox(),matrix=model.getScreenCTM().inverse().multiply(el.getScreenCTM());return [[box.x,box.y],[box.x+box.width,box.y+box.height]].map(([x,y])=>{const p=model.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(matrix);});});
    if(points.length){const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(...points.map(p=>p.x))-x,h=Math.max(...points.map(p=>p.y))-y;center=[x+w/2,y+h/2];zoom=Math.max(1,Math.min(6,b[2]/Math.max(40,w*1.35),b[3]/Math.max(40,h*1.35)));}
  }
  center[0]=Math.max(b[0],Math.min(b[0]+b[2],center[0]));renderView();
}
function renderParts(){
  const descriptions={all:['各部分怎样配合？','涂层在表面，木壳围住笔芯。选择一个部位，就能靠近观察它。'],paint:['涂层：覆盖表面','薄薄的涂层在木材外面。换到横剖面，看看它与木壳的位置关系。'],wood:['木壳：握持与保护','两片开槽的木材围住笔芯并粘合。它让细细的笔芯更好握，也支撑和保护笔芯。'],core:['笔芯：留下痕迹','笔芯主要有石墨和黏土。它藏在木壳里，一直延伸到笔杆内部。'],tip:['笔尖：工作的地方','削掉周围的木材，露出笔芯尖端。下一站，靠近看它怎样与纸面接触。']};
  $('#part-title').textContent=descriptions[part][0];$('#part-description').textContent=descriptions[part][1];
  model.querySelectorAll('.iso-solid').forEach(el=>{const selected=part==='all'||(part==='core'?el.classList.contains('graphite'):part==='tip'?!!el.closest('[data-part="pencil.point"],[data-part="pencil.shaved"]'):el.classList.contains(part));el.style.opacity=selected?'1':'.26';});
  $$('[data-section-part]').forEach(el=>{el.style.opacity=part==='all'||el.dataset.sectionPart===part?'1':'.3';});
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
  model.querySelectorAll('[data-piece="shell"]').forEach(el=>el.setAttribute('transform',`translate(0,${-open*93})`));
  $('#structure').hidden=mode!==0;$('#structure-key').hidden=mode!==0;$('#contact').hidden=mode===0;$('#zoom-card').hidden=mode===0;
  model.toggleAttribute('hidden',['cross','longitudinal'].includes(view));$('#model-cross').toggleAttribute('hidden',view!=='cross');$('#model-longitudinal').toggleAttribute('hidden',view!=='longitudinal');
  $('#shell-controls').hidden=['cross','longitudinal'].includes(view);
  $('#position-label').hidden=mode===0;$('#reset').hidden=mode===0;
  $('#tool-pencil').style.display=mode===1?'':'none';$('#tool-eraser').style.display=mode===2?'':'none';
  const p=pathAt(pos);$('#tool-pencil').setAttribute('transform',`translate(${p[0]},${p[1]}) rotate(-18)`);$('#tool-eraser').setAttribute('transform',`translate(${p[0]},${p[1]})`);
  markEls.forEach((el,i)=>el.setAttribute('opacity',marks[i]));
  $('#crumbs').innerHTML=crumbs.map((c,i)=>{const p=pathAt(c.t);return `<path d="M${p[0]} ${p[1]+18+i%3*3}l4 -1 3 3 -5 2Z" fill="#85807b"/>`;}).join('');
  $('#readout').textContent=mode===0?(['cross','longitudinal'].includes(view)?view==='cross'?'横切一片 · 看位置关系':'纵向剖开 · 看笔芯延伸':open>.98?'木壳打开 · 笔芯露出来':open<.02?'木壳合上 · 笔芯在里面':'正在打开木壳'):mode===1?`${grade} · ${['轻轻写','平常力度','稍重一点'][pressure]} · 笔尖走过`:marks[Math.min(marks.length-1,Math.floor(pos*marks.length))]>.001||localRemoved>.001?'线变淡 · 石墨被带走':'空白处 · 没有石墨可带走';
  $('#position').value=Math.round(pos*100);$('#open').value=Math.round(open*100);$('#view').value=view;$('#part').value=part;
  $('#auto').textContent=still.matches?'演示这一步':auto?'暂停演示':'自动演示';$('#auto').setAttribute('aria-pressed',String(auto));
  renderView();renderProcess();
}
function tick(now){const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;if(auto&&!still.matches){clock+=dt;if(mode===0)wantOpen=(1-Math.cos(clock*.9))/2;else target=(1-Math.cos(clock*1.5))/2;}const f=still.matches?1:1-Math.exp(-dt/.18);open+=(wantOpen-open)*f;pos+=(target-pos)*f;if(Math.abs(pos-target)<.0001)pos=target;if(Math.abs(open-wantOpen)<.0001)open=wantOpen;if(pos!==lastPos){touch(lastPos,pos);lastPos=pos;}update();raf=visible&&(auto||Math.abs(open-wantOpen)>.0001||Math.abs(pos-target)>.0001)?requestAnimationFrame(tick):0;}
function run(){if(!raf&&visible){last=0;raf=requestAnimationFrame(tick);}}
function take(){auto=false;clock=0;target=pos;wantOpen=open;update();}
function snapshot(){return{marks:[...marks],crumbs:[...crumbs],pos,lastPos,target,processStep,localRemoved};}
function cancelGesture(){if(gesture){({marks,crumbs,pos,lastPos,target,processStep,localRemoved}=gesture.state);if(stage.hasPointerCapture(gesture.id))stage.releasePointerCapture(gesture.id);}gesture=null;target=pos;lastPos=pos;wantOpen=open;update();}
function suspend(){cancelGesture();take();if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
function setMode(n){cancelGesture();take();mode=n;pos=target=lastPos=0;processStep=0;localRemoved=0;$$('[data-mode]').forEach((el,i)=>{el.tabIndex=i===mode?0:-1;el.setAttribute('aria-pressed',String(i===mode));el.classList.toggle('selected',i===mode);});$$('[data-for]').forEach(el=>el.hidden=Number(el.dataset.for)!==mode);$('#question').textContent=['真正写字的是哪部分？外面的木壳又帮了什么忙？','换一支笔，痕迹为什么不同？怎样比才公平？','擦过以后，黑色去了哪里？'][mode];$('#scene-title').textContent=mode===0?'结构观察台':mode===1?'自由试写台':'擦除观察台';$('#caption').textContent=['笔芯留下笔迹。木壳让细细的笔芯更方便握住，也受到保护。','笔尖划过纸面，留下极细的颗粒。下方的比较台，每次只改变一个条件。','橡皮带走一部分石墨，黑线变淡。沿右侧过程，看它去了哪里。'][mode];$('#hint').textContent=mode===0?'选择剖面或部位，靠近观察。':'点击纸面或横向拖动，也可以用移动工具滑条。';$('#status').textContent=['先猜一猜，再打开看看。','先自由试写，或到下方公平地比一比。','先有笔迹，才能看见擦除。'][mode];resetView();update();}
$$('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(Number(el.dataset.mode))));
$('#open').addEventListener('input',e=>{const next=Number(e.target.value)/100;take();view=next?'exploded':'assembled';wantOpen=next;run();});
$('#toggle-open').addEventListener('click',()=>{const next=wantOpen>.5?0:1;take();view=next?'exploded':'assembled';wantOpen=next;run();});
$('#view').addEventListener('change',e=>{const next=e.target.value;take();view=next;wantOpen=view==='exploded'?1:0;part='all';renderParts();resetView();update();run();});
$('#part').addEventListener('change',e=>{const next=e.target.value;take();part=next;if(part==='tip'||view==='assembled'&&part!=='all'){view='exploded';open=wantOpen=1;}renderParts();update();focusPart();});
model.addEventListener('click',e=>{const solid=e.target.closest('.iso-solid');if(!solid)return;const next=solid.closest('[data-part="pencil.point"],[data-part="pencil.shaved"]')?'tip':solid.classList.contains('graphite')?'core':solid.classList.contains('wood')?'wood':solid.classList.contains('paint')?'paint':null;if(!next)return;take();part=next;view='exploded';open=wantOpen=1;update();renderParts();focusPart();});
for(const section of [$('#model-cross'),$('#model-longitudinal')])section.addEventListener('click',e=>{const hit=e.target.closest('[data-section-part]');if(!hit)return;take();part=hit.dataset.sectionPart;renderParts();focusPart();update();});
$('#position').addEventListener('input',e=>{const next=Number(e.target.value)/100;take();target=next;run();});
$('#pressure').addEventListener('change',e=>{take();pressure=Number(e.target.value);update();});$('#grade').addEventListener('change',e=>{take();grade=e.target.value;update();});$('#paper').addEventListener('change',e=>{take();paper=e.target.value;update();});
$('#reset').addEventListener('click',()=>{take();marks.fill(0);crumbs=[];pos=target=lastPos=0;localRemoved=0;processStep=0;$('#status').textContent='自由试写区换好新纸了，比较结果仍然保留。';update();});
$('#seed').addEventListener('click',()=>{take();marks.fill(0);deposit(marks,0,1,{grade:'HB',pressure:1,paper:'ordinary'});crumbs=[];pos=target=lastPos=0;processStep=0;localRemoved=0;$('#status').textContent='有一条笔迹了，试着擦一擦。';update();});
$('#auto').addEventListener('click',()=>{if(still.matches){take();if(mode===0){view='exploded';wantOpen=1;}else target=pos>.95?0:1;}else{auto=!auto;clock=0;}update();run();});
for(const [id,factor]of [['zoom-in',1.5],['zoom-out',1/1.5]])$('#'+id).addEventListener('click',()=>{suspend();zoom=Math.max(1,Math.min(6,zoom*factor));renderView();});
for(const [id,x,y]of [['pan-left',-1,0],['pan-right',1,0],['pan-up',0,-1],['pan-down',0,1]])$('#'+id).addEventListener('click',()=>{suspend();const b=baseBox();center[0]+=x*b[2]/zoom*.18;center[1]+=y*b[3]/zoom*.18;renderView();});
$('#view-reset').addEventListener('click',()=>{suspend();resetView();});
const dialog=$('#inspector-dialog'),viewTools=$('.view-tools');
$('#expand-view').addEventListener('click',()=>{suspend();$('#inspector-stage').append(stage);$('#inspector-tools').append(viewTools);dialog.showModal();if(window.parent!==window)window.parent.postMessage({type:'pencil-inspector',open:true},location.origin);$('#close-inspector').focus();});
$('#close-inspector').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{suspend();$('#stage-home').append(stage);$('#view-tools-home').append(viewTools);if(window.parent!==window)window.parent.postMessage({type:'pencil-inspector',open:false},location.origin);$('#expand-view').focus();});
dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const nodes=[...dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
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
stage.addEventListener('pointercancel',cancelGesture);stage.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
function guardedKey(e){return e.defaultPrevented||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey;}
stage.addEventListener('keydown',e=>{if(guardedKey(e)||!['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(e.key))return;e.preventDefault();if(e.repeat)return;take();if(mode===0){view='exploded';wantOpen=e.key==='Home'||e.key==='ArrowLeft'?0:e.key==='End'||e.key==='ArrowRight'?1:1-wantOpen;}else target=e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,target+(e.key==='ArrowLeft'?-.1:.1)));run();});
$('.tabs').addEventListener('keydown',e=>{if(guardedKey(e)||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(e.repeat)return;const next=e.key==='Home'?0:e.key==='End'?2:(mode+(e.key==='ArrowLeft'?2:1))%3;setMode(next);$('[data-mode="'+next+'"]').focus();});
// On touch, focus may arrive after pointerup. Pause autoplay without canceling that confirmed tap.
stage.addEventListener('focus',()=>{auto=false;clock=0;update();$('#status').textContent=mode===0?'用方向键开合，或用下方按钮放大、选择剖面。':'左右键移动；Home回到起点，End到终点。';});
new IntersectionObserver(es=>{sceneVisible=es.at(-1).isIntersecting;visible=sceneVisible&&!document.hidden;if(!visible)suspend();else run();}).observe(stage);
document.addEventListener('visibilitychange',()=>{visible=sceneVisible&&!document.hidden;if(!visible)suspend();else run();});
window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
window.addEventListener('scroll',()=>{if(gesture)cancelGesture();},{passive:true});window.addEventListener('wheel',()=>{if(gesture)cancelGesture();},{passive:true});
window.addEventListener('message',e=>{if(e.source===window.parent&&e.origin===location.origin&&e.data?.type==='pencil-cancel-input'&&gesture)cancelGesture();});
still.addEventListener('change',()=>{suspend();update();});
if(window.parent!==window){let sent=0;new ResizeObserver(()=>{const h=Math.ceil($('.page').getBoundingClientRect().height+48);if(h!==sent){sent=h;window.parent.postMessage({type:'pencil-height',height:h},location.origin);}}).observe($('.page'));}
window.pencilDemo={state:()=>({mode,open,pos,auto,marks:[...marks],crumbs:crumbs.length,pressure,grade,paper,view,part,zoom,processStep}),setMode};
renderParts();resetView();update();run();
