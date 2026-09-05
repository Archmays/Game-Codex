import { M3_HEROES } from "../../../v2/chapter-one/builds";
import { m5AssetUrl } from "../../../v2/chapter-one/m5-assets";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../content-graph/families";
import { getPilotProgress, type ChapterTwoState } from "./engine";
import { PILOT_SIX_DEFINITIONS, getPilotSixDefinition, pilotEncounterKey, pilotReachable, samePilotEdge, type PilotSixDefinition, type PilotEdge } from "./pilot-six";

const glyph = (id: string) => COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === id)!;
const escape = (text: string) => text.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
export const pilotAssetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/hanzi-radical-battle/pilot-six/r1/${name}.webp`;
export const isPilotSurface = (state: ChapterTwoState) => Boolean(getPilotSixDefinition(state) && ["chapter-intro", "build", "pilot-meaning", "family-connect", "family-result"].includes(state.phase));

interface Point { x: number; y: number }
function pointStyle(point: Point): string { return `left:calc(50% + ${point.x - 500}px * var(--pilot-scale));top:calc(50% + ${point.y - 310}px * var(--pilot-scale))`; }
function nodePoint(definition: PilotSixDefinition, id: string): Point {
  if (id === definition.startId) return { x: 260, y: 335 };
  if (id === definition.endId) return { x: 740, y: 335 };
  return { x: 500, y: id === definition.decoyId && definition.nodeIds.length > 2 ? 445 : 185 };
}
function art(name: string, point: Point, width: number, className = ""): string {
  return `<img class="pilot-art ${className}" src="${pilotAssetUrl(name)}" alt="" draggable="false" style="left:${point.x}px;top:${point.y}px;width:${width}px" decoding="async">`;
}
function edgeArt(definition: PilotSixDefinition, edge: PilotEdge, expression: string | null): string {
  const a = nodePoint(definition, edge[0]); const b = nodePoint(definition, edge[1]);
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 32 };
  if (definition.object === "vine") {
    return ""; // The unfurled vine itself spans the endpoints after a valid connection.
  }
  if (definition.object === "waterwheel") return `<svg class="pilot-path-lines" viewBox="0 0 1000 620" aria-hidden="true"><path class="pilot-channel-bank" d="M ${a.x} ${a.y + 75} L ${b.x} ${b.y + 75}"/><path class="pilot-water-channel" d="M ${a.x} ${a.y + 75} L ${b.x} ${b.y + 75}"/></svg>`;
  const name = definition.scene === "canopy" ? "bridge" : "stone-path";
  return `<img class="pilot-art pilot-bridge" src="${pilotAssetUrl(name)}" alt="" draggable="false" style="left:${midpoint.x}px;top:${midpoint.y}px;width:${distance + 35}px;transform:translate(-50%,-50%) rotate(${angle}deg)" decoding="async">`;
}

function roadFootprints(definition: PilotSixDefinition, edges: readonly PilotEdge[]): string {
  const middle = definition.nodeIds[1];
  const directions: PilotEdge[] = [[definition.startId, definition.endId], [definition.startId, middle], [middle, definition.endId]];
  return `<svg class="pilot-path-lines" viewBox="0 0 1000 620" aria-hidden="true">${directions.map((edge) => {
    const a = nodePoint(definition, edge[0]), b = nodePoint(definition, edge[1]);
    const length = Math.hypot(b.x - a.x, b.y - a.y), count = Math.max(4, Math.round(length / 45));
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
    const connected = edges.some((existing) => samePilotEdge(existing, edge[0], edge[1]));
    return Array.from({ length: count }, (_, index) => {
      const t = (index + .5) / count;
      return `<path class="pilot-footprint" d="M-3 6C-5 0-4-8 0-10C5-10 6-4 3 0L3 7Q0 10-3 6Z" transform="translate(${a.x + (b.x - a.x) * t} ${a.y + (b.y - a.y) * t + 26 + (index % 2 ? 5 : -5)}) rotate(${angle})" opacity="${connected ? 1 : .48}"/>`;
    }).join("");
  }).join("")}</svg>`;
}

function sceneObject(state: ChapterTwoState, definition: PilotSixDefinition): string {
  const current = getPilotProgress(state); const active = current.magicApplied;
  if (definition.object === "ink-leaves") return art("ink-leaves", { x: active ? 810 : 500, y: active ? 430 : 330 }, active ? 175 : 450, active ? "pilot-ink-cleared" : "pilot-ink-cover") + (active ? `<svg class="pilot-path-lines" viewBox="0 0 1000 620" aria-hidden="true"><path class="pilot-revealed-root" d="M260 365 Q500 420 740 365"/><g class="pilot-hand-light" transform="translate(432 283) rotate(70 32 32)"><path d="M26 31V11q0-6 5-6t5 6v14l4-2q5-2 8 2l8 9q3 5 0 11L48 56H28L17 42q-4-5 0-8t9 3"/></g></svg>` : "");
  if (definition.object === "lamp") return `${art("bowl", { x: 340, y: 425 }, 115)}${art("lamp", { x: 380, y: 255 }, 160, active ? "pilot-lamp-lit" : "pilot-lamp-tired")}${active ? `<span class="pilot-lamp-light" style="left:380px;top:199px"></span>` : ""}`;
  if (definition.object === "vine") return ["quiet", "talk"].map((expression, index) => {
    const chosen = current.expression === expression;
    if (chosen && current.edges.length) return `<img class="pilot-art pilot-vine-spanning" src="${pilotAssetUrl("vine-open")}" alt="" style="left:500px;top:${index ? 410 : 304}px;width:540px;height:210px;transform:translate(-50%,-50%)${index ? "" : " scaleY(-1)"}">`;
    return art(chosen ? "vine-open" : "vine-coiled", { x: 500, y: index ? 420 : 250 }, chosen ? 350 : 185, chosen ? "pilot-vine-chosen" : "pilot-vine-waiting");
  }).join("");
  if (definition.object === "leaf-gate") return `<div class="pilot-leaf-door ${active ? "is-open" : ""}" style="left:770px;top:260px"><img class="pilot-door-left" src="${pilotAssetUrl("leaf-gate")}" alt=""><img class="pilot-door-right" src="${pilotAssetUrl("leaf-gate")}" alt=""></div>${!current.mistCleared ? art("ink-leaves", { x: 510, y: 405 }, 280, "pilot-root-mist") : ""}`;
  if (definition.object === "stone-path") return active ? roadFootprints(definition, current.edges) : "";
  const road = PILOT_SIX_DEFINITIONS[4]; const roadProgress = state.pilotProgress?.[pilotEncounterKey(road)];
  const wheelPoint = nodePoint(road, current.wheelNodeId);
  const parked = current.magicApplied;
  return `${(roadProgress?.edges ?? []).map((edge) => edgeArt(road, edge, null)).join("")}${art("waterwheel", { x: wheelPoint.x + (parked ? 80 : 0), y: wheelPoint.y - (parked ? 120 : 40) }, 150, "pilot-moving-wheel")}`;
}

function objectControls(state: ChapterTwoState, definition: PilotSixDefinition): string {
  if (state.phase !== "pilot-meaning") return "";
  if (definition.object === "vine") return `<div class="pilot-expression-options" aria-label="给故事伙伴表达心情"><button type="button" data-pilot-expression="quiet" style="${pointStyle({ x: 500, y: 215 })}"><span>想静静</span><small>把心灯送到上方藤弯</small></button><button type="button" data-pilot-expression="talk" style="${pointStyle({ x: 500, y: 465 })}"><span>想聊聊</span><small>把心灯送到下方藤弯</small></button></div>`;
  if (definition.object === "waterwheel") {
    const road = PILOT_SIX_DEFINITIONS[4]; const current = getPilotProgress(state); const edges = state.pilotProgress?.[pilotEncounterKey(road)]?.edges ?? [];
    return road.nodeIds.filter((id) => id !== current.wheelNodeId).map((id) => `<button type="button" class="pilot-waypoint ${edges.some((edge) => samePilotEdge(edge, current.wheelNodeId, id)) ? "is-available" : ""}" data-pilot-move="${id}" style="${pointStyle(nodePoint(road, id))}" aria-label="让小水轮前进到${glyph(id).glyph}字石"><b>${glyph(id).glyph}</b><small>${edges.some((edge) => samePilotEdge(edge, current.wheelNodeId, id)) ? "可到达" : "未相连"}</small></button>`).join("");
  }
  return `<button type="button" class="pilot-magic-target" data-action="pilot-magic" style="${pointStyle({ x: definition.object === "leaf-gate" ? 700 : 500, y: definition.object === "leaf-gate" ? 295 : 440 })}"><span aria-hidden="true">${glyph(definition.characterId).glyph}</span><b>${definition.magicLabel}</b></button>`;
}

function familyNodes(state: ChapterTwoState, definition: PilotSixDefinition): string {
  if (!["family-connect", "family-result"].includes(state.phase)) return "";
  const current = getPilotProgress(state); const reached = pilotReachable(definition.startId, current.edges);
  return [...definition.nodeIds, definition.decoyId].map((id) => {
    const selected = state.familySelectedCharacterIds.includes(id); const label = id === definition.startId ? "入口" : id === definition.endId ? "终点" : "字碑";
    return `<button type="button" class="pilot-family-node ${selected ? "is-selected" : ""} ${reached.has(id) ? "is-reachable" : ""}" data-family-character-id="${id}" aria-pressed="${String(selected)}" aria-label="${glyph(id).glyph}，${label}，${glyph(id).familiarWord}" style="${pointStyle(nodePoint(definition, id))}" ${state.phase === "family-result" ? "disabled" : ""}><small>${label}</small><b>${glyph(id).glyph}</b><span>${glyph(id).familiarWord}</span></button>`;
  }).join("");
}

function renderBuild(state: ChapterTwoState): string {
  const target = glyph(state.currentCharacterId!); const semi = target.structure === "semi-enclosure";
  const labels: Record<string, string> = { left: "左边", right: "右边", top: "上面", bottom: "下面", outer: semi ? "左下包围" : "外面", inner: semi ? "右上里面" : "里面" };
  return `<section class="pilot-build" data-testid="chapter-two-build" data-character-id="${target.id}" data-structure="${target.structure}"><div class="pilot-board pilot-board--${target.structure}" aria-label="${target.glyph}的结构槽位" role="group">${target.components.map((component) => {
    const placement = state.placements.find((candidate) => candidate.slotId === component.slotId); const card = state.hand.find((candidate) => candidate.id === placement?.cardId);
    return `<button type="button" class="pilot-slot ${card ? "is-filled" : ""}" data-slot-id="${component.slotId}" aria-label="${labels[component.slotId]}${card ? `，已有${card.glyph}` : "，空"}">${card ? `<b>${card.glyph}</b>` : `<span>${labels[component.slotId]}</span>`}</button>`;
  }).join("")}</div><div class="pilot-hand-area"><p>把“${target.familiarWord}”里的字合起来</p><div class="pilot-hand" aria-label="字灵手牌" role="group">${state.hand.map((card) => {
    const used = state.placements.some((placement) => placement.cardId === card.id); const selected = state.selectedCardId === card.id;
    return `<button type="button" draggable="${!used}" data-card-id="${card.id}" aria-pressed="${selected}" ${used ? "disabled" : ""}><span>${card.glyph}</span></button>`;
  }).join("")}</div><div class="pilot-build-tools"><button type="button" data-action="undo" ${state.placements.length ? "" : "disabled"}>收回一步</button><small>点字灵，再点它的位置</small></div>${getPilotSixDefinition(state)?.object === "stone-path" ? `<p class="pilot-variant-shadow" data-recovered="${state.placements.some((placement) => placement.slotId === "left")}"><span>足</span><span aria-hidden="true">→</span><span>⻊</span><small>足字旁在左边会变形</small></p>` : ""}</div></section>`;
}

function renderDock(state: ChapterTwoState, definition: PilotSixDefinition): string {
  if (state.phase === "chapter-intro") return `<div class="pilot-intro"><p>树冠上的根线断开了。先合字，再用字光找路。</p><button type="button" class="pilot-primary" data-action="start" data-primary-focus>走上木语树冠</button></div>`;
  if (state.phase === "build") return renderBuild(state);
  const target = glyph(definition.characterId); const sense = COMPLETE_CORE_READING_SENSES.find((entry) => entry.id === target.readingSenseIds[0])!;
  if (state.phase === "pilot-meaning") return `<section class="pilot-meaning" data-testid="chapter-two-meaning"><div class="pilot-meaning-word"><b>${target.glyph}</b><span><strong>${sense.pinyin}</strong><em>${sense.fixedPhrase}</em></span></div><div><p>${target.shortMeaning}</p><p>${definition.object === "lamp" ? "伙伴吃饱了，放下碗。把饱足暖光送给灯苗吧。" : definition.object === "vine" ? "伙伴想表达现在的心情。两种表达都可以。" : target.magicEffect}</p><button type="button" data-action="speak-character">听“${sense.fixedPhrase}”</button></div></section>`;
  const family = COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === definition.familyId)!;
  return `<section class="pilot-family-dock" data-testid="chapter-two-${state.phase}" data-family-id="${definition.familyId}"><div><h2>${state.phase === "family-result" ? "通路接通了" : family.name}</h2><p>${family.childFacingExplanation}</p><details><summary>看看部件线索</summary>${[...definition.nodeIds, definition.decoyId].map((id) => {
    const relation = COMPLETE_COMPONENT_RELATIONS.find((entry) => entry.characterId === id && (id === definition.decoyId || entry.familyId === definition.familyId))!;
    return `<p><b>${glyph(id).glyph}</b> ${relation.childFacingClaim}</p>`;
  }).join("")}<small>这里连接部件；每个字的意思仍看自己的词语。</small></details></div><button type="button" class="pilot-primary" data-action="${state.phase === "family-result" ? "continue" : "connect-family"}" data-primary-focus>${state.phase === "family-result" ? "沿通路继续" : "接好这两个字碑"}</button></section>`;
}

export function renderPilotSix(state: ChapterTwoState): string {
  const definition = getPilotSixDefinition(state)!; const current = getPilotProgress(state); const hero = M3_HEROES.find((candidate) => candidate.id === state.heroId)!;
  const intro = state.phase === "chapter-intro";
  const step = PILOT_SIX_DEFINITIONS.indexOf(definition) + 1;
  const phaseGoal = intro ? "一起把树冠上的通路找回来" : state.phase === "build" ? `合好“${glyph(definition.characterId).glyph}”，${definition.goal}` : state.phase === "family-result" ? "通路已经接好，随时可以继续" : state.phase === "family-connect" ? "连接同一字脉，让入口通到终点" : definition.goal;
  return `<div class="pilot-adventure"><div class="pilot-goal"><span>${String(step).padStart(2, "0")} · ${definition.scene === "canopy" ? "木语树冠" : "清泉石谷"}</span><h2>${phaseGoal}</h2></div><section class="pilot-stage" aria-label="${definition.scene === "canopy" ? "木语树冠" : "清泉石谷"}可操作场景" data-testid="pilot-stage"><div class="pilot-world-plane" aria-hidden="true"><img class="pilot-environment" src="${pilotAssetUrl(`${definition.scene}-environment`)}" alt="" decoding="async">${current.edges.map((edge) => edgeArt(definition, edge, current.expression)).join("")}${sceneObject(state, definition)}</div>${!intro ? objectControls(state, definition) + familyNodes(state, definition) : ""}<div class="pilot-companion"><img src="${m5AssetUrl(hero.iconKey)}" alt=""><span>${hero.name}</span></div>${definition.object === "leaf-gate" ? `<div class="pilot-keeper"><img src="${m5AssetUrl("boss-lantern-root")}" alt="树冠守护者"><small>树冠守护者</small></div>${!current.mistCleared && ["pilot-meaning", "family-connect"].includes(state.phase) ? `<button type="button" class="pilot-observe" data-action="pilot-observe">用已学的指光看清根线</button>` : ""}` : ""}</section><div class="pilot-dock">${renderDock(state, definition)}</div>${!intro ? `<p class="pilot-feedback" role="status">${escape(state.gentleMessage)}</p>` : ""}</div>`;
}

/** Images and semantic controls share the same centred, uniformly scaled camera. */
export function fitPilotScene(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>(".pilot-stage"); if (!stage) return;
  const size = stage.getBoundingClientRect();
  stage.style.setProperty("--pilot-scale", String(Math.max(size.width / 1000, size.height / 620)));
}

/** Reusing decoded image nodes avoids blank frames when the operation dock rerenders. */
export function retainPilotImages(previous: readonly HTMLImageElement[], root: HTMLElement): void {
  const available = new Map<string, HTMLImageElement[]>();
  for (const image of previous) available.set(image.src, [...(available.get(image.src) ?? []), image]);
  for (const image of root.querySelectorAll<HTMLImageElement>(".pilot-stage img")) {
    const cached = available.get(image.src)?.shift(); if (!cached) { image.decoding = "sync"; continue; }
    for (const attribute of [...cached.attributes]) if (attribute.name !== "src") cached.removeAttribute(attribute.name);
    for (const attribute of [...image.attributes]) if (attribute.name !== "src") cached.setAttribute(attribute.name, attribute.value);
    image.replaceWith(cached);
  }
}
