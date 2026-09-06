import { LANDINGS, PARK_EDGES, OBJECT_IDS, PILOT_SENTENCES, pilotWords, pilotCurrentSentence, pilotDraftSentence, type PilotTaskId, type PilotRecord, type ParkMove, type PilotState } from "./model";
import "./styles.css";

const escape = (value: string) => value.replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const GLOSSES: Record<string, string> = { run: "跑", jump: "跳", red: "红色", blue: "蓝色", one: "一个", two: "两个" };
const GOALS: Record<PilotTaskId, string> = {
  "word-run": "选 run 和相邻的落点，让故事角色沿连续道路跑过去。",
  "word-jump": "选 jump 和相邻的落点，让故事角色跳过去；也可试试 run。",
  "word-red": "选一枚贝壳，用 red 改变它的颜色。也可试试 blue。",
  "word-blue": "选一艘船，用 blue 改变船身颜色。也可试试 red。",
  "word-one": "选 one，再选你想点亮的一枚贝壳。也可试试 two。",
  "word-two": "选 two，再选你想让它们启航的两艘船。也可试试 one。",
};
function shell(): string {
  return `<svg viewBox="0 0 100 80" aria-hidden="true"><path d="M50 72C34 75 7 70 6 57C2 42 15 9 29 9C35 2 44 3 50 8C57 2 67 3 73 10C88 9 99 42 94 57C94 70 68 76 50 72Z" fill="var(--object-color)" stroke="#503f32" stroke-width="3"/><path d="M50 70L22 19M50 70L38 13M50 70V13M50 70L64 13M50 70L80 20" fill="none" stroke="#503f32" stroke-width="2" opacity=".6"/></svg>`;
}
function boat(): string {
  return `<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M60 8V70" stroke="#3c464c" stroke-width="4"/><path d="M55 14L17 62H55Z" fill="#fff7df" stroke="#3c464c" stroke-width="2"/><path d="M66 25L96 61H66Z" fill="#fffdf7" stroke="#3c464c" stroke-width="2"/><path d="M8 71H112L99 88Q61 103 24 88Z" fill="var(--object-color)" stroke="#3c464c" stroke-width="3"/></svg>`;
}
function parkScene(state: Extract<PilotState, { kind: "park" }>, chinese: boolean): string {
  const current = LANDINGS.find(spot => spot.id === state.position)!;
  return `<div class="pilot-scene pilot-scene--park" data-testid="pilot-scene" data-position="${state.position}">
    <img class="pilot-environment" src="./assets/english-world/pilot-six/action-park.webp" alt="" width="1200" height="800" />
    <svg class="pilot-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${PARK_EDGES.map(edge => {
      const a = LANDINGS.find(spot => spot.id === edge.from)!, b = LANDINGS.find(spot => spot.id === edge.to)!;
      const near = { x: a.x + (b.x - a.x) * .42, y: a.y + (b.y - a.y) * .42 };
      const far = { x: a.x + (b.x - a.x) * .58, y: a.y + (b.y - a.y) * .58 };
      const path = edge.kind === "road" ? `M${a.x},${a.y}L${b.x},${b.y}` : `M${a.x},${a.y}L${near.x},${near.y}M${far.x},${far.y}L${b.x},${b.y}`;
      return `<path data-edge="${edge.from}-${edge.to}" data-kind="${edge.kind}" d="${path}"/>`;
    }).join("")}</svg>
    <div class="pilot-scene-legend"><span>━ ${chinese ? "连续路" : "Path"}</span><span>┄ ${chinese ? "小跨步" : "Small gap"}</span></div>
    ${LANDINGS.map(spot => `<button type="button" class="pilot-landing" data-pilot-object="${spot.id}" style="left:${spot.x}%;top:${spot.y}%" aria-pressed="${state.destination === spot.id}" aria-label="${spot.id}${chinese ? ` ${spot.label}` : " landing"}${state.position === spot.id ? chinese ? "，角色在这里" : ", here now" : ""}"><span>${spot.id}${state.destination === spot.id ? " ✓" : ""}</span></button>`).join("")}
    <div class="pilot-actor" style="left:${current.x}%;top:${current.y}%" data-pose="idle" aria-hidden="true"><div class="pilot-actor__sprite"></div></div>
    <p class="pilot-location">${chinese ? "角色在" : "Here:"} ${state.position}</p>
  </div>`;
}
function pierScene(id: PilotTaskId, state: Exclude<PilotState, { kind: "park" }>, chinese: boolean): string {
  const shells = id === "word-red" || id === "word-one";
  return `<div class="pilot-scene pilot-scene--pier ${shells ? "has-shells" : "has-boats"}" data-testid="pilot-scene">
    <img class="pilot-environment" src="./assets/english-world/pilot-six/color-number-pier.webp" alt="" width="1200" height="800" />
    ${OBJECT_IDS.map((objectId, index) => {
      const selected = state.kind === "color" ? state.selected === objectId : state.selected.includes(objectId);
      const active = state.kind === "number" && state.active.includes(objectId);
      const color = state.kind === "color" ? state.colors[objectId] : shells ? "shell" : ["red", "blue", "teal"][index];
      const status = state.kind === "color" ? color : active ? shells ? "shining" : "sailing" : shells ? "dark" : "docked";
      const statusZh: Record<string, string> = { red: "红色", blue: "蓝色", shining: "发光", sailing: "航行", dark: "未发光", docked: "停泊" };
      return `<button type="button" class="pilot-object pilot-object--${shells ? "shell" : "boat"}" data-pilot-object="${objectId}" data-active="${active}" data-color="${color}" data-status="${status}" style="--object-x:${18 + index * 32}%" aria-pressed="${selected}" aria-label="${shells ? "shell" : "boat"} ${objectId}, ${status}${chinese ? `，${statusZh[status]}` : ""}">
        <span class="pilot-object__art">${shells ? shell() : boat()}${active && shells ? '<span class="pilot-shine" aria-hidden="true">✦</span>' : ""}</span>
        <span class="pilot-object__label">${objectId}${selected ? " ✓" : ""} <small>${chinese ? statusZh[status] : status}</small></span>
      </button>`;
    }).join("")}
  </div>`;
}
export interface PilotViewOptions {
  readonly id: PilotTaskId;
  readonly record: PilotRecord;
  readonly chinese: boolean;
  readonly notice: string;
  readonly announcement: string;
  readonly helpLevel: number;
  readonly spellingOpen: boolean;
  readonly spellingMarkup: string;
  readonly audioAvailable: boolean;
}
export function pilotMarkup(options: PilotViewOptions): string {
  const { id, record, chinese } = options, state = record.state;
  const park = state.kind === "park", current = pilotCurrentSentence(id, state), draft = pilotDraftSentence(id, state);
  const selected = state.kind === "park" ? state.destination : state.kind === "color" ? state.selected : state.selected.join(", ");
  const scope = state.kind === "color" && state.referent ? ` ${state.referent}` : "";
  const help = pilotHelp(id, state, options.helpLevel, chinese);
  return `<main class="wordlight wordlight-pilot" data-testid="english-mission" data-word-id="${id}" data-phase="interactive" data-interaction-complete="${record.interactionCompleted}">
    <header class="pilot-header"><button type="button" data-action="region" aria-label="${chinese ? "回到这个地方" : "Back to region"}">←</button><h1 lang="en-US">${park ? "Action Park" : "Color & Number Pier"}</h1><nav aria-label="${chinese ? "场景导航" : "Scene navigation"}"><button type="button" data-action="journal">${chinese ? "词光册" : "Words"}</button><button type="button" data-action="settings">${chinese ? "设置" : "Settings"}</button></nav></header>
    ${options.notice}<section class="pilot-workshop"><header class="pilot-goal"><span>${chinese ? "试着让这句话发生" : "Make this happen"}</span><h2 lang="en-US">${PILOT_SENTENCES[id]}</h2>${park ? `<p class="pilot-ability">${chinese ? "I 指故事角色，can 表示“会”。选好后让角色示范。" : "Our story character says: I can. This shows an ability."}</p>` : ""}${chinese ? `<p>${GOALS[id]}</p>` : `<p>Choose a word and ${park ? "a neighboring landing" : id === "word-red" || id === "word-blue" ? "an object" : "objects"}. Then try it.</p>`}</header>
    <div class="pilot-workspace">${park ? parkScene(state, chinese) : pierScene(id, state, chinese)}
    <section class="pilot-controls" aria-label="${chinese ? "词语操作台" : "Word controls"}">
      <div class="pilot-word-cards" role="group" aria-label="${chinese ? "选择词卡" : "Choose a word"}">${pilotWords(id).map(word => `<button type="button" data-pilot-word="${word}" aria-pressed="${state.word === word}" lang="en-US"><strong>${word}</strong>${chinese ? `<span lang="zh-CN">${GLOSSES[word]}</span>` : ""}<span class="pilot-selected-mark" aria-hidden="true">${state.word === word ? "✓" : ""}</span></button>`).join("")}</div>
      <div class="pilot-draft"><span>${chinese ? "准备试一试 · 尚未执行" : "Ready to try · not applied"}</span><p lang="en-US">${draft ?? (chinese ? "先选一张词卡" : "Choose a word")}</p><small>${chinese ? "选中" : "Selected"}: ${selected || "—"}</small></div>
      <button type="button" class="pilot-execute" data-pilot-action="execute">${park ? chinese ? "试着移动" : "Try the move" : chinese ? "用到场景里" : "Apply to the scene"}</button>
      <div class="pilot-secondary"><button type="button" data-pilot-action="cancel">${chinese ? "撤回选择" : "Clear choice"}</button><button type="button" data-pilot-action="reset">${chinese ? "场景重来" : "Reset scene"}</button></div>
      <div class="pilot-current" data-testid="pilot-current"><span>${park ? chinese ? "角色刚才展示" : "Our character showed" : chinese ? `现在的场景${scope}` : `In the scene now${scope}`}</span><p lang="en-US">${current ?? (chinese ? "等你来试一试" : "Try your idea")}</p>${options.audioAvailable && current ? `<button type="button" data-speak="${escape(current)}">${chinese ? "听这句话" : "Hear the sentence"}</button>` : ""}</div>
    </section></div>
    <p class="pilot-feedback" role="status"><span lang="en-US">${escape(options.announcement)}</span>${chinese && messageZh(options.announcement) ? `<span lang="zh-CN">${messageZh(options.announcement)}</span>` : ""}</p>
    ${record.interactionCompleted ? `<p class="pilot-history">✓ ${chinese ? "已试过目标句。你可以继续改变场景。" : "You have tried the target sentence. Keep exploring."}</p>` : ""}
    <div class="pilot-help-actions"><button type="button" data-pilot-action="help">${chinese ? "给一点提示" : "A little help"}</button><button type="button" data-pilot-action="spelling" aria-expanded="${options.spellingOpen}">${chinese ? "拼一拼（可选）" : "Build the word (optional)"}</button><button type="button" data-action="region">${chinese ? "回到这个地方" : "Back to region"}</button></div>
    ${options.helpLevel ? `<aside class="pilot-help">${help}</aside>` : ""}
    ${options.spellingOpen ? `<section class="pilot-spelling" aria-label="${chinese ? "可选拼词帮助" : "Optional spelling help"}">${options.spellingMarkup}<button type="button" data-pilot-action="spelling-reset">${chinese ? "自己重新拼" : "Start a fresh build"}</button></section>` : ""}
    </section><div data-settings-layer></div></main>`;
}
function pilotHelp(id: PilotTaskId, state: PilotState, level: number, chinese: boolean): string {
  if (state.kind === "park") {
    if (level === 1) return chinese ? "看看脚下的路：实线是连续道路，断开的短线是小跨步。词卡不会替你选择落点。" : "Look at the path: solid paths are continuous; short dashed connections have a small gap.";
    if (level === 2) return chinese ? "run 沿连续路跑。jump 用脚蹬地跳起，落在相邻的安全落点。I can 表示“我会”，由故事角色示范。" : 'run moves along a continuous path. jump pushes off the ground to a safe neighboring landing. “I can” tells what our fictional character is able to do.';
    const adjacent = PARK_EDGES.filter(item => item.from === state.position || item.to === state.position);
    const road = adjacent.find(item => item.kind === "road");
    const edge = id === "word-run" && road ? road : adjacent[0];
    const destination = edge.from === state.position ? edge.to : edge.from;
    if (id === "word-run" && !road) return chinese ? `这里两边都是小跨步。先选 jump 跳到 ${destination}，再沿连续路试 run。` : `Both connections here have a small gap. Choose jump to ${destination}, then try run along a continuous path.`;
    return chinese ? `试试选择 ${id.slice(5)}，再选 ${destination}，最后点“试着移动”。这只是一步建议，其他合法路线也可以。` : `Try ${id.slice(5)}, choose ${destination}, then try the move. Other connected routes also work.`;
  }
  if (level === 1) return chinese ? "先看看每个对象的字母标记。点对象只是在选择，再点一次可改选；执行才改变场景。" : "Look at the letter on each object. Choose a word and objects, then apply your choice.";
  if (state.kind === "color") return level === 2
    ? chinese ? "red 是红色，blue 是蓝色；颜色只属于你选中的那枚贝壳或那艘船。" : "red and blue change only the selected shell or boat. The other objects keep their colors."
    : chinese ? `先点 A，再选 ${id.slice(5)}，然后点“用到场景里”。B 或 C 也可以。` : `Choose A, choose ${id.slice(5)}, then apply. B or C works too.`;
  return level === 2
    ? chinese ? `one 是一个，two 是两个。数的是${id === "word-one" ? "发光的贝壳，别的贝壳保持暗着" : "航行的小船，别的船仍然停泊"}。再点已选对象可撤回。` : `one means a single object; two means two different objects. Count only ${id === "word-one" ? "the shining shells" : "the sailing boats"}. Tap a selected object to put it back.`
    : chinese ? `试试选 ${id.slice(5)}，选 ${id === "word-one" ? "A" : "A 和 B"}，再执行。你也可以选别的${id === "word-one" ? "一枚" : "两艘"}。` : `Try ${id.slice(5)}, choose ${id === "word-one" ? "A" : "A and B"}, then apply. Other choices work too.`;
}

/** Presentation only. Rules/save commit before this starts; cancel never changes logical state. */
export function animatePilotMove(root: HTMLElement, move: ParkMove, reduced: boolean): () => void {
  const actor = root.querySelector<HTMLElement>(".pilot-actor");
  if (!actor || reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const from = LANDINGS.find(item => item.id === move.from)!, to = LANDINGS.find(item => item.id === move.to)!;
  const duration = move.word === "run" ? 850 : 1050;
  const sceneHeight = actor.parentElement!.clientHeight;
  const apex = Math.max(actor.offsetHeight * .9 + 6, (Math.min(from.y, to.y) - 14) / 100 * sceneHeight) / sceneHeight * 100;
  const movement = actor.animate(move.word === "run" ? [
    { left: `${from.x}%`, top: `${from.y}%` }, { left: `${to.x}%`, top: `${to.y}%` },
  ] : [
    { left: `${from.x}%`, top: `${from.y}%`, offset: 0 },
    { left: `${from.x}%`, top: `${from.y}%`, offset: .16 },
    { left: `${(from.x + to.x) / 2}%`, top: `${apex}%`, offset: .5 },
    { left: `${to.x}%`, top: `${to.y}%`, offset: .85 },
    { left: `${to.x}%`, top: `${to.y}%`, offset: 1 },
  ], { duration, easing: "linear" });
  actor.dataset.facing = to.x < from.x ? "left" : "right";
  let frame = 0, cancelled = false;
  const update = () => {
    if (cancelled) return;
    const time = Number(movement.currentTime ?? 0);
    if (time >= duration || movement.playState === "finished") { actor.dataset.pose = "idle"; return; }
    actor.dataset.pose = move.word === "run" ? Math.floor(time / 115) % 2 ? "run-b" : "run-a" : time < 170 ? "takeoff" : time < 890 ? "air" : "landing";
    frame = requestAnimationFrame(update);
  };
  update();
  return () => { cancelled = true; cancelAnimationFrame(frame); movement.cancel(); actor.dataset.pose = "idle"; };
}

export function animatePilotObjects(root: HTMLElement, before: PilotState, after: PilotState, reduced: boolean): () => void {
  if (before.kind !== "number" || after.kind !== "number" || reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const animations: Animation[] = [];
  for (const id of OBJECT_IDS) {
    if (before.active.includes(id) === after.active.includes(id)) continue;
    const boat = root.querySelector<HTMLElement>(`.pilot-object--boat[data-pilot-object="${id}"]`);
    if (boat) animations.push(boat.animate([{ top: before.active.includes(id) ? "18%" : "43%" }, { top: after.active.includes(id) ? "18%" : "43%" }], { duration: 850, easing: "ease-in-out" }));
  }
  return () => animations.forEach(animation => animation.cancel());
}

function messageZh(message: string): string | undefined {
  const translations: Record<string, string> = {
    "Choose a word and a landing. Then try it.": "选词卡和落点，再试着移动。",
    "Choose a word and objects. Then try it.": "选词卡和对象，再用到场景里。",
    "Choose a word first.": "先选一张词卡。",
    "Choose a marked landing first.": "先选一个有字母标记的落点。",
    "Already here. Choose another landing.": "角色已经在这里，请另选一个落点。",
    "No direct connection. Choose a neighboring landing.": "这里没有直达的路，请选相邻落点。",
    "There is a gap. Try jump here, or run along the continuous path.": "这里有小间隔。可以试 jump，或换连续道路用 run。",
    "Selection cleared. The scene stays the same.": "选择已撤回，场景保持原样。",
    "Scene reset. Choose a word and an object.": "场景已重来，选词卡和对象再试。",
    "Word selected. Choose where it will act.": "词卡已选中，再选它作用的位置或对象。",
    "Landing selected. Choose run or jump, then try it.": "落点已选中，选 run 或 jump，再试着移动。",
    "Object selected. Choose red or blue, then apply it.": "对象已选中，选 red 或 blue，再用到场景里。",
    "Selection changed. Only apply when the word and count match.": "选择已改变，选中的对象数量要和词卡相符。",
    "Choose one object first.": "先选一个对象。",
    "Choose one object. Tap a selected object to put it back.": "one 要选一个对象。再点已选对象可撤回。",
    "Choose two different objects. Tap a selected object to put it back.": "two 要选两个不同对象。再点已选对象可撤回。",
    "Word built. Now use the sentence in the scene.": "已拼好。现在把目标句用到场景里。",
    "Built with help. You can keep exploring, or build it yourself without fixed tiles.": "这次用了固定提示。可以继续探索，也可点“自己重新拼”。",
    "Look at the spelling blocks and try again.": "再看看拼写块，调整后试试。",
    "I can run.": "角色展示：我会跑。", "I can jump.": "角色展示：我会跳。",
    "The shell is red.": "所指的贝壳是红色的。", "The shell is blue.": "所指的贝壳是蓝色的。",
    "The boat is blue.": "所指的小船是蓝色的。", "The boat is red.": "所指的小船是红色的。",
    "One shell shines.": "恰好一枚贝壳发光。", "Two shells shine.": "恰好两枚贝壳发光。",
    "One boat sails.": "一艘小船航行，其他船仍停泊。", "Two boats sail.": "两艘小船航行，另一艘仍停泊。",
  };
  return translations[message];
}
