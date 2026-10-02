import { preserveRegionFocus } from "../../../packages/ui/input";
import { CORES, CORE_ORDER, recipeCandidates, recipeFor, type CoreKind } from "../content";
import { packConsequence, activeResonance, attachedEnglish, previewEquipment, recycle, type Core } from "../model";
import { englishMapping, resonanceFor } from "../resonance";
import type { DefenseContext } from '../context';
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const color = (kind: CoreKind): string => `#${CORES[kind].color.toString(16).padStart(6, "0")}`;
export function createWorkbench(ctx: DefenseContext) {
function selectedCores(): Core[] { return ctx.selection.map(id => ctx.state.cores.find(c => c.id === id)).filter((c): c is Core => !!c); }
function prepare(ids: number[], target?: number | null, recipeId?: string): void {
    ctx.selection = [...new Set(ids)].filter(id => ctx.state.cores.some(c => c.id === id));
    const towers = ctx.selectedCores().filter(c => c.slot !== null);
    ctx.fusionTarget = target !== undefined && towers.some(c => c.slot === target) ? target : towers[0]?.slot ?? null;
    ctx.chosenRecipe = recipeId; ctx.freshResult = false;
    ctx.renderComposer(); ctx.renderInventory(); ctx.renderRanges();
  }
function choose(id: number): void {
    ctx.audio.unlock();
    if (ctx.state.phase === "lost" || ctx.state.phase === "won") return;
    const item = ctx.state.cores.find(c => c.id === id); if (!item) return;
    if (item.slot !== null) ctx.inspectedId = id;
    if (ctx.englishSelected !== null) { ctx.equipmentTarget = id; ctx.selection = [id]; ctx.pendingRecycle = null; ctx.renderInventory(); ctx.renderEquipment(); ctx.renderRanges(); return; }
    if (ctx.freshResult && (ctx.selection.includes(id) || !ctx.isPartner(item))) ctx.selection = [];
    const next = ctx.selection.includes(id) ? ctx.selection.filter(x => x !== id) : ctx.selection.length >= 2 ? [ctx.selection[0], id] : [...ctx.selection, id];
    ctx.prepare(next);
    const selected = ctx.selectedCores();
    if (selected.length === 1) { const c = CORES[selected[0].kind]; ctx.message(`${c.glyph} · ${c.pinyin}。${c.attack}。点空塔位部署，或再选一枚字核。`); }
  }
function isPartner(core: Core): boolean {
    if (ctx.englishSelected !== null) {
      const english = ctx.state.englishCores.find(e => e.id === ctx.englishSelected), mapping = english && englishMapping(english);
      return !!mapping && mapping.coreId === core.kind && english.attachedTo !== core.id && !attachedEnglish(ctx.state, core.id);
    }
    const a = ctx.selectedCores()[0]; return !!a && a.id !== core.id && recipeCandidates(a.kind, core.kind,ctx.currentRecipes()).length > 0;
  }
function renderRanges(): void {
    const inspected = ctx.state.cores.find(c => c.id === ctx.inspectedId && c.slot !== null);
    if (!inspected) ctx.inspectedId = null;
    const pointerSlot = ctx.viewSource === "focus" ? ctx.focusedSlot ?? ctx.hoveredSlot : ctx.hoveredSlot ?? ctx.focusedSlot;
    const hovered = pointerSlot === null ? undefined : ctx.state.cores.find(c => c.slot === pointerSlot);
    const material = ctx.draggedId !== null ? ctx.state.cores.find(c => c.id === ctx.draggedId) : ctx.selection.length === 1 ? ctx.selectedCores()[0] : undefined;
    const preview = pointerSlot !== null && !hovered && material ? { ...material, slot: pointerSlot } : undefined;
    const active = hovered ?? preview ?? inspected;
    const circles = ctx.showAllRanges ? ctx.state.cores.filter(c => c.slot !== null && (preview || c.id !== active?.id)) : [];
    const resonance=active && activeResonance(ctx.state,active);
    const signature = `${ctx.showAllRanges}:${circles.map(c => `${c.id}:${c.kind}:${c.slot}`).join('|')}/${active?.id}:${active?.kind}:${active?.slot}:${!!preview}:${resonance?.english.id}`;
    if (signature === ctx.rangeSignature) return; ctx.rangeSignature = signature;
    const circle = (c: Core, mode: string) => `<circle data-range-id="${c.id}" data-range-kind="${c.kind}" data-range-slot="${c.slot}" data-range-mode="${mode}" cx="${ctx.SLOTS[c.slot!].x}" cy="${ctx.SLOTS[c.slot!].y}" r="${CORES[c.kind].range}" class="td-range td-range--${mode}" vector-effect="non-scaling-stroke"/>`;
    ctx.el("[data-td-ranges]").innerHTML = circles.map(c => circle(c, 'all')).join('') + (active ? circle(active, preview ? 'preview' : 'inspect') : '');
    ctx.el("[data-td-range-caption]").textContent = active ? `${CORES[active.kind].glyph} · 攻击范围${preview ? `预览 · 塔位 ${active.slot! + 1}` : ` · 塔位 ${active.slot! + 1}`}${resonance ? ` · ${resonance.mapping.text} · ${resonance.mapping.effectName}` : ''}` : ctx.showAllRanges ? '全部字塔 · 攻击范围' : '指向或点选字塔，查看攻击范围';
  }
function renderInventory(): void {
    ctx.selection = ctx.selection.filter(id => ctx.state.cores.some(c => c.id === id));
    const signature = ctx.state.cores.map(c => `${c.id}:${c.kind}:${c.slot}`).join("|") + `:${ctx.selection.join()}:${ctx.englishSelected}:${ctx.state.englishCores.map(e=>`${e.id}:${e.attachedTo}`).join('|')}`;
    if (signature === ctx.inventorySignature) return; ctx.inventorySignature = signature;
    const inBag = ctx.state.cores.filter(c => c.slot === null).sort((a, b) => CORE_ORDER.indexOf(a.kind) - CORE_ORDER.indexOf(b.kind) || a.id - b.id);
    for (const old of [...ctx.bag.querySelectorAll<HTMLElement>("[data-core]")]) if (!inBag.some(c => c.id === Number(old.dataset.core))) old.remove();
    for (const c of inBag) {
      let item = ctx.bag.querySelector<HTMLButtonElement>(`[data-core="${c.id}"]`);
      if (!item) {
        item = document.createElement("button"); item.type = "button"; item.className = "td-core"; item.dataset.core = String(c.id); item.draggable = true;
        item.addEventListener("click", () => ctx.choose(c.id));
        item.addEventListener("dragstart", event => ctx.beginDrag(event, c.id));
        item.addEventListener("dragend", ctx.endDrag);
      }
      const definition = CORES[c.kind]; item.style.setProperty("--core-color", color(c.kind));
      item.innerHTML = `<strong${definition.glyph.length > 1 ? ' class="td-word"' : ""}>${definition.glyph}</strong><small>${attachedEnglish(ctx.state,c.id) ? "已共鸣" : ctx.isPartner(c) ? ctx.englishSelected !== null ? "可共鸣" : "可搭配" : definition.role === "非成字部件" ? "三点水" : definition.pinyin}</small>`;
      item.classList.toggle("td-partner", ctx.isPartner(c));
      item.setAttribute("aria-label", `材料 ${definition.glyph} ${definition.pinyin}，${definition.attack}${ctx.isPartner(c) ? "，可搭配" : ""}`); item.setAttribute("aria-pressed", String(ctx.selection.includes(c.id)));
      // Appending an existing node preserves its identity and event handlers; restore focus below if browsers blur a moved node.
      const focused = document.activeElement === item; ctx.bag.append(item); if (focused) item.focus({ preventScroll: true });
    }
    ctx.bagKeys.refresh();
    ctx.el("[data-td-bag-empty]").hidden = inBag.length > 0;
    for (const [index] of ctx.SLOTS.entries()) {
      const slot = ctx.button(`[data-slot="${index}"]`), c = ctx.state.cores.find(c => c.slot === index);
      slot.classList.toggle("td-slot--occupied", !!c); slot.classList.toggle("td-slot--selected", !!c && ctx.selection.includes(c.id));
      slot.classList.toggle('td-slot--repair',ctx.state.scenarioId==='qinglan-repair'&&c?.id===2);
      slot.classList.toggle("td-partner", !!c && ctx.isPartner(c)); slot.draggable = !!c;
      slot.dataset.towerId = c ? String(c.id) : "";
      slot.dataset.kind = c?.kind ?? ""; slot.dataset.resonant = String(!!c && !!activeResonance(ctx.state,c));
      const art = slot.querySelector<HTMLImageElement>('.td-tower-art')!, illustrated = !!c && CORE_ORDER.includes(c.kind);
      slot.classList.toggle('td-slot--illustrated', illustrated); art.hidden = !illustrated;
      if (illustrated) { const src = `./assets/v1.0/tower/${c!.kind}${activeResonance(ctx.state,c!) ? '-resonant' : ''}.webp`; if (art.getAttribute('src') !== src) art.setAttribute('src',src); }
      slot.classList.toggle("td-slot--available", !c && ctx.selection.length === 1);
      slot.style.setProperty("--core-color", c ? color(c.kind) : "#c8ceba");
      slot.querySelector(".td-slot-glyph")!.textContent = c ? CORES[c.kind].glyph : "＋";
      slot.classList.toggle("td-slot--word", !!c && CORES[c.kind].glyph.length > 1);
      slot.setAttribute("aria-label", `塔位${index + 1} ${ctx.SLOTS[index].name}，${c ? `${CORES[c.kind].glyph} ${CORES[c.kind].attack}${ctx.isPartner(c) ? "，可搭配" : ""}` : "空位"}${slot.classList.contains('td-slot--repair')?'，接手布阵的林塔位置':''}`);
      slot.setAttribute("aria-pressed", String(!!c && ctx.selection.includes(c.id)));
    }
  }
function renderComposer(): void {
    const composer=ctx.el('.td-composer');
    preserveRegionFocus(composer,renderComposerContent,
      node=>node.dataset.fusionTarget!==undefined?`target:${node.dataset.fusionTarget}`:node.dataset.resultRecipe?`recipe:${node.dataset.resultRecipe}`:null,
      id=>id.startsWith('target:')?composer.querySelector<HTMLElement>(`[data-fusion-target="${id.slice(7)}"]`):composer.querySelector<HTMLElement>(`[data-result-recipe="${id.slice(7)}"]`),
      ()=>ctx.button('[data-td-clear]'));
  }
function composerIdle(idle:boolean):void { ctx.el('.td-composer').setAttribute('data-idle',String(idle)); }
function renderComposerContent(): void {
    ctx.el('.td-composer').hidden = ctx.englishSelected !== null || ctx.pendingRecycle !== null;
    const selected = ctx.selectedCores(), a = selected[0], b = selected[1];
    composerIdle(selected.length===0);
    const completeWord=selected.length===1 && CORES[a.kind].structure==='word';
    ctx.el('.td-composer').dataset.wordDetail=String(completeWord);
    ctx.el('.td-composer h2').textContent=completeWord?'字塔详情':'组合台';
    ctx.el('[data-td-selection]').hidden=completeWord; ctx.el('.td-compose-actions').hidden=completeWord;
    const candidates = a && b ? recipeCandidates(a.kind, b.kind,ctx.currentRecipes()) : [];
    const recipe = a && b ? recipeFor(a.kind, b.kind, ctx.chosenRecipe,ctx.currentRecipes()) : undefined;
    ctx.el("[data-td-selection]").innerHTML = [0, 1].map((index) => { const item = selected[index]; return `<span class="td-selected-core${item ? " has-core" : ""}">${item ? `${CORES[item.kind].glyph}<small>${item.slot === null ? "材料栏" : `塔位 ${item.slot + 1}`}</small>` : `<small>第${index + 1}枚字核</small>`}</span>`; }).join('<span class="td-plus">＋</span>');
    const preview = ctx.el("[data-td-preview]");
    if (recipe) {
      const c = CORES[recipe.result]; preview.innerHTML = `<div class="td-structure td-structure--${recipe.structure}" data-structure="${recipe.structure}">${c.components.map((glyph, index) => `<span><small>${c.slots[index]}</small><b>${glyph}</b></span>`).join("")}</div><div class="td-preview-result"><strong>${c.glyph}</strong><span>${c.pinyin}</span></div><p>${escape(c.meaning)}<br><b>${c.attack}</b></p>`;
    } else if (candidates.length > 1) {
      preview.innerHTML = '<p>这些材料能组合出不同结果，选一个：</p>' + candidates.map(r => `<button type="button" data-result-recipe="${r.id}">${CORES[r.result].glyph}</button>`).join('');
    } else if (a && b) preview.innerHTML = '<p class="td-invalid">暂无配方。点亮的字核可换搭档，或取消选择；材料和字塔都还在。</p>';
    else if (a) { const c = CORES[a.kind], resonance = activeResonance(ctx.state,a), mapping = resonanceFor(a.kind); preview.innerHTML = `<p><b>${c.glyph} · ${c.pinyin}</b><br>${escape(c.meaning)}<br>${c.attack}${resonance ? `<br><strong lang="en">${resonance.mapping.text}</strong><br>${resonance.mapping.effectName}：${resonance.mapping.effectText}` : mapping ? `<br>拾得 <span lang="en">${mapping.text}</span> 后，点英文核可预览共鸣。` : ''}</p>`; }
    else preview.innerHTML = '<p>点塔上的字或栏里的材料。<br>两枚字核在这里先预览，再组合。</p>';
    const partners = ctx.el("[data-td-partners]");
    const availableRecipes = a ? ctx.currentRecipes().filter(r => CORE_ORDER.some(k => recipeCandidates(a.kind, k,ctx.currentRecipes()).includes(r))) : [];
    partners.innerHTML = a && !recipe ? availableRecipes.map(r => {
      const other = r.inputs[r.inputs[0] === a.kind ? 1 : 0];
      const available = ctx.state.cores.some(c => c.id !== a.id && c.kind === other);
      return `<p>${CORES[a.kind].glyph} ＋ ${CORES[other].glyph} → <b>${CORES[r.result].glyph}</b> · ${available ? "点亮的搭档可组合" : `还缺 ${CORES[other].glyph}`}</p>`;
    }).join('') || (a ? completeWord ? `<p>完整中文词核${a.slot===null?'可部署到空塔位':'已在塔位 '+(a.slot+1)}。${attachedEnglish(ctx.state,a.id)?'点英文词核可查看卸下或转移。':'点同义英文词核，可预览装备。'}</p>` : '<p>这枚字核暂无组合配方，可先部署。</p>' : '') : '';
    const destination = ctx.el("[data-td-target]"), towers = selected.filter(c => c.slot !== null);
    destination.innerHTML = recipe ? ctx.fusionTarget === null ? '<p>产物放入材料栏</p>' : `<p>保留塔位 ${ctx.fusionTarget + 1}${towers.length === 2 ? `，释放塔位 ${towers.find(c => c.slot !== ctx.fusionTarget)!.slot! + 1}` : ''}</p>${towers.length === 2 ? towers.map(c => `<button type="button" data-fusion-target="${c.slot}" aria-pressed="${ctx.fusionTarget === c.slot}">留在塔位 ${c.slot! + 1}</button>`).join('') : ''}` : '';
    const confirm = ctx.button("[data-td-fuse]"); confirm.disabled = !recipe || ctx.state.phase === "won" || ctx.state.phase === "lost";
    confirm.textContent = recipe ? (ctx.fusionTarget !== null ? "组合并替换字塔" : "组合放入材料栏") : a && b ? candidates.length ? "先选组合结果" : "暂无配方" : "选两枚字核";
    ctx.button("[data-td-stow]").hidden = selected.length !== 1 || a.slot === null;
    ctx.button("[data-td-stow]").disabled=!!ctx.state.scenarioId&&ctx.state.phase==='battle';
    ctx.button("[data-td-stow]").textContent=ctx.state.scenarioId&&ctx.state.phase==='battle'?'波间才能收回':'收回材料栏';
    ctx.button("[data-td-recycle]").hidden = selected.length !== 1 || a.slot !== null;
    const attached = a && attachedEnglish(ctx.state,a.id);
    ctx.button("[data-td-recycle]").disabled = ctx.state.health >= 16 || !!attached && ctx.state.phase === 'battle';
    ctx.button("[data-td-recycle]").textContent = ctx.state.health >= 16 ? "城门完好，无需回收" : attached && ctx.state.phase === 'battle' ? '带英文核，波间再回收' : `回收修城 ＋${Math.min(16 - ctx.state.health, a ? CORES[a.kind].recycle : 0)}${attached ? ' · 先预览' : ''}`;
    const consequence=packConsequence(ctx.state,ctx.selection);ctx.el('[data-td-pack-consequence]').hidden=!consequence;ctx.el('[data-td-pack-consequence]').textContent=consequence?`若部署、合成或回收选中的材料：${consequence}`:'';
  }
function chooseEnglish(id: number): void {
    ctx.audio.unlock(); if (!ctx.state.englishCores.some(e => e.id === id)) return;
    ctx.englishSelected = id; ctx.equipmentTarget = ctx.selectedCores().length === 1 ? ctx.selectedCores()[0].id : null;
    ctx.selection = ctx.equipmentTarget === null ? [] : [ctx.equipmentTarget]; ctx.pendingRecycle = null; ctx.freshResult = false;
    ctx.renderEquipment(); ctx.renderInventory(); ctx.renderComposer();
    ctx.message('点亮的完整中文词核可以共鸣。选好塔位或背包字核，再确认装备。');
  }
function renderEquipment(): void {
    ctx.el('.td-english').hidden=ctx.state.englishCores.length===0 && !ctx.pendingRecycle;
    const signature = `${ctx.englishSelected}:${ctx.equipmentTarget}:${ctx.pendingRecycle}:${ctx.state.phase}:${ctx.state.health}:${ctx.state.englishCores.map(e=>`${e.id}:${e.attachedTo}`).join('|')}:${ctx.state.cores.map(c=>`${c.id}:${c.slot}`).join('|')}`;
    if (ctx.englishSignature === signature) return; ctx.englishSignature = signature;
    const list = ctx.el('[data-td-english-bag]');
    for (const old of list.querySelectorAll<HTMLElement>('[data-english]')) if (!ctx.state.englishCores.some(e=>e.id===Number(old.dataset.english))) old.remove();
    for (const e of ctx.state.englishCores) {
      const mapping = englishMapping(e); if (!mapping) continue;
      let node = list.querySelector<HTMLButtonElement>(`[data-english="${e.id}"]`);
      if (!node) { node=document.createElement('button'); node.type='button'; node.className='td-english-core'; node.dataset.english=String(e.id); node.draggable=true;
        node.addEventListener('click',()=>ctx.chooseEnglish(e.id));
        node.addEventListener('dragstart',event=>{ ctx.englishDragged=e.id; ctx.chooseEnglish(e.id); event.dataTransfer?.setData('text/plain',`english:${e.id}`); });
        node.addEventListener('dragend',()=>{ctx.englishDragged=null;ctx.endDrag();}); list.append(node); }
      const owner=ctx.state.cores.find(c=>c.id===e.attachedTo);
      node.innerHTML=`<strong lang="en">${mapping.text}</strong><span>${CORES[mapping.coreId].glyph} · ${owner ? owner.slot===null ? '已装备 · 材料栏' : `已装备 · 塔位 ${owner.slot+1}` : '可装备'}</span>`;
      node.setAttribute('aria-pressed',String(ctx.englishSelected===e.id)); node.dataset.attachedTo=String(e.attachedTo ?? '');
    }
    ctx.englishKeys.refresh();
    ctx.el('[data-td-english-empty]').hidden=ctx.state.englishCores.length>0;
    const unequipped=ctx.state.englishCores.filter(e=>e.attachedTo===null), notice=ctx.button('[data-td-english-notice]'); notice.hidden=!unequipped.length;
    notice.textContent=unequipped.map(e=>{const r=englishMapping(e)!;return `${r.text} → ${CORES[r.coreId].glyph}`;}).join('；')+' · 已收好，查看装备';
    const english=ctx.state.englishCores.find(e=>e.id===ctx.englishSelected), mapping=english && englishMapping(english), target=ctx.state.cores.find(c=>c.id===ctx.equipmentTarget);
    ctx.equipmentPreview = english && target ? previewEquipment(ctx.state,english.id,target.id) : null;
    const detail=ctx.el('[data-td-equipment-detail]'); detail.hidden=!english && ctx.pendingRecycle===null;
    ctx.button('[data-td-equip]').hidden=!english || !target || ctx.pendingRecycle!==null;
    ctx.button('[data-td-equip]').disabled=!ctx.equipmentPreview?.ok;
    ctx.button('[data-td-equip]').textContent=english?.attachedTo!==null && english?.attachedTo!==target?.id ? '确认转移到这里' : '确认装备';
    ctx.button('[data-td-unequip]').hidden=!english || english.attachedTo===null || ctx.pendingRecycle!==null;
    ctx.button('[data-td-unequip]').disabled=ctx.state.phase!=='ready';
    ctx.button('[data-td-unequip]').textContent=ctx.state.phase==='battle'?'卸下要等波间':'卸下到背包';
    ctx.button('[data-td-confirm-recycle]').hidden=ctx.pendingRecycle===null;
    const copy=ctx.el('[data-td-equipment-copy]');
    if (ctx.pendingRecycle!==null) {
      const c=ctx.state.cores.find(c=>c.id===ctx.pendingRecycle), attachment=c && attachedEnglish(ctx.state,c.id), r=attachment && englishMapping(attachment);
      ctx.button('[data-td-confirm-recycle]').disabled=!c || c.slot!==null || ctx.state.health>=16 || ctx.state.phase!=='ready';
      copy.textContent=c && r ? `回收 ${CORES[c.kind].glyph} 修城 ＋${Math.min(16-ctx.state.health,CORES[c.kind].recycle)}，${r.text} 原枚返还背包。确认后才会改变材料。`:'材料已变化，没有消耗。';
    } else if (mapping) {
      copy.innerHTML=`<b>${CORES[mapping.coreId].glyph} ↔ <span lang="en">${mapping.text}</span></b><br>${mapping.meaning} · ${mapping.form==='word'?'英文词':'英文短语'}<br><strong>${mapping.effectName}</strong> · ${mapping.effectText}<br>${target ? `目标：${CORES[target.kind].glyph} · ${target.slot===null?'材料栏':`塔位 ${target.slot+1}`}<br>${escape(ctx.equipmentPreview!.reason)}` : `点一座亮起的${CORES[mapping.coreId].glyph}塔，或材料栏里的完整${CORES[mapping.coreId].glyph}。<br>${mapping.recipe}`}${english?.attachedTo!==null ? '<br>这枚已装备。波间可选另一座同义词塔转移；战中只能查看。' : ''}`;
    }
  }
return { selectedCores, prepare, choose, isPartner, renderRanges, renderInventory, renderComposer, chooseEnglish, renderEquipment };
}
