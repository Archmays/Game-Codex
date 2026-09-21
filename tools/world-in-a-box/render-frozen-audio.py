"""New 104.35 second score; original offline modal instruments, no samples.
Does not regenerate or alter either previous scene's audio bytes.
"""
from pathlib import Path
import json
BASE=Path(__file__).with_name('render-audio.py')
exec(compile(BASE.read_text(encoding='utf-8').split('\nmusic();music(True)')[0],str(BASE),'exec'))
beat=60/92;meter=5;bars=32
y=np.zeros((round(bars*meter*beat*SR),2))
chords=[[53,60,65,69],[50,57,62,65],[58,65,70,74],[48,55,60,64],[53,60,65,69],[57,60,64,69],[55,62,67,70],[48,55,60,64]]
melodies=[[77,72,74,69],[74,77,76,72],[77,81,79,74],[76,72,67,72],[77,79,81,77],[76,74,72,69],[74,79,77,74],[76,72,69,65]]
for bar in range(bars):
 c=chords[bar%8];start=bar*meter*beat;section=bar//8
 add(y,note(c[0],3,'piano'),start,.19,-.25)
 for j in range(10):
  if j==9 and bar%4==3:continue
  add(y,note(c[1+j%3]+(12 if j==7 else 0),2,'guitar'),start+j*.5*beat,.057,.35)
 phrase=melodies[bar%8]
 if section==2:phrase=[phrase[2],phrase[0],phrase[3],phrase[1]]
 for j,n in enumerate(phrase):
  if j==3 and bar%4==3:continue
  add(y,note(n,1.8,'piano'),start+(j*1.12+.12)*beat,.12,-.12)
 if section in [1,2,3]:
  for n in c[1:3]:add(y,note(n,3.1,'strings'),start,.022,.05)
 if bar%4==0:add(y,note(phrase[0]+12,1.8,'piano'),start+4*beat,.022,.4)
save('frozen-elsa-playground',y,'music',True,bpm=92,meter=5,bars=32,form='A, harp variation, answering B, warm return',instruments='soft modal piano, harp-like pluck, sparse upper keys, light strings')
for name,dur,mode in [('gather',1.1,'chord'),('crystal',.36,'bell'),('start',.6,'rub'),('stop',.5,'rub'),('reform',1.2,'impact'),('door',.8,'rub'),('chandelier',1.4,'bell'),('slide',3,'wind'),('hooves',3,'tram'),('skate',3,'boat'),('snow',4,'wind'),('frost',3,'river'),('air',4,'room')]:fx('frozen-'+name,dur,mode)
(OUT/'frozen-manifest.json').write_text(json.dumps(dict(author='Game-Codex original offline composition and synthesis',license='CC0-1.0 for this original music and synthesis only; excludes Disney character elements',source='tools/world-in-a-box/render-frozen-audio.py',samples='none',sampleRate=SR,assets=manifest),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(manifest),'score':manifest[0]},indent=2))
