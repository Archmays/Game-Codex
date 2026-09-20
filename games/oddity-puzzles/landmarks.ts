import {layout,position,point,type State,type Vec} from './model';
export interface Landmark {id:string;label:string;icon:string;kind:'item'|'actor'|'node'|'wall'|'info';p:Vec;entity?:string;node?:string;direction?:number}
/** Small UI pictograms; illustrated abilities reuse their shipped model thumbnails. */
export function landmarkIcon(mark:Landmark):string {
 if(mark.entity&&['lamp','photo','ring','camera','key'].includes(mark.entity))return `<img alt="" width="26" height="28" src="./assets/oddity-puzzles/thumb-item_${mark.entity}.png">`;
 const drawing:Record<string,string>={window:'<rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M4 12h16"/>',box:'<path d="m3 7 9-4 9 4v13H3ZM3 7l9 4 9-4M12 11v9M8 5l9 4"/>',tray:'<path d="m3 8 4-4h10l4 4-2 11H5ZM3 8h18M6 14h12"/>',exit:'<path d="M11 3H4v18h7M9 12h12m-5-5 5 5-5 5"/>',door:'<rect x="5" y="2" width="14" height="20"/><path d="M14 12h2M7 20V4h10"/>','info:slot':'<rect x="2" y="6" width="20" height="4"/><path d="m7 15 5-5 5 5M12 11v10"/>','info:gap':'<path d="M2 8h7l-3 5 4 4H2M22 8h-7l3 5-4 4h8"/>'};
 const path=drawing[mark.entity??mark.node??mark.id];return path?`<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">${path}</svg>`:'';
}
export const symbols:Record<string,string>={a:'●',b:'▲',npc:'■',left:'△',right:'◇'};
export const nodeNames:Record<string,string>={exit:'出口',window:'观察窗',outside:'投递口外',friend:'同伴旁空地',release:'托盘旁空地',left:'△ 三角开关旁',right:'◇ 菱形开关旁',box:'档案架',lamp:'台灯旁',tray:'托盘旁',inside:'房间中央',front:'室内门廊',center:'室内中央',start:'调查桌旁',door:'门前',side:'右侧空地',safe:'安全小院','left-rear':'三角侧后通道','right-rear':'菱形侧后通道','gate-in':'门内空地','gate-out':'门外空地'};
export function entityName(s:State,id:string){if(id==='left')return '△ 三角开关';if(id==='right')return '◇ 菱形开关';if(id==='door'&&s.level===2)return s.doorRestored?'完整门':'坏门';return s.items.find(o=>o.id===id)?.label??s.actors.find(a=>a.id===id)?.label??id;}
export function landmarks(s:State,endpoints=false,walls=false,carry=false,expanded=false):Landmark[]{
 const list:Landmark[]=[];
 for(const a of s.actors)if(!a.inside)list.push({id:'actor:'+a.id,kind:'actor',entity:a.id,label:entityName(s,a.id),icon:symbols[a.id],p:position(s,a.id)});
 for(const o of s.items){if(o.holder&&o.id!=='photo')continue;if(endpoints&&o.id!=='photo'&&!(carry&&o.id==='tray'))continue;list.push({id:'item:'+o.id,kind:'item',entity:o.id,label:entityName(s,o.id),icon:({lamp:'☀',box:'▣',photo:'▧',tray:'▱',door:'▥',ring:'◎',left:'',right:''} as Record<string,string>)[o.id]??'▣',p:position(s,o.id)});}
 const transit=s.level===1?['bend','rear']:s.level===3?['rear','left-rear','right-rear']:[];const meaningful=expanded||s.level===2?layout(s).nodes.filter(n=>!transit.includes(n.id)).map(n=>n.id):s.level===1?['exit','window','lamp','box']:['exit','outside','release','center'];
 for(const n of layout(s).nodes){if(n.id==='safe'&&!s.portal||carry&&n.id==='tray')continue;if(!endpoints&&!meaningful.includes(n.id))continue;list.push({id:'node:'+n.id,kind:'node',node:n.id,label:s.level===1&&n.id==='outside'?'通道墙前':nodeNames[n.id]??n.label,icon:endpoints?'⌖':'♧',p:s.level===1&&n.id==='window'?[-3.2,1.8,1]:point(s,n.id)});}
 if(s.level===3)list.push({id:'info:slot',kind:'info',label:'投递口',icon:'▰',p:layout(s).slot!});
 if(s.level===2)list.push({id:'info:gap',kind:'info',label:'断路',icon:'⌁',p:[1.2,0,-2.6]});
 if(walls)for(const [direction,label,p]of [[0,'房间后墙',[-3,1.2,-5.75]],[1,'通道墙',[0,1.2,1]],[2,'左侧墙',[-5.5,1.2,-2]]] as [number,string,Vec][])list.push({id:'wall:'+direction,kind:'wall',label,icon:'☀',direction,p});
 return list;
}
