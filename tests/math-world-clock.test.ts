import {
  addClockMinutes,
  clockTtsText,
  createClockChallenge,
  deriveClockView,
  normalizeMinutesSinceMidnight,
  setClockMinuteByDial,
} from "../games/clock-reader/model";

describe("Math World clock model", () => {
  it("derives all 144 five-minute states from one normalized truth", () => {
    for (let minutes = 0; minutes < 720; minutes += 5) {
      const view = deriveClockView(minutes);
      expect(view.minutesSinceMidnight).toBe(minutes);
      expect(view.minuteHandAngle).toBe(view.minute * 6);
      expect(view.hourHandAngle).toBe((view.hour % 12) * 30 + view.minute * 0.5);
      expect(view.digitalText).toMatch(/^(?:[1-9]|1[0-2]):[0-5][0-9]$/);
      expect(clockTtsText(minutes)).toBe(view.exactText);
    }
  });

  it("wraps the complete 12-hour range exactly", () => {
    expect(normalizeMinutesSinceMidnight(-1)).toBe(719);
    expect(normalizeMinutesSinceMidnight(720)).toBe(0);
    expect(addClockMinutes(715, 5)).toBe(0);
    expect(addClockMinutes(0, -5)).toBe(715);
    expect(deriveClockView(addClockMinutes(715, 5)).digitalText).toBe("12:00");
    expect(deriveClockView(addClockMinutes(0, -5)).digitalText).toBe("11:55");
  });

  it("moves the shared hour truth when the dial crosses twelve", () => {
    expect(setClockMinuteByDial(11 * 60 + 55, 5)).toBe(5);
    expect(setClockMinuteByDial(5, 55)).toBe(11 * 60 + 55);
    expect(deriveClockView(setClockMinuteByDial(3 * 60 + 25, 30)).hourHandAngle).toBe(105);
  });

  it("keeps precise and relative expressions in separate deterministic pools", () => {
    expect(deriveClockView(3 * 60 + 30).exactText).toBe("3 点 30 分");
    expect(deriveClockView(3 * 60 + 30).relativeText).toBe("3 点半");
    expect(deriveClockView(3 * 60 + 15).relativeText).toBe("3 点一刻");
    expect(clockTtsText(3 * 60 + 30, "relative")).toBe("3 点半");

    for (const mode of ["exact", "relative"] as const) {
      for (let index = 0; index < 80; index += 1) {
        const first = createClockChallenge("repeatable", index, mode);
        expect(createClockChallenge("repeatable", index, mode)).toEqual(first);
        expect(first.targetMinutes).toBeGreaterThanOrEqual(0);
        expect(first.targetMinutes).toBeLessThan(720);
        expect(first.startingMinutes).not.toBe(first.targetMinutes);
        expect(first.targetMinutes % (mode === "exact" ? 5 : 15)).toBe(0);
      }
    }
  });
});
