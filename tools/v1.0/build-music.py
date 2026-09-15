"""Two original small instrumental themes and seamless environmental beds. No samples.
Scores authored for this project; reproducible DSP is the source, Ogg files are runtime assets.
"""
from pathlib import Path
import numpy as np
import wave, subprocess, json, hashlib
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[2];TMP=ROOT/'tmp/tasks/GAME-CODEX-V1.0/audio';TMP.mkdir(exist_ok=True)
SR=32000; D=32.;N=int(SR*D);rng=np.random.default_rng(9152026)
def hz(m): return 440*2**((m-69)/12)
def note(track,m,start,length,amp=.2,kind='pluck'):
    count=int(length*SR); t=np.arange(count)/SR; f=hz(m)
    attack=np.minimum(1,t/.018)
    env=attack*np.exp(-t*(3.8 if kind=='pluck' else 1.5))*np.minimum(1,(length-t)/.12)
    phase=2*np.pi*f*t+.002*np.sin(t*2*np.pi*4)
    x=(np.sin(phase)+.24*np.sin(2*phase)*np.exp(-t*4)+.09*np.sin(3*phase))*env*amp
    a=int(start*SR); end=min(N,a+count)
    if a<N:track[a:end]+=x[:end-a]
def export(x,product,name):
    # Finite, bounded stereo delay adds space without unbounded runtime convolution.
    left=x.copy();right=.93*x.copy();delay=int(.137*SR)
    right[delay:]+=.12*x[:-delay];left[delay*2:]+=.08*x[:-delay*2]
    stereo=np.stack([left,right],axis=1);peak=np.max(abs(stereo));stereo*=.63/max(peak,.63)
    f=TMP/f'{product}-{name}.wav'
    with wave.open(str(f),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((stereo*32767).astype('<i2').tobytes())
    dest=ROOT/f'public/assets/v1.0/{product}/{name}.ogg';dest.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(f),'-c:a','libvorbis','-q:a','2',str(dest)],check=True)
    fallback=dest.with_suffix('.wav')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(f),'-ac','1','-ar','22050','-c:a','pcm_s16le',str(fallback)],check=True)
    return dict(path=str(dest.relative_to(ROOT)).replace('\\','/'),seconds=D,peak=float(np.max(abs(stereo))),rms=float(np.sqrt(np.mean(stereo**2))),bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),source='tools/v1.0/build-music.py',license='Original project composition; no external samples')
records=[]
for product,melody,chords in [
 ('tower',[62,69,66,64,62,57,59,62,66,69,71,69,66,64,62,0,64,66,69,74,71,69,66,64,62,59,57,59,62,66,64,62],[50,55,52,57,55,50,57,50]),
 ('adventure',[60,64,67,0,69,67,64,62,60,0,55,60,62,64,67,0,69,72,71,67,64,62,60,0,62,64,55,0,60,64,62,60],[48,53,55,48,57,53,55,48])]:
    x=np.zeros(N)
    for bar,base in enumerate(chords):
        for i,step in enumerate([0,7,12,7]):note(x,base+step,bar*4+i,2.1,.09,'soft')
    for i,m in enumerate(melody):
        if m:note(x,m,i+.15,1.7,.17 if product=='tower' else .13,'pluck')
    # A deliberate short breath at the loop seam, no click.
    fade=np.minimum(1,np.arange(N)/(.8*SR))*np.minimum(1,(N-1-np.arange(N))/(1.1*SR));x*=fade
    records.append(export(x,product,'theme'))
    t=np.arange(N)/SR; white=rng.normal(0,1,N);smooth=np.convolve(white,np.ones(240)/240,mode='same')
    air=smooth*(.1+.025*np.sin(t*2*np.pi/8))
    if product=='tower':air+=.004*np.sin(t*2*np.pi*190)*(1+np.sin(t*2*np.pi/4))
    else:air+=.003*np.sin(t*2*np.pi*440)*(1+np.cos(t*2*np.pi/16))
    air*=np.minimum(1,np.arange(N)/(.4*SR))*np.minimum(1,(N-1-np.arange(N))/(.4*SR))
    records.append(export(air,product,'air'))
for record in list(records):
    p=ROOT/record['path'].replace('.ogg','.wav');records.append({**record,'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'use':'Mono 22050 Hz PCM fallback selected by canPlayType; only one format is fetched'})
(TMP/'audio-analysis.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(json.dumps(records,indent=2))
