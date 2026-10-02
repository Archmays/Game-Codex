import { bindInputLifecycle, ignoreGameKey, rovingGroup } from "../../../packages/ui/input";
import type { DefenseContext } from '../context';
export function bindDefenseInput(ctx: DefenseContext): () => void {
  const mapDialog=ctx.el<HTMLDialogElement>('[data-td-map-dialog]');
  // Native Tab may center a low composer button and scroll the field away.
  // Reclaim only available space, without moving focus or a pointer's pressed target.
  const keepBattleContext = (event: FocusEvent) => {
    const target=event.target;
    if(ctx.destroyed || innerWidth>900 || innerHeight<=540 || !(target instanceof HTMLElement) || !target.matches(':focus-visible') || !target.closest('.td-composer'))return;
    const field=ctx.board.getBoundingClientRect(),bar=ctx.el<HTMLElement>('.td-ribbon').getBoundingClientRect(),control=target.getBoundingClientRect();
    const needed=bar.bottom+Math.min(field.height,160)-field.bottom,available=innerHeight-16-control.bottom;
    if(needed>0 && available>0)window.scrollBy({top:-Math.min(needed,available,scrollY),behavior:'instant'});
  };
  ctx.root.addEventListener('focusin',keepBattleContext);

  const bagKeys=rovingGroup(ctx.bag,{items:'[data-core]',columns:()=>Math.max(1,Math.min(ctx.bag.querySelectorAll('[data-core]').length,getComputedStyle(ctx.bag).gridTemplateColumns.split(' ').length))});
  const slotKeys=rovingGroup(ctx.el('.td-slots'),{items:'[data-slot]'});
  const englishKeys=rovingGroup(ctx.el('[data-td-english-bag]'),{items:'[data-english]'});
  const packKeys=rovingGroup(ctx.el('[data-td-packs]'),{items:'[data-td-pack]'});
  const goalKeys=rovingGroup(ctx.el('[data-td-goals]'),{items:'[data-td-goal]'});
  Object.assign(ctx, {bagKeys,slotKeys,englishKeys,packKeys,goalKeys});
  const lifecycle=bindInputLifecycle(ctx.root,(event)=>{
    // HTML dragstart transfers the pointer stream to native DnD with pointercancel.
    // Native dragend (including Escape), blur and hidden end that separate lifecycle.
    if(event?.type!=="pointercancel" || ctx.draggedId===null&&ctx.englishDragged===null){ctx.draggedId=null;ctx.englishDragged=null;}
    ctx.hoveredSlot=null;ctx.renderRanges();
  });
  function beginDrag(event: DragEvent, id: number): void {
    event.dataTransfer?.setData("text/plain", String(id)); ctx.draggedId = id; ctx.prepare([id]);
  }
  function endDrag(): void { ctx.draggedId = null; ctx.hoveredSlot = null; ctx.renderRanges(); }
  Object.assign(ctx,{beginDrag,endDrag});
  for (const [index] of ctx.SLOTS.entries()) {
    const slot = ctx.button(`[data-slot="${index}"]`); slot.addEventListener("click", () => ctx.place(index));
    slot.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") { ctx.hoveredSlot = index; ctx.viewSource = "hover"; ctx.renderRanges(); } });
    slot.addEventListener("pointerleave", () => { if (ctx.hoveredSlot === index) ctx.hoveredSlot = null; ctx.renderRanges(); });
    slot.addEventListener("focus", () => { ctx.focusedSlot = index; ctx.viewSource = "focus"; ctx.renderRanges(); });
    slot.addEventListener("blur", () => { if (ctx.focusedSlot === index) ctx.focusedSlot = null; ctx.renderRanges(); });
    slot.addEventListener("dragstart", event => { const c = ctx.state.cores.find(c => c.slot === index); if (c) ctx.beginDrag(event, c.id); });
    slot.addEventListener("dragend", ctx.endDrag);
    slot.addEventListener("dragover", event => { event.preventDefault(); ctx.hoveredSlot = index; ctx.viewSource = "hover"; ctx.renderRanges(); });
    slot.addEventListener("dragleave", event => { if (!slot.contains(event.relatedTarget as Node | null)) { ctx.hoveredSlot = null; ctx.renderRanges(); } });
    slot.addEventListener("drop", event => {
      event.preventDefault(); const text = event.dataTransfer?.getData("text/plain");
      if (ctx.englishDragged!==null && text===`english:${ctx.englishDragged}`) {
        const target=ctx.state.cores.find(c=>c.slot===index);
        if (target) { ctx.inspectedId=target.id; ctx.equipmentTarget=target.id; ctx.selection=[target.id]; ctx.renderEquipment(); ctx.renderInventory(); ctx.renderComposer(); ctx.message('已准备共鸣，请看实际效果再确认。'); }
        else ctx.message('英文核用于完整中文词塔，不能单独放在空塔位。');
        ctx.englishDragged=null; ctx.endDrag(); return;
      }
      const id = Number(text);
      if (ctx.draggedId===null || id!==ctx.draggedId || !Number.isSafeInteger(id) || !ctx.state.cores.some(c => c.id === id)) { ctx.message("没有可用的源材料，字塔和材料都未改变。"); return; }
      const target = ctx.state.cores.find(c => c.slot === index);
      if (target) {
        ctx.inspectedId = target.id; ctx.prepare(target.id === id ? [id] : [id, target.id], index);
        ctx.message(target.id === id ? "字塔仍在原位。" : "已准备这两枚字核，请在组合台看结果和去向，再确认。");
      } else { ctx.prepare([id]); ctx.place(index); }
      ctx.endDrag();
    });
  }
  const keydown = (event: KeyboardEvent): void => {
    if (ignoreGameKey(event,ctx.gameRoot) || ctx.restartDialog.open || ctx.resultDialog.open || ctx.mapDialog.open || ctx.settingsDialog.open) return;
    if (event.key.toLowerCase() === "p") { event.preventDefault(); ctx.togglePause(); }
    if (event.key === "Escape") { ctx.clearSelection(); ctx.message("已放回选择，材料还在。"); }
  };
  const hide = (): void => { if (document.hidden) { if (ctx.state.phase === "battle") ctx.state.paused = true; ctx.audio.suspend(); ctx.music.suspend(); ctx.persist(); ctx.updateStatus(); } };
  const pagehide = (): void => { if (ctx.state.phase === "battle") ctx.state.paused = true; ctx.persist(); ctx.audio.suspend(); ctx.music.suspend(); };
  ctx.root.addEventListener("keydown", keydown); document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", pagehide);
return () => {
ctx.root.removeEventListener('focusin',keepBattleContext);lifecycle();ctx.bagKeys.destroy();ctx.slotKeys.destroy();ctx.englishKeys.destroy();ctx.packKeys.destroy();ctx.goalKeys.destroy();ctx.root.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',pagehide);
};
}
