"""Author canonical Three Y-up coordinates. Blender importer alone converts to Z-up."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def wall(id,label,x,y,z,w,h,d,glass=False,gate=None):
    return dict(id=id,label=label,center=[x,y,z],size=[w,h,d],glass=glass,gate=gate)
def node(id,label,x,z,y=0): return dict(id=id,label=label,p=[x,y,z])
def bounds(): return [wall('west','左侧墙',-5.65,1.8,-.5,.25,3.6,11),wall('east','右侧墙',5.65,1.8,-.5,.25,3.6,11),wall('back','后墙',0,1.8,-5.9,11.5,3.6,.25),wall('front','走廊栏墙',0,1.8,4.9,11.5,3.6,.25)]
l1=dict(id=1,title='隔墙的灯',goal='把档案盒带回走廊出口。',abilities=['ring','lamp'],walls=bounds()+[
 wall('wall-left','观察窗旁的墙',-4.8,1.8,1,1.5,3.6,.25),wall('wall-mid','观察窗旁的墙',-1.55,1.8,1,1.65,3.6,.25),wall('wall-right','外墙',3.15,1.8,1,4.85,3.6,.25),
 wall('window-low','窗台',-3.2,.4,1,1.7,.8,.25),wall('window-high','窗楣',-3.2,2.9,1,1.7,1.4,.25),wall('window','封闭玻璃窗',-3.2,1.5,1,1.7,1.4,.12,True),
 wall('light-wall','灯光通道处的墙',0,1.2,1,1.4,2.4,.25,False,'lamp'),wall('light-top','通道上方的墙',0,3,1,1.4,1.2,.25),
 wall('partition-side','L形隔板',2,1.8,-2.55,.22,3.6,3.5),wall('partition-front','L形隔板',3.85,1.8,-.9,3.7,3.6,.22)],
 nodes=[node('exit','走廊出口',-3.4,4),node('window','观察窗前',-3.2,2.7),node('outside','墙前',0,2.5),node('inside','房间中央',0,-.2),node('lamp','台灯旁',-2.4,-.65),node('bend','隔板后方',0,-4.9),node('rear','侧室后方',3.5,-4.9),node('box','档案架旁',3.5,-3.6)],
 edges=[['exit','window'],['window','outside'],['outside','inside'],['inside','lamp'],['inside','bend'],['bend','rear'],['rear','box']],
 objects=[dict(id='ring',label='扳指',p=[-3.4,1,4],holder='a',size=[.1,.1,.1],magic=True),dict(id='lamp',label='台灯',p=[-3,1.25,-.7],holder=None,size=[.5,1.3,.5],magic=True,fixed=True),dict(id='box',label='档案盒',p=[3.65,.5,-2.8],holder=None,size=[.55,.65,.4])])
l2=dict(id=2,title='坍塌之门',goal='找到通往安全小院的路，并走过去。',abilities=['camera','key'],walls=bounds()+[
 wall('door-left','门边墙',-3.25,1.8,-1.5,4.8,3.6,.25),wall('door-right','门边墙',3.25,1.8,-1.5,4.8,3.6,.25),wall('door-top','门楣',0,3.1,-1.5,1.7,1,.25),wall('door-solid','门板',0,1.3,-1.5,1.65,2.6,.20,False,'door')],
 nodes=[node('start','调查桌旁',-2,2.5),node('door','门前',0,-.5),node('side','房间右侧',2,2),node('safe','安全小院',0,-4.4)],edges=[['start','door'],['start','side'],['side','door']],
 objects=[dict(id='camera',label='相机',p=[-2,1,2.5],holder='a',size=[.4,.3,.25],magic=True),dict(id='key',label='钥匙',p=[-2,1,2.5],holder='a',size=[.15,.3,.08],magic=True),dict(id='door',label='坏门',p=[0,1.3,-1.5],holder=None,size=[1.65,2.6,.2],fixed=True)])
l3=dict(id=3,title='照片接力',goal='让两位调查员和接应员一起到出口。',abilities=['photo','ring'],walls=bounds()+[
 wall('glass-left','玻璃墙',-4.7,1.8,1,1.9,3.6,.16,True),wall('glass-center','玻璃墙',-1.3,1.8,1,1.7,3.6,.16,True),wall('glass-right','玻璃墙',3.05,1.8,1,5.2,3.6,.16,True),
 wall('slot-low','投递口下方玻璃',0,1.325,1,.9,2.65,.16,True),wall('slot-high','投递口上方玻璃',0,3.175,1,.9,.85,.16,True),
 wall('locked-door','锁住的门',-3,1.4,1,1.5,2.8,.18,True,'latch'),wall('door-header','门框上部',-3,3.2,1,1.5,.8,.18,True),
 wall('screen-l','左开关前的遮板',-3.85,1.8,-1.5,3.7,3.6,.22),wall('screen-l-side','左开关侧遮板',-2,1.8,-3,.22,3.6,3.1),
 wall('screen-r','右开关前的遮板',3.85,1.8,-1.5,3.7,3.6,.22),wall('screen-r-side','右开关侧遮板',2,1.8,-3,.22,3.6,3.1)],
 nodes=[node('exit','室外出口',-3.8,3.7),node('outside','投递口下方',0,2.8),node('friend','同伴旁',.75,3.35),node('gate-out','玻璃门外',-3,2.1),node('gate-in','玻璃门内',-3,-.2),node('tray','接应托盘旁',.7,-.3),node('release','托盘旁空地',1.45,-.3),node('front','室内门廊',0,-1),node('center','室内中央',0,-2.8),node('rear','遮板后通道',0,-5),node('left-rear','左侧后通道',-3.5,-5),node('right-rear','右侧后通道',3.5,-5),node('left','左开关旁',-4.4,-3.3),node('right','右开关旁',4.4,-3.3)],
 edges=[['exit','gate-out'],['exit','outside'],['outside','friend'],['outside','gate-out'],['gate-out','gate-in'],['gate-in','front'],['front','center'],['release','tray'],['release','center'],['center','rear'],['rear','left-rear'],['rear','right-rear'],['left-rear','left'],['right-rear','right']],
 objects=[dict(id='ring',label='扳指',p=[0,1,2.8],holder='a',size=[.1,.1,.1],magic=True),dict(id='photo',label='照片',p=[0,1,2.8],holder='a',size=[.48,.04,.34],magic=True),dict(id='tray',label='接应托盘',p=[0,.8,-.25],holder=None,size=[.8,.1,.6],fixed=True),dict(id='left',label='左保持开关',p=[-3.5,1.05,-3.35],holder=None,size=[.4,.3,.3],fixed=True),dict(id='right',label='右保持开关',p=[3.5,1.05,-3.35],holder=None,size=[.4,.3,.3],fixed=True),dict(id='door',label='玻璃门',p=[-3,1.4,1],holder=None,size=[1.5,2.8,.18],fixed=True)],slot=[0,2.70,1],tray=[0,.91,-.25])
for l in [l1,l2,l3]:
 if l['id']==2:l['walls'] += [wall('floor','房内地板',0,-.15,1.7,11.5,.25,6.4),wall('yard-floor','小院地板',0,-.15,-4.7,11.5,.25,2.4)]
 else:l['walls'].append(wall('floor','地板',0,-.15,-.5,11.5,.25,11))
 if l['id'] in [1,3]:l['walls'].append(wall('ceiling','封闭顶板',0,3.725,-2.45,11.5,.25,7.15,l['id']==3))
 l['anchors']={'eye':[0,1.48,-.04],'hand':[.26,1.02,-.12],'lampPivot':[0,0,0],'doorHinge':[-.78,-1.3,0],'doorLock':[1.35,1.1,-.14]}
 l['props']=[wall('desk','调查桌',-4.7,.5,3.7,1,1,1.4)]
 if l['id']==1:l['props'].append(wall('shelf','档案架',3.65,.11,-2.8,1.05,.22,.75))
 if l['id']==3:
  l['props'].append(wall('tray-top','托盘台面',0,.8,-.25,.8,.10,.6))
  for sign in [-1,1]:l['props'].append(wall('switch-base-'+str(sign),'开关台座',sign*3.5,.55,-3.35,.52,.85,.45))
(root/'games/oddity-puzzles/layout.json').write_text(json.dumps([l1,l2,l3],ensure_ascii=False,indent=2)+'\n',encoding='utf8')
