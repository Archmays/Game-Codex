export type ClockChallengeMode = "exact" | "relative";

export interface ClockView {
  readonly minutesSinceMidnight: number;
  readonly hour: number;
  readonly minute: number;
  readonly minuteHandAngle: number;
  readonly hourHandAngle: number;
  readonly digitalText: string;
  readonly exactText: string;
  readonly relativeText: string;
}

export interface ClockChallenge {
  readonly seed: string;
  readonly index: number;
  readonly mode: ClockChallengeMode;
  readonly targetMinutes: number;
  readonly startingMinutes: number;
}

export function normalizeMinutesSinceMidnight(value: number): number {
  const whole = Number.isFinite(value) ? Math.round(value) : 0;
  return ((whole % 720) + 720) % 720;
}

export function addClockMinutes(minutesSinceMidnight: number, delta: number): number {
  return normalizeMinutesSinceMidnight(minutesSinceMidnight + delta);
}

export function setClockMinuteByDial(minutesSinceMidnight: number, dialMinute: number): number {
  const currentMinute = normalizeMinutesSinceMidnight(minutesSinceMidnight) % 60;
  const nextMinute = ((Math.round(dialMinute / 5) * 5) % 60 + 60) % 60;
  let delta = nextMinute - currentMinute;
  if (delta > 30) delta -= 60;
  if (delta < -30) delta += 60;
  return addClockMinutes(minutesSinceMidnight, delta);
}

export function deriveClockView(minutesSinceMidnight: number): ClockView {
  const normalized = normalizeMinutesSinceMidnight(minutesSinceMidnight);
  const hourIndex = Math.floor(normalized / 60);
  const hour = hourIndex === 0 ? 12 : hourIndex;
  const minute = normalized % 60;
  return {
    minutesSinceMidnight: normalized,
    hour,
    minute,
    minuteHandAngle: minute * 6,
    hourHandAngle: (hour % 12) * 30 + minute * 0.5,
    digitalText: `${hour}:${String(minute).padStart(2, "0")}`,
    exactText: minute === 0 ? `${hour} 点整` : `${hour} 点 ${minute} 分`,
    relativeText: relativeClockText(hour, minute),
  };
}

export function clockTtsText(minutesSinceMidnight: number, mode: ClockChallengeMode | "explore" = "explore"): string {
  const view = deriveClockView(minutesSinceMidnight);
  return mode === "relative" ? view.relativeText : view.exactText;
}

export function createClockChallenge(seed: string, index: number, mode: ClockChallengeMode): ClockChallenge {
  const normalizedIndex = Math.max(0, Math.floor(index));
  const random = seededUnit(`${seed}:${mode}:${normalizedIndex}`);
  const slots = mode === "exact" ? 144 : 36;
  const slot = Math.floor(random * slots) % slots;
  const targetMinutes = mode === "exact"
    ? slot * 5
    : Math.floor(slot / 3) * 60 + [0, 15, 30][slot % 3];
  const offsetSteps = 1 + (hashString(`${seed}:offset:${mode}:${normalizedIndex}`) % 11);
  const direction = hashString(`${seed}:direction:${mode}:${normalizedIndex}`) % 2 === 0 ? 1 : -1;
  return {
    seed,
    index: normalizedIndex,
    mode,
    targetMinutes,
    startingMinutes: addClockMinutes(targetMinutes, direction * offsetSteps * 5),
  };
}

function relativeClockText(hour: number, minute: number): string {
  if (minute === 0) return `${hour} 点整`;
  if (minute === 15) return `${hour} 点一刻`;
  if (minute === 30) return `${hour} 点半`;
  if (minute === 45) return `差一刻 ${hour === 12 ? 1 : hour + 1} 点`;
  return `${hour} 点 ${minute} 分`;
}

function seededUnit(seed: string): number {
  let value = hashString(seed) || 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
