"""Original compositions and physical/modal toy sounds, rendered OFFLINE.
No samples, external music, soundfonts or runtime synthesis dependencies.
Python + numpy/scipy, deterministic seed; PCM WAV at 24 kHz stereo.
All compositions, synthesis and generated recordings: project original, CC0-1.0.
"""
from pathlib import Path
import json, hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/world-in-a-box/audio'
SR=24000
rng=np.random.default_rng(203203)
manifest=[]

def noise(n,lo=120,hi=1800):
    return sosfilt(butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,n))

def note(midi,dur,instrument='piano'):
    t=np.arange(int(SR*dur))/SR; f=440*2**((midi-69)/12); y=np.zeros(len(t))
    if instrument in ['piano','guitar','wood']:
        for k in range(1,10):
            decay=(2.4 if instrument=='piano' else 1.4)/(1+k*.27)
            y+=np.sin(2*np.pi*f*k*np.sqrt(1+.00015*k*k)*t)*np.exp(-t/decay)/k**(1.65 if instrument=='piano' else 1.4)
        y+=noise(len(t),600,6500)*np.exp(-t*95)*.13
        y*=1-np.exp(-t*260)
    else:
        for k in range(1,7):
            y+=np.sin(2*np.pi*f*k*t+.013*k*np.sin(2*np.pi*4.2*t))/k**(2.7 if instrument=='flute' else 1.7)
        y*=np.minimum(t/.22,1)*np.minimum((dur-t)/.36,1)
        y+=noise(len(t),600,2600)*.012*np.sin(np.pi*t/dur)**2
    y*=np.minimum((dur-t)/.08,1)
    return y

def add(track,mono,at,amp,pan=0):
    ix=(np.arange(len(mono))+round(at*SR))%len(track)
    track[ix,0]+=mono*amp*np.sqrt((1-pan)/2)
    track[ix,1]+=mono*amp*np.sqrt((1+pan)/2)

def room(y,loop):
    out=y.copy()
    for seconds,gain in [(.071,.14),(.127,.10),(.193,.07),(.307,.045)]:
        d=int(SR*seconds)
        if loop: out+=np.roll(y[:,::-1],d,axis=0)*gain
        else: out[d:]+=y[:-d,::-1]*gain
    return out

def save(name,y,kind,loop=False,**extra):
    y=room(y,loop);peak=np.max(np.abs(y));y*=.64/max(peak,.001)
    path=OUT/kind/(name+'.wav');path.parent.mkdir(parents=True,exist_ok=True)
    wavfile.write(path,SR,(y*32767).astype('<i2'))
    manifest.append(dict(id=name,file=f'{kind}/{name}.wav',duration=len(y)/SR,loop=loop,loopStart=0,loopEnd=len(y)/SR,peak=float(np.max(np.abs(y))),rms=float(np.sqrt(np.mean(y*y))),seamDelta=float(np.max(np.abs(y[-1]-y[0]))),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),**extra))

# Scores use chord tones as accompaniment, an independently phrased melody,
# rests, answered phrases, register and orchestration variation. No silent padding.
def music(city=False):
    bpm=84 if city else 76; meter=4 if city else 3; beat=60/bpm
    length=32*meter*beat; y=np.zeros((round(length*SR),2))
    chords=([ [50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61],
              [50,57,62,66],[54,57,62,66],[43,50,59,62],[45,52,57,61] ] if city else
             [[48,55,60,64],[45,52,57,60],[53,60,65,69],[55,62,67,71],
              [48,55,60,64],[52,59,64,67],[53,60,65,69],[55,62,67,71]])
    melodies=([[74,78,76],[74,71,69],[71,74,78],[76,73,69],[74,78,81],[78,76,74],[71,74,76],[73,69,74]] if city else
              [[76,79],[76,72],[77,81],[79,74],[76,72],[74,76],[77,76],[74,71]])
    for bar in range(32):
        chord=chords[bar%8]; start=bar*meter*beat; section=bar//8
        add(y,note(chord[0],3,'piano'),start,.22,-.2)
        for j in range(meter*2):
            if j==meter*2-1 and bar%4==3: continue
            pitch=chord[1+j%3]+(12 if section==2 and j%2 else 0)
            add(y,note(pitch,2,'guitar' if city or section==1 else 'piano'),start+(j*.5+.02)*beat,.085 if city else .105,.28)
        phrase=melodies[bar%8]
        if section==2: phrase=[n-12 if j==0 else n for j,n in enumerate(reversed(phrase))]
        for j,n in enumerate(phrase):
            if bar%4==3 and j==len(phrase)-1: continue
            add(y,note(n,beat*(1.4 if city else 1.2),'flute' if city and section in [1,2] else 'piano'),start+(j*(1.15 if city else 1.05)+.1)*beat,.125, -.18)
        if city and section in [2,3] and bar%2==0:
            for n in chord[1:3]:add(y,note(n,beat*3.6,'strings'),start,.035,.1)
    save('river-campus' if city else 'window-breeze',y,'music',True,bpm=bpm,meter=meter,bars=32,form='A A-variation B A-return',instruments='modal piano, plucked string, soft flute/strings' if city else 'modal felt piano, nylon-like pluck')

def fx(name,dur,mode):
    t=np.arange(int(SR*dur))/SR;y=np.zeros((len(t),2)); mono=np.zeros(len(t));loop=False
    if mode=='impact':
        for f,a,d in [(240,1,18),(563,.45,32),(1087,.17,50)]:mono+=a*np.sin(2*np.pi*f*t)*np.exp(-t*d)
        mono+=noise(len(t),200,4000)*np.exp(-t*70)*.5;mono*=1-np.exp(-t*1800)
    elif mode=='rub':mono=noise(len(t),180,2200)*np.sin(np.pi*t/dur)**2*(.65+.35*np.sin(t*42))
    elif mode=='bell':
        for f,a in [(780,1),(1173,.33),(2021,.11)]:mono+=a*np.sin(2*np.pi*f*t)*np.exp(-t*4)
        mono*=1-np.exp(-t*500)
    elif mode=='horn':
        for f,a in [(220,1),(330,.27),(440,.12)]:mono+=a*np.sin(2*np.pi*f*t)
        mono*=np.sin(np.pi*t/dur)**2
    elif mode in ['river','room','wind','boat','tram']:
        loop=True;mono=noise(len(t),70 if mode in ['room','tram'] else 160,1000 if mode=='room' else 2600)
        if mode=='boat':mono=mono*.6+np.sin(2*np.pi*72*t)*(.12+.08*np.cos(2*np.pi*4*t));mono*=.6+.4*np.sin(2*np.pi*2*t)**2
        if mode=='tram':mono=mono*.4+np.sin(2*np.pi*98*t)*.09;mono*=.65+.35*np.cos(2*np.pi*6*t)**12
        # Periodic complementary crossfade, preserving length without a silent seam.
        n=int(SR*.15);tail=mono[-n:].copy();a=np.linspace(0,1,n);mono[:n]=tail*(1-a)+mono[:n]*a;mono[-n:]=tail
        mono[:64]=np.linspace(mono[-1],mono[64],64)
    else:
        for j,n in enumerate([60,64,67]):add(y,note(n,.8),j*.12,.25)
    if mode!='chord':y[:,0]=mono;y[:,1]=mono*.96
    if not loop:y*=np.minimum(1,(dur-t)/.04)[:,None]
    save(name,y,'sfx',loop)

music();music(True)
for name,dur,mode in [('pick',.18,'rub'),('place-light',.27,'impact'),('place-medium',.38,'impact'),('place-heavy',.52,'impact'),('undo',.32,'rub'),('mismatch',.4,'rub'),('complete',1.3,'chord'),('shutter',.55,'rub'),('page',.42,'rub'),('cat',1.3,'rub'),('cup',.55,'bell'),('steam',1.7,'rub'),('chime',1.5,'bell'),('boat-start',.6,'horn'),('boat-contact',.45,'impact'),('tram-start',.4,'bell'),('tram-stop',.48,'rub'),('blocked',.28,'impact'),('section',.85,'rub'),('wind',4,'wind'),('room',4,'room'),('river',4,'river'),('boat',4,'boat'),('tram',4,'tram')]:fx(name,dur,mode)
(OUT/'manifest.json').write_text(json.dumps(dict(author='Game-Codex original offline composition and synthesis',license='CC0-1.0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',source='tools/world-in-a-box/render-audio.py',samples='None; original mathematical/modal instruments and seeded filtered noise',sampleRate=SR,channels=2,assets=manifest),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(manifest),'music':manifest[:2]},indent=2))
