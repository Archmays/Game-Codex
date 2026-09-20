import type {Ability} from './model';
/** Rule demonstrations, deliberately separate from room positions and solution order. */
export function demonstration(a:Ability,portrait:string){
 const person=`<img class="demo-person" src="${portrait}" alt="调查员模型">`;
 if(a==='ring')return `<div class="rule-demo ring-demo" aria-label="演示：视线能穿过玻璃，不能穿过实墙"><div class="demo-eye">眼睛</div><div class="demo-ray"></div><div class="demo-glass">玻璃</div><div class="demo-cube"></div><p>看得见，路够宽，才能搬动。</p></div>`;
 if(a==='lamp')return `<div class="rule-demo lamp-demo" aria-label="演示：光转开时，局部通道关闭"><div class="demo-lamp">灯</div><div class="demo-beam"></div><div class="demo-wall"><span></span></div><p>只有照到的一小块能穿过。</p></div>`;
 if(a==='photo')return `<div class="rule-demo photo-demo" aria-label="演示：一人进入照片，再由外部持片人放出"><div class="demo-frame"></div>${person}<div class="demo-holder">外部持片人</div><p>容量一人 · 片中人不能自己出来</p></div>`;
 if(a==='camera')return `<div class="rule-demo camera-demo" aria-label="演示：只把记录范围里的原件恢复"><div class="demo-record"><i></i><i></i><i></i></div>${person}<p>虚线框内恢复，框外不变。</p></div>`;
 return `<div class="rule-demo key-demo" aria-label="演示：门先连接，人物再实际走过去"><div class="demo-door">安全地点</div>${person}<p>有完整的门，才能连接。</p></div>`;
}
