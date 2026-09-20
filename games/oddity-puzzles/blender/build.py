"""Original Oddity Office miniature. Blender 4.5 LTS, no runtime Blender dependency.
Layout is Y-up. P() is the ONLY authored-coordinate conversion, glTF exports Y-up.
"""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/assets/oddity-puzzles';OUT.mkdir(parents=True,exist_ok=True)
LAYOUT=json.loads((ROOT/'games/oddity-puzzles/layout.json').read_text('utf8'))
GREY='--grey' in sys.argv
bpy.context.preferences.filepaths.save_version=0
def P(v):return (v[0],-v[2],v[1])
def material(name,c,metal=0,alpha=1):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,alpha);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,alpha);b.inputs['Roughness'].default_value=.68;b.inputs['Metallic'].default_value=metal;b.inputs['Alpha'].default_value=alpha
 return m
def empty(name,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=P(p);o.parent=parent;return o
def finish(o,name,mat,parent,bevel=0):
 o.name=name;o.data.materials.append(mat);o.parent=parent
 if bevel and not GREY:
  mod=o.modifiers.new('Hand softened edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(name,p,size,mat,parent,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=P(p));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,parent,bevel)
def ball(name,p,size,mat,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=P(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,mat,parent)
def cyl(name,p,r,depth,mat,parent):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=P(p));return finish(bpy.context.object,name,mat,parent,.015)
def torus(name,p,major,minor,mat,parent):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=10,location=P(p));return finish(bpy.context.object,name,mat,parent)
def join_materials(parent):
 # Merge only direct, static siblings sharing a material; preserve every joint and semantic root.
 groups={}
 for o in list(parent.children):
  if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
 for name,objs in groups.items():
  if len(objs)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=parent.name+'_'+name
def join_colored(parent):
 objs=[o for o in parent.children if o.type=='MESH']
 if not objs:return
 for o in objs:
  attr=o.data.color_attributes.new(name='CraftColor',type='FLOAT_COLOR',domain='CORNER')
  for poly in o.data.polygons:
   color=o.data.materials[poly.material_index].diffuse_color
   for i in poly.loop_indices:attr.data[i].color=color
  o.data.materials.clear();o.data.materials.append(vertex_material)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=parent.name+'_sculpt'
def character(id,p,coat,style):
 r=empty('actor_'+id,p);empty('eye_'+id,l['anchors']['eye'],r);empty('hand_'+id,l['anchors']['hand'],r)
 body=empty('body_'+id,parent=r)
 ball('Head',(0,1.40,0),(.23,.25,.22),skin,body);ball('Hair cap',(0,1.56,.03),(.235,.135,.22),ink,body)
 for x in [-.08,.08]:ball('Bright eye',(x,1.43,-.204),(.026,.032,.013),ink,body)
 ball('Nose',(0,1.36,-.22),(.042,.035,.033),skin,body)
 box('Coat',(0,.92,0),(.53,.62,.33),coat,body,.12)
 if style==1:box('Long coat hem',(0,.62,0),(.66,.20,.38),coat,body,.07)
 if style==2:box('Apron',(0,.86,-.185),(.36,.48,.045),cream,body,.05)
 box('Collar',(0,1.18,-.14),(.36,.09,.06),cream,body)
 for y in [.88,1.05]:ball('Brass button',(.05,y,-.181),(.025,.025,.02),gold,body)
 for sign in [-1,1]:
  arm=empty('arm_'+id+('_l' if sign<0 else '_r'),(sign*.3,1.13,0),r)
  box('Sleeve',(0,-.16,0),(.18,.38,.22),coat,arm,.075);ball('Hand',(0,-.37,0),(.095,.10,.10),skin,arm);join_colored(arm)
  leg=empty('leg_'+id+('_l' if sign<0 else '_r'),(sign*.16,.6,0),r)
  box('Trouser',(0,-.2,0),(.19,.43,.23),ink,leg,.07);box('Boot',(0,-.5,-.065),(.23,.16,.35),brown,leg,.07);join_colored(leg)
 join_colored(body);return r
for l in LAYOUT:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 cream=material('Ivory plaster',(.78,.76,.64));wood=material('Honey oak',(.49,.31,.16));brown=material('Leather walnut',(.14,.09,.065));ink=material('Soft ink',(.045,.07,.08));gold=material('Antique brass',(.67,.43,.12),.5);blue=material('Indigo coat',(.10,.29,.45));orange=material('Ochre cape',(.72,.30,.11));sage=material('Sage uniform',(.24,.43,.32));skin=material('Warm porcelain',(.83,.59,.38));paper=material('Warm paper',(.93,.88,.73));glass=material('Clear blue glass',(.48,.72,.74),alpha=.16);floor=material('Quiet tile',(.46,.53,.49));light=material('Luminous gold',(.95,.70,.20));red=material('Oxide',(.48,.14,.09))
 vertex_material=material('Painted character surfaces',(1,1,1));attr=vertex_material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='CraftColor';vertex_material.node_tree.links.new(attr.outputs['Color'],vertex_material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 world=empty('static_room');world['layoutVersion']=1;world['level']=l['id']
 if l['id']==2:
  box('Room foundation before collapsed gap',(0,-.3,1.7),(11.9,.55,6.4),wood,world,.2)
  box('Far courtyard foundation',(0,-.3,-4.7),(11.9,.55,2.4),wood,world,.2)
 else:box('Rounded room foundation',(0,-.3,-.5),(11.9,.55,11.4),wood,world,.2)
 # Fine authored tile seams and floor panels, no image backdrop.
 for x in range(-5,6):
  for z in range(-5,5):
   if l['id']==2 and -4<z<-1:continue
   box('Inset floor tile',(x,-.025,z),(.975,.08,.975),floor if (x+z)%3 else cream,world,.02)
 for w in l['walls']:
  parent=empty('wall_'+w['id']);parent['collider']=json.dumps(w);parent['logicalOpaque']=not w['glass']
  box(w['label'],w['center'],w['size'],glass if w['glass'] else cream,parent,.025)
  if w['glass']:
   c=w['center'];sz=w['size']
   for x in [c[0]-sz[0]/2,c[0]+sz[0]/2]:box('Glass mullion',(x,c[1],c[2]),(.055,sz[1],.095),gold,parent,.01)
  if w['id'] in ['front','east','ceiling']:parent['cutaway']=True
 for n in l['nodes']:empty('nav_'+n['id'],n['p'])
 for prop in l['props']:
  anchor=empty('collision_'+prop['id']);anchor['collider']=json.dumps(prop)
 for o in l['objects']:
  r=empty('item_'+o['id'],o['p']);r['entityId']=o['id'];empty('anchor_'+o['id'],parent=r)
  id=o['id']
  if id=='ring':torus('Jade band',(0,0,0),.16,.05,sage,r);box('Seal face',(0,.015,-.15),(.17,.10,.12),gold,r,.035)
  elif id=='lamp':
   cyl('Fixed lamp foot',(0,-1.12,0),.4,.12,gold,r);cyl('Brass stem',(0,-.55,0),.045,1.05,gold,r)
   v=empty('pivot_lamp',l['anchors']['lampPivot'],r);empty('beam_origin',(0,0,0),v)
   bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.34,radius2=.12,depth=.38,location=P((0,.06,0)));finish(bpy.context.object,'Enamel shade',sage,v,.025);ball('Warm bulb',(0,-.14,0),(.11,.09,.11),light,v)
  elif id=='box':
   box('Archive case',(0,0,0),(.55,.65,.40),brown,r,.065);box('Paper label',(0,.03,-.213),(.34,.23,.025),paper,r,.025);box('Lid',(0,.32,0),(.58,.08,.43),wood,r,.03)
   for x in [-.21,.21]:box('Brass corner',(x,-.23,-.22),(.07,.12,.025),gold,r,.01)
  elif id=='photo':
   box('Photo cream border',(0,0,0),(.48,.04,.34),paper,r,.012);box('Photo inset',(0,.023,0),(.39,.01,.24),ink,r,.006);empty('photo_content',(0,.04,0),r)
  elif id=='camera':
   box('Camera leather body',(0,0,0),(.46,.29,.24),brown,r,.055);c= cyl('Metal lens',(0,0,-.18),.12,.14,gold,r);c.rotation_euler.x=math.pi/2;ball('Lens glass',(0,0,-.25),(.086,.086,.024),blue,r);box('Viewfinder',(-.13,.17,0),(.13,.09,.15),gold,r,.02);cyl('Shutter button',(.15,.17,0),.045,.04,gold,r)
  elif id=='key':
   t=torus('Key bow',(0,.15,0),.12,.032,gold,r);t.rotation_euler.x=math.pi/2;box('Key shaft',(0,-.08,0),(.06,.32,.06),gold,r,.02)
   for y in [-.17,-.09]:box('Key tooth',(.065,y,0),(.13,.05,.07),gold,r,.01)
  elif id=='tray':
   box('Tray wood',(0,0,0),(.80,.08,.6),wood,r)
   for x in [-.4,.4]:box('Tray rim',(x,.06,0),(.035,.12,.60),gold,r,.01)
   for z in [-.3,.3]:box('Tray rim',(0,.06,z),(.80,.12,.035),gold,r,.01)
   cyl('Tray support',(0,-.42,0),.06,.75,gold,r);empty('tray_rest',(0,.11,0),r)
  elif id in ['left','right']:
   prop=next(p for p in l['props'] if p['id']=='switch-base-'+str(-1 if id=='left' else 1))
   box('Fixed switch pedestal',tuple(prop['center'][i]-o['p'][i] for i in range(3)),prop['size'],wood,r,.075);box('Switch plate',(0,0,0),(.46,.3,.12),gold,r)
   button=empty('pivot_'+id,parent=r);box('Hold button',(0,0,-.10),(.22,.17,.1),red,button,.04)
  elif id=='door':
   # The collision wall has its own root; visual door is separate from static structure.
   pivot=empty('hinge_door',l['anchors']['doorHinge'],r);empty('lock_anchor',l['anchors']['doorLock'],pivot)
   for state in ['intact','broken']:
    dr=empty('door_'+state,parent=pivot)
    if state=='intact':
     box('Framed door',(.78,1.3,0),(1.54,2.55,.16),sage if l['id']==2 else glass,dr,.07)
     for y in [.65,1.85]:box('Inset panel',(.78,y,-.09),(1.22,.87,.07),wood if l['id']==2 else glass,dr,.04)
     box('Latch handle',(1.3,1.14,-.16),(.25,.065,.10),gold,dr,.022)
    else:
     for x,z,a in [(.23,.45,-.20),(.63,.3,.6),(1.1,.52,-.4)]:
      b=box('Broken door plank',(x,z,0),(.36,.96,.14),wood,dr,.03);b.rotation_euler.y=a
    join_materials(dr)
  join_materials(r)
 if l['id']==1:
  shelf=next(p for p in l['props'] if p['id']=='shelf');box('Archive shelf',shelf['center'],shelf['size'],wood,world,.08)
  for z in [-4.1,-3.7]:box('Bound records',(4.65,.38,z),(.3,.7,.28),sage,world)
 if l['id']==2:
  # Visible missing floor, jagged rubble remains separate from the camera snapshot.
  for x in [-3.8,-2,1.8,3.5]:
   b=box('Collapsed rubble',(x,-1.35,-2.6),(.6,.35,.6),cream,world,.05);b.rotation_euler.z=x
  courtyard=empty('destination_courtyard');box('Courtyard lawn',(0,.025,-4.6),(4.3,.10,1.9),sage,courtyard,.16)
  for x in [-1.7,1.7]:
   cyl('Terracotta planter',(x,.28,-4.8),.3,.5,orange,courtyard);ball('Clipped courtyard tree',(x,1.0,-4.8),(.48,.64,.48),sage,courtyard)
  join_materials(courtyard)
 if l['id']==3:
  for name,z in [('photo_entry',1.14),('photo_exit',.86)]:empty(name,(0,2.7,z))
  for y in [2.635,2.775]:box('Mail slot brass lip',(0,y,1),(.98,.03,.25),gold,world,.01)
  empty('tray_anchor',l['tray'])
 # Furniture: shaped desk and field notebook, located outside traversed paths.
 desk=next(p for p in l['props'] if p['id']=='desk');dx,dy,dz=desk['center'];dw,dh,dd=desk['size']
 box('Investigation desk top',(dx,dy+dh/2-.05,dz),(dw,.13,dd),wood,world,.1)
 for x in [dx-dw*.3,dx+dw*.3]:
  for z in [dz-dd*.36,dz+dd*.36]:box('Tapered desk leg',(x,dh*.46,z),(.12,dh*.92,.12),brown,world,.025)
 box('Closed casebook',(dx,dh+.06,dz),(.55,.10,.72),blue,world,.035)
 char_start={1:[('a',[-3.4,0,4],blue,0)],2:[('a',[-2,0,2.5],blue,0)],3:[('a',[0,0,2.8],blue,0),('b',[.75,0,3.35],orange,1),('npc',[.7,0,-.3],sage,2)]}[l['id']]
 for args in char_start:character(*args)
 static_glass=empty('static_glass')
 for w in l['walls']:
  if w['gate'] or w['id'] in ['front','east','ceiling']:continue
  anchor=bpy.data.objects.get('wall_'+w['id'])
  for mesh in list(anchor.children):
   if mesh.type=='MESH':mesh.parent=static_glass if mesh.data.materials[0]==glass else world
 join_materials(static_glass);join_materials(world)
 # Collision and navigation are exported verbatim as named empties/extras from the same layout.
 scene=bpy.context.scene;scene['layout']=json.dumps(l,ensure_ascii=False);scene['art']='Original bevelled miniature by procedural Blender modelling; no TV assets'
 bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/f'room-{l["id"]}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'room-{l["id"]}.glb'),export_format='GLB',export_extras=True,export_yup=True)
 # Deterministic card/portrait stills from these exact authored objects, not separate art.
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=192;scene.render.resolution_y=192;scene.render.resolution_percentage=100;scene.render.film_transparent=True
 scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0
 camera_data=bpy.data.cameras.new('Thumbnail camera');camera=bpy.data.objects.new('Thumbnail camera',camera_data);bpy.context.collection.objects.link(camera);camera_data.type='ORTHO';scene.camera=camera
 light_data=bpy.data.lights.new('Thumbnail softbox','AREA');light_data.energy=450;light_data.shape='DISK';light_data.size=5;softbox=bpy.data.objects.new('Thumbnail softbox',light_data);bpy.context.collection.objects.link(softbox)
 seen=set()
 for object_name in [*['item_'+o['id'] for o in l['objects'] if o.get('magic')],*['actor_'+args[0] for args in char_start]]:
  if (l['id']==3 and object_name in ['item_ring','actor_a']) or (l['id']==2 and object_name=='actor_a'):continue
  target=bpy.data.objects[object_name];children=[target]+list(target.children_recursive);mesh_children=[o for o in children if o.type=='MESH']
  points=[o.matrix_world@Vector(co) for o in mesh_children for co in o.bound_box];lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);center=(lo+hi)/2
  for obj in scene.objects:obj.hide_render=obj not in children and obj not in [camera,softbox]
  camera.location=center+Vector((2,4,3));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.ortho_scale=max((hi-lo).length*1.12,.2)
  softbox.location=center+Vector((-3,4,6));softbox.rotation_euler=(center-softbox.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'thumb-{object_name}.png');bpy.ops.render.render(write_still=True)
 print('ODDITY_EXPORT',l['id'],len(bpy.data.objects))
(OUT/'asset-manifest.json').write_text(json.dumps({'version':'0.1.0','authoring':'Blender 4.5.14 LTS','source':'games/oddity-puzzles/blender/build.py','coordinates':'layout Y-up -> Blender (x,-z,y) -> standard glTF Y-up','rooms':[f'room-{l["id"]}.glb' for l in LAYOUT],'license':'Original project artwork; no adapted characters, plot, images or music'},indent=2)+'\n',encoding='utf8')

