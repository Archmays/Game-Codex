import { DEFENSE_MAPS, MAP_IDS, isMapId, type MapId } from "./maps";
import { CORES, recipeFor, RECIPES, type CoreKind } from "./content";
import { newTactics, deploymentLimit, attachedEnglish, DEFAULT_SEED, deploy, equipEnglish, fuse, newBattle, recycle, startWave, stow, unequipEnglish } from "./model";
import { englishMapping } from "./resonance";
import { rulesFor } from './tactics';
import type { DefenseContext } from './context';
export function createDefenseActions(ctx: DefenseContext) {
function clearSelection(): void {
    ctx.inspectedId = null; ctx.hoveredSlot = null; ctx.focusedSlot = null; ctx.draggedId = null;
    ctx.englishSelected = null; ctx.equipmentTarget = null; ctx.englishDragged=null; ctx.equipmentPreview=null; ctx.pendingRecycle=null;
    ctx.renderEquipment();
    ctx.prepare([]);
  }
function place(slot: number): void {
    ctx.audio.unlock(); const item = ctx.state.cores.find(c => c.slot === slot);
    if(ctx.rangeOnly) {ctx.inspectedId=item?.id??null;ctx.hoveredSlot=null;ctx.focusedSlot=null;ctx.renderRanges();ctx.message(item?`正在查看 ${CORES[item.kind].glyph} 的真实射程，选料未变。`:"这是空塔位，选料未变。");return;}
    if (item) { ctx.choose(item.id); return; }
    if (ctx.englishSelected!==null) { ctx.message('英文核装入完整中文词塔。先点亮起的字塔或背包词核；空位不能单独部署英文。'); return; }
    const selected = ctx.selectedCores();
    if (selected.length === 1 && deploy(ctx.state, selected[0].id, slot)) { ctx.message(`${CORES[selected[0].kind].glyph}已部署到${ctx.SLOTS[slot].name}。`); ctx.audio.play("deploy"); ctx.prepare([]); ctx.inspectedId = selected[0].id; ctx.persist(); }
    else {const limit=deploymentLimit(ctx.state),full=limit!==null&&ctx.state.cores.filter(c=>c.slot!==null).length>=limit;
      ctx.message(full&&selected.length===1&&selected[0].slot===null?`上场已满 ${limit}／${limit}。先在波间收回一座塔，再放这枚材料；材料还在选中。`:ctx.state.scenarioId&&ctx.state.phase==='battle'&&selected.length===1&&selected[0].slot!==null?"这一波中不能移动已部署的塔，暂停仍在战中。可首次部署或合成，移动请等波间或重整。":"先选一枚材料，再点这个塔位。选了两枚时，先在组合台确认。");}
    ctx.updateStatus();
  }
function togglePause(): void {
    if (ctx.state.phase !== "battle") return; ctx.audio.unlock(); ctx.state.paused = !ctx.state.paused; ctx.updateStatus();
    if (!ctx.state.paused) ctx.music.unlock();
    if (ctx.state.paused) ctx.message("战斗已暂停。部署和组合仍然可用。");
  }
function restart(clearDiscoveries=true): void {
    ctx.returnToManagement=false;ctx.restartDialog.close();ctx.resultDialog.close();ctx.state=ctx.pendingScenario?newTactics(ctx.pendingScenario,clearDiscoveries?[]:ctx.state.unlocked,!clearDiscoveries&&ctx.pendingScenario===ctx.state.scenarioId?ctx.state.challenge:undefined):newBattle(DEFAULT_SEED,clearDiscoveries?[]:ctx.state.unlocked,ctx.pendingMap);ctx.refreshMap();if(!clearDiscoveries&&!ctx.state.scenarioId)startWave(ctx.state);ctx.persist();ctx.audio.unlock();ctx.updateStatus();
    ctx.message(`${rulesFor(ctx.state).title} 已重置，固定起始材料已放好。准备好再开波。`);ctx.focusWaveControl();
  }
function selectMap(id:MapId,fresh:boolean):void {
    ctx.persist();ctx.mapDialog.close();ctx.pendingScenario=undefined;ctx.resetDiscoveries=true;
    if(fresh&&ctx.campaign().load(id)){ctx.pendingMap=id;ctx.el('[data-td-reset-copy]').textContent=`将重置 ${DEFENSE_MAPS[id].title} 的波次、材料和配方发现。其他地图与旧存档原文保留。`;ctx.restartDialog.showModal();return;}
    ctx.state=fresh?newBattle(DEFAULT_SEED,[],id):ctx.campaign().load(id)??newBattle(DEFAULT_SEED,[],id);
    ctx.refreshMap();ctx.persist();ctx.message(`已进入 ${DEFENSE_MAPS[id].title}，第 ${Math.min(ctx.state.wave+1,ctx.WAVES.length)} 波。各图资源独立；未完成波次已回到波前。`);ctx.focusWaveControl();
  }
function showMaps(fresh:boolean):void {
    if(ctx.state.phase==='battle')ctx.state.paused=true;ctx.persist();ctx.updateStatus();ctx.draggedId=null;ctx.englishDragged=null;
    ctx.el('#td-map-dialog-title').textContent=fresh?'新游戏 · 选择地图':'继续游戏 · 选择存档';
    ctx.el('[data-td-map-note]').textContent='每张地图独立继续。未结束的波次会回到波前检查点，材料一起回滚。';
    const entries=ctx.campaign().list();ctx.el('[data-td-map-list]').innerHTML=MAP_IDS.map(id=>{const entry=entries.find(e=>e.mapId===id);return `<button type="button" data-map-select="${id}" ${!fresh&&!entry?'disabled':''}><b>${DEFENSE_MAPS[id].title}</b><span>${fresh?DEFENSE_MAPS[id].description:entry?entry.won?'已守住 · 可查看结果':`继续第 ${entry.wave+1} 波`:'还没有存档'}</span></button>`;}).join('');
    ctx.el('[data-td-map-list]').onclick=event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-map-select]')?.dataset.mapSelect;if(isMapId(id))ctx.selectMap(id,fresh);};
    ctx.mapDialog.showModal();
  }
return { clearSelection, place, togglePause, restart, selectMap, showMaps };
}
export function bindDefenseActions(ctx: DefenseContext): void {
  ctx.button('[data-td-new]').addEventListener('click',()=>ctx.showMaps(true));ctx.button('[data-td-continue]').addEventListener('click',()=>ctx.showMaps(false));
  ctx.button('[data-td-map-cancel]').addEventListener('click',()=>ctx.mapDialog.close());
  ctx.button('[data-td-inspect]').addEventListener('click',()=>{ctx.rangeOnly=!ctx.rangeOnly;ctx.button('[data-td-inspect]').setAttribute('aria-pressed',String(ctx.rangeOnly));ctx.message(ctx.rangeOnly?'只看射程：点塔查看，不改变已选材料。':'回到部署与选料。');});
  ctx.button("[data-td-fuse]").addEventListener("click", () => {
    const [a, b] = ctx.selectedCores(); if (!a || !b) return;
    const recipe = recipeFor(a.kind, b.kind, ctx.chosenRecipe,ctx.currentRecipes()); if (!recipe) return;
    const target = ctx.fusionTarget; const result = fuse(ctx.state, a.id, b.id, target, recipe.id); if (!result) { ctx.message("材料或目标已变化，请重新选择；没有消耗材料。"); return; }
    ctx.audio.unlock(); ctx.music.duck();ctx.audio.play("fusion"); ctx.animateFusion(recipe, target); ctx.prepare([result.id]); ctx.freshResult = true;
    ctx.inspectedId = target === null ? null : result.id; ctx.hoveredSlot = null; ctx.focusedSlot = null;
    ctx.persist(); ctx.updateStatus();
    ctx.message(`${CORES[result.kind].glyph} · ${CORES[result.kind].pinyin}。${CORES[result.kind].attack}！${target === null ? "已选中新字核，点空塔位即可部署。" : "字塔已升级，正在显示新的攻击范围。"}`);
    if (target !== null) ctx.button(`[data-slot="${target}"]`).focus({ preventScroll: true });
    else ctx.bag.querySelector<HTMLElement>(`[data-core="${result.id}"]`)?.focus({ preventScroll: true });
  });
  ctx.button("[data-td-clear]").addEventListener("click", ctx.clearSelection);
  ctx.el("[data-td-preview]").addEventListener("click", event => {
    const candidate = (event.target as HTMLElement).closest<HTMLElement>("[data-result-recipe]");
    if (candidate) { ctx.chosenRecipe = candidate.dataset.resultRecipe; ctx.renderComposer(); }
  });
  ctx.el("[data-td-target]").addEventListener("click", event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-fusion-target]");
    if (target && ctx.selectedCores().some(c => c.slot === Number(target.dataset.fusionTarget))) { ctx.fusionTarget = Number(target.dataset.fusionTarget); ctx.renderComposer(); }
  });
  ctx.button("[data-td-all-ranges]").addEventListener("click", () => {
    ctx.showAllRanges = !ctx.showAllRanges; ctx.button("[data-td-all-ranges]").setAttribute("aria-pressed", String(ctx.showAllRanges)); ctx.renderRanges();
  });
  ctx.button("[data-td-stow]").addEventListener("click", () => { const item = ctx.selectedCores()[0]; if (item && stow(ctx.state, item.id)) { ctx.clearSelection(); ctx.persist(); ctx.message("字核已收回，原塔位可以重新部署。");ctx.bag.querySelector<HTMLElement>(`[data-core="${item.id}"]`)?.focus(); } });
  ctx.button("[data-td-recycle]").addEventListener("click", () => { const item = ctx.selectedCores()[0]; if (item) {
    if (attachedEnglish(ctx.state,item.id)) { ctx.pendingRecycle=item.id; ctx.renderEquipment(); ctx.renderComposer(); return; }
    const gain = recycle(ctx.state, item.id); if (gain) { ctx.clearSelection(); ctx.persist(); ctx.updateStatus(); ctx.message(`材料已回收，城门修补 ${gain} 点。`); }
  } });
  ctx.button('[data-td-equip]').addEventListener('click',()=>{
    if (!ctx.equipmentPreview || !equipEnglish(ctx.state,ctx.equipmentPreview)) return;
    const c=ctx.state.cores.find(c=>c.id===ctx.equipmentPreview!.targetId)!; ctx.audio.unlock(); ctx.music.duck();ctx.audio.play('equip');
    ctx.message(`${CORES[c.kind].glyph}已装备 ${englishMapping(attachedEnglish(ctx.state,c.id)!)!.text}，共鸣开始。`);
    ctx.englishSelected=null; ctx.equipmentTarget=null; ctx.equipmentPreview=null; ctx.prepare([c.id]); ctx.inspectedId=c.slot!==null?c.id:null;
    ctx.persist(); ctx.renderEquipment(); ctx.updateStatus();
    (c.slot===null?ctx.bag.querySelector<HTMLElement>(`[data-core="${c.id}"]`):ctx.root.querySelector<HTMLElement>(`[data-slot="${c.slot}"]`))?.focus({preventScroll:true});
  });
  ctx.button('[data-td-unequip]').addEventListener('click',()=>{
    const e=ctx.state.englishCores.find(e=>e.id===ctx.englishSelected); if (!e || e.attachedTo===null || !unequipEnglish(ctx.state,e.id,e.attachedTo)) return;
    ctx.message('英文核已回到背包。可以选择另一座同义词塔，预览再装备。'); ctx.persist(); ctx.renderEquipment(); ctx.renderInventory(); ctx.renderComposer();
  });
  ctx.button('[data-td-confirm-recycle]').addEventListener('click',()=>{
    if (ctx.pendingRecycle===null) return; const gain=recycle(ctx.state,ctx.pendingRecycle); if (!gain) { ctx.renderEquipment(); return; }
    ctx.clearSelection(); ctx.persist(); ctx.updateStatus(); ctx.message(`字核已回收修城 ＋${gain}，英文核原枚返还背包。`);
  });
  ctx.button('[data-td-cancel-equipment]').addEventListener('click',()=>{ctx.clearSelection();ctx.message('已取消预览，所有字核与装备都还在。');});
  ctx.button('[data-td-english-notice]').addEventListener('click',()=>{
    const e=ctx.state.englishCores.find(e=>e.attachedTo===null); if (!e) return;
    ctx.chooseEnglish(e.id); const control=ctx.button(`[data-english="${e.id}"]`); control.scrollIntoView({block:'center'});control.focus({preventScroll:true});
  });
  for (const recipeButton of ctx.root.querySelectorAll<HTMLButtonElement>("[data-recipe]")) recipeButton.addEventListener("click", () => {
    const recipe = RECIPES.find(r => r.id === recipeButton.dataset.recipe)!;
    const candidates = [...ctx.state.cores].sort((a, b) => Number(a.slot !== null) - Number(b.slot !== null) || a.id - b.id);
    const first = candidates.find(c => c.kind === recipe.inputs[0]), second = candidates.find(c => c.kind === recipe.inputs[1] && c.id !== first?.id);
    if (!first || !second) { ctx.message(`还缺 ${[!first ? recipe.inputs[0] : null, !second ? recipe.inputs[1] : null].filter((k): k is CoreKind => k !== null).map(k => CORES[k].glyph).join(" 和 ")}。每波掉落会补充材料。`); return; }
    ctx.prepare([first.id, second.id], undefined, recipe.id); ctx.button("[data-td-fuse]").focus({ preventScroll: true });
  });
  ctx.button("[data-td-pause]").addEventListener("click", ctx.togglePause);
  ctx.button("[data-td-next]").addEventListener("click", () => { ctx.audio.unlock(); if (startWave(ctx.state)) { ctx.persist(); ctx.updateStatus(); ctx.music.unlock(); ctx.message("怪物出发了。需要组合时，随时暂停。"); } });
  ctx.button("[data-td-mute]").addEventListener("click", () => { ctx.preferences.muted = !ctx.preferences.muted; ctx.audio.setMuted(ctx.preferences.muted); ctx.persist(); ctx.updateStatus(); if (!ctx.preferences.muted) {ctx.music.unlock();ctx.audio.play("deploy");} });
  ctx.button("[data-td-motion]").addEventListener("click", () => { ctx.preferences.reducedMotion = !ctx.preferences.reducedMotion; ctx.persist(); ctx.updateStatus(); });
  ctx.button("[data-td-speed]").addEventListener("click", () => { ctx.battleSpeed = ctx.battleSpeed === 1 ? 2 : 1; ctx.updateStatus(); ctx.message(`已切换为 ${ctx.battleSpeed} 倍速度${ctx.state.paused ? "，战斗仍暂停" : ""}。`); });
  ctx.button("[data-td-restart]").addEventListener("click", () => { ctx.returnToManagement=true;ctx.settingsDialog.close(); if (ctx.state.phase === "battle") ctx.state.paused = true; ctx.updateStatus();ctx.pendingMap=ctx.state.mapId??"qinglan-pass";ctx.pendingScenario=ctx.state.scenarioId;ctx.resetDiscoveries=true;ctx.el("#td-restart-title").textContent=ctx.state.scenarioId?"重开这个短局？":"重置这张地图的进度？";ctx.el("[data-td-reset-copy]").textContent=`将重置 ${rulesFor(ctx.state).title} 的进度、材料和配方发现。其他地图与旧存档原文保留。`; ctx.restartDialog.showModal(); });
}
