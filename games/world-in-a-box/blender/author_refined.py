"""Explicit authoring recipe. NOT run by scene exports: edit refined-models.blend freely.
Run with Blender --background --factory-startup --python author_refined.py.
Dedicated lofts, swept surfaces and apertures; coordinates remain east/north/up.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector
P=Path(__file__).parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def mat(n,c,r=.6,m=0):
 a=bpy.data.materials.new(n);a.diffuse_color=(*c,1);a.use_nodes=True;b=a.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=r;b.inputs['Metallic'].default_value=m;return a
skin=mat('R porcelain skin',(.83,.57,.46),.62);hair=mat('R platinum ivory',(.81,.76,.59),.4);hairshade=mat('R hair flow',(.72,.66,.49),.53)
blue=mat('R turquoise satin',(.028,.33,.48),.31,.12);edge=mat('R embroidered frost',(.47,.81,.91),.34,.12);cape=mat('R organza',(.32,.64,.76),.64);white=mat('R eye ivory',(.92,.93,.91),.38);iris=mat('R iris',(.018,.29,.42),.28);black=mat('R lashes',(.033,.021,.039),.58);lip=mat('R lip rose',(.48,.095,.15),.51)
stone=mat('R Elbe sandstone',(.65,.48,.30),.82);trim=mat('R cut sandstone',(.78,.64,.44),.72);old=mat('R surviving masonry',(.23,.19,.15),.92);glass=mat('R recessed glazing',(.14,.23,.23),.34);gold=mat('R gilt',(.62,.34,.08),.35,.65);rail=mat('R running rail',(.075,.065,.055),.35,.6)
ice=mat('R deep glacier',(.085,.36,.54),.24,.22);icepale=mat('R crystal edge',(.40,.72,.82),.23,.14);iceviolet=mat('R shaded crystal',(.20,.27,.48),.32,.15);frost=mat('R frosted ice',(.56,.77,.84),.56)
def root(n,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
def mesh(n,v,f,m,p,smooth=False):
 d=bpy.data.meshes.new(n);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);o.parent=p;d.materials.append(m)
 for a in d.polygons:a.use_smooth=smooth
 return o
def modifier(o,kind,**kw):
 mod=o.modifiers.new(kind,kind)
 for k,v in kw.items():setattr(mod,k,v)
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
def block(n,loc,size,m,p,b=.008):
 x,y,z=loc;a,d,h=[v/2 for v in size];v=[(x+i*a,y+j*d,z+k*h) for k in [-1,1] for j in [-1,1] for i in [-1,1]]
 o=mesh(n,v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],m,p)
 if b:modifier(o,'BEVEL',width=b,segments=2)
 return o
def sweep(n,points,radii,m,p,sides=10):
 v=[];f=[]
 for j,co in enumerate(points):
  tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);tangent.normalize();ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0));u=tangent.cross(ref).normalized();w=tangent.cross(u).normalized();r=radii[j] if isinstance(radii,list) else radii
  for i in range(sides):v.append(Vector(co)+r*(u*math.cos(math.tau*i/sides)+w*math.sin(math.tau*i/sides)))
 for j in range(len(points)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
 f.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))]);return mesh(n,v,f,m,p,True)
def loft(n,rings,m,p,N=48,smooth=True):
 # rings: z, x-radius, y-radius, y-offset; custom silhouettes, no sphere primitive.
 v=[];f=[]
 for z,rx,ry,cy in rings:
  for i in range(N):a=i*math.tau/N;v.append((rx*math.cos(a),cy+ry*math.sin(a),z))
 for j in range(len(rings)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 f.extend([tuple(reversed(range(N))),tuple((len(rings)-1)*N+i for i in range(N))]);return mesh(n,v,f,m,p,smooth)
def lathe(n,profile,m,p,N=64):return loft(n,[(z,r,r,0) for r,z in profile],m,p,N)
def animate(o,n,values):
 for frame,v in values:o.rotation_euler.x=v;o.keyframe_insert(data_path='rotation_euler',index=0,frame=frame)
 a=o.animation_data.action;a.name=n;t=o.animation_data.nla_tracks.new();t.name=n;t.strips.new(n,1,a);o.animation_data.action=None
def bezier(points,count=36):
 # Cubic Bezier, stable sampled sweep.
 a,b,c,d=map(Vector,points);return [a*(1-t)**3+b*3*t*(1-t)**2+c*3*t*t*(1-t)+d*t**3 for t in [i/(count-1) for i in range(count)]]
def elsa():
 r=root('refine_elsa');body=root('elsa_body',parent=r)
 # Neck/chest continuous loft; shoulders terminate under fitted sleeve caps.
 torso=loft('Elsa continuous shoulders and neck',[(1.15,.16,.11,0),(1.30,.23,.13,0),(1.39,.25,.12,0),(1.43,.21,.105,0),(1.47,.085,.076,0),(1.58,.073,.067,0)],skin,body)
 modifier(torso,'SUBSURF',levels=2)
 rings=[(.055,.33,.25,.015),(.14,.34,.265,.015),(.4,.29,.24,.01),(.68,.235,.19,0),(.92,.19,.145,0),(1.09,.145,.108,0),(1.21,.175,.13,0),(1.34,.22,.13,0),(1.39,.225,.128,0)]
 skirt=loft('elsa_body_dress',rings,blue,body,64)
 for v in skirt.data.vertices:
  x,y,z=v.co;a=math.atan2(y,x);t=max(0,(1.04-z)/1.04);v.co.x*=1+.035*t*math.cos(a*7+.8);v.co.y+=.016*t*t*math.cos(a*7+.8)
 modifier(skirt,'SUBSURF',levels=1)
 # Sweetheart neckline and seam shaping on the corset, quiet hem embroidery.
 sweep('Sweetheart neckline',[(x,-.132,1.385-.035*math.cos(x/.22*math.pi)) for x in [-.22+i*.44/40 for i in range(41)]],.009,edge,body)
 for side in [-1,1]:sweep('Corset seam',bezier([(side*.19,-.078,1.36),(side*.11,-.12,1.23),(side*.12,-.108,1.1),(side*.17,-.108,1.00)]),.004,edge,body,6)
 # Flowing mantle hung from shoulder line; folds fan out, hem has a train.
 v=[];f=[];nx=32;ny=24
 for j in range(ny+1):
  t=j/ny
  for i in range(nx+1):
   u=i/nx*2-1;v.append((u*(.205+.24*t),.158+.15*t+.23*t*t+.024*math.cos(u*math.pi*3)*t,1.385*(1-t)+.055+.05*u*u*t))
 for j in range(ny):
  for i in range(nx):a=j*(nx+1)+i;f.append((a,a+1,a+nx+2,a+nx+1))
 o=mesh('elsa_body_cape',v,f,cape,body,True);o['decorative']=True;modifier(o,'SOLIDIFY',thickness=.009)
 for u in [-.88,-.52,0,.52,.88]:
  pts=[]
  for j in range(20):t=j/19;pts.append((u*(.205+.24*t),.169+.15*t+.23*t*t+.024*math.cos(u*math.pi*3)*t,1.385*(1-t)+.055+.05*u*u*t))
  sweep('Mantle frost embroidery',pts,.004,edge,body,6)
 for side in [-1,1]:
  leg=root('elsa_leg_'+str(side),(side*.11,0,.52),body);loft('Ice slipper',[(-.49,.055,.10,-.03),(-.46,.065,.12,-.03),(-.4,.045,.065,0)],edge,leg,20);animate(leg,'elsa_walk_'+str(side),[(1,0),(9,side*.20),(18,-side*.20),(27,0)])
  arm=root('elsa_arm_'+str(side),(side*.218,0,1.35),body);arm.rotation_euler.y=-side*.10
  # A single tapered upper/lower arm, with a rounded shoulder cap nested in torso.
  pts=[(side*x,y,z) for x,y,z in [(0,0,.035),(.022,0,0),(.045,-.005,-.1),(.066,-.014,-.22),(.08,-.045,-.34),(.086,-.07,-.43)]]
  sweep('Fitted gauze sleeve',pts,[.045,.074,.066,.051,.04,.033],cape,arm,16)
  hand=loft('Sculpted palm',[(-.515,.023,.026,-.08),(-.49,.034,.024,-.082),(-.455,.037,.027,-.075),(-.425,.03,.028,-.07)],skin,arm,24);hand.location.x=side*.086
  sweep('Thumb',[(side*.061,-.078,-.459),(side*.045,-.089,-.483),(side*.048,-.087,-.499)],[.012,.013,.007],skin,arm)
  if side==-1:root('elsa_hand',(side*.086,-.08,-.51),arm);animate(arm,'elsa_cast',[(1,0),(12,-1.3),(32,-1.65),(55,-1.3),(72,0)])
  else:animate(arm,'elsa_wave',[(1,-.04),(12,-1.1),(20,-.85),(29,-1.2),(40,-.04)])
 head=root('elsa_head',(0,-.014,1.78),body)
 # Purpose-shaped continuous skull, cheek, jaw, eye socket, nose and lip support.
 # Dense front angular sampling follows the face rather than adding bolt-on features.
 rings=[(-.255,.018,.04,-.033),(-.235,.082,.077,-.03),(-.195,.133,.112,-.018),(-.14,.171,.14,0),(-.075,.201,.16,.006),(0,.218,.169,.008),(.075,.222,.177,.012),(.15,.207,.175,.02),(.215,.16,.142,.022),(.257,.075,.072,.02),(.268,.005,.005,.02)]
 o=loft('Continuous sculpted face',rings,skin,head,96)
 for vert in o.data.vertices:
  x,y,z=vert.co
  if y<0:
   front=max(0,-y/.18)**4
   nose=.055*math.exp(-(x/.038)**2-((z+.048)/.052)**2)+.024*math.exp(-(x/.035)**2-((z-.005)/.09)**2)
   sockets=.018*(math.exp(-((x-.095)/.061)**2-((z-.012)/.045)**2)+math.exp(-((x+.095)/.061)**2-((z-.012)/.045)**2))
   muzzle=.014*math.exp(-(x/.067)**2-((z+.136)/.035)**2)
   vert.co.y+=front*(sockets-nose-muzzle)
 modifier(o,'SUBSURF',levels=2)
 # Almond lenses recessed into sockets, shaped eyelids lie on their perimeter.
 for side in [-1,1]:
  cx=side*.096;cz=.024
  vv=[(cx,-.170,cz)];ff=[]
  for i in range(48):a=i*math.tau/48;dx=.064*math.cos(a);zz=.036*math.sin(a)*(abs(math.sin(a))**.25);vv.append((cx+dx,-.158+abs(dx)*.13,cz+zz+side*dx*.10))
  for i in range(48):ff.append((0,i+1,(i+1)%48+1))
  eye=mesh('Inset almond eye',vv,ff,white,head,True);modifier(eye,'SUBSURF',levels=1)
  for name,rad,depth,m in [('Iris',.025,-.172,iris),('Pupil',.012,-.175,black),('Eye glint',.006,-.178,white)]:
   x=cx+(-.007 if name=='Eye glint' else 0);z=cz+(.01 if name=='Eye glint' else 0);mesh(name,[(x,depth,z)]+[(x+rad*math.cos(i*math.tau/32),depth+.003,z+rad*math.sin(i*math.tau/32)) for i in range(32)],[(0,i+1,(i+1)%32+1) for i in range(32)],m,head,True)
  pts=[(cx+.064*math.cos(a),-.158+abs(.064*math.cos(a))*.13-.004,cz+.036*math.sin(a)+side*.064*math.cos(a)*.10) for a in [i*math.pi/24 for i in range(25)]];sweep('Upper lash line',pts,.006,black,head,8)
  sweep('Expressive swept brow',bezier([(side*.037,-.164,.107),(side*.077,-.17,.125),(side*.14,-.14,.105),(side*.161,-.117,.094)]),[.009*(1-i/40)+.002 for i in range(36)],hairshade,head,8)
 # Lips are a thin inset sculpted ribbon following muzzle, not a tubular smile.
 v=[]
 for i in range(25):
  x=(i/24*2-1)*.052;t=x/.052;y=-.150-.015*(1-t*t);z=-.138+.009*t*t
  v.extend([(x,y,z+.009*(1-abs(t))*(1-.45*math.exp(-(t/.22)**2))),(x,y-.002,z-.009*(1-t*t))])
 mesh('Shaped lip surface',v,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(24)],lip,head,True)
 # Hair cap has a shaped hairline and volume flowing toward the rear gathering.
 v=[];f=[];N=64;M=14
 for j in range(M+1):
  t=j/M
  for i in range(N):
   a=i*math.tau/N;front=max(0,-math.sin(a));bottom=-.14+.285*front;phi=t*(math.pi/2+(0.1-bottom)*2.6);v.append((.228*math.sin(phi)*math.cos(a),.035+.190*math.sin(phi)*math.sin(a),.092+.205*math.cos(phi)))
 for j in range(M):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 mesh('Swept hair mass',v,f,hair,head,True)
 for j in range(7):
  t=j/6;pts=bezier([(.16-.105*t,-.105-.055*t,.16+.035*t),(-.03-.10*t,-.20+.025*t,.48-.025*t),(-.29,-.06+.08*t,.30-.065*t),(-.17,.14,.015+.10*t)])
  sweep('Side swept sculpted lock',pts,[.027*math.sin(math.pi*i/35)**.45+.002 for i in range(36)],hair,head,12)
 for j in range(7):
  x=-.16+j*.05;pts=bezier([(x,.045,.27-abs(x)*.3),(x,.18,.24),(x*.6+.06,.235,.06),(.14,.17,-.10)])
  sweep('Gathered nape hair flow',pts,[.013*math.sin(math.pi*i/35)**.5+.003 for i in range(36)],hair,head,10)
 # Three genuinely interwoven continuous tapered strands travel from nape over left shoulder.
 for strand in range(3):
  pts=[];rads=[]
  for i in range(121):
   t=i/120;phase=t*math.tau*4.7+strand*math.tau/3;cx=.14+.105*math.sin(t*math.pi*.7);cy=.14-.33*min(1,t*2);z=1.78-.66*t;radius=.039*(1-.72*t)
   pts.append((cx+radius*math.cos(phase),cy+.032*(1-.7*t)*math.sin(phase),z));rads.append(.032*(1-.79*t))
  sweep('Woven braid strand '+str(strand),pts,rads,hair if strand!=1 else hairshade,body,10)
 sweep('Braid tapered tip',[(.225,-.19,1.13),(.228,-.192,1.08),(.20,-.188,1.045)],[.025,.022,.001],hair,body)
 return r

def arch_outline(w,h,base=0,N=20):
 r=w/2;return [(-r,base),(r,base)]+[(r*math.cos(a),base+h-r+r*math.sin(a)) for a in [i*math.pi/N for i in range(N+1)]]
def extrude(n,outline,depth,m,p,y=0):
 N=len(outline);v=[(x,y+d,z) for d in [-depth/2,depth/2] for x,z in outline];f=[tuple(range(N)),tuple(reversed(range(N,2*N)))]+[(i,i+N,(i+1)%N+N,(i+1)%N) for i in range(N)];return mesh(n,v,f,m,p)
def arch_ring(n,w,h,t,depth,m,p,loc=(0,0,0)):
 inner=arch_outline(w,h);outer=arch_outline(w+2*t,h+t,base=-t);N=len(inner);v=[(x+loc[0],loc[1]+y,z+loc[2]) for y in [-depth/2,depth/2] for outline in [inner,outer] for x,z in outline];f=[]
 for i in range(N):
  k=(i+1)%N;f.extend([(i,k,N+k,N+i),(2*N+i,3*N+i,3*N+k,2*N+k),(i,2*N+i,2*N+k,k),(N+i,N+k,3*N+k,3*N+i)])
 return mesh(n,v,f,m,p)
def church():
 body=root('refine_church_body');dome=root('refine_church_dome')
 # Chamfered square core; every face receives a genuinely recessed aperture bay.
 poly=[(-.83,-1),(.83,-1),(1,-.83),(1,.83),(.83,1),(-.83,1),(-1,.83),(-1,-.83)]
 v=[(x,y,z) for z in [0,1.91] for x,y in poly];faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)];core=mesh('Church chamfered masonry core',v,faces,stone,body)
 # Four wide bays carve deep recesses into all principal sides (not pasted windows).
 for side in range(4):
  a=side*math.pi/2;bay=root('Facade bay',(0,0,0),body);bay.rotation_euler.z=a
  for x in [-.51,0,.51]:
   cutter=extrude('temporary aperture',arch_outline(.28,.92,.63),.40,stone,None,y=-.99);cutter.location.x=x;cutter.rotation_euler.z=a;cutter.location=Vector((x,-.99,0)); # bake orientation around world origin
   for ve in cutter.data.vertices:ve.co.y+=.99
   cutter.location=Vector((x*math.cos(a)+.99*math.sin(a),x*math.sin(a)-.99*math.cos(a),0))
   mod=core.modifiers.new('Recess','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;mod.solver='EXACT';bpy.context.view_layer.objects.active=core;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
   arch_ring('Carved window reveal',.28,.92,.026,.05,trim,bay,(x,-1.022,.63));pane=extrude('Recessed leaded window',arch_outline(.275,.914,.633),.012,glass,bay,y=-.80);pane.location.x=x
   for dx in [-.065,0,.065]:block('Lead vertical',(x+dx,-.815,1.07),(.009,.015,.83),trim,bay,0)
   for z in [.80,.97,1.14,1.31]:block('Lead transom',(x,-.815,z),(.27,.015,.009),trim,bay,0)
  for x in [-.82,-.29,.29,.82]:
   block('Pilaster base',(x,-1.045,.5),(.115,.11,.12),trim,bay);block('Fluted pilaster',(x,-1.02,1.08),(.067,.065,1.09),trim,bay);block('Pilaster capital',(x,-1.045,1.63),(.13,.11,.10),trim,bay)
  # The central lower portal is recessed, with a deep jamb and actual dark interior.
  cutter=extrude('temporary portal',arch_outline(.24,.40,.045),.40,stone,None);cutter.rotation_euler.z=a;cutter.location=(.99*math.sin(a),-.99*math.cos(a),0)
  mod=core.modifiers.new('Portal recess','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;mod.solver='EXACT';bpy.context.view_layer.objects.active=core;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
  arch_ring('Portal archivolt',.24,.40,.05,.13,trim,bay,(0,-1.055,.045));extrude('Portal interior',arch_outline(.24,.40,.045),.015,glass,bay,y=-.80)
  for z,h,over in [(0.08,.16,.03),(.49,.065,.04),(1.72,.065,.09),(1.84,.08,.13),(1.91,.065,.09)]:block('Continuous horizontal cornice',(0,-1-over/2,z),(2.1,over+.06,h),trim,bay)
  extrude('Axial baroque pediment',[(-.46,1.92),(.46,1.92),(0,2.16)],.10,stone,bay,y=-1.035)
  sweep('Pediment raking cornice',[(-.49,-1.10,1.93),(0,-1.10,2.20),(.49,-1.10,1.93)],.027,trim,bay,8)
  arch_ring('Pediment oculus reveal',.11,.12,.018,.04,trim,bay,(0,-1.11,1.98));extrude('Pediment inset',arch_outline(.11,.12,1.98),.018,glass,bay,y=-1.10)
  # Organized surviving masonry, darker lower bays rather than random confetti.
  for row in range(5):
   for col in range(4):
    if (side==2 and col<3-row//2) or (side==1 and col==0 and row<3):block('Surviving stone course',(-.77+col*.16+(row%2)*.04,-1.007,.16+row*.063),(.148,.013,.055),old,bay,.002)
 # Four corner stair turrets with proper square -> octagonal -> concave roof transitions.
 for x in [-.84,.84]:
  for y in [-.84,.84]:
   p=root('Stair turret',(x,y,1.89),body);lathe('Octagonal turret',[(.18,0),(.18,.13),(.14,.16),(.14,.37),(.18,.40)],trim,p,8);lathe('Corner curved cap',[(.20,.4),(.15,.46),(.12,.57),(.06,.66),(.023,.72)],stone,p,32);lathe('Corner finial',[(.028,.70),(.035,.75),(.01,.81)],gold,p,16)
 # Dome root remains at old 1.4 datum; the .55 raised drum joins the new body.
 profile=[(.88,.50),(.90,.55),(.91,.62),(.87,.69),(.79,.75),(.72,.86),(.71,.99),(.76,1.15),(.78,1.29),(.75,1.44),(.68,1.59),(.56,1.73),(.39,1.85),(.27,1.89)]
 lathe('Continuous stone bell',profile,stone,dome,96)
 for radius,z in [(.91,.59),(.78,1.25),(.275,1.90)]:lathe('Dome course',[(radius,z-.022),(radius+.015,z),(radius,z+.022)],trim,dome)
 for i in range(8):
  a=i*math.tau/8;sweep('Meridian stone rib',[(r*math.cos(a),r*math.sin(a),z) for r,z in profile[3:]],.012,trim,dome,6)
  p=root('Dome dormer',(.77*math.cos(a),.77*math.sin(a),.75),dome);p.rotation_euler.z=a+math.pi/2
  arch_ring('Dormer frame',.16,.27,.025,.09,trim,p);extrude('Dormer inset',arch_outline(.16,.27),.03,glass,p,y=.028)
 lathe('Lantern foot',[(.28,1.89),(.30,1.93),(.29,1.98)],trim,dome)
 for i in range(8):
  a=i*math.tau/8;p=root('Lantern open arcade',(.23*math.cos(a),.23*math.sin(a),1.98),dome);p.rotation_euler.z=a+math.pi/2;arch_ring('Open lantern arch',.14,.32,.035,.065,trim,p)
 lathe('Lantern roof',[(.31,2.33),(.32,2.36),(.25,2.40),(.13,2.47),(.06,2.54),(.02,2.59)],stone,dome)
 sweep('Cross stem',[(0,0,2.57),(0,0,2.79)],.012,gold,dome);sweep('Cross arms',[(-.065,0,2.71),(.065,0,2.71)],.012,gold,dome)
 return body,dome

def crystal(n,loc,width,height,m,p):
 # Hexagonal blade with asymmetric shoulder bevel, tall prism and pointed termination.
 o=lathe(n,[(width*.72,0),(width,.08*height),(width*.88,.67*height),(width*.64,.79*height),(.001,height)],m,p,6);o.location=loc
 for f in o.data.polygons:f.use_smooth=False
 return o
def palace():
 support=root('refine_palace_support');cx=-.3
 # Open radial hall: platform steps to nave, faceted rear buttresses, no opaque roof shell.
 p=root('Hall structural frame',(cx,4,1.53),support)
 lathe('Snowflake nave dais',[(1.28,-.05),(1.36,0),(1.36,.08),(1.25,.13)],frost,p,12)
 for side in [-1,1]:
  # Rear structural piers carry the roof even before any user piece is installed.
  crystal('Permanent rear buttress',(side*1.48,1.15,-.05),.15,2.98,icepale,p)
  pts=[(side*1.48,1.15,2.6),(side*1.13,.92,2.88),(side*.68,.9,2.92),(0,1,2.92)];sweep('Rear crown load path',pts,.075,icepale,p,6)
  sail=mesh('Rear radial vault petal',[(side*2.1,.65,1.8),(side*1.48,1.15,2.65),(0,1,2.92),(side*.72,.82,2.58)],[(0,1,3),(1,2,3)],ice,p);modifier(sail,'SOLIDIFY',thickness=.045)
  for j in range(4):
   y=.0+j*.35;x=side*(2.45-.06*j);crystal('Perimeter crystal baluster',(x,y,.03),.035,.55,icepale,p)
  sweep('Side gallery handrail',[(side*2.45,0,.62),(side*2.40,.6,.62),(side*2.27,1.18,.62)],.035,icepale,p,6)
 sweep('Chandelier cantilever',[(cx,5,4.45),(cx,4.05,4.45),(cx,3.75,4.35)],.044,icepale,support,6)
 # Main axial back support belongs to fixed geometry, ends exactly at original spire datum.
 crystal('Main tower permanent socket',(cx,5,1.53),.30,2.92,frost,support)
 steps=root('refine_palace_steps')
 for j in range(5):
  w=1.8-j*.08;y=j*.19;z=-.26+j*.073
  outline=[(-w/2,y-.39),(w/2,y-.39),(w/2+.10,y+.30),(0,y+.40),(-w/2-.10,y+.30)]
  N=len(outline);v=[(x,y0,h) for h in [z,z+.095] for x,y0 in outline];mesh('Faceted axial stair',v,[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],icepale,steps)
 for side in [-1,1]:
  column=root('refine_palace_column_'+('left' if side==-1 else 'right'))
  crystal('Tapered portico column',(0,0,0),.18,2.43,ice,column)
  for j in range(3):crystal('Wing stepped blade',(side*(.12+.12*j),.36+j*.33,0),.13,2.35+j*.31,icepale if j%2 else ice,column)
  sweep('Vault fan',[(0,0,2.06),(-side*.35,.03,2.30),(-side*1.05,.07,2.57),(-side*2.1,.10,2.82)],.055,icepale,column,6)
  # Broad angular buttress web, thickness and directed facets instead of disconnected cones.
  web=mesh('Wing crystalline web',[(side*.1,.2,.2),(side*.46,1.02,.2),(side*.46,1.02,2.7),(side*.14,.38,2.1),(side*.24,.63,1.18)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],ice,column);modifier(web,'SOLIDIFY',thickness=.07)
 gate=root('refine_palace_gate')
 for side in [-1,1]:
  leaf=root('gate_leaf_'+str(side),(side*.85,0,0),gate)
  shape=[(0,.05),(-side*.80,.05),(-side*.80,2.23),(-side*.39,2.03),(0,1.70)]
  extrude('Thick bevel-edged ice door',shape,.12,ice,leaf)
  sweep('Door perimeter inlay',[(x,-.069,z) for x,z in shape+[shape[0]]],.022,icepale,leaf,6)
  for j in range(3):sweep('Door diamond vein',[(0,-.07,.35+j*.45),(-side*.40,-.075,.62+j*.45),(-side*.78,-.07,.35+j*.45)],.014,icepale,leaf,6)
  crystal('Door handle',(-side*.70,-.11,.89),.025,.18,icepale,leaf)
  crystal('Portal jamb',(side*.93,.035,0),.115,2.19,icepale,gate)
 sweep('Pointed portal crown',[(-.93,.035,1.92),(-.65,.035,2.28),(0,.035,2.57),(.65,.035,2.28),(.93,.035,1.92)],.085,icepale,gate,6)
 spire=root('refine_palace_spire');lathe('Crown central spear',[(.36,0),(.30,.12),(.29,.60),(.19,1.40),(.001,2.25)],ice,spire,6)
 for i in range(6):a=i*math.tau/6;crystal('Crown radial blade',(.35*math.cos(a),.35*math.sin(a),-.03),.085,1.05 if i%2 else 1.32,icepale,spire)
 chandelier=root('refine_palace_chandelier');pivot=root('chandelier_pivot',parent=chandelier)
 crystal('Central hanging jewel',(0,0,-.64),.10,.53,icepale,pivot)
 for i in range(6):
  a=i*math.tau/6;x=.47*math.cos(a);y=.47*math.sin(a);sweep('Snowflake chandelier branch',[(0,0,0),(x*.5,y*.5,-.18),(x,y,-.14)],.025,icepale,pivot,6);crystal('Pendant prism',(x,y,-.51),.059,.34,ice,pivot)

def bridge():
 p=root('refine_bridge')
 # Continuous deck at existing track datum. Three actual open elliptical arches.
 block('Bridge roadway',(0,0,1.40),(1.22,5.30,.12),stone,p)
 for cy in [-1.6,0,1.6]:
  v=[];f=[];N=32
  # Spandrel strip spans from curved intrados to deck, no black opening decal.
  for i in range(N+1):
   a=math.pi*i/N;y=cy+.70*math.cos(a);z=.57+.69*math.sin(a)
   v.extend([(-.59,y,z),(.59,y,z),(-.59,y,1.37),(.59,y,1.37)])
  for i in range(N):a=4*i;f.extend([(a,a+4,a+5,a+1),(a+2,a+3,a+7,a+6),(a,a+2,a+6,a+4),(a+1,a+5,a+7,a+3)])
  mesh('Solid open arch and spandrel',v,f,stone,p)
  for x in [-.61,.61]:
   for j in range(20):
    a=math.pi*j/20+.003;b=math.pi*(j+1)/20-.003;v=[(x+d,cy+r*math.cos(t),.57+r*.9857*math.sin(t)) for d in [-.012,.012] for r,t in [(.70,a),(.70,b),(.815,b),(.815,a)]]
    mesh('Dressed radial voussoir',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],trim,p)
 for y in [-2.4,-.8,.8,2.4]:
  # Boat passage remains clear at +/- .70; pointed cutwaters face the river current.
  outline=[(-.87,y),(-.55,y-.09),(.55,y-.09),(.87,y),(.55,y+.09),(-.55,y+.09)];v=[(x,yy,z) for z in [.24,.83] for x,yy in outline];mesh('Hexagonal river pier cutwater',v,[tuple(reversed(range(6))),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],stone,p)
  block('Pier upper masonry',(0,y,1.04),(1.22,.19,.64),stone,p)
 for x in [-.58,.58]:
  block('Projecting deck cornice',(x,0,1.405),(.12,5.30,.08),trim,p)
  block('Parapet base',(x,0,1.505),(.09,5.30,.09),stone,p)
  block('Parapet coping',(x,0,1.77),(.115,5.30,.07),trim,p)
  for j in range(29):block('Stone parapet baluster',(x,-2.55+j*5.10/28,1.64),(.067,.060,.23),trim,p,.008)
  for y in [-2.6,-.8,.8,2.6]:block('Parapet pier',(x,y,1.64),(.135,.17,.35),stone,p)
 for x in [-.23,.23]:sweep('Continuous tram rail',[(x,-2.65,1.49),(x,2.65,1.49)],.018,rail,p,8)

elsa();church();palace();bridge()
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data)
  if all(e.is_manifold for e in bm.edges):bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(o.data);bm.free()
 if o.type=='MESH' and o.active_material in [ice,icepale,iceviolet,frost]:
  for f in o.data.polygons:f.use_smooth=False
bpy.context.scene.frame_set(1)
for o in bpy.context.scene.objects:
 if o.parent is None:o['refinedSource']=True
bpy.ops.wm.save_as_mainfile(filepath=str(P/'refined-models.blend'))
print('AUTHORED_REFINED_LIBRARY',len(bpy.data.objects))
