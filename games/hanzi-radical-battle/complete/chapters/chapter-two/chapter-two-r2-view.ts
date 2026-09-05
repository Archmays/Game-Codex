import { m5AssetUrl } from "../../../v2/chapter-one/m5-assets";
import { CHAPTER_TWO_EPISODES } from "./contracts";
import { allR2RootsConnected, getPilotProgress, getR2Progress, type ChapterTwoState } from "./engine";
import { CHAPTER_TWO_R2_DEFINITIONS, type R2Definition } from "./chapter-two-r2";
import { PILOT_SIX_DEFINITIONS, pilotEncounterKey, pilotReachable, type PilotEdge } from "./pilot-six";

export interface R2Point { readonly x: number; readonly y: number }
export const r2AssetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/hanzi-radical-battle/chapter-two/r2/${name}.webp`;
const priorAssetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/hanzi-radical-battle/pilot-six/r1/${name}.webp`;
const art = (name: string, x: number, y: number, width: number, className = "", prior = false) => `<img class="pilot-art ${className}" src="${prior ? priorAssetUrl(name) : r2AssetUrl(name)}" alt="" draggable="false" style="left:${x}px;top:${y}px;width:${width}px" decoding="async">`;
const svg = (body: string, className = "") => `<svg class="pilot-path-lines r2-lines ${className}" viewBox="0 0 1000 620" aria-hidden="true">${body}</svg>`;

export function r2NodePoint(definition: R2Definition, id: string): R2Point {
  if (id === definition.startId) return { x: 280, y: 335 };
  if (id === definition.endId) return { x: 720, y: 335 };
  if (id === definition.decoyId) return { x: 500, y: definition.nodeIds.length > 2 ? 495 : 185 };
  const middle = definition.nodeIds.filter(node => node !== definition.startId && node !== definition.endId).indexOf(id);
  return [{ x: 500, y: 165 }, { x: 280, y: 175 }, { x: 720, y: 175 }, { x: 280, y: 495 }, { x: 720, y: 495 }][middle];
}

export function renderR2Edge(state: ChapterTwoState, definition: R2Definition, edge: PilotEdge): string {
  const a = r2NodePoint(definition, edge[0]), b = r2NodePoint(definition, edge[1]);
  const choice = getR2Progress(state).choice;
  const direct = edge.includes(definition.startId) && edge.includes(definition.endId);
  const curve = definition.object === "star-path" && direct ? (choice === "upper-bend" ? 125 : 565) : (a.y + b.y) / 2 + 35;
  const path = `M${a.x} ${a.y + 28} Q${(a.x + b.x) / 2} ${curve} ${b.x} ${b.y + 28}`;
  // Qualified modern-visual relations stay visibly dashed, never promoted to a sound claim.
  const qualified = definition.familyId === "family-door" || edge.includes("char-u9759");
  return svg(`<path class="r2-edge-bed r2-edge-bed--${definition.object}" d="${path}"/><path class="r2-edge ${qualified ? "r2-edge--qualified" : ""}" d="${path}"/>`);
}

function starPaths(state: ChapterTwoState): string {
  const choice = getR2Progress(state).choice;
  return svg(["upper-bend", "lower-bend"].map((bend, index) => {
    const y = index ? 520 : 140, chosen = choice === bend;
    return `<path class="r2-safe-path ${chosen ? "is-lit" : ""}" d="M265 335 Q500 ${y} 735 335"/>${Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10, x = 265 + 470 * t, sy = (1 - t) ** 2 * 335 + 2 * (1 - t) * t * y + t ** 2 * 335;
      return chosen ? `<path class="r2-star" d="M${x} ${sy - 8}l3 5 6 3-6 3-3 5-3-5-6-3 6-3Z"/>` : "";
    }).join("")}`;
  }).join("") + `<g class="r2-exit"><path d="M716 297h42v64h-42Z"/><path d="M726 330h22m-8-8 8 8-8 8"/><text x="737" y="390">出口</text></g>`);
}

function thoughtLeaves(state: ChapterTwoState): string {
  const choice = getR2Progress(state).choice;
  const clues = ["水流", "水沟", "水轮", "踏石", "脚印", "出口"];
  const scattered = [[335, 220, -23], [475, 265, 14], [625, 210, -12], [345, 400, 19], [505, 365, -16], [645, 400, 24]];
  return clues.map((clue, index) => {
    const chosen = choice === "water-clue" ? index < 3 : choice === "stone-clue" ? index >= 3 : false;
    const position = chosen ? [[330, choice === "water-clue" ? 355 : 255, -8], [500, choice === "water-clue" ? 240 : 385, 0], [670, choice === "water-clue" ? 355 : 255, 8]][index % 3] : scattered[index];
    const [x, y, angle] = position;
    return `<div class="r2-clue-leaf ${choice && !chosen ? "is-resting" : ""} ${chosen ? "is-arranged" : ""}" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${angle}deg)"><img src="${r2AssetUrl("clue-leaf")}" alt=""><span>${clue}</span></div>`;
  }).join("");
}

function voiceBridge(state: ChapterTwoState): string {
  const targets = getR2Progress(state).targets;
  return art("voice-terminal", 365, 300, 170) + art("voice-terminal", 635, 300, 170) + svg(["voice-left", "voice-right"].map((side, index) => {
    const active = targets.includes(side as "voice-left" | "voice-right");
    const start = index ? 635 : 365, end = 500;
    return active ? `<path class="r2-sound-wave" d="M${start} 270 Q${index ? 585 : 415} 220 ${end} 270"/><path class="r2-sound-wave r2-sound-wave--inner" d="M${start} 290 Q${index ? 585 : 415} 245 ${end} 290"/>`
      : `<path class="r2-echo-knot" d="M${start - 15} 230c-45-25 60-65 30-5s-65-5-10-30"/>`;
  }).join(""));
}

function riceLamps(state: ChapterTwoState): string {
  const targets = getR2Progress(state).targets;
  return art("rice-bowl", 500, 370, 180) + ["lamps-left", "lamps-right"].map((side, index) => {
    const active = targets.includes(side as "lamps-left" | "lamps-right"), x = index ? 650 : 350;
    return [-35, 35].map(offset => art("lamp", x + offset, 275 + (offset > 0 ? 20 : 0), 110, active ? "pilot-lamp-lit" : "pilot-lamp-tired", true)).join("")
      + (active ? svg(`<path class="r2-warm-mist" d="M500 325Q${x} 390 ${x} 230"/><path class="r2-lamp-lane" d="M${x - 65} 400h130"/>`) : "");
  }).join("");
}

function clockDoors(state: ChapterTwoState): string {
  const active = getPilotProgress(state).magicApplied;
  const doors = [335, 665].map(x => (active ? "" : art("shadow-door", x + 38, 305, 180, "r2-door-shadow")) + art("shadow-door", x, 295, 180, active ? "r2-door-stable" : "r2-door-unsettled")).join("");
  const ticks = Array.from({ length: 12 }, (_, i) => { const angle = i * Math.PI / 6; return `<path d="M${500 + Math.sin(angle) * 43} ${253 - Math.cos(angle) * 43}l${Math.sin(angle) * 6} ${-Math.cos(angle) * 6}"/>`; }).join("");
  return doors + art("clock-case", 500, 250, 280) + svg(`<g class="r2-clock-dial">${ticks}<path d="M500 225v28l23 15"/><circle cx="500" cy="253" r="4"/></g>${active ? `<ellipse class="r2-clock-wave" cx="500" cy="270" rx="100" ry="45"/><ellipse class="r2-clock-wave" cx="500" cy="270" rx="225" ry="85"/>` : ""}`);
}

function metalLock(state: ChapterTwoState): string {
  const targets = getR2Progress(state).targets;
  const connected = ["family-result", "episode-repair"].includes(state.phase);
  return art("lock-body", 500, 285, 345) + svg(`<circle class="r2-lock-socket" cx="439" cy="284" r="17"/><circle class="r2-lock-socket" cx="561" cy="284" r="17"/><path class="r2-lock-bolt ${connected ? "is-connected" : ""}" d="M${connected ? 520 : 480} 364h${connected ? 125 : 50}"/>`)
    + ["tooth-left", "tooth-right"].map((side, index) => {
      const filled = targets.includes(side as "tooth-left" | "tooth-right");
      return art("metal-shard", filled ? (index ? 561 : 439) : (index ? 655 : 345), filled ? 284 : 410, filled ? 64 : 95, filled ? "r2-tooth-fitted" : "r2-tooth-waiting");
    }).join("");
}

function rootConnections(state: ChapterTwoState): string {
  return svg(CHAPTER_TWO_R2_DEFINITIONS.filter(definition => definition.rootSource !== undefined).map(definition => {
    const connected = state.r2Progress?.[pilotEncounterKey(definition)]?.rootConnected;
    const x = [250, 500, 750][definition.rootSource!];
    return `<path class="r2-region-root ${connected ? "is-connected" : ""}" d="M${x} 520Q${x} 425 500 275"/><circle class="r2-root-socket ${connected ? "is-connected" : ""}" cx="${x}" cy="520" r="12"/>`;
  }).join(""));
}

function coreObjects(state: ChapterTwoState, definition: R2Definition): string {
  const active = getPilotProgress(state).magicApplied, choice = getR2Progress(state).choice;
  const complete = allR2RootsConnected(state);
  let object = "";
  if (!["core-intro", "episode-repair", "ending", "chapter-summary"].includes(state.phase)) {
    if (definition.object === "root-vine") object = art(active ? "vine-open" : "vine-coiled", 500, choice === "talk" ? 410 : 365, active ? 345 : 190, "r2-core-vine", true);
    else if (definition.object === "root-road") {
      const road = PILOT_SIX_DEFINITIONS[4], edges = state.pilotProgress?.[pilotEncounterKey(road)]?.edges ?? [];
      const points: Record<string, R2Point> = { [road.startId]: {x:340,y:425}, [road.nodeIds[1]]: {x:500,y:370}, [road.endId]: {x:660,y:425} };
      object = svg(edges.map(([a,b]) => `<path class="r2-core-stone-road" d="M${points[a].x} ${points[a].y}L${points[b].x} ${points[b].y}"/>`).join("") + `<circle class="r2-travel-light" cx="${active ? 660 : 340}" cy="425" r="17"/>`);
    } else object = active ? svg(`<path class="r2-guide-light" d="M345 400Q500 315 655 400"/><path class="pilot-hand-light" transform="translate(425 355) rotate(70 32 32)" d="M26 31V11q0-6 5-6t5 6v14l4-2q5-2 8 2l8 9q3 5 0 11L48 56H28L17 42q-4-5 0-8t9 3"/>`) : art("ink-leaves", 500, 395, 280, "pilot-root-mist", true);
  }
  return rootConnections(state) + art("root-heart", 500, 224, 260, complete ? "r2-heart-restored" : "r2-heart-waiting") + object;
}

export function renderR2SceneObjects(state: ChapterTwoState, definition: R2Definition): string {
  if (definition.scene === "core") return coreObjects(state, definition);
  if (definition.scene === "valley" && ["episode-repair", "episode-complete"].includes(state.phase)) return art("waterwheel", 500, 310, 330, "r2-restored-wheel", true) + svg('<path class="r2-water-feed" d="M260 400Q490 230 740 405"/>');
  if (definition.object === "star-path") return starPaths(state);
  if (definition.object === "thought-leaves") return thoughtLeaves(state);
  if (definition.object === "voice-bridge") return voiceBridge(state);
  if (definition.object === "rice-lamps") return riceLamps(state);
  if (definition.object === "clock-doors") return clockDoors(state);
  if (definition.scene === "corridor" && state.phase === "episode-repair") return art("shadow-door", 340, 300, 170, "r2-corridor-open-left") + art("shadow-door", 660, 300, 170, "r2-corridor-open-right") + metalLock(state) + svg('<path class="r2-guide-light" d="M500 560V395"/>');
  return metalLock(state);
}

export function renderR2Controls(state: ChapterTwoState, definition: R2Definition, style: (point: R2Point) => string): string {
  const current = getR2Progress(state), pilot = getPilotProgress(state);
  const observation = definition.object === "thought-leaves" && ["build", "pilot-meaning"].includes(state.phase) ? '<p class="r2-observation">水沟连着水轮；<br>脚印沿踏石通向出口。</p>' : "";
  if (definition.rootSource !== undefined && state.phase === "family-connect" && pilotReachable(definition.startId, pilot.edges).has(definition.endId)) return `<button class="r2-root-connect pilot-magic-target" type="button" data-action="r2-root" style="${style({x:500,y:350})}"><b>把${["树冠", "清泉", "门廊"][definition.rootSource]}根线接入树心</b></button>`;
  if (state.phase !== "pilot-meaning") return observation;
  return observation + definition.targets.map((target, index) => {
    const done = current.targets.includes(target.id);
    const vertical = definition.object === "star-path" || definition.object === "root-vine";
    const point = definition.targets.length === 1 ? {x:500,y:460} : vertical ? {x:500,y:index ? 480 : 160} : {x:index ? 630 : 370,y:485};
    return `<button type="button" class="r2-object-target ${done ? "is-done" : ""}" data-r2-target="${target.id}" aria-pressed="${done}" style="${style(point)}" ${done ? "disabled" : ""}><b>${target.label}</b>${done ? "<small>✓ 已送到</small>" : ""}</button>`;
  }).join("");
}

export function renderR2Status(state: ChapterTwoState, definition: R2Definition): string {
  if (definition.scene === "core") return `<ul class="r2-object-status r2-root-status" aria-label="三个区域的树心连接">${CHAPTER_TWO_R2_DEFINITIONS.filter(definition => definition.rootSource !== undefined).map(definition => `<li>${["树冠", "清泉", "门廊"][definition.rootSource!]}根线 · ${state.r2Progress?.[pilotEncounterKey(definition)]?.rootConnected ? "✓ 已接入" : "○ 待接入"}</li>`).join("")}</ul>`;
  const progress = getR2Progress(state);
  if (["rice-lamps", "voice-bridge", "metal-lock"].includes(definition.object)) {
    const names = definition.object === "rice-lamps" ? ["左灯组", "右灯组"] : definition.object === "voice-bridge" ? ["左端声纹", "右端声纹"] : ["左齿口", "右齿口"];
    return `<ul class="r2-object-status" aria-label="场景对象状态">${definition.targets.map((target, i) => `<li>${names[i]} · ${progress.targets.includes(target.id) ? "✓ 已恢复" : "○ 待恢复"}</li>`).join("")}</ul>`;
  }
  return "";
}

export function r2EnvironmentUrl(definition: R2Definition): string {
  return definition.scene === "core" ? m5AssetUrl("region-ink-king-core") : definition.scene === "corridor" ? r2AssetUrl("corridor-environment") : priorAssetUrl("valley-environment");
}

export function renderR2Transition(state: ChapterTwoState, definition: R2Definition): string | undefined {
  if (state.phase === "core-intro") return `<div class="pilot-intro" data-testid="chapter-two-core-intro"><p>三片区域已恢复。用见过的情、进、指，把三条根线逐条接入树心。</p><button type="button" class="pilot-primary" data-action="start-core" data-primary-focus>走进字脉树心</button></div>`;
  if (state.phase === "episode-repair" || state.phase === "episode-complete") return `<div class="pilot-intro" data-testid="chapter-two-repair"><p>${definition.scene === "valley" ? "水轮已经完整围合，清泉沿水沟流向高处。" : definition.scene === "corridor" ? "两端声纹、小灯、门影和锁齿都恢复了，长廊通向树心。" : "三条区域根线都已入心，字脉树心重新把光送回森林。"}</p><button type="button" class="pilot-primary" data-action="continue" data-primary-focus>${state.phase === "episode-complete" ? "去下一片区域" : definition.scene === "valley" ? "沿清泉继续" : definition.scene === "corridor" ? "前往字脉树心" : "让字光回到森林"}</button></div>`;
  if (state.phase === "ending") return `<div class="pilot-intro" data-testid="chapter-two-ending"><p>每条根线都留在这里了。家灯小镇传来回应。</p><button type="button" class="pilot-primary" data-action="finish-ending" data-primary-focus>点亮家灯小镇的路</button></div>`;
  if (state.phase === "chapter-summary") return `<div class="pilot-intro" data-testid="chapter-two-summary"><p>家灯小镇的灯已经回应。第二章的修复会留在森林里。</p><a class="pilot-primary" href="?play=hanzi-magic-complete&from=hub&chapter=three">走向家灯小镇</a><a href="?play=hanzi-magic-complete&from=hub">回到墨迹森林</a></div>`;
  return undefined;
}
