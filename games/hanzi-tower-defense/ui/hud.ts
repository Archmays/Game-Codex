import { mapFor } from "../maps";
import { CORES, type Recipe } from "../content";
import { packProgress, MAP, type BattleEvent } from "../model";
import { RESONANCES } from "../resonance";
import { SCENARIOS, rulesFor } from '../tactics';
import type { DefenseContext } from '../context';
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function createHud(ctx: DefenseContext) {
function updateStatus(): void {
    if (ctx.destroyed) return;
    const end=mapFor(ctx.state.mapId).paths[0].at(-1)!;ctx.el('[data-td-gate]').style.left=`${end.x/MAP.width*100}%`;ctx.el('[data-td-gate]').style.top=`${end.y/MAP.height*100}%`;
    ctx.button('[data-td-new]').textContent='新战役';ctx.button('[data-td-continue]').textContent='选择地图';
    ctx.gameRoot.dataset.scenarioId=ctx.state.scenarioId??"";
    ctx.gameRoot.dataset.mapId=ctx.state.mapId??"qinglan-pass";
    ctx.gameRoot.dataset.phase = ctx.state.phase; ctx.gameRoot.dataset.wave = String(ctx.state.wave); ctx.gameRoot.dataset.paused = String(ctx.state.paused);
    ctx.gameRoot.dataset.kills = String(ctx.state.kills); ctx.gameRoot.dataset.leaks = String(ctx.state.leaks);
    ctx.gameRoot.dataset.speed = String(ctx.battleSpeed); ctx.gameRoot.dataset.elapsed = ctx.state.elapsed.toFixed(3);
    ctx.gameRoot.dataset.reducedMotion = String(ctx.preferences.reducedMotion);ctx.gameRoot.dataset.lowPerformance=String(ctx.visual.lowPerformance);ctx.music.configure(ctx.visual.music,ctx.preferences.muted||ctx.state.paused||document.hidden);ctx.audio.setVolume(ctx.visual.effects);
    ctx.el("[data-td-wave]").textContent = `第 ${Math.min(ctx.state.wave + 1, ctx.WAVES.length)} / ${ctx.WAVES.length} 波 · ${ctx.WAVES[Math.min(ctx.state.wave, ctx.WAVES.length-1)].label}`;
    ctx.el("[data-td-health]").textContent = `${ctx.state.health}`; ctx.el("[data-td-health-fill]").style.width = `${ctx.state.health / 16 * 100}%`;
    const fieldStatus = ctx.state.phase === "battle" ? `路上 ${ctx.state.enemies.length} · 还有 ${ctx.WAVES[ctx.state.wave].foes.length - ctx.state.spawned} 只` : ctx.state.phase === "ready" ? "波间布阵 · 准备好再出发" : "守城结束";
    ctx.el("[data-td-enemies]").textContent = ctx.state.paused ? `已暂停 · ${fieldStatus} · 可以安心组合` : fieldStatus;
    const focusedControl = document.activeElement;
    const pause = ctx.button("[data-td-pause]"); pause.textContent = ctx.state.paused ? "继续战斗" : "暂停"; pause.setAttribute("aria-pressed", String(ctx.state.paused)); pause.disabled = ctx.state.phase !== "battle";
    const next = ctx.button("[data-td-next]"); next.hidden = ctx.state.phase !== "ready";next.disabled=!!(SCENARIOS[ctx.state.scenarioId!]?.materialPacks||SCENARIOS[ctx.state.scenarioId!]?.packGoals)&&!ctx.state.challenge?.confirmed;next.textContent=next.disabled?SCENARIOS[ctx.state.scenarioId!]?.packGoals?'先选行囊目标，再出发':'先选材料包，再出发':ctx.activeSave().hasCheckpoint && ctx.state.wave === 0 ? "从检查点继续" : `迎接第 ${ctx.state.wave + 1} 波`;
    ctx.el("[data-td-wave-hint]").textContent = ctx.state.phase === "ready" ? `先布阵，再出发。${ctx.WAVES[ctx.state.wave]?.hint ?? ""}` : ctx.WAVES[Math.min(ctx.state.wave, ctx.WAVES.length-1)].hint;
    const retry=ctx.button('[data-td-retry]');retry.hidden=!ctx.state.scenarioId||ctx.state.phase==='lost'||ctx.state.phase==='won'||ctx.state.phase==='battle'&&!ctx.state.paused||ctx.state.phase==='ready'&&!ctx.state.retryCheckpoint;
    retry.textContent=ctx.state.phase==='ready'?'重整刚才一波':'重整本波';
    ctx.button('[data-td-result-retry]').hidden=!ctx.state.scenarioId;
    const summaries=ctx.el('[data-td-tactics-summary]');summaries.hidden=!ctx.state.scenarioId||!ctx.state.summaries.length;
    const summaryHtml=ctx.state.summaries.map(v=>`<p>第 ${v.wave} 波 · ${v.outcome==='held'?'已守住':'先回城'}：击败 ${v.kills}，漏怪 ${v.leaks}，城门 ${v.healthBefore} → ${v.healthAfter}；波前${v.coverage.length===2?'北／南路':'道路'}覆盖 ${v.coverage.join('／')}%。${v.lanes.map((l,i)=>`${v.lanes.length===2?i===0?'北路':'南路':'本路'}击败 ${l.kills}／漏 ${l.leaks}，城门受损 ${l.damage}。`).join('')}</p>`).join('');
    if(summaries.innerHTML!==summaryHtml)summaries.innerHTML=summaryHtml;
    const boss=ctx.state.enemies.find(e=>e.kind==='captain');
    const bossStatus=ctx.el('[data-td-boss-status]');bossStatus.hidden=!boss;
    const bossStage=boss?`${boss.id}:${boss.summons??0}:${boss.summonAt===undefined?'walking':'warning'}`:'';
    if(bossStage!==ctx.bossAnnouncement){ctx.bossAnnouncement=bossStage;if(boss?.summonAt!==undefined)ctx.music.duck();ctx.audio.play('wave');if(boss)ctx.message(boss.summonAt!==undefined?'首领将在两秒后呼来两只团团怪，注意它身后的道路。':(boss.summons??0)>0?`首领已呼援 ${boss.summons} 次，最多两次。`:'烽台首领出现了。它最多呼援两次，预告期间会亮起金色轮廓。');}
    bossStatus.textContent=boss?`烽台首领 · 耐久 ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)} · ${boss.summonAt!==undefined?`呼援预告 ${Math.max(0,boss.summonAt-ctx.state.waveTime).toFixed(1)} 秒`:`已呼援 ${boss.summons??0} / 2 次`}`:'';
    ctx.button("[data-td-mute]").setAttribute("aria-pressed", String(ctx.preferences.muted)); ctx.button("[data-td-mute]").textContent = ctx.preferences.muted ? "开启声音" : "静音";
    ctx.button("[data-td-motion]").setAttribute("aria-pressed", String(ctx.preferences.reducedMotion));
    const speed = ctx.button("[data-td-speed]"); speed.textContent = `速度 ${ctx.battleSpeed}×`; speed.setAttribute("aria-pressed", String(ctx.battleSpeed === 2)); speed.setAttribute("aria-label", `战斗速度${ctx.battleSpeed}倍，切换为${ctx.battleSpeed === 1 ? 2 : 1}倍`);
    const signature = `${ctx.state.health}:${ctx.state.phase}`; if (signature !== ctx.statusSignature) { ctx.statusSignature = signature; ctx.renderComposer(); }
    ctx.renderChallenge();ctx.renderInventory(); ctx.renderEquipment(); ctx.renderRanges();
    // Move only a wave control that just became unavailable; leave other game and browser focus alone.
    if (focusedControl === next && next.hidden || focusedControl === pause && pause.disabled) ctx.focusWaveControl();
    if ((ctx.state.phase === "won" || ctx.state.phase === "lost") && !ctx.resultDialog.open && !ctx.resultPresented) {
      ctx.resultPresented=true;
      ctx.el("#td-result-title").textContent = ctx.state.phase === "won" ? `${rulesFor(ctx.state).title}，守住了！` : "这次先退回城里";
      ctx.el("[data-td-result-copy]").textContent = ctx.state.phase === "won" ? `${ctx.WAVES.length} 波都已结束。城门还有 ${ctx.state.health} 点耐久，你的字阵挡住了 ${ctx.state.kills} 只怪物。` : `守到了第 ${ctx.state.wave + 1} 波。击败 ${ctx.state.kills}，漏怪 ${ctx.state.leaks}。${ctx.state.scenarioId?"重整本波会回到真正波前，可以调整后再出发。":"把范围塔放在弯道，减速塔留在来路，再试一次。"}`;
      const progress=packProgress(ctx.state),objectives=ctx.el('[data-td-result-objectives]');objectives.hidden=!progress;
      objectives.innerHTML=progress?`<p><b>守城 · ${ctx.state.phase==='won'?'已守住':'这次先回城'}</b><br>城门 ${ctx.state.health} 点</p><p><b>行囊 · ${progress.complete?'已装好':'还可以换个安排'}</b><br>${escape(progress.title)}<br>${progress.items.map(i=>`${CORES[i.kind].glyph} ${i.count}／${i.required}`).join(' · ')}</p>`:'';
      ctx.button('[data-td-replay]').textContent=SCENARIOS[ctx.state.scenarioId!]?.challengeRule?'再试一次':'再守一局';ctx.button('[data-td-result-change]').hidden=ctx.state.scenarioId!=='qinglan-repair';
      ctx.el('.td-result-foot').textContent=progress?'守城和行囊分别记录。再试一次会保留材料包和目标。':'发现的配方已经留下。换条组合路线再试试。';
      ctx.resultDialog.showModal();ctx.button(ctx.state.scenarioId&&ctx.state.phase==='lost'?'[data-td-result-retry]':'[data-td-replay]').focus({preventScroll:true}); ctx.audio.play(ctx.state.phase === "won" ? "wave" : "leak"); ctx.persist();
    }
  }
function focusWaveControl(): void {
    const target = ctx.resultDialog.open ? "[data-td-replay]" : ctx.state.phase === "battle" ? "[data-td-pause]" : ctx.state.phase === "ready" && ctx.button('[data-td-next]').disabled ? ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].packGoals?'[data-td-goal]':'[data-td-pack]' : ctx.state.phase === "ready" ? "[data-td-next]" : "[data-td-home]";
    ctx.button(target).focus({ preventScroll: true });
  }
function animateFusion(recipe: Recipe, target: number | null): void {
    const host = ctx.el("[data-td-synthesis]"), c = CORES[recipe.result];
    host.innerHTML = `<div class="td-fusion-orbit td-fusion-orbit--${recipe.structure}">${c.components.map(glyph => `<span>${glyph}</span>`).join("")}<b>${c.glyph}</b></div><small>${c.glyph} · ${c.pinyin}</small>`;
    host.style.left = `${(target === null ? MAP.width / 2 : ctx.SLOTS[target].x) / MAP.width * 100}%`; host.style.top = `${(target === null ? MAP.height / 2 : ctx.SLOTS[target].y) / MAP.height * 100}%`;
    const token=++ctx.fusionAnimation;host.hidden = false; ctx.later(() => {if(token===ctx.fusionAnimation)host.hidden=true;}, ctx.preferences.reducedMotion ? 450 : 550);
  }
function handleEvents(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.type === "shot") ctx.audio.play(["volcano", "mountain", "wildwood"].includes(event.core) ? "heavy" : "shot");
      if (event.type === "shot") {
        const tower = ctx.root.querySelector<HTMLElement>(`[data-tower-id="${event.coreId}"]`);
        if (tower && !ctx.preferences.reducedMotion) { tower.classList.remove('td-firing'); void tower.offsetWidth; tower.classList.add('td-firing'); }
      }
      if (event.type === "echo") { ctx.audio.play('echo'); ctx.gameRoot.dataset.echoes = String(Number(ctx.gameRoot.dataset.echoes ?? 0)+1); }
      if (event.type === 'roots') { ctx.audio.play('roots'); ctx.gameRoot.dataset.rootBursts=String(Number(ctx.gameRoot.dataset.rootBursts??0)+1); }
      if (event.type === "english-drop") {
        const mapping=RESONANCES.find(r=>r.grantId===event.grantId)!; ctx.audio.play('drop'); ctx.renderEquipment(); ctx.renderInventory();
        ctx.message(`拾得 ${mapping.text}，已自动收好。可装入${CORES[mapping.coreId].glyph}，得到${mapping.effectName}；还没合成也可以先保留。`);
      }
      if (event.type === "defeat") ctx.audio.play("defeat");
      if (event.type === "drop") {
        ctx.audio.play("drop"); const drop = document.createElement("span"); drop.className = "td-drop"; drop.textContent = CORES[event.core].glyph;
        drop.style.left = `${Math.max(5, Math.min(94, event.at.x / MAP.width * 100))}%`; drop.style.top = `${event.at.y / MAP.height * 100}%`;
        ctx.el("[data-td-drops]").append(drop); ctx.later(() => drop.remove(), 950); ctx.renderInventory(); ctx.renderComposer();
        ctx.message(`拾得 ${CORES[event.core].glyph}，已放入材料栏。`);
      }
      if (event.type === "leak") { ctx.audio.play("leak"); ctx.message(`有怪物进城，城门减少 ${event.harm} 点耐久。${ctx.state.scenarioId?"可首次部署材料；暂停后也可重整本波。":"可以暂停调整塔位。"}`); }
      if (event.type === "wave-end") { ctx.music.duck();ctx.audio.play("wave"); ctx.persist(); ctx.message(event.won ? "守住了最后一波！" : "这一波结束了。先组合、调整塔位，准备好再出发。 "); }
    }
  }
return { updateStatus, focusWaveControl, animateFusion, handleEvents };
}
