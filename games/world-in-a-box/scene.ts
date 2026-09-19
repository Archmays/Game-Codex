import * as T from 'three';
import { disposeToy, toyThumbnail } from './toy-view';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { IDS, type Piece, type BoxState, windy } from './model';

export class BoxScene {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera=new T.OrthographicCamera();
  asset?:T.Group;
  angle=.48; pitch=.42; zoom=1;
  pieces=new Map<Piece,T.Object3D>(); slots=new Map<Piece,T.Object3D>();
  private ray=new T.Raycaster(); private size={w:1,h:1}; private wind=0;
  private original=new Map<T.Object3D,T.Quaternion>();
  private land=new Map<Piece,number>(); private catUntil=0; private steamUntil=0;
  private steam:T.Sprite[]=[]; private dead=false;
  constructor(readonly host:HTMLElement){
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.VSMShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.32;
    this.renderer.domElement.setAttribute('aria-hidden','true');host.prepend(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xfff5dc,0x89785e,2.3));
    const sun=new T.DirectionalLight(0xffe2b4,3.1);sun.position.set(-3,7,5);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.blurSamples=8;sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-5;
    sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;sun.shadow.radius=4;this.scene.add(sun);
    const fill=new T.DirectionalLight(0xd5e9ef,1.1);fill.position.set(4,4,-5);this.scene.add(fill);
    const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.14}));floor.rotation.x=-Math.PI/2;floor.position.y=-.13;floor.receiveShadow=true;this.scene.add(floor);
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,249,229,.8)');g.addColorStop(1,'rgba(255,249,229,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    const map=new T.CanvasTexture(c);
    for(let i=0;i<6;i++){const p=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:0}));p.scale.set(.22,.40,1);this.scene.add(p);this.steam.push(p);}
  }
  async load(url='./assets/world-in-a-box/window-breeze.glb'){
    const gltf=await new GLTFLoader().loadAsync(url);
    if(this.dead){this.disposeTree(gltf.scene);return;}
    this.asset=gltf.scene;this.scene.add(this.asset);
    this.asset.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}if(o.name.startsWith('pivot_'))this.original.set(o,o.quaternion.clone());});
    for(const id of IDS){const p=this.asset.getObjectByName('piece_'+id),s=this.asset.getObjectByName('slot_'+id);if(p)this.pieces.set(id,p);if(s)this.slots.set(id,s);}
    this.resize();
  }
  resize(){this.size={w:this.host.clientWidth,h:this.host.clientHeight};this.renderer.setSize(this.size.w,this.size.h);this.updateCamera();}
  updateCamera(){const aspect=this.size.w/this.size.h;const h=Math.max(3.05,3.65/aspect)/this.zoom;this.camera.left=-h*aspect;this.camera.right=h*aspect;this.camera.top=h;this.camera.bottom=-h;this.camera.near=.1;this.camera.far=80;
    this.camera.position.set(Math.sin(this.angle)*10*Math.cos(this.pitch),1.55+Math.sin(this.pitch)*10,Math.cos(this.angle)*10*Math.cos(this.pitch));this.camera.lookAt(0,1.55,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();}
  turn(delta:number){this.angle+=delta;this.updateCamera();}
  tilt(delta:number){this.pitch=T.MathUtils.clamp(this.pitch+delta,.25,.7);this.updateCamera();}
  reset(){this.angle=.48;this.pitch=.42;this.zoom=1;this.updateCamera();}
  setZoom(delta:number){this.zoom=T.MathUtils.clamp(this.zoom+delta,.8,1.35);this.updateCamera();}
  showTarget(id:Piece){this.angle=id==='wind_chime'?Math.PI+.40:.22;this.updateCamera();}
  landPiece(id:Piece){this.land.set(id,performance.now());}
  cancelLanding(id:Piece){this.land.delete(id);const p=this.pieces.get(id),s=this.slots.get(id);if(p&&s)p.position.copy(s.position);}
  react(id:Piece){if(id==='cat')this.catUntil=performance.now()+1800;if(id==='cup')this.steamUntil=performance.now()+2200;}
  frame(s:BoxState,now:number,dt:number){
    if(!this.asset)return;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const windTarget=Number(windy(s)&&!document.hidden);this.wind+=(windTarget-this.wind)*(1-Math.exp(-dt*5));if(Math.abs(this.wind-windTarget)<.003)this.wind=windTarget;
    for(const id of IDS){const p=this.pieces.get(id),slot=this.slots.get(id);if(p){p.visible=s.placed.includes(id);if(slot)p.position.copy(slot.position);const start=this.land.get(id);if(start!==undefined){const t=Math.min(1,(now-start)/320);p.position.y+=(1-t)**3*.35;if(t===1)this.land.delete(id);}}if(slot)slot.visible=!s.placed.includes(id);}
    let shuttersMoving=false;
    for(const [o,q] of this.original){o.quaternion.copy(q);let a=0;
      if(o.name.startsWith('pivot_shutter')){const id=o.name.slice(6) as Piece;const target=s.open.includes(id)?(id==='shutter_left'?1:-1)*1.62:0;const current=Number(o.userData.angle??0);a=current+(target-current)*(1-Math.exp(-dt*12));if(Math.abs(a-target)<.002)a=target;shuttersMoving ||= a!==target;o.userData.angle=a;o.rotateY(a);continue;}
      if(o.name==='pivot_tail')a=now<this.catUntil?Math.sin(now*.009)*.4:0;
      else if(!reduce)a=Math.sin(now*.002+(o.name==='pivot_leaves'?1:0))*this.wind*(o.name==='pivot_pages'?.15:.045);
      o.rotateZ(a);
    }
    const cup=this.pieces.get('cup');
    this.steam.forEach((p,i)=>{const t=(now*.0005+i/6)%1;p.visible=!!cup?.visible&&now<this.steamUntil;if(cup)p.position.copy(cup.position).add(new T.Vector3(Math.sin(t*5+i)*.05,.5+t*.75,0));p.material.opacity=p.visible?Math.sin(t*Math.PI)*.40:0;});
    this.asset.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
    // Observable render completion, separate from the logical open/closed state.
    this.host.dataset.motion=(this.wind===0||reduce)&&!shuttersMoving&&!this.land.size&&now>=this.catUntil&&now>=this.steamUntil?'still':'moving';
  }
  target(id:Piece):{x:number;y:number;visible:boolean}{
    const anchor=this.pieces.get(id)?.visible?this.asset?.getObjectByName('interaction_'+id)??this.asset?.getObjectByName('anchor_'+id):this.asset?.getObjectByName('anchor_'+id);if(!anchor)return{x:0,y:0,visible:false};
    const v=anchor.getWorldPosition(new T.Vector3());const ndc=v.clone().project(this.camera);
    this.ray.setFromCamera(new T.Vector2(ndc.x,ndc.y),this.camera);
    const distance=this.ray.ray.origin.distanceTo(v);
    const meshes:T.Object3D[]=[];this.asset!.traverseVisible(o=>{if(o instanceof T.Mesh)meshes.push(o);});
    const hits=this.ray.intersectObjects(meshes,false);const hit=hits.find(h=>h.distance<distance+.12);
    const owns=(o:T.Object3D|null):boolean=>!!o&&(o.name==='piece_'+id||o.name==='slot_'+id||owns(o.parent));
    const visible=Math.abs(ndc.x)<.91&&Math.abs(ndc.y)<.91&&(!hit||hit.distance>=distance-.08||owns(hit.object));
    return{x:(ndc.x+1)*this.size.w/2,y:(1-ndc.y)*this.size.h/2,visible};
  }
  pick(x:number,y:number):Piece|null{const rect=this.host.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.camera);const meshes:T.Object3D[]=[];this.asset?.traverseVisible(o=>{if(o instanceof T.Mesh)meshes.push(o);});let o:T.Object3D|null=this.ray.intersectObjects(meshes,false)[0]?.object??null;while(o){const match=IDS.find(id=>o!.name==='piece_'+id||o!.name==='slot_'+id);if(match)return match;o=o.parent;}return null;}
  thumbnail(id:Piece,angle=.35):string{
    return toyThumbnail(this.renderer,this.pieces.get(id),this.size,angle);
  }
  private disposeTree(root:T.Object3D){disposeToy(root);}
  destroy(){this.dead=true;this.disposeTree(this.scene);this.steam.forEach(p=>{p.material.map?.dispose();p.material.dispose();});this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
