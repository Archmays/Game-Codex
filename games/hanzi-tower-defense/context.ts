import { openPresentation } from '../../packages/presentation/settings';
import { MusicLoops } from '../../packages/presentation/music';
import { mapFor, isMapId, type MapId } from "./maps";
import { BattleAudio } from "./audio";
import { RECIPES, type Recipe } from "./content";
import { newTactics, choosePreparation, DEFAULT_SEED, newBattle, type BattleEvent, type Core, type EquipmentPreview } from "./model";
import { openSave, openTacticsSave, type StorageLike } from "./save";
import { isScenarioId, rulesFor, type ScenarioId } from './tactics';
function browserStorage(): StorageLike { try { return window.localStorage; } catch { return { getItem() { throw Error("Unavailable"); }, setItem() { throw Error("Unavailable"); } }; } }
export function createDefenseContext(root: HTMLElement, onExit: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let requestedScenario=new URLSearchParams(window.location.search).get('scenario');
  const storage=browserStorage(),defaults={muted:false,reducedMotion:media.matches};
  const presentation=openPresentation(storage,'tower'), visual= presentation.value;
  if(!requestedScenario && !new URLSearchParams(location.search).has('map') && isScenarioId(visual.lastContent)) requestedScenario=visual.lastContent;
  let campaignSave:ReturnType<typeof openSave>|null=isScenarioId(requestedScenario)?null:openSave(storage,defaults);
  const campaign=()=>campaignSave??(campaignSave=openSave(storage,defaults));
  const tacticsSave=openTacticsSave(storage,defaults);
  let state=isScenarioId(requestedScenario)?tacticsSave.load(requestedScenario)??newTactics(requestedScenario):campaign().state;
  let preferences=isScenarioId(requestedScenario)?tacticsSave.preferences:campaign().preferences, selection:number[]=[],destroyed=false,inventorySignature='',statusSignature='';
  const requestedMap=new URLSearchParams(window.location.search).get('map') ?? (isMapId(visual.lastContent) ? visual.lastContent : null);
  if(!isScenarioId(requestedScenario)&&isMapId(requestedMap))state=campaign().load(requestedMap)??newBattle(DEFAULT_SEED,[],requestedMap);
  const activeSave=()=>c.state.scenarioId?tacticsSave:campaign();
  let SLOTS=mapFor(state.mapId).slots,WAVES=rulesFor(state).waves,pendingMap:MapId=state.mapId??'qinglan-pass',pendingScenario:ScenarioId|undefined=state.scenarioId,rangeOnly=false,resultPresented=false,bossAnnouncement='';
  let battleSpeed: 1 | 2 = 1, resetDiscoveries=true;
  const currentRecipes=()=>mapFor(c.state.mapId).expanded?RECIPES:RECIPES.slice(0,5);
  // Composition, destination and inspection have independent lifetimes; none is stored in the save.
  let fusionTarget: number | null = null, chosenRecipe: string | undefined, freshResult = false;
  let inspectedId: number | null = null, hoveredSlot: number | null = null, focusedSlot: number | null = null;
  let viewSource: "hover" | "focus" = "hover";
  let draggedId: number | null = null, showAllRanges = false, rangeSignature = "";
  let englishSelected: number | null = null, equipmentTarget: number | null = null, englishDragged: number | null = null;
  let equipmentPreview: EquipmentPreview | null = null, pendingRecycle: number | null = null, englishSignature = "";
  const audio = new BattleAudio(); audio.muted = preferences.muted; audio.setVolume(visual.effects);
  const music=new MusicLoops('tower',failed=>{ const retry=root.querySelector<HTMLElement>('[data-presentation-retry]'); if(retry)retry.hidden=!failed; });
  let fusionAnimation=0, sceneAssetsFailed=false, returnToManagement=false, challengeSignature='';
  const failedImages=new Set<HTMLImageElement>();
  const timers = new Set<number>();
const el = <T extends HTMLElement>(selector: string): T => { const found = root.querySelector<T>(selector); if (!found) throw Error(`Missing ${selector}`); return found; };
const button = (selector: string) => el<HTMLButtonElement>(selector);
const group = { refresh() {}, destroy() {} };
const c = {
root, onExit, state, preferences, visual, presentation, campaign, tacticsSave, activeSave, SLOTS, WAVES, pendingMap, pendingScenario, rangeOnly, resultPresented, bossAnnouncement, battleSpeed: battleSpeed as 1 | 2, resetDiscoveries, currentRecipes, fusionTarget: fusionTarget as number | null, chosenRecipe: chosenRecipe as string | undefined, freshResult, inspectedId: inspectedId as number | null, hoveredSlot: hoveredSlot as number | null, focusedSlot: focusedSlot as number | null, viewSource: viewSource as "hover" | "focus", draggedId: draggedId as number | null, showAllRanges, rangeSignature, englishSelected: englishSelected as number | null, equipmentTarget: equipmentTarget as number | null, englishDragged: englishDragged as number | null, equipmentPreview: equipmentPreview as EquipmentPreview | null, pendingRecycle: pendingRecycle as number | null, englishSignature, audio, music, fusionAnimation, sceneAssetsFailed, returnToManagement, challengeSignature, failedImages, timers, selection, destroyed, inventorySignature, statusSignature, el, button,
get gameRoot() { return el<HTMLElement>('.td-game'); },
get board() { return el<HTMLElement>('[data-td-board]'); },
get bag() { return el<HTMLElement>('[data-td-bag]'); },
get feedback() { return el<HTMLElement>('[data-td-feedback]'); },
get restartDialog() { return el<HTMLDialogElement>('[data-td-restart-dialog]'); },
get resultDialog() { return el<HTMLDialogElement>('[data-td-result]'); },
get mapDialog() { return el<HTMLDialogElement>('[data-td-map-dialog]'); },
get settingsDialog() { return el<HTMLDialogElement>('[data-td-settings-dialog]'); },
bagKeys:group,slotKeys:group,englishKeys:group,packKeys:group,goalKeys:group,
later(action: () => void, delay: number): void  { throw Error('Unbound defense action: later'); },
message(text: string): void  { throw Error('Unbound defense action: message'); },
savePresentation():void  { throw Error('Unbound defense action: savePresentation'); },
persist(): void  { throw Error('Unbound defense action: persist'); },
selectedCores(): Core[]  { throw Error('Unbound defense action: selectedCores'); },
prepare(ids: number[], target?: number | null, recipeId?: string): void  { throw Error('Unbound defense action: prepare'); },
choose(id: number): void  { throw Error('Unbound defense action: choose'); },
isPartner(core: Core): boolean  { throw Error('Unbound defense action: isPartner'); },
renderRanges(): void  { throw Error('Unbound defense action: renderRanges'); },
renderInventory(): void  { throw Error('Unbound defense action: renderInventory'); },
renderComposer(): void  { throw Error('Unbound defense action: renderComposer'); },
chooseEnglish(id: number): void  { throw Error('Unbound defense action: chooseEnglish'); },
renderEquipment(): void  { throw Error('Unbound defense action: renderEquipment'); },
updateStatus(): void  { throw Error('Unbound defense action: updateStatus'); },
focusWaveControl(): void  { throw Error('Unbound defense action: focusWaveControl'); },
animateFusion(recipe: Recipe, target: number | null): void  { throw Error('Unbound defense action: animateFusion'); },
handleEvents(events: BattleEvent[]): void  { throw Error('Unbound defense action: handleEvents'); },
clearSelection(): void  { throw Error('Unbound defense action: clearSelection'); },
place(slot: number): void  { throw Error('Unbound defense action: place'); },
beginDrag(event: DragEvent, id: number): void  { throw Error('Unbound defense action: beginDrag'); },
endDrag(): void  { throw Error('Unbound defense action: endDrag'); },
togglePause(): void  { throw Error('Unbound defense action: togglePause'); },
refreshMap():void  { throw Error('Unbound defense action: refreshMap'); },
restart(clearDiscoveries=true): void  { throw Error('Unbound defense action: restart'); },
selectMap(id:MapId,fresh:boolean):void  { throw Error('Unbound defense action: selectMap'); },
showMaps(fresh:boolean):void  { throw Error('Unbound defense action: showMaps'); },
renderTacticsBrief():void  { throw Error('Unbound defense action: renderTacticsBrief'); },
renderChallenge():void  { throw Error('Unbound defense action: renderChallenge'); },
selectPreparation(patch:Parameters<typeof choosePreparation>[1]):void  { throw Error('Unbound defense action: selectPreparation'); },
switchVariation():void  { throw Error('Unbound defense action: switchVariation'); },
selectScenario(id:ScenarioId):void  { throw Error('Unbound defense action: selectScenario'); },
showTactics():void  { throw Error('Unbound defense action: showTactics'); },
retryCurrentWave():void  { throw Error('Unbound defense action: retryCurrentWave'); }
};
return c;
}
export type DefenseContext = ReturnType<typeof createDefenseContext>;
