import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeToy,fitCamera} from './toy-view';
import type {DeskState} from './chancellor-model';
export const PLACES={granary:'粮仓',bridge:'坏桥',pier:'起点渡口',river:'河村渡口',mountain:'山村',council:'议事桌'};
export type Place=keyof typeof PLACES;
export class ChancellorScene{
 readonly renderer:T.WebGLRenderer;readonly scene=new T.Scene();readonly camera=new T.OrthographicCamera();asset?:T.Group;
 private dead=false;private size={w:1,h:1};private angle=.12;private zoom=1;private ray=new T.Raycaster();private cartHome=new T.Vector3();private boatHome=new T.Vector3();private homes=new Map<string,T.Vector3>();private cargoHomes=new Map<string,T.Vector3>();
 constructor(readonly host:HTMLElement){this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(2,devicePixelRatio));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-hidden','true');this.scene.add(new T.HemisphereLight(0xfff7e6,0x667777,3));const sun=new T.DirectionalLight(0xffefdb,3);sun.position.set(-5,15,8);this.scene.add(sun);}
 async load(){const g=await new GLTFLoader().loadAsync('./assets/world-in-a-box/chancellor/chancellor-desk.glb');if(this.dead){disposeToy(g.scene);return;}this.asset=g.scene;this.scene.add(g.scene);this.cartHome.copy(g.scene.getObjectByName('cart')!.position);this.boatHome.copy(g.scene.getObjectByName('boat')!.position);for(const n of ['engineer','carrier','grainkeeper','chancellor']){const p=g.scene.getObjectByName(n);if(p)this.homes.set(n,p.position.clone());}for(const prefix of ['cartbag','boatbag'])for(let i=0;i<6;i++){const n=prefix+'_'+i,o=g.scene.getObjectByName(n);if(o)this.cargoHomes.set(n,o.position.clone());}this.resize();}
 resize(){this.size={w:Math.max(1,this.host.clientWidth),h:Math.max(1,this.host.clientHeight)};this.renderer.setSize(this.size.w,this.size.h);this.updateCamera();}
 private updateCamera(){const aspect=this.size.w/this.size.h;fitCamera(this.camera,new T.Vector3(0,.4,0),aspect>1.4?6.8:8.5,aspect,this.angle,1.05,this.zoom);}
 turn(n:number){this.angle+=n;this.updateCamera();}setZoom(n:number){this.zoom=T.MathUtils.clamp(this.zoom+n,.8,1.45);this.updateCamera();}home(){this.angle=.12;this.zoom=1;this.updateCamera();}
 point(name:string){const o=this.asset?.getObjectByName('anchor_'+name);if(!o)return{x:0,y:0};const p=o.getWorldPosition(new T.Vector3()).project(this.camera);return{x:(p.x+1)*this.size.w/2,y:(1-p.y)*this.size.h/2};}
 pick(x:number,y:number):Place|null{const r=this.host.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2(2*(x-r.left)/r.width-1,1-2*(y-r.top)/r.height),this.camera);let o:T.Object3D|null=this.ray.intersectObject(this.asset??this.scene,true)[0]?.object??null;while(o){const place=o.userData.place as Place;if(place&&Object.hasOwn(PLACES,place))return place;o=o.parent;}return null;}
 frame(s:DeskState,alpha:number,assembly:string[]=[]){
  if(!this.asset)return;const a=this.asset;for(const [n,p]of this.cargoHomes)a.getObjectByName(n)!.position.copy(p);
  for(const [prefix,n] of [['store',s.warehouse],['cartbag',s.cart],['boatbag',s.boat],['riverbag',s.river],['mountainbag',s.mountain]] as const)for(let i=0;i<6;i++){const o=a.getObjectByName(prefix+'_'+i);if(o)o.visible=i<n;}
  for(let i=0;i<4;i++){const o=a.getObjectByName('bridge_plank_'+i);if(o)o.visible=i<s.bridge;}
  for(const n of ['granary','river_houses','mountain_houses']){const o=a.getObjectByName(n);if(o)o.visible=!assembly.includes(n);}
  const cart=a.getObjectByName('cart')!,boat=a.getObjectByName('boat')!;cart.position.copy(this.cartHome);boat.position.copy(this.boatHome);
  for(const [n,p]of this.homes)a.getObjectByName(n)?.position.copy(p);
  if(s.repair){const e=a.getObjectByName('engineer');if(e){e.position.set(-1.5,.65,1.2);e.rotation.z=Math.sin(alpha*Math.PI*4)*.12;}}
  if(s.active){const boatJob=s.active.job==='boat-river',o=boatJob?boat:cart,start=boatJob?this.boatHome:this.cartHome;
   const end=boatJob?new T.Vector3(.65,start.y,-2.65):new T.Vector3(s.active.job==='cart-mountain'?4.8:3.7,start.y,s.active.job==='cart-mountain'?2.4:-2.5);
   const p=s.active.step===0?0:s.active.step===1?alpha:s.active.step===2?1:1-alpha;
   if(boatJob)o.position.lerpVectors(start,end,p);
   else{const corner=new T.Vector3(2.5,start.y,start.z);if(p<.65)o.position.lerpVectors(start,corner,p/.65);else o.position.lerpVectors(corner,end,(p-.65)/.35);o.rotation.y=p>.65?(s.active.job==='cart-mountain'?.65:-.65):0;}
   const carrier=a.getObjectByName('carrier');if(carrier){carrier.position.copy(o.position).add(new T.Vector3(-.4,.1,.45));carrier.rotation.z=Math.sin(alpha*12)*.05;}
   if(s.active.step===2){a.updateMatrixWorld(true);const n=boatJob?3:6,prefix=boatJob?'boatbag':'cartbag',target=s.active.job==='cart-mountain'?'mountainbag':'riverbag',offset=s.active.job==='cart-mountain'?s.mountain:s.river;
    for(let i=0;i<n;i++){const bag=a.getObjectByName(prefix+'_'+i)!,dest=a.getObjectByName(target+'_'+(offset+i))!;const end=o.worldToLocal(dest.getWorldPosition(new T.Vector3())),home=this.cargoHomes.get(prefix+'_'+i)!;const t=T.MathUtils.clamp((alpha-i*.08)/.55,0,1);bag.position.lerpVectors(home,end,t);bag.position.y+=Math.sin(t*Math.PI)*.45;}
   }
   if(!boatJob)a.traverse(o=>{if(o.name.startsWith('wheel'))o.rotation.z=alpha*Math.PI*2;});
  }
  this.renderer.render(this.scene,this.camera);this.host.dataset.ready='true';
 }
 destroy(){this.dead=true;disposeToy(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
