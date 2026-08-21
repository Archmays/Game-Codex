import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { clearElement, createButton, createFeedbackBanner, playFeedbackSound } from "../../packages/ui";
import type { FeedbackState } from "../../packages/ui";
import {
  clampArrayFactor,
  createArrayModel,
  createArrayTask,
  transposeArray,
  type ArrayModel,
  type ArrayWorkshopMode,
} from "./model";

export { getMultiplicationGridCount, getNumberBlockCount } from "./model";

export const multiplicationAdventureGame: GameDefinition = {
  id: "multiplication-adventure",
  title: "阵列工坊",
  description: "搭建、阅读并翻转真实方格阵列，看见行、列和乘积之间的关系。",
  subject: "数学",
  recommendedAge: "7-9 岁",
  learningGoal: "用行与列理解 1 到 9 的乘法事实和交换关系。",
  status: "数学世界模块",
  playLabel: "搭建阵列",
  mount(context: MountGameContext): MountedGame {
    return mountArrayWorkshop(context);
  },
};

function mountArrayWorkshop(context: MountGameContext): MountedGame {
  const root = document.createElement("section");
  root.className = "learning-game multiplication-game array-workshop";
  root.dataset.arrayRuntime = "rows-columns-v1";
  context.container.append(root);

  // Preserve legacy score-loop bytes without letting them drive the new experience.
  context.storage.get<unknown>("progress", null);

  let mode: ArrayWorkshopMode = "build";
  let taskIndex = 0;
  let task = createArrayTask("math-world-array-v1", taskIndex, mode);
  let model = createArrayModel(task.rows === 1 ? 2 : task.rows - 1, task.columns);
  let feedback: FeedbackState = { kind: "info", text: `请搭出 ${task.rows} 行 × ${task.columns} 列。` };
  let readChoices: readonly ArrayModel[] = createReadChoices(task.rows, task.columns);

  const render = (): void => {
    clearElement(root);
    root.append(createHeader("阵列工坊", "方格有几行、每行有几列，都能从阵列本身看见。"));

    const toolbar = document.createElement("div");
    toolbar.className = "learning-game__toolbar";
    for (const item of [
      { id: "build", label: "搭阵列" },
      { id: "read", label: "看阵列" },
      { id: "transpose", label: "翻转阵列" },
    ] as const) {
      toolbar.append(createButton(item.label, () => switchMode(item.id), {
        className: mode === item.id ? "ui-button learning-game__pill is-active" : "ui-button learning-game__pill",
      }));
    }

    const prompt = document.createElement("p");
    prompt.className = "array-workshop__prompt";
    prompt.textContent = mode === "build"
      ? `任务：搭出 ${task.rows} × ${task.columns}`
      : mode === "read"
        ? "任务：选择与眼前阵列完全一致的算式"
        : "任务：翻转阵列，观察总数是否改变";

    const workbench = document.createElement("section");
    workbench.className = "array-workshop__bench";
    workbench.setAttribute("aria-label", `${model.rowText}；${model.columnText}`);
    workbench.append(createArrayGrid(model), createArrayDescription(model));

    const controls = document.createElement("div");
    controls.className = "array-workshop__controls";
    if (mode === "build") {
      controls.append(
        dimensionControl("行", model.rows, (delta) => setDimensions(model.rows + delta, model.columns)),
        dimensionControl("列", model.columns, (delta) => setDimensions(model.rows, model.columns + delta)),
        createButton("检查阵列", checkBuild),
      );
    } else if (mode === "read") {
      for (const choice of readChoices) {
        controls.append(createButton(`${choice.rows} × ${choice.columns} = ${choice.product}`, () => checkRead(choice)));
      }
    } else {
      controls.append(createButton("翻转阵列", rotateArray), createButton("换一个阵列", nextTask, {
        className: "ui-button ui-button--secondary",
      }));
    }

    const actions = document.createElement("div");
    actions.className = "learning-game__actions";
    if (mode !== "transpose") actions.append(createButton("换一个任务", nextTask, { className: "ui-button ui-button--secondary" }));

    root.append(toolbar, prompt, workbench, controls, actions, createFeedbackBanner(feedback));
  };

  const switchMode = (nextMode: ArrayWorkshopMode): void => {
    mode = nextMode;
    taskIndex = 0;
    loadTask();
  };

  const loadTask = (): void => {
    task = createArrayTask("math-world-array-v1", taskIndex, mode);
    model = mode === "build"
      ? createArrayModel(task.rows === 1 ? 2 : task.rows - 1, task.columns)
      : createArrayModel(task.rows, task.columns);
    readChoices = createReadChoices(task.rows, task.columns);
    feedback = mode === "build"
      ? { kind: "info", text: `请搭出 ${task.rows} 行 × ${task.columns} 列。` }
      : mode === "read"
        ? { kind: "info", text: "先数行和列，再选择算式。" }
        : { kind: "info", text: `${model.expression}。试着把行和列交换。` };
    render();
  };

  const nextTask = (): void => {
    taskIndex += 1;
    loadTask();
  };

  const setDimensions = (rows: number, columns: number): void => {
    model = createArrayModel(clampArrayFactor(rows), clampArrayFactor(columns));
    feedback = { kind: "info", text: model.rowText };
    render();
  };

  const checkBuild = (): void => {
    const correct = model.rows === task.rows && model.columns === task.columns;
    feedback = correct
      ? { kind: "success", text: `你搭出了 ${model.rowText}。` }
      : { kind: "info", text: `现在是 ${model.rows} 行 × ${model.columns} 列；目标是 ${task.rows} 行 × ${task.columns} 列。` };
    playFeedbackSound(correct ? "success" : "info");
    render();
  };

  const checkRead = (choice: ArrayModel): void => {
    const correct = choice.rows === model.rows && choice.columns === model.columns;
    feedback = correct
      ? { kind: "success", text: `对：${model.rowText}。` }
      : { kind: "info", text: `再看看：横着数是 ${model.rows} 行，每行 ${model.columns} 个。` };
    playFeedbackSound(correct ? "success" : "info");
    render();
  };

  const rotateArray = (): void => {
    const before = model;
    model = transposeArray(model);
    feedback = {
      kind: "success",
      text: `${before.rows} × ${before.columns} 变成 ${model.rows} × ${model.columns}；方向变了，总数仍是 ${model.product}。`,
    };
    playFeedbackSound("success");
    render();
  };

  render();
  return { destroy() { root.remove(); } };
}

function createArrayGrid(model: ArrayModel): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "multiplication-array array-workshop__grid is-revealed";
  grid.style.setProperty("--array-columns", String(model.columns));
  grid.dataset.rows = String(model.rows);
  grid.dataset.columns = String(model.columns);
  grid.dataset.product = String(model.product);
  for (const id of model.cellIds) {
    const cell = document.createElement("i");
    cell.dataset.cellId = id;
    cell.setAttribute("aria-hidden", "true");
    grid.append(cell);
  }
  return grid;
}

function createArrayDescription(model: ArrayModel): HTMLElement {
  const description = document.createElement("div");
  description.className = "array-workshop__description";
  const expression = document.createElement("strong");
  expression.textContent = model.expression;
  const rows = document.createElement("span");
  rows.textContent = model.rowText;
  const columns = document.createElement("span");
  columns.textContent = model.columnText;
  description.append(expression, rows, columns);
  return description;
}

function dimensionControl(label: string, value: number, onChange: (delta: number) => void): HTMLElement {
  const control = document.createElement("div");
  control.className = "array-workshop__dimension";
  control.append(
    createButton(`${label} -`, () => onChange(-1), { className: "ui-button ui-button--secondary", disabled: value <= 1 }),
    Object.assign(document.createElement("output"), { textContent: `${label} ${value}` }),
    createButton(`${label} +`, () => onChange(1), { disabled: value >= 9 }),
  );
  return control;
}

function createReadChoices(rows: number, columns: number): readonly ArrayModel[] {
  const correct = createArrayModel(rows, columns);
  const swapped = createArrayModel(columns, rows);
  const nearby = createArrayModel(rows, columns === 9 ? 8 : columns + 1);
  const unique = new Map<string, ArrayModel>();
  for (const candidate of [nearby, correct, swapped]) unique.set(`${candidate.rows}:${candidate.columns}`, candidate);
  if (unique.size < 3) unique.set(`${rows === 9 ? 8 : rows + 1}:${columns}`, createArrayModel(rows === 9 ? 8 : rows + 1, columns));
  return [...unique.values()].slice(0, 3);
}

function createHeader(titleText: string, introText: string): HTMLElement {
  const header = document.createElement("header");
  header.className = "learning-game__header";
  const title = document.createElement("h2");
  title.textContent = titleText;
  const intro = document.createElement("p");
  intro.textContent = introText;
  header.append(title, intro);
  return header;
}
