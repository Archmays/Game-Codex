import { describe, expect, it } from "vitest";
import { CORES } from "../games/hanzi-tower-defense/content";
import { activeResonance, checkpointOf, deploy, equipEnglish, fuse, newBattle, previewEquipment, recycle, startWave, stow, unequipEnglish, updateBattle, WAVES, type BattleState } from "../games/hanzi-tower-defense/model";
import { ECHO, ROOTS, englishMapping, RESONANCES } from "../games/hanzi-tower-defense/resonance";
import { LEGACY_SAVE_KEY, openSave, SAVE_KEY, validCheckpoint } from "../games/hanzi-tower-defense/save";

const prefs={muted:true,reducedMotion:true};
const storage=(initial:Record<string,string>={})=>{const data=new Map(Object.entries(initial));return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},data};};
function readyVolcano() {
  const s=newBattle(), c=fuse(s,1,6,0)!;
  const r=RESONANCES[0]; s.englishCores=[{id:1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:null}]; s.englishClaims=[r.grantId];s.nextEnglishId=2;
  return {s,c};
}
function range() {
  const {s,c}=readyVolcano(); equipEnglish(s,previewEquipment(s,1,c.id)); startWave(s);
  s.spawned=WAVES[0].foes.length;
  s.enemies=[{id:99,kind:'stone',distance:160,hp:10000,maxHp:10000,slow:0,slowUntil:0}];
  return {s,c};
}

describe('sense-bound equipment and atomic ownership',()=>{
  it('uses lexeme, sense and grant identity; internal core names or lookalikes confer nothing',()=>{
    const {s,c}=readyVolcano(); const e=s.englishCores[0];
    expect(englishMapping(e)?.coreId).toBe('volcano');
    for(const patch of [{senseId:'wrong-sense'},{grantId:'forged'},{lexemeId:'Volcano'},{lexemeId:'wildwood'}]) expect(englishMapping({...e,...patch} as typeof e)).toBeUndefined();
    const before=JSON.stringify(s); expect(previewEquipment(s,1,3).ok).toBe(false); expect(equipEnglish(s,previewEquipment(s,1,3))).toBe(false);expect(JSON.stringify(s)).toBe(before);
    expect(equipEnglish(s,previewEquipment(s,1,c.id))).toBe(true); expect(activeResonance(s,c)?.mapping.effectId).toBe('echo-eruption');
    s.englishClaims=[];expect(activeResonance(s,c)).toBeUndefined();
  });
  it('preview and cancel are pure, duplicate confirm cannot attach twice, source changes invalidate a preview',()=>{
    const {s,c}=readyVolcano(); const before=JSON.stringify(s), p=previewEquipment(s,1,c.id);expect(p.ok).toBe(true);expect(JSON.stringify(s)).toBe(before);
    expect(equipEnglish(s,p)).toBe(true);const after=JSON.stringify(s);expect(equipEnglish(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(after);
    const other={id:s.nextCoreId++,kind:'volcano' as const,slot:1,cooldown:.7};s.cores.push(other);
    const transfer=previewEquipment(s,1,other.id);expect(transfer.ok).toBe(true);expect(unequipEnglish(s,1,c.id)).toBe(true);expect(equipEnglish(s,transfer)).toBe(false);
  });
  it('supports bag equipment, attachment following deploy/stow/move and stable cooldown',()=>{
    const {s,c}=readyVolcano();stow(s,c.id);expect(equipEnglish(s,previewEquipment(s,1,c.id))).toBe(true);c.cooldown=.8;
    expect(deploy(s,c.id,3)).toBe(true);expect(stow(s,c.id)).toBe(true);expect(deploy(s,c.id,2)).toBe(true);expect(c.cooldown).toBe(.8);expect(s.englishCores[0].attachedTo).toBe(c.id);expect(checkpointOf(s).cores.find(e=>e.id===c.id)!.cooldown).toBe(.8);
  });
  it('allows first equip during battle but pause never permits detach/transfer/recycle of attachments',()=>{
    const {s,c}=readyVolcano();startWave(s);s.paused=true;expect(equipEnglish(s,previewEquipment(s,1,c.id))).toBe(true);
    const other={id:s.nextCoreId++,kind:'volcano' as const,slot:null,cooldown:0};s.cores.push(other);stow(s,c.id);s.health=10;
    const before=JSON.stringify(s);expect(unequipEnglish(s,1,c.id)).toBe(false);expect(equipEnglish(s,previewEquipment(s,1,other.id))).toBe(false);expect(recycle(s,c.id)).toBe(0);expect(JSON.stringify(s)).toBe(before);
    s.phase='ready';expect(equipEnglish(s,previewEquipment(s,1,other.id))).toBe(true);expect(s.englishCores.filter(e=>e.attachedTo!==null)).toHaveLength(1);
  });
  it('recycling returns the exact English entity atomically and full-health refusal changes nothing',()=>{
    const {s,c}=readyVolcano();stow(s,c.id);equipEnglish(s,previewEquipment(s,1,c.id));const before=JSON.stringify(s);
    expect(recycle(s,c.id)).toBe(0);expect(JSON.stringify(s)).toBe(before);s.health=15;expect(recycle(s,c.id)).toBe(1);
    expect(s.englishCores[0]).toMatchObject({id:1,attachedTo:null});expect(s.englishClaims).toHaveLength(1);expect(recycle(s,c.id)).toBe(0);
  });
  it('a full target rejects an additional entity without displacing its owner',()=>{
    const {s,c}=readyVolcano();equipEnglish(s,previewEquipment(s,1,c.id));
    s.englishCores.push({...s.englishCores[0],id:2,attachedTo:null});s.nextEnglishId=3;
    const before=JSON.stringify(s),p=previewEquipment(s,2,c.id);expect(p.reason).toContain('每塔只能');expect(equipEnglish(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
    expect(validCheckpoint(checkpointOf(s))).toBe(false); // Duplicate grant is also rejected at persistence boundary.
  });
});

describe('real echo effects and conserved grants',()=>{
  it('adds exactly the snapshotted damage after the model delay, regardless of moved/stowed source',()=>{
    const {s,c}=range();const events=updateBattle(s,.05);expect(events.filter(e=>e.type==='shot')).toHaveLength(1);expect(s.enemies[0].hp).toBe(10000-CORES.volcano.damage);expect(s.echoes).toHaveLength(1);
    const snapshot=structuredClone(s.echoes[0]);stow(s,c.id);c.kind='fire';
    for(let i=0;i<8;i++) updateBattle(s,.05);expect(s.enemies[0].hp).toBe(10000-63);expect(s.echoes[0]).toEqual(snapshot);
    const echo=updateBattle(s,.05).filter(e=>e.type==='echo');expect(echo).toHaveLength(1);expect(s.enemies[0].hp).toBeCloseTo(10000-63-63*ECHO.multiplier);expect(s.echoes).toHaveLength(0);
  });
  it('freezes queued effects and their visible lifetimes on pause and clears wave-end leftovers',()=>{
    const {s}=range();updateBattle(s,.05);s.paused=true;const before=JSON.stringify(s);for(let i=0;i<100;i++)updateBattle(s,.05);expect(JSON.stringify(s)).toBe(before);
    s.paused=false;s.enemies=[];updateBattle(s,.05);expect(s.phase).toBe('ready');expect(s.echoes).toEqual([]);expect(s.visuals).toEqual([]);
  });
  it('echo does not recurse or award duplicate defeats when its original target has died',()=>{
    const {s}=range();s.enemies[0].hp=60;s.enemies.push({...s.enemies[0],id:100,hp:80,maxHp:80});
    updateBattle(s,.05);expect(s.kills).toBe(1);expect(s.echoes).toHaveLength(1);
    for(let i=0;i<9;i++)updateBattle(s,.05);expect(s.kills).toBe(2);expect(s.waveDrops).toBe(1);expect(s.echoes).toHaveLength(0);
  });
  it('kill grant and same-wave fallback share one ledger and do not change Chinese entities/randomness',()=>{
    const s=newBattle();s.wave=1;startWave(s);s.spawned=WAVES[1].foes.length;s.enemies=Array.from({length:3},(_,id)=>({id:id+10,kind:'swarm' as const,distance:0,hp:0,maxHp:50,slow:0,slowUntil:0}));
    const events=updateBattle(s,.05);expect(events.filter(e=>e.type==='english-drop')).toHaveLength(1);expect(s.englishCores).toHaveLength(1);expect(s.englishClaims).toHaveLength(1);expect(s.phase).toBe('ready');
    expect(s.cores.map(c=>c.id)).toEqual([1,2,3,4,5,6,7,8]);expect(s.nextCoreId).toBe(9);
    const fallback=newBattle();fallback.wave=1;startWave(fallback);fallback.spawned=WAVES[1].foes.length;expect(updateBattle(fallback,.05).filter(e=>e.type==='english-drop')).toHaveLength(1);
    updateBattle(fallback,.05);expect(fallback.englishCores).toHaveLength(1);
  });
});

describe('v3 copy migration and rollback protection',()=>{
  function legacy(wave:number) { const {englishCores,englishClaims,englishSkipped,nextEnglishId,...checkpoint}=newBattle().checkpoint;checkpoint.wave=wave;checkpoint.cores[0].cooldown=.6;return JSON.stringify({version:1,checkpoint,unlocked:['fire-fire'],preferences:prefs,extra:'preserve'}); }
  it('quota failure preserves old bytes and continues its validated checkpoint read-only',()=>{
    const old=legacy(3),store=storage({[LEGACY_SAVE_KEY]:old});store.setItem=()=>{throw new Error('QuotaExceededError');};
    const session=openSave(store,prefs);expect(session.writable).toBe(false);expect(session.hasCheckpoint).toBe(true);expect(session.state.wave).toBe(3);expect(session.preferences).toEqual(prefs);
    expect(session.write(session.state,prefs)).toBe(false);expect(store.getItem(LEGACY_SAVE_KEY)).toBe(old);expect(store.getItem(SAVE_KEY)).toBeNull();
  });
  it('restored valid v3 takes priority over v1 and freezes a previously mounted writer',()=>{
    const store=storage({[LEGACY_SAVE_KEY]:legacy(1)}),mounted=openSave(store,prefs),{s,c}=readyVolcano();s.wave=4;equipEnglish(s,previewEquipment(s,1,c.id));
    const restored=JSON.stringify({version:3,activeMapId:"qinglan-pass",maps:{"qinglan-pass":{checkpoint:checkpointOf(s),unlocked:[]}},preferences:prefs});store.setItem(SAVE_KEY,restored);const v1=store.getItem(LEGACY_SAVE_KEY);
    expect(mounted.write(mounted.state,prefs)).toBe(false);const reopened=openSave(store,prefs);expect(reopened.state.wave).toBe(4);expect(reopened.state.englishCores[0].attachedTo).toBe(c.id);expect(reopened.migrated).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(restored);expect(store.getItem(LEGACY_SAVE_KEY)).toBe(v1);
  });
  it.each([0,1,2,6])('copies valid v1 wave %i once with original strings untouched and no reward backfill',(wave)=>{
    const raw=legacy(wave), store=storage({[LEGACY_SAVE_KEY]:raw}), session=openSave(store,prefs);
    expect(session.migrated).toBe(true);expect(session.state.wave).toBe(wave);expect(session.state.englishCores).toEqual([]);expect(session.state.englishSkipped).toHaveLength(RESONANCES.filter(r=>r.coreId!=="forest"&&r.dropWave<wave).length);expect(session.state.cores[0].cooldown).toBe(.6);
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(raw);const once=store.getItem(SAVE_KEY);expect(openSave(store,prefs).migrated).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(once);expect(session.preferences).toEqual(prefs);
  });
  it.each(['{broken','{"version":99}','{"version":2,"checkpoint":{}}'])('existing invalid v2 wins over valid v1 and both bytes remain intact: %s',(raw)=>{
    const old=legacy(2),store=storage({[LEGACY_SAVE_KEY]:old,[SAVE_KEY]:raw}),save=openSave(store,prefs);expect(save.writable).toBe(false);expect(save.migrated).toBe(false);expect(save.write(save.state,prefs)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);expect(store.getItem(LEGACY_SAVE_KEY)).toBe(old);
  });
  it('rolls back mid-wave grants, attachments and Chinese consumption together; boundary changes persist',()=>{
    const s=newBattle();s.wave=1;const store=storage(),save=openSave(store,prefs);save.write(s,prefs);startWave(s);
    const tower=fuse(s,1,6,0)!;s.spawned=WAVES[1].foes.length;s.enemies=[{id:9,kind:'stone',distance:0,hp:999,maxHp:999,slow:0,slowUntil:0}];s.waveKills=3;
    // Trigger a real additional defeat to check the shared grant transaction without ending this wave.
    s.enemies.push({...s.enemies[0],id:10,hp:0});updateBattle(s,.05);expect(s.englishCores).toHaveLength(1);equipEnglish(s,previewEquipment(s,1,tower.id));save.write(s,prefs);
    const rollback=openSave(store,prefs).state;expect(rollback.englishCores).toEqual([]);expect(rollback.cores).toHaveLength(6);expect(rollback.wave).toBe(1);
    s.enemies=[];updateBattle(s,.05);save.write(s,prefs);const boundary=openSave(store,prefs).state;expect(boundary.englishCores[0].attachedTo).toBe(tower.id);expect(boundary.wave).toBe(2);
  });
  it('rejects duplicate grant/entity/attachment or mismatched sense and protects cross-tab writes',()=>{
    const {s,c}=readyVolcano();equipEnglish(s,previewEquipment(s,1,c.id));const cp=checkpointOf(s);expect(validCheckpoint(cp)).toBe(true);
    expect(validCheckpoint({...cp,englishCores:[...cp.englishCores,...cp.englishCores]})).toBe(false);
    expect(validCheckpoint({...cp,englishCores:[{...cp.englishCores[0],senseId:'wrong'}]})).toBe(false);
    expect(validCheckpoint({...cp,englishCores:[{...cp.englishCores[0],attachedTo:3}]})).toBe(false);
    const store=storage(),a=openSave(store,prefs),b=openSave(store,prefs);expect(a.write(s,prefs)).toBe(true);const raw=store.getItem(SAVE_KEY);expect(b.write(newBattle(),prefs)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(raw);
  });
});

function forestRange() {
  const s=newBattle(), grove=fuse(s,3,4,null)!, c=fuse(s,6,grove.id,null)!;stow(s,1);deploy(s,c.id,0);
  const r=RESONANCES[1];s.englishCores=[{id:1,lexemeId:r.lexemeId,senseId:r.senseId,grantId:r.grantId,attachedTo:c.id}];s.englishClaims=[r.grantId];s.nextEnglishId=2;
  startWave(s);s.spawned=WAVES[0].foes.length;s.enemies=[{id:99,kind:'swarm',distance:200,hp:10000,maxHp:10000,slow:0,slowUntil:0}];return {s,c};
}
describe('mountain forest is a complete phrase and a real bounded terrain effect',()=>{
  it('binds the restricted Chinese sense, full spaced phrase, recipe and specialist use',()=>{
    const r=RESONANCES[1];expect(r.coreId).toBe('wildwood');expect(r.text).toBe('mountain forest');expect(r.form).toBe('phrase');expect(r.meaning).toBe('山上的树林');expect(r.sources[0]).toContain('zdic.net');expect(r.sources[1]).toContain('fao.org');expect(r.effectId).not.toBe(RESONANCES[0].effectId);
  });
  it('normal hit creates a snapshotted area; subsequent pulses and movement prove real damage/control',()=>{
    const {s,c}=forestRange();updateBattle(s,.05);const foe=s.enemies[0], hp=foe.hp;expect(hp).toBe(10000-49);expect(s.rootZones).toHaveLength(1);const zone=structuredClone(s.rootZones[0]);
    stow(s,c.id);c.kind='fire';const distance=foe.distance;updateBattle(s,.05);expect(foe.distance-distance).toBeCloseTo(40*(1-ROOTS.slow)*.05);expect(s.rootZones[0]).toEqual(zone);
    for(let i=0;i<6;i++)updateBattle(s,.05);expect(foe.hp).toBeCloseTo(hp-49*ROOTS.multiplier);expect(s.rootZones[0].sourceCoreId).toBe(c.id);
  });
  it('overlapping and staggered zones never sum damage or slow; source removal cannot change snapshots',()=>{
    const {s,c}=forestRange();updateBattle(s,.05);stow(s,c.id);const z=s.rootZones[0],foe=s.enemies[0];s.rootZones.push({...z,id:2,born:.1},{...z,id:3,born:.2});const hp=foe.hp;
    for(let i=0;i<7;i++)updateBattle(s,.05);expect(foe.hp).toBeCloseTo(hp-z.damage);expect(foe.zoneSlow).toBe(ROOTS.slow);
    s.cores=s.cores.filter(e=>e.id!==c.id);for(let i=0;i<8;i++)updateBattle(s,.05);expect(foe.hp).toBeCloseTo(hp-2*z.damage);expect(s.rootZones).toHaveLength(3);
  });
  it('outside/expired areas do nothing; moving out immediately removes only root slow',()=>{
    const {s,c}=forestRange();updateBattle(s,.05);stow(s,c.id);const foe=s.enemies[0];foe.distance=700;foe.slow=0;foe.slowUntil=0;const hp=foe.hp,d=foe.distance;updateBattle(s,.05);
    expect(foe.zoneSlow).toBeUndefined();expect(foe.distance-d).toBeCloseTo(2);expect(foe.hp).toBe(hp);
    for(let i=0;i<50;i++)updateBattle(s,.05);expect(s.rootZones).toEqual([]);expect(foe.zoneSlow).toBeUndefined();
  });
  it('pause freezes roots/pulses and continued fire respects the area/effect caps',()=>{
    const {s}=forestRange();updateBattle(s,.05);s.paused=true;const before=JSON.stringify(s);for(let i=0;i<100;i++)updateBattle(s,.05);expect(JSON.stringify(s)).toBe(before);s.paused=false;
    for(let i=0;i<600;i++){s.enemies[0].distance=200;updateBattle(s,.05);expect(s.rootZones.length).toBeLessThanOrEqual(ROOTS.maxZones);expect(s.echoes.length).toBeLessThanOrEqual(ECHO.maxPending);expect(s.visuals.length).toBeLessThanOrEqual(90);}
    s.enemies=[];updateBattle(s,.05);expect(s.rootZones).toEqual([]);expect(s.visuals).toEqual([]);
  });
  it('each grant is once per run and root kills go through the original unique reward path',()=>{
    const {s,c}=forestRange();s.wave=3;s.spawned=WAVES[3].foes.length;s.waveKills=2;s.englishCores=[];s.englishClaims=[];s.nextEnglishId=1;
    s.rootZones=[{id:1,effectId:'spreading-roots',sourceCoreId:c.id,sourceEnglishId:9,at:{x:175,y:115},born:0,expires:2,damage:20,radius:85,slow:.48}];stow(s,c.id);s.enemies[0].hp=10;s.rootPulseAt=.05;
    const events=updateBattle(s,.05);expect(events.filter(e=>e.type==='defeat')).toHaveLength(1);expect(events.filter(e=>e.type==='english-drop')).toHaveLength(1);expect(s.englishCores[0].lexemeId).toBe('en-mountain-forest');expect(s.englishClaims).toHaveLength(1);expect(s.waveDrops).toBe(1);
    updateBattle(s,.05);expect(s.kills).toBe(1);expect(s.englishCores).toHaveLength(1);
  });
  it('echo is spatial at its original point, with inclusive radius and no tracking a dead target',()=>{
    for(const offset of [ECHO.radius-.01,ECHO.radius+.01]) {
      const s=newBattle();startWave(s);s.spawned=WAVES[0].foes.length;s.cores.forEach(c=>c.slot=null);
      s.echoes=[{id:1,effectId:'echo-eruption',sourceCoreId:999,sourceEnglishId:1,at:{x:100,y:115},due:.05,damage:20,radius:ECHO.radius}];
      s.enemies=[{id:5,kind:'swarm',distance:125+offset-2,hp:50,maxHp:50,slow:0,slowUntil:0}];updateBattle(s,.05);expect(s.enemies[0].hp).toBe(offset<ECHO.radius?30:50);expect(s.echoes).toEqual([]);
    }
  });
});
