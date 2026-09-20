import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CITY_IDS,regionOf,type CityPiece,type CityState,type CityMotion,type Routes } from './dresden-model';
import { disposeToy,toyThumbnail,fitCamera } from './toy-view';
export class DresdenScene{
  readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly renderer:T.WebGLRenderer;readonly scene=new T.Scene();readonly camera=new T.OrthographicCamera();asset?:T.Group;
  pieces=new Map<CityPiece,T.Object3D>();slots=new Map<CityPiece,T.Object3D>();routes!:Routes;
  private homes=new Map<T.Object3D,T.Vector3>();private viewHalves=new Map<string,number>();private land=new Map<CityPiece,number>();private dead=false;private size={w:1,h:1};private ray=new T.Raycaster();
  private center=new T.Vector3();private half=12;angle=.27;pitch=.88;zoom=1;view='all';private sectionAmount=0;private paddle=0;private boatNorth=4;private lightingNight:boolean|undefined;private windowMaterials=new Set<T.MeshStandardMaterial>();
  private ambient=new T.HemisphereLight(0xfff4de,0x72674f,2.7);private sun=new T.DirectionalLight(0xffe4bf,3.4);private fill=new T.DirectionalLight(0xd8edfa,1.2);
  constructor(readonly host:HTMLElement){
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;
    this.renderer.domElement.setAttribute('aria-hidden','true');host.append(this.renderer.domElement);this.sun.position.set(-10,20,8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,far:70});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.0001;this.fill.position.set(10,8,-10);this.scene.add(this.ambient,this.sun,this.fill);
    const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;this.scene.add(ground);
  }
  async load(url='./assets/world-in-a-box/dresden/dresden-river-campus.glb'){
    const gltf=await new GLTFLoader().loadAsync(url);if(this.dead){disposeToy(gltf.scene);return;}
    this.asset=gltf.scene;this.scene.add(this.asset);this.asset.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&/windows|glass/i.test(m.name))this.windowMaterials.add(m);}if(o.name==='pivot_library_cover')this.homes.set(o,o.position.clone());});
    for(const id of CITY_IDS){const p=this.asset.getObjectByName('piece_'+id),s=this.asset.getObjectByName('slot_'+id);if(p){this.pieces.set(id,p);this.homes.set(p,p.position.clone());}if(s)this.slots.set(id,s);}
    const t=this.asset.getObjectByName('tram_route')!.userData,b=this.asset.getObjectByName('boat_route')!.userData;
    this.routes={tramStart:this.homes.get(this.pieces.get('yellow_tram')!)?.z===undefined?.4:-this.homes.get(this.pieces.get('yellow_tram')!)!.z,tramStops:{north:t.points[t.stops.north][1],oldtown:t.points[t.stops.oldtown][1],campus:t.points[t.stops.campus][1]},bridge:t.bridgeLimits,boatStart:b.points[0][0],boatEnd:b.points[1][0],berth:{x:b.berth[0],north:b.berth[1]}};
    // Fit authored camera targets to the exported geometry, before pieces begin moving.
    for(const view of ['all','river','oldtown','campus','street','library']){
      const bounds=new T.Box3();if(view==='all')bounds.setFromObject(this.asset);else for(const [id,piece] of this.pieces)if(view==='library'?id.startsWith('slub_'):regionOf(id)===view)bounds.union(new T.Box3().setFromObject(piece));
      const extent=bounds.getSize(new T.Vector3());this.viewHalves.set(view,Math.max(view==='library'?3.4:6.8,Math.max(extent.x,extent.y,extent.z)*(view==='all'?.54:.6)));
    }
    this.resize();this.go('all');
  }
  resize(){this.size={w:this.host.clientWidth,h:this.host.clientHeight};this.renderer.setSize(this.size.w,this.size.h);this.updateCamera();}
  updateCamera(){fitCamera(this.camera,this.center,this.half,this.size.w/this.size.h,this.angle,this.pitch,this.zoom);this.host.dataset.camera=JSON.stringify({angle:this.angle,pitch:this.pitch,zoom:this.zoom,view:this.view,center:this.center.toArray(),half:this.half});}
  go(view:string){this.view=view;this.angle=view==='river'?1.05:.18;this.pitch=view==='river'?.68:view==='all'?.92:1.05;this.zoom=1;const p=this.asset?.getObjectByName('camera_'+view);if(p)p.getWorldPosition(this.center);this.half=this.viewHalves.get(view)??10.8;this.updateCamera();}
  turn(n:number){this.angle+=n;this.updateCamera();}tilt(n:number){this.pitch=T.MathUtils.clamp(this.pitch+n,.35,1.42);this.updateCamera();}setZoom(n:number){this.zoom=T.MathUtils.clamp(this.zoom+n,.75,1.8);this.updateCamera();}
  showTarget(id:CityPiece,usable:()=>boolean=()=>this.target(id).visible){
    this.go(regionOf(id));const anchor=this.asset?.getObjectByName('anchor_'+id);if(anchor)anchor.getWorldPosition(this.center);this.half=regionOf(id)==='river'?6.2:4.7;
    for(const pitch of [1.18,.85,.5,1.4])for(const angle of [Math.PI+.12,.18,Math.PI/2,-Math.PI/2]){this.pitch=pitch;this.angle=angle;this.updateCamera();this.asset?.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);if(this.target(id).visible&&usable())return true;}
    return false;
  }
  resetMotion(){this.pausedAt=null;this.land.clear();this.sectionAmount=0;this.paddle=0;this.boatNorth=4;for(const id of CITY_IDS)this.cancelLanding(id);}
  pick(x:number,y:number):CityPiece|null{
    const rect=this.host.getBoundingClientRect();if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return null;
    this.asset?.updateMatrixWorld(true);this.ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.camera);
    const meshes:T.Object3D[]=[];this.asset?.traverseVisible(o=>{if(o instanceof T.Mesh)meshes.push(o);});let o:T.Object3D|null=this.ray.intersectObjects(meshes,false)[0]?.object??null;
    while(o){const id=CITY_IDS.find(id=>o!.name==='slot_'+id||o!.name==='piece_'+id);if(id)return id;o=o.parent;}return null;
  }
  snapshot(){return{center:this.center.clone(),half:this.half,angle:this.angle,pitch:this.pitch,zoom:this.zoom,view:this.view};}
  restore(s:ReturnType<DresdenScene['snapshot']>){this.center.copy(s.center);this.half=s.half;this.angle=s.angle;this.pitch=s.pitch;this.zoom=s.zoom;this.view=s.view;this.updateCamera();}
  landPiece(id:CityPiece){this.land.set(id,performance.now()-(this.reducedMotion?320:0));}cancelLanding(id:CityPiece){this.land.delete(id);const p=this.pieces.get(id);if(p)p.position.copy(this.homes.get(p)!);}
  private pausedAt:number|null=null;
  frame(s:CityState,m:CityMotion,now:number,dt:number,paused=false){
    if(!this.asset)return;
    if(paused){this.pausedAt??=now;now=this.pausedAt;dt=0;}else{if(this.pausedAt!==null){const elapsed=now-this.pausedAt;for(const [id,start] of this.land)this.land.set(id,start+elapsed);this.pausedAt=null;}}
    for(const id of CITY_IDS){const p=this.pieces.get(id),slot=this.slots.get(id),placed=s.placed.includes(id);if(p){p.visible=placed;const start=this.land.get(id);if(start!==undefined){const t=Math.min(1,(now-start)/320);p.position.copy(this.homes.get(p)!);p.position.y+=(1-t)**3*.7;if(t===1)this.land.delete(id);}}if(slot)slot.visible=!placed;}
    const tram=this.pieces.get('yellow_tram'),boat=this.pieces.get('paddle_steamer');
    if(tram&&!this.land.has('yellow_tram')){tram.position.z=-m.tram.position;tram.rotation.y=m.tram.direction>=0?0:Math.PI;}
    if(boat&&!this.land.has('paddle_steamer')){boat.position.x=m.boat.position;this.boatNorth=m.boatNorth;boat.position.z=-m.boatNorth;boat.rotation.y=m.boat.direction>=0?0:Math.PI;this.paddle-=dt*m.boatSpeed*4.6;}
    for(const side of ['port','starboard']){const p=this.asset.getObjectByName('pivot_paddle_'+side);if(p)p.rotation.z=this.paddle;}
    const amount=Number(m.section);this.sectionAmount+=(amount-this.sectionAmount)*(this.reducedMotion?1:1-Math.exp(-Math.min(.05,dt)*12));if(Math.abs(amount-this.sectionAmount)<.002)this.sectionAmount=amount;
    const cover=this.asset.getObjectByName('pivot_library_cover')!,sky=this.pieces.get('slub_skylight');cover.position.copy(this.homes.get(cover)!).add(new T.Vector3(-2.7*this.sectionAmount,1.4*this.sectionAmount,0));cover.visible=this.sectionAmount<.98;
    if(sky&&!this.land.has('slub_skylight')){sky.position.copy(this.homes.get(sky)!).add(new T.Vector3(0,1.2*this.sectionAmount,-1.4*this.sectionAmount));sky.rotation.x=-1.15*this.sectionAmount;}
    this.ambient.intensity=s.night?1.1:1.8;this.sun.intensity=s.night?.6:2.3;this.fill.intensity=s.night?1.8:.8;this.renderer.setClearColor(s.night?0x182e3a:0xf1eadb,1);
    if(this.lightingNight!==s.night){this.lightingNight=s.night;for(const mat of this.windowMaterials){mat.emissive.set(s.night?0xf6b64e:0x000000);mat.emissiveIntensity=s.night?.45:0;}}
    if(m.follow){const p=m.follow==='tram'?tram:boat;if(p){p.getWorldPosition(this.center);this.half=4.6;this.updateCamera();}}
    this.asset.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);this.host.dataset.camera=JSON.stringify({angle:this.angle,pitch:this.pitch,zoom:this.zoom,view:this.view,center:this.center.toArray(),half:this.half});this.host.dataset.motion=this.land.size||m.tram.running||m.boat.running||this.sectionAmount!==amount?'moving':'still';
    this.host.dataset.tram=tram?.position.toArray().join(',');this.host.dataset.boat=boat?.position.toArray().join(',');this.host.dataset.section=String(this.sectionAmount);this.host.dataset.calls=String(this.renderer.info.render.calls);this.host.dataset.triangles=String(this.renderer.info.render.triangles);
  }
  target(id:CityPiece){
    const anchor=this.asset?.getObjectByName((this.pieces.get(id)?.visible?'interaction_':'anchor_')+id);if(!anchor)return{x:0,y:0,visible:false};
    const p=anchor.getWorldPosition(new T.Vector3()),ndc=p.clone().project(this.camera);this.ray.setFromCamera(new T.Vector2(ndc.x,ndc.y),this.camera);
    const distance=this.ray.ray.origin.distanceTo(p),meshes:T.Object3D[]=[];this.asset!.traverseVisible(o=>{if(o instanceof T.Mesh)meshes.push(o);});const first=this.ray.intersectObjects(meshes,false)[0];
    const owns=(o:T.Object3D|null):boolean=>!!o&&(o.name==='piece_'+id||o.name==='slot_'+id||owns(o.parent));
    const inFrame=Math.abs(ndc.x)<.9&&Math.abs(ndc.y)<.84,clear=!first||first.distance>=distance-.09||owns(first.object);
    return{x:(ndc.x+1)*this.size.w/2,y:(1-ndc.y)*this.size.h/2,visible:inFrame&&clear,world:p.toArray(),first:first?.object.name??null,reason:!inFrame?'offscreen':!clear?'occluded':'visible'};
  }
  thumbnail(id:CityPiece,angle=.35){return toyThumbnail(this.renderer,this.pieces.get(id),this.size,angle);}
  comparison(ids:CityPiece[]){const group=new T.Group();for(const id of ids){const original=this.pieces.get(id);if(original){const clone=original.clone(true);clone.position.copy(this.homes.get(original)!);clone.visible=true;group.add(clone);}}return toyThumbnail(this.renderer,group,this.size,.25);}
  destroy(){this.dead=true;disposeToy(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
