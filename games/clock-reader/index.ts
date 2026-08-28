import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { clearElement, createButton, createFeedbackBanner, createStatus, playFeedbackSound, speakText } from "../../packages/ui";
import type { FeedbackState } from "../../packages/ui";
import {
  addClockMinutes,
  clockTtsText,
  createClockChallenge,
  deriveClockView,
  setClockMinuteByDial,
  type ClockChallengeMode,
} from "./model";

type ClockMode = "explore" | ClockChallengeMode;

export const clockReaderGame: GameDefinition = {
  id: "clock-reader",
  title: "时钟塔",
  description: "直接拨动同一座机械钟，观察分针走一圈时短针怎样连续前进。",
  subject: "数学",
  recommendedAge: "5-7 岁",
  learningGoal: "用一套一致的时间状态理解整点、半点、一刻和 5 分钟时间。",
  status: "数学世界模块",
  playLabel: "拨动时钟",
  mount(context: MountGameContext): MountedGame {
    return mountClockReader(context);
  },
};

function mountClockReader(context: MountGameContext): MountedGame {
  const root = document.createElement("section");
  root.className = "learning-game clock-game";
  root.dataset.clockRuntime = "minutes-since-midnight-v1";
  context.container.append(root);

  // Read the legacy record without rewriting or deleting its original bytes.
  context.storage.get<unknown>("progress", null);

  let mode: ClockMode = "explore";
  let minutesSinceMidnight = 3 * 60;
  let challengeIndex = 0;
  let targetMinutes: number | null = null;
  let feedback: FeedbackState = { kind: "info", text: "自由拨钟：拖动长针，或用按钮慢慢看看时间怎样变化。" };
  let activePointerId: number | null = null;
  let activeDial: { left: number; top: number; width: number; height: number } | null = null;
  let destroyed = false;

  const actionButton = (
    label: string,
    actionKey: string,
    onClick: () => void,
    options?: Parameters<typeof createButton>[2],
  ): HTMLButtonElement => {
    const control = createButton(label, onClick, options);
    control.dataset.clockAction = actionKey;
    return control;
  };

  const render = (focusKey?: string): void => {
    if (destroyed) return;
    clearElement(root);
    const view = deriveClockView(minutesSinceMidnight);
    root.append(createHeader("时钟塔", "长针和短针属于同一个时间；长针走动时，短针会一起前进。"));

    const toolbar = document.createElement("div");
    toolbar.className = "learning-game__toolbar";
    for (const item of [
      { id: "explore", label: "自由拨钟" },
      { id: "exact", label: "精确时间" },
      { id: "relative", label: "相对时间" },
    ] as const) {
      toolbar.append(actionButton(item.label, `mode-${item.id}`, () => switchMode(item.id, `mode-${item.id}`), {
        className: mode === item.id ? "ui-button learning-game__pill is-active" : "ui-button learning-game__pill",
      }));
    }

    const stats = document.createElement("div");
    stats.className = "learning-game__stats clock-readout";
    stats.append(
      createStatus("数字时间", view.digitalText),
      createStatus(mode === "relative" ? "相对表达" : "精确表达", mode === "relative" ? view.relativeText : view.exactText),
    );

    const stage = document.createElement("div");
    stage.className = "clock-stage";
    stage.append(createClock(minutesSinceMidnight), createControls());

    const actions = document.createElement("div");
    actions.className = "learning-game__actions";
    actions.append(actionButton("听时间", "listen", () => speakText(clockTtsText(minutesSinceMidnight, mode), "zh-CN", 0.9), {
      className: "ui-button ui-button--secondary",
    }));
    if (mode !== "explore") {
      actions.append(
        actionButton("我拨好了", "check", checkAnswer),
        actionButton("换一题", "next", nextChallenge, { className: "ui-button ui-button--secondary" }),
      );
    }

    root.append(toolbar, stats, stage, actions, createFeedbackBanner(feedback));
    if (focusKey) {
      queueMicrotask(() => {
        const target = focusKey === "dial"
          ? root.querySelector<HTMLElement>(".clock-face")
          : root.querySelector<HTMLButtonElement>(`[data-clock-action="${focusKey}"]`);
        target?.focus();
      });
    }
  };

  const switchMode = (nextMode: ClockMode, focusKey: string): void => {
    mode = nextMode;
    activePointerId = null;
    activeDial = null;
    if (mode === "explore") {
      targetMinutes = null;
      feedback = { kind: "info", text: "自由拨钟：拖动长针，或用按钮慢慢看看时间怎样变化。" };
      render(focusKey);
      return;
    }
    challengeIndex = 0;
    loadChallenge(focusKey);
  };

  const loadChallenge = (focusKey?: string): void => {
    if (mode === "explore") return;
    const challenge = createClockChallenge("math-world-clock-v1", challengeIndex, mode);
    targetMinutes = challenge.targetMinutes;
    minutesSinceMidnight = challenge.startingMinutes;
    const target = deriveClockView(targetMinutes);
    feedback = {
      kind: "info",
      text: mode === "exact"
        ? `请拨到 ${target.digitalText}（${target.exactText}）。`
        : `请拨到“${target.relativeText}”。这一轮只练相对表达。`,
    };
    render(focusKey);
  };

  const nextChallenge = (): void => {
    challengeIndex += 1;
    loadChallenge("next");
  };

  const changeTime = (delta: number, focusKey?: string): void => {
    minutesSinceMidnight = addClockMinutes(minutesSinceMidnight, delta);
    if (mode === "explore") feedback = { kind: "info", text: `现在是 ${deriveClockView(minutesSinceMidnight).exactText}。` };
    render(focusKey);
  };

  const checkAnswer = (): void => {
    if (targetMinutes === null) return;
    if (minutesSinceMidnight === targetMinutes) {
      const view = deriveClockView(minutesSinceMidnight);
      feedback = { kind: "success", text: `找到了：${mode === "relative" ? view.relativeText : `${view.digitalText}，${view.exactText}`}。` };
      playFeedbackSound("success");
    } else {
      feedback = { kind: "info", text: getClockMismatchHint(targetMinutes, minutesSinceMidnight) };
      playFeedbackSound("info");
    }
    render("check");
  };

  const createControls = (): HTMLElement => {
    const controls = document.createElement("div");
    controls.className = "clock-controls";
    controls.append(
      actionButton("时针 -", "hour-decrease", () => changeTime(-60, "hour-decrease"), { className: "ui-button ui-button--secondary" }),
      actionButton("时针 +", "hour-increase", () => changeTime(60, "hour-increase")),
      actionButton("分针 -5", "minute-decrease", () => changeTime(-5, "minute-decrease"), { className: "ui-button ui-button--secondary" }),
      actionButton("分针 +5", "minute-increase", () => changeTime(5, "minute-increase")),
    );
    return controls;
  };

  const createClock = (value: number): HTMLElement => {
    const view = deriveClockView(value);
    const clock = document.createElement("div");
    clock.className = "clock-face";
    clock.tabIndex = 0;
    clock.setAttribute("role", "slider");
    clock.setAttribute("aria-label", "拨动分针");
    clock.setAttribute("aria-valuemin", "0");
    clock.setAttribute("aria-valuemax", "719");
    clock.setAttribute("aria-valuenow", String(value));
    clock.setAttribute("aria-valuetext", `${view.digitalText}，${view.exactText}`);
    clock.addEventListener("pointerdown", (event) => {
      const rect = clock.getBoundingClientRect();
      activePointerId = event.pointerId;
      activeDial = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      updateFromPointer(event.clientX, event.clientY);
      event.preventDefault();
    });
    clock.addEventListener("keydown", (event) => {
      const deltas: Partial<Record<string, number>> = {
        ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5,
        PageDown: -60, PageUp: 60, Home: -value, End: 715 - value,
      };
      const delta = deltas[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      changeTime(delta, "dial");
    });

    for (let minute = 0; minute < 60; minute += 1) {
      const tick = document.createElement("i");
      tick.className = minute % 5 === 0 ? "clock-face__tick clock-face__tick--major" : "clock-face__tick";
      tick.style.setProperty("--clock-minute", String(minute));
      tick.style.setProperty("--clock-angle", `${minute * 6}deg`);
      clock.append(tick);
    }
    for (let minute = 0; minute < 60; minute += 5) {
      const label = document.createElement("span");
      label.className = "clock-face__minute-label";
      label.textContent = String(minute).padStart(2, "0");
      label.style.setProperty("--clock-minute", String(minute));
      label.style.setProperty("--clock-angle", `${minute * 6}deg`);
      label.style.setProperty("--clock-angle-reverse", `${minute * -6}deg`);
      clock.append(label);
    }
    for (let numberValue = 1; numberValue <= 12; numberValue += 1) {
      const angle = numberValue * 30;
      const number = document.createElement("span");
      number.className = "clock-face__number";
      number.textContent = String(numberValue);
      number.style.setProperty("--clock-index", String(numberValue));
      number.style.setProperty("--clock-angle", `${angle}deg`);
      number.style.setProperty("--clock-angle-reverse", `${-angle}deg`);
      clock.append(number);
    }
    const hourHand = document.createElement("i");
    hourHand.className = "clock-hand clock-hand--hour";
    hourHand.style.transform = `rotate(${view.hourHandAngle}deg)`;
    const minuteHand = document.createElement("i");
    minuteHand.className = "clock-hand clock-hand--minute";
    minuteHand.style.transform = `rotate(${view.minuteHandAngle}deg)`;
    const center = document.createElement("b");
    center.className = "clock-face__center";
    clock.append(hourHand, minuteHand, center);
    return clock;
  };

  const updateFromPointer = (clientX: number, clientY: number): void => {
    if (!activeDial) return;
    const x = clientX - (activeDial.left + activeDial.width / 2);
    const y = clientY - (activeDial.top + activeDial.height / 2);
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
    minutesSinceMidnight = setClockMinuteByDial(minutesSinceMidnight, angle / 6);
    if (mode === "explore") feedback = { kind: "info", text: `现在是 ${deriveClockView(minutesSinceMidnight).exactText}。` };
    render();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    updateFromPointer(event.clientX, event.clientY);
  };
  const onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    activeDial = null;
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  render();

  return {
    destroy(): void {
      destroyed = true;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.speechSynthesis?.cancel();
      root.remove();
    },
  };
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

export function getClockMismatchHint(
  targetValue: number | { readonly hour: number; readonly minute: number },
  currentValue: number | { readonly hour: number; readonly minute: number },
): string {
  const target = typeof targetValue === "number" ? deriveClockView(targetValue) : targetValue;
  const current = typeof currentValue === "number" ? deriveClockView(currentValue) : currentValue;
  if (target.hour !== current.hour) return `还没到目标。先看短针：目标在 ${target.hour} 点这一小时。`;
  if (target.minute !== current.minute) return `小时已经对了，再调分针到 ${String(target.minute).padStart(2, "0")} 分刻度。`;
  return "";
}
