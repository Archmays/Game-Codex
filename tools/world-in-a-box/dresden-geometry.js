// Asset-only measurement, separate from gameplay evidence. Loads actual exported meshes.
async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1200,height:900}}),p=await ctx.newPage();
 try{await p.goto('http://127.0.0.1:5175/');return await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {scene}=await new GLTFLoader().loadAsync('/assets/world-in-a-box/dresden/dresden-river-campus.glb');scene.updateMatrixWorld(true);const rows=[];
  const bounds=id=>new T.Box3().setFromObject(scene.getObjectByName('piece_'+id),true);const boat=bounds('paddle_steamer'),tram=bounds('yellow_tram'),bridge=scene.getObjectByName('piece_augustus_bridge');
  const bsize=boat.getSize(new T.Vector3());const meshes=[];bridge.traverse(o=>{if(o.isMesh)meshes.push(o)});
  const upperSupportGaps={};for(const [upper,body] of [['frauenkirche_dome','frauenkirche_body'],['beyer_tower','beyer_body']]){const support=new T.Box3().setFromObject(scene.getObjectByName('slot_'+body),true);const gap=bounds(upper).min.y-support.max.y;upperSupportGaps[upper]=gap;if(gap>.005||gap<-.2)throw Error(upper+' floats above its unassembled-body support');}
  const hits=[];const ray=new T.Raycaster();
  // Sweep full boat bounding envelope across the central arch, including both paddles.
  for(let z=boat.min.z;z<=boat.max.z+.0001;z+=.025)for(let y=boat.min.y;y<=boat.max.y+.0001;y+=.025){ray.set(new T.Vector3(-2,y,z),new T.Vector3(1,0,0));ray.far=2.1;if(ray.intersectObjects(meshes,false).length)hits.push([y,z]);}
  if(hits.length)throw Error('Actual boat envelope intersects bridge at '+JSON.stringify(hits.slice(0,4)));
  const railSamples=[];for(const x of [-1.23,-.77]){ray.set(new T.Vector3(x,5,-4),new T.Vector3(0,-1,0));ray.far=6;const hit=ray.intersectObjects(meshes,false)[0];if(!hit||!/Walnut|running rail/.test(hit.object.material.name))throw Error('Bridge deck hides running rail');railSamples.push({x,height:hit.point.y});}
  ray.set(new T.Vector3(-1,5,-4),new T.Vector3(0,-1,0));const deckTop=ray.intersectObjects(meshes,false)[0].point.y;if(tram.min.y<deckTop)throw Error('Tram wheels sink into bridge deck');
  const pier=bounds('river_pier'),berth=scene.getObjectByName('boat_route').userData.berth;const dockMinNorth=berth[1]-bsize.z/2;if(dockMinNorth<=-pier.min.z)throw Error('Paddle overlaps pier while docked');
  const corridor=new T.Box3(new T.Vector3(tram.min.x,tram.min.y,-7.8),new T.Vector3(tram.max.x,tram.max.y,8.7));const buildings=['frauenkirche_body','frauenkirche_dome','semperoper','zwinger_galleries','zwinger_crown_gate','beyer_body','beyer_tower','slub_surface','slub_skylight','campus_bikes','street_houses','bakery_front','bench_scene','riverside_trees'];const collisions=buildings.filter(id=>bounds(id).intersectsBox(corridor));if(collisions.length)throw Error('Tram corridor intersects '+collisions.join(','));
  return{result:'PASS',upperSupportGaps,boatBounds:{min:boat.min.toArray(),max:boat.max.toArray(),size:bsize.toArray()},tramBounds:{min:tram.min.toArray(),max:tram.max.toArray()},deckTop,railSamples,archEnvelopeGridStep:.025,archCollisionSamples:hits.length,dockHullToPierGap:dockMinNorth+ pier.min.z,tramBuildingCollisions:collisions,coordinateCheck:'actual glTF Y up, negative Z north; Blender exported route extras explicitly converted'};
 });}finally{await ctx.close();}
}
