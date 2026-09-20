import json,struct,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];layouts=json.loads((root/'games/oddity-puzzles/layout.json').read_text('utf8'));rows=[]
for l in layouts:
 p=root/f'public/assets/oddity-puzzles/room-{l["id"]}.glb';raw=p.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);nodes={n.get('name'):n for n in g['nodes']}
 for n in l['nodes']:
  assert 'nav_'+n['id'] in nodes
  actual=nodes['nav_'+n['id']].get('translation',[0,0,0]);assert all(abs(a-b)<1e-5 for a,b in zip(actual,n['p'])),(n,actual)
 for w in l['walls']:
  exported=json.loads(nodes['wall_'+w['id']]['extras']['collider']);assert exported==w
 for prop in l['props']:assert json.loads(nodes['collision_'+prop['id']]['extras']['collider'])==prop
 for o in l['objects']:assert nodes['item_'+o['id']]['extras']['entityId']==o['id']
 required=['eye_a','hand_a']+({1:['pivot_lamp','beam_origin'],2:['hinge_door','lock_anchor'],3:['eye_b','hand_b','eye_npc','hand_npc','tray_anchor','photo_entry','photo_exit','hinge_door']}[l['id']])
 assert all(n in nodes for n in required)
 for actor_id in ['a']+(['b','npc'] if l['id']==3 else []):
  for kind in ['eye','hand']:assert all(abs(a-b)<1e-5 for a,b in zip(nodes[kind+'_'+actor_id].get('translation',[0,0,0]),l['anchors'][kind]))
 for ability in l['abilities']:assert (root/f'public/assets/oddity-puzzles/thumb-item_{ability}.png').exists()
 assert not any('uri'in b for b in g.get('buffers',[]));assert not g.get('extensionsRequired'),g.get('extensionsRequired')
 blend=root/f'games/oddity-puzzles/blender/room-{l["id"]}.blend';assert blend.read_bytes()[:7]==b'BLENDER'
 rows.append(dict(level=l['id'],glbBytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),blendBytes=blend.stat().st_size,meshes=len(g['meshes']),anchors=required,layoutCollidersMatch=True,navigationMatch=True))
print(json.dumps({'result':'PASS','rooms':rows},indent=2))
