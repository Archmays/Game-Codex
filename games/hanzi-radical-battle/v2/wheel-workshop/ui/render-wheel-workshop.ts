import { getPlayableWheelRecord, getWheelGradeOption, getWheelPool, WHEEL_GRADE_OPTIONS } from "../library/playable-wheel-manifest";
import type { PlayableWheelRecord, WheelSlotId, WheelWorkshopState } from "../types";

export interface WheelWorkshopView {
  readonly state: WheelWorkshopState;
  readonly gradeSelectOpen: boolean;
  readonly readOnly: boolean;
  readonly saveNotice: "none" | "recovered" | "migrated" | "future-read-only";
}

function structureLabel(record: PlayableWheelRecord): string {
  return ({ "left-right": "左右结构", "top-bottom": "上下结构", "full-enclosure": "全包围结构", "semi-enclosure": "半包围结构" })[record.structure];
}

function slotLabel(slot: WheelSlotId): string {
  return ({ left: "左边", right: "右边", top: "上边", bottom: "下边", outer: "外框", inner: "里面", "context-first": "前半", "context-second": "后半" })[slot];
}

function renderWheel(state: WheelWorkshopState): string {
  const rotation = state.currentRound?.wheelRotationDegrees ?? 0;
  const spinning = state.phase === "spinning";
  return `<div class="ww-wheel-wrap"><span class="ww-wheel-pointer" aria-hidden="true">▼</span><div class="ww-wheel${spinning ? " is-spinning" : ""}" role="img" aria-label="${spinning ? "字轮正在转动" : "等待转动的字轮"}" style="--ww-rotation:${rotation}deg" data-wheel-landing-index="${state.currentRound?.landingIndex ?? -1}"><span aria-hidden="true">✦</span>${Array.from({ length: 12 }, (_, index) => `<i style="--ww-mark:${index}" aria-hidden="true">✦</i>`).join("")}</div></div>`;
}

function renderGradeSelect(view: WheelWorkshopView): string {
  return `<div class="ww-grade-select" data-testid="wheel-grade-select"><p class="hm2-kicker">选择字卷 · 来源标签，不猜你的年级</p><h3>这次想听哪一本字卷？</h3><p>“跟随当前旅程”会从较熟悉的低风险字池开始；选择会只保存在这台设备。</p><div class="ww-grade-grid" role="group" aria-label="十种字卷选择">${WHEEL_GRADE_OPTIONS.map((option) => {
    const selected = view.state.selectedGradeId === option.id;
    return `<button type="button" data-action="wheel-choose-grade" data-wheel-grade-id="${option.id}" aria-pressed="${String(selected)}"><b>${option.label}</b><span>${option.worldName}</span><small>${getWheelPool(option.id).length} 道可用字光</small></button>`;
  }).join("")}</div><button type="button" class="ww-secondary" data-action="wheel-close-grade-select">回到字轮</button></div>`;
}

function renderStructure(record: PlayableWheelRecord, state: WheelWorkshopState): string {
  const round = state.currentRound!;
  const anchorSlot = record.slotIds[round.anchorComponentIndex];
  const partnerSlot = record.slotIds[round.partnerComponentIndex];
  const canPlace = state.phase === "place-card";
  return `<div class="ww-structure" data-structure="${record.structure}" role="group" aria-label="${structureLabel(record)}合字位置"><div class="ww-slot is-anchor" data-wheel-slot-role="anchor"><span>${record.orderedComponents[round.anchorComponentIndex]}</span><small>${slotLabel(anchorSlot)}锚点</small></div>${canPlace ? `<button type="button" class="ww-slot is-empty${state.hintLevel >= 1 ? " is-hinted" : ""}" data-action="wheel-place-card" data-wheel-slot-id="${partnerSlot}" aria-label="把选中的伙伴部件放到${slotLabel(partnerSlot)}"><span>＋</span><small>${slotLabel(partnerSlot)}空位</small></button>` : `<div class="ww-slot is-empty${state.hintLevel >= 1 ? " is-hinted" : ""}" aria-label="${slotLabel(partnerSlot)}空位"><span>？</span><small>${slotLabel(partnerSlot)}空位</small></div>`}</div>`;
}

function renderCandidateCards(state: WheelWorkshopState): string {
  const round = state.currentRound!;
  return `<div class="ww-cards" role="group" aria-label="候选伙伴部件">${round.candidateCards.map((card) => {
    if (card.removedByHint) return `<button type="button" class="ww-card is-resting" disabled aria-label="这张不合适的部件牌正在休息"><span aria-hidden="true">·</span><small>先休息</small></button>`;
    const selected = round.selectedCardId === card.id;
    const finalHint = state.hintLevel >= 4 && card.kind === "partner";
    const cardLabel = finalHint ? `最终提示：伙伴部件 ${card.glyph}` : `候选部件 ${card.glyph}`;
    return `<button type="button" class="ww-card${selected ? " is-selected" : ""}${finalHint ? " is-final-hint" : ""}" data-action="wheel-select-card" data-wheel-card-id="${card.id}" aria-label="${cardLabel}" aria-pressed="${String(selected)}" ${state.phase === "place-card" && !selected ? "disabled" : ""}><span>${card.glyph}</span><small>${selected ? "已拿起" : finalHint ? "伙伴提示" : "选伙伴"}</small></button>`;
  }).join("")}</div>`;
}

function renderRound(state: WheelWorkshopState): string {
  const record = getPlayableWheelRecord(state.currentRound!.recordId);
  if (state.phase === "success") {
    return `<div class="ww-success" data-testid="wheel-success" data-wheel-record-id="${record.id}"><div class="ww-success-glyph" aria-label="完整汉字 ${record.glyph}">${record.glyph}</div><div><p class="hm2-kicker">${record.orderedComponents.join(" ＋ ")} · ${structureLabel(record)}</p><h3>${record.glyph} · ${record.pinyin}</h3><p><b>${record.familiarWord}</b>：${record.shortMeaning}</p><p class="ww-magic">字义魔法：${record.familiarWord}的字光已经回到工坊。</p><div class="ww-success-actions"><button type="button" data-action="wheel-speak-word">朗读“${record.spokenPhrase}”</button><button type="button" class="hm2-primary" data-action="wheel-continue">${state.completedRoundCount >= 2 ? "收好第三道字光" : "继续下一道"}</button></div></div></div>`;
  }
  return `<div class="ww-challenge" data-testid="wheel-structure-placement"><p class="hm2-kicker">第 ${state.completedRoundCount + 1}/3 道字光 · ${structureLabel(record)}</p><h3>${record.meaningClue}</h3><p>先选伙伴部件，再把它放进真实结构空位。</p>${renderStructure(record, state)}${renderCandidateCards(state)}<div class="ww-round-actions"><button type="button" data-action="wheel-hint" ${state.hintLevel >= 4 ? "disabled" : ""}>提示 ${state.hintLevel}/4</button>${state.phase === "place-card" ? `<button type="button" data-action="wheel-undo">放回伙伴牌</button>` : ""}</div></div>`;
}

function renderPlay(view: WheelWorkshopView): string {
  const { state } = view;
  if (state.phase === "finished") return `<div class="ww-finished" data-testid="wheel-session-finished"><div aria-hidden="true">✦ ✦ ✦</div><h3>三道字光都收好了</h3><p>可以回营地休息，也可以再转一局；离开不会失去已经发现的字。</p><button type="button" class="hm2-primary" data-action="wheel-new-session">再转三道字光</button></div>`;
  if (state.phase === "empty") return `<div class="ww-empty"><h3>这本字卷正在整理</h3><p>换一本也能继续玩，已经发现的字不会消失。</p><button type="button" data-action="wheel-open-grade-select">选择字卷</button></div>`;
  if (["choose-card", "place-card", "success"].includes(state.phase) && state.currentRound) return renderRound(state);
  return `<div class="ww-spin-stage" data-testid="wheel-spin" data-wheel-phase="${state.phase}">${renderWheel(state)}<p>${state.phase === "spinning" ? "字轮正在寻找一道适合的字光……" : "转一下，字轮会给出一个锚点部件和结构线索。"}</p><button type="button" class="hm2-primary ww-spin-button" data-action="wheel-spin" ${state.phase !== "ready" ? "disabled" : ""}>${state.phase === "spinning" ? "正在转动" : "转动字轮"}</button></div>`;
}

export function renderWheelWorkshop(view: WheelWorkshopView): string {
  const grade = getWheelGradeOption(view.state.selectedGradeId);
  const notice = view.saveNotice === "recovered" ? "损坏的工坊存档已安全恢复。" : view.saveNotice === "migrated" ? "字库更新后，已安全保留仍可用的发现。" : view.saveNotice === "future-read-only" ? "发现较新版本工坊存档：当前只读，不会覆盖。" : "";
  return `<section class="hm2-panel ww-workshop" role="dialog" aria-modal="true" aria-labelledby="ww-title" data-testid="wheel-workshop" data-wheel-phase="${view.state.phase}" data-wheel-grade="${view.state.selectedGradeId}" data-wheel-round-count="${view.state.completedRoundCount}" data-wheel-read-only="${String(view.readOnly)}"><div class="hm2-overlay-heading"><div><p class="hm2-kicker">第一章营地 · 魔法树旁</p><h2 id="ww-title">字轮工坊</h2></div><button type="button" data-action="close-overlay" aria-label="返回第一章营地">返回营地</button></div>${notice ? `<p class="ww-save-note" role="status">${notice}</p>` : ""}<div class="ww-scroll-name"><span>当前字卷</span><b>${grade.worldName}</b><button type="button" data-action="wheel-open-grade-select">选择字卷</button></div>${view.gradeSelectOpen ? renderGradeSelect(view) : renderPlay(view)}${!view.gradeSelectOpen ? `<p class="ww-message" role="status"><span aria-hidden="true">✦</span>${view.state.gentleMessage}</p>` : ""}<p class="ww-local-note">本机保存 · 无分数、排名、连胜或倒计时</p></section>`;
}
