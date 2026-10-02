import { preserveRegionFocus } from "../../../packages/ui/input";
import { mapFor } from "../maps";
import { CORES } from "../content";
import { ENEMIES, retryWave, newTactics, choosePreparation, changeVariation, deploymentLimit, packProgress } from "../model";
import { RESONANCES } from "../resonance";
import { SCENARIOS, SCENARIO_IDS, isScenarioId, type ScenarioId } from '../tactics';
import type { DefenseContext } from '../context';
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function createChallenges(ctx: DefenseContext) {
function renderTacticsBrief():void {
    const scenario=ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId];ctx.el('[data-td-tactics-brief]').hidden=!scenario||!!scenario.challengeRule;
    ctx.el('[data-td-tactics-rules]').textContent=scenario?'战中可首次部署、合成和首次装备；已部署塔移动／收回与英文转移等波间。暂停仍在战中。':'';
    ctx.el('[data-td-tactics-waves]').innerHTML=scenario?scenario.waves.map((w,i)=>{
      const counts=Object.entries(ENEMIES).filter(([kind])=>w.foes.includes(kind as keyof typeof ENEMIES)).map(([kind,e])=>`${e.label}×${w.foes.filter(k=>k===kind).length}`).join('，');
      const lanes=w.lanes?`北路 ${w.lanes.filter(l=>l===0).length}／南路 ${w.lanes.filter(l=>l===1).length}`:'单路';
      const rewards=scenario.rewards[i].map(k=>CORES[k].glyph).join('、');
      const english=scenario.drops.english.filter(d=>d.wave===i).map(d=>RESONANCES.find(r=>r.grantId===d.grantId)!.text).join('、');
      return `<li><b>${w.label}</b> · ${lanes} · ${counts}<br>第 1／5 次击败依次得 ${rewards}${english?`；英文 ${english}（击败领取，波尾保底）`:''}。</li>`;
    }).join(''):'';
  }
function renderChallenge():void {
    const scenario=ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId],active=!!scenario?.challengeRule;
    ctx.el('[data-td-challenge-rule]').hidden=!active;ctx.el('[data-td-challenge-preview]').hidden=!active;
    ctx.el('[data-td-challenge-preparation]').hidden=!active;
    ctx.el('[data-td-pack-head]').hidden=!scenario?.materialPacks;ctx.el('[data-td-packs]').hidden=!scenario?.materialPacks;
    if(!scenario||!active){ctx.el('[data-td-bag-counts]').hidden=true;ctx.el('[data-td-bag-goal]').hidden=true;return;}
    ctx.el('[data-td-challenge-title]').textContent=scenario.title;
    ctx.el('[data-td-challenge-copy]').textContent=scenario.challengeRule!;
    const limit=deploymentLimit(ctx.state),count=ctx.state.cores.filter(c=>c.slot!==null).length;
    const inherited=ctx.state.cores.find(c=>c.id===2);
    ctx.el('[data-td-deployed-count]').textContent=limit===null?ctx.state.scenarioId==='qinglan-repair'?`接手塔：${inherited?CORES[inherited.kind].glyph:''}${inherited?.slot===null?'已收回背包':inherited?.slot!==undefined?` · 塔位 ${inherited.slot+1} · 金色边框`:'已用于合成'}`:'':`上场 ${count}／${limit} · 合成也只占一座`;
    ctx.el('[data-td-deployed-count]').classList.toggle('td-capacity-full',limit!==null&&count>=limit);
    const change=ctx.button('[data-td-change-variation]');change.hidden=ctx.state.scenarioId!=='qinglan-repair';change.textContent='换个变化 · 重开这局';
    const progress=packProgress(ctx.state),counts=ctx.el('[data-td-bag-counts]'),goal=ctx.el('[data-td-bag-goal]');
    counts.hidden=!progress;goal.hidden=!progress;
    if(progress){counts.innerHTML=progress.items.map(i=>`<span data-bag-kind="${i.kind}" data-count="${i.count}" data-required="${i.required}"><b>${CORES[i.kind].glyph}</b> ${i.count}／${i.required}${i.count>=i.required?' ✓':''}</span>`).join('');goal.textContent=ctx.state.challenge?.confirmed?`行囊：${progress.title}${progress.complete?' · 已装好':''}。只数背包基础材料。`:`行囊预览：${progress.title}。先选一个目标；只数背包基础材料。`;}
    const signature=`${ctx.state.scenarioId}:${ctx.state.phase}:${ctx.state.wave}:${ctx.state.challenge?.packId}:${ctx.state.challenge?.goalId}:${ctx.state.challenge?.variant}:${ctx.state.challenge?.confirmed}`;
    if(signature===ctx.challengeSignature)return;ctx.challengeSignature=signature;
    const preview=ctx.el('[data-td-challenge-foes]');preview.innerHTML=scenario.waves.map((wave,i)=>{
      const counts=Object.entries(ENEMIES).filter(([kind])=>wave.foes.includes(kind as keyof typeof ENEMIES)).map(([kind,e])=>`${e.label} × ${wave.foes.filter(k=>k===kind).length}`).join(' · ');
      return `<p><b>第 ${i+1} 波 · ${escape(wave.label)}</b><span>${counts}</span></p>`;
    }).join('');
    const editable=ctx.state.phase==='ready'&&ctx.state.wave===0;
    ctx.el('[data-td-pack-status]').textContent=editable?ctx.state.challenge?.confirmed?'已选好 · 换包会恢复开局布阵':'先看地图，再选一包': '本局已出发';
    const packs=ctx.el('[data-td-packs]');preserveRegionFocus(packs,()=>{packs.innerHTML=scenario.materialPacks?.map(pack=>{
      const kinds=[...new Set(pack.starting.map(c=>c.kind))];
      return `<button type="button" data-td-pack="${pack.id}" aria-pressed="${ctx.state.challenge?.confirmed&&ctx.state.challenge.packId===pack.id}" ${editable?'':'disabled'}><b>${escape(pack.title)}</b><span>${kinds.map(k=>`${CORES[k].glyph} × ${pack.starting.filter(c=>c.kind===k).length}`).join(' · ')}</span></button>`;
    }).join('')??'';ctx.packKeys.refresh();},node=>node.dataset.tdPack??null,id=>packs.querySelector(`[data-td-pack="${id}"]`),()=>ctx.button('[data-td-next]'));
    ctx.el('[data-td-challenge-goals]').hidden=!scenario.packGoals;
    const goals=ctx.el('[data-td-goals]');preserveRegionFocus(goals,()=>{goals.innerHTML=scenario.packGoals?.map(g=>`<button type="button" data-td-goal="${g.id}" aria-pressed="${!!ctx.state.challenge?.confirmed&&ctx.state.challenge.goalId===g.id}" ${editable?'':'disabled'}>${escape(g.title)}</button>`).join('')??'';ctx.goalKeys.refresh();},node=>node.dataset.tdGoal??null,id=>goals.querySelector(`[data-td-goal="${id}"]`),()=>ctx.button('[data-td-next]'));
    ctx.el('[data-td-goal-status]').textContent=ctx.state.challenge?.confirmed?'已选好 · 换目标会恢复开局布阵':'先看地图，再选一个目标。';
    ctx.el('[data-td-supply-copy]').textContent=ctx.state.scenarioId==='qinglan-repair'?ctx.state.challenge?.variant===1?scenario.variationHint??'变化：林移到塔位6，其他条件相同。':'原阵地：林在塔位8；换个变化只移林到塔位6，从第一波重开。':`固定补给：每波第 1／5 次击退依次得 ${scenario.rewards.map((reward,i)=>`第 ${i+1} 波 ${reward.map(k=>CORES[k].glyph).join('、')}`).join('；')}。${scenario.packGoals?'行囊目标只数背包里的基础字核；部署、合成、回收后会重新计数。':''}`;
  }
function selectPreparation(patch:Parameters<typeof choosePreparation>[1]):void {
    const updated=choosePreparation(ctx.state,patch);if(!updated)return;ctx.state=updated;ctx.refreshMap();ctx.persist();
    ctx.message(patch.goalId?'行囊目标已选好。先布阵，准备好再出发；换目标会恢复起始布阵。':'这包材料已放好。先布阵，准备好再出发；换包会恢复这局的起始布阵。');
  }
function switchVariation():void {
    const updated=changeVariation(ctx.state);if(!updated)return;ctx.state=updated;ctx.resultDialog.close();ctx.refreshMap();ctx.persist();ctx.focusWaveControl();
    ctx.message('已换一个布阵变化，从第一波重新准备。林塔的金色边框显示它现在的位置。');
  }
function selectScenario(id:ScenarioId):void {
    ctx.persist();ctx.mapDialog.close();ctx.state=ctx.tacticsSave.load(id)??newTactics(id);ctx.pendingScenario=id;ctx.refreshMap();ctx.persist();ctx.focusWaveControl();
    ctx.message(`已进入 ${SCENARIOS[id].title}，三波短局。${SCENARIOS[id].packGoals&&!ctx.state.challenge?.confirmed?'先看地图和敌人，再选行囊目标。':SCENARIOS[id].materialPacks&&!ctx.state.challenge?.confirmed?'先看地图和敌人，再选材料包。':'先布阵，准备好再出发。'}切换会保存，未结束波次回到波前。`);
  }
function showTactics():void {
    if(ctx.state.phase==='battle')ctx.state.paused=true;ctx.persist();ctx.updateStatus();ctx.draggedId=null;ctx.englishDragged=null;
    ctx.el('#td-map-dialog-title').textContent='战术短局 · 直接选一局';ctx.el('[data-td-map-note]').textContent='每局独立继续。新挑战先看地图与敌人，再选材料包。';
    ctx.el('[data-td-map-list]').innerHTML=[...SCENARIO_IDS].sort((a,b)=>Number(!!SCENARIOS[b].challengeRule)-Number(!!SCENARIOS[a].challengeRule)).map(id=>{const entry=ctx.tacticsSave.list().find(e=>e.scenarioId===id),s=SCENARIOS[id];return `<button type="button" data-scenario-select="${id}"><b>${s.title} · ${mapFor(s.mapId).title}</b><span>${s.question} · ${s.waves.length} 波${entry?entry.won?' · 已守住':` · 继续第 ${entry.wave+1} 波`:' · 固定新局'}</span></button>`;}).join('');
    ctx.el('[data-td-map-list]').onclick=event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-scenario-select]')?.dataset.scenarioSelect;if(isScenarioId(id))ctx.selectScenario(id);};ctx.mapDialog.showModal();
  }
function retryCurrentWave():void {
    const restored=retryWave(ctx.state);if(!restored)return;ctx.state=restored;ctx.resultDialog.close();ctx.refreshMap();ctx.persist();ctx.updateStatus();ctx.message(`已回到第 ${ctx.state.wave+1} 波出发前，材料、装备和城门一起恢复。换好布局，再出发。`);ctx.focusWaveControl();
  }
return { renderTacticsBrief, renderChallenge, selectPreparation, switchVariation, selectScenario, showTactics, retryCurrentWave };
}
export function bindChallenges(ctx: DefenseContext): void {
  ctx.button('[data-td-tactics]').addEventListener('click',ctx.showTactics);
  ctx.el('[data-td-packs]').addEventListener('click',event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-td-pack]')?.dataset.tdPack;const pack=ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].materialPacks?.find(p=>p.id===id);if(pack)ctx.selectPreparation({packId:pack.id});});
  ctx.el('[data-td-goals]').addEventListener('click',event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-td-goal]')?.dataset.tdGoal;const goal=ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].packGoals?.find(g=>g.id===id);if(goal)ctx.selectPreparation({goalId:goal.id});});
  ctx.button('[data-td-change-variation]').addEventListener('click',ctx.switchVariation);ctx.button('[data-td-result-change]').addEventListener('click',ctx.switchVariation);
  ctx.button('[data-td-retry]').addEventListener('click',ctx.retryCurrentWave);ctx.button('[data-td-result-retry]').addEventListener('click',ctx.retryCurrentWave);
}
