"""Original fictional wooden council desk. Blender 4.5; no runtime Blender dependency.
Reuses the World Box grain texture and Blender -> embedded GLB production pipeline.
Run from any directory: blender --background --factory-startup --python this_file.
Optional -- --render creates the four story views from the exact final scene.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/assets/world-in-a-box/chancellor'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def mat(name,c,grain=False):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.66
 if grain:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/'public/assets/world-in-a-box/ash-grain.png'),check_existing=True);t.image.pack();m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color'])
 return m
wood=mat('Original ash grain',(.72,.48,.27),True);walnut=mat('Walnut edges',(.19,.10,.055));cream=mat('Painted warm ivory',(.91,.81,.57));red=mat('Terracotta',(.62,.23,.12));water=mat('River blue',(.11,.43,.52));green=mat('Sage fields',(.38,.52,.24));coat=mat('Chancellor teal coat',(.08,.34,.32));skin=mat('Maple face',(.87,.62,.36));blue=mat('Boat worker indigo',(.19,.31,.51));gold=mat('Grain sack ochre',(.76,.53,.18));gray=mat('Stone',(.46,.47,.39));orange=mat('Engineering rust',(.83,.37,.10))
def empty(n,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
fixed=empty('fixed_world')
def finish(o,n,m,parent,bev=0):
 o.name=n;o.parent=parent;o.data.materials.append(m)
 if bev:
  mod=o.modifiers.new('Rounded toy edges','BEVEL');mod.width=bev;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(n,p,d,m=wood,parent=fixed,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,m,parent,bevel)
def ball(n,p,d,m=skin,parent=fixed):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=p);o=bpy.context.object;o.scale=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,n,m,parent)
def cyl(n,p,r,h,m=wood,parent=fixed):
 bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=h,location=p);return finish(bpy.context.object,n,m,parent,.025)
def beam(n,a,b,r,m=wood,parent=fixed):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m,parent);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def roof(parent,w,d,z):
 for side in [-1,1]:
  o=box('Sloped tiled roof',(0,side*d/4,z+.18),(w+.18,d*.62,.13),red,parent);o.rotation_euler.x=side*-.5
 for x in [-w/2+i*.18 for i in range(int(w/.18)+1)]:
  for side in [-1,1]:beam('Roof tile rib',(x,0,z+.36),(x,side*d*.53,z+.06),.026,cream,parent)
def house(n,p,w=1.3,d=1.1,h=1,m=cream):
 o=empty(n,p);box('House walls',(0,0,h/2),(w,d,h),m,o);roof(o,w,d,h);box('Door',(0,-d/2-.01,.30),(.30,.04,.6),walnut,o)
 for x in [-w*.30,w*.30]:box('Window',(x,-d/2-.03,.65),(.22,.05,.25),blue,o)
 return o
def sack(n,p,parent=fixed):
 o=empty(n,p,parent);ball('Woven sack',(0,0,.20),(.18,.14,.23),gold,o);cyl('Sack knot',(0,0,.42),.07,.10,walnut,o);return o
def person(n,p,m,role):
 o=empty(n,p);o['role']=role
 for x in [-.12,.12]:box('Foot',(x,-.07,.08),(.18,.30,.14),walnut,o);cyl('Leg',(x,0,.22),.08,.32,m,o)
 bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.27,radius2=.18,depth=.52,location=(0,0,.52));finish(bpy.context.object,'Coat',m,o)
 ball('Face',(0,0,.98),(.19,.18,.23),skin,o);cyl('Hat',(0,0,1.16),.24,.09,walnut,o)
 for x in [-.065,.065]:ball('Eye',(x,-.168,1.01),(.022,.025,.027),walnut,o)
 beam('Left arm',(-.18,0,.72),(-.40,-.16,.57),.07,m,o);beam('Right arm',(.18,0,.72),(.42,-.14,.78),.07,m,o)
 ball('Hand',(-.40,-.16,.57),(.085,.07,.085),skin,o);ball('Hand',(.42,-.14,.78),(.085,.07,.085),skin,o)
 if role=='engineer':beam('Hammer handle',(.43,-.14,.75),(.43,-.14,1.10),.035,walnut,o);box('Hammer head',(.43,-.14,1.13),(.24,.13,.12),gray,o)
 elif role=='boat':beam('Boat pole',(.42,-.14,.15),(.42,-.14,1.65),.03,wood,o)
 else:box('Message tablet',(.35,-.25,.76),(.24,.06,.34),cream,o)
 return o
# Top: both banks sit above a recessed river. Routes connect every real endpoint.
box('Table rim',(0,0,-.12),(16.8,10.8,.5),walnut);box('Ash tabletop',(0,0,.10),(16.4,10.4,.35))
box('Left bank',(-4.6,0,.38),(7.1,9.9,.3),green);box('Right bank',(4.6,0,.38),(7.1,9.9,.3),green);box('River',(0,0,.30),(2.2,9.9,.15),water)
for x in [-7,7]:
 for y in [-4,4]:box('Table leg',(x,y,-1.3),(.6,.6,2.1),wood)
road_height=.56
def road(a,b):
 global road_height
 road_height+=.003
 mid=(Vector(a)+Vector(b))/2;d=Vector(b)-Vector(a);o=box('Connected road',(mid.x,mid.y,road_height),(d.length,.7,.055),cream,bevel=0);o.rotation_euler.z=math.atan2(d.y,d.x)
road((-5,-1.8),(-1.1,-1.8));road((1.1,-1.8),(2.5,-1.8));road((2.5,-1.8),(4.8,-2.4));road((2.5,-1.8),(3.7,2.5));road((-5,-1.8),(-3,2.65));road((-3,2.65),(-1.2,2.65));road((1.2,2.65),(3.7,2.5))
g=house('granary',(-5.3,-.4,.6),2.2,1.7,1.55);g['place']='granary';
for x in [-.65,.65]:beam('Granary brace',(x,-.87,.1),(x,-.87,1.4),.055,wood,g)
for i in range(6):sack('store_'+str(i),(-6.4+(i%3)*.45,-2.1+(i//3)*.4,.6))
bridge=empty('bridge',(0,-1.8,.6));bridge['place']='bridge'
for x in [-1.1,1.1]:
 for y in [-.55,.55]:cyl('Bridge post',(x,y,.22),.09,.55,walnut,bridge)
for i in range(4):box('bridge_plank_'+str(i),(-.9+i*.6,0,0),(.59,1.05,.16),wood,bridge)
for side in [-1,1]:beam('Bridge rail',(-1.2,side*.58,.45),(1.2,side*.58,.45),.07,walnut,bridge)
for i in range(4):o=box('Repair timber',(-2.0,-2.7+i*.20,.63),(.95,.14,.13),wood);o.rotation_euler.z=.12
for side in [-1,1]:
 pier=empty('pier_'+str(side),(side*1.4,2.65,.54));pier['place']='pier' if side==-1 else 'river'
 for i in range(5):box('Pier boards',(0,-.5+i*.25,0),(1.05,.23,.13),wood,pier)
 for y in [-.65,.65]:cyl('Mooring post',(side*.45,y,.12),.07,.55,walnut,pier)
rv=empty('river_houses');rv['place']='river'
for i,p in enumerate([(3.8,3.1,.60),(5.5,3.2,.6)]):h=house('River house '+str(i),p);h.parent=rv
mv=empty('mountain_houses');mv['place']='mountain'
for i,p in enumerate([(5.2,-2.5,.60),(6.6,-1.5,.6)]):h=house('Mountain house '+str(i),p);h.parent=mv
for x,y,z in [(6,-3.8,1.2),(7.3,-3.1,1.1),(4.5,-4,1)]:
 bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.8,radius2=.1,depth=z,location=(x,y,.6+z/2));finish(bpy.context.object,'Carved mountain',gray,fixed,.05)
for prefix,p in [('riverbag',(3.6,1.6,.6)),('mountainbag',(4.4,-3.2,.6))]:
 for i in range(6):sack(prefix+'_'+str(i),(p[0]+(i%3)*.42,p[1]+(i//3)*.38,p[2]))
cart=empty('cart',(-3.6,-1.8,.80));cart['place']='granary';box('Cart bed',(0,0,.15),(1.6,.85,.13),wood,cart)
for side in [-1,1]:
 box('Cart side',(0,side*.43,.40),(1.65,.10,.45),red,cart)
 for x in [-.55,.55]:
  w=cyl('wheel',(x,side*.53,.05),.28,.12,walnut,cart);w.rotation_euler.x=math.pi/2
  for theta in [0,math.pi/2]:beam('Wheel spoke',(x-math.cos(theta)*.24,side*.61,.05-math.sin(theta)*.24),(x+math.cos(theta)*.24,side*.61,.05+math.sin(theta)*.24),.028,cream,cart)
for y in [-.28,.28]:beam('Cart handle',(.8,y,.12),(1.35,y,.15),.045,wood,cart)
for i in range(6):sack('cartbag_'+str(i),(-.53+(i%3)*.45,-.2+(i//3)*.35,.22),cart)
boat=empty('boat',(-.60,2.65,.48));boat['place']='pier';ball('Boat hull',(0,0,0),(.65,.35,.20),walnut,boat);box('Boat inner',(0,0,.12),(1.0,.45,.1),wood,boat)
for y in [-.30,.30]:beam('Boat gunwale',(-.50,y,.19),(.50,y,.19),.075,red,boat)
for i in range(3):sack('boatbag_'+str(i),(-.34+i*.34,0,.16),boat)
chief=person('chancellor',(-3.0,-4.0,.6),coat,'council');chief['place']='council';person('grainkeeper',(-5.8,-3.0,.6),gold,'grain');person('engineer',(-1.7,-3.4,.6),orange,'engineer');person('carrier',(-2.2,2.9,.6),blue,'boat')
desk=empty('council_table',(-3,-3.2,.6));box('Council desk',(0,0,.40),(1.5,.8,.14),wood,desk);box('Message scroll',(0,0,.49),(.8,.4,.025),cream,desk)
for x in [-.6,.6]:box('Desk legs',(x,0,.2),(.12,.55,.4),walnut,desk)
for x,y in [(-7,3),(-6.5,3.7),(7,1),(6.7,.1)]:cyl('Tree trunk',(x,y,.9),.1,.7,walnut);ball('Tree crown',(x,y,1.5),(.5,.45,.75),green)
for n,p in {'granary':(-5.3,-.4,2.7),'bridge':(0,-1.8,.9),'pier':(-1.4,2.65,.8),'river':(3.8,3.1,2),'mountain':(5.2,-2.5,2),'council':(-3,-4,1.9)}.items():empty('anchor_'+n,p)
scene=bpy.context.scene;scene.world.color=(.7,.7,.7);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
for n,p,power,size in [('Key',(-6,-8,14),2100,9),('Fill',(8,4,10),1800,10)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(11,-17,19));camera=bpy.context.object;camera.name='Story camera';camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=19;scene.camera=camera
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
# Collapse static pieces within the same semantic owner. Moving groups and counted bags
# keep their IDs; fewer draw calls do not change geometry or material assignments.
for owner in [o for o in bpy.data.objects if o.type=='EMPTY']:
 meshes=[o for o in owner.children if o.type=='MESH' and not o.name.startswith(('wheel','bridge_plank_'))]
 if len(meshes)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=owner.name+'_surface'
# GLB contains all canonical objects; runtime toggles counted bags and completed bridge planks.
# Clear editor-only file browser folders before distributing the source file.
# The packed texture uses a repository-relative locator, never a user home.
for image in bpy.data.images:
 if image.packed_file:
  locator='//../../../public/assets/world-in-a-box/'+Path(image.filepath).name
  image.filepath='_'*1023;image.filepath=locator
  for packed in image.packed_files:
   packed.filepath='_'*1023;packed.filepath=locator
for screen in bpy.data.screens:
 for area in screen.areas:
  for space in area.spaces:
   if space.type=='FILE_BROWSER' and space.params:
    # Fill the fixed buffer first: shorter RNA assignments leave old bytes after NUL.
    space.params.directory=b'_'*1023;space.params.directory=b'//'
scene.render.filepath='//story.png'
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'chancellor-desk.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'chancellor-desk.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
if '--render' in sys.argv:
 def hide_tree(o,hidden):
  o.hide_render=hidden
  for c in o.children:hide_tree(c,hidden)
 for act in range(1,5):
  for prefix,n in [('store',6 if act<4 else 0),('cartbag',6 if act<4 else 0),('boatbag',0 if act!=3 else 3),('riverbag',6 if act==4 else 0),('mountainbag',6 if act==4 else 0)]:
   for i in range(6):
    o=bpy.data.objects.get(prefix+'_'+str(i))
    if o:hide_tree(o,i>=n)
  if act==3:
   for i in range(3,6):hide_tree(bpy.data.objects['store_'+str(i)],True)
  for i in range(4):bpy.data.objects['bridge_plank_'+str(i)].hide_render=i>=(4 if act==4 else 2 if act==3 else 0)
  if act==2:
   camera.location=(-.5,-12,13);camera.rotation_euler=(Vector((-3,-2.7,.8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=8.5
   for name,pos in [('grainkeeper',(-4.2,-3.4,.6)),('engineer',(-1.9,-3.4,.6)),('carrier',(-2.3,-2.6,.6))]:bpy.data.objects[name].location=pos
  if act==3:
   camera.location=(11,-17,19);camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=19
   bpy.data.objects['engineer'].location=(-1.5,-1.2,.6);bpy.data.objects['carrier'].location=(-.1,2.7,.6);boat.location.x=.2
  if act==4:cart.location=(2.5,-1.8,.8);bpy.data.objects['carrier'].location=(3.7,-2.3,.6)
  scene.render.filepath=str(OUT/f'story-{act}.png');bpy.ops.render.render(write_still=True)
 print('Rendered four original story scenes')
print('CHANCELLOR_BUILD_COMPLETE')
