"""Self-authored fan miniature. Character designs belong to Disney; no extracted assets.
Blender 4.5 LTS; deterministic geometry, anchors and imported object animation.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/assets/world-in-a-box/frozen';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def material(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
wood=material('Honey ash',(.55,.31,.15));snow=material('Soft matte snow',(.88,.94,.98));frost=material('Frost porcelain',(.61,.78,.86));ice=material('Faceted blue ice',(.17,.59,.77),.24,.18);violet=material('Violet crystal',(.39,.40,.69),.32,.12);white=material('Ivory',(.98,.94,.83));skin=material('Warm painted skin',(.91,.62,.46));blue=material('Elsa turquoise satin',(.025,.36,.65),.38);cape=material('Pale blue cape',(.34,.72,.87),.55);blond=material('Platinum braid',(.91,.79,.49));auburn=material('Anna auburn braids',(.36,.105,.038));pink=material('Anna magenta cape',(.58,.035,.20));navy=material('Anna skirt',(.06,.12,.34));black=material('Charcoal',(.027,.036,.048));brown=material('Sven coat',(.31,.18,.10));grey=material('Kristoff charcoal tunic',(.16,.18,.20));gold=material('Warm brass',(.84,.49,.12),.35,.45);green=material('Spruce',(.07,.24,.19));red=material('Berry painted wood',(.47,.10,.10));eye=material('Iris blue',(.03,.24,.37));rose=material('Painted lips',(.49,.06,.10));orange=material('Carrot',(.96,.25,.02));roof=material('Town slate',(.07,.24,.28));peach=material('House ochre',(.86,.49,.25));cream=material('House cream',(.91,.75,.44));teal=material('House teal',(.18,.47,.48))
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
fixed=empty('fixed_world')
def finish(o,name,mat,parent,bevel=0):
 o.name=name;o.parent=parent;o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Rounded toy edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(name,loc,size,mat=wood,parent=fixed,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,parent,bevel)
def ell(name,loc,size,mat,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,mat,parent)
def cone(name,loc,r1,r2,depth,mat,parent,verts=12):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc);return finish(bpy.context.object,name,mat,parent)
def line(name,points,r,mat,parent):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=6;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH');return o
def dress(parent,mat):
 # Shaped waist, hips and flowing hem; not a cone primitive.
 rings=[(.38,.0),(.41,.08),(.36,.30),(.29,.65),(.22,.94),(.18,1.1),(.23,1.34),(.25,1.43)];verts=[];faces=[];n=40
 for r,z in rings:
  for i in range(n):
   a=i*2*math.pi/n;rr=r*(1+.045*math.cos(a*10));verts.append((rr*math.cos(a),rr*.78*math.sin(a),z))
 for j in range(len(rings)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 mesh=bpy.data.meshes.new('Tailored pleated dress');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Tailored pleated dress',mesh);bpy.context.collection.objects.link(o);finish(o,parent.name+'_dress',mat,parent)
 o.shape_key_add(name='Standing');seated=o.shape_key_add(name='Seated lap')
 for vertex in seated.data:
  z=vertex.co.z
  if z<1.1:
   t=1-z/1.1;vertex.co.z+=.52*t;vertex.co.y-=.46*t
 for f in mesh.polygons:f.use_smooth=True
def cloth(parent,mat):
 v=[];f=[]
 for j in range(7):
  for i in range(11):
   u=(i-5)/5;t=j/6;v.append((u*(.25+t*.27),.18+t*.28+.035*math.cos(i*1.8),1.36*(1-t)+.08))
 for j in range(6):
  for i in range(10):a=j*11+i;f.append((a,a+1,a+12,a+11))
 me=bpy.data.meshes.new('Draped cape');me.from_pydata(v,[],f);o=bpy.data.objects.new('Draped cape',me);bpy.context.collection.objects.link(o);finish(o,parent.name+'_cape',mat,parent);o['decorative']=True
 mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.013;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.shape_key_add(name='Standing');seated=o.shape_key_add(name='Seated cape')
 for vertex in seated.data:
  t=max(0,1-vertex.co.z/1.4);vertex.co.z+=.5*t;vertex.co.y-=.12*t
 return o
def clip(obj,name,axis,values):
 for frame,val in values:obj.rotation_euler[axis]=val;obj.keyframe_insert(data_path='rotation_euler',index=axis,frame=frame)
 action=obj.animation_data.action;action.name=name;track=obj.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);obj.animation_data.action=None
def human(name,loc,kind,parent=None):
 root=empty(name,loc,parent);body=empty(kind+'_body',parent=root);female=kind!='kristoff';hair=blond if kind!='anna' else auburn
 if female:dress(body,blue if kind=='elsa' else navy);cloth(body,cape if kind=='elsa' else pink)
 else:
  ell('Padded tunic',(0,0,.97),(.31,.21,.49),grey,body);box('Red sash',(0,-.015,.71),(.57,.43,.09),red,body)
 for side in [-1,1]:
  leg=empty(kind+'_leg_'+str(side),(side*.14,0,.62),body);ell('Boot',(0,-.06,-.42),(.13,.22,.19),black,leg)
  if not female:ell('Trousers',(0,0,-.14),(.105,.12,.28),brown,leg)
  clip(leg,kind+'_walk_'+str(side),0,[(1,0),(9,side*.28),(18,-side*.28),(27,0)])
  arm=empty(kind+'_arm_'+str(side),(side*.24,0,1.34),body);ell('Sleeve',(side*.05,0,-.22),(.095,.10,.27),cape if kind=='elsa' else (pink if kind=='anna' else grey),arm);ell('Hand',(side*.055,-.005,-.49),(.078,.06,.10),skin,arm)
  if side==1:
   empty(kind+'_hand',(side*.055,-.005,-.53),arm)
   clip(arm,kind+'_cast',0,[(1,0),(12,1.3),(32,1.65),(55,1.3),(72,0)])
  else:clip(arm,kind+'_wave',0,[(1,.04),(12,1.1),(20,.85),(29,1.2),(40,.04)])
 ell('Neck',(0,0,1.48),(.10,.09,.16),skin,body)
 head=empty(kind+'_head',(0,-.025,1.75),body);ell('Sculpted cheek and jaw',(0,0,0),(.25,.205,.31 if female else .29),skin,head)
 ell('Nose',(0,-.201,-.02),(.047,.066,.055),skin,head)
 for side in [-1,1]:
  ell('Ear',(side*.245,0,-.04),(.047,.048,.082),skin,head)
  ell('Almond eye white',(side*.098,-.184,.045),(.069,.025,.041),white,head);ell('Iris',(side*.09,-.209,.047),(.027,.012,.031),eye,head);ell('Pupil',(side*.09,-.22,.047),(.012,.009,.022),black,head);ell('Eye catchlight',(side*.085,-.228,.058),(.008,.006,.009),white,head)
  line('Curved brow',[(side*.04,-.19,.13),(side*.10,-.185,.15),(side*.16,-.16,.12)],.014,hair,head)
 line('Smile',[(-.07,-.185,-.13),(0,-.201,-.148),(.07,-.185,-.13)],.014,rose,head)
 ell('Hair crown',(0,.03,.17),(.262,.205,.19),hair,head)
 for i in range(7):line('Swept fringe',[(.20-i*.04,-.1,.25),(.09-i*.032,-.19,.22),(-.16-i*.006,-.16,.10)],.032,hair,head)
 if kind!='kristoff':
  for side in ([1] if kind=='elsa' else [-1,1]):
   for i in range(9):ell('Braided hair',(side*(.23+.025*math.sin(i*math.pi)), -.01-i*.017,1.68-i*.071),(.077-i*.003,.075,.066),hair,body)
   ell('Braid ribbon',(side*.23,-.16,1.05),(.07,.05,.03),blue if kind=='elsa' else pink,body)
 else:
  cone('Fur cap',(0,.02,2.015),.24,.15,.18,grey,root,20);ell('Fur collar',(0,0,1.34),(.33,.22,.10),frost,body)
 if kind=='anna':
  for x in [-.13,0,.13]:ell('Embroidered flower',(x,-.19,1.08),(.032,.015,.043),gold,body)
 return root
def olaf(loc):
 root=empty('piece_olaf',loc);body=empty('olaf_body',parent=root)
 for n,z,size in [('base',.25,(.30,.23,.29)),('middle',.65,(.21,.19,.21)),('head',1.08,(.27,.22,.32))]:ell('olaf_'+n,(0,0,z),size,snow,body)
 for z in [.36,.59,.74]:ell('Coal button',(0,-.205,z),(.035,.027,.037),black,body)
 for side in [-1,1]:
  ell('Olaf foot',(side*.17,-.09,.055),(.15,.20,.08),snow,body);ell('Olaf eye',(side*.085,-.20,1.20),(.065,.035,.08),white,body);ell('Olaf pupil',(side*.078,-.233,1.2),(.021,.012,.037),black,body)
  arm=empty('olaf_arm_'+str(side),(side*.19,0,.7),body);line('Twig arm',[(0,0,0),(side*.24,0,.08),(side*.38,0,.20)],.022,brown,arm)
  for i in range(3):line('Twig fingers',[(side*.34,0,.15),(side*(.42+i*.035),0,.13+i*.07)],.015,brown,arm)
  clip(arm,'olaf_wave_'+str(side),1,[(1,0),(12,side*.5),(24,side*.1),(36,side*.5),(48,0)])
 nose=cone('Carrot',(0,-.37,1.12),.052,0,.34,orange,body,16);nose.rotation_euler[0]=math.pi/2
 line('Happy open mouth',[(-.13,-.205,1.02),(0,-.225,.95),(.13,-.205,1.02)],.029,black,body);box('Front tooth',(0,-.238,1.005),(.08,.018,.065),white,body,.005)
 for i in range(3):line('Hair twig',[(0,0,1.36),((i-1)*.06,0,1.58)],.014,brown,body)
 return root
def sven(loc):
 root=empty('piece_sven',loc);ell('Sven torso',(0,0,.69),(.30,.52,.31),brown,root);ell('Cream chest',(0,-.34,.88),(.26,.21,.40),cream,root)
 head=empty('sven_head',(0,-.48,1.18),root);ell('Sven head',(0,0,0),(.22,.22,.29),brown,head);ell('Soft muzzle',(0,-.2,-.13),(.24,.23,.16),cream,head);ell('Nose',(0,-.38,-.10),(.17,.06,.09),black,head)
 for side in [-1,1]:
  ell('Sven eye',(side*.18,-.14,.04),(.05,.04,.068),white,head);ell('Sven pupil',(side*.19,-.169,.04),(.022,.018,.033),black,head);ell('Ear',(side*.27,0,.16),(.16,.07,.10),brown,head)
  line('Antler',[(side*.1,.04,.2),(side*.22,.05,.48),(side*.40,.05,.72)],.035,cream,head)
  for i in range(3):line('Antler branch',[(side*(.17+i*.08),.05,.36+i*.13),(side*(.13+i*.09),.05,.56+i*.12)],.026,cream,head)
  for front in [-1,1]:
   leg=empty('sven_leg_'+str(side)+'_'+str(front),(side*.21,front*.32,.6),root);ell('Leg',(0,0,-.22),(.065,.085,.26),brown,leg);ell('Hoof',(0,-.02,-.5),(.09,.13,.08),black,leg);clip(leg,'sven_walk_'+str(side)+'_'+str(front),0,[(1,0),(8,side*front*.45),(16,-side*front*.45),(24,0)])
 ell('Sven tail',(0,.51,.77),(.10,.15,.12),cream,root);line('Harness',[(-.3,-.12,.85),(0,-.15,.98),(.3,-.12,.85)],.034,red,root)
 return root
box('Rounded wood base',(0,0,-.27),(17,13,.6),wood,bevel=.6);box('Snow ground',(0,0,.035),(16.6,12.6,.20),snow,bevel=.5)
for x,y,r,h in [(-6,4,2.1,3),(-3.6,5,2,3.2),(0,5.5,1.3,2.3)]:cone('Open north mountain',(x,y,h/2),r,.4,h,frost,fixed,7)
box('Palace permanent balcony',(-.3,4,1.38),(5.8,3.2,.3),frost);box('Balcony footing',(-.3,4,.65),(5.2,2.6,1.35),snow)
box('Permanent arrival platform',(3,4,1.38),(2.1,2,.3),frost)
box('Near bridge abutment',(3,.75,.20),(2.1,1.7,.40),frost)
# Quiet physical paths give the miniature connected places, not isolated models.
for i,(x,y) in enumerate([(-4.5,-2.6),(-4,-2.2),(-3.5,-1.9),(-2.8,-1.3),(-2,-.6),(-1,.2),(0,.5),(1,.6),(2,.65),(3.1,-.2),(4.3,-.8),(4.9,-2),(4.5,-4),(3.5,-4.8),(2.3,-5.1),(1,-5.2),(-.5,-5),(-2,-4.5)]):
 ell('Rounded snowy path stone',(x,y,.17),(.45,.30,.045),white,fixed)
for x,y in [(-7,1),(-6.8,2),(-4.3,3.4),(6.8,4.4),(7,-4.5)]:
 ell('Soft snow drift',(x,y,.19),(.66,.53,.18),snow,fixed)
# The bridge has a real open gap above the snow valley; no collision/road beneath it.
bridge=empty('magic_bridge')
for i in range(12):
 t=(i+.5)/12;y=.95+t*2.4;z=.43+t*.95
 seg=empty('bridge_segment_'+str(i),parent=bridge);plank=box('Ice deck',(3,y,z),(1.65,.25,.13),ice,seg);plank.rotation_euler[0]=math.atan2(.95,2.4)
 for side in [-1,1]:cone('Bridge crystal rail',(3+side*.86,y,z+.35),.08,.045,.7,violet,seg,6)
lake=empty('lake',(.35,-2,.15));ell('Snow lake',(0,0,0),(2.6,1.8,.11),frost,lake)
rink=empty('magic_rink',(.35,-2,.27));ell('Frozen lake',(0,0,0),(2.55,1.75,.06),ice,rink)
for i in range(18):
 a=i*math.tau/18;line('Frost vein',[(0,0,.045),(math.cos(a)*1.2,math.sin(a)*.8,.047),(math.cos(a)*2.4,math.sin(a)*1.55,.05)],.014,white,rink)
cone('Elsa snowflake dais',(-1.6,-4.4,.2),.8,.8,.2,ice,fixed,12)
human('elsa',(-1.6,-4.4,.31),'elsa')
placements={'anna':(-3,-3.3,.17),'olaf':(2.7,-3.65,.2),'kristoff':(5.8,-3.2,.17),'sven':(5,-1,.17),'arendelle_castle':(-5.7,-.6,.17),'town_houses':(-5.5,-3.6,.17),'town_lanterns':(-3.55,-1.6,.17),'snow_pines':(6,2,.17),'sleigh':(4.9,-3,.17),'forest_lantern':(6.8,-.6,.17),'palace_steps':(-.3,2.2,1.53),'palace_column_left':(-2.4,3.65,1.53),'palace_column_right':(1.8,3.65,1.53),'palace_gate':(-.3,4.6,1.53),'palace_spire':(-.3,5,4.45),'palace_chandelier':(-.3,3.75,4.35)}
for id,pos in placements.items():
 if id in ['anna','kristoff']:p=human('piece_'+id,pos,id)
 elif id=='olaf':p=olaf(pos)
 elif id=='sven':p=sven(pos)
 else:p=empty('piece_'+id,pos)
 slot=empty('slot_'+id,pos)
 if id in ['anna','kristoff','olaf','sven']:
  for side in [-1,1]:
   for front in ([-1,1] if id=='sven' else [0]):ell('Foot-shaped stand',(side*(.22 if id=='sven' else .14),front*.30-.06,.026),(.13,.21,.035),frost,slot)
  if id in ['anna','olaf']:cone('Dress hem or snowball seat',(0,0,.02),.40 if id=='anna' else .29,.40 if id=='anna' else .29,.035,frost,slot,20)
 elif id in ['arendelle_castle','town_houses','sleigh','palace_steps','palace_gate']:box('Shaped foundation',(0,0,.025),(1.75 if id!='sleigh' else .9,.65 if id!='sleigh' else 1.2,.05),frost,slot,.08)
 else:cone('Crystal or garden interface',(0,0,.018),.38,.38,.036,frost,slot,6 if 'palace' in id else 8)
 empty('anchor_'+id,(0,0,.065),slot)
 if id in ['palace_spire','palace_chandelier']:
  # Actual permanent pedestal/hanging frame supports arbitrary order.
  if id=='palace_spire':box('Spire load-bearing mast',(-.3,5,2.85),(.30,.30,3.2),frost)
  else:
   for x in [-2.65,2.05]:box('Chandelier fixed post',(x,4.05,2.90),(.16,.16,2.9),frost)
   box('Chandelier hanging beam',(-.3,4.05,4.41),(4.9,.16,.16),frost);line('Suspension',[(-.3,4.05,4.41),(-.3,3.75,4.37)],.025,gold,fixed)
 if id=='arendelle_castle':
  box('Castle keep',(0,0,.65),(1.8,1.2,1.3),cream,p)
  for x in [-.85,.85]:
   cone('Castle turret',(x,0,1.02),.31,.31,1.9,peach,p,12);cone('Turret steep roof',(x,0,2.23),.45,.015,.7,roof,p)
  for x in [-.45,0,.45]:box('Castle window',(x,-.61,.92),(.14,.025,.33),teal,p)
  box('Castle door',(0,-.63,.28),(.35,.04,.54),wood,p)
 if id=='town_houses':
  for j,col in enumerate([peach,teal,cream]):
   h=empty('House',(j*.66-.65,0,0),p);box('House walls',(0,0,.4),(.60,.70,.8),col,h);r=cone('Gabled roof',(0,0,.95),.51,0,.48,roof,h,4);r.rotation_euler[2]=math.pi/4
   for x in [-.15,.15]:box('Warm window',(x,-.355,.50),(.13,.025,.18),gold,h)
   box('Door',(0,-.36,.16),(.13,.04,.29),wood,h)
 if id in ['town_lanterns','forest_lantern']:
  for x in ([-.30,.30] if id=='town_lanterns' else [0]):
   cone('Lantern post',(x,0,.5),.045,.04,1,wood,p);box('Lantern warm glass',(x,0,1.03),(.24,.24,.30),gold,p);cone('Lantern cap',(x,0,1.25),.22,0,.19,roof,p,4)
 if id=='snow_pines':
  for x,y,h in [(-.4,0,1.5),(.4,.3,1.9),(.5,-.5,1.1)]:
   cone('Trunk',(x,y,.35),.085,.07,.7,wood,p)
   for z,r in [(.55,.55),(.9,.43),(1.25,.29)]:cone('Spruce bough',(x,y,z*h/1.5),r,r*.1,.6*h/1.5,green,p,12);cone('Snow cap',(x,y,(z+.13)*h/1.5),r*.93,0,.43*h/1.5,snow,p,12)
 if id=='sleigh':
  for x in [-.43,.43]:line('Curved runner',[(x,.62,.1),(x,-.50,.1),(x,-.77,.24),(x,-.75,.45)],.045,gold,p)
  box('Sleigh floor',(0,0,.3),(.9,1.25,.12),wood,p);box('Bench',(0,.20,.50),(.8,.36,.13),red,p);box('Bench back',(0,.43,.73),(.88,.1,.50),red,p)
  for x in [-.48,.48]:box('Sleigh side',(x,0,.54),(.10,1.15,.4),red,p)
  empty('seat_kristoff',(-.20,-.20,.47),p);empty('seat_anna',(.20,.18,.47),p)
 if id=='palace_steps':
  for j in range(4):box('Crystal stair',(0,j*.22,.05+j*.075),(1.65,.8-j*.12,.12+j*.15),ice,p)
 if id.startswith('palace_column_'):
  cone('Octagonal ice column',(0,0,1.05),.23,.18,2.1,ice,p,8);cone('Crystal capital',(0,0,2.16),.40,.1,.32,violet,p,8)
  for j in range(4):box('Frost ring',(0,0,.2+j*.47),(.43,.43,.065),frost,p,.01)
  side=-1 if id.endswith('left') else 1
  for j in range(3):cone('Side ice fin',(side*.22,j*.40+.35,1+j*.23),.11,.025,2+j*.46,ice,p,6)
  line('Open crystal arch',[(0,0,2.1),(-side*.35,.2,2.5),(-side*.70,.4,2.7)],.07,violet,p)
 if id=='palace_gate':
  for side in [-1,1]:
   leaf=empty('gate_leaf_'+str(side),(side*.85,0,0),p);box('Door leaf',(-side*.42,0,1),(.82,.13,2),ice,leaf)
   for j in range(3):line('Door frost',[(0,-.08,j*.5+.2),(-side*.70,-.08,j*.5+.55)],.018,white,leaf)
  cone('Gate crown',(0,0,2.2),1.05,0,.7,violet,p,4)
 if id=='palace_spire':
  cone('Spire foot',(0,0,.25),.68,.5,.5,ice,p,8);cone('Long faceted spire',(0,0,1),.50,0,1.3,violet,p,8)
  for x in [-.6,.6]:cone('Spire satellite',(x,0,.35),.18,0,.9,ice,p,6)
 if id=='palace_chandelier':
  pivot=empty('chandelier_pivot',parent=p)
  for i in range(6):
   a=i*math.tau/6;x=.5*math.cos(a);y=.5*math.sin(a);line('Ice chandelier arm',[(0,0,0),(x,y,-.25)],.028,ice,pivot);cone('Hanging crystal',(x,y,-.4),.11,0,.4,violet,pivot,6)
for name,loc in [('magic_bridge',(1.8,.8,.22)),('magic_rink',(.35,-2,.4)),('magic_snow',(-2.6,-4.8,.22))]:
 a=empty('touch_'+name,loc);cone('Snowflake touch disc',(0,0,0),.25,.25,.05,ice,a,6)
for name,loc in [('all',(0,0,1.4)),('town',(-4,-1.9,1)),('lake',(.3,-2.8,.8)),('palace',(0,3.6,3))]:empty('camera_'+name,loc)
meta=empty('frozen_routes');meta['palace']=[[4.9,-3,.17],[4.5,-.5,.17],[3,.8,.43],[3,.95,.43],[3,3.35,1.38],[3,4,1.53],[0,3.1,1.53]];meta['lake']=[[4.9,-3,.17],[4,-4.8,.17],[0,-5.2,.17],[-2.8,-3.5,.17],[-2.5,-.2,.17],[1.2,.5,.17],[4.5,-.5,.17],[4.9,-3,.17]]
# Merge only static sibling meshes with the same material. All pivots, hand/seat
# anchors, animated nodes, piece roots and physical picking ownership survive.
groups={}
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and not o.animation_data and not o.get('decorative') and not o.data.shape_keys and o.name!='olaf_head':groups.setdefault((o.parent,o.active_material),[]).append(o)
for (parent,mat),objects in groups.items():
 if len(objects)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=(parent.name if parent else 'static')+'_'+mat.name
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).parent/'frozen-elsa-playground.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'frozen-elsa-playground.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_extras=True,export_yup=True)
path=OUT/'frozen-elsa-playground.glb'
(OUT/'asset-manifest.json').write_text(json.dumps({'source':'games/world-in-a-box/blender/build_frozen.py','blender':bpy.app.version_string,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'characters':['elsa','anna','olaf','kristoff','sven'],'pieces':list(placements),'rights':'Self-authored fan geometry; Frozen characters and designs Disney. Not official; not CC0 character IP. No extracted assets.'},ensure_ascii=False,indent=2),encoding='utf-8')
print('FROZEN_EXPORTED',path.stat().st_size)
