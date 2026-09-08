import { isMapId, mapFor, type MapId } from "./maps";
import { CORE_ORDER, ORIGINAL_CORE_ORDER, ORIGINAL_RECIPES, RECIPES } from "./content";
import { checkpointOf, newBattle, resumeCheckpoint, START_HEALTH, type BattleState, type Checkpoint } from "./model";
import { englishMapping, RESONANCES, type EnglishCore } from "./resonance";

export const LEGACY_SAVE_KEY = "family-games/hanzi-tower-defense/v1";
export const V2_SAVE_KEY = "family-games/hanzi-tower-defense/v2";
export const SAVE_KEY = "family-games/hanzi-tower-defense/v3";
export const SAVE_VERSION = 3;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface Preferences { muted: boolean; reducedMotion: boolean; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
function validLegacyCheckpoint(value: unknown): value is Omit<Checkpoint, "englishCores" | "englishClaims" | "englishSkipped" | "nextEnglishId"> {
  if (!object(value) || !integer(value.seed, 0, 0xffffffff) || !integer(value.wave, 0, mapFor(isMapId(value.mapId)?value.mapId:undefined).waves.length)
    || (value.mapId !== undefined && !isMapId(value.mapId))
    || !integer(value.health, 1, START_HEALTH) || !integer(value.nextCoreId, 1)
    || !integer(value.kills, 0) || !integer(value.leaks, 0) || typeof value.elapsed !== "number"
    || !Number.isFinite(value.elapsed) || value.elapsed < 0 || !Array.isArray(value.cores) || value.cores.length > 1000) return false;
  const ids = new Set<number>(), slots = new Set<number>();
  for (const item of value.cores) {
    if (!object(item) || !integer(item.id, 1, value.nextCoreId - 1) || ids.has(item.id)
      || !(mapFor(isMapId(value.mapId)?value.mapId:undefined).expanded?CORE_ORDER:ORIGINAL_CORE_ORDER).some(kind => kind === item.kind) || typeof item.cooldown !== "number" || !Number.isFinite(item.cooldown) || item.cooldown < 0
      || (item.slot !== null && (!integer(item.slot, 0, mapFor(isMapId(value.mapId)?value.mapId:undefined).slots.length - 1) || slots.has(item.slot)))) return false;
    ids.add(item.id); if (item.slot !== null) slots.add(item.slot as number);
  }
  return true;
}
export function validCheckpoint(value: unknown): value is Checkpoint {
  if (!validLegacyCheckpoint(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  if (!Array.isArray(v.englishCores) || v.englishCores.length > RESONANCES.length || !integer(v.nextEnglishId, 1, RESONANCES.length + 1)
    || !Array.isArray(v.englishClaims) || !Array.isArray(v.englishSkipped)) return false;
  for (const list of [v.englishClaims, v.englishSkipped]) if (new Set(list).size !== list.length || list.some(id => !RESONANCES.some(r => r.grantId === id && (r.coreId!=="forest"||mapFor(value.mapId).expanded)))) return false;
  if (v.englishClaims.some(id => (v.englishSkipped as unknown[]).includes(id)) || v.englishClaims.length !== v.englishCores.length) return false;
  const ids = new Set<number>(), attached = new Set<number>(), grants = new Set<string>();
  for (const e of v.englishCores) {
    if (!object(e) || !integer(e.id, 1, v.nextEnglishId - 1) || ids.has(e.id)) return false;
    const mapping = englishMapping(e as unknown as EnglishCore);
    if (!mapping || (mapping.coreId==="forest"&&!mapFor(value.mapId).expanded) || grants.has(mapping.grantId) || !v.englishClaims.includes(mapping.grantId)) return false;
    if (e.attachedTo !== null && (!integer(e.attachedTo, 1) || attached.has(e.attachedTo) || !value.cores.some(c => c.id === e.attachedTo && c.kind === mapping.coreId))) return false;
    ids.add(e.id); grants.add(mapping.grantId); if (e.attachedTo !== null) attached.add(e.attachedTo as number);
  }
  return true;
}

function validPayload(parsed: unknown, version: number): parsed is Record<string, unknown> & { checkpoint: Checkpoint; unlocked: string[]; preferences: Preferences } {
  return object(parsed) && parsed.version === version && (version>=3 || object(parsed.checkpoint) && (parsed.checkpoint.mapId===undefined || parsed.checkpoint.mapId==="qinglan-pass")) && (version === 1 ? validLegacyCheckpoint(parsed.checkpoint) : validCheckpoint(parsed.checkpoint))
    && Array.isArray(parsed.unlocked) && parsed.unlocked.every(id => typeof id === "string" && (version<3?ORIGINAL_RECIPES:RECIPES).some(r => r.id === id))
    && object(parsed.preferences) && typeof parsed.preferences.muted === "boolean" && typeof parsed.preferences.reducedMotion === "boolean";
}


interface MapSave { checkpoint: Checkpoint; unlocked: string[]; [key:string]: unknown; }
interface Payload { version:number; activeMapId:MapId; maps:Partial<Record<MapId,MapSave>>; preferences:Preferences; [key:string]:unknown; }
function validV3(parsed:unknown):parsed is Payload {
 if(!object(parsed)||parsed.version!==3||!isMapId(parsed.activeMapId)||!object(parsed.maps)||!object(parsed.preferences)||typeof parsed.preferences.muted!=="boolean"||typeof parsed.preferences.reducedMotion!=="boolean") return false;
 return Object.entries(parsed.maps).every(([id,value])=>isMapId(id)&&object(value)&&validCheckpoint(value.checkpoint)&&value.checkpoint.mapId===id&&Array.isArray(value.unlocked)&&value.unlocked.every(r=>(mapFor(id).expanded?RECIPES:ORIGINAL_RECIPES).some(recipe=>recipe.id===r)));
}
/** Each map owns one continue slot. Copy migrations and all writes compare the exact raw source bytes. */
export function openSave(storage:StorageLike,defaults:Preferences) {
 let raw:string|null=null,writable=true,migrated=false,hasCheckpoint=false;
 let payload:Payload={version:3,activeMapId:"qinglan-pass",maps:{},preferences:{...defaults}};
 let state=newBattle(),preferences={...defaults};
 try {
  raw=storage.getItem(SAVE_KEY);
  if(raw===null) {
   const v2raw=storage.getItem(V2_SAVE_KEY), sourceKey=v2raw===null?LEGACY_SAVE_KEY:V2_SAVE_KEY;
   const oldRaw=v2raw??storage.getItem(LEGACY_SAVE_KEY);
   if(oldRaw!==null) {
    const old:unknown=JSON.parse(oldRaw), version=sourceKey===V2_SAVE_KEY?2:1;
    if(!validPayload(old,version)) throw Error("Unrecognized legacy save");
    const checkpoint:Checkpoint={...old.checkpoint,mapId:"qinglan-pass",...(version===1?{englishCores:[],englishClaims:[],englishSkipped:RESONANCES.filter(r=>r.coreId!=="forest"&&r.dropWave<old.checkpoint.wave).map(r=>r.grantId),nextEnglishId:1}:{})};
    payload={version:3,activeMapId:"qinglan-pass",maps:{"qinglan-pass":{checkpoint,unlocked:[...new Set(old.unlocked)]}},preferences:{...old.preferences}};
    state=resumeCheckpoint(checkpoint,old.unlocked);preferences={...old.preferences};hasCheckpoint=true;
    if(storage.getItem(SAVE_KEY)!==null||storage.getItem(sourceKey)!==oldRaw) throw Error("Concurrent migration");
    const nextRaw=JSON.stringify(payload); storage.setItem(SAVE_KEY,nextRaw);raw=nextRaw;migrated=true;
   }
  } else {
   const parsed:unknown=JSON.parse(raw);if(!validV3(parsed))throw Error("Unrecognized save");payload=parsed;
   const entry=payload.maps[payload.activeMapId]; if(entry){state=resumeCheckpoint(entry.checkpoint,entry.unlocked);hasCheckpoint=true;}else state=newBattle(undefined,[],payload.activeMapId);
   preferences={...payload.preferences};
  }
 }catch {writable=false;}
 return {
  state,preferences,hasCheckpoint,migrated,get writable(){return writable;},
  list():{mapId:MapId;wave:number;won:boolean}[]{return Object.entries(payload.maps).map(([id,entry])=>({mapId:id as MapId,wave:entry!.checkpoint.wave,won:entry!.checkpoint.wave>=mapFor(id as MapId).waves.length}));},
  load(mapId:MapId):BattleState|null {const entry=payload.maps[mapId];return entry?resumeCheckpoint(entry.checkpoint,entry.unlocked):null;},
  write(current:BattleState,settings:Preferences):boolean {
   if(!writable)return false;
   try {
    if(storage.getItem(SAVE_KEY)!==raw){writable=false;return false;}
    const checkpoint=current.phase==="ready"||current.phase==="won"?checkpointOf(current):checkpointOf(current.checkpoint);
    const mapId=checkpoint.mapId??"qinglan-pass";if(!validCheckpoint(checkpoint)){writable=false;return false;}
    const previous=payload.maps[mapId];
    const next:Payload={...payload,version:3,activeMapId:mapId,maps:{...payload.maps,[mapId]:{...previous,checkpoint:{...previous?.checkpoint,...checkpoint},unlocked:[...current.unlocked]}},preferences:{...payload.preferences,...settings}};
    const nextRaw=JSON.stringify(next);storage.setItem(SAVE_KEY,nextRaw);raw=nextRaw;payload=next;return true;
   }catch {writable=false;return false;}
  },
 };
}
