"""Dresden wooden city, Blender 4.5. Coordinates: X east, Y north, Z up.
-- --samples exports the same church/bridge/SLUB functions for in-browser inspection.
No Blender dependency in normal web build. Materials are image-backed glTF PBR.
"""
import bpy, math, random, json, hashlib, sys, re
from pathlib import Path
from mathutils import Vector
random.seed(20919)
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/assets/world-in-a-box/dresden'
SAMPLE='--samples' in sys.argv
if SAMPLE: OUT=ROOT/'tmp/tasks/world-box-step02/samples'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def material(name,color,grain=False,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.79;bs.inputs['Metallic'].default_value=metal
 if grain:
  im=bpy.data.images.load(str(ROOT/'public/assets/world-in-a-box/ash-grain.png'),check_existing=True);im.pack();tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 return m
wood=material('Ash / fine original grain',(.76,.59,.36),True)
stone=material('Warm sandstone',(.73,.60,.42));old=material('Retained dark sandstone',(.28,.24,.20));ivory=material('Carved pale stone',(.89,.80,.63));roof=material('Oxidised copper paint',(.20,.37,.34));dark=material('Walnut details',(.18,.13,.09));glass=material('Blue glass inlays',(.30,.55,.58));leaf=material('Sage foliage',(.33,.48,.29));grass=material('Pale meadow',(.57,.64,.40));water=material('Elbe blue wooden inlay',(.19,.44,.53));yellow=material('Tram yellow',(.98,.65,.07));brick=material('Beyer brick',(.53,.25,.13));red=material('Terracotta roofs',(.53,.29,.19));gold=material('Crown brass',(.80,.55,.12),metal=.4);light=material('Warm windows',(.90,.72,.38))
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
fixed=empty('fixed_world')
def finish(o,name,mat,parent,bevel=0):
 o.name=name;o.parent=parent;o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Rounded toy edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(name,loc,size,mat=wood,parent=fixed,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,parent,bevel)
def cyl(name,loc,r,depth,mat=wood,parent=fixed,n=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc);return finish(bpy.context.object,name,mat,parent,.015)
def sphere(name,loc,scale,mat=wood,parent=fixed):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,mat,parent)
def lathe(name,profile,mat,parent):
 n=40;v=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for r,z in profile for i in range(n)];f=[]
 for j in range(len(profile)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat,parent)
 for p in mesh.polygons:p.use_smooth=True
 return o
def beam(name,a,b,r,mat,parent=fixed):
 mid=(Vector(a)+Vector(b))/2;o=cyl(name,mid,r,(Vector(b)-Vector(a)).length,mat,parent,12);o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler();return o
def pitched(name,loc,w,d,h,mat,parent):
 x,y,z=loc;v=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x-w/2,y+d/2,z),(x+w/2,y+d/2,z),(x-w/2,y,z+h),(x+w/2,y,z+h)];f=[(0,1,5,4),(2,4,5,3),(0,4,2),(1,3,5),(0,2,3,1)];m=bpy.data.meshes.new(name);m.from_pydata(v,[],f);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent,.025)
def windows(parent,w,d,h,mat=dark,rows=2):
 for z in [h*(i+1)/(rows+1) for i in range(rows)]:
  for x in [(-w/2+.20)+i*.30 for i in range(max(1,int((w-.2)/.3)))]:
   for y in [-d/2-.008,d/2+.008]:box('Window inlay',(x,y,z),(.12,.025,.24),mat,parent,.025)
def tree(x,y,z,parent=fixed,scale=1):
 cyl('Tree trunk',(x,y,z+.22*scale),.07*scale,.44*scale,dark,parent)
 sphere('Carved tree canopy',(x,y,z+.65*scale),(.33*scale,.31*scale,.48*scale),leaf,parent)
def house(parent,loc,w,d,h,mat=ivory):
 x,y,z=loc;p=empty('House group',loc,parent);box('Plaster body',(0,0,h/2),(w,d,h),mat,p);pitched('Gabled roof',(0,0,h),w+.10,d+.12,.38,red,p);windows(p,w,d,h);return p
G=1.46
spec=[
 ('augustus_bridge','奥古斯都桥','river',(-1,4,0),(0,0,1.6)),
 ('paddle_steamer','轮桨船','river',(-6.6,4,.25),(0,0,.6)),
 ('yellow_tram','黄色电车','river',(-1,.4,G+.05),(0,0,.5)),
 ('river_pier','码头','river',(5.8,2,.32),(0,0,.10)),
 ('riverside_trees','河岸树组','river',(4,6.8,G),(0,0,.8)),
 ('frauenkirche_body','圣母教堂主体','oldtown',(3.3,-.5,G),(0,-.55,1.0)),
 ('frauenkirche_dome','圣母教堂圆顶','oldtown',(3.3,-.5,G+1.4),(0,0,1.3)),
 ('semperoper','森帕歌剧院','oldtown',(-4.6,.4,G),(0,-.6,.8)),
 ('zwinger_galleries','茨温格庭院长廊','oldtown',(-4.6,-2.2,G),(0,0,.12)),
 ('zwinger_crown_gate','冠门','oldtown',(-4.6,-3.35,G),(0,0,1.1)),
 ('beyer_body','贝耶尔楼主体','campus',(-3.4,-7,G),(0,-.65,.6)),
 ('beyer_tower','贝耶尔楼观测塔','campus',(-2.55,-6.8,G+1.3),(0,0,1.1)),
 ('slub_surface','SLUB地面建筑组','campus',(3.4,-7,G),(1.25,0,.8)),
 ('slub_skylight','中央采光顶','campus',(3.4,-7,G+.08),(0,0,.03)),
 ('campus_bikes','校园自行车架','campus',(.4,-8.7,G),(0,0,.35)),
 ('street_houses','街屋组','street',(2,-4.1,G),(0,-.4,.65)),
 ('bakery_front','面包店门面','street',(5.5,-4.8,G),(0,-.15,.6)),
 ('bench_scene','长椅小景','street',(-2.3,-4.3,G),(0,0,.3))]
roots={};slots={}
for id,label,group,loc,anchor in spec:
 p=empty('piece_'+id,loc);p['pieceId']=id;roots[id]=p
 s=empty('slot_'+id,loc);s['accepts']=id;slots[id]=s
 empty('anchor_'+id,anchor,s);empty('interaction_'+id,anchor,p)
 # Sculpted support for arbitrary-order upper pieces; no complete bridge cover.
 if id in ['frauenkirche_body','beyer_body']:
  box('Unpainted structural support',(0,0,.65),(1.45,1.35,1.3),wood,s,.08)
  if id=='beyer_body':box('Observatory support for tower-first',(.85,.2,.65),(.83,.85,1.3),wood,s)
 elif id=='slub_surface':
  for x in [-1.4,1.4]:box('Pale library support',(x,0,.4),(.7,2.3,.8),wood,s)
 elif id=='augustus_bridge':
  for y in [-2.6,2.6]:box('Bridge abutment socket',(0,y,G), (1.25,.25,.08),wood,s)
 elif id not in ['beyer_tower','frauenkirche_dome','slub_skylight','bakery_front']:
  box('Tangible socket',(0,0,.015),(.65,.55,.035),wood,s)
 elif id=='bakery_front':box('Bakery supporting wall',(0,.1,.6),(.95,.20,1.2),wood,s)

# Continuous base, carved water gap and an actual library well, not an image overlay.
box('Rounded foundation',(0,-1,.04),(18,20,.30),wood,bevel=.16)
box('Northern bank',(0,7.65,.81),(17.7,2.5,1.3),wood)
# South bank assembled around SLUB cutout (x 2.35..4.45, y -8.2..-5.8).
box('South bank upper',(0,-2.1,.81),(17.7,7.4,1.3),wood)
box('South bank west',(-3.25,-7,.81),(11.2,2.4,1.3),wood)
box('South bank east',(6.65,-7,.81),(4.4,2.4,1.3),wood)
box('South bank bottom',(0,-9.05,.81),(17.7,1.7,1.3),wood)
box('Blue river inlay',(0,4,.18),(17.7,4.8,.12),water,bevel=.08)
for y in [2.1,2.8,3.5,4.4,5.2,5.9]:
 for x in [-7,-3,1,5]:box('Short carved water glint',(x+(y%1),y,.25),(.9,.025,.012),glass,bevel=.01)
for x in [-8,8]:box('Box rim',(x*1.11,-1,1.0),(.18,19.9,1.6),wood)
for y in [-10.9,8.9]:box('Box rim',(0,y,.5),(18,.18,.9),wood)
# Toy route is a straight north-south corridor with public access south of old town.
tram=[(-1,-8.7,G+.025),(-1,.4,G+.025),(-1,1.12,G+.025),(-1,6.88,G+.025),(-1,7.8,G+.025)]
route=empty('tram_route');route['points']=[list(p) for p in tram];route['stops']={'campus':0,'oldtown':1,'north':4};route['bridgeLimits']=[.8,7.2]
for i,co in enumerate(tram):empty('tram_path_'+str(i),co,route)
for a,b in [(tram[0],(-1,1.4,G+.025)),((-1,6.6,G+.025),tram[4])]:
 box('Toy tram road',(-1,(a[1]+b[1])/2,G+.005),(1.10,b[1]-a[1],.03),stone)
 for dx in [-.23,.23]:beam('Fixed rail',(a[0]+dx,a[1],G+.03),(b[0]+dx,b[1],G+.03),.018,dark)
boat=empty('boat_route');boat['points']=[[-6.6,4,.25],[7.3,4,.25]];boat['berth']=[5.8,3.52,.25];boat['halfWidth']=.42;boat['halfLength']=.88;boat['top']=1.01;boat['pierNorthEdges']=[3.2,4.8];boat['archClearance']=1.24
for i,co in enumerate(boat['points']):empty('boat_path_'+str(i),co,boat)
for name,loc in [('all',(0,-1,G)),('river',(0,4,.6)),('oldtown',(-.3,-1,G)),('campus',(0,-7,G)),('street',(2,-4,G)),('library',(3.4,-7,.7))]:empty('camera_'+name,loc)
for x,y in [(-7,-5),(7,-5),(-6.8,-7),(6.8,-8.8),(-3.3,-4.3),(7.6,7)]:tree(x,y,G,scale=.8)
for x,y,w,d in [(-4,-5.2,5,.7),(4.5,-5.4,5,.4),(-3.5,-8.6,3,.7),(4,7,4,.8)]:box('Green space',(x,y,G+.015),(w,d,.04),grass)
for x in [-6.6,-4.2,2,5.4]:house(fixed,(x,7.45,G),1.15,.85,.65)

def bridge():
 p=roots['augustus_bridge'];box('Continuous fixed bridge deck',(0,0,G-.08),(1.22,5.25,.16),stone,p)
 for y in [-2.4,-.8,.8,2.4]:box('Stone bridge pier',(0,y,.63),(1.30,.22,1.02),stone,p,.05)
 # Wedge rings leave genuinely open holes along east-west boat passage.
 for cy in [-1.6,0,1.6]:
  for j in range(14):
   a=math.pi*j/14;b=math.pi*(j+1)/14;inner=.69;outer=.87
   v=[(x,cy+r*math.cos(t),.57+r*math.sin(t)) for x in [-.59,.59] for r,t in [(inner,a),(inner,b),(outer,b),(outer,a)]]
   m=bpy.data.meshes.new('Arch');m.from_pydata(v,[],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(1,5,6,2),(0,3,7,4)]);m.update();o=bpy.data.objects.new('Open stone arch voussoir',m);bpy.context.collection.objects.link(o);finish(o,o.name,ivory if j%3==0 else stone,p)
 for x in [-.58,.58]:
  box('Bridge parapet',(x,0,1.60),(.075,5.25,.27),stone,p)
  for y in [-2.4,-.8,.8,2.4]:box('Parapet post',(x,y,1.64),(.15,.17,.36),ivory,p)
 for dx in [-.23,.23]:beam('Bridge rail',(dx,-2.65,1.49),(dx,2.65,1.49),.018,dark,p)
def church():
 p=roots['frauenkirche_body'];cyl('Octagonal central church',(0,0,.63),.99,1.26,stone,p,8);windows(p,1.45,1.52,1.35,rows=2)
 for x in [-.72,.72]:
  for y in [-.72,.72]:
   box('Corner stair tower',(x,y,.67),(.32,.32,1.34),ivory,p)
   sphere('Corner turret',(x,y,1.4),(.2,.2,.23),stone,p)
 for i in range(24):
  a=random.choice([-.5,.5])*math.pi;x=random.uniform(-.6,.6);z=random.uniform(.15,1.15)
  box('Preserved old stone',(x,math.sin(a)*.773,z),(.14,.027,.10),old,p,.01)
 cyl('Sandstone cornice',(0,0,1.30),1.02,.13,ivory,p,8)
 p=roots['frauenkirche_dome'];lathe('Bell-shaped stone dome',[(.75,0),(.78,.14),(.65,.26),(.61,.42),(.65,.62),(.70,.80),(.66,1.03),(.52,1.23),(.30,1.37),(.22,1.39)],stone,p)
 cyl('Dome supporting collar',(0,0,-.06),.77,.16,ivory,p,32)
 for i in range(8):
  a=i*math.tau/8;beam('Dome rib',(.66*math.cos(a),.66*math.sin(a),.75),(.27*math.cos(a),.27*math.sin(a),1.38),.023,ivory,p)
 cyl('Lantern foot',(0,0,1.43),.28,.09,ivory,p)
 for i in range(8):a=i*math.tau/8;cyl('Lantern column',(.19*math.cos(a),.19*math.sin(a),1.64),.025,.37,ivory,p,12)
 lathe('Lantern crown',[(.29,1.82),(.25,1.92),(.12,2.02),(.06,2.13)],stone,p)
 beam('Cross upright',(0,0,2.08),(0,0,2.39),.022,gold,p);beam('Cross arms',(-.10,0,2.28),(.10,0,2.28),.02,gold,p)
def library():
 p=roots['slub_surface']
 for x in [-1.43,1.43]:
  h=empty('SLUB aboveground volume',(x,0,0),p);box('Stone library block',(0,0,.55),(.75,2.5,1.1),ivory,h);windows(h,.76,2.51,1.1,rows=2)
  for y in [-.85,-.28,.28,.85]:box('Tall narrow side window',(-.39,y,.56),(.024,.11,.53),dark,h)
  for z in [.24,.5,.76,1.02]:box('Facade fine horizontal grain',(0,-1.262,z),(.7,.012,.013),stone,h,.002)
 room=empty('library_interior',(3.4,-7,0),fixed)
 box('Level minus two reading room',(0,0,.25),(2.04,2.3,.11),wood,room)
 for x in [-.98,.98]:
  box('Two storey retaining wall',(x,0,.84),(.08,2.3,1.18),brick,room)
  for z in [.40,.64,.91]:
   box('Bookshelf',(x*.91,0,z),(.13,2.12,.06),wood,room)
   for y in [-.93,-.72,-.51,-.30,-.09,.12,.33,.54,.75,.96]:box('Book spines',(x*.90,y,z+.10),(.08,.14,.15),roof if y>0 else red,room,.005)
 for x in [-.48,.48]:
  for y in [-.79,-.27,.25,.77]:
   box('Reading table',(x,y,.49),(.52,.33,.065),wood,room)
   for dx in [-.18,.18]:box('Table foot',(x+dx,y,.39),(.045,.23,.20),dark,room,.01)
   for dy in [-.24,.24]:box('Reading chair',(x,y+dy,.41),(.17,.16,.08),roof,room)
   box('Small reading lamp',(x,y,.61),(.17,.04,.04),light,room)
 box('Level minus one gallery',(0,1.03,1.0),(1.85,.26,.08),wood,room)
 cover=empty('pivot_library_cover',(3.4,-7,G),fixed);box('Removable toy ground section',(0,0,0),(2.1,2.4,.13),grass,cover)
 p=roots['slub_skylight'];box('Central glass roof',(0,0,0),(1.82,2.08,.075),glass,p)
 for x in [-.91,-.455,0,.455,.91]:box('Glass roof mullion',(x,0,.05),(.025,2.11,.045),ivory,p,.005)
 for y in [-1.04,-.52,0,.52,1.04]:box('Glass roof crossbar',(0,y,.05),(1.85,.025,.045),ivory,p,.005)
bridge();church();library()
if not SAMPLE:
 p=roots['paddle_steamer'];sphere('Long wooden hull',(0,0,.10),(.84,.29,.15),ivory,p);box('Passenger deck',(0,0,.22),(1.45,.48,.10),wood,p)
 box('Long cabin',(0,0,.37),(1.02,.36,.23),ivory,p);box('Cabin canopy',(0,0,.51),(1.14,.48,.06),ivory,p)
 for x in [-.43,-.24,-.05,.14,.33]:
  for y in [-.19,.19]:box('Cabin blue window',(x,y,.39),(.11,.018,.11),glass,p)
 cyl('Funnel',(0,0,.64),.064,.24,dark,p);cyl('Funnel ochre band',(0,0,.65),.068,.07,yellow,p)
 for y in [-.34,.34]:
  v=empty('pivot_paddle_'+('port' if y>0 else 'starboard'),(0,y,.20),p)
  for i in range(8):a=i*math.tau/8;beam('Paddle spoke',(0,0,0),(.19*math.cos(a),0,.19*math.sin(a)),.018,red,v);o=box('Paddle blade',(.19*math.cos(a),0,.19*math.sin(a)),(.07,.13,.08),wood,v);o.rotation_euler.y=-a
 p=roots['yellow_tram'];box('Yellow rounded tram',(0,0,.28),(.55,1.3,.43),yellow,p,.10);box('Tram roof',(0,0,.52),(.56,1.32,.08),ivory,p,.05)
 for y in [-.44,-.14,.16,.46]:
  for x in [-.284,.284]:box('Tram side glazing',(x,y,.35),(.02,.22,.20),dark,p,.02)
 for y in [-.66,.66]:box('Driver windscreen',(0,y,.36),(.39,.02,.21),glass,p);box('Headlamp',(0,y,.16),(.26,.025,.055),ivory,p)
 for y in [-.4,.4]:
  for x in [-.24,.24]:o=cyl('Steel wheel',(x,y,.07),.085,.065,dark,p,16);o.rotation_euler.y=math.pi/2
 for x in [-.12,.12]:beam('Pantograph leg',(x,-.2,.56),(x,.1,.82),.016,dark,p);beam('Pantograph return',(x,.1,.82),(x,.25,.65),.016,dark,p)
 beam('Contact shoe',(-.22,.1,.83),(.22,.1,.83),.02,dark,p)
 p=roots['river_pier'];box('Wooden floating pier',(0,.45,0),(1.3,1.2,.14),wood,p)
 for x in [-.57,.57]:cyl('Mooring bollard',(x,.9,.16),.065,.25,dark,p)
 for y in [0,.3,.6,.9]:box('Pier deck seam',(0,y,.08),(1.25,.02,.01),dark,p,.003)
 p=roots['riverside_trees']
 for x in [-.75,0,.75]:tree(x,0,0,p,.8)
 # Semperoper: curved front arcade, distinct stage roof and central sculptural group.
 p=roots['semperoper'];box('Opera rear stage',(0,.25,.66),(2.65,1.55,1.32),stone,p);pitched('Opera stage roof',(0,.25,1.32),2.73,1.6,.45,roof,p)
 for i in range(11):
  a=math.pi*(i/10);x=1.35*math.cos(a);y=-.36-.62*math.sin(a)
  box('Arcade bay',(x,y,.64),(.22,.24,1.15),ivory,p)
  for z in [.34,.87]:box('Opera arched window',(x,y-.135,z),(.12,.022,.31),dark,p,.045)
  cyl('Facade column',(x-.12,y-.17,.62),.035,1.20,stone,p,12)
 box('Central portal',(0,-1.06,.63),(.6,.20,1.26),stone,p);box('Portal opening',(0,-1.17,.34),(.32,.025,.52),dark,p,.07)
 box('Sculpture plinth',(0,-.78,1.45),(.55,.32,.16),ivory,p)
 for x in [-.18,.18]:sphere('Panther quadriga toy sculpture',(x,-.79,1.68),(.10,.24,.14),dark,p)
 p=roots['zwinger_galleries'];box('Open courtyard',(0,0,.02),(3.1,2.35,.045),grass,p)
 for y in [-1.08,1.08]:
  spans=[(-1.1,1.2),(1.1,1.2)] if y<0 else [(0,3.4)]
  for x,w in spans:box('Long gallery',(x,y,.44),(w,.32,.87),stone,p);box('Gallery balustrade',(x,y,.9),(w+.05,.4,.08),ivory,p)
  for x in [-1.42,-1.08,-.74,-.4,0,.4,.74,1.08,1.42]:
   if y>0 or abs(x)>.55:box('Arcade dark recess',(x,y-.17,.43),(.21,.03,.52),dark,p,.07)
 for x in [-1.64,1.64]:
  box('Side gallery',(x,0,.43),(.34,2.1,.85),stone,p)
  for y in [-.7,0,.7]:box('Side arcade',(x-.18,y,.43),(.03,.34,.52),dark,p,.06)
 for x in [-1.6,1.6]:
  for y in [-1.03,1.03]:cyl('Corner pavilion',(x,y,.64),.32,1.28,ivory,p,8);sphere('Pavilion copper roof',(x,y,1.32),(.36,.36,.25),roof,p)
 p=roots['zwinger_crown_gate']
 for x in [-.4,.4]:box('Crown gate pier',(x,0,.61),(.28,.5,1.22),ivory,p);cyl('Gate paired column',(x,-.29,.6),.055,1.2,stone,p)
 box('Gate lintel',(0,0,1.22),(1.04,.58,.20),ivory,p);lathe('Onion crown base',[(.48,1.31),(.49,1.43),(.31,1.62),(.27,1.80),(.17,1.95)],roof,p)
 for i in range(6):a=i*math.tau/6;beam('Golden crown rib',(.23*math.cos(a),.23*math.sin(a),1.82),(.12*math.cos(a),.12*math.sin(a),2.08),.032,gold,p)
 cyl('Crown circlet',(0,0,2.10),.17,.10,gold,p);sphere('Crown finial',(0,0,2.26),(.09,.09,.11),gold,p)
 p=roots['beyer_body'];box('Beyer long brick wing',(0,0,.65),(3.2,1.25,1.3),brick,p);pitched('Steep Beyer roof',(0,0,1.3),3.35,1.38,.43,dark,p);windows(p,3.2,1.25,1.3,light,3)
 for x in [-1.45,0,1.45]:box('Brick pilaster',(x,-.65,.68),(.12,.10,1.35),stone,p)
 # Supporting tower core remains part of body/support so tower-first is stable.
 box('Observatory lower brick tower',(.85,.2,.9),(.83,.85,1.8),brick,p)
 p=roots['beyer_tower'];cyl('Octagonal observatory tower',(0,0,.57),.44,1.15,ivory,p,8)
 for i in range(8):a=i*math.tau/8;beam('Observatory vertical glazing bar',(.44*math.cos(a),.44*math.sin(a),.05),(.44*math.cos(a),.44*math.sin(a),1.1),.028,roof,p)
 cyl('Observatory glazed drum',(0,0,1.30),.37,.32,glass,p,24);sphere('Observatory copper dome',(0,0,1.5),(.4,.4,.33),roof,p)
 beam('Dome slit',(-.03,-.40,1.48),(-.03,0,1.83),.025,dark,p)
 p=roots['campus_bikes']
 for x in [-.5,0,.5]:
  for y in [-.2,.2]:
   bpy.ops.mesh.primitive_torus_add(major_radius=.17,minor_radius=.024,major_segments=20,minor_segments=8,location=(x,y,.2),rotation=(0,math.pi/2,0));finish(bpy.context.object,'Bicycle wheel',dark,p)
  beam('Bike frame',(x,-.2,.2),(x,0,.44),.022,roof,p);beam('Bike frame',(x,0,.44),(x,.2,.2),.022,roof,p);beam('Bike frame',(x,-.2,.2),(x,.2,.2),.022,roof,p)
 box('Bike rack',(0,0,.07),(1.4,.14,.08),wood,p)
 p=roots['street_houses'];house(p,(-.7,0,0),1.15,.95,.9,ivory);house(p,(.7,0,0),1.15,.95,1.2,stone)
 # Original bakery shell remains fixed so the facade can be freely assembled.
 house(fixed,(5.5,-4.35,G),1.35,.95,1.1,ivory)
 p=roots['bakery_front'];box('Bakery facade',(0,-.10,.54),(1.12,.14,1.08),roof,p);box('Shop window',(0,-.19,.64),(.82,.025,.46),glass,p)
 aw=box('Striped shop awning',(0,-.38,1.03),(1.22,.58,.09),ivory,p);aw.rotation_euler.x=.16
 for x in [-.5,-.25,0,.25,.5]:box('Ochre awning stripe',(x,-.38,1.083),(.11,.52,.014),yellow,p,.004)
 for x in [-.27,0,.27]:sphere('Original bread display',(x,-.24,.43),(.12,.08,.055),wood,p)
 p=roots['bench_scene']
 for y in [-.14,0,.14]:box('Bench seat slat',(0,y,.25),(.9,.10,.06),wood,p)
 for z in [.40,.53]:box('Bench back slat',(0,.2,z),(.9,.07,.08),wood,p)
 for x in [-.33,.33]:box('Bench leg',(x,0,.13),(.07,.35,.22),dark,p)
 sphere('Toy backpack',(.52,0,.2),(.14,.10,.17),red,p)

# Batch static meshes by immediate semantic parent + material. Pivots remain separate.
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
 groups={}
 for o in list(parent.children):
  if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
 for material_name,objects in groups.items():
  if len(objects)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=parent.name+'_'+material_name
if SAMPLE:
 allowed={'augustus_bridge','frauenkirche_body','frauenkirche_dome','slub_surface','slub_skylight'}
 for id in roots:
  if id not in allowed:
   for o in list(roots[id].children_recursive)+[roots[id]]:bpy.data.objects.remove(o,do_unlink=True)
metadata={'version':'0.2.0','coordinateSystem':'Blender east/north/up; glTF x/z east/south, y up','pieces':[{'id':id,'label':label,'group':group} for id,label,group,loc,anchor in spec],'geography':'城市位置经过简化，距离不按比例。','routeNote':'盒中游览线，为游戏简化，不是真实公交线路。','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'blender':bpy.app.version_string}
blend=OUT/'samples.blend' if SAMPLE else Path(__file__).parent/'dresden-river-campus.blend'
for image in bpy.data.images:
 if image.packed_file:image.filepath='//ash-grain.png'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
# Blender also serializes file-browser history and packed-image original paths.
# Replace only null-terminated absolute Windows path strings, preserving each
# field's byte length and all binary block offsets. The image remains packed.
payload=blend.read_bytes()
for absolute in set(re.findall(rb'[A-Za-z]:[\\/][\x20-\x7e]{3,512}(?=\x00)',payload)):
 relative=b'//ash-grain.png' if absolute.endswith(b'ash-grain.png') else b'//'
 payload=payload.replace(absolute+b'\0',relative+b'\0'*(len(absolute)-len(relative)+1))
blend.write_bytes(payload)
glb=OUT/('samples.glb' if SAMPLE else 'dresden-river-campus.glb')
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
metadata.update(bytes=glb.stat().st_size,glbSha256=hashlib.sha256(glb.read_bytes()).hexdigest(),blendSha256=hashlib.sha256(blend.read_bytes()).hexdigest())
(OUT/'export.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
print('DRESDEN_EXPORT',json.dumps(metadata,ensure_ascii=True))
