"""Runtime preparation: alpha matte, atlas extraction, anchored sizing. Source bytes stay intact.

The generator returned a neutral checkerboard despite two explicit RGBA requests.
Remove only its neutral pixels, retain chromatic artwork, reject mattes with border contact.
Every output additionally requires light/dark visual review; this is not an acceptance oracle.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy.ndimage import label, binary_fill_holes
import hashlib, json

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/images/v1.0/source'
OUT=ROOT/'public/assets/v1.0/tower'
OUT.mkdir(parents=True,exist_ok=True)
records=[]

def save_runtime(im,name,source,neutral=False,size=256,magenta=False):
    im=im.convert('RGBA')
    if not neutral and not magenta:
        # Retained approved masters contain invisible alpha 1–8 specks at their frame edges.
        # Remove only those specks from runtime copies; preserve source bytes and visible smoke.
        a=np.array(im.getchannel('A'));a[a<=8]=0;im.putalpha(Image.fromarray(a))
    if neutral:
        rgb=np.array(im)[:,:,:3].astype(np.int16)
        neutral_pixels=(rgb.max(2)-rgb.min(2)<=22)&(rgb.max(2)>=80)
        background,n=label(neutral_pixels);counts=np.bincount(background.ravel())
        exterior=np.unique(np.concatenate([background[0],background[-1],background[:,0],background[:,-1]]))
        # Enclosed small neutral highlights belong to stone, not the background.
        remove=np.unique(np.concatenate([exterior[exterior>0],np.flatnonzero(counts>1500)]));remove=remove[remove>0]
        mask=~np.isin(background,remove)
        labels,n=label(mask);counts=np.bincount(labels.ravel());counts[0]=0
        mask=labels==counts.argmax()
        im.putalpha(Image.fromarray((mask*255).astype('uint8')))
    if magenta:
        rgb=np.array(im)[:,:,:3].astype(np.float32)
        # Chroma-key production master: no artwork uses magenta. Keep grey stone intact.
        spill=np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1]
        alpha=np.clip((160-spill)/65,0,1)
        labels,n=label(alpha>.5);counts=np.bincount(labels.ravel());counts[0]=0
        keep=binary_fill_holes(labels==counts.argmax())
        # Do not fill chroma-key holes enclosed by bows or antlers.
        alpha*=keep
        im.putalpha(Image.fromarray((alpha*255).astype('uint8')))
    bounds=im.getbbox()
    if not bounds: raise ValueError('empty '+name)
    # Padding after a crop cannot prove its source silhouette was complete.
    source_border=bool(np.array(im.getchannel('A'))[0].max() or np.array(im.getchannel('A'))[-1].max() or np.array(im.getchannel('A'))[:,0].max() or np.array(im.getchannel('A'))[:,-1].max())
    if source_border: raise ValueError('source silhouette touches crop boundary: '+name)
    im=im.crop(bounds);im.thumbnail((round(size*.86),round(size*.88)),Image.Resampling.LANCZOS)
    texture=Image.new('RGBA',(size,size));texture.alpha_composite(im,((size-im.width)//2,round(size*.93)-im.height))
    target=OUT/(name+'.webp');texture.save(target,quality=88,method=6)
    alpha=np.array(texture.getchannel('A'))
    if alpha[0].max() or alpha[-1].max() or alpha[:,0].max() or alpha[:,-1].max():raise ValueError('clipped '+name)
    records.append(dict(path=str(target.relative_to(ROOT)).replace('\\','/'),source=source,bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),width=size,height=size,alpha_zero=int((alpha==0).sum()),alpha_partial=int(((alpha>0)&(alpha<255)).sum()),decodedRGBABytes=size*size*4,anchor=[.5,.93]))
    return texture

if __name__=='__main__':
    sheet=Image.open(SOURCE/'basic-towers.png');w,h=sheet.size;tiles=[]
    # Measured clear gutters, not the generator's requested equal grid: its top row is taller.
    regions=[(0,0,660,642),(660,0,w,645),(0,642,660,h),(660,645,w,h)]
    for i,name in enumerate(['fire','wood','water','mountain']):
        tile=sheet.crop(regions[i])
        tiles.append(save_runtime(tile,name,'basic-towers.png',True))
    for old,new in [('volcano-base','volcano'),('volcano-resonant','volcano-resonant'),('mountain-forest-base','wildwood'),('mountain-forest-resonant','wildwood-resonant')]:
        tiles.append(save_runtime(Image.open(ROOT/f'public/assets/hanzi-tower-defense/{old}.png'),new,f'../hanzi-tower-defense/{old}.png'))
    for filename,names in [('advanced-towers.png',['flame','grove','wash','canopy','forest','forest-resonant']),('creatures-gate.png',['swarm','swift','stone','captain','captain-call','gate'])]:
        if not (SOURCE/filename).exists():continue
        sheet=Image.open(SOURCE/filename);w,h=sheet.size
        xs=[0,w//3,990 if filename=='creatures-gate.png' else w*2//3,w]
        ys=[0,416 if filename=='creatures-gate.png' else 508,h]
        for i,name in enumerate(names):
            tile=sheet.crop((xs[i%3],ys[i//3],xs[i%3+1],ys[i//3+1]))
            tiles.append(save_runtime(tile,name,filename,magenta=True,size=256))
    for name in ['qinglan-pass','twin-bends','beacon-keep']:
        if (SOURCE/(name+'.png')).exists():
            bg=Image.open(SOURCE/(name+'.png')).convert('RGB').resize((1200,800),Image.Resampling.LANCZOS)
            target=OUT/(name+'.webp');bg.save(target,quality=84,method=6)
            records.append(dict(path=str(target.relative_to(ROOT)).replace('\\','/'),source=name+'.png',bytes=target.stat().st_size,width=1200,height=800,decodedRGBABytes=1200*800*4,sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    review=Image.new('RGB',(4*256,2*256),'#faf5e9')
    for i,t in enumerate(tiles[:4]):
        review.paste(t,(i*256,0),t)
        bg=Image.new('RGB',(256,256),'#102f2d');bg.paste(t,(0,0),t);review.paste(bg,(i*256,256))
    review.save(ROOT/'tmp/tasks/GAME-CODEX-V1.0/basic-alpha-review.png')
    review=Image.new('RGB',(5*256,((len(tiles)+4)//5)*512),'#faf5e9')
    for i,t in enumerate(tiles):
        review.paste(t,((i%5)*256,(i//5)*512),t)
        bg=Image.new('RGB',(256,256),'#102f2d');bg.paste(t,(0,0),t);review.paste(bg,((i%5)*256,(i//5)*512+256))
    review.save(ROOT/'tmp/tasks/GAME-CODEX-V1.0/all-alpha-review.png')
    (ROOT/'tmp/tasks/GAME-CODEX-V1.0/asset-preparation.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
