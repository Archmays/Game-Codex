"""Original small pentatonic score and semantic cues, rendered locally to PCM WAV."""
import math,wave,json
from pathlib import Path
import numpy as np
out=Path(__file__).resolve().parents[2]/'public/assets/oddity-puzzles/audio';out.mkdir(parents=True,exist_ok=True)
rate=22050
def tone(f,d):
 t=np.arange(int(d*rate))/rate;return (np.sin(2*math.pi*f*t)+.2*np.sin(4*math.pi*f*t))*np.minimum(1,t/.025)*np.exp(-t*3/max(d,.1))*.18
def write(name,a):
 a=np.clip(a,-.8,.8)
 with wave.open(str(out/(name+'.wav')),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((a*32767).astype('<i2').tobytes())
music=np.zeros(rate*32)
for i,note in enumerate([60,64,67,69,67,64,62,60,64,67,72,69,67,64,62,67]):
 a=tone(440*2**((note-69)/12),1.85)*.36;start=i*2*rate;music[start:start+len(a)]+=a
for i in range(8):
 a=tone(130.8128 if i%2==0 else 174.614,3.8)*.25;music[i*4*rate:i*4*rate+len(a)]+=a
write('music',music)
for name,notes in {'place':[420,560],'light':[330,495,660],'photo':[784,659,523],'repair':[262,330,392,523],'portal':[392,494,587,784]}.items():
 a=np.concatenate([tone(f,.16) for f in notes]);write(name,a)
(out/'credits.json').write_text(json.dumps({'composition':'Original 32-second pentatonic miniature and five synthesized cues','source':'tools/oddity-puzzles/audio.py','license':'Original project audio; no third-party recordings','format':'22050 Hz mono PCM16 WAV'},indent=2)+'\n')
