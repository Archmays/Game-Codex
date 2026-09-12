import { bindInputLifecycle, ignoreGameKey, rovingGroup, preserveRegionFocus } from "../../packages/ui/input";
import { DEFENSE_MAPS, MAP_IDS, mapFor, isMapId, type MapId } from "./maps";
import Phaser from "phaser";
import type { GameDefinition, MountedGame } from "../../packages/game-core";
import { BattleAudio } from "./audio";
import { CORES, CORE_ORDER, recipeCandidates, recipeFor, RECIPES, type CoreKind, type Recipe } from "./content";
import { activeResonance, attachedEnglish, DEFAULT_SEED, deploy, equipEnglish, fuse, MAP, newBattle, previewEquipment, recycle, startWave, stow, unequipEnglish, type BattleEvent, type Core, type EquipmentPreview } from "./model";
import { englishMapping, resonanceFor, RESONANCES } from "./resonance";
import { openSave, type StorageLike } from "./save";
import { DefenseScene } from "./scene";
import "./styles.css";

export const hanziTowerDefenseGame: GameDefinition = {
  id: "hanzi-tower-defense", title: "字阵守城", description: "摆下字塔，把部件合成汉字，守住最后一弯。", subject: "识字", recommendedAge: "6 岁起", learningGoal: "在守城中观察部件结构与双字词序。", status: "可玩", playLabel: "开始守城", route: "?play=hanzi-tower-defense&from=hub",
  mount: context => mountHanziTowerDefense(context.container, context.onExit),
};

const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const color = (kind: CoreKind): string => `#${CORES[kind].color.toString(16).padStart(6, "0")}`;
function browserStorage(): StorageLike { try { return window.localStorage; } catch { return { getItem() { throw Error("Unavailable"); }, setItem() { throw Error("Unavailable"); } }; } }

export function mountHanziTowerDefense(root: HTMLElement, onExit = () => window.location.assign(new URLSearchParams(window.location.search).get("from") === "hub" ? "?hub=classic&from=world" : "?world=my-game-world")): MountedGame {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const save = openSave(browserStorage(), { muted: false, reducedMotion: media.matches });
  let state = save.state, preferences = save.preferences, selection: number[] = [], destroyed = false, inventorySignature = "", statusSignature = "";
  const requestedMap=new URLSearchParams(window.location.search).get('map');
  if(isMapId(requestedMap)) state=save.load(requestedMap)??newBattle(DEFAULT_SEED,[],requestedMap);
  let SLOTS=mapFor(state.mapId).slots, WAVES=mapFor(state.mapId).waves, pendingMap:MapId=state.mapId??"qinglan-pass", rangeOnly=false,resultPresented=false,bossAnnouncement="";
  let battleSpeed: 1 | 2 = 1;
  const currentRecipes=()=>mapFor(state.mapId).expanded?RECIPES:RECIPES.slice(0,5);
  // Composition, destination and inspection have independent lifetimes; none is stored in the save.
  let fusionTarget: number | null = null, chosenRecipe: string | undefined, freshResult = false;
  let inspectedId: number | null = null, hoveredSlot: number | null = null, focusedSlot: number | null = null;
  let viewSource: "hover" | "focus" = "hover";
  let draggedId: number | null = null, showAllRanges = false, rangeSignature = "";
  let englishSelected: number | null = null, equipmentTarget: number | null = null, englishDragged: number | null = null;
  let equipmentPreview: EquipmentPreview | null = null, pendingRecycle: number | null = null, englishSignature = "";
  const audio = new BattleAudio(); audio.muted = preferences.muted;
  const timers = new Set<number>();
  root.className = "td-mount";
  root.innerHTML = `<main class="td-game" aria-labelledby="td-title" data-testid="hanzi-tower-defense">
    <header class="td-header"><div class="td-brand"><span class="td-seal" aria-hidden="true">守</span><div><p data-td-map-title>${mapFor(state.mapId).title} · ${mapFor(state.mapId).description}</p><h1 id="td-title">字阵守城</h1></div></div>
      <nav class="td-controls" aria-label="守城操作"><button type="button" data-td-home>返回</button><button type="button" data-td-restart>重置进度</button><button type="button" data-td-new>新游戏</button><button type="button" data-td-continue>继续游戏</button><button type="button" data-td-mute aria-pressed="false">静音</button><button type="button" data-td-motion aria-pressed="false">减少动态</button><button type="button" data-td-speed aria-pressed="false" aria-label="战斗速度1倍，切换为2倍">速度 1×</button><button type="button" data-td-pause class="td-pause" aria-pressed="false">暂停</button></nav>
    </header>
    <div class="td-ribbon"><span data-td-wave></span><span class="td-gate-health">城门 <strong data-td-health>16</strong><span class="td-health-track" aria-hidden="true"><i data-td-health-fill></i></span></span><span data-td-enemies></span></div>
    <div class="td-layout"><section class="td-battle-column" aria-label="守城战场">
      <div class="td-board" data-td-board><div class="td-canvas" data-td-canvas aria-hidden="true"></div>
        <svg class="td-ranges" data-td-ranges viewBox="0 0 ${MAP.width} ${MAP.height}" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="td-slots" role="group" aria-label="塔位区，方向键选择，Tab 离开">${SLOTS.map((slot, index) => `<button type="button" class="td-slot" data-slot="${index}" style="left:${slot.x / MAP.width * 100}%;top:${slot.y / MAP.height * 100}%" aria-label="塔位${index + 1} ${slot.name}，空位"><img class="td-tower-art" alt="" hidden><span class="td-slot-glyph">＋</span><small>${index + 1}</small></button>`).join("")}</div>
        <span class="td-road-entry" aria-hidden="true">来路 →</span><div class="td-field-message" data-td-field-message hidden></div><div class="td-drops" data-td-drops aria-hidden="true"></div><div class="td-synthesis" data-td-synthesis aria-hidden="true" hidden></div>
      </div>
      <div class="td-range-tools"><span data-td-range-caption>指向或点选字塔，查看攻击范围</span><button type="button" data-td-inspect aria-pressed="false">只看射程</button><button type="button" data-td-all-ranges aria-pressed="false">显示全部射程</button></div>
      <button type="button" class="td-english-notice" data-td-english-notice hidden></button>
      <div class="td-wave-action"><p data-td-wave-hint></p><button type="button" class="td-primary" data-td-next>开始这一波</button></div>
      <p class="td-feedback" role="status" aria-live="polite" data-td-feedback>火塔已就位。点一枚材料，再点空塔位。也可以先暂停。</p>
      <p class="td-boss-status" data-td-boss-status hidden></p><div class="td-enemy-key" aria-label="怪物特点"><span><i class="td-monster-dot td-monster-dot--swarm"></i>团团怪 · 成群</span><span><i class="td-monster-dot td-monster-dot--swift"></i>疾风怪 · 快速</span><span><i class="td-monster-dot td-monster-dot--stone"></i>石甲怪 · 耐打</span></div>
    </section>
    <aside class="td-workbench" aria-label="部署与组合">
      <section class="td-inventory"><div class="td-section-head"><h2>字核材料</h2><span>掉落自动收好</span></div><div class="td-bag" role="group" aria-label="材料区，方向键选择，Tab 离开" data-td-bag></div><p class="td-bag-empty" data-td-bag-empty hidden>材料都在塔上。点塔也能组合。</p></section>
      <section class="td-english" aria-label="英文共鸣装备"><div class="td-section-head"><h2>共鸣词核</h2><span>完整英文 · 装入同义词塔</span></div><div role="group" aria-label="英文区，方向键选择，Tab 离开" data-td-english-bag></div><p class="td-english-empty" data-td-english-empty>战利品会带来英文词核。拾得后，点英文和字塔，预览再装备。</p>
        <div class="td-equipment-detail" data-td-equipment-detail hidden><p data-td-equipment-copy></p><div class="td-equipment-actions"><button type="button" class="td-primary" data-td-equip hidden>确认装备</button><button type="button" data-td-unequip hidden>卸下到背包</button><button type="button" data-td-confirm-recycle hidden>确认回收并返还英文</button><button type="button" data-td-cancel-equipment>取消共鸣选择</button></div></div>
      </section>
      <section class="td-composer" aria-label="合字与组词"><div class="td-section-head"><h2>组合台</h2><button type="button" class="td-text-button" data-td-clear>取消选择</button></div><div class="td-selection" data-td-selection></div><div class="td-recipe-preview" data-td-preview></div><div class="td-partners" data-td-partners></div><div class="td-fusion-target" data-td-target></div><div class="td-compose-actions"><button type="button" class="td-primary" data-td-fuse disabled>选两枚字核</button></div>
      <div class="td-item-actions"><button type="button" data-td-stow hidden>收回材料栏</button><button type="button" data-td-recycle hidden>回收修城</button></div></section>
      <details class="td-recipes"><summary>看看能怎样组合</summary><div class="td-recipe-list">${RECIPES.map(r => `<button type="button" data-recipe="${r.id}"><span>${r.inputs.map(k => CORES[k].glyph).join(" ＋ ")} <b>→ ${CORES[r.result].glyph}</b></span><small>${r.structure === "word" ? "组词 · 保留词序" : r.structure === "top-bottom" ? "合字 · 上下" : r.structure === "pyramid" ? "合字 · 上木下林" : "合字 · 左右"}</small></button>`).join("")}</div></details>
      <details class="td-help"><summary>操作小提示</summary><p>点材料或塔上的字，再点空位部署。选两枚字核，先看结构和去向，再确认组合；材料先选谁都可以。点亮的字核能搭配，选满两枚后点另一枚可换搭档。</p><p>英文核是装备，每枚只强化一座同义中文词塔。先点英文再点塔、先点塔再点英文，或把英文拖到塔上，都先预览再确认。材料栏里的完整中文词核也能装备，再部署。还没合出对应词塔，可以先保留英文核。</p><p>战中可以首次装备；卸下、转移和回收带附件的字核，等这一波结束再做。暂停仍在战中。移动或收回字塔，英文会跟随。</p><p>指向或聚焦字塔只查看攻击范围；范围圈表示能选择攻击目标的距离，命中后的爆炸或减速扩散另算。选一枚字核，指向空位可先看覆盖，触屏直接点空位即可部署。</p><p>键盘 Tab 跨区，材料／塔位／英文区内用方向键、Home／End 快选，Enter 或 Space 确认；P 暂停，Esc 取消选择。聚焦塔位即可独立查看射程，触屏可切换“只看射程”。鼠标可拖字核到空位部署，拖到字塔则先预览组合；触屏点两枚字核，再确认即可。</p><p>顶部“速度”可切换 1×／2×，默认 1×。加速会一起加快怪物、攻击和呼援倒计时；暂停时切换速度仍不推进战斗。切图、重置、再守一局或刷新后回到 1×，速度只用于本页。</p><p>刷新回到这一波开始前，已完成波次保留。未完成波次的中英文掉落、装备和材料消耗一起重来。多余材料可回收修补本局城门。</p><p>法术是游戏想象，不是字源。“氵”叫三点水，是非成字部件。</p></details>
      <p class="td-save-note" data-td-save-note></p>
    </aside></div>
    <dialog class="td-dialog" data-td-restart-dialog aria-labelledby="td-restart-title"><h2 id="td-restart-title">重置这张地图的进度？</h2><p><span data-td-reset-copy>这张地图将从第一波重新布阵，发现的配方也会重置。其他地图和旧存档原文保留。</span></p><div><button type="button" data-td-cancel-restart>继续这一局</button><button type="button" class="td-primary" data-td-confirm-restart>重新开始</button></div></dialog>
    <dialog class="td-dialog" data-td-map-dialog aria-labelledby="td-map-dialog-title"><h2 id="td-map-dialog-title">选择地图</h2><p data-td-map-note>每张地图独立继续。未结束的波次会回到波前检查点，材料一起回滚。</p><div class="td-map-list" data-td-map-list></div><button type="button" data-td-map-cancel>返回战场</button></dialog>
    <dialog class="td-dialog td-result" data-td-result aria-labelledby="td-result-title"><span class="td-result-seal" aria-hidden="true">关</span><h2 id="td-result-title"></h2><p data-td-result-copy></p><div><button type="button" class="td-primary" data-td-replay>再守一局</button><button type="button" data-td-result-home>回游戏世界</button></div><p class="td-result-foot">发现的配方已经留下。换条组合路线再试试。</p></dialog>
  </main>`;
  const el = <T extends HTMLElement>(selector: string): T => { const found = root.querySelector<T>(selector); if (!found) throw Error(`Missing ${selector}`); return found; };
  const button = (selector: string) => el<HTMLButtonElement>(selector);
  const gameRoot = el<HTMLElement>(".td-game"), board = el<HTMLElement>("[data-td-board]"), bag = el<HTMLElement>("[data-td-bag]"), feedback = el<HTMLElement>("[data-td-feedback]");
  const restartDialog = el<HTMLDialogElement>("[data-td-restart-dialog]"), resultDialog = el<HTMLDialogElement>("[data-td-result]");
  const mapDialog=el<HTMLDialogElement>('[data-td-map-dialog]');
  const bagKeys=rovingGroup(bag,{items:'[data-core]',columns:()=>Math.max(1,getComputedStyle(bag).gridTemplateColumns.split(' ').length)});
  const slotKeys=rovingGroup(el('.td-slots'),{items:'[data-slot]'});
  const englishKeys=rovingGroup(el('[data-td-english-bag]'),{items:'[data-english]'});
  const lifecycle=bindInputLifecycle(root,(event)=>{
    // HTML dragstart transfers the pointer stream to native DnD with pointercancel.
    // Native dragend (including Escape), blur and hidden end that separate lifecycle.
    if(event?.type!=="pointercancel" || draggedId===null&&englishDragged===null){draggedId=null;englishDragged=null;}
    hoveredSlot=null;renderRanges();
  });
  function later(action: () => void, delay: number): void { const id = window.setTimeout(() => { timers.delete(id); if (!destroyed) action(); }, delay); timers.add(id); }
  function message(text: string): void { feedback.textContent = text; }
  function persist(): void { const ok = save.write(state, preferences); el("[data-td-save-note]").textContent = ok ? "按波次自动保存 · 只保存在本机" : "存档暂不可写，本页仍可玩；原有记录未改动。"; }
  function selectedCores(): Core[] { return selection.map(id => state.cores.find(c => c.id === id)).filter((c): c is Core => !!c); }
  function prepare(ids: number[], target?: number | null, recipeId?: string): void {
    selection = [...new Set(ids)].filter(id => state.cores.some(c => c.id === id));
    const towers = selectedCores().filter(c => c.slot !== null);
    fusionTarget = target !== undefined && towers.some(c => c.slot === target) ? target : towers[0]?.slot ?? null;
    chosenRecipe = recipeId; freshResult = false;
    renderComposer(); renderInventory(); renderRanges();
  }
  function choose(id: number): void {
    audio.unlock();
    if (state.phase === "lost" || state.phase === "won") return;
    const item = state.cores.find(c => c.id === id); if (!item) return;
    if (item.slot !== null) inspectedId = id;
    if (englishSelected !== null) { equipmentTarget = id; selection = [id]; pendingRecycle = null; renderInventory(); renderEquipment(); renderRanges(); return; }
    if (freshResult && (selection.includes(id) || !isPartner(item))) selection = [];
    const next = selection.includes(id) ? selection.filter(x => x !== id) : selection.length >= 2 ? [selection[0], id] : [...selection, id];
    prepare(next);
    const selected = selectedCores();
    if (selected.length === 1) { const c = CORES[selected[0].kind]; message(`${c.glyph} · ${c.pinyin}。${c.attack}。点空塔位部署，或再选一枚字核。`); }
  }
  function isPartner(core: Core): boolean {
    if (englishSelected !== null) {
      const english = state.englishCores.find(e => e.id === englishSelected), mapping = english && englishMapping(english);
      return !!mapping && mapping.coreId === core.kind && english.attachedTo !== core.id && !attachedEnglish(state, core.id);
    }
    const a = selectedCores()[0]; return !!a && a.id !== core.id && recipeCandidates(a.kind, core.kind,currentRecipes()).length > 0;
  }
  function renderRanges(): void {
    const inspected = state.cores.find(c => c.id === inspectedId && c.slot !== null);
    if (!inspected) inspectedId = null;
    const pointerSlot = viewSource === "focus" ? focusedSlot ?? hoveredSlot : hoveredSlot ?? focusedSlot;
    const hovered = pointerSlot === null ? undefined : state.cores.find(c => c.slot === pointerSlot);
    const material = draggedId !== null ? state.cores.find(c => c.id === draggedId) : selection.length === 1 ? selectedCores()[0] : undefined;
    const preview = pointerSlot !== null && !hovered && material ? { ...material, slot: pointerSlot } : undefined;
    const active = hovered ?? preview ?? inspected;
    const circles = showAllRanges ? state.cores.filter(c => c.slot !== null && (preview || c.id !== active?.id)) : [];
    const resonance=active && activeResonance(state,active);
    const signature = `${showAllRanges}:${circles.map(c => `${c.id}:${c.kind}:${c.slot}`).join('|')}/${active?.id}:${active?.kind}:${active?.slot}:${!!preview}:${resonance?.english.id}`;
    if (signature === rangeSignature) return; rangeSignature = signature;
    const circle = (c: Core, mode: string) => `<circle data-range-id="${c.id}" data-range-kind="${c.kind}" data-range-slot="${c.slot}" data-range-mode="${mode}" cx="${SLOTS[c.slot!].x}" cy="${SLOTS[c.slot!].y}" r="${CORES[c.kind].range}" class="td-range td-range--${mode}" vector-effect="non-scaling-stroke"/>`;
    el("[data-td-ranges]").innerHTML = circles.map(c => circle(c, 'all')).join('') + (active ? circle(active, preview ? 'preview' : 'inspect') : '');
    el("[data-td-range-caption]").textContent = active ? `${CORES[active.kind].glyph} · 攻击范围${preview ? `预览 · 塔位 ${active.slot! + 1}` : ` · 塔位 ${active.slot! + 1}`}${resonance ? ` · ${resonance.mapping.text} · ${resonance.mapping.effectName}` : ''}` : showAllRanges ? '全部字塔 · 攻击范围' : '指向或点选字塔，查看攻击范围';
  }
  function renderInventory(): void {
    selection = selection.filter(id => state.cores.some(c => c.id === id));
    const signature = state.cores.map(c => `${c.id}:${c.kind}:${c.slot}`).join("|") + `:${selection.join()}:${englishSelected}:${state.englishCores.map(e=>`${e.id}:${e.attachedTo}`).join('|')}`;
    if (signature === inventorySignature) return; inventorySignature = signature;
    const inBag = state.cores.filter(c => c.slot === null).sort((a, b) => CORE_ORDER.indexOf(a.kind) - CORE_ORDER.indexOf(b.kind) || a.id - b.id);
    for (const old of [...bag.querySelectorAll<HTMLElement>("[data-core]")]) if (!inBag.some(c => c.id === Number(old.dataset.core))) old.remove();
    for (const c of inBag) {
      let item = bag.querySelector<HTMLButtonElement>(`[data-core="${c.id}"]`);
      if (!item) {
        item = document.createElement("button"); item.type = "button"; item.className = "td-core"; item.dataset.core = String(c.id); item.draggable = true;
        item.addEventListener("click", () => choose(c.id));
        item.addEventListener("dragstart", event => beginDrag(event, c.id));
        item.addEventListener("dragend", endDrag);
      }
      const definition = CORES[c.kind]; item.style.setProperty("--core-color", color(c.kind));
      item.innerHTML = `<strong${definition.glyph.length > 1 ? ' class="td-word"' : ""}>${definition.glyph}</strong><small>${attachedEnglish(state,c.id) ? "已共鸣" : isPartner(c) ? englishSelected !== null ? "可共鸣" : "可搭配" : definition.role === "非成字部件" ? "三点水" : definition.pinyin}</small>`;
      item.classList.toggle("td-partner", isPartner(c));
      item.setAttribute("aria-label", `材料 ${definition.glyph} ${definition.pinyin}，${definition.attack}${isPartner(c) ? "，可搭配" : ""}`); item.setAttribute("aria-pressed", String(selection.includes(c.id)));
      // Appending an existing node preserves its identity and event handlers; restore focus below if browsers blur a moved node.
      const focused = document.activeElement === item; bag.append(item); if (focused) item.focus({ preventScroll: true });
    }
    bagKeys.refresh();
    el("[data-td-bag-empty]").hidden = inBag.length > 0;
    for (const [index] of SLOTS.entries()) {
      const slot = button(`[data-slot="${index}"]`), c = state.cores.find(c => c.slot === index);
      slot.classList.toggle("td-slot--occupied", !!c); slot.classList.toggle("td-slot--selected", !!c && selection.includes(c.id));
      slot.classList.toggle("td-partner", !!c && isPartner(c)); slot.draggable = !!c;
      slot.dataset.towerId = c ? String(c.id) : "";
      slot.dataset.kind = c?.kind ?? ""; slot.dataset.resonant = String(!!c && !!activeResonance(state,c));
      const art = slot.querySelector<HTMLImageElement>('.td-tower-art')!, illustrated = c?.kind === 'volcano' || c?.kind==='wildwood';
      slot.classList.toggle('td-slot--illustrated', illustrated); art.hidden = !illustrated;
      if (illustrated) { const src = `./assets/hanzi-tower-defense/${c?.kind==='wildwood'?'mountain-forest':'volcano'}-${activeResonance(state,c!) ? 'resonant' : 'base'}.png`; if (art.getAttribute('src') !== src) art.setAttribute('src',src); }
      slot.classList.toggle("td-slot--available", !c && selection.length === 1);
      slot.style.setProperty("--core-color", c ? color(c.kind) : "#c8ceba");
      slot.querySelector(".td-slot-glyph")!.textContent = c ? CORES[c.kind].glyph : "＋";
      slot.classList.toggle("td-slot--word", !!c && CORES[c.kind].glyph.length > 1);
      slot.setAttribute("aria-label", `塔位${index + 1} ${SLOTS[index].name}，${c ? `${CORES[c.kind].glyph} ${CORES[c.kind].attack}${isPartner(c) ? "，可搭配" : ""}` : "空位"}`);
      slot.setAttribute("aria-pressed", String(!!c && selection.includes(c.id)));
    }
  }
  function renderComposer(): void {
    const composer=el('.td-composer');
    preserveRegionFocus(composer,renderComposerContent,
      node=>node.dataset.fusionTarget!==undefined?`target:${node.dataset.fusionTarget}`:node.dataset.resultRecipe?`recipe:${node.dataset.resultRecipe}`:null,
      id=>id.startsWith('target:')?composer.querySelector<HTMLElement>(`[data-fusion-target="${id.slice(7)}"]`):composer.querySelector<HTMLElement>(`[data-result-recipe="${id.slice(7)}"]`),
      ()=>button('[data-td-clear]'));
  }
  function renderComposerContent(): void {
    el('.td-composer').hidden = englishSelected !== null || pendingRecycle !== null;
    const selected = selectedCores(), a = selected[0], b = selected[1];
    const completeWord=selected.length===1 && CORES[a.kind].structure==='word';
    el('.td-composer').dataset.wordDetail=String(completeWord);
    el('.td-composer h2').textContent=completeWord?'字塔详情':'组合台';
    el('[data-td-selection]').hidden=completeWord; el('.td-compose-actions').hidden=completeWord;
    const candidates = a && b ? recipeCandidates(a.kind, b.kind,currentRecipes()) : [];
    const recipe = a && b ? recipeFor(a.kind, b.kind, chosenRecipe,currentRecipes()) : undefined;
    el("[data-td-selection]").innerHTML = [0, 1].map((index) => { const item = selected[index]; return `<span class="td-selected-core${item ? " has-core" : ""}">${item ? `${CORES[item.kind].glyph}<small>${item.slot === null ? "材料栏" : `塔位 ${item.slot + 1}`}</small>` : `<small>第${index + 1}枚字核</small>`}</span>`; }).join('<span class="td-plus">＋</span>');
    const preview = el("[data-td-preview]");
    if (recipe) {
      const c = CORES[recipe.result]; preview.innerHTML = `<div class="td-structure td-structure--${recipe.structure}" data-structure="${recipe.structure}">${c.components.map((glyph, index) => `<span><small>${c.slots[index]}</small><b>${glyph}</b></span>`).join("")}</div><div class="td-preview-result"><strong>${c.glyph}</strong><span>${c.pinyin}</span></div><p>${escape(c.meaning)}<br><b>${c.attack}</b></p>`;
    } else if (candidates.length > 1) {
      preview.innerHTML = '<p>这些材料能组合出不同结果，选一个：</p>' + candidates.map(r => `<button type="button" data-result-recipe="${r.id}">${CORES[r.result].glyph}</button>`).join('');
    } else if (a && b) preview.innerHTML = '<p class="td-invalid">暂无配方。点亮的字核可换搭档，或取消选择；材料和字塔都还在。</p>';
    else if (a) { const c = CORES[a.kind], resonance = activeResonance(state,a), mapping = resonanceFor(a.kind); preview.innerHTML = `<p><b>${c.glyph} · ${c.pinyin}</b><br>${escape(c.meaning)}<br>${c.attack}${resonance ? `<br><strong lang="en">${resonance.mapping.text}</strong><br>${resonance.mapping.effectName}：${resonance.mapping.effectText}` : mapping ? `<br>拾得 <span lang="en">${mapping.text}</span> 后，点英文核可预览共鸣。` : ''}</p>`; }
    else preview.innerHTML = '<p>点塔上的字或栏里的材料。<br>两枚字核在这里先预览，再组合。</p>';
    const partners = el("[data-td-partners]");
    const availableRecipes = a ? currentRecipes().filter(r => CORE_ORDER.some(k => recipeCandidates(a.kind, k,currentRecipes()).includes(r))) : [];
    partners.innerHTML = a && !recipe ? availableRecipes.map(r => {
      const other = r.inputs[r.inputs[0] === a.kind ? 1 : 0];
      const available = state.cores.some(c => c.id !== a.id && c.kind === other);
      return `<p>${CORES[a.kind].glyph} ＋ ${CORES[other].glyph} → <b>${CORES[r.result].glyph}</b> · ${available ? "点亮的搭档可组合" : `还缺 ${CORES[other].glyph}`}</p>`;
    }).join('') || (a ? completeWord ? `<p>完整中文词核${a.slot===null?'可部署到空塔位':'已在塔位 '+(a.slot+1)}。${attachedEnglish(state,a.id)?'点英文词核可查看卸下或转移。':'点同义英文词核，可预览装备。'}</p>` : '<p>这枚字核暂无组合配方，可先部署。</p>' : '') : '';
    const destination = el("[data-td-target]"), towers = selected.filter(c => c.slot !== null);
    destination.innerHTML = recipe ? fusionTarget === null ? '<p>产物放入材料栏</p>' : `<p>保留塔位 ${fusionTarget + 1}${towers.length === 2 ? `，释放塔位 ${towers.find(c => c.slot !== fusionTarget)!.slot! + 1}` : ''}</p>${towers.length === 2 ? towers.map(c => `<button type="button" data-fusion-target="${c.slot}" aria-pressed="${fusionTarget === c.slot}">留在塔位 ${c.slot! + 1}</button>`).join('') : ''}` : '';
    const confirm = button("[data-td-fuse]"); confirm.disabled = !recipe || state.phase === "won" || state.phase === "lost";
    confirm.textContent = recipe ? (fusionTarget !== null ? "组合并替换字塔" : "组合放入材料栏") : a && b ? candidates.length ? "先选组合结果" : "暂无配方" : "选两枚字核";
    button("[data-td-stow]").hidden = selected.length !== 1 || a.slot === null;
    button("[data-td-recycle]").hidden = selected.length !== 1 || a.slot !== null;
    const attached = a && attachedEnglish(state,a.id);
    button("[data-td-recycle]").disabled = state.health >= 16 || !!attached && state.phase === 'battle';
    button("[data-td-recycle]").textContent = state.health >= 16 ? "城门完好，无需回收" : attached && state.phase === 'battle' ? '带英文核，波间再回收' : `回收修城 ＋${Math.min(16 - state.health, a ? CORES[a.kind].recycle : 0)}${attached ? ' · 先预览' : ''}`;
  }
  function chooseEnglish(id: number): void {
    audio.unlock(); if (!state.englishCores.some(e => e.id === id)) return;
    englishSelected = id; equipmentTarget = selectedCores().length === 1 ? selectedCores()[0].id : null;
    selection = equipmentTarget === null ? [] : [equipmentTarget]; pendingRecycle = null; freshResult = false;
    renderEquipment(); renderInventory(); renderComposer();
    message('点亮的完整中文词核可以共鸣。选好塔位或背包字核，再确认装备。');
  }
  function renderEquipment(): void {
    const signature = `${englishSelected}:${equipmentTarget}:${pendingRecycle}:${state.phase}:${state.health}:${state.englishCores.map(e=>`${e.id}:${e.attachedTo}`).join('|')}:${state.cores.map(c=>`${c.id}:${c.slot}`).join('|')}`;
    if (englishSignature === signature) return; englishSignature = signature;
    const list = el('[data-td-english-bag]');
    for (const old of list.querySelectorAll<HTMLElement>('[data-english]')) if (!state.englishCores.some(e=>e.id===Number(old.dataset.english))) old.remove();
    for (const e of state.englishCores) {
      const mapping = englishMapping(e); if (!mapping) continue;
      let node = list.querySelector<HTMLButtonElement>(`[data-english="${e.id}"]`);
      if (!node) { node=document.createElement('button'); node.type='button'; node.className='td-english-core'; node.dataset.english=String(e.id); node.draggable=true;
        node.addEventListener('click',()=>chooseEnglish(e.id));
        node.addEventListener('dragstart',event=>{ englishDragged=e.id; chooseEnglish(e.id); event.dataTransfer?.setData('text/plain',`english:${e.id}`); });
        node.addEventListener('dragend',()=>{englishDragged=null;endDrag();}); list.append(node); }
      const owner=state.cores.find(c=>c.id===e.attachedTo);
      node.innerHTML=`<strong lang="en">${mapping.text}</strong><span>${CORES[mapping.coreId].glyph} · ${owner ? owner.slot===null ? '已装备 · 材料栏' : `已装备 · 塔位 ${owner.slot+1}` : '可装备'}</span>`;
      node.setAttribute('aria-pressed',String(englishSelected===e.id)); node.dataset.attachedTo=String(e.attachedTo ?? '');
    }
    englishKeys.refresh();
    el('[data-td-english-empty]').hidden=state.englishCores.length>0;
    const unequipped=state.englishCores.filter(e=>e.attachedTo===null), notice=button('[data-td-english-notice]'); notice.hidden=!unequipped.length;
    notice.textContent=unequipped.map(e=>{const r=englishMapping(e)!;return `${r.text} → ${CORES[r.coreId].glyph}`;}).join('；')+' · 已收好，查看装备';
    const english=state.englishCores.find(e=>e.id===englishSelected), mapping=english && englishMapping(english), target=state.cores.find(c=>c.id===equipmentTarget);
    equipmentPreview = english && target ? previewEquipment(state,english.id,target.id) : null;
    const detail=el('[data-td-equipment-detail]'); detail.hidden=!english && pendingRecycle===null;
    button('[data-td-equip]').hidden=!english || !target || pendingRecycle!==null;
    button('[data-td-equip]').disabled=!equipmentPreview?.ok;
    button('[data-td-equip]').textContent=english?.attachedTo!==null && english?.attachedTo!==target?.id ? '确认转移到这里' : '确认装备';
    button('[data-td-unequip]').hidden=!english || english.attachedTo===null || pendingRecycle!==null;
    button('[data-td-unequip]').disabled=state.phase!=='ready';
    button('[data-td-unequip]').textContent=state.phase==='battle'?'卸下要等波间':'卸下到背包';
    button('[data-td-confirm-recycle]').hidden=pendingRecycle===null;
    const copy=el('[data-td-equipment-copy]');
    if (pendingRecycle!==null) {
      const c=state.cores.find(c=>c.id===pendingRecycle), attachment=c && attachedEnglish(state,c.id), r=attachment && englishMapping(attachment);
      button('[data-td-confirm-recycle]').disabled=!c || c.slot!==null || state.health>=16 || state.phase!=='ready';
      copy.textContent=c && r ? `回收 ${CORES[c.kind].glyph} 修城 ＋${Math.min(16-state.health,CORES[c.kind].recycle)}，${r.text} 原枚返还背包。确认后才会改变材料。`:'材料已变化，没有消耗。';
    } else if (mapping) {
      copy.innerHTML=`<b>${CORES[mapping.coreId].glyph} ↔ <span lang="en">${mapping.text}</span></b><br>${mapping.meaning} · ${mapping.form==='word'?'英文词':'英文短语'}<br><strong>${mapping.effectName}</strong> · ${mapping.effectText}<br>${target ? `目标：${CORES[target.kind].glyph} · ${target.slot===null?'材料栏':`塔位 ${target.slot+1}`}<br>${escape(equipmentPreview!.reason)}` : `点一座亮起的${CORES[mapping.coreId].glyph}塔，或材料栏里的完整${CORES[mapping.coreId].glyph}。<br>${mapping.recipe}`}${english?.attachedTo!==null ? '<br>这枚已装备。波间可选另一座同义词塔转移；战中只能查看。' : ''}`;
    }
  }
  function updateStatus(): void {
    if (destroyed) return;
    gameRoot.dataset.mapId=state.mapId??"qinglan-pass";
    gameRoot.dataset.phase = state.phase; gameRoot.dataset.wave = String(state.wave); gameRoot.dataset.paused = String(state.paused);
    gameRoot.dataset.kills = String(state.kills); gameRoot.dataset.leaks = String(state.leaks);
    gameRoot.dataset.speed = String(battleSpeed); gameRoot.dataset.elapsed = state.elapsed.toFixed(3);
    gameRoot.dataset.reducedMotion = String(preferences.reducedMotion);
    el("[data-td-wave]").textContent = `第 ${Math.min(state.wave + 1, WAVES.length)} / ${WAVES.length} 波 · ${WAVES[Math.min(state.wave, WAVES.length-1)].label}`;
    el("[data-td-health]").textContent = `${state.health}`; el("[data-td-health-fill]").style.width = `${state.health / 16 * 100}%`;
    el("[data-td-enemies]").textContent = state.phase === "battle" ? `路上 ${state.enemies.length} · 还有 ${WAVES[state.wave].foes.length - state.spawned} 只` : state.phase === "ready" ? "波间布阵" : "守城结束";
    const focusedControl = document.activeElement;
    const pause = button("[data-td-pause]"); pause.textContent = state.paused ? "继续战斗" : "暂停"; pause.setAttribute("aria-pressed", String(state.paused)); pause.disabled = state.phase !== "battle";
    const next = button("[data-td-next]"); next.hidden = state.phase !== "ready"; next.textContent = save.hasCheckpoint && state.wave === 0 ? "从检查点继续" : `迎接第 ${state.wave + 1} 波`;
    el("[data-td-wave-hint]").textContent = state.phase === "ready" ? `先布阵，再出发。${WAVES[state.wave]?.hint ?? ""}` : WAVES[Math.min(state.wave, WAVES.length-1)].hint;
    const boss=state.enemies.find(e=>e.kind==='captain');
    const bossStatus=el('[data-td-boss-status]');bossStatus.hidden=!boss;
    const bossStage=boss?`${boss.id}:${boss.summons??0}:${boss.summonAt===undefined?'walking':'warning'}`:'';
    if(bossStage!==bossAnnouncement){bossAnnouncement=bossStage;if(boss)message(boss.summonAt!==undefined?'首领将在两秒后呼来两只团团怪，注意它身后的道路。':(boss.summons??0)>0?`首领已呼援 ${boss.summons} 次，最多两次。`:'烽台首领出现了。它最多呼援两次，预告期间会亮起金色轮廓。');}
    bossStatus.textContent=boss?`烽台首领 · 耐久 ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)} · ${boss.summonAt!==undefined?`呼援预告 ${Math.max(0,boss.summonAt-state.waveTime).toFixed(1)} 秒`:`已呼援 ${boss.summons??0} / 2 次`}`:'';
    const field = el("[data-td-field-message]"); field.hidden = !state.paused && state.phase !== "ready";
    field.textContent = state.paused ? "已暂停 · 可以安心组合" : "波间布阵 · 准备好再出发";
    button("[data-td-mute]").setAttribute("aria-pressed", String(preferences.muted)); button("[data-td-mute]").textContent = preferences.muted ? "开启声音" : "静音";
    button("[data-td-motion]").setAttribute("aria-pressed", String(preferences.reducedMotion));
    const speed = button("[data-td-speed]"); speed.textContent = `速度 ${battleSpeed}×`; speed.setAttribute("aria-pressed", String(battleSpeed === 2)); speed.setAttribute("aria-label", `战斗速度${battleSpeed}倍，切换为${battleSpeed === 1 ? 2 : 1}倍`);
    const signature = `${state.health}:${state.phase}`; if (signature !== statusSignature) { statusSignature = signature; renderComposer(); }
    renderInventory(); renderEquipment(); renderRanges();
    // Move only a wave control that just became unavailable; leave other game and browser focus alone.
    if (focusedControl === next && next.hidden || focusedControl === pause && pause.disabled) focusWaveControl();
    if ((state.phase === "won" || state.phase === "lost") && !resultDialog.open && !resultPresented) {
      resultPresented=true;
      el("#td-result-title").textContent = state.phase === "won" ? `${mapFor(state.mapId).title}，守住了！` : "这次先退回城里";
      el("[data-td-result-copy]").textContent = state.phase === "won" ? `${WAVES.length} 波都已结束。城门还有 ${state.health} 点耐久，你的字阵挡住了 ${state.kills} 只怪物。` : `守到了第 ${state.wave + 1} 波。把范围塔放在弯道，减速塔留在来路，再试一次。`;
      resultDialog.showModal(); audio.play(state.phase === "won" ? "wave" : "leak"); persist();
    }
  }
  function focusWaveControl(): void {
    const target = resultDialog.open ? "[data-td-replay]" : state.phase === "battle" ? "[data-td-pause]" : state.phase === "ready" ? "[data-td-next]" : "[data-td-home]";
    button(target).focus({ preventScroll: true });
  }
  function animateFusion(recipe: Recipe, target: number | null): void {
    const host = el("[data-td-synthesis]"), c = CORES[recipe.result];
    host.innerHTML = `<div class="td-fusion-orbit td-fusion-orbit--${recipe.structure}">${c.components.map(glyph => `<span>${glyph}</span>`).join("")}<b>${c.glyph}</b></div><small>${c.glyph} · ${c.pinyin}</small>`;
    host.style.left = `${(target === null ? MAP.width / 2 : SLOTS[target].x) / MAP.width * 100}%`; host.style.top = `${(target === null ? MAP.height / 2 : SLOTS[target].y) / MAP.height * 100}%`;
    host.hidden = false; later(() => host.hidden = true, preferences.reducedMotion ? 650 : 1050);
  }
  function handleEvents(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.type === "shot") audio.play(["volcano", "mountain", "wildwood"].includes(event.core) ? "heavy" : "shot");
      if (event.type === "shot") {
        const tower = root.querySelector<HTMLElement>(`[data-tower-id="${event.coreId}"]`);
        if (tower && !preferences.reducedMotion) { tower.classList.remove('td-firing'); void tower.offsetWidth; tower.classList.add('td-firing'); }
      }
      if (event.type === "echo") { audio.play('echo'); gameRoot.dataset.echoes = String(Number(gameRoot.dataset.echoes ?? 0)+1); }
      if (event.type === 'roots') { audio.play('roots'); gameRoot.dataset.rootBursts=String(Number(gameRoot.dataset.rootBursts??0)+1); }
      if (event.type === "english-drop") {
        const mapping=RESONANCES.find(r=>r.grantId===event.grantId)!; audio.play('drop'); renderEquipment(); renderInventory();
        message(`拾得 ${mapping.text}，已自动收好。可装入${CORES[mapping.coreId].glyph}，得到${mapping.effectName}；还没合成也可以先保留。`);
      }
      if (event.type === "defeat") audio.play("defeat");
      if (event.type === "drop") {
        audio.play("drop"); const drop = document.createElement("span"); drop.className = "td-drop"; drop.textContent = CORES[event.core].glyph;
        drop.style.left = `${Math.max(5, Math.min(94, event.at.x / MAP.width * 100))}%`; drop.style.top = `${event.at.y / MAP.height * 100}%`;
        el("[data-td-drops]").append(drop); later(() => drop.remove(), 950); renderInventory(); renderComposer();
        message(`拾得 ${CORES[event.core].glyph}，已放入材料栏。`);
      }
      if (event.type === "leak") { audio.play("leak"); message(`有怪物进城，城门减少 ${event.harm} 点耐久。可以暂停调整塔位。`); }
      if (event.type === "wave-end") { audio.play("wave"); persist(); message(event.won ? "守住了最后一波！" : "这一波结束了。先组合、调整塔位，准备好再出发。 "); }
    }
  }
  const scene = new DefenseScene({ state: () => state, preferences: () => preferences, speed: () => battleSpeed, events: handleEvents, tick: updateStatus, ready: () => {
    el("[data-td-canvas]").dataset.ready = "true";
    if (!save.hasCheckpoint && !mapFor(state.mapId).expanded) { startWave(state); persist(); } else message(`已回到第 ${Math.min(state.wave + 1, WAVES.length)} 波的检查点。先布阵，再继续。`);
    updateStatus();
  } });
  // The canvas only renders. All controls are semantic DOM buttons; let the page own wheel and touch scrolling.
  const game = new Phaser.Game({ type: Phaser.AUTO, parent: el("[data-td-canvas]"), width: Math.max(1, board.clientWidth), height: Math.max(1, board.clientHeight), transparent: false, backgroundColor: "#477d56", scale: { mode: Phaser.Scale.NONE }, scene: [scene], input: { mouse: false, touch: false, keyboard: false, gamepad: false }, audio: { noAudio: true }, render: { antialias: true, pixelArt: false }, fps: { target: 60, forceSetTimeOut: false }, banner: false });
  function resizeCanvas(): void {
    if (destroyed || !game.isBooted) return;
    const width = board.clientWidth, height = board.clientHeight;
    // Modal/capture layout can briefly report zero. Never allocate a zero-size WebGL framebuffer.
    // CSS layout dimensions also avoid applying browser zoom twice; SVG and DOM share this board.
    if (width > 0 && height > 0 && (game.scale.width !== width || game.scale.height !== height)) game.scale.resize(width, height);
  }
  const resizeObserver = new ResizeObserver(resizeCanvas); resizeObserver.observe(board);
  game.events.once(Phaser.Core.Events.READY, resizeCanvas);
  function clearSelection(): void {
    inspectedId = null; hoveredSlot = null; focusedSlot = null; draggedId = null;
    englishSelected = null; equipmentTarget = null; englishDragged=null; equipmentPreview=null; pendingRecycle=null;
    renderEquipment();
    prepare([]);
  }
  function place(slot: number): void {
    audio.unlock(); const item = state.cores.find(c => c.slot === slot);
    if(rangeOnly) {inspectedId=item?.id??null;hoveredSlot=null;focusedSlot=null;renderRanges();message(item?`正在查看 ${CORES[item.kind].glyph} 的真实射程，选料未变。`:"这是空塔位，选料未变。");return;}
    if (item) { choose(item.id); return; }
    if (englishSelected!==null) { message('英文核装入完整中文词塔。先点亮起的字塔或背包词核；空位不能单独部署英文。'); return; }
    const selected = selectedCores();
    if (selected.length === 1 && deploy(state, selected[0].id, slot)) { message(`${CORES[selected[0].kind].glyph}已部署到${SLOTS[slot].name}。`); audio.play("deploy"); prepare([]); inspectedId = selected[0].id; persist(); }
    else message("先选一枚材料，再点这个塔位。选了两枚时，先在组合台确认。");
    updateStatus();
  }
  function beginDrag(event: DragEvent, id: number): void {
    event.dataTransfer?.setData("text/plain", String(id)); draggedId = id; prepare([id]);
  }
  function endDrag(): void { draggedId = null; hoveredSlot = null; renderRanges(); }
  for (const [index] of SLOTS.entries()) {
    const slot = button(`[data-slot="${index}"]`); slot.addEventListener("click", () => place(index));
    slot.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") { hoveredSlot = index; viewSource = "hover"; renderRanges(); } });
    slot.addEventListener("pointerleave", () => { if (hoveredSlot === index) hoveredSlot = null; renderRanges(); });
    slot.addEventListener("focus", () => { focusedSlot = index; viewSource = "focus"; renderRanges(); });
    slot.addEventListener("blur", () => { if (focusedSlot === index) focusedSlot = null; renderRanges(); });
    slot.addEventListener("dragstart", event => { const c = state.cores.find(c => c.slot === index); if (c) beginDrag(event, c.id); });
    slot.addEventListener("dragend", endDrag);
    slot.addEventListener("dragover", event => { event.preventDefault(); hoveredSlot = index; viewSource = "hover"; renderRanges(); });
    slot.addEventListener("dragleave", event => { if (!slot.contains(event.relatedTarget as Node | null)) { hoveredSlot = null; renderRanges(); } });
    slot.addEventListener("drop", event => {
      event.preventDefault(); const text = event.dataTransfer?.getData("text/plain");
      if (englishDragged!==null && text===`english:${englishDragged}`) {
        const target=state.cores.find(c=>c.slot===index);
        if (target) { inspectedId=target.id; equipmentTarget=target.id; selection=[target.id]; renderEquipment(); renderInventory(); renderComposer(); message('已准备共鸣，请看实际效果再确认。'); }
        else message('英文核用于完整中文词塔，不能单独放在空塔位。');
        englishDragged=null; endDrag(); return;
      }
      const id = Number(text);
      if (draggedId===null || id!==draggedId || !Number.isSafeInteger(id) || !state.cores.some(c => c.id === id)) { message("没有可用的源材料，字塔和材料都未改变。"); return; }
      const target = state.cores.find(c => c.slot === index);
      if (target) {
        inspectedId = target.id; prepare(target.id === id ? [id] : [id, target.id], index);
        message(target.id === id ? "字塔仍在原位。" : "已准备这两枚字核，请在组合台看结果和去向，再确认。");
      } else { prepare([id]); place(index); }
      endDrag();
    });
  }
  function togglePause(): void {
    if (state.phase !== "battle") return; audio.unlock(); state.paused = !state.paused; updateStatus();
    if (state.paused) message("战斗已暂停。部署和组合仍然可用。");
  }
  function refreshMap():void {
    battleSpeed = 1;
    const url=new URL(window.location.href);url.searchParams.set('map',state.mapId??'qinglan-pass');
    window.history.replaceState(window.history.state,'',url);
    SLOTS=mapFor(state.mapId).slots;WAVES=mapFor(state.mapId).waves;
    inventorySignature="";statusSignature="";englishSignature="";rangeSignature="";
    resultPresented=false;bossAnnouncement="";clearSelection();scene.reset();
    for(const [i,slot] of SLOTS.entries()){const node=button(`[data-slot="${i}"]`);node.style.left=`${slot.x/MAP.width*100}%`;node.style.top=`${slot.y/MAP.height*100}%`;}
    for(const node of root.querySelectorAll<HTMLElement>('[data-recipe]'))node.hidden=!currentRecipes().some(r=>r.id===node.dataset.recipe);
    el('[data-td-map-title]').textContent=`${mapFor(state.mapId).title} · ${mapFor(state.mapId).description}`;
    delete gameRoot.dataset.echoes;delete gameRoot.dataset.rootBursts;updateStatus();slotKeys.refresh();
  }
  function restart(clearDiscoveries=true): void {
    restartDialog.close();resultDialog.close();state=newBattle(DEFAULT_SEED,clearDiscoveries?[]:state.unlocked,pendingMap);refreshMap();if(!clearDiscoveries)startWave(state);persist();audio.unlock();updateStatus();
    message(`${mapFor(state.mapId).title} 已重置，固定起始材料已放好。准备好再开波。`);focusWaveControl();
  }
  function selectMap(id:MapId,fresh:boolean):void {
    persist();mapDialog.close();
    if(fresh&&save.load(id)){pendingMap=id;el('[data-td-reset-copy]').textContent=`将重置 ${DEFENSE_MAPS[id].title} 的波次、材料和配方发现。其他地图与旧存档原文保留。`;restartDialog.showModal();return;}
    state=fresh?newBattle(DEFAULT_SEED,[],id):save.load(id)??newBattle(DEFAULT_SEED,[],id);
    refreshMap();persist();message(`已进入 ${DEFENSE_MAPS[id].title}，第 ${Math.min(state.wave+1,WAVES.length)} 波。各图资源独立；未完成波次已回到波前。`);focusWaveControl();
  }
  function showMaps(fresh:boolean):void {
    if(state.phase==='battle')state.paused=true;persist();updateStatus();draggedId=null;englishDragged=null;
    el('#td-map-dialog-title').textContent=fresh?'新游戏 · 选择地图':'继续游戏 · 选择存档';
    const entries=save.list();el('[data-td-map-list]').innerHTML=MAP_IDS.map(id=>{const entry=entries.find(e=>e.mapId===id);return `<button type="button" data-map-select="${id}" ${!fresh&&!entry?'disabled':''}><b>${DEFENSE_MAPS[id].title}</b><span>${fresh?DEFENSE_MAPS[id].description:entry?entry.won?'已守住 · 可查看结果':`继续第 ${entry.wave+1} 波`:'还没有存档'}</span></button>`;}).join('');
    el('[data-td-map-list]').onclick=event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-map-select]')?.dataset.mapSelect;if(isMapId(id))selectMap(id,fresh);};
    mapDialog.showModal();
  }
  button('[data-td-new]').addEventListener('click',()=>showMaps(true));button('[data-td-continue]').addEventListener('click',()=>showMaps(false));
  button('[data-td-map-cancel]').addEventListener('click',()=>mapDialog.close());
  button('[data-td-inspect]').addEventListener('click',()=>{rangeOnly=!rangeOnly;button('[data-td-inspect]').setAttribute('aria-pressed',String(rangeOnly));message(rangeOnly?'只看射程：点塔查看，不改变已选材料。':'回到部署与选料。');});
  button("[data-td-fuse]").addEventListener("click", () => {
    const [a, b] = selectedCores(); if (!a || !b) return;
    const recipe = recipeFor(a.kind, b.kind, chosenRecipe,currentRecipes()); if (!recipe) return;
    const target = fusionTarget; const result = fuse(state, a.id, b.id, target, recipe.id); if (!result) { message("材料或目标已变化，请重新选择；没有消耗材料。"); return; }
    audio.unlock(); audio.play("fusion"); animateFusion(recipe, target); prepare([result.id]); freshResult = true;
    inspectedId = target === null ? null : result.id; hoveredSlot = null; focusedSlot = null;
    persist(); updateStatus();
    message(`${CORES[result.kind].glyph} · ${CORES[result.kind].pinyin}。${CORES[result.kind].attack}！${target === null ? "已选中新字核，点空塔位即可部署。" : "字塔已升级，正在显示新的攻击范围。"}`);
    if (target !== null) button(`[data-slot="${target}"]`).focus({ preventScroll: true });
    else bag.querySelector<HTMLElement>(`[data-core="${result.id}"]`)?.focus({ preventScroll: true });
  });
  button("[data-td-clear]").addEventListener("click", clearSelection);
  el("[data-td-preview]").addEventListener("click", event => {
    const candidate = (event.target as HTMLElement).closest<HTMLElement>("[data-result-recipe]");
    if (candidate) { chosenRecipe = candidate.dataset.resultRecipe; renderComposer(); }
  });
  el("[data-td-target]").addEventListener("click", event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-fusion-target]");
    if (target && selectedCores().some(c => c.slot === Number(target.dataset.fusionTarget))) { fusionTarget = Number(target.dataset.fusionTarget); renderComposer(); }
  });
  button("[data-td-all-ranges]").addEventListener("click", () => {
    showAllRanges = !showAllRanges; button("[data-td-all-ranges]").setAttribute("aria-pressed", String(showAllRanges)); renderRanges();
  });
  button("[data-td-stow]").addEventListener("click", () => { const item = selectedCores()[0]; if (item && stow(state, item.id)) { clearSelection(); persist(); message("字核已收回，原塔位可以重新部署。");bag.querySelector<HTMLElement>(`[data-core="${item.id}"]`)?.focus(); } });
  button("[data-td-recycle]").addEventListener("click", () => { const item = selectedCores()[0]; if (item) {
    if (attachedEnglish(state,item.id)) { pendingRecycle=item.id; renderEquipment(); renderComposer(); return; }
    const gain = recycle(state, item.id); if (gain) { clearSelection(); persist(); updateStatus(); message(`材料已回收，城门修补 ${gain} 点。`); }
  } });
  button('[data-td-equip]').addEventListener('click',()=>{
    if (!equipmentPreview || !equipEnglish(state,equipmentPreview)) return;
    const c=state.cores.find(c=>c.id===equipmentPreview!.targetId)!; audio.unlock(); audio.play('equip');
    message(`${CORES[c.kind].glyph}已装备 ${englishMapping(attachedEnglish(state,c.id)!)!.text}，共鸣开始。`);
    englishSelected=null; equipmentTarget=null; equipmentPreview=null; prepare([c.id]); inspectedId=c.slot!==null?c.id:null;
    persist(); renderEquipment(); updateStatus();
    (c.slot===null?bag.querySelector<HTMLElement>(`[data-core="${c.id}"]`):root.querySelector<HTMLElement>(`[data-slot="${c.slot}"]`))?.focus({preventScroll:true});
  });
  button('[data-td-unequip]').addEventListener('click',()=>{
    const e=state.englishCores.find(e=>e.id===englishSelected); if (!e || e.attachedTo===null || !unequipEnglish(state,e.id,e.attachedTo)) return;
    message('英文核已回到背包。可以选择另一座同义词塔，预览再装备。'); persist(); renderEquipment(); renderInventory(); renderComposer();
  });
  button('[data-td-confirm-recycle]').addEventListener('click',()=>{
    if (pendingRecycle===null) return; const gain=recycle(state,pendingRecycle); if (!gain) { renderEquipment(); return; }
    clearSelection(); persist(); updateStatus(); message(`字核已回收修城 ＋${gain}，英文核原枚返还背包。`);
  });
  button('[data-td-cancel-equipment]').addEventListener('click',()=>{clearSelection();message('已取消预览，所有字核与装备都还在。');});
  button('[data-td-english-notice]').addEventListener('click',()=>{
    const e=state.englishCores.find(e=>e.attachedTo===null); if (!e) return;
    chooseEnglish(e.id); const control=button(`[data-english="${e.id}"]`); control.scrollIntoView({block:'center'});control.focus({preventScroll:true});
  });
  for (const recipeButton of root.querySelectorAll<HTMLButtonElement>("[data-recipe]")) recipeButton.addEventListener("click", () => {
    const recipe = RECIPES.find(r => r.id === recipeButton.dataset.recipe)!;
    const candidates = [...state.cores].sort((a, b) => Number(a.slot !== null) - Number(b.slot !== null) || a.id - b.id);
    const first = candidates.find(c => c.kind === recipe.inputs[0]), second = candidates.find(c => c.kind === recipe.inputs[1] && c.id !== first?.id);
    if (!first || !second) { message(`还缺 ${[!first ? recipe.inputs[0] : null, !second ? recipe.inputs[1] : null].filter((k): k is CoreKind => k !== null).map(k => CORES[k].glyph).join(" 和 ")}。每波掉落会补充材料。`); return; }
    prepare([first.id, second.id], undefined, recipe.id); button("[data-td-fuse]").focus({ preventScroll: true });
  });
  button("[data-td-pause]").addEventListener("click", togglePause);
  button("[data-td-next]").addEventListener("click", () => { audio.unlock(); if (startWave(state)) { persist(); updateStatus(); message("怪物出发了。需要组合时，随时暂停。"); } });
  button("[data-td-mute]").addEventListener("click", () => { preferences.muted = !preferences.muted; audio.setMuted(preferences.muted); persist(); updateStatus(); if (!preferences.muted) audio.play("deploy"); });
  button("[data-td-motion]").addEventListener("click", () => { preferences.reducedMotion = !preferences.reducedMotion; persist(); updateStatus(); });
  button("[data-td-speed]").addEventListener("click", () => { battleSpeed = battleSpeed === 1 ? 2 : 1; updateStatus(); message(`已切换为 ${battleSpeed} 倍速度${state.paused ? "，战斗仍暂停" : ""}。`); });
  button("[data-td-restart]").addEventListener("click", () => { if (state.phase === "battle") state.paused = true; updateStatus();pendingMap=state.mapId??"qinglan-pass";el("[data-td-reset-copy]").textContent=`将重置 ${mapFor(pendingMap).title} 的进度、材料和配方发现。其他地图与旧存档原文保留。`; restartDialog.showModal(); });
  button("[data-td-cancel-restart]").addEventListener("click", () => restartDialog.close());
  button("[data-td-confirm-restart]").addEventListener("click", ()=>restart());
  button("[data-td-replay]").addEventListener("click", ()=>{pendingMap=state.mapId??"qinglan-pass";restart(false);});
  for (const selector of ["[data-td-home]", "[data-td-result-home]"]) button(selector).addEventListener("click", () => { persist(); audio.suspend(); onExit(); });
  const keydown = (event: KeyboardEvent): void => {
    if (ignoreGameKey(event,gameRoot) || restartDialog.open || resultDialog.open || mapDialog.open) return;
    if (event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); }
    if (event.key === "Escape") { clearSelection(); message("已放回选择，材料还在。"); }
  };
  const hide = (): void => { if (document.hidden) { if (state.phase === "battle") state.paused = true; audio.suspend(); persist(); updateStatus(); } };
  const pagehide = (): void => { if (state.phase === "battle") state.paused = true; persist(); audio.suspend(); };
  root.addEventListener("keydown", keydown); document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", pagehide);
  for(const node of root.querySelectorAll<HTMLElement>("[data-recipe]"))node.hidden=!currentRecipes().some(r=>r.id===node.dataset.recipe);
  renderInventory(); renderComposer(); updateStatus();
  el("[data-td-save-note]").textContent = save.writable ? "按波次自动保存 · 只保存在本机" : "存档暂不可写，本页仍可玩；原有记录未改动。";
  return { destroy() { if (destroyed) return; destroyed = true; lifecycle();bagKeys.destroy();slotKeys.destroy();englishKeys.destroy();resizeObserver.disconnect(); persist(); timers.forEach(id => window.clearTimeout(id)); root.removeEventListener("keydown", keydown); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", pagehide); audio.destroy(); game.destroy(true); root.replaceChildren(); } };
}
