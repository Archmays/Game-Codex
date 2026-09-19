"""Original miniature, deterministic Blender 4.5 LTS authoring. Run with -- --samples for first-piece inspection."""
import bpy, math, random, sys, json, struct, hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np

random.seed(190926)
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/world-in-a-box'
SOURCE = Path(__file__).resolve().parent
SAMPLES = '--samples' in sys.argv
if SAMPLES:
    OUT = ROOT / 'tmp/tasks/world-box-r2/samples'
    SOURCE = OUT
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.preferences.filepaths.save_version = 0

def texture():
    n=512; y,x=np.mgrid[0:n,0:n].astype(float)/n
    grain=np.sin(2*math.pi*(y*49+0.45*np.sin(x*13)+0.17*np.sin(x*29)))
    fine=np.sin(2*math.pi*(y*161+0.15*np.sin(x*39)))
    shade=0.87+0.022*grain+0.009*fine
    rgba=np.ones((n,n,4),dtype=np.float32)
    for k,v in enumerate([0.91,0.73,0.50]): rgba[:,:,k]=shade*v
    im=bpy.data.images.new('Long-grain ash • original',width=n,height=n)
    im.pixels.foreach_set(rgba.ravel()); im.filepath_raw=str(OUT/'ash-grain.png'); im.file_format='PNG'; im.save(); im.pack()
    return im
grain=texture()
def mat(name, color, wood=False, rough=.78, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if wood:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=grain
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    return m
wood=mat('Oiled ash / image PBR',(.76,.54,.31),True)
dark=mat('Endgrain walnut',(.25,.12,.064)); cream=mat('Warm chalk paint',(.79,.73,.60)); sage=mat('Sage paint',(.24,.40,.33))
blue=mat('Glazed seafoam',(.31,.57,.59),rough=.4); clay=mat('Terracotta',(.63,.29,.17)); leaf=mat('Olive leaves',(.26,.40,.17)); leaf2=mat('Young leaves',(.43,.54,.24))
linen=mat('Ochre linen',(.77,.55,.27)); ivory=mat('Paper',(.88,.82,.66)); brass=mat('Brushed brass',(.58,.37,.14),rough=.5,metal=.55)
ink=mat('Engraved dark details',(.105,.085,.066)); tea=mat('Tea',(.17,.08,.028),rough=.28); pink=mat('Ear inset',(.62,.30,.22))

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o
fixed=empty('fixed_world')
def finish(o,name,material,parent,bevel=0):
    o.name=name; o.data.materials.append(material); o.parent=parent
    if bevel:
        mod=o.modifiers.new('Soft carved edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def box(name,loc,size,material=wood,parent=fixed,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,parent,bevel)
def uvgrain(o):
    # Long grain follows each board's longest local axis. Box UVs use authored mesh dimensions.
    if o.type!='MESH' or not o.data.uv_layers: return
    dims=o.dimensions; axis=max(range(3),key=lambda i:dims[i]); other=(axis+1)%3
    uv=o.data.uv_layers.active.data
    for face in o.data.polygons:
        for li in face.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            uv[li].uv=(co[axis]/max(dims[axis],.1)+.5,co[other]/max(dims[other],.1)*.38+.5)
def cyl(name,loc,radius,depth,material=wood,parent=fixed,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    return finish(bpy.context.object,name,material,parent,.018)
def ellipsoid(name,loc,size,material,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc); o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,material,parent)
def curve(name,points,radius,material,parent):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=18; c.bevel_depth=radius; c.bevel_resolution=4
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.parent=parent; o.data.materials.append(material)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False); return o
def lathe(name,profile,material,parent):
    verts=[]; faces=[]; n=64
    for r,z in profile:
        verts.extend([(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for i in range(n)])
    for j in range(len(profile)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(material)
    for p in mesh.polygons:p.use_smooth=True
    return o
def triangular_ear(name,x,parent):
    verts=[(x-.15,-.1,.81),(x+.15,-.1,.81),(x+.10,-.07,1.17),(x-.15,.11,.81),(x+.15,.11,.81),(x+.10,.06,1.17)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,wood,parent,.04)

IDS=['shutter_left','shutter_right','curtain','wind_chime','plant','cup','book','cat']
POSITIONS={ 'shutter_left':(-1.59,.83,1.72),'shutter_right':(1.59,.83,1.72),'curtain':(.88,.40,3.57),'wind_chime':(2.34,1.22,3.12),'plant':(-1.02,.32,1.52),'cup':(-1.48,-1.10,1.26),'book':(-.18,-1.09,1.27),'cat':(1.68,-.83,.80)}
roots={}; slots={}
for id in IDS:
    roots[id]=empty('piece_'+id,POSITIONS[id]);roots[id]['pieceId']=id
    slots[id]=empty('slot_'+id,POSITIONS[id]);slots[id]['accepts']='shutter' if id.startswith('shutter') else id
    empty('anchor_'+id, (0,-.02,.06) if id not in ['shutter_left','shutter_right','curtain','wind_chime'] else ((.76,-.12,.73) if id=='shutter_left' else (-.76,-.12,.22) if id=='shutter_right' else (0,-.12,.10) if id=='curtain' else (0,.16,-.53)),slots[id])

def cup():
    p=roots['cup'];empty('interaction_cup',(0,-.2,.30),p);lathe('Cup • rounded lip and thick inner wall',[(0,0),(.23,0),(.28,.035),(.30,.38),(.295,.43),(.27,.445),(.248,.425),(.245,.10),(.21,.075),(0,.075)],blue,p)
    curve('Cup • integral loop handle',[(.26,0,.34),(.46,0,.37),(.51,0,.23),(.44,0,.10),(.28,0,.12)],.046,blue,p)
    cyl('Tea surface',(0,0,.31),.247,.012,tea,p)
    curve('Cup incised band',[(-.26,-.13,.14),(0,-.29,.14),(.26,-.13,.14)],.011,ivory,p)
def cat():
    p=roots['cat'];empty('interaction_cat',(0,-.3,.45),p);# A single sculpted body silhouette, with muzzle/ears and separate articulated tail.
    profile=[(.30,0),(.38,.09),(.39,.27),(.30,.53),(.32,.68),(.34,.82),(.26,.99),(.09,1.02),(0,1.025)]
    body=lathe('Cat • carved continuous silhouette',profile,wood,p)
    triangular_ear('Cat left ear',-.19,p);triangular_ear('Cat right ear',.19,p)
    for x in [-.13,.13]:
        curve('Cat smiling eye',[(x-.05,-.302,.82),(x,-.325,.845),(x+.05,-.302,.82)],.013,ink,p)
        ellipsoid('Cat cheek',(x,-.292,.70),(.11,.065,.065),cream,p)
        box('Cat paw',(x,-.29,.06),(.20,.19,.13),wood,p,.055)
    ellipsoid('Cat nose',(0,-.36,.73),(.038,.02,.024),pink,p)
    curve('Cat mouth',[(0,-.358,.71),(0,-.35,.68),(.05,-.329,.665)],.009,ink,p)
    t=empty('pivot_tail',(.28,.14,.18),p)
    curve('Cat • independent curled tail',[(0,0,0),(.31,.04,.05),(.42,.02,.28),(.39,-.015,.48),(.26,-.04,.47)],.075,wood,t)
def shutter(id,sign):
    p=roots[id];v=empty('pivot_'+id,(0,0,0),p)
    empty('interaction_'+id,(.14*sign,-.19,.75),v)
    center=.78*sign
    for x in [.10*sign,1.45*sign]:box('Shutter stile',(x,0,.78),(.15,.14,1.57),sage,v,.045)
    for z in [.07,1.48]:box('Shutter rail',(center,0,z),(1.49,.16,.16),sage,v,.04)
    for j in range(7):
        o=box('Shutter slat',(center,.015,.24+j*.173),(1.27,.085,.16),sage,v,.025);o.rotation_euler.x=-.12
    for z in [.23,1.31]:
        cyl('Visible brass hinge',(0,0,z),.055,.20,brass,v)
        box('Hinge plate',(.12*sign,-.09,z),(.23,.032,.09),brass,v,.013)
    ellipsoid('Shutter knob',(1.28*sign,-.145,.75),(.065,.055,.065),wood,v)
    box('Uninstalled wooden shutter cover',(center,0,.78),(1.49,.13,1.56),wood,slots[id],.05)
cup();cat();shutter('shutter_left',1)
box('Thick rounded ash foundation',(0,-.10,.05),(5.65,4.28,.34),wood,bevel=.15)
if not SAMPLES:
    shutter('shutter_right',-1)
    # The wall is built around an actual opening. No invisible wall or sky plane blocks an outside view.
    for x in [-2.21,2.21]:box('Limewashed wall pier',(x,.96,1.95),(1.00,.27,3.52),cream,bevel=.07)
    box('Wall under window',(0,.96,.88),(3.5,.27,1.39),cream)
    box('Wall lintel',(0,.96,3.53),(3.5,.27,.36),cream)
    for x in [-1.68,1.68]:box('Deep window jamb',(x,.78,2.46),(.16,.40,1.90),wood)
    for z in [1.60,3.35]:box('Window frame rail',(0,.78,z),(3.53,.41,.16),wood)
    box('Deep window sill',(0,.56,1.49),(3.8,.88,.14),wood,bevel=.05)
    box('Wall skirting',(0,.76,.37),(5.35,.12,.23),wood)
    for x in [-2.0,2.0]:
        cyl('Curtain rod support',(x,.47,3.49),.07,.22,brass)
    rod=cyl('Curtain rod',(0,.39,3.61),.045,4.34,wood);rod.rotation_euler.y=math.pi/2
    for x in [-2.21,2.21]:ellipsoid('Rod finial',(x,.39,3.61),(.10,.10,.10),wood,fixed)
    # Four-legged table, mortise detail, separate coaster and book socket.
    box('Table rounded top',(-.91,-1.08,1.16),(2.57,1.46,.18),wood,bevel=.09)
    for x in [-1.94,.11]:
        for y in [-1.62,-.54]:box('Tapered table leg',(x,y,.68),(.14,.14,.94),wood,fixed,.035)
    box('Table apron',(-.91,-1.57,.99),(2.20,.10,.22),wood)
    for x in [-1.91,.10]:cyl('Joinery peg',(x,-1.632,1.0),.024,.035,dark).rotation_euler.x=math.pi/2
    cyl('Cup cork coaster',POSITIONS['cup'],.37,.04,dark)
    box('Book recessed wooden socket',(-.18,-1.09,1.257),(.84,.66,.024),dark,bevel=.03)
    cyl('Plant recessed collar',(-1.02,.32,1.53),.36,.05,dark)
    cyl('Cat round sitting platform',(1.68,-.83,.72),.68,.16,wood)
    for x in [1.3,2.06]:box('Cat seat foot',(x,-.83,.46),(.15,.73,.48),wood)
    # Rear hook attaches to fixed wall, so nothing depends on shutter placement.
    curve('Outside fixed brass hook',[(2.34,1.06,3.39),(2.34,1.48,3.40),(2.34,1.56,3.17),(2.34,1.26,3.13)],.035,brass,fixed)
    # Linen is a solid, gently folded carved surface, not a simulated cloth.
    p=roots['curtain'];v=empty('pivot_curtain',(0,0,0),p);verts=[];faces=[];nx=32;nz=16
    for j in range(nz+1):
        z=-j/nz*1.34
        for i in range(nx+1):
            x=(i/nx-.5)*.79; y=.07*math.sin(i/nx*8*math.pi)+.04*j/nz
            verts.append((x,y,z+.04*math.cos(i/nx*8*math.pi)*j/nz))
    for j in range(nz):
        for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new('Linen folds');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Curtain • soft scalloped hem',mesh);bpy.context.collection.objects.link(o);finish(o,o.name,linen,v)
    sol=o.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.025;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
    for poly in mesh.polygons:poly.use_smooth=True
    for x in [-.30,-.10,.10,.30]:curve('Curtain tab',[(x,-.04,-.035),(x,-.055,.10),(x,.065,.11),(x,.075,-.035)],.027,linen,p)
    box('Curtain socket',(.88,.40,3.59),(.82,.14,.065),wood)
    p=roots['wind_chime'];v=empty('pivot_chime',(0,0,0),p)
    curve('Hanging cord',[(0,0,0),(0,0,-.22)],.013,dark,v)
    cyl('Wind chime wooden cap',(0,0,-.24),.28,.10,wood,v)
    for i in range(5):
        a=i*2*math.pi/5;x=.2*math.cos(a);y=.2*math.sin(a);length=.40+.09*(i%3)
        curve('Bell string',[(x,y,-.28),(x,y,-.40)],.008,dark,v)
        cyl('Chime brass tube',(x,y,-.40-length/2),.031,length,brass,v)
    curve('Sail string',[(0,0,-.25),(0,0,-1.03)],.009,dark,v)
    box('Chime wooden sail',(0,0,-1.06),(.18,.04,.22),sage,v,.035)
    p=roots['plant'];lathe('Plant ceramic pot',[(0,0),(.22,0),(.28,.33),(.30,.34),(.30,.40),(.25,.40),(.23,.32)],clay,p);cyl('Pot soil',(0,0,.34),.25,.025,dark,p)
    v=empty('pivot_leaves',(0,0,.34),p)
    for i in range(9):
        a=i*2.4;h=.22+.085*i;x=.24*math.cos(a);y=.22*math.sin(a)
        curve('Leaf stem',[(0,0,0),(x*.4,y*.4,h*.6),(x,y,h)],.012,leaf,v)
        o=ellipsoid('Carved leaf',(x,y,h),(.095,.035,.20),leaf if i%2 else leaf2,v);o.rotation_euler=(.45*math.sin(a),.65*math.cos(a),a)
    p=roots['book'];box('Book cloth cover',(0,0,.025),(.78,.59,.06),sage,p,.026)
    box('Book pages left',(-.18,0,.077),(.35,.55,.07),ivory,p,.013);box('Book pages right',(.18,0,.077),(.35,.55,.07),ivory,p,.013)
    v=empty('pivot_pages',(0,0,.11),p);o=box('Turning page',(.18,0,.005),(.35,.54,.012),ivory,v,.004);o.rotation_euler.y=-.10
    for i in range(5):box('Printed book line',(-.17,-.16+i*.075,.116),(.22,.008,.004),linen,p,.001)
    # restrained lived-in detail, all fixed scenery
    box('Small woven floor mat',(.99,-1.34,.247),(1.61,1.48,.025),linen,bevel=.08)
    for i in range(13):box('Mat weave',(.99,-1.98+i*.105,.264),(1.43,.017,.008),ivory,bevel=.003)
    box('Wall picture frame',(-2.21,.763,2.73),(.59,.075,.72),wood)
    box('Wall picture paper',(-2.21,.718,2.73),(.46,.018,.58),ivory)
    curve('Picture sprig',[(-2.21,.699,2.48),(-2.20,.699,2.79),(-2.08,.699,2.90)],.012,leaf,fixed)
    for z in [2.6,2.72,2.81]:ellipsoid('Picture leaf',(-2.26,.69,z),(.075,.009,.035),sage,fixed)

# Empty sockets remain tangible interfaces; anchor positions originate here, never copied in TS.
for id in IDS:
    if id.startswith('shutter'):continue
    p=slots[id]
    if id in ['cup','plant','cat']:cyl('Socket_'+id,(0,0,.02),{'cup':.27,'plant':.25,'cat':.37}[id],.035,wood,p)
    elif id=='book':box('Socket_book',(0,0,.02),(.71,.51,.03),wood,p,.03)
    else:ellipsoid('Socket_'+id,(0,0,-.05),(.09,.09,.09),wood,p)

if SAMPLES:
    for id in IDS:
        if id not in ['cup','cat','shutter_left']:
            for o in list(roots[id].children_recursive)+[roots[id]]:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.context.scene.objects:
    if o.type=='MESH' and o.data.materials and o.data.materials[0]==wood:uvgrain(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:o.select_set(True)
bpy.context.scene['generator_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
bpy.context.scene['seed']=190926
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/('samples.blend' if SAMPLES else 'window-breeze.blend')))
bpy.ops.export_scene.gltf(filepath=str(OUT/('samples.glb' if SAMPLES else 'window-breeze.glb')),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
p=OUT/('samples.glb' if SAMPLES else 'window-breeze.glb');data=p.read_bytes();length,kind=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+length])
assert doc.get('meshes') and len(data)>1000
summary={'stage':'samples' if SAMPLES else 'final','blender':bpy.app.version_string,'seed':190926,'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(data).hexdigest(),'blendSha256':hashlib.sha256((SOURCE/('samples.blend' if SAMPLES else 'window-breeze.blend')).read_bytes()).hexdigest(),'bytes':len(data),'meshes':len(doc['meshes']),'nodes':[n.get('name') for n in doc['nodes']],'images':len(doc.get('images',[]))}
(OUT/('samples-export.json' if SAMPLES else 'export.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('EXPORT_VERIFIED',len(data),len(doc['meshes']))
