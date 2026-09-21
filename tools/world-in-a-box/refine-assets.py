"""Read actual GLB contracts and compare protected piece geometry to starting commit."""
import json,struct,hashlib,subprocess,sys
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE='58cd16b7'
def read(raw):
 size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size]);off=20+size;size,kind=struct.unpack_from('<II',raw,off);return doc,raw[off+8:off+8+size]
def acc(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*n;stride=v.get('byteStride',size)
 return b''.join(b[start+j*stride:start+j*stride+size] for j in range(a['count']))
def shape(g,b,name):
 index=next(i for i,n in enumerate(g['nodes']) if n.get('name')==name);rows=[]
 def visit(i,parent):
  n=g['nodes'][i];t=np.eye(4)
  if 'matrix' in n:t=np.array(n['matrix']).reshape((4,4),order='F')
  else:
   x,y,z,w=n.get('rotation',[0,0,0,1]);t[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));t[:3,3]=n.get('translation',[0,0,0])
  t=parent@t
  if 'mesh' in n:
   for p in g['meshes'][n['mesh']]['primitives']:
    vs=np.frombuffer(acc(g,b,p['attributes']['POSITION']),dtype='<f4').reshape(-1,3);vs=np.column_stack([vs,np.ones(len(vs))])@t.T
    ai=p['indices'];dtype={5121:'u1',5123:'<u2',5125:'<u4'}[g['accessors'][ai]['componentType']];ids=np.frombuffer(acc(g,b,ai),dtype=dtype).reshape(-1,3)
    for tri in ids:rows.append(tuple(sorted(tuple(round(float(v),4) for v in vs[j,:3]) for j in tri)))
  for c in n.get('children',[]):visit(c,t)
 visit(index,np.eye(4));return sorted(rows)
report={'baseline':BASE,'scenes':{},'checks':[]}
for scene,file,count,changed in [('dresden','dresden-river-campus',18,{'augustus_bridge','frauenkirche_body','frauenkirche_dome'}),('frozen','frozen-elsa-playground',16,{'palace_steps','palace_column_left','palace_column_right','palace_gate','palace_spire','palace_chandelier'})]:
 path=f'public/assets/world-in-a-box/{scene}/{file}.glb';raw=(ROOT/path).read_bytes();g,b=read(raw);oldraw=subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT);og,ob=read(oldraw)
 names=[n.get('name','') for n in g['nodes']];pieces=[n['name'] for n in g['nodes'] if n.get('name','').startswith('piece_') and 'mesh' not in n];assert len(pieces)==count and len(pieces)==len(set(pieces)),pieces
 for name in pieces:assert names.count(name.replace('piece_','slot_'))==1 and names.count(name.replace('piece_','anchor_'))==1,name
 protected=[n for n in pieces if n[6:] not in changed]
 for name in protected:assert shape(g,b,name)==shape(og,ob,name),'Protected geometry changed: '+name
 if scene=='frozen':
  required=['elsa','elsa_body','elsa_head','elsa_hand','elsa_arm_1','elsa_arm_-1','elsa_leg_1','elsa_leg_-1','elsa_body_cape','gate_leaf_1','gate_leaf_-1','chandelier_pivot','seat_anna','seat_kristoff','frozen_routes']
  for name in required:assert names.count(name)==1,(name,names.count(name))
  animations=[a['name'] for a in g.get('animations',[])];assert all(n in animations for n in ['elsa_cast','elsa_wave','elsa_walk_1','elsa_walk_-1'])
  for clip in g['animations']:
   for ch in clip['channels']:assert ch['target']['node']<len(names)
 else:animations=[]
 tris=sum(g['accessors'][p['indices']]['count']//3 for mesh in g['meshes'] for p in mesh['primitives'] if p.get('mode',4)==4)
 oldtris=sum(og['accessors'][p['indices']]['count']//3 for mesh in og['meshes'] for p in mesh['primitives'] if p.get('mode',4)==4)
 assert not any('uri' in x and not x['uri'].startswith('data:') for x in g.get('buffers',[])+g.get('images',[]))
 report['scenes'][scene]={'bytes':len(raw),'beforeBytes':len(oldraw),'sha256':hashlib.sha256(raw).hexdigest(),'exportGeometryTriangles':tris,'beforeExportGeometryTriangles':oldtris,'pieceCount':count,'protectedPieceGeometryUnchanged':protected,'animations':animations,'meshCount':len(g['meshes'])}
report['checks']=['18/16 unique piece roots and matching slot/anchor identities','hand, seats, door and chandelier pivots, Elsa animation targets','all unaffected individual pieces equal transformed triangles at 0.0001 scene-unit precision (independent of exporter vertex order)','embedded buffers/textures, no external asset URI']
report['result']='PASS'
print(json.dumps(report,ensure_ascii=False,indent=2))
