import * as T from 'three';

/** A short, non-pickable marker at the actual footprint, with no new resource per placement. */
export class PlacementGlow{
 readonly mesh=new T.Mesh(new T.RingGeometry(.88,1,64),new T.MeshBasicMaterial({color:0xf6bb55,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));
 private age=2;private footprint=new T.Vector2();
 constructor(private reduced:boolean){this.mesh.rotation.x=-Math.PI/2;this.mesh.visible=false;this.mesh.userData.decorative=true;}
 show(piece:T.Object3D){
  piece.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(piece),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  this.footprint.set(Math.max(.38,size.x*.58),Math.max(.38,size.z*.58));this.mesh.position.set(center.x,box.min.y+.035,center.z);this.age=0;this.frame(0);
 }
 frame(dt:number){this.age+=dt;this.mesh.visible=this.age<1.1;if(!this.mesh.visible)return;const t=this.age/1.1,scale=this.reduced?1:1+t*.18;this.mesh.scale.set(this.footprint.x*scale,this.footprint.y*scale,1);this.mesh.material.opacity=.8*(1-t)**2;}
 clear(){this.age=2;this.mesh.visible=false;}
}
