import * as T from 'three';

/** Both boxes own their resources; late loads are disposed by their scene owner. */
export function disposeToy(root:T.Object3D){
  const textures=new Set<T.Texture>(),materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
  root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);}}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
export function toyThumbnail(renderer:T.WebGLRenderer,original:T.Object3D|undefined,size:{w:number;h:number},angle=.35){
  if(!original)return '';
  const scene=new T.Scene(),o=original.clone(true);o.position.set(0,0,0);o.visible=true;scene.add(o);o.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(o),center=box.getCenter(new T.Vector3()),extent=box.getSize(new T.Vector3());o.position.sub(center);
  scene.add(new T.HemisphereLight(0xfff5e7,0x978369,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,5,7);scene.add(light);
  const r=Math.max(extent.x,extent.y,extent.z)*.68,c=new T.OrthographicCamera(-r,r,r,-r,.1,80);c.position.set(Math.sin(angle)*30,18,Math.cos(angle)*30);c.lookAt(0,0,0);
  renderer.setSize(300,300,false);renderer.render(scene,c);const src=renderer.domElement.toDataURL('image/png');renderer.setSize(size.w,size.h);return src;
}
export function fitCamera(camera:T.OrthographicCamera,center:T.Vector3,halfSize:number,aspect:number,angle:number,pitch:number,zoom:number){
  const h=Math.max(halfSize,halfSize/aspect)/zoom;camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.near=.1;camera.far=160;
  camera.position.copy(center).add(new T.Vector3(Math.sin(angle)*50*Math.cos(pitch),Math.sin(pitch)*50,Math.cos(angle)*50*Math.cos(pitch)));camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
