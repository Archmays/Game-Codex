"""Write the single source/runtime catalogue from final on-disk bytes."""
from pathlib import Path
from PIL import Image
import hashlib,json
R=Path(__file__).resolve().parents[2]
T=R/'tmp/tasks/GAME-CODEX-V1.0'
prepared=json.loads((T/'asset-preparation.json').read_text(encoding='utf-8'))
prompts={'basic-towers.png':['basic-towers.md','basic-towers-alpha.md'],'advanced-towers.png':['advanced-towers.md','forest-crest-fix.md'],'creatures-gate.png':['creatures-and-gate.md','creatures-ground-fix.md'],'qinglan-pass.png':['qinglan-environment.md'],'twin-bends.png':['twin-bends-environment.md'],'beacon-keep.png':['beacon-keep-environment.md']}
sources=[]
for name,ps in prompts.items():
 p=R/'assets/images/v1.0/source'/name;im=Image.open(p)
 sources.append(dict(id=name,path=str(p.relative_to(R)).replace('\\','/'),width=im.width,height=im.height,mode=im.mode,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),author='ChatGPT image, directed and reviewed for this project',rights='Project-generated artwork under the image-generation service terms; not third-party game art',promptFiles=['docs/v1.0/prompts/'+x for x in ps]))
records=[]
for v in prepared:
 v['use']='Phaser current-map terrain' if v['width']==1200 else 'DOM tower/gate or Phaser creature, shared within this game'
 if v['source'].startswith('../'):
  name=Path(v['source']).name;v['sourcePath']='public/assets/hanzi-tower-defense/'+name;v['provenance']='assets/images/hanzi-tower-defense/manifest.json';v['adaptation']='Approved original preserved byte-for-byte. Runtime copy resized; alpha <=8 edge specks removed.'
 else:
  v['sourcePath']='assets/images/v1.0/source/'+v['source'];v['adaptation']='Measured atlas cell crop, matte removed, actual RGBA alpha, anchored and resized' if v['width']==256 else 'Resized opaque terrain; roads/slots/gate remain runtime geometry'
 records.append(v)
records.extend(json.loads((T/'audio/audio-analysis.json').read_text(encoding='utf-8')))
p=R/'public/assets/hanzi-tower-defense/tower-base.png';im=Image.open(p)
records.append(dict(path=str(p.relative_to(R)).replace('\\','/'),source='Kenney towerDefense_tile180.png, approved original preserved',provenance='assets/images/hanzi-tower-defense/manifest.json',sourceURL='https://kenney.nl/assets/tower-defense-top-down',license='CC0 1.0; assets/images/hanzi-tower-defense/Kenney-Tower-License.txt',width=im.width,height=im.height,decodedRGBABytes=im.width*im.height*4,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),use='Existing CSS tower foundation'))
for product in ['tower','adventure']:
 p=R/f'public/assets/v1.0/{product}/icon.svg';records.append(dict(path=str(p.relative_to(R)).replace('\\','/'),source='Project-authored UI SVG; glyph uses a real font',bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),use='Browser icon'))
out=dict(productVersion='1.0.0',date='2026-09-15',sourceMastersServed=False,originalAssetsDeleted=False,notes=['Generated masters returned RGB mattes; they are not falsely described as transparent originals. Only processed runtime WebP has checked real alpha.','11 tower forms + 3 resonance forms; 3 ordinary creatures + 2 captain poses; 1 gate; 3 backgrounds.','New runtime does not load the old Kenney monster parts; their original CC0 sources and manifests remain intact.','Music consists of two original 32-second themes and two original 32-second environmental beds, no external samples.','Font glyphs and all content IDs remain runtime text. Art is imaginative, not an etymology explanation.'],sources=sources,runtime=records,totals=dict(runtimeBytes=sum(v['bytes'] for v in records),imageDecodedRGBABytes=sum(v.get('decodedRGBABytes',0) for v in records)))
(R/'assets/images/v1.0/manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out['totals']))
